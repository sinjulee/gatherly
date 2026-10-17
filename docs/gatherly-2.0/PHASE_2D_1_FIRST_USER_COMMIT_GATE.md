# 최초 Google 사용자 부트스트랩 — 로컬 후보 검증

작성일: 2026-10-17. **최초 사용자 생성은 미실행. 코드 후보 준비·검증 완료, Commit/Push/배포 승인 대기.**

사용자가 확인한 Supabase Users 0명을 전제로 한다. 이번에는 원격 사용자를 생성하거나 운영 SQL·Google 파일 쓰기를 실행하지 않았다.

## Production과의 차이

현재 Production을 읽기 전용 조회해 `dpl_9diV9f6PuyaZTUfgK5dQnAfrvMCJ`, READY / production, 소스 메타데이터 `68eccd88fbb941a3beef460bf30d500604583bba`를 확인했다. 파일 대조는 이전 감사에서 확보한 이 불변 배포 ID의 전체 소스 manifest를 사용했다.

현재 Production에는 `/v2/auth-complete`가 없다. 콜백은 UUID 미승인 시 로컬 signOut하고 거부한다. Phase 2D-1 로컬 변경에는 파일 동의 게이트와 승인 사용자 로그인 전용 화면이 있지만, 미승인 최초 사용자의 UID 확인은 없었다.

이번 후보는 **AUTH_ONLY=true인 경우에만**, Google code 교환·서버 getUser 검증 후 고정 `/v2/auth-complete`로 이동한다. 그 화면이 현재 로그인한 본인의 UID만 표시한다. 일반 모드의 콜백은 기존 UUID 승인 검사를 유지한다.

## 보안 경계

- 인증 완료 화면은 서버 컴포넌트이며 매 요청 getUser로 신원을 검증한다. 비로그인·익명·만료/검증 실패 세션은 UID를 표시하지 않고 /v2로 이동한다.
- UID는 query/header/form 입력이나 user_metadata에서 가져오지 않는다. 서버가 검증한 사용자 ID만 반환하는 ownLoginIdentity를 사용한다. 이메일·토큰·role 등은 화면에 전달하지 않는다.
- AUTH_ONLY와 통합 활성, 서버 환경 일치가 필요하다. UID는 URL·응답 헤더·로그에 넣지 않고 완료 화면 본문에서만 표시한다. 기존 Proxy의 private/no-store, force-dynamic, noindex가 적용된다. noindex는 접근 통제의 대체물이 아니다.
- 미승인 사용자도 신원 확인용 Auth 세션은 유지할 수 있으나, **session()/environmentUser()/adminSession()의 내부 접근 승인은 그대로다.** 지도·카탈로그·개인 자료 API는 빈 Production UUID 목록에서 차단된다. 세션 발급과 자료 접근 권한을 구분한다.
- g2_admins·reader·entitlement 생성, 첫 사용자 자동 승인, 공통 allowlist fallback, SQL 쓰기 코드는 없다.
- Vercel Authentication을 먼저 통과해야 한다. 새 우회 토큰을 만들거나 공개 예외 경로를 추가하지 않았다. 외부 OAuth 왕복은 후속 실환경 검증 대상이다.

## 후속 승인 후 최초 사용자 절차

1. Supabase Google provider와 Google 테스트 사용자/동의 화면을 구성한다. 고정 Production 주소에서 Vercel 로그인을 먼저 완료한다.
2. 아래 최소 Production 설정을 적용하고 검토된 후보를 별도 승인 후 배포한다. UUID 목록은 비워 둔다.
3. 승인된 테스터가 Google 로그인한다. Supabase Auth가 최초 사용자를 생성하고 앱은 완료 화면으로 이동한다. 사용자 생성은 Auth 서비스의 실제 쓰기이므로 이번에는 하지 않았다.
4. 본인이 완료 화면의 UID를 승인된 비공개 경로로 운영자에게 전달한다. 운영자는 Supabase Auth Users의 계정·Google provider·UUID와 대조한다. UID를 안다는 사실만으로 승인하지 않는다.
5. 별도 승인 후 정확한 UUID를 GATHERLY_V2_PRODUCTION_ALLOWED_USER_IDS에 등록하고 설정 반영을 진행한다. 관리자/DB reader 권한은 자동 부여하지 않는다. 등록 전 내부 API 거부를 먼저 확인한다.

이 절차는 이전 2D-1 문서의 “최초 callback 403·signOut 후 Dashboard에서만 UUID 확인” 방식을 **AUTH_ONLY 모드에 한해 대체**한다. 일반 모드의 승인 정책은 그대로다.

## 적용할 Production 설정 — 미등록

```text
NEXT_PUBLIC_SUPABASE_URL=https://rmjyonrmlbarvtaazurc.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<운영자가 안전하게 등록>
GATHERLY_V2_APP_ORIGIN=https://gatherly-shmlucy07-7077s-projects.vercel.app
GATHERLY_V2_ENVIRONMENT=production
GATHERLY_V2_INTEGRATION_ENABLED=true
GATHERLY_V2_AUTH_ONLY=true
GATHERLY_V2_PRODUCTION_ALLOWED_USER_IDS=
GATHERLY_V2_GOOGLE_CONSENT_ENABLED=false
GATHERLY_V2_GOOGLE_WRITES_ENABLED=false
```

`GATHERLY_V2_ALLOWED_USER_IDS`는 서버 승인용이 아니다. 최초 로그인에 카탈로그 스키마/RLS·Vault·서버 서비스 키·Vault 암호화 키·파일 OAuth 클라이언트는 필요하지 않다. Supabase Auth/Google provider 설정만 필요하다. 이후 파일 동의를 켜려면 Vault 의존성 및 별도 승인이 필요하다.

Google 로그인 클라이언트 callback: `https://rmjyonrmlbarvtaazurc.supabase.co/auth/v1/callback`. Supabase redirect allowlist: `https://gatherly-shmlucy07-7077s-projects.vercel.app/api/v2/auth/callback`. 새 완료 화면은 OAuth provider callback이 아니며 앱이 검증 후 이동시키는 내부 목적지다. 보호 쿠키가 유지되는 실제 브라우저 왕복과 Safari/iPhone 검증은 아직 남아 있다.

## 최소 검토 후보 목록

Phase 2D-1 변경을 보존한 코드·테스트·값 없는 예제 **11개**와 검토 문서만 후보로 삼는다. Phase 2D-1의 별도 동의 분리 코드는 포함하되 consent=false로 비활성 유지한다.

```text
app/api/v2/auth/callback/route.ts
app/api/v2/google/callback/route.ts
app/api/v2/google/connect/route.ts
app/v2/page.tsx
app/v2/auth-complete/page.tsx
lib/gatherly-2/auth/server.ts
lib/gatherly-2/integration/config.ts
lib/gatherly-2/integration/runtime.ts
tests/auth-bootstrap.test.ts
docs/gatherly-2.0/.env.v2.example
docs/gatherly-2.0/.env.vercel.example
```

검토 문서 후보는 `PHASE_2D_1_AUTH_BOOTSTRAP.md`와 이 보고서다. 기존 사용자 `.gitignore` 수정, 나머지 미추적 단계 보고서·구버전 문서는 자동 포함하지 않는다. 실제 stage도 하지 않았다. 개별 경로를 재검사해 승인받은 목록만 이후 Commit해야 한다.

격리 배포 후보는 `/private/tmp/gatherly-auth-bootstrap-znn2eg3i/source`: 68eccd88을 추출한 뒤 위 11개만 덮어 적용하고 Markdown 문서를 제외했다. 실제 환경파일·SQLite·미디어·원본 지도·도구 상태는 복사하지 않았다. 이 후보는 아직 커밋되지 않은 변경을 포함하므로 68eccd88 자체와 동일한 소스라고 표시해서는 안 된다.

## 검증 결과

| 검사 | 결과 |
|---|---|
| 기존 50개 테스트 + UID 경계 테스트 1개 | 51/51 PASS, skip 0 |
| 타입 검사 | PASS |
| 린트 | 오류 0, 기존 RefreshCw 경고 1 |
| 격리 Production build:vercel | PASS |
| Vercel --dry | PASS, 업로드 없이 입력 194개 항목 검사 |
| 금지 경로 및 비밀 패턴/로컬 비밀값 일치 검사 | 발견 0건 |
| 보호 파일 | 46개 SHA-256 동일 |
| git diff --check | PASS |

새 테스트는 미승인 사용자 본인 UID만 반환, admin metadata 무시, 내부 승인 거부 유지, 일반 모드 전환 시 거부, 만료·익명·비로그인 거부를 검증한다. 빌드는 실제 키 없이 integration=false, AUTH_ONLY=true, consent/writes=false로 실행했다. 실제 Google 인증·화면 렌더링 왕복·원격 계정 생성 성공 증거는 아니다. Node 26/macOS 로컬 빌드이며 원격 Node 24/Linux 빌드는 후속이다.

## 남은 위험과 중단 상태

자동화 우회 토큰 1개의 isEnvVar=true 위험과 기존 Production 함수 내부 번들 감사 미완료는 여전히 남는다. 이 변경으로 해결됐다고 판정하지 않는다. OAuth 설정 및 승인 테스터 범위를 확인한 뒤에만 운영 반영한다.

이번 작업은 로컬 코드·테스트·보고서 작성과 읽기 전용 조회/dry run에 한정했다. Commit, Push, 실제 Production 배포, 운영 SQL, Google 파일 쓰기, 실제 최초 사용자 생성은 하지 않고 종료한다.
