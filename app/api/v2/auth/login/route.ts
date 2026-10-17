import { serverClient } from '@/lib/gatherly-2/auth/server';
import { failure, origin, sameOrigin, requireAppOrigin } from '@/lib/gatherly-2/integration/config';
export async function POST(request: Request) {
  let stage = 'login_origin';
  const diagnose = (response: Response) => {
    response.headers.set('X-Gatherly-Auth-Stage', stage);
    response.headers.set('Cache-Control', 'private, no-store');
    response.headers.set('Referrer-Policy', 'no-referrer');
    return response;
  };
  try {
    sameOrigin(request);
    requireAppOrigin(request);
    stage = 'login_client';
    const client = await serverClient();
    stage = 'oauth_start';
    const { data, error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${origin()}/api/v2/auth/callback`, skipBrowserRedirect: true } });
    if (error || !data.url) throw error;
    stage = 'oauth_redirect';
    // Response.redirect has immutable headers; construct a mutable response.
    return diagnose(new Response(null, { status: 303, headers: { Location: data.url } }));
  } catch (error) { return diagnose(failure(error)); }
}
