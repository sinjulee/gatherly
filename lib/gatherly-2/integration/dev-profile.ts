import { IntegrationError } from './config';
type Env = Record<string, string | undefined>;
export const devStorageEnabled = (env: Env = process.env) => env.GATHERLY_V2_DEV_STORAGE_ENABLED === 'true';
/** A separate Preview deployment and database, never a switch on Gatherly Production. */
export function devProfile(env: Env = process.env) {
  const scope = env.GATHERLY_V2_ENVIRONMENT;
  const ref = env.GATHERLY_V2_DEV_SUPABASE_PROJECT_REF;
  if (!devStorageEnabled(env) || !['preview', 'development'].includes(scope ?? '') || !ref || !/^[a-z0-9]{20}$/.test(ref) || ref === 'rmjyonrmlbarvtaazurc' || env.NEXT_PUBLIC_SUPABASE_URL !== `https://${ref}.supabase.co`) throw new IntegrationError('DISABLED', 503);
  if (env.VERCEL === '1') {
    const project = env.GATHERLY_V2_DEV_VERCEL_PROJECT_ID;
    if (scope !== 'preview' || env.VERCEL_ENV !== 'preview' || !project || project === 'prj_rVB8Km0yCOQSWLTcqYGsa0YHhyH7' || env.VERCEL_PROJECT_ID !== project) throw new IntegrationError('DISABLED', 503);
  } else if (scope !== 'development') throw new IntegrationError('DISABLED', 503);
  if (env.GATHERLY_V2_VAULT_BACKEND !== 'supabase') throw new IntegrationError('DISABLED', 503);
  return { ref, scope: scope! };
}

export function requireDevUser(user: string, env: Env = process.env, write = false) {
  const profile = devProfile(env);
  const owner = env.GATHERLY_V2_DEV_WRITE_USER_ID;
  const list = (env[`GATHERLY_V2_${profile.scope.toUpperCase()}_ALLOWED_USER_IDS`] ?? '').split(',').map(v=>v.trim()).filter(Boolean);
  if (!owner || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(owner) || list.length !== 1 || list[0] !== owner) throw new IntegrationError('DISABLED',503);
  if (user !== owner) throw new IntegrationError('FORBIDDEN', 403);
  if (env.GATHERLY_V2_INTEGRATION_ENABLED !== 'true' || (write && env.GATHERLY_V2_GOOGLE_WRITES_ENABLED !== 'true')) throw new IntegrationError('DISABLED', 503);
  return profile;
}
