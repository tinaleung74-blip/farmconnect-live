-- Prevent KaFarm Guardian from turning an old incident into a new incident.
-- The monitor now returns only current source records that require operational
-- reconciliation. Browser/API incidents remain in kafarm_incidents and are read
-- directly by Truth Reference without timestamp refresh or shadow copies.

begin;

create or replace function public.kafarm_guardian_monitor_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_findings jsonb;
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.is_admin() then
    raise exception 'KAFARM_MONITOR_AUTH_REQUIRED';
  end if;

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

    union all

    select
      'care_plan_overdue_mission'::text,
      'high'::text,
      'care_plan'::text,
      'An active Care Plan daily mission is overdue.'::text,
      'rooster_daily_missions'::text,
      mission.id::text
    from public.rooster_daily_missions mission
    where mission.status in ('scheduled', 'active', 'overdue')
      and mission.mission_date < (now() at time zone 'Asia/Manila')::date
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'code', code,
    'severity', severity,
    'workflow', workflow,
    'message', message,
    'source', source,
    'sourceRecordId', source_record_id
  ) order by severity, code), '[]'::jsonb)
  into v_findings
  from findings;

  return jsonb_build_object(
    'generated_at', now(),
    'mode', 'read_only_current_source_monitor',
    'truth_model_version', 'current-deployment-v2',
    'finding_count', jsonb_array_length(v_findings),
    'findings', v_findings
  );
end;
$$;

revoke all on function public.kafarm_guardian_monitor_snapshot() from public, anon, authenticated;
grant execute on function public.kafarm_guardian_monitor_snapshot() to service_role;

commit;

select jsonb_build_object(
  'verification', jsonb_build_object(
    'migration', '080_kafarm_truth_reference_current_evidence',
    'snapshot_rpc', to_regprocedure('public.kafarm_guardian_monitor_snapshot()') is not null,
    'incident_shadow_copy_removed', true,
    'business_mutation', false
  )
) as verification;
