begin;

create or replace function public.customer_create_included_daily_care(
  p_customer_animal_id uuid
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_animal public.customer_animals%rowtype;
  v_template public.care_mission_templates%rowtype;
  v_request_id uuid;
  v_catalog_day integer;
  v_metadata jsonb;
begin
  select id into v_profile_id
  from public.profiles
  where auth_user_id = auth.uid()
  limit 1;
  if v_profile_id is null then raise exception 'LOGIN_REQUIRED'; end if;

  select * into v_animal
  from public.customer_animals
  where id = p_customer_animal_id
    and profile_id = v_profile_id
    and coalesce(status, '') <> 'sold'
  for update;
  if not found then raise exception 'ANIMAL_NOT_OWNED'; end if;

  if exists (
    select 1 from public.rooster_care_plans
    where customer_animal_id = v_animal.id
      and status in ('paid_pending_setup', 'ready', 'active', 'paused')
  ) then raise exception 'PAID_CARE_PLAN_ALREADY_AUTOMATES_ROOSTER'; end if;

  if exists (
    select 1 from public.farm_care_requests
    where customer_animal_id = v_animal.id
      and service_category = 'daily_care'
      and status not in ('completed', 'cancelled', 'rejected')
  ) then raise exception 'DAILY_CARE_REQUEST_ALREADY_OPEN'; end if;

  v_catalog_day := least(180, greatest(1,
    ((now() at time zone 'Asia/Manila')::date
      - coalesce(v_animal.acquired_at::date, (now() at time zone 'Asia/Manila')::date)) + 1));

  select * into v_template
  from public.care_mission_templates
  where catalog_version = 'farmconnect-premium-rooster-180-v1'
    and day_number = v_catalog_day;
  if not found then raise exception 'MISSION_TEMPLATE_NOT_FOUND'; end if;

  v_metadata := jsonb_build_object(
    'catalog_day', v_template.day_number,
    'life_stage', v_template.life_stage,
    'primary_mission', v_template.primary_mission,
    'time_schedule', v_template.time_schedule,
    'needed_today', v_template.needed_today,
    'feeding_standard', v_template.feeding_standard,
    'operations_checklist', v_template.operations_checklist,
    'housing_checklist', v_template.housing_checklist,
    'health_checklist', v_template.health_checklist,
    'evidence_requirements', v_template.evidence_requirements,
    'emergency_stop_rule', v_template.emergency_stop_rule,
    'completion_gate', v_template.completion_gate,
    'feed_grams_min', v_template.feed_grams_min,
    'feed_grams_max', v_template.feed_grams_max,
    'care_mode', 'included_daily_care',
    'standard_feed_included', true,
    'fixed_price', 160,
    'caretaker_stop_and_report_required', true
  );

  insert into public.farm_care_requests(
    profile_id, customer_animal_id, rooster_name, rooster_tag,
    service_name, service_category, service_price, required_proof,
    status, mission_template_id, mission_day_number, workflow_type, task_metadata
  ) values (
    v_profile_id, v_animal.id, v_animal.animal_name, v_animal.animal_code,
    'Daily Care', 'daily_care', 160,
    'Complete the scheduled care, verify the rooster QR, and upload a clear after-care photo.',
    'payment_for_review', v_template.id, v_template.day_number,
    'manual_standard_mission', v_metadata
  ) returning id into v_request_id;

  insert into public.inbox_items(profile_id, category, title, body, created_at)
  values (v_profile_id, 'care', 'Daily Care Payment Started',
    'Daily Care for ' || v_animal.animal_name || ' is ready for payment.', now());

  return v_request_id;
end;
$$;

revoke all on function public.customer_create_included_daily_care(uuid) from public, anon;
grant execute on function public.customer_create_included_daily_care(uuid) to authenticated, service_role;

commit;

select jsonb_build_object(
  'verification', jsonb_build_object(
    'migration', '107_included_daily_care_payment',
    'daily_care_rpc', to_regprocedure('public.customer_create_included_daily_care(uuid)') is not null,
    'fixed_price', 160,
    'standard_feed_included', true,
    'business_records_changed', false
  )
);
