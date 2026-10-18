import type { SyncItem } from './contracts';
export type PilotKind = 'photo' | 'audio' | 'note';
export const pilotKind = (row: SyncItem): PilotKind => row.kind === 'NOTE' ? 'note' : row.blob?.type.startsWith('image/') ? 'photo' : 'audio';
export const pilotRows = (rows: SyncItem[]) => rows.filter(r => r.fieldDayId === 'storage-test-event' && r.exhibitorId === 'storage-test-company');
export function pilotReadiness(rows: SyncItem[], deleted: PilotKind[], enabled: boolean, busy: boolean) {
  const reasons: string[] = [];
  if (!enabled) reasons.push('서버 정책상 차단: 원격 쓰기 비활성 또는 실증 대상 계정이 아닙니다.');
  if (busy) reasons.push('업로드 또는 원격 조회 중입니다. 완료될 때까지 기다려 주세요.');
  const selected = pilotRows(rows);
  const labels = { photo: '사진', audio: '녹음', note: '메모' };
  for (const kind of ['photo', 'audio', 'note'] as const) {
    const items = selected.filter(r => pilotKind(r) === kind);
    if (!items.length && !deleted.includes(kind)) reasons.push(`${labels[kind]} 없음: 1건을 준비해 주세요.`);
    if (items.length > 1) reasons.push(`${labels[kind]}가 여러 건입니다. 미전송 로컬 자료를 정리해 1건만 남겨 주세요.`);
    if (deleted.includes(kind)) reasons.push(`${labels[kind]}의 전송 이력이 있는 로컬 원본을 삭제했습니다. 원격 자료는 남아 있을 수 있으며 이 실증의 원격 교체·재전송은 불가합니다.`);
  }
  if (selected.length === 3 && deleted.length === 0 && selected.every(r => r.state === 'SYNCED')) reasons.push('이미 업로드 완료되어 재전송 불가합니다. 저장 결과 다시 조회를 이용해 주세요.');
  if (selected.some(r => r.blob && r.blob.size > 5 * 1024 * 1024)) reasons.push('사진·녹음은 각각 5MiB 이하여야 합니다.');
  return { canUpload: reasons.length === 0, reasons };
}

export function localDeleteWarning() {
  return '이 기기의 원본과 전송 대기 작업을 삭제할까요? 삭제 후 되돌릴 수 없으며 백업이 없으면 영구적으로 복구할 수 없습니다. 원격 저장 여부가 미확인인 경우 Google에 파일이 남아 있을 수 있습니다. 동기화 완료 자료를 포함해 이 작업은 Google Drive·Sheets 자료를 삭제하지 않습니다. 전송 이력이 있는 자료는 이 실증에서 원격 교체·재전송할 수 없습니다. 진행 중인 전송은 종료를 확인한 뒤 삭제합니다.';
}
