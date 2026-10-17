import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { session } from '@/lib/gatherly-2/auth/server';
import { failure } from '@/lib/gatherly-2/integration/config';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    await session();
    const bytes = await readFile(path.join(process.cwd(), 'docs/gatherly-2.0/v0.5_assets/ESG_2026_Official_BoothMap_TitleRemoved_Reference.png'));
    return new Response(bytes, { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') return Response.json({ error: 'MAP_NOT_CONFIGURED' }, { status: 503, headers: { 'Cache-Control': 'private, no-store' } });
    return failure(error);
  }
}
