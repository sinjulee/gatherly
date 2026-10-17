# Gatherly 2.0 — Phase 2C-3A GitHub Preview 커밋 게이트

작성일: 2026-10-17. 대상: GitHub `sinjulee/gatherly`, Vercel `gatherly`, Supabase `gatherly-prod` (`rmjyonrmlbarvtaazurc`).

**COMMIT_READY: YES — 내부 지도 원본과 실데이터를 제외한 비활성 Preview 후보.** Commit 실행은 승인 대기이며 Push·Deploy 승인을 포함하지 않는다. 실제 지도·인증·저장소 연동이 완료된 현장 실증 배포로 판정하지 않는다.

기준: [Phase 2C-2](PHASE_2C_2_SECURITY_IMPLEMENTATION.md), [Phase 2C-1](PHASE_2C_1_DEPLOYMENT_GATE.md), [Phase 2B-2](PHASE_2B_2_VERCEL_READINESS.md). 이번 사용자의 원본 제외 지시에 따라 이전 보고서의 “서버 번들에 지도 포함” 방침을 대체한다.

## CURRENT_BRANCH

- `gatherly-v2-preview`, HEAD `a6b84fd414941518903e23eba9928e83d7bd5ecf` 유지.
- 시작 상태: 추적 파일 수정 6개, 미추적 파일 77개, 스테이징 0개.
- 명시적인 파일 목록으로만 스테이징했다. `master` 이동·브랜치 재작성·reset/clean·Commit·Push는 하지 않았다.
- 최종 스테이징 후보는 이 보고서를 포함한 **78개 파일**이다. 이후 실행 승인은 이 목록과 cached diff를 대상으로 해야 한다.
- 원격 Vercel/GitHub 프로젝트 설정은 이번에 변경하거나 인증 조회하지 않았다. 실제 연결 여부는 다음 외부 작업 전에 확인해야 한다.

## STAGED_FILES

분류: V2 화면/API/어댑터, 필요한 공통 설정·의존성 lockfile, 단위/회귀 테스트, SQL 초안, v0.5 명세와 단계별 검토 문서, 값 없는 환경변수 예제. 기존 icon/Paperlogy 폰트는 이미 추적된 자산이며 이번에 새 바이너리를 stage하지 않았다. 정확한 전체 목록은 부록에 기재했다.

이번 단계의 최소 수정:

- `.gitignore`: 내부 `v0.5_assets/`, 매핑 검토 JSON, `.vercel/` 로컬 상태를 추가 제외했다.
- `.vercelignore`, `next.config.ts`: 내부 원본 자산의 배포 입력·서버 파일 trace 포함을 차단하고 강제 include를 제거했다.
- `/api/v2/map`: 인증 검사 유지. 원본이 없는 경우 `503 MAP_NOT_CONFIGURED`, private/no-store를 반환한다. 로컬 원본은 삭제하지 않았다.
- 로컬 전용 감사 테스트 2개: Git에 포함하지 않는 DB/미디어 또는 지도/검토 JSON이 없는 clean checkout에서는 이유를 명시하고 skip한다. 실제 자료가 있는 현재 작업폴더에서는 모두 실행·통과했다. 다른 오류는 숨기지 않는다.
- `app/v2/page.tsx`: cached diff 검사에서 발견한 EOF 빈 줄만 정리했다.

최초 후보를 stage한 뒤 `git diff --cached --stat`, 파일 목록, 주요 설정/API/test diff와 코드 내용을 검토했다. 원본 강제 include·실제 환경파일·불필요한 루트 이전 문서는 후보에서 제외했다. `git diff --cached --check`의 EOF 경고는 수정했다.

## EXCLUDED_FILES

| 제외 대상 | 처리 |
|---|---|
| `.env`, `.env.local`, 실제 `.env*`, 비밀키·토큰 | Git/배포 제외. 실제 값은 출력하거나 변경하지 않음 |
| SQLite·journal/WAL/SHM·backup, `storage/`, `backups/` | Git/배포 제외, 원래 파일 보존 |
| `.omc/`, `.agents/`, `.codex/`, `.vercel/`, 로그·생성물 | Git/배포 제외 |
| `docs/gatherly-2.0/v0.5_assets/ESG_2026_Official_BoothMap_TitleRemoved_Reference.png` | 내부 원본 지도. Git/배포/서버 trace에서 제외, 로컬 보존 |
| `docs/gatherly-2.0/v0.5_assets/Gatherly_Mobile_BoothMap_Notes_UI_Concept.png` | 내부 참고 이미지. Git/배포 제외, 로컬 보존 |
| `docs/gatherly-2.0/booth-mapping-review.json` | 미승인 내부 검토 자료. Git/배포 제외, 로컬 보존 |
| 루트 `Gatherly_2.0_Development_Kickoff.md`, `Gatherly_2.0_PRD_v0.3.md`, `Gatherly_2.0_SRS_v0.3.md` | 이번 v0.5 실행 후보에 불필요해 미추적 상태로 남김 |

문서·SQL·검증용 JSON 등은 실행용 정적 콘텐츠로 공개하지 않는다. 포함된 SQL은 검토 초안이며 migration 실행 스크립트를 추가하지 않았다. 이전 Git 이력과 레거시 코드 전체를 이번 커밋에서 제거하거나 재작성하지 않는다.

## SECRET_SCAN

**PASS — 검사 범위에서 발견 0건.** 최종 인덱스 전체(기존 추적 파일 + 후보)를 대상으로 검사했다. 실제 값이나 토큰 일부도 결과에 출력하지 않았다.

- 금지 경로: 실제 환경파일, DB, 개인 미디어, 백업, 도구 상태, 내부 자산 경로.
- 본문 패턴: private-key PEM, Google API key, GitHub token, Supabase secret, OAuth refresh token, AWS access-key ID.
- 로컬 환경파일의 비밀 관련 변수 값 3개를 메모리에서만 읽어 인덱스 내용과 정확 일치 검사했다. 값 자체는 로그·보고서·스캔 산출물에 저장하지 않았다.
- 값 없는 `.env*.example`은 별도 허용했다. 공개 Supabase project URL/ID, 가짜 테스트 credential, 변수 이름은 비밀값으로 판정하지 않는다.
- 전체 Git 과거 이력이나 원격 secret store에 대한 전문 감사는 아니다. 휴리스틱/정확 일치 검사가 모든 비밀 형식을 증명하는 것은 아니다.

스캔 요약은 `/private/tmp/gatherly-2c3a-h7n_u76h/`에 값 없이 보관했다. 새 파일 내용이 바뀌면 다시 검사해야 한다.

## STATIC_ASSET_ACCESS

**PASS — 후보에 내부 지도 원본 없음.** 스테이징된 인덱스에서 clean build-source를 추출해 검증했다. 실제 환경파일·SQLite·자료·지도 원본을 복사하지 않았다.

- `.next/static` 파일과 내부 지도 SHA-256 대조: 원본 바이트 일치 0개.
- 빌드 trace 70개 검사: 내부 자산·환경파일·DB·storage/backups 참조 발견 0개.
- 비로그인 map/catalog/voice 호출은 401, 미승인 사용자·쿠키 UUID 위조는 403.
- 원본 docs URL·이전 hashed 정적 지도 URL·이미지 최적화 URL은 404.
- 승인 사용자도 이 후보의 `/api/v2/map`에는 원본이 없어 `503 MAP_NOT_CONFIGURED`를 받는다. no-store 응답을 확인했다. 빈 지도에 실제 좌표가 준비됐다고 간주하지 않는다.

지도 서비스는 승인된 비공개 공급 경로가 마련될 때까지 배포 기능에서 보류한다. 원본을 Git에 다시 넣거나 public 경로로 옮기는 방식으로 해결하지 않는다. 기존 로컬 원본과 기록은 남아 있다. 공식 API·외부 Google 저장은 초기 Preview에서 두 플래그를 false로 유지한다.

## TEST / TYPECHECK / LINT / BUILD

| 항목 | 결과 |
|---|---|
| 로컬 `npm test` | **47/47 PASS**, skip 0. 실제 SQLite·자료·원본 지도 감사 포함 |
| 스테이징 후보만 추출한 복사본 `npm test` | **45 PASS / 2 명시적 SKIP / 실패 0**. 제외된 개인 DB/자료와 내부 지도 감사만 skip |
| `npm run typecheck -- --incremental false` | PASS |
| `npm run lint` | 오류 0, 기존 `RefreshCw` 미사용 경고 1 |
| 후보 `VERCEL=1 VERCEL_ENV=preview GATHERLY_V2_ENVIRONMENT=preview npm run build:vercel` | PASS |
| 후보 HTTP 접근 검사 | PASS: 인증/UUID 위조/이미지 직접 URL 차단, 지도 미설정 503 |
| `git diff --cached --check` | PASS |

후보 빌드: `/private/tmp/gatherly-phase1-2c3a-ez3n6sm1/build-source`. Git index의 파일만 사용했으며 node_modules만 기존 설치본을 연결했다. 마지막 추가 보고서는 런타임 코드를 바꾸지 않는다. 의존성 재설치 시험은 하지 않았다. Node 26.0.0 로컬 검증이며 Vercel Linux/Node 24에서의 실제 검증은 별도다.

HTTP 검사는 로컬 인증 fixture와 Next 서버만 사용했다. 실제 Supabase/Google 요청은 하지 않았다. 이번 단계에서는 전체 UI 브라우저 회귀를 다시 실행하지 않았으며 이전 Phase 2C-2의 결과와 구분한다. 원본이 없는 후보는 이전의 실제 지도 렌더링 시험을 통과한 것으로 보고하지 않는다.

## EXISTING_DATA_PRESERVED

**PASS — 보호 대상 46개 해시 동일, 기존 파일 삭제 0개.** Phase 2C-2 시작 시 기록한 `.env*`, prisma, storage, backups 기준과 다시 대조했다. 지도/참고 PNG와 내부 검토 JSON도 삭제·수정하지 않고 제외 규칙만 적용했다.

FieldDay 3개·기업 180개·자료 16개와 연결/미디어 해시 읽기 전용 회귀가 통과했다. 사진·녹음·메모·보고서 코드를 삭제하지 않았다. Prisma client 생성만 수행했으며 복사본 빌드 후 원본 schema 기준 client를 재생성했다. DB push/migrate/seed는 실행하지 않았다.

## COMMIT_READY

**YES, 이 staged 후보의 로컬 커밋 준비 완료.** 다음 승인에서 staged diff가 바뀌지 않았는지 재확인한 후 Commit할 수 있다. 아직 Commit 명령은 실행하지 않았다.

이 판정은 **내부 지도 없는 비활성 Preview 소스 후보**에 한정된다. Supabase SQL 적용, 실제 인증/저장 연동, 현장 지도 실증, iPhone 검증, 공개 베타 또는 Production 배포 승인이 아니다. 개인 데이터나 내부 자산을 테스트 통과 목적으로 Git에 넣지 않는다.

## VERCEL_PRODUCTION_DEPLOY_RISK

**미해소 외부 설정 위험 있음 — Preview 브랜치 이름만으로 안전하지 않다.** Vercel Git import는 기본 Production Branch를 main, 없으면 master 등의 순서로 정하고, import 화면의 Deploy는 실제 배포를 시작한다. Preview 브랜치를 먼저 Push했다는 사실만으로 master가 배포되지 않는 것은 아니다. [Vercel Git 배포·Production Branch](https://vercel.com/docs/git)

### 승인 후 권장 절차: 프로젝트 생성과 배포를 분리

1. Push 전에 `sinjulee/gatherly`에 이미 연결된 Vercel 프로젝트/자동 배포가 있는지 읽기 전용으로 확인한다. 연결되어 있다면 Push도 배포를 촉발할 수 있으므로 먼저 자동 배포 제한 범위를 승인받는다. 이번에는 이 원격 상태를 확인하거나 변경하지 않았다.
2. 승인된 커밋만 `gatherly-v2-preview`에 Push한다. master merge/push와 GitHub 기본 브랜치 변경은 하지 않는다.
3. **Git import 화면의 Deploy를 누르지 않는다.** 프로젝트가 아직 없다면 별도 승인 후 Git 저장소를 연결하지 않은 빈 프로젝트를 생성한다. 현재 공식 CLI는 `vercel project create gatherly`(add는 alias)를 제공한다. 설치된 버전의 `--help`와 팀 scope를 먼저 확인한다. 이미 프로젝트가 있으면 새로 만들지 않고 해당 설정을 확인한다. [프로젝트 생성 CLI](https://vercel.com/docs/cli/project)
4. Git 미연결·배포 없음 상태를 확인하고 Next.js, Node 24, root directory, build command, Preview 접근 보호와 고정 주소를 설정한다. Production 환경에는 운영 자격증명을 등록하지 않는다. 이 단계의 Supabase SQL/환경변수 적용은 별도 승인 전까지 보류한다.
5. 최초 배포는 승인된 커밋의 깨끗한 checkout에서 해당 프로젝트에 연결한 뒤 **명시적 `--target=preview`**로 실행하는 경로를 권장한다. 원본이 있는 현재 작업폴더 전체를 업로드하지 않는다. Git 미연결 상태에서는 master push가 이 프로젝트의 자동 배포 입력이 되지 않는다. `--prod`, promote, Production 도메인 연결은 하지 않는다. [배포 target 옵션](https://vercel.com/docs/cli/deploy)
6. 배포 후 실제 target=Preview, 소스 SHA, 접근 보호, 도메인, 서버 환경 namespace를 확인한다. 이 실행과 검증은 아직 승인되지 않았다.

### Git 자동 Preview가 꼭 필요한 경우

Git 연결은 위 수동 Preview가 안전하게 확인된 후 별도 단계로 진행한다. Production Branch와 자동 배포 차단이 먼저 검토되어야 한다. `gatherly-v2-preview`를 Production Branch로 지정하면 이름과 달리 Production 배포가 되므로 그렇게 설정하지 않는다.

공식 `git.deploymentEnabled`는 자동 배포를 전체 또는 브랜치별로 제한한다. **Preview 브랜치에만 설정 파일을 추가했다고 master의 옛 코드까지 보호된다고 가정하지 않는다.** master도 포함한 모든 배포 입력 경로에 적용되는 방식을 확인하기 전에는 Git 자동 연결을 보류한다. 본 후보의 `vercel.json`은 build 설정뿐이며 자동 배포를 전역 차단하는 설정은 아직 적용하지 않았다. [Git 배포 제어 설정](https://vercel.com/docs/project-configuration/git-configuration)

## NEXT_APPROVALS

1. 이 보고서의 78개 staged 파일을 대상으로 로컬 Commit 승인.
2. 기존 자동 배포 연결 여부 확인 및 필요 조치 후 Preview 브랜치 Push 승인. Push와 Deploy를 별도 범위로 명시.
3. Git 미연결 프로젝트 생성/설정 및 명시적 Preview 배포 승인. 원격 팀·프로젝트·고정 HTTPS 주소를 확정.
4. Supabase 공용 프로젝트 SQL·환경별 변수·Auth/OAuth 및 테스트 계정 설정 별도 승인. 이번에는 모두 미적용.
5. 지도 원본의 승인된 비공개 공급 방식과 사용 범위 승인. Google 파일 생성과 실기기 현장 시험은 별도 승인.

Commit·Push·Deploy·운영 SQL·외부 Google 파일 쓰기는 실행하지 않고 여기서 멈춘다.

## 부록: STAGED_FILES 전체 목록

```text
.gitignore
.vercelignore
app/api/v2/auth/callback/route.ts
app/api/v2/auth/login/route.ts
app/api/v2/auth/logout/route.ts
app/api/v2/catalog/route.ts
app/api/v2/google/callback/route.ts
app/api/v2/google/connect/route.ts
app/api/v2/map/route.ts
app/api/v2/media/route.ts
app/api/v2/sync/route.ts
app/api/v2/voice/route.ts
app/layout.tsx
app/phase-one/page.tsx
app/v2/page.tsx
components/app-shell.tsx
components/gatherly-2/connected-field.tsx
components/gatherly-2/field-prototype.tsx
components/gatherly-2/note-sheet.tsx
docs/gatherly-2.0/.env.v2.example
docs/gatherly-2.0/.env.vercel.example
docs/gatherly-2.0/ARCHITECTURE_BOUNDARY_PROPOSAL.md
docs/gatherly-2.0/Gatherly_2.0_Development_Kickoff_v0.5.md
docs/gatherly-2.0/Gatherly_2.0_PRD_v0.5.md
docs/gatherly-2.0/Gatherly_2.0_SRS_v0.5.md
docs/gatherly-2.0/Gatherly_2.0_v0.5_CHANGELOG.md
docs/gatherly-2.0/PHASE_0_AUDIT.md
docs/gatherly-2.0/PHASE_1_IMPLEMENTATION.md
docs/gatherly-2.0/PHASE_2A_INTEGRATION_PLAN.md
docs/gatherly-2.0/PHASE_2B_1_IMPLEMENTATION.md
docs/gatherly-2.0/PHASE_2B_2_VERCEL_READINESS.md
docs/gatherly-2.0/PHASE_2C_1_DEPLOYMENT_GATE.md
docs/gatherly-2.0/PHASE_2C_2_SECURITY_IMPLEMENTATION.md
docs/gatherly-2.0/PHASE_2C_3A_COMMIT_GATE.md
docs/gatherly-2.0/README_START_HERE.md
docs/gatherly-2.0/sql/catalog-draft.sql
docs/gatherly-2.0/sql/vercel-vault-draft.sql
lib/gatherly-2/access.ts
lib/gatherly-2/auth/server.ts
lib/gatherly-2/browser-storage.ts
lib/gatherly-2/contracts.ts
lib/gatherly-2/importer.ts
lib/gatherly-2/integration/browser-media.ts
lib/gatherly-2/integration/browser-sync.ts
lib/gatherly-2/integration/catalog.ts
lib/gatherly-2/integration/cloud-media.ts
lib/gatherly-2/integration/config.ts
lib/gatherly-2/integration/environment.ts
lib/gatherly-2/integration/google.ts
lib/gatherly-2/integration/platform.ts
lib/gatherly-2/integration/runtime.ts
lib/gatherly-2/integration/storage.ts
lib/gatherly-2/integration/supabase-vault.ts
lib/gatherly-2/integration/validation.ts
lib/gatherly-2/integration/vault.ts
lib/gatherly-2/map.ts
lib/gatherly-2/mock-storage.ts
lib/gatherly-2/sync.ts
next.config.ts
package-lock.json
package.json
proxy.ts
scripts/tests/legacy_readonly.py
scripts/tests/phase1-browser.mjs
tests/access.test.ts
tests/environment-security.test.ts
tests/fixtures/directory-five.html
tests/integration-auth.test.ts
tests/integration-browser-queue.test.ts
tests/integration-map.test.ts
tests/integration-rls.test.ts
tests/integration-storage.test.ts
tests/legacy.test.ts
tests/map-importer.test.ts
tests/storage-sync.test.ts
tests/vercel-media.test.ts
tests/vercel-readiness.test.ts
vercel.json
```
