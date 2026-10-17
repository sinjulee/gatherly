import { uploadChunks } from './browser-media';
import type { BrowserWorkspace } from '../browser-storage';
import type { SyncItem } from '../contracts';
export async function syncWorkspace(workspace: BrowserWorkspace, userId: string, transport: typeof fetch = fetch, chunkedMedia = false) {
  if (!navigator.locks) throw new Error('이 브라우저는 안전한 동기화 잠금을 지원하지 않습니다.');
  return navigator.locks.request(`gatherly-v2-sync:${userId}`, async () => {
    let done = 0, blocked = 0;
    for (const current of await workspace.list(userId)) {
      if (current.state === 'SYNCED') continue;
      const item = await workspace.transfer(current); // Durable immutable snapshot survives reload/edit.
      if (item.nextAttemptAt > Date.now()) { blocked++; continue; }
      const form = new FormData();
      form.set("expectedUserId", userId);
      form.set('record', JSON.stringify({ id: item.id, fieldDayId: item.fieldDayId, exhibitorId: item.exhibitorId, title: item.title, kind: item.kind, revision: item.revision, ...(item.kind === 'NOTE' ? { text: item.text } : {}) }));
      if (item.blob) form.set('file', item.blob, item.title);
      let next: SyncItem = { ...item, attempts: item.attempts + 1 };
      try {
        const response = chunkedMedia && item.kind === 'MEDIA' ? await uploadChunks(item, userId, transport) : await transport('/api/v2/sync', { method: 'POST', body: form, signal: AbortSignal.timeout(120_000) });
        const result = await response.json();
        if (!response.ok) {
          const state = result.error === 'REAUTH' || result.error === 'UNAUTHORIZED' ? 'BLOCKED_REAUTH' : result.error === 'CONFLICT' ? 'CONFLICT' : result.error === 'INVALID' || result.error === 'FORBIDDEN' ? 'FAILED_FINAL' : 'FAILED_RETRYABLE';
          next = { ...next, state, error: result.error, nextAttemptAt: state === 'FAILED_RETRYABLE' ? Date.now() + Math.min(60000, 1000 * 2 ** Math.min(next.attempts, 6)) : 0 };
          blocked++;
        } else { next = { ...next, state: 'SYNCED', driveFileId: result.driveFileId, nextAttemptAt: 0 }; done++; }
      } catch { next = { ...next, state: 'FAILED_RETRYABLE', nextAttemptAt: Date.now() + 10000 }; blocked++; }
      await workspace.finishTransfer(next);
    }
    return `Google 동기화 ${done}건 완료 · 대기/확인 ${blocked}건. 동기화 중 수정한 내용은 다음 전송에 반영됩니다.`;
  });
}
