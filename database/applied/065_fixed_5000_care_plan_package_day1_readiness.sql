-- Fixed PHP 5,000 30-day Care Plan package and Day 1 readiness gate.
-- Customer request prepares the exact package and payment immediately.
-- Admin payment approval moves it to Task Management. One assignment creates
-- Day 1 preparation + care; later days wait for verified Day 1 readiness.

begin;

create table if not exists public.care_plan_package_items (
  id uuid primary key default gen_random_uuid(),
  care_plan_id uuid not null references public.rooster_care_plans(id) on delete cascade,
  item_kind text not null,
  product_id text,
  linked_inventory_item_id uuid references public.customer_inventory_items(id) on delete set null,
  item_name text not null,
  required_quantity numeric(16,3) not null check (required_quantity > 0),
  unit text not null,
  stock_controlled boolean not null default false,
  use_rule text not null,
  status text not null default 'planned' check (status in ('planned','assigned','verified','blocked','consumed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(care_plan_id,item_kind,item_name)
);

alter table public.rooster_care_plans
  add column if not exists preparation_status text not null default 'not_started',
  add column if not exists preparation_verified_at timestamptz;
alter table public.rooster_care_plans drop constraint if exists rooster_care_plans_preparation_status_check;
alter table public.rooster_care_plans add constraint rooster_care_plans_preparation_status_check
  check (preparation_status in ('not_started','assigned','verified','blocked'));

alter table public.care_plan_package_items enable row level security;
drop policy if exists "care plan package linked read" on public.care_plan_package_items;
create policy "care plan package linked read" on public.care_plan_package_items
  for select to authenticated using (
    exists (
      select 1 from public.rooster_care_plans plan
      where plan.id=care_plan_id and (
        plan.profile_id=public.current_profile_id()
        or public.is_admin()
        or plan.assigned_caretaker_id in (
          select caretaker.id from public.caretakers caretaker
          where caretaker.profile_id=public.current_profile_id()
             or caretaker.caretaker_profile_id=public.current_profile_id()
        )
      )
    )
  );

create or replace function public.customer_prepare_fixed_care_plan_payment(p_care_plan_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_profile_id uuid;
  v_plan public.rooster_care_plans%rowtype;
  v_feed_product public.farm_products%rowtype;
  v_inventory_item public.customer_inventory_items%rowtype;
  v_catalog_count integer;
  v_unquantified_days integer;
  v_required_kg numeric(16,3);
  v_kg_per_unit numeric(16,6);
  v_required_units numeric(16,3);
  v_reserved_farm_units numeric(16,3);
  v_supply_value numeric(14,2);
begin
  select id into v_profile_id from public.profiles where auth_user_id=auth.uid() limit 1;
  if v_profile_id is null then raise exception 'LOGIN_REQUIRED'; end if;
  select * into v_plan from public.rooster_care_plans
    where id=p_care_plan_id and profile_id=v_profile_id for update;
  if not found then raise exception 'CARE_PLAN_NOT_FOUND'; end if;
  if v_plan.duration_days<>30 then raise exception 'FIXED_PACKAGE_REQUIRES_30_DAYS'; end if;
  if v_plan.status in ('payment_submitted','paid_pending_setup','ready','active','paused') then
    return jsonb_build_object('id',v_plan.id,'duplicate',true,'status',v_plan.status,
      'package_total',v_plan.package_total,'feed_required_kg',v_plan.feed_required_kg,
      'duration_days',v_plan.duration_days,'requested_start_day',v_plan.requested_start_day);
  end if;
  if v_plan.status not in ('draft','payment_for_review') then raise exception 'CARE_PLAN_NOT_PAYABLE'; end if;
  if exists(
    select 1 from public.manual_payment_requests
    where source_type='care_plan' and source_ref=v_plan.id::text
      and status in ('for_review','needs_info','approved')
  ) then raise exception 'CARE_PLAN_PAYMENT_ALREADY_SUBMITTED'; end if;

  select count(*),count(*) filter(where feed_grams_max is null),
    round(sum(coalesce(feed_grams_max,30))/1000,3)
  into v_catalog_count,v_unquantified_days,v_required_kg
  from public.care_mission_templates
  where catalog_version=v_plan.catalog_version
    and day_number between v_plan.requested_start_day and v_plan.requested_start_day+29;
  if v_catalog_count<>30 then raise exception 'MISSION_CATALOG_RANGE_INCOMPLETE'; end if;
  if coalesce(v_required_kg,0)<=0 then raise exception 'MISSION_CATALOG_FEED_TOTAL_MISSING'; end if;

  perform pg_advisory_xact_lock(hashtextextended('farmconnect-fixed-care-plan-feed',0));
  select fp.*
  into v_feed_product
  from public.farm_products fp
  where fp.status='available'
    and coalesce(fp.stock_quantity,0)>0
    and (lower(coalesce(fp.product_type,''))='feed' or fp.category ilike '%feed%')
    and coalesce(fp.unit_price,0)>0
    and coalesce(
      case
        when coalesce(fp.product_metadata->>'kg_per_inventory_unit','') ~ '^[0-9]+([.][0-9]+)?$'
          then (fp.product_metadata->>'kg_per_inventory_unit')::numeric
        when substring(lower(coalesce(fp.unit_label,'')) from '([0-9]+([.][0-9]+)?) *kg') is not null
          then substring(lower(fp.unit_label) from '([0-9]+([.][0-9]+)?) *kg')::numeric
        when lower(coalesce(fp.unit_label,'')) like '%kg%' then 1::numeric
        else null::numeric
      end,0
    )>0
    and fp.stock_quantity-
      coalesce((
        select sum(requirement.purchase_inventory_units)
        from public.care_plan_supply_requirements requirement
        join public.rooster_care_plans other_plan on other_plan.id=requirement.care_plan_id
        where requirement.product_id=fp.id::text
          and requirement.purchase_fulfilled_at is null
          and (
            other_plan.status in ('payment_submitted','paid_pending_setup','ready','active','paused')
            or (other_plan.status='payment_for_review' and other_plan.quote_expires_at>=now())
          )
      ),0)
      >=ceil((v_required_kg/(
        case
          when coalesce(fp.product_metadata->>'kg_per_inventory_unit','') ~ '^[0-9]+([.][0-9]+)?$'
            then (fp.product_metadata->>'kg_per_inventory_unit')::numeric
          when substring(lower(coalesce(fp.unit_label,'')) from '([0-9]+([.][0-9]+)?) *kg') is not null
            then substring(lower(fp.unit_label) from '([0-9]+([.][0-9]+)?) *kg')::numeric
          when lower(coalesce(fp.unit_label,'')) like '%kg%' then 1::numeric
        end
      ))*1000)/1000
  order by
    case
      when v_plan.requested_start_day<=42 and (fp.name ilike '%starter%' or fp.name ilike '%chick%') then 0
      when v_plan.requested_start_day between 43 and 90 and (fp.name ilike '%grower%' or fp.name ilike '%developer%') then 0
      when v_plan.requested_start_day>90 and (fp.name ilike '%finisher%' or fp.name ilike '%maintenance%') then 0
      else 1
    end,
    fp.unit_price/(
      case
        when coalesce(fp.product_metadata->>'kg_per_inventory_unit','') ~ '^[0-9]+([.][0-9]+)?$'
          then (fp.product_metadata->>'kg_per_inventory_unit')::numeric
        when substring(lower(coalesce(fp.unit_label,'')) from '([0-9]+([.][0-9]+)?) *kg') is not null
          then substring(lower(fp.unit_label) from '([0-9]+([.][0-9]+)?) *kg')::numeric
        when lower(coalesce(fp.unit_label,'')) like '%kg%' then 1::numeric
      end
    ) asc
  limit 1;
  if not found then raise exception 'CARE_PLAN_COMPLETE_FEED_PACKAGE_UNAVAILABLE'; end if;
  v_kg_per_unit:=case
    when coalesce(v_feed_product.product_metadata->>'kg_per_inventory_unit','') ~ '^[0-9]+([.][0-9]+)?$'
      then (v_feed_product.product_metadata->>'kg_per_inventory_unit')::numeric
    when substring(lower(coalesce(v_feed_product.unit_label,'')) from '([0-9]+([.][0-9]+)?) *kg') is not null
      then substring(lower(v_feed_product.unit_label) from '([0-9]+([.][0-9]+)?) *kg')::numeric
    when lower(coalesce(v_feed_product.unit_label,'')) like '%kg%' then 1::numeric
    else null::numeric
  end;
  if coalesce(v_kg_per_unit,0)<=0 then raise exception 'CARE_PLAN_FEED_PACK_WEIGHT_MISSING'; end if;

  v_required_units:=ceil((v_required_kg/v_kg_per_unit)*1000)/1000;
  select coalesce(sum(requirement.purchase_inventory_units),0) into v_reserved_farm_units
  from public.care_plan_supply_requirements requirement
  join public.rooster_care_plans other_plan on other_plan.id=requirement.care_plan_id
  where requirement.product_id=v_feed_product.id::text
    and requirement.care_plan_id<>v_plan.id
    and requirement.purchase_fulfilled_at is null
    and (
      other_plan.status in ('payment_submitted','paid_pending_setup','ready','active','paused')
      or (other_plan.status='payment_for_review' and other_plan.quote_expires_at>=now())
    );
  if v_feed_product.stock_quantity-coalesce(v_reserved_farm_units,0)<v_required_units then
    raise exception 'CARE_PLAN_COMPLETE_FEED_PACKAGE_UNAVAILABLE';
  end if;
  v_supply_value:=round(v_required_units*v_feed_product.unit_price,2);
  if v_supply_value>=5000 then raise exception 'CARE_PLAN_PACKAGE_COST_EXCEEDS_FIXED_PRICE'; end if;

  insert into public.customer_inventory_items(
    profile_id,product_id,product_name,category,unit_label,unit_price,image_url,
    quantity,product_type,inventory_metadata,updated_at
  ) values(
    v_plan.profile_id,v_feed_product.id::text,v_feed_product.name,v_feed_product.category,
    v_feed_product.unit_label,v_feed_product.unit_price,v_feed_product.image_url,0,
    coalesce(v_feed_product.product_type,'feed'),
    jsonb_build_object('source','fixed_5000_care_plan','kg_per_inventory_unit',v_kg_per_unit),now()
  ) on conflict(profile_id,product_id) do update set
    product_name=excluded.product_name,category=excluded.category,unit_label=excluded.unit_label,
    unit_price=excluded.unit_price,image_url=excluded.image_url,product_type=excluded.product_type,
    inventory_metadata=coalesce(public.customer_inventory_items.inventory_metadata,'{}'::jsonb)
      ||jsonb_build_object('kg_per_inventory_unit',v_kg_per_unit),updated_at=now()
  returning * into v_inventory_item;

  delete from public.care_plan_supply_requirements where care_plan_id=v_plan.id;
  insert into public.care_plan_supply_requirements(
    care_plan_id,inventory_item_id,product_id,product_name,unit,required_quantity,
    owned_quantity_snapshot,reserved_quantity,purchase_quantity,unit_price,requirement_source,
    inventory_unit_label,kg_per_inventory_unit,required_inventory_units,
    reserved_inventory_units,purchase_inventory_units,reservation_status
  ) values(
    v_plan.id,v_inventory_item.id,v_feed_product.id::text,v_feed_product.name,'kg',v_required_kg,
    0,0,v_required_kg,v_feed_product.unit_price,'fixed_5000_30_day_catalog',
    coalesce(nullif(v_feed_product.unit_label,''),'inventory unit'),v_kg_per_unit,
    v_required_units,0,v_required_units,'quoted'
  );

  delete from public.care_plan_package_items where care_plan_id=v_plan.id;
  insert into public.care_plan_package_items(
    care_plan_id,item_kind,product_id,linked_inventory_item_id,item_name,
    required_quantity,unit,stock_controlled,use_rule
  ) values
    (v_plan.id,'feed',v_feed_product.id::text,v_inventory_item.id,v_feed_product.name,
      v_required_kg,'kg',true,'Measured daily from the mission standard; record actual kg used.'),
    (v_plan.id,'biosecurity',null,null,'Biosecurity and sanitation kit',
      1,'30-day kit',false,'Footbath, disinfectant, dedicated cleaning tools, and sealed waste control.'),
    (v_plan.id,'gloves',null,null,'Clean examination gloves',
      30,'pairs',false,'Use clean gloves for the daily physical examination.'),
    (v_plan.id,'litter',null,null,'Dry litter and housing-cleaning allocation',
      30,'daily allocations',false,'Keep housing dry; replace wet or contaminated litter immediately.'),
    (v_plan.id,'support',null,null,'Electrolyte and vitamin reserve',
      1,'labeled reserve pack',false,'Conditional use only when justified and authorized; never routine or overlapping.'),
    (v_plan.id,'evidence',null,null,'Rooster ID and evidence kit',
      1,'set',false,'QR/ID record, daily checklist, scale access, and dated photo/video evidence.');

  update public.rooster_care_plans set
    start_day_number=requested_start_day,
    feed_required_kg=v_required_kg,
    feed_inventory_item_id=v_inventory_item.id,
    labor_price=0,
    supply_price=v_supply_value,
    service_fee=round(5000-v_supply_value,2),
    quote_note='Fixed PHP 5,000 all-inclusive standard 30-day package. Veterinary medicine and emergency treatment excluded.',
    quoted_at=now(),
    quote_expires_at=now()+interval '24 hours',
    quoted_by_profile_id=null,
    status='payment_for_review',
    preparation_status='not_started',
    updated_at=now()
  where id=v_plan.id;

  insert into public.care_plan_events(care_plan_id,actor_profile_id,event_type,event_data)
  values(v_plan.id,v_profile_id,'fixed_package_prepared',jsonb_build_object(
    'package_total',5000,'feed_required_kg',v_required_kg,
    'feed_product_id',v_feed_product.id,'feed_units',v_required_units,
    'feed_pack_kg',v_kg_per_unit,'unquantified_days',v_unquantified_days));
  insert into public.inbox_items(profile_id,category,title,body,created_at)
  values(v_plan.profile_id,'care','Care Plan Ready for Payment',
    'Your 30-day Care Plan package is PHP 5,000. Submit payment proof; after Admin approval it moves to Task Management.',now());

  return jsonb_build_object('id',v_plan.id,'duplicate',false,'status','payment_for_review',
    'package_total',5000,'feed_required_kg',v_required_kg,'duration_days',30,
    'requested_start_day',v_plan.requested_start_day);
end;
$$;

create or replace function public.customer_request_care_plan(
  p_customer_animal_id uuid,p_duration_days integer,p_requested_start_day integer default 1
) returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare v_profile_id uuid; v_plan_id uuid; v_animal public.customer_animals%rowtype;
begin
  select id into v_profile_id from public.profiles where auth_user_id=auth.uid() limit 1;
  if v_profile_id is null then raise exception 'LOGIN_REQUIRED'; end if;
  if p_duration_days<>30 then raise exception 'ONLY_30_DAY_FIXED_PACKAGE_AVAILABLE'; end if;
  if p_requested_start_day<1 or p_requested_start_day+29>180 then raise exception 'PLAN_EXCEEDS_CATALOG'; end if;
  select * into v_animal from public.customer_animals
    where id=p_customer_animal_id and profile_id=v_profile_id and status not in ('sold','cancelled');
  if not found then raise exception 'ANIMAL_NOT_OWNED'; end if;
  if exists(
    select 1 from public.rooster_care_plans
    where customer_animal_id=p_customer_animal_id
      and status in ('draft','payment_for_review','payment_submitted','paid_pending_setup','ready','active','paused')
  ) then raise exception 'ROOSTER_ALREADY_HAS_OPEN_CARE_PLAN'; end if;

  insert into public.rooster_care_plans(
    profile_id,customer_animal_id,duration_days,start_day_number,requested_start_day,status
  ) values(v_profile_id,p_customer_animal_id,30,p_requested_start_day,p_requested_start_day,'draft')
  returning id into v_plan_id;
  insert into public.care_plan_events(care_plan_id,actor_profile_id,event_type,event_data)
  values(v_plan_id,v_profile_id,'plan_requested',jsonb_build_object(
    'duration_days',30,'requested_start_day',p_requested_start_day,'fixed_price',5000));
  perform public.customer_prepare_fixed_care_plan_payment(v_plan_id);
  return v_plan_id;
end;
$$;

create or replace function public.admin_assign_care_plan(
  p_care_plan_id uuid,p_caretaker_id uuid,p_admin_note text default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_admin_id uuid;
  v_plan public.rooster_care_plans%rowtype;
  v_requirement public.care_plan_supply_requirements%rowtype;
  v_today date:=(now() at time zone 'Asia/Manila')::date;
  v_catalog_count integer;
  v_generation jsonb;
  v_package jsonb;
  v_package_needed jsonb;
  v_package_checks jsonb;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if p_caretaker_id is null then raise exception 'ACTIVE_CARETAKER_REQUIRED'; end if;
  select id into v_admin_id from public.profiles where auth_user_id=auth.uid() limit 1;
  select * into v_plan from public.rooster_care_plans where id=p_care_plan_id for update;
  if not found then raise exception 'CARE_PLAN_NOT_FOUND'; end if;
  if v_plan.assigned_caretaker_id is not null and v_plan.preparation_status in ('assigned','verified') then
    if v_plan.assigned_caretaker_id<>p_caretaker_id then raise exception 'CARE_PLAN_ALREADY_ASSIGNED'; end if;
    return jsonb_build_object('id',v_plan.id,'duplicate',true,'status',v_plan.status,
      'start_date',v_plan.start_date,'end_date',v_plan.end_date);
  end if;
  if v_plan.status not in ('paid_pending_setup','ready') then
    raise exception 'CARE_PLAN_NOT_READY_FOR_TASK_ASSIGNMENT';
  end if;
  if round(v_plan.package_total,2)<>5000 then raise exception 'CARE_PLAN_FIXED_PRICE_MISMATCH'; end if;
  if not exists(
    select 1 from public.manual_payment_requests payment
    where payment.id=v_plan.payment_request_id and payment.source_type='care_plan'
      and payment.source_ref=v_plan.id::text and payment.profile_id=v_plan.profile_id
      and payment.status='approved' and round(payment.amount_expected,2)=5000
  ) then raise exception 'APPROVED_EXACT_PAYMENT_REQUIRED'; end if;
  if not exists(
    select 1 from public.caretakers
    where id=p_caretaker_id and coalesce(status,'active') in ('active','approved','on_duty')
  ) then raise exception 'ACTIVE_CARETAKER_REQUIRED'; end if;
  select count(*) into v_catalog_count from public.care_mission_templates
  where catalog_version=v_plan.catalog_version
    and day_number between v_plan.start_day_number and v_plan.start_day_number+29;
  if v_catalog_count<>30 then raise exception 'MISSION_CATALOG_RANGE_INCOMPLETE'; end if;
  if (select count(*) from public.care_plan_package_items where care_plan_id=v_plan.id)<>6 then
    raise exception 'CARE_PLAN_COMPLETE_PACKAGE_MISSING';
  end if;

  perform public.fulfill_care_plan_feed(v_plan.id);
  select * into v_requirement from public.care_plan_supply_requirements
    where care_plan_id=v_plan.id and unit='kg' for update;
  if not found or v_requirement.reservation_status<>'active'
     or v_requirement.reserved_inventory_units<v_requirement.required_inventory_units then
    raise exception 'CARE_PLAN_SUPPLIES_INCOMPLETE';
  end if;

  update public.rooster_care_plans set
    assigned_caretaker_id=p_caretaker_id,start_date=v_today,end_date=v_today+29,
    status='active',schedule_shift_days=0,activated_at=coalesce(activated_at,now()),
    preparation_status='assigned',preparation_verified_at=null,updated_at=now()
  where id=v_plan.id;
  update public.care_plan_package_items set status='assigned',updated_at=now()
    where care_plan_id=v_plan.id;

  v_generation:=public.generate_due_care_plan_missions(v_today);
  select coalesce(jsonb_agg(jsonb_build_object(
    'item_kind',item_kind,'item_name',item_name,'required_quantity',required_quantity,
    'unit',unit,'use_rule',use_rule,'stock_controlled',stock_controlled
  ) order by stock_controlled desc,item_kind),'[]'::jsonb),
  coalesce(jsonb_agg(to_jsonb(item_name||': '||required_quantity::text||' '||unit||' — '||use_rule)
    order by stock_controlled desc,item_kind),'[]'::jsonb),
  coalesce(jsonb_agg(to_jsonb('Verify ready: '||item_name||' — count, inspect label/expiry, isolate any missing or damaged supply.')
    order by stock_controlled desc,item_kind),'[]'::jsonb)
  into v_package,v_package_needed,v_package_checks
  from public.care_plan_package_items where care_plan_id=v_plan.id;

  update public.caretaker_tasks task set
    task_type='Care Plan Ready + Day 1: '||coalesce(task.task_metadata->>'primary_mission','Initial standard care'),
    required_proof='Verify rooster/pen readiness and all six package items, then complete Day 1 care with checklist, health result, actual feed usage, and time-stamped evidence.',
    task_metadata=task.task_metadata||jsonb_build_object(
      'care_plan_preparation_required',true,
      'package_total',5000,
      'package_items',v_package,
      'needed_today',v_package_needed||coalesce(task.task_metadata->'needed_today','[]'::jsonb),
      'operations_checklist',v_package_checks||coalesce(task.task_metadata->'operations_checklist','[]'::jsonb),
      'primary_mission','Prepare the complete 30-day Care Plan package and perform Day 1 care: '||
        coalesce(task.task_metadata->>'primary_mission','Initial standard care')
    )
  where task.care_plan_id=v_plan.id and task.mission_date=v_today;
  update public.rooster_care_plans set status='ready',updated_at=now() where id=v_plan.id;

  insert into public.care_plan_events(care_plan_id,actor_profile_id,event_type,event_data)
  values(v_plan.id,v_admin_id,'plan_assigned_for_day1_preparation',jsonb_build_object(
    'caretaker_id',p_caretaker_id,'start_date',v_today,'end_date',v_today+29,
    'package_items',v_package,'admin_note',p_admin_note));
  insert into public.inbox_items(profile_id,category,title,body,created_at)
  values(v_plan.profile_id,'care','Care Plan Assigned',
    'Your caretaker received Day 1 package preparation and initial care. Day 2 starts after Admin verifies readiness.',now());
  return jsonb_build_object('id',v_plan.id,'duplicate',false,'status','ready',
    'start_date',v_today,'end_date',v_today+29,
    'created_missions',coalesce((v_generation->>'created')::integer,0));
end;
$$;

create or replace function public.sync_care_plan_day1_readiness()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_plan public.rooster_care_plans%rowtype; v_shift integer;
begin
  if new.plan_day<>1 or new.status is not distinct from old.status then return new; end if;
  select * into v_plan from public.rooster_care_plans where id=new.care_plan_id for update;
  if not found then return new; end if;
  if new.status='approved' then
    v_shift:=greatest(0,(now() at time zone 'Asia/Manila')::date-v_plan.start_date);
    update public.rooster_care_plans set
      status='active',preparation_status='verified',preparation_verified_at=now(),
      schedule_shift_days=v_shift,end_date=end_date+v_shift,updated_at=now()
    where id=v_plan.id;
    update public.care_plan_package_items set status='verified',updated_at=now()
      where care_plan_id=v_plan.id;
    insert into public.inbox_items(profile_id,category,title,body,created_at)
    values(v_plan.profile_id,'care','Care Plan Ready',
      'Day 1 package preparation and initial care were verified. Automatic daily missions will continue.',now());
  elsif new.status in ('backjob','watch','isolate_and_escalate') then
    update public.rooster_care_plans set preparation_status='blocked',status='ready',updated_at=now()
      where id=v_plan.id;
    update public.care_plan_package_items set status='blocked',updated_at=now()
      where care_plan_id=v_plan.id;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_sync_care_plan_day1_readiness on public.rooster_daily_missions;
create trigger trg_sync_care_plan_day1_readiness
after update of status on public.rooster_daily_missions
for each row execute function public.sync_care_plan_day1_readiness();

revoke all on function public.customer_prepare_fixed_care_plan_payment(uuid) from public,anon;
revoke all on function public.customer_request_care_plan(uuid,integer,integer) from public,anon;
revoke all on function public.admin_assign_care_plan(uuid,uuid,text) from public,anon;
grant execute on function public.customer_prepare_fixed_care_plan_payment(uuid) to authenticated;
grant execute on function public.customer_request_care_plan(uuid,integer,integer) to authenticated;
grant execute on function public.admin_assign_care_plan(uuid,uuid,text) to authenticated;

commit;

select jsonb_build_object(
  'migration','065_fixed_5000_care_plan_package_day1_readiness',
  'package_table',to_regclass('public.care_plan_package_items') is not null,
  'fixed_payment_rpc',to_regprocedure('public.customer_prepare_fixed_care_plan_payment(uuid)') is not null,
  'assignment_rpc',to_regprocedure('public.admin_assign_care_plan(uuid,uuid,text)') is not null,
  'readiness_trigger',exists(
    select 1 from pg_trigger where tgname='trg_sync_care_plan_day1_readiness' and not tgisinternal
  )
) verification;
