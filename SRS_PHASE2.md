# Gatherly 2차 개발 SRS

## 1. 문서 정보

- 제품명: Gatherly
- 문서명: Phase 2 Software Requirements Specification
- 버전: **1.4**
- 기준일: **2026-09-14**
- 기준 브랜치: `phase2/research-execution-system`
- 기능 구현 기준 커밋: `c981c12abae819cbcd27ce7b0b4247e2f32de993`
- 문서 상태: **Phase 2 Milestone 1 통합 기준본**
- 상위 문서: `PRD_PHASE2.md`

이 문서는 Gatherly 2차 개발의 최신 기술 기준본이다. 앞으로 Phase 2 구현 판단 시 `SRS_PHASE2.md`를 우선한다. `SRS_PHASE2_v1.2.md`, `SRS_PHASE2_DRIVE_QUOTA_ADDENDUM.md`, `SRS_PHASE2_NOTEBOOKLM_SYNC_ADDENDUM.md` 등은 변경 이력으로 유지한다.

---

## 2. 시스템 목표

Gatherly 2차는 1차의 FieldDay, Material, QuickAnalysisJob, AnalysisBrief, SourceBundle, Report, Google Drive/Docs, Codex Worker를 유지하면서 다음 실행계층을 추가한다.

```text
PreResearchSource
→ ResearchPlan
→ ResearchTarget
→ ResearchQuestion
→ ResearchCheckpoint
→ RequiredEvidence
→ EvidenceMapping
→ CoverageSnapshot
→ ResearchGap
→ NextAction
→ BoothCloseout / FieldCloseout
→ ResearchPackage
→ Google Drive Shared Workspace
→ NotebookLM Handoff
```

Research Plan은 Capture의 전제조건이 아니다. 계획형 조사와 계획 없는 즉석 관찰 기록을 모두 지원해야 한다.

Mac mini의 Prisma/SQLite와 로컬 파일 저장소가 원본이다. Drive/NotebookLM 장애가 현장 Capture를 막아서는 안 된다.

---

## 3. 기술 스택 및 기존 기반

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS 4
- Prisma 6.19
- SQLite
- Mac mini local storage
- IndexedDB upload queue
- Google OAuth refresh token 기반 Drive/Docs 연동
- Codex CLI Worker
- PWA

기존 서버 기본 포트: `3001`

기존 주요 Worker:

- Quick Analysis worker
- Final Report worker

---

## 4. 프로젝트 컨텍스트 아키텍처

### 4.1 단일 Project Context

`components/analysis-workspace-shell.tsx`가 `projectId`를 유일하게 소유한다.

```text
AnalysisWorkspaceShell
  projectId
  selectedProject
     ├─ ResearchPrepWorkspace(project)
     ├─ QuickAnalysisWorkspace(project)
     ├─ ResearchPipelineWorkspace(project)
     └─ AnalysisBriefWorkspaceUnified(project)
```

하위 컴포넌트는 독립적인 project selector를 가지지 않는다.

필수 규칙:

1. 프로젝트 선택 UI는 정리·분석함 최상단 하나만 존재한다.
2. 하위 컴포넌트는 부모에서 전달받은 `project.id`만 API 요청의 `fieldDayId`로 사용한다.
3. 프로젝트가 변경되면 하위 컴포넌트는 새 project prop을 기준으로 데이터를 다시 조회한다.
4. Quick Analysis, Research Pipeline, Analysis Brief에 별도의 프로젝트 select를 추가하지 않는다.
5. 선택값 불일치가 생길 수 있는 local `projectId` 복제는 금지한다.

현재 구현 파일:

- `components/analysis-workspace-shell.tsx`
- `components/research-prep-workspace.tsx`
- `components/quick-analysis-workspace.tsx`
- `components/research-pipeline-workspace.tsx`
- `components/analysis-brief-workspace-unified.tsx`

구형 `components/analysis-brief-workspace.tsx`는 제거되었다.

---

## 5. 구현 완료 데이터 모델

### 5.1 FieldDay Drive 확장

구현 완료 필드:

```prisma
driveProjectFolderId         String?
driveProjectFolderUrl        String?
driveWorkspaceLinkedAt       DateTime?
driveWorkspaceLastScannedAt  DateTime?
preResearchSources           PreResearchSource[]
```

`driveProjectFolderId`가 Shared Drive Workspace의 canonical identifier다. 폴더명은 식별자로 사용하지 않는다.

### 5.2 ResearchPlan

구현 완료.

```text
id
fieldDayId
parentPlanId?
version
status
isActive
title
objective
background?
visitPurpose?
decisionContext?
targetScope?
successCriteria?
preResearchText?
generatedByAi
createdAt
updatedAt
activatedAt?
closedAt?
```

상태 설계:

`DRAFT | READY | ACTIVE | CLOSED | ARCHIVED`

제약:

- `@@unique([fieldDayId, version])`
- FieldDay당 활성 Plan은 애플리케이션 수준에서 1개

### 5.3 ResearchTarget

구현 완료.

```text
id
researchPlanId
name
type
boothNo?
locationHint?
description?
priority
visitOrder
visitStatus
startedAt?
completedAt?
createdAt
updatedAt
```

권장 type:

`COMPANY | BOOTH | PRODUCT | TECHNOLOGY | PERSON | LOCATION | CATEGORY | OTHER`

visitStatus:

`PLANNED | VISITING | COMPLETED | SKIPPED`

### 5.4 ResearchQuestion

구현 완료.

```text
id
researchPlanId
targetId?
question
rationale?
priority
sortOrder
status
createdAt
updatedAt
```

### 5.5 ResearchCheckpoint

구현 완료.

```text
id
researchPlanId
targetId?
researchQuestionId?
title
description?
priority
status
evidenceRequirement?
completionNote?
sortOrder
createdAt
updatedAt
```

priority:

`P1 | P2 | P3`

status:

`NOT_STARTED | PARTIAL | SATISFIED | BLOCKED | NOT_APPLICABLE`

### 5.6 RequiredEvidence

구현 완료.

```text
id
checkpointId
evidenceType
minimumCount
requireText
requireFile
description?
createdAt
updatedAt
```

지원 evidenceType:

`IMAGE | VIDEO | AUDIO | TEXT | ANY`

### 5.7 PreResearchSource

구현 완료.

```text
id
fieldDayId
driveFileId
name
mimeType?
webViewLink?
modifiedTime?
sourceType
selectedForPlan
contentHash?
lastScannedAt
createdAt
updatedAt
```

제약:

```text
@@unique([fieldDayId, driveFileId])
```

원본 Drive 파일은 기본적으로 수정하지 않는다.

---

## 6. 향후 구현 데이터 모델

다음 모델은 요구사항은 확정됐지만 Milestone 1 기준 아직 미구현이다.

### 6.1 EvidenceMapping

```text
id
materialId FK
checkpointId FK
matchType
confidence?
rationale?
confirmedByUser
createdAt
updatedAt
```

matchType:

`MANUAL | CONTEXT_CAPTURE | AI_SUGGESTED | AI_AUTO`

제약:

`@@unique([materialId, checkpointId])`

### 6.2 CoverageSnapshot

```text
id
researchPlanId
fieldDayId
targetId?
overallScore
p1Score
p2Score
p3Score
satisfiedCount
partialCount
missingCount
blockedCount
snapshotReason
createdAt
```

snapshotReason:

`MATERIAL_CHANGE | CHECKPOINT_CHANGE | BOOTH_CLOSEOUT | FIELD_CLOSEOUT | REPORT_GENERATION | MANUAL_REFRESH`

### 6.3 ResearchGap

```text
id
researchPlanId
checkpointId
type
status
reason
priority
requiredAction?
resolvedAt?
```

### 6.4 NextAction

```text
id
researchPlanId
targetId?
checkpointId?
title
description
priority
status
source
sortOrder
completedAt?
```

### 6.5 BoothCloseout / FieldCloseout

Closeout은 immutable snapshot으로 취급한다.

### 6.6 ResearchPackage / ResearchPackageItem

ResearchPackage 상태:

`DRAFT | BUILDING | READY_TO_SYNC | SYNCING | SOURCE_READY | PARTIAL | FAILED | STALE`

Drive quota block은 별도의 오류코드 또는 block reason으로 표현한다.

---

## 7. 구현 완료 Research Plan API

### Plan

```text
GET    /api/research/plans?fieldDayId=:id
POST   /api/research/plans
GET    /api/research/plans/:id
PATCH  /api/research/plans/:id
POST   /api/research/plans/:id/activate
```

### Target

```text
POST   /api/research/plans/:id/targets
PATCH  /api/research/targets/:id
DELETE /api/research/targets/:id
```

### Question

```text
POST   /api/research/plans/:id/questions
PATCH  /api/research/questions/:id
```

### Checkpoint

```text
POST   /api/research/plans/:id/checkpoints
PATCH  /api/research/checkpoints/:id
```

### RequiredEvidence

```text
POST   /api/research/checkpoints/:id/requirements
PATCH  /api/research/requirements/:id
```

모든 API는 기존 Next.js Route Handler + Prisma 패턴을 유지한다.

---

## 8. Shared Drive Workspace

### 8.1 폴더 구조

신규 Workspace:

```text
Gatherly/
└─ Projects/
   └─ {현장명}/
      ├─ 00_사전조사/
      ├─ 01_현장자료/
      ├─ 02_조사계획/
      ├─ 03_분석자료/
      └─ 04_최종보고서/
```

FieldDay ID를 사용자에게 보이는 현장 폴더명에 붙이지 않는다.

### 8.2 구현 완료 Drive helper

`lib/google-drive-workspace.ts`

현재 책임:

- Google OAuth access token 획득
- 현장명 Workspace 생성
- Workspace folder 조회
- 기본 하위 폴더 생성/보완
- 기존 현장명/ID 포함 폴더 후보 탐색
- `00_사전조사` 파일 목록 스캔

### 8.3 구현 완료 API

```text
GET  /api/research/drive-workspace?fieldDayId=:id
POST /api/research/drive-workspace/create
POST /api/research/drive-workspace/link
GET  /api/research/drive-workspace/candidates?fieldDayId=:id
POST /api/research/drive-workspace/scan-pre-research
```

동작 규칙:

- `driveProjectFolderId`가 존재하면 해당 folderId를 우선 사용
- 폴더 이름 변경은 연결에 영향 없음
- 같은 이름 후보가 여러 개면 자동 선택 금지
- 사용자가 명시적으로 연결할 때만 canonical folderId 변경
- 기존 `{현장명} ({fieldDayId8})` 폴더는 삭제/rename하지 않음

---

## 9. PreResearchSource API

구현 완료.

```text
GET   /api/research/pre-research-sources?fieldDayId=:id
PATCH /api/research/pre-research-sources/:id
```

PATCH는 최소 다음을 지원한다.

- `selectedForPlan`
- `sourceType`

스캔 시 동일 `fieldDayId + driveFileId`는 같은 Source로 취급한다.

---

## 10. Research Prep UI

구현 파일:

`components/research-prep-workspace.tsx`

역할:

1. Drive Workspace 상태 조회
2. 새 Workspace 생성
3. 기존 폴더 후보 표시
4. 기존 폴더 재연결
5. `00_사전조사` 새로고침
6. PreResearchSource 목록 표시
7. Plan 사용 Source 선택
8. NotebookLM URL 조회/저장
9. Drive / NotebookLM 링크 열기

NotebookLM URL 데이터는 기존 `NotebookLink`를 그대로 사용한다.

별도 `프로젝트 Notebook 연결` 대형 카드 UI는 제거하고 Research Prep 안에 통합한다.

---

## 11. 기존 NotebookLink 유지 규칙

NotebookLink는 중복 데이터가 아니다.

```text
NotebookLink
fieldDayId unique
notebookUrl
notebookLabel?
```

유지 이유:

- Analysis Brief의 NotebookLM Handoff가 URL을 사용함
- Drive Workspace folder와 Notebook notebook은 서로 다른 외부 리소스임

UI 중복만 제거한다.

기존 API 유지:

```text
GET /api/research/notebook-link?fieldDayId=:id
PUT /api/research/notebook-link
```

---

## 12. Quick Analysis

기존 1차 기능을 유지한다.

현재 요구사항:

- `QuickAnalysisWorkspace`는 부모가 전달한 단일 `project`만 사용
- 프로젝트 선택 UI 없음
- `fieldDayId = project.id`
- 최신 Analysis Brief를 자동 참조 가능
- Mac mini Codex worker 사용
- NotebookLM은 필수 의존성 아님

---

## 13. Research Pipeline / Source Bundle

기존 SourceBundle 기능을 유지한다.

현재 UI 요구사항:

- 부모가 전달한 단일 project를 사용
- 하위 프로젝트 select 없음
- 해당 FieldDay의 Material만 필터
- Evidence 검토/연구선정
- Source Bundle 생성
- Source 문서 build
- Drive sync

### 13.1 중요한 현재 통합 과제

**기존 `lib/google-workspace-sync.ts`의 SourceBundle/AnalysisBrief 동기화 로직은 1차 폴더 규칙을 사용하던 코드가 남아 있을 수 있다.**

따라서 다음 단계에서 반드시 확인/수정해야 한다.

```text
기존: {projectTitle} ({fieldDayId8}) / 01_Source / ...

목표: FieldDay.driveProjectFolderId가 있으면
      Shared Workspace의 semantic folder를 canonical destination으로 사용
```

즉, `ResearchPrepWorkspace`에서 생성한 Shared Drive Workspace와 실제 SourceBundle/AnalysisBrief/FinalReport sync가 동일 folderId를 사용하도록 완전 통합되어야 한다.

중복 Drive 프로젝트 폴더 생성은 금지한다.

이 항목은 Milestone 1 UI/메타데이터 연결 완료 이후의 **필수 후속 기술작업**이다.

---

## 14. Analysis Brief

현재 구현 파일:

`components/analysis-brief-workspace-unified.tsx`

규칙:

- 상단 선택 project만 사용
- 자체 프로젝트 selector 없음
- Analysis Brief CRUD/Drive sync 기존 API 재사용
- NotebookLM 준비상태 확인 시 `NotebookLink` 조회

주요 입력:

- title
- goal
- researchQuestions
- decisionContext
- evaluationCriteria
- additionalInstruction
- outputType

기존 API:

```text
GET  /api/research/analysis-briefs?fieldDayId=:id
POST /api/research/analysis-briefs
POST /api/research/analysis-briefs/:id/sync-drive
POST /api/research/analysis-briefs/:id/start-analysis
```

---

## 15. 현장 실행 요구사항

### 15.1 Booth Execution

향후 부스 상세화면에서 다음을 동시에 제공한다.

- Target 정보
- Checkpoint 리스트
- RequiredEvidence
- Coverage
- Gap
- NextAction
- 사진/앨범/메모/음성/영상 Capture
- Booth Closeout

별도 Inbox로 이동하지 않고 체크사항 화면 안에서 기록할 수 있어야 한다.

### 15.2 Context Capture

Checkpoint를 선택한 상태에서 Capture 시:

```text
1. Material 생성
2. uploadStatus STORED 확인
3. EvidenceMapping 생성
4. matchType = CONTEXT_CAPTURE
5. Coverage 재계산
```

Material STORED 이전에는 EvidenceMapping을 확정하지 않는다.

### 15.3 Free Observation

Research Plan/Target/Checkpoint 없이도 기존 Material API로 Capture할 수 있어야 한다.

- 분류 강제 금지
- Coverage 영향 없음
- Quick/Final Report 사용 가능
- 사후 Mapping 가능

---

## 16. Coverage 계산 규칙

priority weight:

```text
P1 = 5
P2 = 3
P3 = 1
```

status factor:

```text
NOT_STARTED = 0.0
PARTIAL = 0.5
SATISFIED = 1.0
BLOCKED = 0.0
NOT_APPLICABLE = denominator 제외
```

공식:

```text
weighted_total = Σ(priority_weight)
weighted_done  = Σ(priority_weight × status_factor)
coverage       = weighted_done / weighted_total × 100
```

RequiredEvidence 자동판정 후보:

- 전부 충족: SATISFIED 후보
- 일부 충족: PARTIAL 후보
- 없음: NOT_STARTED 후보

사용자의 BLOCKED/NOT_APPLICABLE 지정은 자동 판정보다 우선한다.

AI가 사용자 확인 없이 SATISFIED를 강제 확정하지 않는다.

---

## 17. Closeout

BoothCloseout과 FieldCloseout은 immutable snapshot으로 저장한다.

부스 종료 시 최소 포함:

- overallCoverage
- p1Coverage
- missingP1Count
- missingP2Count
- blockedCount
- summaryJson
- forcedClose
- closeNote

FieldCloseout은 추가로 `unvisitedTargetCount`를 포함한다.

---

## 18. Research Package

향후 ResearchPackage 생성 시 포함 대상:

- STORED Material
- 계획형 Evidence
- 자유 Evidence
- ResearchPlan
- Target / Question / Checkpoint
- EvidenceMapping
- CoverageSnapshot
- Open ResearchGap
- NextAction
- Booth/FieldCloseout
- SourceDocument
- 선택된 PreResearchSource 메타데이터
- manifest

ResearchPackageItem은 Evidence ID, sha256, MIME type, driveFileId, syncStatus, readinessStatus를 추적한다.

새 Evidence/Plan/Mapping/Closeout 변경 시 기존 package를 STALE로 표시할 수 있어야 한다.

---

## 19. 실제 미디어 Drive Sync 요구사항

기존 1차 SourceBundle sync는 Markdown 기반 Source 문서를 Google Docs로 동기화하는 수준이다.

Phase 2는 다음을 추가해야 한다.

- IMAGE 실제 파일 upload
- AUDIO 실제 파일 upload
- VIDEO 실제 파일 upload
- 필요 시 Derived artifact 생성
- Evidence ID + sha256 lineage
- 이미 성공한 파일 재업로드 최소화
- partial success 유지
- failed item 개별 retry

NotebookLM에 로컬 Mac mini 파일 경로만 전달해서는 안 된다.

---

## 20. Google Drive quota 처리

Drive storage quota 부족 오류는 일반 transient error와 분리한다.

권장 error code:

`BLOCKED_STORAGE_QUOTA`

quota 감지 시:

```text
Sync 중단
→ 성공 항목 유지
→ 실패/대기 항목 보존
→ 자동 retry 금지
→ 사용자 경고
→ Google Drive 열기
→ 사용자 공간 확보
→ [다시 시도]
→ 미완료 항목만 재개
```

필수 조건:

- timer 기반 자동 retry 금지
- worker 무한 retry 금지
- capture blocking 금지
- 같은 sha256/driveFileId 성공 항목 skip
- package는 SOURCE_READY가 될 수 없음
- UI에 완료/대기 수 표시

예시 상태:

```text
package.status = PARTIAL
package.blockReason = BLOCKED_STORAGE_QUOTA
```

실제 schema 표현은 구현 시 enum 대신 String 기반 기존 패턴을 유지해도 된다.

---

## 21. 오류 및 안전 원칙

### Drive 장애

- Capture는 계속 가능
- 로컬 Material 저장은 계속 가능
- Drive 오류는 안전한 메시지로 표시
- OAuth secret은 클라이언트에 노출 금지

### 중복 폴더

동일 현장명 Drive folder가 여러 개면 자동 연결 금지.

### 폴더 rename

folderId 연결을 유지하므로 rename만으로 linkage를 끊지 않는다.

### 데이터 삭제

기존 ID 포함 Drive folder를 자동 삭제/이동/rename하지 않는다.

### 로컬 경로

Mac mini absolute path를 외부 API response나 Drive 문서에 불필요하게 노출하지 않는다.

---

## 22. Milestone 1 구현 상태

### IMPLEMENTED

- ResearchPlan schema
- ResearchTarget schema
- ResearchQuestion schema
- ResearchCheckpoint schema
- RequiredEvidence schema
- Research Plan Core API
- FieldDay Drive metadata
- PreResearchSource schema
- Drive Workspace create/link/status
- 기존/신규 Drive folder 후보 조회
- `00_사전조사` scan
- PreResearchSource 선택/수정
- Research Prep UI
- NotebookLM URL UI 통합
- 단일 상단 Project Context
- Quick Analysis 하위 selector 제거
- Research Pipeline 하위 selector 제거
- Analysis Brief 하위 selector 제거
- Unified Analysis Brief component
- Legacy Analysis Brief selector component 삭제

### USER VERIFIED

- `사전조사 · 방문 준비` UI 표시
- Workspace 생성 실행 성공
- 상단 프로젝트 변경 시 하단 프로젝트명/컨텍스트 함께 변경

### PENDING

- Research Plan 편집 UI
- AI Plan draft
- Booth/Target 실행 UI
- In-context Capture
- EvidenceMapping
- CoverageSnapshot
- Gap / NextAction
- Closeout
- ResearchPackage / Item
- 실제 media Drive upload
- quota runtime handling UI
- Shared Workspace와 기존 SourceBundle/AnalysisBrief/FinalReport sync의 완전 통합
- NotebookLM end-to-end handoff 검증

---

## 23. 회귀 검증 기준

다음 개발마다 최소 확인한다.

```text
npm run db:generate
npm run db:push
npm run typecheck
npm run lint
```

UI 회귀 체크:

1. 최상단 프로젝트를 변경한다.
2. Research Prep가 동일 project로 변경되는지 확인한다.
3. Quick Analysis가 동일 project를 사용하는지 확인한다.
4. Research Pipeline Material/Bundle이 동일 project만 표시하는지 확인한다.
5. Analysis Brief가 동일 project만 조회/생성하는지 확인한다.
6. 하위 영역에 별도 프로젝트 select가 없는지 확인한다.
7. Workspace 생성/연결 후 새로고침해도 folderId 연결이 유지되는지 확인한다.
8. 기존 NotebookLink가 Research Prep와 Analysis Brief 양쪽에서 같은 URL로 인식되는지 확인한다.

---

## 24. 다음 구현 순서

```text
2C-1 Research Plan 편집 UI
2C-2 Target/Booth + Question + Checkpoint 편집
2C-3 RequiredEvidence 편집
2D-1 Booth Execution 화면
2D-2 Context Capture
2D-3 Free Observation 진입점
2E EvidenceMapping
2E CoverageSnapshot
2F Gap + NextAction
2G Booth / Field Closeout
2H ResearchPackage / Item
2I 실제 Evidence Drive Sync
2I-2 Shared Workspace canonical sync 통합
2J STALE / retry / quota handling
2K NotebookLM Handoff E2E
2L Quick Analysis / Final Report 연계
```

이 순서를 기준으로 기존 1차 기능을 유지하면서 확장한다.
