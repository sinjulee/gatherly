export class IntegrationError extends Error {
  constructor(public code: 'DISABLED' | 'UNAUTHORIZED' | 'FORBIDDEN' | 'REAUTH' | 'RETRY' | 'CONFLICT' | 'INVALID', public status = 400) { super(code); }
}
export function enabled(env: Record<string, string | undefined> = process.env) { return env.GATHERLY_V2_INTEGRATION_ENABLED === 'true'; }
export function required(name: string, env: Record<string, string | undefined> = process.env) {
  const value = env[name]?.trim();
  if (!value) throw new IntegrationError('DISABLED', 503);
  return value;
}
export function requireEnabled() { if (!enabled()) throw new IntegrationError('DISABLED', 503); }
export function requireConsent(env: Record<string, string | undefined> = process.env) {
  if (!enabled(env) || env.GATHERLY_V2_GOOGLE_CONSENT_ENABLED !== 'true') throw new IntegrationError('DISABLED', 503);
}
export function origin() {
  const value = new URL(required('GATHERLY_V2_APP_ORIGIN'));
  if (value.protocol !== 'https:' && !(value.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(value.hostname))) throw new IntegrationError('DISABLED', 503);
  return value.origin;
}
export function sameOrigin(request: Request, expected = origin()) {
  if (request.headers.get('origin') !== expected) throw new IntegrationError('FORBIDDEN', 403);
}
export function allowedUser(id: string, env: Record<string, string | undefined> = process.env) {
  if (!(env.GATHERLY_V2_ALLOWED_USER_IDS ?? '').split(',').map(x => x.trim()).includes(id)) throw new IntegrationError('FORBIDDEN', 403);
}
export function failure(error: unknown) {
  const known = error instanceof IntegrationError ? error : new IntegrationError('RETRY', 503);
  return Response.json({ error: known.code }, { status: known.status, headers: { 'Cache-Control': 'private, no-store' } });
}

export function requireOwner(expected: unknown, actual: string) {
  if (expected !== actual) throw new IntegrationError("FORBIDDEN", 403);
}
