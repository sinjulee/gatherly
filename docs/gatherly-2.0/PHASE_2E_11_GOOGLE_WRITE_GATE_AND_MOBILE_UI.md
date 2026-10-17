# Phase 2E-11 — Google 쓰기 제한 준비 및 모바일 UI

작성일: 2026-10-18. 기준: PHASE_2E_8_STORAGE_READINESS.md, PHASE_2E_9_STORAGE_UI.md, PHASE_2E_10_STORAGE_DEPLOY.md.

**단일 사용자 서버 쓰기 제한과 모바일 UI 수정을 로컬 구현했다. 실제 Google 쓰기 활성화는 아직 준비 완료가 아니다.** 임시 테스트 컨텍스트의 전용 업로드·3건 수량/요청량 제한·원격 재조회 경로를 다음 구현 대상으로 확정했다. 이번에는 운영 파일·설정·SQL을 변경하지 않았다.

사용자 실기기 확인: iPhone Safari 연결 상태 표시, 재방문 유지, 사진/녹음/메모 로컬 저장·재조회/재생, 원격 쓰기 비활성 모두 PASS. 이는 기존 배포의 사용자 확인이며 아래 새 UI의 Safari 검증과 구분한다. 이전 OAuth 원인은 수정된 Google Provider Client ID였으며 PKCE 보안을 완화하지 않는다.

## 1. Google 사전 검증

- 코드 `lib/gatherly-2/integration/google.ts`의 FILE_SCOPE는 `https://www.googleapis.com/auth/drive.file`이다. 동의 교환 시 scope 포함 및 refresh token 존재를 검사한다.
- 이 scope는 앱에서 사용하는 파일의 Sheets 작업에도 허용된다. 전체 Drive/spreadsheets scope를 추가할 필요가 없다. [Sheets 공식 scope 문서](https://developers.google.com/workspace/sheets/api/scopes)
- Drive API와 Sheets API는 **파일 접근 동의 OAuth Client가 소속된 Google Cloud 프로젝트**에서 활성화되어야 한다. Supabase 로그인용 OAuth Client의 성공만으로 같은 프로젝트/두 API 활성화를 증명할 수 없다. [Drive API 활성화 안내](https://developers.google.com/workspace/drive/api/guides/enable-sdk)
- 이번 환경에는 해당 Google Cloud 관리 연결/CLI가 없어 실제 Enabled APIs를 조회하지 못했다. `drive.googleapis.com`, `sheets.googleapis.com`의 활성화 상태는 관리자 읽기 전용 확인이 필요하다. 설정을 추정해 PASS로 표시하지 않는다.
- CONNECTED는 Vault에 refresh credential이 있다는 뜻이며 Google API 가용성은 NOT_CHECKED 유지. 실제 운영 토큰을 이번에 읽거나 갱신하지 않았다.

### 토큰 사용 가능 여부 확인 방법 — 아직 실행/새 API 구현하지 않음

1. 승인된 동일 계정의 명시적 상태 검사 POST에서 Origin, 서버 세션, 환경 승인 목록, 단일 쓰기 실증 UID를 확인한다. 브라우저가 보낸 UID/환경/임의 Google URL을 사용하지 않는다.
2. 기존 Vault lease 안에서 고정된 Drive files.list GET을 `pageSize=1&fields=kind`처럼 개인 파일 내용이 필요 없는 최소 필드로 호출한다. GoogleApi.request의 고정 Google 호스트 검사와 타임아웃을 재사용한다.
3. access token이 만료되면 기존 GoogleApi가 refresh 및 암호화 Vault save를 수행할 수 있다. 이것은 파일 쓰기는 아니지만 순수 무변경 조회도 아니다. 명시적인 건강 검사 실행 승인 범위에 포함한다. 페이지 GET에서 자동 갱신하지 않는다.
4. Sheets API의 Enabled 상태는 관리 콘솔에서 확인한다. 앱에 이미 허용된 테스트 Sheets ID가 있다면 그 파일의 메타데이터 최소 필드 GET으로 검증한다. **검증을 위해 새 Sheets를 만들지 않는다.** 허용된 기존 파일이 없으면 실제 Sheets GET 검증은 첫 승인 생성 후 수행한다.
5. 응답은 DRIVE_READ_OK / SHEETS_READ_OK / REAUTH_REQUIRED / CONFIG_OR_PERMISSION_ERROR / RETRY 같은 고정 분류만 제공한다. Google 원문 오류·토큰·파일 목록·계정 식별자는 반환/로그 기록하지 않는다. 현재 GoogleApi는 403도 REAUTH로 매핑하므로 API 미활성/권한 문제를 계정 재동의로 단정하지 않도록 별도 분류 보완이 필요하다.

## 2. 서버 쓰기 제한 — 구현 완료

새 `lib/gatherly-2/integration/write-access.ts`의 requireWriteUser()를 다음에 연결했다.

- POST `/api/v2/sync`: 세션 검증 직후, 폼 처리/카탈로그 조회 전에 검사.
- POST `/api/v2/media`: 동일 위치에서 검사.
- `runtime.ts`의 withGoogle(): Vault/Google action 이전에 재검사. 다른 호출자가 이 공통 함수를 직접 사용하더라도 같은 제한을 받는다.

조건은 모두 충족해야 한다.

1. INTEGRATION_ENABLED=true 및 GOOGLE_WRITES_ENABLED=true.
2. 서버 environment()가 production이고 VERCEL_ENV와 일치.
3. 현재 로그인 UID가 기존 GATHERLY_V2_PRODUCTION_ALLOWED_USER_IDS에 포함.
4. 새 서버 전용 **GATHERLY_V2_PRODUCTION_WRITE_USER_ID**가 단일 UUID 형식이며 현재 UID와 정확히 일치.

새 변수 미설정/빈 값/쉼표 목록/잘못된 형식은 DISABLED로 차단한다. 다른 승인 사용자와 미승인 사용자는 거부한다. preview/development는 거부한다. 이 제한은 현재 제한적 Production 실증을 위한 것이며 향후 다중 사용자 확장은 별도 정책 변경이 필요하다. 클라이언트 metadata/헤더/body/query는 승인 판단에 사용하지 않는다.

**변수는 아직 등록하지 않았다. 기존 GOOGLE_WRITES_ENABLED=false 유지.** false일 때 기존 HTTP 503 DISABLED 계약을 유지한다. 관리 권한을 자동 부여하지 않는다.

쓰기 플래그가 영향을 주는 V2 원격 파일 API는 sync/media 두 곳이다. 이들은 GoogleStorage/CloudMediaStorage → GoogleApi를 호출한다. google/connect, google/callback의 동의·토큰 저장과 google/status의 상태 확인은 파일 쓰기 게이트와 분리되어 있다. 인증·지도·카탈로그·음성·레거시 보고서의 기존 접근 정책은 변경하지 않았다. 레거시 Google 파일 기능은 별도 로컬 경로이며 Vercel의 기존 레거시 라우트 차단을 유지한다.

## 3. 실제 3건 저장을 위한 다음 최소 구현 — 아직 미구현

단일 UID 제한만으로 writes=true를 켜면 3건 한정 실증이 완성되는 것이 아니다. 기존 sync/media는 g2_exhibitors 관계가 필요하고 현재 storage-test는 임시 문자열 ID를 사용하며 sync callback이 없다. **공식 카탈로그 검증을 생략하도록 기존 API를 바꾸지 않는다.**

다음 전용 경로를 준비한 후 재검증해야 한다.

| 변경 | 최소 계약 |
|---|---|
| 테스트 전용 POST 저장 경로 | 서버가 고정한 private test 행사/기업 컨텍스트만 허용. 공식 Supabase 카탈로그에 INSERT/게시하지 않음. 기존 sync/media의 카탈로그 검사 유지 |
| 테스트 manifest | production:UID Vault 안에 note/photo/audio 각 1개 슬롯, 안정적인 record ID·revision·payload hash·시도 횟수 저장. 첫 전송 전 lease 안에서 예약. 다른 ID로 수량 제한 회피 금지 |
| 입력 한도 | 사진 최대 5MiB, 녹음 최대 5MiB, 메모 500자/제목 120자. 이미지 1개·오디오 1개·메모 1개, 초기 revision 1로 고정. 변경 자료는 기존 실증 종료/새 승인 전 거부 |
| 전송 한도 | 기존 1MiB chunk 유지. 시험 전체 서버 업로드 요청 최대 30회, Google API 요청 최대 120회, 기록당 재시도 최대 5회라는 보수적 초기 한도 제안. 상한은 인증 후 Vault lease 안에서 외부 호출 **전에** 영속 기록하고 실패/refresh/재시도도 계산. 소진 시 수동 대조 후 별도 승인 |
| 원격 재조회 | 클라이언트 파일 ID를 신뢰하지 않고 Vault manifest의 ID만 사용. Drive 소유권/크기/SHA-256 및 Sheets의 지정 행/revision/hash를 재조회해 검증 상태만 반환. 상태/읽기 재검증에 별도 횟수 한도 적용 |
| UI 연결 | 테스트 화면에 명시적 저장/재검증 버튼 추가. writes=false 또는 단일 UID 미일치면 항상 비활성. 기존 로컬 데이터는 스냅샷으로 연결하고 자동 업로드/삭제하지 않음 |

위 수량·요청량 상한은 **설계값이며 현재 서버에 구현된 한도가 아니다.** 현재 코드는 미디어 25MiB, 1MiB chunk, 메모 500자와 중복/재시도 검증만 갖고 있다. 전체 요청 횟수·종류별 1건 상한이 없으므로 현재 상태에서 활성화하지 않는다. 신규 Vault 데이터 필드는 암호문 내부 확장으로 설계하여 SQL 재적용 없이 처리하되, 호환 테스트가 선행돼야 한다.

기존 로컬 자료의 사용자/ID/revision을 바꾸어 버리거나 mock 기업을 공식 기업으로 올리지 않는다. 재방문 원격 확인은 새 서버 조회 결과로 표시해야 하며 IndexedDB의 SYNCED를 원격 재조회로 표시하면 안 된다.

## 4. 저장·실패 복구 검토

- 사진/녹음 원본: Google Drive의 사용자 소유 Photos/Recordings.
- 메모: 행사 Sheets notes 행. 미디어 참조: assets 행.
- IndexedDB BrowserWorkspace는 전송 snapshot과 원본을 유지하며 finishTransfer는 더 최신 로컬 수정본을 덮어쓰지 않는다. 완료 후에도 원본을 자동 삭제하지 않는다.
- GoogleStorage는 Drive ID를 사전 보존하고 저장된 marker/ID를 재사용한다. Drive 성공·Sheets 실패 시 동일 파일을 확인한 뒤 동일 예약 행 PUT/재조회로 복구한다. append를 무작정 반복하지 않는다.
- 같은 mutation의 다른 payload는 CONFLICT, 완료 mutation 재시도는 같은 결과. chunk는 원격 offset/체크섬/크기를 확인한다.
- response loss와 Sheets failure 복구 테스트에서 upload 수 1, assets 데이터 행 1임을 재검증했다. 토큰 만료/401 단일 refresh retry/invalid_grant/429·5xx 관련 기존 회귀도 유지했다.
- lease 만료·중단 작업은 자동 강탈하지 않고 기존 fail-closed 복구 절차로 대조한다. Vault 초기화/키 변경/원본 삭제로 해결하지 않는다.
- Sheets 사용자 수동 편집과 동시 GET→PUT은 원자적 CAS가 아니다. 실증 중 해당 행 수동 편집을 중지하고 충돌 시 재조회·수동 대조한다.
- 요청 상한 소진이나 성공 응답 소실 시 쓰기 중단 후 manifest·Drive·Sheets를 읽기 대조한다. 같은 ID/해시로만 복구하고 새 파일 생성부터 재실행하지 않는다.

최초 3건 저장은 바이너리 2개 외에 최대 폴더 4개(Gatherly/행사/Photos/Recordings), Sheets 1개와 notes 1행/assets 2행을 만들 수 있다. 승인 범위에 이 리소스를 포함해야 한다. 파일 공유/공개 권한은 추가하지 않는다.

## 5. 모바일 UI — 구현 완료

- `/v2`: 로그인 상태 카드 → Google 연결 상태 카드 → 자료 수집 테스트 카드 → 계정 관리 카드. 상태 배지를 먼저 보여주고 버튼을 아래 배치.
- 버튼/폼 작업 그룹은 width 100% 세로 grid, gap 16px. 카드 간격 24px, 수집 4아이콘 간격 12px. 모든 V2 버튼 최소 높이 48px.
- 기존 전역 button의 44px min-height가 Tailwind 규칙보다 우선하는 사례를 실제 브라우저 테스트에서 발견해 V2 범위 CSS로 보정.
- `app/v2/layout.tsx`의 viewportFit=cover 및 `mobile.css`: bottom padding `calc(6rem + env(safe-area-inset-bottom, 0px))`, 좌우 inset, 100dvh. 고정 하단 액션바를 추가하지 않았다.
- `/v2/storage-test`: 돌아가기 full-width, Google 연결 카드, 지도 없는 수집 화면 유지. 기존 수집 데이터/ID/저장소 및 원격 차단 로직 그대로.
- 로그인 복귀 `/v2/auth-complete`: 버튼 full-width, 화면 grid 간격, UID 줄바꿈 유지. 최초 사용자 자동 승인 없음.
- 메모 dialog 하단 safe area 여백 및 버튼 16px 간격, 입력 폰트 16px. 기존 저장/취소/기업 고정 로직 변경 없음.
- V2 layout 아래에만 CSS 적용하여 레거시 화면을 변경하지 않는다. 모바일 브라우저 하단바는 기기마다 달라 env 값과 96px 여유 공간만으로 실기기 검증을 대체하지 않는다.

## 6. 검증 결과

- 단위 테스트 **79/79 PASS**: 기존 75 + 단일 사용자/빈 설정/다른 환경/전역 off/withGoogle 경계 4개.
- 기존 로컬 HTTP **106건 PASS**(동의 false/true 각각 53), 실제 Google 쓰기 0.
- 실제 Chrome 모바일 에뮬레이션: 320/375/390/430px × `/v2`, `/v2/auth-complete`, `/v2/storage-test` = **12개 화면 PASS**.
- 링크/버튼 겹침 0, 가로 넘침 0, 버튼 높이 48px 이상, action 간격 12px 이상 확인.
- DevTools `setSafeAreaInsetsOverride`로 **bottom 34px** 적용해 본문 bottom 130px 이상, 메모 dialog bottom 54px 이상 확인. viewport-fit=cover 확인. 메모 dialog 열기/취소 회귀 및 브라우저 예외 0. [CDP Emulation 문서](https://chromedevtools.github.io/devtools-protocol/tot/Emulation/)
- 로컬 fixture 화면 스크린샷 육안 점검. 산출물: `/var/folders/rs/6_j362g92j79ssyxdgbmn6rw0000gn/T/gatherly-2e11-mobile-1pHMnr/`. 실제 사용자 정보/인증 쿠키를 캡처하지 않았다.
- 타입 검사 PASS, 격리 build:vercel PASS. lint 오류 0, 기존 RefreshCw 미사용 경고 1.
- protected 46개 해시 일치. HEAD `9b705f0e7da22e4a698574eef34819c80ed2b968` 유지. 기존 `.gitignore`/미추적 문서 보존, 스테이징 없음.

모바일 검사는 Chrome 엔진 모의 검증이며 **새 UI의 실제 iPhone Safari 및 인앱 브라우저 검증은 미완료**다. 실제 Safari 주소창 펼침/접힘, 화면 회전, 키보드 표시, 글자 크기 확대, 로그인 후 복귀, 화면 최하단 버튼 접근을 다음 배포 후 확인해야 한다. 이번에 배포하지 않았다.

## 7. 변경 파일

- 서버 제한: `lib/gatherly-2/integration/write-access.ts`, `runtime.ts`, `app/api/v2/sync/route.ts`, `app/api/v2/media/route.ts`.
- UI: `app/v2/layout.tsx`, `mobile.css`, `page.tsx`, `storage-test/page.tsx`, `auth-complete/page.tsx`, `components/gatherly-2/google-connection.tsx`.
- 검증: `tests/write-access.test.ts`, `scripts/tests/v2-mobile-browser.mjs`, `scripts/tests/auth-gate-http.mjs`의 선택적 모바일 검사 연결.
- 본 보고서.

## 8. 다음 승인 및 판정

1. Google Cloud 두 API 활성화 상태 읽기 확인, 파일 동의 OAuth Client의 소속 프로젝트 확인.
2. 전용 private test 저장/재조회 API와 durable 3개 슬롯·요청량 상한 구현/검증. 현재 전역 플래그만 켜지 않음.
3. 단일 본인 UID를 서버 전용 GATHERLY_V2_PRODUCTION_WRITE_USER_ID에 등록할 별도 승인. 기존 접근 승인 목록과 별도로 유지. UUID는 문서/로그에 쓰지 않음.
4. 검증 커밋·격리 배포 승인. All Deployments/APP_ORIGIN/승인 목록/기존 키 유지, 빈 override 금지.
5. 파일 없는 건강 검사 및 필요 토큰 refresh/Vault save 승인. API 준비 확인 후 3건과 부수 폴더/Sheets 생성 범위 승인.
6. writes=true의 빌드/실행 적용과 실패 시 false 복귀를 별도 승인받고, 한 계정·한 테스트에서만 실행. 생성 결과를 대조한 후 중지.

현재: SINGLE_USER_WRITE_GATE=LOCAL_PASS, MOBILE_UI=LOCAL_PASS, GOOGLE_API_ENABLEMENT=UNVERIFIED, GOOGLE_WRITES=false 유지, THREE_RECORD_REMOTE_FLOW=PLANNED_NOT_IMPLEMENTED, ENABLE_READY=false.

운영 환경변수/SQL/Vault/암호화 키 변경, Google 실제 파일 생성, Git Commit/Push, Production 배포는 수행하지 않았다.
