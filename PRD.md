# Gatherly Product Requirements Document

## 1. 문서 정보

- 제품명: Gatherly
- 문서 버전: 2.0
- 기준일: 2026-09-10
- 제품 정의: Field Research OS
- 기본 운영 환경: iPhone PWA + Mac mini 로컬 서버 + Tailscale
- 데이터 저장: Prisma + SQLite + 로컬 파일 저장소
- 외부 연구 엔진: NotebookLM(구독형 사용자 서비스)
- 외부 문서 허브: Google Drive / Google Docs

## 2. 제품 비전

Gatherly는 출장, 전시회, 시장조사, 경쟁사 조사 등 현장에서 발생하는 사진·영상·음성·텍스트 정보를 빠르고 안전하게 수집하고, 이를 신뢰 가능한 Research Evidence로 구조화하여 NotebookLM 기반 심층 연구·분석으로 연결하고, 결과를 다시 Gatherly에서 검토·수정·버전 관리하는 Field Research OS다.

Gatherly는 자체 범용 Deep Research 엔진을 구현하지 않는다. 대신 현장 자료의 맥락 보존, Evidence 관리, NotebookLM 입력 품질 최적화, 연구 결과의 프로젝트·보고서 수명주기 관리에 집중한다.

## 3. 핵심 역할 분담

### 3.1 Gatherly

- 현장 프로젝트 관리
- 사진·영상·음성·텍스트·링크·문서 수집
- 원본 자료와 조사 맥락 보존
- Research Inbox 정리·분류·검토
- NotebookLM용 Source Bundle 생성
- Google Drive 동기화
- Analysis Brief 작성 및 버전 관리
- NotebookLM 연결 화면 제공
- NotebookLM 결과 문서 가져오기
- 보고서 수정·버전 비교·최종본 관리
- Evidence Lineage 추적

### 3.2 NotebookLM

- Source 기반 질의응답
- 심층 연구 및 분석
- 추가 외부 조사
- 비교·종합·인사이트 도출
- 분석 초안 및 보고서 초안 생성

### 3.3 Mac mini

- Gatherly 웹 앱 운영
- 파일 저장 및 변환
- Source 문서 생성·정제
- Google Drive 동기화 작업
- 문서 후처리
- 상태 봇 및 운영 자동화

Mac mini/Codex는 Gatherly의 핵심 Research Engine 역할을 맡지 않는다.

## 4. 핵심 사용자 흐름

1. 사용자가 조사 프로젝트를 생성한다.
2. 현장에서 사진·영상·음성·텍스트·링크·문서를 빠르게 저장한다.
3. 자료는 Research Inbox에 누적된다.
4. 사용자가 자료를 검토·수정·삭제·태깅·제외한다.
5. Gatherly가 NotebookLM 분석에 적합한 Source Bundle을 생성한다.
6. Source Bundle을 프로젝트 전용 Google Drive 폴더에 동기화한다.
7. 사용자가 분석 목적과 주요 질문을 Analysis Brief로 작성한다.
8. Gatherly에서 NotebookLM을 열어 해당 프로젝트 Notebook에서 분석을 수행한다.
9. NotebookLM 결과를 Google Docs로 내보낸다.
10. Gatherly가 결과 문서를 Research Result로 가져온다.
11. 사용자가 결과를 검토하고 문장 수정 또는 추가 연구 요청을 남긴다.
12. 수정 유형에 따라 Google Docs 편집 또는 새로운 Analysis Brief Revision으로 재연구한다.
13. 최종 Report Version을 확정하고 Google Docs/PDF로 활용한다.

## 5. 주요 기능

### 5.1 Field Project

- 현장명, 설명, 장소, 날짜, 상태 관리
- 상태: ACTIVE, COMPLETED, ARCHIVED
- soft delete
- 프로젝트별 자료 수, 정리 진행률, NotebookLM 준비 상태, 보고서 상태 표시

### 5.2 Field Capture

지원 입력:

- 사진
- 영상
- 음성
- 텍스트
- 웹 링크
- 문서

모든 자료는 다음 Context를 유지한다.

- project_id
- captured_at
- location
- asset_type
- title
- memo
- tags
- original_file
- upload_status
- source_hash
- revision history

네트워크 불안정 시 브라우저 로컬 큐에 임시 보관하고 연결 복구 후 재전송한다.

### 5.3 Research Inbox

자료 상태:

- COLLECTED
- REVIEWED
- CURATED
- EXCLUDED
- SYNC_READY
- SYNCED

지원 작업:

- 조회
- 수정
- 삭제
- 태그
- 중요 표시
- 제외
- 프로젝트 이동
- Source Bundle 포함/제외

### 5.4 Research Source Builder

원본 자료를 NotebookLM이 이해하기 좋은 구조로 재구성한다.

기본 Source 문서:

- project_overview.md
- field_notes.md
- interview_transcripts.md
- photo_evidence.md
- document_index.md
- research_questions.md
- source_manifest.md

Source 문서 내 각 항목은 가능한 경우 원본 ResearchAsset ID를 포함한다.

### 5.5 Google Drive Sync

프로젝트별 기본 폴더 구조:

```text
Gatherly/
└── Projects/
    └── {project-name}/
        ├── 01_Source/
        ├── 02_Analysis_Brief/
        ├── 03_NotebookLM_Result/
        └── 04_Final_Report/
```

기능:

- Source 파일 생성/업데이트
- 중복 동기화 방지
- 마지막 동기화 시간 표시
- 변경 감지
- 동기화 실패 상태 및 재시도

### 5.6 Analysis Brief

분석 실행 전 사용자가 반드시 분석 방향을 정의한다.

필수 또는 권장 항목:

- 분석 제목
- 분석 목적
- 주요 연구 질문
- 의사결정 목적
- 중요 평가 기준
- 분석 대상 범위
- 제외 범위
- 원하는 결과물 형태
- 추가 지시사항

같은 Source Bundle도 Analysis Brief에 따라 서로 다른 연구 결과를 만들 수 있어야 한다.

### 5.7 NotebookLM Handoff

MVP에서는 비공식 API, 로그인 자동화, 브라우저 조작을 핵심 기능으로 사용하지 않는다.

Gatherly에서 제공:

- NotebookLM 자료 준비
- Source 동기화
- Analysis Brief 생성
- NotebookLM 연결 상태
- 마지막 동기화 시간
- NotebookLM 열기 버튼

사용자는 구독형 NotebookLM 서비스 내에서 연구·분석을 수행한다.

### 5.8 Research Result Import

NotebookLM 분석 결과의 기본 교환 포맷은 Google Docs다.

지원 방식:

- 사용자가 Google Docs 문서를 직접 선택해 가져오기
- 프로젝트 Result Folder의 새 결과 문서를 감지해 가져오기

저장 정보:

- result title
- analysis brief
- source bundle
- notebook reference
- google_doc_id
- imported_at
- version
- status

### 5.9 Report Workspace

- 결과 Preview
- Google Docs 열기
- 직접 텍스트 수정
- 수정 요청 작성
- 버전 생성
- 이전 버전 비교
- 최종본 지정
- PDF 출력

### 5.10 Revision Workflow

수정 유형:

- TEXT_EDIT
- STRUCTURE_CHANGE
- RESEARCH_EXPANSION
- NEW_RESEARCH_QUESTION
- EVIDENCE_ADDITION
- SOURCE_UPDATE

TEXT_EDIT, STRUCTURE_CHANGE는 보고서 편집 단계에서 처리할 수 있다.

RESEARCH_EXPANSION, NEW_RESEARCH_QUESTION, EVIDENCE_ADDITION, SOURCE_UPDATE는 새로운 Analysis Brief Revision을 생성해 NotebookLM 연구 단계로 되돌린다.

### 5.11 Evidence Lineage

다음 관계를 추적할 수 있어야 한다.

```text
Original Evidence
→ Source Document
→ Source Bundle
→ Analysis Brief
→ NotebookLM Research
→ Research Result
→ Report Version
```

최종 보고서의 근거가 어느 현장 자료에서 출발했는지 추적할 수 있도록 한다.

### 5.12 Research Pipeline 화면

프로젝트별 진행 상태를 한 화면에서 보여준다.

```text
① 자료수집
↓
② 자료정리
↓
③ NotebookLM 준비
↓
④ 분석방향
↓
⑤ NotebookLM 연구
↓
⑥ 결과검토
↓
⑦ 수정/보강
↓
⑧ 최종보고서
```

각 단계는 완료율, 건수, 최근 변경 시각, 다음 행동을 표시한다.

## 6. 기존 기능 유지

다음 1차 개발 기능은 유지한다.

- FieldDay CRUD
- 자료 업로드
- 이미지·영상·음성·텍스트 저장
- IndexedDB 기반 업로드 대기 보존
- 업로드 실패 재시도
- 파일 원본 저장
- Prisma + SQLite
- PWA
- Tailscale 내부 접근
- Telegram 상태 봇
- 앱 health 점검
- 제한된 launchd 앱 복구

## 7. MVP에서 제외하는 기능

- 자체 Deep Research 엔진
- 자체 웹 검색·랭킹 엔진
- 자체 Citation Research 엔진
- 자체 대규모 문서 Q&A Workspace
- Codex 기반 자동 보고서 Research Engine
- NotebookLM 비공식 API
- NotebookLM 로그인 자동화
- NotebookLM UI Browser Automation

향후 공식 NotebookLM 연동 수단이 안정적으로 제공되면 Integration Layer 교체가 가능하도록 추상화한다.

## 8. 비기능 요구사항

### 8.1 데이터 안전

- 원본 자료는 AI/동기화 실패와 무관하게 보존한다.
- 파일과 DB 메타데이터의 일관성을 유지한다.
- 업로드 중 네트워크가 끊겨도 가능한 한 복구할 수 있어야 한다.
- Source 생성/동기화 과정이 원본을 수정하거나 삭제하지 않는다.

### 8.2 신뢰성

- Drive Sync 실패는 프로젝트 자료 수집을 차단하지 않는다.
- NotebookLM 장애 또는 미접속 상태에서도 Capture/Inbox 기능은 사용 가능해야 한다.
- 동기화는 idempotent하게 설계한다.

### 8.3 보안

- Google 인증 정보, Telegram token, 기타 secret은 저장소에 커밋하지 않는다.
- NotebookLM 사용자 로그인 세션을 Gatherly가 보관하지 않는다.
- 외부 서비스 연결 실패 시 내부 stack과 secret을 UI에 노출하지 않는다.

### 8.4 모바일 우선

- iPhone에서 한 손으로 빠르게 자료를 추가할 수 있어야 한다.
- 자료 저장 완료 여부가 명확히 보여야 한다.
- 여러 장 사진 업로드가 개별 파일 단위로 안정적으로 저장되어야 한다.

## 9. 성공 기준

- 현장에서 사진·영상·음성·텍스트를 안정적으로 수집할 수 있다.
- 모든 자료가 프로젝트와 연결된다.
- 사용자가 Research Inbox에서 분석 대상 자료를 선별할 수 있다.
- 선택한 자료에서 NotebookLM Source Bundle을 생성할 수 있다.
- Google Drive 프로젝트 폴더에 Source와 Analysis Brief를 동기화할 수 있다.
- 사용자가 Gatherly에서 NotebookLM 연구 단계로 자연스럽게 이동할 수 있다.
- NotebookLM 결과 Google Docs를 Gatherly로 가져올 수 있다.
- 결과를 수정·버전 관리하고 최종본을 지정할 수 있다.
- 최종 결과에서 주요 Evidence의 출처를 역추적할 수 있다.

## 10. 제품 포지셔닝

Gatherly는 NotebookLM의 대체재가 아니다.

Gatherly는 현장 조사 전 과정을 운영하고 NotebookLM을 고품질 Research Engine으로 활용하는 Field Research OS다.

제품의 핵심 차별점은 다음 조합이다.

**Field Capture + Evidence Management + Context Preservation + NotebookLM Research Orchestration + Report Lifecycle Management**
