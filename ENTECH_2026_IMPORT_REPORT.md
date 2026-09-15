# Gatherly ENTECH 2026 Import Report

## 1. Source File

- Path: `/Users/sinjulee/Library/CloudStorage/GoogleDrive-shmlucy07@gmail.com/내 드라이브/Gatherly/Projects/기후산업국제박람회 (95f52211)/00_사전조사/entech_2026_participating_companies_final.xlsx`
- SHA-256: `af883e48eefd2b4b93ce9d859159b15c1012c5501801f184cc474caae5db3e28`
- Sheet: `리서치 DB (전체 180개사)`
- Header row: 3
- Data rows: 180
- Header columns: 48/48 expected columns matched

## 2. Dry Run

| Metric | Result |
|---|---:|
| Total | 180 |
| Valid | 180 |
| Warning rows | 32 |
| Warning messages | 38 |
| Invalid | 0 |
| New Company | 180 |
| Matched | 0 |
| Conflict | 0 |
| New ExhibitionCompany | 180 |
| Update Existing ExhibitionCompany | 0 |
| Skip | 0 |

Write 전 dry-run은 DB를 변경하지 않았다. `Total = 180`, 필수 ID/name 존재, `company_id` unique, conflict 0을 확인한 후에만 transaction import를 실행했다.

경고 내역:

- 비정수 `founded` 13건은 `null`: external ID `11, 15, 17, 62, 108, 116, 118, 123, 124, 126, 127, 142, 160`
- 파싱 불가능한 `recent_news_date` 16건은 `null`: external ID `4, 5, 6, 9, 10, 11, 12, 13, 14, 15, 16, 26, 34, 35, 59, 62`
- 동일 전시회 참가자 간 공유 website domain 9건은 별도 Company로 보존: `busan.go.kr` 3, `keiti.re.kr` 2, `keco.or.kr` 2, `kwater.or.kr` 2
- 유효하지 않은 website warning: 0

## 3. Normalization

- 완전 일치하는 빈 문자열, 공백, `-`, `N/A`, `n/a`, `정보 확인 필요`, `확인 필요`를 `null`로 변환했다.
- Company name/nameEn/country는 trim, Unicode NFKC 및 비교용 case/space normalization을 적용했다.
- website는 HTTP(S) canonical URL로 정규화하고 `www.` 제거, lowercase, trailing dot 제거 후 `websiteDomain`을 생성했다.
- `main_products`, `target_customer`, `customer_examples`, `competitors`, `certifications`, `questions`, `tags`는 `{"schemaVersion":1,"items":[...]}` JSON 문자열로 저장했다.
- 명확한 newline, semicolon, pipe, bullet만 일반 array delimiter로 사용했다. tags는 comma도 명시적 delimiter로 취급했다.
- Excel `company_id`는 `ExhibitionCompany.externalCompanyId`에 저장했고 `Company.externalId`에는 복사하지 않았다. 실제 non-null Company.externalId는 0건이다.
- `innovation_score`, `market_score`, `differentiation_score`, `collaboration_score`, `research_value_score`, `priority_score`, `visit_grade`는 DB에 저장하지 않았다.

Score lineage의 원본 non-null 건수:

| Source field | Non-null rows |
|---|---:|
| innovation_score | 180 |
| market_score | 180 |
| differentiation_score | 180 |
| collaboration_score | 180 |
| research_value_score | 164 |
| priority_score | 0 |
| visit_grade | 0 |

## 4. Duplicate Resolution

적용 순서:

1. 동일 Exhibition + `externalCompanyId`
2. 기존 Company의 단일 canonical `websiteDomain` 정확 일치
3. name + country 및 nameEn + country는 자동 병합하지 않고 conflict 후보 처리

첫 import 당시 기존 Company/ExhibitionCompany는 0건이어서 180개 Company를 신규 생성했다. 동일 source 내부에서 서로 다른 참가자 이름이 공공기관 root domain을 공유한 9개 행은 하나로 병합할 경우 `ExhibitionCompany` 180개 보존 및 `@@unique([exhibitionId, companyId])`와 충돌하므로 별도 Company로 유지하고 warning lineage를 남겼다.

두 번째 실행 결과:

| Metric | Result |
|---|---:|
| New Company | 0 |
| Matched by externalCompanyId | 180 |
| New ExhibitionCompany | 0 |
| Update | 0 |
| Skip | 180 |
| Conflict | 0 |

두 번째 apply 전후 SQLite logical SHA3-256은 모두 `f01292a91b58cd9fd020503af3413c8179662eac9f03f1d3feb16edb`로 동일했다.

## 5. Backup

- Path: `backups/dev-before-entech-import-20260915-073907.db`
- Original/backup size: 495,616 bytes
- Original/backup logical SHA3-256: `4aec4507b159d4614865d8163ff4e6555ad8cbb87b9a53b4551a5eac`
- Backup physical SHA-256: `ee49e034101b96e7eba916152ce3c59b4cd30fd122268d74e123f649441d8e27`
- `integrity_check`: `ok`
- `foreign_key_check`: 0
- `/backups/` Git ignore 확인

## 6. Import Result

| Object | Before | After |
|---|---:|---:|
| Exhibition | 0 | 1 |
| Company | 0 | 180 |
| ExhibitionCompany | 0 | 180 |
| ENTECH 2026 ExhibitionCompany | 0 | 180 |

Exhibition:

- name: `2026 기후산업국제박람회`
- nameEn: `ENTECH 2026`
- venue: `BEXCO`
- status: `UPCOMING`
- startDate/endDate: `null`

Import는 Prisma interactive transaction 하나로 실행했으며 180개 참가 row 확인에 실패하면 전체 transaction을 rollback하도록 구현했다.

검증 결과:

- distinct externalCompanyId: 180
- null externalCompanyId: 0
- duplicate externalCompanyId within Exhibition: 0
- duplicate Exhibition + Company: 0
- booth null: 0
- website null: 89
- websiteDomain null: 89
- 모든 JSON field `json_valid`: invalid 0

## 7. Data Distribution

### Industry

| Industry | Count |
|---|---:|
| 공공정책 | 28 |
| 물환경 | 28 |
| 전력·발전 | 21 |
| 자원재활용 | 18 |
| 친환경기술 | 17 |
| 측정분석 | 16 |
| 에너지효율 | 15 |
| 신재생에너지 | 13 |
| AI/디지털 | 9 |
| 대기환경 | 8 |
| 수소에너지 | 3 |
| 콘텐츠 | 2 |
| 가스산업 | 1 |
| 물환경 / 자원재활용 | 1 |

### Category

- null: 0
- distinct: 179
- `수처리 엔지니어링`: 2
- 나머지 178 category: 각 1

### Country

| Country | Count |
|---|---:|
| 대한민국 | 172 |
| 국제기구 / 미국 | 1 |
| 남아프리카공화국 | 1 |
| 대한민국 / 미국 | 1 |
| 독일 / 대한민국 | 1 |
| 베트남 | 1 |
| 인도네시아 | 1 |
| 인도네시아 / 대한민국 | 1 |
| 일본 / 대한민국 | 1 |

DB 분포는 normalized source dry-run 분포와 일치한다.

## 8. Sample Verification

아래 9개 지정 표본은 normalized Excel row와 DB의 Company/ExhibitionCompany를 비교했으며 모두 일치했다.

### 주식회사 파이퀀트

- Booth: `A047-02`
- Industry / category: `측정분석` / `분광 AI 센서`
- Flagship product: `분광학 기반 실시간 수질/유해물질 분석 AI 센서`
- Core technology: `분광 신호 노이즈 소쇄 회로 및 AI 성분 분석 지문 매칭 알고리즘`
- Field observation: `1) 성분 측정 검출 한계(ppm/ppb) 2) 측정 소요 시간(초) 3) 센서 모듈 단가`
- Questions: `시약 없이 측정 가능한 성분의 종류는? 2) 검출 정밀도 수치는? 3) 정수기/가전 적용 모듈 공급이 가능한가요?`

### (주)포미트

- Booth: `A062`
- Industry / category: `AI/디지털` / `발전 및 플랜트 디지털 트윈`
- Flagship product: `플랜트 3D 디지털 트윈 & 스마트 관제 플랫폼`
- Core technology: `3D 공간 스캐닝 기반 실시간 SCADA 연동 디지털 트윈`
- Field observation: `1) 3D 공간 스캔 정밀도(mm) 2) IoT 데이터 연동 속도(ms) 3) 라이선스 단가`
- Questions: `대규모 발전소 3D 렌더링 시 속도 지연은 없나요? 2) XR 원격 정비 솔루션 호환성은?`

### (주)코아이

- Booth: `A077-09`
- Industry / category: `물환경` / `해양오염 회수 로봇`
- Flagship product: `AI 자율주행 해양 유류 회수 로봇 (K-Collector)`
- Core technology: `유체역학 회수기 및 AI 자율 운항·기름 회수 알고리즘`
- Field observation: `1) 파도 높이(m) 한계 2) 시간당 유류 회수 용량(ton/h) 3) AI 자율 자이로 제어`
- Questions: `최대 가동 파고 한계는? 2) 시간당 기름 회수 용량은? 3) 해외 항만 수출 수주는?`

### (주)가온테크놀러지

- Booth: `A077-05`
- Industry / category: `AI/디지털` / `스마트팩토리 센서 & 관제`
- Flagship product: `무선 진동/온도 예지보전 센서 및 AI 진단 SaaS`
- Core technology: `진동 파형 주파수 분석 및 AI 결함 진단 딥러닝 알고리즘`
- Field observation: `1) 진동 측정 샘플링 주파수(Hz) 2) 배터리 수명(년) 3) AI 진단 정확도(%)`
- Questions: `베어링 고장을 몇 개월 전에 감지하나요? 2) 무선 센서 배터리 수명은? 3) 도입 비용은?`

### (주)디엑스지

- Booth: `A069`
- Industry / category: `AI/디지털` / `산업용 로봇 & 자동화`
- Flagship product: `스마트 비전 검사 로봇 & AI 품질 알고리즘`
- Core technology: `3D 라인 스캔 비전 및 AI 신경망 defect 검출 소프트웨어`
- Field observation: `1) 검사 처리 속도(초/개) 2) 미검률/과검률(%) 3) 3D 분해능(um)`
- Questions: `검사 처리 속도는 개당 몇 초인가요? 2) AI 신규 불량 학습 기간은? 3) 도입 단가는?`

### 한국수자원공사

- Booth: `A131`
- Industry / category: `물환경` / `국가 물관리 & 기후위기 대응 인프라`
- Flagship product: `AI 기반 디지털 트윈 스마트 물관리(SWM) 관제 플랫폼`
- Core technology: `AI 유량/수질 예측, 디지털 트윈 댐 관제 및 고도 정수 기술`
- Field observation: `1) AI 댐 수위 예측 정확도 2) 스타트업 실증 지원 예산`
- Questions: `K-water 테스트베드 신청 자격은? 2) 스타트업 구매 조건부 사업은? 3) 해외 진출 지원은?`

### ㈜에셈블

- Booth: `A131-01`
- Industry / category: `AI/디지털` / `스마트 상하수도 IoT 관제 & AI 이상 진단`
- Flagship product: `AI 기반 상하수도 이상 진단 & 수압 최적화 관제 시스템`
- Core technology: `저전력 LPWA 수중 IoT 단말 & 머신러닝 관망 압력 파형 분석`
- Field observation: `1) 누수 탐지 위치 오차범위(m) 2) IoT 단말 배터리 수명`
- Questions: `누수 탐지 정밀도는 몇 %인가요? 2) 기존 관망 단말과의 호환성은? 3) 도입 단가는?`

### 센스톤

- Booth: `A131-06`
- Industry / category: `AI/디지털` / `OT/IoT 보안 & 단방향 인증 (OTAC)`
- Flagship product: `OT/PLC 제어망 무통신 단방향 일회성 인증 코드(OTAC) 솔루션`
- Core technology: `네트워크 통신 없이 서버와 클라이언트가 동기화되는 단방향 다이나믹 인증 코드(OTAC) 원천 특허`
- Field observation: `1) OTAC 코드 생성 연산 속도(ms) 2) PLC 제어기 적용 용이성`
- Questions: `통신이 끊긴 상태에서 동기화가 유지되는 원리는? 2) PLC 제조사 탑재 방식은? 3) 라이선스 단가는?`

### 주식회사 심투리얼

- Booth: `A131-08`
- Industry / category: `AI/디지털` / `합성 데이터 & AI 시뮬레이션 Engine`
- Flagship product: `수재해/물관리 AI 학습용 3D 합성 데이터(Synthetic Data) 생성 플랫폼`
- Core technology: `3D 렌더링 물리 엔진 연동 Generative AI 합성 데이터 파이프라인`
- Field observation: `1) 합성 데이터의 실제 데이터 대비 AI 정밀도 기여율(%) 2) 생성 속도`
- Questions: `합성 데이터와 실제 데이터의 도메인 갭(Domain Gap) 극복 방식은? 2) 생성 단가는?`

## 9. Existing Data Preservation

| Existing data | Before | After |
|---|---:|---:|
| FieldDay | 2 | 2 |
| Material | 6 | 6 |
| Deleted Material | 2 | 2 |
| AnalysisBrief | 2 | 2 |
| NotebookLink | 2 | 2 |
| SourceBundle | 1 | 1 |
| SourceDocument | 5 | 5 |
| SyncJob | 3 | 3 |

- Material storage files: 3 → 3
- Storage aggregate fingerprint before/after: `fdf3806cdb6e273546ae0975becd0cb54b02b368d51ab5bdaf649f07bb188561`
- Post-import `integrity_check`: `ok`
- Post-import `foreign_key_check`: 0

## 10. Regression Test

`scripts/phase0-characterization.ts`: PASS on a post-import DB copy and temporary storage.

Protected checks:

- FieldDay list/create/update/soft-delete
- TEXT and context-free IMAGE Material APIs
- clientUploadId idempotency
- preview and Range response
- Material filters
- IndexedDB v1 serialization
- camera/multiple/concurrency-2/STORED queue-removal contract

## 11. TypeScript / ESLint

- `npx tsc --noEmit --incremental false`: PASS
- `npm run lint`: PASS with 0 errors
- Existing unrelated warning: `components/analysis-brief-workspace-unified.tsx` unused `RefreshCw` 1건

## 12. Files Created

- `scripts/import-entech-2026.ts`
- `ENTECH_2026_IMPORT_REPORT.md`
- `backups/dev-before-entech-import-20260915-073907.db` — Git ignored
- Import/characterization DB copies and storage under `/private/tmp/gatherly-phase1.OQJF0Q/`

## 13. Files Modified

- `package.json`: `import:entech` script 추가
- `prisma/dev.db`: ENTECH Exhibition/Company/ExhibitionCompany data import

변경하지 않은 항목:

- `prisma/schema.prisma`
- migration history
- Material relation/API
- IndexedDB/UI/PWA
- `next-env.d.ts`

## 14. Git Status

```text
 M .gitignore
 M next-env.d.ts
 M package.json
 M prisma/schema.prisma
?? ENTECH_2026_IMPORT_REPORT.md
?? PHASE0_MIGRATION_BASELINE.md
?? prisma/migrations/20260915071500_reconcile_schema_history/
?? prisma/migrations/20260915072500_add_exhibition_company_core/
?? scripts/import-entech-2026.ts
?? scripts/phase0-characterization.ts
```

이번 Phase 2 변경은 `package.json`, `scripts/import-entech-2026.ts`, `ENTECH_2026_IMPORT_REPORT.md` 및 실제 dev DB import다. `next-env.d.ts`는 기존 사용자 변경으로 건드리지 않았다. 자동 commit은 수행하지 않았다.

## 15. Remaining Risks

- 원본의 비정수 founded 13건과 비날짜 recent_news_date 16건은 `null`이며, 향후 source 정정 시 idempotent update 대상이 된다.
- 공공기관 부서/본부 9건은 root domain을 공유하지만 전시 참가 record 보존을 위해 별도 Company로 유지했다. 향후 법인 단위 canonical organization 모델이 필요할 수 있다.
- Company website가 없는 89건은 domain 기반 cross-exhibition 자동 매칭을 사용할 수 없다.
- 현재 import reader는 XLSX의 inline/shared string 및 cached scalar cell을 지원하며, 암호화 workbook이나 formula 결과가 cache되지 않은 workbook은 지원하지 않는다.
- score는 의도적으로 저장하지 않았으며 향후 CompanyRelevance에서 재계산해야 한다.

## 16. Final Decision

# READY_FOR_CURATION_INDEX

정확히 180개 참가 record와 180개 Company가 import되었고, duplicate 0, 두 번째 import logical no-op, 기존 데이터 및 Material storage 보존, integrity/FK/characterization/TypeScript/ESLint 검증을 모두 통과했다.
