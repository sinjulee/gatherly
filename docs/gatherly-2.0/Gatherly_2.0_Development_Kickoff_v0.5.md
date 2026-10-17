# Gatherly 2.0 — Codex 개발 착수 지시서 v0.5

- 기준일: 2026-10-16
- 맥미니 저장소: `/Users/sinjulee/Projects/Gatherly`
- 기준 문서: `Gatherly_2.0_PRD_v0.5.md`, `Gatherly_2.0_SRS_v0.5.md`
- UI 참조: `v0.5_assets/ESG_2026_Official_BoothMap_TitleRemoved_Reference.png`, `v0.5_assets/Gatherly_Mobile_BoothMap_Notes_UI_Concept.png`
- **중요:** 이 문서는 Codex 실행을 위한 지시서일 뿐, 코드 수정/배포/DB 마이그레이션이 이미 완료되었다는 의미가 아니다. 파일을 맥미니 저장소의 `docs/gatherly-2.0/`에 복사한 뒤 실행한다.

## 1. 우선 확인할 사항
1. `git status --short`와 현재 branch, 기존 docs, Prisma 스키마, SQLite 실제 저장 DB, 기존 FieldDay/Company/Asset/Report 코드/페이지/API를 읽기 전용 조사.
2. **2006 푸드위크, 기후산업국제박람회, ENTECH 2026** 등 기존 조사/자료 분류 구조와 연관 자료 유실 금지. 기존에는 `FieldDay`와 전시회 명칭이 혼선이 있었으므로 새로운 `exhibitions`와 개인 FieldDay의 관계를 명확히 설계.
3. 기존 기능: 자료수집함, 사진·영상·음성·메모, 다중 사진, 스와이프/미리보기, 자료 수정/삭제, 검색/필터, IndexedDB 임시 보관, AI 보고서 기획 범위를 회귀 체크.
4. 이전 PRD/SRS 원본을 보존하고 v0.5를 기준으로 사용. 개인 조사 데이터는 개인 Google 저장소, 공식 데이터와 사용권한은 Supabase에 관리.

## 2. 실행 금지 및 승인 경계
- 사전 승인 없이 **SQLite DB 삭제, Prisma reset/migrate deploy, 운영 Supabase 프로젝트/테이블 생성·수정, Google Drive/Sheets에 실데이터 쓰기, 공식 외부 사이트 대량 크롤링, OAuth 권한 수정, 외부 공개 배포, Git commit/push**를 금지.
- 본인 또는 외부 사용자 OAuth 토큰, API 키, 개인정보·미공개 기업 원문을 코드/로그/테스트 픽스처에 기입 금지.
- 공개 디렉토리 접근 가능성만으로 텍스트/로고/배치도 재게시 라이선스를 획득했다고 간주 금지. 공식 CSV/Excel 제공 및 재사용 허락을 우선 확인.
- 실제 공식 부스배치도와 UI 개념 목업을 혼동하지 말 것. 목업의 가상 기업명/임의 부스번호를 검증 데이터로 쓰지 말 것.
- 모든 개별 변경은 작은 diff/테스트 가능 단위로 진행하고 브랜치/dirty working tree를 보존.

## 3. Codex에 붙여넣을 통합 프롬프트

```text
Gatherly 2.0 v0.5 개발 준비 및 Phase 0→초기 구현을 진행하라.

저장소: /Users/sinjulee/Projects/Gatherly
기준 문서: docs/gatherly-2.0/Gatherly_2.0_PRD_v0.5.md, docs/gatherly-2.0/Gatherly_2.0_SRS_v0.5.md
참고 이미지: docs/gatherly-2.0/v0.5_assets/ESG_2026_Official_BoothMap_TitleRemoved_Reference.png 와 Gatherly_Mobile_BoothMap_Notes_UI_Concept.png

우선 Phase 0 READ-ONLY AUDIT를 수행한다.
1) git status/branch, 실제 Prisma 모델/DB, 기존 페이지/라우트/핸들러, 자료수집함/동기화/보고서 코드, 테스트·타입체크·린트·빌드의 현재 상태를 확인하라.
2) 기존 ENTECH 2026, 푸드위크, 기후산업국제박람회 FieldDay와 수집 자료를 절대 삭제하지 말고, 신규 공개 exhibitions와 개인 FieldDay 간 데이터 경계를 분명히 하라.
3) docs/gatherly-2.0/PHASE_0_AUDIT.md에 실제 코드 경로와 변경 후보 파일, 리스크, 테스트 결과를 기록하라.

기술 설계 기준:
- Supabase Auth = Google 로그인, Supabase PostgreSQL = 승인된 공식 전시회/출전사/기업/출처/부스 지도 매핑/공개 AI 분석만.
- Google Sheets = 사용자 개인 방문·메모·전사·개인 AI 인사이트·보고서 인덱스.
- Google Drive/Docs = 개인 사진/녹음 원본·보고서 스냅샷/본문.
- IndexedDB = 오프라인 영속화와 2단계 동기화 대기열.
- 별도 Google Drive/Sheets OAuth 동의, 사용자별 격리 및 RLS, 서버측 비밀키 저장.
- 원본 및 사후 보고서 기능을 삭제하지 않는다. 보고서는 사용자가 분석 관점을 입력하고, AI 초안/수정 요청/직접 편집/Docs 출력을 지원해야 한다.
- 신규 AI 보고서 생성과 AI 수정 요청은 **서버 이용권 게이트**를 적용. 무료 사용자는 현장 기능과 과거 Docs 열람/직접 편집을 유지.
- 사용자 유형은 관리자/일반 무료/무료 체험/프리미엄 4종만. 관리자 권한과 체험·프리미엄 자격을 분리하고, 체험권은 `PERIOD` 기간형 및 `ONE_TIME` 1회형만.
- 운영 모드 PREOPEN_LIMITED → COUPON_ONLY → PREMIUM_ONLY; 쿠폰/프리미엄/운영 모드 관리자는 서버 전용, 쿠폰 등록·보고서 차감은 트랜잭션 + idempotency + 실패 시 예약 복구로 구현한다.
- 정식 PG 결제/자동 구독은 차후 별도 단계이며 이번 P0 구현에 포함하지 않는다.

신규 UI 개발 요구(프로토타입은 mock 데이터 허용):
A) 제공된 실제 배치도 원본에서 제목/불필요한 공백을 제거해 지도 본체만 표시. 스마트폰에서 지나친 전체 축소 없이 overflow x+y 양축 스크롤. 스크롤 가능 시각 힌트 제공.
B) 부스 선택 영역(핫스팟)은 원본 맵 비율에 정규화된 geometry로 관리. 탭과 드래그 구별, 선택 시 해당 부스 강조, 지도 바로 아래 해당 기업 카드 표시. 실 좌표 확인 전에는 일부 샘플 선택 영역에 '테스트/미검증' 표시; 허위 부스·기업 매칭을 공식 표시하지 마라.
C) 기업 카드에서 기업명 옆 스피커(도슨트) → 카메라(사진) → 마이크(녹음) → 대문자 A(메모) 순서, 각각 44px 이상 터치 영역. A 탭 시 메모 바텀시트/모달: 제목, 멀티라인, 취소/저장, 입력 중 보존 및 개인 Sheets notes로 연결할 저장 어댑터 경계. 녹음 시작 전 동의 안내, TTS 재생과 녹음 상호배타.
D) 지도에 연결할 기업명/부스번호는 실제 공식 검증 데이터 출처 ID를 사용하고, 등록 안 된 영역은 검색/목록 폴백.

참가기업 디렉토리 Importer 설계 요구:
1) 공식 출처: https://www.k-eco.or.kr/home/v4.php?s=34 ; 상세 예시 https://www.k-eco.or.kr/home/v4_view.php?idx=44&s=34 . 2026-10-16 표시 239개사/6페이지는 참고 스냅샷일 뿐 수집 완료 건수가 아님.
2) 관리자 소유 URL/페이지 파서 어댑터, PoC 5개 상세 링크 확인, import_runs, staging_exhibitors, 디렉토리 출처, 중복/누락/검증, 승인/발행, 오류와 감사 이력, 지도 booth_hotspots 연동 설계.
3) 추출 필드: 기업명/브랜드 한·영, 부스번호, 참가부문, 전시품목, 소개 한·영, 주소, 홈페이지/SNS, 이벤트 프로그램, 로고 URL, 공식 상세 URL, 외부 ID, 수집 시각.
4) 공개 사이트 대량 수집과 DB 실제 발행 전에 사용권/약관/robots/재게시 허용 범위를 확인하고 사용자 승인을 기다려라. 로그인 우회·로봇 제한 우회는 금지.
5) 웹 스크레이핑만 전제로 잠그지 말고 공식 CSV/Excel 수입 어댑터도 우선 고려. 회사 자체 `companies`와 행사 출전사 `exhibitors`는 분리.
6) AI 안내는 출처 기반 `draft → review → published` 승인 흐름, 개인 기록을 공통 AI 데이터로 자동 승격하지 않음.

이용권/프리미엄 설계 요구(새로운 v0.5):
1) 사전 감사: 기존 계정/권한/보고서·이용량 관리·관리자 API가 있는지 우선 확인, 기존 데이터 보존.
2) role(관리자 식별)과 entitlement(체험/프리미엄 상품권)를 분리, 표시 타입은 네 가지 중 하나로 계산. 관리자 self-escalation 방지.
3) 기간형(duration/expiry + 생성 최대치), 1회형(성공한 신규 보고서 1건), 이벤트 쿠폰 등록/소진/만료/취소, 서버 비용 상한.
4) 보고서 새 생성 시 서버 차단을 필수; 하나의 사용자 요청을 여러 번 보내도 중복 차감하지 않도록 transaction reservation → commit/release.
5) 보고서 AI 수정은 동일 문서에 대한 별도 수정 예산을 사용, 기존 Google Docs 열람/직접 편집은 만료 후에도 허용.
6) 초기 모드는 PREOPEN_LIMITED, 이벤트 COUPON_ONLY, 정식 PREMIUM_ONLY; 기존 체험권 전환 처리 방침은 결정 전 유보.
7) 쿠폰·사용량·감사 메타데이터는 Supabase에 저장, 개인 보고서 본문이나 개인 자료는 개인 Google 저장소에만 둔다.
8) 보고서 결제대행/가격/구독 API는 아직 구현하지 않는다. 테스트 우선. 고객에게 유료 결제 가능하다고 표시하지 않는다.

구현 수행 범위:
- Phase 0은 실제 저장소 조사/문서 작성 우선.
- Phase 1은 타입·포트/어댑터 계약, mock 기반 지도 및 4아이콘/메모 프로토타입, importer 파서 fixture 기반 테스트, 초안 SQL/RLS와 디렉토리 ETL 경계, **이용권/쿠폰/사용량 타입 및 mock 정책·테스트**를 '실데이터 쓰지 않고' 가능한 범위에서 구현.
- 신규 UI는 실제 동작을 검사하되 Sheets/Drive/Gemini 연결이 없으면 mock 상태임을 명확히 표시.
- 우선 P0 필수 회귀/단위 테스트 및 typecheck/lint/build를 실행; 과거 미해결 테스트 실패는 원인과 구분.
- docs/gatherly-2.0/PHASE_1_PLAN.md에 구현한 것/미구현/데이터 권리 확인 필요/기기 리허설 필요/승인 필요를 상세 기록.

종료 보고 형식:
CURRENT_BRANCH=...
FILES_CHANGED=...
PHASE_0_AUDIT=PASS/FAIL
BOOTH_MAP_VIEWER=PASS/FAIL/NOT_STARTED
BOOTH_HOTSPOT_MAPPING=PASS/FAIL/NOT_STARTED
FOUR_ACTION_ICONS=PASS/FAIL/NOT_STARTED
NOTE_MODAL=PASS/FAIL/NOT_STARTED
DIRECTORY_IMPORTER_POC_5=PASS/FAIL/BLOCKED
ACCESS_TYPE_FOUR_ONLY=PASS/FAIL/NOT_STARTED
TRIAL_PERIOD_AND_ONE_TIME=PASS/FAIL/NOT_STARTED
COUPON_REDEEM_IDEMPOTENCY=PASS/FAIL/NOT_STARTED
REPORT_GENERATION_GATE=PASS/FAIL/NOT_STARTED
USAGE_RESERVATION_RECOVERY=PASS/FAIL/NOT_STARTED
PREMIUM_PAYMENT_GATEWAY=NOT_EXECUTED
OFFICIAL_DATA_PUBLISH=NOT_EXECUTED
SUPABASE_REAL_WRITES=NOT_EXECUTED
GOOGLE_REAL_WRITES=NOT_EXECUTED
EXISTING_DATA_PRESERVED=true/false
REPORT_REQUIREMENTS_PRESERVED=true/false
TYPECHECK=PASS/FAIL/NOT_RUN
LINT=PASS/FAIL/NOT_RUN
BUILD=PASS/FAIL/NOT_RUN
COMMIT=false
PUSH=false
DEPLOY=false
NEXT_APPROVALS=...
```

## 4. 문서/코드 산출물 기대 목록

| 산출물 | 결과물 조건 |
|---|---|
| `PHASE_0_AUDIT.md` | 기존 경로·스키마·상태/테스트 확인, 안전한 전환 계획 |
| `PHASE_1_PLAN.md` | 기능별 순서, 위험도, 외부 승인/비용, 남은 구현 |
| 지도 뷰어 컴포넌트 | title-free 원본 이미지, x+y 스크롤, 핫스팟 좌표형, 검색 폴백 |
| 기업 카드 컴포넌트 | 4아이콘 순서 + 접근성 + 노트 바텀시트 + 상태 UI |
| Directory Adapter | 리스트/상세 파서, 실제 HTML 5건 PoC 정책, 공식 CSV 지원 경계 |
| 수집·검수 스키마 초안 | source/run/staging/approval/company/exhibitor/map/hotspot/briefing 분리 |
| 저장 어댑터 | PublicCatalogRepository / UserResearchSheetRepository / UserMediaDriveRepository / LocalSyncQueue / ReportRepository |
| 테스트 | 지도 좌표/탭·스크롤 충돌, notes 기업 ID, importer 중복/검수, 권한·실패 복구, 기간형/1회형 체험, 쿠폰 중복 방지, 생성 실패시 차감 복구, 유료 가드 |
| 무료/체험/프리미엄 접근 계약 | `ReportEntitlementService`, `CouponRedeemer`, `UsageReservation`, 모드 정책, 관리자 권한/감사, 기존 Docs 열람 보존 |

## 5. 출시 기준과 작업 우선순위

**10월 23일 실증의 성공 조건**은 (1) 실제 배치도를 모바일에서 스크롤/부스 선택, (2) 검증된 선택 기업 카드에서 스피커·사진·녹음·메모, (3) 사용자 개인 Sheets/Drive 저장 또는 안전한 로컬 대기, (4) 누락 상태 확인/복구이다. **239개 전량 지도좌표 매핑·정식 외부 공개 홍보·전체 보고서 고도화가 그날 모두 완성된다고 간주하지 않는다.**

공개 베타는 OAuth 검증·정보보호·원천 재게시 권한·요금 제한·피드백 체계를 통과한 뒤 별도 오픈한다. AI 보고서 관련 사용자 목적 입력/AI 수정 요청/직접 편집/Docs는 독립 출시 게이트로 계속 추적한다. **외부 체험권 배포 이전에 관리자/무료/체험/프리미엄 네 상태별 API 서버 게이트, 차감 트랜잭션, 쿠폰 비밀·중복 방지가 통과해야 한다.**
