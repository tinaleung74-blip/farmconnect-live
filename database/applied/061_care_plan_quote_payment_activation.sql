-- Care Plan quote -> customer payment -> admin activation lifecycle.
-- No plan starts from a customer page load and no estimate is charged as final.

begin;

alter table public.rooster_care_plans
  add column if not exists requested_start_day integer not null default 1,
  add column if not exists feed_required_kg numeric(16,3),
  add column if not exists feed_inventory_item_id uuid references public.customer_inventory_items(id) on delete set null,
  add column if not exists quote_note text,
  add column if not exists quoted_at timestamptz,
  add column if not exists quoted_by_profile_id uuid references public.profiles(id) on delete set null;

alter table public.rooster_care_plans drop constraint if exists rooster_care_plans_requested_start_day_check;
alter table public.rooster_care_plans add constraint rooster_care_plans_requested_start_day_check
  check (requested_start_day between 1 and 180);

create or replace function public.customer_request_care_plan(
  p_customer_animal_id uuid,p_duration_days integer,p_requested_start_day integer default 1
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_profile_id uuid; v_plan_id uuid; v_animal public.customer_animals%rowtype;
begin
  select id into v_profile_id from public.profiles where auth_user_id=auth.uid() limit 1;
  if v_profile_id is null then raise exception 'LOGIN_REQUIRED'; end if;
  if p_duration_days not in (30,60,90,180) then raise exception 'INVALID_PLAN_DURATION'; end if;
  if p_requested_start_day<1 or p_requested_start_day+p_duration_days-1>180 then raise exception 'PLAN_EXCEEDS_CATALOG'; end if;
  select * into v_animal from public.customer_animals
    where id=p_customer_animal_id and profile_id=v_profile_id and status not in ('sold','cancelled');
  if not found then raise exception 'ANIMAL_NOT_OWNED'; end if;
  if exists(select 1 from public.rooster_care_plans where customer_animal_id=p_customer_animal_id
    and status in ('draft','payment_for_review','payment_submitted','paid_pending_setup','ready','active','paused')) then
    raise exception 'ROOSTER_ALREADY_HAS_OPEN_CARE_PLAN';
  end if;
  insert into public.rooster_care_plans(
    profile_id,customer_animal_id,duration_days,start_day_number,requested_start_day,status
  ) values(v_profile_id,p_customer_animal_id,p_duration_days,p_requested_start_day,p_requested_start_day,'draft')
  returning id into v_plan_id;
  insert into public.care_plan_events(care_plan_id,actor_profile_id,event_type,event_data)
    values(v_plan_id,v_profile_id,'plan_requested',jsonb_build_object('duration_days',p_duration_days,'requested_start_day',p_requested_start_day));
  insert into public.inbox_items(profile_id,category,title,body,created_at) values(
    v_profile_id,'care','Care Plan Requested','Admin will verify the rooster stage, caretaker coverage, food requirement, and locked package price before payment.',now());
  return v_plan_id;
end; $$;

create or replace function public.admin_prepare_care_plan_quote(
  p_care_plan_id uuid,p_caretaker_id uuid,p_feed_inventory_item_id uuid,p_feed_required_kg numeric,
  p_labor_price numeric,p_supply_price numeric,p_service_fee numeric,p_quote_note text default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_admin_id uuid; v_plan public.rooster_care_plans%rowtype; v_item public.customer_inventory_items%rowtype;
  v_feed_known_min numeric; v_feed_known_max numeric; v_total numeric;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  select id into v_admin_id from public.profiles where auth_user_id=auth.uid() limit 1;
  select * into v_plan from public.rooster_care_plans where id=p_care_plan_id for update;
  if not found then raise exception 'CARE_PLAN_NOT_FOUND'; end if;
  if v_plan.status not in ('draft','payment_for_review') then raise exception 'CARE_PLAN_NOT_QUOTABLE'; end if;
  if not exists(select 1 from public.caretakers where id=p_caretaker_id and coalesce(status,'active') in ('active','approved','on_duty')) then
    raise exception 'ACTIVE_CARETAKER_REQUIRED';
  end if;
  if p_feed_required_kg is null or p_feed_required_kg<=0 then raise exception 'POSITIVE_FEED_REQUIREMENT_REQUIRED'; end if;
  if least(coalesce(p_labor_price,-1),coalesce(p_supply_price,-1),coalesce(p_service_fee,-1))<0 then raise exception 'INVALID_PACKAGE_PRICE'; end if;
  select * into v_item from public.customer_inventory_items
    where id=p_feed_inventory_item_id and profile_id=v_plan.profile_id for update;
  if not found then raise exception 'CUSTOMER_FEED_INVENTORY_REQUIRED'; end if;

  select round(sum(feed_grams_min)/1000,3),round(sum(feed_grams_max)/1000,3)
  into v_feed_known_min,v_feed_known_max from public.care_mission_templates
  where catalog_version=v_plan.catalog_version
    and day_number between v_plan.requested_start_day and v_plan.requested_start_day+v_plan.duration_days-1;
  if p_feed_required_kg<coalesce(v_feed_known_min,0) then raise exception 'FEED_REQUIREMENT_BELOW_CATALOG_MINIMUM'; end if;
  v_total:=round(p_labor_price+p_supply_price+p_service_fee,2);

  update public.rooster_care_plans set assigned_caretaker_id=p_caretaker_id,start_day_number=requested_start_day,
    feed_required_kg=round(p_feed_required_kg,3),feed_inventory_item_id=p_feed_inventory_item_id,
    labor_price=round(p_labor_price,2),supply_price=round(p_supply_price,2),service_fee=round(p_service_fee,2),
    quote_note=p_quote_note,quoted_at=now(),quoted_by_profile_id=v_admin_id,status='payment_for_review',updated_at=now()
    where id=v_plan.id;
  insert into public.care_plan_supply_requirements(
    care_plan_id,inventory_item_id,product_id,product_name,unit,required_quantity,owned_quantity_snapshot,
    reserved_quantity,purchase_quantity,unit_price,requirement_source
  ) values(
    v_plan.id,v_item.id,v_item.product_id,v_item.product_name,'kg',round(p_feed_required_kg,3),coalesce(v_item.quantity,0),
    least(coalesce(v_item.quantity,0),round(p_feed_required_kg,3)),greatest(round(p_feed_required_kg,3)-coalesce(v_item.quantity,0),0),
    coalesce(v_item.unit_price,0),'admin_verified_catalog_sum'
  ) on conflict(care_plan_id,product_name,unit) do update set
    inventory_item_id=excluded.inventory_item_id,required_quantity=excluded.required_quantity,
    owned_quantity_snapshot=excluded.owned_quantity_snapshot,reserved_quantity=excluded.reserved_quantity,
    purchase_quantity=excluded.purchase_quantity,unit_price=excluded.unit_price,updated_at=now();
  insert into public.care_plan_events(care_plan_id,actor_profile_id,event_type,event_data) values(
    v_plan.id,v_admin_id,'quote_prepared',jsonb_build_object('package_total',v_total,'feed_required_kg',round(p_feed_required_kg,3),
      'catalog_known_min_kg',v_feed_known_min,'catalog_known_max_kg',v_feed_known_max));
  insert into public.inbox_items(profile_id,category,title,body,created_at) values(
    v_plan.profile_id,'care','Care Plan Quote Ready','Your verified care package quote is ready. Open Care Plans to review and pay the locked total.',now());
  return jsonb_build_object('id',v_plan.id,'status','payment_for_review','package_total',v_total,
    'feed_required_kg',round(p_feed_required_kg,3),'catalog_known_min_kg',v_feed_known_min,'catalog_known_max_kg',v_feed_known_max);
end; $$;

create or replace function public.sync_manual_payment_care_plan()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.source_type='care_plan' and nullif(new.source_ref,'') is not null then
    update public.rooster_care_plans set payment_request_id=new.id,
      status=case when new.status='approved' then 'paid_pending_setup'
        when new.status='rejected' then 'payment_for_review' else status end,
      updated_at=now() where id::text=new.source_ref;
  end if;
  return new;
end; $$;
drop trigger if exists trg_sync_manual_payment_care_plan on public.manual_payment_requests;
create trigger trg_sync_manual_payment_care_plan after insert or update on public.manual_payment_requests
for each row execute function public.sync_manual_payment_care_plan();

create or replace function public.admin_activate_care_plan(
  p_care_plan_id uuid,p_start_date date default ((now() at time zone 'Asia/Manila')::date+1)
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_admin_id uuid; v_plan public.rooster_care_plans%rowtype; v_requirement public.care_plan_supply_requirements%rowtype;
  v_catalog_count integer;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  select id into v_admin_id from public.profiles where auth_user_id=auth.uid() limit 1;
  select * into v_plan from public.rooster_care_plans where id=p_care_plan_id for update;
  if not found then raise exception 'CARE_PLAN_NOT_FOUND'; end if;
  if v_plan.status='active' then return jsonb_build_object('id',v_plan.id,'duplicate',true,'status','active'); end if;
  if v_plan.status<>'paid_pending_setup' then raise exception 'CARE_PLAN_PAYMENT_NOT_APPROVED'; end if;
  if p_start_date<(now() at time zone 'Asia/Manila')::date+1 then raise exception 'CARE_PLAN_START_MUST_BE_FUTURE'; end if;
  if v_plan.assigned_caretaker_id is null then raise exception 'CARETAKER_ASSIGNMENT_REQUIRED'; end if;
  select count(*) into v_catalog_count from public.care_mission_templates where catalog_version=v_plan.catalog_version
    and day_number between v_plan.start_day_number and v_plan.start_day_number+v_plan.duration_days-1;
  if v_catalog_count<>v_plan.duration_days then raise exception 'MISSION_CATALOG_RANGE_INCOMPLETE'; end if;
  select * into v_requirement from public.care_plan_supply_requirements where care_plan_id=v_plan.id and unit='kg' limit 1;
  if not found then raise exception 'CARE_PLAN_SUPPLY_REQUIREMENT_MISSING'; end if;
  if v_requirement.reserved_quantity+v_requirement.purchase_quantity<v_requirement.required_quantity then raise exception 'CARE_PLAN_SUPPLIES_INCOMPLETE'; end if;

  update public.rooster_care_plans set start_date=p_start_date,end_date=p_start_date+(duration_days-1),status='active',
    activated_at=now(),updated_at=now() where id=v_plan.id;
  insert into public.care_plan_events(care_plan_id,actor_profile_id,event_type,event_data)
    values(v_plan.id,v_admin_id,'plan_activated',jsonb_build_object('start_date',p_start_date,'end_date',p_start_date+(v_plan.duration_days-1)));
  insert into public.inbox_items(profile_id,category,title,body,created_at) values(
    v_plan.profile_id,'care','Care Plan Activated','Your paid Care Plan is active. Daily work continues even when you do not open the app.',now());
  return jsonb_build_object('id',v_plan.id,'duplicate',false,'status','active','start_date',p_start_date,
    'end_date',p_start_date+(v_plan.duration_days-1));
end; $$;

revoke all on function public.customer_request_care_plan(uuid,integer,integer) from public,anon;
revoke all on function public.admin_prepare_care_plan_quote(uuid,uuid,uuid,numeric,numeric,numeric,numeric,text) from public,anon;
revoke all on function public.admin_activate_care_plan(uuid,date) from public,anon;
grant execute on function public.customer_request_care_plan(uuid,integer,integer) to authenticated;
grant execute on function public.admin_prepare_care_plan_quote(uuid,uuid,uuid,numeric,numeric,numeric,numeric,text) to authenticated;
grant execute on function public.admin_activate_care_plan(uuid,date) to authenticated;

commit;

select jsonb_build_object('migration','061_care_plan_quote_payment_activation',
  'request_rpc',to_regprocedure('public.customer_request_care_plan(uuid,integer,integer)') is not null,
  'quote_rpc',to_regprocedure('public.admin_prepare_care_plan_quote(uuid,uuid,uuid,numeric,numeric,numeric,numeric,text)') is not null,
  'activate_rpc',to_regprocedure('public.admin_activate_care_plan(uuid,date)') is not null) verification;
