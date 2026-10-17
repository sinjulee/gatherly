import type { SyncItem } from '../contracts';
import { MEDIA_CHUNK_BYTES } from './platform';
export async function uploadChunks(item: SyncItem, userId: string, transport: typeof fetch): Promise<Response> {
  const blob = item.blob;
  if (!blob?.size) return Response.json({ error: 'INVALID' }, { status: 400 });
  const sha256 = [...new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()))].map(n => n.toString(16).padStart(2,'0')).join('');
  const record = { id: item.id, fieldDayId: item.fieldDayId, exhibitorId: item.exhibitorId, title: item.title, kind: item.kind, revision: item.revision };
  let offset = 0, prepared = false;
  for (let attempts = 0; attempts < 60; attempts++) {
    const form = new FormData(); form.set('expectedUserId', userId); form.set('record', JSON.stringify(record));
    form.set('media', JSON.stringify({ size: blob.size, mimeType: blob.type, sha256 })); form.set('offset', String(offset));
    if (prepared && offset < blob.size) form.set('chunk', blob.slice(offset, offset + MEDIA_CHUNK_BYTES, blob.type), 'chunk');
    const response = await transport('/api/v2/media', { method: 'POST', body: form, signal: AbortSignal.timeout(120_000) });
    if (!response.ok) return response;
    const result = await response.json() as { done: boolean; offset: number; driveFileId?: string };
    if (result.done && result.driveFileId) return Response.json(result);
    if (!Number.isSafeInteger(result.offset) || result.offset < 0 || result.offset > blob.size) return Response.json({ error: 'CONFLICT' }, { status: 409 });
    offset = result.offset; prepared = true;
  }
  return Response.json({ error: 'RETRY' }, { status: 503 });
}
