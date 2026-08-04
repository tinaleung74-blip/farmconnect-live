-- FarmConnect customer animal ownership table
-- Run after: 005_gamefowl_bloodlines.sql
-- Purpose:
-- - Store customer-owned rooster/chick ownership records.
-- - Keep bloodline/source product snapshots for invoices, evidence, and disputes.

begin;

create table if not exists public.customer_animals (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  animal_id uuid references public.animals(id) on delete set null,
  animal_name text,
  animal_code text,
  status text not null default 'active',
  acquired_from text not null default 'farm_buy',
  acquired_at timestamptz not null default now(),
  source_product_id text,
  source_product_name text,
  bloodline_snapshot text,
  breed_snapshot text,
  ownership_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.customer_animals
  add column if not exists profile_id uuid references public.profiles(id) on delete cascade,
  add column if not exists animal_id uuid references public.animals(id) on delete set null,
  add column if not exists animal_name text,
  add column if not exists animal_code text,
  add column if not exists status text not null default 'active',
  add column if not exists acquired_from text not null default 'farm_buy',
  add column if not exists acquired_at timestamptz not null default now(),
  add column if not exists source_product_id text,
  add column if not exists source_product_name text,
  add column if not exists bloodline_snapshot text,
  add column if not exists breed_snapshot text,
  add column if not exists ownership_metadata jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_customer_animals_profile_id
  on public.customer_animals(profile_id);

create index if not exists idx_customer_animals_animal_id
  on public.customer_animals(animal_id);

create index if not exists idx_customer_animals_bloodline
  on public.customer_animals(lower(bloodline_snapshot));

alter table public.customer_animals enable row level security;

drop policy if exists "customer animals owner read" on public.customer_animals;
create policy "customer animals owner read"
on public.customer_animals
for select
to authenticated
using (
  profile_id = public.current_profile_id()
  or public.is_admin()
);

drop policy if exists "customer animals admin write" on public.customer_animals;
create policy "customer animals admin write"
on public.customer_animals
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Backfill ownership snapshots from existing animals if animals already use profile_id.
insert into public.customer_animals (
  profile_id,
  animal_id,
  animal_name,
  animal_code,
  status,
  acquired_from,
  source_product_id,
  source_product_name,
  bloodline_snapshot,
  breed_snapshot,
  ownership_metadata
)
select
  a.profile_id,
  a.id,
  a.name,
  a.code,
  'active',
  'existing_animal',
  a.source_product_id,
  a.source_product_name,
  a.bloodline,
  a.breed,
  jsonb_build_object('backfilled_by', '006_customer_animals_ownership_table')
from public.animals a
where a.profile_id is not null
  and not exists (
    select 1
    from public.customer_animals ca
    where ca.profile_id = a.profile_id
      and ca.animal_id = a.id
  );

commit;

-- Verification:
-- select 'customer_animals_exists' as check_name, count(*) from information_schema.tables where table_schema = 'public' and table_name = 'customer_animals'
-- union all
-- select 'customer_animals_rls_enabled', count(*) from pg_tables where schemaname = 'public' and tablename = 'customer_animals' and rowsecurity = true
-- union all
-- select 'customer_animals_policy_count', count(*) from pg_policies where schemaname = 'public' and tablename = 'customer_animals';
