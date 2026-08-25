/**
 * 우선순위 도메인 타입.
 *
 * 대응 파일: backend/.../domain/priority/dto/PriorityResponse.java
 *            backend/.../domain/priority/dto/PriorityBatchResponse.java
 */

import type { PriorityGrade } from './shop';

/**
 * 저장된 우선순위. 필드명이 목록/상세의 `priorityGrade` 와 달리 `grade` 인 점에 주의.
 * 아직 계산 전이면 백엔드가 PRIORITY4001 을 던지므로 이 타입은 내려오지 않는다.
 */
export interface Priority {
  shopId: number;
  score: number;
  grade: PriorityGrade;
  /** `2026-08-25T09:30:00` 형태의 LocalDateTime 직렬화 결과 (타임존 없음). */
  calculatedAt: string;
}

/** 전체 매장 우선순위 일괄 재계산 결과. */
export interface PriorityBatchResult {
  totalShopCount: number;
  processedCount: number;
  elapsedMillis: number;
}
