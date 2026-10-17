import { session } from '@/lib/gatherly-2/auth/server';
import { SupabaseCatalog, REFERENCE_SHA } from '@/lib/gatherly-2/integration/catalog';
import { failure, IntegrationError } from '@/lib/gatherly-2/integration/config';
export async function GET(request: Request) {
  try {
    const { client } = await session();
    const id = new URL(request.url).searchParams.get('exhibition');
    if (!id || !/^[a-f0-9-]{36}$/i.test(id)) throw new IntegrationError('INVALID');
    const catalog = new SupabaseCatalog(client), exhibitors = await catalog.list(id);
    return Response.json({ exhibitors, hotspots: await catalog.hotspots(id, exhibitors, REFERENCE_SHA) }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return failure(error); }
}
