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
└── api/
    ├── openapi.yaml              ← API 명세 (구현/미구현 구분 표기)
    ├── DATA_MODEL.md             ← 엔터티·필드 대조표·점수 산식
    ├── .env.example              ← 환경변수 예시
    ├── backend-patch/            ← 백엔드에 적용할 패치 (아래 참고)
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
| 🟢 | `GET /api/v1/shops/map` | **지도 영역(bounding box) 내 매장** — 좌표 포함 |
| 🟢 | `GET /api/v1/shops/{shopId}` | 매장 상세 |
| 🟢 | `GET /api/v1/shops/{shopId}/priority` | 우선순위 조회 (점수·등급·산정 시각) |
| 🟢 | `POST /api/v1/shops/{shopId}/priority` | 우선순위 재계산 |
| 🟢 | `POST /api/v1/priorities/batch` | 전체 매장 일괄 계산 |
| 🟢 | `POST /api/v1/shops/{shopId}/briefing` | AI 영업 브리핑 (Anthropic API 1회 호출) |
| ⚪ | 인증 · 지역 · 관심목록 · 팀현황 · 데이터관리 · 변경이력 | **서버에 없음** |
| ⚪ | **AI CRM 후속 영업** (`R-RABMND`) | **서버에 없음** — 화면 설계만 존재 |

프로토타입의 관심 목록·영업 상태·메모는 **브라우저 메모리에만** 존재합니다(새로고침 시 소실).
팀 현황·데이터 관리·AI CRM 화면의 수치는 하드코딩된 더미이며, 화면에도 `미구현` 배지로 표시됩니다.

---

## 🖥 프로토타입 실행

`prototype/index.html` — 빌드 불필요.

```bash
# 백엔드가 떠 있으면 실제 데이터로, 아니면 자동으로 더미 폴백
python3 -m http.server 3000
# → http://localhost:3000/prototype/index.html
```

> ⚠️ `file://` 로 직접 열지 마세요. `fetch` 가 차단됩니다. 반드시 HTTP 로 서빙하세요.

상단 배너가 현재 상태를 알려줍니다.

| 배너 | 의미 |
|---|---|
| 🟢 백엔드 연결됨 | `http://localhost:8080` 에서 실제 데이터를 받아옴 |
| 🟡 백엔드 미연결 — 더미 데이터 | 서버 응답 없음. `MOCK_SHOPS` 로 폴백 |

백엔드 주소를 바꾸려면 브라우저 콘솔에서:

```js
localStorage.setItem('meetroute.apiBase', 'http://192.168.0.10:8080');
```

---

## 🔧 백엔드에 먼저 적용할 패치

`api/backend-patch/0001-priority-grade-1-4-and-cors.patch`

백엔드 저장소에서:

```bash
git am < ../frontend/api/backend-patch/0001-priority-grade-1-4-and-cors.patch
```

두 가지가 들어 있습니다.

1. **우선순위 등급 1~4 전환** — `PriorityGrade` 를 `S/A/B/C` 에서 `G1~G4` 로 바꾸고
   `@JsonValue`/`@JsonCreator` 로 JSON·쿼리에서는 `"1"`~`"4"` 를 쓰게 합니다.
2. **CORS 허용** — `SecurityConfig` 에 CORS 설정이 없어 브라우저가 `/api` 호출을 전부 막고 있었습니다.
   `app.cors.allowed-origins` 로 오리진을 지정할 수 있고 기본값은 로컬 개발용입니다.

**이 패치를 적용하지 않으면** 프로토타입이 항상 폴백(더미)으로 뜹니다 — CORS 때문입니다.
등급 필터도 `?priorityGrade=1` 이 `COMMON400` 으로 떨어집니다.

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

### 3. 등급은 1~4 — **1등급이 가장 높다**

| 등급 | 점수 구간 | 의미 |
|:---:|---|---|
| `"1"` | 80 이상 | 최우선 |
| `"2"` | 60 이상 | 우선 |
| `"3"` | 40 이상 | 검토 |
| `"4"` | 40 미만 | 보류 |

문자열입니다(`"1"`, 숫자 `1` 아님). 필터도 `?priorityGrade=1`.

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
| 지도 보기 | `GET /api/v1/shops/map` | 🟢 |
| 상세 드로어 — 기본 정보 | `GET /api/v1/shops/{id}` | 🟢 |
| 상세 드로어 — 우선순위 근거 | 산식 재현 + `GET /shops/{id}/priority` | 🟢 |
| 상세 드로어 — 재계산 | `POST /api/v1/shops/{id}/priority` | 🟢 |
| 상세 드로어 — AI 브리핑 | `POST /api/v1/shops/{id}/briefing` | 🟢 |
| 데이터 관리 — 일괄 계산 | `POST /api/v1/priorities/batch` | 🟢 |
| 자치구 선택 | `GET /api/v1/regions` (현재는 더미에서 추출) | ⚪ |
| 관심 목록 | `GET/POST /api/v1/watchlist` | ⚪ |
| 팀 영업 현황 | `GET /api/v1/team/watchlist` | ⚪ |
| 데이터 관리 — 출처·이력 | `GET /api/v1/admin/*` | ⚪ |
| **AI CRM 후속 영업** | `/shops/{id}/sales-activities`, `/shops/{id}/crm-suggestion` | ⚪ |

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
| **등급** | **S/A/B/C** | **`"1"`~`"4"`** (1이 최상위) |
| 규모 | `sizeEstimate` `"중형 (48석)"` | `area` **숫자(㎡)** |
| 지역 필터 | `regionCode` (`11200`) | `gu` (`"성동구"` 문자열) |
| 정렬 | `sort=priority_desc` | `sort=score,desc` |
| 지도 | 목록에 좌표 포함 가정 | **전용 엔드포인트** `/shops/map` (bounding box) |
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
