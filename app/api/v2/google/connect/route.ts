import { session } from '@/lib/gatherly-2/auth/server';
import { failure, sameOrigin } from '@/lib/gatherly-2/integration/config';
import { startConsent } from '@/lib/gatherly-2/integration/google';
import { googleConfig, requireWrites, vault } from '@/lib/gatherly-2/integration/runtime';
export async function POST(request: Request) {
  try {
    sameOrigin(request); requireWrites(); const { user } = await session();
    const next = startConsent(googleConfig());
    await vault().locked(user.id, async (state, save) => { state.flow = next.flow; await save(); });
    return Response.redirect(next.url, 303);
  } catch (error) { return failure(error); }
}
