/**
 * 매장 상세 — 오른쪽에서 밀려 나오는 드로어.
 *
 * 목록·지도를 그대로 둔 채 상세를 보기 위해 페이지 전환 대신 드로어를 씁니다.
 * 닫혀 있어도 DOM 에 남아 있어야 열림 애니메이션이 돌므로, 언마운트하지 않고
 * `.on` 클래스만 토글합니다.
 */

import { useEffect, useState } from 'react';
import { getShopDetail } from '../api/shops';
import { calculatePriority, getPriority } from '../api/priority';
import { generateBriefing } from '../api/briefing';
import { ApiError } from '../api/client';
import { ERROR_CODE } from '../types/api';
import type { ShopDetail as Shop } from '../types/shop';
import { GRADE_MEANING, gradeKey, gradeLabel } from '../types/shop';
import type { Priority } from '../types/priority';
import SalesActivityPanel from './SalesActivityPanel';
import { readBriefing, relativeAge, writeBriefing } from '../store/briefingCache';
import { IconBookmark, IconRefresh, IconSpark } from './icons';

interface Props {
  shopId: number | null;
  loggedIn: boolean;
  saved: boolean;
  onClose: () => void;
  onUnauthorized: () => void;
  onToggleSave: (shop: Shop) => void;
  /** 우선순위를 다시 계산했을 때 목록·지도도 새로 받도록 알린다. */
  onPriorityChanged: () => void;
  /** 방문 기록이 바뀌면 관심 목록·CRM 화면의 집계도 다시 받도록 알린다. */
  onActivityChanged: () => void;
}

export default function ShopDrawer({
  shopId,
  loggedIn,
  saved,
  onClose,
  onUnauthorized,
  onToggleSave,
  onPriorityChanged,
  onActivityChanged,
}: Props) {
  const [shop, setShop] = useState<Shop | null>(null);
  const [priority, setPriority] = useState<Priority | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [briefing, setBriefing] = useState<{ text: string; err: boolean; at?: number } | null>(null);
  const [busy, setBusy] = useState<'briefing' | 'priority' | null>(null);

  useEffect(() => {
    if (shopId == null) return;
    const ac = new AbortController();
    setShop(null);
    setPriority(null);
    setError(null);

    /* 브리핑은 Claude 호출이라 느리고 돈이 든다. 7일 안에 만든 게 있으면
       그걸 먼저 보여주고, 필요하면 사용자가 '다시 생성'을 누른다. */
    const cached = readBriefing(shopId);
    setBriefing(cached ? { text: cached.text, err: false, at: cached.at } : null);

    void (async () => {
      try {
        const [detail, prio] = await Promise.all([
          getShopDetail(shopId, ac.signal),
          // 미산정(PRIORITY4001)은 오류가 아니라 정상 상태다.
          getPriority(shopId, ac.signal).catch(() => null),
        ]);
        if (ac.signal.aborted) return;
        setShop(detail);
        setPriority(prio);
      } catch (e) {
        if (!ac.signal.aborted) setError((e as Error).message);
      }
    })();

    return () => ac.abort();
  }, [shopId]);

  // Esc 로 닫기. 드로어가 열려 있을 때만 듣는다.
  useEffect(() => {
    if (shopId == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [shopId, onClose]);

  async function onBriefing() {
    if (shopId == null) return;
    setBusy('briefing');
    setBriefing({ text: 'AI가 브리핑을 작성하고 있습니다…', err: false });
    try {
      const res = await generateBriefing(shopId);
      writeBriefing(shopId, res.briefing);
      setBriefing({ text: res.briefing, err: false, at: Date.now() });
    } catch (e) {
      // 백엔드가 본인 방문 메모를 브리핑에 섞으므로 로그인 세션을 요구한다.
      if (ApiError.isApiError(e) && e.code === ERROR_CODE.UNAUTHORIZED) {
        onUnauthorized();
        setBriefing({
          text: 'AI 브리핑에는 로그인이 필요합니다 (COMMON401). 오른쪽 위에서 로그인하세요.',
          err: true,
        });
      } else if (ApiError.isApiError(e) && e.code === ERROR_CODE.AI_BRIEFING_FAILED) {
        setBriefing({
          text: '브리핑 생성 실패 (SHOP5001). 서버의 ANTHROPIC_API_KEY 설정을 확인하세요.',
          err: true,
        });
      } else {
        setBriefing({ text: '브리핑 생성 실패: ' + (e as Error).message, err: true });
      }
    } finally {
      setBusy(null);
    }
  }

  async function onRecalc() {
    if (shopId == null) return;
    setBusy('priority');
    try {
      const next = await calculatePriority(shopId);
      setPriority(next);
      setShop((s) => (s ? { ...s, score: next.score, priorityGrade: next.grade } : s));
      onPriorityChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const open = shopId != null;
  const key = shop ? gradeKey(shop.priorityGrade) : 'NA';

  return (
    <>
      <div className={`scrim${open ? ' on' : ''}`} onClick={onClose} />

      <aside className={`drawer${open ? ' on' : ''}`} aria-hidden={!open}>
        {shop && (
          <>
            <div className="dr-head">
              <button type="button" className="dr-close" onClick={onClose} aria-label="닫기">
                ×
              </button>
              <span className="dr-cat">{shop.businessType}</span>
              <div className="dr-name">{shop.name}</div>
              <div className="dr-addr">{shop.addressJibun}</div>
            </div>

            <div className="dr-body">
              <div className="dr-scorecard">
                <div className={`big grade-${key}${shop.score == null ? ' na' : ''}`}>
                  <b>{shop.score ?? '–'}</b>
                  <small>{shop.priorityGrade ? `${key.slice(1)}등급` : '미산정'}</small>
                </div>
                <div className="meta">
                  <b>{gradeLabel(shop.priorityGrade)}</b>
                  <p>
                    {shop.priorityGrade
                      ? `${GRADE_MEANING[shop.priorityGrade]} 대상입니다.`
                      : '아직 우선순위가 계산되지 않았습니다.'}
                  </p>
                </div>
              </div>

              <div className="sec-t">
                우선순위 산정 <span className="hint">POST /shops/{shop.id}/priority</span>
              </div>
              <p className={`prio-meta${priority ? '' : ' none'}`}>
                {priority
                  ? `산정 ${priority.calculatedAt.replace('T', ' ').slice(0, 16)} · ${priority.score}점 · ${gradeLabel(priority.grade)}`
                  : '계산된 적이 없습니다 (PRIORITY4001)'}
              </p>
              <button type="button" className="btn sm" disabled={busy !== null} onClick={onRecalc}>
                <IconRefresh />
                {busy === 'priority' ? '계산 중…' : '이 매장 재계산'}
              </button>

              <div className="sec-t" style={{ marginTop: 24 }}>
                AI 영업 브리핑
                {briefing?.at != null && <span className="cached">{relativeAge(briefing.at)}</span>}
                <span className="hint">POST /shops/{shop.id}/briefing</span>
              </div>
              <div className={`briefing${briefing?.err ? ' err' : ''}`}>
                {briefing ? briefing.text : <p className="ph">아직 생성하지 않았습니다.</p>}
              </div>
              <button
                type="button"
                className="btn sm primary"
                disabled={busy !== null}
                onClick={onBriefing}
              >
                <IconSpark />
                {busy === 'briefing'
                  ? '생성 중…'
                  : briefing?.at != null
                    ? '다시 생성'
                    : '브리핑 생성'}
              </button>
              {briefing?.at != null && (
                <p className="muted" style={{ fontSize: 11, marginTop: 6 }}>
                  7일 동안 이 브라우저에 보관됩니다. 방문 메모를 새로 남겼다면 다시 생성하세요.
                </p>
              )}
              {!loggedIn && (
                <p className="msg" style={{ marginTop: 6 }}>
                  로그인해야 생성됩니다.
                </p>
              )}

              <div style={{ marginTop: 24 }}>
                <SalesActivityPanel
                  shopId={shop.id}
                  loggedIn={loggedIn}
                  onUnauthorized={onUnauthorized}
                  onChanged={onActivityChanged}
                />
              </div>

              <div className="sec-t" style={{ marginTop: 24 }}>
                기본 정보 <span className="hint">GET /shops/{shop.id}</span>
              </div>
              <dl className="kv">
                <dt>자치구 · 동</dt>
                <dd>
                  {shop.gu} {shop.dong}
                </dd>
                <dt>업태</dt>
                <dd>{shop.businessType}</dd>
                <dt>면적</dt>
                <dd className={shop.area == null ? 'miss' : ''}>
                  {shop.area != null ? `${shop.area}㎡` : '정보 없음'}
                </dd>
                <dt>전화</dt>
                <dd className={shop.phone == null ? 'miss' : 'mono'}>{shop.phone ?? '정보 없음'}</dd>
                <dt>좌표</dt>
                <dd className={shop.latitude == null ? 'miss' : 'mono'}>
                  {shop.latitude != null && shop.longitude != null
                    ? `${shop.latitude}, ${shop.longitude}`
                    : '좌표 없음 — 지도에 표시되지 않습니다'}
                </dd>
              </dl>

              {error && <p className="msg">{error}</p>}
            </div>

            <div className="dr-foot">
              <button type="button" className="btn" onClick={() => onToggleSave(shop)}>
                <IconBookmark />
                {saved ? '관심 목록에서 빼기' : '관심 목록에 담기'}
              </button>
            </div>
          </>
        )}

        {!shop && open && !error && (
          <div className="dr-body">
            <p className="muted">불러오는 중…</p>
          </div>
        )}
        {!shop && open && error && (
          <div className="dr-body">
            <button type="button" className="dr-close" onClick={onClose} aria-label="닫기">
              ×
            </button>
            <p className="msg">{error}</p>
          </div>
        )}
      </aside>
    </>
  );
}
