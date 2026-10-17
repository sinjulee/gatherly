import { serverClient } from '@/lib/gatherly-2/auth/server';
import { failure, origin, sameOrigin } from '@/lib/gatherly-2/integration/config';
export async function POST(request: Request) {
  try { sameOrigin(request); const client = await serverClient(); await client.auth.signOut({ scope: 'local' }); return Response.redirect(`${origin()}/v2`, 303); }
  catch (error) { return failure(error); }
}
