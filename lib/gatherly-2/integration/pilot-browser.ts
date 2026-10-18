import { diagnosticCodes, validRequestId } from './config';
import type { BrowserWorkspace } from '../browser-storage';
import { pilotReadiness } from '../pilot-ui';
import type { SyncItem } from '../contracts';
import type { PilotSessionView } from './pilot-session';
import { pilotKind } from '../pilot-ui';
const endpoint = '/api/v2/storage-test';
const messages: Record<string, string> = { SHEET_PENDING: 'Drive 파일은 확인했지만 Sheets 반영은 미완료입니다. 기존 파일을 사용하는 복구 확인이 필요합니다.', DISABLED: '원격 저장이 비활성입니다.', FORBIDDEN: '이 계정은 쓰기 승인이 없습니다.', UNAUTHORIZED: '다시 로그인해 주세요.', REAUTH: 'Google 연결 또는 Drive·Sheets API 설정을 확인해 주세요.', LIMIT: '테스트 요청 한도에 도달했습니다. 운영자 확인이 필요합니다.', CONFLICT: '예약한 자료와 내용 또는 원격 기록이 다릅니다. 원본을 유지하고 확인해 주세요.', INVALID: '사진·녹음은 각각 5MiB 이하, 메모는 500자 이하로 준비해 주세요.', RETRY: '원격 저장 확인에 실패했습니다. 실패 단계 확인이 필요합니다.' };
export async function pilotPost(form: FormData, transport: typeof fetch = fetch) {
  const response = await transport(endpoint, { method: 'POST', body: form, signal: AbortSignal.timeout(120000) });
  const result = await response.json();
  if (!response.ok) {
    const stage = diagnosticCodes.includes(result.diagnostic) ? ` [${result.diagnostic}]` : '';
    const request = validRequestId(result.requestId) ? ` 요청 ${result.requestId}` : '';
    const evidence = result.remote ? ` 기존 검증 이력: 파일 ${result.remote.file === 'CONFIRMED' ? '확인됨' : '미확인'} · 행 ${result.remote.row === 'CONFIRMED' ? '확인됨' : '미확인'}.` : '';
    throw new Error((messages[result.error] ?? '저장 또는 조회 실패. 로컬 원본은 유지됩니다.') + stage + request + evidence + ' 복구 정보와 원본은 보존됩니다. 원격 대조 전 재전송하지 마세요. 로컬 삭제는 복구 불가 위험을 확인한 뒤 선택할 수 있습니다.');
  }
  return result;
}
export async function pilotStatus(userId: string, run?: PilotSessionView) {
  const form = new FormData(); form.set('expectedUserId', userId); form.set('action', 'status'); if (run) form.set('sessionId', run.id);
  return (await pilotPost(form)).states as Record<string, string>;
}
export async function syncPilot(workspace: BrowserWorkspace, userId: string, transport: typeof fetch = fetch, run?: PilotSessionView) {
  if (run?.readOnly || run?.status === 'CLOSED' || (run && Date.now() >= run.endsAt)) throw new Error('종료된 실증 회차입니다.');
  if (!navigator.locks) throw new Error('안전한 동기화 잠금을 지원하지 않는 브라우저입니다.');
  return navigator.locks.request(`gatherly-pilot:${userId}`, async () => {
    const rows = (await workspace.list(userId)).filter(r => r.fieldDayId === 'storage-test-event' && r.exhibitorId === 'storage-test-company');
    const count = { note: 0, photo: 0, audio: 0 };
    for (const row of rows) {
      const type = row.kind === 'NOTE' ? 'note' : row.blob?.type.startsWith('image/') ? 'photo' : 'audio';
      if (++count[type] > 1 || (row.blob && row.blob.size > 5 * 1024 * 1024)) throw new Error('사진·녹음·메모 각 1건만 준비해 주세요. 미디어는 각각 5MiB 이하입니다. 로컬 자료는 삭제하지 않았습니다.');
    }
    const readiness = pilotReadiness(rows, await workspace.deletedPilotKinds(userId), true, false);
    if (!readiness.canUpload) {
      if (readiness.reasons.length === 1 && readiness.reasons[0].startsWith('이미 업로드 완료')) return '이미 업로드 완료되어 재전송 불가합니다. 저장 결과 다시 조회를 이용해 주세요.';
      throw new Error(readiness.reasons.join(' '));
    }
    let done = 0;
    for (const row of rows) {
      if (row.state === 'SYNCED') { done++; continue; }
      const item = await workspace.transfer(row);
      try {
        await upload(item, userId, transport, run);
        await workspace.finishTransfer({ ...item, state: 'SYNCED', attempts: item.attempts + 1 }); done++;
      } catch (error) {
        await workspace.finishTransfer({ ...item, state: 'FAILED_RETRYABLE', attempts: item.attempts + 1 });
        throw error;
      }
    }
    return `원격 재조회까지 ${done}건 확인했습니다. 로컬 원본은 그대로 보관합니다.`;
  });
}
async function upload(item: SyncItem, owner: string, transport: typeof fetch, run?: PilotSessionView) {
  const blob = item.blob;
  const hash = blob ? [...new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()))].map(n => n.toString(16).padStart(2, '0')).join('') : undefined;
  let offset = 0, prepared = false;
  for (let attempt = 0; attempt < 12; attempt++) {
    const form = new FormData(); form.set('action', 'upload'); form.set('expectedUserId', owner); if (run) form.set('sessionId', run.id);
    form.set('record', JSON.stringify({ id: run ? run.operations[pilotKind(item)] : item.id, fieldDayId: item.fieldDayId, exhibitorId: item.exhibitorId, title: item.title, text: item.text, kind: item.kind, revision: item.revision }));
    if (blob) form.set('media', JSON.stringify({ size: blob.size, mimeType: blob.type, sha256: hash }));
    form.set('offset', String(offset));
    if (blob && prepared && offset < blob.size) form.set('chunk', blob.slice(offset, offset + 1024 * 1024, blob.type), 'chunk');
    const result = await pilotPost(form, transport);
    if (result.done === true) return;
    if (!blob || !Number.isSafeInteger(result.offset) || result.offset < 0 || result.offset > blob.size) throw new Error('원격 전송 위치를 확인하지 못했습니다. 원본은 유지됩니다.');
    offset = result.offset; prepared = true;
  }
  throw new Error('전송 시도 한도에 도달했습니다. 같은 자료로 재시도해 주세요.');
}
