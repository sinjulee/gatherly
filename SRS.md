# Gatherly Software Requirements Specification

## 1. 문서 정보

- 문서명: Gatherly Software Requirements Specification
- 문서 유형: As-Built Software Requirements Specification
- 문서 버전: 3.0
- 기준일: 2026-09-12
- 개발 상태: **1차 개발 완료 기준**
- 구현 기준 브랜치: `feature/notebooklm-research-pipeline-v2`
- 문서 갱신 직전 구현 기준 커밋: `c7ddb4452bf9bd861be6ea82323c65243f16a7d5`
- 관련 문서: `PRD.md`

이 SRS는 현재 저장소에 실제 구현된 구조를 기준으로 작성한다. 스키마에 존재하지만 UI/API가 연결되지 않은 확장 모델은 별도 표기하며, 현재 구현되지 않은 기능을 완료 기능으로 서술하지 않는다.

---

## 2. 시스템 목적

Gatherly는 iPhone에서 현장 조사 자료를 수집하고 Mac mini에 저장한 뒤, 동일 Evidence를 다음 세 용도로 사용할 수 있는 로컬 중심 Field Research 시스템이다.

1. **Quick Analysis**: 현장에서 즉시 질문하고 Codex CLI로 Quick Report 생성
2. **Deep Research Preparation**: Evidence 선별, Source Bundle, Analysis Brief, Google Drive/Docs, NotebookLM Handoff
3. **Final Report**: Evidence + Analysis Brief + Quick Analysis를 Codex CLI로 종합해 최종 보고서 초안/수정본 생성 및 Google Docs 출력

NotebookLM은 자동 분석 엔진으로 직접 호출하지 않으며, 1차 개발에서는 준비/연결/Handoff 역할만 수행한다.

---

## 3. 기술 스택

### 3.1 Application

- Next.js: `^16.3.4`
- React: `^19.2.8`
- React DOM: `^19.2.8`
- TypeScript: `^5.9.3`
- Tailwind CSS: `^4.3.3`
- Lucide React: `^1.41.0`
- Paperlogy local font 400/500/600/700/800

### 3.2 Data

- Prisma: `^6.19.0`
- `@prisma/client`: `^6.19.0`
- SQLite
- 기본 `DATABASE_URL="file:./dev.db"`
- 실제 개발 DB 위치: `prisma/dev.db`

### 3.3 Runtime

- Node.js runtime
- 기본 Host: `0.0.0.0`
- 기본 Port: `3001`
- Mac mini 로컬 실행
- iPhone 접근: Tailscale Serve

### 3.4 AI / External

- Codex CLI
- Google Drive API
- Google Docs API
- NotebookLM URL Handoff
- Telegram Bot API

---

## 4. 전체 시스템 아키텍처

```text
iPhone Safari / PWA
        │
        │ Tailscale Serve
        ▼
Mac mini :3001
Gatherly Next.js App
        │
        ├── Home / FieldDay Management
        ├── Inbox / Capture
        ├── Analysis Workspace
        │     ├── Quick Analysis
        │     ├── Research Pipeline
        │     └── Analysis Brief
        ├── Final Report Workspace
        ├── REST Route Handlers
        │
        ├── Prisma → SQLite
        ├── storage/uploads
        ├── storage/research-sources
        │
        ├── Quick Analysis Worker
        │      └── codex exec
        │
        ├── Final Report Worker
        │      └── codex exec
        │
        ├── Google Drive / Docs
        │      └── NotebookLM Handoff
        │
        └── Health / Doctor / Telegram Status Bot
```

---

## 5. 주요 화면과 컴포넌트

### 5.1 App Shell

파일: `components/app-shell.tsx`

모바일 하단 메뉴:

- `/` 오늘의 현장
- `/inbox` 자료수집함
- `/analysis` 정리·분석함
- `/reports` 최종 보고서

데스크톱에서는 좌측 사이드바를 사용한다.

모바일 상단 MiniCalendar는 `details/summary` 형태로 접고 펼칠 수 있다. 현재 데이터는 정적 값이며 DB 조회 로직은 없다.

### 5.2 Home

서버 페이지: `app/page.tsx`

클라이언트 Overview: `components/home-overview.tsx`

현장 관리: `components/field-day-manager.tsx`

기능:

- FieldDay 목록
- FieldDay 생성/수정/삭제
- ACTIVE 프로젝트 기반 기본 Overview 선택
- 전체 현장 또는 개별 현장 선택
- 선택 범위에 따른 Material/Report 통계
- 최근 Material 최대 4개

### 5.3 Inbox

서버 페이지: `app/inbox/page.tsx`

클라이언트: `components/inbox-workspace.tsx`

기능:

- 저장 대상 FieldDay 선택
- 사진 촬영
- 앨범 다중 선택
- 영상 다중 선택
- 음성 다중 선택
- 텍스트 메모
- IndexedDB queue
- 업로드 재시도/폐기
- 자료 목록 필터
- Material 상세 수정/삭제
- 이미지/영상/음성 미리보기

### 5.4 Analysis

서버 페이지: `app/analysis/page.tsx`

통합 Shell: `components/analysis-workspace-shell.tsx`

하위 컴포넌트:

- `components/quick-analysis-workspace.tsx`
- `components/research-pipeline-workspace.tsx`
- `components/analysis-brief-workspace.tsx`

페이지 상단의 `projectId` 상태를 기준으로 선택된 프로젝트를 배열 첫 항목으로 재정렬하고 하위 컴포넌트에 전달한다. 통합 Shell 내부에서는 CSS로 하위 현장 선택 label을 숨겨 중복 선택을 제거한다.

### 5.5 Final Report

서버 페이지: `app/reports/page.tsx`

클라이언트: `components/final-report-workspace.tsx`

기능:

- FieldDay 선택
- Report 생성 요청
- 약 3초 polling
- Report 버전 목록
- Report 내용 조회
- 직접 수정
- AI 수정 요청
- Google Docs 출력

---

## 6. 데이터 모델

### 6.1 FieldDay

```text
id              String UUID PK
title           String
location        String?
fieldDate       DateTime @map("date")
description     String? @map("notes")
status          String default ACTIVE
createdAt       DateTime
updatedAt       DateTime
deletedAt       DateTime?
```

관계:

- Material[]
- Report[]
- SourceBundle[]
- AnalysisBrief[]
- NotebookLink?
- SyncJob[]
- ResearchResult[]
- QuickAnalysisJob[]

### 6.2 Material

```text
id              String UUID PK
type            String
title           String
description     String?
content         String?
originalName    String?
storedName      String?
relativePath    String? @map("filePath")
mimeType        String?
sizeBytes       Int?
sha256          String?
uploadStatus    String default STORED
uploadError     String?
clientUploadId  String? unique
capturedAt      DateTime?
reviewStatus    String default COLLECTED
tagsJson        String?
isImportant     Boolean default false
createdAt       DateTime
updatedAt       DateTime
deletedAt       DateTime?
fieldDayId      String?
```

Material 파일 유형은 현재 UI/API 기준 `IMAGE`, `VIDEO`, `AUDIO`, `TEXT`를 사용한다.

### 6.3 Report

1차 개발 Final Report의 실제 활성 모델이다.

```text
id                String cuid PK
title             String
status            String default DRAFT
content           String?
instruction       String?
version           Int default 1
parentReportId    String?
googleDocId       String?
outputPath        String?
errorMessageSafe  String?
createdAt         DateTime
startedAt         DateTime?
completedAt       DateTime?
updatedAt         DateTime
fieldDayId        String?
```

자기참조 관계:

```text
Report(parent) → Report(revisions)
```

현재 DB 스키마에는 `(fieldDayId, version)` unique constraint가 없다.

### 6.4 SourceBundle

```text
id            String cuid PK
fieldDayId    String
version       Int default 1
title         String
status        String default DRAFT
manifestJson  String?
createdAt     DateTime
updatedAt     DateTime
```

`@@unique([fieldDayId, version])`

### 6.5 SourceBundleItem

```text
id              String cuid PK
sourceBundleId  String
materialId      String
sourceType      String?
sortOrder       Int default 0
included        Boolean default true
```

`@@unique([sourceBundleId, materialId])`

### 6.6 SourceDocument

```text
id              String cuid PK
sourceBundleId  String
documentType    String
localPath       String?
driveFileId     String?
checksum        String?
syncStatus      String default PENDING
lastSyncedAt    DateTime?
createdAt       DateTime
updatedAt       DateTime
```

`@@unique([sourceBundleId, documentType])`

### 6.7 AnalysisBrief

```text
id                     String cuid PK
fieldDayId             String
sourceBundleId         String?
parentBriefId          String?
version                Int default 1
title                  String
goal                   String
researchQuestions      String?
decisionContext        String?
evaluationCriteria     String?
targetScope            String?
excludeScope           String?
outputType             String?
additionalInstruction  String?
driveFileId            String?
status                 String default DRAFT
createdAt              DateTime
updatedAt              DateTime
```

### 6.8 NotebookLink

```text
id             String cuid PK
fieldDayId     String unique
notebookUrl    String
notebookLabel  String?
createdAt      DateTime
updatedAt      DateTime
```

### 6.9 SyncJob

```text
id                String cuid PK
fieldDayId        String
sourceBundleId    String?
analysisBriefId   String?
jobType           String
status            String default PENDING
attemptCount      Int default 0
errorCode         String?
errorMessageSafe  String?
startedAt         DateTime?
completedAt       DateTime?
createdAt         DateTime
updatedAt         DateTime
```

현재 Analysis Brief/Drive 동기화의 처리 이력 저장에 사용한다.

### 6.10 QuickAnalysisJob

```text
id                String cuid PK
fieldDayId        String
analysisBriefId   String?
title             String
instruction       String
status            String default QUEUED
resultMarkdown    String?
outputPath        String?
errorMessageSafe  String?
queuedAt          DateTime
startedAt         DateTime?
completedAt       DateTime?
updatedAt         DateTime
```

### 6.11 확장용 스키마 모델

다음 모델은 Prisma 스키마에 존재하지만 1차 개발의 활성 UI/API Report 흐름에서는 사용하지 않는다.

- `ResearchResult`
- `ReportVersion`
- `RevisionRequest`

현재 최종 보고서 기능은 `Report` 모델을 직접 사용한다.

---

## 7. FieldDay 기능 요구사항

### FR-FD-001 생성

`POST /api/field-days`

필수:

- title

지원:

- location
- fieldDate
- description
- status

### FR-FD-002 조회

`GET /api/field-days`

soft delete되지 않은 FieldDay를 기본 대상으로 한다.

### FR-FD-003 수정

`PATCH /api/field-days/:id`

제목, 장소, 날짜, 설명, 상태를 수정할 수 있어야 한다.

### FR-FD-004 삭제

`DELETE /api/field-days/:id`

물리 삭제가 아니라 `deletedAt` 기반 soft delete를 사용한다.

### FR-FD-005 홈 Overview

`components/home-overview.tsx`는 다음 규칙을 만족해야 한다.

- ACTIVE FieldDay를 기본 선택
- 없으면 첫 FieldDay
- `ALL` 옵션 제공
- Material/Report를 클라이언트에서 선택 범위로 필터
- 저장 자료 = STORED
- 대기·실패 = STORED가 아닌 Material
- 완성 보고서 표시값 = status가 COMPLETED 또는 DRAFT인 Report 수
- 최근 자료 = 선택 범위에서 서버가 전달한 정렬 순서 기준 앞 4건

---

## 8. Capture 및 Material 요구사항

### FR-CAP-001 입력 유형

Inbox는 다음 input을 제공해야 한다.

- IMAGE camera capture
- IMAGE album multiple
- VIDEO multiple
- AUDIO multiple
- TEXT form

### FR-CAP-002 Client Queue

`lib/upload-queue`를 사용해 브라우저 IndexedDB에 파일을 임시 보관한다.

요구사항:

- clientUploadId 생성
- queue state 저장
- 앱 진입 시 queue 복구
- `UPLOADING` 상태였던 queue는 `PENDING`으로 복원
- `navigator.storage.persist()` 요청
- 저장 완료 전 이탈 경고

### FR-CAP-003 동시 업로드

Inbox는 업로드 jobs를 최대 2개 worker loop로 병렬 처리한다.

### FR-CAP-004 서버 업로드

`POST /api/materials/upload`

FormData:

- fieldDayId
- clientUploadId
- type
- title
- capturedAt optional
- file

검증 실패 또는 잘못된 FieldDay는 저장하지 않는다.

### FR-CAP-005 Idempotency

동일 clientUploadId가 이미 STORED이면 기존 Material을 `idempotent: true`로 반환한다.

동일 clientUploadId가 UPLOADING이면 HTTP 409를 반환한다.

### FR-CAP-006 File Validation

`lib/storage.ts` 규칙:

IMAGE:

- MIME: jpeg/png/heic/heif/webp
- 확장자: jpg/jpeg/png/heic/heif/webp
- 기본 최대 10MB

VIDEO:

- MIME: mp4/quicktime/webm
- 확장자: mp4/mov/webm
- 기본 최대 250MB

AUDIO:

- MIME: mp4/x-m4a/mpeg/wav/wave/webm
- 확장자: m4a/mp3/wav/webm
- 기본 최대 100MB

### FR-CAP-007 File Storage

저장 경로:

```text
storage/uploads/{fieldDayId}/{materialId}/original.{extension}
```

처리:

```text
stream
→ temporary .part
→ SHA-256 계산
→ rename final
→ Material STORED
```

경로는 `STORAGE_ROOT` 외부로 escape하지 못하도록 검사한다.

### FR-CAP-008 실패

저장 실패 시 Material 상태를 `FAILED`로 저장하고 안전한 `uploadError`를 기록한다.

클라이언트는 실패 queue의 개별 재시도와 폐기를 지원한다.

### FR-CAP-009 Text Material

`POST /api/materials`

TEXT 자료는 제목과 content를 DB에 직접 저장한다.

### FR-CAP-010 Material 조회/수정/삭제

- `GET /api/materials`
- `PATCH /api/materials/:id`
- `DELETE /api/materials/:id`
- `GET /api/materials/:id/file`

UI는 project/type filter, 제목/내용 수정, soft delete, 파일 preview를 지원한다.

---

## 9. Research Material 요구사항

### FR-RES-001 Review Update

`PATCH /api/research/materials/:id`

현재 UI가 변경하는 주요 필드:

- reviewStatus
- isImportant

상태 문자열:

- COLLECTED
- REVIEWED
- CURATED
- EXCLUDED
- SYNC_READY
- SYNCED

### FR-RES-002 공통 현장 선택

`components/analysis-workspace-shell.tsx`

- 상단 FieldDay selector 1개
- 선택 FieldDay의 title/location/date 표시
- 선택이 없으면 하위 Workspace를 렌더링하지 않음
- 선택 FieldDay를 하위 컴포넌트의 첫 project로 전달
- 하위 selector UI는 통합 페이지에서 숨김

---

## 10. Quick Analysis 요구사항

### FR-QA-001 조회

`GET /api/research/quick-analysis?fieldDayId=:id`

응답:

- 최근 Job 최대 20건
- 연결 AnalysisBrief 요약
- Quick Worker heartbeat 상태

Worker online 판정:

```text
heartbeat file mtime age < 15초
```

### FR-QA-002 생성

`POST /api/research/quick-analysis`

Request:

```json
{
  "fieldDayId": "...",
  "instruction": "...",
  "analysisBriefId": "optional"
}
```

규칙:

- fieldDayId 필수
- instruction 필수, 최대 5000자 clean
- FieldDay deletedAt null 확인
- 동일 FieldDay에 QUEUED/RUNNING Job이 있으면 기존 Job 반환, `reused: true`
- requestedBriefId가 없으면 최신 AnalysisBrief 자동 연결
- AnalysisBrief 없어도 생성 가능

### FR-QA-003 Worker

파일: `scripts/gatherly-quick-analysis-worker.mjs`

기본값:

```text
POLL_MS        2000
TIMEOUT_MS     360000
MAX_IMAGES     8
MAX_TEXT_CHARS 50000
```

처리 순서:

```text
QUEUED 검색
→ updateMany로 RUNNING claim
→ FieldDay + AnalysisBrief 조회
→ Material 조회
→ important DESC / capturedAt DESC / createdAt DESC
→ text context 생성
→ image path 선택
→ codex exec
→ output md 읽기
→ COMPLETED 또는 FAILED 저장
```

### FR-QA-004 Prompt

Prompt에는 최소 다음 정보가 포함된다.

- 사용자 instruction
- FieldDay title/location/date/description
- Analysis Brief
- Material id/type/title/isImportant/reviewStatus/capturedAt
- Material description/content/originalName
- VIDEO/AUDIO 개수
- 이미지와 Evidence ID 순서 매핑

Quick Report 구조:

1. 한눈에 보는 결론
2. 핵심 발견
3. 현장 근거
4. 판단 및 시사점
5. 추가 확인 필요
6. 다음 액션

### FR-QA-005 Codex 실행

```text
codex exec
--ephemeral
--sandbox read-only
--ignore-rules
--output-last-message <path>
--image <path> ...
-
```

Prompt는 stdin으로 전달한다.

### FR-QA-006 저장

```text
storage/quick-analysis/{fieldDayId}/{jobId}.md
storage/runtime/quick-analysis-worker.json
```

### FR-QA-007 UI polling

QuickAnalysisWorkspace는 약 3000ms마다 GET을 실행한다.

표시 상태:

- QUEUED: 분석 대기
- RUNNING: Codex 분석 중
- COMPLETED: Quick Report 완료
- FAILED: 분석 실패

---

## 11. Source Bundle 요구사항

### FR-SB-001 API

- `GET /api/research/source-bundles?fieldDayId=:id`
- `POST /api/research/source-bundles`
- `POST /api/research/source-bundles/:id/build`
- `POST /api/research/source-bundles/:id/sync-drive`

### FR-SB-002 생성

사용자가 선택한 Material ID를 SourceBundleItem으로 저장한다.

현장별 version은 증가하며 `(fieldDayId, version)` unique 제약을 사용한다.

### FR-SB-003 Source Builder

파일: `lib/research-source-builder.ts`

생성 타입:

```text
PROJECT_OVERVIEW
FIELD_NOTES
PHOTO_EVIDENCE
MEDIA_INDEX
SOURCE_INDEX
```

로컬 파일:

```text
01_project_overview.md
02_field_notes.md
03_photo_evidence.md
04_media_index.md
05_source_index.md
manifest.json
```

저장 폴더:

```text
{RESEARCH_SOURCE_ROOT}/{safeProjectTitle}-{fieldDayId8}/v{version}/
```

기본 `RESEARCH_SOURCE_ROOT`:

```text
./storage/research-sources
```

빌드 성공 시 SourceBundle `status=BUILT`, `manifestJson` 저장.

각 SourceDocument는 checksum SHA-256과 localPath를 저장하고 `syncStatus=PENDING`으로 upsert한다.

### FR-SB-004 Source 범위

- TEXT → Field Notes
- IMAGE → Photo Evidence 메타데이터
- VIDEO/AUDIO → Media Index 메타데이터
- 전체 → Source Index

현재 이미지/영상/음성 바이너리 자체를 Google Drive Source 폴더로 업로드하지 않는다.

---

## 12. Google Drive/Docs Source Sync 요구사항

파일: `lib/google-workspace-sync.ts`

### FR-GD-001 OAuth

필수 환경변수:

- GATHERLY_GOOGLE_CLIENT_ID
- GATHERLY_GOOGLE_CLIENT_SECRET
- GATHERLY_GOOGLE_REFRESH_TOKEN

선택:

- GATHERLY_GOOGLE_DRIVE_ROOT_FOLDER_ID

OAuth refresh token으로 access token을 생성한다.

### FR-GD-002 Project Folder

루트 ID가 없으면 `Gatherly` 폴더를 찾거나 생성한다.

```text
Gatherly
└── Projects
    └── {projectTitle} ({fieldDayId8})
```

### FR-GD-003 Source Sync

```text
01_Source
└── v{bundleVersion}
```

각 SourceDocument를 Native Google Docs로 작성한다.

문서 이름:

- 01 Project Overview
- 02 Field Notes
- 03 Photo Evidence
- 04 Media Index
- 05 Source Index

기존 driveFileId가 있으면 해당 Docs를 재사용할 수 있다.

---

## 13. Analysis Brief 요구사항

### FR-AB-001 API

- `GET /api/research/analysis-briefs?fieldDayId=:id`
- `POST /api/research/analysis-briefs`
- `POST /api/research/analysis-briefs/:id/sync-drive`
- `POST /api/research/analysis-briefs/:id/start-analysis`

### FR-AB-002 입력

POST가 수용하는 필드:

- fieldDayId
- title
- goal
- researchQuestions
- decisionContext
- evaluationCriteria
- targetScope
- excludeScope
- outputType
- additionalInstruction
- sourceBundleId

필수:

- fieldDayId
- goal

UI는 현재 title, goal, researchQuestions, decisionContext, evaluationCriteria, additionalInstruction를 직접 입력하고 `outputType=REPORT`를 전송한다.

### FR-AB-003 Version

FieldDay의 latest AnalysisBrief version + 1로 생성한다.

### FR-AB-004 SourceBundle 자동 연결

sourceBundleId를 지정하지 않으면 해당 FieldDay에서 status가 `SYNCED` 또는 `BUILT`인 최신 SourceBundle을 조회해 연결한다.

### FR-AB-005 Google Docs 자동 Sync

Brief DB 생성 후 SyncJob을 다음 값으로 생성한다.

```text
jobType = GOOGLE_DRIVE_ANALYSIS_BRIEF_SYNC
status  = RUNNING
attemptCount = 1
```

Docs 성공:

```text
AnalysisBrief.status = SYNCED
driveFileId 저장
SyncJob.status = SUCCEEDED
```

Docs 실패:

- AnalysisBrief 레코드는 보존
- SyncJob FAILED
- HTTP 201 + warning 반환

### FR-AB-006 Folder

```text
02_Analysis_Brief/
  v{version} {title}
```

### FR-AB-007 Start Analysis

`start-analysis`는 NotebookLM을 직접 자동 실행하지 않는다.

역할:

- 관련 준비 상태 확인
- 분석 지시 텍스트 생성
- AnalysisBrief 상태를 Handoff용으로 변경
- Notebook URL 반환
- 클라이언트가 지시문을 clipboard에 복사하고 새 탭으로 NotebookLM을 열 수 있게 함

---

## 14. NotebookLink 요구사항

### FR-NB-001 API

- `GET /api/research/notebook-link?fieldDayId=:id`
- `PUT /api/research/notebook-link`

### FR-NB-002 관계

FieldDay당 NotebookLink 최대 1개.

### FR-NB-003 보안

Gatherly는 다음을 저장하지 않는다.

- NotebookLM account credential
- Google browser session cookie
- NotebookLM internal token

저장하는 것은 notebookUrl과 optional label뿐이다.

---

## 15. Final Report 요구사항

### FR-RP-001 API 조회

`GET /api/reports?fieldDayId=:id`

- fieldDayId가 있으면 현장별 조회
- 없으면 전체 조회
- `createdAt desc`
- 최대 30건
- FieldDay id/title 포함

### FR-RP-002 신규 생성

`POST /api/reports`

Request:

```json
{
  "fieldDayId": "...",
  "title": "optional",
  "instruction": "optional",
  "parentReportId": "optional"
}
```

규칙:

- fieldDayId 필수
- FieldDay deletedAt null 확인
- title 없으면 `{fieldDay.title} 최종 보고서`
- instruction 없으면 기본 보고서 작성 instruction 사용
- parentReportId 없는 신규 생성은 해당 FieldDay 최신 version + 1
- parentReportId가 있으면 parent.version + 1
- 생성 상태 `QUEUED`

현재 `(fieldDayId, version)` unique 제약이 없으므로 parent 분기 생성 방식에서 동일 버전 번호가 생길 가능성을 DB가 강제 차단하지 않는다.

### FR-RP-003 Direct Edit

`PATCH /api/reports`

Request:

```json
{
  "id": "report-id",
  "content": "...",
  "title": "optional"
}
```

동작:

- 현재 Report content 직접 갱신
- status COMPLETED
- completedAt 갱신
- 새 version 생성하지 않음

### FR-RP-004 Worker

파일: `scripts/gatherly-final-report-worker.mjs`

기본 설정:

```text
POLL_MS        2500
TIMEOUT_MS     720000
MAX_IMAGES     12
MAX_TEXT_CHARS 90000
```

처리:

```text
QUEUED Report 조회
→ RUNNING claim
→ Report + FieldDay + parentReport
→ 최신 AnalysisBrief
→ 최근 COMPLETED QuickAnalysisJob 최대 5
→ STORED Material
→ prompt 생성
→ 최대 12 이미지 첨부
→ codex exec
→ content/outputPath 저장
→ COMPLETED / FAILED
```

### FR-RP-005 Evidence 정렬

Material:

```text
isImportant DESC
capturedAt DESC
createdAt DESC
```

### FR-RP-006 AI 수정 버전

parentReportId가 있고 parent content가 존재하면 Final Report Prompt에 기존 보고서 전체를 포함하고 사용자 revision instruction을 우선 적용하도록 한다.

### FR-RP-007 Prompt 필수 구조

```text
# Report Title
## Executive Summary
## 조사 목적과 범위
## 핵심 발견
## 근거 기반 분석
## 시사점 및 전략 제안
## 리스크와 한계
## 권장 다음 액션
## 권장 이미지
## 근거 및 출처
```

### FR-RP-008 저장

```text
storage/final-reports/{fieldDayId}/{reportId}-v{version}.md
storage/runtime/final-report-worker.json
```

### FR-RP-009 UI Polling

FinalReportWorkspace는 FieldDay가 선택된 경우 약 3초마다 `/api/reports`를 재조회한다.

상태 표시:

- QUEUED: 생성 대기
- RUNNING: Codex 작성 중
- COMPLETED: 초안 완료
- FAILED: 생성 실패
- DRAFT: 초안/legacy 상태

### FR-RP-010 Google Docs Export

`POST /api/reports/:id/sync-docs`

완료된 content가 존재하고 FieldDay 관계가 있어야 한다.

파일: `lib/final-report-google-sync.ts`

Drive folder:

```text
04_Final_Report
```

Doc name:

```text
v{version} {title}
```

기존 googleDocId가 있으면 document body text를 replace한다.

현재 Google Docs API 사용은 text insert/delete만 수행하며 이미지 insertion이나 스타일 batch update는 구현하지 않는다.

---

## 16. 상태 머신

### 16.1 FieldDay

```text
ACTIVE
COMPLETED
ARCHIVED
```

별도 transition restriction은 코드에서 강제하지 않는다.

### 16.2 Upload

```text
PENDING → UPLOADING → STORED
                   ↘ FAILED
FAILED → retry → UPLOADING
```

### 16.3 Material Review

```text
COLLECTED
REVIEWED
CURATED
EXCLUDED
SYNC_READY
SYNCED
```

UI/API가 자유롭게 특정 상태로 갱신하는 방식이며 엄격한 transition engine은 없다.

### 16.4 QuickAnalysisJob

```text
QUEUED → RUNNING → COMPLETED
                 ↘ FAILED
```

### 16.5 SourceBundle

```text
DRAFT → BUILT → SYNCING/SYNCED
```

실제 Route 동작에 따라 상태를 저장하며 별도 범용 state machine 라이브러리는 사용하지 않는다.

### 16.6 AnalysisBrief

주요 현재 상태:

```text
READY → SYNCED → IN_ANALYSIS
```

기본 DB default는 DRAFT지만 API 생성 시 READY로 생성한다.

### 16.7 Report

```text
QUEUED → RUNNING → COMPLETED
                 ↘ FAILED
```

Direct Edit는 Report를 COMPLETED로 저장한다.

---

## 17. Worker 실행 요구사항

### 17.1 Server Launcher

파일: `scripts/gatherly-server.mjs`

`npm run dev`:

```text
node scripts/gatherly-server.mjs dev
```

`npm run start`:

```text
node scripts/gatherly-server.mjs start
```

시작 전 `lsof`로 Port 3001 listener를 검사한다. Listener가 이미 있으면 중복 서버 시작을 차단한다.

### 17.2 자동 실행 Child Process

기본값:

- Next.js server
- Quick Analysis Worker
- Final Report Worker

Worker 비활성화:

```text
GATHERLY_QUICK_ANALYSIS_WORKER=0
GATHERLY_FINAL_REPORT_WORKER=0
```

웹 서버 종료 시 Worker에 SIGTERM을 전달한다.

### 17.3 단독 Worker Script

```text
npm run worker:quick-analysis
npm run worker:final-report
```

---

## 18. Environment Variables

### 18.1 DB/Storage

```text
DATABASE_URL
STORAGE_ROOT
UPLOAD_MAX_IMAGE_BYTES
UPLOAD_MAX_VIDEO_BYTES
UPLOAD_MAX_AUDIO_BYTES
RESEARCH_SOURCE_ROOT
```

### 18.2 Codex Quick Analysis

```text
GATHERLY_QUICK_ANALYSIS_WORKER
GATHERLY_CODEX_BIN
GATHERLY_QUICK_ANALYSIS_POLL_MS
GATHERLY_QUICK_ANALYSIS_TIMEOUT_MS
GATHERLY_QUICK_ANALYSIS_MAX_IMAGES
GATHERLY_QUICK_ANALYSIS_MAX_TEXT_CHARS
```

### 18.3 Codex Final Report

```text
GATHERLY_FINAL_REPORT_WORKER
GATHERLY_FINAL_REPORT_POLL_MS
GATHERLY_FINAL_REPORT_TIMEOUT_MS
GATHERLY_FINAL_REPORT_MAX_IMAGES
GATHERLY_FINAL_REPORT_MAX_TEXT_CHARS
```

### 18.4 Google

```text
GATHERLY_GOOGLE_CLIENT_ID
GATHERLY_GOOGLE_CLIENT_SECRET
GATHERLY_GOOGLE_REFRESH_TOKEN
GATHERLY_GOOGLE_DRIVE_ROOT_FOLDER_ID
```

### 18.5 Telegram/Health

```text
GATHERLY_TELEGRAM_BOT_TOKEN
GATHERLY_TELEGRAM_ALLOWED_USER_ID
GATHERLY_APP_HEALTH_URL
GATHERLY_ACCESS_URL
GATHERLY_STORAGE_PATH
GATHERLY_LOG_PATH
GATHERLY_DISK_WARN_PERCENT
GATHERLY_DISK_CRITICAL_PERCENT
GATHERLY_HEALTH_TIMEOUT_MS
GATHERLY_HEALTH_SLOW_MS
```

실제 secret 값은 `.env.example`에 넣지 않는다.

---

## 19. API 목록 — 1차 개발 실제 Route

### FieldDay

```text
GET    /api/field-days
POST   /api/field-days
PATCH  /api/field-days/:id
DELETE /api/field-days/:id
```

### Health

```text
GET /api/health
```

### Material

```text
GET    /api/materials
POST   /api/materials
POST   /api/materials/upload
PATCH  /api/materials/:id
DELETE /api/materials/:id
GET    /api/materials/:id/file
```

### Research Material

```text
PATCH /api/research/materials/:id
```

### Quick Analysis

```text
GET  /api/research/quick-analysis?fieldDayId=:id
POST /api/research/quick-analysis
```

### Source Bundle

```text
GET  /api/research/source-bundles?fieldDayId=:id
POST /api/research/source-bundles
POST /api/research/source-bundles/:id/build
POST /api/research/source-bundles/:id/sync-drive
```

### Analysis Brief

```text
GET  /api/research/analysis-briefs?fieldDayId=:id
POST /api/research/analysis-briefs
POST /api/research/analysis-briefs/:id/sync-drive
POST /api/research/analysis-briefs/:id/start-analysis
```

### Notebook Link

```text
GET /api/research/notebook-link?fieldDayId=:id
PUT /api/research/notebook-link
```

### Report

```text
GET   /api/reports?fieldDayId=:id
POST  /api/reports
PATCH /api/reports
POST  /api/reports/:id/sync-docs
```

현재 `ResearchResult`, `ReportVersion`, `RevisionRequest`용 Route는 존재하지 않는다.

---

## 20. Storage Paths

### 20.1 Uploads

```text
storage/uploads/{fieldDayId}/{materialId}/original.{ext}
```

### 20.2 Research Sources

```text
storage/research-sources/{project}-{fieldDayId8}/v{version}/
  01_project_overview.md
  02_field_notes.md
  03_photo_evidence.md
  04_media_index.md
  05_source_index.md
  manifest.json
```

### 20.3 Quick Analysis

```text
storage/quick-analysis/{fieldDayId}/{jobId}.md
```

### 20.4 Final Reports

```text
storage/final-reports/{fieldDayId}/{reportId}-v{version}.md
```

### 20.5 Runtime Heartbeats

```text
storage/runtime/quick-analysis-worker.json
storage/runtime/final-report-worker.json
```

### 20.6 Status Bot Runtime

```text
logs/status-bot-offset.json
logs/status-bot.lock
```

---

## 21. Google Drive 구조

현재 실제 코드가 생성/사용하는 구조:

```text
Gatherly/
└── Projects/
    └── {projectTitle} ({fieldDayId8})/
        ├── 01_Source/
        │   └── v{bundleVersion}/
        │       ├── 01 Project Overview
        │       ├── 02 Field Notes
        │       ├── 03 Photo Evidence
        │       ├── 04 Media Index
        │       └── 05 Source Index
        ├── 02_Analysis_Brief/
        │   └── v{briefVersion} {briefTitle}
        └── 04_Final_Report/
            └── v{reportVersion} {reportTitle}
```

`03_NotebookLM_Result` 자동 생성/Import는 1차 구현 코드에 연결되어 있지 않다.

---

## 22. PWA 및 모바일 요구사항

### NFR-MOB-001 Viewport Safety

모바일 UI의 card/form/select/input/textarea는 iPhone viewport보다 넓어지지 않아야 한다.

현재 Inbox/Analysis에서 `min-w-0`, `max-w-full`, `w-full`, 1-column mobile layout을 사용한다.

### NFR-MOB-002 Navigation

모바일 하단 네비게이션은 fixed이며 4개 주요 페이지에 접근할 수 있어야 한다.

### NFR-MOB-003 Touch Target

전역 CSS에서 button/a 최소 높이를 44px로 적용한다.

### NFR-MOB-004 Shared Context

Analysis 화면은 FieldDay를 한 번 선택하고 Quick/Research/Brief 하위 기능에서 같은 FieldDay를 사용해야 한다.

Home Overview도 FieldDay 선택 1개로 통계/최근 자료를 함께 필터링해야 한다.

### NFR-MOB-005 Long Output

Quick Report와 Final Report는 긴 Markdown을 viewport 내부 scroll 영역에서 읽을 수 있어야 한다.

---

## 23. 보안 요구사항

### SEC-001 Secrets

다음을 Git에 커밋하지 않는다.

- Google OAuth secret/refresh token
- Telegram token
- Codex auth 파일
- 실제 `.env`

### SEC-002 Path Safety

relativePath가 absolute path이거나 `..` segment를 포함하면 저장 파일 경로로 사용하지 않는다.

### SEC-003 Upload Validation

서버가 MIME, 확장자, 크기를 모두 검증한다.

### SEC-004 Codex Sandbox

Quick/Final Worker 모두 `--sandbox read-only`를 기본 사용한다.

### SEC-005 Shell Injection

사용자 instruction/Evidence text를 shell command로 조립하지 않고 `spawn(command, args)`와 stdin을 사용한다.

### SEC-006 NotebookLM Session

NotebookLM cookie/token/password를 Gatherly에 저장하지 않는다.

### SEC-007 Telegram Authorization

Status Bot은 `GATHERLY_TELEGRAM_ALLOWED_USER_ID`로 허용 사용자를 확인한다.

Callback data도 허용 목록을 검증한다.

---

## 24. 신뢰성 요구사항

### NFR-REL-001 Capture Independence

Codex Worker, Google Drive, NotebookLM이 실패해도 FieldDay/Material Capture 기능은 사용 가능해야 한다.

### NFR-REL-002 Evidence Preservation

AI 분석 실패가 원본 Evidence의 수정/삭제로 이어져서는 안 된다.

### NFR-REL-003 Upload Recovery

클라이언트 queue에 남은 파일은 STORED 응답 전까지 삭제하지 않는다.

### NFR-REL-004 Worker Claim

Worker는 QUEUED 레코드를 `updateMany(... status: QUEUED)`로 claim하여 동일 레코드 중복 처리 가능성을 줄인다.

### NFR-REL-005 Heartbeat

Quick/Final Worker는 실행 중 runtime heartbeat 파일을 갱신해야 한다.

Doctor 기준 15초 이상 갱신되지 않은 heartbeat는 stale로 판단한다.

### NFR-REL-006 Duplicate Server Guard

Gatherly server launcher는 Port Listener가 이미 있으면 새 서버를 시작하지 않는다.

---

## 25. Health / Doctor 요구사항

### 25.1 Health API

`GET /api/health`

응답 예:

```json
{
  "status": "ok",
  "timestamp": "...",
  "database": "ok",
  "storage": "ok",
  "responseTimeMs": 3,
  "runtime": "nodejs"
}
```

### 25.2 Doctor

명령:

```text
npm run doctor
```

검사항목:

1. Port 3001 listener
2. Local health
3. Codex CLI
4. Quick Analysis heartbeat
5. Final Report heartbeat
6. Tailscale Serve
7. Tailscale peers

---

## 26. Telegram Status Bot 요구사항

파일군: `scripts/gatherly-status-bot/`

### OPS-TG-001 Command

- `/start`
- `/status`
- `/help`

### OPS-TG-002 Long Polling

- update offset를 `logs/status-bot-offset.json`에 저장
- 오류 시 exponential retry 최대 30초

### OPS-TG-003 Single Instance

`logs/status-bot.lock`을 사용해 중복 프로세스를 방지한다.

### OPS-TG-004 Recovery

지원 callback:

- recover:check
- recover:confirm
- recover:cancel
- system
- errors

복구는 다음 조건을 따른다.

- app service 등록 확인
- 이미 healthy면 복구 안 함
- 진행 중/cooldown이면 재실행 제한
- 실제 이상 확인 후 사용자 확인
- 제한적으로 Gatherly 앱 서비스만 복구

---

## 27. NPM Script

```text
npm run dev
npm run dev:raw
npm run build
npm run start
npm run start:raw
npm run doctor
npm run lint
npm run typecheck
npm run db:generate
npm run db:push
npm run worker:quick-analysis
npm run worker:final-report
npm run bot:status
npm run bot:status:check
npm run bot:status:dev
```

현재 `npm test`는 실제 자동 테스트를 실행하지 않고 오류 종료하는 placeholder script다.

---

## 28. 현재 구현 제한 및 비범위

### 28.1 Calendar

MiniCalendar는 현재 정적 2026년 9월 예시 데이터다. DB 기반 일정/자료 표시가 아니다.

### 28.2 Location

FieldDay location은 문자열 필드다. 주소 검색, 좌표 변환, 지도 연결은 현재 구현되지 않았다.

### 28.3 Audio/Video AI Processing

Quick/Final Worker는 AUDIO/VIDEO 원본 자동 전사, 장면 추출, 프레임 분석 파이프라인을 제공하지 않는다.

### 28.4 NotebookLM Automation

다음을 구현하지 않는다.

- NotebookLM 비공식 API
- 자동 로그인
- DOM click automation
- 공식 API 기반 자동 research execution
- 자동 결과 감지/import

### 28.5 NotebookLM Result Import

`ResearchResult` 모델은 존재하나 현재 API/UI가 없다.

`03_NotebookLM_Result` 자동 폴더/감지 기능도 없다.

### 28.6 Report Lifecycle 확장 모델

`ReportVersion`/`RevisionRequest`는 schema reservation이며 현재 FinalReportWorkspace는 `Report` 모델의 self relation/version 필드를 사용한다.

### 28.7 Final Google Docs

현재 구현은 plain text body replace 방식이다.

미구현:

- Markdown 구조를 Google Docs heading/table 스타일로 변환
- Evidence 이미지 삽입
- 이미지 자동 배치
- PDF 자동 export
- 최종 확정/finalize 버튼
- 버전 diff UI

### 28.8 Search

Gatherly 자체 웹 crawler/search index는 없다. Codex Prompt는 도구가 사용 가능한 경우 외부 조사를 허용하도록 지시할 수 있지만 네트워크/도구 가용성을 Gatherly가 보장하지 않는다.

### 28.9 Authentication

1차 개발은 개인 Mac mini + tailnet 환경을 전제로 하며 애플리케이션 자체 다중 사용자 로그인/권한 시스템은 없다.

---

## 29. 1차 개발 검증 상태

문서 갱신 시점까지 확인된 상태:

- Prisma schema `db:push` 성공
- Prisma Client generate 성공
- TypeScript typecheck 성공
- lint 오류 수정 반영
- Mac mini `codex-cli 0.153.4` 확인
- `/api/health` 정상 확인
- Port 3001 single listener 확인
- Tailscale Serve → `127.0.0.1:3001` 확인
- Quick Analysis Worker/Final Report Worker는 Gatherly Server와 함께 실행하도록 구성
- iPhone에서 주요 화면 접근 및 모바일 UI 반복 보정 완료

실제 개별 AI 결과 품질은 수집 Evidence와 사용자 instruction에 따라 달라진다.

---

## 30. 1차 개발 수용 기준

다음 항목을 현재 1차 구현의 완료 조건으로 정의한다.

### AC-001 Field Management

사용자가 FieldDay를 생성/수정/상태변경/soft delete할 수 있다.

### AC-002 Capture

사진·영상·음성·텍스트를 FieldDay에 저장할 수 있다.

### AC-003 Multi Image

사진을 여러 장 선택했을 때 각 파일이 독립 Material로 저장된다.

### AC-004 Upload Safety

IndexedDB queue, retry, SHA-256, idempotency, file validation이 작동한다.

### AC-005 Material Review

저장 자료를 조회·필터·수정·soft delete할 수 있다.

### AC-006 Home Context

Home 통계가 선택 FieldDay 또는 전체 FieldDay 기준으로 바뀐다.

### AC-007 Shared Analysis Field

Analysis 페이지에서 FieldDay를 한 번 선택하고 Quick/Research/Brief에 공통 적용한다.

### AC-008 Quick Analysis

iPhone에서 Job을 생성하고 Mac mini Codex Worker가 자동으로 Quick Report를 생성한다.

### AC-009 Source Bundle

Evidence를 선택해 SourceBundle을 만들고 5개 Source 문서와 manifest를 생성한다.

### AC-010 Drive Source

Source 문서를 Google Drive Native Docs로 동기화한다.

### AC-011 Analysis Brief

Brief를 versioning하고 Google Docs로 자동 sync/retry할 수 있다.

### AC-012 Notebook Handoff

Notebook URL을 저장하고 분석 지시 복사/Notebook 열기가 가능하다.

### AC-013 Final Report

Codex Final Report Worker가 FieldDay Evidence, Brief, Quick Results를 사용해 Report를 생성한다.

### AC-014 Revision

직접 content 수정 또는 parentReport 기반 AI 수정본 생성이 가능하다.

### AC-015 Final Docs

완료 Report를 `04_Final_Report` Google Docs로 출력할 수 있다.

### AC-016 Operations

Health, Doctor, Tailscale, Worker heartbeat를 통해 운영 상태를 확인할 수 있다.

### AC-017 Safety

AI Worker가 원본 Evidence를 직접 수정하거나 삭제하지 않는다.
