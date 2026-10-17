# Gatherly 2.0 — Phase 2B-2 Vercel 배포 준비

작성일: 2026-10-17. 작업 브랜치: `phase2/research-execution-system` 유지.

허용된 로컬 코드 변경과 검증을 완료했다. **실제 Vercel 배포와 Supabase·Google 연동 검증은 미완료**다. DB 변경·마이그레이션, 외부 데이터 쓰기, commit/push/deploy는 실행하지 않았다. 기존 환경파일과 SQLite·미디어·백업을 보존했다.

기준: [PRD v0.5](Gatherly_2.0_PRD_v0.5.md), [SRS v0.5](Gatherly_2.0_SRS_v0.5.md), [Phase 1](PHASE_1_IMPLEMENTATION.md), [아키텍처 경계](ARCHITECTURE_BOUNDARY_PROPOSAL.md), [Phase 2A](PHASE_2A_INTEGRATION_PLAN.md), [Phase 2B-1](PHASE_2B_1_IMPLEMENTATION.md).

이번 사용자 지시에 따라 Tailscale 운영 및 SQLite-only 지침의 신규 서비스 적용을 대체한다. 맥미니는 개발 환경, Vercel은 V2 웹 실행 환경, Supabase는 공식 카탈로그·인증, Google은 개인 자료 저장소다. 레거시 SQLite 경계와 기존 기능은 로컬에 유지하며 AGENTS.md 자체는 수정하지 않았다.

## 1. 배포 영향 감사

| 코드/구성 | Vercel 영향 | 이번 대응 |
|---|---|---|
| `prisma/schema.prisma`, `lib/prisma.ts` | SQLite 파일은 여러 함수 인스턴스의 공유·영속 DB가 될 수 없음 | provider/DB 보존. 클라우드에서 레거시 경로 차단, V2만 제공 |
| `lib/storage.ts`, `storage/`, 기존 자료 API | 사진·녹음·보고서의 로컬 파일 경로는 배포 후 영속 저장을 보장하지 못함 | 기존 파일 보존·업로드 대상 제외. V2는 브라우저 IndexedDB와 Google 저장소 사용 |
| `integration/vault.ts`의 FileVault | 로컬 파일 잠금·암호화 파일은 인스턴스 간 공유되지 않음 | Supabase 암호화 vault 어댑터와 DB 잠금 초안 추가. Vercel에서 file backend 거부 |
| 기존 전체 미디어 `/api/v2/sync` 요청 | 최대 25MiB 파일은 Vercel 함수 요청 제한 초과 | Vercel 전용 1MiB 청크 API 추가. 로컬 기존 프로토콜 보존 |
| 기존 AI 보고서/worker, `scripts/gatherly-server.mjs` | 장기 프로세스·CLI 실행·로컬 출력·폴링·최대 12분 보고서 작업은 요청 단위 함수에 부적합 | worker를 배포 실행 경로로 사용하지 않음. 기존 로컬 보고서 생성·AI 수정·Docs 코드 보존 |
| `app/layout.tsx`, `components/app-shell.tsx`, 기존 SW | 레거시 링크 prefetch 및 광범위한 캐싱이 V2와 혼재 | 클라우드 내비게이션 분리, 클라우드 SW 등록 중단 |
| `next.config.ts` | Tailscale 개발 origin 및 로컬 데이터 번들 포함 가능성 | Tailscale 설정 제거, Vercel 파일 추적 제외 설정 |

Vercel 함수 요청/응답 본문 제한은 4.5MB다. 파일 전체를 한 요청에 보내지 않고 1MiB씩 전송한다. 함수 최대 시간 300초를 지정했지만 이 값은 작업 완료 보장이 아니다. [Vercel 함수 제한](https://vercel.com/docs/functions/limitations)

## 2. 구현한 최소 변경

### 클라우드와 로컬 실행 경계

- `lib/gatherly-2/integration/platform.ts`, `proxy.ts`: `VERCEL=1`일 때 `/` → `/v2`, `/v2`, `/phase-one`, `/api/v2/*` 및 필요한 정적 경로만 허용한다. 레거시 페이지/API·`/storage`·`/sw.js`는 `404 LOCAL_LEGACY_ONLY`로 차단한다. 로컬에는 이 경계를 적용하지 않는다.
- `app/layout.tsx`, `components/app-shell.tsx`: 클라우드에는 V2·프로토타입 링크만 표시한다. 로컬 레거시 내비게이션은 유지한다.
- `vercel.json`, `package.json`: Next.js 프레임워크 및 `npm run build:vercel`(`prisma generate && next build --webpack`) 지정. Prisma client 생성은 레거시 import의 빌드 호환용이며 DB 마이그레이션이 아니다. 기존 start/dev/build 경로는 유지한다.
- `.vercelignore`, `next.config.ts`: `.env`, SQLite, storage, 백업, 로컬 도구 파일 등을 배포 입력/추적에서 제외한다. 공식 지도 PNG와 폰트는 유지한다. 실제 Vercel 빌드 산출물과 배포 방식별 제외 적용은 첫 승인된 Preview에서 재확인해야 한다.

### 인스턴스 간 공유 가능한 인증 저장소

- `lib/gatherly-2/integration/supabase-vault.ts`, `runtime.ts`: 인증 사용자의 Google 토큰·OAuth 상태·동기화 장부를 AES-256-GCM 암호문으로 저장한다. 개인 사진·녹음·메모 본문은 vault에 저장하지 않는다. Vercel 기본 backend는 Supabase이며 로컬 기본 FileVault는 유지한다.
- `docs/gatherly-2.0/sql/vercel-vault-draft.sql`: **미적용 SQL 초안**. `g2_private.vault`와 claim/save/release RPC, 사용자별 잠금 및 revision 비교를 정의한다. 일반 anon/authenticated의 테이블·RPC 접근을 차단하고 서버 전용 service_role만 허용한다. RPC는 SECURITY INVOKER이며 사용자용 RLS 카탈로그 클라이언트와 분리한다.
- 서버 비밀키는 검증된 세션을 통과한 코드에서만 사용한다. 관리자 권한·사용자 이용권을 이 키로 대체하지 않는다. 기존 `catalog-draft.sql`도 여전히 미적용이다.
- 함수 강제 종료 또는 claim 응답 유실 시 잠금이 남을 수 있다. 자동 만료/탈취는 하지 않는다. 외부 업로드 결과를 확인한 뒤 잠금을 복구할 운영 절차가 필요하다.

### 사진·녹음의 분할 업로드

- `app/api/v2/media/route.ts`, `cloud-media.ts`, `browser-media.ts`: 같은 origin·로그인·허용 사용자·기업/행사 연결을 검증한 뒤, Google resumable upload에 최대 1MiB 청크를 전달한다. 전체 파일 제한 25MiB는 유지한다.
- `browser-sync.ts`, `components/gatherly-2/connected-field.tsx`, `app/v2/page.tsx`: Vercel에서만 청크 경로를 선택한다. IndexedDB 기록과 기존 수동 동기화 큐를 유지한다.
- `storage.ts`, `vault.ts`: 업로드 세션·파일 ID·내용 hash·진행 상태를 저장하고, 원격 offset 조회로 응답 유실과 재시도를 복구한다. 토큰·업로드 세션 URL은 브라우저에 노출하지 않는다.
- Drive 소유권·파일 크기·SHA-256·요청 marker를 확인한 뒤 Sheets 참조를 확정한다. checksum 미제공은 재시도, 불일치는 충돌로 처리한다. [Drive 파일 메타데이터](https://developers.google.com/workspace/drive/api/reference/rest/v3/files)
- `/api/v2/sync`는 Vercel의 전체 미디어 요청을 거부하며 메모는 기존 경로를 사용한다. 로컬 전체 파일 업로드 경로는 유지한다. 두 API는 Node runtime과 maxDuration 300을 명시한다.

## 3. Vercel 환경변수와 외부 설정

템플릿: [`.env.vercel.example`](.env.vercel.example). 실제 키 값은 기록하지 않았다. 아래 존재 여부는 로컬 환경파일 검사 결과이며 값의 유효성·플래그 상태·등록 프로젝트 일치 검증을 뜻하지 않는다.

| 변수 | 용도 | 로컬 존재 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | SSR/브라우저 Supabase URL | 있음 |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 공개 가능 클라이언트 키 | 있음 |
| `GATHERLY_V2_APP_ORIGIN` | 고정 Vercel HTTPS origin, 끝 `/` 없이 설정 | 있음 |
| `GATHERLY_V2_INTEGRATION_ENABLED` | 초기 `false`, 승인된 인증/카탈로그 시험에서 활성화 | 있음 |
| `GATHERLY_V2_GOOGLE_WRITES_ENABLED` | 초기 `false`, 별도 Google 동의·저장 시험 승인 후 활성화 | 있음 |
| `GATHERLY_V2_ALLOWED_USER_IDS` | 현장 시험 Supabase 사용자 UUID 허용 목록 | 있음 |
| `GATHERLY_V2_VAULT_BACKEND` | Vercel은 `supabase` | 없음 |
| `GATHERLY_V2_SUPABASE_SECRET_KEY` | private vault RPC용 서버 전용 키 | 없음 |
| `GATHERLY_V2_TOKEN_ENCRYPTION_KEY` | 32바이트 키의 base64, 인스턴스 간 동일 유지 | 없음 |
| `GATHERLY_V2_GOOGLE_CLIENT_ID` | 파일 접근용 별도 OAuth client | 없음 |
| `GATHERLY_V2_GOOGLE_CLIENT_SECRET` | 파일 접근용 서버 전용 secret | 없음 |
| `GATHERLY_V2_GOOGLE_REDIRECT_URI` | 고정 origin + `/api/v2/google/callback` | 없음 |

Supabase 프로젝트는 `gatherly-prod` (`rmjyonrmlbarvtaazurc`)를 전제로 한다. Publishable Key만으로 서버 vault RPC를 실행할 수는 없다. Secret Key는 NEXT_PUBLIC 이름으로 등록하지 않으며, 카탈로그 조회·SSR 로그인 자체에는 필요하지 않다.

Production과 Preview 환경변수를 구분한다. 승인 전 Preview는 두 플래그를 `false`로 두고 실제 Google/vault 비밀키를 넣지 않는다. 임의 Preview URL을 운영 OAuth에 광범위한 wildcard로 허용하지 않는다. 실제 도메인은 아직 확정하지 않았으므로 `gatherly-prod.vercel.app` 등으로 추정하지 않았다. `VERCEL`은 플랫폼 제공 값이며 로컬 `.env`에 추가하지 않는다. 시스템 환경변수 노출 설정을 확인해야 클라우드 경계가 적용된다.

`DATABASE_URL`, 로컬 storage/vault 경로, 기존 `GATHERLY_GOOGLE_REFRESH_TOKEN`, worker 설정은 Vercel에 복사하지 않는다. 암호화 키 변경은 기존 vault 복호화에 영향을 주므로 별도 회전/복구 계획이 필요하다.

Vercel 프로젝트는 Next.js, 저장소 루트, 지정 build command를 사용한다. Node.js 24.x 설정을 권장하지만 이번 로컬 실행은 Node.js 26.0.0이었다. Vercel의 실제 Node 24 런타임 검증은 남아 있다. [지원 Node 버전](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)

## 4. OAuth 콜백 확인

| 구분 | 등록 위치 | 정확한 경로 |
|---|---|---|
| Google 로그인 → Supabase | Google Console 로그인용 OAuth client의 Authorized redirect URI | `https://rmjyonrmlbarvtaazurc.supabase.co/auth/v1/callback` |
| Supabase → Gatherly | Supabase Auth URL Configuration의 Redirect URLs | `https://<고정-Vercel-도메인>/api/v2/auth/callback` |
| 기본 앱 origin | Supabase Site URL 및 `GATHERLY_V2_APP_ORIGIN` | `https://<고정-Vercel-도메인>` |
| Google 파일 접근 → Gatherly | 파일용 Google OAuth client의 Authorized redirect URI 및 `GATHERLY_V2_GOOGLE_REDIRECT_URI` | `https://<고정-Vercel-도메인>/api/v2/google/callback` |

로그인은 `app/api/v2/auth/login/route.ts` → Supabase Google provider → `app/api/v2/auth/callback/route.ts` 경로다. Google 로그인 client ID/secret은 Supabase provider 설정에 등록한다. [Supabase Google 로그인 설정](https://supabase.com/docs/guides/auth/social-login/auth-google)

파일 접근은 로그인 이후 `/api/v2/google/connect`의 별도 동의 흐름이며 `drive.file` scope를 사용한다. Google Drive API와 Sheets API 활성화, 동의 화면·테스트 사용자·정확한 redirect URI 설정이 필요하다. 파일용 client ID/secret은 위 Vercel 서버 변수에 등록한다. 로그인 동의만으로 Drive/Sheets 저장 권한이 생기지 않는다. Preview 보호 설정이 OAuth 콜백을 방해하지 않는지도 승인된 테스트 도메인에서 확인해야 한다.

## 5. 검증 결과

| 검증 | 결과 |
|---|---|
| `npm test` | **45/45 통과**: 기존 39개 유지 + 신규 6개 |
| `npm run typecheck -- --incremental false` | 통과 |
| `npm run lint` | 오류 0, 기존 경고 1: `components/analysis-brief-workspace-unified.tsx`의 미사용 `RefreshCw` |
| `VERCEL=1 npm run build:vercel` | 환경파일·DB·미디어를 제외한 격리 복사본에서 통과 |
| Vercel 모드 Chromium 브라우저 검증 | 통과: 375/430/1280 폭, 지도 양축 스크롤·선택·드래그, 44px 아이콘, 메모 생성/수정/취소/기업 고정/새로고침, 합성 사진·가상 마이크·녹음 복구 |
| 클라우드 경계 브라우저 검증 | `/` → `/v2` 307, 레거시 API/페이지·SW 404, 비활성 V2 화면 및 API 503 확인 |
| 기존 데이터 회귀 및 보존 | FieldDay 3·기업 180·자료 16 및 파일 연결 검사 통과. 기존 `.env*`·prisma/storage/backups 보호 대상 46개 hash 동일 |
| `git diff --check` | 통과 |

신규 테스트는 `tests/vercel-readiness.test.ts`, `tests/vercel-media.test.ts`다. PGlite 메모리 DB에서 실제 초안 SQL의 RPC 권한 차단·다중 인스턴스 잠금·revision·암호화 사용자 격리를 검증했다. Google HTTP fixture로 6MiB 초과 파일의 청크 분할, 토큰 오류, 응답 유실 후 offset 복구, 중복 완료, hash 충돌과 잘못된 요청 차단을 검증했다. 실제 Supabase 및 Google 서버에서 검증한 결과는 아니다.

빌드 복사본: `/private/tmp/gatherly-phase1-vercel-pg8n99iu/build-source`. 브라우저 산출물: `/var/folders/rs/6_j362g92j79ssyxdgbmn6rw0000gn/T/gatherly-v2-browser-Bz7aH9`. 복사본 빌드에서 공유 node_modules의 Prisma client가 생성되므로 종료 후 원본 schema 기준 client를 재생성했다. DB 생성·초기화·마이그레이션 명령은 실행하지 않았다.

## 6. 회귀 위험과 남은 검증

- Vercel에서는 레거시 FieldDay·자료수집함·AI 보고서 페이지/API를 제공하지 않는다. 이 기능은 기존 코드·데이터와 함께 맥미니 개발 환경에 보존되어 있다. 전체 레거시 서비스를 Vercel로 이관한 상태가 아니다.
- 로컬과 Vercel은 origin이 달라 기존 IndexedDB 자료가 자동 이동하지 않는다. 데모 기록을 실제 계정에 자동 귀속시키지 않는다. Vercel의 SW 등록 중단으로 첫 접속부터 오프라인 사용을 보장하지 않는다.
- Google 업로드 완료 후 checksum 제공 지연은 재시도를 유발할 수 있다. 반복 청크 호출은 함수 실행량·대역폭·Google quota를 사용한다. 실제 모바일 네트워크의 중단/재접속·토큰 만료·콜드 스타트 검증이 필요하다.
- 함수 강제 종료의 잔여 vault 잠금 복구, 암호화 키 관리, 사용자별 장부 증가에 대한 운영 기준이 필요하다. 잠금 자동 탈취를 추가하면 외부 중복 쓰기 위험을 다시 검토해야 한다.
- 기존 Sheets read/PUT 사이의 외부 직접 편집 경합은 남아 있다. 앱의 사용자별 잠금이 Google Sheets에서 사용자가 직접 편집하는 행까지 잠그지는 못한다.
- 실제 RLS/Data API 권한, Vercel Node 24, OAuth 쿠키·리디렉션·Preview 보호, Drive/Sheets 실제 파일 생성은 미검증이다. 브라우저 가상 마이크 시험은 iPhone Safari의 실제 녹음/권한/백그라운드 복귀 검증을 대체하지 않는다.
- 지도 원본·가상 기업·핫스팟을 유지했다. 공식 참가기업 5건의 좌표와 권리는 미검수 상태이며 클릭 가능한 공식 핫스팟으로 게시하지 않았다.

## 7. 승인 후 구현·검증 순서

1. 고정 Preview/운영 도메인과 Vercel Node 24 설정을 확정한다. 초기 플래그 false 상태의 `/phase-one` Preview 배포를 별도 승인받는다.
2. Supabase Auth Google provider·redirect 설정을 확인하고 테스트 사용자 UUID를 등록한다. 카탈로그 SQL 및 private vault SQL은 검토·승인 후에만 적용한다.
3. 실제 카탈로그 조회/RLS·사용자 간 격리·SSR 세션을 배포 환경에서 검증한다. 공식 데이터·지도 자산의 공개 권리 및 좌표 검수는 별도 승인 대상이다.
4. Google 파일 OAuth 설정과 서버 비밀키·암호화 키를 등록한다. 테스트 계정의 실제 폴더/Sheets/미디어 생성 범위와 정리 방법을 승인받은 후 저장 플래그를 활성화한다.
5. iPhone에서 사진·실제 녹음·메모·지도·재시도·토큰 만료·앱 복귀를 시험한다. 실패 시 로컬 미동기화 원본이 남고 복구 후 중복이 없는지 확인한다.

**10월 23일 현장 실증 필수:** HTTPS 고정 주소, 승인 사용자 로그인, 별도 파일 동의, 실제 폴더/Sheets 생성, 메모/사진/녹음 저장·복구, 기업 ID 및 검수된 부스 선택, iPhone 권한·네트워크 시험. 공식 지도 검수가 끝나지 않으면 가상 데모를 실제 현장 지도처럼 사용하지 않는다.

**공개 베타 이후로 분리:** 전체 레거시 이관, 장시간 AI 보고서 worker의 클라우드 실행, 실제 결제·쿠폰·이용권 서비스, 대규모 디렉토리 수집, 자동 잠금 복구·운영 관리 화면, 전체 오프라인 서비스.

이번 작업은 로컬 구현·검증까지 완료했다. 다음 단계의 실제 배포·DB 적용·OAuth 외부 설정·Google 파일 쓰기는 실행하지 않고 승인 대기 상태로 남긴다.
