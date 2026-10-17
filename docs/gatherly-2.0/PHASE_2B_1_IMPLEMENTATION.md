# Gatherly 2.0 — Phase 2B-1 구현 결과

작성일: 2026-10-17. 브랜치: `phase2/research-execution-system` 유지.

기준: [PRD v0.5](Gatherly_2.0_PRD_v0.5.md), [SRS v0.5](Gatherly_2.0_SRS_v0.5.md), [Phase 1](PHASE_1_IMPLEMENTATION.md), [경계 수정안](ARCHITECTURE_BOUNDARY_PROPOSAL.md), [Phase 2A 계획](PHASE_2A_INTEGRATION_PLAN.md).

**실제 API를 호출할 수 있는 코드와 로컬 검증을 구현했다. 외부 연동은 기본 비활성화이며 실제 Supabase/Google 연결 성공을 의미하지 않는다.** 환경 설정·테스트 계정 승인을 받은 뒤 실제 서비스에서 검증해야 한다. 기존 SQLite/자료/보고서 경로를 보존했고 DB 마이그레이션·운영 Supabase 변경·실제 Google 파일 쓰기·배포·commit·push는 하지 않았다.

## 1. 구현 완료

### 인증과 경계

| 경로 | 구현 |
|---|---|
| `lib/gatherly-2/auth/server.ts` | Supabase SSR cookie client. `getUser()`로 서버 인증/현재 사용자 확인, 익명 사용자 차단, 실증 사용자 allowlist 적용 |
| `proxy.ts` | `/v2/**`, `/api/v2/**`에만 세션 갱신·응답 cookie 전달·private/no-store. 레거시 경로는 matcher에 포함하지 않음 |
| `app/api/v2/auth/login/route.ts` | POST Google 로그인, 동일 origin 검사, SDK PKCE OAuth 시작 |
| `app/api/v2/auth/callback/route.ts` | code/session 교환, 사용자 검증, allowlist 외 계정은 로그아웃, 고정 `/v2` redirect |
| `app/api/v2/auth/logout/route.ts` | 동일 origin POST 로그아웃. 로컬 미전송 자료 자동 삭제 없음 |
| `lib/gatherly-2/integration/config.ts` | 기본 비활성화, env 누락 시 fail closed, 허용 origin/사용자 검사, 비밀값 없는 오류 코드 |
| `app/v2/page.tsx` | 비활성 안내 또는 SSR 로그인/승인 카탈로그 화면. 실제 화면을 Phase 1 데모와 구분 |

Supabase Auth와 Google 파일 접근은 별개 흐름이다. 로그인에는 파일 scope를 추가하지 않고, 저장소 연결 버튼에서 `drive.file` 동의를 별도로 요청한다. 브라우저가 제출한 사용자 ID로 서버 인증을 대체하지 않는다. 저장 요청의 `expectedUserId`는 검증된 세션과 **일치 여부만** 검사하여 계정 변경 후 이전 탭의 자료가 다른 계정으로 전송되는 것을 막는다.

AGENTS.md는 덮어쓰지 않았다. 기존 SQLite-only 지침은 레거시에 유지하고, 이번 명시적 지시에 따라 신규 Supabase/Google **코드·초안·로컬 테스트**를 추가했다. 실제 DB/설정 변경 승인은 포함하지 않는다.

### PostgreSQL 초안과 카탈로그

- `docs/gatherly-2.0/sql/catalog-draft.sql`: **검토용 초안**. migrations 디렉터리에 넣지 않았고 운영 DB에 적용하지 않았다.
- `g2_exhibitions`, `g2_companies`, `g2_exhibitors`, `g2_maps`, `g2_booths`, `g2_exhibitor_booths`, `g2_hotspots`를 분리했다. 행사별 부스번호와 기업/출전사 ID를 구분하며 복수·공동 부스를 다대다로 표현한다.
- 복합 FK로 다른 행사의 기업/부스/지도 연결을 거절한다. 정규화 사각형 범위, 이미지 SHA-256/버전, VERIFIED 검수자/시각을 검사한다.
- 모든 테이블에 RLS, 명시적 GRANT/REVOKE를 적용한다. 미발행·권리 미승인 기업/지도와 부모가 비공개인 출전사/핫스팟은 일반 조회에서 제외된다.
- `g2_admins`와 `g2_entitlements`는 독립 테이블이다. 관리자도 이용권을 자동 취득하지 않는다. 일반 사용자는 본인 역할/이용권/연결 상태만 읽고 직접 변경할 수 없다. `user_metadata`를 권한 근거로 사용하지 않는다.
- `g2_storage_links`는 최소 연결 상태 초안이다. 현재 런타임은 여기에 쓰지 않는다. 토큰·메모·사진·녹음 본문은 공개 PostgreSQL 테이블에 넣지 않는다.
- `lib/gatherly-2/integration/catalog.ts`: 사용자 세션/RLS로 카탈로그를 읽고 기존 `PublicCatalogRepository` 계약으로 변환한다. 제공 이미지의 SHA-256과 승인된 지도 행이 일치할 때만 해당 지도 핫스팟을 조회한다. 공동 부스는 선택 UI의 다기업 처리 전까지 목록으로 접근한다.

스키마 초안에는 쿠폰 발급/예약/정산의 운영 트랜잭션을 구현하지 않았다. 기존 `access.ts` Mock 정책과 레거시 보고서 코드는 그대로이며, 신규 실제 AI 실행 경로도 열지 않았다.

### 개인 Google 동의·토큰·저장

| 경로 | 구현 |
|---|---|
| `app/api/v2/google/connect/route.ts`, `callback/route.ts` | 로그인과 별도 파일 동의, 무작위 state·PKCE·10분 만료·단일 사용 검증, 서버 코드 교환 |
| `lib/gatherly-2/integration/google.ts` | 최소 `drive.file` scope, offline refresh token, 만료 전 갱신, 401 후 1회 갱신 재시도, invalid_grant/권한 철회 시 REAUTH |
| `lib/gatherly-2/integration/vault.ts` | 사용자 ID를 AAD로 한 AES-256-GCM. 개인별 암호화 토큰·Google 파일 ID·멱등성 ledger, 0700 디렉터리/0600 파일, atomic rename, 단일 호스트 파일 잠금 |
| `lib/gatherly-2/integration/runtime.ts` | 승인용 설정/쓰기 스위치 검사 후 사용자 vault와 API 어댑터 결합 |
| `lib/gatherly-2/integration/storage.ts` | 개인 Gatherly→행사 폴더→Spreadsheet 생성/재사용, Photos/Recordings 폴더, 파일 업로드, notes/assets 행 저장·검증 |
| `app/api/v2/sync/route.ts` | 세션/allowlist/origin/예상 사용자/출전사·행사 검사 후 동기화. 임의 Google 파일 ID를 입력받지 않음 |

실제 API endpoint를 사용하는 fetch 어댑터이며 로컬 테스트에서는 HTTP transport를 주입해 응답을 재현했다. 기존 서버 공통 `GATHERLY_GOOGLE_*` 자격증명을 사용하지 않는다.

폴더/시트는 사용자 범위를 포함한 appProperties 식별자로 찾는다. 생성 요청의 응답이 사라지면 pending 상태를 보존하고 기존 결과를 조회한다. 결과가 보이지 않는 동안 새 생성 요청을 반복하지 않는다. 미디어는 Drive generateIds 결과를 먼저 기록하고 resumable session URL도 암호화 ledger에 보존한다. 재시도 시 기존 파일 또는 업로드 진행 범위를 확인하고 남은 바이트를 전송한다. Drive 저장 후 Sheets 실패는 파일 ID를 유지한다.

Sheets는 `RAW`로 입력해 메모가 수식으로 실행되지 않게 한다. 행 번호만으로 자료를 식별하지 않고 record_id를 검색한다. 최초 저장은 행 위치를 ledger에 먼저 예약한 뒤 PUT하므로 응답 유실 시 같은 행을 확인/재사용한다. 동일 revision·다른 payload는 CONFLICT, 이미 성공한 mutation은 같은 결과를 반환한다. 원격 행 내용이 마지막 동기화 내용과 다르면 자동 덮어쓰지 않는다. 현재 notes/assets 열은 record_id, field_day_id, exhibitor_id, title, text, drive_file_id, sync_revision, mutation_id, payload_hash다.

**운영 선택:** Phase 2A의 서버 전용 토큰 보관소를 맥미니 단일 서버용 암호화 파일 vault로 구체화했다. 개인 메모/미디어 본문은 vault에 저장하지 않고 ID·해시·상태만 보관한다. 디렉터리는 저장소/공개 정적 경로 밖에 지정해야 한다. 다중 서버·서버리스 배포에는 이 구현을 그대로 사용하면 안 된다. 별도 승인 후 공유 잠금·내구성 있는 서버 전용 vault로 교체해야 한다.

### IndexedDB와 화면 연결

- 기존 `gatherly-v2-phase1-local` 및 레거시 `gatherly-upload-queue`를 보존한다. 실제 연결 화면은 별도 `gatherly-v2-connected-local`을 사용한다. 데모 자료를 실제 계정으로 자동 전송하지 않는다.
- `browser-storage.ts`에 전송 snapshot과 완료 처리 트랜잭션을 추가했다. 전송 중 새 메모가 저장되어도 과거 완료 응답이 최신 queue revision을 덮지 않는다. 페이지를 다시 열어도 같은 전송 snapshot을 재사용한다.
- `integration/browser-sync.ts`: Web Locks로 탭 간 전송 직렬화, 사용자별 조회, 불변 snapshot 전송, 제한된 backoff, 재인증/충돌/재시도 상태 표시. 자동 무한 재시도는 없으며 현재는 명시적 **개인 Google 동기화 · 재시도** 버튼으로 실행한다.
- `components/gatherly-2/connected-field.tsx`와 기존 `field-prototype.tsx`의 선택적 연결 모드로 기존 지도·카드·스피커/카메라/마이크/A UI를 공유한다. 기존 `/phase-one` 기본 모드는 그대로 로컬 데모다.
- `note-sheet.tsx`는 부모의 저장소를 주입받아 연결 화면의 기업 고정 메모를 같은 사용자 DB에 저장한다. 작성·수정·취소·초안 복원을 유지한다.
- 실증용 V2 현장은 **사용자별 + 승인된 exhibition ID**를 작업 공간으로 사용한다. 레거시 FieldDay ID를 변환/덮어쓰지 않는다. 별도 사용자 FieldDay 생성/전체 SRS 개인 시트 탭은 후속 범위다.
- 사진은 기존 UI 파일당 10 MiB 제한, 서버 미디어 요청은 25 MiB 제한이다. 메모 500자·제목 120자·UUID·revision을 서버에서도 검증한다. 이 제한을 넘거나 녹음 저장이 실패해도 로컬 원본을 자동 삭제하지 않는다.

### 지도 매핑 준비

`docs/gatherly-2.0/booth-mapping-review.json`에 Phase 2A에서 확인한 공식 5건의 ID/이름/부스와 출처 URL 패턴을 기록했다. 에코에이블컨설팅의 G-111/H-111을 한 기업의 복수 부스로 유지했다. 모두 geometry=null, rights=UNKNOWN, publicationApproved=false다. 이 파일은 앱이 import하지 않는 내부 검토용 자료다.

제공 PNG는 변경하지 않았다. 실제 좌표를 추측하지 않았으며 실제 핫스팟 발행은 **0건**이다. `map.ts`는 기업이 없는 hotspot도 안전하게 거절하도록 보완했다. 공식 음원/대본 승인 전에는 연결 화면의 스피커가 준비 중 안내만 한다. Phase 1 테스트 음성을 공식 해설로 제공하지 않는다.

## 2. 로컬 검증

| 검사 | 결과 | 검증 범위 |
|---|---|---|
| `npm test` | **PASS 39/39** | 기존21 유지 + 신규18. 인증·토큰·암호화/잠금·RLS·저장 복구·IndexedDB 경쟁·지도 매핑 |
| `npm run typecheck -- --incremental false` | PASS | 원본 tsbuildinfo 갱신 없이 전체 타입 검사 |
| `npm run lint` | PASS, 기존 경고1 | `components/analysis-brief-workspace-unified.tsx` RefreshCw 미사용. 신규 오류/경고 없음 |
| `npm run build` | PASS | 격리 소스 복사본의 Next.js webpack 프로덕션 빌드. 실제 DB/storage/.env 미복사 |
| Chrome 브라우저 회귀 | PASS (캡처 보완 후 재실행) | 375/430/1280px, 양축·네 모서리 이동, 탭/드래그 구분, 4아이콘 터치 영역, 메모 고정/수정/취소/초안, 합성 사진5개/가상 마이크/재로드 |
| V2 비활성 상태 HTTP/화면 | PASS | `/v2` 준비 화면, login/Google connect/sync POST는 503 DISABLED. 실제 쓰기 없음 |
| 실제 Supabase/Google·iPhone | NOT_RUN | 다음 절의 승인/실기기 검증 대기 |

RLS 테스트는 `@electric-sql/pglite`의 **새 메모리 PostgreSQL**에 초안 SQL을 실행한다. auth.users/auth.uid와 anon/authenticated/service_role은 테스트 전용으로 구성했다. A/B 간 조회 격리, 사용자 역할 승격/소유권 변경/카탈로그 변경 거절, 관리자≠이용권, 미승인 부모 지도 비노출, 타 행사 FK 거절을 검사했다. 실제 Supabase Auth/PostgREST 설정과 같은 환경이라고 주장하지 않는다.

신규 파일:

- `tests/integration-auth.test.ts`: 인증 실패/익명 사용자/allowlist/origin, state·PKCE·만료, 암호화 사용자 결합, 잠금·토큰 갱신·401·invalid_grant, 계정 변경 차단.
- `tests/integration-rls.test.ts`: 실제 SQL 엔진에서 정책/GRANT/FK 검증.
- `tests/integration-storage.test.ts`: 오프라인 revision 건너뜀, 동일 요청 중복/다른 payload 거절, Drive/Sheet 응답 유실, 불확실 생성 조회 복구, 직접 편집 충돌, partial upload 재개.
- `tests/integration-browser-queue.test.ts`: IndexedDB snapshot·편집·재시작·과거 응답 처리, 재인증 후 수동 복구.
- `tests/integration-map.test.ts`: 공식 5건 미발행, 복수 부스 보존, geometry 없음, 제공 이미지 해시, 기업 ID/지도 버전 불일치 차단.

최종 재실행 도중 한 차례 `Page.captureScreenshot`의 12초 시간 초과가 있었다. 페이지 이미지/폰트 로딩과 활성 탭 확인을 추가하고 캡처 제한을 30초로 조정한 뒤 같은 최종 빌드로 전체 회귀를 통과했다. 원인을 제품 오류로 확정하지 않았으며 실패 실행을 PASS로 계산하지 않았다. 최종 스크린샷/프로필은 `/var/folders/rs/6_j362g92j79ssyxdgbmn6rw0000gn/T/gatherly-v2-browser-wgccjb/`에 있다.

브라우저 검증은 현재 `scripts/tests/phase1-browser.mjs`를 실행했다. 해당 스크립트에 V2 비활성 화면/API 검사를 추가했다. 실제 Google 로그인 화면과 연결된 카탈로그/Google 저장의 브라우저 E2E는 실행하지 않았다. 최초 타입/린트 검사에서 환경변수 테스트 타입과 React JSX try/catch·render ref 사용 오류를 발견해 수정했고 최종 검사는 통과했다.

재현 명령:

```sh
npm test
npm run typecheck -- --incremental false
npm run lint
# 실제 환경파일·DB·storage를 제외한 격리 복사본에서:
npm run build
# 루트에서 임시 Chrome/loopback 서버 실행 권한 필요:
PHASE1_BUILD_SOURCE=/private/tmp/gatherly-phase1-2b1-kg9noy8p/build-source node scripts/tests/phase1-browser.mjs
```

설치 버전은 package.json/lockfile에 고정했다: `@supabase/ssr 0.12.7`, `@supabase/supabase-js 2.118.0`; 테스트 전용 `@electric-sql/pglite 0.5.10`, `fake-indexeddb 6.2.6`. 설치 시 lifecycle script는 실행하지 않았다. 기존 테스트 스크립트와 의존성은 유지했다.

## 3. 환경 설정 대기 — 아직 실행하지 않음

템플릿: [`docs/gatherly-2.0/.env.v2.example`](.env.v2.example). 실값은 기록하지 않았다.

1. Gatherly 전용 Supabase 프로젝트/리전, Data API 노출 테이블/GRANT/RLS 검토. `catalog-draft.sql`은 승인 후 새 V2 프로젝트에 적용할 초안이며 기존 SQLite 마이그레이션이 아니다.
2. Supabase Google provider용 OAuth 클라이언트와 `https://<project>.supabase.co/auth/v1/callback` 등록. 앱 Site URL과 `${APP_ORIGIN}/api/v2/auth/callback` allowlist를 정확하게 설정한다.
3. 파일 동의용 Google OAuth 웹 클라이언트, Drive/Sheets API, 테스트 사용자, consent screen와 `drive.file` 범위. 별도 callback은 `${APP_ORIGIN}/api/v2/google/callback`이다. 로그인 callback과 혼동하지 않는다.
4. 신뢰 가능한 Tailscale HTTPS origin. 이번에는 외부 공개/터널/배포를 하지 않았다. 모바일 마이크·쿠키·redirect 허용 환경을 먼저 확인한다.
5. 승인 계정의 Supabase UUID allowlist, 32바이트 암호화 키, 서버 전용 vault 디렉터리/권한·백업·키 회전·복구 절차. 서버리스/다중 인스턴스 사용 금지 경계를 확인한다.
6. 공식 지도/기업 사용권, 게시 승인, 실제 지도 버전과 이미지 SHA 일치, 운영자 좌표 검수. 기존5건은 권리 UNKNOWN이므로 자동 발행하지 않는다.
7. 검토 후 `GATHERLY_V2_INTEGRATION_ENABLED=true`로 인증/조회만 활성화한다. **실제 파일 생성 승인 후에만** `GATHERLY_V2_GOOGLE_WRITES_ENABLED=true`를 설정한다. 이번 작업은 둘 다 설정하지 않았다.

기존 `DATABASE_URL`, `GATHERLY_GOOGLE_*`, Gemini/OAuth 실키를 변경하지 않는다. 런타임 카탈로그 조회에는 Supabase service secret이 필요 없으며 사용자 JWT/RLS를 쓴다. 템플릿의 관리자 secret/DB URL 주석은 추후 승인된 관리 도구용이다.

## 4. 외부 연동 테스트 대기

승인 대상은 테스트 계정 A/B, 전용 Supabase 프로젝트, 생성 가능한 Drive 폴더/Sheet와 파일 종류/용량, 실패 후 정리 범위다. 다음 검증을 통과하기 전 실제 연동 완료 또는 현장 사용 준비 완료로 표시하지 않는다.

- Auth 로그인/로그아웃/만료 refresh/철회, callback 변조·재전송·미허용 사용자, 동일 브라우저 계정 교체. 실제 SDK cookie 왕복과 프록시 동작 확인.
- Supabase REST로 anon/A/B/admin 직접 조회·변경/역할 위조 시도. 실제 Data API 노출/GRANT/RLS/복합 FK·관계 select 확인.
- Google 동의 거부/재연결/토큰 만료/invalid_grant. 기존 파일이 있는 상태에서 다른 Google 계정으로 바꾸면 소유권 확인에 실패해야 한다.
- 실제 개인 폴더/Sheet 생성, 사진5장/녹음파일, 원본 파일과 Sheet 참조 대조. 사용자 A가 B의 자료를 볼 수 없어야 한다. 시트 scope와 API enable 설정도 확인한다.
- 429/5xx/응답 유실/업로드 부분 완료/세션 만료/재시작. 실제 Drive 결과 조회와 resumable 상태·동일 ID 재전송 동작을 확인한다.
- Sheets 직접 정렬/수정/삭제, 중복 ID, 동기화 중 새 로컬 메모. 로컬과 원격 결과/미완료 상태를 대조한다.

## 5. iPhone 검증 대기 — 10월 23일 필수

- Safari 실제 양축 팬/부스 탭/회전과 한글 조합·키보드·바텀시트 저장 버튼 가림.
- 카메라/앨범 사진5장, HEIC/큰 파일·미리보기·10 MiB 한도 안내.
- 녹음 동의·3분 녹음·중지·미리듣기, Bluetooth/통화/잠금/백그라운드 중단, 오디오 재생과 녹음 경합.
- Tailscale HTTPS에서 로그인/별도 동의/쿠키·Web Locks 지원, LTE 단절 후 복구·브라우저 재시작·기기 저장 공간 부족.
- 실제 개인 Google 파일과 Sheet 행 수를 확인하고, 로컬 대기/실패 상태가 성공처럼 표시되지 않는지 점검.

## 6. 남은 제한과 운영 위험

- Google/외부 시스템 성공 여부는 아직 미검증이다. 로컬 HTTP 응답 재현 테스트는 실제 quota·scope·Google 정책·Supabase 프로젝트 설정을 대신하지 않는다.
- 암호화 vault는 단일 호스트 영속 디스크 전제다. 프로세스 비정상 종료로 `.lock`이 남으면 자동 탈취하지 않고 RETRY로 차단한다. **기존 작업 종료와 Google 결과를 확인한 후** 운영자가 잠금을 해제해야 한다. 키/ledger 유실 시 새 파일 생성을 진행하지 말고 기존 결과를 먼저 대조한다. OS 전원 장애까지의 내구성/백업 복원은 별도 검증 대상이다.
- Sheets API에는 DB 수준의 compare-and-set이 없다. 조회 시 확인되는 원격 변경은 충돌로 차단하지만, 조회와 PUT 사이에 다른 사람이 직접 편집하는 경쟁을 원자적으로 막지는 못한다. 현장 실증에서는 동기화 중 시트 직접 편집을 피하고, 공개 베타 전 버전 이력/충돌 선택 UX를 보완해야 한다.
- 불확실한 폴더/시트 생성 결과가 조회되지 않으면 자동 새 생성보다 대기를 선택한다. 사용자 취소·잘못된 입력 등 확정 실패의 운영 복구 화면은 후속이다. CONFLICT 상태는 원본을 보존하며 현재 자동 병합하지 않는다.
- 동기화는 명시적 버튼 방식이다. 자동 백그라운드 동기화·완전 오프라인 첫 실행·웹 저장소 퇴거 대응은 미구현이다. 원격 성공 뒤 로컬 원본도 자동 제거하지 않는다.
- 현재 개인 Sheet는 notes/assets의 실증용 최소 계약이며 visits/transcripts/insights/reports·개별 FieldDay 생성·전체 SRS schema_version/삭제 tombstone·미분류 자료 이관은 후속이다. 과거 데이터 3/180/16 이관을 수행하지 않았다.
- 신규 보고서 이용권 서버 트랜잭션·실제 AI/Docs는 연결하지 않았다. 기존 보고서/AI 수정/Docs 경로를 무단 차단하지 않았다. 관리자가 곧 보고서 생성권자는 아니다.
- 공식 도슨트 음원·실제 좌표 검수·공개 콘텐츠 권리 확인은 대기다. 공유 부스는 아직 목록 대안으로 제공한다.
- 이미지25 MiB 등 요청 제한은 애플리케이션 검증이며 reverse proxy의 요청 크기/속도 제한과 공개 서비스 보안 검증은 별도다. 외부 공개는 승인되지 않았다.

## 7. 보존 확인과 중지

작업 전 manifest 229개 파일과 비교해 기존 파일 변경은 다음 7개로 한정했다: package.json, package-lock.json, Phase 1의 browser-storage.ts/map.ts/field-prototype.tsx/note-sheet.tsx, phase1-browser.mjs. 기존 수정사항을 지우지 않고 필요한 계약·연결 모드·테스트를 추가했다. 누락 파일은 0개다. 신규 파일은 이 보고서를 포함해 27개다. `git diff --check` 통과. 브라우저 번들에서 서버 전용 Google client secret·암호화 키·레거시 refresh token 환경변수 이름이 포함되지 않은 것도 확인했다.

`prisma/`, `storage/`, `backups/`의 기존 파일 44개 변경 0개. DB·미디어·마이그레이션 이력·스키마를 보존했다. 기존21개 테스트·AI 보고서 코드·AGENTS·PRD/SRS·Phase 0/1/2A 문서·지도 이미지·폰트를 유지했다. 작업 전 해시는 `/var/folders/rs/6_j362g92j79ssyxdgbmn6rw0000gn/T/gatherly-phase2b1-kfq4wtiu/before.json`에 있다. 임시 검증 자료는 영구 백업이 아니다.

사용한 공식 근거: [Supabase SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client?queryGroups=framework&framework=nextjs), [Supabase changelog](https://supabase.com/changelog), [Google OAuth 웹 서버](https://developers.google.com/identity/protocols/oauth2/web-server), [Drive 업로드](https://developers.google.com/workspace/drive/api/guides/manage-uploads), [Drive ID 생성](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/generateIds). changelog.md는 조회 도구의 markdown content-type 제한으로 HTML changelog를 읽었다. Next.js proxy/cookies/route-handler는 설치된 `node_modules/next/dist/docs/`를 확인했다.

**코드와 로컬 검증 단계에서 중지한다.** 실제 설정 변경·스키마 적용·Google 파일 생성·외부 공개는 이후 승인 범위다.

```text
PHASE_2B_1_LOCAL_CODE=COMPLETE
UNIT_AND_READONLY_TESTS=39/39
RLS_DRAFT_IN_MEMORY_POSTGRES=PASS
TYPECHECK=PASS
LINT=PASS_WITH_1_PREEXISTING_WARNING
BUILD=PASS_ISOLATED
BROWSER_REGRESSION=PASS
REAL_SUPABASE_GOOGLE_TEST=AWAITING_APPROVAL_AND_CONFIGURATION
IPHONE=AWAITING_VALIDATION
REAL_HOTSPOTS_PUBLISHED=0
LEGACY_DB_MIGRATION=false
SUPABASE_GOOGLE_REAL_WRITES=false
COMMIT_PUSH_DEPLOY=false
```
