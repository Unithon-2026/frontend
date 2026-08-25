/**
 * 인증 타입.
 *
 * 대응 파일: backend/.../domain/auth/dto/SignupRequest.java
 *            backend/.../domain/auth/dto/LoginRequest.java
 *            backend/.../domain/auth/dto/LoginResponse.java
 *
 * 백엔드는 세션(JSESSIONID) 방식이라 토큰이 내려오지 않는다. 로그인 성공 시
 * Set-Cookie 로 세션이 심기고, 이후 요청은 `credentials: 'include'` 로 그
 * 쿠키를 실어 보낸다. "지금 누구냐"를 묻는 엔드포인트는 없다.
 */

export interface SignupRequest {
  name: string;
  email: string;
  password: string;
  phone?: string;
  assignedRegionId?: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

/** signup / login 응답이 같은 모양이다. */
export interface AuthUser {
  id: number;
  name: string;
  email: string;
}
