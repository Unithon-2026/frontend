# MeatLead 데이터 모델

백엔드(`unithon-2026/backend`, `com.unithon.meetroute`)의 **실제 엔터티**와, Manyfast 기능명세서에서
도출했지만 **아직 서버에 없는** 설계 초안을 구분해서 정리합니다.

> 🟢 **구현됨** — 서버 코드에 존재. 필드명·타입이 아래 표와 1:1.
> ⚪ **미구현** — 기획 단계 초안. 서버에 엔터티 자체가 없음. 구현 시 아래 규약 준수 필요.

---

## 관계 요약

```
🟢 Shop (매장 = 잠재고객)  1 ──1  🟢 Priority (우선순위 계산 결과)
      └─ score / priorityGrade 는 Priority 계산 결과를 Shop 에 캐싱한 비정규화 컬럼

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
| score | Integer | ✓ | 우선순위 점수. **미계산 시 null** |
| priorityGrade | enum(S/A/B/C) | ✓ | 우선순위 등급. **미계산 시 null** |

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
| `priorityGrade` | `S`/`A`/`B`/`C`. 대소문자 무시. 그 외 값이면 `COMMON400` |
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
| priorityGrade | enum(S/A/B/C) | 등급 |
| calculatedAt | LocalDateTime | 산정 시점 |

> ⚠️ **엔터티는 있지만 이를 노출하는 컨트롤러가 아직 없습니다.** 점수·등급 값은 Shop 응답으로
> 내려오지만, 산정 근거(factors)·신뢰도(confidence)·가중치 버전은 컬럼 자체가 없어 조회 불가입니다.
> 관련 에러코드 `PRIORITY4001`(아직 계산된 우선순위가 없습니다) 은 이미 정의되어 있습니다.

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

`SHOP5001` 은 컨트롤러가 아직 없지만 에러코드가 먼저 정의되어 있어, AI 브리핑이 기획된 기능임을
알 수 있습니다.

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

값은 `mock/industry-weights.json` 참고.

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
| `priorityGrade` | `priorityGrade` | 그대로 (S/A/B/C 일치) |
| `sizeEstimate` (string) | `area` (**number**, ㎡) | 표시 문구는 프론트에서 생성 |
| — | `phone` | **백엔드에만 있음** |
| — | `gu`, `dong` | 주소가 분해되어 제공됨 |
| `latitude` / `longitude` | 동일 | 상세에만 포함 |
| `dataStatus` | — | **컬럼 없음** → 폐업 필터 불가 |
| `salesConditionBadge` | — | 컬럼 없음 |
| `confidence` | — | 컬럼 없음 |
| `dataUpdatedAt` / `createdAt` | — | 컬럼 없음 |
| `openedAt` | — | 컬럼 없음 |
| `sources` | — | 컬럼 없음 |
| `regionCode` (필터) | `gu` (문자열) | 코드 아님 |
| `includeClosed` (필터) | — | `dataStatus` 부재로 불가 |
| `sort=priority_desc` | `sort=score,desc` | Spring 형식 |
