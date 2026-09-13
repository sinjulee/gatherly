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
