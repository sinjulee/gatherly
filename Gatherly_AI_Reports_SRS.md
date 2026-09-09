# Gatherly AI Reports
# Software Requirements Specification (SRS) v1.0

**문서명:** Gatherly AI Reports Software Requirements Specification  
**버전:** v1.0  
**작성일:** 2026-09-10  
**대상 시스템:** Gatherly Reports  
**문서 상태:** Development Ready Draft  
**상위 문서:** Gatherly AI Reports PRD v1.1

---

# 1. 문서 목적

본 문서는 Gatherly의 AI 기반 보고서 작성 기능에 대한 상세 소프트웨어 요구사항을 정의한다.

본 SRS의 목적은 다음과 같다.

- 프론트엔드 개발 기준 정의
- 백엔드 API 요구사항 정의
- 데이터베이스 구조 정의
- Mac mini Report Worker 동작 정의
- Codex CLI 기반 AI 보고서 생성 흐름 정의
- 현장 자료 Evidence 처리 기준 정의
- 외부 Research 처리 기준 정의
- 보고서 초안 생성 기준 정의
- AI 수정 요청 처리 기준 정의
- 사용자 직접 편집 기준 정의
- Google Docs Export 기준 정의
- PDF 출력 기준 정의
- 버전 관리 기준 정의
- 오류 및 복구 정책 정의
- QA 및 완료 판정 기준 정의

본 문서의 요구사항 ID는 구현, 테스트, 버그 관리 시 동일하게 사용한다.

---

# 2. 시스템 목표

Gatherly Reports는 사용자가 현장에서 수집한 자료를 기반으로 AI가 전문적인 조사 보고서를 생성하는 기능이다.

핵심 시스템 흐름은 다음과 같다.

```text
현장 자료
사진 / 영상 / 음성 / 텍스트
        ↓
사용자가 분석 방향 입력
        ↓
AI 분석 계획 수립
        ↓
사용자 확인 및 수정
        ↓
현장 Evidence 추출
        ↓
추가 외부 조사
        ↓
Evidence 검증
        ↓
AI 분석
        ↓
보고서 초안 생성
        ↓
사용자 검토
        ↓
┌───────────────────────────┐
│ AI 수정 요청              │
│ Gatherly 직접 편집        │
│ Google Docs 편집          │
└───────────────────────────┘
        ↓
최종 QA
        ↓
Final Report
        ↓
PDF / Google Docs
```

---

# 3. 시스템 핵심 원칙

## 3.1 Analysis Direction First

보고서는 자료 선택만으로 자동 생성하지 않는다.

사용자는 반드시 보고서를 통해 분석하고 싶은 목적 또는 질문을 입력해야 한다.

같은 자료를 사용하더라도 분석 방향에 따라 보고서 구조와 결론이 달라져야 한다.

예:

```text
같은 전시회 자료
        ↓
시장성 분석
→ 시장규모 / 경쟁강도 / 소비자수요 / 진입장벽 중심

같은 전시회 자료
        ↓
마케팅 전략
→ 타깃 / 포지셔닝 / 메시지 / 채널 / 콘텐츠 중심
```

---

# 4. 시스템 범위

## 4.1 MVP 포함

- 보고서 프로젝트 생성
- 현장 선택
- 분석 대상 자료 선택
- 분석 방향 입력
- 보고서 목적 설정
- 독자 설정
- 분석 범위 설정
- 핵심 질문 설정
- AI 분석 계획 생성
- 분석 계획 사용자 수정
- 현장 Evidence 추출
- 외부 Research
- 출처 관리
- AI Insight 생성
- 보고서 초안 생성
- 사진 자동 선별
- 사진 배치
- AI 수정 요청
- 부분 재작성
- 추가 조사 후 보강
- 변경사항 Preview
- 사용자 직접 텍스트 편집
- 사용자 수정 보호
- 버전 관리
- PDF 출력
- Google Docs 출력
- 보고서 상태 추적
- 실패 작업 재실행
- 최종 QA

---

# 5. MVP 제외

다음 기능은 후속 버전으로 분류한다.

- Google Docs → Gatherly 자동 동기화
- Google Docs 양방향 Sync
- 실시간 공동 편집
- 사용자별 댓글
- PPT 자동 생성
- DOCX Export
- 여러 사용자 권한 관리
- 자동 SWOT 시각화
- 자동 포지셔닝 맵
- 고급 데이터 차트
- 여러 FieldDay 통합 비교 분석
- 다국어 자동 보고서
- 보고서 예약 생성

---

# 6. 사용자 역할

MVP에서는 단일 사용자 구조를 기본으로 한다.

## USER

다음 권한을 가진다.

- 보고서 생성
- 자료 선택
- 분석 방향 입력
- 분석 계획 수정
- AI 작업 실행
- 보고서 열람
- 직접 편집
- AI 수정 요청
- 이미지 교체
- 버전 관리
- PDF Export
- Google Docs Export
- Final 확정

---

# 7. 주요 시스템 컴포넌트

```text
Gatherly Web App
│
├─ Report UI
├─ Report Editor
├─ Revision Panel
├─ Evidence Viewer
├─ Export UI
│
▼
Gatherly Server
│
├─ Report API
├─ Evidence API
├─ Revision API
├─ Export API
├─ Job Controller
│
▼
Database
│
├─ Report
├─ ReportVersion
├─ ReportSection
├─ ReportEvidence
├─ ResearchSource
├─ ReportImage
├─ ReportRevisionRequest
├─ ReportExport
└─ ReportJob
│
▼
Mac mini
│
└─ Gatherly Report Worker
        │
        └─ Codex CLI
             ├─ Evidence Analysis
             ├─ Web Research
             ├─ Analysis
             ├─ Draft
             ├─ Revision
             └─ QA
```

---

# 8. Report 생성 요구사항

## FR-REP-001 — 새 보고서 생성
시스템은 `/reports` 화면에 `새 보고서` 버튼을 제공해야 한다.

## FR-REP-002 — FieldDay 선택
사용자는 보고서의 기반이 될 FieldDay를 선택할 수 있어야 한다. 필수값이다.

## FR-REP-003 — 자료 목록 조회
FieldDay 선택 시 연결된 Material을 조회해야 한다.
지원 유형은 IMAGE, VIDEO, AUDIO, TEXT이다.

각 Material에는 최소 다음 정보를 표시한다.
- Thumbnail
- 자료 종류
- 제목
- 등록 시각
- 사용자 메모
- 선택 상태

## FR-REP-004 — 자료 선택
사용자는 각 Material을 보고서 분석 대상에 포함하거나 제외할 수 있어야 한다.
기본값은 `selected = true`이다.

## FR-REP-005 — 자료 전체 선택
다음 기능을 제공한다.
- 전체 선택
- 전체 해제
- 이미지 전체 선택
- 텍스트 전체 선택

---

# 9. 분석 방향 요구사항

## FR-ANL-001 — 분석 방향 필수 입력
시스템은 다음 질문을 표시해야 한다.

**이 자료를 통해 무엇을 분석하고 싶나요?**

`analysisDirection`은 필수 입력이다.
최소 입력 길이는 10 characters로 한다.

## FR-ANL-002 — 자유 자연어 입력
분석 방향은 제한된 선택값이 아니라 자유로운 자연어 입력을 허용해야 한다.

## FR-ANL-003 — 분석 템플릿
다음 기본 템플릿을 제공해야 한다.

```text
MARKET_FEASIBILITY
MARKETING_STRATEGY
COMPETITOR_ANALYSIS
CONSUMER_TREND
BUSINESS_OPPORTUNITY
PRODUCT_BENCHMARK
BRAND_ANALYSIS
INDUSTRY_TREND
CUSTOM
```

템플릿은 분석 방향 작성 보조 기능이며 필수 선택값이 아니다.

## FR-ANL-004 — 보고서 목적
사용자는 선택적으로 `purpose`를 설정할 수 있다.

예:
- 내부 검토
- 경영진 보고
- 고객사 제출
- 신규사업 검토
- 투자 검토
- 마케팅 기획

## FR-ANL-005 — 독자 설정
사용자는 `audience`를 설정할 수 있다.

```text
WORKING_LEVEL
MANAGER
EXECUTIVE
CUSTOMER
INVESTOR
GENERAL
CUSTOM
```

## FR-ANL-006 — 분석 범위
다음 항목을 선택적으로 입력할 수 있다.
- 지역
- 시장
- 소비자 집단
- 분석 기간
- 경쟁사
- 제품군
- 기타 제한조건

## FR-ANL-007 — 핵심 질문
사용자는 보고서에서 반드시 답해야 할 질문을 복수 입력할 수 있어야 한다.

---

# 10. AI 분석 계획

## FR-PLAN-001 — 분석 계획 생성
사용자가 기본 정보를 입력한 후 시스템은 Codex에 분석계획 생성 Job을 전달해야 한다.

## FR-PLAN-002 — 분석 계획 내용
분석 계획에는 최소 다음 데이터가 포함되어야 한다.

```json
{
  "analysisObjective": "",
  "keyQuestions": [],
  "researchRequirements": [],
  "proposedSections": [],
  "expectedEvidence": [],
  "risks": []
}
```

## FR-PLAN-003 — 분석 계획 검토
사용자는 생성된 분석계획을 실행 전에 확인할 수 있어야 한다.

## FR-PLAN-004 — 분석 계획 수정
사용자는 다음 항목을 수정할 수 있어야 한다.
- 분석 목적
- 핵심 질문
- 조사 항목
- 보고서 Section
- Section 순서

## FR-PLAN-005 — 사용자 승인
사용자가 `분석 시작`을 명시적으로 실행하기 전까지 본격적인 Report Generation Job을 시작해서는 안 된다.

---

# 11. Mac mini Report Worker

## SYS-WRK-001 — 실행 위치
AI 보고서 관련 Codex 작업은 Mac mini의 Gatherly Report Worker에서 실행한다.

## SYS-WRK-002 — API 비사용
기본 AI 실행 방식은 OpenAI API 호출이 아니라 Codex CLI를 사용해야 한다.

## SYS-WRK-003 — 인증
Codex CLI는 시스템에 로그인된 ChatGPT 계정 인증 상태를 사용한다.

## SYS-WRK-004 — API 자동 대체 금지
Codex CLI 실행 실패 또는 사용량 제한 발생 시 시스템은 별도 OpenAI API Key 방식으로 자동 전환해서는 안 된다.

## SYS-WRK-005 — Worker Polling
Worker는 실행 대기 상태의 ReportJob을 조회하고 하나씩 처리할 수 있어야 한다.
향후 Queue 시스템으로 교체할 수 있도록 Job Controller와 Worker를 분리한다.

## SYS-WRK-006 — 동시 작업
MVP 기본 동시 실행 Report Job은 1개로 한다.
Report Revision은 본 Report Generation Job과 충돌해서는 안 된다.

---

# 12. Report Workspace

## SYS-WRK-010 — 작업 폴더 생성
각 보고서는 독립 Workspace를 가져야 한다.

```text
report-workspace/
└── {reportId}/
```

## SYS-WRK-011 — Workspace 구조

```text
{reportId}/
├── brief.json
├── analysis-plan.json
├── materials/
├── evidence.json
├── research-plan.json
├── research.json
├── sources.json
├── outline.json
├── draft.json
├── draft.md
├── images.json
├── revisions/
│   ├── revision-001.json
│   └── revision-002.json
└── qa.json
```

## SYS-WRK-012 — 사용자 Prompt 보안
사용자의 자연어 입력을 shell command 문자열에 직접 연결해서는 안 된다.
사용자 입력은 파일 또는 안전한 structured input 형태로 전달해야 한다.

## SYS-WRK-013 — 파일 접근 제한
Report Worker는 Report Workspace와 명시적으로 허용된 Material 경로만 사용해야 한다.
보고서 생성 작업이 Gatherly 소스코드를 수정해서는 안 된다.

---

# 13. Evidence Extraction

## FR-EVD-001 — 자료 우선 분석
외부 조사를 시작하기 전에 선택된 Gatherly Material을 먼저 분석해야 한다.

## FR-EVD-002 — Evidence 단위 생성
각 Evidence에는 다음 정보가 존재해야 한다.

```text
id
reportId
materialId
type
content
confidence
metadata
createdAt
```

## FR-EVD-003 — Evidence 유형
```text
FIELD
EXTERNAL
INFERENCE
```

## FR-EVD-004 — 사진 Evidence
사진에서 추출 가능한 요소:
- 제품
- 브랜드
- 가격
- 표기 문구
- 디자인
- 색상
- 진열 형태
- 공간 구성
- 사용 상황
- 시각적 특징

## FR-EVD-005 — 텍스트 Evidence
사용자 메모에서 다음을 추출한다.
- 사실
- 사용자 관찰
- 의견
- 질문
- 숫자
- 제품명
- 브랜드명
- 잠재 Insight

사용자의 의견을 확인된 사실로 변환해서는 안 된다.

## FR-EVD-006 — 음성 Evidence
음성 자료는 전사본이 존재할 경우 전사 내용을 Evidence 대상으로 사용한다.

## FR-EVD-007 — 영상 Evidence
MVP에서는 다음 중 존재하는 정보를 사용한다.
- 영상 설명
- 사용자 메모
- metadata
- 추출된 대표 frame

전체 영상 AI 분석은 별도 확장 가능 구조로 둔다.

---

# 14. Research Planning

## FR-RSR-001 — 조사 필요성 판단
Codex는 분석방향과 현재 Evidence를 비교하여 부족한 정보 영역을 결정해야 한다.

## FR-RSR-002 — 조사 계획
외부 조사 전에 Research Plan을 생성해야 한다.

```json
{
  "topics": [
    {
      "question": "국내 시장 규모는?",
      "priority": "HIGH",
      "preferredSourceTier": ["A", "B"]
    }
  ]
}
```

---

# 15. 외부 Research

## FR-RSR-010 — 웹 조사
시스템은 분석에 필요한 외부 정보를 검색할 수 있어야 한다.

## FR-RSR-011 — 출처 우선순위

```text
Tier A
정부 / 공공기관 / 공식 통계 / 논문 / 국제기구

Tier B
기업 공식자료 / IR / 산업협회 / 전문 리서치 기관

Tier C
신뢰도 높은 언론 / 전문매체

Tier D
블로그 / SNS / 커뮤니티
```

## FR-RSR-012 — Tier D 제한
Tier D 자료를 다음 핵심 사실의 단독 근거로 사용해서는 안 된다.
- 시장 규모
- 성장률
- 공식 정책
- 법적 기준
- 기업 공식 실적

## FR-RSR-013 — 중요 숫자 검증
중요한 숫자는 가능한 경우 둘 이상의 출처로 확인해야 한다.

## FR-RSR-014 — 출처 충돌
출처별 수치가 다르면 이를 숨겨서는 안 된다.
필요하면 보고서에 범위 또는 차이 원인을 설명해야 한다.

## FR-RSR-015 — ResearchSource 저장
각 출처는 DB에 기록한다.
필수:

```text
title
publisher
url
publishedAt
accessedAt
sourceTier
```

---

# 16. Insight 생성

## FR-INS-001
Insight는 다음 조합을 기준으로 생성해야 한다.

```text
FIELD Evidence
+
EXTERNAL Evidence
+
Analysis Direction
=
INFERENCE
```

## FR-INS-002
AI가 직접 도출한 해석은 FIELD 또는 EXTERNAL로 저장해서는 안 된다.
`INFERENCE`로 구분한다.

## FR-INS-003
주요 Insight는 어떤 Evidence에서 도출되었는지 연결할 수 있어야 한다.

---

# 17. 보고서 Outline 생성

## FR-OUT-001
보고서 목차는 분석 방향에 따라 동적으로 생성한다.

## FR-OUT-002
다음 기본 Section은 가능한 경우 유지한다.

```text
Cover
Executive Summary
Research Overview
Findings
Analysis
Insights
Recommendations
References
```

## FR-OUT-003
분석 종류에 따라 필요한 Section을 추가할 수 있다.

---

# 18. 보고서 Draft Generation

## FR-DRF-001 — 초안 생성
Outline과 Evidence, Research를 기반으로 Draft를 생성한다.

## FR-DRF-002 — Structured Output
보고서 결과를 Markdown 단일 문자열만으로 저장하지 않는다.
최소 Section 단위 구조화 데이터를 생성해야 한다.

```json
{
  "sections": [
    {
      "id": "section-01",
      "type": "EXECUTIVE_SUMMARY",
      "title": "Executive Summary",
      "blocks": []
    }
  ]
}
```

---

# 19. 콘텐츠 Block 구조

지원 Block:

```text
PARAGRAPH
BULLET_LIST
NUMBERED_LIST
KEY_INSIGHT
STAT_CARD
TABLE
QUOTE
IMAGE
IMAGE_CAPTION
ACTION_ITEM
SOURCE_NOTE
```

## FR-DRF-003 — 가독성
한 Section이 긴 텍스트 덩어리 하나로 생성되지 않도록 해야 한다.

## FR-DRF-004 — Executive Summary
Executive Summary는 최소 다음 정보를 포함해야 한다.
- 핵심 발견
- 주요 숫자
- 주요 기회
- 주요 리스크
- 핵심 Recommendation

---

# 20. 현장 이미지 자동 배치

## FR-IMG-001
AI는 선택된 모든 사진을 보고서에 넣지 않는다.
본문과 관련성이 높은 사진을 선별해야 한다.

## FR-IMG-002
각 이미지에는 연결 Section이 존재해야 한다.

## FR-IMG-003
이미지는 근거로 사용되는 경우 해당 분석과 인접한 위치에 배치한다.

## FR-IMG-004
이미지 Caption을 생성할 수 있어야 한다.

예:
```text
Figure 3. A 브랜드의 친환경 패키지 구조 — 현장 촬영
```

---

# 21. 이미지 크기

## FR-IMG-010
PDF 기준 페이지는:
```text
A4 Landscape
297mm × 210mm
```

## FR-IMG-011
기본 주요 이미지 영역:
```text
148.5mm × 148.5mm
```
정사각형.

## FR-IMG-012
이미지 원본의 중요한 영역을 임의로 제거해서는 안 된다.
필요하면 다음을 사용한다.
- contain
- letterbox
- 여백

## FR-IMG-013
PDF Renderer에서는 물리 크기를 최대한 정확하게 적용한다.
Google Docs Export에서는 문서 편집기의 제약 때문에 ±2% 범위의 크기 차이를 허용한다.

---

# 22. Draft 상태

Draft 생성 및 초기 QA 완료 후 Report 상태는 다음으로 변경한다.

```text
DRAFT_READY
```

사용자는 이 시점부터 수정할 수 있다.

---

# 23. 초안 검토 UI

## UI-REP-001
초안 화면은 기본적으로 다음 3영역을 제공한다.

```text
┌──────────────┬──────────────────────┬───────────────┐
│ 목차          │ 보고서               │ AI 수정 패널   │
│              │ 편집 / Preview       │               │
└──────────────┴──────────────────────┴───────────────┘
```

## UI-REP-002
상단에는 최소 다음 정보를 표시한다.
- 보고서 제목
- 상태
- 현재 버전
- 저장 상태

## UI-REP-003
주요 액션:
```text
AI 수정 요청
직접 편집
Google Docs로 내보내기
PDF 출력
버전 저장
최종 확정
```

---

# 24. AI 수정 요청 모듈

## FR-REV-001 — 수정 요청 입력
사용자는 자연어로 수정 요청을 입력할 수 있어야 한다.

## FR-REV-002 — 수정 범위
지원 범위:
```text
SELECTION
BLOCK
SECTION
MULTI_SECTION
WHOLE_REPORT
```

## FR-REV-003 — 선택 텍스트 수정
사용자가 특정 텍스트를 선택한 후 AI 수정 요청을 실행할 수 있어야 한다.

## FR-REV-004 — Section 수정
사용자는 현재 Section 전체에 대한 수정 요청을 할 수 있어야 한다.

## FR-REV-005 — 전체 보고서 수정
사용자는 톤이나 전체 방향 변경을 요청할 수 있다.

예:
> 전체적으로 경영진 보고용으로 더 간결하게 수정해줘.

---

# 25. Revision Intent 분석

## FR-REV-010
AI는 수정 요청을 먼저 다음 유형으로 분류해야 한다.

```text
SHORTEN
EXPAND
REWRITE
TONE_CHANGE
STRUCTURE_CHANGE
ADD_RESEARCH
REMOVE_CONTENT
ADD_TABLE
CHANGE_IMAGE
CHANGE_CONCLUSION
CUSTOM
```

## FR-REV-011
수정 요청과 관련 없는 Section은 가능한 한 수정해서는 안 된다.

---

# 26. 추가 Research가 필요한 수정

## FR-REV-020
다음과 같은 요청은 추가 조사 Job을 수행할 수 있어야 한다.

> 국내 소비자 자료를 더 찾아서 보강해줘.

## FR-REV-021
추가 조사로 생성된 ResearchSource는 기존 보고서의 출처 목록에 추가해야 한다.

## FR-REV-022
새로운 외부 정보가 포함된 수정안은 Evidence Verification을 다시 수행해야 한다.

---

# 27. Revision Preview

## FR-REV-030
AI 수정 결과를 원본에 즉시 덮어쓰면 안 된다.

## FR-REV-031
수정 결과는 Preview 상태로 제공해야 한다.

## FR-REV-032
사용자는 다음 선택을 할 수 있어야 한다.

```text
APPLY
REJECT
REVISE_AGAIN
```

## FR-REV-033
가능한 경우 수정 전/후 Diff를 표시한다.

---

# 28. Revision 적용

## FR-REV-040
사용자가 `적용`을 선택한 경우에만 현재 ReportVersion에 변경 내용을 반영한다.

## FR-REV-041
AI 수정 적용 후 새로운 ReportVersion을 생성해야 한다.

## FR-REV-042
버전 생성 사유:
```text
AI_REVISION
```

---

# 29. Revision 이력

각 요청은 `ReportRevisionRequest`로 저장한다.

필드:
```text
id
reportId
baseVersionId
resultVersionId
targetType
targetSectionId
instruction
intentType
status
createdAt
completedAt
error
```

---

# 30. 연속 수정

## FR-REV-050
사용자는 수정본에 대해 다시 AI 수정 요청을 할 수 있어야 한다.

## FR-REV-051
모든 Revision은 직전 버전을 Base Version으로 기록한다.

예:
```text
v1 AI Draft
↓
v2 AI Revision
↓
v3 AI Revision
↓
v4 User Edit
```

---

# 31. 사용자 직접 텍스트 편집

## FR-EDT-001
사용자는 Gatherly Report Editor에서 텍스트를 직접 수정할 수 있어야 한다.

## FR-EDT-002
수정 가능 항목:
- 제목
- Section Title
- Paragraph
- Bullet
- Insight
- Recommendation
- Table Cell
- Image Caption

## FR-EDT-003
사용자가 수정한 Block은 다음 값을 기록한다.
```text
userEdited = true
```

---

# 32. 사용자 편집 보호

## FR-EDT-010
사용자가 직접 편집한 Block 또는 Section을 AI 재수정으로부터 보호할 수 있어야 한다.
```text
aiEditLocked = true
```

## FR-EDT-011
전체 보고서 AI 수정 시 `aiEditLocked = true`인 콘텐츠는 변경해서는 안 된다.

## FR-EDT-012
사용자가 명시적으로 해당 잠금을 해제할 수 있어야 한다.

---

# 33. Auto Save

## FR-EDT-020
사용자의 직접 편집 내용은 자동 저장되어야 한다.
권장 debounce:
```text
1~2 seconds
```

## FR-EDT-021
화면에 저장 상태를 표시한다.
```text
저장 중
저장됨
저장 실패
```

---

# 34. 버전 관리

## FR-VER-001
보고서의 중요한 상태 변경마다 버전을 생성한다.

## FR-VER-002
버전 유형:
```text
AI_DRAFT
AI_REVISION
USER_EDIT
FINAL
```

## FR-VER-003
ReportVersion은 immutable snapshot을 원칙으로 한다.
기존 버전을 덮어쓰지 않는다.

## FR-VER-004
사용자는 이전 버전을 조회할 수 있어야 한다.

## FR-VER-005
사용자는 이전 버전을 기반으로 새 버전을 복원할 수 있어야 한다.
복원 시 과거 데이터를 덮어쓰지 않고 새로운 버전을 생성한다.

---

# 35. Google Docs Export

## FR-GDOC-001
사용자는 보고서를 Google Docs 문서로 Export할 수 있어야 한다.
버튼: **Google Docs에서 편집**

## FR-GDOC-002
Google Docs Export 대상은 현재 선택된 ReportVersion이어야 한다.

## FR-GDOC-003
Export 문서에는 최소 다음을 포함해야 한다.
- Report Title
- Heading 구조
- 목차
- 본문
- Bullet
- 표
- 이미지
- 이미지 Caption
- References

---

# 36. Google Docs Export 방향

## FR-GDOC-010
문서 기본 페이지 방향은 A4 Landscape를 목표로 한다.

## FR-GDOC-011
이미지는 가능한 경우 148.5mm 정사각형으로 생성한다.

## FR-GDOC-012
Google Docs의 편집 환경 때문에 PDF와 픽셀 단위 동일 레이아웃을 보장하지 않는다.

---

# 37. Google Docs Export 데이터 흐름

```text
ReportVersion
↓
Structured Report JSON
↓
Google Docs Renderer
↓
Google Drive
↓
Google Docs 생성
↓
ReportExport 저장
↓
문서 링크 반환
```

## FR-GDOC-020
Export 성공 시 다음 정보를 저장한다.
```text
externalFileId
externalUrl
exportedAt
versionId
status
```

## FR-GDOC-021
기존 Google Docs 문서를 자동으로 덮어쓰지 않는다.

## FR-GDOC-022
보고서 수정 후 다시 Export하면 새 Google Docs 문서를 생성한다.

## FR-GDOC-023
문서명에는 버전을 포함할 수 있어야 한다.

예:
```text
2026 Pet Expo 시장성 분석_v3
```

---

# 38. Google Docs 동기화 제한

MVP에서는 다음 기능을 제공하지 않는다.
```text
Google Docs → Gatherly 자동 반영
```

따라서 Google Docs는 편집 가능한 Export Copy로 정의한다.
Gatherly가 Source of Truth이다.

---

# 39. PDF Export

## FR-PDF-001
사용자는 현재 ReportVersion을 PDF로 출력할 수 있어야 한다.

## FR-PDF-002
페이지:
```text
A4 Landscape
297mm × 210mm
```

## FR-PDF-003
다음 요소를 지원한다.
- Cover
- TOC
- Heading
- Paragraph
- Table
- Image
- Caption
- Key Insight
- Stat Card
- Page Number
- Reference

## FR-PDF-004
PDF와 Gatherly 보고서 내용은 의미상 동일해야 한다.

---

# 40. Report 상태

Report.status는 다음 enum을 사용한다.

```text
DRAFT
PLAN_GENERATING
PLAN_READY
PREPARING_EVIDENCE
RESEARCHING
ANALYZING
WRITING
VERIFYING
LAYOUT
DRAFT_READY
USER_REVIEW
REVISING
FINALIZING
COMPLETED
FAILED
```

---

# 41. 상태 전이

```text
DRAFT
↓
PLAN_GENERATING
↓
PLAN_READY
↓
사용자 승인
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
├─ 직접 수정
├─ REVISING
├─ Google Docs Export
└─ PDF Preview
↓
FINALIZING
↓
COMPLETED
```

---

# 42. 실패 상태

어느 AI 작업 단계에서도 오류 발생 시:
```text
FAILED
```
처리하고 마지막 성공 단계와 작업 내용을 보존한다.

---

# 43. ReportJob

`ReportJob`은 장시간 실행 작업을 관리한다.

필드:
```text
id
reportId
jobType
status
stage
progress
attempt
startedAt
completedAt
errorCode
errorMessage
createdAt
updatedAt
```

## JobType
```text
GENERATE_PLAN
GENERATE_REPORT
RESEARCH
REVISION
VERIFY
EXPORT_PDF
EXPORT_GOOGLE_DOCS
```

## JobStatus
```text
QUEUED
RUNNING
SUCCESS
FAILED
CANCELLED
```

---

# 44. 진행률

사용자 UI는 가능한 경우 현재 처리 단계를 표시한다.

예:
```text
현장 자료 분석 중
외부 자료 조사 중
시장 자료 검증 중
보고서 작성 중
이미지 배치 중
품질 검토 중
```

단순 무한 로딩만 표시해서는 안 된다.

---

# 45. 실패 복구

## SYS-ERR-001
Job 실패 시 이미 완료된 단계의 결과물을 삭제해서는 안 된다.

## SYS-ERR-002
사용자는 `다시 실행`할 수 있어야 한다.

## SYS-ERR-003
재실행은 가능한 경우 실패한 단계부터 시작한다.

---

# 46. Codex 사용량 제한

## SYS-ERR-010
Codex 실행이 사용량 제한으로 실패하는 경우 별도 오류코드를 사용한다.
```text
CODEX_USAGE_LIMIT
```

## SYS-ERR-011
사용자에게 현재까지의 분석 결과는 저장되어 있으며 이후 다시 실행할 수 있음을 표시한다.

## SYS-ERR-012
API로 자동 우회해서는 안 된다.

---

# 47. Codex 인증 오류

오류:
```text
CODEX_AUTH_REQUIRED
```

Mac mini의 Codex 로그인 상태 확인이 필요함을 표시한다.
기존 작업 데이터는 보존한다.

---

# 48. Google 연결 오류

Google 계정 연결이 없는 경우:
```text
GOOGLE_CONNECTION_REQUIRED
```

Google Docs Export만 차단하고 보고서 생성 자체에는 영향을 주지 않는다.

---

# 49. 데이터 모델

## Report
```text
id                String
fieldDayId        String
title             String
templateType      Enum?
analysisDirection Text
purpose           String?
audience          String?
scope             Json?
status            ReportStatus
currentVersionId  String?
createdAt         DateTime
updatedAt         DateTime
deletedAt         DateTime?
```

---

# 50. ReportQuestion
```text
id
reportId
question
order
createdAt
```

---

# 51. ReportAnalysisPlan
```text
id
reportId
objective
keyQuestions
researchRequirements
proposedSections
expectedEvidence
risks
userApproved
approvedAt
createdAt
updatedAt
```

---

# 52. ReportVersion
```text
id
reportId
versionNumber
versionType
parentVersionId
createdBy
snapshot
createdAt
```

---

# 53. ReportSection
```text
id
versionId
type
title
order
userEdited
aiEditLocked
createdAt
updatedAt
```

---

# 54. ReportBlock
```text
id
sectionId
blockType
content
order
userEdited
aiEditLocked
createdAt
updatedAt
```

---

# 55. ReportEvidence
```text
id
reportId
materialId
evidenceType
content
confidence
metadata
createdAt
```

---

# 56. EvidenceLink
Insight 또는 Block과 Evidence의 관계를 저장한다.

```text
id
blockId
evidenceId
relationType
createdAt
```

---

# 57. ResearchSource
```text
id
reportId
title
publisher
url
publishedAt
accessedAt
sourceTier
sourceType
createdAt
```

---

# 58. ReportSourceLink
```text
id
sourceId
blockId
context
createdAt
```

---

# 59. ReportImage
```text
id
reportId
materialId
versionId
sectionId
blockId
caption
figureNumber
displayWidthMm
displayHeightMm
fitMode
createdAt
```

기본:
```text
displayWidthMm = 148.5
displayHeightMm = 148.5
fitMode = CONTAIN
```

---

# 60. ReportRevisionRequest
```text
id
reportId
baseVersionId
resultVersionId
targetType
targetSectionId
targetBlockId
instruction
intentType
requiresResearch
status
preview
createdAt
completedAt
error
```

---

# 61. ReportExport
```text
id
reportId
versionId
type
externalFileId
externalUrl
localFilePath
status
exportedAt
error
```

---

# 62. ReportJob
```text
id
reportId
jobType
status
stage
progress
attempt
workspacePath
startedAt
completedAt
errorCode
errorMessage
createdAt
updatedAt
```

---

# 63. Report API

권장 API 구조:
```text
GET    /api/reports
POST   /api/reports
GET    /api/reports/:id
PATCH  /api/reports/:id
DELETE /api/reports/:id
```

---

# 64. Analysis Plan API
```text
POST  /api/reports/:id/analysis-plan
GET   /api/reports/:id/analysis-plan
PATCH /api/reports/:id/analysis-plan
POST  /api/reports/:id/analysis-plan/approve
```

---

# 65. Generation API
```text
POST /api/reports/:id/generate
GET  /api/reports/:id/jobs
GET  /api/reports/:id/jobs/:jobId
POST /api/reports/:id/jobs/:jobId/retry
```

---

# 66. Revision API
```text
POST /api/reports/:id/revisions
GET  /api/reports/:id/revisions
GET  /api/reports/:id/revisions/:revisionId
POST /api/reports/:id/revisions/:revisionId/apply
POST /api/reports/:id/revisions/:revisionId/reject
```

---

# 67. Editor API
```text
PATCH /api/reports/:id/sections/:sectionId
PATCH /api/reports/:id/blocks/:blockId
```

---

# 68. Version API
```text
GET  /api/reports/:id/versions
GET  /api/reports/:id/versions/:versionId
POST /api/reports/:id/versions/:versionId/restore
```

---

# 69. Export API
```text
POST /api/reports/:id/export/pdf
POST /api/reports/:id/export/google-docs
GET  /api/reports/:id/exports
```

---

# 70. Evidence 조회 API

사용자는 보고서 Block의 근거를 볼 수 있어야 한다.
```text
GET /api/reports/:id/blocks/:blockId/evidence
```

반환:
```text
FIELD Evidence
EXTERNAL Source
INFERENCE Relationship
```

---

# 71. Evidence UI

특정 Insight 또는 문장에 `근거 보기` 기능을 제공할 수 있어야 한다.

예:
```text
시장성이 높다고 판단됩니다. [근거 보기]
```

클릭 시 현장 근거, 외부 근거, AI 해석 관계를 확인할 수 있어야 한다.

---

# 72. 최종 QA

Final 전 자동 QA를 수행한다.

## QA-001 Analysis Direction
사용자가 요청한 분석 방향에 보고서가 실제 답하고 있는지 확인한다.

## QA-002 Evidence Coverage
주요 결론이 Evidence와 연결되어 있는지 확인한다.

## QA-003 Source Reliability
핵심 외부 사실의 출처 신뢰도를 검사한다.

## QA-004 Unsupported Numeric Claim
근거 없는 중요한 숫자를 탐지한다.
목표: 0.

## QA-005 Internal Consistency
보고서 내 서로 모순되는 결론이 있는지 확인한다.

## QA-006 Revision Compliance
사용자의 최신 수정 요청이 적용되었는지 확인한다.

## QA-007 Locked Content
사용자 보호 콘텐츠가 AI에 의해 변경되지 않았는지 검사한다.

## QA-008 Image Relevance
이미지와 배치된 Section의 관련성을 검사한다.

---

# 73. QA 결과

`qa.json` 예:
```json
{
  "passed": true,
  "score": 91,
  "checks": {
    "analysisDirection": "PASS",
    "evidenceCoverage": "PASS",
    "sourceReliability": "PASS",
    "numericClaims": "PASS",
    "consistency": "PASS"
  },
  "warnings": []
}
```

---

# 74. 최종 확정

## FR-FIN-001
사용자가 `최종 확정` 버튼을 실행해야 Final 상태로 이동한다.

## FR-FIN-002
최종 확정 전에 자동 QA를 수행한다.

## FR-FIN-003
Critical QA 오류가 있을 경우 Final 확정을 차단한다.

예:
- 근거 없는 중요 숫자
- 깨진 출처
- 빈 Executive Summary
- 분석 방향과 전혀 관련 없는 결과

---

# 75. COMPLETED 상태

다음 조건 충족 후 `status = COMPLETED` 처리한다.
- Final Version 존재
- QA 통과
- 분석 방향 존재
- References 존재
- 핵심 Recommendation 존재

---

# 76. 비기능 요구사항 — 성능

## NFR-PERF-001
일반 보고서 목록 조회 목표는 ≤ 2초이다.

## NFR-PERF-002
보고서 Editor 최초 로딩 목표는 ≤ 3초이다.
대용량 이미지는 Lazy Loading한다.

## NFR-PERF-003
AI 생성은 장시간 작업으로 취급한다.
HTTP 요청을 열린 상태로 유지하면서 완료를 기다리는 방식으로 구현하지 않는다.
Job 기반 비동기 처리 구조를 사용한다.

---

# 77. 안정성

## NFR-REL-001
AI Job 실패가 Report 데이터 손실로 이어져서는 안 된다.

## NFR-REL-002
각 주요 단계의 결과는 파일 또는 DB에 저장한다.

## NFR-REL-003
Worker 재시작 후 미완료 Job을 판별할 수 있어야 한다.

---

# 78. 데이터 무결성

## NFR-DATA-001
기존 ReportVersion은 삭제 또는 덮어쓰기보다 immutable snapshot을 우선한다.

## NFR-DATA-002
AI Revision은 기존 버전을 직접 파괴하지 않는다.

## NFR-DATA-003
Google Docs Export가 Gatherly 원본을 수정해서는 안 된다.

---

# 79. 보안

## NFR-SEC-001
사용자의 Prompt를 Shell command에 직접 interpolation하지 않는다.

## NFR-SEC-002
Codex Workspace 접근 범위를 제한한다.

## NFR-SEC-003
AI가 보고서 생성 도중 `.env`, 인증파일 등 시스템 비밀정보를 읽을 필요가 없도록 한다.

## NFR-SEC-004
Export 과정에서 Google 인증 Token을 보고서 Workspace에 평문으로 저장해서는 안 된다.

---

# 80. 개인정보

현장 자료에 개인정보가 포함될 가능성이 있으므로 외부 조사와 내부 Material을 명확히 구분한다.
사용자가 제공한 내부 사진 또는 메모 자체를 외부 웹 검색어에 불필요하게 그대로 전송하지 않는 방향을 원칙으로 한다.

---

# 81. 사용성

## NFR-UX-001
사용자는 현재 보고서 생성 단계가 무엇인지 알 수 있어야 한다.

## NFR-UX-002
AI 수정 요청은 별도의 복잡한 Prompt 형식 학습 없이 자연어로 사용할 수 있어야 한다.

## NFR-UX-003
직접 편집과 AI 편집 기능을 명확하게 구분한다.

---

# 82. 접근성

- 버튼은 명확한 Label 제공
- 상태를 색상만으로 구분하지 않음
- 이미지에는 가능한 경우 alt text 제공
- Keyboard focus 지원

---

# 83. Logging

Worker는 다음 이벤트를 기록한다.
```text
JOB_CREATED
CODEX_STARTED
EVIDENCE_COMPLETED
RESEARCH_STARTED
RESEARCH_COMPLETED
DRAFT_COMPLETED
QA_COMPLETED
REVISION_STARTED
REVISION_COMPLETED
EXPORT_COMPLETED
JOB_FAILED
```

---

# 84. 감사 추적

최소 다음을 추적한다.
- 보고서 생성시각
- AI Draft 생성시각
- 사용자 수정시각
- 수정요청 내용
- 수정 적용 여부
- 버전 변경
- Google Docs Export
- PDF Export
- Final 확정

---

# 85. 삭제 정책

Report 삭제는 MVP에서 Soft Delete를 우선한다.
```text
deletedAt
```

연관 Workspace를 즉시 삭제하지 않는다.
향후 별도 Cleanup 정책을 적용할 수 있도록 한다.

---

# 86. 핵심 화면

## `/reports`
보고서 목록.

표시:
- Title
- FieldDay
- Analysis Type
- Status
- Version
- Updated At
- Export 상태

## `/reports/new`
새 보고서 Wizard.

```text
1. 현장 선택
2. 자료 선택
3. 분석 방향
4. 세부 조건
5. 분석 계획 확인
```

## `/reports/:id`
보고서 상세 및 Editor.

---

# 87. Editor Layout

Desktop 기준:
```text
┌─────────────────────────────────────────────────────────┐
│ Gatherly Report        v4         저장됨      [Final]    │
├────────────┬─────────────────────────┬───────────────────┤
│ 목차        │                         │ AI 수정           │
│            │ 보고서 Preview / Editor │                   │
│ Summary    │                         │ 요청 내용         │
│ Findings   │                         │                   │
│ Market     │ [텍스트 편집]            │ [수정안 생성]      │
│ Consumer   │                         │                   │
│ Strategy   │ [현장 이미지]            │ 수정 이력         │
│            │                         │                   │
├────────────┴─────────────────────────┴───────────────────┤
│ Google Docs     PDF     버전 보기          최종 확정       │
└─────────────────────────────────────────────────────────┘
```

---

# 88. Mobile UI

모바일에서는 3열을 동시에 표시하지 않는다.

탭:
```text
보고서
목차
AI 수정
```

Google Docs / PDF / Final은 More 메뉴 또는 Bottom Action 영역에 배치할 수 있다.

---

# 89. Acceptance Criteria — 보고서 생성

### AC-REP-001
Given 사용자가 FieldDay를 선택하고  
And 하나 이상의 Material을 선택하고  
And 분석 방향을 입력했을 때  
When 분석 계획 생성을 실행하면  
Then 분석 목적과 핵심 질문, 예상 목차가 생성되어야 한다.

### AC-REP-002
Given 분석 계획이 생성되었을 때  
When 사용자가 승인하지 않았다면  
Then 전체 보고서 생성 Job이 시작되면 안 된다.

### AC-REP-003
Given 사용자가 분석 계획을 승인했을 때  
When Report Generation이 완료되면  
Then 상태는 `DRAFT_READY`가 되어야 한다.

---

# 90. Acceptance Criteria — 분석 차별화

### AC-ANL-001
동일한 Material을 사용하더라도 시장성 분석과 마케팅 전략을 각각 선택했을 경우 목차와 주요 분석 내용이 의미 있게 달라야 한다.

---

# 91. Acceptance Criteria — Evidence

### AC-EVD-001
보고서의 핵심 결론에 사용된 현장 Evidence를 사용자 화면에서 추적할 수 있어야 한다.

### AC-EVD-002
외부 자료 기반 핵심 수치는 ResearchSource와 연결되어야 한다.

---

# 92. Acceptance Criteria — AI 수정

### AC-REV-001
Given 사용자가 특정 Section에 `내용을 절반으로 줄여줘`라고 요청하면  
Then 관련 Section만 수정되어야 한다. 다른 Section의 내용은 의도치 않게 변경되지 않아야 한다.

### AC-REV-002
수정 결과는 사용자가 `적용`하기 전까지 기존 Draft를 덮어써서는 안 된다.

### AC-REV-003
수정 적용 후 새 ReportVersion이 생성되어야 한다.

---

# 93. Acceptance Criteria — 추가 조사 수정

### AC-REV-010
사용자가 `최신 국내 시장 자료를 추가해서 보강해줘`라고 요청했을 때 시스템은 필요 시 Research를 다시 실행하고 신규 출처를 추가할 수 있어야 한다.

---

# 94. Acceptance Criteria — 직접 편집

### AC-EDT-001
사용자가 본문을 직접 수정하면 해당 내용이 저장되어야 한다.

### AC-EDT-002
사용자가 수정한 Section을 AI Edit Lock 상태로 설정하면 전체 보고서 AI Revision에서도 해당 내용을 변경하지 않아야 한다.

---

# 95. Acceptance Criteria — Google Docs

### AC-GDOC-001
사용자가 `Google Docs에서 편집`을 선택하면 선택된 Version을 기반으로 Google Docs 문서가 생성되어야 한다.

### AC-GDOC-002
생성 완료 후 사용자가 해당 문서로 이동할 수 있는 URL을 반환해야 한다.

### AC-GDOC-003
Gatherly 보고서를 수정 후 다시 Export하더라도 기존 Google Docs 문서를 덮어쓰지 않아야 한다.

---

# 96. Acceptance Criteria — PDF

### AC-PDF-001
생성된 PDF가 A4 Landscape 형식이어야 한다.

### AC-PDF-002
대표 이미지 모듈은 148.5 × 148.5mm 정사각형을 목표로 해야 한다.

### AC-PDF-003
Reference가 누락되어서는 안 된다.

---

# 97. Acceptance Criteria — Failure Recovery

### AC-ERR-001
외부 Research 도중 Codex 작업이 실패하더라도 이미 생성된 Evidence가 삭제되어서는 안 된다.

### AC-ERR-002
사용자는 Job을 재실행할 수 있어야 한다.

### AC-ERR-003
Codex 사용량 제한 발생 시 API 방식으로 자동 실행해서는 안 된다.

---

# 98. Definition of Done

Gatherly Reports MVP는 다음이 모두 충족될 때 완료로 본다.

### 생성
- [ ] FieldDay 기반 Report 생성 가능
- [ ] Material 선택 가능
- [ ] 분석 방향 입력 가능
- [ ] 분석 계획 생성 가능
- [ ] 분석 계획 사용자 수정 가능
- [ ] 분석 계획 승인 후 실행

### AI 분석
- [ ] Evidence Extraction
- [ ] External Research
- [ ] Source 저장
- [ ] Insight 생성
- [ ] Report Draft 생성
- [ ] 현장 이미지 선별

### 보고서
- [ ] Executive Summary
- [ ] 동적 목차
- [ ] Findings
- [ ] Analysis
- [ ] Recommendation
- [ ] References

### 수정
- [ ] AI 자연어 수정 요청
- [ ] Section 수정
- [ ] 전체 수정
- [ ] 추가 조사 수정
- [ ] 수정 Preview
- [ ] Apply / Reject
- [ ] 수정 이력

### 직접 편집
- [ ] 텍스트 편집
- [ ] 제목 편집
- [ ] 표 수정
- [ ] Caption 수정
- [ ] Auto Save
- [ ] AI Edit Lock

### 버전
- [ ] AI Draft Version
- [ ] AI Revision Version
- [ ] User Edit Version
- [ ] Final Version
- [ ] 이전 버전 조회

### Export
- [ ] A4 Landscape PDF
- [ ] 148.5mm Square Image
- [ ] Google Docs Export
- [ ] Google Docs Link 저장
- [ ] 버전별 별도 Docs 생성

### 안정성
- [ ] 실패 Job 재실행
- [ ] 중간 결과 보존
- [ ] Codex Usage Limit 처리
- [ ] Codex Auth 오류 처리

### 품질
- [ ] Evidence Coverage QA
- [ ] Source Reliability QA
- [ ] Numeric Claim QA
- [ ] Analysis Direction QA
- [ ] Revision Compliance QA
- [ ] User Edit Preservation QA

---

# 99. 핵심 개발 우선순위

## Phase 1 — Report Core
```text
Report DB
↓
Report Wizard
↓
Analysis Direction
↓
Analysis Plan
```

## Phase 2 — AI Engine
```text
ReportJob
↓
Mac mini Worker
↓
Codex CLI
↓
Workspace
↓
Evidence Extraction
```

## Phase 3 — Research Engine
```text
Research Plan
↓
External Research
↓
ResearchSource
↓
Evidence Link
```

## Phase 4 — Draft Engine
```text
Outline
↓
Structured Report JSON
↓
ReportSection
↓
ReportBlock
↓
Image Placement
```

## Phase 5 — Report Editor
```text
Report Viewer
↓
Direct Editing
↓
Auto Save
↓
User Edit Protection
```

## Phase 6 — AI Revision
```text
Revision Request
↓
Revision Intent
↓
Selective Research
↓
Revision Preview
↓
Diff
↓
Apply
↓
New Version
```

## Phase 7 — Export
```text
PDF Renderer
↓
Google Docs Renderer
↓
Google Drive
↓
ReportExport
```

## Phase 8 — Final QA
```text
Evidence QA
↓
Citation QA
↓
Consistency QA
↓
Finalization
```

---

# 100. 최종 시스템 정의

Gatherly Reports는 단순한 AI 텍스트 생성 기능이 아니다.

시스템은 다음 순환 구조를 갖는다.

```text
CAPTURE
현장 자료 수집
        ↓
DIRECTION
사용자의 분석 목적
        ↓
EVIDENCE
현장 자료 구조화
        ↓
RESEARCH
외부 신뢰 자료 조사
        ↓
ANALYSIS
Evidence 기반 해석
        ↓
DRAFT
AI 전문 보고서 초안
        ↓
REVIEW
사용자 검토
        ↓
REVISION
AI와 반복 수정
        ↓
DIRECT EDIT
사용자 직접 수정
        ↓
EXPORT
Google Docs / PDF
        ↓
FINAL
최종 의사결정 자료
```

Gatherly AI의 역할은 사용자를 대신해 임의의 보고서를 작성하는 것이 아니라,

**사용자가 실제로 수집한 현장 Evidence를 출발점으로 사용자의 분석 목적에 맞는 추가 조사를 수행하고, 근거가 추적 가능한 보고서 초안을 작성하며, 이후 사용자의 피드백과 직접 편집을 통해 최종 문서를 함께 완성하는 Research Partner**

로 정의한다.
