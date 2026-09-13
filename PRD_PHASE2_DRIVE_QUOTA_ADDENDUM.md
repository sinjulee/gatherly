# Phase 2 PRD Addendum — Google Drive Storage Quota

기준일: 2026-09-14
관련 문서: `PRD_PHASE2.md`

Google Drive 저장공간 부족은 사용자 조치가 필요한 오류다. 자동 재시도하지 않는다.

```text
용량 부족 감지
→ 현재 동기화 중단
→ 성공 항목 유지
→ 남은 항목 대기
→ 사용자 알림
→ 사용자가 공간 확보
→ [다시 시도]
→ 대기/실패 항목부터 재개
```

Package는 `SOURCE_READY`가 아닌 `PARTIAL`로 표시하고 세부 원인은 `BLOCKED_STORAGE_QUOTA`로 기록한다.

UI는 동기화 완료 수, 대기 수, `Google Drive 열기`, `다시 시도` 버튼을 제공한다. 사용자가 `다시 시도`를 누르기 전에는 백그라운드 재시도를 하지 않는다.

Drive 용량 부족 중에도 Mac mini Local Capture, Coverage, Gap, Next Action, Booth/Field Closeout은 계속 동작해야 한다.
