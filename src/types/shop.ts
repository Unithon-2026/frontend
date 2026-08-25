/**
 * Shop 도메인 타입.
 *
 * 대응 파일: backend/src/main/java/com/unithon/meetroute/domain/shop/dto/ShopListItemResponse.java
 *            backend/src/main/java/com/unithon/meetroute/domain/shop/dto/ShopDetailResponse.java
 *            backend/src/main/java/com/unithon/meetroute/domain/priority/entity/PriorityGrade.java
 */

/** backend PriorityGrade enum (`@Enumerated(EnumType.STRING)`) 과 동일. */
export const PRIORITY_GRADE = ['S', 'A', 'B', 'C'] as const;

export type PriorityGrade = (typeof PRIORITY_GRADE)[number];

/**
 * `score` / `priorityGrade` 는 Priority 계산이 돌기 전에는 null 이다.
 * (Shop.applyPriority() 가 호출되기 전까지 두 컬럼 모두 비어 있음)
 * 목록/상세 어디서든 "미계산" 상태를 렌더링할 수 있어야 한다.
 */
export interface ShopListItem {
  id: number;
  name: string;
  gu: string;
  dong: string;
  businessType: string;
  score: number | null;
  priorityGrade: PriorityGrade | null;
}

/**
 * BigDecimal 필드(`area`, `longitude`, `latitude`)는 JSON number 로 내려온다.
 * 좌표가 없는 매장이 있으므로 지도에 찍기 전에 null 체크가 필요하다.
 */
export interface ShopDetail {
  id: number;
  name: string;
  addressJibun: string;
  gu: string;
  dong: string;
  phone: string | null;
  businessType: string;
  area: number | null;
  longitude: number | null;
  latitude: number | null;
  score: number | null;
  priorityGrade: PriorityGrade | null;
}

/** `GET /api/v1/shops` 의 쿼리 파라미터. 전부 optional 이며 빈 값은 전송하지 않는다. */
export interface ShopListParams {
  gu?: string;
  businessType?: string;
  priorityGrade?: PriorityGrade;
}

/**
 * `GET /api/v1/shops/map` 응답.
 *
 * 대응 파일: backend/.../domain/shop/dto/ShopMapMarkerResponse.java
 * 목록 DTO 와 달리 좌표를 포함한다. 지도는 목록이 아니라 이쪽을 쓴다.
 */
export interface ShopMapMarker {
  id: number;
  name: string;
  businessType: string;
  addressJibun: string;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
  score: number | null;
  priorityGrade: PriorityGrade | null;
}

/**
 * 지도 영역(bounding box) 질의 파라미터.
 * 카카오 지도의 `getBounds()` 남서/북동 좌표가 그대로 여기에 들어간다.
 */
export interface ShopMapParams {
  minLatitude: number;
  maxLatitude: number;
  minLongitude: number;
  maxLongitude: number;
  gu?: string;
  businessType?: string;
  priorityGrade?: PriorityGrade;
  /** 백엔드 기본값 500. */
  limit?: number;
}

/**
 * 화면 표기는 1~4등급, 와이어는 S/A/B/C 다. 변환은 프론트에서만 한다
 * (백엔드 enum 을 바꾸지 않기로 했으므로 이 표가 유일한 접점).
 */
export const GRADE_TO_LABEL: Record<PriorityGrade, '1' | '2' | '3' | '4'> = {
  S: '1',
  A: '2',
  B: '3',
  C: '4',
};

export const LABEL_TO_GRADE: Record<'1' | '2' | '3' | '4', PriorityGrade> = {
  '1': 'S',
  '2': 'A',
  '3': 'B',
  '4': 'C',
};

/** 미산정(null)이면 '미산정'. 그 외에는 '1등급' 같은 문자열. */
export function gradeLabel(grade: PriorityGrade | null): string {
  return grade ? `${GRADE_TO_LABEL[grade]}등급` : '미산정';
}
