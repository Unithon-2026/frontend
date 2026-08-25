# meetroute-frontend

`Unithon-2026/backend` (Spring Boot) 에 붙는 React 프론트엔드. Vite + TypeScript,
배포는 Vercel 기준입니다.

```
src/
├─ types/     백엔드 DTO 와 1:1 대응하는 타입
├─ api/       엔드포인트별 fetch 래퍼 (UI 프레임워크 비의존)
├─ ui/        화면 컴포넌트
└─ App.tsx    현재 스캐폴드 화면
```

---

## 실행

```bash
npm install
cp .env.example .env      # 필요할 때만. 기본값으로도 동작합니다
npm run dev               # http://localhost:5173
```

백엔드는 `localhost:8080` 에 떠 있어야 합니다. 다른 곳이면 `.env` 의
`VITE_BACKEND_ORIGIN` 을 바꾸세요.

| 명령 | 하는 일 |
| --- | --- |
| `npm run dev` | 개발 서버 (`/api/*` 를 백엔드로 프록시) |
| `npm run build` | `dist/` 로 프로덕션 빌드 |
| `npm run typecheck` | 타입 검사만 |

---

## 왜 API 베이스 URL 이 비어 있는가

`client.ts` 의 기본 베이스 URL 은 **빈 문자열, 즉 상대경로**입니다. 모든 호출이
`/api/v1/...` 로 나가고, 그걸 개발에서는 vite 프록시가, 배포에서는 Vercel
rewrites 가 백엔드로 넘깁니다.

```
개발   브라우저 → localhost:5173 ─(vite proxy)→ localhost:8080
배포   브라우저 → *.vercel.app  ─(rewrites)──→ 백엔드 호스트
```

브라우저 입장에서는 **항상 같은 오리진**이므로:

- 백엔드에 CORS 설정이 없어도 됩니다 (실제로 `SecurityConfig` 에 없습니다)
- 세션 쿠키 `JSESSIONID` 가 기본값 `SameSite=Lax` 인 채로 그대로 동작합니다
- Safari ITP · Chrome 서드파티 쿠키 차단에 걸리지 않습니다

절대 URL 로 바꾸면 이 셋이 전부 문제가 됩니다. 굳이 그래야 한다면 백엔드에
CORS(`Access-Control-Allow-Credentials` + 명시적 오리진, `*` 는 불가)와
쿠키의 `SameSite=None; Secure` 가 **함께** 필요합니다.

---

## Vercel 배포

`vercel.json` 의 `REPLACE-WITH-BACKEND-HOST` 를 실제 백엔드 주소로 바꾸고 배포합니다.

```json
{ "source": "/api/:path*", "destination": "https://meetroute-api.example.com/api/:path*" }
```

**Vercel 은 Spring Boot 를 못 올립니다.** JVM 런타임이 없고, 상시 실행 프로세스와
MySQL 커넥션 풀이 서버리스와 맞지 않습니다. 백엔드는 Railway · Render · Fly.io ·
Cloudtype · EC2 중 한 곳에 따로 띄우고, 그 주소를 위 rewrite 에 넣으세요.

배포 후 확인할 것:

- [ ] 로그인 후 새로고침해도 로그인이 유지되는가 (rewrite 가 `Set-Cookie` 를 통과시키는지)
- [ ] AI 브리핑이 `COMMON401` 없이 생성되는가
- [ ] 카카오 개발자 콘솔 **플랫폼 > Web** 에 배포 도메인이 등록되어 있는가

---

## API 레이어

모든 응답은 `ApiResponse<T>` 봉투입니다. 실패 판정은 HTTP 상태코드가 아니라
`success` 플래그로 합니다. 실패하면 `ApiError` 가 던져지고 `code` 로 분기합니다.

```ts
import { getShops, ApiError, ERROR_CODE } from './src';

try {
  const page = await getShops({ gu: '성동구' }, { page: 0, size: 20 });
} catch (e) {
  if (ApiError.isApiError(e) && e.code === ERROR_CODE.UNAUTHORIZED) { /* 로그인 필요 */ }
}
```

| 함수 | 엔드포인트 | 로그인 |
| --- | --- | --- |
| `getShops` | `GET /api/v1/shops` | 불필요 |
| `getShopDetail` | `GET /api/v1/shops/{id}` | 불필요 |
| `getShopsInBoundingBox` | `GET /api/v1/shops/map` | 불필요 |
| `getPriority` | `GET /api/v1/shops/{id}/priority` | 불필요 |
| `calculatePriority` | `POST /api/v1/shops/{id}/priority` | 불필요 |
| `calculateAllPriorities` | `POST /api/v1/priorities/batch` | 불필요 |
| `generateBriefing` | `POST /api/v1/shops/{id}/briefing` | **필요** |
| `signup` · `login` · `logout` | `POST /api/v1/auth/*` | — |

`getPriority` 는 미산정(`PRIORITY4001`)을 오류가 아니라 `null` 로 돌려줍니다.
"아직 계산 안 됨"은 정상 상태이기 때문입니다.

### 등급 표기

백엔드 `PriorityGrade` 는 `S · A · B · C`, 화면은 `1 · 2 · 3 · 4등급` 입니다.
변환은 프론트에서만 하고, `types/shop.ts` 의 이 표가 유일한 접점입니다.

| 와이어 | 화면 | 의미 |
| --- | --- | --- |
| `S` | 1등급 | 최우선 |
| `A` | 2등급 | 우선 |
| `B` | 3등급 | 검토 |
| `C` | 4등급 | 보류 |

`gradeLabel(null)` 은 `'미산정'` 입니다. `score` · `priorityGrade` 는 우선순위
계산 전까지 `null` 이므로 어디서든 미산정 상태를 그릴 수 있어야 합니다.

---

## 로그인

백엔드는 세션(`JSESSIONID`) 방식이라 토큰이 없습니다. 로그인 응답의 `Set-Cookie`
로 세션이 심기고, 이후 요청은 `credentials: 'include'` 가 그 쿠키를 싣습니다.

"지금 누구냐"를 묻는 엔드포인트가 **없어서**, 로그인 결과를
`localStorage.meetroute.user.v1` 에 표시용으로만 둡니다. 서버가 `COMMON401` 을
주면 그때 지웁니다. 세션의 실제 주인은 언제나 쿠키입니다.

---

## 현재 스캐폴드가 담은 것

`App.tsx` 는 API 레이어가 실제로 도는지 보여주는 화면입니다. 연결 배너, 자치구·업태·
등급 필터, 목록·페이징, 상세, 우선순위 조회·재계산, 전체 배치, 로그인/회원가입/
로그아웃, AI 브리핑까지 **8개 엔드포인트 전부**를 한 번씩 씁니다.

아직 옮기지 않은 것:

| 항목 | 현재 |
| --- | --- |
| 카카오 지도 | `getShopsInBoundingBox` 는 준비됐지만 화면은 없음 |
| 관심 목록 · 영업 메모 | 백엔드에 `SalesActivityController` 가 있으나 미연동 |
| 브리핑 캐시 | 프로토타입에는 7일 TTL 캐시가 있음 |

동작하는 전체 화면은 `Unithon-2026/frontend` 의 `prototype/index.html` 에 있습니다.
지도·드로어·localStorage·브리핑 캐시가 거기 들어 있으니 포팅할 때 참고하세요.
