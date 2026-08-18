-- Care Plan customer-owned feed balance and fixed 30-day pricing contract.
--
-- New requests must reserve enough feed already owned by the customer. The
-- required kilograms come from the exact 30-day slice of the 180-day mission
-- catalog. Farm stock is never purchased or credited by this preparation RPC.
-- The service total remains PHP 5,000 (PHP 166.67 average per covered day).

begin;

create or replace function public.customer_prepare_fixed_care_plan_payment(p_care_plan_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_profile_id uuid;
  v_plan public.rooster_care_plans%rowtype;
  v_inventory_item public.customer_inventory_items%rowtype;
  v_inventory_item_id uuid;
  v_catalog_count integer;
  v_unquantified_days integer;
  v_required_kg numeric(16,3);
  v_kg_per_unit numeric(16,6);
  v_required_units numeric(16,3);
  v_other_plan_units numeric(16,3);
  v_other_manual_units numeric(16,3);
  v_available_units numeric(16,3);
  v_available_kg numeric(16,3);
begin
  select id into v_profile_id
  from public.profiles
  where auth_user_id=auth.uid()
  limit 1;
  if v_profile_id is null then raise exception 'LOGIN_REQUIRED'; end if;

  select * into v_plan
  from public.rooster_care_plans
  where id=p_care_plan_id and profile_id=v_profile_id
  for update;
  if not found then raise exception 'CARE_PLAN_NOT_FOUND'; end if;
  if v_plan.duration_days<>30 then raise exception 'FIXED_PACKAGE_REQUIRES_30_DAYS'; end if;

  if v_plan.status in ('payment_submitted','paid_pending_setup','ready','active','paused')
     or (
       v_plan.status='payment_for_review'
       and v_plan.quote_expires_at>=now()
       and v_plan.feed_inventory_item_id is not null
       and exists(
         select 1 from public.care_plan_supply_requirements requirement
         where requirement.care_plan_id=v_plan.id
           and requirement.inventory_item_id=v_plan.feed_inventory_item_id
           and requirement.reservation_status in ('quoted','active')
           and requirement.required_inventory_units>0
       )
     ) then
    return jsonb_build_object(
      'id',v_plan.id,'duplicate',true,'status',v_plan.status,
      'package_total',v_plan.package_total,'daily_service_rate',round(v_plan.package_total/30,2),
      'feed_required_kg',v_plan.feed_required_kg,'average_daily_feed_kg',round(v_plan.feed_required_kg/30,3),
      'feed_inventory_item_id',v_plan.feed_inventory_item_id,
      'feed_product_name',(select item.product_name from public.customer_inventory_items item where item.id=v_plan.feed_inventory_item_id),
      'duration_days',v_plan.duration_days,'requested_start_day',v_plan.requested_start_day
    );
  end if;
  if v_plan.status not in ('draft','payment_for_review') then raise exception 'CARE_PLAN_NOT_PAYABLE'; end if;
  if exists(
    select 1 from public.manual_payment_requests
    where source_type='care_plan' and source_ref=v_plan.id::text
      and status in ('for_review','needs_info','approved')
  ) then raise exception 'CARE_PLAN_PAYMENT_ALREADY_SUBMITTED'; end if;

  select count(*),count(*) filter(where feed_grams_max is null),
    round(sum(feed_grams_max)/1000,3)
  into v_catalog_count,v_unquantified_days,v_required_kg
  from public.care_mission_templates
  where catalog_version=v_plan.catalog_version
    and day_number between v_plan.requested_start_day and v_plan.requested_start_day+29;
  if v_catalog_count<>30 then raise exception 'MISSION_CATALOG_RANGE_INCOMPLETE'; end if;
  if v_unquantified_days<>0 then raise exception 'MISSION_CATALOG_FEED_QUANTITY_INCOMPLETE|days=%',v_unquantified_days; end if;
  if coalesce(v_required_kg,0)<=0 then raise exception 'MISSION_CATALOG_FEED_TOTAL_MISSING'; end if;

  -- Serialize reservations for one customer so two Care Plans cannot reserve
  -- the same inventory balance at the same time.
  perform pg_advisory_xact_lock(hashtextextended('farmconnect-care-plan-owned-feed:'||v_profile_id::text,0));

  select item.id
  into v_inventory_item_id
  from public.customer_inventory_items item
  cross join lateral (
    select case
      when coalesce(item.inventory_metadata->>'kg_per_inventory_unit','') ~ '^[0-9]+([.][0-9]+)?$'
        then (item.inventory_metadata->>'kg_per_inventory_unit')::numeric
      when substring(lower(coalesce(item.unit_label,'')) from '([0-9]+([.][0-9]+)?) *kg') is not null
        then substring(lower(item.unit_label) from '([0-9]+([.][0-9]+)?) *kg')::numeric
      when lower(coalesce(item.unit_label,'')) like '%kg%'
        or lower(coalesce(item.unit_label,'')) like '%kilo%' then 1::numeric
      else null::numeric
    end as kg_per_unit
  ) conversion
  where item.profile_id=v_profile_id
    and coalesce(item.quantity,0)>0
    and (lower(coalesce(item.product_type,''))='feed' or item.category ilike '%feed%')
    and coalesce(conversion.kg_per_unit,0)>0
    and coalesce(item.quantity,0)
      - coalesce((
          select sum(reservation.reserved_quantity)
          from public.manual_care_inventory_reservations reservation
          where reservation.inventory_item_id=item.id
            and reservation.status='active'
            and (reservation.expires_at is null or reservation.expires_at>=now())
        ),0)
      - coalesce((
          select sum(requirement.reserved_inventory_units)
          from public.care_plan_supply_requirements requirement
          join public.rooster_care_plans other_plan on other_plan.id=requirement.care_plan_id
          where requirement.inventory_item_id=item.id
            and requirement.care_plan_id<>v_plan.id
            and requirement.reservation_status in ('quoted','active')
            and (
              other_plan.status in ('payment_submitted','paid_pending_setup','ready','active','paused')
              or (other_plan.status='payment_for_review' and other_plan.quote_expires_at>=now())
            )
        ),0)
      >=ceil((v_required_kg/conversion.kg_per_unit)*1000)/1000
  order by
    case
      when v_plan.requested_start_day<=42 and (item.product_name ilike '%starter%' or item.product_name ilike '%chick%') then 0
      when v_plan.requested_start_day between 43 and 90 and (item.product_name ilike '%grower%' or item.product_name ilike '%developer%') then 0
      when v_plan.requested_start_day>90 and (item.product_name ilike '%finisher%' or item.product_name ilike '%maintenance%') then 0
      else 1
    end,
    item.updated_at desc,
    item.id
  limit 1;

  if v_inventory_item_id is null then
    raise exception 'CARE_PLAN_CUSTOMER_FEED_BALANCE_INSUFFICIENT|required_kg=%',v_required_kg;
  end if;

  select * into v_inventory_item
  from public.customer_inventory_items
  where id=v_inventory_item_id and profile_id=v_profile_id
  for update;
  if not found then raise exception 'CARE_PLAN_CUSTOMER_FEED_BALANCE_INSUFFICIENT|required_kg=%',v_required_kg; end if;

  v_kg_per_unit:=case
    when coalesce(v_inventory_item.inventory_metadata->>'kg_per_inventory_unit','') ~ '^[0-9]+([.][0-9]+)?$'
      then (v_inventory_item.inventory_metadata->>'kg_per_inventory_unit')::numeric
    when substring(lower(coalesce(v_inventory_item.unit_label,'')) from '([0-9]+([.][0-9]+)?) *kg') is not null
      then substring(lower(v_inventory_item.unit_label) from '([0-9]+([.][0-9]+)?) *kg')::numeric
    when lower(coalesce(v_inventory_item.unit_label,'')) like '%kg%'
      or lower(coalesce(v_inventory_item.unit_label,'')) like '%kilo%' then 1::numeric
    else null::numeric
  end;
  if coalesce(v_kg_per_unit,0)<=0 then
    raise exception 'CARE_PLAN_CUSTOMER_FEED_CONVERSION_REQUIRED|item=%',v_inventory_item.product_name;
  end if;

  v_required_units:=ceil((v_required_kg/v_kg_per_unit)*1000)/1000;
  select coalesce(sum(reservation.reserved_quantity),0)
  into v_other_manual_units
  from public.manual_care_inventory_reservations reservation
  where reservation.inventory_item_id=v_inventory_item.id
    and reservation.status='active'
    and (reservation.expires_at is null or reservation.expires_at>=now());
  select coalesce(sum(requirement.reserved_inventory_units),0)
  into v_other_plan_units
  from public.care_plan_supply_requirements requirement
  join public.rooster_care_plans other_plan on other_plan.id=requirement.care_plan_id
  where requirement.inventory_item_id=v_inventory_item.id
    and requirement.care_plan_id<>v_plan.id
    and requirement.reservation_status in ('quoted','active')
    and (
      other_plan.status in ('payment_submitted','paid_pending_setup','ready','active','paused')
      or (other_plan.status='payment_for_review' and other_plan.quote_expires_at>=now())
    );
  v_available_units:=greatest(coalesce(v_inventory_item.quantity,0)-v_other_manual_units-v_other_plan_units,0);
  v_available_kg:=round(v_available_units*v_kg_per_unit,3);
  if v_available_units<v_required_units then
    raise exception 'CARE_PLAN_CUSTOMER_FEED_BALANCE_INSUFFICIENT|required_kg=%|available_kg=%|item=%',
      v_required_kg,v_available_kg,v_inventory_item.product_name;
  end if;

  delete from public.care_plan_supply_requirements where care_plan_id=v_plan.id;
  insert into public.care_plan_supply_requirements(
    care_plan_id,inventory_item_id,product_id,product_name,unit,required_quantity,
    owned_quantity_snapshot,reserved_quantity,purchase_quantity,unit_price,requirement_source,
    inventory_unit_label,kg_per_inventory_unit,required_inventory_units,
    reserved_inventory_units,purchase_inventory_units,reservation_status
  ) values(
    v_plan.id,v_inventory_item.id,v_inventory_item.product_id,v_inventory_item.product_name,'kg',v_required_kg,
    round(coalesce(v_inventory_item.quantity,0)*v_kg_per_unit,3),v_required_kg,0,
    coalesce(v_inventory_item.unit_price,0),'customer_owned_feed_180_day_catalog',
    coalesce(nullif(v_inventory_item.unit_label,''),'inventory unit'),v_kg_per_unit,
    v_required_units,v_required_units,0,'quoted'
  );

  delete from public.care_plan_package_items where care_plan_id=v_plan.id;
  insert into public.care_plan_package_items(
    care_plan_id,item_kind,product_id,linked_inventory_item_id,item_name,
    required_quantity,unit,stock_controlled,use_rule
  ) values
    (v_plan.id,'feed',v_inventory_item.product_id,v_inventory_item.id,v_inventory_item.product_name,
      v_required_kg,'kg',true,'Customer-owned feed reserved from the age-based 180-day mission standard; deduct only approved actual kg used.'),
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
    supply_price=0,
    service_fee=5000,
    package_total=5000,
    quote_note='PHP 5,000 for 30 days (PHP 166.67 average/day). Required feed is customer-owned, age-based, and reserved before payment; medicine and emergency treatment are separately authorized.',
    quoted_at=now(),
    quote_expires_at=now()+interval '24 hours',
    quoted_by_profile_id=null,
    status='payment_for_review',
    preparation_status='not_started',
    updated_at=now()
  where id=v_plan.id;

  insert into public.care_plan_events(care_plan_id,actor_profile_id,event_type,event_data)
  values(v_plan.id,v_profile_id,'customer_feed_balance_reserved',jsonb_build_object(
    'package_total',5000,'daily_service_rate',round(5000::numeric/30,2),
    'feed_required_kg',v_required_kg,'average_daily_feed_kg',round(v_required_kg/30,3),
    'feed_inventory_item_id',v_inventory_item.id,
    'feed_product_name',v_inventory_item.product_name,'required_inventory_units',v_required_units,
    'available_kg_before_reservation',v_available_kg,'unquantified_days',v_unquantified_days));
  insert into public.inbox_items(profile_id,category,title,body,created_at)
  values(v_plan.profile_id,'care','Care Plan Ready for Payment',
    'Your customer-owned feed passed the age-based 30-day balance check and is reserved. The Care Plan service is PHP 5,000 (PHP 166.67 average/day). Submit payment proof; after Admin approval it moves to Task Management.',now());

  return jsonb_build_object(
    'id',v_plan.id,'duplicate',false,'status','payment_for_review',
    'package_total',5000,'daily_service_rate',round(5000::numeric/30,2),
    'feed_required_kg',v_required_kg,'average_daily_feed_kg',round(v_required_kg/30,3),
    'feed_inventory_item_id',v_inventory_item.id,
    'feed_product_name',v_inventory_item.product_name,'available_feed_kg',v_available_kg,
    'duration_days',30,'requested_start_day',v_plan.requested_start_day
  );
end;
$$;

create or replace function public.customer_request_care_plan(
  p_customer_animal_id uuid,
  p_duration_days integer,
  p_requested_start_day integer default 1
) returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_profile_id uuid;
  v_plan_id uuid;
  v_animal public.customer_animals%rowtype;
  v_start_day integer;
begin
  select id into v_profile_id from public.profiles where auth_user_id=auth.uid() limit 1;
  if v_profile_id is null then raise exception 'LOGIN_REQUIRED'; end if;
  if p_duration_days<>30 then raise exception 'ONLY_30_DAY_FIXED_PACKAGE_AVAILABLE'; end if;

  select * into v_animal
  from public.customer_animals
  where id=p_customer_animal_id and profile_id=v_profile_id and status not in ('sold','cancelled')
  for update;
  if not found then raise exception 'ANIMAL_NOT_OWNED'; end if;

  -- The server derives the program day from the official ownership date. A
  -- customer-entered day cannot reduce the required feed reservation.
  v_start_day:=greatest(1,
    (now() at time zone 'Asia/Manila')::date
      - coalesce((v_animal.acquired_at at time zone 'Asia/Manila')::date,(now() at time zone 'Asia/Manila')::date)
      + 1
  );
  if v_start_day+29>180 then raise exception 'CARE_PLAN_CATALOG_WINDOW_EXHAUSTED|current_day=%',v_start_day; end if;

  if exists(
    select 1 from public.rooster_care_plans
    where customer_animal_id=p_customer_animal_id
      and status in ('draft','payment_for_review','payment_submitted','paid_pending_setup','ready','active','paused')
  ) then raise exception 'ROOSTER_ALREADY_HAS_OPEN_CARE_PLAN'; end if;

  insert into public.rooster_care_plans(
    profile_id,customer_animal_id,duration_days,start_day_number,requested_start_day,status
  ) values(v_profile_id,p_customer_animal_id,30,v_start_day,v_start_day,'draft')
  returning id into v_plan_id;
  insert into public.care_plan_events(care_plan_id,actor_profile_id,event_type,event_data)
  values(v_plan_id,v_profile_id,'plan_requested',jsonb_build_object(
    'duration_days',30,'requested_start_day',v_start_day,
    'client_suggested_start_day',p_requested_start_day,
    'start_day_source','official_acquired_at','fixed_price',5000,
    'daily_service_rate',round(5000::numeric/30,2)));
  perform public.customer_prepare_fixed_care_plan_payment(v_plan_id);
  return v_plan_id;
end;
$$;

create or replace function public.care_plan_customer_inventory_contract_version()
returns text
language sql
immutable
set search_path=public
as $$
  select '069_care_plan_customer_feed_balance_pricing_v1'::text;
$$;

revoke all on function public.customer_prepare_fixed_care_plan_payment(uuid) from public,anon;
revoke all on function public.customer_request_care_plan(uuid,integer,integer) from public,anon;
revoke all on function public.admin_prepare_care_plan_quote_v2(uuid,uuid,uuid,text,numeric,numeric,numeric,numeric,text) from public,anon,authenticated;
grant execute on function public.customer_prepare_fixed_care_plan_payment(uuid) to authenticated;
grant execute on function public.customer_request_care_plan(uuid,integer,integer) to authenticated;
revoke all on function public.care_plan_customer_inventory_contract_version() from public,anon,authenticated;

commit;

select jsonb_build_object(
  'migration','069_care_plan_customer_feed_balance_pricing_contract',
  'prepare_rpc',to_regprocedure('public.customer_prepare_fixed_care_plan_payment(uuid)') is not null,
  'request_rpc',to_regprocedure('public.customer_request_care_plan(uuid,integer,integer)') is not null,
  'version_rpc',to_regprocedure('public.care_plan_customer_inventory_contract_version()') is not null,
  'fixed_total',5000,
  'average_daily_rate',round(5000::numeric/30,2)
) verification;
