# Gatherly 2.0 — Phase 2C-1 배포 사전 검증

작성일: 2026-10-17. 대상: Vercel `gatherly`, Supabase `gatherly-prod` (`rmjyonrmlbarvtaazurc`). 브랜치 `phase2/research-execution-system` 유지.

**판정: 로컬 검증 PASS / 실제 Preview 배포 HOLD.** 기존 45개 테스트·타입 검사·린트·Vercel 모드 빌드·브라우저 회귀 검증을 다시 통과했다. 고정 HTTPS 주소, 원격 환경 설정, 지도 공개 범위 및 배포 승인이 확정되지 않았다. 실제 연동을 활성화하는 배포는 SQL·OAuth·계정 격리 검증도 필요하다.

이번 변경은 이 보고서뿐이다. 앱 코드·SQL 초안·환경파일·기존 Git 변경사항을 수정하지 않았다. 실제 Supabase/Google/Vercel 설정 조회·변경이나 연결 시험을 실행하지 않았으므로 원격 등록 상태를 확인한 보고서는 아니다. DB 마이그레이션·외부 데이터 쓰기·Google 파일 생성·commit/push/deploy를 실행하지 않았다.

기준: [Phase 2B-2](PHASE_2B_2_VERCEL_READINESS.md), [PRD v0.5](Gatherly_2.0_PRD_v0.5.md), [SRS v0.5](Gatherly_2.0_SRS_v0.5.md). 사용자 확정 아키텍처에 따라 V2는 Vercel/Supabase/Google, 레거시는 기존 SQLite/로컬 저장 경계를 유지한다.

## 1. 공개 라우트와 레거시 차단

판정 코드: `proxy.ts`, `lib/gatherly-2/integration/platform.ts`. `VERCEL === '1'`일 때 다음 정책을 적용한다. “허용”은 Proxy 통과를 의미하며 실제 route 존재·로그인·이용 허용을 의미하지 않는다.

| 경로 | Vercel 동작 | 추가 접근 조건 |
|---|---|---|
| `/` | 307 → `/v2` | 없음 |
| `/phase-one` | 프로토타입 화면 허용 | 로그인 불필요, 가상 기업/핫스팟·브라우저 로컬 저장 |
| `/v2`, `/v2/*` | 허용; 실제 구현은 `/v2` | integration false면 안내 화면. true면 검증된 세션·사용자 UUID 허용 목록 |
| `POST /api/v2/auth/login` | Supabase Google 로그인 시작 | integration 활성화·같은 origin |
| `GET /api/v2/auth/callback` | PKCE code 교환 | Supabase 사용자 검증·허용 목록 |
| `POST /api/v2/auth/logout` | 로그아웃 | 같은 origin·인증 클라이언트 |
| `POST /api/v2/google/connect` | 별도 파일 접근 동의 | 두 플래그·같은 origin·세션·허용 사용자·vault |
| `GET /api/v2/google/callback` | 파일 OAuth code 교환 | 세션·두 플래그·일회용 state/PKCE·vault |
| `POST /api/v2/sync` | 메모 저장 | 두 플래그·same-origin·owner·카탈로그 행사/기업 연결 검사. Vercel의 전체 미디어 요청은 거부 |
| `POST /api/v2/media` | 분할 업로드 | 위 권한 검사 + 크기/hash/offset 검증 |
| `/api/v2/*` | 네임스페이스 허용 | 위 7개 외 실제 구현 없음. 향후 라우트도 자동 통과하므로 신규 API별 권한 검토 필요 |
| `/_next/static/*` | 정적 JS/CSS·번들 이미지·폰트 허용 | 인증 없음 |
| `/icon.svg`, `/favicon.ico`, `/manifest.webmanifest` | 경로 허용 | 실제 자산이 없으면 framework 404 |
| 나머지 모든 경로 | 404 `LOCAL_LEGACY_ONLY` | 로컬에서는 이 차단 정책 미적용 |

차단되는 기존 페이지: `/analysis`, `/exhibitions`, `/exhibitions/[exhibitionId]`, `/exhibitions/[exhibitionId]/indexes/[indexId]/companies/[companyId]`, `/inbox`, `/reports`.

차단되는 API 목록(현재 파일 기준; 대괄호는 동적 ID):

```text
/api/health
/api/exhibitions/[id]/companies/[companyId]
/api/exhibitions/[id]/field-days
/api/exhibitions/[id]/indexes
/api/field-days
/api/field-days/[id]
/api/indexes/[id]
/api/indexes/[id]/companies
/api/indexes/[id]/companies/[companyId]
/api/materials
/api/materials/upload
/api/materials/[id]
/api/materials/[id]/file
/api/reports
/api/reports/[id]/export/planframe
/api/reports/[id]/finalize
/api/reports/[id]/structured-result
/api/reports/[id]/sync-docs
/api/research/analysis-briefs
/api/research/analysis-briefs/[id]/start-analysis
/api/research/analysis-briefs/[id]/sync-drive
/api/research/checkpoints/[id]
/api/research/checkpoints/[id]/requirements
/api/research/drive-workspace
/api/research/drive-workspace/candidates
/api/research/drive-workspace/create
/api/research/drive-workspace/link
/api/research/drive-workspace/scan-pre-research
/api/research/materials/[id]
/api/research/notebook-link
/api/research/plans
/api/research/plans/[id]
/api/research/plans/[id]/activate
/api/research/plans/[id]/checkpoints
/api/research/plans/[id]/questions
/api/research/plans/[id]/targets
/api/research/pre-research-sources
/api/research/pre-research-sources/[id]
/api/research/questions/[id]
/api/research/quick-analysis
/api/research/requirements/[id]
/api/research/source-bundles
/api/research/source-bundles/[id]/build
/api/research/source-bundles/[id]/sync-drive
/api/research/targets/[id]
```

`/storage/*`, `/sw.js`, `/fonts/*`와 `/_next/image`도 현재 허용 목록에 없다. 현재 UI의 폰트·지도는 `/_next/static` 번들로 제공되므로 브라우저 검증에서 정상 표시됐다. 향후 원본 public 경로 또는 Next Image 최적화 URL을 추가하면 허용 정책 검토가 필요하다.

### 서버리스 의존성 검증

- V2 API·페이지·공유 layout·proxy에서 프로젝트 내부 import 31개를 추적했다. `lib/prisma.ts`, 레거시 `lib/storage.ts`, Prisma 패키지, child_process 의존성을 발견하지 않았다.
- `integration/vault.ts`의 `node:fs/promises`와 FileVault 코드는 여전히 전이 의존성에 있다. SupabaseVault도 이 파일의 암호화 함수를 사용한다. 따라서 “파일시스템 코드가 완전히 제거됐다”는 판정은 아니다. `runtime.ts`가 `VERCEL=1`에서 file backend를 거부하고 Supabase backend를 선택하므로 파일 쓰기 실행 경로는 차단된다.
- 빌드 추적 파일 67개에서 환경파일·SQLite 파일·storage/backups 포함 흔적을 발견하지 않았다. V2 및 phase-one trace에서 Prisma client 참조도 없었다. 단, 이번 빌드 입력 자체에서 실제 환경파일·DB·미디어를 제외했다. 실데이터가 있는 작업폴더를 그대로 올려도 안전하다는 실증은 아니다.
- **레거시 페이지/API는 Next 빌드 라우트와 서버 산출물에 남아 있다.** Proxy 차단이 실행 경계이며 물리적으로 별도 앱으로 분리된 구조가 아니다. 실제 Preview에서 `VERCEL=1`, Proxy 적용, 산출물 제외를 확인해야 한다. 이를 해제하거나 우회하는 routing 설정은 허용하지 않는다.
- `.vercelignore`와 Next 파일 추적 제외 설정은 유지했다. 실제 배포 입력은 비밀파일·DB·자료·백업을 제외한 검토된 소스로 제한한다. 기존 start wrapper 및 AI worker를 Vercel 실행 명령으로 사용하지 않는다.

Vercel 시스템 변수 제공 설정이 클라우드 경계의 전제다. [시스템 환경변수 문서](https://vercel.com/docs/environment-variables/system-environment-variables)

## 2. 코드와 환경변수 대조

`config.ts`, `runtime.ts`, `auth/server.ts`, `proxy.ts`, `platform.ts`와 [Vercel 템플릿](.env.vercel.example)을 대조했다. 실제 키 값은 출력하지 않았다. 현재 로컬에서는 아래 6개가 `.env`에 선언되어 있고 나머지는 없다. 선언 여부만 확인했으며 값·유효성·프로젝트 일치를 검증하지 않았다. Vercel 대시보드 등록 여부는 미확인이다.

| 변수 | 로컬 선언 | Preview 설정 | Production 설정 |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | 있음 | 초기 데모는 생략 가능, 인증 시험 시 승인된 프로젝트 URL | gatherly-prod URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 있음 | 인증 시험 시 해당 프로젝트 공개 키 | gatherly-prod 공개 키 |
| `GATHERLY_V2_APP_ORIGIN` | 있음 | 고정 Preview HTTPS origin | 고정 운영 HTTPS origin |
| `GATHERLY_V2_INTEGRATION_ENABLED` | 있음 | 최초 `false`, 인증 시험 승인 후 `true` | 초기 `false`, 운영 검증 후 활성화 |
| `GATHERLY_V2_GOOGLE_WRITES_ENABLED` | 있음 | 최초 `false`, 테스트 파일 쓰기 승인 후 `true` | 초기 `false`, 운영 저장 승인 후 활성화 |
| `GATHERLY_V2_ALLOWED_USER_IDS` | 있음 | 승인된 테스트 UUID만 | 승인된 운영 사용자 UUID |
| `GATHERLY_V2_VAULT_BACKEND` | 없음 | 파일 연동 시 `supabase` | `supabase` |
| `GATHERLY_V2_SUPABASE_SECRET_KEY` | 없음 | 데모에는 미등록, vault 시험 시 서버 전용 | 서버 전용, NEXT_PUBLIC 금지 |
| `GATHERLY_V2_TOKEN_ENCRYPTION_KEY` | 없음 | 데모에는 미등록, vault 시험에 32바이트 base64 | 키 보존·회전 절차 필요 |
| `GATHERLY_V2_GOOGLE_CLIENT_ID` | 없음 | 파일용 OAuth 테스트 client | 파일용 운영 client |
| `GATHERLY_V2_GOOGLE_CLIENT_SECRET` | 없음 | 파일용 서버 secret | 파일용 서버 secret |
| `GATHERLY_V2_GOOGLE_REDIRECT_URI` | 없음 | Preview origin + `/api/v2/google/callback` | 운영 origin + 동일 경로 |
| `GATHERLY_V2_VAULT_DIR` | 없음 | 등록 금지: 로컬 FileVault 전용 | 등록하지 않음 |
| `VERCEL` | 플랫폼 제공 | build/runtime 모두 `1` 확인 | 동일 |

`DATABASE_URL`, 기존 Google refresh token, 로컬 storage 경로, worker 환경변수는 이 V2 배포에 옮기지 않는다. `VERCEL_URL`에서 OAuth 주소를 자동 추론하는 코드는 없다. 실제 앱 주소를 명시적으로 설정해야 한다. 환경변수 변경은 새 배포에 반영되므로 Preview와 Production을 별도 관리한다. [Vercel 환경변수 문서](https://vercel.com/docs/environment-variables)

**Preview/Production 격리 조건:** vault PK는 `user_id` 하나이며 환경별 namespace가 없다. 같은 Supabase 프로젝트·사용자 UUID를 쓰면 vault도 공유된다. 이때 서로 다른 암호화 키는 복호화 실패를 일으키며 같은 키는 격리를 제공하지 않는다. 최초 Preview는 연동 비활성으로 두고, 실제 연동 Preview는 별도 테스트 사용자/Google 계정과 비중첩 allowlist를 사용한다. 운영 계정을 Preview에 재사용하려면 별도 프로젝트 또는 namespace 설계가 필요하다. 이번에 새 프로젝트나 계정을 생성하지 않았다.

## 3. Supabase SQL 초안 검토 — 미적용

대상: `docs/gatherly-2.0/sql/catalog-draft.sql`, `vercel-vault-draft.sql`. 테스트는 임시 PGlite 메모리 DB에서만 실행했다.

| 테이블 | 주요 제약 | 공개/사용자 정책 |
|---|---|---|
| `g2_exhibitions` | UUID PK, published 기본 false | 공개 행사만 조회 |
| `g2_companies` | UUID PK, source_url 필수 | published 및 rights_approved |
| `g2_exhibitors` | 행사·기업 FK, source/external/행사 unique | published 및 부모 행사·기업 RLS 통과 |
| `g2_maps` | 행사 FK, 행사/version unique, SHA-256 형식·양수 크기 | published·권리 승인·부모 행사 |
| `g2_booths` | 행사 FK, 행사/code unique | 공개 행사 소속 부스 코드 조회 |
| `g2_exhibitor_booths` | 참가기업/부스 PK, 행사 포함 복합 FK | 공개 참가기업 및 부스 연결 |
| `g2_hotspots` | 지도·부스와 같은 행사 복합 FK, 0~1 좌표, 지도/부스 unique, 검수자·시각 필수 | verified·공개 지도·공개 참가기업 부스 연결 |
| `g2_admins` | auth.users FK/PK | 본인 관리자 행만 SELECT |
| `g2_entitlements` | 사용자 FK, 3종 kind, remaining ≥ 0 | 본인 행만 SELECT |
| `g2_storage_links` | 사용자 FK/PK | 본인 행만 SELECT |
| `g2_private.vault` | 사용자 FK/PK, revision ≥ 0, lock token/time 동시 NULL 제약 | RLS 활성화, 일반 역할 권한 없음, service_role 서버만 접근 |

public 10개 테이블 모두 RLS를 켜고 일반 역할 쓰기 권한을 명시적으로 회수한다. 공개 카탈로그 7개는 anon/authenticated SELECT, 개인·관리자 3개는 authenticated SELECT와 소유권 정책을 적용한다. 사용자 수정 가능 user_metadata를 관리자 판정에 사용하지 않는다.

관리자 행이 있다고 쓰기 권한이나 보고서 이용권이 생기지 않는다. 관리자도 일반 authenticated 연결로 직접 카탈로그를 수정할 수 없다. service_role은 별도 서버 권한이며 카탈로그 초안에서는 넓은 ALL 권한을 갖는다. 관리자 쓰기 API·감사 로그·관리자 초대/bootstrap 절차는 구현되어 있지 않다. service key 소유를 관리자 UI 접근 검사로 대체하면 안 된다.

vault RPC claim/save/release는 SECURITY INVOKER, 빈 search_path, 완전한 스키마 이름을 사용하며 PUBLIC/anon/authenticated EXECUTE를 회수한다. 저장은 lock token·revision 일치 조건을 사용한다. 사용자 A/B 암호문은 AAD로 분리한다. 단 service_role 자체는 RLS를 우회하므로 API 세션·owner 검증이 필수다. 실제 Data API의 exposed schema와 명시 GRANT를 확인해야 한다. `g2_private`를 공개 스키마 목록에 추가하지 않는다. [Supabase Data API 보안](https://supabase.com/docs/guides/api/securing-your-api)

남은 SQL/운영 조건:

- 두 파일은 일회성 초안이며 재실행 가능한 migration이 아니다. 적용 전 기존 테이블/함수 충돌, 역할·schema 권한, 적용 순서·트랜잭션·복구 계획을 검토해야 한다.
- `g2_entitlements`는 요약 모델이다. 기간형의 expires_at 필수 제약, ONE_TIME 최대 횟수, 쿠폰·예약·확정·감사 테이블/트랜잭션은 없다. v0.5 전체 이용권 스키마가 완료된 것으로 간주하지 않는다.
- source_url은 NOT NULL일 뿐 HTTPS/권리 근거를 DB에서 검증하지 않는다. source_id는 별도 출처 테이블 FK가 아니다. rights 승인 이력·검수자의 관리자 여부를 보장하는 운영 절차가 필요하다.
- 부스 코드는 행사 공개만으로 노출된다. 기업/지도보다 공개 조건이 느슨하므로 행사 발행 시 부스 코드 자체의 공개 권리도 확인한다.
- 사용자 삭제 FK는 자동 cascade 정리 정책이 아니다. 탈퇴·토큰 철회·Google 파일 처리 절차가 별도로 필요하다.
- vault 잔여 잠금은 자동 해제하지 않는다. 함수 종료/claim 응답 유실 후 Google 결과를 먼저 확인하고 수동 복구할 운영자를 지정한다.

## 4. 고정 HTTPS 주소와 OAuth

**코드 경로는 일치하지만 실제 OAuth 성공은 미확인**이다. 프로젝트명 `gatherly`만으로 소유한 도메인을 확정할 수 없어 `gatherly.vercel.app`을 실제 주소로 단정하지 않는다.

| 등록 대상 | 필요한 값/경로 |
|---|---|
| Google 로그인용 OAuth redirect | `https://rmjyonrmlbarvtaazurc.supabase.co/auth/v1/callback` |
| Supabase Site URL | 확정된 운영 HTTPS origin |
| Supabase Redirect URLs | 각 승인된 고정 origin의 `/api/v2/auth/callback` |
| 파일용 Google OAuth redirect | 각 승인된 고정 origin의 `/api/v2/google/callback` |
| 앱 origin 변수 | 현재 접속하는 환경의 고정 HTTPS origin |
| 파일 redirect 변수 | 위 origin과 정확히 같은 `/api/v2/google/callback` |

로그인: POST login → Supabase Google provider → Supabase callback → 앱 auth callback에서 code 교환·사용자 검증·allowlist → `/v2`. 로그인용 client ID/secret은 Supabase provider에 등록한다. [공식 Google 로그인 설정](https://supabase.com/docs/guides/auth/social-login/auth-google)

파일 동의: 로그인 후 POST google/connect → vault에 10분 만료 state/PKCE 저장 → Google `drive.file` 별도 동의 → google/callback에서 로그인 사용자·일회용 state 확인 및 토큰 암호화 저장. Drive/Sheets API 활성화, 테스트 사용자·동의 화면 설정이 필요하다. 로그인 동의만으로 파일 권한을 얻지 않는다.

`origin()`은 HTTPS(로컬 개발 localhost HTTP 예외)를 허용하며 `googleConfig()`는 redirect 일치를 검사한다. API POST는 Origin header 정확 일치가 필요하므로 임의 Preview URL에서 고정 origin 설정을 재사용하면 403이 발생할 수 있다. OAuth 시작·복귀 모두 동일 고정 호스트를 사용하고 넓은 wildcard 허용을 피한다. Preview Deployment Protection이 외부 로그인 복귀를 방해하지 않는지 승인된 테스트 계정에서 확인한다.

## 5. 1MiB 업로드 검증

코드: `browser-media.ts` → `/api/v2/media` → `CloudMediaStorage` → Google resumable upload → `GoogleStorage` Sheets 확정. 서버 디스크에서 파일을 재조립하지 않는다. Google이 Content-Range 기준으로 바이트를 누적하고, 완료 후 크기·SHA-256·소유권·marker를 확인한다.

| 상황 | 로컬 확인 결과 | 실제 서비스에서 남은 확인 |
|---|---|---|
| 6MiB+123바이트 전송 | 준비 1회+청크 7회, 각 ≤1MiB | 실제 multipart 본문 및 함수 제한 |
| 바이트 재조립 | 1MiB+3바이트 fixture 누적 결과 hash 일치 후 Sheets 확정 | Drive 실제 checksum 제공 시점 |
| 청크 응답 유실 | 원격 308 Range 조회 후 이미 받은 청크를 중복 전송하지 않음 | 모바일 끊김/앱 종료 |
| 같은 mutation 재전송 | 동일 file ID/장부 재사용, 완료 후 추가 업로드 없음 | 실제 동시 요청·함수 종료 |
| 다른 내용으로 ID/revision 재사용 | CONFLICT, Sheets 완료 기록 없음 | 실계정 경합 |
| 크기 초과/잘못된 타입/hash 불일치 | INVALID/CONFLICT 차단 | 실제 카메라 MIME·25MiB 상한 |
| Google access token 만료/401 | 갱신 후 1회 재시도 단위 테스트 통과 | 청크 도중 실제 만료/철회 |
| refresh invalid_grant 또는 세션 만료 | REAUTH/UNAUTHORIZED, 큐 BLOCKED_REAUTH 및 로컬 원본 유지 테스트 | OAuth 재연결 후 같은 업로드 재개 E2E |
| Drive 성공 후 Sheets 실패 | 기존 저장 어댑터 복구·중복 방지 테스트 통과 | 청크→실제 Sheets 전체 경로 |

기존 45개는 계층별 테스트다. 청크 전송 중 토큰 만료→실제 재동의→남은 바이트 전송의 단일 종단간 시나리오까지 실행한 것은 아니다. Google 세션 404/410 재시작은 코드 검토로 확인했으며 실제 세션 만료 시험은 남아 있다. 모든 네트워크 장애가 자동 복구된다고 판정하지 않는다.

1MiB는 Google 비최종 청크의 256KiB 배수 조건을 만족하고 Vercel 4.5MB 요청 제한 아래다. 전체 파일은 최대 25MiB, 브라우저 요청은 120초, Google 요청은 30초, 두 저장 API는 최대 300초다. 준비 단계의 여러 호출이나 잔여 잠금이 시간 제한 내 성공을 보장하지 않는다. [Drive 업로드 규약](https://developers.google.com/workspace/drive/api/guides/manage-uploads), [Vercel 함수 제한](https://vercel.com/docs/functions/limitations)

## 6. 이번 재실행 결과와 데이터 보존

| 실행 | 결과 |
|---|---|
| `npm test` | **45/45 PASS**, 실패·skip 0 |
| `npm run typecheck -- --incremental false` | PASS |
| `npm run lint` | 오류 0, 기존 `RefreshCw` 미사용 경고 1 |
| `VERCEL=1 npm run build:vercel` | PASS, Next 16.3.4 webpack |
| Vercel 모드 브라우저 회귀 | PASS: 375/430/1280 폭·지도 양축·기업 선택/드래그 방지·44px 아이콘·메모 수정/취소/기업 고정·사진 5장·가상 마이크·새로고침 복구 |
| 브라우저 HTTP 경계 | `/` → `/v2`, 대표 레거시 DB/API·SW 차단, 비활성 V2 API 확인 |
| SQLite 읽기 전용 회귀 | FieldDay 3, 기업 180, 자료 16 및 연결·미디어 보존 PASS |

빌드: `/private/tmp/gatherly-phase1-2c1-58sruibf/build-source`. 실제 환경파일·DB·자료를 제외한 복사본이며 외부 연동 플래그는 비활성이다. 브라우저 산출물: `/var/folders/rs/6_j362g92j79ssyxdgbmn6rw0000gn/T/gatherly-v2-browser-IQkCrD`. 실제 iPhone·Vercel Node 24 검증은 아니다(로컬 Node 26.0.0).

Prisma client 생성만 수행했고 DB push/migrate/seed는 실행하지 않았다. 공유 node_modules의 client는 검증 후 원본 schema 기준으로 재생성했다. 시작 시 기록한 기존 파일 268개 hash 대조 결과 변경·누락 0개이며, 이 중 환경파일·prisma/storage/backups 보호 대상 46개도 모두 동일하다. node_modules·.next·.git·.omc는 이 비교에서 제외했다. 신규 파일은 이 보고서이며 `git diff --check`도 통과했다.

## 7. Preview 배포 게이트와 확정 작업 순서

### 최초 비활성 Preview도 먼저 필요한 조건

1. Vercel 팀/소유자 및 대상 프로젝트 `gatherly`를 확인하고 고정 Preview HTTPS 주소·접근 보호 범위를 확정한다. 프로젝트 이름만으로 연결 대상을 추정하지 않는다.
2. `/phase-one`은 로그인 없이 제공된 실제 지도 PNG를 정적 번들로 노출한다. **integration false는 지도 공개를 막지 않는다.** 지도 재게시 권리/허용 대상 승인 또는 승인된 테스트 인원으로 배포 접근 보호가 먼저 필요하다. 전체 공개 Preview를 지금 승인 가능한 상태로 보지 않는다.
3. 비밀파일·DB·자료·백업을 제외한 검토된 소스를 준비한다. 기존 미커밋 변경이 많으므로 Git 상태 그대로를 임의 commit/push하거나 다른 변경과 섞어 배포하지 않는다.
4. Next.js, root directory, Node 24.x, `npm run build:vercel`, 두 플래그 false, build/runtime `VERCEL=1`을 확인한다. 초기 Preview에 실제 Google/vault 비밀키를 등록하지 않는다.
5. 정확한 대상·소스·환경·접근 범위를 제시해 **실제 Preview 배포를 별도 승인**받는다. 승인 후 첫 Preview에서 라우트 차단·정적 자산·번들 제외·브라우저 기록 보존을 확인한다. Production 승격은 별도 승인이다.

### 실제 인증·저장 시험을 활성화하기 전

6. Supabase 카탈로그/vault SQL 적용 범위와 복구 계획을 승인받는다. 먼저 역할·기존 객체·Data API 설정을 확인하고 승인된 SQL만 적용한 뒤 실환경 A/B 격리·권한 우회·미발행 데이터 비공개를 시험한다.
7. 고정 도메인 기준 Google 로그인/Supabase redirect를 등록한다. Preview 테스트 UUID와 Production UUID, Google 계정·암호화 키의 공유 여부를 확정한다. 테스트 로그인과 카탈로그 조회부터 진행한다.
8. Google Drive/Sheets API·파일 OAuth 동의 화면·콜백·서버 secret·vault key를 설정한다. 테스트 계정의 실제 폴더/Sheets/파일 생성 범위와 정리 정책을 승인받은 뒤에만 writes 플래그를 활성화한다.
9. 실제 파일 재조립·응답 유실·중복·동시 요청·토큰 철회/재연결·잠금 복구를 검증한다. iPhone Safari 사진·녹음·화면 잠금/복귀·네트워크 재접속을 포함한다.
10. 공식 기업 5건과 실제 핫스팟 좌표·지도 버전·공개 권리를 검수하고, 10월 23일 실증에 사용할 승인 계정/기업/부스만 발행한다. 기존 가상 좌표를 공식 좌표로 승격하지 않는다.

**현재 승인 대기:** 실제 Preview 배포 및 접근 공개 범위, 고정 도메인, 외부 OAuth 설정, SQL 적용, 테스트 계정 Google 쓰기. 공개 베타·운영 배포·AI 보고서 worker 이관·쿠폰/결제는 이 게이트 범위에 포함되지 않는다.

로컬 사전 검증은 완료했으며 외부 시스템 변경 전 여기서 멈춘다.
