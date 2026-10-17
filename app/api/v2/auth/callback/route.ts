import { serverClient, verifiedUser, loginDestination } from '@/lib/gatherly-2/auth/server';
import { failure, IntegrationError, origin, requireAppOrigin } from '@/lib/gatherly-2/integration/config';
export async function GET(request: Request) {
  try {
    requireAppOrigin(request);
    const code = new URL(request.url).searchParams.get('code');
    if (!code) throw new IntegrationError('UNAUTHORIZED', 401);
    const client = await serverClient();
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (error) throw new IntegrationError('UNAUTHORIZED', 401);
    const user = await verifiedUser(client.auth);
    let destination: string;
    try { destination = loginDestination(user.id); } catch (error) { await client.auth.signOut({ scope: 'local' }); throw error; }
    return Response.redirect(`${origin()}${destination}`, 303);
  } catch (error) { return failure(error); }
}
