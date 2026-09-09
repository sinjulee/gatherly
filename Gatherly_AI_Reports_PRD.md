# Gatherly AI 보고서 작성 기능 PRD v1.1

**문서 버전:** v1.1  
**작성일:** 2026-09-10  
**대상 기능:** Gatherly Reports / AI Report Generator  
**변경사항:** AI 수정 요청 모듈 및 Google Docs 편집 출력 포함

---

# 1. 기능 개요

Gatherly 보고서는 현장에서 수집한 사진, 영상, 음성, 텍스트 메모 등을 단순 요약하는 기능이 아니다.

사용자가 먼저 **“이 자료를 어떤 관점에서 분석할 것인가”**를 입력하면, Gatherly가 해당 분석 목적에 맞추어 자료를 재해석하고 필요한 외부 자료를 추가 조사하여 하나의 완성도 높은 AI 보고서를 생성한다.

동일한 자료라도 다음과 같이 서로 다른 보고서가 생성될 수 있다.

- 시장성 분석
- 마케팅 전략
- 경쟁사 분석
- 소비자 트렌드 분석
- 신규 사업 기회 분석
- 제품 벤치마킹
- 브랜드 포지셔닝
- 유통 전략
- 기술 트렌드
- 자유 분석

핵심 구조:

```text
Field Evidence
      ×
User Analysis Direction
      ×
External Research
      ↓
Evidence-based Insight
      ↓
AI Draft
      ↓
User Review / Revision
      ↓
Final Report
```

---

# 2. 핵심 목표

사용자는 직접 많은 자료를 다시 읽고 검색하고 정리하지 않아도,

1. Gatherly에 모아둔 현장 자료를 선택하고
2. 분석하고 싶은 방향을 입력하고
3. AI가 현장 자료를 검토하고
4. 부족한 정보를 신뢰도 높은 외부 자료로 조사하고
5. 핵심 인사이트와 근거를 정리하고
6. 현장 사진을 적절한 위치에 배치한 보고서 초안을 받고
7. AI에게 추가 수정 요청을 하거나
8. 직접 텍스트를 수정하고
9. 필요하면 Google Docs로 보내 자유롭게 편집한 뒤
10. 최종 보고서로 활용

할 수 있어야 한다.

---

# 3. 핵심 제품 원칙

## 3.1 Analysis First

보고서 작성의 첫 단계는 반드시 **분석 방향 입력**이다.

자료만 선택한 상태에서 바로 보고서를 생성하지 않는다.

### 필수 입력

**이 자료를 통해 무엇을 분석하고 싶나요?**

예:

> 이번 전시회에서 조사한 제품들을 기반으로 국내 시장 진입 가능성과 성장 가능성을 분석해줘. 특히 30~40대 소비자를 중심으로 시장성과 경쟁 강도를 보고 싶어.

또는:

> 조사한 브랜드들의 마케팅 방식을 비교하고 우리 브랜드에 적용 가능한 온라인 마케팅 전략을 제안해줘.

---

# 4. 전체 사용자 흐름

```text
현장 선택
↓
분석 자료 선택
↓
분석 방향 입력
↓
분석 목적 / 독자 / 범위 설정
↓
AI 분석 계획 생성
↓
사용자 계획 확인 및 수정
↓
현장 Evidence 추출
↓
외부 Research
↓
Insight 생성
↓
보고서 초안 생성
↓
━━━━━━━━━━━━━━━━━━
초안 검토 단계
━━━━━━━━━━━━━━━━━━
↓
A. AI 수정 요청
B. Gatherly 직접 편집
C. Google Docs로 보내 편집
↓
수정본 저장
↓
품질 및 근거 재검증
↓
Final
↓
PDF / Google Docs 출력
```

---

# 5. Step 1 — 자료 선택

보고서의 근거로 사용할 자료를 선택한다.

선택 단위:

- 현장(FieldDay) 전체
- 특정 자료
- 사진
- 영상
- 음성
- 텍스트 메모
- 분석함에 저장된 자료

기본값은 해당 현장의 전체 자료이다.

각 자료는 포함/제외를 개별 지정할 수 있어야 한다.

---

# 6. Step 2 — 분석 방향 입력

큰 자연어 입력 영역을 제공한다.

## 추천 분석 템플릿

- 시장성 분석
- 마케팅 전략
- 경쟁사 분석
- 소비자 트렌드
- 사업기회 분석
- 제품/서비스 벤치마킹
- 브랜드 분석
- 기술/산업 트렌드
- 자유 분석

템플릿 선택 후 사용자가 추가 요구사항을 자유롭게 입력할 수 있어야 한다.

---

# 7. 분석 상세 설정

선택 입력:

### 보고서 목적

- 내부 검토
- 경영진 보고
- 고객사 제출
- 신규 사업 검토
- 마케팅 기획
- 투자/사업 타당성
- 개인 리서치

### 주요 독자

- 실무자
- 관리자
- 경영진
- 고객
- 투자자
- 일반 독자

### 분석 범위

- 국가/지역
- 시장
- 소비자
- 분석 기간
- 경쟁사
- 제품군

### 반드시 다룰 질문

사용자가 여러 개 입력 가능.

예:

- 실제 구매 가능성이 높은 고객은 누구인가?
- 국내 경쟁 제품은 무엇인가?
- 가장 큰 차별화 요소는 무엇인가?
- 적정 가격대는 어느 수준인가?

---

# 8. AI 분석 계획 생성

최종 보고서를 바로 생성하지 않는다.

먼저 AI가 분석 계획을 생성한다.

예:

```text
분석 목적
국내 시장에서 해당 제품군의 사업 가능성 평가

핵심 질문
1. 시장 수요가 존재하는가?
2. 주요 고객층은 누구인가?
3. 기존 경쟁 제품은 무엇인가?
4. 현장 제품의 차별점은 무엇인가?
5. 진입 시 위험요인은 무엇인가?

예상 보고서 구조
1. Executive Summary
2. 조사 개요
3. 현장 관찰 결과
4. 시장 환경
5. 소비자 수요
6. 경쟁 환경
7. 시장성 평가
8. 기회와 위험
9. 전략적 제언
10. References
```

사용자 기능:

- 분석 시작
- 분석계획 수정
- 분석 항목 추가
- 분석 항목 삭제
- 분석 우선순위 변경

---

# 9. AI 실행 환경

AI 보고서 작성은 **맥미니 서버의 Codex CLI**를 기본 엔진으로 사용한다.

OpenAI API를 기본 방식으로 사용하지 않는다.

```text
Gatherly Web
↓
Report Job
↓
Mac mini Report Worker
↓
Codex CLI
↓
ChatGPT Subscription
↓
Evidence + Research + Analysis
↓
Structured Report
↓
Gatherly DB
```

Codex 작업 실패 또는 사용 한도 도달 시 API 방식으로 자동 전환하지 않는다.

작성 중인 Evidence, Research 및 Draft는 보존하여 다시 실행할 수 있게 한다.

---

# 10. AI 생성 파이프라인

한 번의 거대한 Prompt로 모든 것을 생성하지 않는다.

```text
01 Analysis Brief
↓
02 Evidence Extraction
↓
03 Research Planning
↓
04 External Research
↓
05 Insight Synthesis
↓
06 Report Outline
↓
07 Draft Generation
↓
08 Evidence Verification
↓
09 Visual Layout
↓
10 Draft Review
↓
11 User Revision
↓
12 Final QA
↓
13 Final Report
```

---

# 11. 현장 Evidence 분석

## 사진

추출 대상:

- 제품
- 브랜드
- 가격
- 패키지
- 문구
- 디자인
- 진열
- 사용 상황
- 현장 특징

## 텍스트

- 사용자 메모
- 의견
- 질문
- 숫자
- 브랜드명
- 제품명
- 현장에서 얻은 인사이트

## 음성

음성 → 텍스트 변환 자료를 분석 대상으로 사용한다.

## 영상

영상 메타데이터, 설명 및 주요 프레임 분석이 가능하도록 확장 가능한 구조를 사용한다.

---

# 12. Evidence 유형

AI가 사용하는 정보는 세 종류로 구분한다.

### FIELD

사용자가 직접 현장에서 수집한 내용.

### EXTERNAL

공식 자료, 웹 조사, 통계, 논문, 기업 자료 등.

### INFERENCE

FIELD와 EXTERNAL 근거를 조합하여 AI가 도출한 분석 및 해석.

AI의 추론을 실제 확인된 사실처럼 표현하지 않는다.

---

# 13. 외부 조사

사용자의 분석 방향을 기준으로 필요한 추가 조사를 결정한다.

시장성 분석 예:

- 시장 규모
- 성장률
- 소비자 트렌드
- 경쟁 제품
- 가격
- 규제
- 시장 전망

마케팅 전략 예:

- 타깃 소비자
- 소비자 행동
- 경쟁 브랜드 캠페인
- 포지셔닝
- SNS
- 콘텐츠 전략
- 채널 전략

---

# 14. 출처 신뢰도 정책

## Tier A

- 정부기관
- 공공기관
- 공식 통계
- 법령
- 학술논문
- 국제기구

## Tier B

- 기업 공식 자료
- 공식 IR
- 산업협회
- 전문 리서치 기관

## Tier C

- 신뢰도 높은 언론
- 전문 산업매체

## Tier D

- 블로그
- 커뮤니티
- SNS

Tier D는 소비자 반응 및 사례 등의 보조 자료로 사용하고 핵심 시장 수치의 단독 근거로 사용하지 않는다.

---

# 15. 근거 검증

시장 규모, 성장률, 가격 등의 핵심 수치는 가능한 경우 복수 출처를 비교한다.

출처 간 수치가 다르면 AI가 임의로 하나를 정답으로 만들지 않는다.

검증할 수 없는 숫자를 생성하지 않는다.

---

# 16. 보고서 출처 관리

외부 사실에 대한 출처를 저장한다.

ResearchSource:

```text
title
publisher
url
publishedAt
accessedAt
sourceTier
reportSectionId
```

보고서 말미에 References를 자동 생성한다.

---

# 17. 보고서 기본 구조

목차는 사용자의 분석 방향에 따라 동적으로 생성한다.

기본 골격:

- Cover
- Executive Summary
- 조사 개요
- 현장 Findings
- 분석 본문
- 추가 Research
- Insight
- Recommendation
- References

---

# 18. 동적 보고서 예

## 시장성 분석

```text
시장 개요
시장 규모
시장 성장성
소비자 수요
현장 관찰
경쟁 환경
차별화 가능성
진입 장벽
시장 기회
시장성 평가
전략 제안
```

## 마케팅 전략

```text
현장 인사이트
시장 환경
핵심 타깃
고객 니즈
경쟁 브랜드 전략
포지셔닝
핵심 메시지
채널 전략
콘텐츠 전략
실행 우선순위
KPI
```

---

# 19. 보고서 가독성

긴 AI 문장을 연속해서 배치하지 않는다.

적극 활용:

- Key Insight
- 핵심 숫자
- 비교표
- 장점/위험 표
- Bullet Point
- Action Item
- 인용 박스
- 사진
- 캡션
- 간단한 도식
- 강조 문장

원칙:

> 한 페이지에는 가능한 한 하나의 핵심 메시지를 중심으로 구성한다.

---

# 20. 이미지 활용

현장 사진은 보고서의 장식이 아니라 **Evidence**로 사용한다.

AI가 보고서와 관련성이 높은 사진만 선택한다.

```text
경쟁 브랜드 패키지 분석
↓
관련 현장 사진
↓
사진에서 확인되는 특징
↓
시장적 / 마케팅적 의미
```

---

# 21. 이미지 규격

보고서 용지는 기본적으로:

**A4 Landscape — 297 × 210mm**

주요 현장 이미지는:

**148.5 × 148.5mm**

정사각형을 기본값으로 한다.

이미지 정책:

- 1:1
- 148.5 × 148.5mm
- 중요 영역 임의 Crop 금지
- 원본을 훼손하지 않음
- 필요하면 여백 사용
- 추후 사용자 Crop 기능 추가 가능

---

# 22. 이미지 캡션

예:

**Figure 03. A 브랜드 제품 패키지 — 현장 촬영**

필요한 경우:

- 촬영 장소
- 조사일
- 제품명
- 관련 메모

를 연결한다.

---

# 23. 보고서 디자인

목표:

> 전문 리서치 보고서의 정보 구조와 현장 리서치 노트의 생생함을 결합한다.

디자인 원칙:

- 정보 밀도 높음
- 핵심 문장은 간결
- 시각적 위계 명확
- 여백 확보
- 현장 이미지 적극 활용
- 장식 그래픽 남용 금지
- 주요 숫자와 결론 강조

---

# 24. 보고서 생성 상태

```text
DRAFT
↓
PREPARING_EVIDENCE
↓
RESEARCHING
↓
ANALYZING
↓
WRITING
↓
VERIFYING
↓
LAYOUT
↓
DRAFT_READY
↓
USER_REVIEW
↓
REVISING
↓
FINALIZING
↓
COMPLETED
```

실패:

```text
FAILED
```

---

# 25. 초안 검토 단계

AI가 보고서를 생성하면 즉시 Final 처리하지 않는다.

상태:

**DRAFT_READY**

사용자는 초안 화면에서 세 가지 편집 방식을 선택할 수 있다.

```text
┌─────────────────────────────┐
│       보고서 초안 완료       │
│                             │
│  [ AI에게 수정 요청 ]        │
│  [ 직접 편집 ]               │
│  [ Google Docs로 편집 ]      │
│                             │
│         [ 최종 확정 ]         │
└─────────────────────────────┘
```

---

# 26. AI 수정 요청 모듈

초안을 읽은 사용자가 자연어로 수정 요구를 전달하면 AI가 기존 보고서와 Evidence를 유지하면서 필요한 부분만 수정한다.

보고서 전체를 처음부터 다시 생성하지 않는다.

---

# 27. AI 수정 요청 UI

보고서 오른쪽에 **AI 수정 패널**을 제공한다.

예:

```text
────────────────────────────
AI에게 수정 요청
────────────────────────────
이 보고서를 어떻게 수정할까요?

• 시장성 결론을 좀 더 보수적으로 평가해줘
• 경쟁사 비교표를 추가해줘
• 3장의 내용을 절반 정도로 줄여줘
• 마케팅 실행안에 SNS 전략을 더 추가해줘

[ 수정안 생성 ]
────────────────────────────
```

---

# 28. 수정 범위 선택

사용자가 수정 범위를 선택할 수 있다.

- 선택된 문장
- 현재 Section
- 여러 Section
- 전체 보고서

---

# 29. 자연어 수정 요청 예

> 시장성이 너무 긍정적으로 작성된 것 같아. 리스크를 더 많이 반영해서 보수적으로 다시 평가해줘.

> 30대 여성 소비자 관점의 내용이 부족해. 관련 조사자료를 추가로 찾아서 보강해줘.

> 경쟁 브랜드 세 곳을 비교하는 표를 만들어줘.

> Executive Summary를 경영진이 1분 안에 읽을 수 있게 더 짧게 만들어줘.

> 이 사진은 빼고 두 번째 현장 사진으로 바꿔줘.

---

# 30. 수정 요청 처리 과정

```text
사용자 수정 요청
↓
Revision Intent 분석
↓
수정 대상 Section 결정
↓
기존 Evidence 확인
↓
필요 시 추가 Research
↓
수정안 생성
↓
Evidence 재검증
↓
변경사항 Preview
↓
사용자 승인
↓
보고서 반영
```

---

# 31. 수정 Preview

AI가 내용을 바로 덮어쓰지 않는다.

먼저 변경안을 보여준다.

사용자는:

- 적용
- 취소
- 다시 수정 요청

할 수 있어야 한다.

가능하면 Diff 형태로 변경 전후를 비교한다.

---

# 32. 연속 수정 요청

한 번 수정한 뒤 다시 요구할 수 있다.

모든 수정 이력을 유지한다.

---

# 33. AI Revision History

각 요청을 저장한다.

```text
ReportRevisionRequest

id
reportId
versionId
targetType
targetSectionId
instruction
status
createdAt
completedAt
```

---

# 34. 사용자 직접 편집

Gatherly 보고서 상세화면에서 텍스트를 직접 수정할 수 있어야 한다.

수정 대상:

- 보고서 제목
- Section 제목
- 본문
- Bullet
- Insight
- Recommendation
- 표
- 이미지 캡션

사용자가 직접 수정한 내용에는 다음 상태를 기록한다.

```text
USER_EDITED = true
```

AI가 이후 다른 부분을 수정할 때 이 내용을 임의로 덮어쓰지 않는다.

---

# 35. 사용자 편집 잠금

사용자가 직접 수정한 Section에는 선택적으로:

**AI 수정 시 내용 보호**

옵션을 제공할 수 있다.

활성화 시 전체 보고서 재작성에서도 해당 Section을 보존한다.

---

# 36. Google Docs로 편집

보고서 초안 또는 최종본을 **Google Docs로 출력**할 수 있어야 한다.

버튼:

**Google Docs에서 편집**

---

# 37. Google Docs 출력 목적

Google Docs 출력은 단순 문서 보관이 아니라:

> Gatherly에서 생성된 고품질 초안을 사용자가 익숙한 문서 편집 환경에서 자유롭게 수정하기 위한 기능

이다.

특히 다음 사용자를 고려한다.

- 긴 글을 직접 다듬고 싶은 사용자
- 여러 사람이 함께 검토해야 하는 경우
- 댓글/제안 기능을 사용하고 싶은 경우
- 회사 보고서 포맷으로 추가 수정해야 하는 경우
- 다른 문서와 내용을 합쳐야 하는 경우

---

# 38. Google Docs 생성 방식

```text
Gatherly Report
↓
Structured Report JSON
↓
Google Docs Export Renderer
↓
Google Drive
↓
Google Docs 문서 생성
↓
사용자에게 문서 링크 제공
```

MVP에서는 **Gatherly → Google Docs 단방향 출력**을 기본으로 한다.

Google Docs에서 변경한 내용을 Gatherly로 자동 동기화하는 기능은 MVP 범위에서 제외한다.

---

# 39. Google Docs 문서 구성

가능한 한 Gatherly 보고서 구조를 유지한다.

포함:

- 제목
- 목차
- Heading 구조
- 본문
- Bullet
- 표
- 현장 이미지
- 이미지 캡션
- 출처
- References

문서 방향:

**A4 Landscape**

현장 이미지 역시 원칙적으로:

**148.5 × 148.5mm**

크기를 사용한다.

단, Google Docs의 편집 환경 특성상 페이지 흐름에 따라 일부 레이아웃은 웹/PDF 버전과 다르게 표현될 수 있다.

역할 구분:

- PDF = 레이아웃 보존형 최종본
- Google Docs = 편집 중심 문서

---

# 40. Google Docs 출력 시점

사용자는 다음 시점에 Google Docs로 보낼 수 있다.

- 초안 상태
- 수정본 상태
- Final 상태

---

# 41. Google Docs 출력 정보 저장

ReportExport 테이블 추가:

```text
id
reportId
versionId
type
externalFileId
externalUrl
exportedAt
status
```

`type`:

```text
PDF
GOOGLE_DOCS
```

---

# 42. 재출력

보고서가 수정된 이후 이전 Google Docs 문서와 자동 동기화하지 않는다.

대신:

**최신 버전으로 새 Google Docs 만들기**

기능을 제공한다.

기존 문서를 덮어쓰지 않아 편집본 유실을 방지한다.

---

# 43. 보고서 목록

`/reports`

표시:

- 보고서 제목
- 현장
- 분석 목적
- 작성일
- 상태
- 현재 버전
- 마지막 수정일
- Google Docs 출력 여부

버튼:

**+ 새 보고서**

---

# 44. 보고서 상세 화면

주요 기능:

- 목차
- 전체 보기
- 페이지 보기
- 출처 열기
- Evidence 확인
- 현장 자료 열기
- AI 수정 요청
- 직접 텍스트 수정
- Section 재작성
- 이미지 교체
- 이미지 삭제
- 버전 저장
- Google Docs로 보내기
- PDF 출력
- 최종 확정

---

# 45. 보고서 편집 화면 권장 구조

```text
┌────────────────────────────────────────────┐
│ 시장성 분석 보고서         v3    저장됨     │
├──────────────┬─────────────────┬───────────┤
│   목차       │   보고서 본문    │ AI 수정   │
│              │                 │ 요청      │
│ 01 Summary   │  편집 가능       │           │
│ 02 Market    │  본문            │ Prompt    │
│ 03 Consumer  │                 │           │
│ 04 Competitor│  이미지          │ [수정]    │
├──────────────┴─────────────────┴───────────┤
│ Google Docs   PDF 출력    버전저장   최종확정 │
└────────────────────────────────────────────┘
```

---

# 46. 버전 관리

초안 및 모든 주요 수정사항을 버전으로 관리한다.

예:

```text
v1 AI Draft
v2 AI Revision
v3 User Edited
v4 AI Revision
v5 Final
```

Google Docs 출력 시 해당 버전도 기록한다.

---

# 47. 데이터 모델

## Report

```text
id
fieldDayId
title
analysisDirection
purpose
audience
scope
status
currentVersion
createdAt
updatedAt
```

## ReportVersion

```text
id
reportId
version
content
createdAt
createdBy
```

createdBy:

```text
AI
USER
AI_REVISION
```

## ReportSection

```text
id
reportVersionId
type
title
content
order
userEdited
aiEditLocked
```

## ReportEvidence

```text
id
reportId
materialId
evidenceType
excerpt
sectionId
```

## ResearchSource

```text
id
reportId
title
publisher
url
publishedAt
accessedAt
sourceTier
```

## ReportImage

```text
id
reportId
materialId
sectionId
caption
position
width
height
```

## ReportRevisionRequest

```text
id
reportId
versionId
targetType
targetSectionId
instruction
status
createdAt
completedAt
```

## ReportExport

```text
id
reportId
versionId
type
externalFileId
externalUrl
exportedAt
status
```

## ReportJob

```text
id
reportId
status
stage
startedAt
completedAt
error
```

---

# 48. Codex 작업 디렉터리

```text
Gatherly/
└── report-workspace/
    └── {reportId}/
        ├── brief.md
        ├── materials/
        ├── evidence.json
        ├── research.json
        ├── sources.json
        ├── outline.json
        ├── report.json
        ├── report.md
        ├── revisions/
        │   ├── revision-001.json
        │   └── revision-002.json
        └── qa.json
```

수정 요청도 별도 기록하여 전체 보고서를 다시 생성하지 않고 기존 분석 결과를 활용한다.

---

# 49. AI 품질검증

Final 전 반드시 확인한다.

### Evidence Coverage

주요 결론에 근거가 있는가?

### Source Reliability

주요 외부 사실이 신뢰 가능한 출처에 근거하는가?

### Logical Consistency

근거와 결론이 논리적으로 연결되는가?

### Analysis Direction

사용자가 처음 요청한 분석 목적에 답하고 있는가?

### Revision Intent

사용자의 수정 요청이 실제 반영되었는가?

### User Edit Preservation

사용자가 직접 수정한 내용을 임의로 훼손하지 않았는가?

### Hallucination

근거 없는 사실이나 숫자가 없는가?

### Readability

중요한 내용을 빠르게 파악할 수 있는가?

### Visual Relevance

사용된 사진이 해당 내용과 관계가 있는가?

---

# 50. 완료 기준

다음 조건을 만족해야 `COMPLETED` 처리한다.

- 분석 방향 반영
- 선택 자료 분석 완료
- 현장 Evidence 추적 가능
- 필요한 외부 조사 완료
- 주요 외부 사실 출처 존재
- 근거 없는 중요 숫자 없음
- FIELD / EXTERNAL / INFERENCE 구별 가능
- Executive Summary 존재
- Recommendation 존재
- 관련 이미지 배치
- References 존재
- 사용자 AI 수정 요청 가능
- 사용자 직접 편집 가능
- 사용자 편집 내용 보존
- Google Docs 출력 가능
- PDF 출력 가능
- 버전 관리 가능

---

# 51. MVP 범위

## 보고서 생성

- 현장 선택
- 자료 선택
- 분석 방향 입력
- 분석계획 생성
- 분석계획 수정
- Codex 기반 분석
- 외부 조사
- Evidence 생성
- 초안 생성
- 출처 연결

## 초안 리뷰

- AI 수정 요청
- 문장/Section/전체 수정
- 수정안 Preview
- 적용/취소
- 반복 수정 요청
- 수정 이력 저장

## 사용자 직접 편집

- Gatherly 내 텍스트 직접 수정
- 제목 및 본문 편집
- 표 및 캡션 편집
- 사용자 편집 내용 보호

## 출력

- A4 가로형 PDF
- 현장 이미지 148.5 × 148.5mm
- Google Docs 출력
- Google Docs에서 자유 편집

---

# 52. MVP 이후

- Google Docs 양방향 Sync
- Google Docs 수정본 다시 가져오기
- 협업자 Comment
- 공동 편집
- Word Export
- PPT Export
- 자동 차트 생성
- 시장 규모 그래프
- 경쟁사 포지셔닝맵
- SWOT
- 브랜드별 보고서 Template
- 여러 현장 통합분석
- 이전 보고서 비교
- 다국어 보고서

---

# 53. 핵심 성공지표

### 품질

- 보고서 생성 성공률 ≥ 95%
- 핵심 외부 사실 출처 연결 ≥ 95%
- 근거 없는 숫자 0건 목표
- Evidence 연결률 ≥ 90%
- 수정 없이 활용 가능한 Section ≥ 80%
- 분석방향 반영 만족도 ≥ 4/5

### 수정 경험

- 전체 재생성 없이 부분 수정 성공률 ≥ 95%
- 사용자 직접 편집 내용 보존율 100%
- 수정 요청 후 관련 없는 Section 변경 최소화
- 수정 요청 이력 100% 추적 가능

---

# 54. Gatherly 보고서의 핵심 차별점

일반적인 AI 보고서:

```text
Prompt
+
AI
=
Generated Text
```

Gatherly:

```text
현장 조사
↓
사진 / 영상 / 음성 / 메모
↓
사용자 분석 방향
↓
Evidence 구조화
↓
신뢰 가능한 외부 조사
↓
근거 검증
↓
AI Insight
↓
전문적인 보고서 초안
↓
사용자와 AI의 반복 수정
↓
Google Docs / Gatherly 직접 편집
↓
Final Report
```

Gatherly의 AI는 보고서를 일방적으로 만들어주는 것이 아니라,

> **사용자가 수집한 실제 Evidence를 바탕으로 조사하고 초안을 만든 뒤, 사용자의 수정 지시를 받아 함께 완성해가는 AI Research Partner**

역할을 한다.

---

# 55. 최종 제품 정의

**Gatherly Reports**

> 사용자가 현장에서 직접 수집한 자료를 기반으로 사용자가 지정한 분석 방향에 따라 AI가 추가 조사와 근거 검증을 수행하고, 현장 이미지와 핵심 인사이트를 결합해 전문적인 초안을 생성한다. 이후 사용자는 자연어로 AI에게 반복적인 수정 요청을 하거나 직접 내용을 편집할 수 있으며, 필요하면 Google Docs로 출력해 자유롭게 후편집할 수 있는 Evidence-based AI Research Report System.
