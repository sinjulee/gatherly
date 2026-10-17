import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { BrowserWorkspace } from '../lib/gatherly-2/browser-storage';
import { pilotReadiness } from '../lib/gatherly-2/pilot-ui';
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
test('in-flight snapshots, failed attempts and stale revisions cannot be deleted',async()=>{
 const db=await fixture(), rows=await db.list(ctx.userId), item=rows[0];
 await db.transfer(item);await assert.rejects(()=>db.deletePilotLocal(item,ctx.userId),/전송을 시도/);
 assert.equal((await db.list(ctx.userId)).length,3);
 const second=rows[1];await db.put({...second,state:'FAILED_RETRYABLE',attempts:1});
 await assert.rejects(()=>db.deletePilotLocal(second,ctx.userId),/전송을 시도/);
 await assert.rejects(()=>db.deletePilotLocal({...rows[2],revision:99},ctx.userId),/수정/);
});
test('synced local removal retains only slot tombstone and blocks remote replacement',async()=>{
 const db=await fixture(),photo=(await db.list(ctx.userId)).find(r=>r.blob?.type==='image/png')!;
 await db.put({...photo,state:'SYNCED',attempts:1});await db.deletePilotLocal(photo,ctx.userId);
 assert.equal((await db.list(ctx.userId)).length,2);assert.deepEqual(await db.deletedPilotKinds(ctx.userId),['photo']);
 assert(pilotReadiness(await db.list(ctx.userId),['photo'],true,false).canUpload);
 await db.put(media('image/png'));
 assert(pilotReadiness(await db.list(ctx.userId),['photo'],true,false).reasons.some(r=>r.includes('원격 교체')));
});
