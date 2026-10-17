import test from 'node:test';
import assert from 'node:assert/strict';
import { authFailure, exchangeFailureReason } from '../lib/gatherly-2/auth/diagnostics';
import { IntegrationError } from '../lib/gatherly-2/integration/config';

test('OAuth failure diagnostics expose fixed categories only, never provider data', async () => {
  for (const [code, reason] of [
    ['pkce_code_verifier_not_found', 'PKCE_VERIFIER_MISSING'],
    ['bad_code_verifier', 'PKCE_VERIFIER_REJECTED'],
    ['flow_state_expired', 'OAUTH_FLOW_EXPIRED'],
    ['flow_state_not_found', 'OAUTH_FLOW_NOT_FOUND'],
    ['private-provider-payload', 'EXCHANGE_REJECTED'],
  ]) {
    const response = authFailure(new IntegrationError('UNAUTHORIZED', 401), 'session_exchange', { code, message: 'private-token-and-user' });
    assert.equal(response.status, 401);
    assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
    assert.match(response.headers.get('cache-control')!, /no-store/);
    assert.equal(response.headers.get('x-gatherly-auth-result'), reason);
    assert.deepEqual(await response.json(), { error: 'UNAUTHORIZED', stage: 'session_exchange', reason });
  }
  assert.equal(exchangeFailureReason(null), 'EXCHANGE_REJECTED');
});

test('callback trace logs and headers contain only defined categories; provider state is reported not trusted', async () => {
  const original = console.info;
  const logs: unknown[][] = [];
  console.info = (...args: unknown[]) => { logs.push(args); };
  try {
    for (const [stage, detail, expected] of [
      ['callback_code', undefined, 'CODE_MISSING'],
      ['provider_callback', 'bad_oauth_state', 'OAUTH_STATE_REPORTED'],
      ['provider_callback', 'private-code-state-token-uid', 'PROVIDER_ERROR_REPORTED'],
      ['session_exchange', { code: 'pkce_code_verifier_not_found', message: 'private-code-state-token-uid' }, 'PKCE_VERIFIER_MISSING'],
      ['user_verification', undefined, 'SESSION_REJECTED'],
    ] as const) {
      const response = authFailure(new IntegrationError('UNAUTHORIZED', 401), stage, detail);
      assert.equal(response.headers.get('x-gatherly-auth-result'), expected);
      assert.equal(response.status, 401);
      assert(!JSON.stringify([...response.headers]).includes('private-code-state-token-uid'));
      assert(!(await response.text()).includes('private-code-state-token-uid'));
    }
    assert.equal(logs.length, 5);
    assert(!JSON.stringify(logs).includes('private-code-state-token-uid'));
    assert(logs.every(args => args.length === 1 && /^GATHERLY_AUTH_TRACE stage=[a-z_]+ result=[A-Z_]+ status=401$/.test(String(args[0]))));
  } finally { console.info = original; }
});

test('diagnostics retain origin, authorization and unexpected-error status boundaries', async () => {
  assert.equal(authFailure(new IntegrationError('FORBIDDEN', 403), 'callback_origin').status, 403);
  assert.equal(authFailure(new IntegrationError('FORBIDDEN', 403), 'login_destination').status, 403);
  const response = authFailure(new Error('private-provider-payload'), 'user_verification');
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: 'RETRY', stage: 'user_verification' });
});
