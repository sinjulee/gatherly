import { environment } from './environment';
import { isVercel } from './platform';
import { SupabaseVault, vaultRpc } from './supabase-vault';
import { FileVault } from './vault';
import { GoogleApi, consumeState, type GoogleConfig } from './google';
import { IntegrationError, origin, required, requireEnabled, requireConsent } from './config';
export function googleConfig(): GoogleConfig {
  const redirectUri = required('GATHERLY_V2_GOOGLE_REDIRECT_URI');
  if (redirectUri !== `${origin()}/api/v2/google/callback`) throw new IntegrationError('DISABLED', 503);
  return { clientId: required('GATHERLY_V2_GOOGLE_CLIENT_ID'), clientSecret: required('GATHERLY_V2_GOOGLE_CLIENT_SECRET'), redirectUri };
}
export function vault() {
  requireEnabled();
  const namespace = environment();
  const key = Buffer.from(required('GATHERLY_V2_TOKEN_ENCRYPTION_KEY'), 'base64');
  const backend = process.env.GATHERLY_V2_VAULT_BACKEND ?? (isVercel() ? 'supabase' : 'file');
  if (backend === 'supabase') return new SupabaseVault(vaultRpc(required('NEXT_PUBLIC_SUPABASE_URL'), required('GATHERLY_V2_SUPABASE_SECRET_KEY')), key, namespace);
  if (backend !== 'file' || isVercel()) throw new IntegrationError('DISABLED', 503);
  return new FileVault(required('GATHERLY_V2_VAULT_DIR'), key);
}
export function requireWrites() { requireEnabled(); if (process.env.GATHERLY_V2_GOOGLE_WRITES_ENABLED !== 'true') throw new IntegrationError('DISABLED', 503); }
/** Consent persists tokens only; never exposes a general Google file operation callback. */
export async function completeGoogleConsent(userId: string, params: URLSearchParams) {
  requireConsent();
  await vault().locked(userId, async (state, save) => {
    const verifier = consumeState(state, params.get('state') ?? '');
    await save();
    const code = params.get('code');
    if (!code || params.has('error')) throw new IntegrationError('REAUTH', 401);
    await new GoogleApi(googleConfig(), state, save).exchange(code, verifier);
  });
}
export async function withGoogle<T>(userId: string, action: (api: GoogleApi, state: import('./vault').VaultData, save: () => Promise<void>) => Promise<T>) {
  requireWrites();
  return vault().locked(userId, (state, save) => action(new GoogleApi(googleConfig(), state, save), state, save));
}
