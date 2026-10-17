-- Review draft, NOT an applied migration. Requires an approved V2 Supabase project.
-- Public RPCs are SECURITY INVOKER and executable only by service_role.
create schema if not exists g2_private;
revoke all on schema g2_private from public, anon, authenticated;
grant usage on schema g2_private to service_role;
create table g2_private.vault (
 environment text not null check(environment in ('development','preview','production')),
 user_id uuid not null references auth.users(id), ciphertext text,
 primary key(environment,user_id),
 revision integer not null default 0 check (revision >= 0),
 lock_token uuid, locked_at timestamptz,
 check ((lock_token is null) = (locked_at is null))
);
alter table g2_private.vault enable row level security;
revoke all on g2_private.vault from public, anon, authenticated;
grant select, insert, update on g2_private.vault to service_role;
create function public.g2_vault_claim(p_user uuid, p_token uuid, p_environment text default 'development') returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare result jsonb;
begin
 if p_token is null then raise exception 'INVALID_LOCK'; end if;
 insert into g2_private.vault(environment,user_id) values(p_environment,p_user) on conflict do nothing;
 update g2_private.vault set lock_token=p_token, locked_at=now()
 where environment=p_environment and user_id=p_user and lock_token is null
 returning jsonb_build_object('ciphertext',ciphertext,'revision',revision) into result;
 if result is null then raise exception 'BUSY'; end if;
 return result;
end $$;
create function public.g2_vault_save(p_user uuid, p_token uuid, p_revision integer, p_ciphertext text, p_environment text default 'development') returns integer
language plpgsql security invoker set search_path = '' as $$
declare next_revision integer;
begin
 if p_ciphertext is null then raise exception 'INVALID_STATE'; end if;
 update g2_private.vault set ciphertext=p_ciphertext, revision=revision+1
 where environment=p_environment and user_id=p_user and lock_token=p_token and revision=p_revision
 returning revision into next_revision;
 if next_revision is null then raise exception 'STALE_LOCK_OR_REVISION'; end if;
 return next_revision;
end $$;
create function public.g2_vault_release(p_user uuid, p_token uuid, p_environment text default 'development') returns boolean
language plpgsql security invoker set search_path = '' as $$
begin
 update g2_private.vault set lock_token=null,locked_at=null where environment=p_environment and user_id=p_user and lock_token=p_token;
 return found;
end $$;
revoke all on function public.g2_vault_claim(uuid,uuid,text),public.g2_vault_save(uuid,uuid,integer,text,text),public.g2_vault_release(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.g2_vault_claim(uuid,uuid,text),public.g2_vault_save(uuid,uuid,integer,text,text),public.g2_vault_release(uuid,uuid,text) to service_role;
-- No automatic stale-lock takeover or client unlock API. Investigate external outcomes first.
