/**
 * AI 영업 브리핑 타입.
 *
 * 대응 파일: backend/.../domain/shop/briefing/dto/BriefingResponse.java
 */

/**
 * 브리핑 본문. 백엔드가 로그인한 사용자 **본인의** 방문 메모를 프롬프트에
 * 섞기 때문에, 생성에는 세션이 필요하다(없으면 COMMON401).
 */
export interface Briefing {
  shopId: number;
  briefing: string;
}
