/**
 * 데이터 관리 화면이 쓰는 집계.
 *
 * 백엔드에 통계 엔드포인트가 없어서 기존 두 엔드포인트로 유도합니다.
 * 유도한 값이 정확한지 아닌지를 화면이 그대로 밝힐 수 있도록, 숫자와 함께
 * "이게 전수인가"를 돌려줍니다. 어림값을 확정값처럼 보여주지 않기 위해서입니다.
 */

import { getShops, getShopsInBoundingBox } from './shops';
import { KOREA_BOUNDS } from '../map/kakao';

/** 목록을 훑을 때 한 번에 받는 크기와 최대 페이지 수. */
const SCAN_PAGE_SIZE = 200;
const SCAN_PAGES = 10;

/** backend ShopService.MAX_MAP_LIMIT 과 같은 값. 더 크게 보내도 잘립니다. */
const MAX_MAP_LIMIT = 1000;

export interface DatasetStats {
  /** 백엔드가 알려준 전체 매장 수. 항상 정확합니다. */
  total: number;

  /** 실제로 훑은 건수. total 과 같으면 아래 수치가 전수입니다. */
  scanned: number;

  /** 훑은 범위에서 score 가 null 인 건수. */
  unscored: number;

  /**
   * 좌표가 없어 지도에 못 찍히는 매장 수. `null` 이면 셀 수 없었다는 뜻입니다
   * (전체가 지도 API 상한 1000건을 넘으면 뺄셈이 성립하지 않습니다).
   */
  missingGeo: number | null;

  /** 위 수치가 전수인가, 표본인가. 화면 문구가 이걸로 갈립니다. */
  complete: boolean;
}

/**
 * 목록을 훑어 미산정 건수를 세고, 지도 API 로 좌표 있는 매장 수를 받아
 * 좌표 결측을 뺄셈으로 구합니다.
 *
 * `ShopListItem` 에는 좌표가 없고 `ShopMapMarker` 에만 있어서, 한쪽만으로는
 * 두 수치를 다 얻을 수 없습니다.
 */
export async function loadDatasetStats(signal?: AbortSignal): Promise<DatasetStats> {
  let scanned = 0;
  let unscored = 0;
  let total = 0;

  for (let page = 0; page < SCAN_PAGES; page++) {
    const result = await getShops({}, { page, size: SCAN_PAGE_SIZE, sort: 'id,asc' }, signal);
    total = result.totalElements;

    for (const shop of result.content) {
      if (shop.score == null) unscored++;
    }
    scanned += result.content.length;

    if (result.last || result.content.length === 0) break;
  }

  let missingGeo: number | null = null;
  if (total <= MAX_MAP_LIMIT) {
    try {
      const markers = await getShopsInBoundingBox(
        {
          minLatitude: KOREA_BOUNDS.minLat,
          maxLatitude: KOREA_BOUNDS.maxLat,
          minLongitude: KOREA_BOUNDS.minLng,
          maxLongitude: KOREA_BOUNDS.maxLng,
          limit: MAX_MAP_LIMIT,
        },
        signal,
      );
      // 국내 범위 밖 좌표도 여기서 빠지므로, 화면은 '좌표 없음 또는 국내 밖'이라 적는다.
      missingGeo = Math.max(0, total - markers.length);
    } catch {
      missingGeo = null;
    }
  }

  return { total, scanned, unscored, missingGeo, complete: scanned >= total };
}
