import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { proxy } from '../proxy';
import { POST as login } from '../app/api/v2/auth/login/route';
import { GET as callback } from '../app/api/v2/auth/callback/route';
import { ownLoginIdentity, loginDestination } from '../lib/gatherly-2/auth/server';
import { environmentUser } from '../lib/gatherly-2/integration/environment';
import { requireWrites } from '../lib/gatherly-2/integration/runtime';

const canonical = 'https://gatherly-three-umber.vercel.app';
const alias = 'https://gatherly-shmlucy07-7077s-projects.vercel.app';
const env = { VERCEL: '1', VERCEL_ENV: 'production', GATHERLY_V2_ENVIRONMENT: 'production', GATHERLY_V2_APP_ORIGIN: canonical, GATHERLY_V2_INTEGRATION_ENABLED: 'true', GATHERLY_V2_AUTH_ONLY: 'true', GATHERLY_V2_PRODUCTION_ALLOWED_USER_IDS: '', GATHERLY_V2_GOOGLE_WRITES_ENABLED: 'false' };
async function configured(action: () => Promise<void>) {
  const before = { ...process.env };
  Object.assign(process.env, env);
  try { await action(); } finally {
    for (const key of Object.keys(process.env)) if (!(key in before)) delete process.env[key];
    Object.assign(process.env, before);
  }
}

test('alias login pages move to canonical host before cookies; no attacker URL or code is forwarded', () => configured(async () => {
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  for (const method of ['GET', 'HEAD']) {
    for (const pathname of ['/v2', '/v2/auth-complete']) {
      const response = await proxy(new NextRequest(`${alias}${pathname}?next=https://evil.invalid&code=fixture`, { method, headers: { 'x-forwarded-host': 'evil.invalid' } }));
      assert.equal(response.status, 307);
      assert.equal(response.headers.get('location'), `${canonical}/v2`);
      assert.match(response.headers.get('cache-control')!, /no-store/);
      assert.equal(response.headers.has('set-cookie'), false);
    }
  }
}));

test('login keeps CSRF and canonical-host checks; disabled integration is not an allowlist rejection', () => configured(async () => {
  for (const [url, origin] of [[alias, alias], [alias, canonical], [canonical, alias], [canonical, 'null'], [canonical, '']]) {
    const response = await login(new Request(`${url}/api/v2/auth/login`, { method: 'POST', headers: origin ? { origin } : {} }));
    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), { error: 'FORBIDDEN' });
    assert.equal(response.headers.has('location'), false);
  }
  process.env.GATHERLY_V2_INTEGRATION_ENABLED = 'false';
  const response = await login(new Request(`${canonical}/api/v2/auth/login`, { method: 'POST', headers: { origin: canonical } }));
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: 'DISABLED' });
}));

test('callback refuses wrong host without forwarding code and rejects missing code on canonical host', () => configured(async () => {
  const wrong = await callback(new Request(`${alias}/api/v2/auth/callback?code=fixture&next=https://evil.invalid`));
  assert.equal(wrong.status, 403);
  assert.equal(wrong.headers.has('location'), false);
  const missing = await callback(new Request(`${canonical}/api/v2/auth/callback`));
  assert.equal(missing.status, 401);
}));

test('first-user PKCE bootstrap retains verifier and returns own UID without granting data or file access', () => configured(async () => {
  const cookies = new Map<string, string>();
  const id = '00000000-0000-0000-0000-000000000001';
  let exchanges = 0;
  const client = createServerClient('https://auth.fixture.invalid', 'fixture-publishable', {
    cookies: { getAll: () => [...cookies].map(([name, value]) => ({ name, value })), setAll: values => { for (const { name, value } of values) cookies.set(name, value); } },
    global: { fetch: async (input, init) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('/token')) {
        const body = JSON.parse(String(init?.body));
        assert.equal(url.searchParams.get('grant_type'), 'pkce');
        assert.equal(body.auth_code, 'fixture-code');
        assert.ok(body.code_verifier?.length > 20);
        exchanges++;
        return Response.json({ access_token: 'fixture-access', refresh_token: 'fixture-refresh', expires_in: 3600, token_type: 'bearer', user: { id } });
      }
      assert.equal(url.pathname, '/auth/v1/user');
      return Response.json({ id, user_metadata: { role: 'admin' } });
    } },
  });
  const started = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${canonical}/api/v2/auth/callback`, skipBrowserRedirect: true } });
  assert.equal(started.error, null);
  const authorize = new URL(started.data.url!);
  assert.equal(authorize.searchParams.get('redirect_to'), `${canonical}/api/v2/auth/callback`);
  assert.equal(authorize.searchParams.get('code_challenge_method'), 's256');
  assert.ok(authorize.searchParams.get('code_challenge'));
  assert.ok([...cookies.keys()].some(key => key.includes('code-verifier')));
  assert.equal((await client.auth.exchangeCodeForSession('fixture-code')).error, null);
  assert.equal(exchanges, 1);
  assert.equal(loginDestination(id), '/v2/auth-complete');
  assert.deepEqual(await ownLoginIdentity(client.auth), { id });
  assert.throws(() => environmentUser(id), /FORBIDDEN/);
  assert.throws(() => requireWrites(), /DISABLED/);
  // A consumed/missing host cookie cannot authorize another code exchange.
  assert.ok((await client.auth.exchangeCodeForSession('fixture-replay')).error);
  assert.equal(exchanges, 1);
  await client.auth.stopAutoRefresh();
}));
