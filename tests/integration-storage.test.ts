import test from 'node:test';
import assert from 'node:assert/strict';
import { GoogleApi } from '../lib/gatherly-2/integration/google';
import { GoogleStorage, type RemoteRecord } from '../lib/gatherly-2/integration/storage';
import { emptyVault } from '../lib/gatherly-2/integration/vault';
import { parseRecord } from '../lib/gatherly-2/integration/validation';
const record: RemoteRecord = { id: '00000000-0000-0000-0000-000000000001', fieldDayId: '00000000-0000-0000-0000-000000000002', exhibitorId: '00000000-0000-0000-0000-000000000003', title: '메모', text: '=NOT_A_FORMULA', kind: 'NOTE', revision: 3 };
function harness() {
  const state = emptyVault(); state.oauth = { accessToken: 'fixture', refreshToken: 'fixture', expiresAt: Date.now()+3600000 };
  const files = new Map<string, { id: string; appProperties?: Record<string,string>; size?: number }>();
  const tabs: Record<string,string[][]> = {}; let seq = 0, uploads = 0, resourceCreates = 0, saves = 0;
  const failure = { sheet: false, upload: false, create: false, partial: false };
  let metadata: Record<string, unknown>; let partialBytes = 0;
  const transport = async (url: string, init?: RequestInit): Promise<Response> => {
    const target = new URL(url), method = init?.method ?? 'GET';
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : null;
    if (target.pathname.endsWith('/generateIds')) return Response.json({ ids: [`media-${++seq}`] });
    if (target.pathname === '/upload/drive/v3/files') { metadata = body; return new Response('', { headers: { location: 'https://www.googleapis.com/upload/session' } }); }
    if (target.pathname === '/upload/session') {
      const range = new Headers(init?.headers).get('content-range') ?? '';
      if (range.startsWith('bytes */')) return new Response('', { status: 308, headers: { Range: `bytes=0-${partialBytes-1}` } });
      if (failure.partial) { failure.partial = false; partialBytes = 4; throw new Error('interrupted partial upload'); }
      if (partialBytes) assert.match(range, /^bytes 4-/);
      uploads++; const file = { ...metadata, id: String(metadata.id), size: (init?.body as Blob).size + partialBytes }; files.set(file.id, file);
      if (failure.upload) { failure.upload = false; throw new Error('lost upload response'); }
      return Response.json({ id: file.id });
    }
    if (target.pathname === '/drive/v3/files') {
      if (method === 'GET') { const match = [...files.values()].filter(f => target.searchParams.get('q')?.includes(f.appProperties?.gatherlyKey ?? 'NEVER')); return Response.json({ files: match }); }
      resourceCreates++; const file = { ...body, id: `resource-${++seq}` }; files.set(file.id, file);
      if (failure.create) { failure.create = false; throw new Error('lost create response'); }
      return Response.json(file);
    }
    if (target.pathname.startsWith('/drive/v3/files/')) {
      const file = files.get(target.pathname.split('/').at(-1)!);
      return file ? Response.json({ ...file, ownedByMe: true, trashed: false }) : new Response('',{status:404});
    }
    if (target.pathname.endsWith(':batchUpdate')) {
      for (const req of body.requests) tabs[req.addSheet.properties.title] = [];
      return Response.json({});
    }
    if (!target.pathname.includes('/values/')) return Response.json({ sheets: Object.keys(tabs).map(title => ({ properties: { title } })) });
    const range = decodeURIComponent(target.pathname.split('/values/')[1]); const [tab, cells] = range.split('!');
    const start = Number(cells.match(/A(\d+)/)?.[1]);
    if (method === 'PUT') {
      assert.equal(target.searchParams.get('valueInputOption'), 'RAW');
      tabs[tab][start-1] = body.values[0];
      if (failure.sheet && start > 1) { failure.sheet = false; throw new Error('lost sheet response'); }
      return Response.json({});
    }
    return Response.json({ values: start ? [tabs[tab][start-1]] : tabs[tab] });
  };
  const api = new GoogleApi({ clientId:'fixture',clientSecret:'fixture',redirectUri:'https://fixture.invalid' },state,async()=>{saves++;},transport);
  const storage = new GoogleStorage(api,state,async()=>{saves++;},"fixture-owner");
  return { storage, state, tabs, failure, counts:()=>({uploads,resourceCreates,saves}) };
}
test('offline multi-edit revision jump saves once; retry is idempotent and payload reuse conflicts', async () => {
  const h = harness(); await h.storage.sync(record); await h.storage.sync(record);
  assert.equal(h.tabs.notes.length,2); assert.equal(h.tabs.notes[1][4],'=NOT_A_FORMULA');
  assert.equal(h.tabs.notes[1][6],'3');
  await assert.rejects(()=>h.storage.sync({...record,text:'changed same revision'}),/CONFLICT/);
  await h.storage.sync({...record,text:'next',revision:4}); assert.equal(h.tabs.notes.length,2);
});
test('Drive success response loss and Sheets response loss recover without duplicate files/rows', async () => {
  const h = harness(), media = { ...record, kind:'MEDIA' as const, text:undefined,revision:1 }, blob = new Blob(['fixture image'],{type:'image/png'});
  h.failure.upload = true; await assert.rejects(()=>h.storage.sync(media,blob));
  h.failure.sheet = true; await assert.rejects(()=>h.storage.sync(media,blob));
  await h.storage.sync(media,blob); await h.storage.sync(media,blob);
  assert.equal(h.counts().uploads,1); assert.equal(h.tabs.assets.length,2);
});
test('unknown native file create reconciles original resource rather than creating another', async () => {
  const h = harness(); h.failure.create = true;
  await assert.rejects(()=>h.storage.sync(record)); await h.storage.sync(record);
  assert.equal(h.counts().resourceCreates,3); // root, field folder, spreadsheet
});
test('direct Sheet edits and deletion are not silently overwritten', async () => {
  const h = harness(); await h.storage.sync(record); h.tabs.notes[1][4]='edited in Sheets';
  await assert.rejects(()=>h.storage.sync({...record,revision:4,text:'new local'}),/CONFLICT/);
  assert.equal(h.tabs.notes[1][4],'edited in Sheets');
});
test('validation rejects demo identifiers, impossible revision and excess notes; ignores forged owner', () => {
  assert.equal('userId' in parseRecord({...record,userId:'someone-else'}),false);
  assert.throws(()=>parseRecord({...record,exhibitorId:'test-exhibitor-1'}));
  assert.throws(()=>parseRecord({...record,revision:0}));
  assert.throws(()=>parseRecord({...record,text:'a'.repeat(501)}));
});

test('persisted resumable session resumes partial bytes after interruption', async () => {
  const h = harness(), media = {...record,kind:'MEDIA' as const,text:undefined,revision:1};
  const blob = new Blob(['fixture image'],{type:'image/png'});
  h.failure.partial = true; await assert.rejects(()=>h.storage.sync(media,blob));
  await h.storage.sync(media,blob); assert.equal(h.counts().uploads,1); assert.equal(h.tabs.assets.length,2);
});
