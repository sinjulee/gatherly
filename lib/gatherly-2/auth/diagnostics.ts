import { IntegrationError } from '../integration/config';

export type AuthStage = 'callback_origin' | 'callback_code' | 'callback_client' | 'provider_callback' | 'session_exchange' | 'user_verification' | 'login_destination';

/** Fixed categories only: never echo provider messages, URLs, cookies, IDs or tokens. */
export function exchangeFailureReason(error: unknown) {
  const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
  switch (code) {
    case 'pkce_code_verifier_not_found': return 'PKCE_VERIFIER_MISSING';
    case 'bad_code_verifier': return 'PKCE_VERIFIER_REJECTED';
    case 'flow_state_expired': return 'OAUTH_FLOW_EXPIRED';
    case 'flow_state_not_found': return 'OAUTH_FLOW_NOT_FOUND';
    default: return 'EXCHANGE_REJECTED';
  }
}

export function authFailure(error: unknown, stage: AuthStage, exchangeError?: unknown) {
  const known = error instanceof IntegrationError ? error : new IntegrationError('RETRY', 503);
  const reason = stage === 'session_exchange' ? exchangeFailureReason(exchangeError)
    : stage === 'provider_callback' ? (exchangeError === 'bad_oauth_state' ? 'OAUTH_STATE_REPORTED' : 'PROVIDER_ERROR_REPORTED') : undefined;
  const result = reason ?? (stage === 'callback_code' ? 'CODE_MISSING'
    : stage === 'callback_origin' ? 'ORIGIN_REJECTED'
    : stage === 'user_verification' && known.code === 'UNAUTHORIZED' ? 'SESSION_REJECTED'
    : stage === 'login_destination' && known.code === 'FORBIDDEN' ? 'ACCESS_REJECTED' : 'OTHER_ERROR');
  // No request, URL, provider message, cookie, user, or exception object is logged.
  console.info(`GATHERLY_AUTH_TRACE stage=${stage} result=${result} status=${known.status}`);
  return Response.json({ error: known.code, stage, ...(reason ? { reason } : {}) }, {
    status: known.status,
    headers: { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer',
      'X-Gatherly-Auth-Stage': stage, 'X-Gatherly-Auth-Result': result },
  });
}
