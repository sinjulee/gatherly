# Gatherly 2차 개발 PRD

## 1. 문서 정보

- 제품명: Gatherly
- 문서명: Phase 2 Product Requirements Document
- 버전: 1.1
- 기준일: 2026-09-14
- 기준 제품: Gatherly 1차 개발 완료본
- 기준 브랜치: `phase2/research-execution-system`
- 제품 포지셔닝: **AI Field Research OS / Research Execution System**

2차 개발은 Gatherly를 `자료를 모아 AI가 분석하고 보고서를 만드는 도구`에서 `조사를 계획하고 현장에서 실행하며 누락 없이 완결하는 시스템`으로 확장한다.

---

## 2. 제품 방향

NotebookLM, Gemini, ChatGPT 등은 사전조사, 소스 수집, 요약, 비교, 보고서 생성 자체를 잘 수행할 수 있다. Gatherly는 이들과 사전조사 품질로 직접 경쟁하지 않는다.

Gatherly가 소유할 핵심은 다음 실행 상태다.

```text
무엇을 조사해야 하는가
→ 무엇을 실제로 확인했는가
→ 어떤 Evidence가 어떤 체크사항을 충족했는가
→ 무엇이 빠졌는가
→ 다음에 무엇을 해야 하는가
→ 현장을 떠나도 되는가
```

제품 핵심 루프:

```text
사전조사
→ Research Plan
→ 방문대상/부스 계획
→ 부스별 체크리스트
→ 현장 방문
→ 체크리스트 화면 안에서 즉시 기록/촬영
→ Coverage 갱신
→ Evidence Gap
→ Next Action
→ 부스 종료
→ 현장 Closeout
→ 분석/보고서
```

---

## 3. 2차 개발 핵심 목표

1. 현장 방문 전에 조사 목적과 방문대상을 구조화한다.
2. 방문할 기업/부스/제품별로 사전 체크사항을 저장한다.
3. 실제 방문 시 **해당 부스 체크리스트 화면 안에서 사진·영상·음성·텍스트 기록을 바로 추가**할 수 있게 한다.
4. 기록된 Evidence를 체크사항에 연결한다.
5. Target/부스별 Coverage를 실시간 계산한다.
6. 미충족 체크사항을 Evidence Gap으로 표시한다.
7. Gap을 구체적인 Next Action으로 변환한다.
8. 부스를 떠나기 전 Booth Closeout, 행사장을 떠나기 전 Field Closeout을 제공한다.
9. 기존 Quick Analysis와 Final Report가 Research Plan과 Coverage를 활용하도록 연결한다.

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

Gatherly는 이를 실행 구조로 바꾼다.

```text
Objective
→ Target/Booth
→ Research Question
→ Checkpoint
→ Required Evidence
→ Priority
```

### 4.2 현장: 부스 중심 실행

현장에서 사용자는 별도 자료수집 화면으로 이동할 필요 없이 **방문대상 상세 화면**에서 조사와 기록을 함께 수행한다.

예:

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

사용자는 체크사항을 누른 뒤 바로:

- 사진 촬영
- 앨범 선택
- 텍스트 메모
- 음성 기록/업로드
- 영상 기록/업로드

을 수행할 수 있어야 한다.

### 4.3 부스 종료

`이 부스 조사 완료`를 누르면 다음을 확인한다.

- Target Coverage
- 미충족 P1/P2
- Required Evidence 누락
- AI 추천 마지막 질문/촬영

미충족이 있어도 사용자가 사유를 남기고 부스를 종료할 수 있다.

### 4.4 전체 현장 종료

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

### 4.5 분석/보고서

최종 분석은 다음 Context를 함께 사용할 수 있어야 한다.

```text
Research Plan
+ Target/Checkpoint
+ Evidence Mapping
+ Coverage Snapshot
+ Open Gap
+ Quick Analysis
+ Analysis Brief
→ Final Report
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
Checkpoint 충족에 필요한 증거 조건.

예:
- 사진 1장 이상
- 가격 메모
- 담당자 연락처
- 인터뷰 답변
- 브로슈어
- 제품 전체 사진

### EvidenceMapping
Material과 Checkpoint의 연결.

지원 방식:
- 현재 Checkpoint에서 바로 기록하여 자동 연결
- 수동 연결
- AI 추천 후 확인

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

### Booth Closeout
Target/부스 단위 종료 스냅샷.

### Field Closeout
전체 현장 종료 스냅샷.

---

## 6. 화면 요구사항

### 6.1 조사 준비

- 현장 선택
- 조사 목적
- 사전조사 입력
- AI Plan 생성
- 방문대상/부스 목록
- 방문 순서/우선순위
- Target별 질문/Checkpoint/Required Evidence
- 방문 준비 완료

### 6.2 오늘의 현장

- 활성 Research Plan
- 전체 Coverage
- P1 미충족
- 방문 예정/완료 부스 수
- 다음 추천 Target
- Next Action
- 현장 종료 점검

### 6.3 방문대상/부스 상세 — 2차 핵심 화면

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

이 화면은 현장에서 가장 많이 쓰는 화면으로 설계한다.

### 6.4 자료수집함

기존 기능 유지. 부스 화면에서 저장한 자료도 동일 Material 저장소에 들어간다. 자료수집함은 전체 Evidence 조회/보정/추가 업로드 역할을 유지한다.

### 6.5 정리·분석함

- Coverage Matrix
- Target별 진행률
- Evidence Mapping 검토
- Gap 목록
- Quick Analysis
- Analysis Brief

### 6.6 최종 보고서

보고서 생성 전:
- Coverage
- 미확인 P1/P2
- Closeout 여부

를 보여준다. 미충족 항목이 있어도 보고서 생성을 막지는 않되 한계로 명시한다.

---

## 7. AI 역할

### Gatherly + Codex

- 사전조사 텍스트를 Research Plan 초안으로 구조화
- Checkpoint/Required Evidence 추천
- Evidence Mapping 추천
- Gap 설명
- Next Action 생성
- Booth/Field Closeout 요약
- Quick Analysis
- Final Report

### 외부 AI

NotebookLM/Gemini/ChatGPT 등은 사전조사와 심층 리서치에 자유롭게 사용할 수 있다. Gatherly는 그 결과를 실행 가능한 Plan으로 변환하고 현장 수행 상태를 관리한다.

---

## 8. 데이터/신뢰성 원칙

- 원본 Material은 Plan/Mapping 처리로 수정하지 않는다.
- 현재 Checkpoint에서 생성된 Material은 Target/Checkpoint Context를 함께 저장한다.
- AI 매핑은 rationale/confidence를 저장하고 수정 가능해야 한다.
- Coverage는 AI 없이 DB 상태만으로 재현 가능해야 한다.
- AI Worker 장애 시에도 수동 체크/기록/Mapping/Closeout이 가능해야 한다.
- 기존 IndexedDB 업로드 대기와 재시도 기능을 그대로 유지한다.

---

## 9. 2차 MVP 범위

필수:

- ResearchPlan
- ResearchTarget/Booth
- ResearchQuestion
- ResearchCheckpoint
- RequiredEvidence
- Booth Detail 실행 화면
- Checkpoint 화면 내 직접 Capture
- EvidenceMapping
- Coverage Engine
- Evidence Gap
- Next Action
- Booth Closeout
- Field Closeout
- Pre-Research 텍스트 입력
- AI Research Plan Draft
- Quick Analysis/Final Report Context 연계

후순위:

- 지도 기반 최적 동선
- GPS 자동 체크인
- 행사장 공식 부스맵 자동 파싱
- 음성 자동 전사 기반 Coverage
- NotebookLM 공식 API 자동 실행
- 다중 사용자 협업

---

## 10. 개발 단계

```text
2A. Research Plan / Target / Booth / Checkpoint Core
2B. 조사 준비 UI
2C. Booth Detail + In-context Capture
2D. Evidence Mapping + Coverage
2E. Gap + Next Action
2F. Booth Closeout + Field Closeout
2G. Quick Analysis / Final Report 연계
2H. 모바일 현장 회귀 테스트
```

---

## 11. 완료 정의

2차 개발은 실제 iPhone에서 다음 흐름이 끊기지 않고 완료될 때 종료한다.

```text
현장 생성
→ 사전조사 입력
→ Research Plan 생성
→ 방문 부스와 체크사항 확정
→ 부스 선택
→ 체크리스트를 보면서 사진/메모/음성/영상 기록
→ Coverage 자동 갱신
→ 빠진 항목과 Next Action 확인
→ 부스 종료
→ 전체 현장 Closeout
→ Final Report
```

핵심 제품 메시지:

> **Gatherly는 현장 방문 전에 무엇을 확인할지 계획하고, 현장에서는 체크리스트와 기록을 한 화면에서 실행하며, 무엇이 빠졌는지 실시간으로 찾아 다음 조사 행동까지 안내하는 AI Field Research OS다.**

> **Capture evidence. Find what’s missing. Decide what to investigate next.**
