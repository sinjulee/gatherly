# Phase 1 — 레거시/신규 아키텍처 경계와 지침 수정안

2026-10-16. 사용자의 Phase 1 지시로 신규 Supabase 아키텍처의 **설계와 Mock 구현**이 허용되었다. 실제 연동/DB 변경 승인은 포함되지 않는다. 기존 AGENTS.md는 덮어쓰지 않고 아래 수정안을 제안한다.

## AGENTS.md 교체 제안 문구

기존 `데이터베이스는 Prisma + SQLite만 사용한다. 외부 SaaS 데이터베이스와 Supabase는 사용하지 않는다.` 항목을 다음과 같이 대체할 수 있다.

> 기존 Gatherly 기능과 데이터는 Prisma + SQLite 레거시 경계로 보존한다. Gatherly 2.0은 Supabase PostgreSQL/Auth를 공식 카탈로그·인증·이용권 운영 데이터용으로 설계한다. 개인 방문·메모·전사는 사용자 Google Sheets, 원본 미디어는 개인 Drive, 보고서 본문과 스냅샷은 개인 Docs/Drive로 분리한다. Phase 1에서는 타입·Mock·로컬 프로토타입만 허용하며 운영 DB 변경·마이그레이션·실제 외부 서비스 쓰기는 별도 승인 후 수행한다. 기존 FieldDay·기업·자료·보고서 경로를 자동 이관하거나 차단하지 않는다.

한국어/터치 영역/아이보리·딥그린/Paperlogy/Tailscale 전용 지침과 Next.js 가이드 블록은 유지한다. 공개 베타는 별도 승인 전 실행하지 않는다.

## 저장/권한 설계

| 데이터 | 신규 대상 | 경계 |
|---|---|---|
| 공식 행사/기업/참가·출처/지도·핫스팟/승인 도슨트 | Supabase PostgreSQL | 공개 조회는 승인·발행 데이터만. 이름으로 개인 자료 자동 병합 금지 |
| Google 로그인 | Supabase Auth | 로그인과 개인 저장소 OAuth 동의를 분리 |
| 관리자 역할/운영 모드/쿠폰 해시·캠페인/사용권/사용량 예약/감사 | Supabase PostgreSQL | 신뢰된 서버만 변경. 관리자 역할은 이용권과 별개. 사용자 본인의 상태 조회만 허용 |
| FieldDay·방문·메모·전사·개인 분석/파일·보고서 인덱스 | 개인 Google Sheets | UUID와 revision, 삭제 tombstone. 사용자별 파일 소유권 검증 |
| 사진/음성/영상·입력 스냅샷 | 개인 Google Drive | client asset ID 멱등성, 원본 유지 |
| 보고서 본문·버전 | 개인 Docs/Drive | 만료 후에도 소유자 열람/직접 편집 유지 |
| 미전송 파일·메모·초안 | 기기 IndexedDB | 사용자/현장/참가기업 ID 고정. 서버 저장 성공과 구분 |

레거시 `prisma/schema.prisma`, `lib/prisma.ts`, `lib/storage.ts`, `/api/materials`, `/api/field-days`, `/api/reports`, 기존 worker는 그대로 유지한다. 신규 계약은 `lib/gatherly-2/`에만 있고 Prisma/Google SDK를 import하지 않는다. UI는 `/phase-one` 전용이다.

`ExhibitionCompany.id`는 신규 exhibitor ID의 매핑 후보이며 Company ID와 동일시하지 않는다. 기존 FieldDay.exhibitionId=null, 자료 companyId=null을 허용한다. `2006 푸드위크` 제목과 ENTECH/기후산업 명칭, 개인 자료 소유자 귀속은 운영자 확인 후 ID 매핑표로 결정한다. 기존 자료에 새 소유자/행사 ID를 추정 주입하지 않는다.

## 향후 PostgreSQL/접근 정책 (실행 SQL 아님)

- 핵심 키: exhibitions.id, companies.id, exhibitors.id + exhibition_id/company_id; source_id + external_id 유니크. booth_code 전역 유니크 금지, 공동/복수 부스 지원.
- staging/import_runs/approvals와 쿠폰 원본/관리자 변경은 비노출 경계. 출처 및 지도 이미지 권리가 확인되지 않으면 발행 불가.
- 노출 테이블은 명시적 GRANT와 RLS 모두 설계한다. 공개 카탈로그 SELECT에는 published 조건, 개인 운영 메타데이터 SELECT에는 서버 인증에서 확인된 user_id 소유 조건. 일반 사용자의 role/entitlement/reservation 직접 INSERT/UPDATE는 허용하지 않는다.
- 사용자 수정 가능한 user_metadata로 관리자 권한을 판단하지 않는다. 서버 관리자 역할과 최신 권한 상태를 확인하고 서비스 비밀키를 브라우저에 넣지 않는다.
- UNIQUE(user_id, request_key), 쿠폰 캠페인/사용자 제한, 원자 예약/확정/복구를 실제 DB 트랜잭션으로 구현해야 한다. Mock의 단일 JS 프로세스 원자성은 PostgreSQL 경쟁 테스트를 대체하지 않는다.
- 만료된 예약은 단순 시간 경과만으로 권리를 환불하지 않는다. 외부 결과가 불확실하면 RESERVED 유지, 결과 확인 후 확정/해제한다. 재시도는 확정된 실패 후 새 요청 키를 사용한다.
- 물리 스키마, migration, RLS SQL 파일, Supabase 프로젝트/환경변수는 이번에 만들거나 변경하지 않았다.

설계 시 [Supabase RLS 공식 문서](https://supabase.com/docs/guides/database/postgres/row-level-security)를 참고했다. changelog.md는 조회 도구가 text/markdown을 지원하지 않아 읽지 못했다. Supabase SDK/API를 구현한 단계가 아니며 실제 연동 전에 changelog와 해당 API 문서를 다시 확인한다.

## 보고서 이용권 연결 지점 (아직 연결하지 않음)

1. `app/api/reports/route.ts` POST: 신규 V2 진입 경로에서 서버 인증/소유권→운영 모드/이용권→예약→큐 등록. parentReportId가 있으면 동일 문서 AI 수정 예산 적용. 기존 레거시 POST에 일괄 거부 가드를 넣지 않는다.
2. `scripts/gatherly-final-report-worker.mjs`: 작업 claim과 reservation을 연결. 결과/입력 snapshot/개인 Docs 저장 성공 확인 후 commit. 실패는 release, timeout/프로세스 중단은 결과 조회 후 recovery. 기존 SQL 트랜잭션만으로 Google와 원자적 커밋을 보장할 수 없다.
3. `app/api/reports/[id]/sync-docs/route.ts`, `lib/final-report-google-sync.ts`: 사용자별 Google 인증/파일 소유권, 저장 멱등성, 실패 후 복구가 필요. 현재 서버 공통 토큰은 유지하고 V2에 재사용하지 않는다.
4. GET/PATCH·기존 Docs 열람/직접 편집은 이용권 소진과 무관하게 소유권만 확인. 기존 FINAL 직접 덮어쓰기 금지와 버전 보존은 유지한다.
5. `/api/research/quick-analysis`, `/api/research/analysis-briefs/[id]/start-analysis` 등 다른 AI 진입점도 V2 비용 정책 범위를 결정한다. 우회 생성 가능성을 통합 검증한다.
6. ReportIntegrationDelivery의 PlanFrame 멱등 키는 보고서 생성권 멱등 키와 별개다. 신규 경로를 연결하기 전에 기존 UI·worker·Docs·PlanFrame 회귀를 분리 검증한다.
