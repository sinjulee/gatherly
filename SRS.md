# Gatherly Software Requirements Specification

## 1. 문서 개요

- 문서명: Gatherly Software Requirements Specification
- 문서 버전: 2.1
- 기준일: 2026-09-10
- 대상 시스템: Gatherly PWA, Mac mini 로컬 서버, Codex CLI Quick Analysis Worker, Prisma/SQLite, 로컬 파일 저장소, Google Drive/Docs 연동, NotebookLM/Gemini Handoff, Telegram 상태 봇
- 관련 문서: PRD.md

## 2. 시스템 목표

Gatherly는 현장 조사 자료를 안전하게 수집·보관하고, iPhone에서 즉시 분석 요청을 보내 Mac mini의 Codex CLI로 Quick Report를 생성하며, 필요 시 동일 Evidence를 Source Bundle과 Analysis Brief로 구조화해 NotebookLM/Gemini 기반 심층 연구로 확장하고, 결과를 다시 Gatherly에서 검토·수정·버전 관리할 수 있어야 한다.

시스템은 두 분석 경로를 독립적으로 지원한다.

1. **Quick Analysis**: 현장 신속성 우선. Source Bundle/NotebookLM 준비 없이 현재 저장된 Evidence를 바로 분석한다.
2. **Deep Research**: 자료 선별·구조화·동기화를 거쳐 NotebookLM/Gemini에서 심층 연구한다.

NotebookLM 장애 또는 모바일 기능 제한이 현장 Quick Analysis를 차단해서는 안 된다.

## 3. 전체 시스템 구성

```text
iPhone Safari/PWA
      │
      ▼
Gatherly Next.js :3001
      │
      ├── Project Service
      ├── Capture Service
      ├── Research Inbox
      ├── Quick Analysis API
      ├── Analysis Brief Service
      ├── Source Builder
      ├── Drive Sync Service
      ├── Result Import Service
      └── Report Manager
      │
      ├── Prisma → SQLite
      ├── Local File Storage
      │
      ├──────────── Quick path ──────────────┐
      │                                      ▼
      │                         Mac mini Quick Analysis Worker
      │                                      │
      │                                      ▼
      │                              codex exec (read-only)
      │                                      │
      │                                      ▼
      │                              Quick Report Markdown
      │                                      │
      ◀───────────────────────────────────────┘
      │
      └──────────── Deep path ───────────────┐
                                             ▼
                                    Google Drive / Docs
                                             │
                                             ▼
                                    NotebookLM / Gemini
                                             │
                                             ▼
                                        Google Docs
                                             │
                                             ▼
                                      Gatherly Import
```

Tailscale 내부 접근과 Telegram 상태 봇은 기존 구조를 유지한다.

## 4. 주요 도메인 모델

### 4.1 FieldDay / Project

- id
- title
- description
- location
- fieldDate
- status
- deletedAt
- createdAt
- updatedAt

### 4.2 Material / ResearchAsset

- id
- fieldDayId
- type: IMAGE | VIDEO | AUDIO | TEXT
- title
- description
- content
- originalName
- relativePath
- mimeType
- sizeBytes
- sha256
- capturedAt
- uploadStatus
- reviewStatus
- isImportant
- tagsJson
- deletedAt
- createdAt
- updatedAt

### 4.3 QuickAnalysisJob

현장 즉시 분석 요청과 결과를 저장한다.

- id
- fieldDayId
- analysisBriefId nullable
- title
- instruction
- status: QUEUED | RUNNING | COMPLETED | FAILED
- resultMarkdown nullable
- outputPath nullable
- errorMessageSafe nullable
- queuedAt
- startedAt nullable
- completedAt nullable
- updatedAt

### 4.4 SourceBundle

- id
- fieldDayId
- version
- title
- status
- manifestJson
- createdAt
- updatedAt

### 4.5 SourceBundleItem

- id
- sourceBundleId
- materialId
- sourceType
- sortOrder
- included

### 4.6 SourceDocument

- id
- sourceBundleId
- documentType
- localPath
- driveFileId
- checksum
- syncStatus
- lastSyncedAt

### 4.7 AnalysisBrief

- id
- fieldDayId
- sourceBundleId nullable
- parentBriefId nullable
- version
- title
- goal
- researchQuestions
- decisionContext
- evaluationCriteria
- targetScope
- excludeScope
- outputType
- additionalInstruction
- driveFileId
- status
- createdAt
- updatedAt

QuickAnalysisJob은 최신 AnalysisBrief를 선택적으로 참조할 수 있다. Brief가 없어도 Quick Analysis는 실행 가능해야 한다.

### 4.8 NotebookLink

- id
- fieldDayId
- notebookUrl
- notebookLabel
- createdAt
- updatedAt

MVP에서는 NotebookLM 인증 토큰, 쿠키, 사용자 브라우저 세션을 저장하지 않는다.

### 4.9 SyncJob

- id
- fieldDayId
- sourceBundleId nullable
- analysisBriefId nullable
- jobType
- status
- attemptCount
- errorCode nullable
- errorMessageSafe nullable
- startedAt
- completedAt

### 4.10 ResearchResult

- id
- fieldDayId
- sourceBundleId
- analysisBriefId
- title
- googleDocId
- importedAt
- status
- version

### 4.11 ReportVersion

- id
- researchResultId
- versionNo
- title
- googleDocId nullable
- localSnapshotPath nullable
- revisionReason nullable
- status
- createdAt

### 4.12 RevisionRequest

- id
- reportVersionId
- type
- instruction
- status
- createdAt
- resolvedAt nullable

## 5. 주요 데이터 관계

```text
FieldDay
 ├── Material[]
 ├── QuickAnalysisJob[]
 │    └── AnalysisBrief? 
 ├── SourceBundle[]
 │    ├── SourceBundleItem[] → Material
 │    └── SourceDocument[]
 ├── AnalysisBrief[]
 ├── NotebookLink?
 ├── SyncJob[]
 └── ResearchResult[]
      └── ReportVersion[]
           └── RevisionRequest[]
```

## 6. 기능 요구사항

### FR-001 Project CRUD

- 프로젝트 생성, 조회, 수정, soft delete를 지원한다.
- 삭제된 프로젝트는 기본 목록에서 제외한다.
- 프로젝트별 자료 수, Quick Analysis 상태, Source 준비 상태, 최근 동기화 상태, 보고서 상태를 표시할 수 있어야 한다.

### FR-002 Multi-asset Capture

- 사진 다중 선택을 지원한다.
- 한 번에 여러 파일을 선택해도 각 파일을 독립 Material로 저장한다.
- 영상, 음성, 텍스트를 지원한다.
- 업로드 중 앱 이탈 시 경고한다.
- 브라우저 로컬 큐를 이용해 미완료 업로드를 보존한다.

### FR-003 Upload Integrity

- clientUploadId로 중복 요청을 방지한다.
- 파일은 임시 경로에 기록 후 검증 완료 시 최종 경로로 rename한다.
- SHA-256을 저장한다.
- 실패 시 재시도 가능해야 한다.

### FR-004 Research Inbox

- Project, type, reviewStatus로 필터링한다.
- 제목·메모·태그를 수정할 수 있다.
- 중요 표시, 제외, Source 포함 여부를 설정할 수 있다.
- 원본 파일 미리보기/재생을 지원한다.

### FR-005 Quick Analysis Request

- iPhone/데스크톱 모두에서 프로젝트를 선택하고 자유형 분석 요청을 입력할 수 있어야 한다.
- `빠른 분석 요청`은 HTTP 요청 처리 중 Codex 실행 완료를 기다리지 않고 QuickAnalysisJob을 QUEUED 상태로 생성한다.
- 동일 프로젝트에 QUEUED/RUNNING Job이 존재하면 중복 생성 대신 기존 활성 Job을 반환할 수 있다.
- Source Bundle, Google Drive, NotebookLM 상태와 무관하게 실행 가능해야 한다.
- 최신 AnalysisBrief가 존재하면 자동 연결한다.

### FR-006 Quick Analysis Worker

Mac mini worker는 다음 순서로 처리한다.

```text
QUEUED Job 조회
→ 원자적 RUNNING claim
→ FieldDay + AnalysisBrief + Material 조회
→ Prompt/context 구성
→ 이미지 경로 선별
→ codex exec 실행
→ 결과 Markdown 읽기
→ COMPLETED/FAILED 저장
```

요구사항:

- 기본 polling 간격 2초
- 기본 실행 timeout 6분
- 기본 첨부 이미지 최대 8장
- 중요 표시 자료를 우선하고 이후 최근 자료 순으로 사용한다.
- 텍스트 컨텍스트에는 상한을 둔다.
- Worker는 heartbeat 파일을 주기적으로 갱신한다.
- 웹 서버 시작 시 Worker를 함께 시작하는 것이 기본값이다.
- `GATHERLY_QUICK_ANALYSIS_WORKER=0`으로 Worker 자동 실행을 비활성화할 수 있다.

### FR-007 Codex CLI Invocation

- 비대화형 실행은 `codex exec`를 사용한다.
- 사용자 분석 지시와 Evidence 텍스트는 stdin prompt로 전달한다.
- 원본 Evidence 보호를 위해 기본 sandbox는 `read-only`로 한다.
- 세션 rollout이 불필요한 Quick Analysis에는 `--ephemeral`을 사용한다.
- 프로젝트 AGENTS/rules가 보고서 분석에 불필요한 영향을 주지 않도록 제어한다.
- 최종 agent message는 파일로 저장하여 Worker가 DB에 반영한다.
- 이미지 입력이 지원되는 경우 `--image`로 로컬 이미지 파일을 첨부한다.
- CLI 인증은 Mac mini에 이미 로그인된 Codex 사용자 인증을 재사용한다.
- Gatherly는 Codex auth 파일 내용을 DB, 로그, Git에 복사하지 않는다.

### FR-008 Quick Report

기본 출력 섹션:

1. 한눈에 보는 결론
2. 핵심 발견
3. 현장 근거
4. 판단 및 시사점
5. 추가 확인 필요
6. 다음 액션

- 모바일에서 빠르게 읽을 수 있는 길이와 구조를 우선한다.
- 가능한 경우 `[Evidence ID]`를 표시한다.
- 사실/관찰/해석을 구분한다.
- 근거가 부족한 내용은 `추가 확인 필요`로 표시한다.
- 영상/음성 원본이 직접 분석되지 않은 경우 이를 명시한다.
- 외부 검색이 사용되지 않았는데 외부 사실을 임의 생성해서는 안 된다.

### FR-009 Quick Analysis Mobile Status

- Worker online/offline 상태를 UI에서 표시한다.
- QUEUED, RUNNING, COMPLETED, FAILED 상태를 약 3초 간격으로 자동 갱신한다.
- 사용자는 화면을 새로고침하거나 Mac mini 화면을 직접 조작하지 않고 완료 결과를 확인할 수 있어야 한다.
- 완료된 resultMarkdown을 모바일 화면에서 스크롤해 읽을 수 있어야 한다.
- 최근 Quick Analysis 이력을 조회할 수 있어야 한다.

### FR-010 Analysis Brief

사용자가 다음 정보를 입력/수정할 수 있어야 한다.

- analysis_title
- analysis_goal
- research_questions
- decision_context
- evaluation_criteria
- target_scope
- exclude_scope
- output_type
- additional_instruction

Analysis Brief는 버전 관리하며 Google Docs로 자동 생성/동기화할 수 있다.

### FR-011 Source Builder

CURATED Material을 사용해 NotebookLM 심층 연구용 Source 문서를 생성한다.

- project_overview.md
- field_notes.md
- interview_transcripts.md
- photo_evidence.md
- document_index.md
- research_questions.md
- source_manifest.md

각 Source 항목에는 가능한 경우 Material ID를 포함한다.

### FR-012 Source Bundle Versioning

- Source Bundle 생성 시 version을 증가시킨다.
- 분석에 사용한 Bundle은 immutable snapshot 유지가 원칙이다.

### FR-013 Google Drive Folder Provisioning

```text
Gatherly/Projects/{project}/
  01_Source/
  02_Analysis_Brief/
  03_NotebookLM_Result/
  04_Final_Report/
```

### FR-014 Drive Sync

- driveFileId, checksum, lastSyncedAt, syncStatus를 저장한다.
- 동일 문서를 다시 동기화할 때 기존 Google Docs를 재사용한다.
- 실패 시 안전한 오류 메시지와 재시도 기능을 제공한다.
- Drive 실패는 Capture/Quick Analysis를 차단하지 않는다.

### FR-015 NotebookLM / Gemini Handoff

- 프로젝트별 Notebook URL을 저장한다.
- Source Bundle 및 Analysis Brief 동기화 상태를 표시한다.
- 데스크톱에서는 분석 지시 복사 + NotebookLM 열기 UX를 제공한다.
- 모바일에서는 NotebookLM/Gemini Notebook을 참고용으로 열 수 있는 경로를 제공하되, 모바일 기능 제한 때문에 Deep Research가 현장 Quick Flow의 필수 단계가 되어서는 안 된다.
- MVP에서는 NotebookLM 자동 로그인, 비공식 endpoint, DOM 기반 자동 클릭을 핵심 기능으로 사용하지 않는다.
- 향후 공식적이고 안정적인 자동 실행 인터페이스가 제공되면 DeepResearchProvider 계층을 통해 Mac mini에서 요청을 전달할 수 있도록 확장 가능해야 한다.

### FR-016 Research Pipeline Status

두 트랙을 구분해 표시한다.

```text
Quick: Capture → Quick Analysis → Quick Report → Next Action
Deep: Review → Source Bundle → Analysis Brief → NotebookLM/Gemini → Result → Final Report
```

### FR-017 Result Import

- NotebookLM/Gemini의 Google Docs 결과를 ResearchResult로 연결할 수 있다.
- 사용자가 직접 문서를 선택하는 방식은 필수 지원한다.
- 프로젝트 Result Folder 새 문서 감지는 선택 구현 가능하다.

### FR-018 Report Versioning

- ResearchResult 최초 가져오기 시 v1을 생성한다.
- 주요 수정이나 재연구 결과 반영 시 새 버전을 생성한다.
- 이전 버전을 조회하고 FINAL 버전을 지정할 수 있어야 한다.

### FR-019 Revision Request

타입:

- TEXT_EDIT
- STRUCTURE_CHANGE
- RESEARCH_EXPANSION
- NEW_RESEARCH_QUESTION
- EVIDENCE_ADDITION
- SOURCE_UPDATE

현장성 질문이나 짧은 보강은 Quick Analysis 재실행으로 처리할 수 있다. 심층 보강은 Analysis Brief revision/Deep Research로 연결한다.

### FR-020 Evidence Lineage

Quick 경로:

```text
Material → QuickAnalysisJob → Quick Report
             ↑
      AnalysisBrief(optional)
```

Deep 경로:

```text
Material → SourceBundle → AnalysisBrief → NotebookLM/Gemini → ResearchResult → ReportVersion
```

### FR-021 Google Docs Direct Editing

- Gatherly는 Google Docs 링크를 제공한다.
- 사용자가 Docs에서 직접 수정할 수 있다.
- Gatherly는 문서 ID와 버전 메타데이터를 관리한다.

### FR-022 PDF Output

- 최종 확정 ReportVersion은 PDF 출력 가능한 상태로 연결한다.
- MVP에서는 Google Docs PDF export를 기본 경로로 사용한다.

## 7. Mac mini Worker 요구사항

Mac mini는 두 종류의 작업 책임을 가진다.

### 7.1 Operational Worker

- Source 문서 생성
- 파일 변환/정제
- Google Drive 동기화
- checksum 계산
- 문서 후처리
- 상태 기록

### 7.2 Quick Analysis Worker

- QuickAnalysisJob polling/claim
- 현장 Evidence context 구성
- Codex CLI 비대화형 실행
- 이미지 첨부
- Quick Report 결과 저장
- heartbeat 제공

Quick Analysis Worker는 다음을 하지 않는다.

- 원본 Evidence 수정/삭제
- 임의 shell command 실행
- 사용자 요청을 shell 문자열로 직접 interpolate
- NotebookLM 사용자 세션 수집
- NotebookLM 비공식 내부 API 호출

## 8. API 요구사항

### Project

- GET /api/field-days
- POST /api/field-days
- PATCH /api/field-days/:id
- DELETE /api/field-days/:id

### Material

- POST /api/materials/upload
- GET /api/materials
- PATCH /api/materials/:id
- DELETE /api/materials/:id

### Quick Analysis

- GET /api/research/quick-analysis?fieldDayId=:id
- POST /api/research/quick-analysis

POST 예시:

```json
{
  "fieldDayId": "project-id",
  "instruction": "현재까지 본 기술 중 적용 가능성이 높은 5개를 우선순위로 정리해줘"
}
```

GET 응답에는 최근 Job 배열과 Worker heartbeat 상태를 포함한다.

### Source Bundle

- POST /api/research/source-bundles
- GET /api/research/source-bundles?fieldDayId=:id
- POST /api/research/source-bundles/:id/build
- POST /api/research/source-bundles/:id/sync-drive

### Analysis Brief

- POST /api/research/analysis-briefs
- GET /api/research/analysis-briefs?fieldDayId=:id
- POST /api/research/analysis-briefs/:id/sync-drive
- POST /api/research/analysis-briefs/:id/start-analysis

### Notebook Link

- PUT /api/research/notebook-link
- GET /api/research/notebook-link?fieldDayId=:id

### Results / Reports

- POST /api/projects/:id/research-results/import
- GET /api/projects/:id/research-results
- POST /api/research-results/:id/report-versions
- POST /api/report-versions/:id/revisions
- POST /api/report-versions/:id/finalize

## 9. 상태 머신

### Material

```text
COLLECTED → REVIEWED → CURATED → SYNC_READY → SYNCED
                     ↘ EXCLUDED
```

### QuickAnalysisJob

```text
QUEUED → RUNNING → COMPLETED
              ↘ FAILED
```

### SourceBundle

```text
DRAFT → BUILT → SYNCING → SYNCED
```

### AnalysisBrief

```text
DRAFT → READY → SYNCED → IN_ANALYSIS
```

### ResearchResult

```text
IMPORTED → UNDER_REVIEW → REVISION_NEEDED → APPROVED
```

### ReportVersion

```text
DRAFT → REVIEWED → FINAL
```

## 10. Quick Analysis Prompt 요구사항

Worker가 생성하는 prompt에는 최소 다음 정보가 포함되어야 한다.

- 사용자 instruction
- 프로젝트 title/location/date/description
- 최신 Analysis Brief(존재 시)
- Material ID/type/title/description/content/capturedAt/reviewStatus/isImportant
- 첨부 이미지와 해당 Evidence ID의 순서 매핑
- 결과 형식
- 근거 부족 시 명시 규칙

보안상 user instruction을 shell command로 평가하거나 실행해서는 안 된다. `spawn()` argument array와 stdin을 사용한다.

## 11. 오프라인/불안정 네트워크

```text
Capture
→ IndexedDB/local queue
→ Pending Upload
→ Network Recovery
→ Mac mini Upload
→ Stored
```

- 서버에 도착한 Evidence만 Quick Analysis 입력으로 사용한다.
- 아직 IndexedDB에만 남은 자료가 있으면 향후 UI에서 `업로드 대기 자료는 분석에 미포함` 상태를 표시할 수 있다.
- 업로드 완료 전 로컬 큐 데이터를 삭제하지 않는다.

## 12. 보안 요구사항

- Google OAuth credential은 환경변수 또는 OS 안전 저장소를 사용한다.
- 실제 credential을 Git에 커밋하지 않는다.
- NotebookLM 사용자 세션과 쿠키를 Gatherly DB에 저장하지 않는다.
- NotebookLM 비공식 endpoint를 사용하지 않는다.
- Codex auth 파일을 애플리케이션 DB나 Git 저장소에 저장하지 않는다.
- Quick Analysis Codex 실행은 기본 read-only sandbox를 사용한다.
- 사용자 입력은 stdin prompt로 전달하며 shell interpolation을 사용하지 않는다.
- stderr에 secret을 의도적으로 출력하지 않는다.

## 13. 운영 요구사항

- 운영 포트 기본값: 3001
- 로컬 DB: Prisma + SQLite
- 원본 파일: storage/uploads
- Quick Report 파일: storage/quick-analysis/{fieldDayId}/{jobId}.md
- Worker heartbeat: storage/runtime/quick-analysis-worker.json
- `npm run dev`/`npm run start` 시 Quick Analysis Worker를 함께 실행한다.
- `npm run worker:quick-analysis`로 Worker만 단독 실행할 수 있다.
- `npm run doctor`는 서버, Codex CLI, Quick Analysis heartbeat, Tailscale 상태를 확인한다.
- Tailscale를 통한 iPhone 내부 접근을 유지한다.
- Worker 실패가 앱 전체 장애로 이어지지 않아야 한다.

## 14. Codex 인증 및 실행 전제

- Mac mini에서 `codex --version`이 성공해야 한다.
- Mac mini에서 Codex CLI 사용자 로그인이 완료되어 있어야 한다.
- Quick Analysis는 저장된 CLI 인증을 재사용한다.
- `GATHERLY_CODEX_BIN`으로 실행 파일 경로를 재정의할 수 있다.
- Quick Analysis는 API key를 Gatherly `.env`에 필수로 요구하지 않는다.

## 15. 구현 우선순위

### Phase 1 — Quick Analysis MVP

1. QuickAnalysisJob schema
2. Quick Analysis API
3. Mac mini Codex Worker
4. Worker heartbeat/doctor
5. iPhone Quick Analysis UI
6. 실제 현장 Evidence로 end-to-end 테스트

### Phase 2 — Quick Analysis 고도화

1. 음성 전사 연결
2. 영상 핵심 프레임/메타 추출
3. Evidence citation UX
4. 결과 저장/비교/재분석
5. 외부 조사 provider 연결 여부 검토

### Phase 3 — Deep Research

1. Source Bundle 품질 고도화
2. Drive/Analysis Brief sync 안정화
3. NotebookLM/Gemini 모바일 사용성 검증
4. Result Import
5. 공식 NotebookLM 자동화 인터페이스 제공 시 provider 추가

### Phase 4 — Report Lifecycle

1. ResearchResult
2. ReportVersion
3. RevisionRequest
4. Final Google Docs/PDF

## 16. 수용 기준

- 기존 현장 Capture 기능이 회귀 없이 작동한다.
- iPhone에서 Quick Analysis Job을 생성할 수 있다.
- Mac mini 화면이나 Terminal을 직접 조작하지 않아도 Job이 자동 실행된다.
- Worker online 상태가 iPhone UI에 표시된다.
- Codex가 저장된 텍스트 Evidence와 이미지 Evidence를 사용해 Quick Report를 생성한다.
- 결과가 iPhone에 자동 갱신된다.
- Quick Analysis 실패 시 원본 Evidence는 영향을 받지 않는다.
- NotebookLM 연결이 없어도 Quick Analysis가 정상 작동한다.
- Source와 Analysis Brief를 Drive에 동기화할 수 있다.
- 필요 시 NotebookLM/Gemini Deep Research로 확장할 수 있다.
- 심층 결과를 ResearchResult/ReportVersion으로 이어갈 수 있다.

## 17. 명시적 비범위

- Gatherly 자체 검색 크롤러/검색 인덱스 구축
- NotebookLM 자동 로그인
- NotebookLM DOM 기반 브라우저 조작을 핵심 의존성으로 사용
- 비공식 NotebookLM API
- Codex의 원본 Evidence 수정 권한
- Quick Analysis를 법적·의료·재무 등 고위험 전문 판단의 무검증 최종 결론으로 사용하는 기능
