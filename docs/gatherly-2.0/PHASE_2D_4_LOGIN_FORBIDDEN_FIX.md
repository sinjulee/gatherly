# Phase 2D-4 — Google 로그인 FORBIDDEN 로컬 수정

작성일: 2026-10-17. **원인 재현·로컬 수정·검증 완료. Commit/Push/배포 및 운영 설정 변경 없음. 실제 최초 사용자 생성은 미검증.**

## 원인과 재현

`app/api/v2/auth/login/route.ts:5`의 `sameOrigin(request)`가 원인이다. `lib/gatherly-2/integration/config.ts:19`에서 요청의 `Origin` 헤더와 `GATHERLY_V2_APP_ORIGIN`의 origin을 엄격히 비교하고, 불일치 시 `IntegrationError('FORBIDDEN', 403)`을 던진다. Origin 누락·null도 거부한다.

기존 Production 배포의 고정 APP_ORIGIN은 `https://gatherly-shmlucy07-7077s-projects.vercel.app`이다. 사용자가 로그인 버튼을 누른 별칭은 `https://gatherly-three-umber.vercel.app`이므로 브라우저 POST의 Origin이 다르다. 상대 경로 로그인 form이 별칭에 POST하면서 Supabase 요청 전에 차단된다.

읽기 전용 Vercel 조회로 새 별칭이 동일 Gatherly 프로젝트 및 `dpl_2us7xQm59TvjtZ42kCsspCTv9fxK`를 가리킴을 확인했다. 기존 식별된 보호 우회 자격증명을 메모리에서만 사용하여 동일 로그인 URL의 Origin만 바꿔 재현했다. 새 자격증명 생성·출력은 없었다.

| 배포 코드에 보낸 POST Origin | 결과 |
|---|---|
| `https://gatherly-three-umber.vercel.app` | 403, `FORBIDDEN` |
| 기존 고정 APP_ORIGIN | 303, OAuth 시작 |

두 번째 요청은 원인 분리를 위한 HTTP 검사이며, 다른 호스트에서 Origin을 위조해 로그인하는 방식을 해결책으로 사용하지 않는다. 이번 수정은 요청 URL의 origin도 검사한다.

`GATHERLY_V2_INTEGRATION_ENABLED=false`라면 `serverClient()`의 `requireEnabled()`가 **503 DISABLED**를 반환한다. 최초 로그인에 true가 필요하지만 이번 403의 원인이 아니다. 로그인 시작 경로는 `session()`이나 `environmentUser()`를 호출하지 않으므로 빈 `GATHERLY_V2_PRODUCTION_ALLOWED_USER_IDS`가 시작을 막지 않는다. API URL을 주소창에서 GET으로 열면 지원하지 않는 메서드이므로 405가 정상이며, `/v2`의 버튼으로 POST해야 한다.

## 최소 수정

| 파일 | 수정 |
|---|---|
| `proxy.ts` | 통합 활성 상태에서 별칭의 GET/HEAD `/v2`, `/v2/auth-complete`를 고정 APP_ORIGIN의 `/v2`로 307 이동. Supabase 클라이언트·쿠키 처리 전에 수행 |
| `lib/gatherly-2/integration/config.ts` | `requireAppOrigin()` 추가. 요청 URL origin과 서버 고정 origin 일치 요구 |
| `app/api/v2/auth/login/route.ts` | 기존 POST Origin 검사 유지 + 요청 URL origin 검사 |
| `app/api/v2/auth/callback/route.ts` | 코드 교환 전 요청 URL origin 검사 |
| `tests/auth-origin.test.ts` | 실제 Proxy/거부 Route Handler 및 SSR SDK 기반 회귀 테스트 4개 |

리디렉션 목적지는 서버 설정으로만 정한다. `Host`/`X-Forwarded-Host`/사용자가 전달한 next를 목적지로 채택하지 않는다. 별칭에서 들어온 query·OAuth code와 POST 본문도 전달하지 않는다. 비정규 호스트로 직접 POST하거나 콜백을 호출하면 계속 403이다. 이미 열린 예전 별칭 로그인 탭은 배포 후 새로고침해야 한다.

흐름은 **별칭 로그인 페이지 → 보호된 고정 주소 → Google 로그인 POST → Supabase → Google → Supabase callback → 고정 앱 callback → 본인 UID 화면**이다. 로그인 시작과 콜백이 같은 호스트에 있도록 하여 host-bound PKCE 쿠키 누락도 예방한다.

AUTH_ONLY=true에서 getUser로 검증한 최초 사용자의 UID를 표시하는 기존 부트스트랩 정책은 유지했다. 사용자를 승인 UUID 목록·관리자·카탈로그 권한에 자동 등록하지 않는다. 일반 모드의 UUID 승인 검사, 지도·카탈로그·개인자료 API의 서버 검사, Google consent/writes=false, 레거시 보고서 API 차단도 변경하지 않았다.

## PKCE·state·콜백 경계

Google provider의 OAuth state 검증은 Supabase가 담당하고, 앱은 기존 `signInWithOAuth` 및 `exchangeCodeForSession` 경로를 유지한다. callback에서 브라우저 Origin 헤더를 필수화하지 않는다. OAuth 최상위 GET 왕복에는 그 헤더가 없을 수 있기 때문이다. 대신 callback의 수신 URL origin을 고정 주소와 비교하고, SDK의 verifier 쿠키 기반 교환 및 서버 getUser 검증을 유지한다.

추가 테스트는 실제 설치된 Supabase SSR SDK로 PKCE challenge 생성, verifier 쿠키 저장, 가짜 token endpoint에 verifier 전달, 검증된 본인 UID 반환을 확인한다. verifier 소비 후 재교환은 오류이며 token endpoint를 다시 호출하지 않는다. Google/Supabase 실제 state 검증·서명·계정 생성을 대신하는 테스트는 아니다.

공식 문서의 [Google 서버 로그인 및 callback](https://supabase.com/docs/guides/auth/social-login/auth-google), [PKCE 흐름](https://supabase.com/docs/guides/auth/sessions/pkce-flow)을 확인했다. changelog도 읽었으며 SDK 버전 변경은 하지 않았다. 설치된 Next.js Proxy 및 Route Handler 가이드를 확인하고 수정했다.

## Vercel Authentication 발견 사항

프로젝트 정책은 여전히 `ssoProtection.deploymentType=all_except_custom_domains`다. 그러나 **프로젝트 정책 필드만으로 모든 별칭이 보호된다고 볼 수 없다.** 인증 쿠키·우회 토큰 없는 실제 요청 결과는 다음과 같다.

| 주소의 `/v2` | 비로그인 응답 |
|---|---|
| `gatherly-shmlucy07-7077s-projects.vercel.app` | 302 → vercel.com/sso-api |
| `gatherly-three-umber.vercel.app` | **200, Vercel 로그인 차단 없음** |

새 별칭이 보호되지 않는 사실은 확인했으나, Vercel이 해당 별칭을 내부적으로 어떤 도메인 범주로 분류했는지까지 단정하지 않는다. 이번 로컬 수정은 새 별칭의 로그인 화면을 보호된 주소로 이동시킨다. **전체 별칭/API의 Vercel 보호 설정을 고치는 작업은 아니며, 이를 완료했다고 보고하지 않는다.** 운영자는 새 별칭까지 포함하는 보호 정책을 적용하거나 해당 별칭 사용·연결을 제한하는 방안을 검토해야 한다. 이 작업에서는 도메인·보호 정책·환경변수를 변경하지 않았다.

고정 주소에서 먼저 Vercel 인증을 완료하면 OAuth callback도 같은 호스트로 돌아온다. 실제 Google 왕복 시 보호 쿠키 만료나 브라우저 쿠키 정책 때문에 Vercel 재인증이 필요할 가능성은 남는다. callback 공개 예외나 새 bypass 토큰으로 우회하지 않는다. 실제 브라우저 왕복 성공은 이번 작업 범위에서 확인하지 않았다.

## 로컬 검증

| 검사 | 결과 |
|---|---|
| 기존 51개 + 신규 4개 테스트 | 55/55 PASS, skip 0 |
| 타입 검사 | PASS |
| 린트 | 오류 0, 기존 RefreshCw 미사용 경고 1 |
| 격리 build:vercel | PASS |
| git diff --check | PASS |
| 기존 보호 파일 | 환경파일·SQLite·미디어·백업 등 46개 SHA-256 동일 |

빌드는 `/private/tmp/gatherly-login-fix-lie5br6b/source`에서 기존 HEAD와 이번 변경만 합쳐 실행했다. 실제 환경파일·개인자료를 복사하지 않았고, 가짜 Supabase 주소/Publishable Key와 integration=true, AUTH_ONLY=true, 빈 승인 목록, consent/writes=false를 사용했다. Prisma generate만 실행했으며 SQL이나 SQLite 변경은 없다.

격리 빌드의 로컬 Next 서버에서도 HTTP로 확인했다.

| 요청 | 결과 |
|---|---|
| `/v2` | 200 |
| POST `/api/v2/auth/login` | 303 → 가짜 Supabase authorize, PKCE 쿠키 설정 |
| verifier 없는 callback | 401 |
| 세션 없는 `/v2/auth-complete` | 307 → `/v2` |
| 세션 없는 `/api/v2/catalog` | 401 |
| POST `/api/v2/media` | 503 DISABLED |

처음 로컬 실행은 sandbox 포트 제한으로 실패하여 승인된 로컬 포트로 재실행했다. 이후 Next.js가 루프백 요청 URL을 localhost로 정규화하여 APP_ORIGIN=127.0.0.1과 불일치한 것을 확인했고, 로컬 검사 APP_ORIGIN을 `http://localhost:3197`로 맞춰 통과했다. 운영 설정은 변경하지 않았다. 로컬 개발에서도 해당 고정 호스트를 일관되게 사용해야 한다. 서버는 검사 후 종료했다.

## 종료 상태와 다음 조치

브랜치는 `gatherly-v2-preview`, HEAD는 `d0226a4bc0746f26f7f437db92d6c0f9297c903e` 그대로다. 기존 사용자 `.gitignore` 수정 및 미추적 문서를 보존했다. 이번 코드 4개·테스트 1개·이 보고서는 로컬 수정으로 남겼으며 stage/Commit/Push/배포는 하지 않았다.

따라서 **현재 Production에는 이 수정이 반영되지 않았다.** 기존 고정 주소 `https://gatherly-shmlucy07-7077s-projects.vercel.app/v2`에서 Vercel 인증 후 로그인하면 이번 별칭 Origin 불일치 조건을 피할 수 있다. 다만 Google 실제 callback과 UID 화면 성공은 별도 실증이 필요하다.

후속 승인 시 새 별칭 보호 상태, 고정 APP_ORIGIN과 Supabase 앱 callback allowlist 일치, AUTH_ONLY=true/빈 승인 목록/consent 및 writes=false를 재확인한 뒤 검토된 수정만 배포해야 한다. SQL 변경, Google 파일 쓰기, 최초 사용자 자동 승인, 인증 보호 해제, 비밀값 출력은 하지 않았다.
