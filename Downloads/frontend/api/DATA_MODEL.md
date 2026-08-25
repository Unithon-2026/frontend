# MeetRoute 데이터 모델

백엔드(`unithon-2026/backend`, `com.unithon.meetroute`)의 **실제 엔터티**와, Manyfast 기능명세서에서
도출했지만 **아직 서버에 없는** 설계 초안을 구분해서 정리합니다.

> 🟢 **구현됨** — 서버 코드에 존재. 필드명·타입이 아래 표와 1:1.
> ⚪ **미구현** — 기획 단계 초안. 서버에 엔터티 자체가 없음. 구현 시 아래 규약 준수 필요.

---

## 관계 요약

```
🟢 Shop (매장 = 잠재고객)  1 ──1  🟢 Priority (우선순위 계산 결과)
      └─ score / priorityGrade 는 Priority 계산 결과를 Shop 에 캐싱한 비정규화 컬럼
         (조인 없이 정렬·필터하기 위한 것. PriorityService 에서만 갱신)

⚪ Shop 1 ──* SalesActivity *──1 User      (AI CRM 영업 이력)
⚪ SalesActivity 1 ──* DataLabel           (AI 추출 라벨)
⚪ Shop 1 ──1 CrmSuggestion                (AI 후속 접촉 제안)
⚪ User ── assignedRegions ── ⚪ Region
⚪ Shop 1 ──* WatchlistEntry *──1 User
⚪ Shop 1 ──* History
⚪ IndustryWeight   ── Priority 계산 입력
⚪ DataSource       ── Shop 수집·표준화
⚪ DedupCandidate   ── Shop ↔ Shop
```

---

## 🟢 Shop — 매장 (잠재고객)

`domain/shop/entity/Shop.java`. 서울시 공공데이터(위생업소) 기준 레코드.

| 필드 | 타입 | Null | 설명 |
|---|---|:---:|---|
| id | Long (PK) | ✗ | **숫자**입니다. 초안의 `L001` 같은 문자열 아님 |
| name | String | | 사업장명 |
| addressJibun | String | | 지번 주소. **도로명 주소 컬럼은 없음** |
| gu | String | | 자치구 (예: `성동구`). 목록 필터 키 |
| dong | String | | 법정동 (예: `행당동`) |
| phone | String | ✓ | 연락처 |
| businessType | String | | 위생업태명. 원본 텍스트 그대로 |
| area | BigDecimal | ✓ | 시설 면적(㎡). JSON 에서는 **number** |
| longitude / latitude | BigDecimal | ✓ | 좌표. null 이면 지도 미표시 |
| score | Integer | ✓ | 우선순위 점수(0~100). **미계산 시 null** |
| priorityGrade | enum(G1~G4) | ✓ | 우선순위 등급. JSON 에서는 **`"1"`~`"4"`**. **미계산 시 null** |

**꼭 알아둘 것**

- `businessType` 은 **enum 이 아니라 자유 문자열**입니다. 공공데이터 CSV에 없던 값이 들어와도
  삽입이 깨지지 않도록 백엔드가 의도적으로 String 으로 둔 컬럼이라, 프론트에서 고정 목록으로
  가정하면 안 됩니다.
- `score` / `priorityGrade` 는 `Priority` 계산 결과를 조인 없이 정렬·필터하려고 Shop 에 복사해 둔
  **비정규화 컬럼**입니다. `Shop.applyPriority()` 로만 갱신되며, 배치가 돌기 전에는 **둘 다 null**.
  목록·상세·지도 어디서든 "미산정" 상태를 그릴 수 있어야 합니다.
- `area` 는 숫자(㎡)입니다. 초안의 `sizeEstimate`("중형 (48석)") 같은 문구가 아니므로
  **표시용 구간 나누기는 프론트 책임**입니다.

### 필터·정렬 (`GET /api/v1/shops`)

| 파라미터 | 동작 |
|---|---|
| `gu` | 정확히 일치. 부분 검색 아님 |
| `businessType` | 정확히 일치 |
| `priorityGrade` | `1`~`4` (**1등급이 최상위**). 그 외 값이면 `COMMON400` |
| `page` | **0부터 시작** |
| `size` | 기본 20 |
| `sort` | `필드명,asc\|desc` (기본 `score,desc`) |

---

## 🟢 Priority — 우선순위 계산 결과

`domain/priority/entity/Priority.java`. Shop 과 1:1.

| 필드 | 타입 | 설명 |
|---|---|---|
| id | Long (PK) | |
| shop | Shop (FK, unique) | 1:1 |
| score | int | 점수 |
| priorityGrade | enum(G1~G4) | 등급. **JSON 에서는 `"1"`~`"4"`** (`@JsonValue`) |
| calculatedAt | LocalDateTime | 산정 시점 |

### 등급 체계

**1등급이 가장 높고 4등급이 가장 낮습니다.**

| 등급 | 점수 구간 | 의미 |
|:---:|---|---|
| `1` | 80 이상 | 최우선 |
| `2` | 60 이상 | 우선 |
| `3` | 40 이상 | 검토 |
| `4` | 40 미만 | 보류 |
| `null` | — | 미산정 (계산 전) |

자바 enum 상수는 숫자로 시작할 수 없어 내부적으로는 `G1`~`G4` 이고 DB에도 그렇게 저장됩니다.
JSON 직렬화와 쿼리 파라미터에서는 `@JsonValue`/`@JsonCreator` 로 `"1"`~`"4"` 를 씁니다.

### 점수 산식

`domain/priority/service/PriorityScoreCalculator.java`. **총점 100점 만점.**

| 항목 | 배점 | 규칙 |
|---|:---:|---|
| 업태 가중치 | 0~50 | `businessType` 별 고정 가중치 표. 표에 없는 업태는 **0점** |
| 시설 면적 | 0~30 | 200㎡ 이상 30 · 100㎡ 이상 20 · 50㎡ 이상 10 · 그 외/결측 0 |
| 연락처 보유 | 0 또는 20 | `phone` 이 비어 있지 않으면 20 |

업태 가중치 상위 (전체 표는 소스 참고):
`식육(숯불구이)` 50 · `호프/통닭` 45 · `통닭(치킨)` 45 · `한식` 40 ·
`경양식`·`패밀리레스트랑`·`탕류(보신용)` 35 · `뷔페식` 30 · `중국식` 25 ·
`일식`·`정종/대포집/소주방`·`감성주점` 20 · `패스트푸드` 15 ·
`이동조리`·`출장조리`·`푸드트럭` 10 · `분식`·`김밥(도시락)`·`횟집`·`냉면집` 5

> ⚠️ 방문 이력(`Sales_Activity`) 데이터가 없어 지금은 **Shop 컬럼만으로** 채점합니다.
> 상권 밀집도·개업 시기·재방문율 등은 반영되지 않습니다.

> ⚠️ 배점이 거친 계단식이라 **동점이 많이 생깁니다.** 예를 들어 한식(40) + 100㎡ 이상(20) +
> 연락처(20) = 80점이면 전부 1등급으로 묶입니다. 순위를 세밀하게 나누려면
> 연속값(면적 비례 점수)이나 추가 신호가 필요합니다 — 백엔드 협의 대상.

---

## 🟢 에러 코드

`global/exception/ErrorCode.java`. 프론트는 HTTP 상태코드가 아니라 **`code` 로 분기**하세요.

| code | HTTP | 메시지 |
|---|:---:|---|
| `COMMON400` | 400 | 잘못된 요청입니다. |
| `COMMON404` | 404 | 요청한 리소스를 찾을 수 없습니다. |
| `COMMON500` | 500 | 서버 내부 오류가 발생했습니다. |
| `SHOP4001` | 404 | 해당 매장을 찾을 수 없습니다. |
| `PRIORITY4001` | 404 | 아직 계산된 우선순위가 없습니다. |
| `SHOP5001` | 502 | AI 브리핑 생성에 실패했습니다. |

`PRIORITY4001` 은 `GET /shops/{id}/priority` 에서 아직 계산 전인 매장을 조회할 때 납니다.
`SHOP5001` 은 AI 브리핑(`POST /shops/{id}/briefing`) 이 실패할 때 나며,
서버에 `ANTHROPIC_API_KEY` 가 없으면 항상 이 코드가 떨어집니다.

---

## 🟢 응답 봉투 / 페이지

`global/response/ApiResponse.java`.

```jsonc
{ "success": true,  "code": null,       "message": "OK", "data": { /* T */ } }
{ "success": false, "code": "SHOP4001", "message": "...", "data": null }
```

목록의 `data` 는 Spring Data `Page` 입니다. **초안의 `items`/`page`/`pageSize`/`total` 과 이름이 다릅니다.**

| 초안 | 실제 |
|---|---|
| `items` | `content` |
| `total` | `totalElements` |
| `pageSize` | `size` |
| `page` (1-based) | `number` (**0-based**) |
| — | `totalPages`, `first`, `last`, `empty`, `numberOfElements` |

---

## ⚪ 미구현 — 아래는 전부 서버에 엔터티가 없습니다

프로토타입에서 동작하는 것처럼 보이는 기능(관심 저장, 메모, 영업 상태, 팀 현황, 데이터 관리)은
현재 **브라우저 메모리에만** 존재합니다. 새로고침하면 사라집니다.

### Region — 영업 구역
| 필드 | 타입 | 설명 |
|---|---|---|
| code | string (PK) | 지역 코드 (예: `11200`) |
| name | string | 지역명 |
| gu | string | `?gu=` 에 넘길 값 |
| assigned | boolean | 조회 사용자 배정 여부 |

> ⚠️ 백엔드 Shop 은 지역 **코드**가 아니라 `gu`/`dong` **문자열**을 들고 있습니다.
> `code` 를 쓰려면 Shop 에 코드 컬럼을 추가하거나 코드↔이름 매핑 테이블이 필요합니다.

### User — 사용자
| 필드 | 타입 | 설명 |
|---|---|---|
| id / name / email | string | |
| role | enum | `sales_rep` / `team_lead` / `org_admin` |
| assignedRegions | Region[] | 배정 구역 |

> ⚠️ 현재 `SecurityConfig` 는 **전체 permitAll** 입니다. 역할(Role) 개념 자체가 없어
> 아래 권한 매트릭스는 **하나도 강제되지 않습니다.**

### WatchlistEntry — 관심 저장
| 필드 | 타입 | 설명 |
|---|---|---|
| entryId | string (PK) | |
| userId | string (FK) | |
| shopId | Long (FK) | 초안의 `leadId` 에서 개명 |
| salesStatus | enum | `to_contact` / `visited` / `proposed` / `on_hold` |
| memo | string (≤1000) | 최대 1,000자 |
| savedAt / updatedAt | datetime | |

> 규칙: 동일 매장 재저장 시 신규 생성 대신 기존 entry 반환.

### History — 변경 이력
| 필드 | 타입 | 설명 |
|---|---|---|
| shopId | Long (FK) | |
| changedAt | datetime | |
| field | string | 변경 항목 |
| beforeValue / afterValue | string, nullable | |
| cause | string | 변경 원인 |

### DataSource — 수집 출처
| 필드 | 타입 | 설명 |
|---|---|---|
| id / name | string | |
| provisionType | string | 공공 OpenAPI / 지도 제휴 / 수기 업로드 |
| schedule | string | 수집 주기 |
| active | boolean | |
| lastCollectedAt | datetime | |
| lastStatus | enum | `success` / `partial_failure` / `failure` |

### DedupCandidate — 중복 후보
| 필드 | 타입 | 설명 |
|---|---|---|
| candidateId | string (PK) | |
| primaryShopId / duplicateShopId | Long (FK) | |
| matchBasis | enum | `business_number`(우선) / `name_address_phone` / `name_address` |
| status | enum | `pending_review` / `merged` / `kept_separate` |

### IndustryWeight — 업종 가중치
| 필드 | 타입 | 설명 |
|---|---|---|
| businessType | string (PK) | 초안의 `industry` 에서 개명 |
| weight | int (0–100) | 축산물 취급 가능성 가중치 |

값은 `mock/industry-weights.json` 참고. **단, 실제 점수 계산은 이 파일이 아니라
백엔드 `PriorityScoreCalculator` 의 하드코딩된 표를 씁니다.** 가중치를 DB/설정으로
빼는 것은 미구현입니다 (기획 확정: 조직 관리자만 변경 가능).

---

### SalesActivity — 영업 시도 이력 (AI CRM)

기획서 `R-RABMND` / `F-QBNKTD`. 잠재고객별 영업 시도를 기록합니다.

| 필드 | 타입 | 설명 |
|---|---|---|
| id | Long (PK) | |
| shop | Shop (FK) | 대상 잠재고객 |
| assignee | User (FK) | 담당자. **User 엔터티가 없어 현재 채울 수 없음** |
| attemptedAt | LocalDateTime | 시도 시점 |
| contactMethod | enum | `cold_call` / `cold_email` / `visit` |
| result | enum | `contacted` / `no_answer` / `interested` / `on_hold` / `rejected` |
| memo | text | 담당자 원문 답변 (자유 입력) |
| aiSummary | text | AI 요약 |
| reviewStatus | enum | `pending_review` / `reviewed` |
| nextContactDate | LocalDate (nullable) | 다음 접촉 예정일 |

**기획 확정 사항**
- 기록 입력은 **선택형 질문과 자유 입력을 함께** 제공합니다.
- 대화 원문과 AI 요약은 저장일로부터 **3년** 보존합니다.
- 민감·불필요 정보가 감지되면 **저장 전에 경고하고 수정을 요청**합니다.

---

### DataLabel — AI 추출 데이터 라벨

기획서 `F-FUPSJX`. 향후 AI CRM 분석·추천 개선에 쓸 구조화 데이터입니다.

| 필드 | 타입 | 설명 |
|---|---|---|
| id | Long (PK) | |
| salesActivity | SalesActivity (FK) | |
| type | enum | 아래 라벨 범위 참고 |
| value | string | 라벨 값 (예: `한우 등심`) |
| evidence | text | 추출 근거가 된 원문 조각 |
| extractedBy | enum | `ai` / `user` |
| approved | boolean | **담당자 승인 전에는 저장하지 않습니다** |
| savedAt | LocalDateTime | |

**라벨 범위 (기획 확정)** — 핵심 라벨 + 상세 라벨을 함께 저장합니다.

| 구분 | `type` |
|---|---|
| 핵심 | `contact_result` · `interest_item` · `reject_reason` · `next_action` |
| 상세 | `budget` · `decision_maker` · `purchase_timing` · `competitor` |

> 학습·분석용 데이터 사용 동의는 **조직 관리자가 조직 단위로** 관리합니다(기획 확정).

---

### CrmSuggestion — AI 후속 접촉 제안

기획서 `F-QBNKTD`. Shop 과 1:1 (가장 최근 제안만 유지).

| 필드 | 타입 | 설명 |
|---|---|---|
| id | Long (PK) | |
| shop | Shop (FK, unique) | |
| historySummary | text | 누적 이력 요약 |
| generatedAt | LocalDateTime | 제안 생성 시점 |
| recommendedContactDate | LocalDate | 추천 접촉 시점 |
| recommendedMethod | enum | `cold_call` / `cold_email` / `visit` |
| coldCallScript | text (nullable) | |
| coldEmailDraft | text (nullable) | |
| needsMoreInfo | boolean | true 면 아래 질문으로 추가 정보 요청 |
| followUpQuestions | text[] | |
| used | boolean | 제안 활용 여부 |

**기획 확정 사항**
- AI 제안은 **실패 또는 보류 결과가 기록되면** 시작합니다.
- 후속 접촉 시점은 고정 일수가 아니라 **영업 이력과 결과를 바탕으로 AI가 결정**합니다.
- 정보가 부족하면 일반 제안 대신 **담당자에게 추가 질문을 요청**합니다.
- 콜드메일 초안 제안 시 **발송 전 수신 동의 또는 적법한 발송 근거 확인을 안내**합니다.
- 동일 잠재고객에 알림이 겹치면 **가장 최근 제안만 유지**합니다.
- 팀장·관리자는 팀원의 영업 이력과 AI 제안 **요약만** 조회할 수 있습니다.

---

## ⚪ 권한 매트릭스 (전부 미적용)

역할 개념이 없어 **현재는 모두 permitAll** 입니다. 인증 도입 시 목표 상태로만 참고하세요.

| 리소스 / 액션 | 영업 담당자 | 영업팀장 | 조직 관리자 | 현재 |
|---|:---:|:---:|:---:|:---:|
| 매장 조회 | ✅ (배정 구역) | ✅ | ✅ | 🟢 전체 공개 |
| 우선순위 점수 조회 | ✅ | ✅ | ✅ | 🟢 값만 공개 |
| 우선순위 **근거** 조회 | ✅ | ✅ | ✅ | ⚪ 없음 |
| 지도 보기 | ✅ | ✅ | ✅ | 🟢 상세 좌표로 가능 |
| 내 관심 목록 CRUD | ✅ | ✅ | ✅ | ⚪ 없음 |
| 타인 영업 메모 조회 | ❌ | ✅ | ✅ | ⚪ 없음 |
| 팀 영업 현황 | ❌ | ✅ | ✅ | ⚪ 없음 |
| 변경 이력 상세 | ❌ | ✅ | ✅ | ⚪ 없음 |
| 데이터 출처·일정 관리 | ❌ | ❌ | ✅ | ⚪ 없음 |
| 중복 통합 확정 | ❌ | ❌ | ✅ | ⚪ 없음 |
| 데이터 상태 변경(폐업 등) | ❌ | ❌ | ✅ | ⚪ 없음 |
| 업종 가중치 변경 | ❌ | ❌ | ✅ | ⚪ 없음 |

---

## 초안 → 실제 필드명 대조표

프론트 코드에서 이름을 바꿔야 하는 지점입니다.

| 초안 (Lead) | 실제 (Shop) | 비고 |
|---|---|---|
| `id` (string `L001`) | `id` (**number**) | 타입 변경 |
| `address` | `addressJibun` | 지번만 존재 |
| `industry` | `businessType` | |
| `priorityScore` | `score` | **nullable** |
| `priorityGrade` | `priorityGrade` | **값 체계 변경: S/A/B/C → `"1"`~`"4"`** (1이 최상위) |
| `sizeEstimate` (string) | `area` (**number**, ㎡) | 표시 문구는 프론트에서 생성 |
| — | `phone` | **백엔드에만 있음** |
| — | `gu`, `dong` | 주소가 분해되어 제공됨 |
| `latitude` / `longitude` | 동일 | 상세 + 지도(`/shops/map`)에 포함. **목록에는 없음** |
| `dataStatus` | — | **컬럼 없음** → 폐업 필터 불가 |
| `salesConditionBadge` | — | 컬럼 없음 |
| `confidence` | — | 컬럼 없음 |
| `dataUpdatedAt` / `createdAt` | — | 컬럼 없음 |
| `openedAt` | — | 컬럼 없음 |
| `sources` | — | 컬럼 없음 |
| `regionCode` (필터) | `gu` (문자열) | 코드 아님 |
| `includeClosed` (필터) | — | `dataStatus` 부재로 불가 |
| `sort=priority_desc` | `sort=score,desc` | Spring 형식 |

---

## 엔드포인트별 DTO 요약

| 엔드포인트 | 응답 DTO | 좌표 | 점수/등급 | 주소·전화·면적 |
|---|---|:---:|:---:|:---:|
| `GET /shops` | `Page<ShopListItemResponse>` | ✗ | ✓ | ✗ |
| `GET /shops/map` | `List<ShopMapMarkerResponse>` | ✓ | ✓ | 주소·전화 ✓ / 면적 ✗ |
| `GET /shops/{id}` | `ShopDetailResponse` | ✓ | ✓ | ✓ |
| `GET`·`POST /shops/{id}/priority` | `PriorityResponse` | ✗ | ✓ + `calculatedAt` | ✗ |
| `POST /shops/{id}/briefing` | `BriefingResponse` | ✗ | ✗ | ✗ |
| `POST /priorities/batch` | `PriorityBatchResponse` | — | — | — |

목록에 좌표가 없는 것은 의도된 설계입니다 — 지도는 bounding box 전용 엔드포인트를 쓰세요.
