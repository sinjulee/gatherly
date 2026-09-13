# Gatherly 2차 개발 SRS v1.2

기준일: 2026-09-14
기준 브랜치: `phase2/research-execution-system`
관련 문서: `PRD_PHASE2.md`, `SRS_PHASE2.md`, `SRS_PHASE2_NOTEBOOKLM_SYNC_ADDENDUM.md`

이 문서는 Gatherly 2차 개발의 현재 구현 기준 SRS다. 기존 `SRS_PHASE2.md`의 Research Execution 요구사항과 NotebookLM Research Package 요구사항을 통합한다.

## 1. 시스템 목표

```text
Research Plan
→ Target/Booth
→ Checkpoint
→ 계획형/즉석 Evidence Capture
→ Evidence Mapping
→ Coverage / Gap / Next Action
→ Booth / Field Closeout
→ Research Package
→ Google Drive Sync
→ SOURCE_READY
→ NotebookLM Handoff
→ Deep Research / Final Report
```

Mac mini의 Prisma/SQLite와 로컬 파일 저장소를 원본 저장소로 유지한다. Google Drive는 NotebookLM 및 외부 연구도구에 전달하기 위한 동기화 레이어다. Drive/NotebookLM 장애가 현장 기록을 막아서는 안 된다.

## 2. 핵심 도메인

- `ResearchPlan`: 조사 목적과 실행 계획
- `ResearchTarget`: 기업/부스/제품/기술/사람/장소
- `ResearchQuestion`: 현장에서 답해야 할 질문
- `ResearchCheckpoint`: P1/P2/P3 체크 단위
- `RequiredEvidence`: 체크 완료에 필요한 Evidence 조건
- `EvidenceMapping`: Material과 Checkpoint 연결
- `CoverageSnapshot`: 전체/우선순위/Target별 충족도
- `ResearchGap`: 미충족/부분충족/Blocked 항목
- `NextAction`: Gap을 해결할 다음 행동
- `BoothCloseout`, `FieldCloseout`: 종료 시점 스냅샷
- `ResearchPackage`: 외부 연구용 버전 스냅샷
- `ResearchPackageItem`: Package 항목별 동기화/준비 상태

## 3. 현장 실행 요구사항

부스 상세 화면에서 체크리스트, Coverage, Evidence, Gap, Next Action, Capture, Closeout을 한 화면에서 제공한다.

Checkpoint를 선택한 상태에서 사진·앨범·영상·음성·텍스트를 기록하면 Material 저장 완료 후 해당 Checkpoint와 연결하고 Coverage를 갱신한다.

Research Plan이나 Checkpoint가 없는 경우에도 즉석 관찰 기록을 허용한다. 자유 Evidence는 정상 Material로 저장하며 즉시 분류를 강제하지 않는다. 이후 기존 Checkpoint 연결, 새 Target/Checkpoint 생성, 미분류 유지가 가능하다.

Coverage 기본 가중치는 P1=5, P2=3, P3=1이며 PARTIAL은 50%, SATISFIED는 100%, NOT_APPLICABLE은 분모에서 제외한다.

## 4. Research Package 요구사항

`NotebookLM 자료 준비` 실행 시 다음을 packageVersion으로 스냅샷한다.

- STORED Material
- 계획형/즉석 Evidence
- Research Plan
- Target/Checkpoint
- Evidence Mapping
- Coverage
- Open Gap / Next Action
- Booth/Field Closeout
- Source 문서
- Package manifest

Package 상태:
`DRAFT | BUILDING | READY_TO_SYNC | SYNCING | SOURCE_READY | PARTIAL | FAILED | STALE`

새 Evidence, Plan/Checkpoint 변경, Mapping 변경, Closeout 생성 등 Package 내용에 영향을 주는 변경이 발생하면 기존 SOURCE_READY Package를 STALE로 표시할 수 있다.

## 5. 자료 유형별 처리

- IMAGE: 실제 이미지 파일과 Evidence Context 포함
- TEXT: Source 문서에 본문과 Evidence ID 포함
- AUDIO: 원본 포함, 전사본이 있으면 함께 포함
- VIDEO: 원본 포함, 전사/핵심 프레임은 파생물로 확장 가능

계획형/즉석형 Evidence를 동일한 Package 후보로 취급한다.

## 6. Google Drive Sync 요구사항

기존 Google Docs 동기화를 확장해 Research Package의 Evidence와 Source 문서를 Drive에 전달한다.

필수 요구사항:
- Evidence별 성공/실패 상태 추적
- Evidence ID와 SHA-256 기반 Lineage
- 동일 파일의 불필요한 재동기화 최소화
- 일부 실패 시 성공 항목 유지
- 실패 항목 개별 재시도
- Mac mini 내부 절대경로는 외부 Source에 노출하지 않음

Source 문서는 기존 5종에 다음을 추가한다.
- 06 Research Plan
- 07 Coverage and Gaps
- 08 Closeout

## 7. NotebookLM Handoff

NotebookLM 준비 화면에서 다음을 제공한다.
- packageVersion/status
- 전체/포함/동기화/실패 Evidence 수
- IMAGE/TEXT/AUDIO/VIDEO별 준비 상태
- STALE/PARTIAL 원인
- 마지막 build/sync 시각
- Drive 열기
- NotebookLM 열기
- 권장 Source 목록

검증 흐름:

```text
Package 없음 → 생성 권장
STALE → 갱신 권장
PARTIAL → 누락 Evidence 표시
SOURCE_READY → NotebookLM Handoff 가능
```

NotebookLM Source 자동등록은 공식적으로 지원되는 방식이 확인되는 경우에만 구현한다. 비공식 로그인/화면 자동조작은 필수 범위에 포함하지 않는다.

## 8. UI 요구사항

- 조사 준비: 목적, 사전조사, AI Plan, 부스/순서, 체크사항
- 오늘의 현장: Coverage, P1 미충족, Next Action, 즉석 기록, 종료 점검
- 부스 상세: 체크리스트 + Capture + Evidence + Gap + Closeout
- 자료수집함: 전체 Evidence, 미분류 필터, 사후 Mapping
- NotebookLM 준비: Package 상태, 동기화 진행률, 실패 재시도, Drive/NotebookLM Handoff

## 9. 수용 기준

- 부스별 체크사항을 사전 정의할 수 있다.
- 체크리스트 화면 안에서 사진/메모/음성/영상 기록이 가능하다.
- 계획 없이도 즉석 관찰 기록이 가능하다.
- Evidence를 사후 Checkpoint에 연결할 수 있다.
- Coverage/Gap/Next Action이 갱신된다.
- Booth/Field Closeout이 가능하다.
- ResearchPackage를 생성할 수 있다.
- 실제 Evidence와 Source 문서를 Drive에 동기화할 수 있다.
- 일부 실패 시 성공 항목은 유지하고 실패 항목만 재시도할 수 있다.
- 새 Evidence 이후 기존 Package의 STALE 상태를 감지할 수 있다.
- SOURCE_READY 상태에서 NotebookLM Handoff를 제공한다.
- 1차 기능에 회귀가 없다.

## 10. 구현 순서

```text
2A Research Plan Core
2B 조사 준비 UI
2C Booth Execution
2D In-context + Free Observation Capture
2E EvidenceMapping + Coverage
2F Gap + Next Action
2G Booth / Field Closeout
2H ResearchPackage + PackageItem
2I Source Docs 확장 + Drive Evidence Sync
2J Package Status / Retry / STALE Detection
2K NotebookLM 준비 UI + Handoff
2L Quick Analysis / Final Report 연계
2M iPhone + Drive + NotebookLM E2E 테스트
```

## 11. 완료 정의

```text
사전조사
→ Research Plan
→ 계획형/즉석 Evidence Capture
→ Coverage/Gap/Next Action
→ Closeout
→ ResearchPackage
→ 실제 Evidence + Source Docs Drive Sync
→ SOURCE_READY
→ NotebookLM Handoff
→ Deep Research / Final Report
```

이 흐름이 iPhone과 Mac mini 환경에서 끊기지 않고 수행되면 2차 개발을 완료로 판단한다.
