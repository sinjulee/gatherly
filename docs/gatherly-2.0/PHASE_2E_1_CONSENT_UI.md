# Phase 2E-1 — Google Drive·Sheets 별도 동의 UI

작성일: 2026-10-17. 기준: `PHASE_2E_GOOGLE_CONSENT_READY.md`.

**로컬 구현 완료. 운영 환경변수·배포·실제 Google 동의·파일 쓰기는 실행하지 않았다.**

## 사용자 흐름

1. 기존 Google 로그인과 `/v2/auth-complete`의 본인 UID 확인을 유지한다. 이 화면에 `/v2` 연결 화면으로 가는 링크를 추가했다. UID 확인은 권한 자동 부여가 아니다.
2. `/v2`는 기존 `session()`으로 getUser와 서버 환경별 승인 목록을 검사한다. 통과한 사용자에게만 `Google Drive·Sheets 연결` 버튼을 표시한다. AUTH_ONLY=true에서도 카탈로그/Vault 조회 없이 표시한다.
3. consent=false이면 버튼은 disabled이고 설정 준비 중임을 안내한다. consent=true이면 파일 writes=false여도 버튼을 사용할 수 있다.
4. 버튼은 기존 **POST `/api/v2/google/connect`** 폼이다. 같은 탭으로 Google 동의 화면에 이동한다. popup, client fetch, localStorage 토큰 저장에 의존하지 않는다.
5. `/api/v2/google/callback`이 처리 결과에 따라 한국어 HTML을 직접 반환한다. 결과 화면에는 `/v2` 복귀 링크가 있다.

## 결과 표시와 보안

| 결과 | 표시/처리 |
|---|---|
| 동의·토큰 저장·잠금 해제 성공 | “Google Drive·Sheets 연결 완료”, 연결 정보 암호화 저장 완료 안내 |
| access_denied | state 검증·소비·저장 후에만 취소 안내. 새 토큰을 교환/저장하지 않으며 기존 oauth 값 유지 |
| state 만료/재사용/위조 또는 승인 실패 | 403 요청 확인 불가 안내; 저장 성공으로 표시하지 않음 |
| 세션 없음/만료 | 401 로그인 필요 안내 |
| 설정/동의 게이트 비활성 | 503 연결 준비 중 안내 |
| Google 인증/필요 scope 확인 실패 | 재인증 안내 |
| Vault 저장·잠금 해제·네트워크 등 불확실 실패 | 저장 완료를 확인하지 못했다는 안내. 미저장이라고 단정하지 않음 |

성공 여부를 쿼리스트링에서 읽지 않는다. `?success=true`로 완료 화면을 만들 수 없으며, 콜백에서 `completeGoogleConsent()`가 최종 완료 결과를 반환해야 성공을 표시한다. 기존에 저장된 연결의 실시간 상태를 보여주는 대시보드를 추가한 것은 아니다. 새로고침으로 callback을 재사용하면 단일 사용 state 검사에서 거부될 수 있으므로 결과 화면에서 복귀 링크를 이용한다.

OAuth code/state/provider error/사용자 UID/토큰을 HTML에 삽입하지 않는다. 고정된 한국어 문구만 렌더링하고 private,no-store 및 no-referrer, CSP frame-ancestors 'none' 등 응답 헤더를 적용한다. 브라우저 native form의 Accept:text/html 오류는 HTML로, 기존 JSON 클라이언트 오류는 기존 failure() JSON으로 유지한다. 성공 callback 응답은 과거 303 `/v2` 이동에서 결과 HTML 200으로 변경했다.

기존 callback의 고정 Origin 검사는 유지했다. connect에도 동일한 고정 Origin 검사를 추가했으며 sameOrigin CSRF, session/allowlist, PKCE S256, 10분 단일 사용 state, namespace/UID Vault 격리는 유지한다. 거절 응답도 유효한 state 없이 신뢰하지 않는다. 실제로 거절한 경우 state 제거를 저장하므로 거절 처리에도 Vault 쓰기는 발생하지만 새로운 Google 토큰은 저장하지 않는다.

## 파일 쓰기와 분리

requireConsent는 integration+consent, requireWrites/withGoogle는 integration+writes를 검사하는 기존 구조를 유지했다. consent=true/writes=false에서 동의와 암호문 저장이 가능하다. 실제 사진·녹음·메모 생성 API의 쓰기 게이트는 변경하지 않았다. 연결 과정에서 파일 생성은 하지 않는다. 재연결 시 기존 resource가 있으면 기존 소유권 메타데이터 조회가 발생할 수 있다.

Production의 writes 변수를 변경하지 않았으며 로컬 HTTP 검증도 false로 유지했다. 모든 데이터 기능을 AUTH_ONLY로 차단한다는 의미는 아니다. 실제 기업/지도 공개는 기존 서버 승인·RLS·파일 제외 정책을 계속 따른다.

## 모바일 Safari 대응

- 표준 HTML form POST → 303 Google → GET callback의 같은 탭 흐름으로 구현했다. 팝업 차단 및 비동기 window.open 문제를 피한다.
- 버튼/링크 최소 48px, 연결 버튼 가로 전체, 모바일 viewport, 한국어 문구와 아이보리/딥그린 사용.
- 결과 페이지는 JavaScript 없이 읽고 복귀할 수 있으며 외부 이미지/스크립트를 로드하지 않는다.
- 실제 iPhone Safari 및 Vercel 보호를 통과한 Google 복귀는 미실행이다. 후속 승인 시 동일 브라우저의 로그인 세션 유지, 동의 완료/거절, 뒤로 가기·새로고침·만료·재연결을 실기기에서 확인해야 한다. 호환성을 구현했다고 실제 Safari 인증 성공을 확정하지 않는다.

## 변경 파일

- `app/v2/page.tsx`: 승인 완료 후 연결 컴포넌트 표시, AUTH_ONLY 경로 지원.
- `app/v2/auth-complete/page.tsx`: 연결 화면 이동 링크.
- `components/gatherly-2/google-connection.tsx`: 서버 렌더링 연결 버튼·설정/파일 쓰기 상태 안내.
- `app/api/v2/google/connect/route.ts`: 고정 Origin 검사·브라우저 오류 안내.
- `app/api/v2/google/callback/route.ts`: 검증된 완료/거절 결과 HTML.
- `lib/gatherly-2/integration/runtime.ts`: connected/declined 결과 반환, 거절도 state 소비 후 처리.
- `lib/gatherly-2/integration/consent-response.ts`: 정적 안전 문구와 결과 응답.
- `tests/consent-ui.test.ts`: 결과/오류/Origin/거절/기존 토큰 보존/교차 사용자/동의 성공 테스트.
- `scripts/tests/auth-gate-http.mjs`: 승인 전용 UI와 consent true/false HTTP 검증 확장.
- 이 보고서.

기존 미커밋 SQL·Vault/Google 수정·문서는 덮어쓰거나 되돌리지 않았다.

## 검증

- 기존 62개 + 신규 3개 = **65/65 테스트 PASS**, skip 0.
- 타입 검사 PASS. 린트 오류 0, 기존 RefreshCw 미사용 경고 1. 변경 파일을 포함한 격리 `build:vercel` PASS.
- localhost 인증 fixture와 실제 Next.js 라우트로 consent=false/true 각각 33개 HTTP 검사. 승인 사용자만 연결 폼 표시, disabled 상태 전환, 미승인/위조 세션 폼 미표시, 거짓 성공 쿼리 무시, 파일 쓰기 DISABLED 확인. Google 실설정은 주입하지 않아 활성 모드에서도 실제 동의/외부 토큰 요청은 수행하지 않는다.
- 단위 테스트에서는 가짜 Google token 응답만 사용해 writes=false 상태의 state 소비·암호화 저장·connected 결과를 확인했다. 다른 사용자 callback 및 거절 재사용은 거부된다. 실제 브라우저 Google 동의→운영 Vault 저장의 종단간 검증은 별도 승인 대기다.
- 환경파일·Prisma·storage·backups 46개 해시 일치. 운영 환경변수·SQLite·SQL·실제 Google 자료 변경 없음.

## 다음 단계

필수 Vault/Google 설정과 운영 RLS 확인 → 변경 소스 검토·승인 커밋 → 빈 승인 UUID override 없는 승인 배포 → consent=true/writes=false의 실제 동의 실증 승인 순서다. All Deployments 보호를 유지하며 파일 생성은 별도 승인 전까지 비활성으로 둔다. 이번에는 Commit/Push·배포·실제 동의·Google 파일 쓰기 없이 종료한다.
