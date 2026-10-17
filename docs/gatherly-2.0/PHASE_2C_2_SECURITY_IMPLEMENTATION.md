# Gatherly 2.0 — Phase 2C-2 보안 구현 및 Preview 브랜치 준비

작성일: 2026-10-17. 대상: Vercel `gatherly`, Supabase `gatherly-prod` (`rmjyonrmlbarvtaazurc`).

**로컬 보안 구현·검증 완료. 실제 배포는 승인 대기다.** 환경 namespace와 내부 지도 인증 경로를 구현했고 기존 45개를 포함한 단위 테스트 47개, 타입 검사·린트·빌드·브라우저 회귀를 통과했다. 운영 SQL·외부 Google 파일 쓰기·Commit·Push·Deploy는 실행하지 않았다.

기준: [Phase 2C-1](PHASE_2C_1_DEPLOYMENT_GATE.md), [Phase 2B-2](PHASE_2B_2_VERCEL_READINESS.md), [PRD v0.5](Gatherly_2.0_PRD_v0.5.md), [SRS v0.5](Gatherly_2.0_SRS_v0.5.md). 이 문서의 새 접근 정책이 이전 보고서의 공개 `/phase-one`·공개 카탈로그 정책을 대체한다.

## 1. 브랜치와 Git 보존

- 시작: `phase2/research-execution-system`, HEAD `a6b84fd414941518903e23eba9928e83d7bd5ecf`.
- 현재 HEAD에서 `git switch -c gatherly-v2-preview`를 실행했다. `master`로 이동하지 않았으며 HEAD 커밋은 동일하다. `.git` 쓰기에 필요한 실행 권한만 사용했다.
- 기존 수정·미추적 파일을 유지했다. stage/commit/push는 하지 않았고 upstream은 아직 설정하지 않았다.
- 종료 시 Git 상태는 추적 파일 수정 6개·미추적 파일 77개·스테이징 0개다. 이 수에는 이전 단계의 미커밋 작업도 포함된다. `.omc`는 삭제하지 않고 ignore 처리했다.
- `.gitignore`에 `.omc/`, `.agents/`, `.codex/`, 실제 `.env*`, SQLite 보조 파일 패턴을 추가했다. 값 없는 환경변수 예제만 예외로 둔다. 기존 `.vercelignore`의 환경파일·데이터·도구 상태 제외 규칙을 유지했다.
- `git ls-files` 검사에서 실제 환경파일·SQLite·storage·backups·도구 상태 추적 항목은 없었다. `git check-ignore`로 `.env`, `.env.local`, `.omc`, DB, storage, backups 제외를 확인했다.
- 시작 시 기존 파일 269개의 해시를 기록했다(빌드/의존성/Git/도구 상태 제외). 기존 파일 삭제 0개, 환경파일·prisma/storage/backups 보호 대상 46개 변경 0개다. 실제 지도 원본도 수정하지 않았다.
- 브랜치는 미커밋 파일이나 Git 제외 데이터를 백업하는 수단은 아니다. 데이터는 기존 위치에 유지한다.

## 2. 서버가 강제하는 환경 경계

`lib/gatherly-2/integration/environment.ts`는 서버 설정 `GATHERLY_V2_ENVIRONMENT`를 `development | preview | production`으로 제한한다. Vercel에서는 `VERCEL_ENV`와 일치해야 하고, 로컬에서는 development만 허용한다. 누락·오타·불일치는 DISABLED로 차단한다. 요청 query/header/body의 환경 식별자를 이 결정에 사용하지 않는다.

인증은 Supabase `getUser()`로 검증한 UUID와 환경별 서버 허용 목록을 대조한다. 브라우저 쿠키의 user 객체나 user_metadata를 신뢰하지 않는다. 기존 범용 `GATHERLY_V2_ALLOWED_USER_IDS`는 V2 서버 인증에서 더 이상 사용하지 않는다. 로그인 callback도 같은 검사를 거친다.

| 환경 | 서버 설정 | 허용 목록 |
|---|---|---|
| 로컬 | `GATHERLY_V2_ENVIRONMENT=development` | `GATHERLY_V2_DEVELOPMENT_ALLOWED_USER_IDS` |
| Vercel Preview | `GATHERLY_V2_ENVIRONMENT=preview`, 플랫폼 `VERCEL_ENV=preview` | `GATHERLY_V2_PREVIEW_ALLOWED_USER_IDS` |
| Vercel Production | `GATHERLY_V2_ENVIRONMENT=production`, 플랫폼 `VERCEL_ENV=production` | `GATHERLY_V2_PRODUCTION_ALLOWED_USER_IDS` |

환경 예제 두 파일을 갱신했으며 실제 `.env`/`.env.local`은 수정하지 않았다. 기존 로컬 설정만으로는 새 인증 경로가 열리지 않는다. 사용자가 해당 환경 변수와 승인 UUID를 설정해야 한다. 이 실패 시 차단 동작은 의도된 변경이다.

### Vault와 개인 Google 자료

- `g2_private.vault`의 키를 `(environment, user_id)`로 변경한 **미적용 SQL 초안**을 작성했다. environment CHECK, 복합 PK, lock/revision 조건을 적용한다.
- claim/save/release RPC에 환경 인자를 추가했다. 런타임이 서버에서 결정한 환경을 넘긴다. 기존 테스트/개발 호환 기본값은 development이며 실제 Vercel 런타임은 항상 명시적으로 전달한다.
- 암호문 AAD는 `environment:user_id`다. 같은 사용자·같은 암호화 키라도 다른 환경에 복사된 ciphertext는 복호화되지 않는다.
- 잠금·revision은 환경별로 독립적이다. Preview 잠금 token으로 Production 저장/해제 또는 반대 작업을 하면 실패한다.
- Google resource marker의 owner도 `environment:user_id`로 바꿨다. 같은 Google 계정에서도 환경 간 폴더·Sheet 검색 marker가 달라진다. 브라우저가 파일 ID나 환경을 골라 서버 vault를 열 수 없다.
- IndexedDB는 `gatherly-v2-{environment}-internal/connected`로 나눈다. 내부 프로토타입도 인증 사용자 UUID로 기록한다. 기존 데모/connected IndexedDB는 삭제하거나 자동 이관하지 않는다. 이전 브라우저 기록은 원래 DB에 남지만 새 화면에 자동 표시되지 않는다.

### RLS와 service-role 한계

vault는 RLS 활성화 상태이며 anon/authenticated에는 schema/table/RPC 접근 권한이 없다. 환경을 지정한 직접 SELECT/UPDATE/RPC 호출 모두 차단됨을 PGlite에서 검증했다. 서버 API는 검증된 사용자 UUID, 환경별 allowlist, 요청의 expectedUserId 일치, 기업/행사 연결을 확인한 뒤 vault를 사용한다.

**이 구조는 논리적 환경 격리이며 service-role 권한 자체를 환경별로 나누지는 않는다.** 동일 Supabase 프로젝트의 service-role 키를 가진 신뢰된 서버/운영자는 RLS를 우회해 양쪽 데이터에 접근할 수 있다. 키 유출·악성 서버 코드까지 방어하는 물리적 분리가 아니다. 브라우저에 키를 제공하지 않고 배포 코드/비밀키 접근자를 제한해야 한다. 더 강한 운영자 격리는 별도 DB 역할/프로젝트 설계가 필요하다.

Supabase Auth 사용자 풀·provider 설정·세션/사용자 관리도 공유된다. 동일 UUID를 양쪽 허용 목록에 넣으면 양쪽 로그인은 가능하지만 vault와 Google 자료 marker는 분리된다. Auth 사용자 삭제/차단 및 동일 Google OAuth grant 철회는 환경을 넘는 영향을 줄 수 있다. 공식 승인 카탈로그·관리자 테이블은 공용이며 환경별 복제 데이터가 아니다. 실제 이용권/보고서 쓰기 기능은 이 단계에서 활성화하지 않았다.

## 3. 내부 지도·카탈로그·관리자 보호

| 경로/코드 | 변경된 보호 |
|---|---|
| `/phase-one` | 정적 페이지에서 동적 서버 페이지로 변경. `session()` 통과 후 UI 렌더링. 비로그인·미승인·설정 불충분은 `/v2`로 redirect |
| `/api/v2/map` | 세션·환경별 allowlist 확인 후 서버 파일 읽기. image/png, private/no-store, nosniff. 인증 전에는 원본을 읽거나 응답하지 않음 |
| 이전 정적 지도 URL | 클라이언트 PNG import 제거. 이전 파일명 기반 URL도 Proxy에서 404 차단. 새 `.next/static`에는 원본 바이트 없음 |
| `/api/v2/catalog?exhibition=...` | 서버 세션 검사 후 기업 상세 목록·검수된 핫스팟 반환. private/no-store. 기존 `/v2` SSR도 동일 세션 검사 유지 |
| `/api/v2/voice` | 먼저 서버 세션 검사. 승인된 공식 AI 음성은 아직 없으므로 승인 사용자에게도 NOT_PUBLISHED 404. 외부 AI 호출 없음 |
| `adminSession()` | 환경별 승인 사용자 확인 후 DB `g2_admins`의 본인 행 조회. user_metadata 관리자 표시로 우회 불가. 관리자 쓰기 API는 추가하지 않음 |

지도 원본은 기존 docs 경로에 보존하되 정적 import를 제거했다. `next.config.ts`는 `/api/v2/map`의 서버 파일 추적에만 원본 PNG를 포함한다. 일반 public 경로나 Next 이미지 최적화 경로로 원본을 제공하지 않는다. 새 배포가 과거 배포의 URL을 삭제해 주는 것은 아니므로, 과거 외부 공개 배포가 있다면 별도 폐쇄가 필요하다(이번에는 실제 배포를 하지 않았다).

지도 스크롤·핫스팟·기업 선택·4아이콘·메모 동작은 유지한다. 프로토타입의 기업·좌표·TTS는 여전히 가상 데이터다. 공식 기업 좌표나 AI 도슨트를 새로 발행하지 않았다.

### Supabase 직접 카탈로그 조회 방어

앱 API만 보호하고 Supabase REST가 공개되어 있으면 우회 경로가 된다. 따라서 `catalog-draft.sql`에 `g2_catalog_readers` 승인 테이블을 추가하고, 카탈로그의 anon SELECT를 제거했다. authenticated도 DB 승인 행이 있어야 공개·권리 승인·검수 상태 RLS를 통과한다. 일반 사용자는 승인 행을 추가할 수 없으며 본인 행만 읽는다.

`g2_admins`에 속해도 자동으로 카탈로그 reader·환경 allowlist·보고서 이용권을 얻지 않는다. 운영자는 승인 회수 시 앱 환경 allowlist와 DB reader 승인을 함께 관리해야 한다. 직접 Supabase REST에는 Vercel 환경 정보가 없으므로, DB reader 정책은 공용 승인 카탈로그의 사용자 승인을 검사한다. 개인 환경 데이터는 이 공개 스키마에 저장하지 않는다.

## 4. 테스트와 실행 결과

| 항목 | 결과 |
|---|---|
| 기존 단위 테스트 45개 | 유지·통과. 기존 RLS 테스트의 익명 공개 기대값을 새 내부 승인 정책에 맞게 강화 |
| 신규 환경 보안 테스트 2개 | 양방향 allowlist, 잘못된 서버 환경, UUID 위조, namespace별 저장/잠금, 다른 환경 token 사용, ciphertext 복사, 일반 역할 SELECT/UPDATE/RPC 거부 통과 |
| `npm test` | **47/47 PASS**, 실패·skip 0 |
| `npm run typecheck -- --incremental false` | PASS |
| `npm run lint` | 오류 0. 기존 `RefreshCw` 미사용 경고 1 |
| `VERCEL=1 VERCEL_ENV=preview GATHERLY_V2_ENVIRONMENT=preview npm run build:vercel` | 격리 복사본 PASS |
| 브라우저 인증 경계 | 비로그인 phase-one 307, map/catalog/voice 401; 미승인 사용자 403; 쿠키 user 객체를 승인 UUID로 위조해도 실제 검증 토큰 사용자가 미승인이면 403 |
| 지도 직접 접근 | docs 원본 경로·이전 정적 URL·이미지 최적화 URL 차단, 승인 사용자 map 200 및 no-store 확인 |
| 환경값 조작 | query/header의 production 값으로 Preview 서버 환경을 변경하지 못함. Production용 사용자도 Preview 허용 목록에는 없는 경우 거부 |
| UI 브라우저 회귀 | 375/430/1280 폭, 양축 지도·네 모서리·드래그 오선택 방지·44px 아이콘·메모 작성/수정/취소/기업 고정·사진 5장·가상 녹음·새로고침 복구 PASS |
| 기존 SQLite 회귀 | 읽기 전용 검사 PASS: FieldDay 3, 기업 180, 자료 16 및 미디어 연결 |
| `git diff --check` | PASS |

브라우저 시험은 격리된 로컬 Next 서버와 HTTP Supabase Auth fixture를 사용한다. 앱에 테스트 인증 우회 옵션은 추가하지 않았으며 실제 `getUser()`/allowlist 경로를 통과한다. 실제 Supabase나 Google에 인증/파일 쓰기를 요청하지 않았다. 첫 브라우저 시험은 fixture가 시간에 따라 토큰을 다시 만들어 세션을 거부했으며 토큰을 고정했다. 최종 재검증에서는 자동화가 저장 완료 전 다음 모달을 열던 순서 문제를 발견해 모달 종료 대기를 추가했다. 앱 메모 코드는 바꾸지 않았으며 수정된 시험이 통과했다.

최종 브라우저 산출물: `/var/folders/rs/6_j362g92j79ssyxdgbmn6rw0000gn/T/gatherly-v2-browser-jedko0`. 새 `.next/static` 전체 파일의 SHA-256과 지도 원본을 대조해 일치 파일 0개를 확인했고, map 서버 route의 파일 trace에는 원본이 포함됨을 확인했다. 마지막 테스트 스크립트 수정 후 해당 파일 린트도 재실행했다.

빌드 복사본: `/private/tmp/gatherly-phase1-2c2-da7zg6_u/build-source`. 로컬 Node 26.0.0에서 검증했으며 Vercel Node 24 및 iPhone 실기기 검증은 남아 있다. 빌드의 Prisma generate는 client 생성만 수행했고 종료 후 원본 schema 기준 client를 재생성했다. DB migrate/push/seed는 실행하지 않았다.

## 5. 이번 변경 파일

기존 파일 수정:

```text
.gitignore
proxy.ts
next.config.ts
app/phase-one/page.tsx
app/v2/page.tsx
app/api/v2/auth/callback/route.ts
app/api/v2/sync/route.ts
app/api/v2/media/route.ts
components/gatherly-2/field-prototype.tsx
components/gatherly-2/connected-field.tsx
lib/gatherly-2/auth/server.ts
lib/gatherly-2/integration/platform.ts
lib/gatherly-2/integration/runtime.ts
lib/gatherly-2/integration/supabase-vault.ts
docs/gatherly-2.0/.env.v2.example
docs/gatherly-2.0/.env.vercel.example
docs/gatherly-2.0/sql/catalog-draft.sql
docs/gatherly-2.0/sql/vercel-vault-draft.sql
tests/integration-rls.test.ts
scripts/tests/phase1-browser.mjs
```

신규:

```text
lib/gatherly-2/integration/environment.ts
app/api/v2/map/route.ts
app/api/v2/catalog/route.ts
app/api/v2/voice/route.ts
tests/environment-security.test.ts
docs/gatherly-2.0/PHASE_2C_2_SECURITY_IMPLEMENTATION.md
```

기존 app/layout·AppShell·package 파일 수정 등 Phase 2B 이전 변경은 그대로 유지했으며 이번 변경으로 덮어쓰지 않았다.

## 6. Commit/Push 후보와 제외 대상

아래는 **검토 대상 분류이며 stage/commit/push 실행 목록이 아니다.** V2 이전 단계 파일도 아직 미커밋 상태이므로 이번 보안 변경만 단독으로 올리면 실행 가능한 전체 코드가 되지 않는다.

| 분류 | 후보 경로 |
|---|---|
| V2 실행 코드 | `app/api/v2/**`, `app/v2/**`, `app/phase-one/**`, `components/gatherly-2/**`, `lib/gatherly-2/**` |
| 필수 공통/배포 설정 | `.gitignore`, `.vercelignore`, `proxy.ts`, `next.config.ts`, `vercel.json`, `package.json`, `package-lock.json`, `app/layout.tsx`, `components/app-shell.tsx` |
| 검증 코드 | `tests/**`, `scripts/tests/**` |
| 검토/이력용 문서 | `docs/gatherly-2.0/*.md`, `sql/*.sql`, 값 없는 `.env*.example`, 내부 매핑 검토 JSON |
| 서버 전용 지도 자산 | `docs/gatherly-2.0/v0.5_assets/ESG_2026_Official_BoothMap_TitleRemoved_Reference.png` — 서버 route가 필요로 함. 저장소 공개 범위/자료 사용권 확인 후 포함 |
| 별도 검토, 실행 필수 아님 | 루트 v0.3 PRD/SRS·이전 Kickoff 3개, UI concept PNG |

Git/배포 제외: 실제 `.env*`와 비밀키, SQLite DB·journal/WAL/SHM·backup, `storage/`, `backups/`, 로그, `.omc/`, `.agents/`, `.codex/`, node_modules·.next 등 생성 파일. SQL/문서/검토 JSON은 Git 검토용이며 `.vercelignore`로 배포 입력에서 제외한다. 레거시 소스는 보존하되 Vercel에서는 기존 Proxy 경계로 실행을 차단한다. `git add .`로 모든 미추적 자료를 한 번에 포함하지 않고 이 분류에 따라 검토해야 한다.

서버 인증은 웹 URL을 보호하지만 **공개 GitHub 저장소에 원본 PNG를 커밋하는 행위까지 보호하지는 않는다.** `sinjulee/gatherly`의 가시성과 지도 원본의 저장소 포함 권한을 확인해야 한다. 비공개 소스 저장 또는 별도 승인된 서버 자산 공급 경로 없이 공개 저장소에 내부 지도 원본을 올리지 않는다.

## 7. 운영 SQL 적용 전 작업과 Preview 판정

**코드 기준 보안 차단점은 해결했다. 제한된 Preview 배포 준비는 가능하지만 실제 배포 승인·외부 설정은 남아 있다.** 초기 두 연동 플래그 false 상태에서는 지도와 phase-one이 열리지 않고 준비 화면만 제공한다. 내부 기능 시험에는 실제 Google 로그인과 환경별 allowlist를 설정해야 한다.

승인 후 순서:

1. Vercel `gatherly`의 소유 팀·고정 Preview HTTPS 주소·접근 보호·Node 24·build command를 확인한다. Git 저장소 가시성과 지도 자산 포함 권한을 확인한다.
2. Preview/Production별 서버 환경·UUID allowlist·origin·OAuth callback을 등록한다. 두 환경의 Google/vault secret과 암호화 키 관리를 정한다. 운영 계정을 Preview 테스트에 자동 등록하지 않는다.
3. 실제 프로젝트에서 기존 SQL 적용 여부를 읽기 전용으로 확인한 뒤 변경 적용 계획을 승인받는다. 초안은 재실행 migration이 아니다. 기존 단일 user_id vault가 있다면 이전 암호문의 환경 귀속과 AAD 재암호화를 검토해야 하며 자동으로 Production에 귀속시키지 않는다. 구 RPC overload의 정리 여부도 검토한다.
4. 카탈로그 reader 테이블·정책과 환경 vault를 승인 후 적용한다. 테스트 UUID의 reader 승인, 관리자 bootstrap, 권한 회수 절차를 분리한다. 일반 사용자에게 승인 테이블이나 RPC 쓰기 권한을 주지 않는다.
5. 실제 Supabase 환경에서 미승인 사용자 REST 차단·vault RPC 거부·승인 사용자 카탈로그 조회·양방향 namespace 격리를 확인한다. 공식 카탈로그와 Auth의 공유 범위도 확인한다.
6. 정확한 소스/환경/접근 범위로 Preview 배포 승인을 받은 후에만 배포한다. 실제 산출물에 지도 원본이 공개 static으로 들어가지 않고 서버 map route에만 있는지 재확인한다.
7. Google 파일 시험은 별도 승인 후 writes 플래그를 켠다. 실제 token 만료·업로드 중단·잠금 복구, iPhone 카메라/마이크·오프라인 복귀를 검증한다. Production 승격과 외부 공개는 별도 승인이다.

운영 DB·외부 서비스는 변경하지 않았으며 브랜치 생성과 로컬 구현·검증을 마치고 여기서 멈춘다.
