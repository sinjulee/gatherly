import { devStorageEnabled, devProfile } from './dev-profile';
import { requireWriteUser } from './write-access';
import { environment } from './environment';
import { isVercel } from './platform';
import { SupabaseVault, vaultRpc } from './supabase-vault';
import { FileVault } from './vault';
import { GoogleApi, consumeState, type GoogleConfig } from './google';
import { IntegrationError, origin, required, requireEnabled, requireConsent } from './config';
export function googleConfig(): GoogleConfig {
  if (devStorageEnabled()) devProfile();
  const prefix = devStorageEnabled() ? 'GATHERLY_V2_DEV_' : 'GATHERLY_V2_';
  const redirectUri = required('GATHERLY_V2_GOOGLE_REDIRECT_URI');
  if (redirectUri !== `${origin()}/api/v2/google/callback`) throw new IntegrationError('DISABLED', 503);
  return { clientId: required(prefix + 'GOOGLE_CLIENT_ID'), clientSecret: required(prefix + 'GOOGLE_CLIENT_SECRET'), redirectUri };
}
export function vault() {
  requireEnabled();
  const namespace = environment();
  const prefix = devStorageEnabled() ? 'GATHERLY_V2_DEV_' : 'GATHERLY_V2_';
  const key = Buffer.from(required(prefix + 'TOKEN_ENCRYPTION_KEY'), 'base64');
  const backend = process.env.GATHERLY_V2_VAULT_BACKEND ?? (isVercel() ? 'supabase' : 'file');
  if (backend === 'supabase') return new SupabaseVault(vaultRpc(required('NEXT_PUBLIC_SUPABASE_URL'), required(prefix + 'SUPABASE_SECRET_KEY')), key, namespace);
  if (backend !== 'file' || isVercel()) throw new IntegrationError('DISABLED', 503);
  return new FileVault(required('GATHERLY_V2_VAULT_DIR'), key);
}
export function requireWrites() { requireEnabled(); if (process.env.GATHERLY_V2_GOOGLE_WRITES_ENABLED !== 'true') throw new IntegrationError('DISABLED', 503); }
export function requireCatalogWrites() {
  requireWrites();
  if (process.env.GATHERLY_V2_AUTH_ONLY === 'true') throw new IntegrationError('DISABLED', 503);
}
/** Consent persists tokens only; never exposes a general Google file operation callback. */
export async function completeGoogleConsent(userId: string, params: URLSearchParams) {
  requireConsent();
  return vault().locked(userId, async (state, save) => {
    const verifier = consumeState(state, params.get('state') ?? '');
    await save();
    if (params.get('error') === 'access_denied') return 'declined' as const;
    const code = params.get('code');
    if (!code || params.has('error')) throw new IntegrationError('REAUTH', 401);
    await new GoogleApi(googleConfig(), state, save).exchange(code, verifier);
    return 'connected' as const;
  });
}
export async function withGoogle<T>(userId: string, action: (api: GoogleApi, state: import('./vault').VaultData, save: () => Promise<void>) => Promise<T>) {
  requireCatalogWrites(); requireWriteUser(userId);
  return vault().locked(userId, (state, save) => action(new GoogleApi(googleConfig(), state, save), state, save));
}
