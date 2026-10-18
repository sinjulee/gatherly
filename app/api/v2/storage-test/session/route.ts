import { session } from '@/lib/gatherly-2/auth/server';
import { sameOrigin, requireAppOrigin, failure, IntegrationError } from '@/lib/gatherly-2/integration/config';
import { vault } from '@/lib/gatherly-2/integration/runtime';
import { requirePilotUser } from '@/lib/gatherly-2/integration/write-access';
import { openPilotSession, closePilotSession, pilotApproval, sessionView } from '@/lib/gatherly-2/integration/pilot-session';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    sameOrigin(request); requireAppOrigin(request);
    const { user } = await session(); requirePilotUser(user.id);
    // No client UUID, approval, expiry or environment can grant a session.
    const action = new URL(request.url).searchParams.get('action');
    const id = new URL(request.url).searchParams.get('sessionId');
    if (action !== 'open' && action !== 'close' && action !== 'history') throw new IntegrationError('INVALID');
    const keys = [...new URL(request.url).searchParams.keys()];
    if (keys.some(key => !['action', 'sessionId'].includes(key)) || (action !== 'close' && id !== null) || request.headers.get('content-length') && request.headers.get('content-length') !== '0') throw new IntegrationError('INVALID');
    if (action === 'history') {
      const rows = await vault().locked(user.id, async state => Object.values(state.pilotSessions ?? {}).map(row => ({ ...sessionView(row), readOnly: true as const })));
      return Response.json(rows, { headers: { 'Cache-Control': 'private, no-store' } });
    }
    if (action === 'open') pilotApproval(user.id);
    const result = await vault().locked(user.id, async (state, save) => sessionView(action === 'open' ? await openPilotSession(state, user.id, save) : await closePilotSession(state, user.id, id, save)));
    return Response.json(result, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return failure(error); }
}
