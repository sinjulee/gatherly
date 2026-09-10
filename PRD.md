# Gatherly Product Requirements Document

## 1. 문서 정보

- 제품명: Gatherly
- 문서 버전: 2.1
- 기준일: 2026-09-10
- 제품 정의: Field Research OS
- 기본 운영 환경: iPhone PWA + Mac mini 로컬 서버 + Tailscale
- 데이터 저장: Prisma + SQLite + 로컬 파일 저장소
- 현장 Quick Analysis 엔진: Mac mini + Codex CLI (ChatGPT/Codex 계정 인증)
- 심층 연구 확장 엔진: NotebookLM / Gemini Notebook
- 외부 문서 허브: Google Drive / Google Docs

## 2. 제품 비전

Gatherly는 출장, 전시회, 시장조사, 경쟁사 조사 등 현장에서 발생하는 사진·영상·음성·텍스트 정보를 빠르고 안전하게 수집하고, 현장에서 즉시 분석하여 다음 조사 행동과 의사결정을 지원하며, 필요 시 NotebookLM 기반 심층 연구로 확장하고 결과를 다시 Gatherly에서 검토·수정·버전 관리하는 Field Research OS다.

핵심 원칙은 **현장 신속성과 장기 연구 확장성을 분리**하는 것이다.

- 현장에서 답이 바로 필요할 때는 Mac mini의 Codex CLI가 현재 프로젝트 Evidence와 Analysis Brief를 읽어 Quick Report를 생성한다.
- 더 넓은 자료 종합, 장기 지식 축적, 심층 비교·추가 연구가 필요할 때는 Source Bundle과 Analysis Brief를 Google Drive/Docs로 동기화하여 NotebookLM/Gemini Notebook으로 확장한다.
- NotebookLM은 Gatherly의 필수 선행 단계가 아니라 선택 가능한 Deep Research 모듈이다.

Gatherly 자체가 범용 검색 엔진을 구현하지는 않는다. 대신 Evidence 수집·맥락 보존·분석 오케스트레이션·보고서 수명주기 관리에 집중한다.

## 3. 핵심 역할 분담

### 3.1 Gatherly

- 현장 프로젝트 관리
- 사진·영상·음성·텍스트·링크·문서 수집
- 원본 자료와 조사 맥락 보존
- Research Inbox 정리·분류·검토
- Analysis Brief 작성 및 버전 관리
- Quick Analysis 요청/상태/결과 UI
- NotebookLM용 Source Bundle 생성
- Google Drive/Docs 동기화
- NotebookLM 연결 화면 제공
- NotebookLM 결과 문서 가져오기
- 보고서 수정·버전 비교·최종본 관리
- Evidence Lineage 추적

### 3.2 Mac mini + Codex CLI — Quick Analysis

현장 즉시 분석을 담당한다.

- iPhone에서 생성된 Quick Analysis Job을 감지한다.
- 현재 프로젝트의 저장된 Evidence와 최신 Analysis Brief를 읽는다.
- 텍스트 Evidence와 제한된 수의 현장 이미지를 Codex에 입력한다.
- 사용자의 현장 질문에 직접 답하는 고밀도 Quick Report를 생성한다.
- 결과를 Gatherly DB/로컬 저장소에 기록한다.
- 사용자는 iPhone Gatherly 화면에서 결과를 자동 갱신해 확인한다.

Quick Analysis는 속도와 현장 의사결정이 우선이며, 최종 Deep Report를 대체할 필요는 없다.

### 3.3 NotebookLM / Gemini Notebook — Deep Research

선택형 심층 연구 모듈이다.

- Source 기반 질의응답
- 다수 문서 비교·종합
- 추가 외부 조사
- 장기 프로젝트 지식 축적
- 인사이트 및 심층 보고서 초안 생성

NotebookLM이 사용 불가능하더라도 Gatherly의 Capture와 Quick Analysis는 정상 작동해야 한다.

### 3.4 Google Drive / Google Docs

- Source Bundle 전달 허브
- Analysis Brief 문서화
- NotebookLM 결과 교환
- 최종 보고서 편집/공유/PDF 출력

## 4. 핵심 사용자 흐름

### 4.1 현장 Quick Flow — 최우선

1. 사용자가 조사 프로젝트를 생성한다.
2. iPhone에서 사진·영상·음성·텍스트를 수집한다.
3. 자료가 Mac mini에 저장되고 Research Inbox에 누적된다.
4. 사용자가 필요하면 Analysis Brief를 작성하거나 바로 Quick Analysis 질문을 입력한다.
5. `빠른 분석 요청`을 누른다.
6. Mac mini Quick Analysis Worker가 Job을 가져간다.
7. Codex CLI가 현재 Evidence와 최신 Brief를 기반으로 Quick Report를 생성한다.
8. iPhone 화면에서 대기 → 분석 중 → 완료 상태가 자동 갱신된다.
9. 사용자는 결과를 보고 현장에서 추가 촬영·질문·조사 또는 의사결정을 수행한다.
10. 새 Evidence가 추가되면 다시 Quick Analysis를 실행할 수 있다.

### 4.2 Deep Research Flow — 선택 확장

1. 사용자가 Research Inbox에서 심층 연구에 사용할 Evidence를 선별한다.
2. Gatherly가 Source Bundle을 생성한다.
3. Source Bundle을 Google Drive `01_Source`에 동기화한다.
4. Analysis Brief를 Google Docs `02_Analysis_Brief`에 생성/동기화한다.
5. 프로젝트 NotebookLM/Notebook 연결 상태를 확인한다.
6. 데스크톱에서는 NotebookLM을 열어 심층 분석을 수행한다.
7. 모바일에서는 NotebookLM/Gemini Notebook이 지원하는 범위에서 연결 Notebook을 참고·질의할 수 있는 경로를 열어둔다.
8. 공식적이고 안정적인 NotebookLM 자동 실행 인터페이스가 제공될 경우, Mac mini가 Deep Research Job을 전달하는 Integration Layer를 추가할 수 있다.
9. NotebookLM 결과는 Google Docs `03_NotebookLM_Result`를 통해 Gatherly로 가져온다.
10. Research Result → Revision → Report Version → Final Report로 이어진다.

## 5. 주요 기능

### 5.1 Field Project

- 현장명, 설명, 장소, 날짜, 상태 관리
- 상태: ACTIVE, COMPLETED, ARCHIVED
- soft delete
- 프로젝트별 자료 수, Quick Analysis 상태, NotebookLM 준비 상태, 보고서 상태 표시

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

### 5.4 Quick Analysis

사용자는 Source Bundle이나 NotebookLM 준비가 끝나지 않아도 현재까지 저장된 Evidence를 대상으로 빠른 분석을 요청할 수 있다.

기본 UX:

```text
현장 선택
→ 질문/분석 요청 입력
→ 빠른 분석 요청
→ Mac mini 대기열
→ Codex 분석 중
→ Quick Report 자동 표시
```

기본 Quick Report 섹션:

- 한눈에 보는 결론
- 핵심 발견
- 현장 근거
- 판단 및 시사점
- 추가 확인 필요
- 다음 액션

요구사항:

- 최신 Analysis Brief가 있으면 자동으로 분석 맥락에 포함한다.
- 텍스트 Evidence를 우선 사용한다.
- 이미지 입력이 가능한 Codex 실행에서는 중요/최근 이미지를 제한된 개수로 첨부한다.
- 영상·음성은 전사/추출 모듈이 준비되기 전까지 존재 사실을 표시하고 추가 처리 필요를 명시한다.
- 근거가 부족한 내용을 사실처럼 생성하지 않는다.
- 가능한 경우 Evidence ID를 결과에 연결한다.
- 외부 검색 기능 사용 가능 여부에 따라 보완 조사를 수행하거나 `추가 확인 필요`로 명확히 구분한다.

### 5.5 Analysis Brief

사용자는 분석 목적을 구조화할 수 있다.

- 분석 제목
- 분석 목적
- 주요 연구 질문
- 의사결정 목적
- 중요 평가 기준
- 분석 대상 범위
- 제외 범위
- 원하는 결과물 형태
- 추가 지시사항

같은 Evidence도 Analysis Brief에 따라 서로 다른 Quick Report 및 Deep Research 결과를 만들 수 있어야 한다.

### 5.6 Research Source Builder

심층 연구용으로 CURATED Evidence를 NotebookLM이 이해하기 좋은 구조로 재구성한다.

기본 Source 문서:

- project_overview.md
- field_notes.md
- interview_transcripts.md
- photo_evidence.md
- document_index.md
- research_questions.md
- source_manifest.md

Source 문서 내 각 항목은 가능한 경우 원본 ResearchAsset ID를 포함한다.

### 5.7 Google Drive Sync

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
- Analysis Brief Google Docs 자동 생성
- 중복 동기화 방지
- 마지막 동기화 시간 표시
- 변경 감지
- 동기화 실패 상태 및 재시도

### 5.8 NotebookLM Handoff

NotebookLM은 선택형 심층 연구 채널이다.

MVP에서 제공:

- NotebookLM 자료 준비
- Source 동기화
- Analysis Brief 생성/Docs 동기화
- NotebookLM 연결 상태
- NotebookLM 열기
- 모바일에서는 `심층 연구 준비 완료`와 참고용 Notebook 열기 제공
- 데스크톱에서는 분석 지시 복사 + NotebookLM 열기 제공

MVP 핵심 기능으로 비공식 API, 자동 로그인, 불안정한 브라우저 UI 자동화를 사용하지 않는다.

향후 공식 NotebookLM API/Agent/Integration 인터페이스가 안정적으로 제공되면 다음 흐름을 추가한다.

```text
iPhone Gatherly
→ Deep Research 요청
→ Mac mini Integration Worker
→ NotebookLM 공식 인터페이스
→ 결과 감지
→ Gatherly ResearchResult
```

### 5.9 Research Result Import

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

### 5.10 Report Workspace

- Quick Report 조회
- Deep Research 결과 Preview
- Google Docs 열기
- 직접 텍스트 수정
- 수정 요청 작성
- 버전 생성
- 이전 버전 비교
- 최종본 지정
- PDF 출력

### 5.11 Revision Workflow

수정 유형:

- TEXT_EDIT
- STRUCTURE_CHANGE
- RESEARCH_EXPANSION
- NEW_RESEARCH_QUESTION
- EVIDENCE_ADDITION
- SOURCE_UPDATE

간단한 현장 추가 질문은 Quick Analysis로 재실행할 수 있다.

심층 보강이 필요한 RESEARCH_EXPANSION, NEW_RESEARCH_QUESTION, EVIDENCE_ADDITION, SOURCE_UPDATE는 새로운 Analysis Brief Revision 또는 Deep Research로 연결한다.

### 5.12 Evidence Lineage

Quick 경로:

```text
Original Evidence
→ Analysis Brief(optional)
→ Quick Analysis Job
→ Quick Report
```

Deep 경로:

```text
Original Evidence
→ Source Document
→ Source Bundle
→ Analysis Brief
→ NotebookLM Research
→ Research Result
→ Report Version
```

최종 결과의 근거가 어느 현장 자료에서 출발했는지 추적할 수 있도록 한다.

### 5.13 Research Pipeline 화면

모바일에서 가장 먼저 Quick Analysis를 제공하고, 아래에 Deep Research 준비 흐름을 둔다.

```text
[Quick]
자료수집 → 즉시 질문 → Codex Quick Report → 다음 현장 행동

[Deep]
자료정리 → Source Bundle → Analysis Brief → NotebookLM/Gemini → 결과검토 → 최종보고서
```

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

- 자체 범용 웹 검색/랭킹 엔진
- 자체 대규모 문서 Q&A Workspace
- NotebookLM 비공식 API
- NotebookLM 로그인 자동화
- NotebookLM DOM/UI에 강하게 의존하는 핵심 자동화
- Codex가 임의로 원본 Evidence를 수정/삭제하는 기능

Codex Quick Analysis는 **read-only 분석 작업**으로 제한한다. 최종 심층 연구와 장기 Source 기반 연구는 NotebookLM/Gemini 확장 경로를 유지한다.

## 8. 비기능 요구사항

### 8.1 데이터 안전

- 원본 자료는 AI/동기화 실패와 무관하게 보존한다.
- Quick Analysis는 원본 파일에 쓰기 권한을 요구하지 않는다.
- 파일과 DB 메타데이터의 일관성을 유지한다.
- 업로드 중 네트워크가 끊겨도 가능한 한 복구할 수 있어야 한다.
- Source 생성/동기화 과정이 원본을 수정하거나 삭제하지 않는다.

### 8.2 신뢰성

- Quick Analysis worker 장애는 Capture를 차단하지 않는다.
- worker online/offline 상태를 UI에서 확인할 수 있어야 한다.
- Quick Analysis Job은 QUEUED/RUNNING/COMPLETED/FAILED 상태를 가진다.
- Drive Sync 실패는 프로젝트 자료 수집과 Quick Analysis를 차단하지 않는다.
- NotebookLM 장애 또는 미접속 상태에서도 Capture/Inbox/Quick Analysis는 사용 가능해야 한다.

### 8.3 보안

- Google 인증 정보, Telegram token, 기타 secret은 저장소에 커밋하지 않는다.
- Codex CLI의 사용자 인증 파일을 Gatherly DB나 Git에 복사하지 않는다.
- Codex는 Mac mini에 이미 저장된 CLI 인증을 재사용한다.
- Quick Analysis는 read-only sandbox를 기본값으로 사용한다.
- 사용자 입력을 shell command 문자열로 조립해 실행하지 않고 `codex exec`의 stdin prompt로 전달한다.
- NotebookLM 사용자 로그인 세션을 Gatherly가 보관하지 않는다.
- 외부 서비스 연결 실패 시 내부 secret을 UI에 노출하지 않는다.

### 8.4 모바일 우선

- iPhone에서 한 손으로 빠르게 자료를 추가할 수 있어야 한다.
- iPhone에서 Mac mini 화면을 직접 조작하지 않고 Quick Analysis를 요청할 수 있어야 한다.
- 분석 상태와 결과가 동일 화면에서 자동 갱신되어야 한다.
- 자료 저장 완료 여부가 명확히 보여야 한다.
- 여러 장 사진 업로드가 개별 파일 단위로 안정적으로 저장되어야 한다.

### 8.5 성능 목표

- Quick Analysis Job 등록 응답: 목표 2초 이내
- worker 대기열 감지: 기본 2초 내
- 일반적인 현장 Quick Report: 목표 1~3분 내, 최대 실행 제한 기본 6분
- 모바일 결과 상태 갱신: 약 3초 간격

## 9. 성공 기준

- 현장에서 사진·영상·음성·텍스트를 안정적으로 수집할 수 있다.
- 모든 자료가 프로젝트와 연결된다.
- iPhone에서 질문을 입력하고 Mac mini를 직접 만지지 않은 채 Quick Analysis를 실행할 수 있다.
- Quick Report 결과를 iPhone에서 즉시 확인하고 다음 조사 행동에 활용할 수 있다.
- NotebookLM 없이도 현장 핵심 흐름이 완료된다.
- 사용자가 Research Inbox에서 심층 분석 대상 자료를 선별할 수 있다.
- 선택한 자료에서 NotebookLM Source Bundle을 생성할 수 있다.
- Google Drive 프로젝트 폴더에 Source와 Analysis Brief를 동기화할 수 있다.
- 필요 시 NotebookLM/Gemini Notebook으로 심층 연구를 확장할 수 있다.
- NotebookLM 결과 Google Docs를 Gatherly로 가져올 수 있다.
- 결과를 수정·버전 관리하고 최종본을 지정할 수 있다.
- 최종 결과에서 주요 Evidence의 출처를 역추적할 수 있다.

## 10. 제품 포지셔닝

Gatherly는 Codex나 NotebookLM 자체의 대체재가 아니다.

Gatherly는 **현장에서 AI를 즉시 호출하는 리서치 운영 레이어**이면서, 동일 Evidence를 장기 Deep Research로 확장할 수 있는 Field Research OS다.

제품의 핵심 차별점은 다음 조합이다.

**Mobile Field Capture + Evidence Management + Mac mini Quick Analysis + Analysis Brief + NotebookLM/Gemini Deep Research + Report Lifecycle Management**
