import { session } from '@/lib/gatherly-2/auth/server';
import { sameOrigin, requireAppOrigin, requireOwner, failure, IntegrationError } from '@/lib/gatherly-2/integration/config';
import { requireWrites, googleConfig, vault } from '@/lib/gatherly-2/integration/runtime';
import { requireWriteUser } from '@/lib/gatherly-2/integration/write-access';
import { scopedOwner } from '@/lib/gatherly-2/integration/environment';
import { GoogleApi } from '@/lib/gatherly-2/integration/google';
import { PilotStorage, pilotData, pilotRecord, pilotTransport } from '@/lib/gatherly-2/integration/pilot-storage';
export const runtime = 'nodejs';
export const maxDuration = 300;
/** Limit actual bytes, not just a client-controlled Content-Length header. */
export async function POST(request: Request) {
  try {
    sameOrigin(request); requireAppOrigin(request); requireWrites();
    const { user } = await session(); requireWriteUser(user.id);
    const reader = request.body?.getReader();
    if (!reader) throw new IntegrationError('INVALID');
    const chunks: Uint8Array<ArrayBuffer>[] = []; let size = 0;
    try {
      while (true) {
        const next = await reader.read(); if (next.done) break;
        size += next.value.length;
        if (size > 1152 * 1024) { await reader.cancel(); throw new IntegrationError('INVALID', 413); }
        chunks.push(next.value);
      }
    } finally { reader.releaseLock(); }
    const form = await new Response(new Blob(chunks), { headers: { 'Content-Type': request.headers.get('content-type') ?? '' } }).formData();
    requireOwner(form.get('expectedUserId'), user.id);
    const check = form.get('action') === 'status';
    if (!check && form.get('action') !== 'upload') throw new IntegrationError('INVALID');
    const slot = check ? null : pilotRecord(JSON.parse(String(form.get('record'))), form.has('media') ? JSON.parse(String(form.get('media'))) : undefined);
    const chunk = form.get('chunk'), offset = Number(form.get('offset') ?? 0);
    if (!check && (!Number.isSafeInteger(offset) || offset < 0 || (chunk instanceof File && chunk.size > 1024 * 1024))) throw new IntegrationError('INVALID');
    const result = await vault().locked(user.id, async (state, save) => {
      const data = pilotData(state);
      const api = new GoogleApi(googleConfig(), state, save, pilotTransport(data, save));
      const storage = new PilotStorage(api, data, save, scopedOwner(user.id));
      return check ? { states: await storage.status() } : storage.upload(slot!, offset, chunk instanceof File ? chunk : undefined);
    });
    return Response.json(result, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return failure(error); }
}
