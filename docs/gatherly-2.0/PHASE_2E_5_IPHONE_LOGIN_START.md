# Phase 2E-5 — iPhone 로그인 시작 단계 진단

작성일: 2026-10-17. 대상: https://gatherly-three-umber.vercel.app

**관측된 iPhone 요청은 로그인 POST에서 303을 받은 뒤 앱 callback에서 401로 실패한다. 로그인 시작 차단으로 판단하지 않는다.** 다만 callback의 code 누락, PKCE 교환 오류, getUser 오류 중 어느 조건인지는 운영 응답이 모두 UNAUTHORIZED여서 아직 구분할 수 없다. Google 페이지에 실제로 도달했다는 네트워크 증거도 없으므로 PKCE 쿠키 문제로 단정하지 않는다.

## 1. 운영 로그 비교

Gatherly Production의 CDN 요청 로그와 함수 runtime 로그를 읽기 전용 조회했다. 현재 배포 한정 조회 후, PC 비교를 위해 Production 전체의 최근 12시간을 조회했다. 최대 100건 조건이며 완전한 장기 감사 로그는 아니다. clientUserAgent는 원문을 출력하지 않고 iPhone/Chrome/unknown으로 분류했다. 사용자 식별자·IP·쿠키·query·OAuth code/state/verifier·토큰·로그 본문을 출력하거나 저장하지 않았다. 아래 시간은 모두 **2026-10-17 KST**다.

| 기기 분류 | 시간 | 요청 | 상태 | 배포 |
|---|---|---|---|---|
| Chrome | 18:20:00.132 | POST /api/v2/auth/login | 303 | 이전 Production |
| Chrome | 18:20:09.220 | GET /api/v2/auth/callback | 303 | 이전 Production |
| Chrome | 18:20:10.244 | GET /v2/auth-complete | 200 | 이전 Production |
| iPhone | 21:46:37.590 | POST /api/v2/auth/login | 303 | 현재 Production |
| iPhone | 21:46:50.170 | GET /api/v2/auth/callback | 401 | 현재 Production |
| iPhone | 21:56:24.051 | POST /api/v2/auth/login | 303 | 현재 Production |
| iPhone | 21:56:26.084 | GET /api/v2/auth/callback | 401 | 현재 Production |
| iPhone | 22:05:59.988 | POST /api/v2/auth/login | 303 | 현재 Production |
| iPhone | 22:06:01.970 | GET /api/v2/auth/callback | 401 | 현재 Production |
| iPhone | 22:06:12.664 | GET /api/v2/auth/callback | 401 | 현재 Production |

이 표의 요청은 모두 대표 host다. 현재 배포는 dpl_9y6MM7bFRYfmDSV6bNQsdwBj7Va1 / 커밋 ec3a46f0ab760daa7648d5cb34cc059be6bbf3a7이다. 과거 Chrome의 다른 Origin 403 및 도구 요청은 현재 iPhone 실패와 혼합하지 않았다.

시간상 인접한 요청을 묶은 것이며 사용자 식별자를 이용한 세션 상관분석은 하지 않았다. iPhone 분류만으로 Safari와 앱 내부 WebView를 확정하지 않는다. PC 성공 기록은 이전 배포이고, 현재 배포에서 PC의 기존 세션으로 Drive 동의가 성공했다는 것은 사용자 확인이다. 현재 배포에서 PC의 완전히 새로운 로그인도 성공했다고 로그로 입증한 것은 아니다.

인증 경로 필터의 runtime 로그는 반환 항목이 없었다. 기존 코드가 오류를 응답으로 처리하고 원본 오류를 로깅하지 않으므로 runtime 로그 부재로 인증 성공을 판정하지 않는다.

## 2. 다섯 단계별 판정

1. **Vercel Authentication**: 기존 All Deployments 유지. 관측된 iPhone 로그인 POST 303과 callback 401은 앱 흐름에 도달한 증거다. 보호가 모든 실패의 원인이라는 근거는 없다. 전체 외부 redirect chain에서 보호 화면 재등장 여부는 실기기 관측이 필요하다.
2. **Gatherly login**: 세 차례 POST 303 확인. 이 요청들에서는 strict Origin/대표 host 검사를 통과했다. 승인 UUID는 시작 조건이 아니다.
3. **signInWithOAuth**: 현재 코드에서 정상 data.url이 있어야 303이다. 설치 SDK는 이 단계에서 PKCE verifier/challenge와 Supabase authorize URL을 준비한다. 이 호출의 성공은 Google 인증 완료 또는 Google 페이지 방문 증거가 아니다.
4. **Google 인증 페이지 이동**: Vercel 로그에는 Supabase/Google 도메인의 요청이 없다. 계정 선택 화면이 없다는 사용자 관측은 존중하되, Google에 전혀 방문하지 않았다고도 단정하지 않는다. Supabase의 provider 설정 오류/거절 redirect 또는 기존 Google 세션의 빠른 인증 가능성을 구분해야 한다.
5. **앱 callback**: iPhone GET 401 확인. 현재 운영 코드의 code 없음, exchangeCodeForSession 오류, verifiedUser 실패가 모두 같은 UNAUTHORIZED다. 단계 5에서 실패 응답이 발생한 것은 확인했지만 **PKCE 교환까지 실행됐는지 자체도 미확정**이다. 예를 들어 Supabase가 error만 반환해 code가 없으면 교환 전에 401이다.

## 3. 구현·쿠키·보안 검토

- 로그인 UI는 native form POST `/api/v2/auth/login`이다. GET으로 직접 여는 경로는 구현하지 않았으며 로컬 HTTP에서 405를 확인했다. 과거 Vercel 보호가 반환한 GET 302를 로그인 API 성공으로 해석하지 않는다.
- POST는 Origin이 APP_ORIGIN과 정확히 일치하고 요청 host도 대표 Origin이어야 한다. Referer는 요구하지 않는다. Origin 누락/null/외부 Origin은 403이며, Referer 또는 Sec-Fetch-Site가 같은 출처라고 해도 대체 신뢰하지 않는다. 이번 iPhone POST는 303이므로 이 검사 완화로 해결하려 하지 않는다.
- 정상 signInWithOAuth 후 303 Location은 Supabase authorize URL이다. Next Route Handler의 cookies().set을 통해 SDK verifier Set-Cookie가 같이 전달된다. 로컬 실제 HTTP 검사에서 Location, PKCE challenge, verifier 쿠키, callback 세션 쿠키와 삭제를 확인했다.
- SDK 기본 쿠키: 호스트 전용, Path=/, SameSite=Lax, HttpOnly=false, Secure 명시 없음. 기존 설정을 변경하지 않았다. Secure 명시 등 별도 보완 검토를 Safari 실패 해결로 포장하지 않는다.
- callback GET은 교차 사이트 복귀라 Origin/Referer가 없어도 허용한다. 대신 대표 host, code 및 SDK PKCE, getUser를 검사한다. 실제 HTTP에서 Origin/Referer 없는 callback에 Safari UA를 사용해 성공을 검증했다.
- proxy의 canonical redirect는 GET/HEAD /v2와 /v2/auth-complete에만 적용하며 code/POST를 다른 Alias로 넘기지 않는다. Phase 2E-4 읽기 확인에서 두 Alias는 같은 현재 배포이며, 이번 iPhone 관련 로그도 모두 대표 주소였다. 외부 OAuth chain의 다른 host 방문 여부는 별개다.
- Vercel 인증 쿠키와 Supabase 앱 쿠키는 별개다. 보호를 해제하거나 새 bypass token을 만들어 진단하지 않는다. 브라우저 컨텍스트 전환·쿠키 소실·provider 거절·code 만료 중 원인을 추가 관측해야 한다.

## 4. 필요한 최소 수정 — 로컬만

근본 원인이 확인되지 않아 인증 정책을 변경하지 않았다. Phase 2E-4의 callback 진단을 보존하고 **로그인 시작 응답에 고정된 단계 헤더만 추가**했다.

- `app/api/v2/auth/login/route.ts`: X-Gatherly-Auth-Stage = login_origin / login_client / oauth_start / oauth_redirect. 기존 실패 JSON과 상태 코드는 유지한다. no-store 및 no-referrer를 명시한다.
- 정상 redirect는 헤더를 추가할 수 있는 Response(null, {status:303, headers:{Location}})로 구성했다. 원래 Response.redirect의 immutable 헤더를 수정하지 않는다. 검증된 SDK URL을 그대로 사용한다.
- `tests/auth-origin.test.ts`: 진단 단계와 Origin 누락/null/외부 Origin을 Referer/Fetch Metadata로 우회하지 못하는 테스트 추가.
- `scripts/tests/auth-gate-http.mjs`: 정상 303 진단 헤더, GET 405, Origin 누락·위조 403 및 Set-Cookie 미발급 검사 추가.

이전 Phase 2E-4의 auth/diagnostics.ts, callback 수정 및 테스트도 여전히 로컬 미커밋 상태다. Production에는 이번 단계 헤더나 callback의 stage/reason이 아직 없다. 비밀값이 포함될 수 있는 provider message/Location 전체/SDK debug를 로깅하지 않는다. 이 변경은 관측성을 보완하며 iPhone 오류 수정 완료를 뜻하지 않는다.

## 5. 검증 결과

| 검증 | 결과 |
|---|---|
| 단위 테스트 | 68/68 PASS, skip 0 |
| 실제 Next 로컬 HTTP | consent=false/true 각각 43건, 총 86건 PASS |
| 정상 시작 | POST 303 + Supabase authorize URL + challenge + verifier Set-Cookie |
| 콜백 왕복 | verifier 전달/검증 → 세션 쿠키 → UID/연결 화면 200 |
| 보안 | GET 405, 누락/null/잘못된 Origin 403, callback 잘못된 host 거부, verifier 누락/소비 후 재사용 차단 |
| state | 기존 별도 Drive 동의 state 검증·교차 사용자·재사용 차단 테스트 유지. Google 로그인 upstream state는 Supabase 담당이며 로컬 Google 제공자 전체를 재현한 것은 아님 |
| PC 회귀 | 기존 정상 SDK/HTTP 흐름 및 서버 승인 목록/미승인 차단 테스트 유지 |
| Safari 모의 | Safari UA 및 교차 사이트 GET 헤더, Origin/Referer 없는 callback 성공. 실제 WebKit/ITP 실험은 아님 |
| 타입 검사 | PASS |
| 린트 | 오류 0, 기존 RefreshCw 경고 1 |
| 격리 build:vercel | PASS, 변경 login/callback/helper 포함 |
| 보존 | 환경파일·Prisma·storage·backups 46개 해시 일치. HEAD 유지 |

실제 Google 파일 쓰기, OAuth 동의, SQL 변경, Vault 초기화, 환경변수 변경, 보안 해제, Git Commit/Push, Production 배포는 수행하지 않았다.

## 6. 실기기 재검증 절차

1. PC와 iPhone 각각 동일 대표 /v2에서 시작하고 한국 시간 및 브라우저 종류를 기록한다. PC 기존 세션 성공과 최초 로그인 성공을 구분한다.
2. Vercel Authentication 통과 후 같은 브라우저에서 Google 로그인 버튼을 누른다. native POST인지 확인한다. Safari에서 시작한 흐름을 앱 내부 브라우저로 중간 전환하지 않는다.
3. Mac Safari Web Inspector 또는 안전한 수기 관측으로 **host/path/status와 쿠키 존재 여부만** 기록한다. Supabase authorize → Google host → Supabase callback → 앱 callback 중 실제 도달한 단계가 필요하다. query/HAR/쿠키 원문/Authorization/UID는 공유하지 않는다.
4. callback에는 code가 있는지 또는 provider error가 있는지 **존재 여부만** 확인한다. 값은 복사하지 않는다. code 없음이면 provider 거절/설정/redirect부터 확인하고 PKCE 쿠키 변경부터 하지 않는다.
5. 향후 진단 배포가 별도 승인되면 login 응답의 X-Gatherly-Auth-Stage와 callback JSON의 stage/reason만 수집한다. callback_code라면 교환 전, session_exchange라면 PKCE/토큰 교환, user_verification이면 교환 후 getUser로 좁힌다.
6. verifier 쿠키가 시작 응답에 있었는지, callback 요청에 전달됐는지를 boolean으로 확인한다. callback 새로고침을 재로그인으로 사용하지 말고 /v2에서 새 흐름으로 시작한다.
7. PC Chrome 최초 로그인 재검증 및 미승인 사용자 차단을 함께 확인한다. Google 파일 쓰기는 계속 false다.

**최종 판정:** 관측된 실패 위치는 앱 callback. iPhone POST 시작 단계의 실패 증거는 없으며 정상 303이 확인됐다. callback 내부 원인 및 Google 도메인 방문 여부는 추가 실기기 증거가 필요하다. 현재 근거로 Origin/PKCE/승인 목록 보호를 완화할 이유는 없다.
