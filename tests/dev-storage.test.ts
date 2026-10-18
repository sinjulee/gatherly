import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { devProfile, requireDevUser } from '../lib/gatherly-2/integration/dev-profile';
import { environmentUser } from '../lib/gatherly-2/integration/environment';
import { devData, reserveDev, DevStorage } from '../lib/gatherly-2/integration/dev-storage';
import { emptyVault } from '../lib/gatherly-2/integration/vault';
import { pilotRecord } from '../lib/gatherly-2/integration/pilot-storage';
import { BrowserWorkspace } from '../lib/gatherly-2/browser-storage';
import { syncDevItem, devWorkspaceName } from '../lib/gatherly-2/integration/dev-browser';
import { devUploadReasons } from '../lib/gatherly-2/dev-ui';
import { harness } from './helpers/pilot-google';
const uid='00000000-0000-4000-8000-000000000001';
const env={VERCEL:'1',VERCEL_ENV:'preview',VERCEL_PROJECT_ID:'prj_dev_fixture',GATHERLY_V2_DEV_VERCEL_PROJECT_ID:'prj_dev_fixture',GATHERLY_V2_ENVIRONMENT:'preview',GATHERLY_V2_DEV_STORAGE_ENABLED:'true',GATHERLY_V2_DEV_SUPABASE_PROJECT_REF:'aaaaaaaaaaaaaaaaaaaa',NEXT_PUBLIC_SUPABASE_URL:'https://aaaaaaaaaaaaaaaaaaaa.supabase.co',GATHERLY_V2_VAULT_BACKEND:'supabase',GATHERLY_V2_DEV_WRITE_USER_ID:uid,GATHERLY_V2_PREVIEW_ALLOWED_USER_IDS:uid,GATHERLY_V2_INTEGRATION_ENABLED:'true',GATHERLY_V2_GOOGLE_WRITES_ENABLED:'true'};
const note=(id=crypto.randomUUID())=>pilotRecord({id,fieldDayId:'storage-test-event',exhibitorId:'storage-test-company',title:'fixture',text:'note',kind:'NOTE',revision:1});
test('dev profile rejects Production deployment/database/project and other users before any storage',()=>{
 assert.equal(requireDevUser(uid,env,true).scope,'preview');
 for(const patch of [{VERCEL_ENV:'production'},{GATHERLY_V2_ENVIRONMENT:'production'},{VERCEL_PROJECT_ID:'prj_rVB8Km0yCOQSWLTcqYGsa0YHhyH7'},{GATHERLY_V2_DEV_SUPABASE_PROJECT_REF:'rmjyonrmlbarvtaazurc',NEXT_PUBLIC_SUPABASE_URL:'https://rmjyonrmlbarvtaazurc.supabase.co'},{GATHERLY_V2_PREVIEW_ALLOWED_USER_IDS:uid+',other'},{GATHERLY_V2_DEV_STORAGE_ENABLED:'false'},{GATHERLY_V2_GOOGLE_WRITES_ENABLED:'false'}]) assert.throws(()=>requireDevUser(uid,{...env,...patch},true));
 assert.throws(()=>environmentUser('other',env));
 assert.doesNotThrow(()=>devProfile({...env,GATHERLY_V2_DEV_WRITE_USER_ID:undefined,GATHERLY_V2_PREVIEW_ALLOWED_USER_IDS:''})); // login bootstrap only
 assert.throws(()=>requireDevUser(uid,{...env,GATHERLY_V2_DEV_WRITE_USER_ID:undefined}));
});
test('multiple same-kind operations allowed; immutable retries consume request budget, not storage again',async()=>{
 const s=emptyVault();s.pilot={resources:{},records:{},slots:{},requests:7,googleRequests:1,checks:0};const old=JSON.stringify(s.pilot),d=devData(s),a=note(),b=note();
 await reserveDev(d,a,async()=>{});await reserveDev(d,b,async()=>{});await reserveDev(d,a,async()=>{});
 assert.equal(Object.keys(d.operations).length,2);assert.equal(d.requests,3);assert.equal(JSON.stringify(s.pilot),old);
 await assert.rejects(reserveDev(d,{...a,hash:'different'},async()=>{}),/CONFLICT/);
 d.requests=10000;await assert.rejects(reserveDev(d,a,async()=>{}),/LIMIT/);
});
test('dev count and byte quotas persist without resetting past records',async()=>{
 const d=devData(emptyVault());for(let i=0;i<100;i++)await reserveDev(d,note(),async()=>{});
 await assert.rejects(reserveDev(d,note(),async()=>{}),/LIMIT/);
 const b=devData(emptyVault());b.bytes=100*1024*1024;
 const media=pilotRecord({...note().record,fieldDayId:'storage-test-event',exhibitorId:'storage-test-company',kind:'MEDIA'},{size:1,mimeType:'image/png',sha256:'a'.repeat(64)});
 await assert.rejects(reserveDev(b,media,async()=>{}),/LIMIT/);
});
test('dev Google target uses new resources; multiple notes/retry/readback preserve production ledger',async()=>{
 const h=harness(),before=JSON.stringify(h.state.resources),d=devData(h.state),a=note(),b=note();
 const storage=new DevStorage(h.api,d,h.save,'dev-storage-v1:fixture:preview:owner');
 await storage.upload(a,0);const creates=h.counts().resourceCreates;
 await storage.upload(a,0);assert.equal(h.counts().resourceCreates,creates);await storage.upload(b,0);
 assert.equal(await storage.status(a.record.id),'VERIFIED');assert.equal(await storage.status(b.record.id),'VERIFIED');
 assert.equal(JSON.stringify(h.state.resources),before);
 assert([...h.files.values()].some(f=>'name' in f && f.name==='Gatherly 개발 전용 테스트'));
});
test('one item enables upload, failures keep same operation and deletion prevents resurrection',async()=>{
 const db=new BrowserWorkspace(devWorkspaceName('preview',crypto.randomUUID())),r={userId:uid,fieldDayId:'storage-test-event',exhibitorId:'storage-test-company',id:crypto.randomUUID(),title:'note',text:'test',kind:'NOTE' as const,revision:1,state:'LOCAL_PENDING' as const,attempts:0,nextAttemptAt:0};
 await db.put(r);assert.deepEqual(devUploadReasons(r,true,true,false,true),[]);
 const ids:string[]=[];
 await assert.rejects(syncDevItem(db,uid,r,async(url,init)=>{assert.equal(url,'/api/v2/dev-storage');const f=init!.body as FormData;assert(!f.has('sessionId'));ids.push(JSON.parse(String(f.get('record'))).id);return Response.json({error:'RETRY',diagnostic:'DRIVE_UPLOAD_STATUS_FAILED'},{status:503});}));
 assert.equal((await db.list(uid))[0].state,'FAILED_RETRYABLE');
 await syncDevItem(db,uid,r,async(_url,init)=>{ids.push(JSON.parse(String((init!.body as FormData).get('record'))).id);return Response.json({done:true});});assert.deepEqual(ids,[r.id,r.id]);
 await db.deletePilotLocal(r,uid);await assert.rejects(syncDevItem(db,uid,r),/삭제/);assert.deepEqual(await db.list(uid),[]);
 await db.put({...r,id:crypto.randomUUID()});assert.deepEqual(devUploadReasons((await db.list(uid))[0],true,true,false,true),[]);
});
