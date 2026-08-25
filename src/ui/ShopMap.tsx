/**
 * 카카오 지도 패널.
 *
 * 목록(`GET /api/v1/shops`)과 달리 지도는 `GET /api/v1/shops/map` 을 씁니다.
 * 보이는 영역만 조회하므로 전국 데이터를 한 번에 내려받지 않습니다.
 *
 * 앱키가 없거나 SDK 로드가 실패하면 좌표를 격자 위 상대 위치로 찍는 대체
 * 화면으로 자동 전환됩니다. 핀 클릭 → 상세는 그대로 동작하고 배경만 빠집니다.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { getShopsInBoundingBox } from '../api/shops';
import {
  clampCenterToKorea,
  loadKakaoSdk,
  MAP_IDLE_DEBOUNCE_MS,
  MAP_INIT_CENTER,
  MAP_INIT_LEVEL,
  MAP_MAX_LEVEL,
  normalizeBbox,
  SEOUL_BBOX,
  waitForSize,
} from '../map/kakao';
import type { Bbox } from '../map/kakao';
import type { KakaoCustomOverlay, KakaoMap, KakaoMaps } from '../types/kakao';
import type { PriorityGrade, ShopMapMarker } from '../types/shop';
import { gradeKey } from '../types/shop';
import { IconPinOff } from './icons';

interface Props {
  gu: string;
  businessType: string;
  priorityGrade: PriorityGrade | undefined;
  selectedId: number | null;
  onSelect: (shopId: number) => void;
  /** 우선순위 재계산처럼 점수가 바뀌는 일이 있었을 때 증가시키면 다시 조회한다. */
  refreshToken: number;
}

const LEGEND: Array<{ key: string; color: string; text: string }> = [
  { key: 'G1', color: 'var(--g-1)', text: '1등급 · 최우선' },
  { key: 'G2', color: 'var(--g-2)', text: '2등급 · 우선' },
  { key: 'G3', color: 'var(--g-3)', text: '3등급 · 검토' },
  { key: 'G4', color: 'var(--g-4)', text: '4등급 · 보류' },
  { key: 'NA', color: 'var(--g-na)', text: '미산정' },
];

function scoreText(m: ShopMapMarker): string {
  return m.score == null ? '–' : String(m.score);
}

/** 핀 내용이 달라졌을 때만 오버레이를 다시 만들기 위한 지문. */
function pinSignature(m: ShopMapMarker): string {
  return `${m.name}|${m.score}|${m.priorityGrade}|${m.latitude}|${m.longitude}`;
}

/** 카카오 CustomOverlay 안에 넣을 DOM 노드. React 밖이라 직접 만든다. */
function createPinNode(m: ShopMapMarker, selected: boolean, onClick: () => void): HTMLElement {
  const node = document.createElement('div');
  node.className = `pin pin-${gradeKey(m.priorityGrade)}${selected ? ' sel' : ''}`;
  node.dataset.pin = String(m.id);

  const label = document.createElement('div');
  label.className = 'lbl';
  label.textContent = `${m.name} · ${scoreText(m)}${m.score == null ? '' : '점'}`;

  const pill = document.createElement('div');
  pill.className = 'pill';
  pill.textContent = scoreText(m);

  node.append(label, pill);
  node.addEventListener('click', onClick);
  return node;
}

type OverlayEntry = { overlay: KakaoCustomOverlay; signature: string; selected: boolean };

export default function ShopMap({
  gu,
  businessType,
  priorityGrade,
  selectedId,
  onSelect,
  refreshToken,
}: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);

  const mapsRef = useRef<KakaoMaps | null>(null);
  const mapRef = useRef<KakaoMap | null>(null);
  const overlaysRef = useRef(new Map<string, OverlayEntry>());

  /** 늦게 도착한 응답이 최신 결과를 덮지 않도록 하는 순번. */
  const seqRef = useRef(0);
  /** 필터가 바뀐 뒤 결과가 화면 밖이면 한 번만 화면을 맞춰준다. */
  const autoFitRef = useRef(false);
  /** 한국 밖으로 나간 화면을 되돌리는 중(setCenter 재귀 방지). */
  const clampingRef = useRef(false);
  const idleTimerRef = useRef<number | undefined>(undefined);
  const resizeTimerRef = useRef<number | undefined>(undefined);

  const [markers, setMarkers] = useState<ShopMapMarker[]>([]);
  const [ready, setReady] = useState(false);
  /** 대체 화면으로 내려간 이유. 있으면 안내를 지우지 않는다. */
  const [stubReason, setStubReason] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  /**
   * 이벤트 리스너는 마운트 때 한 번만 등록하는데, 그 안에서 읽는 필터는 매 렌더
   * 바뀐다. ref 로 최신값을 흘려보내야 클로저가 옛 필터를 붙들지 않는다.
   */
  const filtersRef = useRef({ gu, businessType, priorityGrade });
  filtersRef.current = { gu, businessType, priorityGrade };
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  /** 현재 지도 화면의 bbox. SDK 가 없으면 서울 전역 고정값. */
  const currentBbox = useCallback((): Bbox => {
    const map = mapRef.current;
    if (!map) return SEOUL_BBOX;
    const b = map.getBounds();
    const sw = b.getSouthWest();
    const ne = b.getNorthEast();
    return normalizeBbox(sw.getLat(), sw.getLng(), ne.getLat(), ne.getLng());
  }, []);

  /**
   * 첫 화면(서울시청)이나 바뀐 필터의 결과가 보이는 영역 밖이면 지도만 텅 비어
   * 보인다. 그럴 때 한 번만 데이터가 있는 곳으로 화면을 맞춘다.
   */
  const autoFitIfEmpty = useCallback(async (found: ShopMapMarker[]) => {
    const map = mapRef.current;
    const maps = mapsRef.current;
    if (!map || !maps || !autoFitRef.current) return;
    autoFitRef.current = false;
    if (found.length) return;

    let wide: ShopMapMarker[];
    try {
      wide = await getShopsInBoundingBox({
        ...SEOUL_BBOX,
        gu: filtersRef.current.gu || undefined,
        businessType: filtersRef.current.businessType || undefined,
        priorityGrade: filtersRef.current.priorityGrade,
        limit: 500,
      });
    } catch {
      return;
    }

    const geo = wide.filter((s) => s.latitude != null && s.longitude != null);
    if (!geo.length) return;

    const bounds = new maps.LatLngBounds();
    for (const s of geo) {
      bounds.extend(new maps.LatLng(Number(s.latitude), Number(s.longitude)));
    }
    map.setBounds(bounds); // idle 이 돌면서 새 영역으로 다시 조회된다
  }, []);

  /** 보이는 영역(또는 서울 전역)의 마커를 다시 조회한다. */
  const refresh = useCallback(async () => {
    const seq = ++seqRef.current;
    const { gu: g, businessType: bt, priorityGrade: pg } = filtersRef.current;

    let rows: ShopMapMarker[];
    try {
      rows = await getShopsInBoundingBox({
        ...currentBbox(),
        gu: g || undefined,
        businessType: bt || undefined,
        priorityGrade: pg,
      });
    } catch (error) {
      // 통신 실패는 '결과 0건'과 다르다. 핀을 지우면 지도가 꺼졌다 켜진 것처럼 보인다.
      if (seq !== seqRef.current) return;
      setNote(`지도 조회 실패 — ${(error as Error).message}. 직전 결과를 그대로 표시합니다.`);
      return;
    }

    if (seq !== seqRef.current) return; // 더 최신 요청이 이미 나갔다
    setNote(null);
    setMarkers(rows);
    void autoFitIfEmpty(rows);
  }, [currentBbox, autoFitIfEmpty]);

  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  /** 보이는 영역이 국내를 벗어났으면 중심을 밀어 넣는다. */
  const clampToKorea = useCallback(() => {
    const map = mapRef.current;
    const maps = mapsRef.current;
    if (!map || !maps || clampingRef.current) return;

    const b = map.getBounds();
    const sw = b.getSouthWest();
    const ne = b.getNorthEast();
    const center = map.getCenter();

    const next = clampCenterToKorea(
      { lat: center.getLat(), lng: center.getLng() },
      { lat: Math.abs(ne.getLat() - sw.getLat()), lng: Math.abs(ne.getLng() - sw.getLng()) },
    );
    if (!next) return;

    clampingRef.current = true;
    map.setCenter(new maps.LatLng(next.lat, next.lng));
    clampingRef.current = false;
  }, []);

  /**
   * 컨테이너가 `display:none` 이었다가 돌아오면 카카오는 크기를 0 으로 기억한다.
   * 그대로 두면 타일이 안 그려지거나 반쪽만 나온다. 보일 때마다 알려준다.
   */
  const relayout = useCallback(() => {
    const map = mapRef.current;
    const host = hostRef.current;
    if (!map || !host || !host.offsetWidth || !host.offsetHeight) return;
    const center = map.getCenter();
    map.relayout();
    map.setCenter(center);
  }, []);

  // ── 마운트: SDK 로드 → 지도 생성 → 리스너 등록 ────────────────────────────
  useEffect(() => {
    let disposed = false;

    void (async () => {
      const host = hostRef.current;
      if (!host) return;

      let maps: KakaoMaps;
      try {
        maps = await loadKakaoSdk();
      } catch (error) {
        if (disposed) return;
        setStubReason((error as Error).message);
        setReady(false);
        void refreshRef.current(); // 대체 화면도 데이터는 그대로 보여준다
        return;
      }
      if (disposed) return;

      /* 크기가 0 일 때 지도를 만들면 카카오가 그 크기를 기억해 타일을 한 조각만
         그린다. 새로고침 직후 지도가 깨져 보이던 원인이라 크기를 기다린다. */
      await waitForSize(host);
      if (disposed) return;

      host.innerHTML = ''; // StrictMode 재실행으로 남은 이전 인스턴스 정리

      const map = new maps.Map(host, {
        center: new maps.LatLng(MAP_INIT_CENTER.lat, MAP_INIT_CENTER.lng),
        level: MAP_INIT_LEVEL,
      });
      map.addControl(new maps.ZoomControl(), maps.ControlPosition.RIGHT);
      map.setMaxLevel(MAP_MAX_LEVEL); // 더 축소하면 국내 타일 밖이 보인다

      mapsRef.current = maps;
      mapRef.current = map;
      setStubReason(null);
      setReady(true);

      /* 지도 이동·확대가 끝날 때마다 보이는 영역만 다시 조회한다.
         드래그 한 번에 idle 이 여러 번 오므로 묶어서 마지막 것만 처리한다. */
      maps.event.addListener(map, 'idle', () => {
        clampToKorea();
        window.clearTimeout(idleTimerRef.current);
        idleTimerRef.current = window.setTimeout(
          () => void refreshRef.current(),
          MAP_IDLE_DEBOUNCE_MS,
        );
      });

      /* 사용자가 지도를 직접 잡은 순간부터는 자동 맞춤을 포기한다. 안 그러면
         핀이 있는 곳으로 옮기는 도중 지도가 튕겨서 "옮겼더니 숫자가 사라졌다"
         처럼 보인다. */
      for (const ev of ['dragstart', 'zoom_start']) {
        maps.event.addListener(map, ev, () => {
          autoFitRef.current = false;
        });
      }

      void refreshRef.current();
    })();

    return () => {
      disposed = true;
      window.clearTimeout(idleTimerRef.current);
      window.clearTimeout(resizeTimerRef.current);
    };
  }, [clampToKorea]);

  /**
   * 첫 페인트 이후에도 폭이 또 바뀐다(목록 렌더로 스크롤바 등장, 웹폰트 적용,
   * 목록 전용 보기로 접었다 펴기, 창 크기). 달라질 때마다 relayout 한다.
   */
  useEffect(() => {
    if (!ready) return;
    const host = hostRef.current;
    if (!host) return;

    const schedule = () => {
      window.clearTimeout(resizeTimerRef.current);
      resizeTimerRef.current = window.setTimeout(relayout, 80);
    };

    if (typeof ResizeObserver !== 'function') {
      window.addEventListener('resize', schedule);
      return () => window.removeEventListener('resize', schedule);
    }

    const ro = new ResizeObserver(() => {
      if (!host.offsetWidth || !host.offsetHeight) return; // 숨겨진 동안은 건너뛴다
      schedule();
    });
    ro.observe(host);
    document.fonts?.ready.then(relayout).catch(() => {});
    return () => ro.disconnect();
  }, [ready, relayout]);

  // ── 필터·재계산: 화면 맞춤을 한 번 허용하고 다시 조회 ─────────────────────
  useEffect(() => {
    autoFitRef.current = true;
    void refresh();
  }, [gu, businessType, priorityGrade, refreshToken, refresh]);

  // ── 카카오 오버레이 렌더 ─────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    const maps = mapsRef.current;
    if (!ready || !map || !maps) return;

    const geo = markers.filter((m) => m.latitude != null && m.longitude != null);
    const next = new Map<string, OverlayEntry>();

    for (const m of geo) {
      const key = String(m.id);
      const signature = pinSignature(m);
      const selected = m.id === selectedId;
      let entry = overlaysRef.current.get(key);

      if (!entry || entry.signature !== signature || entry.selected !== selected) {
        entry?.overlay.setMap(null);
        const overlay = new maps.CustomOverlay({
          position: new maps.LatLng(Number(m.latitude), Number(m.longitude)),
          content: createPinNode(m, selected, () => onSelectRef.current(m.id)),
          yAnchor: 1,
          clickable: true,
          zIndex: selected ? 10 : 1,
        });
        overlay.setMap(map);
        entry = { overlay, signature, selected };
      }
      next.set(key, entry);
    }

    // 화면 밖으로 나간 것만 걷어낸다. 전부 지웠다 다시 그리면 매 이동마다 깜빡인다.
    for (const [key, entry] of overlaysRef.current) {
      if (!next.has(key)) entry.overlay.setMap(null);
    }
    overlaysRef.current = next;
  }, [ready, markers, selectedId]);

  // 언마운트 시 남은 오버레이 정리. 안 지우면 지도만 사라지고 핀이 떠 있는다.
  useEffect(
    () => () => {
      for (const entry of overlaysRef.current.values()) entry.overlay.setMap(null);
      overlaysRef.current = new Map();
    },
    [],
  );

  // ── 목록에서 매장을 고르면 그 위치로 이동 ────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    const maps = mapsRef.current;
    if (!ready || !map || !maps || selectedId == null) return;

    const target = markers.find((m) => m.id === selectedId);
    if (!target || target.latitude == null || target.longitude == null) return;

    map.setLevel(4);
    map.panTo(new maps.LatLng(Number(target.latitude), Number(target.longitude)));
  }, [ready, selectedId, markers]);

  const geo = markers.filter((m) => m.latitude != null && m.longitude != null);

  return (
    <div className="mapwrap">
      <div ref={hostRef} className={`kakaomap${ready ? ' on' : ''}`} />
      {!ready && <StubPins markers={geo} selectedId={selectedId} onSelect={onSelect} />}

      <div className="map-topleft">
        {stubReason && (
          <div className="map-note">
            <b>카카오 지도를 쓸 수 없어 대체 화면으로 표시합니다</b> — {stubReason}.<br />
            <code>VITE_KAKAO_APP_KEY</code> 에 JavaScript 키를 넣고, 카카오 개발자 콘솔의{' '}
            <b>플랫폼 &gt; Web</b> 에 <code>{location.origin}</code> 을 등록하세요.
          </div>
        )}
        {note && <div className="map-note">{note}</div>}

        <div className="map-legend">
          {LEGEND.map((l) => (
            <div className="row" key={l.key}>
              <i style={{ background: l.color }} />
              {l.text}
            </div>
          ))}
        </div>
      </div>

      <div className="map-count">
        <b>{geo.length}</b>개 표시
      </div>

      {geo.length === 0 && (
        <div className={`map-blocked${ready ? ' soft' : ''}`}>
          <div className="mb-card">
            <IconPinOff />
            <b>표시할 매장이 없습니다</b>
            <p>
              {ready
                ? '지도를 옮기거나 축소해 보세요. 필터가 좁으면 이 영역에 결과가 없을 수 있습니다.'
                : '필터를 바꾸거나, 좌표가 있는 매장이 있는지 확인하세요.'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * 대체 화면: 좌표를 컨테이너 안 상대 위치로 환산해서 찍는다.
 * 배경이 없을 뿐 핀 클릭 → 상세는 그대로 동작한다.
 */
function StubPins({
  markers,
  selectedId,
  onSelect,
}: {
  markers: ShopMapMarker[];
  selectedId: number | null;
  onSelect: (shopId: number) => void;
}) {
  if (!markers.length) return <div className="map-stub" />;

  const lats = markers.map((m) => Number(m.latitude));
  const lngs = markers.map((m) => Number(m.longitude));
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  // 한 점뿐이면 폭이 0 이라 나누기가 터진다. 그때는 한가운데.
  const span = (min: number, max: number, v: number) =>
    max - min < 1e-9 ? 50 : 12 + ((v - min) / (max - min)) * 76;

  return (
    <div className="map-stub">
      {markers.map((m) => (
        <button
          key={m.id}
          type="button"
          className={`pin pin-${gradeKey(m.priorityGrade)}${m.id === selectedId ? ' sel' : ''}`}
          style={{
            position: 'absolute',
            left: `${span(minLng, maxLng, Number(m.longitude)).toFixed(1)}%`,
            top: `${(100 - span(minLat, maxLat, Number(m.latitude))).toFixed(1)}%`,
          }}
          onClick={() => onSelect(m.id)}
        >
          <span className="lbl">
            {m.name} · {scoreText(m)}
            {m.score == null ? '' : '점'}
          </span>
          <span className="pill">{scoreText(m)}</span>
        </button>
      ))}
    </div>
  );
}
