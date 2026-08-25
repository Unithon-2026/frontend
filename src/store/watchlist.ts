/**
 * 관심 목록. 이 브라우저에만 남습니다.
 *
 * 백엔드에 즐겨찾기 엔드포인트가 없어서 localStorage 에 둡니다. 저장 시점의
 * 이름·등급을 함께 적어 두는 이유는, 나중에 목록에서 사라진 매장(필터가
 * 달라졌거나 우선순위가 재계산된 경우)도 관심 목록에서는 그려야 하기 때문입니다.
 */

import type { PriorityGrade } from '../types/shop';

const KEY = 'meetroute.watchlist.v1';

export interface WatchEntry {
  id: number;
  name: string;
  gu: string;
  dong: string;
  businessType: string;
  score: number | null;
  priorityGrade: PriorityGrade | null;
  /** 저장 시각(ms). 최근 저장이 위로 오도록 정렬하는 데만 씁니다. */
  savedAt: number;
}

export function readWatchlist(): WatchEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // 스키마가 바뀌었거나 손상된 항목은 통째로 버리지 말고 그것만 걸러낸다.
    return parsed.filter(
      (e): e is WatchEntry =>
        typeof e === 'object' && e !== null && typeof (e as WatchEntry).id === 'number',
    );
  } catch {
    return [];
  }
}

export function writeWatchlist(entries: WatchEntry[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries));
  } catch {
    // 시크릿 모드·저장 공간 초과. 화면은 계속 돌아야 하므로 삼킨다.
  }
}

/** 이미 있으면 빼고 없으면 넣는다. 새 목록을 돌려준다(호출부가 상태로 삼음). */
export function toggleWatch(entries: WatchEntry[], shop: Omit<WatchEntry, 'savedAt'>): WatchEntry[] {
  const next = entries.some((e) => e.id === shop.id)
    ? entries.filter((e) => e.id !== shop.id)
    : [...entries, { ...shop, savedAt: Date.now() }];
  writeWatchlist(next);
  return next;
}

/** 관심 목록 전체 삭제. 되돌릴 수 없으므로 호출부가 먼저 확인을 받습니다. */
export function clearWatchlist(): WatchEntry[] {
  writeWatchlist([]);
  return [];
}
