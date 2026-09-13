# Gatherly 2차 개발 SRS

## 1. 문서 정보

- 제품명: Gatherly
- 문서명: Phase 2 Software Requirements Specification
- 버전: 1.1
- 기준일: 2026-09-14
- 기준 브랜치: `phase2/research-execution-system`
- 기준 제품: Gatherly 1차 개발 완료본
- 관련 문서: `PRD.md`, `SRS.md`, `PRD_PHASE2.md`

2차 개발은 1차의 FieldDay, Material, QuickAnalysisJob, AnalysisBrief, SourceBundle, Report, Google Drive/Docs, Codex Worker를 유지하면서 `Research Plan → Target/Booth → Checkpoint → Evidence Mapping → Coverage → Gap → Next Action → Closeout` 실행계층을 추가한다.

**Research Plan은 Capture의 필수 전제조건이 아니다.** 시스템은 계획형 조사와 계획 없는 즉석 관찰 기록을 모두 지원해야 한다.

---

## 2. 시스템 목표

계획형 조사:

```text
사전조사
→ ResearchPlan
→ ResearchTarget/Booth
→ ResearchQuestion
→ ResearchCheckpoint
→ RequiredEvidence
→ 현장 방문
→ 체크리스트 화면 내 직접 Capture
→ EvidenceMapping
→ Coverage
→ Gap
→ NextAction
→ BoothCloseout
→ FieldCloseout
→ Quick Analysis / Final Report
```

즉석 관찰:

```text
FieldDay 선택
→ Plan/Target/Checkpoint 없이 Capture
→ Material 저장
→ Unclassified Evidence
→ 선택적 사후 Mapping
   ├→ 기존 Checkpoint 연결
   ├→ 새 Checkpoint 생성
   ├→ 새 Target 생성
   └→ 계획 밖 Evidence로 유지
→ Quick Analysis / Final Report
```

원칙:

- Research Plan이 없어도 Material Capture는 정상 작동한다.
- Checkpoint 선택 여부와 관계없이 Capture는 가능하다.
- Coverage는 AI 호출 없이 DB 상태만으로 재현 가능해야 한다.
- 매핑되지 않은 자유 Evidence는 Coverage를 자동 증가시키지 않는다.
- AI 결과는 추천/초안이며 사용자 수정이 가능해야 한다.
- Material 원본은 Research 기능 때문에 변경되지 않는다.
- AI Worker 장애 시에도 수동 체크, 자유 기록, Mapping, Closeout이 가능해야 한다.
- 1차 기능에 회귀가 없어야 한다.

---

## 3. 신규 데이터 모델

### 3.1 ResearchPlan

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

제약:
- `@@unique([fieldDayId, version])`
- FieldDay당 활성 Plan은 애플리케이션 수준에서 1개
- FieldDay는 ResearchPlan이 0개여도 유효하다.

### 3.2 ResearchTarget

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

### 3.3 ResearchQuestion

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

### 3.4 ResearchCheckpoint

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

### 3.5 RequiredEvidence

```text
id String PK
checkpointId String FK
evidenceType String
minimumCount Int
requireText Boolean
requireFile Boolean
description String?
```

기본 evidenceType: `IMAGE | VIDEO | AUDIO | TEXT | ANY`

### 3.6 EvidenceMapping

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

matchType: `MANUAL | CONTEXT_CAPTURE | AI_SUGGESTED | AI_AUTO | POST_CLASSIFIED`

제약: `@@unique([materialId, checkpointId])`

- `CONTEXT_CAPTURE`: 사용자가 특정 Checkpoint 화면에서 직접 자료를 생성한 경우
- `POST_CLASSIFIED`: 자유 Evidence를 나중에 Checkpoint에 연결한 경우

### 3.7 CoverageSnapshot

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

snapshotReason: `MATERIAL_CHANGE | CHECKPOINT_CHANGE | EVIDENCE_MAPPING_CHANGE | BOOTH_CLOSEOUT | FIELD_CLOSEOUT | REPORT_GENERATION | MANUAL_REFRESH`

### 3.8 ResearchGap

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

type: `NOT_STARTED | PARTIAL | MISSING_REQUIRED_EVIDENCE | BLOCKED`

status: `OPEN | DISMISSED | RESOLVED`

### 3.9 NextAction

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

source: `RULE | AI | MANUAL`

status: `OPEN | DONE | DISMISSED`

### 3.10 BoothCloseout

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
unclassifiedEvidenceCount Int
summaryJson String
forcedClose Boolean
closeNote String?
createdAt DateTime
```

### 3.11 FieldCloseout

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
unclassifiedEvidenceCount Int
summaryJson String
forcedClose Boolean
closeNote String?
createdAt DateTime
```

Closeout 레코드는 생성 시점의 immutable snapshot으로 취급한다.

---

## 4. 기존 모델 확장

### FieldDay

추가 relation:

```text
researchPlans ResearchPlan[]
coverageSnapshots CoverageSnapshot[]
boothCloseouts BoothCloseout[]
fieldCloseouts FieldCloseout[]
```

### Material

기존 Material 저장 구조를 그대로 유지한다. Research 관련 Context는 모두 선택 사항이다.

권장 추가 필드:

```text
captureMode String @default("FREE")
capturedTargetId String?
capturedCheckpointId String?
```

`captureMode` 값:

- `FREE`: Plan/Checkpoint와 무관한 즉석 관찰
- `TARGET`: 특정 Target에서 기록했지만 Checkpoint 미지정
- `CHECKPOINT`: 특정 Checkpoint Context에서 생성

추가 relation:

```text
evidenceMappings EvidenceMapping[]
```

중요 규칙:

- `fieldDayId`만 있으면 Material 저장 가능
- `capturedTargetId`, `capturedCheckpointId`는 nullable
- `captureMode=FREE` Material은 정상 상태이며 오류/미완료로 취급하지 않음
- Coverage의 정규 관계 기준은 `EvidenceMapping`으로 유지

### QuickAnalysisJob

선택 추가:

```text
researchPlanId String?
```

Plan이 없으면 기존 방식대로 모든 Stored Material을 사용한다.

### Report

선택 추가:

```text
researchPlanId String?
coverageSnapshotId String?
```

Plan이 없어도 기존 Final Report 생성은 유지한다.

---

## 5. Coverage 계산

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

전체, P1, P2, P3, Target별 Coverage를 계산한다.

RequiredEvidence 판정:

- EvidenceMapping으로 연결된 Material만 자동 충족 계산에 사용
- 최소 수량 전부 충족 → SATISFIED 후보
- 일부 충족 → PARTIAL
- 미충족 → NOT_STARTED
- 사용자 지정 BLOCKED/NOT_APPLICABLE은 자동 판정보다 우선
- `captureMode=FREE`이고 Mapping이 없는 Material은 Coverage 계산에서 제외

MVP에서는 AI가 Checkpoint 상태를 강제로 SATISFIED로 확정하지 않는다.

---

## 6. 핵심 기능 요구사항

### FR2-001 Research Plan CRUD

- FieldDay별 Plan 생성/조회/수정/버전 관리
- DRAFT → READY → ACTIVE 전환
- 활성 Plan은 한 FieldDay당 1개
- 기존 Plan은 삭제보다 ARCHIVED 권장
- Plan 생성 없이도 현장 기록 시작 가능

### FR2-002 Pre-Research 입력

지원:
- 텍스트 붙여넣기
- 기존 Material 선택
- 링크/문서 메타 입력
- 향후 Drive/Docs 연계

### FR2-003 AI Plan Draft

입력:
- FieldDay 정보
- objective
- preResearchText
- visitPurpose

출력:
- targets
- questions
- checkpoints
- requiredEvidence
- priorities

생성 결과는 DRAFT로 저장하고 사용자 확인 전 활성화하지 않는다.

### FR2-004 Target/Booth Planning

사용자는 방문 전 각 Target에 다음을 설정할 수 있다.

- 기업/부스명
- 부스번호 또는 위치 힌트
- 우선순위
- 방문 순서
- 사전 메모
- 질문
- 체크사항
- 필요한 Evidence

### FR2-005 Booth Detail Execution Screen

2차 개발의 핵심 모바일 화면이다.

화면은 한 Target/부스에 대해 다음 정보를 동시에 보여준다.

```text
Target 이름 / 부스번호
방문 상태
Coverage
P1 미충족 수
체크리스트
각 Checkpoint의 Evidence
Gap
Next Action
Capture controls
Free Capture control
Booth Closeout
```

이 화면에서 별도 자료수집함으로 이동하지 않고 바로 자료를 추가할 수 있어야 한다.

### FR2-006 Checkpoint In-context Capture

사용자가 Checkpoint를 선택한 상태에서 다음을 바로 실행할 수 있다.

- 사진 촬영
- 앨범 다중 선택
- 영상 선택
- 음성 선택
- 텍스트 메모

저장 흐름:

```text
Checkpoint 선택
→ Capture(captureMode=CHECKPOINT)
→ 기존 Material 저장 파이프라인
→ Material STORED 확인
→ EvidenceMapping(matchType=CONTEXT_CAPTURE) 생성
→ Checkpoint/Coverage 재계산
→ Gap/Next Action 갱신
```

기존 IndexedDB 업로드 대기, 다중 업로드, 재시도, SHA-256, 파일 검증 로직을 재사용한다.

업로드 실패 시 EvidenceMapping을 완료 처리하지 않는다.

### FR2-007 Free / Spontaneous Capture

사용자는 Research Plan, Target, Checkpoint 선택 여부와 관계없이 즉석 관찰을 기록할 수 있어야 한다.

진입점:

- 오늘의 현장
- 부스 상세
- 기존 자료수집함

지원:

- 사진 촬영
- 앨범 다중 선택
- 영상 선택
- 음성 선택
- 텍스트 메모

저장 흐름:

```text
즉석 관찰 기록
→ FieldDay 선택 확인
→ Capture(captureMode=FREE 또는 TARGET)
→ 기존 Material 저장 파이프라인
→ STORED
→ Mapping 없이 저장 완료 허용
→ Unclassified Evidence 목록에 노출
```

요구사항:

- Research Plan이 없어도 저장 가능
- Checkpoint가 없어도 저장 가능
- 현재 Target이 있으면 선택적으로 Target Context만 보존
- 자유 Evidence는 저장 직후 사용자 현장 흐름을 방해하지 않음
- 저장 후 즉시 새 Checkpoint 생성 요구 금지
- 자유 Evidence는 Quick Analysis/Final Report의 일반 Evidence로 사용 가능

### FR2-008 Unclassified Evidence Review

정리·분석 단계에서 Mapping 없는 자유 Evidence를 검토할 수 있어야 한다.

지원 작업:

```text
기존 Checkpoint 연결
새 Checkpoint 생성 후 연결
새 Target 생성 후 연결
계획 밖 Evidence로 유지
```

새 Checkpoint/Target 생성은 사용자 명시 동작 또는 AI 제안 후 승인으로 수행한다.

### FR2-009 수동 Evidence Mapping

- Material 상세에서 Checkpoint 연결/해제
- 한 Material을 여러 Checkpoint에 연결 가능
- 현재 Target 외 Checkpoint에도 사용자가 직접 연결 가능
- FREE Evidence를 사후 연결할 경우 matchType=`POST_CLASSIFIED`

### FR2-010 AI Mapping 추천

Codex 입력:
- Material type/title/content/description
- 지원 시 이미지
- 활성 Plan의 Target/Question/Checkpoint

출력 예:

```json
{
  "suggestions": [
    {
      "checkpointId": "checkpoint-id",
      "confidence": 0.87,
      "rationale": "가격표 이미지가 가격 확인 항목을 직접 뒷받침함"
    }
  ],
  "newCheckpointCandidate": null
}
```

자유 Evidence가 기존 Plan에 맞지 않으면 `newCheckpointCandidate` 또는 `newTargetCandidate`를 제안할 수 있다.

기본 정책은 사용자 확인 후 반영이다.

### FR2-011 Gap Engine

Open Gap 조건:

```text
NOT_STARTED
OR PARTIAL
OR BLOCKED
OR RequiredEvidence 미충족
```

재계산 트리거:
- Material 저장 완료 후 Mapping 생성
- EvidenceMapping 추가/삭제
- Checkpoint 상태 변경
- RequiredEvidence 변경
- Plan 활성화
- Booth/Field Closeout Preview

FREE Evidence 저장 자체는 Mapping이 없으면 Coverage/Gap 상태를 변경하지 않는다.

### FR2-012 Next Action

AI 없이 최소 rule-based Action을 생성한다.

```text
[P1] A사 - 설치비 확인 필요
필요 Evidence: 텍스트 메모 1건
```

AI 사용 시 행동형 문장으로 정제한다.

```text
A사 담당자에게 설치비 포함 여부를 질문하고 답변을 메모로 남기세요.
```

AI는 존재하지 않는 위치, 담당자, 가격을 생성하지 않는다.

### FR2-013 Booth Closeout

`이 부스 조사 완료` 실행 시:

- Target Coverage
- P1/P2 미충족
- RequiredEvidence 누락
- BLOCKED 항목
- 해당 Target에서 생성된 미분류 자유 Evidence 수
- 마지막 추천 행동

을 표시한다.

사용자는 미충족이 있어도 `forcedClose=true`와 선택적 사유를 남기고 종료 가능하다.

Target `visitStatus`는 COMPLETED로 변경한다.

### FR2-014 Field Closeout

전체 현장 종료 Preview:

- 전체 Coverage
- Target별 Coverage
- 미방문 Target
- 미충족 P1/P2
- BLOCKED
- 미분류 자유 Evidence 수
- 마지막 Next Action

강제 종료 가능하며 Closeout Snapshot을 저장하고 활성 ResearchPlan이 있으면 CLOSED로 전환한다.

Plan이 없는 FieldDay의 경우 Coverage 기반 Closeout 대신 `저장 자료 수 / 미분류 자료 수 / 최근 기록` 중심의 간단 Closeout을 제공하거나 기존 현장 상태 변경을 유지한다.

---

## 7. API 요구사항

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

### Capture

기존 `/api/materials/upload`와 `/api/materials`를 유지한다.

2차 확장 시 선택 파라미터:

```text
captureMode
capturedTargetId
capturedCheckpointId
```

모두 optional이어야 한다.

Checkpoint Capture는 저장 완료 후 Mapping API를 호출하거나 orchestration endpoint를 사용할 수 있다.

- `POST /api/research/checkpoints/:id/capture-link`

Free Capture는 별도 Research API가 없어도 기존 Material API만으로 완료 가능해야 한다.

### Evidence Mapping

- `GET /api/research/evidence-mappings?fieldDayId=:id`
- `POST /api/research/evidence-mappings`
- `DELETE /api/research/evidence-mappings/:id`
- `POST /api/research/evidence-mappings/suggest`
- `GET /api/research/unclassified-evidence?fieldDayId=:id`

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

---

## 8. UI 요구사항

### 8.1 조사 준비

- 현장 선택
- 조사 목적/사전조사 입력
- AI Plan 생성
- 방문 부스 목록
- 방문순서/우선순위
- 부스별 Questions/Checkpoints/RequiredEvidence
- 방문 준비 완료
- `계획 없이 기록 시작` 진입 허용

### 8.2 오늘의 현장

추가 표시:
- 활성 Plan
- Plan 없는 상태 표시
- 전체 Coverage(Plan 존재 시)
- P1 미충족(Plan 존재 시)
- 방문 예정/완료 Target 수
- 다음 방문 추천 Target
- Next Action
- **즉석 관찰 기록**
- 현장 종료 점검

### 8.3 부스 실행 화면

모바일 최우선.

권장 구성:

```text
[←] A사 · B-214
진행중 · Coverage 60%

P1 제품 가격 확인        ✓
P1 설치비 확인           □
P1 제품 전체 사진        □
P2 주요 고객사           △

선택: 설치비 확인
[사진] [앨범] [메모] [음성] [영상]

[+ 즉석 관찰 기록]

연결된 Evidence 0건
미분류 관찰 2건

부족한 정보
- 설치비
- 제품 전체 사진

다음 행동
- 설치비 포함 여부 질문

[이 부스 조사 완료]
```

Capture control은 화면 하단에 sticky 영역으로 제공하는 방안을 우선 검토한다.

Checkpoint가 선택되어 있지 않아도 Capture 버튼은 사용 가능하며 이 경우 FREE 또는 TARGET Capture로 저장한다.

### 8.4 빠른 기록 / 자유 Capture

모바일에서 최소 단계로 실행한다.

```text
즉석 관찰 기록
→ 유형 선택
→ 촬영/입력
→ 저장
→ 현재 화면으로 복귀
```

저장 완료 후 분류 화면을 강제로 띄우지 않는다.

### 8.5 자료수집함

기존 전체 Evidence 관리 화면으로 유지한다. 부스 화면과 자유 Capture에서 생성한 자료도 동일 Material로 표시한다.

추가 표시/필터:
- Checkpoint 연결됨
- Target만 연결됨
- 자유 Evidence
- 미분류 Evidence

### 8.6 정리·분석함

- Coverage Matrix
- Target별 Coverage
- Gap 목록
- Evidence Mapping Review
- **Unclassified Evidence Review**
- 새 Target/Checkpoint 후보
- Quick Analysis
- Analysis Brief

### 8.7 최종 보고서

보고서 생성 전 Coverage, 미확인 P1/P2, Closeout 상태, 미분류 Evidence 수를 표시한다.

---

## 9. Quick Analysis 확장

활성 Plan이 있으면 기존 prompt에 선택적으로 추가:

```text
# Active Research Plan
# Current Target
# Current Coverage
# Open P1/P2 Gaps
# Current Next Actions
# Unclassified / Spontaneous Evidence
```

Plan이 없으면 기존 1차 방식대로 Stored Evidence와 사용자 질문을 중심으로 분석한다.

대표 질문:
- 이 부스를 떠나도 되는가?
- 지금 가장 중요한 미확인 항목은?
- 어떤 사진이나 질문이 더 필요한가?
- 오늘 조사에서 무엇이 가장 부족한가?
- 방금 기록한 계획 밖 관찰이 중요한 발견인가?

현재 위치를 알 수 없으면 위치 기반 답변을 만들지 않는다.

---

## 10. Final Report 확장

Final Report Worker 입력에 추가 가능:

- ResearchPlan
- Target/Question/Checkpoint
- EvidenceMapping
- Unclassified/Free Evidence
- CoverageSnapshot
- Open Gap
- BoothCloseout / FieldCloseout

작성 원칙:

- 미확인 P1/P2는 `한계/미확인 사항`으로 명시
- 낮은 Coverage 영역을 확정적 사실로 표현하지 않음
- EvidenceMapping이 없더라도 직접 Evidence가 존재하는지 재검토
- 계획 밖에서 발견된 중요 Evidence는 `계획 외 주요 발견`으로 구분 가능

---

## 11. Research Intelligence Worker

권장 신규 Worker:

`scripts/gatherly-research-intelligence-worker.mjs`

작업 유형:

- PLAN_DRAFT
- MAPPING_SUGGESTION
- UNCLASSIFIED_EVIDENCE_REVIEW
- NEXT_ACTION_GENERATION
- BOOTH_CLOSEOUT_SUMMARY
- FIELD_CLOSEOUT_SUMMARY

권장 `ResearchAiJob`:

```text
id
fieldDayId
researchPlanId?
jobType
payloadJson
status
resultJson
errorMessageSafe
queuedAt
startedAt
completedAt
```

`researchPlanId`는 nullable이어야 한다.

상태: `QUEUED | RUNNING | COMPLETED | FAILED`

Codex CLI 기존 인증, stdin prompt, read-only Evidence 접근을 사용한다.

---

## 12. 마이그레이션/호환성

- 신규 모델/nullable 필드 추가 방식으로 마이그레이션
- 기존 FieldDay/Material/Report ID 유지
- 기존 Material은 `captureMode=FREE` 또는 legacy 처리 가능
- 기존 프로젝트는 ResearchPlan 없이도 정상 동작
- Plan 없는 프로젝트의 Capture/Quick Analysis/Final Report 유지
- 사용자가 원하는 기존 현장에 추후 Plan 생성 가능
- 자유 Evidence는 Plan 생성 후에도 그대로 유지하며 필요 시 사후 Mapping 가능

---

## 13. 비기능 요구사항

### 모바일
- 현장 핵심 기능은 한 손 사용 가능
- 부스 체크리스트와 Capture가 같은 화면에 존재
- Free Capture는 1~2번의 탭으로 시작 가능
- Capture를 위해 2개 이상의 화면을 왕복하지 않도록 설계
- 저장 직후 강제 분류를 요구하지 않음

### 성능
- Coverage 계산: 500ms 목표
- 체크 상태 변경 후 UI 반영: 2초 이내
- Booth Execution 화면 초기 로딩: 2초 이내 목표
- Free Capture 진입: 즉시
- AI Mapping/Next Action: 1~2분 목표
- Closeout Preview의 rule 기반 계산: 2초 이내

### 신뢰성
- 업로드 완료 전에 Mapping 완료 금지
- Free Capture는 Mapping 실패와 무관하게 저장 완료 상태 유지
- AI 실패가 Capture/수동 Mapping/Closeout을 막지 않음
- Closeout Snapshot 보존

### 보안
- preResearchText와 메모를 shell command로 사용하지 않음
- Codex 입력은 stdin
- secret/로컬 절대경로 UI 노출 금지

---

## 14. 수용 기준

- 방문 전에 부스별 체크사항을 만들 수 있다.
- 모바일에서 부스 하나를 열면 해당 체크리스트와 Coverage가 보인다.
- 체크사항을 선택한 상태에서 사진/메모/음성/영상 추가가 가능하다.
- **체크사항을 선택하지 않아도 즉석 관찰 기록이 가능하다.**
- **Research Plan이 전혀 없어도 기존 FieldDay에 자료를 추가할 수 있다.**
- 자유 Capture로 저장된 Material은 원본 Evidence로 정상 보존된다.
- 자유 Evidence를 나중에 기존 Checkpoint에 연결할 수 있다.
- 필요하면 자유 Evidence에서 새 Target/Checkpoint를 만들 수 있다.
- 연결되지 않은 자유 Evidence는 Coverage를 자동 변경하지 않는다.
- 저장된 Checkpoint Context Material이 해당 Checkpoint와 연결된다.
- 자료 추가/Mapping 후 Coverage가 갱신된다.
- P1/P2 미충족 항목이 Gap으로 표시된다.
- Next Action이 최소 rule 기반으로 생성된다.
- Booth Closeout에서 빠진 항목과 미분류 관찰 수를 확인할 수 있다.
- 전체 Field Closeout에서 미방문 부스, 핵심 미충족, 미분류 Evidence를 확인할 수 있다.
- Quick Analysis가 활성 Research Plan이 있으면 Plan Context를 사용하고, 없으면 기존 방식으로 작동한다.
- Final Report가 계획형 Evidence와 계획 밖 Evidence를 모두 활용할 수 있다.
- 1차 자료수집, Quick Analysis, Analysis Brief, Source Bundle, Final Report, Tailscale, Telegram 상태봇에 회귀가 없다.

---

## 15. 대표 테스트 시나리오

### 계획형

```text
1. 전시회 FieldDay 생성
2. 사전조사 붙여넣기
3. AI Research Plan 생성
4. A/B/C 부스와 체크사항 확정
5. A 부스 방문 시작
6. '가격 확인' 체크사항 선택
7. 가격표 사진 촬영 → 자동 Mapping
8. '설치비 확인' 체크사항 선택
9. 텍스트 메모 입력 → 자동 Mapping
10. Coverage 갱신 확인
11. Gap/Next Action 확인
12. Booth Closeout
13. B/C 부스 반복
14. Field Closeout
15. Final Report 생성
```

### 즉석 관찰

```text
1. FieldDay 생성 또는 기존 FieldDay 선택
2. Research Plan 없이 '즉석 관찰 기록' 실행
3. 사진 2장 + 텍스트 메모 저장
4. 모두 STORED 확인
5. Quick Analysis에서 해당 Evidence 사용 확인
6. 이후 Research Plan 생성
7. 미분류 Evidence Review에서 사진 1장을 기존 Checkpoint에 연결
8. 나머지 사진은 계획 밖 Evidence로 유지
9. Mapping된 Evidence만 Coverage에 반영되는지 확인
10. Final Report에서 계획 밖 주요 발견도 참조 가능한지 확인
```

---

## 16. 명시적 비범위

2차 MVP 제외:

- 실내 GPS/비콘 자동 위치 인식
- 전시장 지도 자동 동선 최적화
- 행사 공식 부스맵 자동 파싱
- 다중 사용자 실시간 협업
- NotebookLM 비공식 API 자동화
- 범용 웹 크롤러
- AI가 모든 Checkpoint를 사용자 확인 없이 자동 확정하는 기능
- 자유 Evidence를 AI가 사용자 승인 없이 자동으로 새 Plan 구조에 편입하는 기능

---

## 17. 구현 순서

```text
2A. Prisma 모델 + Plan CRUD + nullable Capture Context
2B. 조사 준비 UI + Target/Booth/Checkpoint 편집
2C. Booth Execution 화면 + Checkpoint In-context Capture
2D. Free/Spontaneous Capture + Unclassified Evidence Review
2E. EvidenceMapping + Coverage Engine
2F. Gap + Next Action
2G. Booth Closeout + Field Closeout
2H. Quick Analysis / Final Report 연계
2I. iPhone 현장 회귀 테스트
```

각 단계에서 `npm run db:push`, `npm run typecheck`, `npm run lint` 및 핵심 모바일 시나리오를 검증한다.

---

## 18. 2차 개발 완료 정의

계획형 흐름:

```text
현장 생성
→ 사전조사
→ Research Plan
→ 방문 부스와 체크사항 확정
→ 부스 상세 진입
→ 체크사항을 보면서 즉시 촬영/기록
→ Evidence 자동 연결
→ Coverage
→ Gap
→ Next Action
→ Booth Closeout
→ Field Closeout
→ Final Report
```

즉석 관찰 흐름:

```text
현장 선택
→ 계획 없이 즉석 관찰 기록
→ Material 저장
→ 계속 조사
→ 필요 시 사후 Mapping 또는 새 Target/Checkpoint 생성
→ Quick Analysis / Final Report
```

두 흐름이 모두 iPhone에서 끊기지 않고 수행되면 2차 개발을 완료로 판단한다.
