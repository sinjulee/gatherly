# Gatherly Phase 2 Drive Workspace

현장별 Google Drive 최상위 폴더는 `현장명`만 사용한다.

예:

```text
Gatherly/
└─ Projects/
   └─ 2026 푸드위크/
      ├─ 00_사전조사/
      ├─ 01_현장자료/
      ├─ 02_조사계획/
      ├─ 03_분석자료/
      └─ 04_최종보고서/
```

`00_사전조사`에는 NotebookLM 등에서 만든 사전조사, 방문계획, 개별 조사자료를 저장한다. Gatherly는 이를 Research Plan 생성에 참조한다.

Gatherly FieldDay와 Drive 프로젝트 폴더의 연결은 폴더명이 아니라 Google Drive `folderId`로 유지한다. 따라서 사용자가 폴더명을 바꿔도 연결이 유지되어야 한다.

기존 `{현장명} ({fieldDayId8})` 방식은 2차 신규 구조에서는 사용하지 않는다.

## Google Drive 용량 부족 처리

Google Drive 동기화 중 저장공간 부족 또는 quota 관련 오류를 감지하면 해당 동기화 작업은 즉시 중단한다. 용량 부족은 자동 재시도로 해결되지 않는 사용자 조치 필요 오류이므로 백그라운드 반복 재시도를 하지 않는다.

상태는 `BLOCKED_STORAGE_QUOTA`로 기록하고, 이미 성공한 Evidence 동기화 결과는 유지한다. 실패한 항목은 삭제하거나 처음부터 다시 업로드하지 않고 `WAITING_FOR_USER_RETRY` 상태로 보존한다.

사용자 UI 예:

```text
Google Drive 동기화 중단

Google Drive 저장공간이 부족하여
남은 자료를 업로드하지 못했습니다.

동기화 완료      38 / 47
대기 중            9

Drive 저장공간을 확보하거나 용량을 늘린 뒤
아래 버튼을 눌러 다시 시도하세요.

[Google Drive 열기]
[다시 시도]
```

`다시 시도` 버튼을 누르기 전에는 Gatherly가 해당 quota 오류 작업을 자동으로 재시도하지 않는다.

사용자가 `다시 시도`를 누르면 새로 전체 동기화를 시작하지 않고, 이미 성공한 항목을 건너뛰고 실패/대기 항목부터 재개한다. 동일 SHA-256과 기존 `driveFileId`를 활용하여 중복 업로드를 방지한다.

재시도 후에도 저장공간 부족이 확인되면 다시 `BLOCKED_STORAGE_QUOTA` 상태로 돌아가며 사용자 알림을 유지한다.

이 오류는 현장 Capture, Mac mini 로컬 저장, Coverage, Gap, Next Action, Closeout을 차단하지 않는다. 단, Research Package의 전체 상태는 `PARTIAL` 또는 `BLOCKED_STORAGE_QUOTA`로 표시하며 `SOURCE_READY`로 전환하지 않는다.
