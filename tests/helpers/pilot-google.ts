import assert from 'node:assert/strict';
import { GoogleApi } from '../../lib/gatherly-2/integration/google';
import { GoogleStorage } from '../../lib/gatherly-2/integration/storage';
import { emptyVault } from '../../lib/gatherly-2/integration/vault';
import { digest } from '../../lib/gatherly-2/integration/storage';
export function harness() {
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
      uploads++; const file = { ...metadata, id: String(metadata.id), size: (init?.body as Blob).size + partialBytes, sha256Checksum: digest(new Uint8Array(await (init?.body as Blob).arrayBuffer())) }; files.set(file.id, file);
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
  return { transport, api, storage, state, tabs, files, failure, save: async () => { saves++; }, counts:()=>({uploads,resourceCreates,saves}) };
}
