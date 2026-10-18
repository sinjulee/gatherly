import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { openPilotSession, activePilotSession, closePilotSession, requireSessionOperation, pilotApproval } from '../lib/gatherly-2/integration/pilot-session';
import { requireWriteUser } from '../lib/gatherly-2/integration/write-access';
import { emptyVault } from '../lib/gatherly-2/integration/vault';
import { PilotStorage, pilotData, pilotRecord, reservePilot } from '../lib/gatherly-2/integration/pilot-storage';
import { harness } from './helpers/pilot-google';
const uid='00000000-0000-4000-8000-000000000001', now=Date.now();
const env={VERCEL:'1',VERCEL_ENV:'production',GATHERLY_V2_ENVIRONMENT:'production',GATHERLY_V2_INTEGRATION_ENABLED:'true',GATHERLY_V2_GOOGLE_WRITES_ENABLED:'false',GATHERLY_V2_PRODUCTION_WRITE_USER_ID:uid,GATHERLY_V2_PRODUCTION_ALLOWED_USER_IDS:uid,GATHERLY_V2_PILOT_APPROVAL_ID:'00000000-0000-4000-8000-000000000015',GATHERLY_V2_PILOT_STATE:'open',GATHERLY_V2_PILOT_STARTS_AT:new Date(now-60000).toISOString(),GATHERLY_V2_PILOT_ENDS_AT:new Date(now+3600000).toISOString()};
const save=async()=>{};
const record=(id:string)=>pilotRecord({id,fieldDayId:'storage-test-event',exhibitorId:'storage-test-company',title:'fixture',text:'note',kind:'NOTE',revision:1});
test('session requires server approval, production owner and bounded time; false still blocks files',async()=>{
 for(const patch of [{GATHERLY_V2_PILOT_APPROVAL_ID:''},{GATHERLY_V2_PILOT_STATE:'closed'},{GATHERLY_V2_ENVIRONMENT:'preview'},{GATHERLY_V2_PRODUCTION_WRITE_USER_ID:''}])assert.throws(()=>pilotApproval(uid,{...env,...patch},now));
 assert.throws(()=>pilotApproval('00000000-0000-4000-8000-000000000002',env,now));
 assert.throws(()=>pilotApproval(uid,env,now+3600000));assert.throws(()=>pilotApproval(uid,env,now-120000));
 const run=await openPilotSession(emptyVault(),uid,save,env,now);assert.equal(run.status,'OPEN');
 assert.throws(()=>requireWriteUser(uid,env),/DISABLED/);
});
test('repeat and concurrent opens reuse server UUID and quota; old state is byte-preserved',async()=>{
 const state=emptyVault(),old=pilotData(state);old.requests=7;old.records['old-operation:1']={hash:'old',revision:1};
 const before=JSON.stringify(old);let saves=0;const persist=async()=>{saves++;};
 const [a,b]=await Promise.all([openPilotSession(state,uid,persist,env,now),openPilotSession(state,uid,persist,env,now)]);
 assert.equal(a.id,b.id);assert.equal(saves,1);assert.notEqual(a.id,env.GATHERLY_V2_PILOT_APPROVAL_ID);assert.equal(new Set(Object.values(a.operations)).size,3);
 a.data.requests=3;assert.equal((await openPilotSession(state,uid,persist,env,now)).data.requests,3);assert.equal(JSON.stringify(state.pilot),before);
});
test('client session IDs and old operation IDs cannot select a new budget',async()=>{
 const state=emptyVault(),a=await openPilotSession(state,uid,save,env,now);
 assert.throws(()=>activePilotSession(state,uid,crypto.randomUUID(),env,now),/CONFLICT/);
 assert.throws(()=>requireSessionOperation(a,record(uid)),/CONFLICT/);
 requireSessionOperation(a,record(a.operations.note));
 const next={...env,GATHERLY_V2_PILOT_APPROVAL_ID:crypto.randomUUID()};const b=await openPilotSession(state,uid,save,next,now);
 assert.throws(()=>activePilotSession(state,uid,a.id,next,now),/CONFLICT/);assert.throws(()=>requireSessionOperation(b,record(a.operations.note)),/CONFLICT/);
 assert.notEqual(a.id,b.id);assert.equal(Object.keys(state.pilotSessions!).length,2);
});
test('each session keeps one immutable record per kind; failures consume requests, retries keep slots',async()=>{
 const run=await openPilotSession(emptyVault(),uid,save,env,now),slot=record(run.operations.note);
 await reservePilot(run.data,slot,save);await reservePilot(run.data,slot,save);assert.equal(run.data.requests,2);
 await assert.rejects(reservePilot(run.data,{...slot,hash:'changed'},save),/CONFLICT/);
 run.data.requests=30;await assert.rejects(reservePilot(run.data,slot,save),/LIMIT/);
});
test('closed, expired and modified approval windows cannot reopen or reset a session',async()=>{
 const state=emptyVault(),run=await openPilotSession(state,uid,save,env,now);run.data.requests=4;
 await closePilotSession(state,uid,run.id,save,env);await closePilotSession(state,uid,run.id,save,env);
 assert.equal((await openPilotSession(state,uid,save,env,now)).status,'CLOSED');assert.equal(run.data.requests,4);
 assert.throws(()=>activePilotSession(state,uid,run.id,env,now),/CONFLICT/);
 await assert.rejects(openPilotSession(state,uid,save,{...env,GATHERLY_V2_PILOT_ENDS_AT:new Date(now+7200000).toISOString()},now),/CONFLICT/);
 assert.throws(()=>activePilotSession(state,uid,run.id,env,now+3600001));
});
test('session save failure stops before any Google work',async()=>{
 await assert.rejects(openPilotSession(emptyVault(),uid,async()=>{throw new Error('fixture save failed');},env,now),/save failed/);
});
test('session Google resources use distinct markers and reuse within a session without touching legacy resources',async()=>{
 const h=harness();const old=pilotData(h.state);old.resources.root={id:'legacy-root'};const snapshot=JSON.stringify(old);
 const a=await openPilotSession(h.state,uid,h.save,env,now);
 const p=new PilotStorage(h.api,a.data,h.save,'production:fixture',a.id);
 await p.upload(record(a.operations.note));const creates=h.counts().resourceCreates;
 await p.upload(record(a.operations.note));assert.equal(h.counts().resourceCreates,creates);
 const firstMarkers=[...h.files.values()].map(f=>f.appProperties?.gatherlyKey).filter(Boolean);
 // Separate harness avoids pretending its deliberately simplified tab mock isolates spreadsheets.
 const other=harness(),b=await openPilotSession(other.state,uid,other.save,{...env,GATHERLY_V2_PILOT_APPROVAL_ID:crypto.randomUUID()},now);
 await new PilotStorage(other.api,b.data,other.save,'production:fixture',b.id).upload(record(b.operations.note));
 const nextMarkers=[...other.files.values()].map(f=>f.appProperties?.gatherlyKey).filter(Boolean);
 assert(firstMarkers.every(m=>!nextMarkers.includes(m)));assert.equal(JSON.stringify(h.state.pilot),snapshot);
});

test('browser new-session mapping uses server operations and leaves legacy DB and deletion markers intact',async()=>{
 const { BrowserWorkspace }=await import('../lib/gatherly-2/browser-storage');
 const { syncPilot }=await import('../lib/gatherly-2/integration/pilot-browser');
 const ctx={userId:uid,fieldDayId:'storage-test-event',exhibitorId:'storage-test-company'};
 const old=new BrowserWorkspace('legacy-'+crypto.randomUUID()),fresh=new BrowserWorkspace('session-'+crypto.randomUUID());
 const audio={...ctx,id:crypto.randomUUID(),kind:'MEDIA' as const,title:'old',blob:new Blob(['old'],{type:'audio/mp4'}),revision:1,state:'FAILED_RETRYABLE' as const,attempts:2,nextAttemptAt:0};
 await old.put(audio);await old.deletePilotLocal(audio,uid);assert.deepEqual(await old.deletedPilotKinds(uid),['audio']);
 await fresh.saveNote({...ctx,title:'new',text:'new'});
 for(const mime of ['image/png','audio/mp4'])await fresh.put({...audio,id:crypto.randomUUID(),state:'LOCAL_PENDING',attempts:0,blob:new Blob(['new'],{type:mime})});
 const run=await openPilotSession(emptyVault(),uid,save,env,now),seen:string[]=[];
 await syncPilot(fresh,uid,async(_url,init)=>{const form=init!.body as FormData;assert.equal(form.get('sessionId'),run.id);const id=JSON.parse(String(form.get('record'))).id;assert(Object.values(run.operations).includes(id));assert.notEqual(id,audio.id);seen.push(id);return Response.json({done:true});},run);
 await assert.rejects(syncPilot(fresh,uid,async()=>{throw new Error('must not send');},{...run,readOnly:true}),/종료된/);
 assert.equal(new Set(seen).size,3);assert.deepEqual(await old.list(uid),[]);assert.deepEqual(await old.deletedPilotKinds(uid),['audio']);
 await assert.rejects(old.put(audio),/이미 로컬 삭제/);
});
