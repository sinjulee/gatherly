# Gatherly 2.0 v0.5 — Phase 1 구현 결과

- 기준일: 2026-10-16
- 브랜치: `phase2/research-execution-system` 유지
- 기준: PRD/SRS v0.5, PHASE_0_AUDIT.md, 사용자의 Phase 1 개발 지시
- 범위: 허용된 로컬 구현·Mock·테스트. 실제 DB 변경/마이그레이션·외부 쓰기·배포·commit·push 없음.
- 로컬 신규 화면: **`/phase-one`**. 기존 메뉴/API/보고서 경로는 변경하지 않았다.

## 1. 구현 완료 — 로컬에서 동작

| 항목 | 구현/검증 |
|---|---|
| 테스트 진입점 | `npm test`: 기존 설치된 tsx + Node test runner 사용. 새 패키지/lockfile 변경 없음 |
| 읽기 전용 레거시 회귀 | `scripts/tests/legacy_readonly.py`, `tests/legacy.test.ts`. SQLite `mode=ro` + query_only, FieldDay 3/Company 180/Material 16/참가 연결 180, 현장별 활성/삭제 포함 자료 수, 기업/Index/행사 관계, 무결성/FK/파일 SHA-256 확인 |
| 원본 지도 뷰어 | 제공 754×446 PNG를 원본 그대로 import, 1131×669 비율 유지 렌더, 높이 360px viewport의 양축 overflow, 스크롤 힌트/키보드 focus |
| 핫스팟/목록 대안 | 정규화 좌표와 이미지 버전·동일 행사/참가기업 검증, 선택 강조/지도 아래 카드. 드래그·scroll·pointercancel은 클릭으로 처리하지 않음. 미매핑 테스트 기업도 검색/목록에서 선택 가능 |
| 4아이콘 | 스피커→카메라→마이크→대문자 A. 한국어 접근성 이름과 44px 이상 터치 영역 |
| 사진 | 다중 선택, 파일당 이미지 10 MiB 이하, 대상 기업을 파일 선택 시작 시 고정, IndexedDB 저장/로컬 미리보기. 실제 카메라 촬영 제공 방식은 모바일 파일 선택기의 기능에 따름 |
| 녹음 | 동의 확인→마이크 권한→MediaRecorder MIME 탐지→시작/중지/타이머→Blob 저장/미리듣기. 녹음 시작 시 TTS 중지, 녹음/권한 요청 중 TTS 차단. 화면 숨김 시 녹음 중지·보관 시도 |
| 메모 바텀시트 | 제목/내용(500자)/작성·수정·취소·저장. native dialog focus/Escape. 대상 context 고정, 글 입력마다 draft 로컬 저장, 재진입 복원. 취소는 초안만 삭제하고 이전 저장본 유지 |
| 로컬 영속화 | `gatherly-v2-phase1-local` 별도 IndexedDB. legacy `gatherly-upload-queue`에 접근/업그레이드하지 않음. 트랜잭션 완료 후 저장 성공 처리. 메모 UUID/revision와 큐 기록을 같은 로컬 트랜잭션에 저장 |
| 저장 실패 UI | 오류 안내, 저장되지 않은 미디어 다시 저장/다운로드. 로컬 원본을 외부 성공 확인 없이 제거하지 않음 |

지도 위 선택 영역 2개와 테스트 기업 3개는 **가상·미검증**이다. 지도 자체만 실제 제공 참고본이며, 실제 부스/공식 업체와 매칭했다고 표시하지 않는다. 원본 파일은 편집/덮어쓰지 않았다. 한국어·아이보리·딥그린과 기존 Paperlogy 경로를 유지했다.

화면은 고정된 로컬 데모 사용자/현장을 사용한다. 로그인된 다중 사용자 서비스로 쓰면 안 된다. 이 화면은 기존 SQLite FieldDay나 기존 수집함에 쓰지 않는다. 기기 저장과 외부 동기화를 분명히 구분하며, Mock 원격 성공 상태를 실제 Google 저장으로 표시하지 않는다.

## 2. Mock만 구현

### 저장소 계약

`lib/gatherly-2/contracts.ts`, `mock-storage.ts`:

- PublicCatalogRepository: 승인된 공개 참가기업만 조회하는 Mock, 행사 경계 확인.
- UserResearchSheetRepository: 사용자 범위, mutation ID 중복 방지, revision 충돌 검증.
- UserMediaDriveRepository: 사용자 범위, 동일 asset/context 업로드 멱등성, 다른 내용 재사용 충돌.
- LocalSyncQueue: 사용자별 조회, 메모/미디어 상태 저장. MockQueue와 별도 실제 브라우저 로컬 어댑터 제공.
- ReportRepository: Mock 문서 저장/소유자 조회/중복 요청. 실제 Docs 생성 없음.

### 이용권·쿠폰·사용량

`lib/gatherly-2/access.ts`는 서버측 정책 **시뮬레이터**다. UI/API/기존 보고서 worker에 연결하지 않았다.

- 표시 상태: ADMIN > PREMIUM > TRIAL > FREE. 관리자라고 생성권을 자동 우회하지 않는다.
- PERIOD 기간/생성 상한, ONE_TIME 성공한 신규 보고서 1건, 수동 PREMIUM grant/회수.
- PREOPEN_LIMITED/COUPON_ONLY/PREMIUM_ONLY와 기존 체험권 유예 정책 매개변수.
- 쿠폰 코드 정규화/해시, 만료/회수, 코드 총량·캠페인 총량·계정별 한도, 동일 요청 재전송/동시 경쟁.
- 예약 RESERVED→COMMITTED/RELEASED, Docs ID 없는 성공 확정 거부, 다른 payload의 같은 요청 키 거부.
- 실패 후 같은 키는 동일한 종료 결과 반환. 재시도는 새 키 사용. 결과 불확실 timeout은 예약 유지, 확인된 결과에 따라 확정/해제.
- 동일 보고서 AI 수정은 생성권 대신 별도 수정 횟수/기간을 적용. 보고서 소유권 유지, 만료/소진 후 과거 조회 가능.
- 모의 전역 작업 예산 상한과 감사 이벤트. 쿠폰 원문/본문은 감사 로그에 없음.

Mock의 관리자 목록/시계/정책은 테스트가 주입한다. 실인증, 다중 프로세스 원자성, 암호화 토큰 저장, rate limit, 실제 통화 단위 비용/일·월 비용 집계는 미구현이다. 테스트용 예시 수치는 운영 기본 정책이 아니다. 실제 쿠폰을 발급하지 않았다.

### 동기화

`lib/gatherly-2/sync.ts`:

- 미디어 LOCAL_PENDING→DRIVE_UPLOADING→DRIVE_UPLOADED_SHEET_PENDING→SHEET_SYNCING→SYNCED.
- 메모는 Drive 단계를 건너뜀. Drive 성공 후 Sheets 실패 시 파일 ID를 보존해 재업로드 없이 재시도.
- 동일 작업 동시 요청 합치기, 저장 ledger 재조회로 오래된 UI snapshot 대응.
- 지수 backoff, 최대 5회 실패 후 종료, 재인증은 자동 재시도 차단/명시 재시도, revision 충돌 자동 덮어쓰기 금지.
- 원본 Blob은 성공 후에도 이번 구현에서 자동 제거하지 않음.

UI는 로컬 대기 보관까지만 수행한다. Mock remote worker는 테스트에서만 실행하며 UI에서 원격 저장 성공을 연출하지 않는다. 실제 네트워크/OAuth 재연결, 여러 탭/기기의 경쟁 조정은 후속 연동 범위다.

### Importer

`tests/fixtures/directory-five.html`, `lib/gatherly-2/importer.ts`:

- **합성 HTML 상세 5건**의 파서와 staging/검증 계약. 실제 공식 사이트 HTML을 가져온 것이 아니다.
- 국영문 기업/브랜드/부스/분류/품목/소개/주소/웹/SNS/프로그램/로고/원본 URL/수집 시각 필드.
- 엔티티/공백 정리, 누락 필드 null/경고, 원천 ID 중복·필수 이름·원천 URL 검증.
- fixture.invalid HTTPS 출처만 허용. 모든 결과에 SYNTHETIC_FIXTURE/RIGHTS_UNVERIFIED 표시, 상태 REVIEW 또는 INVALID만 반환. 발행 API 없음.
- CSV/Excel 입력을 위한 TabularDirectoryAdapter 계약만 마련. 실제 표 파서와 공식 HTML DOM 구조 대응, 라이선스/robots 확인, 실제 5사 PoC는 아직 필요.

## 3. 실제 API 연동 필요

- Supabase Auth 로그인·서버 세션/소유권, 공식 데이터/관리자 운영 스키마/RLS/GRANT, 안전한 관리자 역할, 이용권 실제 트랜잭션/중복 요청 제약.
- 개인 Google OAuth 별도 동의, 사용자별 Drive/Sheets/Docs 저장, 재연결/철회/삭제/충돌 복구. 서버 공통 레거시 refresh token을 신규 사용자에게 공유하지 않음.
- 공식 출처 승인 데이터·지도 좌표 검수·사전 도슨트 생성/캐시. 현재 음성은 브라우저 합성의 테스트 안내이며 Gemini TTS가 아님.
- 신규 보고서 게이트 연결, 실제 AI/Docs 성공 정의와 작업 복구. 현재 기존 보고서 생성/AI 수정/Docs 코드는 해시 기준 그대로 유지.

[아키텍처 경계와 AGENTS 수정안](ARCHITECTURE_BOUNDARY_PROPOSAL.md)에 저장 주체·접근정책·레거시 ID 경계와 실제 보고서 연결 위치를 기록했다. 이번 사용자 지시가 신규 설계/Mock을 허용한 근거이며, AGENTS.md 자체는 덮어쓰지 않았다. SQL/migration 파일·Supabase client·OAuth/Gemini 키는 생성/변경하지 않았다.

## 4. 검증 결과

| 검사 | 결과 | 한계 |
|---|---|---|
| `npm test` | PASS: 21/21 | Node/tsx 단위 20개 + 실제 SQLite 읽기 전용 회귀 1개. 운영 DB에 테스트 데이터를 만들지 않음 |
| `npm run typecheck -- --incremental false` | PASS | 원본 tsbuildinfo 덮어쓰기 방지 |
| `npm run lint` | PASS, 기존 warning 1 | `components/analysis-brief-workspace-unified.tsx:4:83` RefreshCw 미사용. 신규 오류/경고 없음 |
| `npm run build` | PASS | 격리 소스 복사본에서 Next.js webpack 프로덕션 빌드. 실제 DB·storage·.env 미복사, 원본 `.next` 보존 |
| Chrome CDP 스모크 | PASS | 375/430/1280px 폭, 양축 스크롤/버튼 크기, 핫스팟/드래그 구분, 메모 create/edit/cancel/대상 고정/새로고침 초안, 사진 5개, 가상 마이크와 재생 차단, 미디어 재로드 보존 |
| 실제 iPhone/실사용 Google·AI | NOT_RUN | 아래 실기기/연동 게이트 필요 |

첫 린트에서 신규 미리보기의 effect 내 setState 오류를 발견해 DOM 미디어 ref로 수정했다. 최종 린트에는 기존 경고만 남았다. 빌드는 실제 서비스 시작 wrapper를 사용하지 않았으며 AI worker를 실행하지 않았다.

테스트 실행 방법:

```sh
npm test
npm run test:legacy
npm run typecheck -- --incremental false
npm run lint
```

레거시 회귀는 Python 3 표준 sqlite3와 현재 2026-10-16 데이터 기준을 사용한다. DB가 없는 CI에서는 해당 검사를 명시적으로 분리 구성해야 하며, 데이터가 정당하게 늘어나면 기준을 검토해 갱신한다. 테스트가 데이터를 원상복구하거나 자동 수정하지 않는다.

격리 빌드/브라우저 검증 위치:

```text
/private/tmp/gatherly-phase1-1nyspcrv/build-source
PHASE1_BUILD_SOURCE=/private/tmp/gatherly-phase1-1nyspcrv/build-source node scripts/tests/phase1-browser.mjs
```

브라우저 검증은 승인된 Chrome 실행과 `127.0.0.1:3107` 임시 서버만 사용한다. 새 임시 브라우저 프로필·합성 이미지·가상 마이크를 사용하고 외부 페이지 요청을 차단한다. 테스트 종료 시 자신이 실행한 서버/Chrome을 종료한다. 기존 실행 앱을 재시작하거나 worker를 켜지 않는다. 임시 소스 복사본을 갱신/빌드한 후 실행해야 한다.

## 5. 실기기 검증 필요 — 10월 23일 코엑스 실증 게이트

| 현장 필수 항목 | Phase 1 준비 상태 | 실증 전 남은 일 |
|---|---|---|
| 지도 읽기/이동/정확한 부스 선택 | 실제 이미지 + 양축 UI/샘플 선택 구현 | 고해상도/재사용 권한 확인, 우선 부스 실제 좌표·출전사 검수, iPhone Safari 실제 팬/탭/회전 |
| 기업 카드/사진 | 로컬 다중 파일 보관 | iPhone 카메라/앨범/HEIC 선택 및 미리보기·큰 사진 처리 |
| 현장 녹음 | MediaRecorder + 동의/중지/기기 보관 | 실제 3분 녹음, Bluetooth 이어폰·전화·잠금·Safari MIME/권한/용량 부족·중단 복구 |
| 메모 | 작성/수정/취소/저장/기기 draft | 소프트 키보드/한글 조합/저장 버튼 가림/접근성 검증 |
| 데이터 저장/복구 | 안전한 로컬 대기와 Mock ledger | 개인 Drive/Sheets 실제 2단계 저장, 업로드 중 재시작·LTE 끊김, 누락/중복/재인증 복구 |
| 도슨트 | 테스트 브라우저 음성/녹음 상호배타 | 승인 공식 대본·음원 캐시와 재생, 실제 기기 오디오 경합 |

**현장 실증 준비 완료로 판정하지 않는다.** 로컬 대기는 구현됐지만 브라우저 저장소 퇴거/데이터 삭제까지 무손실을 보장하지 않는다. 지도 전체 239개 매핑이나 공개 베타/보고서 전체 출시가 이번 완료 범위가 아니다. 검증된 우선 부스와 사용자 개인 저장/복구를 실증의 별도 통과 기준으로 유지한다.

## 6. 기존 회귀 위험과 남은 제한

- 기존 코드·스키마를 바꾸지 않고 `/phase-one`을 추가했다. 기존 FieldDay/수집함/보고서 쓰기 E2E는 실행하지 않았으므로 기존 기능 전체 성공을 새로 보증하지 않는다.
- 기존 레거시 API는 여전히 단일 사용자 가정이며 이용권/인증 게이트가 없다. 외부 공개 전에 별도 보호 설계가 필요하다. 신규 Mock 정책으로 레거시를 무단 차단하지 않았다.
- 새 UI는 사진/음성/메모 로컬 프로토타입이다. 신규 영상 버튼/자료 삭제·재분류/전사/보고서 UI는 만들지 않았고 해당 기존 기능/기획은 유지했다.
- 실제 recorder는 브라우저 지원/메모리 한계가 있다. 무제한 녹음/백그라운드 지속 녹음을 보장하지 않으며 운영 녹음 길이/크기 상한을 확정해야 한다.
- 개인 시트 직접 편집/여러 탭의 편집 충돌 UI, 시트 행 삭제 tombstone, mock 프로세스 재시작 후 durable recovery, 실제 쿠폰 추측 공격 rate-limit은 후속 범위다.
- service worker는 기존 구성 그대로다. 완전 오프라인 첫 실행/앱 셸 캐시를 새로 구현하지 않았다. 앱이 열린 상태의 로컬 수집과 새로고침 영속화 검증을 구분한다.
- 새 Importer는 합성 fixture 전용이다. 공식 사이트 구조에 맞는 파서나 공식 5사 수집 완료로 사용하면 안 된다.

## 7. 추가 승인/결정 및 중지 지점

1. 제안한 레거시/신규 지침 문구의 채택 및 실제 Supabase/Auth/Google 연동 단계 범위.
2. 기존 데이터의 사용자 귀속·ENTECH/기후산업 명칭 관계·이관 ID 매핑. 실제 DB 변경 전 동시점 백업/복원 검증·롤백 승인.
3. 공식 원천 CSV/Excel·지도/로고/소개 재사용 권한, 실제 5사 PoC와 발행 범위, 우선 부스 검수.
4. 운영 체험 기한/활성화/생성·수정 한도/쿠폰 계정별 한도, PREMIUM_ONLY 전환 유예, 실제 비용 예산·재시도/Docs 성공 확정 정책.
5. 실제 OAuth/Google 쓰기·AI 호출·외부 체험권 배포·공개 서비스는 별도 승인. PG·결제·정기 구독은 미구현/범위 제외.

Phase 1의 로컬 구현과 검증을 마친 상태에서 중지한다. 실제 외부 시스템 연동/DB 마이그레이션을 시작하지 않는다.

## 8. 최종 보존 확인과 산출물

작업 전후 SHA-256 비교 결과 DB·storage·backups의 파일 31개 변경 0개. 기존 소스/설정/문서 179개 중 `package.json`의 테스트 스크립트만 변경했다. 기존 AI 보고서 코드, Prisma 스키마/이력, AGENTS.md, PRD/SRS/Phase 0 문서, 이미지/폰트는 그대로다. 기존 미추적 항목과 브랜치도 보존했다. `git diff --check` 통과.

신규 파일 19개:

- `app/phase-one/page.tsx`
- `components/gatherly-2/{field-prototype,note-sheet}.tsx`
- `lib/gatherly-2/{contracts,mock-storage,access,sync,map,importer,browser-storage}.ts`
- `tests/{access,storage-sync,map-importer,legacy}.test.ts`
- `tests/fixtures/directory-five.html`
- `scripts/tests/{legacy_readonly.py,phase1-browser.mjs}`
- `docs/gatherly-2.0/{PHASE_1_IMPLEMENTATION,ARCHITECTURE_BOUNDARY_PROPOSAL}.md`

최종 브라우저 검증에는 지도 네 모서리 이동과 메모 UUID/revision·단일 큐 항목 유지 확인도 포함됐다. 스크린샷/독립 브라우저 프로필: `/var/folders/rs/6_j362g92j79ssyxdgbmn6rw0000gn/T/gatherly-v2-browser-k17thh/`. 작업 전 파일 해시 manifest와 격리 빌드는 `/private/tmp/gatherly-phase1-1nyspcrv/`에 있다. 임시 파일을 운영 백업으로 간주하지 않는다.

```text
PHASE_1_LOCAL_IMPLEMENTATION=PASS
UNIT_AND_READONLY_TESTS=21/21
TYPECHECK=PASS
LINT=PASS_WITH_1_PREEXISTING_WARNING
BUILD=PASS_ISOLATED
CHROME_SMOKE=PASS
REAL_DEVICE=NOT_RUN
REAL_DIRECTORY_POC_5=NOT_RUN
REAL_ENTITLEMENT_SERVER_GATE=NOT_CONNECTED
LEGACY_DB_AND_FILES_PRESERVED=true
SUPABASE_GOOGLE_REAL_WRITES=false
DB_MIGRATION=false
COMMIT=false
PUSH=false
DEPLOY=false
```
