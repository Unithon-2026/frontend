/**
 * 우선순위 API 호출부.
 *
 * 대응 파일: backend/.../domain/priority/controller/PriorityController.java
 *            backend/.../domain/priority/controller/PriorityBatchController.java
 *   GET  /api/v1/shops/{shopId}/priority -> ApiResponse<PriorityResponse>
 *   POST /api/v1/shops/{shopId}/priority -> ApiResponse<PriorityResponse>
 *   POST /api/v1/priorities/batch        -> ApiResponse<PriorityBatchResponse>
 */

import { ApiError, apiGet, apiPost } from './client';
import { ERROR_CODE } from '../types/api';
import type { Priority, PriorityBatchResult } from '../types/priority';

const SHOPS_PATH = '/api/v1/shops';

/**
 * 저장된 우선순위 조회.
 *
 * 아직 계산된 적이 없으면 백엔드가 PRIORITY4001 을 던진다. 이건 오류라기보다
 * "미산정" 상태라서 `null` 로 바꿔 돌려준다. 그 외 오류는 그대로 던진다.
 */
export async function getPriority(shopId: number, signal?: AbortSignal): Promise<Priority | null> {
  try {
    return await apiGet<Priority>(`${SHOPS_PATH}/${shopId}/priority`, { signal });
  } catch (error) {
    if (ApiError.isApiError(error) && error.code === ERROR_CODE.PRIORITY_NOT_FOUND) {
      return null;
    }
    throw error;
  }
}

/** 매장 한 곳의 우선순위를 다시 계산하고 저장한다. 본문 없는 POST. */
export function calculatePriority(shopId: number, signal?: AbortSignal): Promise<Priority> {
  return apiPost<Priority>(`${SHOPS_PATH}/${shopId}/priority`, undefined, { signal });
}

/**
 * 전체 매장 일괄 재계산. 매장 수에 비례해 오래 걸리므로 화면에서는
 * 진행 표시를 띄우고 기다리게 할 것.
 */
export function calculateAllPriorities(signal?: AbortSignal): Promise<PriorityBatchResult> {
  return apiPost<PriorityBatchResult>('/api/v1/priorities/batch', undefined, { signal });
}
