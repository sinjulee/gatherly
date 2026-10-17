# Phase 2D-1 — Production Google 로그인 준비

작성일: 2026-10-17. **로컬 구현·검증 완료, 운영 적용 전 중단.** 기존 Production, 환경변수, Google/Supabase 설정은 변경하지 않았다. 실제 로그인 성공이나 OAuth 왕복을 완료했다고 보고하지 않는다.

후속 변경: [최초 사용자 후보 검증](PHASE_2D_1_FIRST_USER_COMMIT_GATE.md)에서 AUTH_ONLY 모드에 본인 UID 확인 화면을 추가했다. 아래 최초 callback 거부 절차는 일반 모드에 유지되며, AUTH_ONLY의 최신 동작·후보·검증 결과는 후속 문서를 따른다.

## 변경 파일

| 파일 | 변경 |
|---|---|
| app/v2/page.tsx | GATHERLY_V2_AUTH_ONLY=true이면 서버 인증·UUID 승인 후 카탈로그 쿼리 없이 로그인 확인 화면 표시 |
| lib/gatherly-2/integration/config.ts | requireConsent: 통합 활성 + 별도 동의 활성 플래그 검사 |
| lib/gatherly-2/integration/runtime.ts | completeGoogleConsent: state 소비·토큰 교환/암호화 저장만 수행. 파일 쓰기용 withGoogle/requireWrites는 유지 |
| app/api/v2/google/connect/route.ts | 쓰기 게이트 대신 동의 게이트 사용, same-origin·session 검증 유지 |
| app/api/v2/google/callback/route.ts | 서버 session 후 동의 전용 처리 사용 |
| docs/gatherly-2.0/.env.v2.example | AUTH_ONLY, GOOGLE_CONSENT_ENABLED 예제 추가 |
| docs/gatherly-2.0/.env.vercel.example | 동일한 두 설정 및 설명 추가 |
| tests/auth-bootstrap.test.ts | 동의/쓰기 분리, 최초 사용자 거부, 승인 UUID, 토큰 저장·재사용 차단 테스트 3개 |

기존 `.gitignore` 수정은 사용자의 작업으로 보존했다. 이 보고서도 로컬 추가 파일이며 stage/commit/push하지 않았다. 기준 커밋 68eccd88 위의 로컬 수정이므로 이후 적용 시 기존 커밋만 배포하면 이번 변경은 반영되지 않는다.

## 최소 로그인 구성과 의존성

기존 `/api/v2/auth/login`은 sameOrigin 확인 후 Supabase signInWithOAuth를 호출한다. `/api/v2/auth/callback`은 code 교환, 서버 getUser 검증, 환경별 UUID 승인 후 고정 origin의 /v2로 이동한다. 미승인 UUID는 세션을 로컬 signOut하고 403을 반환한다.

새 AUTH_ONLY 모드의 /v2는 session 확인 직후 반환하므로 g2_exhibitions, 카탈로그 RLS, g2_admins, 이용권, Vault RPC, Vault 암호화 키, Google Drive 클라이언트가 없어도 승인 사용자 로그인 확인이 가능하다. Supabase Auth 자체와 Google provider는 필요하다. **AUTH_ONLY는 화면의 의존성을 줄이는 설정이며 다른 API를 일괄 차단하는 보안 플래그가 아니다.** 각 API의 session/권한 검증은 계속 적용되고, 파일 동의와 쓰기는 별도 false 게이트로 차단한다.

파일 접근 동의는 GOOGLE_CONSENT_ENABLED=true일 때만 허용한다. Google 파일 쓰기가 false여도 토큰 동의/저장은 가능하지만 **Vault 스키마·서비스 키·암호화 키는 여전히 필요**하며 state/토큰 저장은 Supabase 쓰기다. 최초 로그인 단계에서는 consent=false로 두므로 이 의존성과 쓰기는 발생하지 않는다. 재연결 시 기존 파일 소유권을 GET으로 확인할 수 있으나 파일 생성·수정 경로는 열지 않는다.

## 현재 변수와 Production 적용 목록 — 미적용

읽기 API에서 기존 4개 변수(URL, publishable key, integration, Google writes)는 모두 Preview 전용으로 확인됐다. Production 사용자 등록 항목은 없었다. 배포별 override·시스템 변수까지 이 목록으로 단정하지 않는다. 비밀값은 출력하지 않았다.

아래는 **후속 승인 후 로그인 시험용 Production 값**이다. 지금 원격에 등록하지 않았다.

| 변수 | 값/등록 원칙 |
|---|---|
| NEXT_PUBLIC_SUPABASE_URL | https://rmjyonrmlbarvtaazurc.supabase.co |
| NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | gatherly-prod 공개용 키, 운영자가 안전하게 등록 |
| GATHERLY_V2_ENVIRONMENT | production |
| GATHERLY_V2_APP_ORIGIN | https://gatherly-shmlucy07-7077s-projects.vercel.app |
| GATHERLY_V2_INTEGRATION_ENABLED | true: Google 로그인 시험을 시작할 때만 적용 |
| GATHERLY_V2_AUTH_ONLY | true |
| GATHERLY_V2_PRODUCTION_ALLOWED_USER_IDS | 사전 확인된 UUID 목록; 최초 부트스트랩에서는 비워 두어 거부 상태 유지 |
| GATHERLY_V2_GOOGLE_CONSENT_ENABLED | false |
| GATHERLY_V2_GOOGLE_WRITES_ENABLED | false 유지 |

`GATHERLY_V2_ALLOWED_USER_IDS`는 예전 공통 이름이며 **현재 서버 승인 판단에 사용하지 않는다.** 이 변수에 등록하는 대신 Production 전용 이름을 사용해야 한다. 문서 요청의 명칭을 그대로 따라 공통 변수를 넣으면 승인이 되지 않는다. 자동 fallback이나 첫 사용자 자동 승인 코드는 추가하지 않았다.

로그인용 Google Client ID/Secret는 Supabase Google provider에 설정한다. 별도 파일 접근용 GATHERLY_V2_GOOGLE_CLIENT_ID/SECRET 및 Vault 키는 이 단계의 필수 변수가 아니다. VERCEL/VERCEL_ENV는 플랫폼 값이며 임의 Production 흉내 설정을 하지 않는다.

## 최초 UUID 부트스트랩 절차

1. 먼저 Supabase Auth Users에 승인 대상 Google 계정의 기존 사용자 UUID가 있는지 운영자가 확인한다. 단순 표시 이름이나 클라이언트 제공 UUID를 믿지 말고 계정·provider·사용자 소유를 확인한다. 기존 UUID가 확실하면 Production 전용 목록에 그 UUID만 등록한다.
2. UUID가 없다면 Google OAuth 동의 화면을 승인된 테스트 계정으로 제한하고, Vercel 접근 권한도 운영자/테스터로 제한한다. 승인된 실제 OAuth 시험 시 최초 Auth 사용자 생성이 발생할 수 있으므로 이 단계는 외부 적용 승인 후 수행한다. 이번에는 생성하지 않았다.
3. Production allowlist를 비워 둔 채 최소 로그인 설정으로 승인된 테스터가 한 번 Google 인증한다. OAuth 시작에는 앱 UUID가 필요하지 않다. provider 인증 후 Auth 사용자가 생성되더라도 앱 callback은 UUID 미승인으로 403·로컬 세션 종료한다. **이 첫 시도의 앱 접근 거부가 정상**이다.
4. 운영자가 Supabase Auth Users에서 방금 인증한 Google 계정/provider에 해당하는 UUID를 확인한다. 다른 신규 계정이나 브라우저가 주장한 이메일로 자동 승인하지 않는다. 신규 가입 비활성화 등 Auth 정책이 사용자 생성을 막으면 먼저 정책을 검토하고, 임의로 전체 공개 가입을 켜지 않는다.
5. 승인 후 GATHERLY_V2_PRODUCTION_ALLOWED_USER_IDS에 정확한 UUID만 등록하고 해당 설정 반영을 위한 별도 Production 재배포를 승인한다. 재로그인해 로그인 확인 화면을 보고, 다른 계정은 403인지 검증한다.

이 절차는 “UUID가 있어야 OAuth를 시작할 수 있다”는 순환을 제거하면서 앱 자료 접근은 승인 전까지 차단한다. Supabase Auth 가입과 Gatherly 사용 승인은 다르다. g2_catalog_readers나 운영 SQL을 먼저 만들 필요도 없다.

## 콜백 경로와 Production 보호

| 등록 위치 | 정확한 값 |
|---|---|
| Google 로그인 클라이언트 Authorized redirect URI | https://rmjyonrmlbarvtaazurc.supabase.co/auth/v1/callback |
| Supabase Site URL | https://gatherly-shmlucy07-7077s-projects.vercel.app |
| Supabase redirect allowlist | https://gatherly-shmlucy07-7077s-projects.vercel.app/api/v2/auth/callback |
| 별도 Drive/Sheets OAuth redirect URI (후속 단계) | https://gatherly-shmlucy07-7077s-projects.vercel.app/api/v2/google/callback |

로그인은 기본 신원 scope만 사용하고 파일 접근 동의는 별도 drive.file scope다. [Supabase Google 로그인](https://supabase.com/docs/guides/auth/social-login/auth-google), [Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)를 확인했다. 실제 provider 콘솔 설정은 이번에 변경하거나 로그인으로 검증하지 않았다.

Vercel Authentication은 앱 인증과 별도다. 승인된 테스터는 고정 Production origin에서 Vercel 로그인 후 같은 브라우저로 OAuth를 시작해야 한다. 리디렉션 복귀는 브라우저 요청이므로 보호 쿠키가 유지돼야 앱 code/PKCE 처리가 가능하다. Google 서버에서 앱으로 직접 호출하는 webhook으로 취급하지 않는다.

실제 검증 계획: 정상 왕복, Vercel 보호 세션 만료, Safari/iPhone 외부 브라우저 전환, PKCE 쿠키 손실, 만료 code, 미승인 계정 거부를 확인한다. 보호 중간 로그인으로 code가 유실되면 원래 앱에서 OAuth를 새로 시작한다. 자동화 우회 토큰을 URL/클라이언트에 전달하거나 콜백을 무인증 예외로 공개하지 않는다. 지금까지는 보호 없는 콜백 요청이 Vercel SSO로 이동한다는 관측만 있으며 정상 OAuth 왕복 성공 증거는 없다.

## 로컬 검증

- 기존 47개 + 새 3개 = **50/50 PASS**, skip 0.
- 새 테스트: 동의 명시적 opt-in, 공통/빈 allowlist로 부트스트랩 우회 불가, writes=false에서 토큰만 저장·콜백 재사용 거부·파일 작업 호출 거부. 실제 Google 요청은 mock이며 Vault는 임시 디렉터리다.
- 타입 검사 PASS, 린트 오류 0 / 기존 RefreshCw 미사용 경고 1.
- 격리 소스 Production 환경 build:vercel PASS. AUTH_ONLY=true, integration/consent/writes=false, 실제 외부 자격증명 없음. 승인 사용자 로그인 화면의 실브라우저 검증은 후속 단계다.
- 빌드 경로 `/private/tmp/gatherly-2d-o_g4gi2j/source`는 이번 로컬 코드 6개를 반영한 검증 복사본이며 이제 순수 68eccd88 아카이브가 아니다. 그대로 배포 승인된 것으로 취급하지 않는다.
- 기존 보호 파일 46개 해시 동일. DB·미디어·환경파일 변경 없음. git diff --check 통과.

## 적용 전 남은 항목

Production 변수 등록·Supabase Google provider 설정·Auth 사용자 생성 시험·재배포는 각각 승인 후 진행한다. 이번에는 로컬 구현과 문서화만 했다. 별도 파일 동의 활성화는 Vault 준비/토큰 저장 승인 후, 실제 Google 파일 쓰기는 또 별도 승인 후 진행한다.

기존 Automation Bypass 1개와 자동 주입 설정, 미완료 원격 함수 번들 감사 위험은 그대로 남는다. 이번에 토큰을 생성·노출·변경하지 않았다. Supabase SQL, Google 실제 파일 쓰기, Git Commit/Push, Production 재배포 없이 종료한다.
