# Phase 2 SRS Addendum — Google Drive Storage Quota

기준일: 2026-09-14
관련 문서: `SRS_PHASE2_v1.2.md`

## 상태
- Package: `PARTIAL`
- Block reason: `BLOCKED_STORAGE_QUOTA`
- 미완료 Item: `WAITING` 또는 `FAILED`
- 완료 Item: `SYNCED` 유지

## 처리 규칙
1. Drive API에서 저장공간 부족을 감지하면 현재 Sync를 중단한다.
2. 동일 작업을 자동 재시도하지 않는다.
3. 이미 `SYNCED`된 항목은 유지한다.
4. 미완료 항목과 오류 사유를 보존한다.
5. 사용자가 `다시 시도`를 누르면 `SYNCED` 항목은 건너뛰고 미완료 항목부터 재개한다.
6. 용량 부족 상태에서는 `SOURCE_READY`로 전환하지 않는다.
7. Local Capture와 Coverage/Gap/Next Action/Closeout은 계속 동작한다.

## UI
```text
Google Drive 동기화 중단
저장공간이 부족합니다.
동기화 완료 38 / 47
대기 중 9

[Google Drive 열기]
[다시 시도]
```

## API/동작 요구
`POST /api/research/packages/:id/retry-failed`는 사용자 명시 동작으로만 호출한다. 저장공간 부족 오류 후 백그라운드 Worker가 해당 Package를 자동 재큐잉하면 안 된다.

## 수용 기준
- Drive 용량 부족 시 자동 재시도가 발생하지 않는다.
- 성공한 항목은 중복 업로드되지 않는다.
- 사용자가 공간 확보 후 `다시 시도`로 남은 항목만 재개할 수 있다.
- 모든 항목 Sync 완료 후에만 Package가 `SOURCE_READY`가 된다.
