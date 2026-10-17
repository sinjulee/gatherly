import test from 'node:test';
import assert from 'node:assert/strict';
import { CloudMediaStorage } from '../lib/gatherly-2/integration/cloud-media';
import { GoogleApi } from '../lib/gatherly-2/integration/google';
import { digest, type RemoteRecord } from '../lib/gatherly-2/integration/storage';
import { emptyVault } from '../lib/gatherly-2/integration/vault';
import { MEDIA_CHUNK_BYTES } from '../lib/gatherly-2/integration/platform';
function fixture() {
  const state=emptyVault();state.oauth={accessToken:'fixture',refreshToken:'fixture',expiresAt:Date.now()+3600000};
  state.resources={root:{id:'root'},'field:field':{id:'folder'},'sheet:field':{id:'sheet'},'recordings:field':{id:'audio-folder'}};
  let data=new Uint8Array(0), metadata:{appProperties:{payloadHash:string}}|undefined; const sheet:string[][]=[];
  let failNext=false, corrupt=false, uploads=0, saves=0;
  const api=new GoogleApi({clientId:'fixture',clientSecret:'fixture',redirectUri:'https://fixture.invalid'},state,async()=>{},async(url,init)=>{
    const path=new URL(url).pathname, body=typeof init?.body==='string'?JSON.parse(init.body):null;
    if(path.endsWith('/generateIds')) return Response.json({ids:['media-id']});
    if(path==='/drive/v3/files/media-id') return data.length===MEDIA_CHUNK_BYTES+3 ? Response.json({ownedByMe:true,trashed:false,size:String(data.length),sha256Checksum:corrupt?'0'.repeat(64):digest(data),appProperties:metadata!.appProperties}):new Response('',{status:404});
    if(path.startsWith('/drive/v3/files/')) return Response.json({ownedByMe:true});
    if(path==='/upload/drive/v3/files') {metadata=body;return new Response('',{headers:{location:'https://www.googleapis.com/upload/session'}});}
    if(path==='/upload/session') {
      const range=new Headers(init?.headers).get('content-range')!;
      if(range.startsWith('bytes */')) return new Response('',{status:308,headers:data.length?{Range:`bytes=0-${data.length-1}`}:{}});
      assert(range.startsWith(`bytes ${data.length}-`)); uploads++;
      const chunk=new Uint8Array(await (init!.body as Blob).arrayBuffer()),combined=new Uint8Array(data.length+chunk.length);combined.set(data);combined.set(chunk,data.length);data=combined;
      if(failNext){failNext=false;throw new Error('lost chunk acknowledgement');}
      return data.length===MEDIA_CHUNK_BYTES+3?Response.json({id:'media-id'}):new Response('',{status:308,headers:{Range:`bytes=0-${data.length-1}`}});
    }
    if(!path.includes('/values/')) return Response.json({sheets:[{properties:{title:'notes'}},{properties:{title:'assets'}}]});
    const range=decodeURIComponent(path.split('/values/')[1]);const row=Number(range.match(/A(\d+)/)?.[1]);
    if(init?.method==='PUT'){sheet[row-1]=body.values[0];return Response.json({});}
    return Response.json({values:row?[sheet[row-1]]:sheet});
  });
  const record:RemoteRecord={id:'record',fieldDayId:'field',exhibitorId:'exhibitor',title:'audio',revision:1,kind:'MEDIA'};
  const bytes=new Uint8Array(MEDIA_CHUNK_BYTES+3).fill(7), blob=new Blob([bytes],{type:'audio/webm'}),info={size:bytes.length,mimeType:blob.type,sha256:digest(bytes)};
  return {record,blob,info,worker:()=>new CloudMediaStorage(api,state,async()=>{saves++;},'owner'),lose:()=>{failNext=true;},corrupt:()=>{corrupt=true;},counts:()=>({uploads,saves,rows:sheet.length})};
}
test('cloud chunk resume after lost acknowledgement uses remote offset and confirms checksum before Sheets',async()=>{
  const f=fixture();assert.deepEqual(await f.worker().step(f.record,f.info,0),{offset:0,done:false});
  f.lose();await assert.rejects(()=>f.worker().step(f.record,f.info,0,f.blob.slice(0,MEDIA_CHUNK_BYTES)));
  const recovered=await f.worker().step(f.record,f.info,0,f.blob.slice(0,MEDIA_CHUNK_BYTES));assert.equal(recovered.offset,MEDIA_CHUNK_BYTES);
  const result=await f.worker().step(f.record,f.info,recovered.offset,f.blob.slice(recovered.offset));assert.equal(result.done,true);assert.equal(result.driveFileId,'media-id');
  assert.equal((await f.worker().step(f.record,f.info,0)).done,true);assert.equal(f.counts().uploads,2);assert.equal(f.counts().rows,2);
});
test('cloud media oversized chunks and changed payload are rejected; checksum mismatch never marks synced',async()=>{
  const f=fixture();await assert.rejects(()=>f.worker().step(f.record,f.info,0,f.blob),/INVALID/);
  await f.worker().step(f.record,f.info,0);
  await assert.rejects(()=>f.worker().step(f.record,{...f.info,sha256:'a'.repeat(64)},0),/CONFLICT/);
  await f.worker().step(f.record,f.info,0,f.blob.slice(0,MEDIA_CHUNK_BYTES));f.corrupt();
  await assert.rejects(()=>f.worker().step(f.record,f.info,MEDIA_CHUNK_BYTES,f.blob.slice(MEDIA_CHUNK_BYTES)),/CONFLICT/);assert.equal(f.counts().rows,0);
});
