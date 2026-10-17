import { IntegrationError, requireAppOrigin, sameOrigin } from './config';
import type { VaultData } from './vault';
export type ConnectionStatus = { status: 'CONNECTED' | 'NOT_CONNECTED' | 'REAUTH_REQUIRED' | 'ERROR'; apiAvailability: 'NOT_CHECKED'; };
interface StatusVault { locked<T>(userId: string, action: (state: VaultData, save: () => Promise<void>) => Promise<T>): Promise<T> }
export function storedConnection(state: VaultData): ConnectionStatus {
  const status = !state.oauth ? 'NOT_CONNECTED' : !state.oauth.refreshToken ? 'REAUTH_REQUIRED' : 'CONNECTED';
  // Access-token expiry alone does not revoke the persisted refresh credential.
  return { status, apiAvailability: 'NOT_CHECKED' };
}
/** POST: existing adapters claim/release a lease even without saving. No refresh or file operations. */
export async function connectionStatusResponse(request: Request, authorize: () => Promise<string>, getVault: () => StatusVault) {
  const headers = { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' };
  try {
    sameOrigin(request); requireAppOrigin(request);
    const owner = await authorize(); // Verified server session + environment allowlist, never body/query UID.
    const result = await getVault().locked(owner, async state => storedConnection(state));
    return Response.json(result, { headers });
  } catch (error) {
    const status = error instanceof IntegrationError ? error.status : 503;
    // A crypto/lease/configuration error must never masquerade as an absent connection.
    return Response.json({ status: 'ERROR', apiAvailability: 'NOT_CHECKED' }, { status, headers });
  }
}
