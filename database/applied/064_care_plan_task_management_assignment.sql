-- Care Plan approval-to-assignment workflow correction.
-- A paid plan enters Task Management, receives one caretaker assignment, and
-- becomes eligible for idempotent daily mission generation immediately.

begin;

create or replace function public.admin_assign_care_plan(
  p_care_plan_id uuid,
  p_caretaker_id uuid,
  p_admin_note text default null
) returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_admin_id uuid;
  v_plan public.rooster_care_plans%rowtype;
  v_requirement public.care_plan_supply_requirements%rowtype;
  v_today date := (now() at time zone 'Asia/Manila')::date;
  v_catalog_count integer;
  v_generation jsonb;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if p_caretaker_id is null then raise exception 'ACTIVE_CARETAKER_REQUIRED'; end if;

  select id into v_admin_id from public.profiles where auth_user_id=auth.uid() limit 1;
  select * into v_plan from public.rooster_care_plans where id=p_care_plan_id for update;
  if not found then raise exception 'CARE_PLAN_NOT_FOUND'; end if;

  if v_plan.status='active' then
    if v_plan.assigned_caretaker_id<>p_caretaker_id then raise exception 'CARE_PLAN_ALREADY_ASSIGNED'; end if;
    return jsonb_build_object('id',v_plan.id,'duplicate',true,'status','active',
      'start_date',v_plan.start_date,'end_date',v_plan.end_date);
  end if;
  if v_plan.status not in ('paid_pending_setup','ready') then
    raise exception 'CARE_PLAN_NOT_READY_FOR_TASK_ASSIGNMENT';
  end if;
  if not exists(
    select 1 from public.manual_payment_requests payment
    where payment.id=v_plan.payment_request_id
      and payment.source_type='care_plan'
      and payment.source_ref=v_plan.id::text
      and payment.profile_id=v_plan.profile_id
      and payment.status='approved'
      and round(payment.amount_expected,2)=round(v_plan.package_total,2)
  ) then raise exception 'APPROVED_EXACT_PAYMENT_REQUIRED'; end if;
  if not exists(
    select 1 from public.caretakers
    where id=p_caretaker_id and coalesce(status,'active') in ('active','approved','on_duty')
  ) then raise exception 'ACTIVE_CARETAKER_REQUIRED'; end if;

  select count(*) into v_catalog_count
  from public.care_mission_templates
  where catalog_version=v_plan.catalog_version
    and day_number between v_plan.start_day_number and v_plan.start_day_number+v_plan.duration_days-1;
  if v_catalog_count<>v_plan.duration_days then raise exception 'MISSION_CATALOG_RANGE_INCOMPLETE'; end if;

  perform public.fulfill_care_plan_feed(v_plan.id);
  select * into v_requirement
  from public.care_plan_supply_requirements
  where care_plan_id=v_plan.id and unit='kg'
  for update;
  if not found or coalesce(v_requirement.kg_per_inventory_unit,0)<=0 then
    raise exception 'CARE_PLAN_SUPPLY_CONVERSION_MISSING';
  end if;
  if v_requirement.reservation_status<>'active'
     or v_requirement.reserved_inventory_units<v_requirement.required_inventory_units then
    raise exception 'CARE_PLAN_SUPPLIES_INCOMPLETE';
  end if;

  update public.rooster_care_plans set
    assigned_caretaker_id=p_caretaker_id,
    start_date=v_today,
    end_date=v_today+(duration_days-1),
    status='active',
    schedule_shift_days=0,
    activated_at=coalesce(activated_at,now()),
    paused_at=null,
    pause_note=null,
    updated_at=now()
  where id=v_plan.id;

  insert into public.care_plan_events(care_plan_id,actor_profile_id,event_type,event_data)
  values(v_plan.id,v_admin_id,'plan_assigned_and_activated',jsonb_build_object(
    'caretaker_id',p_caretaker_id,'start_date',v_today,
    'end_date',v_today+(v_plan.duration_days-1),'admin_note',p_admin_note));
  insert into public.inbox_items(profile_id,category,title,body,created_at)
  values(v_plan.profile_id,'care','Care Plan Assigned',
    'Admin assigned your paid Care Plan. Daily caretaker tasks now continue automatically.',now());

  v_generation:=public.generate_due_care_plan_missions(v_today);
  return jsonb_build_object('id',v_plan.id,'duplicate',false,'status','active',
    'start_date',v_today,'end_date',v_today+(v_plan.duration_days-1),
    'created_missions',coalesce((v_generation->>'created')::integer,0));
end;
$$;

revoke all on function public.admin_assign_care_plan(uuid,uuid,text) from public,anon;
grant execute on function public.admin_assign_care_plan(uuid,uuid,text) to authenticated;

commit;

select jsonb_build_object(
  'migration','064_care_plan_task_management_assignment',
  'assignment_rpc',to_regprocedure('public.admin_assign_care_plan(uuid,uuid,text)') is not null,
  'daily_generator',to_regprocedure('public.generate_due_care_plan_missions(date)') is not null
) verification;
