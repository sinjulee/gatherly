import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { validHotspot } from '../lib/gatherly-2/map';
import { REFERENCE_SHA } from '../lib/gatherly-2/integration/catalog';
import { createHash } from 'node:crypto';
test('official five stay review-only, preserve multi-booth identity, and have no guessed geometry', async t => {
  try {
    await access('docs/gatherly-2.0/booth-mapping-review.json');
    await access('docs/gatherly-2.0/v0.5_assets/ESG_2026_Official_BoothMap_TitleRemoved_Reference.png');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    t.skip('Local-only official source audit: private map/review files are intentionally excluded from Git.'); return;
  }
  const pending = JSON.parse(await readFile('docs/gatherly-2.0/booth-mapping-review.json','utf8'));
  assert.equal(pending.publicationApproved,false); assert.equal(pending.rights,'UNKNOWN');
  assert.equal(pending.entries.length,5);
  assert.deepEqual(pending.entries.find((x:{externalId:string})=>x.externalId==='76').booths,['G-111','H-111']);
  assert(pending.entries.every((x:{geometry:unknown})=>x.geometry===null));
  const image = await readFile('docs/gatherly-2.0/v0.5_assets/ESG_2026_Official_BoothMap_TitleRemoved_Reference.png');
  assert.equal(createHash('sha256').update(image).digest('hex'),REFERENCE_SHA);
});
test('hotspot with missing or wrong exhibitor is rejected rather than selecting another company', () => {
  const h = {id:'h',exhibitionId:'e',exhibitorId:'one',mapVersion:'v1',review:'VERIFIED' as const,geometry:{x:.1,y:.2,width:.1,height:.1}};
  assert.equal(validHotspot(h,undefined,'v1'),false);
  const e = {id:'two',exhibitionId:'e',companyId:'c',name:'different',booth:null,summary:'',sourceId:'s',review:'PUBLISHED' as const};
  assert.equal(validHotspot(h,e,'v1'),false); assert.equal(validHotspot({...h,exhibitorId:'two'},e,'v0'),false);
});
