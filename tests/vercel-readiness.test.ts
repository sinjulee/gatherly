import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { cloudRoute, isVercel, MEDIA_CHUNK_BYTES } from '../lib/gatherly-2/integration/platform';
import { SupabaseVault, type VaultRpc } from '../lib/gatherly-2/integration/supabase-vault';
import { uploadChunks } from '../lib/gatherly-2/integration/browser-media';
import { mediaInfo } from '../lib/gatherly-2/integration/cloud-media';
const A='00000000-0000-0000-0000-000000000001', B='00000000-0000-0000-0000-000000000002';
test('Vercel surface excludes legacy DB/API, allows V2 and static assets; local remains separate', () => {
  assert.equal(isVercel({}),false); assert.equal(isVercel({VERCEL:'1'}),true);
  assert.equal(cloudRoute('/'),'redirect');
  for(const path of ['/v2','/phase-one','/api/v2/media','/_next/static/media/font.woff']) assert.equal(cloudRoute(path),'allow');
  for(const path of ['/api/materials','/reports','/api/reports','/storage/file','/sw.js','/api/v20/sync']) assert.equal(cloudRoute(path),'block');
});
test('distributed vault SQL denies public access and fences concurrent workers; state survives instance changes', async () => {
  const db=new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key); grant usage on schema public to anon,authenticated,service_role; insert into auth.users values('${A}'),('${B}');`);
    await db.exec(await readFile('docs/gatherly-2.0/sql/vercel-vault-draft.sql','utf8'));
    for(const role of ['anon','authenticated']) {
      await db.exec(`set role ${role}`);
      await assert.rejects(()=>db.query(`select public.g2_vault_claim('${A}','${B}')`),/permission denied/);
      await assert.rejects(()=>db.query('select * from g2_private.vault'),/permission denied/);
    }
    await db.exec('set role service_role');
    const rpc: VaultRpc = { async call(name,args) {
      const entries=Object.entries(args);
      const result=await db.query<{value:unknown}>(`select public.${name}(${entries.map(([k],i)=>`${k} => $${i+1}`).join(',')}) as value`,entries.map(([,v])=>v));
      return result.rows[0].value;
    } };
    const key=randomBytes(32), first=new SupabaseVault(rpc,key), second=new SupabaseVault(rpc,key);
    await first.locked(A,async(state,save)=>{
      state.resources.fixture={id:'private-reference'}; await save();
      await assert.rejects(()=>second.locked(A,async()=>{}),/BUSY/);
      await assert.rejects(()=>rpc.call('g2_vault_save',{p_user:A,p_token:B,p_revision:1,p_ciphertext:'forged'}),/STALE_LOCK/);
    });
    await second.locked(A,async state=>assert.equal(state.resources.fixture.id,'private-reference'));
    await second.locked(B,async state=>assert.deepEqual(state.resources,{}));
    const row=await db.query<{ciphertext:string}>('select ciphertext from g2_private.vault where user_id=$1',[A]);
    assert(!row.rows[0].ciphertext.includes('private-reference'));
    await assert.rejects(()=>new SupabaseVault(rpc,randomBytes(32)).locked(A,async()=>{}),/REAUTH/);
    await second.locked(A,async()=>{}); // failed decrypt also releases only its own lock
  } finally {await db.close();}
});
test('large media is sent in bounded chunks, never as a full Vercel request', async()=>{
  const blob=new Blob([new Uint8Array(6*1024*1024+123)],{type:'audio/webm'});
  let offset=0, calls=0;
  const response=await uploadChunks({userId:A,fieldDayId:A,exhibitorId:B,id:A,kind:'MEDIA',title:'recording',revision:1,state:'LOCAL_PENDING',attempts:0,nextAttemptAt:0,blob},A,async(_url,init)=>{
    assert.equal(_url,'/api/v2/media'); calls++;
    const form=init!.body as FormData, chunk=form.get('chunk') as Blob|null;
    assert.equal(form.get('expectedUserId'),A);
    if(chunk) {assert(chunk.size<=MEDIA_CHUNK_BYTES); assert.equal(Number(form.get('offset')),offset); offset+=chunk.size;}
    return Response.json({offset,done:offset===blob.size,...(offset===blob.size?{driveFileId:'fixture'}:{})});
  });
  assert.equal((await response.json()).driveFileId,'fixture'); assert.equal(calls,8);
});
test('chunk protocol rejects invalid bounds/types and stops on auth failure',async()=>{
  assert.throws(()=>mediaInfo({size:30*1024*1024,mimeType:'audio/webm',sha256:'a'.repeat(64)}));
  assert.throws(()=>mediaInfo({size:10,mimeType:'text/html',sha256:'a'.repeat(64)}));
  let calls=0;
  const response=await uploadChunks({userId:A,fieldDayId:A,exhibitorId:B,id:A,kind:'MEDIA',title:'recording',revision:1,state:'LOCAL_PENDING',attempts:0,nextAttemptAt:0,blob:new Blob(['x'],{type:'audio/webm'})},A,async()=>{calls++;return Response.json({error:'REAUTH'},{status:401});});
  assert.equal(response.status,401);assert.equal(calls,1);
});
