-- FarmConnect mission proof + exact inventory accounting.
-- Run after 058 and 059. Inventory changes occur only inside admin approval.

begin;

create table if not exists public.care_plan_inventory_usage (
  id uuid primary key default gen_random_uuid(),
  care_plan_id uuid not null references public.rooster_care_plans(id) on delete restrict,
  daily_mission_id uuid not null references public.rooster_daily_missions(id) on delete restrict,
  task_proof_id uuid not null references public.task_proofs(id) on delete restrict,
  inventory_item_id uuid not null references public.customer_inventory_items(id) on delete restrict,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  product_name text not null,
  quantity_used numeric(16,3) not null check (quantity_used > 0),
  unit text not null check (unit in ('kg','g','ml','l','piece')),
  quantity_before numeric(16,3) not null check (quantity_before >= 0),
  quantity_after numeric(16,3) not null check (quantity_after >= 0),
  approved_by_profile_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (task_proof_id, inventory_item_id),
  check (quantity_after = quantity_before - quantity_used)
);

create or replace function public.care_mission_checklist_passes(
  p_expected jsonb,p_actual jsonb
) returns boolean language sql immutable set search_path=public as $$
  select jsonb_typeof(coalesce(p_expected,'[]'::jsonb))='array'
    and jsonb_typeof(coalesce(p_actual,'[]'::jsonb))='array'
    and jsonb_array_length(coalesce(p_expected,'[]'::jsonb))=jsonb_array_length(coalesce(p_actual,'[]'::jsonb))
    and not exists (
      select 1
      from jsonb_array_elements_text(coalesce(p_expected,'[]'::jsonb)) with ordinality expected(label,position)
      full join jsonb_array_elements(coalesce(p_actual,'[]'::jsonb)) with ordinality actual(item,position) using(position)
      where expected.label is null or actual.item is null
        or actual.item->>'label' is distinct from expected.label
        or coalesce((actual.item->>'checked')::boolean,false) is not true
    );
$$;

alter table public.care_plan_inventory_usage enable row level security;
drop policy if exists "care plan inventory usage linked read" on public.care_plan_inventory_usage;
create policy "care plan inventory usage linked read" on public.care_plan_inventory_usage
for select to authenticated using (
  profile_id=public.current_profile_id() or public.is_admin() or exists (
    select 1 from public.rooster_daily_missions mission
    join public.caretakers caretaker on caretaker.id=mission.caretaker_id
    where mission.id=daily_mission_id
      and (caretaker.profile_id=public.current_profile_id() or caretaker.caretaker_profile_id=public.current_profile_id())
  )
);

create or replace function public.caretaker_get_task_inventory(p_task_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_profile_id uuid; v_customer_profile_id uuid; v_result jsonb;
begin
  select id into v_profile_id from public.profiles where auth_user_id=auth.uid() limit 1;
  if v_profile_id is null then raise exception 'LOGIN_REQUIRED'; end if;
  select task.profile_id into v_customer_profile_id
  from public.caretaker_tasks task join public.caretakers caretaker on caretaker.id=task.caretaker_id
  where task.id=p_task_id and task.status in ('active','in_progress','backjob')
    and (caretaker.profile_id=v_profile_id or caretaker.caretaker_profile_id=v_profile_id);
  if v_customer_profile_id is null then raise exception 'TASK_NOT_ASSIGNED_TO_CURRENT_CARETAKER'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',item.id,'product_name',item.product_name,'category',item.category,'unit_label',item.unit_label,
    'quantity',item.quantity,'product_type',item.product_type
  ) order by item.product_name),'[]'::jsonb) into v_result
  from public.customer_inventory_items item where item.profile_id=v_customer_profile_id and item.quantity>0;
  return v_result;
end; $$;

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
declare v_task public.caretaker_tasks%rowtype; v_mission public.rooster_daily_missions%rowtype;
  v_template public.care_mission_templates%rowtype; v_proof_id uuid;
begin
  if p_health_status not in ('pass','watch','isolate_and_escalate') then raise exception 'INVALID_HEALTH_STATUS'; end if;
  if jsonb_typeof(coalesce(p_checklist_results,'{}'::jsonb)) <> 'object' then raise exception 'INVALID_CHECKLIST_RESULTS'; end if;
  if jsonb_typeof(coalesce(p_inventory_usage,'[]'::jsonb)) <> 'array' then raise exception 'INVALID_INVENTORY_USAGE'; end if;

  select * into v_task from public.caretaker_tasks where id=p_task_id and workflow_type='care_plan_daily_mission';
  if not found or v_task.daily_mission_id is null then raise exception 'MISSION_TASK_REQUIRED'; end if;
  select * into v_mission from public.rooster_daily_missions where id=v_task.daily_mission_id for update;
  select * into v_template from public.care_mission_templates where id=v_mission.mission_template_id;

  if p_health_status='pass' and not public.care_mission_checklist_passes(v_template.operations_checklist,p_checklist_results->'operations') then raise exception 'OPERATIONS_CHECKLIST_INCOMPLETE'; end if;
  if p_health_status='pass' and not public.care_mission_checklist_passes(v_template.housing_checklist,p_checklist_results->'housing') then raise exception 'HOUSING_CHECKLIST_INCOMPLETE'; end if;
  if p_health_status='pass' and not public.care_mission_checklist_passes(v_template.supplement_checklist,p_checklist_results->'supplements') then raise exception 'SUPPLEMENT_CHECKLIST_INCOMPLETE'; end if;
  if p_health_status='pass' and not public.care_mission_checklist_passes(v_template.vaccine_checklist,p_checklist_results->'vaccines') then raise exception 'VACCINE_AUTHORITY_CHECKLIST_INCOMPLETE'; end if;
  if p_health_status='pass' and not public.care_mission_checklist_passes(v_template.health_checklist,p_checklist_results->'health') then raise exception 'HEALTH_CHECKLIST_INCOMPLETE'; end if;

  if p_health_status='pass' and jsonb_array_length(coalesce(p_inventory_usage,'[]'::jsonb))<>1 then raise exception 'EXACTLY_ONE_FEED_USAGE_REQUIRED'; end if;
  if p_health_status<>'pass' and jsonb_array_length(coalesce(p_inventory_usage,'[]'::jsonb))>1 then raise exception 'TOO_MANY_INVENTORY_USAGE_ITEMS'; end if;
  if exists (select 1 from jsonb_array_elements(coalesce(p_inventory_usage,'[]'::jsonb)) usage
    where coalesce((usage->>'quantity')::numeric,0)<=0 or usage->>'unit'<>'kg'
      or nullif(usage->>'inventory_item_id','') is null) then raise exception 'INVALID_INVENTORY_USAGE_ITEM'; end if;

  v_proof_id:=public.caretaker_submit_task_proof_v3(
    p_task_id,p_proof_urls,'Day '||v_mission.catalog_day||' mission evidence',p_free_note,
    p_qr_verified,p_serial_exception,null,null
  );
  update public.task_proofs set daily_mission_id=v_mission.id,health_status=p_health_status,
    checklist_results=p_checklist_results,inventory_usage=p_inventory_usage where id=v_proof_id;
  update public.rooster_daily_missions set status=case p_health_status when 'watch' then 'watch'
      when 'isolate_and_escalate' then 'isolate_and_escalate' else 'submitted' end,
    health_status=p_health_status,submitted_at=now(),updated_at=now() where id=v_mission.id;
  insert into public.care_plan_events(care_plan_id,daily_mission_id,event_type,event_data)
    values(v_mission.care_plan_id,v_mission.id,
      case when p_health_status='pass' then 'mission_submitted' else 'health_escalation' end,
      jsonb_build_object('proof_id',v_proof_id,'health_status',p_health_status));
  return v_proof_id;
end; $$;

create or replace function public.admin_review_mission_proof_guarded(
  p_proof_id uuid,p_decision text,p_admin_note text default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_admin_id uuid; v_proof public.task_proofs%rowtype; v_mission public.rooster_daily_missions%rowtype;
  v_usage jsonb; v_item public.customer_inventory_items%rowtype; v_quantity numeric(16,3); v_unit text; v_result jsonb;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if p_decision not in ('approved','backjob','rejected') then raise exception 'INVALID_DECISION'; end if;
  if p_decision<>'approved' and nullif(trim(coalesce(p_admin_note,'')),'') is null then raise exception 'ADMIN_NOTE_REQUIRED'; end if;
  select id into v_admin_id from public.profiles where auth_user_id=auth.uid() limit 1;
  select * into v_proof from public.task_proofs where id=p_proof_id for update;
  if not found then raise exception 'PROOF_NOT_FOUND'; end if;
  if v_proof.admin_review_status=p_decision then
    return jsonb_build_object('id',p_proof_id,'duplicate',true,'status',p_decision);
  end if;
  if v_proof.admin_review_status<>'pending' then raise exception 'PROOF_ALREADY_REVIEWED'; end if;
  if v_proof.daily_mission_id is null then raise exception 'MISSION_PROOF_REQUIRED'; end if;
  select * into v_mission from public.rooster_daily_missions where id=v_proof.daily_mission_id for update;
  if not found then raise exception 'MISSION_NOT_FOUND'; end if;
  if p_decision='approved' and coalesce(v_proof.health_status,'')<>'pass' then raise exception 'HEALTH_ESCALATION_CANNOT_BE_APPROVED'; end if;

  -- Base review updates proof/task/care request/customer inbox. Any later failure rolls the transaction back.
  perform public.admin_review_task_proof(p_proof_id,p_decision,p_admin_note);

  if p_decision='approved' then
    for v_usage in select value from jsonb_array_elements(coalesce(v_proof.inventory_usage,'[]'::jsonb)) loop
      v_quantity:=round((v_usage->>'quantity')::numeric,3); v_unit:=v_usage->>'unit';
      select * into v_item from public.customer_inventory_items
        where id=(v_usage->>'inventory_item_id')::uuid and profile_id=v_mission.profile_id for update;
      if not found then raise exception 'INVENTORY_ITEM_NOT_OWNED'; end if;
      if coalesce(v_item.quantity,0)<v_quantity then raise exception 'INSUFFICIENT_INVENTORY: %',v_item.product_name; end if;
      insert into public.care_plan_inventory_usage(
        care_plan_id,daily_mission_id,task_proof_id,inventory_item_id,profile_id,product_name,
        quantity_used,unit,quantity_before,quantity_after,approved_by_profile_id
      ) values (
        v_mission.care_plan_id,v_mission.id,p_proof_id,v_item.id,v_mission.profile_id,v_item.product_name,
        v_quantity,v_unit,v_item.quantity,v_item.quantity-v_quantity,v_admin_id
      ) on conflict (task_proof_id,inventory_item_id) do nothing;
      if found then update public.customer_inventory_items set quantity=quantity-v_quantity,updated_at=now() where id=v_item.id; end if;
    end loop;
  end if;

  update public.rooster_daily_missions set status=case when p_decision='approved' then 'approved'
      when p_decision='backjob' then 'backjob' else 'cancelled' end,
    reviewed_at=now(),approved_at=case when p_decision='approved' then now() else null end,updated_at=now()
    where id=v_mission.id;
  insert into public.care_plan_events(care_plan_id,daily_mission_id,actor_profile_id,event_type,event_data)
    values(v_mission.care_plan_id,v_mission.id,v_admin_id,'mission_'||p_decision,
      jsonb_build_object('proof_id',p_proof_id,'admin_note',p_admin_note));
  v_result:=jsonb_build_object('id',p_proof_id,'duplicate',false,'status',p_decision,'mission_id',v_mission.id);
  return v_result;
end; $$;

revoke all on function public.caretaker_get_task_inventory(uuid) from public,anon;
revoke all on function public.care_mission_checklist_passes(jsonb,jsonb) from public,anon,authenticated;
revoke all on function public.caretaker_submit_mission_proof(uuid,text[],text,boolean,boolean,text,jsonb,jsonb) from public,anon;
revoke all on function public.admin_review_mission_proof_guarded(uuid,text,text) from public,anon;
grant execute on function public.caretaker_get_task_inventory(uuid) to authenticated;
grant execute on function public.caretaker_submit_mission_proof(uuid,text[],text,boolean,boolean,text,jsonb,jsonb) to authenticated;
grant execute on function public.admin_review_mission_proof_guarded(uuid,text,text) to authenticated;

commit;

select jsonb_build_object(
  'migration','060_care_plan_mission_proof_inventory_guard',
  'usage_table',to_regclass('public.care_plan_inventory_usage') is not null,
  'checklist_guard',to_regprocedure('public.care_mission_checklist_passes(jsonb,jsonb)') is not null,
  'submit_rpc',to_regprocedure('public.caretaker_submit_mission_proof(uuid,text[],text,boolean,boolean,text,jsonb,jsonb)') is not null,
  'review_rpc',to_regprocedure('public.admin_review_mission_proof_guarded(uuid,text,text)') is not null
) verification;
