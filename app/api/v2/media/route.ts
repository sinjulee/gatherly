import { requireWriteUser } from '@/lib/gatherly-2/integration/write-access';
import { scopedOwner } from '@/lib/gatherly-2/integration/environment';
import { session } from '@/lib/gatherly-2/auth/server';
import { failure, IntegrationError, sameOrigin, requireOwner } from '@/lib/gatherly-2/integration/config';
import { withGoogle, requireCatalogWrites } from '@/lib/gatherly-2/integration/runtime';
import { parseRecord } from '@/lib/gatherly-2/integration/validation';
import { CloudMediaStorage, mediaInfo } from '@/lib/gatherly-2/integration/cloud-media';
export const runtime = 'nodejs';
export const maxDuration = 300;
export async function POST(request: Request) {
  try {
    sameOrigin(request); requireCatalogWrites(); const { user, client } = await session(); requireWriteUser(user.id);
    if (Number(request.headers.get('content-length') ?? 0) > 2 * 1024 * 1024) throw new IntegrationError('INVALID', 413);
    const form = await request.formData(); requireOwner(form.get('expectedUserId'), user.id);
    const record = parseRecord(JSON.parse(String(form.get('record'))));
    const info = mediaInfo(JSON.parse(String(form.get('media'))));
    const { data, error } = await client.from('g2_exhibitors').select('id').eq('id', record.exhibitorId).eq('exhibition_id', record.fieldDayId).single();
    if (error || !data) throw new IntegrationError('FORBIDDEN', 403);
    const chunk = form.get('chunk');
    const result = await withGoogle(user.id, (api, state, save) => new CloudMediaStorage(api, state, save, scopedOwner(user.id)).step(record, info, Number(form.get('offset')), chunk instanceof File ? chunk : undefined));
    return Response.json(result, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return failure(error); }
}
