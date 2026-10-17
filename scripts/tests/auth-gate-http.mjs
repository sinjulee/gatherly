// Run only against an isolated build, without environment files or the private map.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { once } from 'node:events';
import { createCipheriv, randomBytes, createHash } from 'node:crypto';

const source = process.env.AUTH_GATE_BUILD_SOURCE;
assert(source && path.resolve(source) !== process.cwd(), 'An isolated build is required');
for (const name of ['.env', '.env.local', '.env.production', '.env.production.local', 'prisma/dev.db', 'docs/gatherly-2.0/v0.5_assets/ESG_2026_Official_BoothMap_TitleRemoved_Reference.png']) {
  assert(!existsSync(path.join(source, name)), 'Private source must be excluded');
}
const approved = '00000000-0000-0000-0000-000000000001';
const denied = '00000000-0000-0000-0000-000000000002';
const jwt = id => ['eyJhbGciOiJIUzI1NiJ9', Buffer.from(JSON.stringify({ sub: id, exp: Math.floor(Date.now()/1000)+3600, role: 'authenticated' })).toString('base64url'), 'fixture'].join('.');
const tokens = { [approved]: jwt(approved), [denied]: jwt(denied) };
const cookie = (id, claim = id) => `sb-127-auth-token=base64-${Buffer.from(JSON.stringify({ access_token: tokens[id], refresh_token: 'fixture', expires_at: Math.floor(Date.now()/1000)+3600, user: { id: claim, user_metadata: { is_admin: true } } })).toString('base64url')}`;
const vaultKey = Buffer.alloc(32, 7); // Local fixture only, never a deployment credential.
let vaultReads = 0;
let vaultConnected = true;
function fixtureCiphertext() {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', vaultKey, iv);
  cipher.setAAD(Buffer.from(`production:${approved}`));
  const state = { resources: {}, records: {}, ...(vaultConnected ? { oauth: { accessToken: 'fixture-private', refreshToken: 'fixture-refresh', expiresAt: 1 } } : {}) };
  const data = Buffer.concat([cipher.update(JSON.stringify(state)), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64');
}
let reads = 0;
let expectedChallenge;
let exchanges = 0;
const fixture = createServer(async (request, response) => {
  response.setHeader('Content-Type', 'application/json');
  const id = Object.keys(tokens).find(id => request.headers.authorization === `Bearer ${tokens[id]}`);
  if (request.url === '/auth/v1/token?grant_type=pkce') {
    let raw = '';
    for await (const chunk of request) raw += chunk;
    const body = JSON.parse(raw);
    const valid = body.auth_code === 'fixture-login-code' && typeof body.code_verifier === 'string'
      && createHash('sha256').update(body.code_verifier).digest('base64url') === expectedChallenge;
    exchanges++;
    response.statusCode = valid ? 200 : 400;
    response.end(JSON.stringify(valid
      ? { access_token: tokens[approved], refresh_token: 'fixture-refresh', expires_in: 3600, token_type: 'bearer', user: { id: approved, aud: 'authenticated' } }
      : { code: 'bad_code_verifier', message: 'fixture' }));
  } else if (request.url === '/rest/v1/rpc/g2_vault_claim' || request.url === '/rest/v1/rpc/g2_vault_release') {
    let raw = ''; for await (const chunk of request) raw += chunk;
    const args = JSON.parse(raw);
    assert.equal(args.p_user, approved); assert.equal(args.p_environment, 'production');
    if (request.url.endsWith('claim')) { vaultReads++; response.end(JSON.stringify({ ciphertext: fixtureCiphertext(), revision: 1 })); }
    else response.end('true');
  } else if (request.url === '/auth/v1/user') {
    response.statusCode = id ? 200 : 401;
    response.end(JSON.stringify(id ? { id, aud: 'authenticated', is_anonymous: false, user_metadata: { is_admin: true } } : { message: 'unauthorized' }));
  } else if (request.url?.startsWith('/rest/v1/') && request.method === 'GET' && id === approved) {
    reads++; response.end('[]');
  } else { response.statusCode = 403; response.end('{}'); }
});
// NEXT_PUBLIC_SUPABASE_URL must also use this fixture address at build time.
await new Promise(resolve => fixture.listen(3218, '127.0.0.1', resolve));
// NextURL normalizes loopback hostnames to localhost for Origin comparison.
const base = 'http://localhost:3217';
const consentUIEnabled = process.env.AUTH_GATE_CONSENT_UI_ENABLED === '1';
const env = { ...process.env };
for (const key of Object.keys(env)) if (/^(GATHERLY_|NEXT_PUBLIC_SUPABASE|VERCEL)/.test(key)) delete env[key];
Object.assign(env, {
  VERCEL: '1', VERCEL_ENV: 'production', GATHERLY_V2_ENVIRONMENT: 'production',
  GATHERLY_V2_APP_ORIGIN: base, GATHERLY_V2_INTEGRATION_ENABLED: 'true', GATHERLY_V2_AUTH_ONLY: 'true',
  GATHERLY_V2_PRODUCTION_ALLOWED_USER_IDS: approved, GATHERLY_V2_PREVIEW_ALLOWED_USER_IDS: denied,
  GATHERLY_V2_GOOGLE_CONSENT_ENABLED: String(consentUIEnabled), GATHERLY_V2_GOOGLE_WRITES_ENABLED: 'false',
  GATHERLY_V2_TOKEN_ENCRYPTION_KEY: vaultKey.toString('base64'), GATHERLY_V2_SUPABASE_SECRET_KEY: 'fixture-server', GATHERLY_V2_VAULT_BACKEND: 'supabase',
  NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${fixture.address().port}`, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'fixture',
});
const server = spawn(process.execPath, [path.resolve('node_modules/next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', '3217'], { cwd: source, env, stdio: ['ignore', 'pipe', 'pipe'] });
let serverLog = '';
server.stdout.on('data', data => { serverLog += data.toString(); });
server.stderr.on('data', data => { serverLog += data.toString(); });
let checks = 0;
async function status(route, expected, session, method = 'GET') {
  const response = await fetch(base + route, { method, redirect: 'manual', headers: { origin: base, ...(session ? { cookie: session } : {}), 'x-user-id': approved, 'x-gatherly-environment': 'preview' } });
  assert.equal(response.status, expected, `${method} ${route}`); checks++; return response;
}
try {
  let ready = false;
  const startupStatuses = new Set();
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw new Error('Isolated server exited');
    try { const response = await fetch(base + '/v2', { redirect: 'manual', signal: AbortSignal.timeout(2000) }); startupStatuses.add(response.status); if (response.ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  // Print only known error categories; never dump response bodies or credentials.
  assert(ready, `Isolated server startup failed: HTTP ${[...startupStatuses].join(',')}; ${['EADDRINUSE', 'DISABLED', 'MODULE_NOT_FOUND', 'fetch failed', 'Invalid API key'].filter(code => serverLog.includes(code)).join(',')}`);
  for (const route of ['/api/v2/catalog?exhibition=' + approved, '/api/v2/map', '/api/v2/voice', '/api/v2/google/callback?state=fixture']) {
    await status(route, 401);
    await status(route, 403, cookie(denied));
    await status(route, 403, cookie(denied, approved));
  }
  assert.equal(reads, 0, 'Denied requests must never reach catalogue reads');
  const allowed = await status('/v2', 200, cookie(approved));
  const approvedHtml = await allowed.text();
  assert.match(approvedHtml, /승인된 사용자입니다/);
  assert.match(approvedHtml, /Google Drive·Sheets 연결/);
  assert.match(approvedHtml, /action="\/api\/v2\/google\/connect"/);
  assert.equal(approvedHtml.match(/<form action="\/api\/v2\/google\/connect"[\s\S]*?<\/form>/)?.[0].includes('disabled=""'), !consentUIEnabled);
  assert.match(approvedHtml, /현재 Google 파일 저장은 비활성/);
  for (const session of [undefined, cookie(denied), cookie(denied, approved)]) {
    const page = await status('/v2?success=true', 200, session);
    const html = await page.text();
    assert(!html.includes('action="/api/v2/google/connect"'));
    assert(!html.includes('연결 정보를 암호화해 안전하게 저장'));
  }
  for (const [identity, expected] of [[undefined, 401], [cookie(denied), 403], [cookie(denied, approved), 403]]) {
    const response = await status('/api/v2/google/status?userId=' + approved + '&environment=preview', expected, identity, 'POST');
    assert.deepEqual(await response.json(), { status: 'ERROR', apiAvailability: 'NOT_CHECKED' });
    const page = await status('/v2/storage-test', 200, identity);
    assert(!(await page.text()).includes('사진 수집'));
  }
  const testPage = await status('/v2/storage-test', 200, cookie(approved));
  const testHtml = await testPage.text();
  assert.match(testHtml, /임시 테스트 행사/); assert.match(testHtml, /사진 수집/);
  assert.match(testHtml, /Google 원격 업로드/); assert(!testHtml.includes('src="/api/v2/map"'));
  assert.equal(vaultReads, 0, 'Unapproved status calls never claim a Vault');
  const storedStatus = await status('/api/v2/google/status?userId=' + denied + '&environment=preview', 200, cookie(approved), 'POST');
  assert.deepEqual(await storedStatus.json(), { status: 'CONNECTED', apiAvailability: 'NOT_CHECKED' });
  vaultConnected = false;
  const emptyStatus = await status('/api/v2/google/status', 200, cookie(approved), 'POST');
  assert.deepEqual(await emptyStatus.json(), { status: 'NOT_CONNECTED', apiAvailability: 'NOT_CHECKED' });
  assert.equal(vaultReads, 2);
  const catalogue = await status('/api/v2/catalog?exhibition=' + approved, 200, cookie(approved));
  assert.deepEqual(await catalogue.json(), { exhibitors: [], hotspots: [] });
  assert(reads > 0, 'Approved request reaches the authenticated catalogue adapter');
  const map = await status('/api/v2/map', 503, cookie(approved));
  assert.deepEqual(await map.json(), { error: 'MAP_NOT_CONFIGURED' });
  await status('/api/v2/voice', 404, cookie(approved));
  const approvedSession = cookie(approved);
  for (const session of [undefined, cookie(denied), approvedSession]) {
    for (const route of ['/api/v2/media', '/api/v2/sync', '/api/v2/google/connect']) {
      const expected = consentUIEnabled && route.endsWith('/connect') && session !== approvedSession
        ? (session ? 403 : 401) : 503;
      const response = await status(route, expected, session, 'POST');
      assert.deepEqual(await response.json(), { error: expected === 401 ? 'UNAUTHORIZED' : expected === 403 ? 'FORBIDDEN' : 'DISABLED' });
    }
  }
  const identity = await status('/v2/auth-complete', 200, cookie(denied));
  const html = await identity.text(); assert(html.includes(denied)); assert(!html.includes(approved));
  assert(html.includes('Gatherly 연결 화면으로 이동'));
  await status('/phase-one', 307, cookie(denied));
  for (const route of ['/api/reports', '/api/materials', '/docs/gatherly-2.0/v0.5_assets/ESG_2026_Official_BoothMap_TitleRemoved_Reference.png']) await status(route, 404, cookie(approved));
  // Fresh-browser lifecycle through real Next handlers, not a pre-made auth cookie.
  const started = await status('/api/v2/auth/login', 303, undefined, 'POST');
  assert.equal(started.headers.get('x-gatherly-auth-stage'), 'oauth_redirect');
  assert.match(started.headers.get('cache-control'), /no-store/);
  const authorize = new URL(started.headers.get('location'));
  assert.equal(authorize.searchParams.get('redirect_to'), `${base}/api/v2/auth/callback`);
  expectedChallenge = authorize.searchParams.get('code_challenge');
  assert(expectedChallenge);
  const pending = started.headers.getSetCookie();
  assert(pending.some(value => value.includes('code-verifier') && /SameSite=lax/i.test(value)));
  assert(pending.every(value => /Path=\//i.test(value) && !/Domain=/i.test(value)));
  const missing = await status('/api/v2/auth/callback?code=fixture-login-code', 401);
  assert.deepEqual(await missing.json(), { error: 'UNAUTHORIZED', stage: 'session_exchange', reason: 'PKCE_VERIFIER_MISSING' });
  assert.equal(exchanges, 0, 'Missing verifier must fail before the token endpoint');
  const pendingCookie = pending.map(value => value.split(';')[0]).join('; ');
  const completed = await fetch(`${base}/api/v2/auth/callback?code=fixture-login-code`, {
    redirect: 'manual', headers: { cookie: pendingCookie, 'sec-fetch-site': 'cross-site',
      'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1' },
  });
  assert.equal(completed.status, 303); checks++;
  assert.equal(completed.headers.get('x-gatherly-auth-result'), 'OK');
  assert.equal(completed.headers.get('location'), `${base}/v2/auth-complete`);
  assert.equal(exchanges, 1);
  const providerDenied = await status('/api/v2/auth/callback?error=fixture&error_code=bad_oauth_state&error_description=private-fixture', 401);
  assert.equal(providerDenied.headers.get('x-gatherly-auth-result'), 'OAUTH_STATE_REPORTED');
  assert(!(await providerDenied.text()).includes('private-fixture'));
  await status('/api/v2/auth/login', 405);
  for (const origin of [undefined, 'null', 'https://evil.invalid']) {
    const rejected = await fetch(`${base}/api/v2/auth/login`, { method: 'POST', redirect: 'manual',
      headers: { referer: `${base}/v2`, 'sec-fetch-site': 'same-origin', ...(origin ? { origin } : {}) } });
    assert.equal(rejected.status, 403); checks++;
    assert.equal(rejected.headers.get('x-gatherly-auth-stage'), 'login_origin');
    assert.equal(rejected.headers.has('set-cookie'), false);
  }
  const completedCookies = completed.headers.getSetCookie();
  assert(completedCookies.some(value => value.includes('code-verifier') && /Max-Age=0/i.test(value)));
  const sessionCookie = completedCookies.filter(value => !/Max-Age=0/i.test(value)).map(value => value.split(';')[0]).join('; ');
  assert(sessionCookie);
  await status('/v2/auth-complete', 200, sessionCookie);
  const freshPage = await status('/v2', 200, sessionCookie);
  assert.match(await freshPage.text(), /Google Drive·Sheets 연결/);
  const replay = await status('/api/v2/auth/callback?code=fixture-login-code', 401, sessionCookie);
  assert.equal((await replay.json()).reason, 'PKCE_VERIFIER_MISSING');
  assert.equal(exchanges, 1);
  console.log(JSON.stringify({ result: 'PASS', httpChecks: checks, consentUIEnabled, actualGoogleWrites: 0, fixtureOnly: true }));
} finally {
  server.kill('SIGTERM');
  if (server.exitCode === null) await once(server, 'exit');
  await new Promise(resolve => fixture.close(resolve));
}
