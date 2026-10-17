import { environment, environmentUser } from '../integration/environment';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { IntegrationError, required, requireEnabled, enabled } from '../integration/config';
export async function serverClient() {
  requireEnabled(); environment();
  const jar = await cookies();
  return createServerClient(required('NEXT_PUBLIC_SUPABASE_URL'), required('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'), {
    cookies: { getAll: () => jar.getAll(), setAll: values => {
      // Server Components cannot set cookies; proxy refreshes them before rendering.
      try { for (const { name, value, options } of values) jar.set(name, value, options); } catch {}
    } },
  });
}
export async function verifiedUser(auth: { getUser(): Promise<{ data: { user: { id: string; is_anonymous?: boolean } | null }; error: unknown }> }) {
  const { data, error } = await auth.getUser();
  if (error || !data.user || data.user.is_anonymous) throw new IntegrationError('UNAUTHORIZED', 401);
  return data.user;
}
/** Authentication only: returns the caller's UID, never data access or an admin grant. */
export async function ownLoginIdentity(auth: Parameters<typeof verifiedUser>[0], env: Record<string, string | undefined> = process.env) {
  if (!enabled(env) || env.GATHERLY_V2_AUTH_ONLY !== 'true') throw new IntegrationError('DISABLED', 503);
  environment(env);
  return { id: (await verifiedUser(auth)).id };
}
export function loginDestination(userId: string, env: Record<string, string | undefined> = process.env) {
  environment(env);
  if (env.GATHERLY_V2_AUTH_ONLY === 'true') return '/v2/auth-complete';
  environmentUser(userId, env);
  return '/v2';
}
export async function session() {
  const client = await serverClient();
  const user = await verifiedUser(client.auth);
  environmentUser(user.id);
  return { client, user };
}

/** Administrators must also pass the environment allowlist; user_metadata never grants authority. */
export async function adminSession() {
  const result = await session();
  const { data, error } = await result.client.from('g2_admins').select('user_id').eq('user_id', result.user.id).single();
  if (error || !data) throw new IntegrationError('FORBIDDEN', 403);
  return result;
}
