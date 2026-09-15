# Gatherly Phase 0 Migration Baseline Report

기준 시각: 2026-09-15 01:27 KST

범위:

- 원본 `prisma/dev.db`는 read-only source로만 사용했다.
- migration replay, reconciliation simulation, API characterization은 `/private/tmp`의 clean DB 또는 dev DB 복제본에서만 수행했다.
- reset, drop, `db push`, `migrate reset`, 기존 row/file 삭제는 수행하지 않았다.
- Exhibition/Company/Material relation/IndexedDB/UI schema는 변경하지 않았다.

## 1. Current DB Snapshot

| Item | Value |
|---|---|
| Datasource provider | `sqlite` |
| DB path | `/Users/sinjulee/Projects/Gatherly/prisma/dev.db` |
| Backup path | `/Users/sinjulee/Projects/Gatherly/backups/dev-before-exhibition-phase0-20260915-012737.db` |
| Original size | 430,080 bytes |
| Backup size | 430,080 bytes |
| Original file SHA-256 | `22a71a6956fe1d3d609e787fb99e8f11d5e5a763ad6aefda5ac9f30064821314` |
| Backup file SHA-256 | `5f22aa4e593186499cc9463b0b2823f2efb933fc689e8dea97552eb497eef496` |
| SQLite logical `.sha3sum --schema`, original | `10853540a7f4910c14f3093bc04c266f94bd22b119d606b9dc43c46a` |
| SQLite logical `.sha3sum --schema`, backup | `10853540a7f4910c14f3093bc04c266f94bd22b119d606b9dc43c46a` |
| FieldDay count | 2 |
| Material count | 6 |
| Deleted Material count | 2 |

SQLite의 `.backup` API는 논리적으로 일관된 snapshot을 새 DB 파일에 기록하면서 free page/page layout을 재배치할 수 있다. 따라서 물리 파일 SHA-256은 다르지만 다음 네 조건으로 백업 동일성을 확인했다.

1. 파일 크기가 동일하다.
2. SQLite logical schema+data hash가 동일하다.
3. 모든 테이블의 row count가 동일하다.
4. 양쪽 DB의 integrity/FK 검사가 동일하게 통과한다.

### Model별 row count

| Model/Table | Rows |
|---|---:|
| AnalysisBrief | 2 |
| FieldDay | 2 |
| Material | 6 |
| NotebookLink | 2 |
| PreResearchSource | 0 |
| QuickAnalysisJob | 0 |
| Report | 0 |
| ReportIntegrationDelivery | 0 |
| ReportVersion | 0 |
| RequiredEvidence | 0 |
| ResearchCheckpoint | 0 |
| ResearchPlan | 0 |
| ResearchQuestion | 0 |
| ResearchResult | 0 |
| ResearchTarget | 0 |
| RevisionRequest | 0 |
| SourceBundle | 1 |
| SourceBundleItem | 1 |
| SourceDocument | 5 |
| SyncJob | 3 |
| `_prisma_migrations` | 5 records: 4 successful migration names + 1 rolled-back attempt |

Material 세부 상태:

- IMAGE/STORED: 3
- TEXT/STORED: 3
- soft-deleted: 2
- `fieldDayId IS NULL`: 0
- `clientUploadId IS NULL`: 0

## 2. Integrity Check

| Check | Original DB | Backup | Result |
|---|---|---|---|
| `PRAGMA integrity_check` | `ok` | `ok` | PASS |
| `PRAGMA foreign_key_check` | 0 rows | 0 rows | PASS |
| Broken FK | 0 | 0 | PASS |
| Orphan detected by FK check | 0 | 0 | PASS |
| Duplicate named index definition | 0 | 0 | PASS |
| Unexpected application table | 0 | 0 | PASS |

실제 DB에는 Prisma model 20개에 대응하는 테이블과 `_prisma_migrations`만 존재한다. SQLite connection별 `PRAGMA foreign_keys` 활성 상태와 무관하게 `foreign_key_check` 자체의 결과는 위반 0건이다.

## 3. Migration Inventory

`prisma/migrations/migration_lock.toml` provider는 `sqlite`다.

| # | Migration | Main content | Replay |
|---:|---|---|---|
| 1 | `20260906100000_initial_schema` | FieldDay, Material, Report 초기 테이블 | PASS |
| 2 | `20260906141637_field_day_material_uploads` | FieldDay 상태/soft delete, Material upload metadata/status/index | PASS |
| 3 | `20260910082000_notebooklm_research_pipeline_v2` | Material research metadata, SourceBundle, SourceDocument, AnalysisBrief, NotebookLink, SyncJob, ResearchResult, ReportVersion, RevisionRequest | PASS |
| 4 | `20260912233000_report_planframe_contract` | Report/ReportVersion 재정의, PlanFrame delivery | PASS |

실제 `_prisma_migrations`에는 4번 migration의 rolled-back 시도 1건과 이후 성공 1건이 함께 기록되어 총 5 row다. 성공한 migration name은 디렉터리 4개와 일치한다.

`package.json` Prisma 관련 script:

- `db:generate`: `prisma generate`
- `db:push`: `prisma db push`
- `migrate dev`, `migrate deploy` 전용 script는 없음

`macmini/README.md`의 초기 실행 절차도 `npm run db:push`를 사용한다. 이는 아래 drift 원인 판단의 근거 중 하나다.

### Current Prisma Schema Snapshot

표기: `?` nullable, `=...` default, `map:` SQLite column mapping.

| Model | Scalar fields / mappings | Relations and onDelete | Unique / indexes | Actual DB |
|---|---|---|---|---|
| FieldDay | `id=uuid`, `title`, `location?`, `fieldDate=now map:date`, `description? map:notes`, `status=ACTIVE`, Drive metadata 4개 nullable, timestamps, `deletedAt?` | Material/Report `SetNull`; research 계열 다수 `Cascade` | `(status,deletedAt)`, `driveProjectFolderId` | MATCH |
| Material | `id=uuid`, `type`, `title`, `description?`, `content?`, file metadata, `relativePath? map:filePath`, `uploadStatus=STORED`, `clientUploadId?`, research metadata, timestamps | `fieldDayId? → FieldDay SetNull`; SourceBundleItem reverse | unique `clientUploadId`; 3 indexes | MATCH |
| Report | `id=cuid map:report_id`, title/status/content/instruction, `reportVersion map:report_version`, structured fields with mappings, timestamps | FieldDay/parent `SetNull`; versions/deliveries | 3 indexes | MATCH |
| SourceBundle | id, fieldDayId, version=1, title, status=DRAFT, manifestJson?, timestamps | FieldDay `Cascade` | unique `(fieldDayId,version)`; status index | MATCH |
| SourceBundleItem | sourceBundleId, materialId, sourceType?, sortOrder=0, included=true | both `Cascade` | unique pair; material index | MATCH |
| SourceDocument | sourceBundleId, documentType, local/Drive/checksum nullable, syncStatus=PENDING, timestamps | SourceBundle `Cascade` | unique type per bundle; status index | MATCH |
| AnalysisBrief | FieldDay/source/parent IDs, version=1, title/goal, research text fields nullable, status=DRAFT, timestamps | FieldDay `Cascade`; bundle/parent `SetNull` | 3 indexes | MATCH |
| NotebookLink | fieldDayId, URL, label?, timestamps | FieldDay `Cascade` | unique fieldDayId | MATCH |
| SyncJob | FieldDay/source/brief IDs, jobType, status=PENDING, attempt=0, error/timing fields | FieldDay `Cascade`; bundle/brief `SetNull` | 3 indexes | MATCH |
| QuickAnalysisJob | FieldDay/brief IDs, title/instruction, status=QUEUED, output/error/timing fields | FieldDay `Cascade`; brief `SetNull` | 3 indexes | MATCH |
| ResearchResult | required FieldDay/bundle/brief IDs, title, googleDocId?, importedAt=now, status=IMPORTED, version=1 | FieldDay `Cascade`; bundle/brief `Restrict` | 3 indexes | MATCH |
| ReportVersion | report fields with `report_version`, `structured_result`, `structured_schema_version` mappings; research-result compatibility fields; status/timestamp | Report/ResearchResult `Cascade` | 2 unique pairs; 3 indexes | MATCH |
| RevisionRequest | reportVersionId, type, instruction, status=OPEN, timestamps | ReportVersion `Cascade` | status index | MATCH |
| ReportIntegrationDelivery | report IDs, destination=PLANFRAME, idempotencyKey, status=QUEUED, attempt=0, response/error/timestamps | Report/ReportVersion `Cascade` | unique key; 2 indexes | MATCH |
| ResearchPlan | FieldDay/parent IDs, version=1, status=DRAFT, active=false, planning text fields, generatedByAi=false, timestamps | FieldDay `Cascade`; parent `SetNull` | unique `(fieldDayId,version)`; 3 indexes | MATCH |
| ResearchTarget | planId, name, type=OTHER, booth/location/description nullable, priority=P2, order=0, visitStatus=PLANNED, timestamps | ResearchPlan `Cascade` | visit order/status indexes | MATCH |
| ResearchQuestion | planId, targetId?, question/rationale, priority=P2, sortOrder=0, status=OPEN, timestamps | Plan `Cascade`; Target `SetNull` | 2 indexes | MATCH |
| ResearchCheckpoint | planId, target/question nullable, title/description, priority=P2, status=NOT_STARTED, evidence/completion, order/timestamps | Plan `Cascade`; Target/Question `SetNull` | 4 indexes | MATCH |
| RequiredEvidence | checkpointId, evidenceType=ANY, minimumCount=1, boolean requirements=false, description?, timestamps | Checkpoint `Cascade` | checkpoint index | MATCH |
| PreResearchSource | fieldDayId, driveFileId/name, file metadata nullable, sourceType=OTHER, selected=false, hash?, scan/create/update timestamps | FieldDay `Cascade` | unique `(fieldDayId,driveFileId)`; 2 indexes | MATCH |

`prisma migrate diff --from-url <dev-copy> --to-schema-datamodel prisma/schema.prisma` 결과는 `No difference detected.`였다. 따라서 현재 Prisma schema와 실제 dev DB 구조는 field, nullability, default, mapping, FK/onDelete, unique/index 수준에서 일치한다.

주요 mapped columns도 양쪽 모두 일치한다.

- `FieldDay.fieldDate → date`
- `FieldDay.description → notes`
- `Material.relativePath → filePath`
- `Report.id → report_id`
- `Report.reportVersion → report_version`
- `Report.structuredResult → structured_result`
- `Report.structuredSchemaVersion → structured_schema_version`
- ReportVersion의 동일 snake_case mappings

## 4. Schema vs Migration Drift

기존 migration 4개를 빈 SQLite DB에 `prisma migrate deploy`로 replay하는 작업은 성공했다. 그러나 결과 DB는 현재 schema를 완전히 재현하지 못한다.

| Object | Current Schema | Migration Replay | Actual DB | Difference | Risk |
|---|---|---|---|---|---|
| FieldDay Drive columns | 4 nullable columns 존재 | 없음 | 존재 | migration 누락 | HIGH |
| `FieldDay_driveProjectFolderId_idx` | 존재 | 없음 | 존재 | index 누락 | MEDIUM |
| QuickAnalysisJob table/FKs/indexes | 존재 | 없음 | 존재 | 전체 table migration 누락 | HIGH |
| ResearchPlan table/FKs/indexes | 존재 | 없음 | 존재 | 전체 table migration 누락 | HIGH |
| ResearchTarget table/FKs/indexes | 존재 | 없음 | 존재 | 전체 table migration 누락 | HIGH |
| ResearchQuestion table/FKs/indexes | 존재 | 없음 | 존재 | 전체 table migration 누락 | HIGH |
| ResearchCheckpoint table/FKs/indexes | 존재 | 없음 | 존재 | 전체 table migration 누락 | HIGH |
| RequiredEvidence table/FK/index | 존재 | 없음 | 존재 | 전체 table migration 누락 | HIGH |
| PreResearchSource table/FK/indexes | 존재 | 없음 | 존재 | 전체 table migration 누락 | HIGH |
| Existing 13 migrated models | 존재 | 존재 | 존재 | 차이 없음 | LOW |
| Existing mapped columns | 존재 | 존재 | 존재 | 차이 없음 | LOW |
| Existing Material structure | 존재 | 존재 | 존재 | 차이 없음 | LOW |

Clean replay → current schema diff는 정확히 다음을 생성한다.

- `ALTER TABLE FieldDay ADD COLUMN` 4개
- 신규 table 7개와 각 FK
- 신규 index/unique index 19개
- FieldDay Drive index 1개

dev DB 복제본 → current schema diff는 비어 있다.

clean replay DB → dev DB 복제본 diff는 위 clean replay → schema diff와 동일하다.

## 5. Drift Root Cause

| Drift group | Git evidence | Classification | Assessment |
|---|---|---|---|
| QuickAnalysisJob | `adbd88c`, 2026-09-11, schema만 변경 | `MIGRATION_MISSING` | migration 파일 없이 schema에 추가됨 |
| ResearchPlan/Target/Question/Checkpoint/RequiredEvidence | `e8e6050`, 2026-09-14, schema만 변경 | `MIGRATION_MISSING` | migration 파일 없이 schema에 추가됨 |
| FieldDay Drive metadata/PreResearchSource | `c235397`, 2026-09-14, schema만 변경 | `MIGRATION_MISSING` | migration 파일 없이 schema에 추가됨 |
| 실제 DB에 위 구조가 정확히 존재 | dev DB와 schema diff 0, `db:push` script 및 설치 문서 존재 | `DB_PUSH_HISTORY` | `prisma db push`로 반영됐을 가능성이 가장 높음 |
| Migration replay가 schema보다 오래됨 | clean replay diff 확인 | `SCHEMA_NEWER_THAN_MIGRATION` | 확정 |

Git에는 해당 구조를 추가하는 manual SQL이나 migration commit이 없다. 실제 DB가 변경된 명령에 대한 독립적인 audit log는 없으므로 `DB_PUSH_HISTORY`는 강한 정황 판단이며, `MANUAL_SQL` 가능성을 절대적으로 배제할 수는 없다. 다만 실제 DB가 현재 Prisma schema와 정확히 일치한다는 점은 임의 manual SQL보다 `db push` 설명과 더 잘 부합한다.

## 6. Recommended Reconciliation Strategy

| Option | Existing DB risk | Clean install reproducibility | Prisma migrate compatibility | Data preservation | Future operations |
|---|---|---|---|---|---|
| A. 단일 baseline migration으로 교체 | HIGH: 기존 `_prisma_migrations` history 재작성 필요 | HIGH | LOW until history surgery | 위험 | 기존 배포/DB마다 별도 처리 |
| B. Missing reconciliation migration 추가 | LOW: 실제 DB에는 SQL 대신 resolve만 수행 | HIGH | HIGH | HIGH | 기존 4개 history 유지, 가장 단순 |
| C. 기존 migration SQL 수정 | HIGH: 이미 적용된 checksum 변경 | HIGH for new DB | LOW: modified migration 경고 | app data는 유지돼도 history 신뢰 훼손 | 장기적으로 취약 |
| D. migration chain 전체 재생성 | HIGH | HIGH | LOW for existing DB | history 재기록 필요 | 전환 비용 큼 |
| E. 계속 `db push`만 사용 | MEDIUM | LOW | LOW | 단기 보존 가능 | drift가 반복됨 |

### Recommendation: B. Missing reconciliation migration

검증한 절차:

1. 기존 4개 migration을 clean DB에 replay했다.
2. clean replay DB → 현재 schema의 SQL diff를 생성했다.
3. 이 SQL을 임시 5번째 migration으로 구성했다.
4. 완전히 빈 DB에서 5개 migration을 replay했다.
5. 결과와 현재 schema diff가 0임을 확인했다.
6. fresh dev DB 복제본에는 reconciliation SQL을 실행하지 않고 `migrate resolve --applied`만 수행했다.
7. 복제본의 migration status, schema diff, integrity, 2/6/2 row count를 재확인했다.

결과:

- clean install: 현재 schema 완전 재현
- 기존 DB copy: application table/row 변경 없음
- 기존 DB copy: reconciliation migration만 applied로 기록
- 이후 migration compatibility: 정상

실제 적용은 별도 승인 후 다음 순서로 수행해야 한다.

1. `prisma/migrations/<timestamp>_reconcile_schema_history/migration.sql` 추가
2. clean DB에서 전체 replay 재검증
3. 실제 dev DB fresh backup 생성
4. 실제 dev DB와 현재 schema diff 0 재확인
5. 실제 dev DB에서 reconciliation migration을 `migrate resolve --applied`
6. integrity/FK/count/status 재검증
7. 그 다음에만 Exhibition additive migration 생성

현재 Phase 0에서는 실제 migration 디렉터리에 5번째 migration을 추가하거나 실제 dev DB에 resolve를 실행하지 않았다.

## 7. Regression Baseline

| Feature | Related files | API | DB/storage | Regression risk |
|---|---|---|---|---|
| FieldDay 목록/생성 | `app/page.tsx`, `components/field-day-manager.tsx` | `GET/POST /api/field-days` | FieldDay | MEDIUM |
| FieldDay 수정/상태 | FieldDayManager, item route | `PATCH /api/field-days/:id` | FieldDay | MEDIUM |
| FieldDay soft delete | FieldDayManager, item route | `DELETE /api/field-days/:id` | `deletedAt`, `ARCHIVED` | HIGH |
| PHOTO/IMAGE | InboxWorkspace, storage | `POST /api/materials/upload` | Material + uploads | HIGH |
| VIDEO | InboxWorkspace, storage/file route | upload + file GET | Material + uploads | HIGH |
| AUDIO | InboxWorkspace, storage/file route | upload + file GET | Material + uploads | HIGH |
| TEXT | InboxWorkspace | `POST /api/materials` | Material.content | HIGH |
| Material title/text 수정 | Inbox detail | `PATCH /api/materials/:id` | Material | MEDIUM |
| Material soft delete | Inbox detail | `DELETE /api/materials/:id` | Material.deletedAt; file retained | HIGH |
| Image preview | Inbox detail | `GET /api/materials/:id/file` | stored file | MEDIUM |
| Video/Audio Range | HTML media + file route | Range GET, 206 | stored file | HIGH |
| Camera capture | Inbox file input | upload | browser File → storage | HIGH |
| 다중 사진/영상/음성 | Inbox `addFiles` | file별 upload | file별 Material | HIGH |
| IndexedDB pending/uploading/failed | `lib/upload-queue.ts`, InboxWorkspace | upload | browser `gatherly-upload-queue` | HIGH |
| Retry | InboxWorkspace | upload | IndexedDB + Material | HIGH |
| clientUploadId | upload queue/domain | text/upload POST | unique Material column | HIGH |
| Idempotency | Material routes | same POST returns existing STORED | Material | HIGH |
| STORED 후 queue 제거 | Inbox `uploadOne` | upload acknowledgement | IndexedDB delete | HIGH |
| Concurrency 2 | Inbox `runUploads` | upload | browser/server/storage | HIGH |
| Manifest | `app/manifest.ts` | `/manifest.webmanifest` | none | LOW |
| Production SW | `app/layout.tsx`, `public/sw.js` | `/sw.js` | Cache Storage | MEDIUM |
| Mobile navigation | `components/app-shell.tsx` | page routes | none | MEDIUM |
| Review status/important/tagsJson | ResearchPipelineWorkspace | `PATCH /api/research/materials/:id` | Material | MEDIUM |
| Source Bundle | ResearchPipelineWorkspace | `/api/research/source-bundles*` | SourceBundle/Item/Document | HIGH |
| `05_source_index.md` | `lib/research-source-builder.ts` | bundle build | `storage/research-sources` | MEDIUM |

Regression source files:

- `prisma/schema.prisma`
- `app/api/field-days/route.ts`
- `app/api/field-days/[id]/route.ts`
- `app/api/materials/route.ts`
- `app/api/materials/upload/route.ts`
- `app/api/materials/[id]/route.ts`
- `app/api/materials/[id]/file/route.ts`
- `app/api/research/materials/[id]/route.ts`
- `lib/domain.ts`
- `lib/storage.ts`
- `lib/upload-queue.ts`
- `components/field-day-manager.tsx`
- `components/inbox-workspace.tsx`
- `components/research-pipeline-workspace.tsx`
- `lib/research-source-builder.ts`
- `app/manifest.ts`
- `app/layout.tsx`
- `public/sw.js`
- `components/app-shell.tsx`

## 8. Material API Contract

### `GET /api/materials`

| Property | Contract |
|---|---|
| Request | Optional query `fieldDayId`, optional `type` |
| Validation | type must be `IMAGE`, `VIDEO`, `AUDIO`, or `TEXT` |
| Response | `{ materials }`; full Material records plus selected FieldDay `{id,title,deletedAt}` |
| Status | 200; invalid type 400 |
| DB write | None |
| Storage write | None |
| Idempotency | Read-only |

조회는 `deletedAt: null`만 반환하고 `createdAt desc`로 정렬한다.

### `POST /api/materials` — TEXT

| Property | Contract |
|---|---|
| Request JSON | required `fieldDayId`, `content`, `clientUploadId`; optional `title` |
| Length validation | fieldDayId 100, content 10,000, clientUploadId 120, title 160 |
| Domain validation | non-deleted FieldDay가 존재해야 함 |
| Response | create: `{ material }`; duplicate: `{ material, idempotent: true }` |
| Status | create 201; idempotent 200; invalid 400; FieldDay missing 404 |
| DB write | Material type `TEXT`, `uploadStatus=STORED` 생성 |
| Storage write | None |
| Idempotency | `clientUploadId` unique lookup; 기존 row 즉시 반환 |

현재 request에는 Exhibition/Company/Index context가 없다.

### `POST /api/materials/upload` — IMAGE/VIDEO/AUDIO

| Property | Contract |
|---|---|
| Request | multipart FormData |
| Required fields | `fieldDayId`, `clientUploadId`, non-TEXT `type`, `file` |
| Optional fields | `title`, `capturedAt` |
| File validation | MIME와 extension 동시 allow-list; size > 0 및 type별 최대 크기 |
| Domain validation | non-deleted FieldDay 존재 |
| New DB writes | `PENDING → UPLOADING → STORED`; failure after create is `FAILED` |
| Existing FAILED/PENDING | 같은 fieldDay/type이면 동일 row를 재사용하고 UPLOADING으로 갱신 |
| Storage writes | `.part` stream, SHA-256, atomic rename to `storage/uploads/{fieldDayId}/{materialId}/original.{ext}` |
| Success | `{ material }`, 201 |
| STORED duplicate | `{ material, idempotent: true }`, 200 |
| UPLOADING duplicate | 409 |
| Same ID, different FieldDay/type | 409 |
| Invalid payload/file | 400 |
| Missing FieldDay | 404 |
| Other storage/server failure | 500 and Material FAILED when row exists |

현재 context 없는 multipart payload가 characterization test에서 그대로 성공했다.

### `GET /api/materials/:id`

- Response: `{ material }` including FieldDay `{id,title}`
- Status: 200 or 404
- DB/storage write: 없음

### `PATCH /api/materials/:id`

| Property | Contract |
|---|---|
| Request JSON | required non-empty `title`; optional `content` |
| Length validation | title 160, content 10,000 |
| Response | `{ material }` |
| Status | 200, invalid/catch 400, missing/deleted 404 |
| DB write | title, and content only when input is string |
| Storage write | None |
| Idempotency | 별도 idempotency key 없음; 같은 값 반복 PATCH는 결과상 안정적 |

### `DELETE /api/materials/:id`

- `deletedAt`만 기록하는 soft delete다.
- 원본 파일은 삭제하지 않는다.
- 첫 요청 200, 이미 삭제됐거나 없는 row는 404다.

## 9. IndexedDB Contract

Database contract:

| Property | Current value |
|---|---|
| Database name | `gatherly-upload-queue` |
| Version | 1 |
| Object store | `uploads` |
| Key path | `clientUploadId` |
| Secondary indexes | 없음 |

Record snapshot:

```ts
type QueuedUpload = {
  clientUploadId: string;
  fieldDayId: string;
  type: "IMAGE" | "VIDEO" | "AUDIO";
  file: File;
  title: string;
  capturedAt?: string;
  state: "PENDING" | "UPLOADING" | "FAILED" | "STORED";
  error?: string;
  createdAt: string;
};
```

중요:

- field 이름은 `status`가 아니라 `state`다.
- 완료 상태명은 `COMPLETED`가 아니라 `STORED`다.
- TEXT는 이 queue에 포함되지 않는다.
- 재진입 시 `UPLOADING`은 메모리에서 `PENDING`으로 복구된다.
- 서버의 STORED acknowledgement 이후 `removeQueuedUpload`를 호출한다.
- 현재 `companyId`, `sourceIndexId`, `exhibitionId`는 존재하지 않는다.

Phase 5에서는 위 세 field만 optional로 추가하고 기존 v1 row를 계속 역직렬화할 수 있어야 한다. Object Store/key/index 변경이 없다면 단순 property 추가만으로 DB version을 올리지 않는 전략이 우선이다.

## 10. Characterization Tests

추가한 최소 script:

- `scripts/phase0-characterization.ts`

특성:

- 새 test framework/package 없음
- 기존 `tsx`, Node assert, 실제 Route Handler를 사용
- live `prisma/dev.db` 경로를 명시적으로 거부
- DB와 storage가 승인된 temp directory 아래가 아니면 실행 거부
- 테스트 row/file은 temp DB copy와 temp storage에만 생성

검증 결과: PASS

- FieldDay list/create/update/status/soft-delete
- 기존 TEXT request/update/soft-delete
- TEXT clientUploadId idempotency
- 기존 context 없는 IMAGE multipart upload
- upload clientUploadId idempotency
- image file preview
- byte Range 206 응답
- Material FieldDay/type filter
- IndexedDB v1 serialization source contract
- 미래 context field가 Phase 0에 추가되지 않았는지 검사
- camera capture, multiple input, concurrency 2
- STORED acknowledgement 후 queue 제거 호출 순서

정적 품질 검사:

- `npx eslint scripts/phase0-characterization.ts`: PASS
- `npx tsc --noEmit --incremental false`: PASS

현재 Node script가 실제 Safari IndexedDB를 열지는 않는다. IndexedDB runtime, persistent storage, unload, camera UI는 Phase 8 실제 iPhone/PWA 검증이 계속 필요하다. Phase 0에서는 serialization/source contract를 고정했다.

## 11. Files Created

Project files:

- `backups/dev-before-exhibition-phase0-20260915-012737.db` — Git ignored safety backup
- `backups/dev-before-migration-reconciliation-20260915-071346.db` — reconciliation 직전 Git ignored safety backup
- `scripts/phase0-characterization.ts` — temp-only characterization script
- `PHASE0_MIGRATION_BASELINE.md` — 이 보고서
- `prisma/migrations/20260915071500_reconcile_schema_history/migration.sql` — 누락됐던 현재 schema 구조를 clean install에서 재현하는 reconciliation migration

Temporary analysis artifacts:

- `/private/tmp/gatherly-phase0.fAzBaq/clean-replay.db`
- `/private/tmp/gatherly-phase0.fAzBaq/dev-copy.db`
- `/private/tmp/gatherly-phase0.fAzBaq/clean-five-migrations.db`
- `/private/tmp/gatherly-phase0.fAzBaq/dev-reconciled-copy.db`
- `/private/tmp/gatherly-phase0.fAzBaq/characterization-final.db`
- `/private/tmp/gatherly-phase0.fAzBaq/reconcile-chain/`
- `/private/tmp/gatherly-reconcile.H8C5Mx/clean-four.db`
- `/private/tmp/gatherly-reconcile.H8C5Mx/clean-five-initial.db`
- `/private/tmp/gatherly-reconcile.H8C5Mx/clean-five-final.db`
- `/private/tmp/gatherly-reconcile.H8C5Mx/dev-resolve-copy.db`
- `/private/tmp/gatherly-reconcile.H8C5Mx/characterization-final.db`
- temp characterization storage directories

## 12. Files Modified

- `.gitignore`: 이전 Phase 0에서 `/backups/` 추가
- `PHASE0_MIGRATION_BASELINE.md`: reconciliation 적용 및 최종 검증 결과 추가
- `prisma/dev.db`: application schema/data가 아니라 `_prisma_migrations`에 reconciliation migration의 applied 이력 1건만 추가

변경하지 않은 핵심 파일:

- `prisma/schema.prisma`
- 기존 `prisma/migrations/*`
- `lib/upload-queue.ts`
- Material/FieldDay API
- UI/PWA 파일
- 기존 `storage/uploads/*`

`next-env.d.ts`는 Phase 0 시작 전부터 수정 상태였으며 이번 작업에서 변경하지 않았다.

## 13. Commands Executed

주요 명령과 대상:

1. `git status --short`, `git check-ignore`, `.env`/schema/migration/package inspection
2. `lsof prisma/dev.db` — 현재 프로세스가 DB를 열고 있음을 확인, 종료하지 않음
3. `.gitignore`에 `/backups/` 추가 후 `git check-ignore` 재확인
4. `sqlite3 -readonly prisma/dev.db ".backup ..."`
5. `stat`, `shasum -a 256`, `cmp`, SQLite `.sha3sum --schema`
6. 원본/backup read-only `integrity_check`, `foreign_key_check`, row counts
7. `/private/tmp/gatherly-phase0.fAzBaq` 생성
8. clean DB에 `prisma migrate deploy`로 기존 4 migration replay
9. `prisma migrate diff`: clean↔schema, copy↔schema, clean↔copy
10. SQLite table/index/migration inventory read-only query
11. `git log`, `git blame`, `git show`로 drift commit 추적
12. temp migration chain에서 reconciliation SQL 생성 및 clean five-migration replay
13. fresh dev DB copy에서 `prisma migrate resolve --applied` simulation
14. temp DB copy/storage에서 `npx tsx scripts/phase0-characterization.ts`
15. `npx eslint scripts/phase0-characterization.ts`
16. `npx tsc --noEmit --incremental false`
17. reconciliation 직전 SQLite online backup, logical hash, integrity/FK/count/storage fingerprint 확인
18. 기존 4개 migration을 clean DB에 replay하고 현재 schema와의 missing SQL을 재생성해 Phase 0 simulation과 대조
19. `20260915071500_reconcile_schema_history`를 포함한 5개 migration을 두 개의 독립적인 clean DB에 replay
20. fresh dev DB copy에서 `prisma migrate resolve --applied 20260915071500_reconcile_schema_history`와 status/diff/integrity/count 검증
21. 실제 dev DB에서 SQL 실행 없이 `prisma migrate resolve --applied 20260915071500_reconcile_schema_history` 실행
22. 실제 dev DB의 migrate status, schema diff, integrity/FK, application row counts, storage fingerprint 재검증
23. 별도 backup copy/temp storage에서 characterization 재실행 후 ESLint와 TypeScript 재검증

실행하지 않은 명령:

- `prisma db push`
- `prisma migrate reset`
- 실제 dev DB 대상 `migrate deploy`, `migrate dev`
- reconciliation SQL의 실제 dev DB 실행
- DROP/DELETE/reset 계열 SQL
- 서버 시작/재시작/종료
- Material 파일 삭제

## 14. Risks Remaining

| Risk | Level | Remaining reason |
|---|---|---|
| reconciliation migration 오용 | MEDIUM | 이미 동일 schema인 다른 DB에는 SQL을 deploy하지 말고 사전 diff 후 `resolve --applied`가 필요 |
| 실행 명령의 원인 audit 부족 | MEDIUM | 과거 DB push를 직접 증명하는 log는 없음 |
| Browser IndexedDB runtime | HIGH | Node source characterization만 수행 |
| iOS Safari/PWA background behavior | HIGH | 실제 단말 검증 전 |
| Video/Audio 실제 sample upload | MEDIUM | API/storage code는 존재하나 이번 script는 IMAGE Range만 실행 |
| Live server concurrent write | MEDIUM | 이번 resolve는 metadata-only였지만 향후 실제 schema migration 시 maintenance window 필요 |
| 단일 local DB와 storage의 동시 복구 | HIGH | DB와 `storage/uploads`의 같은 시점 백업 정책이 필요 |

## 15. Ready / Not Ready

# READY_FOR_EXHIBITION_SCHEMA

2026-09-15 reconciliation 결과:

- migration: `20260915071500_reconcile_schema_history`
- pre-resolve backup logical SHA3-256: `10853540a7f4910c14f3093bc04c266f94bd22b119d606b9dc43c46a`
- clean replay: 5 migrations applied, Prisma diff 0, `integrity_check=ok`, FK violation 0, migrate status 정상
- copy resolve: SQL 실행 없이 applied history 기록 후 diff 0/status 정상
- actual resolve: SQL 실행 없이 applied history 기록 후 5 migrations up to date
- application row counts: FieldDay 2, Material 6, deleted Material 2 및 Research 관련 count 모두 작업 전과 동일
- storage: 3 files, aggregate fingerprint `fdf3806cdb6e273546ae0975becd0cb54b02b368d51ab5bdaf649f07bb188561` 유지
- characterization, ESLint, TypeScript: PASS

현재 migration chain은 완전히 새로운 SQLite DB에서 `prisma/schema.prisma`를 차이 없이 재현한다. 실제 dev DB의 schema 및 application data에는 변경이 없고 migration metadata만 정렬됐다. 따라서 다음 Exhibition schema 작업은 additive migration으로 시작할 수 있다.
