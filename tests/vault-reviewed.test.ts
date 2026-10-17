import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { SupabaseVault, type VaultRpc } from '../lib/gatherly-2/integration/supabase-vault';
import { GoogleApi } from '../lib/gatherly-2/integration/google';
import { emptyVault } from '../lib/gatherly-2/integration/vault';

const user = '00000000-0000-0000-0000-000000000001';
const first = '00000000-0000-0000-0000-000000000002';
const second = '00000000-0000-0000-0000-000000000003';

test('consent tokens survive a fresh vault instance encrypted and isolated from preview', async () => {
  const { db, rpc } = await setup();
  const key = randomBytes(32);
  try {
    await new SupabaseVault(rpc, key, 'production').locked(user, async (state, save) => {
      state.oauth = { accessToken: 'fixture-private-access', refreshToken: 'fixture-private-refresh', expiresAt: 1 };
      await save();
    });
    const stored = await db.query<{ ciphertext: string; lock_token: string | null }>(
      "select ciphertext, lock_token from g2_private.vault where environment='production' and user_id=$1", [user]);
    assert(stored.rows[0].ciphertext);
    assert(!stored.rows[0].ciphertext.includes('fixture-private'));
    assert.equal(stored.rows[0].lock_token, null);
    await new SupabaseVault(rpc, key, 'production').locked(user, async state => {
      assert.equal(state.oauth?.refreshToken, 'fixture-private-refresh');
      // An expired access token does not erase the persisted refresh credential.
      assert.equal(state.oauth?.expiresAt, 1);
    });
    await new SupabaseVault(rpc, key, 'preview').locked(user, async state => {
      assert.equal(state.oauth, undefined);
    });
  } finally { await db.close(); }
});
async function setup() {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create role outsider;
    create schema auth; create table auth.users(id uuid primary key); insert into auth.users values('${user}');
    grant usage on schema public to anon,authenticated,service_role,outsider;
    alter default privileges grant execute on functions to outsider;
    alter default privileges in schema public grant execute on functions to anon,authenticated;`);
  const sql = await readFile('docs/gatherly-2.0/sql/consent-vault-minimal-reviewed.sql', 'utf8');
  await db.exec(sql);
  const rpc: VaultRpc = { async call(name, args) {
    assert.match(name, /^g2_vault_(claim|save|release)$/);
    const entries = Object.entries(args);
    return (await db.query<{ value: unknown }>(`select public.${name}(${entries.map(([key], i) => `${key} => $${i+1}`).join(',')}) as value`, entries.map(([, value]) => value))).rows[0].value;
  } };
  return { db, sql, rpc };
}

test('reviewed install rejects duplicates; RLS and default function grants remain private', async () => {
  const { db, sql } = await setup();
  try {
    await db.exec(await readFile('docs/gatherly-2.0/sql/consent-vault-verify-readonly.sql', 'utf8'));
    assert.equal((await db.query<{ relrowsecurity: boolean }>("select relrowsecurity from pg_class where oid='g2_private.vault'::regclass")).rows[0].relrowsecurity, true);
    for (const role of ['anon', 'authenticated', 'outsider']) {
      await db.exec(`set role ${role}`);
      await assert.rejects(() => db.query('select * from g2_private.vault'), /permission denied/);
      for (const expression of [
        `public.g2_vault_claim('${user}','${first}','production')`,
        `public.g2_vault_save('${user}','${first}',0,'fixture','production')`,
        `public.g2_vault_release('${user}','${first}','production')`,
      ]) await assert.rejects(() => db.query(`select ${expression}`), /permission denied/);
      await db.exec('reset role');
    }
    await assert.rejects(() => db.exec(sql), /EXISTING_OBJECTS_REQUIRE_REVIEW/);
    await db.exec('rollback');
    assert.equal((await db.query<{ n: number }>('select count(*)::int as n from auth.users')).rows[0].n, 1);
  } finally { await db.close(); }
});

test('expired lock quarantines work; operator recovery fences stale saves and stale unlocks', async () => {
  const { db, rpc } = await setup();
  const claim = (token: string) => rpc.call('g2_vault_claim', { p_user: user, p_token: token, p_environment: 'production' }) as Promise<{ revision: number }>;
  const save = (token: string, revision: number, ciphertext: string) => rpc.call('g2_vault_save', { p_user: user, p_token: token, p_environment: 'production', p_revision: revision, p_ciphertext: ciphertext });
  try {
    await db.exec('set role service_role');
    const competing = await Promise.allSettled([claim(first), claim(second)]);
    assert.equal(competing.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal(competing[0].status, 'fulfilled');
    const a = (competing[0] as PromiseFulfilledResult<{ revision: number }>).value;
    await assert.rejects(() => db.query(`select g2_private.recover_vault('${user}','production','${first}',${a.revision})`), /permission denied/);
    await db.exec('reset role');
    await assert.rejects(() => db.query(`select g2_private.recover_vault('${user}','production','${first}',${a.revision})`), /RECOVERY_PRECONDITION/);
    // Simulate elapsed server time without sleeps; production clients cannot set a lease.
    await db.exec("update g2_private.vault set locked_at=clock_timestamp()-interval '6 minutes', lease_expires_at=clock_timestamp()-interval '1 minute'");
    await db.exec('set role service_role');
    await assert.rejects(() => save(first, a.revision, 'old'), /STALE/);
    await assert.rejects(() => claim(second), /RECOVERY_REQUIRED/);
    assert.equal(await rpc.call('g2_vault_release', { p_user: user, p_token: first, p_environment: 'production' }), false);
    await db.exec('reset role');
    await assert.rejects(() => db.query(`select g2_private.recover_vault('${user}','production','${first}',${a.revision+1})`), /RECOVERY_PRECONDITION/);
    await db.query(`select g2_private.recover_vault('${user}','production','${first}',${a.revision})`);
    await db.exec('set role service_role');
    const b = await claim(second); assert(b.revision > a.revision);
    const results = await Promise.allSettled([save(second, b.revision, 'new-A'), save(second, b.revision, 'new-B')]);
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
    await assert.rejects(() => save(first, a.revision, 'old'), /STALE/);
    await assert.rejects(() => save(second, b.revision, 'stale-revision'), /STALE/);
    assert.equal(await rpc.call('g2_vault_release', { p_user: user, p_token: first, p_environment: 'production' }), false);
    const row = (await db.query<{ ciphertext: string; lock_token: string }>('select ciphertext,lock_token from g2_private.vault')).rows[0];
    assert.match(row.ciphertext, /^new-/); assert.equal(row.lock_token, second);
  } finally { await db.close(); }
});

test('reviewed RPC works with current encrypted adapter and excludes a second refreshing worker', async () => {
  const { db, rpc } = await setup();
  try {
    await db.exec('set role service_role');
    const key = randomBytes(32), a = new SupabaseVault(rpc, key, 'production'), b = new SupabaseVault(rpc, key, 'production');
    await a.locked(user, async (state, save) => {
      state.oauth = { accessToken: 'fixture-access', refreshToken: 'fixture-refresh', expiresAt: 0 }; await save();
      await assert.rejects(() => b.locked(user, async () => assert.fail('second worker entered')), /BUSY/);
      const api = new GoogleApi({ clientId: 'fixture', clientSecret: 'fixture', redirectUri: 'https://fixture.invalid' }, state, save, async url => url.endsWith('/token') ? Response.json({ access_token: 'fixture-new', expires_in: 3600 }) : Response.json({}));
      await api.request('https://www.googleapis.com/drive/v3/files?fields=files(id)');
    });
    await b.locked(user, async state => assert.equal(state.oauth?.accessToken, 'fixture-new'));
    const ciphertext = (await db.query<{ ciphertext: string }>('select ciphertext from g2_private.vault')).rows[0].ciphertext;
    assert(!ciphertext.includes('fixture-new')); assert(!ciphertext.includes('fixture-refresh'));
  } finally { await db.close(); }
});

test('token refresh 429/500 retry and invalid_grant preserve old state and never send file request', async () => {
  for (const status of [429, 500, 400]) {
    const state = emptyVault(); state.oauth = { accessToken: 'old', refreshToken: 'refresh', expiresAt: 0 };
    let attempts = 0, files = 0, saves = 0;
    const api = new GoogleApi({ clientId: 'fixture', clientSecret: 'fixture', redirectUri: 'https://fixture.invalid' }, state, async () => { saves++; }, async url => {
      if (url.endsWith('/token')) { attempts++; return attempts === 1 ? Response.json({ error: 'invalid_grant' }, { status }) : Response.json({ access_token: 'new', expires_in: 3600 }); }
      files++; return Response.json({});
    });
    await assert.rejects(() => api.request('https://www.googleapis.com/drive/v3/files'), status === 400 ? /REAUTH/ : /RETRY/);
    assert.equal(state.oauth.accessToken, 'old'); assert.equal(saves, 0); assert.equal(files, 0);
    if (status !== 400) { await api.request('https://www.googleapis.com/drive/v3/files'); assert.equal(saves, 1); assert.equal(files, 1); }
  }
});

test('adapter never returns success when its lease expires before release', async () => {
  const { db, rpc } = await setup();
  try {
    const vault = new SupabaseVault(rpc, randomBytes(32), 'production');
    await assert.rejects(() => vault.locked(user, async () => {
      await db.exec("update g2_private.vault set locked_at=clock_timestamp()-interval '6 minutes', lease_expires_at=clock_timestamp()-interval '1 minute'");
      return 'must-not-report-success';
    }), /RETRY/);
    assert.equal((await db.query<{ locked: boolean }>('select lock_token is not null as locked from g2_private.vault')).rows[0].locked, true);
  } finally { await db.close(); }
});

test('refresh response followed by stale save cannot authorize a file operation on retry', async () => {
  const state = emptyVault(); state.oauth = { accessToken: 'old', refreshToken: 'refresh', expiresAt: 0 };
  let files = 0, saves = 0;
  const api = new GoogleApi({ clientId: 'fixture', clientSecret: 'fixture', redirectUri: 'https://fixture.invalid' }, state, async () => { saves++; throw new Error('STALE_LOCK_OR_REVISION'); }, async url => {
    if (url.endsWith('/token')) return Response.json({ access_token: 'new', expires_in: 3600 });
    files++; return Response.json({});
  });
  for (let i = 0; i < 2; i++) await assert.rejects(() => api.request('https://www.googleapis.com/drive/v3/files'), /STALE/);
  assert.equal(state.oauth.accessToken, 'old'); assert.equal(files, 0); assert.equal(saves, 2);
});
