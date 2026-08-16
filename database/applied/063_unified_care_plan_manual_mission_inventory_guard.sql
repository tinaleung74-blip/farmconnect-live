-- FarmConnect unified premium care contract.
-- Paid Care Plan: automatic daily missions with plan-reserved supplies.
-- No paid plan: the same mission catalog is available through a manual Care Request,
-- with an atomic inventory preflight/reservation before the request is accepted.

begin;

alter table public.farm_care_requests
  add column if not exists mission_template_id uuid references public.care_mission_templates(id) on delete set null,
  add column if not exists mission_day_number integer,
  add column if not exists workflow_type text not null default 'standard_care',
  add column if not exists task_metadata jsonb not null default '{}'::jsonb;

create table if not exists public.manual_care_inventory_reservations (
  id uuid primary key default gen_random_uuid(),
  care_request_id uuid not null references public.farm_care_requests(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  inventory_item_id uuid not null references public.customer_inventory_items(id) on delete restrict,
  product_name text not null,
  required_quantity numeric(16,3) not null check (required_quantity > 0),
  reserved_quantity numeric(16,3) not null check (reserved_quantity > 0),
  actual_used_quantity numeric(16,3) check (actual_used_quantity is null or actual_used_quantity > 0),
  reserved_base_quantity numeric(16,3),
  actual_used_base_quantity numeric(16,3),
  usage_unit text not null default 'inventory_unit' check (usage_unit in ('kg','inventory_unit')),
  kg_per_inventory_unit numeric(16,3),
  inventory_unit_label text not null,
  status text not null default 'active' check (status in ('active','consumed','released')),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (care_request_id, inventory_item_id)
);
alter table public.manual_care_inventory_reservations
  add column if not exists expires_at timestamptz,
  add column if not exists reserved_base_quantity numeric(16,3),
  add column if not exists actual_used_base_quantity numeric(16,3),
  add column if not exists usage_unit text not null default 'inventory_unit',
  add column if not exists kg_per_inventory_unit numeric(16,3);

create table if not exists public.manual_care_inventory_usage (
  id uuid primary key default gen_random_uuid(),
  care_request_id uuid not null references public.farm_care_requests(id) on delete restrict,
  caretaker_task_id uuid not null references public.caretaker_tasks(id) on delete restrict,
  task_proof_id uuid not null references public.task_proofs(id) on delete restrict,
  inventory_item_id uuid not null references public.customer_inventory_items(id) on delete restrict,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  product_name text not null,
  quantity_used numeric(16,3) not null check (quantity_used > 0),
  unit text not null default 'inventory_unit' check (unit='inventory_unit'),
  quantity_before numeric(16,3) not null,
  quantity_after numeric(16,3) not null check (quantity_after >= 0),
  used_base_quantity numeric(16,3),
  base_unit text,
  approved_by_profile_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (task_proof_id, inventory_item_id)
);

create index if not exists idx_manual_care_reservation_item
  on public.manual_care_inventory_reservations(inventory_item_id,status);
create index if not exists idx_manual_care_usage_request
  on public.manual_care_inventory_usage(care_request_id,created_at desc);

alter table public.manual_care_inventory_reservations enable row level security;
alter table public.manual_care_inventory_usage enable row level security;
drop policy if exists "manual care reservation linked read" on public.manual_care_inventory_reservations;
create policy "manual care reservation linked read" on public.manual_care_inventory_reservations
  for select to authenticated using (
    profile_id=public.current_profile_id() or public.is_admin() or exists (
      select 1 from public.farm_care_requests request
      join public.caretakers caretaker on caretaker.id=request.assigned_caretaker_id
      where request.id=care_request_id
        and (caretaker.profile_id=public.current_profile_id() or caretaker.caretaker_profile_id=public.current_profile_id())
    )
  );
drop policy if exists "manual care usage linked read" on public.manual_care_inventory_usage;
create policy "manual care usage linked read" on public.manual_care_inventory_usage
  for select to authenticated using (
    profile_id=public.current_profile_id() or public.is_admin() or exists (
      select 1 from public.caretaker_tasks task
      join public.caretakers caretaker on caretaker.id=task.caretaker_id
      where task.id=caretaker_task_id
        and (caretaker.profile_id=public.current_profile_id() or caretaker.caretaker_profile_id=public.current_profile_id())
    )
  );

create or replace function public.customer_create_care_request(
  p_customer_animal_id uuid,
  p_rooster_name text,
  p_rooster_tag text,
  p_service_name text,
  p_service_category text,
  p_service_price numeric,
  p_required_proof text,
  p_customer_note text
) returns uuid language plpgsql security definer set search_path=public as $$
declare
  v_profile_id uuid;
  v_animal public.customer_animals%rowtype;
  v_template public.care_mission_templates%rowtype;
  v_item public.customer_inventory_items%rowtype;
  v_request_id uuid;
  v_catalog_day integer;
  v_supply_kind text;
  v_required_units numeric(16,3);
  v_required_base numeric(16,3);
  v_kg_per_unit numeric(16,3);
  v_other_manual numeric(16,3);
  v_other_plan numeric(16,3);
  v_available numeric(16,3);
  v_metadata jsonb;
begin
  select id into v_profile_id from public.profiles where auth_user_id=auth.uid() limit 1;
  if v_profile_id is null then raise exception 'LOGIN_REQUIRED'; end if;
  if p_customer_animal_id is null then raise exception 'OWNED_ROOSTER_REQUIRED'; end if;
  select * into v_animal from public.customer_animals
    where id=p_customer_animal_id and profile_id=v_profile_id and coalesce(status,'')<>'sold' for update;
  if not found then raise exception 'ANIMAL_NOT_OWNED'; end if;
  if exists(select 1 from public.rooster_care_plans
    where customer_animal_id=v_animal.id and status in ('paid_pending_setup','ready','active','paused')) then
    raise exception 'PAID_CARE_PLAN_ALREADY_AUTOMATES_ROOSTER';
  end if;

  v_catalog_day:=least(180,greatest(1,
    ((now() at time zone 'Asia/Manila')::date-coalesce(v_animal.acquired_at::date,(now() at time zone 'Asia/Manila')::date))+1));
  select * into v_template from public.care_mission_templates
    where catalog_version='farmconnect-premium-rooster-180-v1' and day_number=v_catalog_day;
  if not found then raise exception 'MISSION_TEMPLATE_NOT_FOUND'; end if;

  v_metadata:=jsonb_build_object(
    'catalog_day',v_template.day_number,'life_stage',v_template.life_stage,
    'primary_mission',v_template.primary_mission,'time_schedule',v_template.time_schedule,
    'needed_today',v_template.needed_today,'feeding_standard',v_template.feeding_standard,
    'supplement_checklist',v_template.supplement_checklist,'vaccine_checklist',v_template.vaccine_checklist,
    'operations_checklist',v_template.operations_checklist,'housing_checklist',v_template.housing_checklist,
    'health_checklist',v_template.health_checklist,'evidence_requirements',v_template.evidence_requirements,
    'emergency_stop_rule',v_template.emergency_stop_rule,'completion_gate',v_template.completion_gate,
    'feed_grams_min',v_template.feed_grams_min,'feed_grams_max',v_template.feed_grams_max,
    'care_mode','manual_premium','procedure_is_guidance',true,
    'caretaker_stop_and_report_required',true
  );

  v_supply_kind:=case
    when lower(coalesce(p_service_name,'')) in ('today''s standard care','premium feed') then 'feed'
    when lower(coalesce(p_service_name,'')) like '%vitamin%' then 'vitamin'
    when lower(coalesce(p_service_name,'')) like '%vaccine%' then 'vaccine'
    else null end;
  if v_supply_kind is not null then
    select * into v_item from public.customer_inventory_items item
      where item.profile_id=v_profile_id and coalesce(item.quantity,0)>0 and (
        (v_supply_kind='feed' and (lower(coalesce(item.product_type,''))='feed' or item.category ilike '%feed%')) or
        (v_supply_kind='vitamin' and (item.category ilike '%vitamin%' or item.product_name ilike '%vitamin%')) or
        (v_supply_kind='vaccine' and (item.category ilike '%vaccine%' or item.product_name ilike '%vaccine%'))
      ) order by item.quantity desc,item.updated_at desc limit 1 for update;
    if not found then raise exception 'CARE_INVENTORY_ITEM_REQUIRED|category=%',v_supply_kind; end if;
    if v_supply_kind='feed' then
      v_kg_per_unit:=case
        when coalesce(v_item.inventory_metadata->>'kg_per_inventory_unit','') ~ '^[0-9]+([.][0-9]+)?$'
          then (v_item.inventory_metadata->>'kg_per_inventory_unit')::numeric
        when lower(coalesce(v_item.unit_label,'')) like '%kg%' or lower(coalesce(v_item.unit_label,'')) like '%kilo%' then 1
        else null end;
      if coalesce(v_kg_per_unit,0)<=0 then raise exception 'CARE_INVENTORY_UNIT_CONVERSION_REQUIRED|item=%',v_item.product_name; end if;
      v_required_base:=round(coalesce(v_template.feed_grams_max,50)/1000,3);
      v_required_units:=ceil((v_required_base/v_kg_per_unit)*1000)/1000;
    elsif v_supply_kind='vaccine' then v_required_units:=1;
    else v_required_units:=0.001;
    end if;
    select coalesce(sum(reserved_quantity),0) into v_other_manual
      from public.manual_care_inventory_reservations
      where inventory_item_id=v_item.id and status='active' and (expires_at is null or expires_at>=now());
    select coalesce(sum(reserved_inventory_units),0) into v_other_plan
      from public.care_plan_supply_requirements requirement
      join public.rooster_care_plans plan on plan.id=requirement.care_plan_id
      where requirement.inventory_item_id=v_item.id and requirement.reservation_status in ('quoted','active')
        and (
          plan.status in ('payment_submitted','paid_pending_setup','ready','active','paused')
          or (plan.status='payment_for_review' and plan.quote_expires_at>=now())
        );
    v_available:=greatest(coalesce(v_item.quantity,0)-v_other_manual-v_other_plan,0);
    if v_available<v_required_units then
      raise exception 'CARE_INVENTORY_INSUFFICIENT|required=%|available=%|unit=%|item=%',
        v_required_units,v_available,coalesce(v_item.unit_label,'inventory unit'),v_item.product_name;
    end if;
  end if;

  insert into public.farm_care_requests(
    profile_id,customer_animal_id,rooster_name,rooster_tag,service_name,service_category,
    service_price,required_proof,customer_note,status,mission_template_id,mission_day_number,workflow_type,task_metadata
  ) values(
    v_profile_id,v_animal.id,coalesce(nullif(trim(p_rooster_name),''),v_animal.animal_name),p_rooster_tag,
    coalesce(nullif(trim(p_service_name),''),'Today''s Standard Care'),p_service_category,
    coalesce(p_service_price,0),p_required_proof,p_customer_note,
    case when coalesce(p_service_price,0)>0 then 'payment_for_review' else 'paid_pending_assignment' end,
    v_template.id,v_template.day_number,'manual_standard_mission',v_metadata
  ) returning id into v_request_id;

  if v_supply_kind is not null then
    insert into public.manual_care_inventory_reservations(
      care_request_id,profile_id,inventory_item_id,product_name,required_quantity,reserved_quantity,
      reserved_base_quantity,usage_unit,kg_per_inventory_unit,inventory_unit_label,status,expires_at
    ) values(v_request_id,v_profile_id,v_item.id,v_item.product_name,v_required_units,v_required_units,
      case when v_supply_kind='feed' then v_required_base else null end,
      case when v_supply_kind='feed' then 'kg' else 'inventory_unit' end,
      case when v_supply_kind='feed' then v_kg_per_unit else null end,
      coalesce(nullif(v_item.unit_label,''),'inventory unit'),'active',now()+interval '24 hours');
  end if;
  insert into public.inbox_items(profile_id,category,title,body,created_at) values(
    v_profile_id,'care','Premium Care Request Submitted',
    'Day '||v_template.day_number||' standard care was requested for '||v_animal.animal_name||
      '. Required customer inventory was checked and reserved before submission.',now());
  return v_request_id;
end; $$;

create or replace function public.admin_assign_care_request(
  p_care_request_id uuid,p_caretaker_id uuid default null,p_admin_note text default null
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_admin_id uuid; v_request public.farm_care_requests%rowtype; v_caretaker_id uuid; v_task_id uuid;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  select id into v_admin_id from public.profiles where auth_user_id=auth.uid() limit 1;
  select * into v_request from public.farm_care_requests where id=p_care_request_id for update;
  if not found then raise exception 'CARE_REQUEST_NOT_FOUND'; end if;
  if v_request.assigned_task_id is not null then
    select id into v_task_id from public.caretaker_tasks where id=v_request.assigned_task_id and status not in ('cancelled','rejected');
    if v_task_id is not null then return v_task_id; end if;
  end if;
  if v_request.status<>'paid_pending_assignment' then raise exception 'CARE_REQUEST_NOT_READY_FOR_ASSIGNMENT'; end if;
  if exists(select 1 from public.manual_care_inventory_reservations
    where care_request_id=v_request.id and (status<>'active' or (expires_at is not null and expires_at<now()))) then
    raise exception 'CARE_REQUEST_INVENTORY_RESERVATION_NOT_ACTIVE';
  end if;
  select id into v_caretaker_id from public.caretakers
    where (p_caretaker_id is null or id=p_caretaker_id) and coalesce(status,'active') in ('active','approved','on_duty')
    order by created_at asc limit 1;
  if v_caretaker_id is null then raise exception 'NO_ACTIVE_CARETAKER'; end if;
  insert into public.caretaker_tasks(
    care_request_id,profile_id,caretaker_id,assigned_by_profile_id,animal_id,rooster_name,rooster_tag,
    task_type,customer_note,admin_note,required_proof,status,priority,due_at,workflow_type,qr_scan_required,task_metadata
  ) values(
    v_request.id,v_request.profile_id,v_caretaker_id,v_admin_id,null,v_request.rooster_name,v_request.rooster_tag,
    case when v_request.mission_day_number is null then v_request.service_name else
      'Day '||v_request.mission_day_number||': '||coalesce(v_request.task_metadata->>'primary_mission',v_request.service_name) end,
    v_request.customer_note,p_admin_note,v_request.required_proof,'active',
    case when v_request.service_name ilike '%vet%' or v_request.service_name ilike '%health%' then 'urgent' else 'normal' end,
    now()+interval '1 day',coalesce(nullif(v_request.workflow_type,''),'standard_care'),true,
    coalesce(v_request.task_metadata,'{}'::jsonb)||jsonb_build_object('source','care_request','assignment_version',63)
  ) returning id into v_task_id;
  update public.farm_care_requests set assigned_caretaker_id=v_caretaker_id,assigned_task_id=v_task_id,
    admin_note=p_admin_note,status='assigned',updated_at=now() where id=v_request.id;
  update public.manual_care_inventory_reservations set expires_at=null,updated_at=now()
    where care_request_id=v_request.id and status='active';
  insert into public.inbox_items(profile_id,category,title,body,created_at) values(
    v_request.profile_id,'care','Care Request Assigned','Admin assigned your premium-standard manual care request. The caretaker received the complete procedure and safety guide.',now());
  return v_task_id;
end; $$;

create or replace function public.caretaker_get_task_inventory(p_task_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_profile_id uuid; v_task public.caretaker_tasks%rowtype; v_result jsonb;
begin
  select id into v_profile_id from public.profiles where auth_user_id=auth.uid() limit 1;
  if v_profile_id is null then raise exception 'LOGIN_REQUIRED'; end if;
  select task.* into v_task from public.caretaker_tasks task
    join public.caretakers caretaker on caretaker.id=task.caretaker_id
    where task.id=p_task_id and task.workflow_type in ('care_plan_daily_mission','manual_standard_mission')
      and task.status in ('active','in_progress','backjob')
      and (caretaker.profile_id=v_profile_id or caretaker.caretaker_profile_id=v_profile_id);
  if not found then raise exception 'TASK_NOT_ASSIGNED_TO_CURRENT_CARETAKER'; end if;
  if v_task.workflow_type='care_plan_daily_mission' then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id',item.id,'product_name',item.product_name,'category',item.category,
      'unit_label',requirement.inventory_unit_label,'quantity',item.quantity,'product_type',item.product_type,
      'kg_per_inventory_unit',requirement.kg_per_inventory_unit,'reserved_inventory_units',requirement.reserved_inventory_units,
      'reserved_kg',round(requirement.reserved_inventory_units*requirement.kg_per_inventory_unit,3),'usage_unit','kg'
    )),'[]'::jsonb) into v_result
    from public.care_plan_supply_requirements requirement
    join public.customer_inventory_items item on item.id=requirement.inventory_item_id
    where requirement.care_plan_id=v_task.care_plan_id and requirement.reservation_status='active'
      and requirement.reserved_inventory_units>0;
  else
    select coalesce(jsonb_agg(jsonb_build_object(
      'id',item.id,'product_name',item.product_name,'category',item.category,
      'unit_label',reservation.inventory_unit_label,'quantity',item.quantity,'product_type',item.product_type,
      'reserved_inventory_units',reservation.reserved_quantity,'reserved_kg',reservation.reserved_base_quantity,
      'kg_per_inventory_unit',reservation.kg_per_inventory_unit,'usage_unit',reservation.usage_unit
    )),'[]'::jsonb) into v_result
    from public.manual_care_inventory_reservations reservation
    join public.customer_inventory_items item on item.id=reservation.inventory_item_id
    where reservation.care_request_id=v_task.care_request_id and reservation.status='active';
  end if;
  return v_result;
end; $$;

create or replace function public.caretaker_submit_manual_mission_proof(
  p_task_id uuid,p_proof_urls text[],p_free_note text,p_qr_verified boolean,p_serial_exception boolean,
  p_health_status text,p_checklist_results jsonb,p_inventory_usage jsonb default '[]'::jsonb
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_task public.caretaker_tasks%rowtype; v_request public.farm_care_requests%rowtype;
  v_template public.care_mission_templates%rowtype; v_proof_id uuid; v_reservation_count integer;
begin
  if p_health_status not in ('pass','watch','isolate_and_escalate') then raise exception 'INVALID_HEALTH_STATUS'; end if;
  select * into v_task from public.caretaker_tasks where id=p_task_id and workflow_type='manual_standard_mission';
  if not found then raise exception 'MANUAL_MISSION_TASK_REQUIRED'; end if;
  select * into v_request from public.farm_care_requests where id=v_task.care_request_id;
  select * into v_template from public.care_mission_templates where id=v_request.mission_template_id;
  if not found then raise exception 'MISSION_TEMPLATE_NOT_FOUND'; end if;
  if p_health_status='pass' and not public.care_mission_checklist_passes(v_template.operations_checklist,p_checklist_results->'operations') then raise exception 'OPERATIONS_CHECKLIST_INCOMPLETE'; end if;
  if p_health_status='pass' and not public.care_mission_checklist_passes(v_template.housing_checklist,p_checklist_results->'housing') then raise exception 'HOUSING_CHECKLIST_INCOMPLETE'; end if;
  if p_health_status='pass' and not public.care_mission_checklist_passes(v_template.supplement_checklist,p_checklist_results->'supplements') then raise exception 'SUPPLEMENT_CHECKLIST_INCOMPLETE'; end if;
  if p_health_status='pass' and not public.care_mission_checklist_passes(v_template.vaccine_checklist,p_checklist_results->'vaccines') then raise exception 'VACCINE_AUTHORITY_CHECKLIST_INCOMPLETE'; end if;
  if p_health_status='pass' and not public.care_mission_checklist_passes(v_template.health_checklist,p_checklist_results->'health') then raise exception 'HEALTH_CHECKLIST_INCOMPLETE'; end if;
  select count(*) into v_reservation_count from public.manual_care_inventory_reservations where care_request_id=v_request.id and status='active';
  if p_health_status='pass' and jsonb_array_length(coalesce(p_inventory_usage,'[]'::jsonb))<>v_reservation_count then raise exception 'RESERVED_INVENTORY_USAGE_REQUIRED'; end if;
  if exists(select 1 from jsonb_array_elements(coalesce(p_inventory_usage,'[]'::jsonb)) usage
    left join public.manual_care_inventory_reservations reservation
      on reservation.care_request_id=v_request.id and reservation.inventory_item_id=(usage->>'inventory_item_id')::uuid and reservation.status='active'
    where reservation.id is null or usage->>'unit'<>reservation.usage_unit or coalesce((usage->>'quantity')::numeric,0)<=0
      or (reservation.usage_unit='kg' and (usage->>'quantity')::numeric>reservation.reserved_base_quantity)
      or (reservation.usage_unit='inventory_unit' and (usage->>'quantity')::numeric>reservation.reserved_quantity)
  ) then raise exception 'INVALID_OR_UNRESERVED_INVENTORY_USAGE'; end if;
  v_proof_id:=public.caretaker_submit_task_proof_v3(
    p_task_id,p_proof_urls,'Day '||v_request.mission_day_number||' manual premium mission evidence',p_free_note,
    p_qr_verified,p_serial_exception,null,null
  );
  update public.task_proofs set health_status=p_health_status,checklist_results=p_checklist_results,inventory_usage=p_inventory_usage
    where id=v_proof_id;
  return v_proof_id;
end; $$;

create or replace function public.admin_review_manual_mission_proof_guarded(
  p_proof_id uuid,p_decision text,p_admin_note text default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_admin_id uuid; v_proof public.task_proofs%rowtype; v_task public.caretaker_tasks%rowtype;
  v_request public.farm_care_requests%rowtype; v_usage jsonb; v_item public.customer_inventory_items%rowtype;
  v_reservation public.manual_care_inventory_reservations%rowtype; v_quantity numeric(16,3);
  v_deduct_units numeric(16,3); v_inserted integer;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if p_decision not in ('approved','backjob','rejected') then raise exception 'INVALID_DECISION'; end if;
  if p_decision<>'approved' and nullif(trim(coalesce(p_admin_note,'')),'') is null then raise exception 'ADMIN_NOTE_REQUIRED'; end if;
  select id into v_admin_id from public.profiles where auth_user_id=auth.uid() limit 1;
  select * into v_proof from public.task_proofs where id=p_proof_id for update;
  if not found then raise exception 'PROOF_NOT_FOUND'; end if;
  if v_proof.admin_review_status=p_decision then return jsonb_build_object('id',p_proof_id,'duplicate',true,'status',p_decision); end if;
  if v_proof.admin_review_status<>'pending' then raise exception 'PROOF_ALREADY_REVIEWED'; end if;
  select * into v_task from public.caretaker_tasks where id=coalesce(v_proof.caretaker_task_id,v_proof.task_id) for update;
  if not found or v_task.workflow_type<>'manual_standard_mission' then raise exception 'MANUAL_MISSION_PROOF_REQUIRED'; end if;
  select * into v_request from public.farm_care_requests where id=v_task.care_request_id for update;
  if p_decision='approved' and coalesce(v_proof.health_status,'')<>'pass' then raise exception 'HEALTH_ESCALATION_CANNOT_BE_APPROVED'; end if;
  perform public.admin_review_task_proof(p_proof_id,p_decision,p_admin_note);
  if p_decision='approved' then
    for v_usage in select value from jsonb_array_elements(coalesce(v_proof.inventory_usage,'[]'::jsonb)) loop
      v_quantity:=round((v_usage->>'quantity')::numeric,3);
      select * into v_reservation from public.manual_care_inventory_reservations
        where care_request_id=v_request.id and inventory_item_id=(v_usage->>'inventory_item_id')::uuid and status='active' for update;
      if not found or v_quantity<=0 or coalesce(v_usage->>'unit','')<>v_reservation.usage_unit then
        raise exception 'MANUAL_RESERVED_INVENTORY_INSUFFICIENT';
      end if;
      if v_reservation.usage_unit='kg' then
        if coalesce(v_reservation.kg_per_inventory_unit,0)<=0 or v_quantity>v_reservation.reserved_base_quantity then
          raise exception 'MANUAL_RESERVED_FEED_INSUFFICIENT';
        end if;
        v_deduct_units:=ceil((v_quantity/v_reservation.kg_per_inventory_unit)*1000)/1000;
      else
        v_deduct_units:=v_quantity;
      end if;
      if v_deduct_units>v_reservation.reserved_quantity then raise exception 'MANUAL_RESERVED_INVENTORY_INSUFFICIENT'; end if;
      select * into v_item from public.customer_inventory_items
        where id=v_reservation.inventory_item_id and profile_id=v_request.profile_id for update;
      if not found or v_item.quantity<v_deduct_units then raise exception 'CUSTOMER_INVENTORY_CHANGED_BELOW_RESERVED_AMOUNT'; end if;
      insert into public.manual_care_inventory_usage(
        care_request_id,caretaker_task_id,task_proof_id,inventory_item_id,profile_id,product_name,
        quantity_used,quantity_before,quantity_after,used_base_quantity,base_unit,approved_by_profile_id
      ) values(v_request.id,v_task.id,p_proof_id,v_item.id,v_request.profile_id,v_item.product_name,
        v_deduct_units,v_item.quantity,v_item.quantity-v_deduct_units,
        case when v_reservation.usage_unit='kg' then v_quantity else null end,
        case when v_reservation.usage_unit='kg' then 'kg' else null end,v_admin_id)
      on conflict(task_proof_id,inventory_item_id) do nothing;
      get diagnostics v_inserted=row_count;
      if v_inserted=1 then
        update public.customer_inventory_items set quantity=quantity-v_deduct_units,updated_at=now() where id=v_item.id;
        update public.manual_care_inventory_reservations set actual_used_quantity=v_deduct_units,
          actual_used_base_quantity=case when usage_unit='kg' then v_quantity else null end,
          status='consumed',updated_at=now()
          where id=v_reservation.id;
        insert into public.inbox_items(profile_id,category,title,body,created_at) values(
          v_request.profile_id,'farm_update','Care Inventory Updated',
          v_item.product_name||': '||v_item.quantity::text||' - '||v_deduct_units::text||' = '||(v_item.quantity-v_deduct_units)::text||
            ' '||v_reservation.inventory_unit_label||case when v_reservation.usage_unit='kg' then
            '. Actual mission use: '||v_quantity::text||' kg.' else '.' end||' Admin approved the caretaker proof.',now());
      end if;
    end loop;
  elsif p_decision='rejected' then
    update public.manual_care_inventory_reservations set status='released',updated_at=now()
      where care_request_id=v_request.id and status='active';
  end if;
  return jsonb_build_object('id',p_proof_id,'duplicate',false,'status',p_decision,'care_request_id',v_request.id);
end; $$;

create or replace function public.sync_manual_payment_care_request()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.source_type='care_request' and nullif(new.source_ref,'') is not null then
    if new.status='approved' and exists(select 1 from public.manual_care_inventory_reservations
      where care_request_id::text=new.source_ref and status='active' and expires_at is not null and expires_at<now()) then
      raise exception 'CARE_REQUEST_INVENTORY_RESERVATION_EXPIRED_RETRY';
    end if;
    update public.farm_care_requests set payment_request_id=new.id,status=case
      when new.status='approved' then 'paid_pending_assignment'
      when new.status='rejected' then 'payment_rejected'
      when new.status in ('needs_info','reviewing','for_review') then 'payment_for_review'
      else public.farm_care_requests.status end,
      admin_note=coalesce(new.admin_note,public.farm_care_requests.admin_note),updated_at=now()
      where public.farm_care_requests.id::text=new.source_ref;
    if new.status='rejected' then
      update public.manual_care_inventory_reservations set status='released',updated_at=now()
        where care_request_id::text=new.source_ref and status='active';
    end if;
  end if;
  return new;
end; $$;

-- Keep KaFarm as the read-only watchdog for both automated paid plans and
-- manual premium missions. Existing 062 keys stay stable for the UI.
create or replace function public.kafarm_care_plan_health_snapshot()
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_result jsonb;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  select jsonb_build_object(
    'catalog_days',(select count(*) from public.care_mission_templates where catalog_version='farmconnect-premium-rooster-180-v1'),
    'open_plans',(select count(*) from public.rooster_care_plans where status in ('draft','payment_for_review','payment_submitted','paid_pending_setup','ready','active','paused')),
    'active_plans',(select count(*) from public.rooster_care_plans where status='active'),
    'overdue_missions',(select count(*) from public.rooster_daily_missions where status='overdue'),
    'unreviewed_proofs',(select count(*) from public.task_proofs where daily_mission_id is not null and admin_review_status='pending'),
    'active_supply_conversion_missing',(select count(*) from public.care_plan_supply_requirements requirement
      join public.rooster_care_plans plan on plan.id=requirement.care_plan_id
      where plan.status='active' and coalesce(requirement.kg_per_inventory_unit,0)<=0),
    'negative_inventory',(select count(*) from public.customer_inventory_items where quantity<0),
    'pending_refunds',(select count(*) from public.rooster_care_plans where refund_status='pending'),
    'manual_expired_reservations',(select count(*) from public.manual_care_inventory_reservations
      where status='active' and expires_at is not null and expires_at<now()),
    'manual_unreviewed_proofs',(select count(*) from public.task_proofs proof
      join public.caretaker_tasks task on task.id=coalesce(proof.caretaker_task_id,proof.task_id)
      where task.workflow_type='manual_standard_mission' and proof.admin_review_status='pending'),
    'manual_consumed_without_usage',(select count(*) from public.manual_care_inventory_reservations reservation
      where reservation.status='consumed' and not exists (
        select 1 from public.manual_care_inventory_usage usage
        where usage.care_request_id=reservation.care_request_id
          and usage.inventory_item_id=reservation.inventory_item_id
      )),
    'manual_approved_with_active_reservation',(select count(*) from public.task_proofs proof
      join public.caretaker_tasks task on task.id=coalesce(proof.caretaker_task_id,proof.task_id)
      join public.manual_care_inventory_reservations reservation on reservation.care_request_id=task.care_request_id
      where task.workflow_type='manual_standard_mission' and proof.admin_review_status='approved'
        and reservation.status='active'),
    'paid_manual_open_conflicts',(select count(*) from public.farm_care_requests request
      join public.rooster_care_plans plan on plan.customer_animal_id=request.customer_animal_id
      where request.status in ('payment_for_review','paid_pending_assignment','assigned','in_progress','proof_submitted')
        and plan.status in ('paid_pending_setup','ready','active','paused')),
    'generated_at',now()
  ) into v_result;
  return v_result;
end; $$;

revoke all on function public.customer_create_care_request(uuid,text,text,text,text,numeric,text,text) from public,anon;
revoke all on function public.admin_assign_care_request(uuid,uuid,text) from public,anon;
revoke all on function public.caretaker_get_task_inventory(uuid) from public,anon;
revoke all on function public.caretaker_submit_manual_mission_proof(uuid,text[],text,boolean,boolean,text,jsonb,jsonb) from public,anon;
revoke all on function public.admin_review_manual_mission_proof_guarded(uuid,text,text) from public,anon;
revoke all on function public.kafarm_care_plan_health_snapshot() from public,anon;
revoke all on function public.sync_manual_payment_care_request() from public,anon,authenticated;
grant execute on function public.customer_create_care_request(uuid,text,text,text,text,numeric,text,text) to authenticated;
grant execute on function public.admin_assign_care_request(uuid,uuid,text) to authenticated;
grant execute on function public.caretaker_get_task_inventory(uuid) to authenticated;
grant execute on function public.caretaker_submit_manual_mission_proof(uuid,text[],text,boolean,boolean,text,jsonb,jsonb) to authenticated;
grant execute on function public.admin_review_manual_mission_proof_guarded(uuid,text,text) to authenticated;
grant execute on function public.kafarm_care_plan_health_snapshot() to authenticated;

commit;

select jsonb_build_object(
  'migration','063_unified_care_plan_manual_mission_inventory_guard',
  'reservation_table',to_regclass('public.manual_care_inventory_reservations') is not null,
  'usage_table',to_regclass('public.manual_care_inventory_usage') is not null,
  'manual_submit_rpc',to_regprocedure('public.caretaker_submit_manual_mission_proof(uuid,text[],text,boolean,boolean,text,jsonb,jsonb)') is not null,
  'manual_review_rpc',to_regprocedure('public.admin_review_manual_mission_proof_guarded(uuid,text,text)') is not null,
  'kafarm_unified_health_rpc',to_regprocedure('public.kafarm_care_plan_health_snapshot()') is not null
) verification;
