-- PROPOSED ONLY — NOT APPLIED BY CODEX.
-- Durable semantic incident memory requires explicit schema approval.
-- This table stores engineering knowledge, not credentials or private KYC media.

begin;

create table if not exists public.kafarm_guardian_incident_memory (
  id uuid primary key default gen_random_uuid(),
  source_incident_id uuid references public.kafarm_incidents(id) on delete set null,
  fingerprint text not null unique,
  symptom text not null,
  workflow text not null,
  evidence jsonb not null default '[]'::jsonb,
  root_cause text,
  root_cause_confidence text not null default 'UNKNOWN' check (root_cause_confidence in ('CONFIRMED','HIGH_CONFIDENCE','LIKELY','UNKNOWN','CONTRADICTORY')),
  affected_version text,
  implemented_fix text,
  test_proof jsonb not null default '[]'::jsonb,
  result text,
  prevention_rule text,
  status text not null default 'open' check (status in ('open','resolved','invalidated')),
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.kafarm_guardian_incident_memory enable row level security;

drop policy if exists "active admins read guardian incident memory" on public.kafarm_guardian_incident_memory;
create policy "active admins read guardian incident memory"
on public.kafarm_guardian_incident_memory for select to authenticated
using (public.is_admin());

revoke all on table public.kafarm_guardian_incident_memory from public, anon, authenticated;
grant select on table public.kafarm_guardian_incident_memory to authenticated;

commit;

select jsonb_build_object(
  'proposal', '068_kafarm_guardian_semantic_incident_memory',
  'table_present', to_regclass('public.kafarm_guardian_incident_memory') is not null,
  'automatic_write_enabled', false
) as review_note;
