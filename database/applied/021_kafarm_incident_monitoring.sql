-- FarmConnect KaFarm incident monitoring
-- Purpose: save frontend/API/browser incidents to Supabase for admin System Health.
-- Safe scope: logging and admin status notes only. No wallet/KYC/withdrawal actions.

create table if not exists public.kafarm_incidents (
  id uuid primary key default gen_random_uuid(),
  incident_key text unique,
  source text not null default 'client_monitor',
  title text not null,
  category text not null default 'Frontend',
  severity text not null default 'Medium',
  status text not null default 'Checking',
  app_role text not null default 'unknown',
  route text,
  affected text,
  message text not null,
  evidence text[] not null default '{}'::text[],
  proposed_fix text,
  safe_recovery text,
  metadata jsonb not null default '{}'::jsonb,
  stack_trace text,
  http_status integer,
  request_url text,
  profile_id uuid references public.profiles(id) on delete set null,
  auth_user_id uuid,
  admin_notes text,
  resolved_by_profile_id uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_kafarm_incidents_status_created on public.kafarm_incidents(status, created_at desc);
create index if not exists idx_kafarm_incidents_profile_created on public.kafarm_incidents(profile_id, created_at desc);
create index if not exists idx_kafarm_incidents_role_route on public.kafarm_incidents(app_role, route);
create index if not exists idx_kafarm_incidents_metadata_gin on public.kafarm_incidents using gin(metadata);

alter table public.kafarm_incidents enable row level security;

drop policy if exists "kafarm incidents admin read all" on public.kafarm_incidents;
create policy "kafarm incidents admin read all" on public.kafarm_incidents
for select to authenticated
using (public.is_admin());

drop policy if exists "kafarm incidents owner read own" on public.kafarm_incidents;
create policy "kafarm incidents owner read own" on public.kafarm_incidents
for select to authenticated
using (profile_id = public.current_profile_id());

drop policy if exists "kafarm incidents admin update" on public.kafarm_incidents;
create policy "kafarm incidents admin update" on public.kafarm_incidents
for update to authenticated
using (public.is_admin())
with check (public.is_admin());

create or replace function public.kafarm_record_incident(
  p_incident_key text,
  p_title text,
  p_category text default 'Frontend',
  p_severity text default 'Medium',
  p_status text default 'Checking',
  p_app_role text default 'unknown',
  p_route text default null,
  p_affected text default null,
  p_message text default '',
  p_evidence text[] default '{}'::text[],
  p_proposed_fix text default null,
  p_safe_recovery text default null,
  p_metadata jsonb default '{}'::jsonb,
  p_stack_trace text default null,
  p_http_status integer default null,
  p_request_url text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_id uuid;
begin
  if nullif(trim(coalesce(p_title, '')), '') is null then
    raise exception 'INCIDENT_TITLE_REQUIRED';
  end if;

  if nullif(trim(coalesce(p_message, '')), '') is null then
    raise exception 'INCIDENT_MESSAGE_REQUIRED';
  end if;

  select id into v_profile_id
  from public.profiles
  where auth_user_id = auth.uid()
  limit 1;

  insert into public.kafarm_incidents(
    incident_key,
    source,
    title,
    category,
    severity,
    status,
    app_role,
    route,
    affected,
    message,
    evidence,
    proposed_fix,
    safe_recovery,
    metadata,
    stack_trace,
    http_status,
    request_url,
    profile_id,
    auth_user_id
  )
  values (
    nullif(trim(p_incident_key), ''),
    'client_monitor',
    left(trim(p_title), 180),
    left(coalesce(nullif(trim(p_category), ''), 'Frontend'), 80),
    left(coalesce(nullif(trim(p_severity), ''), 'Medium'), 40),
    left(coalesce(nullif(trim(p_status), ''), 'Checking'), 60),
    left(coalesce(nullif(trim(p_app_role), ''), 'unknown'), 40),
    left(coalesce(p_route, ''), 500),
    left(coalesce(p_affected, ''), 500),
    left(trim(p_message), 3000),
    coalesce(p_evidence, '{}'::text[]),
    left(coalesce(p_proposed_fix, ''), 1500),
    left(coalesce(p_safe_recovery, ''), 1500),
    coalesce(p_metadata, '{}'::jsonb),
    left(coalesce(p_stack_trace, ''), 6000),
    p_http_status,
    left(coalesce(p_request_url, ''), 1000),
    v_profile_id,
    auth.uid()
  )
  on conflict (incident_key) do update
  set updated_at = now(),
      status = case
        when public.kafarm_incidents.status in ('Resolved', 'Ignored') then public.kafarm_incidents.status
        else excluded.status
      end,
      metadata = coalesce(public.kafarm_incidents.metadata, '{}'::jsonb)
        || jsonb_build_object('repeat_seen_at', now(), 'repeat_route', excluded.route)
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.admin_kafarm_update_incident_status(
  p_incident_id uuid,
  p_status text,
  p_admin_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_profile_id uuid;
begin
  if not public.is_admin() then
    raise exception 'ADMIN_REQUIRED';
  end if;

  select public.current_profile_id() into v_admin_profile_id;

  update public.kafarm_incidents
  set status = left(coalesce(nullif(trim(p_status), ''), status), 60),
      admin_notes = p_admin_notes,
      resolved_by_profile_id = case when lower(coalesce(p_status, '')) in ('resolved','ignored') then v_admin_profile_id else resolved_by_profile_id end,
      resolved_at = case when lower(coalesce(p_status, '')) in ('resolved','ignored') then now() else resolved_at end,
      updated_at = now()
  where id = p_incident_id
  returning id into p_incident_id;

  if p_incident_id is null then
    raise exception 'INCIDENT_NOT_FOUND';
  end if;

  return p_incident_id;
end;
$$;

create or replace view public.admin_kafarm_incident_queue as
select
  ki.id,
  ki.incident_key,
  ki.title,
  ki.category,
  ki.severity,
  ki.status,
  ki.app_role,
  ki.route,
  ki.affected,
  ki.message,
  ki.evidence,
  ki.proposed_fix,
  ki.safe_recovery,
  ki.metadata,
  ki.stack_trace,
  ki.http_status,
  ki.request_url,
  ki.profile_id,
  p.email,
  p.full_name,
  ki.admin_notes,
  ki.created_at,
  ki.updated_at,
  ki.resolved_at
from public.kafarm_incidents ki
left join public.profiles p on p.id = ki.profile_id
where public.is_admin()
order by ki.created_at desc;

grant execute on function public.kafarm_record_incident(text,text,text,text,text,text,text,text,text,text[],text,text,jsonb,text,integer,text) to anon, authenticated;
grant execute on function public.admin_kafarm_update_incident_status(uuid,text,text) to authenticated;
grant select on public.admin_kafarm_incident_queue to authenticated;

-- Verification:
-- select 'kafarm_incidents_table', count(*) from information_schema.tables where table_schema='public' and table_name='kafarm_incidents'
-- union all select 'kafarm_record_incident_function', count(*) from information_schema.routines where routine_schema='public' and routine_name='kafarm_record_incident'
-- union all select 'admin_kafarm_update_incident_status_function', count(*) from information_schema.routines where routine_schema='public' and routine_name='admin_kafarm_update_incident_status'
-- union all select 'admin_kafarm_incident_queue_view', count(*) from information_schema.views where table_schema='public' and table_name='admin_kafarm_incident_queue';
