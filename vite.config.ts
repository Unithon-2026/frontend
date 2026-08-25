import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * 개발 서버가 /api/* 를 백엔드로 프록시한다.
 *
 * 백엔드 SecurityConfig 에 CORS 설정이 없어서 브라우저가 5173 → 8080 을 직접
 * 부르면 전부 차단된다. 프록시를 거치면 브라우저 입장에서는 같은 오리진이라
 * CORS 자체가 발생하지 않는다. 배포(Vercel)에서는 vercel.json 의 rewrites 가
 * 같은 일을 하므로, 코드에서는 항상 상대경로 `/api/...` 만 쓰면 된다.
 *
 * 쿠키도 그대로 오간다. 백엔드 인증이 세션(JSESSIONID) 방식이라 이게 없으면
 * 로그인해도 다음 요청에서 다시 비로그인이 되고 AI 브리핑이 COMMON401 로 떨어진다.
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const backend = env.VITE_BACKEND_ORIGIN || 'http://localhost:8080';

  return {
    plugins: [react()],
    server: {
      port: Number(env.PORT) || 5173,
      proxy: {
        '/api': {
          target: backend,
          changeOrigin: true,
          // Set-Cookie 의 Domain 은 백엔드(8080) 기준이라 떼어내야 dev 서버에서 저장된다.
          cookieDomainRewrite: '',
        },
      },
    },
  };
});
