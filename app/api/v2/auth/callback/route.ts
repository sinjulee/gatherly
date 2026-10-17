import { environmentUser } from '@/lib/gatherly-2/integration/environment';
import { serverClient, verifiedUser } from '@/lib/gatherly-2/auth/server';
import { failure, IntegrationError, origin } from '@/lib/gatherly-2/integration/config';
export async function GET(request: Request) {
  try {
    const code = new URL(request.url).searchParams.get('code');
    if (!code) throw new IntegrationError('UNAUTHORIZED', 401);
    const client = await serverClient();
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (error) throw new IntegrationError('UNAUTHORIZED', 401);
    const user = await verifiedUser(client.auth);
    try { environmentUser(user.id); } catch (error) { await client.auth.signOut({ scope: 'local' }); throw error; }
    return Response.redirect(`${origin()}/v2`, 303);
  } catch (error) { return failure(error); }
}
