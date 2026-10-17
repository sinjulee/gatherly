-- REVIEW DRAFT ONLY. Not a migration. Run only in an approved empty V2 project.
create table public.g2_exhibitions (
 id uuid primary key, name text not null, published boolean not null default false
);
create table public.g2_companies (
 id uuid primary key, name text not null, published boolean not null default false,
 rights_approved boolean not null default false, source_url text not null
);
create table public.g2_exhibitors (
 id uuid primary key, exhibition_id uuid not null references public.g2_exhibitions,
 company_id uuid not null references public.g2_companies, source_id text not null,
 external_id text not null, summary text not null default '', published boolean not null default false,
 unique(source_id, external_id, exhibition_id), unique(id, exhibition_id)
);
create table public.g2_maps (
 id uuid primary key, exhibition_id uuid not null references public.g2_exhibitions,
 version text not null, sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
 width integer not null check(width > 0), height integer not null check(height > 0),
 source_url text not null, rights_approved boolean not null default false,
 published boolean not null default false, unique(id, exhibition_id), unique(exhibition_id, version)
);
create table public.g2_booths (
 id uuid primary key, exhibition_id uuid not null references public.g2_exhibitions,
 code text not null, unique(exhibition_id, code), unique(id, exhibition_id)
);
create table public.g2_exhibitor_booths (
 exhibitor_id uuid not null, booth_id uuid not null, exhibition_id uuid not null,
 primary key(exhibitor_id, booth_id),
 foreign key(exhibitor_id, exhibition_id) references public.g2_exhibitors(id, exhibition_id),
 foreign key(booth_id, exhibition_id) references public.g2_booths(id, exhibition_id)
);
create table public.g2_hotspots (
 id uuid primary key, map_id uuid not null, booth_id uuid not null, exhibition_id uuid not null,
 x numeric not null, y numeric not null, width numeric not null, height numeric not null,
 verified boolean not null default false, reviewed_by uuid references auth.users, reviewed_at timestamptz,
 check(x >= 0 and y >= 0 and width > 0 and height > 0 and x+width <= 1 and y+height <= 1),
 check(not verified or (reviewed_by is not null and reviewed_at is not null)),
 foreign key(map_id, exhibition_id) references public.g2_maps(id, exhibition_id),
 foreign key(booth_id, exhibition_id) references public.g2_booths(id, exhibition_id), unique(map_id, booth_id)
);
-- Internal pilot catalogue: server allowlist AND database approval are required.
-- This catalogue is shared official data, not private environment-specific research.
create table public.g2_catalog_readers (user_id uuid primary key references auth.users);
-- Administrative role never implies report-generation entitlement.
create table public.g2_admins (user_id uuid primary key references auth.users);
create table public.g2_entitlements (
 id uuid primary key, user_id uuid not null references auth.users,
 kind text not null check(kind in ('PERIOD','ONE_TIME','PREMIUM')), expires_at timestamptz,
 remaining integer not null check(remaining >= 0)
);
create table public.g2_storage_links (
 user_id uuid primary key references auth.users, connection_status text not null,
 updated_at timestamptz not null default now()
);
-- Tokens, private notes and Google file contents are NOT stored in public tables.
-- Revoke all writes explicitly, even if project default privileges differ.
do $$ declare t text; begin
 foreach t in array array['g2_exhibitions','g2_companies','g2_exhibitors','g2_maps','g2_booths','g2_exhibitor_booths','g2_hotspots','g2_catalog_readers','g2_admins','g2_entitlements','g2_storage_links'] loop
 execute format('alter table public.%I enable row level security', t);
 execute format('revoke all on public.%I from public, anon, authenticated', t);
 execute format('grant all on public.%I to service_role', t);
 end loop;
end $$;
grant select on public.g2_exhibitions,public.g2_companies,public.g2_exhibitors,public.g2_maps,public.g2_booths,public.g2_exhibitor_booths,public.g2_hotspots to authenticated;
grant select on public.g2_catalog_readers,public.g2_admins,public.g2_entitlements,public.g2_storage_links to authenticated;
create policy exhibition_read on public.g2_exhibitions for select to authenticated using(exists(select 1 from public.g2_catalog_readers r where r.user_id=(select auth.uid())) and published);
create policy company_read on public.g2_companies for select to authenticated using(exists(select 1 from public.g2_catalog_readers r where r.user_id=(select auth.uid())) and published and rights_approved);
create policy exhibitor_read on public.g2_exhibitors for select to authenticated using(exists(select 1 from public.g2_catalog_readers r where r.user_id=(select auth.uid())) and published and exists(select 1 from public.g2_exhibitions e where e.id=exhibition_id) and exists(select 1 from public.g2_companies c where c.id=company_id));
create policy map_read on public.g2_maps for select to authenticated using(exists(select 1 from public.g2_catalog_readers r where r.user_id=(select auth.uid())) and published and rights_approved and exists(select 1 from public.g2_exhibitions e where e.id=exhibition_id));
create policy booth_read on public.g2_booths for select to authenticated using(exists(select 1 from public.g2_catalog_readers r where r.user_id=(select auth.uid())) and exists(select 1 from public.g2_exhibitions e where e.id=exhibition_id));
create policy link_read on public.g2_exhibitor_booths for select to authenticated using(exists(select 1 from public.g2_catalog_readers r where r.user_id=(select auth.uid())) and exists(select 1 from public.g2_exhibitors e where e.id=exhibitor_id) and exists(select 1 from public.g2_booths b where b.id=booth_id));
create policy hotspot_read on public.g2_hotspots for select to authenticated using(exists(select 1 from public.g2_catalog_readers r where r.user_id=(select auth.uid())) and verified and exists(select 1 from public.g2_maps m where m.id=map_id) and exists(select 1 from public.g2_exhibitor_booths b where b.booth_id=g2_hotspots.booth_id));
create policy reader_self on public.g2_catalog_readers for select to authenticated using((select auth.uid())=user_id);
create policy admin_self on public.g2_admins for select to authenticated using((select auth.uid())=user_id);
create policy entitlement_self on public.g2_entitlements for select to authenticated using((select auth.uid())=user_id);
create policy storage_self on public.g2_storage_links for select to authenticated using((select auth.uid())=user_id);
create index on public.g2_exhibitors(exhibition_id);
create index on public.g2_exhibitors(company_id);
create index on public.g2_hotspots(map_id);
create index on public.g2_exhibitor_booths(booth_id);
create index on public.g2_entitlements(user_id);
