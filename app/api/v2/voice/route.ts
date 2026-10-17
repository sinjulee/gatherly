import { session } from '@/lib/gatherly-2/auth/server';
import { failure } from '@/lib/gatherly-2/integration/config';
/** No approved official AI narration is published yet. Demo TTS remains client-side. */
export async function GET() {
  try { await session(); return Response.json({ error: 'NOT_PUBLISHED' }, { status: 404, headers: { 'Cache-Control': 'private, no-store' } }); }
  catch (error) { return failure(error); }
}
