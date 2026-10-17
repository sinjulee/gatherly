import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { legacyMapAsset, cloudRoute } from '../lib/gatherly-2/integration/platform';
import { environment, environmentUser } from '../lib/gatherly-2/integration/environment';
import { requireOwner } from '../lib/gatherly-2/integration/config';
import { SupabaseVault, type VaultRpc } from '../lib/gatherly-2/integration/supabase-vault';
const A='00000000-0000-0000-0000-000000000001', B='00000000-0000-0000-0000-000000000002';

test('deployment environment fails closed; each allowlist and verified UUID remain separate', () => {
  assert.equal(legacyMapAsset('/_next/static/media/ESG_2026_Official_BoothMap_TitleRemoved_Reference.old.png'),true);
  assert.equal(cloudRoute('/_next/static/media/ESG_2026_Official_BoothMap_TitleRemoved_Reference.old.png'),'block');
  assert.throws(()=>environment({}), /DISABLED/);
  const preview={VERCEL:'1',VERCEL_ENV:'preview',GATHERLY_V2_ENVIRONMENT:'preview',GATHERLY_V2_PREVIEW_ALLOWED_USER_IDS:A,GATHERLY_V2_PRODUCTION_ALLOWED_USER_IDS:B};
  assert.equal(environmentUser(A,preview),'preview');
  assert.throws(()=>environmentUser(B,preview),/FORBIDDEN/);
  const production={...preview,VERCEL_ENV:'production',GATHERLY_V2_ENVIRONMENT:'production'};
  assert.equal(environmentUser(B,production),'production');
  assert.throws(()=>environmentUser(A,production),/FORBIDDEN/);
  assert.throws(()=>environment({...preview,VERCEL_ENV:'production'}),/DISABLED/);
  assert.throws(()=>environment({...preview,VERCEL:undefined}),/DISABLED/);
  assert.throws(()=>requireOwner(B,A),/FORBIDDEN/);
  // Browser payload cannot become deployment configuration or verified identity.
  const forged = new Request('https://fixture.invalid/api/v2/map?environment=production', {headers:{'x-gatherly-environment':'production','x-user-id':B}});
  assert.equal(new URL(forged.url).searchParams.get('environment'),'production');
  assert.equal(environmentUser(A,preview),'preview');
});

test('vault namespaces isolate the same UUID in both directions, including locks and encrypted AAD', async () => {
  const db=new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key); grant usage on schema public to anon,authenticated,service_role; insert into auth.users values('${A}'),('${B}');`);
    await db.exec(await readFile('docs/gatherly-2.0/sql/vercel-vault-draft.sql','utf8'));
    for(const role of ['anon','authenticated']) {
      await db.exec(`set role ${role}`);
      for(const env of ['preview','production']) {
        await assert.rejects(()=>db.query(`select public.g2_vault_claim('${A}','${B}','${env}')`),/permission denied/);
        await assert.rejects(()=>db.query('select * from g2_private.vault where environment=$1',[env]),/permission denied/);
        await assert.rejects(()=>db.query('update g2_private.vault set ciphertext=$1 where environment=$2',['forged',env]),/permission denied/);
      }
    }
    await db.exec('set role service_role');
    const rpc:VaultRpc={async call(name,args){
      const entries=Object.entries(args);
      return (await db.query<{value:unknown}>(`select public.${name}(${entries.map(([k],i)=>`${k} => $${i+1}`).join(',')}) as value`,entries.map(([,v])=>v))).rows[0].value;
    }};
    const key=randomBytes(32), preview=new SupabaseVault(rpc,key,'preview'), production=new SupabaseVault(rpc,key,'production');
    await preview.locked(A,async(state,save)=>{
      state.resources.root={id:'preview-folder'};await save();
      await production.locked(A,async(other,saveOther)=>{
        assert.deepEqual(other.resources,{});other.resources.root={id:'production-folder'};await saveOther();
        const rows=await db.query<{lock_token:string}>('select lock_token from g2_private.vault where environment=$1 and user_id=$2',['preview',A]);
        await assert.rejects(()=>rpc.call('g2_vault_save',{p_environment:'production',p_user:A,p_token:rows.rows[0].lock_token,p_revision:1,p_ciphertext:'forged'}),/STALE_LOCK/);
        const prodToken=(await db.query<{lock_token:string}>('select lock_token from g2_private.vault where environment=$1 and user_id=$2',['production',A])).rows[0].lock_token;
        await assert.rejects(()=>rpc.call('g2_vault_save',{p_environment:'preview',p_user:A,p_token:prodToken,p_revision:1,p_ciphertext:'forged'}),/STALE_LOCK/);
        assert.equal(await rpc.call('g2_vault_release',{p_environment:'production',p_user:A,p_token:rows.rows[0].lock_token}),false);
      });
    });
    await preview.locked(A,async state=>assert.equal(state.resources.root.id,'preview-folder'));
    await production.locked(A,async state=>assert.equal(state.resources.root.id,'production-folder'));
    await preview.locked(B,async state=>assert.deepEqual(state.resources,{}));
    // Even an operator copying ciphertext cannot silently change its environment identity.
    await db.exec(`update g2_private.vault set ciphertext=(select ciphertext from g2_private.vault where environment='preview' and user_id='${A}') where environment='production' and user_id='${A}'`);
    await assert.rejects(()=>production.locked(A,async()=>{}),/REAUTH/);
    await preview.locked(A,async state=>assert.equal(state.resources.root.id,'preview-folder'));
  } finally {await db.close();}
});
