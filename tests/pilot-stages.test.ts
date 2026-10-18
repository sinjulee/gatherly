import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { GoogleApi } from '../lib/gatherly-2/integration/google';
import { PilotStorage, pilotData, pilotRecord } from '../lib/gatherly-2/integration/pilot-storage';
import { digest } from '../lib/gatherly-2/integration/storage';
import { atOperation, IntegrationError, failure, type Diagnostic } from '../lib/gatherly-2/integration/config';
import { pilotPost } from '../lib/gatherly-2/integration/pilot-browser';
import { harness } from './helpers/pilot-google';
const bytes = new Uint8Array([1,2,3]);
const slot = () => pilotRecord({ id: '00000000-0000-0000-0000-000000000001', fieldDayId:'storage-test-event', exhibitorId:'storage-test-company', title:'fixture', kind:'MEDIA', revision:1 }, { size:3,mimeType:'audio/mp4',sha256:digest(bytes) });
const config = {clientId:'fixture',clientSecret:'private-fixture',redirectUri:'https://fixture.invalid'};
const stages: Diagnostic[] = ['DRIVE_SESSION_INIT_FAILED','DRIVE_UPLOAD_STATUS_FAILED','DRIVE_CHUNK_TRANSFER_FAILED','DRIVE_UPLOAD_VERIFY_FAILED','SHEETS_INITIALIZATION_FAILED','SHEETS_HEADER_FAILED','SHEETS_ROW_WRITE_FAILED','SHEETS_ROW_VERIFY_FAILED'];
for (const stage of stages) test(`pilot classifies real adapter branch ${stage}`,async()=>{
 const h=harness(),data=pilotData(h.state);let armed=stage!=='DRIVE_UPLOAD_STATUS_FAILED', hit=false;
 const api=new GoogleApi(config,h.state,h.save,async(url,init)=>{
  const u=new URL(url),method=init?.method??'GET',range=new Headers(init?.headers).get('content-range')??'';
  const match=stage==='DRIVE_SESSION_INIT_FAILED'?u.pathname==='/upload/drive/v3/files':
   stage==='DRIVE_UPLOAD_STATUS_FAILED'?u.pathname==='/upload/session'&&range.startsWith('bytes */'):
   stage==='DRIVE_CHUNK_TRANSFER_FAILED'?u.pathname==='/upload/session'&&!range.startsWith('bytes */'):
   stage==='DRIVE_UPLOAD_VERIFY_FAILED'?u.pathname.startsWith('/drive/v3/files/media-')&&h.counts().uploads>0:
   stage==='SHEETS_INITIALIZATION_FAILED'?u.pathname.endsWith(':batchUpdate'):
   stage==='SHEETS_HEADER_FAILED'?method==='PUT'&&u.pathname.includes('!A1:I1'):
   stage==='SHEETS_ROW_WRITE_FAILED'?method==='PUT'&&u.pathname.includes('!A2:I2'):
   method==='GET'&&u.pathname.includes('!A2:I2');
  if(armed&&match){hit=true;return new Response('secret response',{status:503});}
  return h.transport(url,init);
 });
 const pilot=new PilotStorage(api,data,h.save,'production:fixture'),item=slot();
 if(!armed){await pilot.upload(item);armed=true;}
 await assert.rejects(pilot.upload(item,0,new Blob([bytes],{type:'audio/mp4'})),(e:IntegrationError)=>e.diagnostic===stage&&e.upstreamStatus===503);
 assert(hit);assert.equal(data.slots.audio!.record.id,item.record.id);
 if(stage.startsWith('SHEETS_') && ['SHEETS_ROW_WRITE_FAILED','SHEETS_ROW_VERIFY_FAILED'].includes(stage))assert.equal(h.counts().uploads,1);
});
test('semantic stages preserve Vault/token failures and their secondary release error',async()=>{
 for(const stage of ['VAULT_CLAIM_FAILED','VAULT_SAVE_FAILED','VAULT_RELEASE_FAILED','GOOGLE_TOKEN_REFRESH_FAILED'] as const){
  const original=new IntegrationError('RETRY',503,stage,500,'VAULT_RELEASE_FAILED');
  await assert.rejects(atOperation('DRIVE_SESSION_INIT_FAILED',async()=>{throw original;}),(e:unknown)=>e===original);
 }
});
test('response log and mobile error share only server correlation and bounded evidence',async()=>{
 const requestId=randomUUID(),logs:string[]=[];const previous=console.error;console.error=x=>logs.push(String(x));
 try{
  const response=failure(new IntegrationError('RETRY',503,'DRIVE_CHUNK_TRANSFER_FAILED',503),true,{requestId,remote:{file:'UNKNOWN',row:'UNKNOWN'}});
  const body=await response.json();const logged=JSON.parse(logs[0]);
  assert.equal(body.requestId,logged.requestId);assert.equal(logged.diagnostic,body.diagnostic);assert.deepEqual(body.remote,{file:'UNKNOWN',row:'UNKNOWN'});
  await assert.rejects(pilotPost(new FormData(),async()=>Response.json(body,{status:503})),e=>String(e).includes(requestId)&&String(e).includes('DRIVE_CHUNK_TRANSFER_FAILED')&&String(e).includes('원격 대조 전'));
  const malicious={...body,requestId:'secret-token',diagnostic:'secret-body'};
  await assert.rejects(pilotPost(new FormData(),async()=>Response.json(malicious,{status:503})),e=>!String(e).includes('secret-'));
 }finally{console.error=previous;}
});
test('remote evidence requires prior verification and does not infer existence from IDs',async()=>{
 const {pilotRemoteEvidence}=await import('../lib/gatherly-2/integration/pilot-storage');
 const h=harness(),data=pilotData(h.state),item=slot();
 const key=`${JSON.stringify([item.record.fieldDayId,item.record.exhibitorId,item.record.id])}:${item.record.revision}`;
 assert.deepEqual(pilotRemoteEvidence(data,item),{file:'UNKNOWN',row:'UNKNOWN'});
 data.records[key]={hash:'fixture',revision:1,fileId:'reserved',row:2};
 assert.deepEqual(pilotRemoteEvidence(data,item),{file:'UNKNOWN',row:'UNKNOWN'});
 data.records[key].driveVerified=true;
 assert.deepEqual(pilotRemoteEvidence(data,item),{file:'CONFIRMED',row:'UNKNOWN'});
 data.records[key].done=true;
 assert.deepEqual(pilotRemoteEvidence(data,item),{file:'CONFIRMED',row:'CONFIRMED'});
});
