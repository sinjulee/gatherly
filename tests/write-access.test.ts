import test from 'node:test';
import assert from 'node:assert/strict';
import { requireWriteUser } from '../lib/gatherly-2/integration/write-access';
import { withGoogle } from '../lib/gatherly-2/integration/runtime';
const owner = '00000000-0000-0000-0000-000000000001', other = '00000000-0000-0000-0000-000000000002';
const env = { VERCEL: '1', VERCEL_ENV: 'production', GATHERLY_V2_ENVIRONMENT: 'production', GATHERLY_V2_INTEGRATION_ENABLED: 'true', GATHERLY_V2_GOOGLE_WRITES_ENABLED: 'true', GATHERLY_V2_PRODUCTION_ALLOWED_USER_IDS: `${owner},${other}`, GATHERLY_V2_PRODUCTION_WRITE_USER_ID: owner };
test('write pilot permits exactly the server-designated and normally approved Production UID', () => {
  assert.doesNotThrow(() => requireWriteUser(owner, env));
  assert.throws(() => requireWriteUser(other, env), /FORBIDDEN/);
  assert.throws(() => requireWriteUser('unapproved', env), /FORBIDDEN/);
  assert.throws(() => requireWriteUser(owner, { ...env, GATHERLY_V2_PRODUCTION_ALLOWED_USER_IDS: other }), /FORBIDDEN/);
});
test('write pilot rejects blank/multiple/malformed UID and cross-environment access', () => {
  for (const value of ['', `${owner},${other}`, 'invalid']) assert.throws(() => requireWriteUser(owner, { ...env, GATHERLY_V2_PRODUCTION_WRITE_USER_ID: value }), /DISABLED/);
  assert.throws(() => requireWriteUser(owner, { ...env, VERCEL_ENV: 'preview' }), /DISABLED/);
  assert.throws(() => requireWriteUser(owner, { ...env, VERCEL_ENV: 'preview', GATHERLY_V2_ENVIRONMENT: 'preview', GATHERLY_V2_PREVIEW_ALLOWED_USER_IDS: owner }), /FORBIDDEN/);
});
test('global writes false remains authoritative even with a configured pilot owner', () => {
  assert.throws(() => requireWriteUser(owner, { ...env, GATHERLY_V2_GOOGLE_WRITES_ENABLED: 'false' }), /DISABLED/);
  assert.throws(() => requireWriteUser(owner, { ...env, GATHERLY_V2_INTEGRATION_ENABLED: 'false' }), /DISABLED/);
});
test('withGoogle rejects another approved user before Vault and any Google action', async () => {
  const before = { ...process.env }; let action = false;
  try {
    Object.assign(process.env, env);
    delete process.env.GATHERLY_V2_TOKEN_ENCRYPTION_KEY;
    await assert.rejects(() => withGoogle(other, async () => { action = true; }), /FORBIDDEN/);
    assert.equal(action, false);
  } finally { process.env = before; }
});
