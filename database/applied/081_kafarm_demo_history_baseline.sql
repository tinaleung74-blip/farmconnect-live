-- KaFarm pre-rollout demo history baseline.
-- Preserve owner-confirmed demo records for audit while excluding their
-- unfinished workflow-chain rows from current public-rollout alerts.

begin;

create table if not exists public.kafarm_monitor_baselines (
  baseline_key text primary key,
  ignore_before timestamptz not null,
  reason text not null,
  created_at timestamptz not null default now()
);

alter table public.kafarm_monitor_baselines enable row level security;
revoke all on table public.kafarm_monitor_baselines from public, anon, authenticated;
grant select on table public.kafarm_monitor_baselines to service_role;

insert into public.kafarm_monitor_baselines(baseline_key, ignore_before, reason)
values (
  'public_rollout_demo_history', now(),
  'Owner-confirmed pre-public-rollout customer and caretaker records are demo/test history. Preserve records; monitor only workflows updated after this cutoff.'
)
on conflict (baseline_key) do nothing;

create or replace function public.kafarm_guardian_monitor_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_findings jsonb;
  v_baseline_at timestamptz;
  v_demo_history_ignored integer := 0;
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.is_admin() then
    raise exception 'KAFARM_MONITOR_AUTH_REQUIRED';
  end if;

  select ignore_before into v_baseline_at
  from public.kafarm_monitor_baselines
  where baseline_key = 'public_rollout_demo_history';

  select count(*)::integer into v_demo_history_ignored
  from public.workflow_chain_runs run
  where run.completed_at is null
    and run.updated_at < now() - interval '24 hours'
    and v_baseline_at is not null
    and run.updated_at < v_baseline_at;

  with findings as (
    select
      'workflow_stuck'::text as code,
      case when run.updated_at < now() - interval '72 hours' then 'high' else 'medium' end::text as severity,
      run.workflow_type::text as workflow,
      ('Workflow has not advanced from ' || coalesce(run.last_successful_step, run.current_status, 'unknown'))::text as message,
      'workflow_chain_runs'::text as source,
      run.source_record_id::text as source_record_id
    from public.workflow_chain_runs run
    where run.completed_at is null
      and run.updated_at < now() - interval '24 hours'
      and (v_baseline_at is null or run.updated_at >= v_baseline_at)

    union all

    select
      'care_plan_overdue_mission'::text, 'high'::text, 'care_plan'::text,
      'An active Care Plan daily mission is overdue.'::text,
      'rooster_daily_missions'::text, mission.id::text
    from public.rooster_daily_missions mission
    where mission.status in ('scheduled', 'active', 'overdue')
      and mission.mission_date < (now() at time zone 'Asia/Manila')::date
      and (v_baseline_at is null or coalesce(mission.updated_at, mission.created_at) >= v_baseline_at)
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'code', code, 'severity', severity, 'workflow', workflow,
    'message', message, 'source', source, 'sourceRecordId', source_record_id
  ) order by severity, code), '[]'::jsonb)
  into v_findings
  from findings;

  return jsonb_build_object(
    'generated_at', now(),
    'mode', 'read_only_public_rollout_monitor',
    'truth_model_version', 'current-deployment-v3',
    'finding_count', jsonb_array_length(v_findings),
    'demo_baseline_at', v_baseline_at,
    'demo_history_ignored', v_demo_history_ignored,
    'findings', v_findings
  );
end;
$$;

revoke all on function public.kafarm_guardian_monitor_snapshot() from public, anon, authenticated;
grant execute on function public.kafarm_guardian_monitor_snapshot() to service_role;

commit;

select jsonb_build_object(
  'verification', jsonb_build_object(
    'migration', '081_kafarm_demo_history_baseline',
    'baseline_table', to_regclass('public.kafarm_monitor_baselines') is not null,
    'snapshot_rpc', to_regprocedure('public.kafarm_guardian_monitor_snapshot()') is not null,
    'baseline_at', (select ignore_before from public.kafarm_monitor_baselines where baseline_key = 'public_rollout_demo_history'),
    'business_records_changed', false,
    'business_records_deleted', false
  )
) as verification;
