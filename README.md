# meetroute-frontend

`Unithon-2026/backend` (Spring Boot) 에 붙는 React 프론트엔드. Vite + TypeScript,
배포는 Vercel 기준입니다.

```
src/
├─ types/     백엔드 DTO 와 1:1 대응하는 타입
├─ api/       엔드포인트별 fetch 래퍼 (UI 프레임워크 비의존)
├─ map/       카카오 SDK 로더 + 좌표 계산 (SDK 없이 검증 가능한 순수 함수)
├─ store/     localStorage 저장소 (관심 목록 · 브리핑 캐시)
├─ hooks/     여러 화면이 공유하는 데이터 로딩
├─ ui/        화면 컴포넌트
├─ styles.css 디자인 시스템 — prototype/index.html 에서 그대로 옮긴 값
└─ App.tsx    화면 조립
```

---

## 실행

```bash
npm install
cp .env.example .env.local   # 백엔드 주소·카카오 키를 여기에
npm run dev                  # http://localhost:5173
```

백엔드는 `localhost:8080` 에 떠 있어야 합니다. 다른 곳이면 `VITE_BACKEND_ORIGIN`
을 바꾸세요. 지도를 띄우려면 `VITE_KAKAO_APP_KEY` 에 카카오 **JavaScript 키**가
필요합니다 — 없으면 지도만 격자 대체 화면으로 바뀌고 나머지는 그대로 돕니다.

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

지도를 쓴다면 Vercel 프로젝트 설정의 **Environment Variables** 에도 넣습니다.
`VITE_` 접두사가 붙은 값은 빌드 시점에 번들로 구워지므로, 추가한 뒤에는
**재배포해야** 반영됩니다.

```
VITE_KAKAO_APP_KEY = <카카오 JavaScript 키>
```

> 이 키는 번들에 그대로 들어가 누구나 볼 수 있습니다. 카카오 JavaScript 키는
> 원래 그런 용도이고, 대신 **등록된 도메인에서만** 동작합니다. 그러니 콘솔의
> 도메인 등록이 곧 접근 제어입니다. REST API 키는 절대 여기 넣지 마세요.

배포 후 확인할 것:

- [ ] 로그인 후 새로고침해도 로그인이 유지되는가 (rewrite 가 `Set-Cookie` 를 통과시키는지)
- [ ] AI 브리핑이 `COMMON401` 없이 생성되는가
- [ ] 카카오 개발자 콘솔 **플랫폼 > Web** 에 배포 도메인이 등록되어 있는가

---

## 지도

지도는 목록과 다른 엔드포인트를 씁니다. `GET /api/v1/shops` 는 페이지를,
`GET /api/v1/shops/map` 은 좌표가 붙은 배열을 돌려줍니다. 지도는 **보이는 영역만**
조회하므로 전국 데이터를 한 번에 내려받지 않습니다.

`ShopMap.tsx` 가 안고 있는 것들 — 전부 프로토타입에서 실제로 났던 증상의 대응책입니다.

| 증상 | 원인 | 대응 |
| --- | --- | --- |
| 새로고침하면 타일이 한 조각만 | 컨테이너 크기가 0 일 때 지도를 만듦 | `waitForSize()` 후 생성 |
| 목록이 그려지면 지도가 잘림 | 스크롤바·웹폰트로 폭이 바뀜 | `ResizeObserver` → `relayout()` |
| 드래그하면 핀이 깜빡임 | 이동마다 오버레이를 전부 재생성 | `shopId` 로 재사용, 나간 것만 제거 |
| 한 번 드래그에 조회가 여러 번 | `idle` 이 연달아 발생 | 220ms 디바운스 |
| 축소하면 회색 여백 | 카카오는 국내 타일만 제공 | `setMaxLevel(13)` + 중심 클램프 |
| 핀 있는 곳으로 옮기면 사라짐 | 이동 도중 자동 맞춤이 튕김 | `dragstart`·`zoom_start` 에 자동 맞춤 해제 |
| 0건일 때 지도가 통째로 가려짐 | 안내가 전체를 덮음 | 지도 위에서는 `.soft` 작은 카드 |

**앱키가 없거나 SDK 로드가 실패하면** 좌표를 격자 위 상대 위치로 찍는 대체 화면으로
자동 전환됩니다. 핀 클릭 → 상세는 그대로 동작하고 배경 지도만 빠집니다. 데모 중
키가 막혀도 화면이 죽지 않게 하려는 것입니다.

카카오 개발자 콘솔의 **앱 설정 > 플랫폼 > Web** 에 앱이 뜨는 주소를 **전부** 등록해야
합니다. `http://localhost:5173` 과 배포 주소 양쪽 다 필요합니다.

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
| `recordVisit` | `POST /api/v1/shops/{id}/sales_activity` | **필요** |
| `updateMemo` · `saveMemo` | `POST /api/v1/shops/{id}/sales_activity/memo` | **필요** |
| `listActivities` | `GET /api/v1/shops/{id}/sales_activity` | **필요** |

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

## 화면

`prototype/index.html` 의 디자인을 그대로 옮겼습니다. `styles.css` 의 색·간격·
그림자는 프로토타입에서 복사한 값이라 임의로 바꾸면 두 화면이 갈라집니다.

다섯 화면이 전부 열립니다.

| 화면 | 내용 | 데이터 출처 |
| --- | --- | --- |
| 매장 탐색 | 필터 · 목록 · 지도 · 상세 드로어 | 실 API |
| 관심 목록 | 담은 매장, 방문 단계별 추리기 | localStorage + 실 API |
| AI CRM 후속 영업 | 방치 기간순 후속 대상, 활동 집계 | 실 API |
| 팀 영업 현황 | **본인** 실적 (서버에 팀 개념 없음) | 실 API |
| 데이터 관리 | 데이터셋 집계, 일괄 재계산 | 실 API |

지어낸 수치는 없습니다. 서버에 없는 것은 값을 비우고 무엇이 없는지 화면에
적었습니다 — 스크린샷 한 장만 돌아다녀도 있는 기능처럼 보이기 때문입니다.

| 영역 | 내용 |
| --- | --- |
| 사이드바 | 다섯 화면 + 로그인한 사용자 |
| 상단 바 | 브레드크럼 · 제목 · 로그인/회원가입 |
| 배너 | 백엔드 연결 상태. 실패하면 어느 주소로 나갔고 무엇이 틀렸는지까지 |
| 필터 | 자치구 · 업태 드롭다운, 등급 칩, 목록/지도 토글 |
| 목록 | 점수 배지 · 업태 칩 · 북마크 · 순위, 페이징 |
| 지도 | 등급별 핀, 범례, 표시 개수 |
| 드로어 | 오른쪽에서 밀려 나오는 상세 — 우선순위 재계산, AI 브리핑, 영업 활동, 기본 정보 |

목록 · 지도 · 드로어가 같은 `selectedId` 를 보므로 어느 쪽에서 골라도 나머지가
따라옵니다.

### 자치구 · 업태 후보값

백엔드에 facet 엔드포인트가 없어서 목록 몇 페이지를 훑어 distinct 값을 모읍니다
(`api/facets.ts`). 전수가 아니라 **표본**이므로 화면에 "N건 기준"이라고 밝히고
`다시 스캔` 버튼을 함께 둡니다. 결과는 localStorage 에 캐시됩니다.

### 관심 목록

백엔드에 즐겨찾기 엔드포인트가 없어 `localStorage.meetroute.watchlist.v1` 에
둡니다. 저장 시점의 점수·등급을 함께 적어 두므로, 그 뒤 우선순위가 재계산됐다면
상세에서 본 값과 다를 수 있습니다.

방문 단계별 추리기는 **서버의 실제 `VisitStatus`** 를 씁니다. 프로토타입은 프론트
에만 있는 '영업 상태'를 따로 뒀지만, 같은 개념을 두 벌 두면 반드시 어긋납니다.
담긴 매장마다 이력을 한 번씩 읽어야 해서(`hooks/useSavedActivities.ts`) 동시
요청을 4개로 묶어 둡니다. 이 API 는 세션이 필요하므로 로그인 전에는 필터를
감춥니다.

### 데이터 관리의 수치는 어떻게 나오나

백엔드에 집계 엔드포인트가 없어 기존 두 API 로 유도합니다(`api/stats.ts`).

| 수치 | 구하는 법 |
| --- | --- |
| 등록된 매장 | `GET /shops` 의 `totalElements` — 항상 정확 |
| 우선순위 미산정 | 목록을 페이지 단위로 훑어 `score == null` 세기 |
| 지도 표시 불가 | 전체 − 지도 API 가 돌려준 마커 수 |

훑는 페이지에 상한이 있어 데이터가 많으면 **표본**이 됩니다. 그때는 화면이
"N건 표본 기준"이라고 밝힙니다. 지도 API 는 최대 1000건(`MAX_MAP_LIMIT`)이라
전체가 그보다 많으면 좌표 결측을 셀 수 없고, 그 사실도 그대로 적습니다.

### 영업 활동 (방문 단계 · 메모)

백엔드는 방문 기록과 메모를 **분리**해 두었습니다. 메모(`/memo`)는 그 단계의 방문
기록이 먼저 있어야 하고, 없으면 `SALES4001` 을 던집니다.

화면에서는 이걸 한 덩어리로 다룹니다. "메모를 남긴다"는 곧 "그 단계를 밟았다"는
뜻이라, `saveMemo()` 가 `SALES4001` 을 받으면 방문을 먼저 기록하고 다시 시도합니다
(`api/salesActivity.ts`). 사용자에게 버튼을 두 번 누르게 하지 않기 위해서입니다.

단계 버튼에 찍히는 초록 점은 이미 기록된 단계라는 뜻입니다. 단계를 바꾸면 그
단계에 적어 둔 메모가 편집창에 올라옵니다 — 안 그러면 다른 단계 메모를 덮어쓰기
쉽습니다.

세 엔드포인트 모두 세션이 필요하고 **본인 기록만** 보입니다. 비로그인 상태에서는
아예 조회하지 않고 안내만 띄웁니다.

### 브리핑 캐시

브리핑 한 번이 Claude 호출 한 번이라 느리고 돈이 듭니다. 결과를
`localStorage.meetroute.briefing.v1` 에 **7일** 보관하고, 다시 열면 캐시를 먼저
보여줍니다(`오늘 생성` 같은 배지가 붙고 버튼이 `다시 생성`으로 바뀝니다).

브리핑에는 본인 방문 메모가 섞이므로(백엔드 `ShopBriefingService`) 내용이 사용자마다
다릅니다. 한 브라우저를 여러 사람이 쓰면 남의 브리핑이 보일 수 있어서 **로그아웃할
때 캐시를 통째로 비웁니다**.

### 서버에 없어서 만들지 않은 것

프로토타입에는 아래가 하드코딩된 더미로 들어 있었습니다. 대응 엔터티가 없어
값을 지어내는 대신 자리만 두고 무엇이 빠졌는지 화면에 적었습니다.

| 항목 | 없는 것 |
| --- | --- |
| 팀 실적·담당자별 집계 | `User` 에 소속·역할 필드, 남의 활동 조회 권한 |
| 다음 접촉 예정일 | 일정 필드 (`visitedAt` 은 과거 기록만) |
| AI 제안 채택 여부 | 브리핑을 보고 무엇을 했는지 저장할 곳 |
| 수집 일정 · 변경 이력 | 수집 출처·변경 로그 엔터티 |
| 폐업 제외 필터 | `Shop.dataStatus` 컬럼 |
