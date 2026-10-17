import { serverClient } from '@/lib/gatherly-2/auth/server';
import { failure, origin, sameOrigin, requireAppOrigin } from '@/lib/gatherly-2/integration/config';
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    requireAppOrigin(request);
    const client = await serverClient();
    const { data, error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${origin()}/api/v2/auth/callback`, skipBrowserRedirect: true } });
    if (error || !data.url) throw error;
    return Response.redirect(data.url, 303);
  } catch (error) { return failure(error); }
}
