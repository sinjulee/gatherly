import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { BrowserWorkspace } from '../lib/gatherly-2/browser-storage';
import { localDeleteWarning, pilotReadiness } from '../lib/gatherly-2/pilot-ui';
import type { SyncItem } from '../lib/gatherly-2/contracts';
const ctx = { userId: 'fixture', fieldDayId: 'storage-test-event', exhibitorId: 'storage-test-company' };
const media = (mime: string): SyncItem => ({ ...ctx, id: crypto.randomUUID(), kind:'MEDIA', title:'fixture', blob:new Blob(['x'],{type:mime}), revision:1, state:'LOCAL_PENDING', attempts:0, nextAttemptAt:0 });
async function fixture() {
 const db = new BrowserWorkspace('pilot-ui-'+crypto.randomUUID());
 await db.saveNote({...ctx,title:'memo',text:'text'});await db.put(media('image/png'));await db.put(media('audio/mp4'));return db;
}
test('pilot readiness lists each missing type; all three enable; busy/policy/completed block', async()=>{
 const db=await fixture();const rows=await db.list(ctx.userId);
 assert(pilotReadiness(rows,[],true,false).canUpload);
 const absent=pilotReadiness([],[],true,false);assert(!absent.canUpload);
 for(const label of ['사진 없음','녹음 없음','메모 없음'])assert(absent.reasons.some(r=>r.includes(label)));
 assert(pilotReadiness(rows,[],true,true).reasons.some(r=>r.includes('업로드 또는')));
 assert(pilotReadiness(rows,[],false,false).reasons.some(r=>r.includes('서버 정책')));
 assert(pilotReadiness(rows.map(r=>({...r,state:'SYNCED'})),[],true,false).reasons.some(r=>r.includes('이미 업로드 완료')));
});
test('local removal deletes memo/draft/queue and recalculates readiness; another owner cannot delete',async()=>{
 const db=await fixture(), note=(await db.list(ctx.userId)).find(r=>r.kind==='NOTE')!;
 await db.saveDraft({...ctx,title:'draft',text:'draft'});
 await assert.rejects(()=>db.deletePilotLocal(note,'other'),/다른 사용자/);
 assert.equal((await db.list(ctx.userId)).length,3);
 await db.deletePilotLocal(note,ctx.userId);
 assert.equal(await db.getNote(ctx),undefined);assert.equal(await db.getDraft(ctx),undefined);
 assert(pilotReadiness(await db.list(ctx.userId),[],true,false).reasons.some(r=>r.includes('메모 없음')));
 await db.saveNote({...ctx,title:'new',text:'new'});assert(pilotReadiness(await db.list(ctx.userId),[],true,false).canUpload);
});
test('deleting extra prepared photo resolves duplicate block without touching other originals',async()=>{
 const db=await fixture(),extra=media('image/png');await db.put(extra);
 assert(!pilotReadiness(await db.list(ctx.userId),[],true,false).canUpload);
 await db.deletePilotLocal(extra,ctx.userId);assert(pilotReadiness(await db.list(ctx.userId),[],true,false).canUpload);
});
test('finished failed attempts and snapshots can be deleted; stale revisions still fail',async()=>{
 const db=await fixture(), rows=await db.list(ctx.userId);
 await db.transfer(rows[0]);await db.deletePilotLocal(rows[0],ctx.userId);
 await db.put({...rows[1],state:'FAILED_RETRYABLE',attempts:1});await db.deletePilotLocal(rows[1],ctx.userId);
 await assert.rejects(()=>db.deletePilotLocal({...rows[2],revision:99},ctx.userId),/수정/);
 assert.equal((await db.list(ctx.userId)).length,1);
});
test('synced local removal retains only slot tombstone and blocks remote replacement',async()=>{
 const db=await fixture(),photo=(await db.list(ctx.userId)).find(r=>r.blob?.type==='image/png')!;
 await db.put({...photo,state:'SYNCED',attempts:1});await db.deletePilotLocal(photo,ctx.userId);
 assert.equal((await db.list(ctx.userId)).length,2);assert.deepEqual(await db.deletedPilotKinds(ctx.userId),['photo']);
 assert(!pilotReadiness(await db.list(ctx.userId),['photo'],true,false).canUpload);
 await db.put(media('image/png'));
 assert(pilotReadiness(await db.list(ctx.userId),['photo'],true,false).reasons.some(r=>r.includes('원격 교체')));
});
test('503 failed audio deletes after caller confirmation and late callbacks cannot resurrect it',async()=>{
 const db=await fixture(),audio=(await db.list(ctx.userId)).find(r=>r.blob?.type==='audio/mp4')!;
 const snapshot=await db.transfer(audio);await db.finishTransfer({...snapshot,state:'FAILED_RETRYABLE',attempts:2});
 const failed=(await db.list(ctx.userId)).find(r=>r.id===audio.id)!;
 const status=await db.pilotLocalStatus(failed,ctx.userId);assert(status.canDelete);assert.match(status.reason,/원격 결과 미확인/);
 await db.deletePilotLocal(failed,ctx.userId);
 await db.finishTransfer({...snapshot,state:'FAILED_RETRYABLE',attempts:3});
 await db.finishTransfer({...snapshot,state:'SYNCED'});
 await assert.rejects(db.put(snapshot),/이미 로컬 삭제/);
 await assert.rejects(db.transfer(snapshot),/로컬 삭제/);
 assert(!(await db.list(ctx.userId)).some(r=>r.id===audio.id));
 assert.deepEqual(await db.deletedPilotKinds(ctx.userId),['audio']);
 assert.match(localDeleteWarning(),/영구적으로 복구/);assert.match(localDeleteWarning(),/Google에 파일이 남아/);assert.match(localDeleteWarning(),/삭제하지 않습니다/);
});
test('unattempted audio confirmation deletes only that local item; mere inspection preserves all',async()=>{
 const db=await fixture(),audio=(await db.list(ctx.userId)).find(r=>r.blob?.type==='audio/mp4')!;
 assert((await db.pilotLocalStatus(audio,ctx.userId)).canDelete);
 assert.equal((await db.list(ctx.userId)).length,3);
 await db.deletePilotLocal(audio,ctx.userId);
 assert.equal((await db.list(ctx.userId)).length,2);
 assert((await db.list(ctx.userId)).some(r=>r.kind==='NOTE'));
});
test('interrupted local upload recovery requires free browser lock and preserves frozen operation',async()=>{
 const descriptor=Object.getOwnPropertyDescriptor(navigator,'locks');
 let available=false;
 Object.defineProperty(navigator,'locks',{configurable:true,value:{request:async (_:string,options:{ifAvailable:boolean},action:(lock:unknown)=>Promise<unknown>)=>{
  assert(options.ifAvailable);return action(available?{}:null);
 }}});
 try {
  const db=await fixture(),audio=(await db.list(ctx.userId)).find(r=>r.blob?.type==='audio/mp4')!;
  await db.transfer(audio);await db.put({...audio,state:'DRIVE_UPLOADING'});
  await assert.rejects(db.recoverPilotLocal(audio,ctx.userId),/업로드 중/);
  assert.equal((await db.list(ctx.userId)).find(r=>r.id===audio.id)!.state,'DRIVE_UPLOADING');
  available=true;await db.recoverPilotLocal(audio,ctx.userId);
  const recovered=(await db.list(ctx.userId)).find(r=>r.id===audio.id)!;
  assert.equal(recovered.state,'FAILED_RETRYABLE');assert.equal(recovered.attempts,1);
  assert.equal(await recovered.blob!.text(),'x');assert.equal((await db.transfer(recovered)).state,'LOCAL_PENDING');
  assert.equal((await db.transfer(recovered)).id,audio.id);
  assert((await db.pilotLocalStatus(recovered,ctx.userId)).canDelete);
  assert(!pilotReadiness(await db.list(ctx.userId),[],false,false).canUpload);
  await assert.rejects(db.recoverPilotLocal(audio,'other'),/다른 사용자/);
 } finally { if(descriptor)Object.defineProperty(navigator,'locks',descriptor);else Reflect.deleteProperty(navigator,'locks'); }
});
test('pending snapshot with zero attempts permits deletion but reserves remote slot',async()=>{
 const db=await fixture(),audio=(await db.list(ctx.userId)).find(r=>r.blob?.type==='audio/mp4')!;
 await db.transfer(audio);const policy=await db.pilotLocalStatus(audio,ctx.userId);assert(policy.canDelete);
 await db.deletePilotLocal(audio,ctx.userId);assert.deepEqual(await db.deletedPilotKinds(ctx.userId),['audio']);
});
test('aborted IndexedDB delete rejects and leaves recording intact',async()=>{
 const db=await fixture(),audio=(await db.list(ctx.userId)).find(r=>r.blob?.type==='audio/mp4')!;
 const original=IDBObjectStore.prototype.delete;
 IDBObjectStore.prototype.delete=function(key){const request=original.call(this,key);this.transaction.abort();return request;};
 try {await assert.rejects(db.deletePilotLocal(audio,ctx.userId),/기기 저장/);}
 finally {IDBObjectStore.prototype.delete=original;}
 assert.equal(await (await db.list(ctx.userId)).find(r=>r.id===audio.id)!.blob!.text(),'x');
 await db.put(audio);assert.deepEqual(await db.deletedPilotKinds(ctx.userId),[]);
});
test('failed recording delete persists after reopen with no original or identifying payload',async()=>{
 const name='pilot-preservation-'+crypto.randomUUID(),db=new BrowserWorkspace(name);
 const recording={...media('audio/mp4'),title:'private fixture title',state:'FAILED_RETRYABLE' as const,attempts:2,revision:1};
 await db.put(recording);await db.transfer(recording);
 await new BrowserWorkspace(name).deletePilotLocal(recording,ctx.userId);
 const reopened=new BrowserWorkspace(name);assert.deepEqual(await reopened.list(ctx.userId),[]);
 await assert.rejects(reopened.put(recording),/이미 로컬 삭제/);
 const entries=await new Promise<unknown[]>(resolve=>{const r=indexedDB.open(name,1);r.onsuccess=()=>{const d=r.result,t=d.transaction('records'),items:unknown[]=[];const q=t.objectStore('records').openCursor();q.onsuccess=()=>{if(q.result){items.push([q.result.key,q.result.value]);q.result.continue();}};t.oncomplete=()=>{d.close();resolve(items);};};});
 assert.equal(entries.length,1);const serialized=JSON.stringify(entries);
 for(const sensitive of [recording.id,recording.title,ctx.userId,'blob','text','driveFileId','operation'])assert(!serialized.includes(sensitive));
 assert.deepEqual(await reopened.deletedPilotKinds(ctx.userId),['audio']);
});
test('active upload lock delays deletion until bookkeeping completes, then cleans all',async()=>{
 const db=await fixture(),audio=(await db.list(ctx.userId)).find(r=>r.blob?.type==='audio/mp4')!;
 let release!:()=>void, entered!:()=>void;
 const started=new Promise<void>(r=>entered=r),hold=new Promise<void>(r=>release=r);
 const upload=navigator.locks.request(`gatherly-pilot:${ctx.userId}`,async()=>{await db.transfer(audio);entered();await hold;await db.finishTransfer({...audio,state:'FAILED_RETRYABLE',attempts:1});});
 await started;let deleted=false;const deletion=db.deletePilotLocal(audio,ctx.userId).then(()=>{deleted=true;});
 await new Promise(r=>setTimeout(r,25));assert(!deleted);assert((await db.list(ctx.userId)).some(r=>r.id===audio.id));
 release();await upload;await deletion;assert(!(await db.list(ctx.userId)).some(r=>r.id===audio.id));await assert.rejects(db.transfer(audio),/로컬 삭제/);
});
test('failed note cleanup removes content and snapshot; new note gets a fresh ID',async()=>{
 const db=await fixture(),note=(await db.list(ctx.userId)).find(r=>r.kind==='NOTE')!;
 await db.transfer(note);await db.finishTransfer({...note,state:'FAILED_RETRYABLE',attempts:1});
 await db.deletePilotLocal(note,ctx.userId);assert.equal(await db.getNote(ctx),undefined);await assert.rejects(db.transfer(note),/로컬 삭제/);
 const fresh=await db.saveNote({...ctx,title:'new',text:'new'});assert.notEqual(fresh.id,note.id);
});

test('lock timeout refuses deletion and preserves original with an actionable reason',async()=>{
 const db=await fixture(),audio=(await db.list(ctx.userId)).find(r=>r.blob?.type==='audio/mp4')!;
 const descriptor=Object.getOwnPropertyDescriptor(navigator,'locks');
 Object.defineProperty(navigator,'locks',{configurable:true,value:{request:async()=>{throw new DOMException('fixture','TimeoutError');}}});
 try {await assert.rejects(db.deletePilotLocal(audio,ctx.userId),/전송 종료를 확인하지 못해/);assert.equal((await db.list(ctx.userId)).length,3);}
 finally {if(descriptor)Object.defineProperty(navigator,'locks',descriptor);else Reflect.deleteProperty(navigator,'locks');}
});
