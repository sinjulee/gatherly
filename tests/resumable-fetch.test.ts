import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { GoogleApi } from '../lib/gatherly-2/integration/google';
import { emptyVault } from '../lib/gatherly-2/integration/vault';
import { atOperation, IntegrationError, failure } from '../lib/gatherly-2/integration/config';

const config = { clientId: 'fixture', clientSecret: 'fixture', redirectUri: 'https://fixture.invalid' };
const sessionUrl = 'https://www.googleapis.com/upload/drive/v3/files?upload_id=fixture';
const probe = { method: 'PUT', headers: { 'Content-Length': '0', 'Content-Range': 'bytes */3' } };
function state() {
  const value = emptyVault(); value.oauth = { accessToken: 'fixture', refreshToken: 'fixture', expiresAt: Date.now()+3600000 }; return value;
}
test('native fetch exposes Drive 308 without following Location; error mode reproduces lost status', async () => {
  let followed = 0, requests = 0;
  const server = http.createServer((req, res) => {
    if (req.url === '/follow') { followed++; res.end(); return; }
    requests++; assert.equal(req.method, 'PUT'); assert.equal(req.headers['content-range'], 'bytes */3'); assert.equal(req.headers['content-length'], '0');
    res.writeHead(308, req.url === '/location' ? { Location: '/follow', Range: 'bytes=0-1' } : {}); res.end();
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  try {
    for (const path of ['/empty', '/location']) {
      await assert.rejects(fetch(base+path, { ...probe, redirect: 'error' }), TypeError);
      const api = new GoogleApi(config, state(), async()=>{}, (_url, init)=>fetch(base+path, init));
      const response = await api.request(sessionUrl, probe);
      assert.equal(response.status, 308); assert.equal(response.headers.get('range'), path === '/empty' ? null : 'bytes=0-1');
    }
    assert.equal(requests, 4); assert.equal(followed, 0);
  } finally { server.closeAllConnections(); await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve())); }
});
for (const status of [200,201,308,400,403,404,410,429,500,503]) test(`resumable status ${status} remains observable or classified with original HTTP status`, async () => {
  const api = new GoogleApi(config,state(),async()=>{},async(_url,init)=>{
    assert.equal(init?.redirect,'manual'); assert.equal(new Headers(init?.headers).get('Content-Range'),'bytes */3');
    return new Response('',{status});
  });
  if(status===403 || status===429 || status>=500) await assert.rejects(atOperation('DRIVE_UPLOAD_STATUS_FAILED',()=>api.request(sessionUrl,probe)),(e:IntegrationError)=>e.diagnostic==='DRIVE_UPLOAD_STATUS_FAILED' && e.upstreamStatus===status);
  else assert.equal((await api.request(sessionUrl,probe)).status,status);
});
test('unexpected redirects never navigate; error response and log share sanitized correlation/status', async () => {
  const api=new GoogleApi(config,state(),async()=>{},async()=>new Response('',{status:307,headers:{Location:'https://invalid.example/private'}}));
  const logs:string[]=[];const original=console.error;console.error=(v)=>logs.push(String(v));
  try {
    try { await atOperation('DRIVE_UPLOAD_STATUS_FAILED',()=>api.request(sessionUrl,probe)); assert.fail('must reject'); }
    catch(e) {
      const id='00000000-0000-4000-8000-000000000001';
      const body=await failure(e,true,{requestId:id,remote:{file:'UNKNOWN',row:'UNKNOWN'}}).json();
      assert.equal(body.upstreamStatus,307);assert.equal(body.requestId,id);assert.equal(body.diagnostic,'DRIVE_UPLOAD_STATUS_FAILED');
      assert.equal(JSON.parse(logs[0]).requestId,id);assert.equal(JSON.parse(logs[0]).upstreamStatus,307);
      assert(!logs[0].includes('private'));assert(!logs[0].includes('fixture'));
    }
  } finally {console.error=original;}
});
test('non-upload API retains redirect:error and rejects untrusted session hosts before transport', async()=>{
  let calls=0;const api=new GoogleApi(config,state(),async()=>{},async(_url,init)=>{calls++;assert.equal(init?.redirect,'error');return Response.json({});});
  await api.request('https://www.googleapis.com/drive/v3/files/fixture');
  await assert.rejects(api.request('https://untrusted.invalid/upload/session',probe),/FORBIDDEN/);assert.equal(calls,1);
});

test('empty media rejected before upload; an untransferred session resumes at zero', async()=>{
  const { mediaInfo, CloudMediaStorage }=await import('../lib/gatherly-2/integration/cloud-media');
  const { digest }=await import('../lib/gatherly-2/integration/storage');
  assert.throws(()=>mediaInfo({size:0,mimeType:'audio/mp4',sha256:'a'.repeat(64)}),/INVALID/);
  const record={id:'record',fieldDayId:'field',exhibitorId:'company',kind:'MEDIA' as const,revision:1,title:'fixture'};
  const info={size:3,mimeType:'audio/mp4',sha256:digest('abc')},value=state();
  const key=JSON.stringify(['field','company','record'])+':1';
  value.records[key]={hash:digest(JSON.stringify(record)+info.sha256+info.mimeType),revision:1,media:info,fileId:'fixture',uploadUrl:sessionUrl};
  const before=JSON.stringify(value.records);let probes=0;
  const api=new GoogleApi(config,value,async()=>{},async(url,init)=>{
    if(url===sessionUrl){probes++;assert.equal(init?.redirect,'manual');assert.equal(new Headers(init?.headers).get('Content-Range'),'bytes */3');return new Response('',{status:308});}
    return new Response('',{status:404});
  });
  const result=await new CloudMediaStorage(api,value,async()=>{},'owner').step(record,info,0);
  assert.deepEqual(result,{offset:0,done:false});assert.equal(probes,1);assert.equal(JSON.stringify(value.records),before);
});
