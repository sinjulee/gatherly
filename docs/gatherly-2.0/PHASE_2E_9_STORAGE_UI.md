# Phase 2E-9 — 연결 상태 및 내부 수집 테스트 UI

작성일: 2026-10-17. 로컬 구현 완료, 운영 미반영.
기준: PHASE_2E_8_STORAGE_READINESS.md.

## 구현 결과

### 서버 연결 상태

`POST /api/v2/google/status`를 추가했다. `/v2` 및 테스트 화면의 연결 컴포넌트는 마운트 때 서버를 조회하며 사용자가 다시 조회할 수도 있다. 새 페이지 방문·재로그인 후 브라우저의 이전 성공 플래그가 아니라 서버 Vault를 다시 읽는다.

검사 순서는 Origin 및 APP_ORIGIN → session()의 Supabase getUser 검증 → 서버 환경별 승인 목록 → Vault다. 요청 body/query의 UID·환경값은 사용하지 않는다. 서비스 역할 키를 사용하는 기존 어댑터의 RLS 우회를 전제로 승인 검사 후 확인된 UID만 전달한다. namespace는 기존 서버 environment()에서 결정한다.

| 상태 | 의미 |
|---|---|
| CONNECTED | 복호화한 Vault에 refresh credential이 저장되어 있음 |
| NOT_CONNECTED | Vault에 oauth 항목 없음 |
| REAUTH_REQUIRED | oauth 항목은 있지만 refresh credential이 없음 |
| ERROR | 인증·승인·Origin 거부 또는 Vault 설정/복호화/잠금/조회 오류 |

응답은 `status`, `apiAvailability: NOT_CHECKED`뿐이다. 토큰·암호문·UID·키·원문 오류를 반환하거나 로그에 기록하지 않는다. 응답은 private/no-store, no-referrer다. 인증/승인 실패는 HTTP 401/403, 일반 조회 실패는 503이며 미연결로 오인 표시하지 않는다.

**CONNECTED는 실제 Google API 성공 판정이 아니다.** access token 만료만으로 기존 refresh credential을 폐기하거나 재동의를 강요하지 않는다. Google 권한 철회, refresh token의 실제 유효성, Drive/Sheets API 활성화는 이 조회로 검증되지 않는다. UI에 이를 명시했다. 실제 API 건강 검사나 자동 토큰 갱신은 이번 범위에 추가하지 않았다.

기존 Vault는 claim/save/release 계약만 제공한다. 상태 API도 **claim/release로 잠금 메타데이터가 변경되는 POST**이며 순수 읽기 전용 SQL 조회가 아니다. save는 호출하지 않으며 토큰 갱신·Google 요청·파일 생성은 하지 않는다. 만료된 lease를 강탈하거나 Vault를 초기화하지 않는다. 이 구현을 운영에 호출한 것은 아니며 모든 실행 검증은 로컬 fixture다. SQL 변경은 없다.

UI는 연결하기·다시 연결·연결 상태 확인, 조회 중·오류·재연결 필요를 표시한다. 기존 로그인/UID 확인, 동의 form POST 및 OAuth state/PKCE/Origin 검사는 유지했다. 로그인 검증은 기존 getUser 경로를 사용한다. [Supabase getUser 문서](https://supabase.com/docs/reference/javascript/auth-getuser)

### 내부 수집 화면

`/v2/storage-test`를 추가하고 승인된 `/v2` 화면에서 링크한다. AUTH_ONLY에서도 접근할 수 있지만 별도로 session() 승인 검사를 실행한다. 거부 시 로그인 안내만 렌더링하고 수집 UI/사용자 컨텍스트를 전달하지 않는다. 기존 페이지 방식처럼 안내 HTML은 200이며 데이터 접근 허용을 뜻하지 않는다. API는 401/403을 반환한다.

- Phase 1 `FieldPrototype`의 사진 선택, MediaRecorder, NoteSheet, IndexedDB 저장과 원본 복구 UI를 재사용한다.
- 임시 테스트 행사/기업을 명시한다. 실제 카탈로그·지도 요청은 하지 않는다.
- namespace별 `gatherly-v2-<environment>-storage-test` IndexedDB를 사용하고 서버에서 확인한 사용자 ID로 기존 컨텍스트/조회 필터를 적용한다. 기존 connected/internal 저장소와 분리한다.
- 사진은 한 번에 1장 선택, 녹음은 1건씩 시작/중지, 메모는 기존 수정/저장 기능을 사용한다. 전체 건수 제한은 강제하지 않으며 실증 안내는 각각 1건이다.
- 온라인/오프라인, LOCAL_PENDING 등 상태, 전송 시도 횟수, revision을 표시한다. 기기 저장 실패 시 기존 기록으로 재저장하거나 미디어 원본을 다운로드한다.
- 원격 업로드 버튼은 비활성이다. 임시 ID가 있으므로 향후 writes=true가 되더라도 이 화면에는 sync callback을 연결하지 않는다. 임시 자료의 운영 자동 전환도 없다.
- 기존 동기화 어댑터의 잠금·고정 전송 스냅샷·재시도 로직은 변경하지 않았다. 공식 카탈로그/지도/보고서/API 권한과 Google 쓰기 게이트도 변경하지 않았다.
- 터치 버튼 최소 높이 48px, 사진 미리보기, 녹음 시간·권한 안내·중지·재생, 화면 숨김 시 녹음 중지를 유지한다.

로컬 브라우저 저장은 서버 권한/RLS 또는 암호화 저장을 대체하지 않는다. 공유 기기에서 같은 Origin의 IndexedDB를 사용하는 한계가 있으며 브라우저 데이터 삭제 시 기록이 사라질 수 있다. 오프라인 수집은 이미 열린 화면에서 지원하며 앱 전체 오프라인 시작/PWA를 추가한 것은 아니다.

## 변경 파일

1. `app/api/v2/google/status/route.ts` — 세션 기반 상태 API.
2. `lib/gatherly-2/integration/connection-status.ts` — 최소 응답·에러 처리·상태 판정.
3. `components/gatherly-2/google-connection.tsx` — 서버 상태 조회와 동적 연결 안내.
4. `app/v2/storage-test/page.tsx` — 승인 사용자 전용 화면.
5. `components/gatherly-2/field-prototype.tsx` — 기존 수집 컴포넌트의 지도 없는 테스트 모드.
6. `app/v2/page.tsx` — 승인 사용자 테스트 화면 링크.
7. `tests/connection-status.test.ts` — 상태·비노출·권한·재조회 테스트 3개.
8. `tests/integration-browser-queue.test.ts` — 오프라인 실패/동일 mutation 재시도/완료 중복 방지 테스트 1개.
9. `scripts/tests/auth-gate-http.mjs` — 실제 Next HTTP 테스트와 로컬 암호화 Vault RPC fixture 확장.
10. 본 보고서.

기존 `.gitignore`, auth-diagnostics/vault-reviewed 테스트 수정과 이전 미추적 문서는 보존했다. Git 스테이징·Commit·Push 없음. 브랜치 gatherly-v2-preview, HEAD 41e55780ff3fd9ff7783655107a4e19125676c21 유지.

## 검증

- 단위 테스트: 기존 71개 + 신규 4개 = **75개 통과**, skip 0.
- HTTP: 기존 88건 유지 및 신규 18건 = **106건 통과**. 동의 false/true 각각 53건. 실제 Google 쓰기 0, 로컬 fixture만 사용.
- HTTP에서 미로그인/미승인/위조 UID 차단, 승인된 테스트 UI, 지도 원본 요청 부재, Production UID/namespace 고정, 암호문 복호화 후 CONNECTED/NOT_CONNECTED 최소 응답 확인.
- 토큰 존재와 API 유효성 구분, 새 Vault 인스턴스 재조회, 타 사용자 미연결, 복호화/lease 오류 비노출 확인.
- 오프라인 실패 후 로컬 원본 유지, 같은 ID/revision 재전송, 완료 항목 재전송 없음 확인. 기존 chunk/retry/동시 갱신/환경 격리 회귀도 통과.
- 타입 검사 PASS, lint 오류 0·기존 RefreshCw 미사용 경고 1.
- HEAD archive + 이번 앱 파일만 반영한 격리 소스에서 build:vercel PASS. 실제 환경파일·개인자료 없이 fixture 환경으로 빌드.
- 기존 환경파일·Prisma·storage·backups 46개 해시 일치. git diff --check 통과.

운영 Google/Vault 및 iPhone 실기기 검증은 수행하지 않았다. HTTP는 실제 Next 서버와 모의 Auth/RPC를 사용하며 iPhone의 권한 팝업/오디오 코덱/백그라운드 동작을 증명하지 않는다.

## 다음 실기기 절차와 남은 작업

별도 배포 승인 이후, Google 쓰기 false를 유지한 채 다음을 확인한다.

1. 승인 계정으로 `/v2` 방문, 연결됨 표시와 API 미검사 안내 확인. 재방문·로그아웃/재로그인 후 재조회한다.
2. 미승인 계정으로 수집 UI와 상태 API 접근 거부를 확인한다.
3. `/v2/storage-test`에서 비민감 사진 1장, 3~5초 녹음, 짧은 메모 1건을 저장한다. 오프라인으로 전환해 로컬 저장·미리보기/재생·새로고침 후 보존을 확인한다.
4. 마이크 거절→허용, 녹음 중 화면 숨김, 저장 실패 시 재시도/원본 보존을 확인한다. Safari 지원 여부는 실기기에서 판정한다.
5. Google 업로드 버튼이 비활성이고 Drive/Sheets에 파일이 생성되지 않는지 확인한다.

실제 원격 저장에는 승인된 테스트 행사/기업 관계, API 준비 상태, 실제 쓰기·배포에 대한 별도 승인이 필요하다. 테스트 화면은 준비 화면이며 원격 쓰기 활성화 완료가 아니다. 기존 원격 파일 목록/다운로드 복원 API도 이번에 추가하지 않았다.

**Google 파일 쓰기 false 유지. Supabase SQL 변경, Vault 초기화, 키 교체, 환경변수 변경, Git Commit/Push, Production 배포 없음.**
