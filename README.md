# MeatLead — 프론트엔드 & API 계약

> 축산물 영업인을 위한 지역별 음식점 잠재고객 데이터베이스 및 영업 우선순위 관리 서비스

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
    ├── DATA_MODEL.md             ← 엔터티·필드 대조표·권한 매트릭스
    ├── .env.example              ← 환경변수 예시
    └── mock/
        ├── db.json               ← Mock 데이터 (백엔드 필드명과 1:1)
        ├── routes.json           ← json-server 경로 매핑
        └── industry-weights.json ← 업태 가중치 (점수 계산 입력)
```

---

## 🚦 지금 백엔드에 뭐가 있나

**구현된 것은 매장 조회 두 개뿐입니다.**

| 상태 | 엔드포인트 | 설명 |
|:---:|---|---|
| 🟢 | `GET /api/v1/shops` | 매장 목록 (구/업태/등급 필터 + 페이지) |
| 🟢 | `GET /api/v1/shops/{shopId}` | 매장 상세 |
| ⚪ | 그 외 전부 | 인증·지역·관심목록·팀현황·데이터관리·점수근거·지도 — **서버에 없음** |

프로토타입의 관심 목록·영업 상태·메모는 **브라우저 메모리에만** 존재합니다(새로고침 시 소실).
팀 현황·데이터 관리 화면의 수치는 하드코딩된 더미입니다. 화면에도 `미구현` 배지로 표시됩니다.

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
localStorage.setItem('meatlead.apiBase', 'http://192.168.0.10:8080');
```

### ⚠️ CORS

백엔드 `SecurityConfig` 에 **CORS 설정이 없습니다.** 다른 포트(3000)에서 8080 을 호출하면
브라우저가 막습니다. 백엔드에 CORS 허용 추가가 필요합니다 — **백엔드 담당자 협의 대상.**

---

## 🔌 API 규약 (3가지만 기억하면 됩니다)

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

### 3. `score` / `priorityGrade` 는 null 일 수 있다

우선순위 계산 배치가 돌기 전에는 두 값 모두 `null` 입니다.
목록·상세·지도 어디서든 "미산정" 상태를 그릴 수 있어야 합니다.

전체 명세는 `api/openapi.yaml`, 필드 대조표는 `api/DATA_MODEL.md` 를 보세요.

---

## 🧭 화면 ↔ API 매핑

| 프로토타입 화면 | 주요 API | 상태 |
|---|---|:---:|
| 매장 탐색 (목록) | `GET /api/v1/shops` | 🟢 |
| 상세 드로어 — 기본 정보 | `GET /api/v1/shops/{id}` | 🟢 |
| 상세 드로어 — 우선순위 **근거** | `GET /api/v1/shops/{id}/priority` | ⚪ |
| 지도 보기 | 목록 DTO에 좌표 없음 (상세에만 있음) | ⚪ |
| 자치구 선택 | `GET /api/v1/regions` (현재는 하드코딩) | ⚪ |
| 관심 목록 | `GET/POST /api/v1/watchlist` | ⚪ |
| 팀 영업 현황 | `GET /api/v1/team/watchlist` | ⚪ |
| 데이터 관리 | `GET /api/v1/admin/*`, `GET /api/v1/shops/{id}/history` | ⚪ |

---

## 🧪 Mock 서버 (선택)

```bash
npx json-server --watch api/mock/db.json --routes api/mock/routes.json --port 4000
```

> ⚠️ **json-server 는 `ApiResponse` 봉투도 Spring `Page` 도 재현하지 못합니다.**
> 응답 형태 확인은 실제 백엔드를 띄워서 하세요. `db.json` 은 **필드명 합의용**입니다.
> 프로토타입은 json-server 대신 자체 폴백(`MOCK_SHOPS`)을 씁니다.

---

## 🔁 초안 대비 바뀐 것

이 저장소는 원래 Manyfast 기획서 기반 **API 초안**이었고, 실제 백엔드가 나오면서 아래를 맞췄습니다.

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
| 규모 | `sizeEstimate` `"중형 (48석)"` | `area` **숫자(㎡)** |
| 지역 필터 | `regionCode` (`11200`) | `gu` (`"성동구"` 문자열) |
| 정렬 | `sort=priority_desc` | `sort=score,desc` |
| 인증 | JWT bearer | **없음** (전체 permitAll) |
| — | 없음 | `phone` 이 새로 생김 |

**삭제된 필터**: `includeClosed`(폐업 제외). 백엔드 `Shop` 에 `dataStatus` 컬럼 자체가 없어
구현이 불가능합니다. 대신 백엔드가 지원하는 **업태·등급 필터**를 넣었습니다.

**사라진 필드**: `dataStatus`, `salesConditionBadge`, `confidence`, `dataUpdatedAt`,
`createdAt`, `openedAt`, `sources`. 서버에 컬럼이 없습니다. 프로토타입에서 관련 UI를 걷어냈습니다.

---

## ❓ 백엔드에 확인이 필요한 것

1. **CORS** — 설정이 없어 브라우저에서 호출이 막힙니다. (가장 시급)
2. **목록 DTO에 좌표 추가** — 지도를 붙이려면 `ShopListItemResponse` 에 `latitude`/`longitude`
   가 필요합니다. 지금은 상세에만 있어 N번 조회해야 합니다.
3. **`businessType` 해상도** — 위생업태명은 `한식`/`중국식` 수준이라 "고깃집"과 "김밥집"이
   같은 `한식` 입니다. 점수 산식에 상호명 키워드나 별도 분류 컬럼이 필요합니다.
   (제안은 `api/mock/industry-weights.json` 의 `nameKeywordBoost` 참고)
4. **등급 S/A/B/C 의 점수 구간** — 서버가 계산하지만 기준이 공개되어 있지 않습니다.
5. **우선순위 계산 배치 트리거** — `Priority` 엔터티는 있으나 계산·갱신 코드가 안 보입니다.
   언제 `score` 가 채워지나요?
6. **`dataStatus`(폐업) 컬럼 추가 여부** — 폐업 제외는 기획 확정 규칙인데 컬럼이 없습니다.
7. **인증 도입 시점** — 역할 기반 권한(팀장/관리자 전용 화면)이 전부 여기에 묶여 있습니다.

---

*API 명세와 데이터 모델은 백엔드 코드를 기준으로 갱신됩니다. 서버가 바뀌면 `api/openapi.yaml` 부터 맞추세요.*
