import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
test('draft SQL executes in disposable PostgreSQL: RLS isolates A/B; roles cannot bypass publication or grants', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth,public to anon,authenticated,service_role; grant execute on function auth.uid() to anon,authenticated;`);
    await db.exec(await readFile('docs/gatherly-2.0/sql/catalog-draft.sql','utf8'));
    await db.exec(`insert into auth.users values('${id(1)}'),('${id(2)}'); insert into g2_catalog_readers values('${id(1)}'),('${id(2)}'); insert into g2_admins values('${id(1)}'); insert into g2_entitlements values('${id(10)}','${id(2)}','ONE_TIME',null,1); insert into g2_storage_links(user_id,connection_status) values('${id(1)}','A'),('${id(2)}','B'); insert into g2_exhibitions values('${id(20)}','visible',true),('${id(21)}','hidden',false); insert into g2_companies values('${id(30)}','approved',true,true,'https://fixture.invalid'),('${id(31)}','unapproved',true,false,'https://fixture.invalid'); insert into g2_exhibitors(id,exhibition_id,company_id,source_id,external_id,published) values('${id(40)}','${id(20)}','${id(30)}','fixture','1',true),('${id(41)}','${id(21)}','${id(30)}','fixture','2',true),('${id(42)}','${id(20)}','${id(31)}','fixture','3',true);`);
    await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${id(1)}',false);`);
    assert.equal((await db.query('select * from g2_storage_links')).rows.length,1);
    assert.equal((await db.query<{connection_status:string}>('select connection_status from g2_storage_links')).rows[0].connection_status,'A');
    assert.equal((await db.query('select * from g2_entitlements')).rows.length,0, 'admin is not entitled');
    assert.equal((await db.query('select * from g2_exhibitors')).rows.length,1);
    await assert.rejects(() => db.exec(`update g2_storage_links set user_id='${id(2)}'`), /permission denied/);
    await assert.rejects(() => db.exec(`insert into g2_admins values('${id(2)}')`), /permission denied/);
    await assert.rejects(() => db.exec(`update g2_companies set rights_approved=true`), /permission denied/);
    await db.exec(`select set_config('request.jwt.claim.sub','${id(2)}',false);`);
    assert.equal((await db.query('select * from g2_admins')).rows.length,0);
    assert.equal((await db.query('select * from g2_entitlements')).rows.length,1);
    await db.exec('set role anon');
    await assert.rejects(() => db.query('select * from g2_exhibitors'), /permission denied/);
    await assert.rejects(() => db.query('select * from g2_storage_links'), /permission denied/);
    await db.exec(`select set_config('request.jwt.claim.sub','${id(3)}',false); set role authenticated;`);
    assert.equal((await db.query('select * from g2_exhibitors')).rows.length,0);
    await db.exec(`select set_config('request.jwt.claim.sub','${id(2)}',false); reset role;`);
    await db.exec(`insert into g2_maps values('${id(50)}','${id(20)}','v1','${'a'.repeat(64)}',754,446,'fixture',true,true); insert into g2_booths values('${id(60)}','${id(20)}','C-107'),('${id(61)}','${id(21)}','C-107'); insert into g2_exhibitor_booths values('${id(40)}','${id(60)}','${id(20)}'); insert into g2_hotspots values('${id(70)}','${id(50)}','${id(60)}','${id(20)}',0.1,0.2,0.1,0.1,true,'${id(1)}',now());`);
    await assert.rejects(() => db.exec(`insert into g2_exhibitor_booths values('${id(40)}','${id(61)}','${id(20)}')`), /foreign key/);
    await db.exec('set role authenticated'); assert.equal((await db.query('select * from g2_hotspots')).rows.length,1);
    await db.exec(`reset role; update g2_maps set rights_approved=false; set role authenticated;`);
    assert.equal((await db.query('select * from g2_hotspots')).rows.length,0);
  } finally { await db.close(); }
});
