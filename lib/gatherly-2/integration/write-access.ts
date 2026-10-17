import { enabled, IntegrationError } from './config';
import { environmentUser } from './environment';
/** Restricted pilot: deployment-owned single UID, in addition to the normal allowlist. */
export function requireWriteUser(userId: string, env: Record<string, string | undefined> = process.env) {
  if (!enabled(env) || env.GATHERLY_V2_GOOGLE_WRITES_ENABLED !== 'true') throw new IntegrationError('DISABLED', 503);
  if (environmentUser(userId, env) !== 'production') throw new IntegrationError('FORBIDDEN', 403);
  const owner = env.GATHERLY_V2_PRODUCTION_WRITE_USER_ID?.trim();
  if (!owner || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(owner)) throw new IntegrationError('DISABLED', 503);
  if (userId !== owner) throw new IntegrationError('FORBIDDEN', 403);
}
