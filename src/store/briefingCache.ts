/**
 * AI 브리핑 캐시.
 *
 * 브리핑 한 번이 Claude 호출 한 번이라 느리고 돈이 듭니다. 같은 매장을 다시
 * 열었다고 매번 새로 만들 이유는 없어서 7일 동안 브라우저에 둡니다.
 * 최신 내용이 필요하면 화면의 '다시 생성'이 캐시를 건너뜁니다.
 *
 * 브리핑에는 본인 방문 메모가 섞이므로(백엔드 ShopBriefingService) 내용이
 * 사용자마다 다릅니다. localStorage 는 브라우저별이라 그 경계와 대체로
 * 맞지만, 한 브라우저를 여러 사람이 공유하면 남의 브리핑을 볼 수 있습니다.
 * 그래서 로그아웃할 때 통째로 비웁니다.
 */

const KEY = 'meetroute.briefing.v1';
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface CacheEntry {
  text: string;
  at: number;
}

type CacheMap = Record<string, CacheEntry>;

function readAll(): CacheMap {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? (parsed as CacheMap) : {};
  } catch {
    return {};
  }
}

function writeAll(map: CacheMap): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    // 저장 공간 초과·시크릿 모드. 캐시가 없으면 그냥 매번 새로 만들면 된다.
  }
}

/** 살아 있는 캐시만 돌려준다. 만료됐으면 지우고 null. */
export function readBriefing(shopId: number): CacheEntry | null {
  const map = readAll();
  const entry = map[String(shopId)];
  if (!entry || typeof entry.text !== 'string') return null;

  if (Date.now() - entry.at > TTL_MS) {
    delete map[String(shopId)];
    writeAll(map);
    return null;
  }
  return entry;
}

export function writeBriefing(shopId: number, text: string): void {
  const map = readAll();
  map[String(shopId)] = { text, at: Date.now() };
  writeAll(map);
}

/** 로그아웃 시 호출. 브리핑에 본인 메모가 섞여 있으므로 남겨 두지 않는다. */
export function clearBriefings(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* 지우지 못해도 화면은 계속 돌아야 한다. */
  }
}

/** '3일 전 생성'처럼 보여주기 위한 문구. */
export function relativeAge(at: number): string {
  const days = Math.floor((Date.now() - at) / (24 * 60 * 60 * 1000));
  if (days <= 0) return '오늘 생성';
  if (days === 1) return '어제 생성';
  return `${days}일 전 생성`;
}
