-- Align paid Care Plan proof validation with the exact checklist frozen on the assigned task.
-- Day 1 adds six package-readiness items to task_metadata; validating only the base catalog
-- incorrectly rejects the otherwise complete proof as OPERATIONS_CHECKLIST_INCOMPLETE.

begin;

create or replace function public.caretaker_submit_mission_proof(
  p_task_id uuid,
  p_proof_urls text[],
  p_free_note text,
  p_qr_verified boolean,
  p_serial_exception boolean,
  p_health_status text,
  p_checklist_results jsonb,
  p_inventory_usage jsonb default '[]'::jsonb
) returns uuid language plpgsql security definer set search_path=public as $$
declare
  v_task public.caretaker_tasks%rowtype;
  v_mission public.rooster_daily_missions%rowtype;
  v_template public.care_mission_templates%rowtype;
  v_expected jsonb;
  v_proof_id uuid;
begin
  if p_health_status not in ('pass','watch','isolate_and_escalate') then raise exception 'INVALID_HEALTH_STATUS'; end if;
  if jsonb_typeof(coalesce(p_checklist_results,'{}'::jsonb)) <> 'object' then raise exception 'INVALID_CHECKLIST_RESULTS'; end if;
  if jsonb_typeof(coalesce(p_inventory_usage,'[]'::jsonb)) <> 'array' then raise exception 'INVALID_INVENTORY_USAGE'; end if;

  select * into v_task
  from public.caretaker_tasks
  where id=p_task_id and workflow_type='care_plan_daily_mission';
  if not found or v_task.daily_mission_id is null then raise exception 'MISSION_TASK_REQUIRED'; end if;

  select * into v_mission
  from public.rooster_daily_missions
  where id=v_task.daily_mission_id
  for update;
  if not found then raise exception 'DAILY_MISSION_NOT_FOUND'; end if;

  select * into v_template
  from public.care_mission_templates
  where id=v_mission.mission_template_id;
  if not found then raise exception 'MISSION_TEMPLATE_NOT_FOUND'; end if;

  v_expected:=coalesce(v_task.task_metadata,'{}'::jsonb);

  if p_health_status='pass' and not public.care_mission_checklist_passes(
    case when jsonb_typeof(v_expected->'operations_checklist')='array'
      then v_expected->'operations_checklist' else v_template.operations_checklist end,
    p_checklist_results->'operations'
  ) then raise exception 'OPERATIONS_CHECKLIST_INCOMPLETE'; end if;
  if p_health_status='pass' and not public.care_mission_checklist_passes(
    case when jsonb_typeof(v_expected->'housing_checklist')='array'
      then v_expected->'housing_checklist' else v_template.housing_checklist end,
    p_checklist_results->'housing'
  ) then raise exception 'HOUSING_CHECKLIST_INCOMPLETE'; end if;
  if p_health_status='pass' and not public.care_mission_checklist_passes(
    case when jsonb_typeof(v_expected->'supplement_checklist')='array'
      then v_expected->'supplement_checklist' else v_template.supplement_checklist end,
    p_checklist_results->'supplements'
  ) then raise exception 'SUPPLEMENT_CHECKLIST_INCOMPLETE'; end if;
  if p_health_status='pass' and not public.care_mission_checklist_passes(
    case when jsonb_typeof(v_expected->'vaccine_checklist')='array'
      then v_expected->'vaccine_checklist' else v_template.vaccine_checklist end,
    p_checklist_results->'vaccines'
  ) then raise exception 'VACCINE_AUTHORITY_CHECKLIST_INCOMPLETE'; end if;
  if p_health_status='pass' and not public.care_mission_checklist_passes(
    case when jsonb_typeof(v_expected->'health_checklist')='array'
      then v_expected->'health_checklist' else v_template.health_checklist end,
    p_checklist_results->'health'
  ) then raise exception 'HEALTH_CHECKLIST_INCOMPLETE'; end if;

  if p_health_status='pass' and jsonb_array_length(coalesce(p_inventory_usage,'[]'::jsonb))<>1 then raise exception 'EXACTLY_ONE_FEED_USAGE_REQUIRED'; end if;
  if p_health_status<>'pass' and jsonb_array_length(coalesce(p_inventory_usage,'[]'::jsonb))>1 then raise exception 'TOO_MANY_INVENTORY_USAGE_ITEMS'; end if;
  if exists (
    select 1
    from jsonb_array_elements(coalesce(p_inventory_usage,'[]'::jsonb)) usage
    where coalesce((usage->>'quantity')::numeric,0)<=0
      or usage->>'unit'<>'kg'
      or nullif(usage->>'inventory_item_id','') is null
  ) then raise exception 'INVALID_INVENTORY_USAGE_ITEM'; end if;

  v_proof_id:=public.caretaker_submit_task_proof_v3(
    p_task_id,p_proof_urls,'Day '||v_mission.catalog_day||' mission evidence',p_free_note,
    p_qr_verified,p_serial_exception,null,null
  );
  update public.task_proofs
  set daily_mission_id=v_mission.id,
      health_status=p_health_status,
      checklist_results=p_checklist_results,
      inventory_usage=p_inventory_usage
  where id=v_proof_id;
  update public.rooster_daily_missions
  set status=case p_health_status
        when 'watch' then 'watch'
        when 'isolate_and_escalate' then 'isolate_and_escalate'
        else 'submitted'
      end,
      health_status=p_health_status,
      submitted_at=now(),
      updated_at=now()
  where id=v_mission.id;
  insert into public.care_plan_events(care_plan_id,daily_mission_id,event_type,event_data)
  values(
    v_mission.care_plan_id,
    v_mission.id,
    case when p_health_status='pass' then 'mission_submitted' else 'health_escalation' end,
    jsonb_build_object('proof_id',v_proof_id,'health_status',p_health_status)
  );
  return v_proof_id;
end; $$;

create or replace function public.care_plan_task_checklist_compatibility_version()
returns text language sql immutable set search_path=public as $$
  select '066_care_plan_task_checklist_compatibility_v1'::text;
$$;

revoke all on function public.caretaker_submit_mission_proof(uuid,text[],text,boolean,boolean,text,jsonb,jsonb) from public,anon;
grant execute on function public.caretaker_submit_mission_proof(uuid,text[],text,boolean,boolean,text,jsonb,jsonb) to authenticated;
revoke all on function public.care_plan_task_checklist_compatibility_version() from public,anon,authenticated;

commit;

select jsonb_build_object(
  'migration','066_care_plan_task_checklist_compatibility',
  'submit_rpc',to_regprocedure('public.caretaker_submit_mission_proof(uuid,text[],text,boolean,boolean,text,jsonb,jsonb)') is not null,
  'version_rpc',to_regprocedure('public.care_plan_task_checklist_compatibility_version()') is not null
) verification;
