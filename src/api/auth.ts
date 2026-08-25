/**
 * 인증 API 호출부.
 *
 * 대응 파일: backend/.../domain/auth/controller/AuthController.java
 *   POST /api/v1/auth/signup -> ApiResponse<SignupResponse>
 *   POST /api/v1/auth/login  -> ApiResponse<LoginResponse>
 *   POST /api/v1/auth/logout -> ApiResponse<Void>
 *
 * 세션(JSESSIONID) 방식이라 토큰이 없다. 로그인 응답의 Set-Cookie 로 세션이
 * 심기고, 이후 요청은 client.ts 의 `credentials: 'include'` 가 그 쿠키를 싣는다.
 * 상대경로(같은 오리진)로 호출해야 쿠키가 확실히 오간다.
 */

import { apiPost } from './client';
import type { AuthUser, LoginRequest, SignupRequest } from '../types/auth';

const AUTH_PATH = '/api/v1/auth';

/** 회원가입. 이미 가입된 이메일이면 USER4001. 세션은 아직 심기지 않는다. */
export function signup(request: SignupRequest, signal?: AbortSignal): Promise<AuthUser> {
  return apiPost<AuthUser>(`${AUTH_PATH}/signup`, request, { signal });
}

/** 로그인. 실패하면 USER4002. 성공 시 세션 쿠키가 심긴다. */
export function login(request: LoginRequest, signal?: AbortSignal): Promise<AuthUser> {
  return apiPost<AuthUser>(`${AUTH_PATH}/login`, request, { signal });
}

/** 로그아웃. 세션이 이미 없어도 성공으로 돌아온다. */
export function logout(signal?: AbortSignal): Promise<void> {
  return apiPost<void>(`${AUTH_PATH}/logout`, undefined, { signal });
}
