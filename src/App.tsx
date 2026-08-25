import { useCallback, useEffect, useMemo, useState } from 'react';
import AuthBar, { readStoredUser, writeStoredUser } from './ui/AuthBar';
import ShopList from './ui/ShopList';
import ShopDetail from './ui/ShopDetail';
import { getShops, SHOP_LIST_DEFAULT_PAGE } from './api/shops';
import { calculateAllPriorities } from './api/priority';
import { getApiBaseUrl } from './api/client';
import type { Page } from './types/api';
import type { AuthUser } from './types/auth';
import type { PriorityGrade, ShopListItem } from './types/shop';
import { LABEL_TO_GRADE } from './types/shop';

type Conn = { state: 'loading' } | { state: 'live' } | { state: 'down'; reason: string };

const GRADE_OPTIONS: Array<{ label: string; value: '' | '1' | '2' | '3' | '4' }> = [
  { label: '전체 등급', value: '' },
  { label: '1등급 · 최우선', value: '1' },
  { label: '2등급 · 우선', value: '2' },
  { label: '3등급 · 검토', value: '3' },
  { label: '4등급 · 보류', value: '4' },
];

export default function App() {
  const [conn, setConn] = useState<Conn>({ state: 'loading' });
  const [user, setUser] = useState<AuthUser | null>(() => readStoredUser());

  const [gu, setGu] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [gradeLabelValue, setGradeLabelValue] = useState<'' | '1' | '2' | '3' | '4'>('');
  const [pageNumber, setPageNumber] = useState(0);

  const [page, setPage] = useState<Page<ShopListItem> | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ShopListItem | null>(null);
  const [batchNote, setBatchNote] = useState<string | null>(null);
  const [batchBusy, setBatchBusy] = useState(false);

  const priorityGrade: PriorityGrade | undefined = gradeLabelValue
    ? LABEL_TO_GRADE[gradeLabelValue]
    : undefined;

  useEffect(() => {
    const ac = new AbortController();
    setLoading(true);

    void (async () => {
      try {
        const result = await getShops(
          { gu: gu || undefined, businessType: businessType || undefined, priorityGrade },
          { ...SHOP_LIST_DEFAULT_PAGE, page: pageNumber },
          ac.signal,
        );
        if (ac.signal.aborted) return;
        setPage(result);
        setConn({ state: 'live' });
      } catch (error) {
        if (ac.signal.aborted) return;
        setPage(null);
        setConn({ state: 'down', reason: (error as Error).message });
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    })();

    return () => ac.abort();
  }, [gu, businessType, priorityGrade, pageNumber]);

  const onAuthChange = useCallback((next: AuthUser | null) => {
    writeStoredUser(next);
    setUser(next);
  }, []);

  /** 서버가 COMMON401 을 주면 세션이 끊긴 것이므로 화면 상태도 되돌린다. */
  const onUnauthorized = useCallback(() => onAuthChange(null), [onAuthChange]);

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
    } catch (error) {
      setBatchNote('일괄 계산 실패: ' + (error as Error).message);
    } finally {
      setBatchBusy(false);
    }
  }

  return (
    <div className="shell">
      <div className="topbar">
        <div className="grow">
          <div className="crumbs">영업 · 매장 탐색</div>
          <h1>MeetRoute</h1>
        </div>
        <AuthBar user={user} onChange={onAuthChange} disabled={conn.state !== 'live'} />
      </div>

      <div className={`banner ${conn.state === 'live' ? 'live' : conn.state === 'down' ? 'down' : ''}`}>
        {conn.state === 'loading' && <span>백엔드에 연결하는 중…</span>}
        {conn.state === 'live' && (
          <span>
            <b>백엔드 연결됨</b> — <code>{target}/api/v1/shops</code>
          </span>
        )}
        {conn.state === 'down' && (
          <span>
            <b>백엔드에 연결하지 못했습니다</b> — <code>{target}</code> · {conn.reason}
          </span>
        )}
      </div>

      <div className="filters">
        <span className="label">자치구</span>
        <input placeholder="예: 성동구" value={gu} onChange={(e) => { setGu(e.target.value); setPageNumber(0); }} />
        <span className="label">업태</span>
        <input placeholder="예: 한식" value={businessType} onChange={(e) => { setBusinessType(e.target.value); setPageNumber(0); }} />
        <select
          value={gradeLabelValue}
          onChange={(e) => { setGradeLabelValue(e.target.value as typeof gradeLabelValue); setPageNumber(0); }}
        >
          {GRADE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <button type="button" disabled={batchBusy || conn.state !== 'live'} onClick={onBatch}>
          {batchBusy ? '계산 중…' : '전체 재계산'}
        </button>
        {batchNote && <span className="muted">{batchNote}</span>}
      </div>

      <div className="split">
        <div className="card">
          <div className="sec-t">
            우선순위 결과 <span className="hint">GET /api/v1/shops</span>
            {page && <span className="muted"> · 총 {page.totalElements.toLocaleString('ko-KR')}건</span>}
          </div>
          <ShopList
            page={page}
            loading={loading}
            selectedId={selected?.id ?? null}
            onSelect={setSelected}
            onPage={setPageNumber}
          />
        </div>

        <div className="card">
          {selected ? (
            <ShopDetail shopId={selected.id} loggedIn={user !== null} onUnauthorized={onUnauthorized} />
          ) : (
            <p className="muted">왼쪽 목록에서 매장을 선택하세요.</p>
          )}
        </div>
      </div>
    </div>
  );
}
