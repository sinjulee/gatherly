import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { BrowserWorkspace } from '../lib/gatherly-2/browser-storage';
import { syncWorkspace } from '../lib/gatherly-2/integration/browser-sync';
import type { Context } from '../lib/gatherly-2/contracts';
const context: Context = { userId:'A', fieldDayId:'field',exhibitorId:'company' };
test('immutable IndexedDB transfer survives edit and restart; old ack cannot replace latest note', async () => {
  const name = `test-${crypto.randomUUID()}`, db = new BrowserWorkspace(name);
  await db.saveNote({...context,title:'first',text:'one'});
  const item = (await db.list('A'))[0], frozen = await db.transfer(item);
  await db.saveNote({...context,title:'second',text:'two'});
  const restarted = new BrowserWorkspace(name);
  assert.equal((await restarted.transfer((await db.list('A'))[0])).text,'one');
  await restarted.finishTransfer({...frozen,state:'SYNCED'});
  assert.equal((await db.list('A'))[0].revision,2); assert.equal((await db.list('A'))[0].state,'LOCAL_PENDING');
  const second = await db.transfer((await db.list('A'))[0]); assert.equal(second.text,'two');
  await db.finishTransfer({...second,state:'SYNCED'}); assert.equal((await db.list('A'))[0].state,'SYNCED');
  assert.equal((await db.list('B')).length,0);
});
test('manual remote sync sends expected owner, keeps reauth pending, then recovers without local loss', async () => {
  Object.defineProperty(navigator,'locks',{configurable:true,value:{request:async (_: string, action:()=>Promise<unknown>)=>action()}});
  const db = new BrowserWorkspace(`test-${crypto.randomUUID()}`);
  await db.saveNote({...context,title:'saved',text:'private'});
  let requests = 0;
  const transport: typeof fetch = async (_url, init) => {
    requests++; assert.equal((init!.body as FormData).get('expectedUserId'),'A');
    return requests===1 ? Response.json({error:'REAUTH'},{status:401}) : Response.json({revision:1});
  };
  await syncWorkspace(db,'A',transport); assert.equal((await db.list('A'))[0].state,'BLOCKED_REAUTH');
  assert.equal((await db.getNote(context))?.text,'private');
  await syncWorkspace(db,'A',transport); assert.equal((await db.list('A'))[0].state,'SYNCED');
});

test('offline retry preserves the original and retries the same mutation without duplicating a completed upload', async () => {
  Object.defineProperty(navigator, 'locks', { configurable: true, value: { request: async (_: string, action: () => Promise<unknown>) => action() } });
  const db = new BrowserWorkspace(`test-${crypto.randomUUID()}`);
  await db.saveNote({ ...context, title: 'offline fixture', text: 'keep original' });
  const original = (await db.list('A'))[0];
  await syncWorkspace(db, 'A', async () => { throw new TypeError('offline'); });
  const failed = (await db.list('A'))[0];
  assert.equal(failed.state, 'FAILED_RETRYABLE'); assert.equal(failed.id, original.id);
  assert.equal(failed.text, original.text);
  await db.finishTransfer({ ...failed, nextAttemptAt: 0 });
  let uploads = 0;
  const upload: typeof fetch = async (_url, init) => {
    uploads++;
    const record = JSON.parse(String((init!.body as FormData).get('record')));
    assert.equal(record.id, original.id); assert.equal(record.revision, original.revision);
    return Response.json({ revision: original.revision });
  };
  await syncWorkspace(db, 'A', upload); await syncWorkspace(db, 'A', upload);
  assert.equal(uploads, 1); assert.equal((await db.list('A')).length, 1);
  assert.equal((await db.list('A'))[0].state, 'SYNCED');
});
