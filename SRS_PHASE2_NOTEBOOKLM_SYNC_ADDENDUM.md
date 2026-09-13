# Gatherly Phase 2 SRS Addendum — Research Package & NotebookLM Handoff

기준일: 2026-09-14
관련 문서: `SRS_PHASE2.md`, `PRD_PHASE2.md`

## 목적

2차 개발에서 Mac mini에 저장되는 현장 Evidence를 외부 연구도구가 사용할 수 있도록 `ResearchPackage` 계층을 추가한다. Mac mini의 Prisma/SQLite와 로컬 파일 저장소는 계속 원본 저장소로 유지하며, Google Drive는 Research Package 전달용 동기화 레이어로 사용한다.

## 필수 모델

### ResearchPackage
- fieldDayId
- researchPlanId(optional)
- version
- status
- includedMaterialCount
- syncedItemCount
- failedItemCount
- driveVersionFolderId/Url
- builtAt/syncedAt/staleAt

상태: `DRAFT | BUILDING | READY_TO_SYNC | SYNCING | SOURCE_READY | PARTIAL | FAILED | STALE`

### ResearchPackageItem
- researchPackageId
- materialId(optional)
- evidenceId
- itemType/sourceKind
- sha256/mimeType
- driveFileId/Url
- syncStatus
- readinessStatus
- errorMessageSafe

## Package 구성

Package는 다음을 포함한다.
- STORED Material 중 선택된 Evidence
- 계획형 및 즉석 관찰 Evidence
- Research Plan
- Target/Checkpoint
- Evidence Mapping
- Coverage
- Open Gap / Next Action
- Booth/Field Closeout
- Source 문서
- Package manifest

## 자료 유형 처리

- IMAGE: 실제 이미지 파일과 Evidence Context를 포함한다.
- TEXT: Field Notes/Source 문서에 본문과 Evidence ID를 포함한다.
- AUDIO: 원본을 포함하며 전사본이 있으면 함께 포함한다.
- VIDEO: 원본을 포함하며 전사/핵심 프레임은 파생물로 확장할 수 있다.

## 동기화 요구사항

- Evidence별 성공/실패 상태를 저장한다.
- Evidence ID와 SHA-256을 기준으로 로컬 원본과 외부 파일의 연결을 추적한다.
- 동일 파일의 불필요한 재동기화를 최소화한다.
- 일부 항목 실패 시 성공 항목을 유지한다.
- 실패 항목만 재시도할 수 있다.
- 외부 Source 문서에는 Mac mini 내부 절대경로를 노출하지 않는다.

## Source 문서 확장

기존 Source 문서 5종에 다음을 추가한다.
- 06 Research Plan
- 07 Coverage and Gaps
- 08 Closeout

## Package Freshness

SOURCE_READY 이후 새 Evidence, Research Plan/Checkpoint 변경, Evidence Mapping 변경, Closeout 생성 등 Package 내용에 영향을 주는 변경이 발생하면 Package를 STALE로 표시할 수 있다. 과거 분석에 사용한 packageVersion은 스냅샷으로 보존한다.

## NotebookLM 준비 화면

사용자는 다음을 확인할 수 있어야 한다.
- packageVersion/status
- 전체/포함/동기화/실패 Evidence 수
- 자료유형별 준비 상태
- STALE/PARTIAL 원인
- 마지막 build/sync 시각
- Drive 폴더 열기
- NotebookLM 열기
- 권장 Source 목록

NotebookLM Source 자동등록은 공식적으로 지원되는 방법이 확인되는 경우에만 구현한다. 2차 MVP는 `SOURCE_READY → Drive/NotebookLM Handoff`까지를 보장한다.

## 수용 기준

- ResearchPackage 생성 가능
- 계획형/즉석 Evidence 모두 Package 포함 가능
- 실제 Evidence와 Source 문서의 Drive 동기화 상태 확인 가능
- 일부 실패 시 재시도 가능
- 새 Evidence 이후 STALE 감지 가능
- SOURCE_READY 상태에서 NotebookLM Handoff 가능
- Drive 또는 NotebookLM 문제로 현장 Capture가 중단되지 않음
