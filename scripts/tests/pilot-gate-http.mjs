// Run only against an isolated build, without environment files or the private map.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
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
const fixture = createServer(async (request, response) => {
  response.setHeader('Content-Type', 'application/json');
  const id = Object.keys(tokens).find(id => request.headers.authorization === `Bearer ${tokens[id]}`);
  if (request.url === '/auth/v1/token?grant_type=pkce') {
    let raw = '';
    for await (const chunk of request) raw += chunk;
    const body = JSON.parse(raw);
    const valid = body.auth_code === 'fixture-login-code' && typeof body.code_verifier === 'string'
      && createHash('sha256').update(body.code_verifier).digest('base64url') === expectedChallenge;
    response.statusCode = valid ? 200 : 400;
    response.end(JSON.stringify(valid
      ? { access_token: tokens[approved], refresh_token: 'fixture-refresh', expires_in: 3600, token_type: 'bearer', user: { id: approved, aud: 'authenticated' } }
      : { code: 'bad_code_verifier', message: 'fixture' }));
  } else if (request.url === '/rest/v1/rpc/g2_vault_claim' || request.url === '/rest/v1/rpc/g2_vault_release' || request.url === '/rest/v1/rpc/g2_vault_save') {
    let raw = ''; for await (const chunk of request) raw += chunk;
    const args = JSON.parse(raw);
    assert.equal(args.p_user, approved); assert.equal(args.p_environment, 'production');
    if (request.url.endsWith('claim')) { vaultReads++; response.end(JSON.stringify({ ciphertext: fixtureCiphertext(), revision: 1 })); }
    else if(request.url.endsWith('save')) response.end(String(args.p_revision+1)); else response.end('true');
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
  GATHERLY_V2_PRODUCTION_ALLOWED_USER_IDS: approved+','+denied, GATHERLY_V2_PRODUCTION_WRITE_USER_ID: approved, GATHERLY_V2_PREVIEW_ALLOWED_USER_IDS: denied,
  GATHERLY_V2_GOOGLE_CONSENT_ENABLED: String(consentUIEnabled), GATHERLY_V2_GOOGLE_WRITES_ENABLED: 'true', GATHERLY_V2_GOOGLE_CLIENT_ID:'fixture', GATHERLY_V2_GOOGLE_CLIENT_SECRET:'fixture', GATHERLY_V2_GOOGLE_REDIRECT_URI:base+'/api/v2/google/callback',
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
  await status('/api/v2/storage-test',401,undefined,'POST');
  await status('/api/v2/storage-test',403,cookie(denied),'POST');
  await status('/api/v2/storage-test?userId='+approved+'&environment=production',403,cookie(denied,approved),'POST');
  const ownerPage=await status('/v2/storage-test',200,cookie(approved));
  assert.match(await ownerPage.text(), /아래 실저장 테스트에서 별도로 업로드/);
  const otherPage=await status('/v2/storage-test',200,cookie(denied));
  assert.match(await otherPage.text(), /서버 정책상 차단/);
  const form = new FormData(); form.set('expectedUserId',approved);form.set('action','status');
  const response=await fetch(base+'/api/v2/storage-test',{method:'POST',headers:{origin:base,cookie:cookie(approved)},body:form});
  assert.equal(response.status,200);assert.deepEqual(await response.json(),{states:{note:'NOT_UPLOADED',photo:'NOT_UPLOADED',audio:'NOT_UPLOADED'}});checks++;
  form.set('expectedUserId',denied);
  assert.equal((await fetch(base+'/api/v2/storage-test',{method:'POST',headers:{origin:base,cookie:cookie(approved)},body:form})).status,403);checks++;
  assert.equal((await fetch(base+'/api/v2/storage-test',{method:'POST',headers:{origin:'https://evil.invalid',cookie:cookie(approved)},body:form})).status,403);checks++;
  for(const route of ['/api/v2/sync','/api/v2/media'])await status(route,503,cookie(approved),'POST');
  assert.equal(reads,0);assert.equal(vaultReads,1);
  if(process.env.PILOT_TOUCH_UI==='1') await (await import('./v2-mobile-browser.mjs')).checkMobileUI(base,cookie(approved),true);
  console.log(JSON.stringify({pilotGate:'PASS',httpChecks:checks,actualGoogleWrites:0,fixtureOnly:true}));
} finally {server.kill('SIGTERM');fixture.close();}
