import { session } from '@/lib/gatherly-2/auth/server';
import { failure, IntegrationError, origin } from '@/lib/gatherly-2/integration/config';
import { consumeState } from '@/lib/gatherly-2/integration/google';
import { withGoogle } from '@/lib/gatherly-2/integration/runtime';
export async function GET(request: Request) {
  try {
    const { user } = await session(); const params = new URL(request.url).searchParams;
    await withGoogle(user.id, async (api, state, save) => {
      const verifier = consumeState(state, params.get('state') ?? ''); await save();
      const code = params.get('code'); if (!code || params.has('error')) throw new IntegrationError('REAUTH', 401);
      await api.exchange(code, verifier);
    });
    return Response.redirect(`${origin()}/v2`, 303);
  } catch (error) { return failure(error); }
}
