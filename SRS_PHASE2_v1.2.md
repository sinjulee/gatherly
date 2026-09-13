# Gatherly 2차 개발 SRS v1.3

기준일: 2026-09-14
기준 브랜치: `phase2/research-execution-system`
관련 문서: `PRD_PHASE2.md`, `SRS_PHASE2.md`, `DRIVE_WORKSPACE_PHASE2.md`

이 문서는 Gatherly 2차 개발의 현재 기준 SRS다. 기존 Research Execution, 자유 관찰 Capture, Research Package, NotebookLM Handoff 요구사항에 **현장명 기반 Shared Drive Workspace와 사전조사 Source 연계**를 통합한다.

## 1. 시스템 목표

```text
NotebookLM/Gemini/ChatGPT 사전조사
→ Drive 현장 Workspace / 00_사전조사
→ Research Plan
→ Target/Booth
→ Checkpoint
→ 계획형/즉석 Evidence Capture
→ Evidence Mapping
→ Coverage / Gap / Next Action
→ Booth / Field Closeout
→ Research Package
→ 같은 Drive 현장 Workspace 동기화
→ SOURCE_READY
→ NotebookLM Handoff
→ Deep Research / Final Report
```

Mac mini의 Prisma/SQLite와 로컬 파일 저장소를 원본 저장소로 유지한다. Google Drive는 사전조사와 Gatherly 산출물이 만나는 공유 Workspace이며 외부 연구도구에 전달하기 위한 동기화 레이어다. Drive/NotebookLM 장애가 현장 기록을 막아서는 안 된다.

## 2. 핵심 도메인

- `ResearchPlan`: 조사 목적과 실행 계획
- `ResearchTarget`: 기업/부스/제품/기술/사람/장소
- `ResearchQuestion`: 현장에서 답해야 할 질문
- `ResearchCheckpoint`: P1/P2/P3 체크 단위
- `RequiredEvidence`: 체크 완료에 필요한 Evidence 조건
- `EvidenceMapping`: Material과 Checkpoint 연결
- `CoverageSnapshot`: 전체/우선순위/Target별 충족도
- `ResearchGap`: 미충족/부분충족/Blocked 항목
- `NextAction`: Gap을 해결할 다음 행동
- `BoothCloseout`, `FieldCloseout`: 종료 시점 스냅샷
- `DriveWorkspace`: FieldDay와 Google Drive 현장 폴더 연결
- `PreResearchSource`: `00_사전조사` 개별 Source 참조
- `ResearchPackage`: 외부 연구용 버전 스냅샷
- `ResearchPackageItem`: Package 항목별 동기화/준비 상태

## 3. 데이터 모델 요구사항

### 3.1 FieldDay 확장

기존 FieldDay ID는 유지한다.

추가 권장 필드:

```text
driveProjectFolderId String?
driveProjectFolderUrl String?
driveWorkspaceLinkedAt DateTime?
driveWorkspaceLastScannedAt DateTime?
```

`driveProjectFolderId`를 Drive 연결의 영구 식별자로 사용한다. 폴더명은 식별자가 아니다.

### 3.2 ResearchPlan

```text
id String PK
fieldDayId String FK
parentPlanId String?
version Int
status String
isActive Boolean
title String
objective String
background String?
visitPurpose String?
decisionContext String?
targetScope String?
successCriteria String?
preResearchText String?
generatedByAi Boolean
createdAt DateTime
updatedAt DateTime
activatedAt DateTime?
closedAt DateTime?
```

상태: `DRAFT | READY | ACTIVE | CLOSED | ARCHIVED`
제약: `@@unique([fieldDayId, version])`
FieldDay당 활성 Plan은 애플리케이션 수준에서 1개.

### 3.3 ResearchTarget

```text
id String PK
researchPlanId String FK
name String
type String
boothNo String?
locationHint String?
description String?
priority String
visitOrder Int
visitStatus String
startedAt DateTime?
completedAt DateTime?
createdAt DateTime
updatedAt DateTime
```

`type`: `COMPANY | BOOTH | PRODUCT | TECHNOLOGY | PERSON | LOCATION | CATEGORY | OTHER`
`visitStatus`: `PLANNED | VISITING | COMPLETED | SKIPPED`

### 3.4 ResearchQuestion

```text
id String PK
researchPlanId String FK
targetId String? FK
question String
rationale String?
priority String
sortOrder Int
status String
```

### 3.5 ResearchCheckpoint

```text
id String PK
researchPlanId String FK
targetId String? FK
researchQuestionId String? FK
title String
description String?
priority String
status String
evidenceRequirement String?
completionNote String?
sortOrder Int
createdAt DateTime
updatedAt DateTime
```

priority: `P1 | P2 | P3`
status: `NOT_STARTED | PARTIAL | SATISFIED | BLOCKED | NOT_APPLICABLE`

### 3.6 RequiredEvidence

```text
id String PK
checkpointId String FK
evidenceType String
minimumCount Int
requireText Boolean
requireFile Boolean
description String?
```

`evidenceType`: `IMAGE | VIDEO | AUDIO | TEXT | ANY`

### 3.7 EvidenceMapping

```text
id String PK
materialId String FK
checkpointId String FK
matchType String
confidence Float?
rationale String?
confirmedByUser Boolean
createdAt DateTime
updatedAt DateTime
```

`matchType`: `MANUAL | CONTEXT_CAPTURE | AI_SUGGESTED | AI_AUTO`
제약: `@@unique([materialId, checkpointId])`

### 3.8 CoverageSnapshot

```text
id String PK
researchPlanId String FK
fieldDayId String FK
targetId String?
overallScore Float
p1Score Float
p2Score Float
p3Score Float
satisfiedCount Int
partialCount Int
missingCount Int
blockedCount Int
snapshotReason String
createdAt DateTime
```

snapshotReason: `MATERIAL_CHANGE | CHECKPOINT_CHANGE | BOOTH_CLOSEOUT | FIELD_CLOSEOUT | REPORT_GENERATION | MANUAL_REFRESH`

### 3.9 ResearchGap

```text
id String PK
researchPlanId String FK
checkpointId String FK
type String
status String
reason String
priority String
requiredAction String?
resolvedAt DateTime?
```

`type`: `NOT_STARTED | PARTIAL | MISSING_REQUIRED_EVIDENCE | BLOCKED`
`status`: `OPEN | DISMISSED | RESOLVED`

### 3.10 NextAction

```text
id String PK
researchPlanId String FK
targetId String? FK
checkpointId String? FK
title String
description String
priority String
status String
source String
sortOrder Int
completedAt DateTime?
```

`source`: `RULE | AI | MANUAL`
`status`: `OPEN | DONE | DISMISSED`

### 3.11 BoothCloseout / FieldCloseout

BoothCloseout:

```text
id String PK
fieldDayId String FK
researchPlanId String FK
targetId String FK
overallCoverage Float
p1Coverage Float
missingP1Count Int
missingP2Count Int
blockedCount Int
summaryJson String
forcedClose Boolean
closeNote String?
createdAt DateTime
```

FieldCloseout:

```text
id String PK
fieldDayId String FK
researchPlanId String FK
overallCoverage Float
p1Coverage Float
missingP1Count Int
missingP2Count Int
blockedCount Int
unvisitedTargetCount Int
summaryJson String
forcedClose Boolean
closeNote String?
createdAt DateTime
```

Closeout은 immutable snapshot으로 취급한다.

### 3.12 PreResearchSource

`00_사전조사`에 있는 개별 문서/파일의 참조 메타데이터다.

```text
id String PK
fieldDayId String FK
driveFileId String
name String
mimeType String?
webViewLink String?
modifiedTime DateTime?
sourceType String
selectedForPlan Boolean
contentHash String?
lastScannedAt DateTime
createdAt DateTime
updatedAt DateTime
```

`sourceType` 예: `NOTEBOOK_RESEARCH | VISIT_PLAN | CHECKLIST | INTERNAL_DOC | OTHER`

원본 Drive 파일은 Gatherly가 기본적으로 수정하지 않는다.

### 3.13 ResearchPackage

```text
id String PK
fieldDayId String FK
researchPlanId String?
version Int
status String
includedMaterialCount Int
syncedItemCount Int
failedItemCount Int
driveWorkspaceFolderId String?
builtAt DateTime?
syncedAt DateTime?
staleAt DateTime?
createdAt DateTime
updatedAt DateTime
```

상태: `DRAFT | BUILDING | READY_TO_SYNC | SYNCING | SOURCE_READY | PARTIAL | FAILED | STALE`

### 3.14 ResearchPackageItem

```text
id String PK
researchPackageId String FK
materialId String?
evidenceId String
itemType String
sourceKind String
sha256 String?
mimeType String?
driveFileId String?
driveFileUrl String?
syncStatus String
readinessStatus String
errorMessageSafe String?
createdAt DateTime
updatedAt DateTime
```

항목 상태 예: `READY | SYNCING | SYNCED | NEEDS_DERIVATIVE | ARCHIVE_ONLY | FAILED`

## 4. Shared Drive Workspace 요구사항

### 4.1 기본 구조

```text
Gatherly/
└─ Projects/
   └─ {현장명}/
      ├─ 00_사전조사/
      ├─ 01_현장자료/
      │  ├─ Evidence/
      │  │  ├─ Images/
      │  │  ├─ Audio/
      │  │  ├─ Video/
      │  │  └─ Other/
      │  ├─ Derived/
      │  ├─ Field Notes
      │  └─ Source Index
      ├─ 02_조사계획/
      │  ├─ Research Plan
      │  ├─ Booth Checklist
      │  └─ Research Questions
      ├─ 03_분석자료/
      │  ├─ Coverage and Gaps
      │  ├─ Closeout
      │  └─ Analysis Brief
      └─ 04_최종보고서/
```

2차 신규 Workspace 이름에는 FieldDay ID를 붙이지 않는다.

### 4.2 연결 규칙

- `driveProjectFolderId`가 있으면 해당 folderId를 우선 사용한다.
- 폴더명 변경만으로 연결이 끊기면 안 된다.
- 동일 이름 폴더가 여러 개면 자동 선택하지 않는다.
- 연결되지 않은 FieldDay에서만 현장명 검색 또는 새 폴더 생성 UI를 제공한다.
- 사용자가 명시적으로 기존 폴더를 선택하면 해당 folderId를 FieldDay에 저장한다.

### 4.3 기존 1차 폴더 호환

기존 `{현장명} ({fieldDayId8})` 폴더는 자동 삭제/이동하지 않는다.

지원 흐름:

```text
기존 폴더 감지
→ 사용자에게 재연결 후보 표시
→ 기존 폴더 그대로 사용 또는 새 현장명 Workspace 선택
→ folderId 저장
→ 필요 시 하위 폴더 구조만 보완
```

데이터 손실 없는 재연결이 우선이며, 자동 이름 변경은 필수 기능이 아니다.

## 5. 사전조사 Source 요구사항

`00_사전조사`는 NotebookLM/Gemini/ChatGPT/사용자가 만든 사전조사와 방문계획의 보관 영역이다.

필수 동작:

- 폴더 파일 목록 스캔
- 개별 Source 메타데이터 저장
- Plan에 사용할 Source 선택
- 파일 변경시 modifiedTime/hash 비교
- 새 Source 재스캔
- Research Plan 생성 시 선택 Source 정보를 입력 Context에 포함
- Research Plan과 Source 간 Lineage 저장 가능

Gatherly는 `00_사전조사` 파일을 자동 덮어쓰지 않는다.

## 6. 현장 실행 요구사항

부스 상세 화면에서 체크리스트, Coverage, Evidence, Gap, Next Action, Capture, Closeout을 한 화면에서 제공한다.

Checkpoint를 선택한 상태에서 사진·앨범·영상·음성·텍스트를 기록하면 Material 저장 완료 후 해당 Checkpoint와 연결하고 Coverage를 갱신한다.

Research Plan이나 Checkpoint가 없는 경우에도 즉석 관찰 기록을 허용한다. 자유 Evidence는 정상 Material로 저장하며 즉시 분류를 강제하지 않는다. 이후 기존 Checkpoint 연결, 새 Target/Checkpoint 생성, 미분류 유지가 가능하다.

## 7. Coverage 계산

기본 가중치:

```text
P1 = 5
P2 = 3
P3 = 1
```

상태 계수:

```text
NOT_STARTED = 0.0
PARTIAL = 0.5
SATISFIED = 1.0
BLOCKED = 0.0
NOT_APPLICABLE = 분모 제외
```

공식:

```text
weighted_total = Σ(priority_weight)
weighted_done = Σ(priority_weight × status_factor)
coverage = weighted_done / weighted_total × 100
```

RequiredEvidence 판정:
- 최소 수량 전부 충족 → SATISFIED 후보
- 일부 충족 → PARTIAL
- 미충족 → NOT_STARTED
- 사용자 지정 BLOCKED/NOT_APPLICABLE은 자동 판정보다 우선

AI가 Checkpoint 상태를 사용자 확인 없이 강제로 SATISFIED로 확정하지 않는다.

## 8. Research Package / Drive Sync 요구사항

`NotebookLM 자료 준비` 실행 시 다음을 packageVersion으로 스냅샷한다.

- STORED Material
- 계획형/즉석 Evidence
- Research Plan
- Target/Checkpoint
- Evidence Mapping
- Coverage
- Open Gap / Next Action
- Booth/Field Closeout
- Source 문서
- 선택 사전조사 Source 메타데이터
- Package manifest

자료 유형 처리:
- IMAGE: 실제 이미지 파일과 Evidence Context 포함
- TEXT: Field Notes/Source Index에 본문과 Evidence ID 포함
- AUDIO: 원본 포함, 전사본이 있으면 함께 포함
- VIDEO: 원본 포함, 전사/핵심 프레임은 파생물로 확장 가능

계획형/즉석형 Evidence를 동일한 Package 후보로 취급한다.

Drive 동기화 필수 요구사항:
- Evidence별 성공/실패 상태 추적
- Evidence ID와 SHA-256 기반 Lineage
- 동일 파일의 불필요한 재동기화 최소화
- 일부 실패 시 성공 항목 유지
- 실패 항목 개별 재시도
- Mac mini 내부 절대경로 외부 노출 금지
- 새 Evidence/Plan/Mapping/Closeout 변경 시 STALE 감지
- Research Package 결과를 동일 현장 Workspace에 저장

## 9. API 요구사항

### Drive Workspace
- `GET /api/research/drive-workspace?fieldDayId=:id`
- `POST /api/research/drive-workspace/link`
- `POST /api/research/drive-workspace/create`
- `POST /api/research/drive-workspace/scan-pre-research`
- `POST /api/research/drive-workspace/reconnect`

### PreResearchSource
- `GET /api/research/pre-research-sources?fieldDayId=:id`
- `PATCH /api/research/pre-research-sources/:id`

### Plan
- `GET /api/research/plans?fieldDayId=:id`
- `POST /api/research/plans`
- `GET /api/research/plans/:id`
- `PATCH /api/research/plans/:id`
- `POST /api/research/plans/:id/activate`
- `POST /api/research/plans/:id/ai-draft`

### Target
- `POST /api/research/plans/:id/targets`
- `PATCH /api/research/targets/:id`
- `DELETE /api/research/targets/:id`
- `POST /api/research/targets/:id/start-visit`
- `GET /api/research/targets/:id/execution`

### Question / Checkpoint / Requirement
- `POST /api/research/plans/:id/questions`
- `PATCH /api/research/questions/:id`
- `POST /api/research/plans/:id/checkpoints`
- `PATCH /api/research/checkpoints/:id`
- `POST /api/research/checkpoints/:id/requirements`
- `PATCH /api/research/requirements/:id`

### Capture / Mapping
- 기존 `/api/materials/upload` 재사용
- `POST /api/research/checkpoints/:id/capture-link`
- `GET /api/research/evidence-mappings?fieldDayId=:id`
- `POST /api/research/evidence-mappings`
- `DELETE /api/research/evidence-mappings/:id`
- `POST /api/research/evidence-mappings/suggest`

### Coverage / Gap / Action
- `GET /api/research/coverage?fieldDayId=:id`
- `POST /api/research/coverage/snapshot`
- `GET /api/research/gaps?fieldDayId=:id`
- `PATCH /api/research/gaps/:id`
- `GET /api/research/next-actions?fieldDayId=:id`
- `POST /api/research/next-actions/generate`
- `PATCH /api/research/next-actions/:id`

### Closeout
- `GET /api/research/targets/:id/closeout-preview`
- `POST /api/research/targets/:id/closeout`
- `GET /api/research/closeout/preview?fieldDayId=:id`
- `POST /api/research/closeout`

### Research Package
- `GET /api/research/packages?fieldDayId=:id`
- `POST /api/research/packages`
- `GET /api/research/packages/:id`
- `POST /api/research/packages/:id/build`
- `POST /api/research/packages/:id/sync-drive`
- `POST /api/research/packages/:id/retry-failed`

## 10. NotebookLM Handoff

NotebookLM 준비 화면에서 다음을 제공한다.

- 연결된 현장 Drive Workspace
- `00_사전조사` Source 수/최신 상태
- packageVersion/status
- 전체/포함/동기화/실패 Evidence 수
- IMAGE/TEXT/AUDIO/VIDEO별 준비 상태
- STALE/PARTIAL 원인
- 마지막 build/sync 시각
- Drive 열기
- NotebookLM 열기
- 권장 Source 목록

검증 흐름:

```text
Drive Workspace 미연결 → 연결/생성 필요
사전조사 미스캔 → 스캔 권장
Package 없음 → 생성 권장
STALE → 갱신 권장
PARTIAL → 누락 Evidence 표시
SOURCE_READY → NotebookLM Handoff 가능
```

NotebookLM Source 자동등록은 공식적으로 지원되는 방식이 확인되는 경우에만 구현한다. 비공식 로그인/화면 자동조작은 필수 범위에 포함하지 않는다.

## 11. Quick Analysis 확장

기존 prompt에 선택적으로 추가한다.

```text
# Active Research Plan
# Current Target
# Current Coverage
# Open P1/P2 Gaps
# Current Next Actions
# Selected Pre-Research Sources
```

대표 질문:
- 이 부스를 떠나도 되는가?
- 지금 가장 중요한 미확인 항목은?
- 어떤 사진이나 질문이 더 필요한가?
- 오늘 조사에서 무엇이 가장 부족한가?

## 12. Final Report 확장

Final Report Worker 입력에 추가 가능:
- ResearchPlan
- Target/Question/Checkpoint
- EvidenceMapping
- CoverageSnapshot
- Open Gap
- BoothCloseout / FieldCloseout
- ResearchPackage 상태
- PreResearchSource Lineage

작성 원칙:
- 미확인 P1/P2는 한계/미확인 사항으로 명시
- 낮은 Coverage 영역을 확정적 사실로 표현하지 않음
- EvidenceMapping이 없더라도 직접 Evidence가 존재하는지 재검토
- 사전조사 주장과 현장 확인 Evidence를 구분

## 13. Research Intelligence Worker

권장 Worker: `scripts/gatherly-research-intelligence-worker.mjs`

작업 유형:
- PLAN_DRAFT
- MAPPING_SUGGESTION
- NEXT_ACTION_GENERATION
- BOOTH_CLOSEOUT_SUMMARY
- FIELD_CLOSEOUT_SUMMARY

권장 `ResearchAiJob`:

```text
id
fieldDayId
researchPlanId
jobType
payloadJson
status
resultJson
errorMessageSafe
queuedAt
startedAt
completedAt
```

상태: `QUEUED | RUNNING | COMPLETED | FAILED`
Codex CLI 기존 인증, stdin prompt, read-only Evidence 접근을 사용한다.

## 14. 비기능 요구사항

### 모바일
- 현장 핵심 기능은 한 손 사용 가능
- 부스 체크리스트와 Capture가 같은 화면에 존재
- Capture를 위해 2개 이상의 화면을 왕복하지 않음

### 성능
- Coverage 계산: 500ms 목표
- 체크 상태 변경 후 UI 반영: 2초 이내
- Booth Execution 초기 로딩: 2초 이내 목표
- Closeout Preview rule 계산: 2초 이내
- Drive Source 목록은 페이지네이션/증분 조회 가능하게 설계

### 신뢰성
- 업로드 완료 전에 Mapping 완료 금지
- AI 실패가 Capture/수동 Mapping/Closeout을 막지 않음
- Drive 장애가 Local Capture를 막지 않음
- Closeout Snapshot 보존
- 사전조사 원본 자동 덮어쓰기 금지
- 기존 1차 Drive 자료 자동 삭제 금지

### 보안
- preResearchText/메모를 shell command로 사용하지 않음
- Codex 입력은 stdin
- secret/환경변수/로컬 절대경로 UI/Drive Source 노출 금지

## 15. 수용 기준

- 방문 전에 부스별 체크사항을 만들 수 있다.
- 계획 없이도 즉석 관찰 기록이 가능하다.
- 모바일 체크리스트 화면 안에서 사진/메모/음성/영상 기록이 가능하다.
- Evidence를 사후 Checkpoint에 연결할 수 있다.
- Coverage/Gap/Next Action이 갱신된다.
- Booth/Field Closeout이 가능하다.
- 사용자가 `현장명` Drive 폴더를 FieldDay에 연결하거나 생성할 수 있다.
- Drive 연결은 폴더명이 아닌 folderId를 기준으로 유지된다.
- Drive 폴더명을 변경해도 연결이 유지된다.
- `00_사전조사` 파일 목록을 스캔하고 Research Plan 입력으로 선택할 수 있다.
- Gatherly가 `00_사전조사` 원본을 임의 수정하지 않는다.
- ResearchPackage를 생성할 수 있다.
- 실제 Evidence와 Source 문서를 동일 현장 Workspace에 동기화할 수 있다.
- 일부 실패 시 성공 항목은 유지하고 실패 항목만 재시도할 수 있다.
- 새 Evidence 이후 기존 Package의 STALE 상태를 감지할 수 있다.
- SOURCE_READY 상태에서 NotebookLM Handoff를 제공한다.
- 기존 `{현장명} ({fieldDayId8})` 폴더를 데이터 손실 없이 재연결할 수 있다.
- 1차 자료수집, Quick Analysis, Analysis Brief, Source Bundle, Final Report, Tailscale, Telegram 상태봇에 회귀가 없다.

## 16. 대표 테스트 시나리오

```text
1. FieldDay 생성
2. Drive의 `2026 푸드위크` 현장 Workspace 연결
3. 00_사전조사에 NotebookLM 조사자료/방문계획 저장
4. Gatherly에서 사전조사 Source 스캔 및 선택
5. AI Research Plan 생성
6. A/B/C 부스와 체크사항 확정
7. A 부스 방문 시작
8. 가격표 사진 촬영 → 자동 Mapping
9. 설치비 답변 텍스트 메모 → 자동 Mapping
10. 계획 밖 흥미로운 제품 사진을 즉석 기록
11. Coverage 갱신 및 Gap/Next Action 확인
12. Booth Closeout
13. B/C 부스 반복
14. Field Closeout
15. Research Package 생성
16. 실제 Evidence를 같은 `2026 푸드위크` Drive Workspace에 Sync
17. SOURCE_READY 확인
18. NotebookLM Handoff
19. Final Report 생성
20. Drive 폴더명을 변경한 뒤에도 folderId 연결 유지 확인
```

## 17. 명시적 비범위

2차 MVP 제외:
- 실내 GPS/비콘 자동 위치 인식
- 전시장 지도 자동 동선 최적화
- 행사 공식 부스맵 자동 파싱
- 다중 사용자 실시간 협업
- NotebookLM 비공식 API 자동화
- 범용 웹 크롤러
- AI가 모든 Checkpoint를 사용자 확인 없이 자동 확정하는 기능
- 기존 Drive 폴더 강제 이름 변경/강제 삭제

## 18. 구현 순서

```text
2A Research Plan Core
2B Shared Drive Workspace 연결 + PreResearchSource
2C 조사 준비 UI
2D Booth Execution
2E In-context + Free Observation Capture
2F EvidenceMapping + Coverage
2G Gap + Next Action
2H Booth / Field Closeout
2I ResearchPackage + PackageItem
2J Source Docs 확장 + Drive Evidence Sync
2K Package Status / Retry / STALE Detection
2L NotebookLM 준비 UI + Handoff
2M Quick Analysis / Final Report 연계
2N 기존 ID 포함 Drive 폴더 재연결/마이그레이션 테스트
2O iPhone + Drive + NotebookLM E2E 테스트
```

각 단계에서 `npm run db:push`, `npm run typecheck`, `npm run lint` 및 핵심 모바일 시나리오를 검증한다.

## 19. 완료 정의

```text
현장 Drive Workspace 연결
→ 00_사전조사 NotebookLM/사용자 자료 스캔
→ Research Plan
→ 계획형/즉석 Evidence Capture
→ Coverage/Gap/Next Action
→ Closeout
→ ResearchPackage
→ 같은 현장 Workspace에 실제 Evidence + Source Docs Drive Sync
→ SOURCE_READY
→ NotebookLM Handoff
→ Deep Research / Final Report
```

이 흐름이 iPhone과 Mac mini 환경에서 끊기지 않고 수행되고, 기존 1차 Drive 구조의 재연결까지 데이터 손실 없이 검증되면 2차 개발을 완료로 판단한다.