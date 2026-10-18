import type { BrowserWorkspace } from '../browser-storage';
import type { SyncItem } from '../contracts';
import { uploadStorageItem, pilotPost } from './pilot-browser';
export const DEV_STORAGE_ENDPOINT = '/api/v2/dev-storage';
export const devWorkspaceName = (scope: string, project: string) => `gatherly-v2-dev-storage-${scope}-${project}`;
export async function syncDevItem(workspace: BrowserWorkspace, userId: string, item: SyncItem, transport: typeof fetch = fetch) {
  if (item.userId !== userId || !navigator.locks) throw new Error('계정 또는 브라우저 전송 잠금을 확인해 주세요.');
  return navigator.locks.request(`gatherly-pilot:${userId}`, async () => {
    const current = (await workspace.list(userId)).find(row=>row.id===item.id);
    if (!current) throw new Error('로컬 삭제된 자료는 전송하지 않습니다.');
    if (current.state === 'SYNCED') return;
    const snapshot = await workspace.transfer(current);
    try { await uploadStorageItem(snapshot,userId,transport,undefined,DEV_STORAGE_ENDPOINT); await workspace.finishTransfer({...snapshot,state:'SYNCED',attempts:snapshot.attempts+1}); }
    catch(error) { await workspace.finishTransfer({...snapshot,state:'FAILED_RETRYABLE',attempts:snapshot.attempts+1}); throw error; }
  });
}
export async function checkDevItem(userId: string, id: string, transport: typeof fetch = fetch) {
  const form = new FormData(); form.set('expectedUserId',userId); form.set('action','status');form.set('operationId',id);
  return (await pilotPost(form,transport,DEV_STORAGE_ENDPOINT)).state as string;
}
