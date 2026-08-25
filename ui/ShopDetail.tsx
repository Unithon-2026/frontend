import { useEffect, useState } from 'react';
import { getShopDetail } from '../api/shops';
import { calculatePriority, getPriority } from '../api/priority';
import { generateBriefing } from '../api/briefing';
import { ApiError } from '../api/client';
import { ERROR_CODE } from '../types/api';
import type { ShopDetail as Shop } from '../types/shop';
import { GRADE_TO_LABEL, gradeLabel } from '../types/shop';
import type { Priority } from '../types/priority';

interface Props {
  shopId: number;
  loggedIn: boolean;
  onUnauthorized: () => void;
}

export default function ShopDetail({ shopId, loggedIn, onUnauthorized }: Props) {
  const [shop, setShop] = useState<Shop | null>(null);
  const [priority, setPriority] = useState<Priority | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [briefing, setBriefing] = useState<{ text: string; err: boolean } | null>(null);
  const [busy, setBusy] = useState<'briefing' | 'priority' | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    setShop(null);
    setPriority(null);
    setBriefing(null);
    setError(null);

    void (async () => {
      try {
        const [detail, prio] = await Promise.all([
          getShopDetail(shopId, ac.signal),
          getPriority(shopId, ac.signal).catch(() => null),
        ]);
        setShop(detail);
        setPriority(prio);
      } catch (e) {
        if (!ac.signal.aborted) setError((e as Error).message);
      }
    })();

    return () => ac.abort();
  }, [shopId]);

  async function onBriefing() {
    setBusy('briefing');
    setBriefing({ text: 'AI가 브리핑을 작성하고 있습니다…', err: false });
    try {
      const res = await generateBriefing(shopId);
      setBriefing({ text: res.briefing, err: false });
    } catch (e) {
      // 백엔드가 본인 방문 메모를 브리핑에 섞으므로 로그인 세션을 요구한다.
      if (ApiError.isApiError(e) && e.code === ERROR_CODE.UNAUTHORIZED) {
        onUnauthorized();
        setBriefing({ text: 'AI 브리핑에는 로그인이 필요합니다 (COMMON401). 오른쪽 위에서 로그인하세요.', err: true });
      } else if (ApiError.isApiError(e) && e.code === ERROR_CODE.AI_BRIEFING_FAILED) {
        setBriefing({ text: '브리핑 생성 실패 (SHOP5001). 서버의 ANTHROPIC_API_KEY 설정을 확인하세요.', err: true });
      } else {
        setBriefing({ text: '브리핑 생성 실패: ' + (e as Error).message, err: true });
      }
    } finally {
      setBusy(null);
    }
  }

  async function onRecalc() {
    setBusy('priority');
    try {
      setPriority(await calculatePriority(shopId));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  if (error) return <p className="msg">{error}</p>;
  if (!shop) return <p className="muted">불러오는 중…</p>;

  return (
    <>
      <div className="sec-t">
        매장 상세 <span className="hint">GET /api/v1/shops/{shop.id}</span>
      </div>
      <h2 style={{ fontSize: 17, margin: '0 0 4px' }}>{shop.name}</h2>
      <p className="muted" style={{ margin: '0 0 14px' }}>
        {shop.addressJibun}
      </p>

      <div className="rows">
        <div>
          <span>업태</span>
          <span>{shop.businessType}</span>
        </div>
        <div>
          <span>면적</span>
          <span>{shop.area != null ? `${shop.area}㎡` : '—'}</span>
        </div>
        <div>
          <span>전화</span>
          <span>{shop.phone ?? '—'}</span>
        </div>
        <div>
          <span>좌표</span>
          <span>
            {shop.latitude != null && shop.longitude != null
              ? `${shop.latitude}, ${shop.longitude}`
              : '좌표 없음 (지도 표시 불가)'}
          </span>
        </div>
        <div>
          <span>우선순위</span>
          <span>
            <span className={`pill ${shop.priorityGrade ? `G${GRADE_TO_LABEL[shop.priorityGrade]}` : 'NA'}`}>
              {gradeLabel(shop.priorityGrade)}
            </span>{' '}
            {shop.score ?? '–'}점
          </span>
        </div>
      </div>

      <div className="sec-t" style={{ marginTop: 20 }}>
        우선순위 산정 <span className="hint">POST /api/v1/shops/{shop.id}/priority</span>
      </div>
      <p className="muted" style={{ margin: '0 0 10px' }}>
        {priority
          ? `산정 ${priority.calculatedAt.replace('T', ' ').slice(0, 16)} · ${priority.score}점 · ${gradeLabel(priority.grade)}`
          : '아직 계산된 적이 없습니다 (PRIORITY4001).'}
      </p>
      <button type="button" disabled={busy !== null} onClick={onRecalc}>
        {busy === 'priority' ? '계산 중…' : '이 매장 재계산'}
      </button>

      <div className="sec-t" style={{ marginTop: 20 }}>
        AI 영업 브리핑 <span className="hint">POST /api/v1/shops/{shop.id}/briefing</span>
      </div>
      <div className={`briefing${briefing?.err ? ' err' : ''}`} style={{ marginBottom: 10 }}>
        {briefing?.text ?? '아직 생성하지 않았습니다.'}
      </div>
      <button type="button" className="primary" disabled={busy !== null} onClick={onBriefing}>
        {busy === 'briefing' ? '생성 중…' : '브리핑 생성'}
      </button>
      {!loggedIn && <span className="muted" style={{ marginLeft: 8 }}>로그인이 필요합니다</span>}
    </>
  );
}
