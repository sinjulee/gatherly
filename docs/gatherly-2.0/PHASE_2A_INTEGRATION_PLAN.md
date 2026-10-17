# Gatherly 2.0 v0.5 — Phase 2A 연동 준비 계획

작성일: 2026-10-16. 브랜치: `phase2/research-execution-system` 유지.

**Phase 2A의 읽기 전용 조사·회귀 검증·연동 계획을 완료했다. 실제 연동 준비 완료나 현장 실증 통과를 의미하지 않는다.** 이번 변경은 이 문서뿐이다. Phase 1 코드, 기존 수정사항, SQLite·storage·백업, 환경변수·키를 보존한다. DB 변경/마이그레이션, Supabase·Google 쓰기, 공식 콘텐츠 앱 등록/발행, commit/push/deploy는 수행하지 않았다.

기준: [PRD v0.5](Gatherly_2.0_PRD_v0.5.md), [SRS v0.5](Gatherly_2.0_SRS_v0.5.md), [Phase 0](PHASE_0_AUDIT.md), [Phase 1](PHASE_1_IMPLEMENTATION.md), [아키텍처 경계 수정안](ARCHITECTURE_BOUNDARY_PROPOSAL.md).

## 1. Phase 1 검토와 유지할 경계

| 실제 코드 경로 | 현재 상태 | 연동 전 필요한 변경 |
|---|---|---|
| `app/phase-one/page.tsx`, `components/gatherly-2/field-prototype.tsx` | 독립 로컬 프로토타입, 고정 데모 사용자/현장 | 인증 사용자·실제 현장 Context를 주입하는 신규 경로 분리. 데모 큐를 실제 계정에 자동 귀속하지 않음 |
| `components/gatherly-2/note-sheet.tsx` | 기업 고정 메모·초안·취소·저장 | 실제 계정 전환/동기화 중 편집/한글 키보드 검증 |
| `lib/gatherly-2/contracts.ts`, `mock-storage.ts` | 공식 카탈로그/개인 Sheet/Drive/Report/Queue 포트와 Mock | 서버 인증에 묶인 실제 어댑터 추가. 클라이언트가 넘긴 userId를 인증으로 사용하지 않음 |
| `lib/gatherly-2/map.ts` | 실제 참고 이미지, 가상 기업 3개·가상 핫스팟 2개 | 실제 출처·권리·지도 버전·부스 연결·검수 이력을 별도 데이터로 관리 |
| `lib/gatherly-2/browser-storage.ts`, `sync.ts` | IndexedDB 로컬 수집, Mock worker | 변경 불가능한 mutation/기준 revision, 다중 탭 작업권·중단 복구·실제 네트워크 구현 |
| `lib/gatherly-2/access.ts` | 이용권·쿠폰·예약 정책 시뮬레이터 | 실제 DB 트랜잭션·인증·요청/비용 제한. 기존 보고서에 아직 연결하지 않음 |
| `lib/gatherly-2/importer.ts`, `tests/fixtures/directory-five.html` | 합성 fixture 전용 | 별도의 공식 HTML 어댑터와 검수 계약 필요. 실제 5건을 기존 합성 fixture로 덮어쓰지 않음 |
| `prisma/schema.prisma`, `lib/prisma.ts`, `lib/storage.ts` | 레거시 SQLite/파일 저장소 | 현재 경계 유지. V2 준비를 위해 provider나 DATABASE_URL 변경 금지 |

AGENTS.md의 SQLite-only 규칙과 신규 요구의 충돌은 기존 경계 수정안대로 처리한다. 사용자의 Phase 2A 지시는 Supabase/Google **설계·조사**를 허용하지만 실제 쓰기까지 승인하지 않는다. AGENTS.md 자체는 바꾸지 않았다. 이후 수정 시 기존 SQLite 경계, 한국어·터치 영역·색상·Paperlogy·Tailscale 운영, Next.js 문서 확인 규칙을 유지하고, Phase 1에 한정된 문구만 승인된 후속 범위에 맞춰 갱신한다.

## 2. 실제 지도와 booth_hotspots 검토

### 확인한 자산과 불확실성

- 제공 원본: `docs/gatherly-2.0/v0.5_assets/ESG_2026_Official_BoothMap_TitleRemoved_Reference.png`, **754×446**. 원본을 눈으로 확인했으며 개별 작은 글자/부스 경계는 정밀 판독에 부족하다. Phase 1은 비율을 유지한 1131×669 표면을 양방향 스크롤한다. 확대 렌더링이 원본 해상도를 높이지는 않는다.
- [공식 부스배치도 페이지](https://www.k-eco.or.kr/home/v3.php?s=33)를 읽었다. 현재 HTML은 iframe srcdoc 안에서 Dabeeo SDK 지도를 초기화하고, POI의 `directoryIdx`를 공식 기업 상세 링크로 연결한다. SDK 자격증명이나 지도 데이터를 추출·재사용하지 않았고, SDK API 호출도 실행하지 않았다. 제공 PNG와 현재 온라인 지도의 동일 버전 여부는 미확인이다.
- 공식 페이지의 텍스트 목록에는 공동 부스가 있으며, 아래 상세 확인에서는 한 기업의 복수 부스도 확인했다. 따라서 기업↔부스는 일대일로 고정할 수 없다.
- 디자인 목업은 실제 지도 데이터가 아니다. 승인된 고해상도 정적 원본 또는 운영자가 사용권을 확보한 자료를 받아 좌표를 검수하는 경로를 우선한다. 외부 SDK를 임의로 이식하지 않는다.

### Mock과 실제 자료 분리

| 구분 | 식별/상태 | 이번 결과 |
|---|---|---|
| Phase 1 데모 | `test-esg`, `test-exhibitor-*`, `reference-v1`, DRAFT | 그대로 유지. 실제 업체나 부스번호에 연결하지 않음 |
| 공식 상세 확인 5건 | 출처 + 실제 `idx`, 권리 UNKNOWN | 문서의 내부 검토용 사실 확인만. DB/앱 반영 0건 |
| 실제 지도 좌표 | 행사·지도 버전·부스·참가기업 연결 | 검증 완료 0건. 가상 사각형을 실제 좌표로 승격하지 않음 |

권장 구조는 SRS의 `booth_map_assets`/`booth_hotspots`를 유지하되, 다음 계약을 구체화하는 것이다. 아직 스키마/SQL 파일은 만들지 않았다.

1. 지도 자산: `map_id`, `exhibition_id`, `version`, 원본 width/height·SHA-256, 출처, 권리 근거/허용 범위, 승인 상태. 같은 지도 버전 안에서만 좌표를 해석한다.
2. 부스: 행사 안의 `booth_code`를 식별하고 `exhibitor_booths`로 참가기업과 다대다 연결한다. `Company.id`와 행사별 `Exhibitor.id`를 구분한다. 복수 부스 때문에 기업을 복제하지 않는다.
3. hotspot: `map_id`, `booth_id`, shape_type, `geometry_norm_json`, review_status, reviewed_by/at. 공동 부스 선택 시 연결된 참가기업 목록을 보여준다. SRS의 단일 `exhibitor_id`를 유지할 경우 연결 테이블 확장과 호환 변환을 먼저 합의한다.
4. 정규화 좌표는 이미지 콘텐츠 좌상단 기준 x/width, y/height. 사각형은 유한 값, 양의 크기, 0≤x/y 및 x+w≤1/y+h≤1을 검사한다. 화면/viewport 좌표를 저장하지 않고 스크롤·축척을 변환한다. 이후 polygon이 필요하면 별도 검증한다.
5. 현행 `validHotspot`은 geometry/행사/기업/버전만 확인하며 VERIFIED 판정은 하지 않는다. 실제 조회 어댑터와 서버 정책은 **권리 승인 지도 + 발행 참가기업 + VERIFIED hotspot**을 모두 요구해야 한다. 잘못된 조합·옛 지도 버전은 목록 대안만 제공한다.
6. 원본과 상세 페이지의 이름/부스번호를 대조하고 운영자 검수자를 기록한다. 좌표 미확정은 `null`/미매핑으로 유지한다. OCR 추정값이나 AI 재그림을 검증값으로 취급하지 않는다.

## 3. 공식 참가기업 상세 5건 — 읽기 전용 확인

2026-10-16 23시경 KST에 [공식 디렉토리](https://www.k-eco.or.kr/home/v4.php?s=34)의 실제 링크에서 발견한 첫 5개 ID만 순차 요청했다. 번호를 추측하거나 다음 페이지를 순회하지 않았다. 직접 HTTP 응답은 5건 모두 200이며 기업명과 부스번호를 상세 HTML에서 확인했다. 검색 도구의 목록 출력과 직접 받은 목록의 순서가 달라, 순번이 아닌 동일 응답의 실제 href/idx를 기준으로 대조했다.

| 원천 ID | 상세에 표시된 기업명 | 부스번호 원문 | 검증 출처 |
|---|---|---|---|
| 1206 | 모리스앤코 주식회사 | C-107 | [공식 상세](https://www.k-eco.or.kr/home/v4_view.php?s=34&sd=255200&startPage=1&idx=1206) |
| 76 | 에코에이블컨설팅(주) | G-111, H-111 | [공식 상세](https://www.k-eco.or.kr/home/v4_view.php?s=34&sd=255200&startPage=1&idx=76) |
| 57 | 엔츠 | F-111 | [공식 상세](https://www.k-eco.or.kr/home/v4_view.php?s=34&sd=255200&startPage=1&idx=57) |
| 1118 | 주식회사 비지에프에코머티리얼즈 | L-126 | [공식 상세](https://www.k-eco.or.kr/home/v4_view.php?s=34&sd=255200&startPage=1&idx=1118) |
| 1127 | 안산조경개발 주식회사 | J-117 | [공식 상세](https://www.k-eco.or.kr/home/v4_view.php?s=34&sd=255200&startPage=1&idx=1127) |

확인한 것은 해당 시점의 공식 웹 표기이며 현장 최종 배치 확정이 아니다. 지도 페이지 자체 상세 링크는 다른 `sd` 값을 사용하므로 navigation query를 기업 정체성으로 삼지 않는다. 원본 URL을 보존하고 source + external_id를 키로 검토한다.

`robots.txt`는 HTTP 404였다. 사이트에서 자동 수집·소개/로고/지도 재게시를 허용하는 명확한 근거는 확보하지 못했다. **접근 가능·robots 404·공식 게시 사실은 재사용 허가가 아니다.** 위 표는 내부 검토용 최소 사실/출처이며, 전체 설명·이미지·연락처를 앱이나 저장소 fixture에 복사하지 않았다. 추가 수집, AI 요약·도슨트 생성, 외부 재게시 전에 운영자의 권리 확인이 필요하다.

HTML은 임시 조사 디렉터리에만 보관했다. 재현용 상세 응답 SHA-256:

```text
1206 78a8b9d5f58642adeeaed7c55fdd89704d1b89586c7174eba581d7c606ebc8ac
76   c5e5ec6ef184d70316c481b2220dbf573a526b933c285985d0027dd1407a3c8d
57   57e6f1fc7c056a75c3c4ab529b0e8c6eefb9e8f9eca47647ca6aa89ac7ccac95
1118 2daf509034cf1f28a9c8261b17fd84b8cda060b5fd03b5561c49de4bdb272d19
1127 4217f9a486a823af8026fb835e3a06b3df11641a5b4727278bd3983a925cc69e
```

현재 importer는 합성 `article[data-id]`/`data-field` 계약이고 실제 사이트는 목록 onclick 링크와 다른 상세 DOM을 사용한다. 따라서 이번 결과는 **실제 5건 수동 검증 PASS**, 자동 공식 파서 검증은 NOT_RUN이다. 후속 파서는 허용된 HTML/CSV로 별도 작성하여 다중 부스 보존, 필수 이름/원천 ID, null, URL 출처, 변경 감지, 중복·HTML 이스케이프를 테스트한다. preview/staging까지만 적재하고 권리 승인과 내용 검수를 분리한다.

## 4. 외부 설정과 인증 계획 — 미실행

### 환경변수 제안

아래 이름은 신규 제안이며 `.env`나 배포 설정에 추가하지 않았다. 실제 값은 문서/브라우저/로그에 넣지 않는다.

| 변수/설정 | 노출 범위와 용도 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | V2 프로젝트 공개 연결 정보. 보안은 RLS/서버 검증에 의존 |
| `GATHERLY_V2_SUPABASE_SECRET_KEY` | 서버 전용 관리 작업. 일반 사용자 요청은 사용자 JWT/RLS 우선; 필요 작업만 권한 확인 후 사용 |
| `GATHERLY_V2_DATABASE_URL` | 승인된 관리/이관 도구 전용 연결. 레거시 `DATABASE_URL` 교체 금지 |
| `GATHERLY_V2_APP_ORIGIN` | 허용된 HTTPS 앱 origin, 콜백/리디렉션 검증 |
| `GATHERLY_V2_GOOGLE_CLIENT_ID`, `GATHERLY_V2_GOOGLE_CLIENT_SECRET` | 개인 저장소 동의용 OAuth 웹 클라이언트. 서버 전용 secret |
| `GATHERLY_V2_GOOGLE_REDIRECT_URI` | 별도 개인 저장소 OAuth callback의 정확한 등록 URL |
| `GATHERLY_V2_TOKEN_ENCRYPTION_KEY` | 서버 토큰 암호화 키 또는 관리형 KMS 참조. 회전/복구 정책 필요 |
| `GATHERLY_V2_INTEGRATION_ENABLED` | 서버 기본 false, 승인된 계정/환경에서 단계적으로 활성화 |

사용자별 refresh token·Drive 폴더/Sheet ID는 공통 환경변수로 두지 않는다. `user_storage_links`에 연결 상태/참조 ID만 두고 토큰은 서버 전용 암호화 저장소에 분리한다. 기존 `GATHERLY_GOOGLE_CLIENT_ID/SECRET/REFRESH_TOKEN`과 `GATHERLY_GOOGLE_DRIVE_ROOT_FOLDER_ID`는 `lib/google-drive-workspace.ts`, `lib/final-report-google-sync.ts`의 레거시 전용이며 V2에서 재사용하지 않는다.

### OAuth와 네트워크

1. 승인 후 전용 Supabase 프로젝트의 Google provider, Site URL, 명시적 redirect allowlist를 설정한다. Google 로그인 provider callback(`https://<project>.supabase.co/auth/v1/callback`)과 앱의 코드 교환 callback, 개인 저장소 OAuth callback은 역할이 다르다. 각각 정확히 등록하고 open redirect를 막는다. [Supabase Google 로그인 문서](https://supabase.com/docs/guides/auth/social-login/auth-google)
2. 신규 `lib/gatherly-2/auth/{browser,server}.ts`, `/auth/callback` 등을 제안한다. SSR cookie/PKCE 세션을 구성하고 서버에서 JWT를 검증한다. 민감한 변경은 최신 사용자/역할 상태도 확인한다. 브라우저의 사용자 객체나 `getSession()` 값만으로 권한을 결정하지 않는다. Next.js 16 로컬 가이드의 `proxy.ts` 규칙을 적용하되 V2 경로만 대상으로 하고 레거시 API를 일괄 차단하지 않는다. [SSR 클라이언트 지침](https://supabase.com/docs/guides/auth/server-side/creating-a-client?queryGroups=framework&framework=nextjs)
3. Google Cloud에서 Drive/Sheets API, 이후 Docs API를 활성화하고 OAuth 동의 화면·테스트 사용자·허용 origin/redirect URI·필요한 개인정보 안내를 설정한다. 로그인 성공과 개인 저장소 연결 성공을 별도 상태로 표시한다. 저장소 동의 거부 시 로컬 수집/대기는 유지한다.
4. 앱이 만든 파일 중심의 `drive.file` 최소 권한을 우선 검증한다. 기존 임의 시트 접근은 별도 파일 선택/권한 검토 대상이며 처음부터 전체 Drive/Sheets 권한을 요청하지 않는다. 실제 Sheet 생성·읽기·수정과 파일 소유/접근 검증을 테스트 계정으로 확인한 후 scope를 확정한다. [Drive scope](https://developers.google.com/workspace/drive/api/guides/api-specific-auth), [Sheets scope](https://developers.google.com/workspace/sheets/api/scopes)
5. 개인 저장소 연결은 로그인된 Supabase user에 결합한 state/PKCE와 서버 코드 교환, offline access, 암호화 refresh token 보관으로 설계한다. 연결 계정 변경을 사용자에게 명시하고 다른 Google 계정 허용 여부를 확정한다. invalid_grant/철회는 BLOCKED_REAUTH로 처리하고 무한 토큰 재발급을 하지 않는다. OAuth 앱 심사/테스트 모드 제한과 토큰 수명도 실증 전 확인한다. [Google 웹 서버 OAuth](https://developers.google.com/identity/protocols/oauth2/web-server)
6. iPhone 마이크와 인증 redirect에 사용할 **Tailscale 내부의 신뢰 가능한 HTTPS 주소**를 확정해야 한다. 개발용 localhost와 현장 휴대폰 주소는 다르다. 외부 공개·터널 생성·인증 설정 변경은 이번에 하지 않았다. 승인된 테스트 사용자 2명으로 실제 기기 접근을 검증한다.

### PostgreSQL 접근 정책

| 대상 | 조회 | 변경 |
|---|---|---|
| 공식 행사·기업·참가·지도·핫스팟·승인 도슨트 | 허용된 공개 필드만. published/rights-approved 및 부모 행사·지도 상태 일치, hotspot verified | 인증된 운영 서버의 관리자 승인 경로만 |
| staging/import_runs/approvals·원본 수집물 | 일반 사용자·anon 차단 | 관리자 권한 확인 후 서버만 |
| user_storage_links | 본인 연결 상태 등 최소 필드, 토큰 제외 | 소유자 확인한 서버만 |
| entitlement/reservation/usage | 본인 상태·사용량만 | 원자적 서버 트랜잭션/RPC만 |
| coupon 원문/해시·캠페인 제한·admin role·토큰 vault | 일반 클라이언트 직접 접근 차단 | 제한된 서버 역할, 감사 기록 |

RLS만 선언하지 말고 schema/table GRANT와 공개 projection을 함께 검토한다. private 스키마는 Data API 노출 대상에서 제외한다. 서버 비밀키는 RLS 우회가 가능하므로 모든 서버 요청에서 사용자·관리자·파일 소유권을 다시 확인한다. `user_metadata`로 관리자를 판정하지 않는다. [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)

이번에 공식 changelog를 확인했다. 테이블 자동 Data/GraphQL API 노출 기본값 변경이 있으므로 새 테이블이 자동 접근 가능하다고 가정하지 않는다. 현재 로컬 Node는 v26.0.0이며 Node 20 지원 종료 공지도 확인했다. 실제 연결 시 SDK 버전과 지원 런타임을 고정한다. [API 노출 변경](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically), [Node 20 지원 공지](https://supabase.com/changelog/45715-deprecation-notice-dropping-support-for-node-js-20)

필수 RLS 테스트: anon/A/B/admin 각각의 직접 REST·RPC 호출, 미승인 행·타 사용자 UUID 조회, user_id 변경 INSERT/UPDATE, 역할 위조, 만료 세션, 부모가 미발행인 hotspot, 쿠폰 경쟁·동일 요청 재전송. 공개 응답에 개인 메모·토큰·내부 원천물이 없는지도 검사한다. 아직 정책을 배포하거나 테스트한 것은 아니다.

## 5. API 어댑터와 동기화 변경 순서

신규 코드는 `lib/gatherly-2/` 및 별도 `/api/v2/` 경로를 제안한다. SRS API 명칭과의 최종 연결은 라우트 계약 확정 후 진행한다. 기존 `/api/materials`, `/api/field-days`, `/api/reports`의 동작을 바꾸지 않는다.

1. **계약 보완:** Context의 실제 인증 사용자·현장·참가기업, 원격 baseRevision, 불변 mutationId와 payload hash, schema_version/deleted_at, 사용자별 연결 상태를 정의한다. 개인 시트의 FieldDay 자체 메타데이터도 보존할 `field_days` 탭 또는 동등 계약을 추가한다. 미분류/레거시 자료의 nullable 참가기업을 현행 필수 exhibitorId에 억지 대입하지 않는다.
2. **인증/카탈로그:** 신규 Supabase 어댑터가 승인된 행사/기업/부스만 반환한다. 서버가 세션의 userId를 Context에 넣고, 경로 파라미터의 현장·파일 소유권을 검증한다. Mock 어댑터와 선택 구성을 분리하고 `/phase-one`은 계속 데모로 유지한다.
3. **개인 저장소:** Google 연결 API와 `google-sheets`/`google-drive` 서버 어댑터를 추가한다. 사용자별 Gatherly/행사 폴더·Spreadsheet를 생성 또는 재사용하고 visits/notes/assets 등 SRS 13.2 계약을 적용한다. 시트 행 번호 대신 record_id를 사용하며 직접 정렬/편집/삭제를 감지한다.
4. **동기화 경쟁 보완:** 현재 `saveNote`는 같은 큐 키를 최신 메모로 덮어쓰고 worker의 `put`은 조건 없이 기록한다. 업로드 도중 편집하면 과거 worker가 최신 대기를 덮을 가능성이 있다. revision별 불변 작업과 compare-and-set 완료 처리, 탭 간 lease/만료 복구를 구현해야 한다. 또한 오프라인에서 여러 번 저장하면 revision이 2 이상인데 MockSheets는 원격0→1만 허용하므로 충돌한다. baseRevision과 로컬 편집 revision을 분리하여 합쳐 전송하거나 모든 mutation을 순서대로 처리하는 정책을 먼저 선택한다. **코드 검토로 발견한 위험이며 이번에는 코드 수정/실제 동시성 재현을 수행하지 않았다.**
5. **Drive→Sheets:** resumable 업로드 세션·client_asset_id·파일 ID를 로컬 ledger에 보존하고, 응답 유실 시 결과를 먼저 조회한다. 동일 mutation 재전송은 같은 결과, 다른 payload는 충돌이다. Drive 성공 후 Sheets 실패는 파일을 재업로드하지 않는다. Sheets에는 DB식 CAS/트랜잭션을 가정하지 않고 사용자/파일 단위 직렬화와 원격 내용 비교를 적용한다. Google에서 직접 편집한 내용과 충돌하면 양쪽 원본을 보존해 선택하도록 한다.
6. **오류/UI:** 429/5xx·네트워크 오류는 제한된 backoff, 재인증은 명시적 재연결, 충돌은 자동 덮어쓰기 금지. 기기 저장/Drive 저장/Sheets 반영을 구별하고 타 계정 로그인 시 이전 계정 큐를 전송하지 않는다. 성공 확인 전 로컬 원본을 제거하지 않는다. 기존 `gatherly-upload-queue`와 새 IndexedDB를 합치거나 초기화하지 않는다.
7. **보고서 후속:** `app/api/reports/route.ts`, `scripts/gatherly-final-report-worker.mjs`, `app/api/reports/[id]/sync-docs/route.ts`, `lib/final-report-google-sync.ts`의 신규 경로에 서버 이용권 예약→AI/Docs 결과 확인→확정/복구를 연결한다. 불확실 결과는 RESERVED 유지 후 조정한다. 기존 보고서 경로와 공통 토큰은 보존하고 신규 경로에서는 사용자 토큰을 쓴다. 기존 조회/직접 편집·무료 수집을 이용권 만료로 차단하지 않는다.

## 6. 레거시 3/180/16 참조 보존 이관 전략

이번 읽기 전용 회귀는 FieldDay **3**, Company **180**, ExhibitionCompany **180**, Material **16**을 확인했다. 자료는 활성10/삭제표시6이며 IMAGE11·VIDEO2·TEXT3, 파일 참조13개다. 파일 해시·크기와 DB 무결성/FK를 검사했다. 자료의 기업/Index 연결은 4개, 나머지12개는 nullable 연결을 그대로 유지한다.

| 기존 FieldDay | 전체/활성 자료 | 이관 시 유의점 |
|---|---|---|
| `2006 푸드위크` | 0 / 0 | 제목의 연도를 자동 정정하지 않음 |
| `기후산업국제박람회` | 12 / 7 | exhibitionId=null 보존, 이름으로 행사 추정 금지 |
| `ENTECH 2026 현장조사` | 4 / 3 | 기존 Exhibition 연결 보존 |

기존 Exhibition의 name=`2026 기후산업국제박람회`, nameEn=`ENTECH 2026` 관계는 운영자 확인 대상이다. 신규 ESG 행사와 자동 병합하지 않는다. CurationIndex 8, CompanyIndex 356, Tag 343, CompanyTag 545 및 기존 분석/출처 자료도 관계 그래프에 포함한다. 이전 감사의 보고서 테이블 0건을 근거로 기존 보고서 코드/worker를 제거하지 않는다.

**복사 후 검증·선택적 전환**을 제안하며 SQLite는 보존한다. 10월 23일 실증을 위해 과거 전체 이관을 강제할 필요는 없다.

1. 사용자/운영자가 데이터 소유자와 행사 매핑을 승인한다. 실제 이관 전 동시점 SQLite·파일·백업의 스냅샷과 복원 시험을 승인된 격리 환경에서 수행한다. 현재 백업이 있다는 이유로 복원 가능성을 단정하지 않는다.
2. 읽기 전용 dry-run manifest에 모든 기존 PK/FK, null, deletedAt, 파일 SHA-256·size, 행 수, source version을 기록한다. `legacy_table + legacy_id → target_id + owner_id + status` 매핑은 개인 전용 파일/서버 비공개 경계로 두고 공개 카탈로그에 노출하지 않는다.
3. Company 180개와 ExhibitionCompany 180개는 별도 ID로 매핑한다. 개인 기업 메모/평가와 레거시 원천은 개인 보관 영역에 남긴다. 공식 카탈로그에 넣을 기업은 별도 출처/권리/내용 승인 후 연결하며 자동 공개 승격하지 않는다. Tag/Index 관계도 개인 시트의 관계 탭 또는 개인 보관 manifest에 보존한다.
4. FieldDay 3개와 Material 16개를 소유자의 Sheet에 참조 무손실로 복사하는 계약을 만든다. TEXT와 파일 자료를 구분하고 파일13개는 승인 후 개인 Drive에 복사한다. 삭제표시6개는 tombstone/삭제 시각을 유지해 활성 자료로 부활시키지 않는다. 미분류 null을 가짜 기업 ID로 채우지 않는다.
5. 실제 복사는 승인 후 `migration_run_id + legacy_table + legacy_id` 멱등 키로 수행한다. 원본을 수정하지 않고 각 파일/행의 목적지 ID·checksum·상태를 확인한다. 관계상 부모와 ID 매핑을 확보한 후 자식/파일 참조를 기록한다.
6. 승인 기준은 3/180/180/16 및 활성10/삭제6, 파일13 checksum, 현장별 개수, null·FK·Index/Tag 관계의 일치다. 신규 카탈로그에 공개된 행 수와 개인 보존 행 수를 따로 집계한다. 차이가 있으면 전환하지 않는다.
7. 전환은 선택한 사용자/현장만 opt-in한다. 이관 중 레거시 쓰기가 가능한 경우 짧은 동결 또는 별도 delta 검증을 합의해야 한다. 롤백은 원본 경로로 복귀하고 새 대상을 숨기는 방식이며 원본 삭제/자동 양방향 쓰기를 하지 않는다. 신규 서비스에서 추가된 자료의 역보존 정책도 전환 전에 정한다.

## 7. 이번 회귀 검증 결과와 남은 기준

| 실행/검토 | 결과 | 범위/한계 |
|---|---|---|
| `npm test` | **PASS 21/21** | 정책·Mock 저장소·큐·지도/fixture 및 실제 SQLite 읽기 전용 회귀 |
| `scripts/tests/phase1-browser.mjs` | **PASS (재실행)** | 375/430/1280px 폭, 양축/네 모서리 스크롤, 핫스팟/드래그, 44px 4아이콘 |
| 동일 브라우저 메모 검사 | PASS | 작성·수정·취소·기업 고정·재로드 초안, UUID/revision 유지 |
| 동일 브라우저 미디어 검사 | PASS | 합성 사진5개, 가상 마이크 녹음, TTS 경합 차단, 재로드 보존 |
| 실제 iPhone/실제 카메라·마이크 | NOT_RUN | Chrome 가상 장치가 실기기 검증을 대체하지 않음 |
| 실제 Auth/RLS/Google/API·이관 | NOT_RUN | 외부 쓰기 미승인, 이번 범위 제외 |

브라우저 첫 실행은 `CDP timeout: Page.captureScreenshot`로 종료됐으며 같은 코드로 재실행하여 통과했다. 첫 실패를 제품 기능 성공으로 계산하지 않았다. 새 독립 프로필과 loopback 테스트 서버를 사용하고 테스트가 실행한 프로세스는 종료했다.

실행 명령:

```sh
npm test
PHASE1_BUILD_SOURCE=/private/tmp/gatherly-phase1-1nyspcrv/build-source node scripts/tests/phase1-browser.mjs
```

격리된 Phase 1 빌드의 app/components/lib/public·주요 설정과 현재 소스 일치를 확인해 재사용했다. 해당 복사본에는 실제 DB/storage/.env가 없다. 현재 테스트 스크립트로 실행했으며 실사용 서버/AI worker를 시작하지 않았다. 코드 변경이 없는 문서 작업이므로 타입 검사·린트·빌드는 재실행하지 않았다. 그 결과는 [Phase 1 보고서](PHASE_1_IMPLEMENTATION.md)의 기존 PASS 기록과 구분한다.

브라우저 결과: `/var/folders/rs/6_j362g92j79ssyxdgbmn6rw0000gn/T/gatherly-v2-browser-eeymQ8/`. 조사/작업 전 해시: `/private/tmp/gatherly-phase2a-5q7eccov/`. 임시 경로는 영구 백업이 아니다.

후속 필수 자동 테스트는 오프라인 다회 편집→최초 동기화, 업로드 중 메모 수정, 두 탭/worker 경쟁, Drive 성공 응답 유실, Sheets 반영 실패/행 재정렬/직접 수정, OAuth 철회·계정 교체, 앱 재시작 복구다. 사용자 A/B 파일 ID 바꿔치기는 403이어야 하고, 실패 중 원본과 최신 메모가 남아야 한다.

## 8. 10월 23일 현장 실증과 공개 베타 분리

| 현장 실증에 반드시 필요한 것 | 통과 기준 |
|---|---|
| 사용권 있는 지도·우선 참가기업·정확한 부스 | 승인된 지도 버전과 우선 부스 수동 검수, Mock/미검증 표시 분리. 미매핑 기업도 검색/목록 선택 가능 |
| 실제 인증·개인 저장소 | 테스트 사용자 로그인/별도 동의/재인증, A/B 격리, 사용자 본인 Drive·Sheets에서 결과 직접 확인 |
| 무료 현장 수집 | 지도 양축 이동·4아이콘·기업 고정 메모. 체험권 없이 수집 가능 |
| 사진·녹음 실기기 | iPhone Safari 사진5장, HEIC/큰 파일 처리 확인, 실제3분 녹음·재생·전화/잠금/권한거부/이어폰 경합 |
| 손실·중복 방지 | LTE 끊김/복귀·업로드 중 재시작·Drive 성공 후 Sheet 실패·계정 전환에서 복구, 파일/행 중복0 |
| 현장 접근/지원 | 승인된 Tailscale HTTPS에서 휴대폰 접속, 한글 키보드/가로세로 회전, 저장 공간 부족 안내, 대기 자료 확인·수동 보관 절차 |
| 도슨트 | 권리 승인된 우선 부스 대본/음원과 녹음 상호배타. 미승인 기업은 제공 불가로 표시; 테스트 음성을 공식 해설처럼 사용 금지 |

위 항목이 통과하기 전에는 **실제 연동 현장 실증 준비 완료**로 판정하지 않는다. 권리 또는 인증/저장소가 준비되지 않으면 범위를 명시한 로컬 UX 점검만 가능하며 실제 연동 실증을 대체하지 않는다. 완전 오프라인 첫 실행은 미구현이므로 사전 접속과 통신 단절 시나리오를 구별한다.

공개 베타로 미룰 수 있는 기능: 전체 참가기업 자동 수집/전체 부스 매핑, 다행사 운영 UI, 고도화된 도슨트·전사/분석, 쿠폰 운영 화면/전체 보고서 워크플로, 광범위 다기기 충돌 UI, 피드백/탈퇴/운영 모니터링의 공개 서비스 완성, 과거 전체 데이터 이관. 이 목록은 PRD 삭제가 아니라 단계 구분이다. 인증·격리·저장 복구를 공개 베타까지 미루지는 않는다.

AI 보고서를 현장에서 실제 시연할 경우에는 예외 없이 서버 이용권·예약·성공 확정·실패 복구·요금 한도·개인 Docs 검증을 먼저 통과해야 한다. 준비되지 않았다면 V2 실제 AI 실행을 제공하지 않고 기존 레거시 보고서 경로는 그대로 보존한다. 실제 결제·쿠폰 발급·외부 모집/공개는 별도 승인이다.

## 9. 권장 실행 순서와 승인 항목

1. **권리·경계 확정:** AGENTS 경계 수정안 채택, 공식 지도/상세 재사용 범위, 현장 우선 부스, 사용자/레거시 소유자·행사 ID 매핑 결정.
2. **로컬 계약 보완:** 다대다 부스 구조·좌표 검수 계약, 불변 mutation/baseRevision·동시성 테스트, FieldDay/미분류 자료 계약. Phase 1 데모·합성 fixture 보존.
3. **외부 설정 승인:** Supabase 프로젝트/리전·RLS/스키마 적용 범위, OAuth 클라이언트/동의/scope·HTTPS callback, 토큰 보관/회전 방식 확정. 실제 DB 쓰기/설정 변경은 승인 후 별도 작업.
4. **승인된 테스트 계정 연동:** Auth→카탈로그 읽기→개인 Google 연결→메모→미디어→복구 순서. 각 단계 A/B 권한 검사 후 다음 단계 진행.
5. **현장 게이트:** 우선 부스 검수와 iPhone 실제 사진/3분 녹음·오프라인 복구 리허설. 실제 API 쓰기 테스트에는 계정/폴더/허용 데이터와 실패 정리 범위를 지정한다.
6. **후속 이관/보고서/베타:** 이관 dry-run·백업 복원·롤백 승인 후 선택 전환. AI/이용권 정책·비용 및 공개 베타 보안/운영 기준은 별도 완료 후 공개.

현재 필요한 승인은 실제 Supabase/Google 설정·쓰기 및 DB 스키마 적용, 공식 콘텐츠/지도 재사용과 좌표 발행, 소유자/행사 매핑 및 이관 실행, 실제 AI/비용 정책, 외부 공개 범위다. **이 문서는 승인 요청을 위한 구체적 계획이며 승인 또는 실행 기록이 아니다.** 이번 지시의 중지 지점에 도달했으므로 실제 외부 연동이나 DB 마이그레이션을 시작하지 않는다.

최종 SHA-256 대조: 작업 전 파일 228개 중 변경 0개·누락 0개, 신규 파일은 이 문서 1개다. 비교 범위는 기존 코드/설정/문서/DB/storage/백업이며 `.git`, `node_modules`, `.next`, `.omc`는 제외했다. 기존 package.json 수정과 미추적 파일, 작업 브랜치를 유지했다. `git diff --check`도 통과했다.

```text
PHASE_2A_READONLY_REVIEW_AND_PLAN=COMPLETE
REAL_DIRECTORY_DETAILS_VERIFIED=5
OFFICIAL_CONTENT_IMPORTED_OR_PUBLISHED=0
REAL_HOTSPOTS_VERIFIED=0
UNIT_AND_READONLY_REGRESSION=21/21_PASS
BROWSER_REGRESSION=PASS_ON_RETRY
REAL_DEVICE_AND_EXTERNAL_INTEGRATION=NOT_RUN
SOURCE_AND_LEGACY_DATA_CHANGES=0
DB_MIGRATION=false
SUPABASE_GOOGLE_WRITES=false
COMMIT_PUSH_DEPLOY=false
```
