import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { BrowserWorkspace } from '../lib/gatherly-2/browser-storage';
import { syncPilot } from '../lib/gatherly-2/integration/pilot-browser';
const context={userId:'fixture',fieldDayId:'storage-test-event',exhibitorId:'storage-test-company'};
test('pilot browser preserves frozen originals on failure, retries same ID, skips completed records',async()=>{
  Object.defineProperty(navigator,'locks',{configurable:true,value:{request:async(_:string,fn:()=>Promise<unknown>)=>fn()}});
  const db=new BrowserWorkspace('pilot-'+crypto.randomUUID());await db.saveNote({...context,title:'fixture',text:'first'});
  const original=(await db.list(context.userId))[0];let calls=0;
  const transport:typeof fetch=async(_url,init)=>{calls++;assert.equal(JSON.parse(String((init!.body as FormData).get('record'))).id,original.id);return calls===1?Response.json({error:'REAUTH'},{status:401}):Response.json({done:true,offset:0});};
  await assert.rejects(()=>syncPilot(db,context.userId,transport),/Google/);
  assert.equal((await db.list(context.userId))[0].text,'first');
  await syncPilot(db,context.userId,transport);await syncPilot(db,context.userId,transport);
  assert.equal(calls,2);assert.equal((await db.list(context.userId))[0].state,'SYNCED');assert.equal((await db.list(context.userId))[0].text,'first');
});
test('pilot browser rejects multiple photos before requests and retains both local originals',async()=>{
  Object.defineProperty(navigator,'locks',{configurable:true,value:{request:async(_:string,fn:()=>Promise<unknown>)=>fn()}});
  const db=new BrowserWorkspace('pilot-'+crypto.randomUUID());
  for(let i=0;i<2;i++)await db.put({...context,id:crypto.randomUUID(),title:'fixture',kind:'MEDIA',blob:new Blob(['x'],{type:'image/png'}),revision:1,state:'LOCAL_PENDING',attempts:0,nextAttemptAt:0});
  let calls=0;await assert.rejects(()=>syncPilot(db,context.userId,async()=>{calls++;return Response.json({done:true});}),/각 1건/);
  assert.equal(calls,0);assert.equal((await db.list(context.userId)).length,2);
});
