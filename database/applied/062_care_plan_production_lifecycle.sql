-- FarmConnect Care Plan production lifecycle hardening.
-- Run after 058, 059, 060, and 061.
-- Corrects pack-to-kilogram accounting, payment binding, supply fulfillment,
-- scheduler operations, cancellation/refund tracking, reassignment, and completion.

begin;

-- Care Plans are a first-class manual-payment source.
do $$
declare v_constraint record;
begin
  for v_constraint in
    select conname
    from pg_constraint
    where conrelid='public.manual_payment_requests'::regclass
      and contype='c'
      and pg_get_constraintdef(oid) ilike '%source_type%'
  loop
    execute format('alter table public.manual_payment_requests drop constraint %I',v_constraint.conname);
  end loop;
end; $$;
alter table public.manual_payment_requests
  add constraint manual_payment_requests_source_type_check
  check (source_type in ('farm_buy','care_request','care_plan','cashin','other'));

alter table public.rooster_care_plans
  add column if not exists paused_at timestamptz,
  add column if not exists pause_note text,
  add column if not exists schedule_shift_days integer not null default 0,
  add column if not exists quote_expires_at timestamptz,
  add column if not exists refund_due_amount numeric(14,2) not null default 0,
  add column if not exists refund_status text not null default 'not_required',
  add column if not exists refund_reference text,
  add column if not exists refunded_at timestamptz,
  add column if not exists cancelled_by_profile_id uuid references public.profiles(id) on delete set null;

alter table public.rooster_care_plans drop constraint if exists rooster_care_plans_status_check;
alter table public.rooster_care_plans add constraint rooster_care_plans_status_check check (status in (
  'draft','payment_for_review','payment_submitted','paid_pending_setup','ready','active','paused','completed','cancelled','expired'
));
drop index if exists public.uq_rooster_one_live_care_plan;
create unique index uq_rooster_one_live_care_plan on public.rooster_care_plans(customer_animal_id)
  where status in ('payment_for_review','payment_submitted','paid_pending_setup','ready','active','paused');

alter table public.rooster_care_plans drop constraint if exists rooster_care_plans_refund_status_check;
alter table public.rooster_care_plans add constraint rooster_care_plans_refund_status_check
  check (refund_status in ('not_required','pending','completed'));
alter table public.rooster_care_plans drop constraint if exists rooster_care_plans_refund_due_amount_check;
alter table public.rooster_care_plans add constraint rooster_care_plans_refund_due_amount_check
  check (refund_due_amount>=0);
alter table public.rooster_care_plans drop constraint if exists rooster_care_plans_schedule_shift_check;
alter table public.rooster_care_plans add constraint rooster_care_plans_schedule_shift_check
  check (schedule_shift_days>=0);

alter table public.care_plan_supply_requirements
  add column if not exists inventory_unit_label text,
  add column if not exists kg_per_inventory_unit numeric(16,6),
  add column if not exists required_inventory_units numeric(16,3),
  add column if not exists reserved_inventory_units numeric(16,3) not null default 0,
  add column if not exists purchase_inventory_units numeric(16,3) not null default 0,
  add column if not exists purchase_fulfilled_at timestamptz,
  add column if not exists reservation_status text not null default 'quoted';

alter table public.care_plan_supply_requirements drop constraint if exists care_plan_supply_kg_per_unit_check;
alter table public.care_plan_supply_requirements add constraint care_plan_supply_kg_per_unit_check
  check (kg_per_inventory_unit is null or kg_per_inventory_unit>0);
alter table public.care_plan_supply_requirements drop constraint if exists care_plan_supply_units_check;
alter table public.care_plan_supply_requirements add constraint care_plan_supply_units_check
  check (coalesce(required_inventory_units,0)>=0 and reserved_inventory_units>=0 and purchase_inventory_units>=0);
alter table public.care_plan_supply_requirements drop constraint if exists care_plan_supply_reservation_status_check;
alter table public.care_plan_supply_requirements add constraint care_plan_supply_reservation_status_check
  check (reservation_status in ('quoted','active','released','consumed'));

-- Migration 058 used purchase_quantity = required - reserved as a quote-time
-- invariant. That formula becomes false after a purchase is fulfilled or a
-- reservation is released on completion/cancellation, so remove only that
-- obsolete expression constraint. Non-negative quantity checks remain.
do $$
declare v_constraint record;
begin
  for v_constraint in
    select conname,pg_get_constraintdef(oid) as definition
    from pg_constraint
    where conrelid='public.care_plan_supply_requirements'::regclass and contype='c'
  loop
    if v_constraint.definition ilike '%purchase_quantity%greatest%required_quantity%reserved_quantity%' then
      execute format('alter table public.care_plan_supply_requirements drop constraint %I',v_constraint.conname);
    end if;
  end loop;
end; $$;

alter table public.care_plan_inventory_usage
  add column if not exists used_base_kg numeric(16,3),
  add column if not exists inventory_unit_label text,
  add column if not exists kg_per_inventory_unit numeric(16,6);

alter table public.care_plan_inventory_usage drop constraint if exists care_plan_inventory_usage_unit_check;
alter table public.care_plan_inventory_usage add constraint care_plan_inventory_usage_unit_check
  check (length(trim(unit)) between 1 and 80);
alter table public.care_plan_inventory_usage drop constraint if exists care_plan_inventory_usage_base_kg_check;
alter table public.care_plan_inventory_usage add constraint care_plan_inventory_usage_base_kg_check
  check (used_base_kg is null or used_base_kg>0);

create unique index if not exists uq_care_plan_one_open_payment
  on public.manual_payment_requests(source_type,source_ref)
  where source_type='care_plan' and status in ('for_review','needs_info','approved');

-- The server computes food from the authoritative mission catalog. Admin supplies
-- only the verified pack conversion, labor/service prices, caretaker, and note.
drop function if exists public.admin_prepare_care_plan_quote_v2(uuid,uuid,uuid,numeric,numeric,numeric,numeric,text);
create or replace function public.admin_prepare_care_plan_quote_v2(
  p_care_plan_id uuid,
  p_caretaker_id uuid,
  p_feed_inventory_item_id uuid,
  p_feed_product_id text,
  p_kg_per_inventory_unit numeric,
  p_unquantified_day_feed_grams numeric,
  p_labor_price numeric,
  p_service_fee numeric,
  p_quote_note text default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_admin_id uuid;
  v_plan public.rooster_care_plans%rowtype;
  v_item public.customer_inventory_items%rowtype;
  v_feed_product public.farm_products%rowtype;
  v_catalog_count integer;
  v_unquantified_days integer;
  v_required_kg numeric(16,3);
  v_known_min_kg numeric(16,3);
  v_required_units numeric(16,3);
  v_reserved_units numeric(16,3);
  v_purchase_units numeric(16,3);
  v_other_reserved_units numeric(16,3);
  v_other_purchase_units numeric(16,3);
  v_supply_price numeric(14,2);
  v_total numeric(14,2);
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  select id into v_admin_id from public.profiles where auth_user_id=auth.uid() limit 1;
  select * into v_plan from public.rooster_care_plans where id=p_care_plan_id for update;
  if not found then raise exception 'CARE_PLAN_NOT_FOUND'; end if;
  if v_plan.status not in ('draft','payment_for_review') then raise exception 'CARE_PLAN_NOT_QUOTABLE'; end if;
  if v_plan.payment_request_id is not null and exists(
    select 1 from public.manual_payment_requests where id=v_plan.payment_request_id and status in ('for_review','needs_info','approved')
  ) then raise exception 'CARE_PLAN_PAYMENT_ALREADY_SUBMITTED'; end if;
  if not exists(select 1 from public.caretakers where id=p_caretaker_id and coalesce(status,'active') in ('active','approved','on_duty')) then
    raise exception 'ACTIVE_CARETAKER_REQUIRED';
  end if;
  if coalesce(p_kg_per_inventory_unit,0)<=0 then raise exception 'PACK_WEIGHT_KG_REQUIRED'; end if;
  if coalesce(p_unquantified_day_feed_grams,-1)<0 then raise exception 'UNQUANTIFIED_DAY_FEED_ALLOWANCE_REQUIRED'; end if;
  if least(coalesce(p_labor_price,-1),coalesce(p_service_fee,-1))<0 then raise exception 'INVALID_PACKAGE_PRICE'; end if;
  if (p_feed_inventory_item_id is null)=(nullif(trim(coalesce(p_feed_product_id,'')),'') is null) then
    raise exception 'CHOOSE_ONE_FEED_SOURCE';
  end if;
  if p_feed_inventory_item_id is not null then
    select * into v_item from public.customer_inventory_items
      where id=p_feed_inventory_item_id and profile_id=v_plan.profile_id for update;
    if not found then raise exception 'CUSTOMER_FEED_INVENTORY_REQUIRED'; end if;
  else
    select * into v_feed_product from public.farm_products
      where id::text=trim(p_feed_product_id) and status='available' for update;
    if not found then raise exception 'CARE_PLAN_FEED_PRODUCT_NOT_FOUND'; end if;
    insert into public.customer_inventory_items(
      profile_id,product_id,product_name,category,unit_label,unit_price,image_url,quantity,product_type,inventory_metadata,updated_at
    ) values(
      v_plan.profile_id,v_feed_product.id::text,v_feed_product.name,v_feed_product.category,v_feed_product.unit_label,
      v_feed_product.unit_price,v_feed_product.image_url,0,coalesce(v_feed_product.product_type,'feed'),
      jsonb_build_object('source','care_plan_quote_placeholder'),now()
    ) on conflict(profile_id,product_id) do update set
      product_name=excluded.product_name,category=excluded.category,unit_label=excluded.unit_label,
      unit_price=excluded.unit_price,image_url=excluded.image_url,product_type=excluded.product_type,updated_at=now()
    returning * into v_item;
  end if;
  if coalesce(v_item.category,'') not ilike '%feed%'
     and lower(coalesce(v_item.product_type,''))<>'feed' then
    raise exception 'CARE_PLAN_FEED_ITEM_REQUIRED';
  end if;
  if coalesce(v_item.quantity,0)<0 then raise exception 'INVALID_CUSTOMER_INVENTORY'; end if;
  select coalesce(sum(requirement.reserved_inventory_units),0) into v_other_reserved_units
  from public.care_plan_supply_requirements requirement
  join public.rooster_care_plans other_plan on other_plan.id=requirement.care_plan_id
  where requirement.inventory_item_id=v_item.id and requirement.care_plan_id<>v_plan.id
    and requirement.reservation_status in ('quoted','active')
    and (
      other_plan.status in ('payment_submitted','paid_pending_setup','ready','active','paused')
      or (other_plan.status='payment_for_review' and other_plan.quote_expires_at>=now())
    );

  select count(*),count(*) filter(where feed_grams_max is null),
    round(coalesce(sum(coalesce(feed_grams_max,p_unquantified_day_feed_grams)),0)/1000,3),
    round(coalesce(sum(coalesce(feed_grams_min,p_unquantified_day_feed_grams)),0)/1000,3)
    into v_catalog_count,v_unquantified_days,v_required_kg,v_known_min_kg
  from public.care_mission_templates
  where catalog_version=v_plan.catalog_version
    and day_number between v_plan.requested_start_day and v_plan.requested_start_day+v_plan.duration_days-1;
  if v_catalog_count<>v_plan.duration_days then raise exception 'MISSION_CATALOG_RANGE_INCOMPLETE'; end if;
  if v_unquantified_days>0 and p_unquantified_day_feed_grams<=0 then raise exception 'BROODING_FEED_ALLOWANCE_REQUIRED'; end if;
  if v_required_kg<=0 then raise exception 'MISSION_CATALOG_FEED_TOTAL_MISSING'; end if;

  v_required_units:=ceil((v_required_kg/p_kg_per_inventory_unit)*1000)/1000;
  v_reserved_units:=least(greatest(coalesce(v_item.quantity,0)-v_other_reserved_units,0),v_required_units);
  v_purchase_units:=greatest(v_required_units-v_reserved_units,0);
  if v_purchase_units>0 and coalesce(v_item.unit_price,0)<=0 then
    raise exception 'CARE_PLAN_FEED_PRICE_REQUIRED';
  end if;
  if v_purchase_units>0 then
    select * into v_feed_product from public.farm_products
      where id::text=v_item.product_id and status='available' for update;
    if not found then raise exception 'CARE_PLAN_FEED_PRODUCT_NOT_FOUND'; end if;
    select coalesce(sum(requirement.purchase_inventory_units),0) into v_other_purchase_units
    from public.care_plan_supply_requirements requirement
    join public.rooster_care_plans other_plan on other_plan.id=requirement.care_plan_id
    where requirement.product_id=v_item.product_id and requirement.care_plan_id<>v_plan.id
      and requirement.purchase_fulfilled_at is null
      and (
        other_plan.status in ('payment_submitted','paid_pending_setup','ready','active','paused')
        or (other_plan.status='payment_for_review' and other_plan.quote_expires_at>=now())
      );
    if coalesce(v_feed_product.stock_quantity,0)-v_other_purchase_units<v_purchase_units then
      raise exception 'CARE_PLAN_FEED_STOCK_INSUFFICIENT_FOR_QUOTE';
    end if;
  end if;
  v_supply_price:=round(v_purchase_units*coalesce(v_item.unit_price,0),2);
  v_total:=round(p_labor_price+v_supply_price+p_service_fee,2);

  update public.rooster_care_plans set
    assigned_caretaker_id=p_caretaker_id,start_day_number=requested_start_day,
    feed_required_kg=v_required_kg,feed_inventory_item_id=p_feed_inventory_item_id,
    labor_price=round(p_labor_price,2),supply_price=v_supply_price,service_fee=round(p_service_fee,2),
    quote_note=nullif(trim(coalesce(p_quote_note,'')),''),quoted_at=now(),quote_expires_at=now()+interval '24 hours',quoted_by_profile_id=v_admin_id,
    status='payment_for_review',updated_at=now()
  where id=v_plan.id;

  delete from public.care_plan_supply_requirements where care_plan_id=v_plan.id;
  insert into public.care_plan_supply_requirements(
    care_plan_id,inventory_item_id,product_id,product_name,unit,required_quantity,owned_quantity_snapshot,
    reserved_quantity,purchase_quantity,unit_price,requirement_source,inventory_unit_label,
    kg_per_inventory_unit,required_inventory_units,reserved_inventory_units,purchase_inventory_units,reservation_status
  ) values(
    v_plan.id,v_item.id,v_item.product_id,v_item.product_name,'kg',v_required_kg,
    round(coalesce(v_item.quantity,0)*p_kg_per_inventory_unit,3),
    round(v_reserved_units*p_kg_per_inventory_unit,3),round(v_purchase_units*p_kg_per_inventory_unit,3),
    coalesce(v_item.unit_price,0),'mission_catalog_feed_grams_max',coalesce(nullif(v_item.unit_label,''),'inventory unit'),
    p_kg_per_inventory_unit,v_required_units,v_reserved_units,v_purchase_units,'quoted'
  );

  insert into public.care_plan_events(care_plan_id,actor_profile_id,event_type,event_data) values(
    v_plan.id,v_admin_id,'quote_prepared_v2',jsonb_build_object(
      'package_total',v_total,'feed_required_kg',v_required_kg,'catalog_known_min_kg',v_known_min_kg,
      'kg_per_inventory_unit',p_kg_per_inventory_unit,'required_inventory_units',v_required_units,
      'owned_inventory_units_reserved',v_reserved_units,'other_plan_reserved_inventory_units',v_other_reserved_units,
      'inventory_units_to_purchase',v_purchase_units,
      'other_plan_farm_stock_reserved_units',v_other_purchase_units,
      'supply_price',v_supply_price,'unquantified_days',v_unquantified_days,
      'unquantified_day_feed_grams',p_unquantified_day_feed_grams
    ));
  insert into public.inbox_items(profile_id,category,title,body,created_at) values(
    v_plan.profile_id,'care','Care Plan Quote Ready',
    'Your verified package includes '||v_required_kg::text||' kg of planned feed, daily caretaker missions, and a locked total of PHP '||v_total::text||'. Open Care Plans to review and pay.',now());
  return jsonb_build_object('id',v_plan.id,'status','payment_for_review','package_total',v_total,
    'feed_required_kg',v_required_kg,'catalog_known_min_kg',v_known_min_kg,
    'unquantified_days',v_unquantified_days,'unquantified_day_feed_grams',p_unquantified_day_feed_grams,
    'required_inventory_units',v_required_units,'reserved_inventory_units',v_reserved_units,
    'purchase_inventory_units',v_purchase_units,'supply_price',v_supply_price);
end; $$;

-- Payment approval atomically buys and reserves missing feed. If farm stock is
-- no longer sufficient, the payment approval transaction fails instead of
-- leaving a paid plan without its promised package.
create or replace function public.fulfill_care_plan_feed(p_care_plan_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare
  v_plan public.rooster_care_plans%rowtype;
  v_requirement public.care_plan_supply_requirements%rowtype;
  v_item public.customer_inventory_items%rowtype;
  v_product public.farm_products%rowtype;
  v_other_reserved_units numeric(16,3);
begin
  select * into v_plan from public.rooster_care_plans where id=p_care_plan_id for update;
  if not found then raise exception 'CARE_PLAN_NOT_FOUND'; end if;
  select * into v_requirement from public.care_plan_supply_requirements
    where care_plan_id=v_plan.id and unit='kg' for update;
  if not found or coalesce(v_requirement.kg_per_inventory_unit,0)<=0 then
    raise exception 'CARE_PLAN_SUPPLY_CONVERSION_MISSING';
  end if;
  select * into v_item from public.customer_inventory_items
    where id=v_requirement.inventory_item_id and profile_id=v_plan.profile_id for update;
  if not found then raise exception 'CARE_PLAN_INVENTORY_ITEM_MISSING'; end if;

  if v_requirement.purchase_inventory_units>0 and v_requirement.purchase_fulfilled_at is null then
    select * into v_product from public.farm_products where id::text=v_requirement.product_id for update;
    if not found then raise exception 'CARE_PLAN_FEED_PRODUCT_NOT_FOUND'; end if;
    if coalesce(v_product.stock_quantity,0)<v_requirement.purchase_inventory_units then
      raise exception 'CARE_PLAN_FEED_STOCK_INSUFFICIENT';
    end if;
    update public.farm_products set
      stock_quantity=stock_quantity-v_requirement.purchase_inventory_units,updated_at=now()
    where id=v_product.id;
    update public.customer_inventory_items set
      quantity=quantity+v_requirement.purchase_inventory_units,updated_at=now()
    where id=v_item.id;
    update public.care_plan_supply_requirements set
      owned_quantity_snapshot=owned_quantity_snapshot+(purchase_inventory_units*kg_per_inventory_unit),
      purchase_quantity=0,
      reserved_inventory_units=required_inventory_units,
      reserved_quantity=required_quantity,
      reservation_status='active',
      purchase_fulfilled_at=now(),
      updated_at=now()
    where id=v_requirement.id;
  else
    select coalesce(sum(requirement.reserved_inventory_units),0) into v_other_reserved_units
    from public.care_plan_supply_requirements requirement
    join public.rooster_care_plans other_plan on other_plan.id=requirement.care_plan_id
    where requirement.inventory_item_id=v_item.id and requirement.care_plan_id<>v_plan.id
      and requirement.reservation_status='active'
      and other_plan.status in ('paid_pending_setup','ready','active','paused');
    if v_item.quantity-v_other_reserved_units<v_requirement.required_inventory_units then
      raise exception 'CARE_PLAN_SUPPLIES_INCOMPLETE';
    end if;
    update public.care_plan_supply_requirements set
      reserved_inventory_units=required_inventory_units,
      reserved_quantity=required_quantity,reservation_status='active',updated_at=now()
    where id=v_requirement.id;
  end if;
end; $$;

-- Bind every Care Plan payment to the owner, exact locked quote, and one plan.
create or replace function public.sync_manual_payment_care_plan()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_plan public.rooster_care_plans%rowtype; v_plan_id uuid;
begin
  if new.source_type<>'care_plan' then return new; end if;
  begin v_plan_id:=new.source_ref::uuid; exception when others then raise exception 'INVALID_CARE_PLAN_REFERENCE'; end;
  select * into v_plan from public.rooster_care_plans where id=v_plan_id for update;
  if not found then raise exception 'CARE_PLAN_NOT_FOUND'; end if;
  if tg_op='INSERT' and new.status='for_review'
     and (v_plan.quote_expires_at is null or v_plan.quote_expires_at<now()) then
    raise exception 'CARE_PLAN_QUOTE_EXPIRED_REQUOTE_REQUIRED';
  end if;
  if new.profile_id<>v_plan.profile_id then raise exception 'CARE_PLAN_PAYMENT_OWNER_MISMATCH'; end if;
  if round(coalesce(new.amount_expected,0),2)<>round(coalesce(v_plan.package_total,0),2) or v_plan.package_total<=0 then
    raise exception 'CARE_PLAN_PAYMENT_AMOUNT_MISMATCH';
  end if;
  if tg_op='INSERT' and v_plan.status<>'payment_for_review' then raise exception 'CARE_PLAN_NOT_AWAITING_PAYMENT'; end if;
  if new.status='approved' and v_plan.status in ('payment_for_review','payment_submitted') then
    perform public.fulfill_care_plan_feed(v_plan.id);
  end if;
  update public.rooster_care_plans set payment_request_id=new.id,
    status=case
      when new.status='approved' and v_plan.status in ('payment_for_review','payment_submitted') then 'paid_pending_setup'
      when new.status='needs_info' and v_plan.status in ('payment_for_review','payment_submitted') then 'payment_submitted'
      when new.status='rejected' and v_plan.status in ('payment_for_review','payment_submitted') then 'payment_for_review'
      when new.status='for_review' and v_plan.status='payment_for_review' then 'payment_submitted'
      else v_plan.status end,
    updated_at=now() where id=v_plan.id;
  return new;
end; $$;

-- A paid plan buys only the missing feed units, then reserves the complete package.
create or replace function public.admin_activate_care_plan(
  p_care_plan_id uuid,p_start_date date default ((now() at time zone 'Asia/Manila')::date+1)
) returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_admin_id uuid;
  v_plan public.rooster_care_plans%rowtype;
  v_requirement public.care_plan_supply_requirements%rowtype;
  v_catalog_count integer;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  select id into v_admin_id from public.profiles where auth_user_id=auth.uid() limit 1;
  select * into v_plan from public.rooster_care_plans where id=p_care_plan_id for update;
  if not found then raise exception 'CARE_PLAN_NOT_FOUND'; end if;
  if v_plan.status='active' then return jsonb_build_object('id',v_plan.id,'duplicate',true,'status','active'); end if;
  if v_plan.status<>'paid_pending_setup' then raise exception 'CARE_PLAN_PAYMENT_NOT_APPROVED'; end if;
  if not exists(select 1 from public.manual_payment_requests where id=v_plan.payment_request_id and source_type='care_plan'
    and source_ref=v_plan.id::text and profile_id=v_plan.profile_id and status='approved'
    and round(amount_expected,2)=round(v_plan.package_total,2)) then raise exception 'APPROVED_EXACT_PAYMENT_REQUIRED'; end if;
  if p_start_date<(now() at time zone 'Asia/Manila')::date+1 then raise exception 'CARE_PLAN_START_MUST_BE_FUTURE'; end if;
  if v_plan.assigned_caretaker_id is null or not exists(select 1 from public.caretakers where id=v_plan.assigned_caretaker_id and coalesce(status,'active') in ('active','approved','on_duty')) then
    raise exception 'ACTIVE_CARETAKER_REQUIRED';
  end if;
  select count(*) into v_catalog_count from public.care_mission_templates where catalog_version=v_plan.catalog_version
    and day_number between v_plan.start_day_number and v_plan.start_day_number+v_plan.duration_days-1;
  if v_catalog_count<>v_plan.duration_days then raise exception 'MISSION_CATALOG_RANGE_INCOMPLETE'; end if;
  select * into v_requirement from public.care_plan_supply_requirements where care_plan_id=v_plan.id and unit='kg' for update;
  if not found or coalesce(v_requirement.kg_per_inventory_unit,0)<=0 then raise exception 'CARE_PLAN_SUPPLY_CONVERSION_MISSING'; end if;

  perform public.fulfill_care_plan_feed(v_plan.id);
  select * into v_requirement from public.care_plan_supply_requirements where care_plan_id=v_plan.id and unit='kg' for update;
  if v_requirement.reservation_status<>'active'
     or v_requirement.reserved_inventory_units<v_requirement.required_inventory_units then
    raise exception 'CARE_PLAN_SUPPLIES_INCOMPLETE';
  end if;

  update public.care_plan_supply_requirements set
    reserved_inventory_units=required_inventory_units,
    reserved_quantity=required_quantity,reservation_status='active',updated_at=now()
  where id=v_requirement.id;
  update public.rooster_care_plans set start_date=p_start_date,end_date=p_start_date+(duration_days-1),status='active',
    schedule_shift_days=0,activated_at=now(),paused_at=null,pause_note=null,updated_at=now() where id=v_plan.id;
  insert into public.care_plan_events(care_plan_id,actor_profile_id,event_type,event_data) values(
    v_plan.id,v_admin_id,'plan_activated',jsonb_build_object('start_date',p_start_date,
      'end_date',p_start_date+(v_plan.duration_days-1),'reserved_inventory_units',v_requirement.required_inventory_units));
  insert into public.inbox_items(profile_id,category,title,body,created_at) values(
    v_plan.profile_id,'care','Care Plan Activated','Your paid Care Plan is active. Daily work continues even when you do not open the app.',now());
  return jsonb_build_object('id',v_plan.id,'duplicate',false,'status','active','start_date',p_start_date,
    'end_date',p_start_date+(v_plan.duration_days-1));
end; $$;

-- Generate every ungenerated paid day through the requested run date. This is
-- intentionally idempotent, and turns recovered older days into overdue tasks.
create or replace function public.generate_due_care_plan_missions(
  p_run_date date default (now() at time zone 'Asia/Manila')::date
) returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_plan record;
  v_date date;
  v_plan_day integer;
  v_template public.care_mission_templates%rowtype;
  v_mission_id uuid;
  v_task_id uuid;
  v_created integer:=0;
  v_overdue integer:=0;
begin
  if auth.uid() is not null and not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if p_run_date>(now() at time zone 'Asia/Manila')::date then raise exception 'FUTURE_MISSION_RUN_NOT_ALLOWED'; end if;
  update public.rooster_daily_missions set status='overdue',updated_at=now()
    where mission_date<p_run_date and status in ('scheduled','active');

  for v_plan in
    select plan.*,animal.animal_name,animal.animal_code,
      identity.id as qr_identity_id,identity.qr_payload
    from public.rooster_care_plans plan
    join public.customer_animals animal on animal.id=plan.customer_animal_id
    left join public.animal_qr_identities identity on identity.customer_animal_id=animal.id
    where plan.status='active' and plan.start_date<=least(p_run_date,plan.end_date)
  loop
    for v_plan_day in 1..v_plan.duration_days
    loop
      v_date:=v_plan.start_date+(v_plan_day-1)+coalesce(v_plan.schedule_shift_days,0);
      exit when v_date>least(p_run_date,v_plan.end_date);
      select * into v_template from public.care_mission_templates
      where catalog_version=v_plan.catalog_version
        and day_number=v_plan.start_day_number+v_plan_day-1;
      if not found then raise exception 'MISSION_TEMPLATE_MISSING_FOR_DATE: %',v_date; end if;
      v_mission_id:=null;
      insert into public.rooster_daily_missions(
        care_plan_id,mission_template_id,profile_id,customer_animal_id,caretaker_id,plan_day,catalog_day,mission_date,status
      ) values(
        v_plan.id,v_template.id,v_plan.profile_id,v_plan.customer_animal_id,v_plan.assigned_caretaker_id,
        v_plan_day,v_template.day_number,v_date,
        case when v_date<p_run_date then 'overdue' else 'active' end
      ) on conflict(care_plan_id,mission_date) do nothing returning id into v_mission_id;
      if v_mission_id is null then continue; end if;

      insert into public.caretaker_tasks(
        care_plan_id,daily_mission_id,mission_day_number,mission_date,profile_id,caretaker_id,assigned_by_profile_id,
        animal_id,rooster_name,rooster_tag,task_type,required_proof,status,priority,due_at,workflow_type,
        qr_scan_required,qr_identity_id,qr_payload,task_metadata
      ) values(
        v_plan.id,v_mission_id,v_template.day_number,v_date,v_plan.profile_id,v_plan.assigned_caretaker_id,null,
        null,v_plan.animal_name,v_plan.animal_code,'Day '||v_template.day_number||': '||v_template.primary_mission,
        'Complete required checklist, time-stamped evidence, health status, and actual inventory usage.',
        case when v_date<p_run_date then 'backjob' else 'active' end,
        case when v_date<p_run_date then 'urgent' else 'normal' end,
        (v_date::timestamp+time '17:15') at time zone 'Asia/Manila','care_plan_daily_mission',
        v_plan.qr_payload is not null,v_plan.qr_identity_id,v_plan.qr_payload,
        jsonb_build_object('catalog_day',v_template.day_number,'life_stage',v_template.life_stage,
          'primary_mission',v_template.primary_mission,'time_schedule',v_template.time_schedule,
          'needed_today',v_template.needed_today,'feeding_standard',v_template.feeding_standard,
          'supplement_checklist',v_template.supplement_checklist,'vaccine_checklist',v_template.vaccine_checklist,
          'operations_checklist',v_template.operations_checklist,'housing_checklist',v_template.housing_checklist,
          'health_checklist',v_template.health_checklist,'evidence_requirements',v_template.evidence_requirements,
          'emergency_stop_rule',v_template.emergency_stop_rule,'completion_gate',v_template.completion_gate,
          'feed_grams_min',v_template.feed_grams_min,'feed_grams_max',v_template.feed_grams_max,
          'recovered_overdue',v_date<p_run_date)
      ) returning id into v_task_id;
      update public.rooster_daily_missions set caretaker_task_id=v_task_id where id=v_mission_id;
      insert into public.care_plan_events(care_plan_id,daily_mission_id,event_type,event_data)
        values(v_plan.id,v_mission_id,case when v_date<p_run_date then 'overdue_mission_recovered' else 'mission_generated' end,
          jsonb_build_object('mission_date',v_date,'task_id',v_task_id));
      v_created:=v_created+1;
      if v_date<p_run_date then v_overdue:=v_overdue+1; end if;
    end loop;
  end loop;
  return jsonb_build_object('run_date',p_run_date,'created',v_created,'recovered_overdue',v_overdue,'timezone','Asia/Manila');
end; $$;

-- Only the plan-reserved feed is offered to its assigned caretaker.
create or replace function public.caretaker_get_task_inventory(p_task_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_profile_id uuid; v_task public.caretaker_tasks%rowtype; v_result jsonb;
begin
  select id into v_profile_id from public.profiles where auth_user_id=auth.uid() limit 1;
  if v_profile_id is null then raise exception 'LOGIN_REQUIRED'; end if;
  select task.* into v_task from public.caretaker_tasks task
    join public.caretakers caretaker on caretaker.id=task.caretaker_id
  where task.id=p_task_id and task.workflow_type='care_plan_daily_mission'
    and task.status in ('active','in_progress','backjob')
    and (caretaker.profile_id=v_profile_id or caretaker.caretaker_profile_id=v_profile_id);
  if not found then raise exception 'TASK_NOT_ASSIGNED_TO_CURRENT_CARETAKER'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',item.id,'product_name',item.product_name,'category',item.category,
    'unit_label',requirement.inventory_unit_label,'quantity',item.quantity,
    'product_type',item.product_type,'kg_per_inventory_unit',requirement.kg_per_inventory_unit,
    'reserved_inventory_units',requirement.reserved_inventory_units,
    'reserved_kg',round(requirement.reserved_inventory_units*requirement.kg_per_inventory_unit,3)
  )),'[]'::jsonb) into v_result
  from public.care_plan_supply_requirements requirement
  join public.customer_inventory_items item on item.id=requirement.inventory_item_id
  where requirement.care_plan_id=v_task.care_plan_id and requirement.reservation_status='active'
    and requirement.reserved_inventory_units>0;
  return v_result;
end; $$;

-- Replace the prior proof review with exact kg -> inventory-unit conversion.
create or replace function public.admin_review_mission_proof_guarded(
  p_proof_id uuid,p_decision text,p_admin_note text default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_admin_id uuid;
  v_proof public.task_proofs%rowtype;
  v_mission public.rooster_daily_missions%rowtype;
  v_plan public.rooster_care_plans%rowtype;
  v_usage jsonb;
  v_item public.customer_inventory_items%rowtype;
  v_requirement public.care_plan_supply_requirements%rowtype;
  v_used_kg numeric(16,3);
  v_units numeric(16,3);
  v_result jsonb;
  v_approved_count integer;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if p_decision='rejected' then raise exception 'MISSION_REJECT_USE_BACKJOB_OR_CANCEL_PLAN'; end if;
  if p_decision not in ('approved','backjob') then raise exception 'INVALID_DECISION'; end if;
  if p_decision<>'approved' and nullif(trim(coalesce(p_admin_note,'')),'') is null then raise exception 'ADMIN_NOTE_REQUIRED'; end if;
  select id into v_admin_id from public.profiles where auth_user_id=auth.uid() limit 1;
  select * into v_proof from public.task_proofs where id=p_proof_id for update;
  if not found then raise exception 'PROOF_NOT_FOUND'; end if;
  if v_proof.admin_review_status=p_decision then return jsonb_build_object('id',p_proof_id,'duplicate',true,'status',p_decision); end if;
  if v_proof.admin_review_status<>'pending' then raise exception 'PROOF_ALREADY_REVIEWED'; end if;
  if v_proof.daily_mission_id is null then raise exception 'MISSION_PROOF_REQUIRED'; end if;
  select * into v_mission from public.rooster_daily_missions where id=v_proof.daily_mission_id for update;
  select * into v_plan from public.rooster_care_plans where id=v_mission.care_plan_id for update;
  if not found then raise exception 'CARE_PLAN_NOT_FOUND'; end if;
  if p_decision='approved' and coalesce(v_proof.health_status,'')<>'pass' then raise exception 'HEALTH_ESCALATION_CANNOT_BE_APPROVED'; end if;

  perform public.admin_review_task_proof(p_proof_id,p_decision,p_admin_note);

  if p_decision='approved' then
    for v_usage in select value from jsonb_array_elements(coalesce(v_proof.inventory_usage,'[]'::jsonb)) loop
      v_used_kg:=round((v_usage->>'quantity')::numeric,3);
      if v_used_kg<=0 or coalesce(v_usage->>'unit','')<>'kg' then raise exception 'MISSION_USAGE_MUST_BE_POSITIVE_KG'; end if;
      select * into v_requirement from public.care_plan_supply_requirements
        where care_plan_id=v_plan.id and inventory_item_id=(v_usage->>'inventory_item_id')::uuid
          and reservation_status='active' for update;
      if not found or coalesce(v_requirement.kg_per_inventory_unit,0)<=0 then raise exception 'MISSION_ITEM_NOT_RESERVED_FOR_PLAN'; end if;
      v_units:=ceil((v_used_kg/v_requirement.kg_per_inventory_unit)*1000)/1000;
      if v_requirement.reserved_inventory_units<v_units then raise exception 'CARE_PLAN_RESERVED_FEED_INSUFFICIENT'; end if;
      select * into v_item from public.customer_inventory_items
        where id=v_requirement.inventory_item_id and profile_id=v_plan.profile_id for update;
      if not found or v_item.quantity<v_units then raise exception 'CUSTOMER_INVENTORY_INSUFFICIENT'; end if;

      insert into public.care_plan_inventory_usage(
        care_plan_id,daily_mission_id,task_proof_id,inventory_item_id,profile_id,product_name,
        quantity_used,unit,quantity_before,quantity_after,approved_by_profile_id,
        used_base_kg,inventory_unit_label,kg_per_inventory_unit
      ) values(
        v_plan.id,v_mission.id,p_proof_id,v_item.id,v_plan.profile_id,v_item.product_name,
        v_units,coalesce(v_requirement.inventory_unit_label,'inventory unit'),v_item.quantity,v_item.quantity-v_units,v_admin_id,
        v_used_kg,v_requirement.inventory_unit_label,v_requirement.kg_per_inventory_unit
      ) on conflict(task_proof_id,inventory_item_id) do nothing;
      if found then
        update public.customer_inventory_items set quantity=quantity-v_units,updated_at=now() where id=v_item.id;
        update public.care_plan_supply_requirements set
          reserved_inventory_units=reserved_inventory_units-v_units,
          reserved_quantity=greatest(0,reserved_quantity-v_used_kg),
          reservation_status=case when reserved_inventory_units-v_units<=0 then 'consumed' else reservation_status end,
          updated_at=now() where id=v_requirement.id;
        insert into public.inbox_items(profile_id,category,title,body,created_at) values(
          v_plan.profile_id,'care','Care Plan Inventory Updated',v_item.product_name||': '||
          v_item.quantity::text||' - '||v_units::text||' '||coalesce(v_requirement.inventory_unit_label,'unit')||
          ' = '||(v_item.quantity-v_units)::text||'. Actual mission use: '||v_used_kg::text||' kg.',now());
      end if;
    end loop;
  end if;

  update public.rooster_daily_missions set status=case when p_decision='approved' then 'approved'
      when p_decision='backjob' then 'backjob' else 'cancelled' end,
    reviewed_at=now(),approved_at=case when p_decision='approved' then now() else null end,updated_at=now()
  where id=v_mission.id;
  insert into public.care_plan_events(care_plan_id,daily_mission_id,actor_profile_id,event_type,event_data)
    values(v_plan.id,v_mission.id,v_admin_id,'mission_'||p_decision,
      jsonb_build_object('proof_id',p_proof_id,'admin_note',p_admin_note));

  if p_decision='approved' then
    select count(*) into v_approved_count from public.rooster_daily_missions where care_plan_id=v_plan.id and status='approved';
    if v_approved_count>=v_plan.duration_days then
      update public.rooster_care_plans set status='completed',completed_at=now(),updated_at=now() where id=v_plan.id;
      update public.care_plan_supply_requirements set reserved_inventory_units=0,reserved_quantity=0,
        reservation_status='released',updated_at=now() where care_plan_id=v_plan.id and reservation_status='active';
      insert into public.care_plan_events(care_plan_id,actor_profile_id,event_type,event_data)
        values(v_plan.id,v_admin_id,'plan_completed',jsonb_build_object('approved_missions',v_approved_count));
      insert into public.inbox_items(profile_id,category,title,body,created_at) values(
        v_plan.profile_id,'care','Care Plan Completed','All required daily missions were reviewed and approved. Any unused feed remains in your inventory.',now());
    end if;
  end if;
  v_result:=jsonb_build_object('id',p_proof_id,'duplicate',false,'status',p_decision,'mission_id',v_mission.id);
  return v_result;
end; $$;

create or replace function public.customer_cancel_care_plan(p_care_plan_id uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_profile_id uuid; v_plan public.rooster_care_plans%rowtype;
begin
  select id into v_profile_id from public.profiles where auth_user_id=auth.uid() limit 1;
  select * into v_plan from public.rooster_care_plans where id=p_care_plan_id and profile_id=v_profile_id for update;
  if not found then raise exception 'CARE_PLAN_NOT_FOUND'; end if;
  if v_plan.status not in ('draft','payment_for_review') then raise exception 'ADMIN_CANCELLATION_REQUIRED_AFTER_PAYMENT'; end if;
  if exists(select 1 from public.manual_payment_requests where source_type='care_plan' and source_ref=v_plan.id::text and status in ('for_review','needs_info','approved')) then
    raise exception 'PAYMENT_REVIEW_MUST_FINISH_BEFORE_CANCELLATION';
  end if;
  update public.rooster_care_plans set status='cancelled',cancellation_note=nullif(trim(p_reason),''),
    cancelled_at=now(),cancelled_by_profile_id=v_profile_id,updated_at=now() where id=v_plan.id;
  update public.care_plan_supply_requirements set reservation_status='released',reserved_inventory_units=0,reserved_quantity=0,updated_at=now()
    where care_plan_id=v_plan.id;
  insert into public.care_plan_events(care_plan_id,actor_profile_id,event_type,event_data)
    values(v_plan.id,v_profile_id,'plan_cancelled_by_customer',jsonb_build_object('reason',p_reason));
  return jsonb_build_object('id',v_plan.id,'status','cancelled','refund_due_amount',0);
end; $$;

create or replace function public.admin_control_care_plan(
  p_care_plan_id uuid,p_action text,p_note text,p_new_caretaker_id uuid default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_admin_id uuid; v_plan public.rooster_care_plans%rowtype; v_remaining integer; v_approved integer:=0; v_paused_days integer:=0; v_refund numeric(14,2):=0;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if p_action not in ('pause','resume','reassign','cancel') then raise exception 'INVALID_CARE_PLAN_ACTION'; end if;
  if nullif(trim(coalesce(p_note,'')),'') is null then raise exception 'CARE_PLAN_ACTION_NOTE_REQUIRED'; end if;
  select id into v_admin_id from public.profiles where auth_user_id=auth.uid() limit 1;
  select * into v_plan from public.rooster_care_plans where id=p_care_plan_id for update;
  if not found then raise exception 'CARE_PLAN_NOT_FOUND'; end if;

  if p_action='pause' then
    if v_plan.status<>'active' then raise exception 'ONLY_ACTIVE_PLAN_CAN_PAUSE'; end if;
    update public.rooster_care_plans set status='paused',paused_at=now(),pause_note=p_note,updated_at=now() where id=v_plan.id;
  elsif p_action='resume' then
    if v_plan.status<>'paused' then raise exception 'ONLY_PAUSED_PLAN_CAN_RESUME'; end if;
    v_paused_days:=greatest(0,(now() at time zone 'Asia/Manila')::date-(v_plan.paused_at at time zone 'Asia/Manila')::date);
    update public.rooster_care_plans set status='active',end_date=end_date+v_paused_days,
      schedule_shift_days=schedule_shift_days+v_paused_days,
      paused_at=null,pause_note=null,updated_at=now() where id=v_plan.id;
  elsif p_action='reassign' then
    if v_plan.status not in ('active','paused','paid_pending_setup') then raise exception 'CARE_PLAN_NOT_REASSIGNABLE'; end if;
    if not exists(select 1 from public.caretakers where id=p_new_caretaker_id and coalesce(status,'active') in ('active','approved','on_duty')) then
      raise exception 'ACTIVE_CARETAKER_REQUIRED';
    end if;
    update public.rooster_care_plans set assigned_caretaker_id=p_new_caretaker_id,updated_at=now() where id=v_plan.id;
    update public.rooster_daily_missions set caretaker_id=p_new_caretaker_id,updated_at=now()
      where care_plan_id=v_plan.id and status in ('scheduled','active','overdue','backjob');
    update public.caretaker_tasks set caretaker_id=p_new_caretaker_id,updated_at=now()
      where care_plan_id=v_plan.id and status in ('active','in_progress','backjob');
  else
    if v_plan.status in ('completed','cancelled','expired') then raise exception 'CARE_PLAN_ALREADY_CLOSED'; end if;
    select count(*) into v_approved from public.rooster_daily_missions where care_plan_id=v_plan.id and status='approved';
    v_remaining:=greatest(0,v_plan.duration_days-v_approved);
    v_refund:=case when v_plan.payment_request_id is null then 0 else
      round((v_plan.labor_price+v_plan.service_fee)*(v_remaining::numeric/v_plan.duration_days),2) end;
    update public.rooster_care_plans set status='cancelled',cancellation_note=p_note,cancelled_at=now(),
      cancelled_by_profile_id=v_admin_id,refund_due_amount=v_refund,
      refund_status=case when v_refund>0 then 'pending' else 'not_required' end,updated_at=now() where id=v_plan.id;
    update public.rooster_daily_missions set status='cancelled',updated_at=now()
      where care_plan_id=v_plan.id and status in ('scheduled','active','overdue','backjob');
    update public.caretaker_tasks set status='cancelled',updated_at=now()
      where care_plan_id=v_plan.id and status in ('active','in_progress','backjob');
    update public.care_plan_supply_requirements set reservation_status='released',reserved_inventory_units=0,reserved_quantity=0,updated_at=now()
      where care_plan_id=v_plan.id and reservation_status='active';
  end if;
  insert into public.care_plan_events(care_plan_id,actor_profile_id,event_type,event_data)
    values(v_plan.id,v_admin_id,'plan_'||p_action,jsonb_build_object('note',p_note,'new_caretaker_id',p_new_caretaker_id,'refund_due_amount',v_refund,'paused_days_added',v_paused_days));
  insert into public.inbox_items(profile_id,category,title,body,created_at) values(
    v_plan.profile_id,'care','Care Plan '||initcap(p_action),
    'Admin recorded this Care Plan action: '||p_action||'. '||p_note||case when v_refund>0 then ' Refund due: PHP '||v_refund::text||'.' else '' end,now());
  return jsonb_build_object('id',v_plan.id,'action',p_action,'refund_due_amount',v_refund);
end; $$;

create or replace function public.admin_record_care_plan_refund(
  p_care_plan_id uuid,p_reference text,p_note text default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_admin_id uuid; v_plan public.rooster_care_plans%rowtype;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if nullif(trim(coalesce(p_reference,'')),'') is null then raise exception 'REFUND_REFERENCE_REQUIRED'; end if;
  select id into v_admin_id from public.profiles where auth_user_id=auth.uid() limit 1;
  select * into v_plan from public.rooster_care_plans where id=p_care_plan_id for update;
  if not found or v_plan.refund_status<>'pending' or v_plan.refund_due_amount<=0 then raise exception 'NO_PENDING_CARE_PLAN_REFUND'; end if;
  update public.rooster_care_plans set refund_status='completed',refund_reference=trim(p_reference),refunded_at=now(),updated_at=now()
    where id=v_plan.id;
  insert into public.care_plan_events(care_plan_id,actor_profile_id,event_type,event_data)
    values(v_plan.id,v_admin_id,'refund_completed',jsonb_build_object('amount',v_plan.refund_due_amount,'reference',trim(p_reference),'note',p_note));
  insert into public.inbox_items(profile_id,category,title,body,created_at) values(
    v_plan.profile_id,'receipt','Care Plan Refund Completed','Refund PHP '||v_plan.refund_due_amount::text||
    ' was recorded. Reference: '||trim(p_reference)||'.',now());
  return jsonb_build_object('id',v_plan.id,'refund_status','completed','amount',v_plan.refund_due_amount,'reference',trim(p_reference));
end; $$;

-- A read-only readiness snapshot for KaFarm and deployment verification.
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
    'generated_at',now()
  ) into v_result;
  return v_result;
end; $$;

revoke all on function public.admin_prepare_care_plan_quote(uuid,uuid,uuid,numeric,numeric,numeric,numeric,text) from public,anon,authenticated;
revoke all on function public.admin_prepare_care_plan_quote_v2(uuid,uuid,uuid,text,numeric,numeric,numeric,numeric,text) from public,anon;
revoke all on function public.customer_cancel_care_plan(uuid,text) from public,anon;
revoke all on function public.admin_control_care_plan(uuid,text,text,uuid) from public,anon;
revoke all on function public.admin_record_care_plan_refund(uuid,text,text) from public,anon;
revoke all on function public.kafarm_care_plan_health_snapshot() from public,anon;
revoke all on function public.sync_manual_payment_care_plan() from public,anon,authenticated;
revoke all on function public.fulfill_care_plan_feed(uuid) from public,anon,authenticated;
grant execute on function public.admin_prepare_care_plan_quote_v2(uuid,uuid,uuid,text,numeric,numeric,numeric,numeric,text) to authenticated;
grant execute on function public.customer_cancel_care_plan(uuid,text) to authenticated;
grant execute on function public.admin_control_care_plan(uuid,text,text,uuid) to authenticated;
grant execute on function public.admin_record_care_plan_refund(uuid,text,text) to authenticated;
grant execute on function public.kafarm_care_plan_health_snapshot() to authenticated;

commit;

select jsonb_build_object(
  'migration','062_care_plan_production_lifecycle',
  'quote_v2',to_regprocedure('public.admin_prepare_care_plan_quote_v2(uuid,uuid,uuid,text,numeric,numeric,numeric,numeric,text)') is not null,
  'feed_fulfillment',to_regprocedure('public.fulfill_care_plan_feed(uuid)') is not null,
  'cancel_rpc',to_regprocedure('public.customer_cancel_care_plan(uuid,text)') is not null,
  'control_rpc',to_regprocedure('public.admin_control_care_plan(uuid,text,text,uuid)') is not null,
  'refund_rpc',to_regprocedure('public.admin_record_care_plan_refund(uuid,text,text)') is not null,
  'health_rpc',to_regprocedure('public.kafarm_care_plan_health_snapshot()') is not null
) verification;
