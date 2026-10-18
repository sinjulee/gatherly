export const diagnosticCodes = ['DRIVE_SESSION_INIT_FAILED', 'DRIVE_UPLOAD_STATUS_FAILED', 'DRIVE_CHUNK_TRANSFER_FAILED', 'DRIVE_UPLOAD_VERIFY_FAILED', 'SHEETS_INITIALIZATION_FAILED', 'SHEETS_HEADER_FAILED', 'SHEETS_ROW_WRITE_FAILED', 'SHEETS_ROW_VERIFY_FAILED', 'VAULT_CLAIM_FAILED', 'VAULT_SAVE_FAILED', 'VAULT_RELEASE_FAILED', 'VAULT_DECRYPT_FAILED', 'GOOGLE_TOKEN_REFRESH_FAILED', 'GOOGLE_TOKEN_EXCHANGE_FAILED', 'DRIVE_CREATE_FAILED', 'DRIVE_READ_FAILED', 'DRIVE_UPLOAD_FAILED', 'SHEETS_WRITE_FAILED', 'SHEETS_READ_FAILED', 'VERIFY_FAILED', 'RESOURCE_RECONCILIATION_REQUIRED', 'UNCLASSIFIED_FAILURE'] as const;
export type Diagnostic = typeof diagnosticCodes[number];
export function classified(error: unknown, stage: Diagnostic, upstreamStatus?: number): IntegrationError {
  const known = error instanceof IntegrationError ? error : new IntegrationError('RETRY', 503);
  known.diagnostic ??= stage;
  if (upstreamStatus !== undefined) known.upstreamStatus ??= upstreamStatus;
  return known;
}
export async function atStage<T>(stage: Diagnostic, action: () => Promise<T>): Promise<T> {
  try { return await action(); } catch (error) { throw classified(error, stage); }
}
/** Refine transport categories only; never replace a Vault/token or earlier semantic failure. */
export async function atOperation<T>(stage: Diagnostic, action: () => Promise<T>): Promise<T> {
  try { return await action(); } catch (error) {
    const known = classified(error, stage);
    if (['DRIVE_READ_FAILED', 'DRIVE_CREATE_FAILED', 'DRIVE_UPLOAD_FAILED', 'SHEETS_WRITE_FAILED', 'SHEETS_READ_FAILED', 'VERIFY_FAILED'].includes(known.diagnostic!)) known.diagnostic = stage;
    throw known;
  }
}
export type RemoteEvidence = { file: 'UNKNOWN' | 'CONFIRMED'; row: 'UNKNOWN' | 'CONFIRMED' };
export type FailureContext = { requestId: string; remote: RemoteEvidence };
export function validRequestId(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
}
export function safeDiagnostic(error: IntegrationError) {
  const diagnostic = diagnosticCodes.includes(error.diagnostic!) ? error.diagnostic : 'UNCLASSIFIED_FAILURE';
  const upstreamStatus = Number.isInteger(error.upstreamStatus) && error.upstreamStatus! >= 100 && error.upstreamStatus! <= 599 ? error.upstreamStatus : undefined;
  const secondary = diagnosticCodes.includes(error.secondary!) ? error.secondary : undefined;
  return { diagnostic, upstreamStatus, secondary };
}
export class IntegrationError extends Error {
  constructor(public code: 'SHEET_PENDING' | 'LIMIT' | 'DISABLED' | 'UNAUTHORIZED' | 'FORBIDDEN' | 'REAUTH' | 'RETRY' | 'CONFLICT' | 'INVALID', public status = 400, public diagnostic?: Diagnostic, public upstreamStatus?: number, public secondary?: Diagnostic) { super(code); }
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
/** OAuth cookies and the code exchange must stay on the configured app host. */
export function requireAppOrigin(request: Request, expected = origin()) {
  if (new URL(request.url).origin !== expected) throw new IntegrationError('FORBIDDEN', 403);
}
export function allowedUser(id: string, env: Record<string, string | undefined> = process.env) {
  if (!(env.GATHERLY_V2_ALLOWED_USER_IDS ?? '').split(',').map(x => x.trim()).includes(id)) throw new IntegrationError('FORBIDDEN', 403);
}
export function failure(error: unknown, diagnose = false, context?: FailureContext) {
  const known = error instanceof IntegrationError ? error : new IntegrationError('RETRY', 503);
  const details = diagnose ? { ...safeDiagnostic(known), ...(context && validRequestId(context.requestId) ? { requestId: context.requestId, remote: { file: context.remote.file === 'CONFIRMED' ? 'CONFIRMED' : 'UNKNOWN', row: context.remote.row === 'CONFIRMED' ? 'CONFIRMED' : 'UNKNOWN' } } : {}) } : {};
  if (diagnose) console.error(JSON.stringify({ event: 'STORAGE_FAILURE', status: known.status, code: known.code, ...details }));
  return Response.json({ error: known.code, ...details }, { status: known.status, headers: { 'Cache-Control': 'private, no-store' } });
}

export function requireOwner(expected: unknown, actual: string) {
  if (expected !== actual) throw new IntegrationError("FORBIDDEN", 403);
}
