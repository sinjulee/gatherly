import { session } from '@/lib/gatherly-2/auth/server';
import { requireAppOrigin } from '@/lib/gatherly-2/integration/config';
import { consentPage, consentFailure } from '@/lib/gatherly-2/integration/consent-response';
import { completeGoogleConsent } from '@/lib/gatherly-2/integration/runtime';
export async function GET(request: Request) {
  try {
    requireAppOrigin(request);
    const { user } = await session(); const params = new URL(request.url).searchParams;
    const outcome = await completeGoogleConsent(user.id, params);
    return consentPage(outcome);
  } catch (error) { return consentFailure(request, error); }
}
