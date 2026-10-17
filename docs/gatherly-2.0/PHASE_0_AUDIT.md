# Gatherly 2.0 v0.5 — Phase 0 읽기 전용 감사

- 조사일: 2026-10-16 (Asia/Seoul)
- 저장소: `/Users/sinjulee/Projects/Gatherly`
- 브랜치: `phase2/research-execution-system` (upstream: `origin/phase2/research-execution-system`)
- 결론: **Phase 0 조사 완료. Phase 1 구현 미착수.** 타입 검사·격리 빌드 통과, 린트 경고 1건, 기본 테스트 명령 미구성. 실제 기능 전체 통과나 출시 승인을 의미하지 않는다.
- 이번 저장소 변경: 이 문서만 추가. 앱 코드·설정·원본 문서·DB·미디어 변경 없음.

## 1. 적용 문서와 안전 경계

다음 다섯 문서를 읽고 현행 코드/실제 DB와 대조했다.

1. `README_START_HERE.md`
2. `Gatherly_2.0_PRD_v0.5.md`
3. `Gatherly_2.0_SRS_v0.5.md`
4. `Gatherly_2.0_v0.5_CHANGELOG.md`
5. `Gatherly_2.0_Development_Kickoff_v0.5.md`

사용자의 이번 요청이 Kickoff의 Phase 0→초기 구현 통합 프롬프트보다 범위가 좁으므로, Phase 1은 권장 순서만 작성했다. `PHASE_1_PLAN.md` 및 구현 파일은 만들지 않았다. 외부 원천 사이트 조회/수집, Google·AI 호출, 외부 쓰기, 서버/worker 실행, DB 변경·삭제·마이그레이션, 배포, commit/push를 수행하지 않았다. 비밀키·토큰·자료 본문을 보고서에 기록하지 않았다.

**먼저 해결할 문서 충돌**

- 루트 `AGENTS.md`와 사용자가 제공한 개발 메모는 Prisma + SQLite만 사용하고 Supabase를 금지한다. v0.5는 Supabase Auth/PostgreSQL과 개인 Google 저장소를 요구한다. 현재는 기존 제한을 유지한다. Supabase 구현·SQL/RLS 물리 설계 확정 전에 아키텍처 예외/지침 변경을 승인받아야 한다. 저장소 독립 타입과 mock 설계는 이 결정과 분리할 수 있다.
- 기존 지침은 Tailscale 전용 운영, v0.5는 공개 베타 지향이다. 공개 전환은 별도 승인 대상이다.
- SRS v0.5 머리말의 `기준 PRD: v0.4` 표기는 v0.5 내용과 불일치한다. 원본은 수정하지 않았다.
- SRS의 Phase 1은 계약/스키마 중심이고 Kickoff의 Phase 1은 지도·메모·Importer fixture·이용권 mock까지 포함한다. 아래 권장 순서는 Kickoff 범위를 작은 단위로 나눈 제안이며 실행 승인이 아니다.

## 2. 작업 트리와 환경

시작 시 추적 파일 수정은 없고, 아래 항목이 미추적 상태였다. 브랜치 전환·stash·reset·정리는 하지 않았다.

```text
?? .omc/
?? Gatherly_2.0_Development_Kickoff.md
?? Gatherly_2.0_PRD_v0.3.md
?? Gatherly_2.0_SRS_v0.3.md
?? docs/
```

`package.json`: Next.js 16.3.4 계열, React 19.2.8 계열, Prisma 6.19.0 계열, TypeScript 5.9.3 계열. 빌드 출력의 실제 Next.js는 16.3.4. 의존성 설치/갱신 없음. Prisma provider는 `sqlite`, `DATABASE_URL`은 `file:./dev.db`, 저장소 설정은 `./storage`다. `prisma.config.ts`는 없으며 datasource 설정은 `prisma/schema.prisma`에 있다. 최초 파일 열기에서 이 미존재 파일 때문에 exit 1이 있었고, 스키마 내 설정과 실제 경로를 재확인했다. 파일을 생성해 보정할 사안은 아니다.

`app/layout.tsx`는 `public/fonts/Paperlogy-{4Regular,5Medium,6SemiBold,7Bold,8ExtraBold}.ttf`를 사용한다. 해당 5개 파일 존재를 확인했다. UI/폰트/CSS는 변경하지 않았다. 후속 코드 작성 시 `node_modules/next/dist/docs/`의 해당 버전 가이드를 먼저 읽어야 한다.

## 3. 실제 SQLite 및 파일 보존 기준

DB는 Python SQLite URI `mode=ro` + `PRAGMA query_only=ON`으로 열었다. Prisma CLI로 DB를 열거나 마이그레이션하지 않았다.

| 항목 | 관측 결과 |
|---|---|
| 실제 DB | `prisma/dev.db` (1,531,904 bytes) |
| DB SHA-256 | `386b3a83219099d8f2423b4b79d13dfb9bf3cc919026920b64c3de853ca00361` |
| `integrity_check` | `ok` |
| `foreign_key_check` | 위반 0건 |
| 마이그레이션 파일 | 8개 |
| `_prisma_migrations` | 9행: 성공 8행 + 과거 rolled-back 1행 |
| 이력 체크섬 | 성공한 8개 모두 현재 SQL 파일 SHA-256과 일치 |
| 파일 참조 | Material 13행에 `filePath` 있음, 누락 0 / 크기 불일치 0 / 저장 SHA-256 불일치 0 |
| storage | 파일 23개 확인; 본문을 문서에 복제하지 않음 |

과거 rolled-back 행은 `20260912233000_report_planframe_contract`이며 동일 migration의 성공 행이 별도로 있다. 현재 미해결 실패로 단정하지 않는다. 체크섬/외래키 검사는 전체 스키마 drift 검증이나 clean replay를 대체하지 않는다. 이번에는 replay를 수행하지 않았다.

### 3.1 현장·자료 분류

| FieldDay 원본 제목 | 상태 | 전체 자료 | 활성 자료 | Exhibition 연결 |
|---|---|---:|---:|---|
| `2006 푸드위크` | ACTIVE | 0 | 0 | 없음 |
| `기후산업국제박람회` | ACTIVE | 12 | 7 | 없음 |
| `ENTECH 2026 현장조사` | ACTIVE | 4 | 3 | 기존 Exhibition 1건에 연결 |

FieldDay 3개 모두 `deletedAt=null`. `2006`은 DB 원문 그대로이며 오탈자로 추정해 수정하지 않았다. Material 총 16개 중 활성 10개, soft-delete 6개. 모두 `STORED`다.

| 자료 유형 | 활성 | soft-delete 포함 전체 |
|---|---:|---:|
| IMAGE | 7 | 11 |
| VIDEO | 2 | 2 |
| TEXT | 1 | 3 |
| AUDIO | 0 | 0 |

자료의 FieldDay 미지정은 0개. 회사/Index가 함께 연결된 자료 4개, 두 연결 모두 없는 기존 자료 12개다. soft-delete 자료 및 파일도 보존 대상이다.

기존 Exhibition은 한글명 `2026 기후산업국제박람회`, 영문명 `ENTECH 2026`, 상태 `UPCOMING`으로 등록돼 있다. 이 이름 조합과 별도 FieldDay의 관계는 담당자 확인 없이 자동 병합/이름 변경하지 않는다. ESG 신규 행사는 현재 DB에 없다.

### 3.2 주요 모델별 실재 행 수

| 모델 | 행 수 |
|---|---:|
| Exhibition / Company / ExhibitionCompany | 1 / 180 / 180 |
| Tag / CompanyTag | 343 / 545 |
| CurationIndex / CompanyIndex | 8 / 356 |
| SourceBundle / SourceBundleItem / SourceDocument | 1 / 1 / 5 |
| AnalysisBrief / NotebookLink / SyncJob | 2 / 2 / 3 |
| Report / ReportVersion / ReportIntegrationDelivery | 0 / 0 / 0 |
| ResearchResult / RevisionRequest / QuickAnalysisJob | 0 / 0 / 0 |
| ResearchPlan / ResearchTarget / ResearchQuestion | 0 / 0 / 0 |
| ResearchCheckpoint / RequiredEvidence / PreResearchSource | 0 / 0 / 0 |

CompanyIndex 356개 모두 같은 Exhibition의 참가 연결과 조인된다. 기업/부스 정보가 공식 출처 검수를 마쳤다는 증거는 아니다.

### 3.3 백업 현황과 후속 이관 조건

기존 `backups/`에 `dev-before-exhibition-phase0-20260915-012737.db`, `dev-before-migration-reconciliation-20260915-071346.db`, `dev-before-exhibition-phase1-20260915-072451.db`, `dev-before-entech-import-20260915-073907.db`, `dev-before-curation-phase3-20260915-075510.db`, `dev-before-material-context-20260915-201707.db`, `dev-before-entech-fieldday-20260915-210539.db`가 있다. `prisma/`에도 `dev.db.backup-before-notebooklm-v2`, `dev.db.backup-before-report-migration-repair`가 있다.

이는 파일 존재 확인이며 최신 복구 가능성 검증이 아니다. 이번 감사에서 새 운영 백업이나 복원은 하지 않았다. 실제 이관 전 DB와 `storage/`를 같은 시점으로 백업하고 별도 복원 검증·ID 매핑·행 수/파일 해시 비교·롤백 계획 승인이 필요하다. 브라우저 IndexedDB는 서버 백업에 포함되지 않으므로 별도 보존/내보내기 계획이 필요하다.

## 4. 코드·페이지·API 조사

| 영역 | 실제 경로 | 현재 구현과 v0.5 차이 |
|---|---|---|
| 현장 관리 | `app/page.tsx`, `components/field-day-manager.tsx`, `app/api/field-days/route.ts`, `app/api/field-days/[id]/route.ts` | 목록/생성/편집/soft-delete. 삭제 시 ARCHIVED + deletedAt. 사용자 소유자 모델 없음 |
| 전시회/기업 | `app/exhibitions/page.tsx`, `app/exhibitions/[exhibitionId]/page.tsx`, `components/exhibition-company-search.tsx` | 기업 한영명·부스·산업·분류·대표상품·요약 검색. 승인된 공개 데이터만 조회하는 상태 필터 없음 |
| Index/기업 카드 | `app/exhibitions/[exhibitionId]/indexes/[indexId]/companies/[companyId]/page.tsx`, `components/company-full-card.tsx`, `lib/company-card-context.ts`, `lib/company-card-navigation.ts` | 이전/다음·스와이프·관심/오늘 방문·상세 조회. 현재 액션은 사진/음성/메모/더보기이며 v0.5 스피커/카메라/마이크/A가 아님 |
| 개인 Index | `app/api/exhibitions/[id]/indexes/route.ts`, `app/api/indexes/[id]/route.ts`, `app/api/indexes/[id]/companies/route.ts`, `app/api/indexes/[id]/companies/[companyId]/route.ts` | SYSTEM 변경 제한과 개인 분류 조작이 있으나 계정별 owner 격리는 없음 |
| 자료수집함 | `app/inbox/page.tsx`, `components/inbox-workspace.tsx` | 사진/영상/음성 파일/텍스트, 다중 선택, 미리보기, 수정/soft-delete, 현장·유형 필터. 수집함 본문 키워드 검색은 확인되지 않음 |
| 기업별 수집 | `components/company-capture-panel.tsx`, `components/company-materials.tsx`, `lib/company-capture-queue.ts` | 기업/Index/행사 context로 수집·자료 조회. 파일형 음성 입력은 있으나 MediaRecorder/getUserMedia 직접 녹음은 없음 |
| 자료 API | `app/api/materials/route.ts`, `app/api/materials/upload/route.ts`, `app/api/materials/[id]/route.ts`, `app/api/materials/[id]/file/route.ts` | TEXT 저장, 파일 업로드, 수정/삭제, Range 미리보기. clientUploadId 멱등 계약과 업로드 상태 존재 |
| 파일 저장 | `lib/storage.ts` | 서버 로컬 `storage/uploads/{fieldDayId}/{materialId}/original.*`, 임시 .part→rename, SHA-256, MIME/확장자/크기 검사. 개인 Drive 업로드 경로가 아님 |
| 연결 검증 | `lib/material-context.ts`, `app/api/exhibitions/[id]/field-days/route.ts` | 다른 행사/Index 불일치 차단, 기존 context 없는 수집함 허용. 미연결 FieldDay는 수동 후보로 제공 |
| 연구 준비/분석 | `app/analysis/page.tsx`, `components/research-prep-workspace.tsx`, `components/research-pipeline-workspace.tsx`, `app/api/research/**` | ResearchPlan/질문/체크포인트/자료묶음/AnalysisBrief/NotebookLink/빠른 분석/Drive 작업공간 존재 |
| 기존 Importer | `scripts/import-entech-2026.ts`, `scripts/seed-entech-curation-indexes.ts`, `ENTECH_2026_IMPORT_REPORT.md` | XLSX 파싱, dry-run, 외부 ID/충돌 검사 후 DB 적용. ESG HTML 5건 파서·staging/승인/발행 흐름은 없음. 이번에 실행하지 않음 |

파일 업로드 기본 한도는 이미지 10 MiB / 영상 250 MiB / 음성 100 MiB이며 환경변수로 조정 가능하다. 현재 실제 설정값 전체를 검증한 것은 아니다. 향후 녹음 길이·Google 업로드 제한과 별도로 정책을 정해야 한다.

### 4.1 FieldDay와 공개 카탈로그 경계

이미 `Exhibition → ExhibitionCompany → Company`가 분리돼 있고 `FieldDay.exhibitionId`는 nullable이다. 이 구조를 없애고 FieldDay 제목을 행사 키로 쓰면 안 된다. 기존 `ExhibitionCompany`를 신규 `exhibitor` 계약의 참가 식별자에 매핑하는 방식이 우선 검토 대상이다.

`ExhibitionCompany`는 `(exhibitionId, companyId)` 유니크이고 `booth`는 nullable 문자열이다. 부스번호 전역 UNIQUE는 없지만 복수 부스/공유 부스 관계 모델은 별도 설계가 필요하다. `Material`에는 `companyId`/`sourceIndexId`가 있고 직접 `exhibitorId`는 없다. 자동 추정으로 기존 자료를 재연결하지 말고, 기존 ID를 유지하는 명시적 매핑/미매핑 상태가 필요하다.

`Company`/`ExhibitionCompany`의 조사 메모 성격 필드와 `CurationIndex`의 개인 분류를 공식 공개 데이터로 그대로 승격하지 않는다. 향후 계정 도입 시 FieldDay·Material·개인 Index·보고서·로컬 큐의 소유자를 따로 정해야 한다.

### 4.2 오프라인/동기화

- `lib/upload-queue.ts`: IndexedDB `gatherly-upload-queue`, 버전 1, `uploads`, key `clientUploadId`. 파일만 IMAGE/VIDEO/AUDIO로 저장하며 상태는 PENDING/UPLOADING/FAILED/STORED다.
- 수집 UI는 동시 업로드 2개, 복귀 시 UPLOADING→PENDING 복구, 서버 STORED 응답 후 큐 삭제, 재시도 및 이탈 경고를 구현한다.
- TEXT는 API로 직접 전송한다. 기업 메모 draft는 React 상태에 있으나 새로고침까지 보장하는 영속 메모 큐는 없다.
- v0.5의 Drive 성공/Sheets 대기 ledger, 사용자별 큐 구획, notes 동기화, record_id/revision 충돌 처리, OAuth 재연결 상태는 미구현이다.
- IndexedDB helper가 request 성공에서 Promise를 resolve한다. transaction 완료까지 기다리는지, abort/용량 부족 때 저장 성공이 먼저 표시되는지 후속 회귀 검증이 필요하다.
- `public/sw.js`는 API·탐색 요청·`/_next/`를 캐시하지 않는다. IndexedDB 파일 보존과 앱 전체 오프라인 재진입은 서로 다른 보장이다. iPhone 브라우저의 실제 잔여 큐/용량은 이번 서버 조사로 확인할 수 없다.

## 5. AI 보고서·권한 감사

**보고서 기능은 기획만 있는 상태가 아니다. 코드가 있으며, 현재 DB에는 결과 보고서가 없다. 실제 AI/Docs 성공 여부는 이번에 검증하지 않았다.**

| 기능 | 근거 및 현재 상태 |
|---|---|
| 분석 목적 입력·새 생성 | `components/final-report-workspace.tsx`, `app/api/reports/route.ts` POST: instruction + FieldDay를 받아 QUEUED 생성 |
| AI 수정 | 같은 POST의 parentReportId로 부모 본문을 참조하는 새 Report 생성, reportVersion 증가 |
| 직접 편집 | `/api/reports` PATCH로 본문 갱신, FINAL은 409. 직접 편집 시 structuredResult를 비움; 모든 수동 수정의 스냅샷/복원 UI가 완비된 것은 아님 |
| AI 실행 | `scripts/gatherly-final-report-worker.mjs`: Codex CLI, QUEUED→RUNNING 조건부 claim, 결과/ReportVersion 트랜잭션 저장, 실패 상태. Gemini 보고서 worker가 아님 |
| 근거 선택 | worker는 해당 FieldDay의 활성 STORED 자료 전체를 조회하고 중요도/개수 제한을 사용. v0.5의 사용자별 명시적 근거 선택·Google 입력 스냅샷은 별도 구현 필요 |
| 확정/구조화 | `app/api/reports/[id]/finalize/route.ts`, `structured-result/route.ts`, `lib/report-structured-result.ts`: 구조화 결과 및 FINAL snapshot 경로 존재 |
| Docs 출력 | `app/api/reports/[id]/sync-docs/route.ts`, `lib/final-report-google-sync.ts`: Google 문서 생성/본문 교체. 서버 공통 환경변수 refresh token 사용; 사용자별 별도 OAuth 아님 |
| 외부 전달 | `app/api/reports/[id]/export/planframe/route.ts`, ReportIntegrationDelivery: 별도 외부 POST와 멱등 키. 보고서 이용권 예약과 혼동 금지 |
| 빠른 분석 | `app/api/research/quick-analysis/route.ts`, `scripts/gatherly-quick-analysis-worker.mjs`: 별도 AI 진입점이므로 비용/권한 범위 결정 필요 |

`lib/google-workspace-sync.ts`, `lib/google-drive-workspace.ts`에도 Drive/Docs 쓰기가 있다. 연결 조회처럼 보이는 작업이 폴더 생성 등으로 이어질 수 있어 실행하지 않았다. Google Sheets API 어댑터는 발견되지 않았다.

스키마·라우트·lib·의존성 조사에서 사용자 계정/세션/소유권 테이블, Supabase Auth, 관리자 API, 쿠폰·entitlement·premium·usage reservation 모델/게이트는 발견되지 않았다. 보고서 POST는 FieldDay/부모 유효성만 검사하며 현재 사용자 권한·이용량 예약·clientRequestId 중복 방지는 없다. 기존 자료 업로드/PlanFrame의 멱등성을 이용권 동시성 보장으로 간주하면 안 된다.

v0.5 RPT-01~15를 계속 유지해야 한다. 특히 생성/AI 수정만 이용권으로 제한하고 현장 수집·기존 보고서/Docs 조회·직접 편집은 소유권 검사로 분리한다. 기존 부모-자식 Report와 신규 동일 문서 revision 계약을 연결할 때 과거 버전 링크를 보존해야 한다.

## 6. 지도·Importer·출처의 현재 상태

- 제공 지도 PNG는 754×446, UI 콘셉트 PNG는 941×1672이며 `docs/gatherly-2.0/v0.5_assets/`에 있다. 파일 헤더로 크기를 확인했다. 좌표 검수/화질의 실기기 판독 테스트는 하지 않았다.
- 지도 뷰어·정규화 hotspot·지도 아래 선택 카드·도슨트 TTS·4아이콘 요구는 미구현이다. 기존 카드/메모 패널은 재사용 후보이며 완료 상태로 표시하지 않는다.
- 디렉토리 출처/수집 실행/staging/승인/지도/공개 briefing 모델은 없다. 기존 XLSX Importer의 검증 경험은 활용 가능하나 새 공개 발행 정책과 분리해야 한다.
- 문서의 239개사/6페이지와 N-101 예시는 제공 문서의 주장만 확인했다. 외부 사이트를 새로 조회하거나 5건 PoC를 수행하지 않았고, 실수집/승인/매핑 건수로 보고하지 않는다.
- 원천 텍스트/로고/지도 재게시 권리, CSV/Excel 제공 여부, robots/약관은 미확인이다. 공개 디렉토리라는 사실만으로 허가를 추정하지 않는다.

## 7. 검증 실행 결과와 한계

| 검사 | 결과 | 실행 방식/한계 |
|---|---|---|
| 타입 검사 | PASS | 원본에서 `npm run typecheck -- --incremental false`, exit 0. 기존 tsbuildinfo 덮어쓰기 방지 |
| 린트 | PASS (warning 1) | `npm run lint`, exit 0. `components/analysis-brief-workspace-unified.tsx:4:83`의 사용하지 않는 RefreshCw. 자동 수정 없음 |
| 프로덕션 빌드 | PASS | `/private/tmp/gatherly-v05-audit-u6sb15bm/build-source`에서 `npm run build`, exit 0. 코드/정적 자산만 복사, 기존 node_modules 연결, `.env`/실 DB/storage 미복사. 원본 `.next` 보존. 런타임 DB·Google 연결 성공을 뜻하지 않음 |
| 기본 테스트 | FAIL (기존 미구성) | `npm test`, exit 1. package.json이 `echo "Error: no test specified" && exit 1`. 기능 테스트 실패가 아니라 runner 미연결이며 이번 범위에서 수정하지 않음 |
| SQLite/파일 검사 | PASS | query_only integrity/FK/count/checksum 및 참조 파일 크기/해시 검사 |
| 기존 characterization | NOT_RUN | `scripts/phase0-characterization.ts`, `phase3-curation-characterization.ts`, `phase4-company-card-characterization.ts`, `phase5-material-context-characterization.ts`는 임시 DB 경로 guard가 있지만 실제 create/update/delete 호출 포함. 이번 읽기 전용 범위에서 코드만 조사 |
| 브라우저 회귀 | NOT_RUN | `scripts/phase4-browser-check.mjs`, `phase5-browser-check.mjs`는 별도 localhost 앱/Chrome 및 상태 조작 필요. iPhone 녹음·스와이프·복구 실증 미실행 |
| AT-ACC-01~10 및 신규 v0.5 수락 테스트 | NOT_RUN | 해당 기능/테스트 아직 없음. Phase 1 mock 테스트와 실제 DB 동시성/API 검증을 구분할 것 |
| AI/Docs/Drive/Sheets·외부 Importer | NOT_RUN | 비용/외부 쓰기/실데이터 변경 방지 |

장시간 명령은 도구의 비동기 session으로 실행하고 결과를 회수했다. `run_in_background`라는 별도 도구는 제공되지 않는다. 테스트/빌드 오류를 고치기 위한 제품 코드 변경은 하지 않았다.

`scripts/gatherly-server.mjs`는 기본 host가 `0.0.0.0`이며 두 AI worker가 기본 활성화된다. 따라서 감사 중 `npm run dev/start`를 실행하지 않았다. `next.config.ts`의 allowedDevOrigins는 네트워크 바인딩 제한을 대신하지 않는다. 실제 실행 프로세스의 host/방화벽 노출은 이번에 검증하지 않았으며 Tailscale 전용 실행 설정을 후속 확인해야 한다.

## 8. Phase 1 권장 구현 순서와 변경 후보

다음은 **미실행 계획**이다. 각 단계는 별도 작은 diff로 검토하고 DB/외부 쓰기 없이 mock으로 진행한다. 저장소 정책 결정을 넘어서는 실제 어댑터 연결은 승인 전 보류한다.

| 순서 | 작업/후보 경로 | 통과 기준 |
|---:|---|---|
| 1 | `docs/gatherly-2.0/PHASE_1_PLAN.md`와 소유권/기존 ID 매핑 계약; 테스트 runner 정리(`package.json`, `scripts/*characterization*`) | 기존 기능/요구 추적표, 운영 DB 접근 불가한 합성 테스트 환경, 미확정 정책 구분 |
| 2 | 신규 `lib/gatherly-2.0/` 타입/포트: PublicCatalogRepository, UserResearchSheetRepository, UserMediaDriveRepository, LocalSyncQueue, ReportRepository | Exhibition/Company/Exhibitor/개인 FieldDay·note·asset 분리, 기존 nullable context 호환. 현행 Prisma 스키마 변경 없음 |
| 3 | ReportEntitlementService/CouponRedeemer/UsageReservation mock 정책 및 테스트 | ADMIN > PREMIUM > TRIAL > FREE, PERIOD/ONE_TIME, 3개 운영 모드, 만료 경계, 중복 요청/실패 복구/관리자 위조 거부. mock 통과를 실제 트랜잭션/RLS 통과로 표시하지 않음 |
| 4 | 로컬 메모/미디어 ledger mock 및 테스트; `lib/upload-queue.ts`, `lib/company-capture-queue.ts` 연결 후보 | 기존 uploads v1 보존, notes 별도 영속화, 기업 ID 고정, Drive 성공/Sheets 실패 재시도, 사용자별 격리 계약, 충돌·abort 처리 |
| 5 | 격리된 mock 지도/카드/메모 프로토타입; 신규 `components/gatherly-2.0/*`, 기존 company-full-card/capture-panel 재사용 검토 | 양축 스크롤·탭/드래그 구분·정규화 좌표·미매핑 검색 폴백, 스피커→카메라→마이크→A 44px+, 입력 보존/키보드, TTS/녹음 상호배타. 샘플은 테스트/미검증 표시 |
| 6 | Importer 파서 포트와 합성/사용 허가된 fixture 테스트; 기존 `scripts/import-entech-2026.ts`와 분리 | CSV/Excel 우선 입력 + HTML adapter, 누락/중복/출처/검수 상태, 다른 행사 hotspot 연결 거부. 실제 5사 PoC와 구분 |
| 7 | 보고서 통합 설계·mock 회귀; `app/api/reports/route.ts`, `components/final-report-workspace.tsx`, worker/Google sync 변경 계획 | 기존 생성/AI 수정/직접 편집/Docs 요구 유지, 생성권 예약→결과/Docs 확정→차감, 재시도 정합성, 과거 조회 독립. 실 API 게이트 적용은 별도 승인 단계 |

계약과 UI mock을 끝낸 후 typecheck/lint/build, 지도/큐/권한 단위 테스트를 수행하고, 별도 합성 DB와 외부 호출 stub을 사용하는 기존 회귀 테스트를 연결한다. iPhone Safari/PWA의 양축 스크롤·키보드·다중 사진·녹음 중단·네트워크 복귀는 실제 기기 게이트로 남긴다. 10/23에 239개 전량 좌표 매핑이나 보고서/공개 베타 전체 완료를 약속하지 않는다.

## 9. 승인·결정이 필요한 사항

1. **Phase 1 착수 범위 및 저장소 정책:** SQLite 유지인지 Supabase 전환 예외인지 명시 결정. 후자라면 AGENTS 지침 개정과 Supabase/Auth/SQL/RLS 설계 범위 승인. 현재 문서를 근거로 제한을 임의 해제하지 않음.
2. **기존 데이터 해석/이관:** `2006 푸드위크` 표기, Exhibition의 한글명/ENTECH 영문명, 미연결 FieldDay의 관계, 소유자 귀속. 백업+복원 검증 및 ID 매핑을 검토한 다음 실제 DB 변경을 별도로 승인.
3. **원천/지도:** 공식 CSV/Excel 제공 및 재게시 범위, 5사 PoC 실행 범위, 대량 수집/발행, 고해상도 지도와 우선 검수 부스. 목업 업체/좌표는 데이터 근거에서 제외.
4. **계정/Google/AI:** 사용자별 OAuth 동의·토큰 보관·탈퇴/철회, 실제 Drive/Sheets/Docs 쓰기, AI 호출 예산, 녹음 길이·파일 크기·보관 한도. 현재 공통 refresh token을 다중 사용자로 그대로 확장하지 않음.
5. **이용권 운영:** 기간형 시작/만료/생성 상한, 1회형 활성화/사용 마감, AI 수정 예산·기간, 쿠폰 사용자당 제한, 작업 중 만료 시 처리, Docs 실패/불확실 완료의 확정 시점, PREMIUM_ONLY 전환 시 기존 권리 유예. 예시 숫자를 기본 정책으로 확정하지 않음.
6. **외부 운영:** 외부 체험권 배포 전 서버 게이트·동시 차감·비밀/중복 방지 검증. 공개 베타/네트워크 노출 전환·배포·commit·push는 별도 승인. PG/정기 결제는 이번 P0/Phase 1에서 제외.

## 10. 종료 상태

```text
CURRENT_BRANCH=phase2/research-execution-system
FILES_CHANGED=docs/gatherly-2.0/PHASE_0_AUDIT.md (added only)
PHASE_0_AUDIT=PASS
BOOTH_MAP_VIEWER=NOT_STARTED
BOOTH_HOTSPOT_MAPPING=NOT_STARTED
FOUR_ACTION_ICONS=NOT_STARTED
NOTE_MODAL=NOT_STARTED (v0.5; legacy memo panel exists)
DIRECTORY_IMPORTER_POC_5=BLOCKED (Phase 0 scope; source permission not verified)
ACCESS_TYPE_FOUR_ONLY=NOT_STARTED
TRIAL_PERIOD_AND_ONE_TIME=NOT_STARTED
COUPON_REDEEM_IDEMPOTENCY=NOT_STARTED
REPORT_GENERATION_GATE=NOT_STARTED
USAGE_RESERVATION_RECOVERY=NOT_STARTED
PREMIUM_PAYMENT_GATEWAY=NOT_EXECUTED
OFFICIAL_DATA_PUBLISH=NOT_EXECUTED
SUPABASE_REAL_WRITES=NOT_EXECUTED
GOOGLE_REAL_WRITES=NOT_EXECUTED
EXISTING_DATA_PRESERVED=true
REPORT_REQUIREMENTS_PRESERVED=true
TYPECHECK=PASS
LINT=PASS (1 existing warning)
BUILD=PASS (isolated source copy)
NPM_TEST=FAIL (existing placeholder)
CHARACTERIZATION_TESTS=NOT_RUN
COMMIT=false
PUSH=false
DEPLOY=false
NEXT_APPROVALS=Phase 1 scope; storage-policy conflict; data ownership/mapping; source rights; OAuth/external writes; entitlement policy
```

종료 보존 검사: 조사 전후 기존 소스·설정·문서 파일 SHA-256 변경 0개, 신규 파일은 이 감사 문서 1개뿐이다. DB 1개와 storage 파일 23개의 SHA-256 변경도 0개다. 브랜치와 기존 미추적 항목을 그대로 유지했고 `git diff --stat`는 비어 있다. 비교용 해시 manifest와 격리 빌드 산출물은 `/private/tmp/gatherly-v05-audit-u6sb15bm/`에만 있다. 원본 자료/토큰을 새 테스트 fixture로 복사하지 않았다.
