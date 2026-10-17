-- REVIEWED CANDIDATE, NOT APPLIED. Fresh install only. Verify target project before approval.
-- Expiry quarantines the lock; only an operator may reconcile and recover it.
-- No automatic takeover: PostgreSQL fencing cannot cancel an in-flight Google request.
-- Fresh namespace only: never adapt or overwrite existing production objects blindly.
-- No auth users, catalogue grants, Google files or extensions are created.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
do $$ begin
 if to_regclass('auth.users') is null then
   raise exception 'AUTH_SCHEMA_REQUIRED';
 end if;
 if exists(select 1 from pg_catalog.pg_namespace where nspname='g2_private')
    or exists(select 1 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
              where n.nspname='public' and p.proname in ('g2_vault_claim','g2_vault_save','g2_vault_release')) then
   raise exception 'EXISTING_OBJECTS_REQUIRE_REVIEW';
 end if;
end $$;
-- Review draft, NOT an applied migration. Requires an approved V2 Supabase project.
-- Public RPCs are SECURITY INVOKER and executable only by service_role.
create schema g2_private;
revoke all on schema g2_private from public, anon, authenticated;
grant usage on schema g2_private to service_role;
create table g2_private.vault (
 environment text not null check(environment in ('development','preview','production')),
 user_id uuid not null references auth.users(id), ciphertext text,
 primary key(environment,user_id),
 revision integer not null default 0 check (revision >= 0),
 lock_token uuid, locked_at timestamptz, lease_expires_at timestamptz,
 check ((lock_token is null) = (locked_at is null)),
 check ((lock_token is null) = (lease_expires_at is null)),
 check (lease_expires_at > locked_at)
);
alter table g2_private.vault enable row level security;
revoke all on g2_private.vault from public, anon, authenticated;
grant select, insert, update on g2_private.vault to service_role;
create function public.g2_vault_claim(p_user uuid, p_token uuid, p_environment text) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare result jsonb;
begin
 if p_token is null then raise exception 'INVALID_LOCK'; end if;
 insert into g2_private.vault(environment,user_id) values(p_environment,p_user) on conflict do nothing;
 update g2_private.vault set lock_token=p_token, locked_at=clock_timestamp(),
 lease_expires_at=clock_timestamp()+interval '5 minutes', revision=revision+1
 where environment=p_environment and user_id=p_user and lock_token is null
 returning jsonb_build_object('ciphertext',ciphertext,'revision',revision) into result;
 if result is null then raise exception 'BUSY_OR_RECOVERY_REQUIRED'; end if;
 return result;
end $$;
create function public.g2_vault_save(p_user uuid, p_token uuid, p_revision integer, p_ciphertext text, p_environment text) returns integer
language plpgsql security invoker set search_path = '' as $$
declare next_revision integer;
begin
 if p_ciphertext is null then raise exception 'INVALID_STATE'; end if;
 -- Check the deadline after waiting for the row lock, not before that wait.
 perform 1 from g2_private.vault where environment=p_environment and user_id=p_user for update;
 update g2_private.vault set ciphertext=p_ciphertext, revision=revision+1
 where environment=p_environment and user_id=p_user and lock_token=p_token and revision=p_revision and lease_expires_at > clock_timestamp()
 returning revision into next_revision;
 if next_revision is null then raise exception 'STALE_LOCK_OR_REVISION'; end if;
 return next_revision;
end $$;
create function public.g2_vault_release(p_user uuid, p_token uuid, p_environment text) returns boolean
language plpgsql security invoker set search_path = '' as $$
begin
 perform 1 from g2_private.vault where environment=p_environment and user_id=p_user for update;
 update g2_private.vault set lock_token=null,locked_at=null,lease_expires_at=null where environment=p_environment and user_id=p_user and lock_token=p_token and lease_expires_at > clock_timestamp();
 return found;
end $$;
revoke all on function public.g2_vault_claim(uuid,uuid,text),public.g2_vault_save(uuid,uuid,integer,text,text),public.g2_vault_release(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.g2_vault_claim(uuid,uuid,text),public.g2_vault_save(uuid,uuid,integer,text,text),public.g2_vault_release(uuid,uuid,text) to service_role;
-- Not an exposed-schema RPC. Only the migration owner can execute recovery.
-- Prerequisite: stop/quiesce the old worker, reconcile Google outcomes, and approve recovery.
-- Token + revision CAS prevents a stale operator decision from unlocking a newer holder.
create function g2_private.recover_vault(p_user uuid, p_environment text,
 p_expected_token uuid, p_expected_revision integer) returns integer
language plpgsql security invoker set search_path = '' as $$
declare next_revision integer;
begin
 if current_user <> (select pg_catalog.pg_get_userbyid(proowner) from pg_catalog.pg_proc
                    where oid='g2_private.recover_vault(uuid,text,uuid,integer)'::regprocedure) then
   raise exception 'RECOVERY_OWNER_REQUIRED';
 end if;
 update g2_private.vault set lock_token=null, locked_at=null, lease_expires_at=null,
 revision=revision+1
 where environment=p_environment and user_id=p_user and lock_token=p_expected_token
 and revision=p_expected_revision and lease_expires_at <= clock_timestamp()
 returning revision into next_revision;
 if next_revision is null then raise exception 'RECOVERY_PRECONDITION_FAILED'; end if;
 return next_revision;
end $$;
revoke all on function g2_private.recover_vault(uuid,text,uuid,integer)
 from public, anon, authenticated, service_role;
-- Remove custom-role grants inherited from the installer's default ACL too.
-- Touch only the four functions just created, never global default privileges.
do $$ declare f record; g record; begin
 for f in select p.oid,p.proowner,n.nspname,p.proname,
                 pg_catalog.pg_get_function_identity_arguments(p.oid) as args
          from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
          where (n.nspname='public' and p.proname in ('g2_vault_claim','g2_vault_save','g2_vault_release'))
             or (n.nspname='g2_private' and p.proname='recover_vault') loop
   for g in select distinct a.grantee from pg_catalog.pg_proc p,
                lateral pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))) a
            where p.oid=f.oid and a.grantee<>f.proowner loop
     execute format('revoke all on function %I.%I(%s) from %s', f.nspname,f.proname,f.args,
       case when g.grantee=0 then 'PUBLIC' else quote_ident(pg_catalog.pg_get_userbyid(g.grantee)) end);
   end loop;
 end loop;
end $$;
grant execute on function public.g2_vault_claim(uuid,uuid,text),public.g2_vault_save(uuid,uuid,integer,text,text),public.g2_vault_release(uuid,uuid,text) to service_role;


commit;
