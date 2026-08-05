-- FarmConnect KaFarm temporary SQL gateway bootstrap.
-- DEV ONLY. Run this once in Supabase SQL Editor for FarmConnect only.
-- Disable the app gateway with KAFARM_SQL_GATEWAY_ENABLED=false before real production users.

create table if not exists public.kafarm_sql_gateway_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_profile_id uuid references public.profiles(id) on delete set null,
  mode text not null check (mode in ('read','write','migration')),
  sql_preview text not null,
  sql_hash text not null,
  status text not null check (status in ('started','success','failed','blocked')),
  result_summary jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now()
);

alter table public.kafarm_sql_gateway_audit_logs enable row level security;

drop policy if exists "kafarm sql audit admin read" on public.kafarm_sql_gateway_audit_logs;
create policy "kafarm sql audit admin read"
on public.kafarm_sql_gateway_audit_logs
for select
using (public.is_admin());

drop policy if exists "kafarm sql audit service insert" on public.kafarm_sql_gateway_audit_logs;
create policy "kafarm sql audit service insert"
on public.kafarm_sql_gateway_audit_logs
for insert
with check (true);

create or replace function public.kafarm_dev_exec_sql(
  p_sql text,
  p_mode text default 'read',
  p_confirm_danger boolean default false,
  p_admin_profile_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sql text := trim(coalesce(p_sql, ''));
  v_mode text := lower(trim(coalesce(p_mode, 'read')));
  v_preview text;
  v_hash text;
  v_audit_id uuid;
  v_result jsonb := '[]'::jsonb;
  v_count integer := 0;
begin
  if v_sql = '' then
    raise exception 'EMPTY_SQL';
  end if;

  if v_mode not in ('read','write','migration') then
    raise exception 'INVALID_MODE';
  end if;

  v_preview := left(regexp_replace(v_sql, '\s+', ' ', 'g'), 260);
  v_hash := md5(v_sql);

  insert into public.kafarm_sql_gateway_audit_logs(
    admin_profile_id,
    mode,
    sql_preview,
    sql_hash,
    status
  )
  values (
    p_admin_profile_id,
    v_mode,
    v_preview,
    v_hash,
    'started'
  )
  returning id into v_audit_id;

  if v_sql ~* '\b(drop\s+table|truncate|delete\s+from|update\s+auth\.|delete\s+from\s+auth\.|alter\s+role)\b'
     and not p_confirm_danger then
    update public.kafarm_sql_gateway_audit_logs
    set status = 'blocked',
        error_message = 'DESTRUCTIVE_SQL_BLOCKED'
    where id = v_audit_id;
    raise exception 'DESTRUCTIVE_SQL_BLOCKED';
  end if;

  if v_mode = 'read' then
    if v_sql !~* '^\s*(select|with)\b' then
      update public.kafarm_sql_gateway_audit_logs
      set status = 'blocked',
          error_message = 'READ_MODE_ONLY_ALLOWS_SELECT_OR_WITH'
      where id = v_audit_id;
      raise exception 'READ_MODE_ONLY_ALLOWS_SELECT_OR_WITH';
    end if;

    execute format('select coalesce(jsonb_agg(to_jsonb(q)), ''[]''::jsonb), count(*) from (%s) q', v_sql)
    into v_result, v_count;

    update public.kafarm_sql_gateway_audit_logs
    set status = 'success',
        result_summary = jsonb_build_object('rows', v_count)
    where id = v_audit_id;

    return jsonb_build_object(
      'audit_id', v_audit_id,
      'mode', v_mode,
      'rows', v_count,
      'data', v_result
    );
  end if;

  execute v_sql;

  update public.kafarm_sql_gateway_audit_logs
  set status = 'success',
      result_summary = jsonb_build_object('executed', true)
  where id = v_audit_id;

  return jsonb_build_object(
    'audit_id', v_audit_id,
    'mode', v_mode,
    'executed', true,
    'note', 'Write/migration SQL executed. Run a read query next to verify result.'
  );
exception
  when others then
    if v_audit_id is not null then
      update public.kafarm_sql_gateway_audit_logs
      set status = case when status = 'blocked' then 'blocked' else 'failed' end,
          error_message = sqlerrm,
          result_summary = jsonb_build_object('sqlstate', sqlstate)
      where id = v_audit_id;
    end if;
    raise;
end;
$$;

revoke all on function public.kafarm_dev_exec_sql(text,text,boolean,uuid) from public;
revoke all on function public.kafarm_dev_exec_sql(text,text,boolean,uuid) from anon;
revoke all on function public.kafarm_dev_exec_sql(text,text,boolean,uuid) from authenticated;
grant execute on function public.kafarm_dev_exec_sql(text,text,boolean,uuid) to service_role;

select
  'kafarm_sql_gateway_ready' as check_name,
  count(*) as count
from information_schema.routines
where routine_schema = 'public'
  and routine_name = 'kafarm_dev_exec_sql';
