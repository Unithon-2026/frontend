/**
 * Shop API 호출부.
 *
 * 대응 파일: backend/src/main/java/com/unithon/meetroute/domain/shop/controller/ShopController.java
 *   GET /api/v1/shops           -> ApiResponse<Page<ShopListItemResponse>>
 *   GET /api/v1/shops/{shopId}  -> ApiResponse<ShopDetailResponse>
 *   GET /api/v1/shops/map       -> ApiResponse<List<ShopMapMarkerResponse>>
 */

import { apiGet, toPageableQuery } from './client';
import type { Page, PageRequest } from '../types/api';
import type {
  ShopDetail,
  ShopListItem,
  ShopListParams,
  ShopMapMarker,
  ShopMapParams,
} from '../types/shop';

const SHOPS_PATH = '/api/v1/shops';

/** 컨트롤러의 `@PageableDefault(size = 20, sort = "score", direction = DESC)` 와 동일. */
export const SHOP_LIST_DEFAULT_PAGE: Required<Pick<PageRequest, 'size' | 'sort'>> = {
  size: 20,
  sort: 'score,desc',
};

/**
 * 매장 목록 조회.
 *
 * `priorityGrade` 에 S/A/B/C 외의 값을 넣으면 백엔드가 COMMON400(INVALID_INPUT)을 던진다.
 * 정렬 기본값은 score 내림차순이며, score 가 아직 null 인 매장이 섞여 있을 수 있다.
 */
export function getShops(
  params: ShopListParams = {},
  page: PageRequest = {},
  signal?: AbortSignal,
): Promise<Page<ShopListItem>> {
  return apiGet<Page<ShopListItem>>(SHOPS_PATH, {
    query: {
      gu: params.gu,
      businessType: params.businessType,
      priorityGrade: params.priorityGrade,
      ...toPageableQuery({ ...SHOP_LIST_DEFAULT_PAGE, ...page }),
    },
    signal,
  });
}

/** 매장 상세 조회. 없는 id 면 SHOP4001(SHOP_NOT_FOUND) 이 ApiError 로 던져진다. */
export function getShopDetail(shopId: number, signal?: AbortSignal): Promise<ShopDetail> {
  return apiGet<ShopDetail>(`${SHOPS_PATH}/${shopId}`, { signal });
}

/**
 * 지도 영역 안의 매장 조회.
 *
 *   GET /api/v1/shops/map -> ApiResponse<List<ShopMapMarkerResponse>>
 *
 * 목록(`getShops`)과 달리 페이지가 아니라 배열이고, 좌표를 포함한다.
 * 카카오 지도의 `getBounds()` 남서/북동 좌표를 그대로 넘기면 된다.
 * 보이는 영역만 조회하므로 전국 데이터를 한 번에 내려받지 않는다.
 */
export function getShopsInBoundingBox(
  params: ShopMapParams,
  signal?: AbortSignal,
): Promise<ShopMapMarker[]> {
  return apiGet<ShopMapMarker[]>(`${SHOPS_PATH}/map`, {
    query: {
      minLatitude: params.minLatitude,
      maxLatitude: params.maxLatitude,
      minLongitude: params.minLongitude,
      maxLongitude: params.maxLongitude,
      gu: params.gu,
      businessType: params.businessType,
      priorityGrade: params.priorityGrade,
      limit: params.limit,
    },
    signal,
  });
}
