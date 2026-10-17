import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { allowedUser, enabled, sameOrigin, requireOwner } from '../lib/gatherly-2/integration/config';
import { GoogleApi, startConsent, consumeState, FILE_SCOPE } from '../lib/gatherly-2/integration/google';
import { FileVault, emptyVault, seal, unseal } from '../lib/gatherly-2/integration/vault';
import { verifiedUser } from '../lib/gatherly-2/auth/server';
const config = { clientId: 'fixture-client', clientSecret: 'fixture-only', redirectUri: 'https://gatherly.invalid/api/v2/google/callback' };
test('external integration defaults off; owner allowlist and CSRF fail closed', () => {
  assert.equal(enabled({} as NodeJS.ProcessEnv), false);
  assert.throws(() => allowedUser('B', { GATHERLY_V2_ALLOWED_USER_IDS: 'A' }));
  assert.throws(() => sameOrigin(new Request('https://gatherly.invalid', { headers: { Origin: 'https://attacker.invalid' } }), 'https://gatherly.invalid'));
  sameOrigin(new Request('https://gatherly.invalid', { headers: { Origin: 'https://gatherly.invalid' } }), 'https://gatherly.invalid');
});
test('SSR verification rejects expired/revoked and anonymous users', async () => {
  await assert.rejects(() => verifiedUser({ getUser: async () => ({ data: { user: { id: 'forged' } }, error: new Error('expired') }) }));
  await assert.rejects(() => verifiedUser({ getUser: async () => ({ data: { user: { id: 'guest', is_anonymous: true } }, error: null }) }));
  assert.equal((await verifiedUser({ getUser: async () => ({ data: { user: { id: 'A' } }, error: null }) })).id, 'A');
});
test('separate Google consent has minimal scope, PKCE, expiring single-use state', () => {
  const start = startConsent(config, 100), url = new URL(start.url), data = emptyVault();
  assert.equal(url.searchParams.get('scope'), FILE_SCOPE); assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  data.flow = start.flow; assert.equal(consumeState(data, start.flow.state, 101), start.flow.verifier);
  assert.throws(() => consumeState(data, start.flow.state, 101));
  data.flow = start.flow; assert.throws(() => consumeState(data, start.flow.state, 600100));
  data.flow = start.flow; assert.throws(() => consumeState(data, 'forged', 101));
});
test('vault binds ciphertext to user, rejects tamper, persists privately and excludes concurrent worker', async () => {
  const key = randomBytes(32), raw = seal('A', { token: 'fixture-only' }, key);
  assert.equal(raw.includes('fixture-only'), false); assert.throws(() => unseal('B', raw, key));
  assert.throws(() => unseal('A', raw.slice(0, -6) + 'AAAAAA', key));
  const dir = await mkdtemp(path.join(os.tmpdir(), 'gatherly-vault-test-')); const vault = new FileVault(dir, key);
  await vault.locked('A', async (state, save) => { state.resources.folder = { id: 'fixture' }; await save(); await assert.rejects(() => vault.locked('A', async () => {})); });
  await new FileVault(dir, key).locked('A', async state => assert.equal(state.resources.folder.id, 'fixture'));
  const files = await readdir(dir); assert.equal(files.length, 1); assert.equal((await readFile(path.join(dir, files[0]), 'utf8')).includes('fixture'), false);
});
test('Google expiry refresh and one retry on 401; refresh token is never a browser result', async () => {
  const state = emptyVault(); state.oauth = { accessToken: 'expired', refreshToken: 'fixture-refresh', expiresAt: 0 };
  let refresh = 0, writes = 0, apiCalls = 0;
  const api = new GoogleApi(config, state, async () => { writes++; }, async (url, init) => {
    if (url.includes('/token')) { refresh++; assert.match(String(init?.body), /grant_type=refresh_token/); return Response.json({ access_token: `fixture-${refresh}`, expires_in: 3600 }); }
    apiCalls++; return apiCalls === 1 ? new Response('', { status: 401 }) : Response.json({ id: 'file' });
  }, () => 100);
  assert.deepEqual(await api.json('https://www.googleapis.com/drive/v3/files/file'), { id: 'file' });
  assert.equal(refresh, 2); assert.equal(writes, 2); assert.equal(apiCalls, 2);
});
test('invalid_grant blocks reauth and hostile resumable URL never receives credentials', async () => {
  const state = emptyVault(); state.oauth = { accessToken: 'expired', refreshToken: 'fixture', expiresAt: 0 };
  let calls = 0;
  const api = new GoogleApi(config, state, async () => {}, async () => { calls++; return Response.json({ error: 'invalid_grant' }, { status: 400 }); });
  await assert.rejects(() => api.json('https://www.googleapis.com/drive/v3/files'), /REAUTH/);
  assert.equal(calls, 1);
  await assert.rejects(() => api.request('https://evil.invalid/upload'), /FORBIDDEN/); assert.equal(calls, 1);
});

test('old account tab cannot send its local records into the newly logged-in account', () => {
  assert.throws(() => requireOwner('A', 'B'), /FORBIDDEN/);
  assert.throws(() => requireOwner(null, 'B'), /FORBIDDEN/);
  requireOwner('A', 'A');
});
