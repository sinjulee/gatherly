import { serverClient, verifiedUser, loginDestination } from '@/lib/gatherly-2/auth/server';
import { IntegrationError, origin, requireAppOrigin } from '@/lib/gatherly-2/integration/config';
import { authFailure, type AuthStage } from '@/lib/gatherly-2/auth/diagnostics';
export async function GET(request: Request) {
  let stage: AuthStage = 'callback_origin';
  let exchangeError: unknown;
  try {
    requireAppOrigin(request);
    stage = 'callback_code';
    const params = new URL(request.url).searchParams;
    if (params.has('error') || params.has('error_code')) {
      stage = 'provider_callback';
      exchangeError = params.get('error_code');
      throw new IntegrationError('UNAUTHORIZED', 401);
    }
    const code = params.get('code');
    if (!code) throw new IntegrationError('UNAUTHORIZED', 401);
    stage = 'callback_client';
    const client = await serverClient();
    stage = 'session_exchange';
    const { error } = await client.auth.exchangeCodeForSession(code);
    exchangeError = error;
    if (error) throw new IntegrationError('UNAUTHORIZED', 401);
    stage = 'user_verification';
    const user = await verifiedUser(client.auth);
    stage = 'login_destination';
    let destination: string;
    try { destination = loginDestination(user.id); } catch (error) { await client.auth.signOut({ scope: 'local' }); throw error; }
    return new Response(null, { status: 303, headers: { Location: `${origin()}${destination}`,
      'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer',
      'X-Gatherly-Auth-Stage': 'login_complete', 'X-Gatherly-Auth-Result': 'OK' } });
  } catch (error) { return authFailure(error, stage, exchangeError); }
}
