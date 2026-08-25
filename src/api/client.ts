/**
 * ApiResponse 봉투를 벗겨서 `data` 만 돌려주는 fetch 래퍼.
 *
 * 백엔드는 실패해도 HTTP 200 이 아닌 실제 상태코드(400/404/502/500)를 쓰지만,
 * body 는 항상 ApiResponse 모양이므로 상태코드가 아니라 `success` 플래그로 판정한다.
 * (GlobalExceptionHandler 가 모든 예외를 ApiResponse.error 로 변환)
 */

import type { ApiResponse, PageRequest } from '../types/api';
import { ERROR_CODE } from '../types/api';

/**
 * 기본값은 빈 문자열, 즉 **상대경로**다. 절대 URL 로 바꾸지 않는 것이 기본 전략이다.
 *
 * 개발에서는 vite 의 `/api` 프록시가, 배포에서는 vercel.json 의 rewrites 가
 * 같은 오리진으로 위장해 백엔드로 넘긴다. 그래야
 *   - 백엔드에 CORS 설정이 없어도 되고,
 *   - 세션 쿠키(JSESSIONID)가 SameSite=Lax 인 채로 그대로 동작하며,
 *   - 브라우저의 서드파티 쿠키 차단에도 걸리지 않는다.
 *
 * 다른 오리진의 백엔드를 직접 부르려면 절대 URL 을 넣을 수 있지만, 그때는
 * 백엔드에 CORS(Access-Control-Allow-Credentials + 명시적 오리진)와
 * 쿠키의 SameSite=None; Secure 가 함께 필요하다.
 */
const DEFAULT_BASE_URL = '';

function resolveBaseUrlFromEnv(): string {
  const fromVite =
    typeof import.meta !== 'undefined' ? import.meta.env?.VITE_API_BASE_URL : undefined;
  if (fromVite) {
    return String(fromVite).replace(/\/+$/, '');
  }
  if (typeof process !== 'undefined' && process.env) {
    return (
      process.env.NEXT_PUBLIC_API_BASE_URL ??
      process.env.REACT_APP_API_BASE_URL ??
      process.env.API_BASE_URL ??
      DEFAULT_BASE_URL
    );
  }
  return DEFAULT_BASE_URL;
}

let baseUrl = resolveBaseUrlFromEnv();

/** 앱 부트스트랩 시점에 베이스 URL 을 바꾸고 싶을 때만 쓴다. 보통은 필요 없다. */
export function configureApiBaseUrl(url: string): void {
  baseUrl = url.replace(/\/+$/, '');
}

export function getApiBaseUrl(): string {
  return baseUrl;
}

/** 백엔드가 내려준 실패 응답을 그대로 담는 에러. `code` 로 분기할 수 있다. */
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }

  static isApiError(error: unknown): error is ApiError {
    return error instanceof ApiError;
  }
}

type QueryValue = string | number | boolean | null | undefined | readonly string[];

/** 빈 값은 파라미터 자체를 생략하고, 배열은 같은 키를 반복해서 붙인다(Spring 의 sort 규약). */
function buildQuery(params: Record<string, QueryValue>): string {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') {
      continue;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item !== '') {
          search.append(key, item);
        }
      }
      continue;
    }
    search.append(key, String(value));
  }

  const query = search.toString();
  return query ? `?${query}` : '';
}

/** PageRequest 를 Spring Pageable 이 읽는 쿼리 파라미터 모양으로 편다. */
export function toPageableQuery(page?: PageRequest): Record<string, QueryValue> {
  if (!page) {
    return {};
  }
  return {
    page: page.page,
    size: page.size,
    sort: page.sort,
  };
}

export interface RequestOptions {
  query?: Record<string, QueryValue>;
  signal?: AbortSignal;
}

/** 응답 봉투를 벗기고 실패면 ApiError 로 던진다. GET/POST 공통. */
async function unwrap<T>(response: Response): Promise<T> {
  let body: ApiResponse<T>;
  try {
    body = (await response.json()) as ApiResponse<T>;
  } catch {
    // 스프링 시큐리티 거절이나 게이트웨이 오류처럼 ApiResponse 규약을 타지 않는 응답.
    throw new ApiError(
      ERROR_CODE.INTERNAL_SERVER_ERROR,
      `서버 응답을 해석하지 못했습니다. (HTTP ${response.status})`,
      response.status,
    );
  }

  if (!body.success) {
    throw new ApiError(body.code, body.message, response.status);
  }

  return body.data;
}

export async function apiGet<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const url = `${baseUrl}${path}${buildQuery(options.query ?? {})}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    // 세션 쿠키(JSESSIONID)를 함께 보낸다. 상대경로면 same-origin 이라 항상 실린다.
    credentials: 'include',
    signal: options.signal,
  });

  return unwrap<T>(response);
}

/**
 * POST. 우선순위 재계산·브리핑·배치는 본문이 없고, 회원가입·로그인은 본문이 있다.
 * `payload` 를 넘기지 않으면 Content-Type 도 붙이지 않는다.
 */
export async function apiPost<T>(
  path: string,
  payload?: unknown,
  options: RequestOptions = {},
): Promise<T> {
  const url = `${baseUrl}${path}${buildQuery(options.query ?? {})}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      ...(payload === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    credentials: 'include',
    body: payload === undefined ? undefined : JSON.stringify(payload),
    signal: options.signal,
  });

  return unwrap<T>(response);
}
