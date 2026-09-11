# Gatherly Product Requirements Document

## 1. 문서 정보

- 제품명: Gatherly
- 문서 유형: Product Requirements Document / As-Built Baseline
- 문서 버전: 3.0
- 기준일: 2026-09-12
- 개발 상태: **1차 개발 완료 기준**
- 구현 기준 브랜치: `feature/notebooklm-research-pipeline-v2`
- 문서 갱신 직전 구현 기준 커밋: `c7ddb4452bf9bd861be6ea82323c65243f16a7d5`
- 제품 정의: Field Research OS
- 기본 사용 환경: iPhone Safari/PWA + Mac mini 로컬 서버 + Tailscale
- 웹 애플리케이션: Next.js 16 App Router + React 19 + TypeScript + Tailwind CSS
- 데이터 저장: Prisma 6.19 + SQLite + Mac mini 로컬 파일 저장소
- 현장 AI 분석: Mac mini + Codex CLI
- 최종 보고서 생성: Mac mini + Codex CLI
- 심층 연구 확장: Google Drive/Docs + NotebookLM 수동 Handoff
- 운영 보조: Health API, Gatherly Doctor, Telegram 상태 봇

이 문서는 향후 희망 기능이 아니라 **현재 저장소에 구현되어 있는 1차 개발 결과를 기준으로 작성한다.** 구현되지 않은 항목은 별도의 `현재 미구현/제한` 절에 명시한다.

---

## 2. 제품 정의와 목표

Gatherly는 출장, 전시회, 시장조사, 경쟁사 조사 등 외부 현장에서 발생하는 사진·영상·음성·텍스트 자료를 iPhone으로 수집하고, Mac mini에 안전하게 저장한 뒤, 동일한 자료를 즉시 분석하거나 심층 연구용으로 구조화하고, 최종 보고서까지 생성·수정·보관하는 개인용 Field Research OS다.

1차 개발의 핵심 목표는 다음 네 단계가 하나의 모바일 중심 흐름으로 실제 연결되는 것이다.

```text
현장 생성
→ 자료 수집
→ 정리·분석
→ 최종 보고서
```

AI 분석은 API 사용을 전제로 하지 않고 Mac mini에 로그인된 Codex CLI를 비대화형 Worker 방식으로 사용한다. NotebookLM은 현장 즉시 분석의 필수 단계가 아니며, 사용자가 필요할 때 Source Bundle과 Analysis Brief를 Google Drive/Docs로 전달한 뒤 수동으로 이어가는 심층 연구 확장 경로다.

---

## 3. 1차 개발 완료 범위 요약

현재 구현된 핵심 범위는 다음과 같다.

- 현장 프로젝트 생성·수정·상태 관리·soft delete
- 홈 화면 현장별 통계 필터
- 사진 촬영, 사진 다중 선택, 영상, 음성, 텍스트 수집
- IndexedDB 기반 업로드 임시 보관 및 실패 재시도
- 개별 파일 단위 저장 확인, SHA-256, 원본 파일 보관
- 저장 자료 목록 조회·필터·미리보기·수정·soft delete
- 정리·분석함 상단의 공통 현장 선택
- Evidence 중요 표시, 연구선정, 제외
- Source Bundle 생성·버전 관리
- NotebookLM용 5종 Source Markdown 생성
- Source 문서 Google Drive/Docs 동기화
- Analysis Brief 생성·버전 관리·Google Docs 자동 동기화
- 프로젝트별 NotebookLM URL 저장 및 Handoff
- iPhone에서 Quick Analysis 요청
- Mac mini Codex CLI Quick Analysis Worker
- Quick Report 자동 갱신 및 이력 표시
- Mac mini Codex CLI Final Report Worker
- 최종 보고서 초안 생성, 직접 수정, AI 수정본 새 버전 생성
- 최종 보고서 Google Docs 출력
- PWA Shell, 모바일 하단 네비게이션, Tailscale 내부 접근
- Health API, Doctor, Telegram 상태 확인/제한적 복구 UI

---

## 4. 사용자 정보 구조

### 4.1 모바일 주요 탭

Gatherly는 모바일 하단 네비게이션에 다음 네 개의 주요 탭을 제공한다.

1. `오늘의 현장` `/`
2. `자료수집함` `/inbox`
3. `정리·분석함` `/analysis`
4. `최종 보고서` `/reports`

데스크톱에서는 동일 메뉴를 좌측 사이드바로 제공한다.

### 4.2 모바일 캘린더 UI

모바일 상단에는 접을 수 있는 `현장 캘린더` 요약 UI가 있다. 현재 1차 개발 기준 이 캘린더의 월/날짜/자료 있음 표시/현장명은 **정적 UI 데이터**이며 FieldDay DB와 동적으로 연동되지 않는다.

---

## 5. 핵심 사용자 흐름

### 5.1 현장 생성 및 현황 확인

```text
오늘의 현장
→ 새 현장
→ 이름/장소/날짜/상태/설명 입력
→ ACTIVE / COMPLETED / ARCHIVED 관리
→ 자료 수 확인
```

홈 상단의 `현장별 현황 보기`에서 현장을 한 번 선택하면 다음 항목이 동일 현장 기준으로 갱신된다.

- 저장된 자료
- 저장 대기·실패
- 완성한 보고서
- 최근 저장 자료

기본 선택은 ACTIVE 현장이며, ACTIVE 현장이 없으면 첫 프로젝트를 사용한다. `전체 현장` 선택도 가능하다.

### 5.2 현장 자료 수집

```text
자료수집함
→ 저장할 현장 선택
→ 사진 촬영 / 앨범 다중 선택 / 영상 / 음성 / 텍스트
→ 브라우저 임시 보관
→ Mac mini 업로드
→ 파일별 STORED 확인
→ 자료 목록에서 조회/수정/삭제
```

파일 자료는 각각 독립 Material로 저장되며 여러 장의 사진을 한 번에 선택해도 하나의 파일로 합치지 않는다.

### 5.3 Quick Analysis

```text
정리·분석함 상단에서 현장 선택
→ 현장에서 바로 분석하기
→ 질문 입력 또는 프리셋 선택
→ 빠른 분석 요청
→ QuickAnalysisJob QUEUED
→ Mac mini Codex Worker RUNNING
→ Quick Report COMPLETED
→ iPhone에서 자동 갱신 확인
```

사용자는 NotebookLM 또는 Source Bundle 준비 없이 현재 서버에 저장 완료된 Evidence만으로 바로 분석할 수 있다.

### 5.4 Deep Research 준비 및 NotebookLM Handoff

```text
정리·분석함 상단에서 현장 선택
→ Evidence 검토
→ 연구선정/중요/제외
→ 선택 Evidence로 Source Bundle 생성
→ Source 문서 생성
→ Google Drive 동기화
→ Analysis Brief 생성 및 Google Docs 동기화
→ 프로젝트 NotebookLM URL 연결
→ 분석 지시 복사 + NotebookLM 열기
```

NotebookLM에서 실제 분석을 자동 실행하는 API/브라우저 자동화는 1차 개발에 포함하지 않는다.

### 5.5 Final Report

```text
최종 보고서
→ 현장 선택
→ 보고서 제목/지시 입력
→ Codex로 최종 보고서 생성
→ QUEUED / RUNNING / COMPLETED
→ Gatherly에서 초안 확인
→ 직접 수정 또는 AI 수정 요청
→ AI 수정 시 새 버전 생성
→ Google Docs로 출력
```

Final Report Worker는 해당 현장의 Evidence, 최신 Analysis Brief, 최근 완료 Quick Analysis 결과를 함께 사용한다.

---

## 6. 기능 상세

### 6.1 오늘의 현장

#### 현장 프로젝트 관리

입력 필드:

- 현장 이름
- 장소
- 현장 날짜
- 상태
- 설명

상태:

- `ACTIVE` 진행 중
- `COMPLETED` 완료
- `ARCHIVED` 보관

삭제는 `deletedAt`을 사용하는 soft delete이며 연결된 원본 파일을 즉시 물리 삭제하지 않는다.

#### 현장별 Overview

사용자가 선택한 현장 또는 전체 현장을 기준으로 다음 통계를 클라이언트에서 계산한다.

- `저장된 자료`: `uploadStatus === STORED`
- `저장 대기·실패`: `uploadStatus !== STORED`
- `완성한 보고서`: 현재 UI 계산 기준 `Report.status`가 `COMPLETED` 또는 `DRAFT`
- 최근 저장 자료: 선택 범위의 최신 Material 최대 4개

각 통계 카드에는 현재 적용 중인 현장명이 표시된다.

### 6.2 자료수집함

#### 지원 입력

- 사진 촬영: iPhone 후면 카메라 요청
- 앨범 사진: 다중 선택
- 영상: 다중 선택
- 음성: 다중 선택
- 텍스트 메모

현재 파일 허용 형식과 기본 최대 용량:

- IMAGE: JPEG, PNG, HEIC, HEIF, WebP / 기본 10MB
- VIDEO: MP4, MOV, WebM / 기본 250MB
- AUDIO: M4A/MP4, MP3, WAV, WebM / 기본 100MB

환경변수로 크기 제한을 조정할 수 있다.

#### 업로드 안전성

- 각 파일에 `clientUploadId` 생성
- IndexedDB에 업로드 대기 자료 임시 저장
- 브라우저 Persistent Storage 요청
- 이전 세션의 `UPLOADING` 항목은 재진입 시 `PENDING`으로 복구
- 최대 2개 파일 동시 업로드
- 업로드 중 페이지 이탈 경고
- 서버 저장 완료 후 IndexedDB 큐 제거
- 실패 항목 개별 재시도 및 폐기
- 동일 `clientUploadId`의 STORED 요청은 idempotent 응답

서버는 파일을 임시 `.part`로 기록한 뒤 정상 완료 시 최종 원본 파일명으로 rename하고 SHA-256을 저장한다.

#### 자료 목록

- 현장 필터
- 자료 유형 필터
- 이미지 썸네일
- 영상 재생
- 음성 재생
- 제목/텍스트 내용 수정
- soft delete
- 저장 상태 표시

### 6.3 정리·분석함 공통 현장 선택

정리·분석함은 페이지 상단에 **하나의 공통 현장 선택 UI**를 둔다.

선택한 현장은 아래 세 기능에 동일하게 적용된다.

1. Quick Analysis
2. NotebookLM 연구 준비/Source Pipeline
3. Analysis Brief

각 하위 컴포넌트의 내부 현장 선택 UI는 통합 Shell에서 숨겨 중복 선택을 방지한다.

### 6.4 Quick Analysis

#### 사용자 UI

- 자유형 분석 요청 입력
- 프리셋
  - 핵심 요약
  - 기회·리스크
  - 추가 조사 목록
- Worker 연결 상태 표시
- Codex 버전 표시 가능
- 상태 자동 갱신 약 3초
- 최신 Quick Report 표시
- 이전 Quick Analysis 이력 표시

#### 작업 생성 규칙

- 현장과 instruction 필수
- 동일 현장에 `QUEUED` 또는 `RUNNING` 작업이 있으면 중복 생성하지 않고 기존 작업 재사용
- Analysis Brief ID를 명시하지 않으면 해당 현장의 최신 Brief 자동 연결
- Brief가 없어도 실행 가능

#### Codex 입력

- FieldDay 정보
- 최신/연결 Analysis Brief
- 저장 완료 Material
- 중요 자료 우선, 이후 최근 자료 순
- 텍스트 컨텍스트 기본 최대 50,000자
- 이미지 기본 최대 8장
- VIDEO/AUDIO 원본은 현재 직접 전사·분석하지 않음

#### Quick Report 기본 구조

- 한눈에 보는 결론
- 핵심 발견
- 현장 근거
- 판단 및 시사점
- 추가 확인 필요
- 다음 액션

가능한 경우 결과에 Evidence ID를 표시하도록 Prompt에서 요구한다.

### 6.5 Evidence 검토와 Source Bundle

자료별 Research 상태:

- `COLLECTED`
- `REVIEWED`
- `CURATED`
- `EXCLUDED`
- `SYNC_READY`
- `SYNCED`

현재 UI에서 지원하는 주요 작업:

- 중요 표시/해제
- 연구선정
- 제외
- 체크박스로 Source Bundle 포함 자료 선택

Source Bundle은 현장별 버전 번호를 가지며 선택된 Material과 관계를 저장한다.

### 6.6 NotebookLM Source Builder

Source Bundle을 빌드하면 로컬에 다음 5개 Markdown 문서를 생성한다.

1. `01_project_overview.md`
2. `02_field_notes.md`
3. `03_photo_evidence.md`
4. `04_media_index.md`
5. `05_source_index.md`

추가로 `manifest.json`을 생성한다.

Source 문서에는 가능한 경우 Evidence ID, 수집시각, 중요 여부, 원본 파일명, MIME, SHA-256, 로컬 자산 경로를 기록한다.

현재 Source Builder는 사진/영상/음성 원본 바이너리를 NotebookLM Source로 직접 업로드하지 않고, Source 문서에 Evidence 메타데이터와 설명을 기록한다.

### 6.7 Google Drive Source Sync

Google OAuth refresh token 기반으로 Drive/Docs API를 사용한다.

현재 생성/사용하는 폴더 구조:

```text
Gatherly/
└── Projects/
    └── {project-title} ({fieldDayId 앞 8자})/
        ├── 01_Source/
        │   └── v{bundleVersion}/
        ├── 02_Analysis_Brief/
        └── 04_Final_Report/
```

`GATHERLY_GOOGLE_DRIVE_ROOT_FOLDER_ID`가 있으면 해당 폴더를 루트로 사용하고, 없으면 최상위 `Gatherly` 폴더를 찾거나 생성한다.

Source Markdown은 Drive에서 다음 이름의 Native Google Docs로 생성/갱신한다.

- `01 Project Overview`
- `02 Field Notes`
- `03 Photo Evidence`
- `04 Media Index`
- `05 Source Index`

### 6.8 Analysis Brief

#### 현재 사용자 입력 필드

- 분석 제목
- 분석 방향/목표 — 필수
- 핵심 질문
- 의사결정 맥락
- 평가 기준
- 추가 지시

API/DB 스키마에는 `targetScope`, `excludeScope`, `outputType`도 존재하며 현재 UI에서는 `outputType=REPORT`를 사용한다. `targetScope`와 `excludeScope`는 현재 기본 UI에서 직접 입력하지 않는다.

#### 생성 동작

- 현장별 version 증가
- 최신 `SYNCED` 또는 `BUILT` Source Bundle을 자동 연결할 수 있음
- DB에 `READY`로 생성
- 생성 즉시 Google Docs 동기화 시도
- 성공 시 `SYNCED` 및 `driveFileId` 저장
- Drive 실패 시 Brief 자체는 보존하고 warning 반환
- 별도 `다시 동기화` 제공

### 6.9 NotebookLM Handoff

- 현장별 Notebook URL 저장
- 연결된 Notebook URL 열기
- Source Bundle/Analysis Brief 준비 상태 표시
- 데스크톱에서 분석 지시문 복사 후 NotebookLM 열기
- `start-analysis`는 NotebookLM을 API로 실행하는 기능이 아니라 **Handoff 준비와 상태 표시** 기능

NotebookLM 로그인 정보, 쿠키, 세션은 Gatherly가 저장하지 않는다.

### 6.10 Final Report

#### 보고서 생성 입력

- 현장
- 보고서 제목(비우면 `{현장명} 최종 보고서`)
- 사용자 작성 지시

#### Final Report Worker가 사용하는 컨텍스트

- 현장 정보
- 해당 현장의 최신 Analysis Brief
- 최근 완료 Quick Analysis 최대 5건
- 저장 완료 Evidence
- 기존 보고서 내용(AI 수정 요청일 때)
- 중요/최근 이미지 기본 최대 12장
- Evidence 텍스트 기본 최대 90,000자

#### 기본 보고서 구조

- Executive Summary
- 조사 목적과 범위
- 핵심 발견
- 근거 기반 분석
- 시사점 및 전략 제안
- 리스크와 한계
- 권장 다음 액션
- 권장 이미지
- 근거 및 출처

#### 버전과 수정

- 신규 보고서는 현장의 최신 version 이후 번호 사용
- AI 수정 요청은 선택한 기존 Report를 `parentReportId`로 연결하고 새 Report 레코드 생성
- 기존 보고서 내용을 Prompt에 포함하여 개선본 생성
- 직접 수정은 현재 Report의 `content`를 갱신하며 별도 버전을 만들지 않음
- 생성 상태: `QUEUED` → `RUNNING` → `COMPLETED` 또는 `FAILED`
- UI는 약 3초 간격으로 Report 목록을 다시 조회하여 상태와 결과를 갱신

### 6.11 Google Docs 최종 보고서 출력

완료된 Report를 `04_Final_Report`에 Google Docs로 출력한다.

문서명:

```text
v{version} {report.title}
```

이미 `googleDocId`가 있으면 같은 문서의 텍스트를 갱신하고, 없으면 새 문서를 생성한다.

현재 1차 개발에서는 Markdown 텍스트 전체를 Google Docs 본문에 삽입한다. Codex가 `권장 이미지`를 제안할 수 있으나 Evidence 이미지를 Google Docs 특정 위치에 실제 자동 삽입하는 기능은 아직 없다.

---

## 7. AI Worker 구조

### 7.1 Quick Analysis Worker

- 스크립트: `scripts/gatherly-quick-analysis-worker.mjs`
- 기본 polling: 2초
- 기본 timeout: 6분
- 기본 최대 이미지: 8
- 기본 최대 Evidence 텍스트: 50,000자
- 출력: `storage/quick-analysis/{fieldDayId}/{jobId}.md`
- heartbeat: `storage/runtime/quick-analysis-worker.json`

### 7.2 Final Report Worker

- 스크립트: `scripts/gatherly-final-report-worker.mjs`
- 기본 polling: 2.5초
- 기본 timeout: 12분
- 기본 최대 이미지: 12
- 기본 최대 Evidence 텍스트: 90,000자
- 출력: `storage/final-reports/{fieldDayId}/{reportId}-v{version}.md`
- heartbeat: `storage/runtime/final-report-worker.json`

### 7.3 Codex 실행 원칙

두 Worker 모두 기본적으로 다음 형태를 사용한다.

```text
codex exec
--ephemeral
--sandbox read-only
--ignore-rules
--output-last-message <outputPath>
--image <selected images...>
-
```

- prompt는 shell 문자열이 아니라 stdin으로 전달
- Mac mini에 이미 로그인된 Codex CLI 인증 재사용
- OpenAI API key를 Gatherly 기능의 필수값으로 사용하지 않음
- 원본 Evidence에 쓰기 권한을 부여하지 않음

---

## 8. 데이터 및 저장 정책

### 8.1 SQLite

기본 개발 DB:

```text
prisma/dev.db
```

주요 활성 모델:

- FieldDay
- Material
- Report
- SourceBundle
- SourceBundleItem
- SourceDocument
- AnalysisBrief
- NotebookLink
- SyncJob
- QuickAnalysisJob

스키마에는 향후 Deep Result Lifecycle을 위해 `ResearchResult`, `ReportVersion`, `RevisionRequest` 모델도 존재하지만 **1차 개발 UI/API의 실제 Report 흐름은 `Report` 모델을 사용한다.**

### 8.2 원본 파일

```text
storage/uploads/{fieldDayId}/{materialId}/original.{ext}
```

### 8.3 Research Source

```text
storage/research-sources/{safeProjectName}-{fieldDayId8}/v{version}/
```

### 8.4 삭제 정책

- FieldDay: soft delete
- Material: soft delete
- 사용자 삭제 시 원본 파일을 즉시 물리 삭제하지 않는 방향
- AI Worker는 원본 파일 수정/삭제 금지

---

## 9. 운영 구조

### 9.1 Gatherly Server Launcher

`npm run dev` 또는 `npm run start`는 `scripts/gatherly-server.mjs`를 사용한다.

- 기본 Host: `0.0.0.0`
- 기본 Port: `3001`
- 시작 전 같은 포트 Listener 존재 여부 검사
- 중복 Listener가 있으면 새 서버 시작 차단
- Next.js 서버와 Quick Analysis Worker, Final Report Worker를 함께 시작
- 웹 서버 종료 시 두 Worker도 종료

### 9.2 Doctor

`npm run doctor`는 다음을 확인한다.

- 3001 포트 Listener와 중복 여부
- `/api/health`
- Codex CLI 설치/버전
- Quick Analysis Worker heartbeat
- Final Report Worker heartbeat
- Tailscale Serve 상태
- Tailscale peer 상태

### 9.3 Health API

`/api/health`는 앱, DB, Storage 접근 가능 여부와 응답시간을 반환한다.

### 9.4 Tailscale

Mac mini의 `127.0.0.1:3001`을 Tailscale Serve로 연결해 iPhone에서 tailnet 내부 주소로 접근하는 운영 방식을 사용한다.

### 9.5 Telegram 상태 봇

Gatherly 전용 Telegram Bot은 허용된 단일 사용자 ID를 기준으로 동작한다.

지원 명령:

- `/start`
- `/status`
- `/help`

지원 Callback:

- 대시보드 갱신
- 시스템 상세
- 오류 상세
- 앱 복구 가능 여부 확인
- 복구 확인/취소

자동 복구는 `com.gatherly.app` launchd 서비스가 등록되어 있고 앱 이상이 확인된 경우에만 사용자 확인 후 실행하는 제한적 복구 구조다.

---

## 10. 모바일 UX 요구와 현재 반영 상태

- 4개 주요 탭은 모바일 하단 고정 네비게이션 제공
- 모바일 본문과 상단 캘린더는 동일한 좌우 기준 폭 사용
- 자료수집함 카드/입력/select가 iPhone viewport 밖으로 밀리지 않도록 `min-width:0`, `max-width:100%`, 모바일 1열 배치 적용
- 정리·분석함은 공통 현장 선택 1개 사용
- Analysis Brief 입력 영역은 모바일 전체 폭 내에 배치
- 홈 Overview는 공통 현장 필터 1개 사용
- Quick Report/Final Report는 긴 Markdown을 내부 스크롤 영역에서 읽을 수 있음
- 버튼은 모바일 터치 영역을 고려해 기본 44px 이상 높이를 사용

---

## 11. 보안 및 데이터 안전 원칙

- `.env` 실제 값 Git 커밋 금지
- Google OAuth client secret/refresh token Git 커밋 금지
- Telegram Bot token Git 커밋 금지
- Codex 인증 파일/내용 DB·Git 복사 금지
- NotebookLM 로그인 세션/쿠키 수집 금지
- 저장 경로 traversal 방지
- 업로드 확장자/MIME/크기 검증
- SHA-256 계산
- AI Worker read-only sandbox
- 사용자 AI instruction은 stdin 전달
- Worker 오류가 원본 Evidence를 변경하지 않아야 함
- Drive/NotebookLM 오류가 Capture 기능을 차단하지 않아야 함

---

## 12. 1차 개발 현재 미구현/제한 사항

다음 항목은 현재 코드 기준으로 구현 완료로 간주하지 않는다.

- 모바일 캘린더의 FieldDay/Material DB 실시간 연동
- 장소 문자열의 지도/지오코딩 자동 연결
- 음성 자동 전사
- 영상 자동 프레임 추출/전사
- NotebookLM 공식 API 기반 자동 분석 실행
- NotebookLM 브라우저 자동 로그인/DOM 자동 조작
- NotebookLM 결과 Google Docs의 자동 Import
- `03_NotebookLM_Result` 폴더의 실제 자동 생성/감지/가져오기 흐름
- `ResearchResult`/`ReportVersion`/`RevisionRequest` 모델을 사용하는 활성 UI/API
- 최종 보고서 Evidence 이미지의 Google Docs 자동 삽입 및 위치 지정
- Google Docs 고급 스타일 자동 서식
- 최종 PDF 자동 Export 버튼
- Report 간 시각적 diff/비교 UI
- Final 확정 상태를 별도로 지정하는 UI
- 자체 검색 크롤러/검색 인덱스
- 완전 오프라인 서버 동기화(IndexedDB는 업로드 전 임시 보관 역할)
- 다중 사용자 계정/권한 시스템
- 종합 자동 테스트 스위트 (`npm test`는 현재 실제 테스트를 수행하지 않음)

스키마나 문서에 확장용 필드/모델이 존재하더라도 위 기능은 1차 개발 완료 범위에 포함하지 않는다.

---

## 13. 1차 개발 완료 수용 기준

1차 개발은 다음 상태를 충족하는 현재 구현을 기준으로 완료한다.

- iPhone에서 현장 프로젝트를 생성·관리할 수 있다.
- 사진 여러 장을 한 번에 선택해 각각 독립 자료로 저장할 수 있다.
- 사진/영상/음성/텍스트 자료의 저장 완료 여부를 확인할 수 있다.
- 실패한 업로드를 재시도할 수 있다.
- 자료 목록에서 원본을 확인하고 제목/텍스트를 수정하거나 삭제할 수 있다.
- 홈에서 선택 현장 기준 저장 자료/대기·실패/보고서 수를 볼 수 있다.
- 정리·분석함에서 현장을 한 번 선택하고 하위 분석 기능에 공통 적용할 수 있다.
- iPhone에서 Quick Analysis를 요청하고 Mac mini Codex Worker가 자동 처리할 수 있다.
- Quick Report 상태와 결과가 자동 갱신된다.
- Evidence를 선별해 Source Bundle을 만들 수 있다.
- 5종 Source 문서를 생성하고 Google Drive에 동기화할 수 있다.
- Analysis Brief를 생성하고 Google Docs로 자동 동기화할 수 있다.
- 프로젝트별 NotebookLM 주소를 저장하고 Handoff할 수 있다.
- Codex CLI로 Final Report 초안을 생성할 수 있다.
- Final Report를 직접 수정하거나 AI 수정 요청으로 새 버전을 만들 수 있다.
- Final Report를 Google Docs로 출력할 수 있다.
- `npm run doctor`로 서버, Codex Worker, Tailscale 상태를 확인할 수 있다.
- Capture, Quick Analysis, Final Report AI 작업이 원본 Evidence를 직접 수정하지 않는다.

---

## 14. 제품 포지셔닝

1차 개발 완료 기준 Gatherly의 제품 포지셔닝은 다음 조합으로 정의한다.

**Mobile Field Capture + Local Evidence Safety + Shared Field Context + Codex Quick Analysis + NotebookLM Research Preparation + Codex Final Report + Google Docs Handoff**

Gatherly는 범용 AI 검색 서비스나 NotebookLM 대체 서비스가 아니라, 현장에서 수집한 Evidence의 맥락과 파일을 보존하면서 AI 분석과 최종 산출물 생성을 운영하는 개인용 Field Research OS다.
