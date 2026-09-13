# Gatherly 2차 개발 PRD

## 1. 문서 정보

- 제품명: Gatherly
- 문서명: Phase 2 Product Requirements Document
- 버전: 1.3
- 기준일: 2026-09-14
- 기준 제품: Gatherly 1차 개발 완료본
- 기준 브랜치: `phase2/research-execution-system`
- 제품 포지셔닝: **AI Field Research OS / Research Execution System**

2차 개발은 Gatherly를 `자료를 모아 AI가 분석하고 보고서를 만드는 도구`에서 `조사를 계획하고, 현장에서 실행하며, 누락을 찾아 보완하고, 필요 시 외부 AI 연구도구가 사용할 수 있는 Research Package로 전달하여 조사를 완결하는 시스템`으로 확장한다.

---

## 2. 제품 방향

NotebookLM, Gemini, ChatGPT 등은 사전조사, 소스 수집, 요약, 비교, 보고서 생성 자체를 잘 수행할 수 있다. Gatherly는 이들과 범용 리서치 품질로 직접 경쟁하지 않는다.

Gatherly가 소유할 핵심은 다음 **조사 실행 상태와 Evidence Lineage**다.

```text
무엇을 조사해야 하는가
→ 무엇을 실제로 확인했는가
→ 어떤 Evidence가 어떤 체크사항을 충족했는가
→ 무엇이 빠졌는가
→ 다음에 무엇을 해야 하는가
→ 현장을 떠나도 되는가
→ 어떤 원본 Evidence가 외부 연구도구에 전달되었는가
→ 어떤 근거로 최종 결론이 만들어졌는가
```

### 2.1 핵심 제품 루프

```text
PLAN
사전조사
→ Research Plan
→ 방문대상/부스 계획
→ 부스별 체크리스트

FIELD
→ 계획형 기록 + 즉석 관찰 기록
→ Evidence
→ Coverage
→ Evidence Gap
→ Next Action
→ Booth / Field Closeout

SYNC
→ NotebookLM-ready Research Package 생성
→ Google Drive 동기화
→ 패키지 완전성/최신성 확인

RESEARCH
→ NotebookLM 등 외부 AI에서 심층 분석/보고서

REPORT
→ Gatherly Codex Final Report 또는 외부 연구 결과 활용
→ Evidence Lineage 유지
```

### 2.2 저장 원칙: Local-first + Research Package Sync

Gatherly의 원본 저장소는 계속 Mac mini다.

- 메타데이터/텍스트: Prisma + SQLite
- 사진/영상/음성 원본: Mac mini 로컬 파일 저장소
- 현장 즉시 분석: Mac mini Codex CLI

Google Drive는 원본 DB를 대체하지 않는다. Google Drive는 **NotebookLM 및 외부 연구도구에 전달하기 위한 동기화/교환 레이어**로 사용한다.

이 구조를 선택하는 이유:

- 현장 네트워크가 불안정해도 기록을 먼저 안전하게 저장할 수 있음
- 기존 IndexedDB 업로드 대기/재시도 구조를 유지할 수 있음
- 외부 서비스 장애가 현장 Capture를 막지 않음
- 필요한 시점에만 정리된 조사 패키지를 외부 AI에 전달할 수 있음

---

## 3. 2차 개발 핵심 목표

1. 현장 방문 전에 조사 목적과 방문대상을 구조화한다.
2. 방문할 기업/부스/제품별로 사전 체크사항을 저장한다.
3. 실제 방문 시 **해당 부스 체크리스트 화면 안에서 사진·영상·음성·텍스트 기록을 바로 추가**한다.
4. Research Plan이나 Checkpoint가 없어도 **즉석 관찰 기록**을 자유롭게 추가한다.
5. 기록된 Evidence를 Checkpoint에 연결하고 Target/부스별 Coverage를 계산한다.
6. 미충족 체크사항을 Evidence Gap으로 표시하고 Next Action을 제안한다.
7. 부스를 떠나기 전 Booth Closeout, 행사장을 떠나기 전 Field Closeout을 제공한다.
8. 기존 Quick Analysis와 Final Report가 Research Plan, Coverage, Gap을 활용하도록 연결한다.
9. Mac mini에 저장된 실제 Evidence를 **NotebookLM-ready Research Package**로 구성한다.
10. Research Package를 Google Drive에 동기화하고 누락/실패/최신성을 사용자가 확인할 수 있게 한다.
11. NotebookLM 자동 Source 등록이 공식적으로 지원되지 않는 경우에도, 사용자가 Drive 자료를 바로 선택해 연구를 이어갈 수 있는 Handoff를 제공한다.

---

## 4. 핵심 사용자 흐름

### 4.1 방문 전: 조사 준비

```text
현장 생성
→ 조사 목적 입력
→ 사전조사 자료 입력/연결
→ AI Research Plan 초안 생성
→ 방문할 Target/부스 확정
→ Target별 질문·체크사항·필요 Evidence 설정
→ 방문 순서/우선순위 확정
→ 방문 준비 완료
```

사전조사는 Gatherly 내부에서만 수행할 필요가 없다. NotebookLM, Gemini, ChatGPT, 웹검색, 내부 문서 등에서 만든 결과를 붙여넣거나 연결할 수 있다.

Gatherly는 이를 다음 실행 구조로 바꾼다.

```text
Objective
→ Target/Booth
→ Research Question
→ Checkpoint
→ Required Evidence
→ Priority
```

### 4.2 현장: 계획형 조사

현장에서 사용자는 별도 자료수집 화면으로 이동할 필요 없이 **방문대상 상세 화면**에서 조사와 기록을 함께 수행한다.

```text
A사 · B-214 부스
Coverage 60%

[P1] 제품 가격 확인          ✓
[P1] 설치비 확인             □
[P1] 실제 장비 전체 사진     □
[P2] 주요 고객사 확인        △
[P2] 담당자 연락처 확보      ✓

[사진 촬영] [앨범] [메모] [음성] [영상]

현재 부족한 정보
- 설치비
- 전체 제품 사진

추천 다음 행동
- 담당자에게 설치비 포함 여부 질문
- 제품 전체 외관 사진 1장 추가 촬영
```

자료 저장 시 현재 Target/부스와 선택한 Checkpoint가 자동 Context로 붙는다.

### 4.3 현장: 즉석 관찰 기록

Research Plan 또는 Checkpoint는 Capture의 필수조건이 아니다.

```text
즉석 관찰 기록
→ 사진 / 앨범 / 메모 / 음성 / 영상
→ 즉시 저장
→ Unclassified Evidence로 보존
→ 현장조사 계속
→ 나중에 필요 시 Target/Checkpoint 연결 또는 새 항목 생성
```

원칙:

- 저장 전에 분류를 강제하지 않는다.
- 자유 Evidence도 Quick Analysis와 Final Report에서 사용 가능하다.
- Checkpoint 연결 전에는 Coverage를 자동 상승시키지 않는다.
- 사용자는 사후에 기존 Checkpoint에 연결하거나 새 Target/Checkpoint로 승격할 수 있다.

### 4.4 부스 종료

`이 부스 조사 완료`를 누르면 다음을 확인한다.

- Target Coverage
- 미충족 P1/P2
- Required Evidence 누락
- AI 추천 마지막 질문/촬영

미충족이 있어도 사용자가 사유를 남기고 부스를 종료할 수 있다.

### 4.5 전체 현장 종료

```text
현장 종료 점검
→ 전체 Coverage
→ Target별 Coverage
→ 미방문 Target
→ 미충족 P1/P2
→ 마지막 Next Action
→ 계속 조사 / 강제 종료
→ Closeout Snapshot 저장
```

### 4.6 NotebookLM 준비 및 동기화

사용자가 심층 분석 또는 NotebookLM 보고서를 원할 때 Gatherly는 현재 현장의 Evidence와 조사 상태를 하나의 버전된 Research Package로 만든다.

```text
[NotebookLM 자료 준비]
→ 포함할 Evidence 확인
→ Research Package 생성
→ 이미지/텍스트/음성/영상 처리 상태 확인
→ Google Drive 동기화
→ 누락/실패 재시도
→ Source-ready 상태 확인
→ [NotebookLM 열기]
```

보고서 요청 시 기존 Research Package가 최신이 아니면 `새 Evidence가 있음` 또는 `패키지 갱신 필요`를 표시한다.

NotebookLM Notebook에 Source를 자동 등록하는 기능은 공식 지원 수단이 확인되는 범위에서만 구현한다. 2차 MVP의 완료 기준은 **Google Drive까지 Source-ready Package를 안정적으로 준비하고 Handoff하는 것**이다.

### 4.7 분석/보고서

```text
Research Plan
+ Target/Checkpoint
+ Evidence Mapping
+ Coverage Snapshot
+ Open Gap
+ 자유 관찰 Evidence
+ Quick Analysis
+ Analysis Brief
+ Research Package 상태
→ Final Report 또는 NotebookLM Deep Research
```

---

## 5. 핵심 도메인

### ResearchPlan
현장 전체 조사 목적과 실행 계획. 버전 관리하며 FieldDay당 기본 활성 Plan은 1개.

### ResearchTarget
방문/조사 대상. 예: 기업, 부스, 제품, 기술, 인터뷰 대상, 장소.

주요 속성:
- name
- type
- boothNo/locationHint
- description
- priority
- visitOrder
- visitStatus

### ResearchQuestion
현장에서 답해야 할 질문. Target과 연결 가능.

### ResearchCheckpoint
현장에서 체크할 최소 실행 단위.

상태:
- NOT_STARTED
- PARTIAL
- SATISFIED
- BLOCKED
- NOT_APPLICABLE

우선순위:
- P1 반드시 확인
- P2 가능하면 확인
- P3 참고

### RequiredEvidence
Checkpoint 충족에 필요한 Evidence 조건.

### EvidenceMapping
Material과 Checkpoint의 연결.

지원 방식:
- 현재 Checkpoint에서 바로 기록하여 자동 연결
- 수동 연결
- AI 추천 후 확인

### Unclassified Evidence
계획 없이 추가된 즉석 관찰 기록. 정상 Material로 보존되며 추후 분류 가능하다.

### Coverage
단순 자료 개수가 아니라 계획된 조사 항목 충족도.

권장 가중치:
- P1 = 5
- P2 = 3
- P3 = 1
- PARTIAL = 50%
- SATISFIED = 100%
- NOT_APPLICABLE = 분모 제외

### Evidence Gap
미충족/부분충족/Blocked/Required Evidence 부족 항목.

### Next Action
Gap을 현장에서 바로 수행할 행동으로 변환한 항목.

### Booth Closeout / Field Closeout
부스 또는 전체 현장의 종료 상태를 보존하는 immutable snapshot.

### ResearchPackage
특정 시점의 현장 Evidence와 Research 상태를 외부 AI가 사용할 수 있도록 구성한 **버전된 전달 패키지**.

패키지에는 다음이 포함된다.

- Project Overview
- Field Notes
- Photo Evidence
- Media Index
- Source Index
- 활성 Research Plan
- Target/Booth Checklist
- Coverage / Gap / Next Action
- Closeout Snapshot
- 선택된 실제 Evidence 파일 또는 NotebookLM-ready 파생 파일
- package manifest

### ResearchPackageItem
각 Material 또는 파생 산출물이 Research Package에 어떻게 포함되고 Google Drive에 어떤 상태로 동기화되었는지 추적한다.

---

## 6. NotebookLM-ready Research Package 정책

### 6.1 Google Drive 구조

기존 Gatherly Drive 구조를 확장한다.

```text
Gatherly/
└── Projects/
    └── {현장명} ({fieldDayId8})/
        ├── 01_Source/
        │   └── v{packageVersion}/
        │       ├── Evidence/
        │       │   ├── Images/
        │       │   ├── Audio/
        │       │   ├── Video/
        │       │   └── Other/
        │       ├── Derived/
        │       │   ├── Transcripts/
        │       │   └── Frames/
        │       ├── 01 Project Overview
        │       ├── 02 Field Notes
        │       ├── 03 Photo Evidence
        │       ├── 04 Media Index
        │       ├── 05 Source Index
        │       ├── 06 Research Plan
        │       ├── 07 Coverage and Gaps
        │       └── 08 Closeout
        ├── 02_Analysis_Brief/
        └── 04_Final_Report/
```

Google Drive 구조는 실제 NotebookLM 지원 소스 유형 변화에 대응할 수 있게 유지한다.

### 6.2 자료 유형별 처리

**IMAGE**
- 실제 이미지 파일을 Drive에 동기화한다.
- 원본 또는 적절한 크기의 파생본을 사용할 수 있다.
- Evidence ID, 촬영시각, Target/Checkpoint 관계를 Source Index에 남긴다.

**TEXT**
- 메모 본문을 Field Notes/Source Docs에 포함한다.
- Evidence ID를 유지한다.

**AUDIO**
- 원본 파일을 보존/동기화한다.
- 전사본이 존재하면 함께 포함한다.
- 전사가 없는 경우 `transcript unavailable` 상태를 명시한다.

**VIDEO**
- 원본 파일을 보존할 수 있다.
- NotebookLM 활용성을 위해 향후 핵심 프레임/전사본 파생을 지원한다.
- 파생본 생성 실패가 원본 Evidence를 손상시키면 안 된다.

### 6.3 Source-ready 상태

각 패키지 항목은 최소 다음 상태 중 하나를 가진다.

- READY
- SYNCING
- SYNCED
- NEEDS_DERIVATIVE
- ARCHIVE_ONLY
- FAILED

패키지 전체에는 다음 상태를 제공한다.

- DRAFT
- BUILDING
- READY_TO_SYNC
- SYNCING
- SOURCE_READY
- PARTIAL
- FAILED
- STALE

### 6.4 증분 동기화와 버전

- SHA-256이 동일한 파일은 재업로드하지 않는다.
- 새 Evidence나 수정된 Source 문서가 있으면 현재 Package를 `STALE`로 표시한다.
- NotebookLM 분석에 사용한 패키지는 버전 스냅샷으로 보존한다.
- 로컬 Material 삭제가 과거 Research Package의 Drive 자료를 자동 삭제하지 않는다.
- 새 분석을 위한 동기화는 새 packageVersion 생성 또는 명시적 갱신 정책을 사용한다.

### 6.5 개인정보/로컬 경로

- Google Drive로 내보내는 문서에 Mac mini의 절대 로컬 경로를 노출하지 않는다.
- 외부 전달용 식별자는 Evidence ID와 안전한 파일명으로 제한한다.
- secret, OAuth 토큰, 환경변수 값은 Package에 포함하지 않는다.

---

## 7. 화면 요구사항

### 7.1 조사 준비

- 현장 선택
- 조사 목적
- 사전조사 입력
- AI Plan 생성
- 방문대상/부스 목록
- 방문 순서/우선순위
- Target별 질문/Checkpoint/Required Evidence
- 방문 준비 완료

### 7.2 오늘의 현장

- 활성 Research Plan
- 전체 Coverage
- P1 미충족
- 방문 예정/완료 부스 수
- 다음 추천 Target
- Next Action
- 즉석 관찰 기록
- 현장 종료 점검

### 7.3 방문대상/부스 상세 — 2차 핵심 화면

한 화면 안에서 다음이 가능해야 한다.

- Target 정보와 부스번호
- 방문 상태
- Target Coverage
- 체크리스트
- 각 체크사항 상태 변경
- 체크사항별 Evidence 보기
- **사진/메모/음성/영상 즉시 추가**
- Gap 확인
- Next Action
- 부스 조사 완료

### 7.4 자료수집함

기존 기능 유지. 부스 화면/즉석 기록으로 저장한 자료도 동일 Material 저장소에 들어간다.

### 7.5 정리·분석함

- Coverage Matrix
- Target별 진행률
- Evidence Mapping 검토
- Unclassified Evidence 검토
- Gap 목록
- Quick Analysis
- Analysis Brief

### 7.6 NotebookLM 준비 화면

사용자는 최소 다음을 확인할 수 있어야 한다.

```text
Research Package v3
상태: SOURCE_READY

전체 Evidence          47
패키지 포함            45
Drive 동기화           45 / 45
사진                   28 / 28
텍스트                 12 / 12
음성                    3 / 3
영상                    2 / 2
미동기화/실패           0
마지막 동기화           2026-09-14 14:30
새 Evidence 이후 변경  없음

[패키지 다시 만들기]
[실패 항목 재시도]
[Drive 열기]
[NotebookLM 열기]
```

`PARTIAL` 또는 `STALE` 상태라면 어떤 Evidence가 빠졌는지 명확히 표시한다.

### 7.7 최종 보고서

보고서 생성 전:
- Coverage
- 미확인 P1/P2
- Closeout 여부
- Research Package 최신성

을 보여준다. 미충족 항목이 있어도 보고서 생성을 막지는 않되 한계로 명시한다.

---

## 8. AI 역할

### Gatherly + Codex

- 사전조사 텍스트를 Research Plan 초안으로 구조화
- Checkpoint/Required Evidence 추천
- Evidence Mapping 추천
- Gap 설명
- Next Action 생성
- Booth/Field Closeout 요약
- Quick Analysis
- Final Report
- 필요 시 NotebookLM 전달용 Source 문서 정리

### 외부 AI

NotebookLM/Gemini/ChatGPT 등은 사전조사와 심층 리서치에 자유롭게 사용할 수 있다. Gatherly는 그 결과를 실행 가능한 Plan으로 변환하고 현장 수행 상태를 관리하며, **현장 원본 Evidence를 외부 AI가 사용할 수 있는 Research Package로 전달한다.**

---

## 9. 데이터/신뢰성 원칙

- Mac mini가 원본 Evidence의 authoritative source다.
- 원본 Material은 Plan/Mapping/Package 처리로 수정하지 않는다.
- 현재 Checkpoint에서 생성된 Material은 Target/Checkpoint Context를 함께 저장한다.
- 계획 없는 Material도 정상 Evidence로 저장한다.
- AI 매핑은 rationale/confidence를 저장하고 수정 가능해야 한다.
- Coverage는 AI 없이 DB 상태만으로 재현 가능해야 한다.
- AI Worker 장애 시에도 수동 체크/기록/Mapping/Closeout이 가능해야 한다.
- Google Drive 장애 시에도 현장 Capture가 계속 가능해야 한다.
- Package Sync 실패는 항목별 재시도가 가능해야 한다.
- Drive에 동기화된 파일과 로컬 Material 사이의 Evidence ID/해시 Lineage를 유지한다.
- 기존 IndexedDB 업로드 대기와 재시도 기능을 그대로 유지한다.

---

## 10. 2차 MVP 범위

필수:

- ResearchPlan
- ResearchTarget/Booth
- ResearchQuestion
- ResearchCheckpoint
- RequiredEvidence
- Booth Detail 실행 화면
- Checkpoint 화면 내 직접 Capture
- 계획 없는 즉석 관찰 Capture
- EvidenceMapping
- Unclassified Evidence 사후 연결
- Coverage Engine
- Evidence Gap
- Next Action
- Booth Closeout
- Field Closeout
- Pre-Research 텍스트 입력
- AI Research Plan Draft
- Quick Analysis/Final Report Context 연계
- **ResearchPackage / ResearchPackageItem**
- **이미지·텍스트·음성·영상 Evidence의 Drive 동기화**
- **패키지 manifest 및 Source Docs 생성**
- **증분 동기화 / 실패 재시도 / STALE 감지**
- **NotebookLM 준비 상태 UI 및 Drive/NotebookLM Handoff**

후순위:

- 지도 기반 최적 동선
- GPS 자동 체크인
- 행사장 공식 부스맵 자동 파싱
- 고도화된 음성 자동 전사
- 영상 자동 핵심 프레임 추출
- NotebookLM 공식 API 기반 Source 자동등록/결과 자동회수
- 다중 사용자 협업

---

## 11. 개발 단계

```text
2A. Research Plan / Target / Booth / Checkpoint Core
2B. 조사 준비 UI
2C. Booth Detail + In-context Capture
2D. 자유 관찰 Capture + Evidence Mapping + Coverage
2E. Gap + Next Action
2F. Booth Closeout + Field Closeout
2G. Research Package Builder
2H. Evidence Binary / Source Docs Google Drive Sync
2I. NotebookLM 준비 상태 + Handoff
2J. Quick Analysis / Final Report 연계
2K. iPhone 현장 및 NotebookLM 연계 회귀 테스트
```

---

## 12. 완료 정의

2차 개발은 실제 iPhone에서 다음 흐름이 끊기지 않고 완료될 때 종료한다.

```text
현장 생성
→ 사전조사 입력
→ Research Plan 생성
→ 방문 부스와 체크사항 확정
→ 부스 선택
→ 체크리스트를 보면서 사진/메모/음성/영상 기록
→ 계획에 없던 즉석 관찰도 즉시 기록
→ Coverage 자동 갱신
→ 빠진 항목과 Next Action 확인
→ 부스 종료
→ 전체 현장 Closeout
→ Research Package 생성
→ 실제 Evidence + 조사상태 Google Drive 동기화
→ SOURCE_READY 확인
→ NotebookLM Handoff
→ 심층 분석 또는 Final Report
```

핵심 제품 메시지:

> **Gatherly는 현장 방문 전에 무엇을 확인할지 계획하고, 현장에서는 체크리스트와 자유 관찰을 함께 기록하며, 무엇이 빠졌는지 실시간으로 찾아 다음 행동을 안내하고, 현장 Evidence 전체를 외부 AI가 바로 연구할 수 있는 패키지로 연결하는 AI Field Research OS다.**

> **Plan the fieldwork. Capture the evidence. Find the gaps. Continue the research.**
