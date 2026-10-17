import { scopedOwner } from '@/lib/gatherly-2/integration/environment';
import { isVercel } from '@/lib/gatherly-2/integration/platform';
import { session } from '@/lib/gatherly-2/auth/server';
import { failure, IntegrationError, sameOrigin, requireOwner } from '@/lib/gatherly-2/integration/config';
import { withGoogle, requireWrites } from '@/lib/gatherly-2/integration/runtime';
import { GoogleStorage } from '@/lib/gatherly-2/integration/storage';
import { parseRecord } from '@/lib/gatherly-2/integration/validation';
export const runtime = 'nodejs';
export const maxDuration = 300;
export async function POST(request: Request) {
  try {
    sameOrigin(request); requireWrites(); const { user, client } = await session();
    if (Number(request.headers.get('content-length') ?? 0) > 26 * 1024 * 1024) throw new IntegrationError('INVALID', 413);
    const form = await request.formData();
    requireOwner(form.get('expectedUserId'), user.id);
    const record = parseRecord(JSON.parse(String(form.get('record'))));
    const { data, error } = await client.from('g2_exhibitors').select('id,exhibition_id').eq('id', record.exhibitorId).eq('exhibition_id', record.fieldDayId).single();
    // Pilot fieldDayId is explicitly the published exhibition ID, private workspace scoped by owner.
    if (error || !data) throw new IntegrationError('FORBIDDEN', 403);
    if (isVercel() && record.kind === 'MEDIA') throw new IntegrationError('INVALID', 413);
    const file = form.get('file');
    if (record.kind === 'MEDIA' && (!(file instanceof File) || file.size === 0 || file.size > 25 * 1024 * 1024 || !/^(image|audio)\//.test(file.type))) throw new IntegrationError('INVALID', 413);
    const result = await withGoogle(user.id, (api, state, save) => new GoogleStorage(api, state, save, scopedOwner(user.id)).sync(record, file instanceof File ? file : undefined));
    return Response.json(result, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return failure(error); }
}
