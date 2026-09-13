# Gatherly 2차 개발 PRD

## 1. 문서 정보

- 제품명: Gatherly
- 문서명: Phase 2 Product Requirements Document
- 버전: **1.5**
- 기준일: **2026-09-14**
- 기준 브랜치: `phase2/research-execution-system`
- 기능 구현 기준 커밋: `c981c12abae819cbcd27ce7b0b4247e2f32de993`
- 제품 포지셔닝: **AI Field Research OS / Research Execution System**
- 문서 상태: **Phase 2 Milestone 1 기준본**

이 문서는 2차 개발의 최신 제품 기준본이다. 앞으로 기능 판단 시 `PRD_PHASE2.md`를 우선한다. `DRIVE_WORKSPACE_PHASE2.md`, `PRD_PHASE2_DRIVE_QUOTA_ADDENDUM.md` 등 기존 보완 문서는 변경 이력으로 유지하되, 본 문서와 충돌할 경우 본 문서를 우선한다.

---

## 2. 제품 정의

Gatherly는 범용 AI 리서치 도구가 아니라, AI가 만든 조사계획을 실제 현장에서 실행하고 완결하는 **Research Execution System**이다.

핵심 제품 루프는 다음과 같다.

```text
PRE-RESEARCH
NotebookLM / Gemini / ChatGPT / 내부문서
→ Drive 00_사전조사

PLAN
→ Research Plan
→ Target / Booth
→ Question / Checkpoint / Required Evidence

FIELD
→ 계획형 기록 + 즉석 관찰 기록
→ Evidence
→ Evidence Mapping
→ Coverage
→ Gap
→ Next Action
→ Booth / Field Closeout

SYNC
→ Research Package
→ 동일 현장 Drive Workspace
→ SOURCE_READY

RESEARCH / REPORT
→ NotebookLM 심층분석 또는 Gatherly Codex 분석
→ Final Report
→ Evidence Lineage 유지
```

Gatherly가 반드시 소유해야 하는 정보는 다음이다.

- 무엇을 조사하려 했는가
- 무엇을 실제로 확인했는가
- 어떤 Evidence가 어떤 조사 항목의 근거인가
- 무엇이 부족한가
- 현장에서 다음에 무엇을 해야 하는가
- 언제 부스/현장을 종료해도 되는가
- 어떤 사전조사가 계획의 근거였는가
- 어떤 자료가 외부 연구도구로 전달되었는가
- 어떤 근거로 최종 결론이 만들어졌는가

---

## 3. 핵심 제품 원칙

### 3.1 Local-first

Mac mini가 원본 저장소다.

- 메타데이터/텍스트: Prisma + SQLite
- 사진/영상/음성 원본: Mac mini 로컬 파일 저장소
- 현장 즉시 분석: Mac mini Codex CLI
- 모바일 Capture: 네트워크 장애 시 IndexedDB 임시 저장 후 재전송

Google Drive는 원본 DB를 대체하지 않는다. Drive는 사전조사와 현장 Evidence, 조사계획, 분석산출물, 최종보고서를 연결하는 **공유 Research Workspace 및 외부 AI 전달 레이어**다.

### 3.2 Capture는 Research Plan에 종속되지 않는다

Research Plan, Target, Checkpoint가 없어도 사용자는 언제든 사진·영상·음성·텍스트를 기록할 수 있어야 한다.

즉석 관찰 기록은 정상 Evidence다.

- 저장 전에 분류를 강제하지 않는다.
- 미분류 상태로 유지할 수 있다.
- 추후 Target/Checkpoint에 연결 가능하다.
- 연결 전에는 Coverage를 올리지 않는다.
- Quick Analysis와 Final Report에서는 사용할 수 있다.

### 3.3 프로젝트 선택은 한 곳에서만 한다

`정리·분석함`의 **최상단 현장 선택**이 전체 하위 기능의 단일 기준값이다.

하위 영역은 별도의 현장 선택 UI를 가지지 않는다.

상단 선택값은 다음에 동일하게 적용된다.

```text
사전조사 · 방문 준비
Quick Analysis
NotebookLM 연구 준비 / Source Bundle
분석 방향 설정 / Analysis Brief
```

이 원칙은 프로젝트 컨텍스트 불일치와 사용자의 선택 혼란을 방지하기 위한 필수 UX 규칙이다.

### 3.4 NotebookLM 연결은 중복 UI를 만들지 않는다

기존 `NotebookLink` 데이터와 API는 유지한다. Analysis Brief의 NotebookLM Handoff가 저장된 URL을 사용하기 때문이다.

단, 별도의 `프로젝트 Notebook 연결` 카드는 제거하고 **사전조사 · 방문 준비** 영역에 통합한다.

따라서 사용자는 한 영역에서 다음을 관리한다.

- 현장 Drive Workspace
- `00_사전조사` Source
- Research Plan에 사용할 사전자료 선택
- NotebookLM URL 저장/변경
- Drive 열기 / NotebookLM 열기

---

## 4. Shared Drive Workspace

### 4.1 현장 Workspace 구조

신규 2차 Workspace의 최상위 폴더명은 **현장명만 사용**한다. FieldDay ID는 사용자에게 보이는 폴더명에 넣지 않는다.

```text
Gatherly/
└─ Projects/
   └─ {현장명}/
      ├─ 00_사전조사/
      ├─ 01_현장자료/
      │  ├─ Evidence/
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

### 4.2 연결 규칙

Gatherly와 Drive Workspace의 실제 연결은 폴더명이 아니라 **Google Drive folderId**로 유지한다.

FieldDay은 다음 메타데이터를 가진다.

```text
driveProjectFolderId
driveProjectFolderUrl
driveWorkspaceLinkedAt
driveWorkspaceLastScannedAt
```

따라서 사용자가 `2026 푸드위크`를 `2026 서울 푸드위크`로 이름 변경해도 folderId가 같으면 연결은 유지되어야 한다.

동일 이름 폴더가 여러 개면 자동 연결하지 않는다. 사용자가 직접 선택해야 한다.

### 4.3 기존 1차 Drive 폴더 호환

기존 구조의 폴더는 자동 삭제, 이동, 이름 변경하지 않는다.

예:

```text
2026 푸드위크 (69c5e6f4)
```

Gatherly는 다음 후보를 찾아 사용자에게 제시할 수 있다.

- `{현장명}`
- `{현장명} ({fieldDayId8})`

사용자가 `[이 폴더 연결]`을 선택하면 해당 folderId를 FieldDay에 저장하고 필요한 신규 하위 폴더만 보완한다.

---

## 5. 사전조사 · 방문 준비

### 5.1 `00_사전조사`

NotebookLM, Gemini, ChatGPT, 웹검색, 내부문서 등에서 만든 사전조사와 방문계획을 보관한다.

Gatherly는 원본 파일을 임의로 합치거나 덮어쓰지 않는다.

개별 Source는 `PreResearchSource`로 참조한다.

주요 정보:

- Drive fileId
- 파일명
- MIME type
- webViewLink
- modifiedTime
- sourceType
- Research Plan 사용 여부 (`selectedForPlan`)

### 5.2 사용 흐름

```text
상단 현장 선택
→ Drive Workspace 생성 또는 기존 폴더 연결
→ 00_사전조사 스캔
→ Source 목록 확인
→ Research Plan에 사용할 자료 체크
→ NotebookLM URL 필요 시 저장
→ Research Plan 작성/생성
```

### 5.3 NotebookLM Handoff

NotebookLM Notebook URL은 FieldDay 기준으로 저장한다.

Drive Workspace와 NotebookLM Notebook은 동일 개념이 아니므로 데이터는 분리 유지한다. 하지만 사용자 UI에서는 사전조사 준비 흐름 안에 함께 배치한다.

NotebookLM Source 자동등록은 공식적으로 안정적인 방법이 확인되는 범위에서만 구현한다. 비공식 API, 로그인 자동화, DOM 자동화는 핵심 의존성으로 사용하지 않는다.

---

## 6. Research Plan

### 6.1 ResearchPlan

현장 전체 조사 목적과 실행계획이다.

- 버전 관리
- FieldDay당 활성 Plan 1개
- 상태: `DRAFT | READY | ACTIVE | CLOSED | ARCHIVED`
- 사전조사 내용/Source를 입력 근거로 사용할 수 있음

### 6.2 ResearchTarget

방문 또는 조사 대상이다.

예:

- COMPANY
- BOOTH
- PRODUCT
- TECHNOLOGY
- PERSON
- LOCATION
- CATEGORY
- OTHER

주요 속성:

- name
- boothNo
- locationHint
- description
- priority
- visitOrder
- visitStatus

### 6.3 ResearchQuestion

현장에서 답해야 할 질문이다. 전체 Plan 또는 특정 Target과 연결할 수 있다.

### 6.4 ResearchCheckpoint

현장에서 확인해야 할 최소 실행 단위다.

우선순위:

- P1 반드시 확인
- P2 가능하면 확인
- P3 참고

상태:

- NOT_STARTED
- PARTIAL
- SATISFIED
- BLOCKED
- NOT_APPLICABLE

### 6.5 RequiredEvidence

Checkpoint를 충족하기 위해 필요한 Evidence 유형/수량/설명을 정의한다.

지원 Evidence 유형:

- IMAGE
- VIDEO
- AUDIO
- TEXT
- ANY

---

## 7. 현장 실행 UX

### 7.1 Booth-centered 실행

현장 사용자는 부스 상세화면에서 체크사항 확인과 Evidence 기록을 동시에 할 수 있어야 한다.

```text
A사 · B-214
Coverage 60%

[P1] 제품 가격 확인        ✓
[P1] 설치비 확인           □
[P1] 장비 전체 사진        □
[P2] 주요 고객사 확인      △

[사진] [앨범] [메모] [음성] [영상]

부족한 정보
- 설치비
- 전체 제품 사진

다음 행동
- 설치비 포함 여부 질문
- 제품 전체 사진 1장 촬영
```

체크포인트를 선택한 상태에서 Capture하면 Material 저장 완료 후 Target/Checkpoint에 연결한다.

### 7.2 즉석 관찰

계획이 없어도 글로벌 `즉석 관찰 기록`을 통해 Capture할 수 있어야 한다.

- 계획 없음: 허용
- Target 없음: 허용
- Checkpoint 없음: 허용
- 즉시 분류 강제: 금지

---

## 8. Evidence Mapping / Coverage / Gap

### 8.1 EvidenceMapping

Material과 Checkpoint의 근거 연결이다.

연결 방식:

- CONTEXT_CAPTURE
- MANUAL
- AI_SUGGESTED
- AI_AUTO

사용자가 체크포인트 화면에서 직접 기록하면 `CONTEXT_CAPTURE`로 연결한다.

### 8.2 Coverage

기본 가중치:

```text
P1 = 5
P2 = 3
P3 = 1
```

상태 계수:

```text
NOT_STARTED = 0
PARTIAL = 0.5
SATISFIED = 1
BLOCKED = 0
NOT_APPLICABLE = 분모 제외
```

Coverage는 단순 자료 개수가 아니라 계획 충족도를 의미한다.

### 8.3 Evidence Gap / Next Action

미충족 Checkpoint와 RequiredEvidence 부족을 Gap으로 표시한다.

Gap은 현장에서 바로 수행할 수 있는 행동으로 변환한다.

예:

```text
Gap: 설치비 미확인
→ Next Action: 담당자에게 설치비 포함 여부 질문
```

---

## 9. Booth / Field Closeout

부스를 떠나기 전에 다음을 확인한다.

- Target Coverage
- 미충족 P1/P2
- Required Evidence 누락
- Blocked 항목
- 마지막 질문/촬영 추천

현장 전체 종료 전에는 다음을 확인한다.

- 전체 Coverage
- Target별 Coverage
- 미방문 Target
- 미충족 P1/P2
- 마지막 Next Action

사용자는 미충족 항목이 있어도 사유를 기록하고 강제 종료할 수 있다. Closeout 결과는 이후 변경되지 않는 snapshot으로 저장한다.

---

## 10. Research Package / NotebookLM Sync

Mac mini의 실제 Evidence를 외부 연구도구가 사용할 수 있는 버전된 Research Package로 구성한다.

패키지 포함 대상:

- Project Overview
- Field Notes
- 실제 Evidence 또는 파생 파일
- Source Index
- 활성 Research Plan
- Target / Checkpoint
- Coverage / Gap / Next Action
- Closeout Snapshot
- 선택된 PreResearchSource 메타데이터
- package manifest

미분류 즉석 Evidence도 Package 후보에 포함될 수 있다.

자료 유형 정책:

- IMAGE: 실제 이미지 또는 최적화 사본 + Evidence ID
- TEXT: 본문 + Source Index
- AUDIO: 원본 + 전사본이 있으면 함께
- VIDEO: 원본 + 필요 시 전사/대표 프레임/노트

새 Evidence 또는 Plan/Mapping/Closeout 변경 시 기존 Package는 `STALE` 처리할 수 있어야 한다.

---

## 11. Google Drive 용량 부족 정책

Drive 저장공간 부족은 자동 재시도로 해결되는 오류가 아니다.

용량 부족 감지 시:

```text
현재 동기화 중단
→ 성공 항목 유지
→ 미완료 항목 보존
→ 자동 재시도 금지
→ 사용자에게 저장공간 부족 알림
→ [Google Drive 열기]
→ 사용자가 공간 확보
→ [다시 시도]
→ 실패/대기 항목만 이어서 동기화
```

UI 예시:

```text
Google Drive 동기화 중단

Google Drive 저장공간이 부족하여
남은 자료를 업로드하지 못했습니다.

완료 38 / 47
대기 9

[Google Drive 열기]
[다시 시도]
```

필수 원칙:

- 용량 부족에서는 자동 재시도하지 않는다.
- 성공 파일을 처음부터 다시 올리지 않는다.
- 동일 SHA-256 / driveFileId를 활용해 중복 업로드를 방지한다.
- Capture, 로컬 저장, Coverage, Gap, Next Action, Closeout은 계속 동작한다.
- Package는 `SOURCE_READY`가 될 수 없으며 `PARTIAL` 및 quota-block 상태를 표시한다.

---

## 12. 분석 및 보고서

### 12.1 Quick Analysis

상단에서 선택된 현장의 로컬 Evidence와 최신 Analysis Brief를 Mac mini Codex CLI가 읽고 Quick Report를 생성한다.

NotebookLM은 현장 즉시 분석의 필수조건이 아니다.

### 12.2 Analysis Brief

같은 Evidence라도 사용 목적에 따라 분석 방향은 달라질 수 있다.

입력 예:

- 분석 제목
- 분석 목표
- 핵심 질문
- 의사결정 맥락
- 평가기준
- 추가 지시

Analysis Brief는 상단 선택 현장을 자동 사용하며 자체 프로젝트 선택 UI를 두지 않는다.

### 12.3 NotebookLM Deep Research

준비 조건:

- Source Bundle / Research Package가 Drive에서 준비됨
- Analysis Brief가 Google Docs에 준비됨
- NotebookLM URL이 연결됨

사용자는 NotebookLM을 열고 공식 UI에서 Source를 등록/선택해 연구를 이어간다.

### 12.4 Final Report

Final Report는 가능한 범위에서 다음을 근거로 사용한다.

- Evidence
- Analysis Brief
- Quick Analysis
- Research Plan
- Coverage / Gap
- Closeout
- 외부 조사 결과

---

## 13. 단일 프로젝트 컨텍스트 UX

`정리·분석함`에서 프로젝트를 선택하는 위치는 최상단 하나다.

```text
ACTIVE FIELD PROJECT
[현장 선택 ▼]
```

하단 모든 기능은 부모가 전달한 선택 프로젝트만 사용한다.

금지사항:

- Quick Analysis 내부 프로젝트 select
- Research Pipeline 내부 프로젝트 select
- Analysis Brief 내부 프로젝트 select
- 하위 컴포넌트에서 독립 projectId를 초기화해 상단 값과 달라지는 구조

프로젝트 변경 시 하위 UI와 API 요청 대상이 모두 동일하게 바뀌어야 한다.

---

## 14. Milestone 1 구현 완료 범위 — 2026-09-14

다음은 현재 코드에 구현되었거나 사용자가 실제 UI에서 확인한 범위다.

### 완료

- ResearchPlan 데이터 모델
- ResearchTarget 데이터 모델
- ResearchQuestion 데이터 모델
- ResearchCheckpoint 데이터 모델
- RequiredEvidence 데이터 모델
- Plan 목록/생성/상세/수정/활성화 API
- Target CRUD 기반 API
- Question 생성/수정 API
- Checkpoint 생성/수정 API
- RequiredEvidence 생성/수정 API
- FieldDay Drive Workspace 메타데이터
- PreResearchSource 데이터 모델
- 현장명 기반 Drive Workspace 생성
- 기존 `{현장명} ({fieldDayId8})` 폴더 후보 조회 및 재연결
- Workspace 하위 기본폴더 보완
- `00_사전조사` 스캔
- PreResearchSource 목록 및 Plan 사용 선택
- `사전조사 · 방문 준비` UI
- NotebookLM URL 관리 UI를 사전조사 영역으로 통합
- 기존 NotebookLink 데이터/API 유지
- 정리·분석함 상단 현장 선택을 전체 하위 기능의 단일 프로젝트 컨텍스트로 통합
- 하위 Quick Analysis / Research Pipeline / Analysis Brief의 개별 프로젝트 선택 제거
- 구형 Analysis Brief selector 컴포넌트 제거
- 사용자 UI 확인: Workspace 생성 성공
- 사용자 UI 확인: 상단 프로젝트 변경 시 하단 프로젝트 컨텍스트 함께 변경

### 기존 1차 기능으로 유지

- FieldDay / Material
- 멀티미디어 Capture 및 로컬 저장
- IndexedDB 업로드 대기/재시도
- Quick Analysis + Codex Worker
- SourceBundle / SourceDocument
- AnalysisBrief / Google Docs sync
- NotebookLink
- Final Report + Codex Worker
- Google Drive/Docs 인증

---

## 15. 아직 구현되지 않은 Phase 2 범위

다음은 요구사항은 확정됐지만 Milestone 1 종료 시점에는 아직 구현 대상이다.

- Research Plan 편집/생성 전용 사용자 UI
- AI 기반 Research Plan 초안 생성
- Target/Booth 방문계획 UI
- 부스별 체크리스트 화면
- 체크리스트 안에서 직접 Capture
- EvidenceMapping
- CoverageSnapshot 계산/저장/UI
- ResearchGap
- NextAction
- BoothCloseout / FieldCloseout
- 미분류 Evidence 사후 매핑 UI
- ResearchPackage / ResearchPackageItem 실구현
- 실제 이미지/영상/음성 Drive 동기화
- STALE 감지
- Drive quota 전용 런타임 상태/재시도 UI
- Research Plan / Coverage / Gap의 Quick Analysis 및 Final Report 연계
- 전체 iPhone → Drive → NotebookLM E2E 검증

---

## 16. 제품 완료 기준

Phase 2가 완료되었다고 판단하려면 최소 다음이 가능해야 한다.

1. 사전조사 Source를 Drive에서 불러와 조사계획에 활용할 수 있다.
2. 사용자가 Target/부스별 체크사항을 준비할 수 있다.
3. 현장에서 체크리스트 화면을 벗어나지 않고 Evidence를 기록할 수 있다.
4. 계획 없는 즉석 관찰도 언제든 저장할 수 있다.
5. Evidence와 Checkpoint의 관계를 추적할 수 있다.
6. Coverage와 부족 Evidence를 현장에서 바로 확인할 수 있다.
7. Gap을 Next Action으로 변환할 수 있다.
8. Booth / Field Closeout을 수행할 수 있다.
9. 실제 멀티미디어 Evidence를 Research Package로 Drive에 전달할 수 있다.
10. Drive 용량 부족 시 자동 재시도 없이 사용자 조치 후 이어서 재시도할 수 있다.
11. NotebookLM 또는 Gatherly Codex 분석에서 Source Lineage를 유지할 수 있다.
12. 정리·분석함 전체가 하나의 상단 프로젝트 선택값만 사용한다.

---

## 17. 다음 개발 시작점

Milestone 1 이후의 다음 개발 시작점은 **Research Plan 사용자 UI + Booth Execution**이다.

권장 순서:

```text
2C Research Plan 편집/준비 UI
→ Target/Booth 및 체크리스트 편집
→ Booth Execution 화면
→ In-context Capture + 즉석 관찰
→ EvidenceMapping
→ Coverage
→ Gap + Next Action
→ Closeout
→ ResearchPackage
→ 실제 Drive Evidence Sync + quota 처리
→ NotebookLM Handoff E2E
→ Quick/Final Report 연계
```

이 순서를 기준으로 기존 1차 기능을 파괴하지 않고 확장한다.
