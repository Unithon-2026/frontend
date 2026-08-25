/**
 * AI 영업 브리핑 API 호출부.
 *
 * 대응 파일: backend/.../domain/shop/controller/ShopController.java (briefing)
 *   POST /api/v1/shops/{shopId}/briefing -> ApiResponse<BriefingResponse>
 */

import { apiPost } from './client';
import type { Briefing } from '../types/briefing';

const SHOPS_PATH = '/api/v1/shops';

/**
 * 브리핑 생성. Claude API 를 1회 호출하므로 응답이 수 초 걸리고 비용이 든다.
 * 화면에서 같은 매장을 반복 호출하지 않도록 캐시할 것.
 *
 * **로그인이 필요하다.** 백엔드가 로그인한 사용자 본인의 방문 메모를 프롬프트에
 * 섞기 때문에, 세션이 없으면 COMMON401 로 실패한다.
 * 서버에 ANTHROPIC_API_KEY 가 없으면 SHOP5001 로 실패한다.
 */
export function generateBriefing(shopId: number, signal?: AbortSignal): Promise<Briefing> {
  return apiPost<Briefing>(`${SHOPS_PATH}/${shopId}/briefing`, undefined, { signal });
}
