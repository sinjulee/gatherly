-- READ ONLY. No tokens, ciphertext or user identifiers returned. No Vault RPC calls.
begin read only;
select current_database(), current_user;
select n.nspname, c.relname, c.relrowsecurity, c.relforcerowsecurity,
       pg_get_userbyid(c.relowner) as owner, c.relacl
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='g2_private' and c.relname='vault';
select column_name, data_type, is_nullable, column_default
from information_schema.columns where table_schema='g2_private' and table_name='vault'
order by ordinal_position;
select conname, pg_get_constraintdef(oid) as definition
from pg_constraint where conrelid=to_regclass('g2_private.vault');
select schemaname,tablename,policyname,roles,cmd,qual,with_check
from pg_policies where schemaname='g2_private';
select n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) as arguments,
 p.prosecdef,p.proconfig,p.proacl,pg_get_userbyid(p.proowner) as owner,
 pg_get_functiondef(p.oid) as definition
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where (n.nspname='public' and p.proname in ('g2_vault_claim','g2_vault_save','g2_vault_release'))
 or (n.nspname='g2_private' and p.proname='recover_vault');
-- Effective grants, including inheritance; inspect unexpected custom roles as well.
select r.rolname,n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) as arguments,
 has_function_privilege(r.oid,p.oid,'EXECUTE') as can_execute
from pg_roles r cross join pg_proc p join pg_namespace n on n.oid=p.pronamespace
where (n.nspname='public' and p.proname in ('g2_vault_claim','g2_vault_save','g2_vault_release'))
 or (n.nspname='g2_private' and p.proname='recover_vault');
-- grantee=0 is PUBLIC. NULL proacl means PostgreSQL defaults, not no permissions.
select n.nspname,p.proname,a.grantee,a.privilege_type,a.is_grantable
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
where (n.nspname='public' and p.proname in ('g2_vault_claim','g2_vault_save','g2_vault_release'))
 or (n.nspname='g2_private' and p.proname='recover_vault');
select pg_get_userbyid(defaclrole) as owner,defaclnamespace::regnamespace as schema,
 defaclobjtype,defaclacl from pg_default_acl where defaclobjtype='f';
-- Expected: zero rows. Owners/superusers are PostgreSQL privileged exceptions.
select r.rolname,n.nspname,p.proname as unexpected_effective_execute
from pg_roles r cross join pg_proc p join pg_namespace n on n.oid=p.pronamespace
where ((n.nspname='public' and p.proname in ('g2_vault_claim','g2_vault_save','g2_vault_release'))
    or (n.nspname='g2_private' and p.proname='recover_vault'))
 and r.oid<>p.proowner and not r.rolsuper
 and not (n.nspname='public' and r.rolname='service_role')
 and has_function_privilege(r.oid,p.oid,'EXECUTE');
-- Default table grants and schema usage must also be reviewed independently of RPC ACLs.
select r.rolname,has_schema_privilege(r.oid,'g2_private','USAGE') as schema_usage,
 has_table_privilege(r.oid,'g2_private.vault','SELECT') as can_select,
 has_table_privilege(r.oid,'g2_private.vault','UPDATE') as can_update
from pg_roles r;
-- Aggregate lock status only. Run after installation with the approved audit role.
select environment,count(*) as total,
 count(*) filter(where lock_token is not null) as locked,
 count(*) filter(where lease_expires_at <= clock_timestamp()) as requires_reconciliation
from g2_private.vault group by environment;
rollback;
