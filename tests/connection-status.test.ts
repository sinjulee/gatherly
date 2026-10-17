import test from 'node:test';
import assert from 'node:assert/strict';
import { connectionStatusResponse, storedConnection } from '../lib/gatherly-2/integration/connection-status';
import { emptyVault, FileVault } from '../lib/gatherly-2/integration/vault';
import { IntegrationError } from '../lib/gatherly-2/integration/config';
import { environmentUser } from '../lib/gatherly-2/integration/environment';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';

test('status distinguishes stored credentials from API availability without exposing secrets', () => {
  assert.equal(storedConnection(emptyVault()).status, 'NOT_CONNECTED');
  for (const expiresAt of [1, Date.now() + 3600000]) {
    const result = storedConnection({ ...emptyVault(), oauth: { accessToken: 'private-access', refreshToken: 'private-refresh', expiresAt } });
    assert.deepEqual(result, { status: 'CONNECTED', apiAvailability: 'NOT_CHECKED' });
    assert(!JSON.stringify(result).includes('private'));
  }
  assert.equal(storedConnection({ ...emptyVault(), oauth: { accessToken: 'private', refreshToken: '', expiresAt: 1 } }).status, 'REAUTH_REQUIRED');
});

test('status rechecks server owner/production allowlist before Vault and rejects Origin/UID forgery', async () => {
  const before = { ...process.env };
  Object.assign(process.env, { GATHERLY_V2_APP_ORIGIN: 'https://fixture.invalid', VERCEL: '1', VERCEL_ENV: 'production', GATHERLY_V2_ENVIRONMENT: 'production', GATHERLY_V2_PRODUCTION_ALLOWED_USER_IDS: 'approved' });
  let calls = 0;
  const getVault = () => { calls++; throw new Error('must not access'); };
  const request = (origin = 'https://fixture.invalid') => new Request('https://fixture.invalid/api/v2/google/status?userId=approved&environment=preview', { method: 'POST', headers: { origin }, body: '{"userId":"approved"}' });
  try {
    for (const code of ['UNAUTHORIZED', 'FORBIDDEN'] as const) {
      const response = await connectionStatusResponse(request(), async () => { throw new IntegrationError(code, code === 'UNAUTHORIZED' ? 401 : 403); }, getVault);
      assert.equal(response.status, code === 'UNAUTHORIZED' ? 401 : 403);
      assert.deepEqual(await response.json(), { status: 'ERROR', apiAvailability: 'NOT_CHECKED' });
    }
    const denied = await connectionStatusResponse(request(), async () => { environmentUser('denied'); return 'denied'; }, getVault);
    assert.equal(denied.status, 403);
    for (const origin of ['', 'https://evil.invalid']) assert.equal((await connectionStatusResponse(request(origin), async () => 'approved', getVault)).status, 403);
    assert.equal(calls, 0);
  } finally { process.env = before; }
});

test('status survives new vault instance and does not save, refresh, or disclose crypto errors', async () => {
  const before = process.env.GATHERLY_V2_APP_ORIGIN;
  process.env.GATHERLY_V2_APP_ORIGIN = 'https://fixture.invalid';
  const dir = await mkdtemp(join(tmpdir(), 'gatherly-status-')), key = randomBytes(32);
  const original = new FileVault(dir, key);
  await original.locked('approved', async (state, save) => { state.oauth = { accessToken: 'private-access', refreshToken: 'private-refresh', expiresAt: 1 }; await save(); });
  const request = new Request('https://fixture.invalid/api/v2/google/status', { method: 'POST', headers: { origin: 'https://fixture.invalid' } });
  try {
    const response = await connectionStatusResponse(request, async () => 'approved', () => new FileVault(dir, key));
    assert.equal(response.status, 200); assert.match(response.headers.get('cache-control')!, /no-store/);
    assert.deepEqual(await response.json(), { status: 'CONNECTED', apiAvailability: 'NOT_CHECKED' });
    const other = await connectionStatusResponse(request, async () => 'other', () => new FileVault(dir, key));
    assert.equal((await other.json()).status, 'NOT_CONNECTED');
    const corrupt = await connectionStatusResponse(request, async () => 'approved', () => new FileVault(dir, randomBytes(32)));
    assert.deepEqual(await corrupt.json(), { status: 'ERROR', apiAvailability: 'NOT_CHECKED' });
    const lease = await connectionStatusResponse(request, async () => 'approved', () => ({ locked: async () => { throw new Error('private-secret'); } }));
    assert.equal(lease.status, 503); assert(!(await lease.text()).includes('private-secret'));
  } finally { if (before === undefined) delete process.env.GATHERLY_V2_APP_ORIGIN; else process.env.GATHERLY_V2_APP_ORIGIN = before; }
});
