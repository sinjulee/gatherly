import test from 'node:test';
import assert from 'node:assert/strict';
import { IntegrationError, atStage, failure } from '../lib/gatherly-2/integration/config';
import { SupabaseVault } from '../lib/gatherly-2/integration/supabase-vault';
import { GoogleApi } from '../lib/gatherly-2/integration/google';
import { emptyVault } from '../lib/gatherly-2/integration/vault';
import { pilotPost } from '../lib/gatherly-2/integration/pilot-browser';
const config = { clientId: 'fixture', clientSecret: 'private-fixture', redirectUri: 'https://example.invalid/callback' };
for (const stage of ['claim', 'save', 'release'] as const) test(`Vault ${stage} failure remains distinct`, async () => {
  const vault = new SupabaseVault({ async call(name) {
    if (name.endsWith(stage)) throw new Error('sensitive-fixture');
    return name.endsWith('claim') ? { ciphertext: null, revision: 0 } : true;
  } }, Buffer.alloc(32));
  await assert.rejects(vault.locked('fixture', async (_, save) => { if (stage === 'save') await save(); }), (e: IntegrationError) => e.diagnostic === `VAULT_${stage.toUpperCase()}_FAILED` && e.status === 503);
});
test('release failure cannot mask the original failure or report success', async () => {
  const vault = new SupabaseVault({ async call(name) { if (name.endsWith('claim')) return { ciphertext: null, revision: 0 }; throw new Error('private'); } }, Buffer.alloc(32));
  await assert.rejects(vault.locked('fixture', async () => { throw new IntegrationError('RETRY', 503, 'DRIVE_CREATE_FAILED', 500); }), (e: IntegrationError) => e.diagnostic === 'DRIVE_CREATE_FAILED' && e.secondary === 'VAULT_RELEASE_FAILED' && e.upstreamStatus === 500);
});
for (const [url, method, stage] of [
  ['https://www.googleapis.com/drive/v3/files', 'POST', 'DRIVE_CREATE_FAILED'],
  ['https://www.googleapis.com/drive/v3/files', 'GET', 'DRIVE_READ_FAILED'],
  ['https://www.googleapis.com/upload/drive/v3/files', 'PUT', 'DRIVE_UPLOAD_FAILED'],
  ['https://sheets.googleapis.com/v4/spreadsheets/fixture', 'PUT', 'SHEETS_WRITE_FAILED'],
  ['https://sheets.googleapis.com/v4/spreadsheets/fixture', 'GET', 'SHEETS_READ_FAILED'],
]) test(`Google HTTP failure: ${stage}`, async () => {
  const state = emptyVault(); state.oauth = { accessToken: 'private', refreshToken: 'private', expiresAt: Date.now()+3600000 };
  const api = new GoogleApi(config, state, async () => {}, async () => new Response('sensitive', { status: 503 }));
  await assert.rejects(api.request(url, { method }), (e: IntegrationError) => e.diagnostic === stage && e.upstreamStatus === 503);
});
test('refresh failure takes precedence over Drive stage, without exposing body', async () => {
  const state = emptyVault(); state.oauth = { accessToken: 'private', refreshToken: 'private', expiresAt: 0 };
  const api = new GoogleApi(config, state, async () => {}, async () => new Response('sensitive', { status: 429 }));
  await assert.rejects(api.request('https://www.googleapis.com/drive/v3/files'), (e: IntegrationError) => e.diagnostic === 'GOOGLE_TOKEN_REFRESH_FAILED' && e.upstreamStatus === 429);
});
test('diagnostic response/log and browser reject arbitrary secret-bearing stages', async () => {
  const logs: string[] = []; const original = console.error;
  console.error = value => logs.push(String(value));
  try {
    const response = failure(new Error('sensitive-fixture'), true);
    assert.deepEqual(await response.json(), { error: 'RETRY', diagnostic: 'UNCLASSIFIED_FAILURE' });
    assert(!logs.join('').includes('sensitive-fixture'));
  } finally { console.error = original; }
  await assert.rejects(pilotPost(new FormData(), async () => Response.json({ error: 'RETRY', diagnostic: 'VAULT_CLAIM_FAILED' }, { status: 503 })), /VAULT_CLAIM_FAILED/);
  await assert.rejects(pilotPost(new FormData(), async () => Response.json({ error: 'RETRY', diagnostic: 'sensitive-fixture' }, { status: 503 })), e => !String(e).includes('sensitive-fixture'));
  await assert.rejects(atStage('VERIFY_FAILED', async () => { throw new Error('private'); }), (e: IntegrationError) => e.diagnostic === 'VERIFY_FAILED');
});
test('network and malformed token responses remain classified, without invented HTTP status', async () => {
  for (const transport of [async () => { throw new Error('secret url'); }, async () => new Response('not-json')]) {
    const state = emptyVault(); state.oauth = { accessToken: 'private', refreshToken: 'private', expiresAt: 0 };
    const api = new GoogleApi(config, state, async () => {}, transport);
    await assert.rejects(api.request('https://www.googleapis.com/drive/v3/files'), (e: IntegrationError) => e.diagnostic === 'GOOGLE_TOKEN_REFRESH_FAILED' && e.upstreamStatus === undefined);
  }
});
