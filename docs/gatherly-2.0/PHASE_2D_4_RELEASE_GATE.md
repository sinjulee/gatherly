# Phase 2D-4 — Production 반영 후보 검증

작성일: 2026-10-17. **로컬 코드·검증 후보 준비 완료. Production 반영은 승인 및 도메인 보호 조치 대기.** 이번 작업은 읽기 전용 원격 검사, 로컬 테스트·빌드, 이 보고서 작성만 수행했다. Stage/Commit/Push/배포, SQL 적용, Google 파일 쓰기, 환경변수·보호 정책 변경은 하지 않았다.

## 현재 Production 연결

Vercel 팀 `shmlucy07-7077s-projects`, 프로젝트 `gatherly` (`prj_rVB8Km0yCOQSWLTcqYGsa0YHhyH7`)만 조회했다. 프로젝트 도메인 목록은 1개이며 다음 페이지가 없었다. 현재 배포의 Alias 목록은 2개다.

배포: **`dpl_2us7xQm59TvjtZ42kCsspCTv9fxK`**, READY / production. sourceCommit: **`d0226a4bc0746f26f7f437db92d6c0f9297c903e`**. 이번 로컬 수정은 아직 포함되지 않았다.

| URL 호스트 | 종류·연결 | 쿠키·우회 헤더 없는 GET /v2 |
|---|---|---|
| `gatherly-three-umber.vercel.app` | 프로젝트에 등록된 Production 도메인, 위 배포의 Alias | **200, Gatherly 로그인 form** |
| `gatherly-shmlucy07-7077s-projects.vercel.app` | 위 배포의 Alias, 현재 고정 APP_ORIGIN | 302 → vercel.com/sso-api |
| `gatherly-mvdkyhnwg-shmlucy07-7077s-projects.vercel.app` | 위 배포의 직접 URL | 302 → vercel.com/sso-api |

새 도메인의 redirect, gitBranch, customEnvironmentId는 모두 null이다. Alias 상세, 배포 API의 Alias 목록, 배포별 Alias 목록을 대조했다. 과거 배포의 모든 주소를 나열한 것이 아니라 현재 Production 연결을 검증한 목록이다.

## /v2가 200인 이유: 서로 다른 두 계층

1. **Vercel 계층:** 새 Alias의 요청은 Vercel Authentication에 차단되지 않고 앱에 도달한다. 프로젝트의 실제 보호 값은 `all_except_custom_domains`다. 새 Alias가 프로젝트 도메인 목록에 등록된 사실과 비로그인 응답은 Production 도메인을 제외하는 보호 범위와 부합한다. Vercel 내부 분류의 세부 구현이나 정책 enum을 다른 enum과 동일하다고 단정하지는 않는다.
2. **앱 계층:** `app/v2/page.tsx`는 `session()`이 UNAUTHORIZED를 반환하면 로그인 안내와 `/api/v2/auth/login` POST form을 정상 페이지로 렌더링한다. 따라서 **200 본문은 의도된 비로그인 안내 화면**이다. 본문에서 해당 form을 확인했고 UID 완료 화면은 없었다. 지도·카탈로그 승인 성공을 의미하지 않는다.

즉 “로그인 안내 화면이므로 Vercel 보호도 정상” 또는 “200이므로 내부 자료도 공개”라는 결론은 모두 잘못이다. **앱의 로그인 화면은 정상적으로 렌더링되지만 새 Alias의 Vercel 보호는 적용되지 않았다.** 기존의 Production 전체 보호 운영 요구에는 공백이 남는다.

Vercel 공식 설명상 Standard Protection은 Production 도메인을 제외하고, All Deployments는 Production 도메인까지 포함한다. 운영 설정 검토의 기준으로 사용하되 이번에는 변경하지 않았다. [Deployment Protection](https://vercel.com/docs/deployment-protection#choose-which-urls-to-protect)

## 내부 API 접근 차단

새 Alias에서 세션·쿠키·보호 우회 헤더 없이 직접 요청했다. 파일 POST는 빈 본문을 사용했으며 실제 작업을 실행하지 않았다.

| 요청 | 결과 |
|---|---|
| GET `/phase-one` | 307 → `/v2` |
| GET `/v2/auth-complete` | 307 → `/v2`, UID 노출 없음 |
| GET `/api/v2/map`, `/api/v2/catalog`, `/api/v2/voice` | 401 UNAUTHORIZED |
| POST `/api/v2/media`, `/api/v2/sync`, `/api/v2/google/connect`, 새 Alias Origin | 403 FORBIDDEN |
| 같은 파일·동의 POST에 고정 APP_ORIGIN 헤더 적용 | **503 DISABLED** |
| GET `/api/materials`, `/api/reports` | 404 LOCAL_LEGACY_ONLY |
| 원본 지도 이름의 직접 URL | 404 PRIVATE_ASSET |

파일 API의 거부가 Origin 불일치에만 의존하지 않음을 별도로 확인했다. 지도·카탈로그는 `session()`으로 getUser와 환경별 UUID 승인을 통과한 뒤 파일/DB에 접근한다. 미승인 로그인 사용자는 `environmentUser()`에서 거부되며, AUTH_ONLY는 관리자 권한을 부여하지 않는다. 신규 로컬 테스트와 기존 테스트가 이 경계를 검증한다.

이번 원격 검사에는 실제 로그인한 미승인 사용자 세션이 없었다. 따라서 그 세션의 원격 403과 실제 UID 화면 성공은 **코드·단위 테스트 검증과 구분하여 후속 실증으로 남긴다.** AUTH_ONLY 자체가 모든 API를 끄는 스위치는 아니므로 빈 Production 승인 목록과 consent/writes=false를 함께 유지해야 한다.

## 로그인 Origin 및 콜백

배포 중인 상대 경로 form은 새 Alias에 POST하므로 현재 APP_ORIGIN과 일치하지 않는다. 이번 재검사에서도 새 Alias Origin은 403, 고정 Origin을 넣은 진단 요청은 303 Supabase authorize였다. 303의 redirect_to는 다음 고정 주소와 일치했다. 토큰·challenge·쿠키 값은 기록하지 않았다.

```text
APP_ORIGIN: https://gatherly-shmlucy07-7077s-projects.vercel.app
앱 callback: https://gatherly-shmlucy07-7077s-projects.vercel.app/api/v2/auth/callback
Google provider callback: https://rmjyonrmlbarvtaazurc.supabase.co/auth/v1/callback
```

로컬 후보는 별칭의 로그인 화면을 먼저 고정 Origin으로 이동시킨다. 그 주소에서 같은 Origin POST와 PKCE 쿠키 생성·callback이 이루어지도록 한다. 임의 헤더나 query를 신뢰해 목적지를 바꾸지 않으며, 잘못된 호스트의 POST/callback은 계속 거부한다. Google OAuth state 검증과 SDK code/verifier 교환은 그대로다.

Vercel 인증 쿠키는 URL 간 공유를 가정하면 안 된다. 고정 주소에서 Vercel 인증을 먼저 완료하고 그 주소로 callback을 받는 실브라우저 검증이 필요하다. [Vercel Authentication 보안 고려 사항](https://vercel.com/docs/deployment-protection/methods-to-protect-deployments/vercel-authentication#vercel-authentication-security-considerations)

## 최소 Commit 후보와 배포 후보

기준 HEAD는 `d0226a4bc0746f26f7f437db92d6c0f9297c903e`, 브랜치는 `gatherly-v2-preview`다. 다음 **코드 4개 + 테스트 1개**를 한 변경으로 검토한다.

```text
proxy.ts
lib/gatherly-2/integration/config.ts
app/api/v2/auth/login/route.ts
app/api/v2/auth/callback/route.ts
tests/auth-origin.test.ts
```

- `proxy.ts`: 별칭 GET/HEAD 로그인 페이지를 고정 `/v2`로 이동. query/code/POST 본문을 전달하지 않음.
- config 및 auth route 3개: 로그인 Origin 검사 유지, 수신 URL의 고정 Origin 검사 추가.
- 테스트: 별칭 이동·악성 목적지 무시·CSRF 거부·bootstrap PKCE·UID 및 내부 접근 거부·verifier 재사용 거부.

감사 추적용 문서 후보는 `PHASE_2D_4_LOGIN_FORBIDDEN_FIX.md`와 이 `PHASE_2D_4_RELEASE_GATE.md`다. **권장 Commit 후보 합계 7개**이며 아직 스테이징하지 않았다. 예상 메시지는 `fix: canonicalize Gatherly Google login origin`이다.

제외: 기존 사용자 `.gitignore` 수정, 구버전 루트 문서, 다른 미추적 단계 보고서, 실제 `.env*`, SQLite, 미디어, 백업, `.omc/`, 원본 지도 및 기타 승인되지 않은 파일. 코드 후보의 로컬 비밀값 일치 검사에서 발견 0건이다.

배포 후보는 승인 후 만들어질 새 커밋을 archive한 격리 소스다. 현재 테스트한 `/private/tmp/gatherly-login-fix-lie5br6b/source`는 HEAD에 위 5개를 적용한 **미커밋 로컬 후보**이며 이를 기존 d0226a4 커밋 자체라고 표시하면 안 된다. Markdown 문서·환경파일·개인자료는 배포 입력에서 제외하고 기존 `.vercelignore`를 유지한다. 이번에는 배포 입력 업로드나 배포 명령을 실행하지 않았다.

후속 승인 순서:

1. 새 Production 도메인까지 Vercel Authentication을 적용하거나, 해당 별칭을 외부에서 사용할 수 없게 제한하는 운영 조치를 승인받고 검증한다. 로그인 화면 리디렉션만으로 전체 API의 Vercel 보호가 해결되었다고 판단하지 않는다.
2. 위 7개만 검토·스테이징·Commit하고 Preview 브랜치에만 Push한다. master는 제외한다.
3. 승인된 새 커밋의 격리 소스를 다시 검사한다. 현재 APP_ORIGIN, production 환경, integration=true, AUTH_ONLY=true, 빈 Production 승인 목록, consent/writes=false를 빌드와 런타임에 명시한다. 이전 배포의 CLI override가 다음 배포에 자동 계승된다고 가정하지 않는다.
4. 별도 승인된 Production 배포 후 모든 Alias의 보호·Origin 이동·API 거부·Google 왕복·UID 화면을 실제 브라우저에서 확인한다. 최초 사용자에게 내부 권한을 자동 부여하지 않는다.

## 재검증 및 판정

| 검사 | 이번 실행 결과 |
|---|---|
| npm test | **55/55 PASS**, skip 0 |
| 타입 검사 | PASS (`--incremental false`) |
| 린트 | 오류 0, 기존 RefreshCw 미사용 경고 1 |
| 격리 build:vercel | PASS, 가짜 Supabase 설정·로그인 전용 모드 |
| git diff --check | PASS |
| 스테이징 상태 | 비어 있음 |
| 기존 자료 보존 | 환경파일·SQLite·미디어·백업 등 46개 SHA-256 동일 |

코드 후보는 검토·Commit 준비가 되어 있다. **무조건적인 Production release PASS는 아니다.** 새 Alias의 보호 공백과 실제 로그인 왕복 검증이 남아 있다. 기존 Automation Bypass 자격증명 위험 및 함수 번들 전체 비밀정보 감사 미완료도 이전 보고서의 미해결 항목으로 유지한다. 이번 검사에는 보호 우회 토큰을 사용·생성·변경하지 않았다.

이번 변경은 결과 보고서 추가뿐이며 기존 로컬 수정과 사용자 작업을 보존했다. Commit/Push/Production 배포·외부 설정 변경·SQL 적용·Google 파일 쓰기 없이 종료한다.
