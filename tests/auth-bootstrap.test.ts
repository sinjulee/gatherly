import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { requireConsent } from '../lib/gatherly-2/integration/config';
import { environmentUser } from '../lib/gatherly-2/integration/environment';
import { completeGoogleConsent, vault, withGoogle } from '../lib/gatherly-2/integration/runtime';
import { FILE_SCOPE, startConsent } from '../lib/gatherly-2/integration/google';
import { ownLoginIdentity, loginDestination } from '../lib/gatherly-2/auth/server';

test('unapproved Google user can inspect only own verified identity; protected authorization still rejects', async () => {
  const id = '00000000-0000-0000-0000-000000000001';
  const env = { VERCEL: '1', VERCEL_ENV: 'production', GATHERLY_V2_ENVIRONMENT: 'production', GATHERLY_V2_AUTH_ONLY: 'true', GATHERLY_V2_INTEGRATION_ENABLED: 'true' };
  const auth = { getUser: async () => ({ data: { user: { id, email: 'private@example.invalid', user_metadata: { role: 'admin' } } }, error: null }) };
  assert.deepEqual(await ownLoginIdentity(auth, env), { id });
  assert.equal(loginDestination(id, env), '/v2/auth-complete');
  assert.throws(() => environmentUser(id, env), /FORBIDDEN/);
  assert.throws(() => loginDestination(id, { ...env, GATHERLY_V2_AUTH_ONLY: 'false' }), /FORBIDDEN/);
  assert.equal(loginDestination(id, { ...env, GATHERLY_V2_AUTH_ONLY: 'false', GATHERLY_V2_PRODUCTION_ALLOWED_USER_IDS: id }), '/v2');
  await assert.rejects(() => ownLoginIdentity(auth, { ...env, GATHERLY_V2_AUTH_ONLY: 'false' }), /DISABLED/);
  await assert.rejects(() => ownLoginIdentity({ getUser: async () => ({ data: { user: null }, error: null }) }, env), /UNAUTHORIZED/);
  await assert.rejects(() => ownLoginIdentity({ getUser: async () => ({ data: { user: { id } }, error: new Error('expired') }) }, env), /UNAUTHORIZED/);
  await assert.rejects(() => ownLoginIdentity({ getUser: async () => ({ data: { user: { id, is_anonymous: true } }, error: null }) }, env), /UNAUTHORIZED/);
});

test('consent requires explicit opt-in independently of file writes', () => {
  const env = { GATHERLY_V2_INTEGRATION_ENABLED: 'true', GATHERLY_V2_GOOGLE_WRITES_ENABLED: 'false' };
  assert.throws(() => requireConsent(env), /DISABLED/);
  requireConsent({ ...env, GATHERLY_V2_GOOGLE_CONSENT_ENABLED: 'true' });
  assert.throws(() => requireConsent({ ...env, GATHERLY_V2_INTEGRATION_ENABLED: 'false', GATHERLY_V2_GOOGLE_CONSENT_ENABLED: 'true' }), /DISABLED/);
});

test('bootstrap never admits first user or legacy global allowlist before operator UUID approval', () => {
  const id = '00000000-0000-0000-0000-000000000001';
  const env = { VERCEL: '1', VERCEL_ENV: 'production', GATHERLY_V2_ENVIRONMENT: 'production', GATHERLY_V2_ALLOWED_USER_IDS: id };
  assert.throws(() => environmentUser(id, env), /FORBIDDEN/);
  assert.equal(environmentUser(id, { ...env, GATHERLY_V2_PRODUCTION_ALLOWED_USER_IDS: id }), 'production');
  assert.throws(() => environmentUser('00000000-0000-0000-0000-000000000002', { ...env, GATHERLY_V2_PRODUCTION_ALLOWED_USER_IDS: id }), /FORBIDDEN/);
});

test('consent stores tokens with writes disabled; media action and callback replay stay blocked', async () => {
  const before = { ...process.env }, originalFetch = globalThis.fetch;
  try {
    Object.assign(process.env, {
      VERCEL: '0', GATHERLY_V2_ENVIRONMENT: 'development',
      GATHERLY_V2_INTEGRATION_ENABLED: 'true', GATHERLY_V2_GOOGLE_CONSENT_ENABLED: 'true',
      GATHERLY_V2_GOOGLE_WRITES_ENABLED: 'false', GATHERLY_V2_VAULT_BACKEND: 'file',
      GATHERLY_V2_VAULT_DIR: await mkdtemp(path.join(os.tmpdir(), 'gatherly-consent-')),
      GATHERLY_V2_TOKEN_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
      GATHERLY_V2_APP_ORIGIN: 'https://fixture.invalid',
      GATHERLY_V2_GOOGLE_REDIRECT_URI: 'https://fixture.invalid/api/v2/google/callback',
      GATHERLY_V2_GOOGLE_CLIENT_ID: 'fixture', GATHERLY_V2_GOOGLE_CLIENT_SECRET: 'fixture',
    });
    let requests = 0;
    globalThis.fetch = async (input, init) => {
      assert.equal(String(input), 'https://oauth2.googleapis.com/token');
      assert.equal(init?.method, 'POST'); requests++;
      return Response.json({ access_token: 'fixture-access', refresh_token: 'fixture-refresh', expires_in: 3600, scope: FILE_SCOPE });
    };
    const next = startConsent({ clientId: 'fixture', clientSecret: 'fixture', redirectUri: process.env.GATHERLY_V2_GOOGLE_REDIRECT_URI! });
    await vault().locked('A', async (state, save) => { state.flow = next.flow; await save(); });
    const params = new URLSearchParams({ state: next.flow.state, code: 'fixture-code' });
    await completeGoogleConsent('A', params);
    await vault().locked('A', async state => { assert.equal(state.oauth?.refreshToken, 'fixture-refresh'); assert.equal(state.flow, undefined); });
    await assert.rejects(() => completeGoogleConsent('A', params), /FORBIDDEN/);
    let fileAction = false;
    await assert.rejects(() => withGoogle('A', async () => { fileAction = true; }), /DISABLED/);
    assert.equal(fileAction, false); assert.equal(requests, 1);
  } finally {
    globalThis.fetch = originalFetch;
    for (const key of Object.keys(process.env)) if (!(key in before)) delete process.env[key];
    Object.assign(process.env, before);
  }
});
