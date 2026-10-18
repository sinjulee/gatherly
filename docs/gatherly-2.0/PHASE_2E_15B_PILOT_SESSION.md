# Phase 2E-15B — 서버 승인 실증 회차 분리

2026-10-18 · 로컬 구현/검증 완료. 운영 회차 발급·Vault 접근·환경변수 변경·Google 요청·배포·Commit/Push 없음.

```text
PILOT_SESSION_ISOLATION=PASS_LOCAL
OLD_HISTORY_PRESERVED=PASS
NEW_QUOTA_POLICY=사진/녹음/메모 각 1건, 회차별 고정 operation 및 요청 예산
DUPLICATE_SESSION_GUARD=PASS
GOOGLE_WRITES=FALSE (운영 설정 변경 없음)
TESTS=132_UNIT / 139_HTTP / 12_MOBILE_PASS / TYPECHECK_LINT_BUILD_PASS
DEPLOYMENT=UNCHANGED
```

## 서버 승인 및 생명주기

`lib/gatherly-2/integration/pilot-session.ts`가 서버 승인 설정을 검증하고 최초 요청에서 randomUUID로 회차 ID와 종류별 원격 operation ID 3개를 생성한다. 브라우저는 승인 ID·기간·환경·사용자를 설정하지 못한다. 세션 인증 및 Production 승인 목록에 더해 기존 단일 쓰기 UID를 검사한다.

서버 전용 신규 설정(이번에는 어느 환경에도 등록하지 않음):

| 변수 | 의미 |
| --- | --- |
| GATHERLY_V2_PILOT_APPROVAL_ID | 운영자가 명시적으로 승인한 회차 발급 건의 UUIDv4. 실제 회차 ID와 다름 |
| GATHERLY_V2_PILOT_STATE | open일 때만 회차 시작·업로드 가능. 누락/다른 값이면 차단 |
| GATHERLY_V2_PILOT_STARTS_AT | 승인 시작 시각. ISO UTC 권장 |
| GATHERLY_V2_PILOT_ENDS_AT | 승인 종료 시각. 시작 이후여야 하며 종료 시각부터 전송 거부 |

설정 누락, 잘못된 UUID/날짜, 시작 전, 종료 후, 다른 사용자/환경은 거부한다. 승인 ID 교체는 추가 실증 한도를 허용하는 운영 행위이므로 별도 승인이 필요하다. 클라이언트 요청만으로 교체할 수 없다.

`POST /api/v2/storage-test/session?action=open`은 기존 소유자별 Vault lease 안에서 승인 ID를 키로 회차를 한 번만 저장한다. 같은 승인으로 다시 호출하면 동일 ID/operation/사용량을 반환한다. 기간을 바꿔 기존 회차를 연장·재설정하려 하면 CONFLICT다. 저장 실패 시 발급 성공을 반환하지 않는다. 실제 다중 함수의 직렬화와 revision fencing은 기존 Vault RPC lease 계약을 그대로 이용한다.

`action=close&sessionId=...`는 현재 승인 회차를 영구 CLOSED로 기록한다. 반복 종료는 멱등이며 원본/한도/ledger를 삭제하지 않는다. 종료된 회차에 open을 반복해도 새 회차가 생기거나 OPEN으로 돌아가지 않는다. 기한 만료는 요청 시 서버가 검사하므로 클라이언트 시계를 바꿔 우회할 수 없다. 진행 중인 Vault 작업과 종료는 같은 lease로 직렬화한다. 이미 진행 중인 Google 요청을 취소했다고 간주하지 않으며 종료 후 후속 청크/재시도는 거부한다.

`action=history`는 승인된 본인에게 기존 승인 회차의 공개 메타데이터만 반환한다. UI는 readOnly 보관 모드로 열어 실제 OPEN/CLOSED 상태와 보관 화면의 전송 금지를 구분한다. OAuth 토큰·암호문·파일 ID·원격 내용은 반환하지 않는다. 과거 회차의 로컬 자료는 기기에 남아 있는 경우 열 수 있다. 이미 사용자가 삭제한 원본을 복원하지 않는다.

**회차 준비·종료·목록 API는 Google 파일 쓰기와 별개다.** 파일 쓰기 false여도 승인된 사용자가 회차 메타데이터를 저장/확인할 수 있도록 했다. Vault claim/release와 저장이 있으므로 이 API를 운영의 순수 읽기 전용 검사라고 부르면 안 된다. 이번에는 fixture에서만 실행했다. 페이지를 열었다고 자동으로 회차를 발급하거나 목록 API를 호출하지 않는다.

## 데이터·한도·중복 방지

기존 `VaultData.pilot`을 그대로 보존하고 optional `pilotSessions[approvalId]`에 신규 데이터만 추가한다. SQL 스키마·RPC·암호화 키를 바꾸지 않는다. 과거 slot, resource, record ledger, operation, 요청 카운터를 초기화하거나 새 회차에 복사하지 않는다.

새 회차의 각 종류는 서버 발급 operation ID만 허용한다. 다른 회차/과거 ID 또는 임의 ID는 Google 호출 전에 CONFLICT다. 브라우저의 새 로컬 자료 ID와 원격 operation ID는 구분하며, 동일 회차·종류의 원격 ID는 재시도 동안 고정한다. 기존 normalized 행사/기업 ID와 서버 operation ID/revision이 mutation을 구성한다. 새 ID가 회차별로 달라 이전 mutation과 섞이지 않는다. 브라우저는 이전 DB의 자료를 자동 이관하거나 다시 전송하지 않는다.

기존 reservePilot 정책을 회차별 data에 적용한다:

- 사진 1건/녹음 1건/메모 1건. 같은 종류의 다른 payload/hash로 교체 불가.
- 사진·녹음 각 5MiB, 메모 500자, 청크 1MiB 제한 유지.
- 업로드 요청 30, Google 요청 240, 재조회 10. 실패/재시도도 기존처럼 예산을 소비하며 환불/초기화하지 않는다.
- 동일 slot·동일 payload의 재시도는 기존 파일 ID/고정 Sheets 행/ledger를 사용한다. 회차를 다시 열어도 남은 예산은 그대로다.

Google 자원 namespace는 기존 `production:<owner>:storage-test-v1`을 유지하고 **신규 회차만** 뒤에 서버 회차 ID를 붙인다. 새 회차의 root 이름에는 회차 식별용 짧은 표시가 추가된다. root/행사 폴더/Sheets/미디어 폴더의 gatherlyKey와 새 ledger가 회차별로 분리된다. 기존 Google 테스트 구조를 재사용·덮어쓰기하지 않고 신규 회차 전용 구조를 사용한다. 같은 회차의 반복 요청에서는 같은 자원 marker/ledger를 재사용한다. 생성 응답 유실 pending 상태에서 무조건 재생성하지 않는 기존 정책도 유지한다.

이는 승인 후 신규 Google 구조가 생성될 수 있는 **코드**이며, 이번에 실제 폴더·파일·Sheets는 만들지 않았다. 기존 실패 결과와 운영 한도 소진 여부는 여전히 UNKNOWN이다.

## 화면과 로컬 보존

`PilotSessions`가 기존 회차, 서버 승인 회차, 이전 승인 회차 보관 보기를 구분한다. 기존 DB 이름은 바꾸지 않고 새 회차에만 `gatherly-v2-<environment>-pilot-<server-session-id>-storage-test` DB를 사용한다. 자동 마이그레이션·기존 DB 초기화는 없다.

기존 회차는 원격 재전송을 막고 기존 수집/삭제 기능을 유지한다. 신규 회차는 별도 DB에서 준비하며 업로드 API에 회차 ID와 서버 발급 operation을 전달한다. 기존 삭제 표식은 이전 DB에 남고 새 회차를 발급받아도 과거 queue가 복원되지 않는다. 공유 사용자 Web Lock과 삭제 후 늦은 응답 방어는 그대로다. 사용자 확인이 완료된 삭제 코드/정책/회귀 테스트는 수정하지 않았다.

Google Writes=false는 새 회차가 있어도 최우선으로 업로드를 차단한다. UI 버튼과 서버 requireWrites 게이트를 모두 유지한다. 보관/종료 회차는 원격 전송 버튼이 비활성이다. iPhone 터치 48px, 세로 액션 간격, Safe Area를 유지한다.

## 변경 파일

- 신규: `lib/gatherly-2/integration/pilot-session.ts`, `app/api/v2/storage-test/session/route.ts`, `components/gatherly-2/pilot-sessions.tsx`, `tests/pilot-session.test.ts`.
- 수정: `app/api/v2/storage-test/route.ts`, `app/v2/storage-test/page.tsx`, `components/gatherly-2/pilot-actions.tsx`, `lib/gatherly-2/integration/pilot-browser.ts`, `pilot-storage.ts`, `vault.ts`, `write-access.ts`.
- 검사 확장: `scripts/tests/pilot-gate-http.mjs`, `scripts/tests/v2-mobile-browser.mjs`.
- 기존 `.gitignore`와 미추적 보고서는 보존했다. Git index/브랜치/HEAD 변경 없음.

## 검증 결과와 한계

- 단위 **132/132 PASS**: 기존 124 + 회차 8개. 승인·기한·UID, 반복/동시 open, 과거 state 보존, 위조 회차/operation, immutable 한도·실패 예산, 종료/기간변경, 저장 실패, 자원 marker 분리/재사용, 브라우저 DB/삭제 표식 보존과 서버 operation 매핑 포함.
- HTTP **139 PASS**: 기존 동의 off/on 각 56, 확장 pilot 정책 22, Google Writes=false 상태의 회차 준비·중복 open·업로드 선차단·종료 5. 401/403/400/409 및 종료 후 거부, 보관 목록 포함. 외부 Google 요청 0건.
- 모바일 **12화면 PASS**: 320/375/390/430px, 서버 회차 열기 후 수집·삭제 취소/확인·실패 진단·새로고침/이어가기·중복 차단, 48px 터치/Safe Area. Chrome 모바일 모의이며 실제 iPhone Safari 확인은 이후 필요하다.
- 타입 검사 PASS, 린트 오류 0/기존 RefreshCw 미사용 경고 1, 격리 production build PASS(build Google Writes=false).
- 초기 검사에서 테스트의 dynamic fake-indexeddb import 타입 오류, UI 함수명 충돌, render 중 Date.now 린트 오류를 수정했다. 기한 UI 갱신은 effect 타이머로 처리한다. 기존 페이지 문구를 기대하던 HTTP 검사는 회차 선택 화면에 맞게 갱신했다. 최종 전체 재검사 통과.
- 보호 자료 46/46 해시 일치. 실제 iPhone DB/Google/운영 Vault를 건드리지 않았다. 제품 삭제 파일 3개 및 삭제 단위 테스트의 Git diff가 비어 있음을 확인했다.

운영 적용 전에는 코드 검토·별도 배포 승인, 단일 UID 유지 확인, 서버 승인 ID/기간/state 설정과 **회차 메타데이터 저장 승인**이 필요하다. 파일 실증에는 별도의 Google Writes 활성화 및 같은 승인 커밋의 false 복귀 계획이 추가로 필요하다. 이번 작업은 이 설정이나 실제 회차를 발급하지 않고 종료한다.
