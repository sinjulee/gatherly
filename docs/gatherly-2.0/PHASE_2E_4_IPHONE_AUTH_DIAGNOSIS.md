# Phase 2E-4 — iPhone Safari 최초 Google 로그인 진단

작성일: 2026-10-17. Production: https://gatherly-three-umber.vercel.app/v2

**실패 응답의 코드 경로는 확인했으나 iPhone 실기기의 근본 원인은 아직 미확정이다.** PC Chrome에서 로그인·동의·Vault 저장 성공은 사용자 확인이다. 로컬에서는 PKCE 쿠키가 없는 callback의 동일한 UNAUTHORIZED를 재현했고, 정상 쿠키 왕복은 통과했다. 기기별 쿠키/redirect 관측 없이 Safari 정책 탓이라고 단정하지 않는다.

이번 수정은 실패 단계가 합쳐지는 진단 문제를 최소 범위로 보완했다. 인증·쿠키 정책을 추측으로 변경하지 않았다. Production 배포·환경변수 변경·Commit/Push·SQL 변경·Vault 초기화·Google 동의·파일 쓰기는 수행하지 않았다.

## 실제 인증 순서와 실패 조건

| 단계/경로 | 실제 검사 순서와 응답 |
|---|---|
| proxy.ts | 공개 레거시/원본 자산 차단 → V2 GET 페이지의 대표 Origin 정규화 → Supabase getUser로 세션 refresh. 각 API에서 권한 재검사 |
| POST /api/v2/auth/login | sameOrigin → requireAppOrigin → integration/environment → serverClient → signInWithOAuth(google, PKCE) → 303 Supabase. 승인 UUID/기존 세션 요구 없음 |
| Supabase Google OAuth | Google 인증 및 Supabase 측 state 처리 → 설정된 앱 /api/v2/auth/callback로 code 전달 |
| GET /api/v2/auth/callback | 대표 Origin → code 존재 → serverClient → exchangeCodeForSession → verifiedUser(getUser) → loginDestination → 303 /v2/auth-complete |
| /v2/auth-complete | integration+AUTH_ONLY+environment → getUser → 본인 UID만 표시. 실패하면 /v2로 이동. 승인/관리자 자동 부여 없음 |
| /v2와 내부 API | session에서 getUser → environmentUser 승인 목록. 미승인 사용자는 FORBIDDEN. 동의 시작도 승인 검사를 통과해야 함 |

정확한 UNAUTHORIZED 발생 위치:

- `app/api/v2/auth/callback/route.ts`: code 없음 또는 exchangeCodeForSession 오류 → 401.
- `lib/gatherly-2/auth/server.ts::verifiedUser`: getUser 오류, user 없음, anonymous 사용자 → 401. callback 및 내부 API의 session에서 사용한다.
- 로그인 POST의 Origin 불일치는 403 FORBIDDEN이며 Referer는 검사하지 않는다. integration/environment/필수 설정 누락은 503 DISABLED다. 정상 로그인 시작 코드에서 승인 목록 부족으로 UNAUTHORIZED를 반환하지 않는다.
- `/v2`는 인증 실패를 로그인 화면으로 표시하고 UID 페이지는 실패 시 redirect한다. JSON UNAUTHORIZED가 보였다면 정확한 API 경로 확인이 우선이다.

## 운영 읽기 전용 증거

- 두 Alias `gatherly-three-umber.vercel.app`, `gatherly-shmlucy07-7077s-projects.vercel.app` 모두 `dpl_9y6MM7bFRYfmDSV6bNQsdwBj7Va1`에 연결돼 있다.
- 프로젝트 All Deployments: `deploymentType=all` 유지.
- 최근 6시간 Production 요청 집계(최대 100개/경로): login 303 10건·403 7건, callback 401 3건·303 1건·302 1건, auth-complete 200 1건·307 4건.
- 집계는 기기/사용자/이번 재현 시각에 한정되지 않았으므로 401 3건이 모두 iPhone이라고 주장하지 않는다. 403은 Origin 실패와 일치할 수 있지만 본문·기기별 대조 없이 원인을 확정하지 않는다.
- 요청 쿼리, 쿠키, code/state, 토큰, UID, 로그 본문은 출력하지 않았다. 새 보호 우회 토큰도 생성하지 않았다.

## 쿠키 생성·전달·삭제

현재 `@supabase/ssr` 0.12.7의 DEFAULT_COOKIE_OPTIONS:

| 속성 | 현재 코드의 실효 설정 |
|---|---|
| Path | / |
| Domain | 미지정 → 호스트 전용 |
| SameSite | lax |
| HttpOnly | false |
| Secure | 기본 옵션/앱에서 명시하지 않음 |
| Max-Age | SDK 기본 400일; 실제 인증 유효기간은 토큰/서버 세션 검사와 별개 |

`runtime`의 Vault 토큰과 이 Supabase 로그인 쿠키는 별개다. Vault를 초기화하거나 Google 파일 쓰기를 켜도 첫 로그인 쿠키 문제는 해결되지 않는다.

로그인 시작 시 SDK가 code-verifier 쿠키를 즉시 setAll로 쓰고 Next cookies().set이 redirect 응답에 반영한다. callback은 브라우저가 보낸 쿠키로 verifier를 읽어 code를 교환한다. 성공 시 verifier 삭제(Max-Age=0)와 세션 쿠키 저장이 발생한다. 재사용/쿠키 없는 교환은 거부한다. SDK는 실패 종류에 따라서도 verifier를 정리하므로 실패한 callback URL을 새로고침해 재시도하지 말고 /v2에서 새 로그인으로 시작한다.

서버 컴포넌트의 쿠키 쓰기 제한 때문에 serverClient의 setAll은 예외를 catch한다. 이는 실제 쓰기 실패를 가릴 가능성은 있지만 이번 로컬 Route Handler 왕복에서는 Set-Cookie가 정상 전달됐다. 이를 iPhone 원인으로 확정하지 않았다.

Supabase 공식 안내는 SSR PKCE 및 Lax를 설명한다. HttpOnly=false는 SDK 기본이며 임의로 true로 바꾸거나 SameSite=None으로 완화하지 않았다. Secure 명시 여부는 별도 보안 보완 검토 사항이며 현재 iPhone 오류의 입증된 원인은 아니다. [Supabase SSR 안내](https://supabase.com/docs/guides/auth/server-side/advanced-guide)

## Vercel 보호·Alias·브라우저 경계

Vercel Authentication은 앱 실행 전의 보호 계층이다. Vercel 로그인 쿠키와 Supabase 앱 쿠키는 서로 대체하지 않는다. callback에 Vercel 인증이 개입하거나 다른 브라우저 컨텍스트로 이동하면 code 지연/쿠키 미전달 가능성을 확인해야 한다. 보호를 해제하거나 우회 토큰을 생성해 해결하지 않는다.

proxy는 /v2, /v2/auth-complete의 GET/HEAD가 다른 Origin이면 대표 Origin의 /v2로 이동한다. OAuth code/임의 next/POST body는 다른 Alias로 전달하지 않는다. 로그인 redirectTo는 APP_ORIGIN의 /api/v2/auth/callback이고 callback의 Origin 불일치는 거부한다. 정적 코드와 Alias 연결에서는 새 잘못된 redirect를 발견하지 못했다. 실제 iPhone의 Google/Vercel 왕복 전체 redirect chain은 미수집이다.

Safari에서 직접 시작한 흐름과 앱 내부 브라우저에서 시작한 흐름을 구분해야 한다. 중간에 외부 Safari/다른 탭 컨텍스트로 전환했는지 확인한다. 내부 브라우저와 Safari가 같은 쿠키 저장소를 쓴다고 가정하지 않는다. Safari User-Agent를 보내는 Node 테스트는 Safari의 실제 쿠키 정책/ITP를 구현하지 않는다.

## 로컬 최소 변경

- `lib/gatherly-2/auth/diagnostics.ts`: 고정된 단계 및 SDK 오류 코드만 분류. 외부 오류 message/URL/사용자 ID/쿠키/토큰을 응답·로그로 복사하지 않음.
- `app/api/v2/auth/callback/route.ts`: 기존 상태 코드·검사 순서를 유지하며 JSON에 stage 및 교환 오류의 reason 추가. no-store/no-referrer 적용.
- `tests/auth-diagnostics.test.ts`: 민감 문자열 미노출, 고정 분류, 권한 오류 보존 테스트 2개.
- `scripts/tests/auth-gate-http.mjs`: 실제 Next HTTP 경로의 첫 로그인 → PKCE 쿠키 → callback → 세션 확인·verifier 삭제·재사용 차단 검증 추가.

진단 예시(비밀값 없음):

```json
{"error":"UNAUTHORIZED","stage":"session_exchange","reason":"PKCE_VERIFIER_MISSING"}
```

| stage / reason | 판단 범위 |
|---|---|
| callback_origin | 대표 Origin 검사 실패 |
| callback_code | code 누락; provider 거절/error redirect 여부는 안전하게 별도 확인 |
| session_exchange / PKCE_VERIFIER_MISSING | SDK 저장소에서 verifier를 찾지 못함. 미생성/미전달/삭제/다른 브라우저를 구분하려면 쿠키 존재 여부 관측 필요 |
| session_exchange / PKCE_VERIFIER_REJECTED | verifier 불일치 |
| session_exchange / OAUTH_FLOW_EXPIRED | 교환 흐름 만료 |
| session_exchange / OAUTH_FLOW_NOT_FOUND | 흐름 없음/이미 처리 등 후속 대조 필요 |
| session_exchange / EXCHANGE_REJECTED | 그 외 교환 실패. 원본 provider 메시지는 노출하지 않음 |
| user_verification | 교환 후 getUser 검증 단계 실패 |
| login_destination | 인증 후 목적지/권한 검사 실패 |

진단은 로컬에만 있으며 현재 Production 오류 응답에는 아직 적용되지 않았다. 공개 진단 endpoint, 환경변수 출력, 쿠키/토큰 출력, SDK debug 로그 활성화는 추가하지 않았다.

## 재현 및 검증 결과

- npm test: 기존 65 + 신규 2 = **67/67 PASS**, skip 0.
- typecheck PASS. lint 오류 0, 기존 RefreshCw 미사용 경고 1.
- 수정 callback/helper를 포함한 격리 build:vercel PASS.
- consent=false/true 각각 HTTP 39건, 총 **78건 PASS**. 실제 Google 요청/파일 쓰기 0.
- 새 브라우저 상태에서 로그인 시작의 PKCE challenge 및 Set-Cookie 확인.
- 쿠키를 생략한 callback: 401 + PKCE_VERIFIER_MISSING, 가짜 token endpoint 호출 0.
- 쿠키를 정상 전달하고 Origin/Referer 없는 cross-site GET callback에 Safari UA 전달: 303 UID 화면. fixture에서 SHA-256 challenge/verifier 일치 확인.
- callback 세션 쿠키를 다음 UID/연결 화면에 사용: 200 및 연결 UI 확인. verifier 삭제 및 소비 후 재사용 차단 확인.
- 기존 미승인·위조 사용자, Origin, 승인 목록, writes=false 차단 검증 유지.
- 환경파일·Prisma·storage·backups 46개 현재 기준 해시 일치. HEAD ec3a46f0ab760daa7648d5cb34cc059be6bbf3a7 유지, staging 없음. 기존 .gitignore 수정 등 보존.

## 남은 확인과 다음 조치

현재 사실은 **callback 401 존재 + 여러 실패가 같은 응답에 합쳐짐**이다. PKCE 쿠키 누락은 재현 가능한 후보지만 iPhone 원인으로 확정하지 않았다. 실제 iPhone/앱 브라우저에서 실패하는 URL의 **경로만**, Google 계정 선택 전/후, Vercel 인증 재등장 여부를 먼저 확인한다. code/state 포함 전체 URL은 공유하지 않는다.

Mac Safari Web Inspector를 사용할 경우 네트워크 원문/HAR를 외부로 공유하지 말고 다음 정보만 수기로 기록한다: 단계별 host/path, HTTP status, Set-Cookie 존재 여부와 속성만, callback에 verifier 쿠키가 있는지 여부만, 같은 브라우저에서 끝났는지 여부. 키·쿠키 값·code·state·Authorization·UID는 기록하지 않는다.

후속 로컬 진단 수정 배포를 승인받은 뒤 오류의 stage/reason으로 범위를 좁힐 수 있다. 그 전까지는 새 로그인 시도를 Safari의 대표 /v2에서 같은 브라우저로 끝내고 실패 callback 새로고침을 피한다. 보안 설정/추적 방지를 무작정 끄거나 승인 목록을 완화하지 않는다. PC 성공 경로는 유지하며 실제 iPhone 확인 없이 해결 완료로 판정하지 않는다.
