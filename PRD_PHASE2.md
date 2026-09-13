# Gatherly 2차 개발 PRD

## 1. 문서 정보

- 제품명: Gatherly
- 문서명: Phase 2 Product Requirements Document
- 문서 버전: 1.0
- 기준일: 2026-09-14
- 기준 제품: Gatherly 1차 개발 완료본
- 기준 브랜치: `phase2/research-execution-system`
- 기준 시작 커밋: `80207c21615ef5d4f62c839c288b3305f3c7e6a8`
- 제품 포지셔닝: **AI Field Research OS / Research Execution System**

이 문서는 1차 개발 기능을 유지한 상태에서 Gatherly의 차별점을 `자료 수집 및 AI 분석`에서 `현장조사의 계획-실행-완결 관리`로 확장하기 위한 2차 개발 요구사항을 정의한다.

---

## 2. 제품 방향 재정의

### 2.1 문제 정의

NotebookLM, Gemini, ChatGPT 등 범용 AI 리서치 도구는 다음 기능을 빠르게 확장하고 있다.

- 문서·웹·이미지·오디오 소스 수집
- 사전조사
- 질의응답
- 요약·비교·보고서 생성
- 현장에서의 모바일 자료 추가

따라서 Gatherly가 `자료를 모아 AI가 분석하고 보고서를 만드는 도구`에 머무르면 차별화가 약하다.

Gatherly 2차 개발의 핵심 문제는 다음과 같다.

> AI가 무엇을 조사해야 하는지 알려주는 것에서 끝나지 않고, 실제 현장에서 그 조사가 얼마나 수행되었는지 측정하고, 빠진 정보를 찾고, 다음 행동을 제안하며, 조사 종료 전 누락을 방지하는 시스템이 필요하다.

### 2.2 새로운 제품 정의

Gatherly는 **AI가 만든 조사계획을 실제 현장에서 실행하고 완결하는 Research Execution System**이다.

핵심 루프는 다음과 같다.

```text
사전조사
→ Research Plan
→ 현장 실행
→ Evidence 자동 매핑
→ Coverage 계산
→ Evidence Gap 발견
→ Next Action 추천
→ 추가 수집
→ Field Closeout
→ 최종 분석/보고서
```

### 2.3 경쟁하지 않을 영역

Gatherly는 다음 영역에서 NotebookLM/Gemini/ChatGPT와 직접 경쟁하지 않는다.

- 범용 검색엔진
- 범용 문서 Q&A
- 대규모 지식 노트북
- 독자적인 foundation model
- 모든 소스 유형을 자체 파싱하는 플랫폼

Gatherly가 소유할 핵심 자산은 다음 상태 데이터다.

- 무엇을 조사해야 했는가
- 무엇을 실제로 확인했는가
- 어떤 Evidence가 어떤 조사 항목을 충족했는가
- 무엇이 아직 빠졌는가
- 다음에 무엇을 해야 하는가
- 어떤 근거로 어떤 결론과 보고서가 생성되었는가

---

## 3. 2차 개발 목표

### 3.1 핵심 목표

1. 현장 방문 전에 `Research Plan`을 생성·편집할 수 있다.
2. 조사 목표를 구조화된 Checkpoint와 Required Evidence로 변환한다.
3. 현장 자료가 어떤 Checkpoint를 충족하는지 연결할 수 있다.
4. 프로젝트별 Research Coverage를 실시간 계산한다.
5. 미충족/부분충족 항목을 Evidence Gap으로 표시한다.
6. Evidence Gap을 행동 가능한 Next Action으로 변환한다.
7. 현장 종료 전 필수 누락을 점검하는 Field Closeout을 제공한다.
8. 기존 Quick Analysis, Source Bundle, Analysis Brief, Final Report와 자연스럽게 연결한다.

### 3.2 성공 기준

- 사용자가 현장 방문 전에 최소 1개의 Research Plan을 생성할 수 있다.
- Research Plan에는 목표, 대상, 질문, Checkpoint, Required Evidence, 우선순위가 포함된다.
- 현장에서 저장된 Material을 Checkpoint에 연결할 수 있다.
- Coverage가 Evidence 변화에 따라 자동 재계산된다.
- P1 미충족 항목이 별도로 표시된다.
- 사용자가 `다음에 무엇을 확인해야 하는지` 모바일에서 1화면 안에 파악할 수 있다.
- Field Closeout 실행 시 미충족 P1/P2 항목을 확인하고 종료 여부를 결정할 수 있다.
- 최종 보고서가 Research Plan과 Evidence Lineage를 참조할 수 있다.

---

## 4. 핵심 사용자 흐름

### 4.1 Plan 단계

```text
새 현장 생성
→ 조사 목적 입력
→ 사전조사 자료 연결/붙여넣기
→ AI가 Research Plan 초안 생성
→ 사용자가 수정/확정
→ 현장 방문 준비 완료
```

사전조사 입력은 Gatherly 자체 조사 결과일 필요가 없다. 사용자는 NotebookLM, Gemini, ChatGPT, 웹검색, 내부 문서 등 외부에서 만든 결과를 가져올 수 있다.

Gatherly의 역할은 사전조사 내용을 다음 실행 구조로 변환하는 것이다.

```text
Objective
→ Target
→ Research Question
→ Checkpoint
→ Required Evidence
→ Priority
```

### 4.2 Field 단계

```text
현장 선택
→ Research Plan 확인
→ 자료 촬영/메모
→ Evidence 매핑
→ Coverage 갱신
→ Gap 표시
→ Next Action 추천
→ 추가 조사
```

### 4.3 Closeout 단계

```text
현장 종료 요청
→ P1/P2 미충족 항목 검사
→ 미확인 항목과 권장 행동 표시
→ 계속 조사 / 종료 선택
→ Closeout Snapshot 저장
```

### 4.4 Review/Report 단계

```text
Research Plan
+ Evidence
+ Coverage Snapshot
+ Quick Analysis
→ Final Report
```

최종 보고서에는 조사 범위, 충족도, 미확인 사항과 제한사항이 포함될 수 있어야 한다.

---

## 5. 주요 기능 요구사항

### 5.1 Research Plan

Research Plan은 2차 개발의 핵심 도메인 객체다.

필수 필드:

- title
- objective
- background
- visitPurpose
- decisionContext
- targetScope
- successCriteria
- status
- version

상태:

- DRAFT
- READY
- ACTIVE
- CLOSED
- ARCHIVED

한 FieldDay는 여러 Research Plan 버전을 가질 수 있으나, 기본 활성 Plan은 하나로 운영한다.

### 5.2 Target

조사 대상을 구조화한다.

예:

- 기업
- 부스
- 제품
- 기술
- 인터뷰 대상
- 장소
- 카테고리

필드:

- name
- type
- description
- priority
- order

### 5.3 Research Question

현장에서 답해야 하는 질문을 구조화한다.

예:

- 실제 가격은 얼마인가?
- 설치 조건은 무엇인가?
- 주요 고객군은 누구인가?
- 경쟁 제품 대비 차별점은 무엇인가?

질문은 Target과 연결 가능해야 한다.

### 5.4 Checkpoint

현장 실행의 최소 관리 단위다.

예:

```text
A사 / 가격 확인
A사 / 설치조건 확인
A사 / 실제 장비 사진
B사 / 고객사례 인터뷰
```

필드:

- title
- description
- priority: P1 | P2 | P3
- status
- evidenceRequirement
- targetId
- researchQuestionId
- sortOrder

상태:

- NOT_STARTED
- PARTIAL
- SATISFIED
- BLOCKED
- NOT_APPLICABLE

### 5.5 Required Evidence

Checkpoint 충족에 필요한 Evidence 유형을 정의한다.

예:

- 사진 1장 이상
- 가격 정보 텍스트
- 명함/담당자 연락처
- 인터뷰 메모
- 브로슈어
- 제품 전체 사진

1차 개발 Material 유형인 IMAGE, VIDEO, AUDIO, TEXT를 기본으로 사용한다.

### 5.6 Evidence Mapping

Material과 Checkpoint를 연결한다.

지원 방식:

- 사용자가 직접 연결
- AI 추천 후 사용자 확인
- AI 자동 연결(확신도 임계값 이상일 때 선택적으로 허용)

매핑에는 다음 정보가 저장되어야 한다.

- materialId
- checkpointId
- matchType
- confidence
- rationale
- confirmedByUser

AI가 잘못 매핑해도 원본 Material은 영향을 받지 않아야 한다.

### 5.7 Research Coverage

Coverage는 단순 자료 개수가 아니라 `계획된 조사 항목 충족도`다.

기본 계산 원칙:

- P1 가중치 > P2 > P3
- NOT_APPLICABLE은 분모에서 제외
- PARTIAL은 부분 점수
- SATISFIED는 완전 점수

권장 초기 가중치:

- P1 = 5
- P2 = 3
- P3 = 1
- NOT_STARTED = 0%
- PARTIAL = 50%
- SATISFIED = 100%

UI에는 다음을 표시한다.

- 전체 Coverage %
- P1 Coverage %
- Target별 Coverage
- 미충족 P1 개수
- 최근 Coverage 변화

### 5.8 Evidence Gap

Evidence Gap은 다음 조건에서 생성된다.

- Checkpoint가 NOT_STARTED
- Checkpoint가 PARTIAL
- Required Evidence가 충족되지 않음
- 사용자가 BLOCKED로 지정

Gap은 자동 계산 결과로 생성하며 사용자가 dismiss/resolve 가능해야 한다.

표시 정보:

- 어떤 Target인지
- 어떤 Checkpoint인지
- 왜 미충족인지
- 필요한 Evidence
- Priority

### 5.9 Next Action

Next Action은 Gap을 실제 현장 행동으로 변환한다.

예:

```text
A사 부스로 돌아가 설치비와 유지보수 비용을 확인하세요.
B사 담당자에게 실제 도입 고객 2곳을 질문하세요.
C사 제품의 전체 외관 사진을 추가 촬영하세요.
```

Next Action은 다음 데이터를 고려한다.

- P1/P2 우선순위
- 현재 Coverage
- 최근 수집 Evidence
- 사용자의 분석 목적
- Target
- 현재 unresolved Gap

2차 MVP에서는 복잡한 위치 최적화/지도 동선 계산은 필수 범위가 아니다.

### 5.10 Field Closeout

사용자가 `현장 종료`를 실행하면 다음을 보여준다.

- 전체 Coverage
- P1 Coverage
- 미충족 P1/P2 목록
- BLOCKED 항목
- Required Evidence 누락
- AI 권장 마지막 행동

사용자는 다음을 선택할 수 있다.

- 현장조사 계속
- 강제 종료
- 종료 사유 메모 후 종료

종료 시 Closeout Snapshot을 보존한다.

### 5.11 Pre-Research Import

사전조사를 Gatherly 안에서만 수행하도록 제한하지 않는다.

입력 지원 우선순위:

1. 직접 텍스트 붙여넣기
2. 기존 Material 선택
3. 문서/링크 메타 입력
4. Google Docs/Drive 연계 확장

AI는 입력된 사전조사 내용을 Research Plan 초안으로 구조화한다.

### 5.12 Research Plan AI Draft

사용자가 사전조사/목적을 입력하면 Codex Worker가 다음 JSON 구조 초안을 생성한다.

- objectives
- targets
- researchQuestions
- checkpoints
- requiredEvidence
- priorities

사용자 확인 전에는 DRAFT로 저장한다.

### 5.13 기존 Analysis Brief와 역할 분리

Research Plan:

> 현장에서 무엇을 조사하고 어떤 증거를 확보할 것인가

Analysis Brief:

> 수집된 자료를 어떤 관점으로 분석할 것인가

두 객체는 연결할 수 있지만 동일 객체로 합치지 않는다.

### 5.14 Quick Analysis 연계

Quick Analysis는 현재 Evidence뿐 아니라 다음 정보를 함께 읽을 수 있어야 한다.

- 활성 Research Plan
- Coverage
- unresolved Gap

대표 질문:

- 지금 가장 먼저 확인할 것은?
- 현재 조사에서 빠진 것은?
- 이 부스를 떠나도 되는가?

### 5.15 Final Report 연계

Final Report Worker는 향후 다음을 참조할 수 있어야 한다.

- Research Plan
- 조사 목표
- Coverage Snapshot
- 미충족 항목
- Evidence Mapping
- 기존 Analysis Brief
- Quick Analysis

최종 보고서에서 `확인하지 못한 내용`을 근거 없는 추론으로 채우지 않고 제한사항으로 명시한다.

---

## 6. 화면 구조

2차 개발에서 권장하는 상위 IA:

```text
오늘의 현장
조사 준비
자료수집함
정리·분석함
최종 보고서
```

### 6.1 조사 준비

구성:

- 현장 선택
- Research Plan 상태
- 사전조사 입력
- AI Plan 생성
- Target 목록
- Checkpoint 목록
- 우선순위 편집
- 방문 준비 완료 버튼

### 6.2 오늘의 현장

기존 홈에 추가:

- 현재 활성 Research Plan
- Coverage %
- 미충족 P1
- 추천 Next Action
- 현장 종료 버튼

### 6.3 자료수집함

기존 업로드 흐름을 유지하면서 다음을 추가한다.

- 현재 Checkpoint 표시
- 저장 직후 Evidence 연결 추천
- 최근 충족된 항목 표시

### 6.4 정리·분석함

추가:

- Coverage Matrix
- Gap 목록
- Target별 진행률
- Evidence ↔ Checkpoint 연결 검토

---

## 7. AI 역할 분담

### Gatherly/Codex

- Research Plan 구조화
- Evidence 매핑 후보 생성
- Gap 설명
- Next Action 생성
- Closeout 요약
- Quick Analysis
- Final Report

### NotebookLM/Gemini/ChatGPT 등 외부 도구

- 사전조사
- 외부 자료 종합
- 긴 문서 분석
- 심층 리서치

Gatherly는 외부 AI 결과를 입력으로 받아 실행 가능한 구조로 변환한다.

---

## 8. 비기능 요구사항

### 모바일 우선

- 현장에서 한 손으로 Coverage와 Next Action을 확인 가능해야 한다.
- 핵심 상태는 2~3번의 탭 이내 접근 가능해야 한다.
- 네트워크 불안정 시 기존 자료수집 안정성을 훼손하지 않는다.

### 데이터 안전

- Research Plan/Mapping 변경은 Material 원본을 수정하지 않는다.
- AI 자동 판단은 사용자 수정 가능해야 한다.
- Closeout Snapshot은 종료 시점 상태를 보존한다.

### 신뢰성

- AI Worker 장애 시에도 수동 Research Plan/Checkpoint 관리는 가능해야 한다.
- Coverage 계산은 AI 호출 없이 DB 상태만으로 재현 가능해야 한다.

### 설명 가능성

- AI가 Evidence를 Checkpoint에 추천한 이유를 표시할 수 있어야 한다.
- 자동 매핑에는 confidence를 저장한다.

---

## 9. 2차 개발 MVP 범위

반드시 구현:

- ResearchPlan
- ResearchTarget
- ResearchQuestion
- Checkpoint
- RequiredEvidence
- EvidenceMapping
- Coverage 계산
- Gap 표시
- Next Action
- Field Closeout
- Pre-Research 텍스트 입력
- AI Research Plan Draft
- 홈/자료수집/분석 화면 연계

후순위:

- 지도 기반 동선 최적화
- GPS 자동 체크인
- 음성 자동 전사 기반 Coverage
- 외부 행사 공식 지도/부스 맵 파싱
- NotebookLM 공식 API 자동 실행
- 다중 사용자 협업

---

## 10. 개발 단계

### Phase 2A — Research Plan Core

- DB 모델
- CRUD API
- 조사 준비 화면
- Target/Question/Checkpoint 편집

### Phase 2B — Evidence Execution

- Material ↔ Checkpoint 연결
- Coverage 계산
- Coverage Matrix
- Gap 엔진

### Phase 2C — Field Intelligence

- AI Mapping 추천
- Next Action 생성
- Quick Analysis Research Plan context 연계

### Phase 2D — Closeout / Report Integration

- Field Closeout
- Snapshot
- Final Report context 연계
- 1차 기능 회귀 테스트

---

## 11. 핵심 제품 메시지

기존:

> 현장에서 자료를 모으고 AI로 분석해 보고서를 만드는 도구

2차 이후:

> **Gatherly는 현장 방문 전에 무엇을 확인해야 하는지 계획하고, 현장에서는 무엇이 확인되었고 무엇이 빠졌는지를 실시간으로 추적하며, 다음 조사 행동까지 안내하는 AI Field Research OS입니다.**

핵심 문장:

> **Capture evidence. Find what’s missing. Decide what to investigate next.**

한국어 표현:

> **현장에서 모으고, 빠진 것을 찾고, 다음 조사를 결정한다.**
