-- FarmConnect KaFarm privacy-safe device usage audit
-- Captures layout class and route usage only. No raw fingerprint, IP, password,
-- token, receipt, payment detail, or full user-agent string is stored.

create table if not exists public.kafarm_device_usage_logs (
  id uuid primary key default gen_random_uuid(),
  session_key text not null,
  profile_id uuid references public.profiles(id) on delete set null,
  auth_user_id uuid,
  app_role text not null default 'public',
  route text not null,
  device_type text not null check (device_type in ('phone','tablet','desktop')),
  layout_mode text not null check (layout_mode in ('mobile','tablet','desktop')),
  viewport_width integer not null check (viewport_width between 1 and 10000),
  viewport_height integer not null check (viewport_height between 1 and 10000),
  orientation text not null check (orientation in ('portrait','landscape')),
  browser_family text not null default 'Other',
  os_family text not null default 'Other',
  touch_capable boolean not null default false,
  visit_count integer not null default 1 check (visit_count > 0),
  metadata jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique(session_key, route)
);

create index if not exists idx_kafarm_device_usage_last_seen
  on public.kafarm_device_usage_logs(last_seen_at desc);
create index if not exists idx_kafarm_device_usage_type_role
  on public.kafarm_device_usage_logs(device_type, app_role, last_seen_at desc);
create index if not exists idx_kafarm_device_usage_profile
  on public.kafarm_device_usage_logs(profile_id, last_seen_at desc);

alter table public.kafarm_device_usage_logs enable row level security;

drop policy if exists "kafarm device usage admin read" on public.kafarm_device_usage_logs;
create policy "kafarm device usage admin read"
on public.kafarm_device_usage_logs for select to authenticated
using (public.is_admin());

drop policy if exists "kafarm device usage owner read" on public.kafarm_device_usage_logs;
create policy "kafarm device usage owner read"
on public.kafarm_device_usage_logs for select to authenticated
using (profile_id = public.current_profile_id());

revoke insert, update, delete on public.kafarm_device_usage_logs from anon, authenticated;
grant select on public.kafarm_device_usage_logs to authenticated;

create or replace function public.kafarm_record_device_usage(
  p_session_key text,
  p_app_role text,
  p_route text,
  p_device_type text,
  p_layout_mode text,
  p_viewport_width integer,
  p_viewport_height integer,
  p_orientation text,
  p_browser_family text default 'Other',
  p_os_family text default 'Other',
  p_touch_capable boolean default false,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_profile_id uuid;
  v_role text := 'public';
  v_route text;
  v_device_type text := lower(trim(coalesce(p_device_type, '')));
  v_layout_mode text := lower(trim(coalesce(p_layout_mode, '')));
  v_orientation text := lower(trim(coalesce(p_orientation, '')));
begin
  if length(trim(coalesce(p_session_key, ''))) < 8 then
    raise exception 'DEVICE_SESSION_REQUIRED';
  end if;
  if v_device_type not in ('phone','tablet','desktop') then
    raise exception 'INVALID_DEVICE_TYPE';
  end if;
  if v_layout_mode not in ('mobile','tablet','desktop') then
    raise exception 'INVALID_LAYOUT_MODE';
  end if;
  if v_orientation not in ('portrait','landscape') then
    raise exception 'INVALID_ORIENTATION';
  end if;
  if coalesce(p_viewport_width, 0) not between 1 and 10000
     or coalesce(p_viewport_height, 0) not between 1 and 10000 then
    raise exception 'INVALID_VIEWPORT';
  end if;

  v_route := left(coalesce(nullif(trim(p_route), ''), '/'), 500);

  if auth.uid() is not null then
    select id, lower(coalesce(role, 'customer'))
      into v_profile_id, v_role
    from public.profiles
    where auth_user_id = auth.uid()
    limit 1;
  else
    v_role := 'public';
  end if;

  insert into public.kafarm_device_usage_logs(
    session_key, profile_id, auth_user_id, app_role, route,
    device_type, layout_mode, viewport_width, viewport_height,
    orientation, browser_family, os_family, touch_capable, metadata
  ) values (
    left(trim(p_session_key), 120), v_profile_id, auth.uid(),
    left(coalesce(nullif(v_role, ''), lower(coalesce(p_app_role, 'public'))), 40),
    v_route, v_device_type, v_layout_mode, p_viewport_width, p_viewport_height,
    v_orientation, left(coalesce(nullif(trim(p_browser_family), ''), 'Other'), 80),
    left(coalesce(nullif(trim(p_os_family), ''), 'Other'), 80),
    coalesce(p_touch_capable, false),
    jsonb_build_object('capture', 'privacy_safe') || coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (session_key, route) do update
  set profile_id = coalesce(excluded.profile_id, public.kafarm_device_usage_logs.profile_id),
      auth_user_id = coalesce(excluded.auth_user_id, public.kafarm_device_usage_logs.auth_user_id),
      app_role = excluded.app_role,
      device_type = excluded.device_type,
      layout_mode = excluded.layout_mode,
      viewport_width = excluded.viewport_width,
      viewport_height = excluded.viewport_height,
      orientation = excluded.orientation,
      browser_family = excluded.browser_family,
      os_family = excluded.os_family,
      touch_capable = excluded.touch_capable,
      visit_count = public.kafarm_device_usage_logs.visit_count + 1,
      metadata = public.kafarm_device_usage_logs.metadata || excluded.metadata,
      last_seen_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.kafarm_record_device_usage(
  text,text,text,text,text,integer,integer,text,text,text,boolean,jsonb
) from public, anon;
grant execute on function public.kafarm_record_device_usage(
  text,text,text,text,text,integer,integer,text,text,text,boolean,jsonb
) to authenticated;

create or replace view public.admin_kafarm_device_usage_summary as
select
  device_type,
  layout_mode,
  app_role,
  count(*)::bigint as route_sessions,
  count(distinct session_key)::bigint as unique_sessions,
  count(distinct profile_id)::bigint as identified_users,
  sum(visit_count)::bigint as total_route_views,
  min(first_seen_at) as first_seen_at,
  max(last_seen_at) as last_seen_at
from public.kafarm_device_usage_logs
where public.is_admin()
group by device_type, layout_mode, app_role;

grant select on public.admin_kafarm_device_usage_summary to authenticated;

select 'kafarm_device_usage_logs_ready' as check_name, count(*)
from information_schema.tables
where table_schema = 'public' and table_name = 'kafarm_device_usage_logs'
union all
select 'kafarm_record_device_usage_ready', count(*)
from information_schema.routines
where routine_schema = 'public' and routine_name = 'kafarm_record_device_usage'
union all
select 'admin_kafarm_device_usage_summary_ready', count(*)
from information_schema.views
where table_schema = 'public' and table_name = 'admin_kafarm_device_usage_summary';
