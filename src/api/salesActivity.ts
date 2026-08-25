/**
 * 영업활동 API.
 *
 * 대응 파일: backend/.../domain/salesactivity/controller/SalesActivityController.java
 *   POST /api/v1/shops/{shopId}/sales_activity       -> ApiResponse<SalesActivityResponse>
 *   POST /api/v1/shops/{shopId}/sales_activity/memo  -> ApiResponse<SalesActivityResponse>
 *   GET  /api/v1/shops/{shopId}/sales_activity       -> ApiResponse<List<SalesActivityResponse>>
 *
 * 셋 다 세션이 필요합니다. 없으면 COMMON401.
 */

import { apiGet, apiPost } from './client';
import { ApiError } from './client';
import { ERROR_CODE } from '../types/api';
import type {
  RecordVisitRequest,
  SalesActivity,
  UpdateMemoRequest,
  VisitStatus,
} from '../types/salesActivity';

const path = (shopId: number) => `/api/v1/shops/${shopId}/sales_activity`;

/**
 * 방문 기록. 같은 단계를 다시 부르면 새로 만들지 않고 방문일만 갱신합니다
 * (백엔드가 shop+user+status 로 upsert).
 */
export function recordVisit(
  shopId: number,
  request: RecordVisitRequest,
): Promise<SalesActivity> {
  return apiPost<SalesActivity>(path(shopId), request);
}

/** 특정 단계의 메모. 그 단계 방문 기록이 없으면 SALES4001 이 던져집니다. */
export function updateMemo(shopId: number, request: UpdateMemoRequest): Promise<SalesActivity> {
  return apiPost<SalesActivity>(`${path(shopId)}/memo`, request);
}

/** 본인이 이 매장을 방문한 이력. 최신순. 로그인 전이면 COMMON401. */
export function listActivities(shopId: number, signal?: AbortSignal): Promise<SalesActivity[]> {
  return apiGet<SalesActivity[]>(path(shopId), { signal });
}

/**
 * 메모 저장. 그 단계 방문 기록이 아직 없으면 먼저 만들고 다시 시도합니다.
 *
 * 백엔드가 메모와 방문 기록을 분리해 두었지만, 화면에서는 "메모를 남긴다"가
 * 곧 "그 단계를 밟았다"는 뜻입니다. 사용자에게 버튼을 두 번 누르게 하는 대신
 * 여기서 한 번에 처리합니다.
 */
export async function saveMemo(
  shopId: number,
  status: VisitStatus,
  memo: string,
): Promise<SalesActivity> {
  try {
    return await updateMemo(shopId, { status, memo });
  } catch (error) {
    if (!ApiError.isApiError(error) || error.code !== ERROR_CODE.SALES_ACTIVITY_NOT_FOUND) {
      throw error;
    }
    await recordVisit(shopId, { status });
    return updateMemo(shopId, { status, memo });
  }
}
