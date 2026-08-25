/**
 * Backend 공통 응답 규약.
 *
 * 대응 파일: backend/src/main/java/com/unithon/meetroute/global/response/ApiResponse.java
 *            backend/src/main/java/com/unithon/meetroute/global/exception/ErrorCode.java
 *
 * 백엔드의 모든 컨트롤러는 ApiResponse<T> 로 감싼 body 를 반환한다.
 * 이 파일을 백엔드와 어긋나게 두면 client.ts 의 언랩 로직이 조용히 깨지므로,
 * ApiResponse / ErrorCode 가 바뀌면 여기부터 같이 고칠 것.
 */

/** 성공 응답. `code` 는 성공 시 백엔드가 채우지 않으므로 항상 null 이다. */
export interface ApiSuccessResponse<T> {
  success: true;
  code: null;
  message: string;
  data: T;
}

/** 실패 응답. GlobalExceptionHandler 가 만들며 `data` 는 항상 null. */
export interface ApiErrorResponse {
  success: false;
  code: string;
  message: string;
  data: null;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * Spring Data 의 Pageable 요청 파라미터.
 * sort 는 `"score,desc"` 형태이며 여러 개를 배열로 넘기면 sort 파라미터가 반복 전송된다.
 */
export interface PageRequest {
  page?: number;
  size?: number;
  sort?: string | string[];
}

export interface SortInfo {
  sorted: boolean;
  unsorted: boolean;
  empty: boolean;
}

export interface PageableInfo {
  pageNumber: number;
  pageSize: number;
  offset: number;
  paged: boolean;
  unpaged: boolean;
  sort: SortInfo;
}

/**
 * Spring Data `Page<T>` 직렬화 결과.
 *
 * 백엔드가 `Page` 를 그대로 반환하고 있어 PageImpl 의 필드가 그대로 노출된다.
 * `pageable` / `sort` 는 Spring 의 직렬화 모드에 따라 빠질 수 있어 optional 로 둔다.
 * 페이지 이동에 실제로 필요한 값은 `number` / `totalPages` / `last` 이므로 그쪽만 필수로 취급한다.
 */
export interface Page<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  /** 0-based 현재 페이지 번호. */
  number: number;
  size: number;
  numberOfElements: number;
  first: boolean;
  last: boolean;
  empty: boolean;
  pageable?: PageableInfo;
  sort?: SortInfo;
}

/**
 * backend ErrorCode enum 과 1:1 대응.
 * 화면에서 분기해야 하는 에러는 문자열 리터럴 대신 이 상수를 쓸 것.
 */
export const ERROR_CODE = {
  INVALID_INPUT: 'COMMON400',
  UNAUTHORIZED: 'COMMON401',
  NOT_FOUND: 'COMMON404',
  INTERNAL_SERVER_ERROR: 'COMMON500',
  SHOP_NOT_FOUND: 'SHOP4001',
  PRIORITY_NOT_FOUND: 'PRIORITY4001',
  AI_BRIEFING_FAILED: 'SHOP5001',
  EMAIL_ALREADY_EXISTS: 'USER4001',
  INVALID_CREDENTIALS: 'USER4002',
  SALES_ACTIVITY_NOT_FOUND: 'SALES4001',
} as const;

export type ErrorCode = (typeof ERROR_CODE)[keyof typeof ERROR_CODE];
