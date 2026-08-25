/**
 * 영업활동(방문 기록 · 메모) 타입.
 *
 * 대응 파일:
 *   backend/.../domain/salesactivity/entity/VisitStatus.java
 *   backend/.../domain/salesactivity/dto/SalesActivityResponse.java
 *
 * 기록은 **로그인한 본인 것만** 보입니다. 세션이 없으면 세 엔드포인트 모두
 * COMMON401 을 던집니다.
 */

/** backend `VisitStatus` enum 과 동일. 와이어에는 이 문자열이 그대로 나갑니다. */
export const VISIT_STATUS = [
  'NOT_VISITED',
  'FIRST_VISIT',
  'SECOND_VISIT',
  'THIRD_VISIT',
  'FOURTH_VISIT',
  'FIFTH_VISIT',
] as const;

export type VisitStatus = (typeof VISIT_STATUS)[number];

/** 화면 표기. 와이어 값을 직접 노출하지 않기 위한 유일한 접점입니다. */
export const VISIT_STATUS_LABEL: Record<VisitStatus, string> = {
  NOT_VISITED: '미방문',
  FIRST_VISIT: '1차',
  SECOND_VISIT: '2차',
  THIRD_VISIT: '3차',
  FOURTH_VISIT: '4차',
  FIFTH_VISIT: '5차',
};

/**
 * `visitedAt` 은 `LocalDate` 라 `2026-08-25` 형태입니다(시각 없음).
 * `memo` 는 방문만 기록하고 메모를 안 남겼으면 null 입니다.
 */
export interface SalesActivity {
  id: number;
  shopId: number;
  status: VisitStatus;
  memo: string | null;
  visitedAt: string;
}

/** 방문 기록 요청. `visitedAt` 을 생략하면 백엔드가 오늘로 잡습니다. */
export interface RecordVisitRequest {
  status: VisitStatus;
  visitedAt?: string;
}

/** 메모 요청. 해당 단계의 방문 기록이 **먼저 있어야** 합니다(없으면 SALES4001). */
export interface UpdateMemoRequest {
  status: VisitStatus;
  memo: string;
}
