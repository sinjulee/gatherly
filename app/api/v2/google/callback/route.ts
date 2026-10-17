import { session } from '@/lib/gatherly-2/auth/server';
import { failure, origin } from '@/lib/gatherly-2/integration/config';
import { completeGoogleConsent } from '@/lib/gatherly-2/integration/runtime';
export async function GET(request: Request) {
  try {
    const { user } = await session(); const params = new URL(request.url).searchParams;
    await completeGoogleConsent(user.id, params);
    return Response.redirect(`${origin()}/v2`, 303);
  } catch (error) { return failure(error); }
}
