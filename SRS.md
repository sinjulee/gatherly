# Gatherly Software Requirements Specification

## 1. 문서 개요

- 문서명: Gatherly Software Requirements Specification
- 문서 버전: 2.0
- 기준일: 2026-09-10
- 대상 시스템: Gatherly PWA, Mac mini 로컬 서버, Prisma/SQLite, 로컬 파일 저장소, Google Drive/Docs 연동, NotebookLM Handoff, Telegram 상태 봇
- 관련 문서: PRD.md

## 2. 시스템 목표

Gatherly는 현장 조사 자료를 안전하게 수집·보관하고, NotebookLM이 분석하기 좋은 Source Bundle과 Analysis Brief로 구조화한 뒤 Google Drive를 통해 연구 단계로 연결하며, NotebookLM 결과를 다시 Gatherly로 회수하여 수정·버전 관리·최종 산출물 관리까지 수행해야 한다.

Gatherly는 자체 Deep Research 엔진을 구현하지 않는다.

## 3. 전체 시스템 구성

```text
iPhone Safari/PWA
      │
      ▼
Gatherly Next.js
      │
      ├── Project Service
      ├── Capture Service
      ├── Research Inbox
      ├── Source Builder
      ├── Analysis Brief Service
      ├── Drive Sync Service
      ├── Result Import Service
      ├── Report Manager
      └── Audit/Lineage Service
      │
      ├── Prisma → SQLite
      ├── Local File Storage
      └── Google Drive / Docs
                    │
                    ▼
                NotebookLM
                    │
            Research / Analysis
                    │
                    ▼
              Google Docs
                    │
                    ▼
             Gatherly Import
```

Telegram 상태 봇과 Tailscale 내부 접근 구조는 기존 1차 구현을 유지한다.

## 4. 주요 도메인 모델

### 4.1 Project

필드 예:

- id
- title
- description
- location
- startDate
- endDate
- status
- deletedAt
- createdAt
- updatedAt

### 4.2 ResearchAsset

현장 원본 자료.

- id
- projectId
- type: IMAGE | VIDEO | AUDIO | TEXT | LINK | DOCUMENT
- title
- memo
- originalName
- storagePath
- mimeType
- fileSize
- sha256
- capturedAt
- locationText
- uploadStatus
- reviewStatus
- deletedAt
- createdAt
- updatedAt

### 4.3 SourceBundle

NotebookLM 연구에 전달할 구조화 자료 묶음.

- id
- projectId
- version
- title
- status
- manifestJson
- createdAt
- updatedAt

### 4.4 SourceBundleItem

- id
- sourceBundleId
- researchAssetId
- sourceType
- order
- included

### 4.5 SourceDocument

- id
- sourceBundleId
- documentType
- localPath
- driveFileId
- checksum
- syncStatus
- lastSyncedAt

### 4.6 AnalysisBrief

- id
- projectId
- sourceBundleId
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

### 4.7 NotebookLink

- id
- projectId
- notebookUrl
- notebookLabel
- createdAt
- updatedAt

MVP에서는 NotebookLM 인증 토큰이나 사용자 세션을 저장하지 않는다.

### 4.8 SyncJob

- id
- projectId
- sourceBundleId nullable
- analysisBriefId nullable
- jobType
- status
- attemptCount
- errorCode nullable
- errorMessageSafe nullable
- startedAt
- completedAt

### 4.9 ResearchResult

- id
- projectId
- sourceBundleId
- analysisBriefId
- title
- googleDocId
- importedAt
- status
- version

### 4.10 ReportVersion

- id
- researchResultId
- versionNo
- title
- googleDocId nullable
- localSnapshotPath nullable
- revisionReason nullable
- status
- createdAt

### 4.11 RevisionRequest

- id
- reportVersionId
- type
- instruction
- status
- createdAt
- resolvedAt nullable

## 5. 주요 데이터 관계

```text
Project
 ├── ResearchAsset[]
 ├── SourceBundle[]
 │    ├── SourceBundleItem[] → ResearchAsset
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
- 프로젝트 상세에 자료 수, 정리 진행률, Source 준비 상태, 최근 동기화 상태, 보고서 상태를 표시한다.

### FR-002 Multi-asset Capture

- 사진 다중 선택을 지원한다.
- 한 번에 여러 파일을 선택해도 각 파일을 독립 ResearchAsset으로 저장한다.
- 영상, 음성, 텍스트, 링크, 문서를 지원한다.
- 업로드 중 앱 이탈 시 경고한다.
- 브라우저 로컬 큐를 이용해 미완료 업로드를 보존한다.

### FR-003 Upload Integrity

- clientUploadId로 중복 요청을 방지한다.
- 파일은 임시 경로에 기록 후 검증 완료 시 최종 경로로 rename한다.
- SHA-256을 저장한다.
- 파일 저장 성공과 DB 상태 전환 순서를 통제한다.
- 실패 시 재시도 가능해야 한다.

### FR-004 Research Inbox

- Project, type, reviewStatus로 필터링한다.
- 제목·메모·태그를 수정할 수 있다.
- 중요 표시, 제외, Source 포함 여부를 설정할 수 있다.
- 원본 파일 미리보기/재생을 지원한다.

### FR-005 Source Builder

시스템은 CURATED 상태의 ResearchAsset을 사용해 다음 문서를 생성할 수 있어야 한다.

- project_overview.md
- field_notes.md
- interview_transcripts.md
- photo_evidence.md
- document_index.md
- research_questions.md
- source_manifest.md

각 Source 항목에는 가능한 경우 `asset_id`를 포함한다.

예:

```text
[PHOTO-20260910-023]
제목: 경쟁사 부스 신제품 패키지
관찰: ...
원본: Gatherly ResearchAsset PHOTO-20260910-023
```

### FR-006 Source Bundle Versioning

- Source Bundle 생성 시 version을 증가시킨다.
- 원본 ResearchAsset의 수정 또는 포함/제외 변경이 있으면 변경 감지 상태를 표시한다.
- 이미 분석한 Bundle은 삭제보다 immutable snapshot 유지가 원칙이다.

### FR-007 Google Drive Folder Provisioning

프로젝트별로 다음 논리 구조를 지원한다.

```text
Gatherly/Projects/{project}/
  01_Source/
  02_Analysis_Brief/
  03_NotebookLM_Result/
  04_Final_Report/
```

실제 폴더 ID는 DB에 저장할 수 있다.

### FR-008 Drive Sync

- 파일별 driveFileId, checksum, lastSyncedAt, syncStatus를 저장한다.
- checksum이 동일하면 중복 업로드하지 않는다.
- syncStatus: PENDING | SYNCING | SYNCED | FAILED
- 실패 시 안전한 오류 메시지와 재시도 기능을 제공한다.
- Drive 실패는 Capture 기능을 차단하지 않는다.

### FR-009 Analysis Brief

사용자가 분석 실행 전에 다음 정보를 입력/수정할 수 있어야 한다.

- analysis_title
- analysis_goal
- research_questions
- decision_context
- evaluation_criteria
- target_scope
- exclude_scope
- output_type
- additional_instruction

Analysis Brief는 버전 관리하며 Google Drive 문서로 동기화할 수 있다.

### FR-010 NotebookLM Handoff

- 프로젝트별 Notebook URL을 저장할 수 있다.
- `NotebookLM 열기` 버튼을 제공한다.
- 버튼 실행 전 Source Bundle 및 Analysis Brief 동기화 상태를 표시한다.
- MVP에서는 NotebookLM 내부 버튼 클릭, 자동 프롬프트 입력, 로그인 자동화를 수행하지 않는다.

### FR-011 Research Pipeline Status

프로젝트 화면에 다음 단계를 표시한다.

1. 자료수집
2. 자료정리
3. NotebookLM 준비
4. 분석방향
5. NotebookLM 연구
6. 결과검토
7. 수정/보강
8. 최종보고서

각 단계는 NOT_STARTED | IN_PROGRESS | BLOCKED | DONE 상태 중 하나를 가진다.

### FR-012 Result Import

- Google Docs 문서를 ResearchResult로 연결할 수 있다.
- 사용자가 직접 문서를 선택하는 방식은 필수 지원한다.
- 프로젝트 Result Folder에서 새 문서를 감지하는 방식은 선택 구현 가능하다.
- 결과 문서의 googleDocId를 저장한다.

### FR-013 Report Versioning

- ResearchResult 최초 가져오기 시 v1을 생성한다.
- 사용자의 주요 수정이나 재연구 결과 반영 시 새 버전을 생성한다.
- 이전 버전을 조회할 수 있어야 한다.
- FINAL 상태의 버전을 하나 지정할 수 있다.

### FR-014 Revision Request

타입:

- TEXT_EDIT
- STRUCTURE_CHANGE
- RESEARCH_EXPANSION
- NEW_RESEARCH_QUESTION
- EVIDENCE_ADDITION
- SOURCE_UPDATE

TEXT_EDIT와 STRUCTURE_CHANGE는 보고서 편집 작업으로 처리한다.

나머지 연구 관련 타입은 새 AnalysisBrief revision을 만드는 흐름으로 연결한다.

### FR-015 Evidence Lineage

- ResearchResult가 어떤 SourceBundle과 AnalysisBrief를 사용했는지 저장한다.
- SourceBundleItem을 통해 원본 ResearchAsset을 역추적할 수 있어야 한다.
- ReportVersion에서 ResearchResult로 역추적할 수 있어야 한다.

### FR-016 Google Docs Direct Editing

- Gatherly는 Google Docs 링크를 제공한다.
- 사용자가 Docs에서 직접 수정할 수 있다.
- Gatherly는 문서 ID와 버전 메타데이터를 관리한다.

### FR-017 PDF Output

- 최종 확정 ReportVersion을 PDF 출력 가능한 상태로 연결한다.
- MVP에서는 Google Docs의 PDF export를 기본 경로로 사용한다.

## 7. Mac mini Worker 요구사항

Mac mini worker의 책임은 다음으로 제한한다.

- Source 문서 생성
- 파일 변환/정제
- 동기화 job 처리
- checksum 계산
- 문서 후처리
- 상태 기록

다음 책임을 맡지 않는다.

- 범용 웹 Research
- Deep Research
- Citation 탐색
- 최종 연구 판단
- NotebookLM을 대체하는 보고서 생성 엔진

## 8. API 요구사항 예시

### Project

- GET /api/projects
- POST /api/projects
- GET /api/projects/:id
- PATCH /api/projects/:id
- DELETE /api/projects/:id

### ResearchAsset

- POST /api/materials/upload
- GET /api/materials
- PATCH /api/materials/:id
- DELETE /api/materials/:id

### Source Bundle

- POST /api/projects/:id/source-bundles
- GET /api/projects/:id/source-bundles
- GET /api/source-bundles/:id
- POST /api/source-bundles/:id/build
- POST /api/source-bundles/:id/sync

### Analysis Brief

- POST /api/projects/:id/analysis-briefs
- GET /api/projects/:id/analysis-briefs
- PATCH /api/analysis-briefs/:id
- POST /api/analysis-briefs/:id/sync

### Notebook Link

- PUT /api/projects/:id/notebook-link
- GET /api/projects/:id/notebook-link

### Results

- POST /api/projects/:id/research-results/import
- GET /api/projects/:id/research-results
- GET /api/research-results/:id

### Reports

- POST /api/research-results/:id/report-versions
- GET /api/research-results/:id/report-versions
- POST /api/report-versions/:id/revisions
- POST /api/report-versions/:id/finalize

## 9. 상태 머신

### ResearchAsset

```text
COLLECTED → REVIEWED → CURATED → SYNC_READY → SYNCED
                     ↘ EXCLUDED
```

### SourceBundle

```text
DRAFT → BUILT → SYNC_PENDING → SYNCED → USED_FOR_RESEARCH
```

### AnalysisBrief

```text
DRAFT → READY → SYNCED → USED_FOR_RESEARCH
```

### ResearchResult

```text
IMPORTED → UNDER_REVIEW → REVISION_NEEDED → APPROVED
```

### ReportVersion

```text
DRAFT → REVIEWED → FINAL
```

## 10. 동기화 요구사항

- 동기화는 동일 요청 반복 시 결과가 중복 생성되지 않도록 idempotent해야 한다.
- 파일 checksum과 Drive file ID를 이용한다.
- 동기화 job은 attemptCount를 기록한다.
- 재시도 가능 오류와 사용자 조치 필요 오류를 구분한다.
- Secret, Authorization 헤더, 내부 stack은 UI/로그에 노출하지 않는다.

## 11. 오프라인/불안정 네트워크

```text
Capture
→ IndexedDB/local queue
→ Pending Upload
→ Network Recovery
→ Mac mini Upload
→ Stored
```

- 원본 캡처는 NotebookLM/Drive 상태와 무관하게 가능해야 한다.
- 업로드 완료 전 로컬 큐 데이터를 삭제하지 않는다.
- 서버가 성공 응답한 후에만 해당 큐 항목을 제거한다.

## 12. 보안 요구사항

- Google OAuth credential은 환경변수 또는 OS 안전 저장소를 사용한다.
- 실제 credential을 Git에 커밋하지 않는다.
- NotebookLM 사용자 세션과 쿠키를 Gatherly DB에 저장하지 않는다.
- NotebookLM 비공식 endpoint를 사용하지 않는다.
- 사용자 입력을 shell 명령으로 전달하지 않는다.
- Telegram 상태 봇 보안 규칙은 기존 SRS v1 요구사항을 유지한다.

## 13. 운영 요구사항

- 운영 포트 기본값: 3001
- 로컬 DB: Prisma + SQLite
- 원본 파일: storage/uploads
- 앱과 Telegram 상태 봇은 독립 프로세스로 운영한다.
- Tailscale를 통한 iPhone 내부 접근을 유지한다.
- Google Drive 동기화 worker 실패가 앱 전체 장애로 이어지지 않아야 한다.

## 14. 기존 보고서 구현 롤백 정책

2026-09-09에 추가된 다음 계열의 구현은 v2 기준 브랜치에서 사용하지 않는다.

- Codex report plan worker
- 자체 analysis plan approval/report generation API
- 자체 AI Reports 중심 데이터 모델
- Gatherly 자체 Research Engine을 전제로 한 report workflow

필요 시 backup branch에서 참조할 수 있으나 v2의 기반으로 재사용하지 않는다.

## 15. 구현 우선순위

### Phase 1 — Data/Foundation

1. 기존 Capture 안정성 유지
2. Prisma 모델을 ResearchAsset/SourceBundle/AnalysisBrief 중심으로 확장
3. Research Inbox 상태 확장
4. Research Pipeline 상태 계산

### Phase 2 — Source Builder

1. Source Bundle 생성 UI
2. Source 문서 생성
3. Evidence ID 삽입
4. Bundle versioning

### Phase 3 — Google Drive

1. Google 연결
2. 프로젝트 폴더 생성/선택
3. Source sync
4. Analysis Brief sync
5. sync status/retry

### Phase 4 — NotebookLM Handoff

1. Notebook URL 저장
2. 준비 상태 확인
3. NotebookLM 열기 UX
4. 연구 진행 상태 수동/반자동 관리

### Phase 5 — Result/Report

1. Google Docs 결과 가져오기
2. ResearchResult 저장
3. ReportVersion
4. RevisionRequest
5. Final/PDF

## 16. 수용 기준

- 기존 현장 Capture 기능이 회귀 없이 작동한다.
- 한 번에 여러 장의 사진을 각각 독립 asset으로 저장한다.
- CURATED 자료만으로 Source Bundle을 생성할 수 있다.
- Source 문서에서 원본 asset ID를 확인할 수 있다.
- Source와 Analysis Brief를 Drive에 동기화할 수 있다.
- 동일 파일 재동기화 시 중복 파일이 생기지 않는다.
- NotebookLM 열기 전에 준비 상태를 확인할 수 있다.
- NotebookLM 결과 Google Docs를 ResearchResult로 연결할 수 있다.
- 보고서 수정 요청을 연구 재실행 필요 여부에 따라 분기할 수 있다.
- 최종 ReportVersion에서 SourceBundle과 원본 ResearchAsset까지 역추적할 수 있다.

## 17. 명시적 비범위

- 자체 Deep Research
- 자체 웹 검색 엔진
- NotebookLM 자동 로그인
- NotebookLM 브라우저 자동 조작
- 비공식 NotebookLM API
- Codex 기반 자체 연구·보고서 생성 파이프라인
