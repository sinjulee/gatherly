import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { consentPage, consentFailure } from '../lib/gatherly-2/integration/consent-response';
import { IntegrationError } from '../lib/gatherly-2/integration/config';
import { completeGoogleConsent, vault } from '../lib/gatherly-2/integration/runtime';
import { startConsent, FILE_SCOPE } from '../lib/gatherly-2/integration/google';
import { POST as connect } from '../app/api/v2/google/connect/route';

test('consent HTML reports fixed outcomes, preserves status, and never echoes OAuth errors', async () => {
  const success = consentPage('connected');
  assert.equal(success.status, 200);
  assert.match(await success.text(), /연결 정보를 암호화해 안전하게 저장/);
  assert.match(success.headers.get('cache-control')!, /no-store/);
  assert.equal(success.headers.get('referrer-policy'), 'no-referrer');
  assert.match(await consentPage('declined').text(), /기존 연결이 있다면 그대로/);
  const request = new Request('https://fixture.invalid?success=true&error=secret', { headers: { accept: 'text/html' } });
  const failed = consentFailure(request, new Error('secret-provider-response'));
  assert.equal(failed.status, 503);
  const html = await failed.text();
  assert.match(html, /저장 완료를 확인하지 못했습니다/);
  assert(!html.includes('secret')); assert(!html.includes('연결 완료</h1>'));
  assert.equal(consentPage('error', new IntegrationError('FORBIDDEN', 403)).status, 403);
});

test('native consent form gets a readable disabled/Origin error without changing JSON clients', async () => {
  const before = { ...process.env };
  Object.assign(process.env, { GATHERLY_V2_APP_ORIGIN: 'https://fixture.invalid', GATHERLY_V2_INTEGRATION_ENABLED: 'true', GATHERLY_V2_GOOGLE_CONSENT_ENABLED: 'false' });
  try {
    const form = await connect(new Request('https://fixture.invalid/api/v2/google/connect', { method: 'POST', headers: { origin: 'https://fixture.invalid', accept: 'text/html' } }));
    assert.equal(form.status, 503); assert.match(await form.text(), /연결을 준비 중/);
    const api = await connect(new Request('https://fixture.invalid/api/v2/google/connect', { method: 'POST', headers: { origin: 'https://fixture.invalid' } }));
    assert.deepEqual(await api.json(), { error: 'DISABLED' });
    const wrong = await connect(new Request('https://other.invalid/api/v2/google/connect', { method: 'POST', headers: { origin: 'https://fixture.invalid', accept: 'text/html' } }));
    assert.equal(wrong.status, 403);
  } finally { process.env = before; }
});

test('decline validates and consumes state, preserves prior tokens, and never exchanges code', async () => {
  const before = { ...process.env }, fetchBefore = globalThis.fetch;
  Object.assign(process.env, {
    VERCEL: '0', GATHERLY_V2_ENVIRONMENT: 'development', GATHERLY_V2_INTEGRATION_ENABLED: 'true',
    GATHERLY_V2_GOOGLE_CONSENT_ENABLED: 'true', GATHERLY_V2_GOOGLE_WRITES_ENABLED: 'false',
    GATHERLY_V2_VAULT_BACKEND: 'file', GATHERLY_V2_VAULT_DIR: await mkdtemp(path.join(os.tmpdir(), 'gatherly-consent-ui-')),
    GATHERLY_V2_TOKEN_ENCRYPTION_KEY: randomBytes(32).toString('base64'), GATHERLY_V2_APP_ORIGIN: 'https://fixture.invalid',
    GATHERLY_V2_GOOGLE_REDIRECT_URI: 'https://fixture.invalid/api/v2/google/callback',
    GATHERLY_V2_GOOGLE_CLIENT_ID: 'fixture', GATHERLY_V2_GOOGLE_CLIENT_SECRET: 'fixture',
  });
  try {
    let calls = 0;
    globalThis.fetch = async () => { calls++; throw new Error('No external requests allowed'); };
    const start = startConsent({ clientId: 'fixture', clientSecret: 'fixture', redirectUri: process.env.GATHERLY_V2_GOOGLE_REDIRECT_URI! });
    await vault().locked('A', async (state, save) => { state.flow = start.flow; state.oauth = { accessToken: 'old', refreshToken: 'old-refresh', expiresAt: 1 }; await save(); });
    const denied = new URLSearchParams({ state: start.flow.state, error: 'access_denied' });
    await assert.rejects(() => completeGoogleConsent('B', denied), /FORBIDDEN/);
    assert.equal(await completeGoogleConsent('A', denied), 'declined');
    await vault().locked('A', async state => { assert.equal(state.flow, undefined); assert.equal(state.oauth?.accessToken, 'old'); });
    await assert.rejects(() => completeGoogleConsent('A', denied), /FORBIDDEN/);
    assert.equal(calls, 0);
    const next = startConsent({ clientId: 'fixture', clientSecret: 'fixture', redirectUri: process.env.GATHERLY_V2_GOOGLE_REDIRECT_URI! });
    await vault().locked('A', async (state, save) => { state.flow = next.flow; await save(); });
    globalThis.fetch = async () => Response.json({ access_token: 'new', refresh_token: 'new-refresh', expires_in: 3600, scope: FILE_SCOPE });
    assert.equal(await completeGoogleConsent('A', new URLSearchParams({ state: next.flow.state, code: 'fixture' })), 'connected');
    await vault().locked('A', async state => assert.equal(state.oauth?.accessToken, 'new'));
  } finally { globalThis.fetch = fetchBefore; process.env = before; }
});
