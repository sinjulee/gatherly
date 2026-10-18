import { devStorageEnabled, devProfile, requireDevUser } from './dev-profile';
import { IntegrationError } from './config';
export type Environment = 'development' | 'preview' | 'production';
/** Only deployment-owned configuration is accepted; never headers, query or form fields. */
export function environment(env: Record<string, string | undefined> = process.env): Environment {
  const configured = env.GATHERLY_V2_ENVIRONMENT;
  if (!['development', 'preview', 'production'].includes(configured ?? '')) throw new IntegrationError('DISABLED', 503);
  if (env.VERCEL === '1' && configured !== env.VERCEL_ENV) throw new IntegrationError('DISABLED', 503);
  if (env.VERCEL !== '1' && configured !== 'development') throw new IntegrationError('DISABLED', 503);
  if (devStorageEnabled(env)) devProfile(env);
  return configured as Environment;
}
export function environmentUser(id: string, env: Record<string, string | undefined> = process.env) {
  const scope = environment(env);
  if (devStorageEnabled(env)) requireDevUser(id, env);
  const list = env[`GATHERLY_V2_${scope.toUpperCase()}_ALLOWED_USER_IDS`] ?? '';
  if (!list.split(',').map(value => value.trim()).includes(id)) throw new IntegrationError('FORBIDDEN', 403);
  return scope;
}
export function scopedOwner(id: string) { return `${environment()}:${id}`; }
