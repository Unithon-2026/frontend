/**
 * 카카오 지도 SDK 로더와, 지도 동작에 필요한 순수 계산들.
 *
 * React 컴포넌트에서 떼어 놓은 이유는 두 가지다.
 *   - SDK 로드는 문서 전역에 한 번뿐인 일이라 컴포넌트 생명주기와 무관하다.
 *   - 좌표 계산은 SDK 없이도 검증할 수 있어야 한다.
 */

import type { KakaoMaps } from '../types/kakao';
import type { ShopMapParams } from '../types/shop';

const SDK_URL = 'https://dapi.kakao.com/v2/maps/sdk.js';

/**
 * JavaScript 앱키. 빌드 시점의 환경변수를 먼저 보고, 없으면 localStorage 를 본다.
 *
 * Vercel 에서는 프로젝트 설정의 Environment Variables 에 `VITE_KAKAO_APP_KEY` 를
 * 넣는 것이 정석이다. localStorage 는 키를 아직 배포에 넣지 않았을 때
 * 브라우저 콘솔에서 즉석으로 시험해 보라고 남겨 둔 뒷문이다.
 */
export function readKakaoAppKey(): string {
  const fromEnv = import.meta.env?.VITE_KAKAO_APP_KEY;
  if (fromEnv) return String(fromEnv);
  try {
    return localStorage.getItem('meetroute.kakaoKey') ?? '';
  } catch {
    return '';
  }
}

/** 서울 시청 부근. 최초 중심점. */
export const MAP_INIT_CENTER = { lat: 37.5665, lng: 126.978 };
export const MAP_INIT_LEVEL = 7;

/** SDK 를 못 쓸 때 대체 화면이 조회하는 기본 영역(서울 전역). */
export const SEOUL_BBOX = {
  minLatitude: 37.41,
  maxLatitude: 37.7,
  minLongitude: 126.76,
  maxLongitude: 127.19,
};

/**
 * 카카오 지도는 국내 타일만 제공한다. 이 밖으로 나가면 회색 여백만 보이므로
 * 화면(중심이 아니라 보이는 영역 전체)이 이 안에 머물도록 잡아둔다.
 * 제주(33.1)·울릉(130.9)·독도(131.9)까지 포함하는 범위.
 */
export const KOREA_BOUNDS = { minLat: 33.0, maxLat: 38.7, minLng: 124.5, maxLng: 132.0 };

/** 카카오 레벨은 숫자가 클수록 축소. 14 까지 가면 한반도가 점이 되고 주변이 다 빈다. */
export const MAP_MAX_LEVEL = 13;

/** 지도 이동 중 idle 이 연달아 터진다. 그때마다 조회하면 핀이 명멸한다. */
export const MAP_IDLE_DEBOUNCE_MS = 220;

let sdkPromise: Promise<KakaoMaps> | null = null;

/**
 * SDK 를 한 번만 받아서 캐시한다.
 *
 * `autoload=false` 로 받아 `kakao.maps.load()` 로 초기화 시점을 직접 잡는다.
 * 그러지 않으면 스크립트 onload 와 실제 준비 완료 사이에 틈이 생겨,
 * 그 틈에 `new kakao.maps.Map` 을 부르면 조용히 실패한다.
 */
export function loadKakaoSdk(): Promise<KakaoMaps> {
  if (sdkPromise) return sdkPromise;

  /* 이미 올라와 있으면 그대로 쓴다. 앱키 검사보다 먼저 보는 이유는, SDK 가
     다른 경로로(호스트 페이지의 <script>, 테스트의 주입) 이미 로드된 경우
     앱키가 없다고 거부하면 멀쩡한 지도를 버리게 되기 때문이다. */
  if (window.kakao?.maps) {
    sdkPromise = Promise.resolve(window.kakao.maps);
    return sdkPromise;
  }

  const appKey = readKakaoAppKey();
  if (!appKey) {
    return Promise.reject(new Error('카카오 JavaScript 앱키가 설정되지 않았습니다'));
  }

  sdkPromise = new Promise<KakaoMaps>((resolve, reject) => {
    const el = document.createElement('script');
    el.src = `${SDK_URL}?appkey=${encodeURIComponent(appKey)}&autoload=false`;
    el.onload = () => {
      const maps = window.kakao?.maps;
      if (!maps) {
        reject(new Error('SDK 를 불러왔지만 kakao.maps 가 없습니다'));
        return;
      }
      maps.load(() => resolve(maps));
    };
    el.onerror = () =>
      reject(new Error('SDK 스크립트를 불러오지 못했습니다 (앱키·도메인 등록을 확인하세요)'));
    document.head.appendChild(el);
  });

  // 실패한 약속을 캐시해 두면 새로고침 전까지 영원히 실패한다.
  sdkPromise.catch(() => {
    sdkPromise = null;
  });

  return sdkPromise;
}

/**
 * 컨테이너가 실제 크기를 가질 때까지 기다린다.
 *
 * 크기가 0 일 때 지도를 만들면 카카오가 그 크기를 기억해 타일을 한 조각만
 * 그리고 나머지는 흰 채로 남는다(새로고침 직후 지도가 깨져 보이던 원인).
 * 단, 좁은 화면에서 컨테이너가 `display:none` 이면 기다려도 소용없으므로
 * 바로 진행하고, 넓어지는 순간 ResizeObserver 가 relayout 을 걸어준다.
 */
export function waitForSize(el: HTMLElement, timeoutMs = 1200): Promise<void> {
  const sized = () => el.offsetWidth > 0 && el.offsetHeight > 0;
  const hidden = () => el.offsetParent === null;
  if (sized() || hidden()) return Promise.resolve();

  return new Promise((resolve) => {
    const started = Date.now();
    const poll = () => {
      if (sized() || hidden() || Date.now() - started > timeoutMs) {
        resolve();
        return;
      }
      requestAnimationFrame(poll);
    };
    poll();
  });
}

export interface Bbox {
  minLatitude: number;
  maxLatitude: number;
  minLongitude: number;
  maxLongitude: number;
}

/**
 * 남서/북동 좌표를 백엔드가 받는 bbox 로 정규화한다.
 *
 * 크게 축소하면 `getBounds()` 가 뒤집히거나 경도 ±180 을 넘어오기도 한다.
 * 그대로 넘기면 '조건에 맞는 게 하나도 없는' 질의가 되어 핀이 통째로 사라지므로,
 * 정렬한 뒤 국내 범위로 잘라낸다.
 */
export function normalizeBbox(
  swLat: number,
  swLng: number,
  neLat: number,
  neLng: number,
): Bbox {
  const lat1 = Math.min(swLat, neLat);
  const lat2 = Math.max(swLat, neLat);
  const lng1 = Math.min(swLng, neLng);
  const lng2 = Math.max(swLng, neLng);
  return {
    minLatitude: Math.max(lat1, KOREA_BOUNDS.minLat),
    maxLatitude: Math.min(lat2, KOREA_BOUNDS.maxLat),
    minLongitude: Math.max(lng1, KOREA_BOUNDS.minLng),
    maxLongitude: Math.min(lng2, KOREA_BOUNDS.maxLng),
  };
}

/**
 * 보이는 영역이 국내를 벗어나지 않도록 중심을 밀어 넣은 결과를 돌려준다.
 *
 * 중심만 검사하면 화면 절반이 빈 채로 남으므로, 화면 폭·높이를 빼고 남은
 * 여유 안에서 가둔다. 현재 배율이 한국보다 넓으면 가둘 수 없으므로 한가운데로.
 * 움직일 필요가 없으면 `null` 을 돌려 호출부가 setCenter 를 건너뛰게 한다.
 */
export function clampCenterToKorea(
  center: { lat: number; lng: number },
  span: { lat: number; lng: number },
): { lat: number; lng: number } | null {
  const fit = (lo: number, hi: number, width: number, v: number) => {
    const half = width / 2;
    if (hi - lo <= width) return (lo + hi) / 2; // 화면이 더 넓다 → 한가운데
    return Math.min(Math.max(v, lo + half), hi - half);
  };

  const lat = fit(KOREA_BOUNDS.minLat, KOREA_BOUNDS.maxLat, span.lat, center.lat);
  const lng = fit(KOREA_BOUNDS.minLng, KOREA_BOUNDS.maxLng, span.lng, center.lng);

  if (Math.abs(lat - center.lat) < 1e-7 && Math.abs(lng - center.lng) < 1e-7) return null;
  return { lat, lng };
}

/** bbox + 필터를 `GET /api/v1/shops/map` 파라미터로 합친다. */
export function toMapParams(
  bbox: Bbox,
  filters: Pick<ShopMapParams, 'gu' | 'businessType' | 'priorityGrade' | 'limit'>,
): ShopMapParams {
  return { ...bbox, ...filters };
}
