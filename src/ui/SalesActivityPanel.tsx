/**
 * 방문 단계 · 영업 메모.
 *
 * 백엔드는 방문 기록과 메모를 분리해 두었지만(메모는 그 단계 기록이 먼저
 * 있어야 함) 화면에서는 한 덩어리로 다룹니다 — 메모를 남긴다는 건 그 단계를
 * 밟았다는 뜻이므로, `saveMemo` 가 필요하면 방문 기록을 먼저 만듭니다.
 *
 * 기록은 로그인한 본인 것만 보입니다. 비로그인이면 아예 조회하지 않습니다.
 */

import { useCallback, useEffect, useState } from 'react';
import { listActivities, recordVisit, saveMemo } from '../api/salesActivity';
import { ApiError } from '../api/client';
import { ERROR_CODE } from '../types/api';
import type { SalesActivity, VisitStatus } from '../types/salesActivity';
import { VISIT_STATUS, VISIT_STATUS_LABEL } from '../types/salesActivity';

interface Props {
  shopId: number;
  loggedIn: boolean;
  onUnauthorized: () => void;
  /** 기록이 바뀌었음을 바깥(관심 목록·CRM 집계)에 알린다. */
  onChanged: () => void;
}

/** 'NOT_VISITED' 는 단계라기보다 초기 상태라, 기록 버튼에서는 뺀다. */
const RECORDABLE = VISIT_STATUS.filter((s) => s !== 'NOT_VISITED');

export default function SalesActivityPanel({
  shopId,
  loggedIn,
  onUnauthorized,
  onChanged,
}: Props) {
  const [activities, setActivities] = useState<SalesActivity[]>([]);
  const [status, setStatus] = useState<VisitStatus>('FIRST_VISIT');
  const [memo, setMemo] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const rows = await listActivities(shopId, signal);
        if (signal?.aborted) return;
        setActivities(rows);
      } catch (error) {
        if (signal?.aborted) return;
        if (ApiError.isApiError(error) && error.code === ERROR_CODE.UNAUTHORIZED) {
          onUnauthorized();
          return;
        }
        setMsg({ text: '방문 이력을 불러오지 못했습니다: ' + (error as Error).message, ok: false });
      }
    },
    [shopId, onUnauthorized],
  );

  useEffect(() => {
    setActivities([]);
    setMemo('');
    setMsg(null);
    setStatus('FIRST_VISIT');
    if (!loggedIn) return;

    const ac = new AbortController();
    void load(ac.signal);
    return () => ac.abort();
  }, [shopId, loggedIn, load]);

  /* 단계를 고르면 그 단계에 이미 적어 둔 메모를 편집창에 올려 준다.
     안 그러면 다른 단계 메모를 덮어쓰기 쉽다. */
  useEffect(() => {
    const existing = activities.find((a) => a.status === status);
    setMemo(existing?.memo ?? '');
  }, [status, activities]);

  async function run(action: () => Promise<unknown>, okText: string) {
    setBusy(true);
    setMsg(null);
    try {
      await action();
      await load();
      onChanged();
      setMsg({ text: okText, ok: true });
    } catch (error) {
      if (ApiError.isApiError(error) && error.code === ERROR_CODE.UNAUTHORIZED) {
        onUnauthorized();
        setMsg({ text: '세션이 만료되었습니다. 다시 로그인하세요.', ok: false });
      } else {
        setMsg({ text: (error as Error).message, ok: false });
      }
    } finally {
      setBusy(false);
    }
  }

  if (!loggedIn) {
    return (
      <>
        <div className="sec-t">
          영업 활동 <span className="hint">GET /shops/{shopId}/sales_activity</span>
        </div>
        <p className="muted" style={{ fontSize: 12.5 }}>
          방문 기록과 메모는 본인 것만 보입니다. 오른쪽 위에서 로그인하세요.
        </p>
      </>
    );
  }

  const recorded = new Set(activities.map((a) => a.status));

  return (
    <>
      <div className="sec-t">
        영업 활동 <span className="hint">POST /shops/{shopId}/sales_activity</span>
      </div>

      <div className="status-row">
        {RECORDABLE.map((s) => (
          <button
            key={s}
            type="button"
            className={`stbtn${status === s ? ' on' : ''}${recorded.has(s) ? ' done' : ''}`}
            disabled={busy}
            onClick={() => setStatus(s)}
            title={recorded.has(s) ? '기록됨' : '아직 기록 없음'}
          >
            {VISIT_STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      <textarea
        className="memo"
        placeholder={`${VISIT_STATUS_LABEL[status]} 방문 메모 — 무엇을 확인했고 다음에 무엇을 할지`}
        value={memo}
        disabled={busy}
        onChange={(e) => setMemo(e.target.value)}
      />

      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button
          type="button"
          className="btn sm"
          style={{ flex: 1, width: 'auto', marginTop: 0 }}
          disabled={busy}
          onClick={() =>
            void run(
              () => recordVisit(shopId, { status }),
              `${VISIT_STATUS_LABEL[status]} 방문을 기록했습니다.`,
            )
          }
        >
          방문만 기록
        </button>
        <button
          type="button"
          className="btn sm primary"
          style={{ flex: 1, width: 'auto', marginTop: 0 }}
          disabled={busy || memo.trim() === ''}
          onClick={() =>
            void run(
              () => saveMemo(shopId, status, memo.trim()),
              `${VISIT_STATUS_LABEL[status]} 메모를 저장했습니다.`,
            )
          }
        >
          메모 저장
        </button>
      </div>

      <p className="muted" style={{ fontSize: 11, marginTop: 6 }}>
        메모를 저장하면 그 단계 방문도 함께 기록됩니다.
      </p>

      {msg && (
        <p className={`msg${msg.ok ? ' ok' : ''}`} style={{ marginTop: 6 }}>
          {msg.text}
        </p>
      )}

      {activities.length > 0 && (
        <div className="visits">
          {activities.map((a) => (
            <div className="visit" key={a.id}>
              <span className="n">{VISIT_STATUS_LABEL[a.status]}</span>
              <div className="visit-body">
                <b>{a.visitedAt}</b>
                <p>{a.memo ?? '메모 없음'}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
