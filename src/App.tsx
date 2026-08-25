import { useCallback, useEffect, useMemo, useState } from 'react';
import AuthBar, { readStoredUser, writeStoredUser } from './ui/AuthBar';
import Banner from './ui/Banner';
import type { Conn } from './ui/Banner';
import Filters from './ui/Filters';
import Sidebar from './ui/Sidebar';
import type { ViewName } from './ui/Sidebar';
import ShopList from './ui/ShopList';
import ShopMap from './ui/ShopMap';
import ShopDrawer from './ui/ShopDrawer';
import SavedView from './ui/SavedView';
import CrmView from './ui/CrmView';
import TeamView from './ui/TeamView';
import DataView from './ui/DataView';
import { getShops, SHOP_LIST_DEFAULT_PAGE } from './api/shops';
import { calculateAllPriorities } from './api/priority';
import { readCachedFacets, scanFacets } from './api/facets';
import type { Facets } from './api/facets';
import { getApiBaseUrl } from './api/client';
import { useSavedActivities } from './hooks/useSavedActivities';
import { clearWatchlist, readWatchlist, toggleWatch } from './store/watchlist';
import type { WatchEntry } from './store/watchlist';
import { clearBriefings } from './store/briefingCache';
import type { Page } from './types/api';
import type { AuthUser } from './types/auth';
import type { GradeLabelValue, PriorityGrade, ShopDetail, ShopListItem } from './types/shop';
import { LABEL_TO_GRADE } from './types/shop';

const SORT_OPTIONS = [
  { value: 'score,desc', label: '점수 높은 순' },
  { value: 'score,asc', label: '점수 낮은 순' },
  { value: 'name,asc', label: '이름순' },
];

/** 브레드크럼·제목에 쓰는 이름. 사이드바 항목과 같은 순서. */
const VIEW_TITLE: Record<ViewName, string> = {
  explore: '매장 탐색',
  saved: '관심 목록',
  crm: 'AI CRM 후속 영업',
  team: '팀 영업 현황',
  data: '데이터 관리',
};

export default function App() {
  const [view, setView] = useState<ViewName>('explore');
  const [conn, setConn] = useState<Conn>({ state: 'loading' });
  const [user, setUser] = useState<AuthUser | null>(() => readStoredUser());

  const [gu, setGu] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [gradeValue, setGradeValue] = useState<GradeLabelValue>('');
  const [sort, setSort] = useState(SORT_OPTIONS[0]!.value);
  const [pageNumber, setPageNumber] = useState(0);
  const [showMap, setShowMap] = useState(true);

  const [page, setPage] = useState<Page<ShopListItem> | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const [watchlist, setWatchlist] = useState<WatchEntry[]>(() => readWatchlist());
  const [facets, setFacets] = useState<Facets | null>(() => readCachedFacets());
  const [scanning, setScanning] = useState(false);

  const [batchNote, setBatchNote] = useState<string | null>(null);
  const [batchBusy, setBatchBusy] = useState(false);
  /** 점수가 바뀌는 일이 있을 때마다 올려 목록·지도를 함께 다시 받는다. */
  const [refreshToken, setRefreshToken] = useState(0);

  const priorityGrade: PriorityGrade | undefined = gradeValue
    ? LABEL_TO_GRADE[gradeValue]
    : undefined;

  const savedIds = useMemo(() => new Set(watchlist.map((e) => e.id)), [watchlist]);

  /* 관심 목록·CRM·팀 화면이 같은 방문 이력을 본다. 한 번만 읽어 공유한다.
     탐색 화면에서는 쓰지 않으므로 그때는 요청을 아예 내지 않는다. */
  const activityIds = useMemo(
    () => (view === 'explore' ? [] : watchlist.map((e) => e.id)),
    [view, watchlist],
  );
  const {
    activities,
    loading: activitiesLoading,
    reload: reloadActivities,
  } = useSavedActivities(activityIds, user !== null);

  // ── 목록 조회 ────────────────────────────────────────────────────────────
  useEffect(() => {
    const ac = new AbortController();
    setLoading(true);

    void (async () => {
      try {
        const result = await getShops(
          { gu: gu || undefined, businessType: businessType || undefined, priorityGrade },
          { ...SHOP_LIST_DEFAULT_PAGE, page: pageNumber, sort },
          ac.signal,
        );
        if (ac.signal.aborted) return;
        setPage(result);
        setConn({ state: 'live', total: result.totalElements });
      } catch (error) {
        if (ac.signal.aborted) return;
        setPage(null);
        setConn({ state: 'down', reason: (error as Error).message });
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    })();

    return () => ac.abort();
  }, [gu, businessType, priorityGrade, pageNumber, sort, refreshToken]);

  // ── 드롭다운 후보값 스캔 (캐시가 없을 때 한 번) ──────────────────────────
  const rescanFacets = useCallback(async () => {
    setScanning(true);
    try {
      setFacets(await scanFacets());
    } catch {
      // 백엔드가 죽어 있으면 배너가 이미 알리고 있다. 여기서 또 떠들지 않는다.
    } finally {
      setScanning(false);
    }
  }, []);

  useEffect(() => {
    if (facets || conn.state !== 'live') return;
    void rescanFacets();
  }, [facets, conn.state, rescanFacets]);

  const onAuthChange = useCallback((next: AuthUser | null) => {
    writeStoredUser(next);
    setUser(next);
    /* 브리핑에는 본인 방문 메모가 섞여 있다. 로그아웃하면 남겨 두지 않는다 —
       한 브라우저를 여러 사람이 쓰면 남의 메모가 캐시로 보일 수 있다. */
    if (next === null) clearBriefings();
  }, []);

  /** 서버가 COMMON401 을 주면 세션이 끊긴 것이므로 화면 상태도 되돌린다. */
  const onUnauthorized = useCallback(() => onAuthChange(null), [onAuthChange]);

  const onToggleSave = useCallback((shop: ShopListItem | ShopDetail | WatchEntry) => {
    setWatchlist((prev) =>
      toggleWatch(prev, {
        id: shop.id,
        name: shop.name,
        gu: shop.gu,
        dong: shop.dong,
        businessType: shop.businessType,
        score: shop.score,
        priorityGrade: shop.priorityGrade,
      }),
    );
  }, []);

  const target = useMemo(() => getApiBaseUrl() || `${location.origin} (프록시)`, []);

  async function onBatch() {
    setBatchBusy(true);
    setBatchNote('전체 매장 우선순위를 계산하는 중…');
    try {
      const r = await calculateAllPriorities();
      setBatchNote(
        `완료 — 전체 ${r.totalShopCount.toLocaleString('ko-KR')}건 중 ` +
          `${r.processedCount.toLocaleString('ko-KR')}건 처리 · ${(r.elapsedMillis / 1000).toFixed(1)}초`,
      );
      setPageNumber(0);
      setRefreshToken((n) => n + 1);
    } catch (error) {
      setBatchNote('일괄 계산 실패: ' + (error as Error).message);
    } finally {
      setBatchBusy(false);
    }
  }

  /** 제목 오른쪽의 회색 부연. 화면마다 다르다. */
  const subtitle =
    view === 'explore'
      ? gu || '서울 전역'
      : view === 'saved'
        ? `${watchlist.length}건 저장됨`
        : view === 'crm'
          ? '관심 목록 기준'
          : view === 'team'
            ? (user?.name ?? '비로그인')
            : '실데이터 집계';

  return (
    <div className="app">
      <Sidebar
        view={view}
        onView={setView}
        exploreCount={page?.totalElements ?? null}
        savedCount={watchlist.length}
        user={user}
      />

      <div className="main">
        <div className="topbar">
          <div className="topbar-row">
            <div className="grow">
              <div className="crumbs">영업 · {VIEW_TITLE[view]}</div>
              <h1>
                {VIEW_TITLE[view]} <span>— {subtitle}</span>
              </h1>
            </div>
            <AuthBar user={user} onChange={onAuthChange} disabled={conn.state === 'loading'} />
          </div>
        </div>

        <section className="view">
          {view === 'explore' && (
            <>
              <Banner conn={conn} target={target} />

              <Filters
                gu={gu}
                businessType={businessType}
                grade={gradeValue}
                showMap={showMap}
                facets={facets}
                scanning={scanning}
                onGu={(v) => {
                  setGu(v);
                  setPageNumber(0);
                }}
                onBusinessType={(v) => {
                  setBusinessType(v);
                  setPageNumber(0);
                }}
                onGrade={(v) => {
                  setGradeValue(v);
                  setPageNumber(0);
                }}
                onShowMap={setShowMap}
                onRescan={() => void rescanFacets()}
              />

              <div className={`split${showMap ? '' : ' mapoff'}`}>
                <div>
                  <div className="panel-head">
                    <div>
                      <span className="t">우선순위 결과</span>{' '}
                      <span className="n">
                        · 총 {page ? page.totalElements.toLocaleString('ko-KR') : '–'}건
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <button
                        type="button"
                        className="pgbtn"
                        disabled={batchBusy || conn.state !== 'live'}
                        onClick={onBatch}
                        title="전체 매장의 우선순위를 다시 계산합니다"
                      >
                        {batchBusy ? '계산 중…' : '전체 재계산'}
                      </button>
                      <select
                        className="sortsel"
                        value={sort}
                        onChange={(e) => {
                          setSort(e.target.value);
                          setPageNumber(0);
                        }}
                      >
                        {SORT_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {batchNote && (
                    <p className="msg" style={{ margin: '-6px 0 10px' }}>
                      {batchNote}
                    </p>
                  )}

                  <ShopList
                    page={page}
                    loading={loading}
                    selectedId={selectedId}
                    savedIds={savedIds}
                    filtered={gu !== '' || businessType !== '' || gradeValue !== ''}
                    onSelect={(shop) => setSelectedId(shop.id)}
                    onToggleSave={onToggleSave}
                    onPage={setPageNumber}
                  />
                </div>

                {showMap && (
                  <ShopMap
                    gu={gu}
                    businessType={businessType}
                    priorityGrade={priorityGrade}
                    selectedId={selectedId}
                    onSelect={setSelectedId}
                    refreshToken={refreshToken}
                  />
                )}
              </div>
            </>
          )}

          {view === 'saved' && (
            <SavedView
              entries={watchlist}
              activities={activities}
              loadingActivities={activitiesLoading}
              loggedIn={user !== null}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onToggleSave={onToggleSave}
              onClearAll={() => setWatchlist(clearWatchlist())}
            />
          )}

          {view === 'crm' && (
            <CrmView
              entries={watchlist}
              activities={activities}
              loading={activitiesLoading}
              loggedIn={user !== null}
              onSelect={setSelectedId}
            />
          )}

          {view === 'team' && (
            <TeamView
              user={user}
              entries={watchlist}
              activities={activities}
              loading={activitiesLoading}
              onSelect={setSelectedId}
            />
          )}

          {view === 'data' && <DataView onPriorityChanged={() => setRefreshToken((n) => n + 1)} />}
        </section>
      </div>

      <ShopDrawer
        shopId={selectedId}
        loggedIn={user !== null}
        saved={selectedId != null && savedIds.has(selectedId)}
        onClose={() => setSelectedId(null)}
        onUnauthorized={onUnauthorized}
        onToggleSave={onToggleSave}
        onPriorityChanged={() => setRefreshToken((n) => n + 1)}
        onActivityChanged={reloadActivities}
      />
    </div>
  );
}
