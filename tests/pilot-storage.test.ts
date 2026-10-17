import test from 'node:test';
import assert from 'node:assert/strict';
import { PilotStorage, pilotData, pilotRecord, reservePilot, pilotTransport } from '../lib/gatherly-2/integration/pilot-storage';
import { digest } from '../lib/gatherly-2/integration/storage';
import { emptyVault } from '../lib/gatherly-2/integration/vault';
import { harness } from './helpers/pilot-google';
const input = { id: '00000000-0000-0000-0000-000000000001', fieldDayId: 'storage-test-event', exhibitorId: 'storage-test-company', title: '테스트 메모', text: '테스트 내용', revision: 1, kind: 'NOTE' };
const media = (id: string, mimeType: string) => pilotRecord({ ...input, id, kind: 'MEDIA' }, { size: 3, mimeType, sha256: digest(new Uint8Array([1,2,3])) });
test('pilot reserves only one immutable item per type, rejects context/size/ID reuse and bounds request counts', async () => {
  const data = pilotData(emptyVault()), save = async () => {};
  const first = pilotRecord(input);
  await reservePilot(data, first, save); await reservePilot(data, first, save);
  await assert.rejects(() => reservePilot(data, pilotRecord({ ...input, text: 'edited' }), save), /CONFLICT/);
  await assert.rejects(() => reservePilot(data, pilotRecord({ ...input, id: '00000000-0000-0000-0000-000000000004' }), save), /CONFLICT/);
  await assert.rejects(() => reservePilot(data, media(input.id, 'image/png'), save), /CONFLICT/);
  assert.throws(() => pilotRecord({ ...input, fieldDayId: 'official-id' }), /FORBIDDEN/);
  assert.throws(() => pilotRecord({ ...input, kind: 'MEDIA' }, { size: 5*1024*1024+1, mimeType: 'image/png', sha256: 'a'.repeat(64) }), /INVALID/);
  data.requests=30; await assert.rejects(()=>reservePilot(data,first,save), /LIMIT/);
  let calls=0; data.googleRequests=240;
  await assert.rejects(()=>pilotTransport(data,save,async()=>{calls++;return Response.json({});})('https://www.googleapis.com/drive/v3/files'), /LIMIT/);
  assert.equal(calls,0);
});
test('three pilot records create isolated resources, verify Google rows/files and retry without duplicates', async () => {
  const h=harness(), data=pilotData(h.state), pilot=new PilotStorage(h.api,data,h.save,'production:fixture');
  const note=pilotRecord(input), photo=media('00000000-0000-0000-0000-000000000002','image/png'), audio=media('00000000-0000-0000-0000-000000000003','audio/mp4');
  await pilot.upload(note);
  for(const slot of [photo,audio]) await pilot.upload(slot,0,new Blob([new Uint8Array([1,2,3])],{type:slot.media!.mimeType}));
  assert.deepEqual(await pilot.status(),{note:'VERIFIED',photo:'VERIFIED',audio:'VERIFIED'});
  const restarted=new PilotStorage(h.api,pilotData(h.state),h.save,'production:fixture');
  await restarted.upload(note); await restarted.upload(photo);
  assert.equal(h.counts().uploads,2);assert.equal(h.tabs.notes.length,2);assert.equal(h.tabs.assets.length,3);
  assert.deepEqual(h.state.resources,{}); assert.deepEqual(h.state.records,{});
  assert.equal(Object.keys(data.slots).length,3);
  assert(!JSON.stringify(await restarted.status()).includes('resource-'));
  h.tabs.notes[1][4]='external edit';await assert.rejects(()=>restarted.verify('note'),/CONFLICT/);
});
test('pilot recovers Drive success and Sheets response loss without another binary or row', async()=>{
  const h=harness(),data=pilotData(h.state),pilot=new PilotStorage(h.api,data,h.save,'production:fixture');
  const slot=media(input.id,'image/png'),blob=new Blob([new Uint8Array([1,2,3])],{type:'image/png'});
  h.failure.upload=true;await assert.rejects(()=>pilot.upload(slot,0,blob));
  h.failure.sheet=true;await assert.rejects(()=>pilot.upload(slot,0,blob),/SHEET_PENDING/);
  assert.equal(await pilot.verify('photo'),'SHEET_PENDING');
  await pilot.upload(slot,0,blob);await pilot.upload(slot);
  assert.equal(h.counts().uploads,1);assert.equal(h.tabs.assets.length,2);assert.equal(await pilot.verify('photo'),'VERIFIED');
  data.checks=10;await assert.rejects(()=>pilot.status(),/LIMIT/);
});
test('pilot persists budget before a network call; failed reservation cannot send credentials',async()=>{
  const data=pilotData(emptyVault());let calls=0;
  const transport=pilotTransport(data,async()=>{throw new Error('save failed');},async()=>{calls++;return Response.json({});});
  await assert.rejects(()=>transport('https://www.googleapis.com/drive/v3/files'),/save failed/);assert.equal(calls,0);
});

test('pilot refreshes expired credentials through bounded transport and rejects invalid grants without files',async()=>{
  const { GoogleApi }=await import('../lib/gatherly-2/integration/google');
  const h=harness(),data=pilotData(h.state);h.state.oauth!.expiresAt=0;let refresh=0;
  const config={clientId:'fixture',clientSecret:'fixture',redirectUri:'https://fixture.invalid'};
  const api=new GoogleApi(config,h.state,h.save,pilotTransport(data,h.save,async(url,init)=>{
    if(url.includes('oauth2.googleapis.com')){refresh++;return Response.json({access_token:'fixture-new',expires_in:3600});}
    return h.transport(url,init);
  }));
  await new PilotStorage(api,data,h.save,'production:fixture').upload(pilotRecord(input));
  assert.equal(refresh,1);assert(data.googleRequests>1);
  const denied=harness(),deniedData=pilotData(denied.state);denied.state.oauth!.expiresAt=0;
  const broken=new GoogleApi(config,denied.state,denied.save,pilotTransport(deniedData,denied.save,async()=>Response.json({error:'invalid_grant'},{status:400})));
  await assert.rejects(()=>new PilotStorage(broken,deniedData,denied.save,'production:fixture').upload(pilotRecord(input)),/REAUTH/);
  assert.equal(denied.files.size,0);
});
test('pilot rejects invalid chunks before resource creation and detects remote file tampering',async()=>{
  const h=harness(),data=pilotData(h.state),p=new PilotStorage(h.api,data,h.save,'production:fixture');
  const slot=media(input.id,'image/png');
  await assert.rejects(()=>p.upload(slot,4,new Blob(['x'])),/INVALID/);assert.equal(h.files.size,0);
  await p.upload(slot,0,new Blob([new Uint8Array([1,2,3])],{type:'image/png'}));
  const ledger=Object.values(data.records).find(r=>r.fileId)!;h.files.get(ledger.fileId!)!.size=2;
  await assert.rejects(()=>p.verify('photo'),/CONFLICT/);
});
