/**
 * 관심 목록에 담긴 매장들의 방문 이력을 한꺼번에 읽어 옵니다.
 *
 * 관심 목록 화면(방문 단계별 추리기)과 AI CRM 화면(후속 접촉 대상)이 같은
 * 데이터를 보므로 한 군데서 모읍니다.
 *
 * 백엔드에 "여러 매장의 이력을 한 번에" 주는 엔드포인트가 없어서 매장마다
 * 한 번씩 부릅니다. 관심 목록은 사람이 직접 담은 것이라 보통 수십 건이지만,
 * 그래도 브라우저 연결을 다 쓰지 않도록 동시 요청 수를 묶어 둡니다.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { listActivities } from '../api/salesActivity';
import { ApiError } from '../api/client';
import { ERROR_CODE } from '../types/api';
import type { SalesActivity, VisitStatus } from '../types/salesActivity';
import { VISIT_STATUS } from '../types/salesActivity';

/** 동시에 띄우는 요청 수. 브라우저의 호스트당 연결 한도(보통 6)를 넘지 않게. */
const CONCURRENCY = 4;

export type ActivityMap = Map<number, SalesActivity[]>;

/** 단계 순서. 뒤로 갈수록 진행된 단계라 '가장 진행된 단계'를 고를 때 씁니다. */
const STATUS_RANK = new Map<VisitStatus, number>(VISIT_STATUS.map((s, i) => [s, i]));

/** 그 매장에서 가장 많이 진행된 단계. 기록이 없으면 null. */
export function latestStatus(activities: SalesActivity[] | undefined): VisitStatus | null {
  if (!activities || activities.length === 0) return null;
  return activities.reduce((best, a) =>
    (STATUS_RANK.get(a.status) ?? -1) > (STATUS_RANK.get(best.status) ?? -1) ? a : best,
  ).status;
}

/** 가장 최근 방문 기록(방문일 기준). 없으면 null. */
export function mostRecent(activities: SalesActivity[] | undefined): SalesActivity | null {
  if (!activities || activities.length === 0) return null;
  return activities.reduce((best, a) => (a.visitedAt > best.visitedAt ? a : best));
}

interface Result {
  activities: ActivityMap;
  loading: boolean;
  /** 세션이 없어서 못 읽은 경우. 화면은 필터를 감추고 안내를 띄웁니다. */
  unauthorized: boolean;
  reload: () => void;
}

export function useSavedActivities(shopIds: readonly number[], loggedIn: boolean): Result {
  const [activities, setActivities] = useState<ActivityMap>(new Map());
  const [loading, setLoading] = useState(false);
  const [unauthorized, setUnauthorized] = useState(false);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  /* 배열은 매 렌더 새 참조라 그대로 의존성에 넣으면 무한 루프가 된다.
     내용이 같으면 같은 키가 되도록 문자열로 눌러 둔다. */
  const key = shopIds.join(',');
  const idsRef = useRef(shopIds);
  idsRef.current = shopIds;

  useEffect(() => {
    if (!loggedIn) {
      setActivities(new Map());
      setUnauthorized(false);
      return;
    }
    const ids = idsRef.current;
    if (ids.length === 0) {
      setActivities(new Map());
      return;
    }

    const ac = new AbortController();
    setLoading(true);
    setUnauthorized(false);

    void (async () => {
      const next: ActivityMap = new Map();
      const queue = [...ids];

      const worker = async () => {
        for (;;) {
          const id = queue.shift();
          if (id === undefined || ac.signal.aborted) return;
          try {
            next.set(id, await listActivities(id, ac.signal));
          } catch (error) {
            if (ac.signal.aborted) return;
            if (ApiError.isApiError(error) && error.code === ERROR_CODE.UNAUTHORIZED) {
              setUnauthorized(true);
              return;
            }
            // 매장 하나가 실패해도 나머지는 보여준다. 빈 배열로 두면 '기록 없음'과
            // 구분이 안 되지만, 화면에서 그 차이가 의미를 갖지 않는다.
            next.set(id, []);
          }
        }
      };

      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, ids.length) }, worker));
      if (ac.signal.aborted) return;
      setActivities(next);
      setLoading(false);
    })();

    return () => {
      ac.abort();
      setLoading(false);
    };
  }, [key, loggedIn, nonce]);

  return { activities, loading, unauthorized, reload };
}
