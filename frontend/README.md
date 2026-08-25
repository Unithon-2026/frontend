# MeetRoute — 프론트엔드 & API 계약

> 식자재·축산물 영업 사원을 위한 지역별 음식점 잠재고객 데이터베이스 및 영업 우선순위 관리 서비스

이 저장소는 **프론트엔드 프로토타입 + 백엔드 API 계약**을 담고 있습니다.

**백엔드**: [`unithon-2026/backend`](https://github.com/unithon-2026/backend) — Spring Boot, 패키지 `com.unithon.meetroute`

---

## 📁 구조

```
.
├── README.md                     ← 지금 이 파일
├── .gitignore
├── prototype/
│   └── index.html                ← 단일 파일 UI 프로토타입 (백엔드 연동 + 더미 폴백)
├── tools/
│   └── dev-server.mjs            ← 정적 서버 + /api 프록시 (CORS 우회, 의존성 없음)
└── api/
    ├── openapi.yaml              ← API 명세 (구현/미구현 구분 표기)
    ├── DATA_MODEL.md             ← 엔터티·필드 대조표·점수 산식
    ├── .env.example              ← 환경변수 예시
    └── mock/
        ├── db.json               ← Mock 데이터 (백엔드 필드명과 1:1)
        ├── routes.json           ← json-server 경로 매핑
        └── industry-weights.json ← 업태 가중치 (백엔드 산식 사본)
```

---

## 🚦 지금 백엔드에 뭐가 있나

**매장 조회·지도·우선순위·AI 브리핑까지 7개가 구현되어 있습니다.**

| 상태 | 엔드포인트 | 설명 |
|:---:|---|---|
| 🟢 | `GET /api/v1/shops` | 매장 목록 (구/업태/등급 필터 + 페이지) |
| 🟢 | `GET /api/v1/shops/map` | **지도 영역(bounding box) 내 매장** — 카카오 지도가 이걸 씁니다 |
| 🟢 | `GET /api/v1/shops/{shopId}` | 매장 상세 |
| 🟢 | `GET /api/v1/shops/{shopId}/priority` | 우선순위 조회 (점수·등급·산정 시각) |
| 🟢 | `POST /api/v1/shops/{shopId}/priority` | 우선순위 재계산 |
| 🟢 | `POST /api/v1/priorities/batch` | 전체 매장 일괄 계산 |
| 🟢 | `POST /api/v1/shops/{shopId}/briefing` | AI 영업 브리핑 (Anthropic API 1회 호출) |
| ⚪ | `POST /api/v1/auth/login` · `/auth/signup` | **서버에 없음** (아래 참고) |
| ⚪ | 지역 · 관심목록 · 팀현황 · 데이터관리 · 변경이력 | **서버에 없음** |
| ⚪ | **AI CRM 후속 영업** (`R-RABMND`) | 엔터티만 있고 컨트롤러 없음 |

> **API 명세서 대조 결과**
>
> - `POST /api/v1/priorities/batch` 가 명세서에 **빠져 있습니다.** 실제로는 구현되어 있습니다.
> - `POST /api/v1/auth/login`·`/auth/signup` 은 명세서에 있지만 **구현되지 않았습니다.**
>   `User` 엔터티에 **비밀번호 컬럼이 없고**, 인증 컨트롤러·JWT 의존성도 없습니다.
> - `GET /api/v1/shops/map` 은 `minLatitude`·`maxLatitude`·`minLongitude`·`maxLongitude`
>   **4개가 필수**입니다. 빠지면 `COMMON400` 입니다.

프로토타입의 관심 목록·영업 상태·메모는 서버가 아니라 **브라우저 `localStorage`** 에 남습니다
(새로고침해도 유지되지만 이 브라우저 밖으로는 나가지 않습니다 — 아래 `localStorage` 절 참고).
팀 현황·데이터 관리·AI CRM 화면의 수치는 하드코딩된 더미이며, 화면에도 `미구현` 배지로 표시됩니다.

---

## 🖥 프로토타입 실행

`prototype/index.html` — 빌드 불필요.

```bash
# 권장 — 정적 서버 + /api 프록시 (CORS 우회)
node tools/dev-server.mjs
# → http://localhost:3000/prototype/index.html
```

**백엔드 `SecurityConfig` 에 CORS 설정이 없습니다.** 그래서 3000 포트에서 8080 을 직접 부르면
브라우저가 전부 막습니다. `tools/dev-server.mjs` 는 `/api/*` 요청을 백엔드로 대신 전달하므로
브라우저 입장에서는 같은 오리진이 되고 **CORS 자체가 발생하지 않습니다.**
백엔드를 고치지 않고 프론트만으로 해결하는 방법입니다.

```bash
BACKEND=http://192.168.0.10:8080 PORT=4000 node tools/dev-server.mjs   # 주소 변경
```

프록시 없이 그냥 정적 서빙만 하려면 (백엔드에 CORS 가 이미 있거나, 더미로만 볼 때):

```bash
python3 -m http.server 3000
```

> ⚠️ `file://` 로 직접 열지 마세요. `fetch` 가 차단됩니다. 반드시 HTTP 로 서빙하세요.

상단 배너가 현재 상태를 알려줍니다.

| 배너 | 의미 |
|---|---|
| 🟢 백엔드 연결됨 | 실제 데이터를 받아옴 (프록시 경유 또는 직접 호출) |
| 🟡 백엔드 미연결 — 더미 데이터 | 서버 응답 없음. `MOCK_SHOPS` 로 폴백. 배너에 원인 안내 |

프로토타입은 기본적으로 **같은 오리진**(`/api/...`)으로 요청합니다 — 위 프록시를 타기 위해서입니다.
백엔드를 직접 부르려면(백엔드에 CORS 가 이미 있는 경우) 브라우저 콘솔에서:

```js
localStorage.setItem('meetroute.apiBase', 'http://localhost:8080');  // 직접 호출
localStorage.removeItem('meetroute.apiBase');                        // 프록시로 되돌리기
```

---

## 🧷 백엔드는 건드리지 않습니다

이 저장소만 수정하는 것을 전제로 맞춰져 있습니다. 백엔드에서 오는 값은 **그대로** 받아들이고,
차이는 프론트 표시층에서 흡수합니다.

| 백엔드 현실 | 프론트 대응 |
|---|---|
| 등급이 `S`/`A`/`B`/`C` | 화면에만 1~4 등급으로 표기 (`WIRE_TO_GRADE`). 통신은 서버 값 그대로 |
| CORS 설정 없음 | `tools/dev-server.mjs` 가 `/api` 를 프록시해 같은 오리진으로 만듦 |
| 인증 없음 (`permitAll`) | 로그인 화면 없음. 사용자·권한 UI 는 더미 |
| 관심목록·팀·이력 엔터티 없음 | 브라우저 메모리 + 더미. 화면에 `미구현` 배지 |

---

## 🗺 카카오 지도

지도는 **카카오 지도 JavaScript SDK** 를 씁니다. 백엔드의 `GET /api/v1/shops/map` 이
bounding box 방식이라 카카오의 `getBounds()` 와 그대로 맞물립니다.

```
지도 이동/확대 끝남 (idle)
   → map.getBounds()
   → 남서 좌표 = minLatitude / minLongitude
     북동 좌표 = maxLatitude / maxLongitude
   → GET /api/v1/shops/map?minLatitude=…&maxLatitude=…&minLongitude=…&maxLongitude=…
   → 받은 마커를 CustomOverlay 로 그림
```

보이는 영역만 조회하므로 전국 데이터를 한 번에 내려받지 않습니다. 자치구·업태·등급 필터도
같이 넘어가서 목록과 지도가 항상 같은 조건을 봅니다.

### 앱키 설정

빌드가 없어 `.env` 를 읽지 못합니다. 브라우저 콘솔에서 넣으세요.

```js
localStorage.setItem('meetroute.kakaoKey', '<JavaScript 키>');
location.reload();
```

1. [카카오 개발자](https://developers.kakao.com) → 내 애플리케이션 → **JavaScript 키** 복사
2. 같은 앱의 **플랫폼 > Web** 에 실행 주소를 등록 (예: `http://localhost:3000`)
   — 등록하지 않으면 SDK 가 거부합니다.

### 앱키가 없으면

자동으로 **대체 화면**으로 넘어갑니다. 격자 배경에 좌표를 상대 위치로 찍는 방식이라
지도 타일만 없을 뿐 핀·필터·클릭은 그대로 동작합니다. 지도 위에 원인과 설정 방법이 표시됩니다.

---

## 💾 브라우저에 남는 것 (`localStorage`)

서버에 관심 목록·메모 엔터티가 없고 브리핑은 호출마다 비용이 들어서, 세 가지를
브라우저에 담아 둡니다. **이 브라우저에서만** 유효하고 팀과 공유되지 않습니다.
시크릿 모드나 용량 초과로 저장이 막히면 조용히 메모리 전용으로 떨어지고,
관심 목록 화면 상단 배너가 그 사실을 알려 줍니다.

| 키 | 내용 | 수명 |
|---|---|---|
| `meetroute.watchlist.v1` | 관심 매장 + 영업 상태 + 메모 (매장 스냅샷 포함) | 직접 지울 때까지 |
| `meetroute.briefing.v1` | 매장별 AI 브리핑 본문·생성 시각 | 최근 50건 (오래된 것부터 폐기) |
| `meetroute.facets.v1` | 자치구·업태 후보값 스캔 결과 | 24시간 |
| `meetroute.apiBase` | 백엔드 절대주소 (프록시를 안 쓸 때) | 직접 지울 때까지 |
| `meetroute.kakaoKey` | 카카오 JavaScript 앱키 | 직접 지울 때까지 |

전부 지우려면 콘솔에서:

```js
Object.keys(localStorage).filter(k => k.startsWith('meetroute.')).forEach(k => localStorage.removeItem(k));
```

### 관심 목록 · 영업 메모

북마크 버튼으로 저장하면 새로고침해도 남습니다. 메모는 타이핑이 잠깐 멈추거나
입력칸에서 포커스가 빠질 때 저장합니다. 매장 정보 스냅샷을 함께 담기 때문에
백엔드가 꺼져 있어도 관심 목록 화면은 그대로 그려집니다.
관심 목록 화면 오른쪽 위 **저장 목록 비우기** 로 한 번에 지웁니다.

### AI 브리핑 캐싱

브리핑 1건이 서버에서 Claude API 호출 1회입니다. 그래서 생성 결과를 매장별로
담아 두고, 드로어를 다시 열면 **호출 없이** 그 내용을 보여 줍니다.
이때 본문 아래에 `저장된 브리핑 · 2026-08-25 09:30` 처럼 생성 시각이 붙고
버튼 문구가 `브리핑 다시 생성` 으로 바뀝니다. 새로 부르는 건 이 버튼을 눌렀을 때뿐입니다.
생성한 지 7일이 지나면 "오래된 내용일 수 있습니다" 를 덧붙이지만 지우지는 않습니다.

### 자치구 · 업태 후보값

백엔드에 "업태 목록" / "자치구 목록" 엔드포인트가 없습니다(⚪ 미구현).
더미에서 뽑은 몇 종만 쓰면 실제 데이터에 있는 업태를 고를 수 없으므로,
목록 API 를 `size=1000&sort=id,asc` 로 최대 5장(5,000건)까지 훑어서
**실제로 존재하는 값과 건수**를 뽑아 채웁니다. 결과는 24시간 캐시합니다.

- 첫 페인트는 네트워크 없이 캐시 또는 더미로 즉시 채웁니다.
- 스캔은 백엔드 연결 여부가 정해진 뒤(첫 목록 조회 직후)에 한 번 돕니다.
- 필터 아래 줄에 출처를 그대로 적습니다 —
  `후보값은 실제 데이터 4,812건 표본 기준 — 업태 38종 · 자치구 25곳`.
- 전체가 5,000건을 넘으면 `(전체 N건 중 앞 5,000건만 훑음)` 이 붙습니다.
- **다시 스캔** 을 누르면 캐시를 무시하고 새로 훑습니다.

서버에 목록 엔드포인트가 생기면 `scanFacets()` 만 그 호출로 바꾸면 됩니다.

---

## 🔌 API 규약 (4가지만 기억하면 됩니다)

### 1. 모든 응답은 `ApiResponse` 봉투에 싸여 있다

```jsonc
{ "success": true,  "code": null,       "message": "OK", "data": { /* 실제 데이터 */ } }
{ "success": false, "code": "SHOP4001", "message": "해당 매장을 찾을 수 없습니다.", "data": null }
```

성공/실패 판정은 **HTTP 상태코드가 아니라 `success` 필드**로 합니다.
분기가 필요하면 `code` 를 보세요 (`COMMON400` / `COMMON404` / `COMMON500` / `SHOP4001` / `PRIORITY4001` / `SHOP5001`).

### 2. 목록은 Spring `Page` 다 — 필드명이 초안과 다르다

| 초안 | 실제 |
|---|---|
| `items` | `content` |
| `total` | `totalElements` |
| `pageSize` | `size` |
| `page` (1부터) | `number` (**0부터**) |

요청도 `page` 가 **0부터** 시작하고, 정렬은 `sort=score,desc` 형식(Spring 규약)입니다.

**단, 지도(`/shops/map`)는 `Page` 가 아니라 평평한 배열입니다.**

### 3. 등급 — 서버는 `S/A/B/C`, 화면은 1~4

| 서버 값 | 점수 구간 | 화면 표기 |
|:---:|---|:---:|
| `S` | 80 이상 | 1등급 · 최우선 |
| `A` | 60 이상 | 2등급 · 우선 |
| `B` | 40 이상 | 3등급 · 검토 |
| `C` | 40 미만 | 4등급 · 보류 |

**통신은 항상 서버 값입니다.** 필터도 `?priorityGrade=S` 로 나갑니다.
1~4 표기는 `prototype/index.html` 의 `WIRE_TO_GRADE` / `GRADE_TO_WIRE` 매핑으로
화면에서만 바뀝니다 — 백엔드를 고치지 않기 위한 선택입니다.

점수는 **100점 만점**이고 산식은 이렇습니다:

```
업태 가중치 (0~50)  +  시설 면적 (0~30)  +  연락처 보유 (0 또는 20)
```

- 업태: `식육(숯불구이)` 50 · `한식` 40 · `중국식` 25 · `분식` 5 … 표에 없는 업태는 **0점**
- 면적: 200㎡↑ 30 · 100㎡↑ 20 · 50㎡↑ 10 · 그 외/결측 0
- 연락처: 있으면 20

프로토타입은 이 산식을 그대로 재현해 상세 화면에서 **점수 내역을 분해해 보여줍니다.**

### 4. `score` / `priorityGrade` 는 null 일 수 있다

계산이 돌기 전에는 두 값 모두 `null` 이고, 조회 시 `PRIORITY4001` 이 납니다.
`POST /shops/{id}/priority` (개별) 또는 `POST /priorities/batch` (전체) 로 채웁니다.
목록·상세·지도 어디서든 "미산정" 상태를 그릴 수 있어야 합니다.

전체 명세는 `api/openapi.yaml`, 필드 대조표는 `api/DATA_MODEL.md` 를 보세요.

---

## 🧭 화면 ↔ API 매핑

| 프로토타입 화면 | 주요 API | 상태 |
|---|---|:---:|
| 매장 탐색 (목록) | `GET /api/v1/shops` | 🟢 |
| 지도 보기 (카카오 지도) | `GET /api/v1/shops/map` | 🟢 |
| 상세 드로어 — 기본 정보 | `GET /api/v1/shops/{id}` | 🟢 |
| 상세 드로어 — 우선순위 근거 | 산식 재현 + `GET /shops/{id}/priority` | 🟢 |
| 상세 드로어 — 재계산 | `POST /api/v1/shops/{id}/priority` | 🟢 |
| 상세 드로어 — AI 브리핑 | `POST /api/v1/shops/{id}/briefing` | 🟢 |
| 데이터 관리 — 일괄 계산 | `POST /api/v1/priorities/batch` | 🟢 |
| 자치구 · 업태 선택 | `GET /api/v1/regions` 대신 목록 API 스캔 | 🟡 |
| 관심 목록 · 메모 | `GET/POST /api/v1/watchlist` 대신 `localStorage` | 🟡 |
| 팀 영업 현황 | `GET /api/v1/team/watchlist` | ⚪ |
| 데이터 관리 — 출처·이력 | `GET /api/v1/admin/*` | ⚪ |
| **AI CRM 후속 영업** | `/shops/{id}/sales-activities`, `/shops/{id}/crm-suggestion` | ⚪ |

🟢 서버 API 그대로 · 🟡 서버에 없어서 프론트에서 대신 해결 (위 `localStorage` 절 참고) · ⚪ 화면만 있고 미연결

---

## 🤖 AI CRM 후속 영업 (신규 요구사항 `R-RABMND`)

기획서에 추가된 요구사항으로, **서버에 엔터티가 아직 없습니다.** 계약과 화면 설계만 반영했습니다.

- `F-QBNKTD` **AI CRM 후속 영업 어시스턴트** — 영업 시도 결과를 기록하면 AI가 이력을 요약하고
  다음 후속 접촉 시점·방식과 콜드콜 스크립트 또는 콜드메일 초안을 제안합니다.
- `F-FUPSJX` **AI 대화형 영업 기록 분석 및 데이터 라벨링** — 단계별 질문으로 기록을 받고
  AI가 라벨을 추출하면, 담당자가 검토·수정한 뒤 저장합니다.

기획에서 확정된 규칙 중 계약에 반영한 것:

| 항목 | 확정 내용 |
|---|---|
| 제안 시작 조건 | 실패 또는 보류 결과가 기록되면 |
| 후속 시점 | 고정 일수 아님 — 이력과 결과를 바탕으로 AI가 결정 |
| 정보 부족 시 | 일반 제안 대신 담당자에게 추가 질문 요청 |
| 알림 중복 | 가장 최근 제안만 유지 |
| 콜드메일 | 발송 전 수신 동의·적법 근거 확인을 안내 |
| 라벨 저장 | 담당자 검토·수정 후에만 저장 |
| 라벨 범위 | 핵심(결과·관심 품목·거절 사유·다음 행동) + 예산·의사결정자·구매 시기·경쟁사 |
| 민감 정보 | 감지되면 저장 전 경고하고 수정 요청 |
| 보존 기간 | 원문·AI 요약 3년 |
| 학습 동의 | 조직 관리자가 조직 단위로 관리 |
| 팀장·관리자 조회 | 팀원 이력과 AI 제안 **요약만** |

스키마는 `api/openapi.yaml` 의 `SalesActivity` / `DataLabel` / `CrmSuggestion`,
엔터티 설계는 `api/DATA_MODEL.md` 참고.

---

## 🧪 Mock 서버 (선택)

```bash
npx json-server --watch api/mock/db.json --routes api/mock/routes.json --port 4000
```

> ⚠️ **json-server 는 `ApiResponse` 봉투도 Spring `Page` 도 재현하지 못합니다.**
> 응답 형태 확인은 실제 백엔드를 띄워서 하세요. `db.json` 은 **필드명 합의용**입니다.
> 프로토타입은 json-server 대신 자체 폴백(`MOCK_SHOPS`)을 씁니다.

`db.json` 의 16건은 **백엔드 산식으로 계산한 점수·등급과 정확히 일치**시켜 두었습니다
(1등급 5건 · 2등급 5건 · 3등급 2건 · 4등급 2건 · 미산정 1건, 결측 케이스 포함).

---

## 🔁 초안 대비 바뀐 것

| 항목 | 초안 | 실제 백엔드 |
|---|---|---|
| 서버 주소 | `api.meatlead.example/v1`, `:4000` | `localhost:8080` + `/api/v1` |
| 리소스명 | `/leads` (잠재고객) | `/shops` (매장) |
| 응답 | 맨 객체 | `ApiResponse` 봉투 |
| 페이징 | `items`/`total`, page 1부터 | Spring `Page`, page **0부터** |
| id | 문자열 `L001` | **숫자** (Long) |
| 주소 | `address` 한 덩어리 | `addressJibun` + `gu` + `dong` |
| 업종 | `industry` (마케팅 카테고리) | `businessType` (**위생업태명** 원본) |
| 점수 | `priorityScore` | `score` (**nullable**) |
| 등급 | S/A/B/C | S/A/B/C (동일) · **화면 표기만 1~4** |
| 규모 | `sizeEstimate` `"중형 (48석)"` | `area` **숫자(㎡)** |
| 지역 필터 | `regionCode` (`11200`) | `gu` (`"성동구"` 문자열) |
| 정렬 | `sort=priority_desc` | `sort=score,desc` |
| 지도 | 목록에 좌표 포함 가정 | **카카오 지도** + 전용 엔드포인트 `/shops/map` (bounding box) |
| 브리핑 | `GET` | **`POST`** (호출마다 AI 비용 발생) |
| 인증 | JWT bearer | **없음** (전체 permitAll) |
| — | 없음 | `phone` 이 새로 생김 |

**삭제된 필터**: `includeClosed`(폐업 제외). 백엔드 `Shop` 에 `dataStatus` 컬럼 자체가 없어
구현이 불가능합니다.

**사라진 필드**: `dataStatus`, `salesConditionBadge`, `confidence`, `dataUpdatedAt`,
`createdAt`, `openedAt`, `sources`. 서버에 컬럼이 없습니다.

---

## ❓ 백엔드에 확인이 필요한 것

1. **점수 배점이 거칠어 동점이 많습니다.** 한식(40) + 100㎡↑(20) + 연락처(20) = 80점이면
   전부 1등급으로 묶입니다. 순위를 세밀하게 나누려면 면적 비례 점수 같은 연속값이 필요합니다.
2. **연락처 유무가 20점**이라 데이터 결측이 곧 낮은 점수가 됩니다. 실제 영업 가치와 무관할 수 있어
   가중치 재검토가 필요해 보입니다.
3. **`businessType` 해상도** — 위생업태명은 `한식` 수준이라 고깃집과 김밥집이 같은 값입니다.
   상호명 키워드나 별도 분류 컬럼이 있으면 점수 정확도가 올라갑니다.
4. **업태 가중치가 하드코딩**되어 있습니다. 기획상 조직 관리자가 변경할 수 있어야 하므로
   DB나 설정으로 빼야 합니다.
5. **일괄 계산 트리거** — 지금은 수동 `POST /priorities/batch` 뿐입니다.
   데이터 수집 후 자동 실행되는 스케줄이 필요한지 확인이 필요합니다.
6. **`dataStatus`(폐업) 컬럼 추가 여부** — 폐업 제외는 기획 확정 규칙인데 컬럼이 없습니다.
7. **인증 도입 시점** — 역할 기반 권한(팀장/관리자 전용 화면)과 AI CRM 의 담당자 개념이
   전부 여기에 묶여 있습니다.
8. **일괄 계산 권한** — 현재 누구나 `POST /priorities/batch` 를 호출할 수 있습니다(permitAll).

---

*API 명세와 데이터 모델은 백엔드 코드를 기준으로 갱신됩니다. 서버가 바뀌면 `api/openapi.yaml` 부터 맞추세요.*
