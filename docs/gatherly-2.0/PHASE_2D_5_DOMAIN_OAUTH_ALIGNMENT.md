# Phase 2D-5 — Production 대표 도메인·OAuth 통일 계획

작성일: 2026-10-17. **설정안 및 로컬 후보 검증 완료. 운영 설정은 미적용.**

새 대표 Origin은 `https://gatherly-three-umber.vercel.app`이다. 이 문서의 목표 설정은 Phase 2D-4 보고서의 기존 고정 주소 권고를 대체한다. 이전 보고서의 당시 관측 결과는 수정하지 않았다.

## 현재 상태 재확인

프로젝트 `gatherly`, 팀 `shmlucy07-7077s-projects`, 프로젝트 ID `prj_rVB8Km0yCOQSWLTcqYGsa0YHhyH7`.

두 Alias는 모두 READY / production 배포 `dpl_2us7xQm59TvjtZ42kCsspCTv9fxK`에 연결되어 있다. 커밋은 `d0226a4bc0746f26f7f437db92d6c0f9297c903e`이며 로컬 Origin 수정은 아직 배포되지 않았다.

| 호스트 | 비로그인 /v2 | 역할 |
|---|---|---|
| gatherly-three-umber.vercel.app | 200, 앱 로그인 안내 | 등록된 Production 도메인, 새 대표 주소 |
| gatherly-shmlucy07-7077s-projects.vercel.app | 302 → Vercel 인증 | 기존 APP_ORIGIN |
| gatherly-mvdkyhnwg-shmlucy07-7077s-projects.vercel.app | 302 → Vercel 인증 | 직접 배포 URL |

현재 보호 값은 `all_except_custom_domains`. 새 대표 주소는 프로젝트 도메인 목록에 등록되어 있지만 Vercel 인증으로 차단되지 않는다. 앱은 비로그인 요청에 로그인 안내를 정상 렌더링하므로 200을 반환한다. 로그인 안내 공개와 내부 자료 접근 허용은 별개다.

새 대표 주소의 직접 요청에서 지도·카탈로그·voice API는 401, 자료·보고서 레거시 API는 404, 원본 지도 경로는 404를 재확인했다. 파일·동의 POST는 현재 새 주소 Origin에서 403이다. 기존 서버 승인 검사와 파일 비활성화 코드는 변경하지 않았다.

현재 배포의 OAuth 시작은 새 대표 주소 Origin에서 403이고 기존 APP_ORIGIN 헤더를 사용한 원인 확인 요청에서는 303이다. redirect_to도 기존 앱 callback이다. **운영 주소 통일은 아직 이루어지지 않았다.** 진단용 Origin 헤더 변경을 사용자 로그인 해결책으로 사용하지 않는다.

## Production을 포함한 전체 보호

후속 승인 후 Vercel 프로젝트 **Settings → Deployment Protection → Vercel Authentication → All Deployments**를 선택하고 저장한다. All Deployments는 Production 도메인을 포함한 전체 URL을 보호한다. Standard Protection은 Production 도메인을 제외하므로 이번 내부 테스트 운영 목적과 맞지 않는다. [공식 보호 범위 안내](https://vercel.com/docs/deployment-protection#choose-which-urls-to-protect)

API로 적용한다면 Gatherly 프로젝트만 대상으로 다음 설정을 사용한다. **아래 PATCH는 실행하지 않았다.**

```text
PATCH /v9/projects/prj_rVB8Km0yCOQSWLTcqYGsa0YHhyH7?teamId=team_8Zi6jcULw7UKK4IaADXYOOyY
{"ssoProtection":{"deploymentType":"all"}}
```

적용 전후 다른 보호·bypass 설정을 보존하고, 쿠키/우회 헤더 없는 브라우저 및 HTTP 요청으로 두 Alias와 직접 URL 모두 Vercel 인증 화면으로 가는지 확인한다. `all`을 저장할 수 없거나 실제 보호가 확인되지 않으면 그 상태에서 로그인 실증 배포를 중단한다. 인증 해제·callback 공개 예외·새 bypass 토큰 생성으로 대체하지 않는다. [Vercel Authentication API 설정](https://vercel.com/docs/deployment-protection/methods-to-protect-deployments/vercel-authentication#how-to-manage-vercel-authentication-with-the-api)

## 통일할 환경변수와 OAuth 설정

### Vercel Production

아래 설정은 Production 대상에만 적용할 계획이다. Preview 설정과 로컬 `.env`는 덮어쓰지 않는다. 기존 배포의 CLI override가 후속 배포에 자동 계승된다고 가정하지 말고, 빌드와 런타임에 같은 값을 전달한다.

| 이름 | 목표 값 |
|---|---|
| GATHERLY_V2_APP_ORIGIN | `https://gatherly-three-umber.vercel.app` |
| GATHERLY_V2_ENVIRONMENT | `production` |
| GATHERLY_V2_INTEGRATION_ENABLED | `true` — Supabase 로그인 경로에 필요 |
| GATHERLY_V2_AUTH_ONLY | `true` |
| GATHERLY_V2_PRODUCTION_ALLOWED_USER_IDS | 빈 문자열 유지 |
| GATHERLY_V2_GOOGLE_CONSENT_ENABLED | `false` |
| GATHERLY_V2_GOOGLE_WRITES_ENABLED | `false` |
| NEXT_PUBLIC_SUPABASE_URL | `https://rmjyonrmlbarvtaazurc.supabase.co` 유지 |
| NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | 기존 올바른 프로젝트 키 유지, 값 출력 안 함 |

`VERCEL_ENV`는 플랫폼이 결정하므로 직접 변경하지 않는다. 서버는 production 환경 일치를 검증한다. 공통 `GATHERLY_V2_ALLOWED_USER_IDS`로 최초 사용자를 허용하지 않는다. 로그인 실증에는 서비스 역할 키·카탈로그 SQL/RLS·Vault 암호화 키가 필요하지 않다.

별도 Google 파일 OAuth를 나중에 승인받는 경우 `GATHERLY_V2_GOOGLE_REDIRECT_URI`는 `https://gatherly-three-umber.vercel.app/api/v2/google/callback`이어야 한다. **이번 로그인 실증에는 등록·활성화할 필요가 없으며 consent/writes=false를 유지한다.**

### Supabase Auth URL Configuration

프로젝트 `gatherly-prod` / `rmjyonrmlbarvtaazurc`의 Authentication → URL Configuration에서 다음을 적용할 계획이다.

- **Site URL:** `https://gatherly-three-umber.vercel.app`
- **Redirect URLs:** `https://gatherly-three-umber.vercel.app/api/v2/auth/callback`
- `/v2/auth-complete`는 앱 내부의 검증 후 목적지이며 OAuth callback allowlist 항목으로 추가할 필요가 없다.
- 전환 중 기존 배포·진행 중 OAuth를 위해 기존 callback을 잠시 유지할 수 있으나, 새 배포 실증 완료 후 Production 로그인 목적지는 새 callback 하나로 정리한다. `https://*.vercel.app/**`와 같은 광범위 wildcard는 사용하지 않는다.

Site URL만 바꾸어서는 코드의 명시적 redirectTo가 바뀌지 않는다. Vercel APP_ORIGIN도 반드시 함께 맞춰야 한다. 이번에는 Supabase 관리 설정의 실제 현재 Site URL/전체 Redirect 목록을 조회·변경하지 않았으며 위 값은 **적용할 목표 값**이다. [Supabase Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)

### Google 로그인 OAuth 클라이언트

Supabase Google provider가 사용하는 기존 Web OAuth 클라이언트에서 확인한다. 클라이언트 ID/Secret을 재발급하거나 코드에 넣지 않는다.

| Google 설정 | 값·조치 |
|---|---|
| Authorized JavaScript origins | `https://gatherly-three-umber.vercel.app` 등록·확인 |
| Authorized redirect URIs | **`https://rmjyonrmlbarvtaazurc.supabase.co/auth/v1/callback` 유지** |
| Audience / Testing | 실증 Google 계정이 테스트 사용자에 포함되어 있는지 확인 |
| 로그인 범위 | openid / email / profile, Drive·Sheets 범위를 로그인에 추가하지 않음 |

Google 클라이언트의 redirect URI는 앱의 `/api/v2/auth/callback`이 아니라 **Supabase callback**이다. 앱 대표 주소 변경 때문에 이 Supabase URI를 바꾸면 안 된다. 별도 Drive/Sheets OAuth 클라이언트와도 혼동하지 않는다. Google 콘솔의 실제 설정값은 이번에 조회·수정하지 않았다. [Supabase Google OAuth 설정](https://supabase.com/docs/guides/auth/social-login/auth-google)

## 코드·테스트·문서 범위

기존 후보 5개를 유지한다.

```text
proxy.ts
lib/gatherly-2/integration/config.ts
app/api/v2/auth/login/route.ts
app/api/v2/auth/callback/route.ts
tests/auth-origin.test.ts
```

운영 코드 4개는 이전 Phase 2D-4 후보에서 추가 변경하지 않았다. 모든 목적지는 APP_ORIGIN에서 얻으므로 새 대표 도메인을 코드에 하드코딩할 필요가 없다. **이번에는 테스트의 canonical을 새 주소로, alias를 기존 주소로 바꾼 2줄만 변경했다.** 동일한 55개 테스트로 반대 방향 전환을 검증했다.

기존 후보 문서 2개 `PHASE_2D_4_LOGIN_FORBIDDEN_FIX.md`, `PHASE_2D_4_RELEASE_GATE.md`는 당시 증거로 보존한다. 기존 7개 후보에 이번 계획서까지 감사 추적용으로 포함하면 8개다. 실제 stage/Commit은 미실행이며 사용자 `.gitignore` 수정 및 다른 미추적 문서는 제외한다.

별칭 GET/HEAD 로그인 화면은 새 고정 `/v2`로 이동하고, query·code·POST 본문은 전달하지 않는다. 로그인 POST는 브라우저 Origin과 요청 URL을 검증하고 callback은 수신 URL origin을 검증한다. Supabase state 검증, SDK PKCE verifier 교환, getUser 본인 확인, 미승인 UUID의 내부 접근 거부는 유지한다. callback에서 Origin 헤더를 필수화하거나 code를 다른 호스트로 재전송하지 않는다.

## 재검증 결과

| 항목 | 결과 |
|---|---|
| 새 대표 주소 기준 기존 55개 테스트 | 55/55 PASS, skip 0 |
| 타입 검사 | PASS |
| 린트 | 오류 0, 기존 RefreshCw 미사용 경고 1 |
| 격리 build:vercel | PASS, 새 APP_ORIGIN과 가짜 Supabase 키 사용 |
| 코드·테스트 5개와 격리 소스 일치 | PASS |
| 기존 후보 7개 로컬 비밀값 일치 검사 | 발견 0 |
| 격리 소스 파일 검사 | 의존성·빌드 출력 제외 200개 검사, 금지 자료·원본 지도 SHA·로컬 비밀값 발견 0 |
| 기존 환경파일·SQLite·미디어·백업 | 46개 SHA-256 동일 |
| diff --check / index | PASS / 비어 있음 |

격리 소스는 `/private/tmp/gatherly-login-fix-lie5br6b/source`다. 검사한 200개는 업로드 manifest 개수가 아니다. 환경 예제·SQL 초안 등 기존 `.vercelignore` 제외 대상도 포함한 소스 검사이며, 실제 배포 직전 업로드 목록을 다시 확인해야 한다. 함수 번들 전체의 비밀정보 부재를 이번 검사로 증명한 것은 아니다. 테스트 복사 단계의 임시 경로 오류는 절대 경로 복사로 바로잡았고 최종 소스 일치를 확인했다.

## 최소 Production 적용·실증 순서 — 미실행

1. **보호부터 적용:** 승인 후 Gatherly만 All Deployments로 설정하고 모든 URL의 비로그인 차단을 확인한다. 기존 Alias는 즉시 삭제하지 않는다.
2. **OAuth 준비:** Supabase에 새 Site URL과 정확한 새 callback을 등록하고 Google 콘솔의 origin·Supabase callback·테스트 사용자를 확인한다. 기존 callback은 전환 완료 전 임시 보존할 수 있다.
3. **배포 환경 준비:** 위 Production 환경변수를 저장한다. 현재 실행 중인 배포의 설정이 곧바로 바뀐다고 가정하지 않는다. 새 배포의 빌드·런타임 설정을 명시적으로 확인한다.
4. **후속 승인된 Commit/Push:** 최소 코드·테스트와 검토 문서만 `gatherly-v2-preview`에 반영한다. master는 건드리지 않는다.
5. **격리 배포:** 새 승인 커밋만 archive하고 비밀키·실제 env·SQLite·개인자료·원본 지도·불필요한 문서를 제외한다. 테스트/빌드/업로드 후보를 검토한다. CLI 기본 형식은 아래와 같으며 이번에는 실행하지 않았다.

```sh
vercel deploy "$RELEASE_SOURCE" \
  --project prj_rVB8Km0yCOQSWLTcqYGsa0YHhyH7 \
  --scope shmlucy07-7077s-projects \
  --target=production \
  --meta "sourceCommit=$APPROVED_COMMIT"
```

`RELEASE_SOURCE`와 `APPROVED_COMMIT`은 후속 승인한 새 커밋으로 정해야 한다. 이 기본 명령은 **Production 프로젝트 환경변수의 위 목표 값 등록·검증이 선행되어야 실행 가능**하다. CLI `--env`/`--build-env`를 사용할 경우 두 쪽 모두 동일한 새 APP_ORIGIN과 안전 플래그를 명시하며 키 값을 로그에 출력하지 않는다. 이전 d0226a4나 미커밋 작업 폴더를 새 승인 커밋 대신 배포하지 않는다.

6. **실증:** 새 대표 주소 `/v2`에서 Vercel 인증 → Google 로그인 → Supabase callback → 새 앱 callback → `/v2/auth-complete`를 확인한다. 본인의 UID 표시 및 Supabase Users 생성을 운영자가 비공개로 대조한다. 실제 계정 생성은 이 후속 승인된 실증에서만 수행한다.
7. **권한 거부 확인:** 같은 미승인 세션으로 지도·카탈로그가 403, 파일·동의가 DISABLED, 레거시 보고서가 404인지 확인한다. 최초 사용자에게 승인 UUID나 관리자 권한을 자동 부여하지 않는다.
8. **전환 정리:** 성공 후 오래된 Supabase Production callback 허용 항목을 정리한다. 과거 도메인 쿠키/진행 중 flow를 재사용하지 않고 새 대표 주소에서 로그인을 다시 시작한다. 기존 Alias의 로그인 화면은 새 주소로 이동시키되 OAuth code 자체는 이동시키지 않는다.

## 남은 위험 및 종료

현재 새 대표 주소는 아직 전체 Vercel 보호가 적용되지 않았으며 APP_ORIGIN도 이전 배포 값이다. 로컬 통과를 실운영 로그인 성공으로 표시하지 않는다. 대표 주소가 바뀌면 Vercel 인증 쿠키와 PKCE 세션을 새 주소에서 다시 만들어야 한다. callback 공개 예외 없이 실제 브라우저 왕복과 iPhone 확인이 필요하다.

기존 Automation Bypass 자격증명·자동 주입 관련 위험과 함수 번들 정밀 감사 미완료는 유지한다. 이번에는 토큰을 사용·생성·삭제하거나 보호 정책을 변경하지 않았다.

브랜치 및 HEAD는 `gatherly-v2-preview` / `d0226a4bc0746f26f7f437db92d6c0f9297c903e` 그대로다. **Commit, Push, Production 재배포, Supabase SQL/설정 변경, Google 파일 쓰기, 로컬 환경파일 변경 없이 종료한다.**
