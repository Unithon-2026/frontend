/**
 * 자치구·업태 드롭다운의 후보값.
 *
 * 백엔드에 facet 엔드포인트가 없어서 목록 몇 페이지를 훑어 distinct 값을 모읍니다.
 * 전수가 아니라 **표본**이므로, 화면에서 "N건 기준"이라고 밝히고 다시 스캔할
 * 수단을 함께 둡니다. 스캔 결과는 localStorage 에 캐시해 새로고침마다 다시
 * 훑지 않습니다.
 */

import { getShops } from './shops';
import type { ShopListItem } from '../types/shop';

const KEY = 'meetroute.facets.v1';

/** 한 번에 받는 크기 × 페이지 수. 해커톤 데이터 규모에서는 이 정도면 충분합니다. */
const SCAN_PAGE_SIZE = 200;
const SCAN_PAGES = 3;

export interface Facets {
  gu: string[];
  businessType: string[];
  /** 표본 크기. "더미 16건 기준" 같은 안내에 씁니다. */
  sampled: number;
  /** 전체 건수(백엔드가 알려준 값). 표본이 전수인지 판단하는 데 씁니다. */
  total: number;
  scannedAt: number;
}

export function readCachedFacets(): Facets | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Facets;
    return Array.isArray(parsed.gu) && Array.isArray(parsed.businessType) ? parsed : null;
  } catch {
    return null;
  }
}

function cacheFacets(facets: Facets): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(facets));
  } catch {
    /* 저장 실패는 무시 — 다음 실행에서 다시 스캔하면 된다. */
  }
}

/** 목록을 훑어 distinct 자치구·업태를 모은다. */
export async function scanFacets(signal?: AbortSignal): Promise<Facets> {
  const gu = new Set<string>();
  const businessType = new Set<string>();
  let sampled = 0;
  let total = 0;

  for (let page = 0; page < SCAN_PAGES; page++) {
    const result = await getShops({}, { page, size: SCAN_PAGE_SIZE, sort: 'id,asc' }, signal);
    total = result.totalElements;

    for (const shop of result.content as ShopListItem[]) {
      if (shop.gu) gu.add(shop.gu);
      if (shop.businessType) businessType.add(shop.businessType);
    }
    sampled += result.content.length;

    if (result.last || result.content.length === 0) break;
  }

  const facets: Facets = {
    gu: [...gu].sort((a, b) => a.localeCompare(b, 'ko')),
    businessType: [...businessType].sort((a, b) => a.localeCompare(b, 'ko')),
    sampled,
    total,
    scannedAt: Date.now(),
  };
  cacheFacets(facets);
  return facets;
}
