// Run only against an isolated build, without environment files or the private map.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { once } from 'node:events';

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
let reads = 0;
const fixture = createServer((request, response) => {
  response.setHeader('Content-Type', 'application/json');
  const id = Object.keys(tokens).find(id => request.headers.authorization === `Bearer ${tokens[id]}`);
  if (request.url === '/auth/v1/user') {
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
  assert.equal(approvedHtml.includes('disabled=""'), !consentUIEnabled);
  assert.match(approvedHtml, /현재 Google 파일 저장은 비활성/);
  for (const session of [undefined, cookie(denied), cookie(denied, approved)]) {
    const page = await status('/v2?success=true', 200, session);
    const html = await page.text();
    assert(!html.includes('action="/api/v2/google/connect"'));
    assert(!html.includes('연결 정보를 암호화해 안전하게 저장'));
  }
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
  console.log(JSON.stringify({ result: 'PASS', httpChecks: checks, consentUIEnabled, actualGoogleWrites: 0, fixtureOnly: true }));
} finally {
  server.kill('SIGTERM');
  if (server.exitCode === null) await once(server, 'exit');
  await new Promise(resolve => fixture.close(resolve));
}
