-- FarmConnect Care Plan + 180-day Mission Engine foundation.
-- Forward-only and additive. Apply before 059_care_mission_catalog_seed.sql.

begin;

create extension if not exists pgcrypto;

create table if not exists public.care_mission_templates (
  id uuid primary key default gen_random_uuid(),
  catalog_version text not null,
  day_number integer not null check (day_number between 1 and 180),
  life_stage text not null,
  primary_mission text not null,
  feed_grams_min numeric(12,3),
  feed_grams_max numeric(12,3),
  time_schedule jsonb not null default '[]'::jsonb,
  needed_today jsonb not null default '[]'::jsonb,
  feeding_standard jsonb not null default '[]'::jsonb,
  supplement_checklist jsonb not null default '[]'::jsonb,
  vaccine_checklist jsonb not null default '[]'::jsonb,
  operations_checklist jsonb not null default '[]'::jsonb,
  housing_checklist jsonb not null default '[]'::jsonb,
  health_checklist jsonb not null default '[]'::jsonb,
  evidence_requirements jsonb not null default '[]'::jsonb,
  emergency_stop_rule text not null,
  completion_gate text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (catalog_version, day_number),
  check (feed_grams_min is null or feed_grams_min >= 0),
  check (feed_grams_max is null or feed_grams_max >= feed_grams_min)
);

create table if not exists public.rooster_care_plans (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  customer_animal_id uuid not null references public.customer_animals(id) on delete restrict,
  care_request_id uuid references public.farm_care_requests(id) on delete set null,
  payment_request_id uuid references public.manual_payment_requests(id) on delete set null,
  assigned_caretaker_id uuid references public.caretakers(id) on delete set null,
  catalog_version text not null default 'farmconnect-premium-rooster-180-v1',
  duration_days integer not null check (duration_days in (30,60,90,180)),
  start_day_number integer not null default 1 check (start_day_number between 1 and 180),
  start_date date,
  end_date date,
  timezone text not null default 'Asia/Manila' check (timezone = 'Asia/Manila'),
  status text not null default 'draft' check (status in (
    'draft','payment_for_review','paid_pending_setup','ready','active','paused','completed','cancelled','expired'
  )),
  labor_price numeric(14,2) not null default 0 check (labor_price >= 0),
  supply_price numeric(14,2) not null default 0 check (supply_price >= 0),
  service_fee numeric(14,2) not null default 0 check (service_fee >= 0),
  package_total numeric(14,2) generated always as (labor_price + supply_price + service_fee) stored,
  cancellation_note text,
  activated_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date)
);

create unique index if not exists uq_rooster_one_live_care_plan
  on public.rooster_care_plans(customer_animal_id)
  where status in ('payment_for_review','paid_pending_setup','ready','active','paused');

create table if not exists public.care_plan_supply_requirements (
  id uuid primary key default gen_random_uuid(),
  care_plan_id uuid not null references public.rooster_care_plans(id) on delete cascade,
  inventory_item_id uuid references public.customer_inventory_items(id) on delete set null,
  product_id text,
  product_name text not null,
  unit text not null check (unit in ('kg','g','ml','l','piece')),
  required_quantity numeric(16,3) not null check (required_quantity >= 0),
  owned_quantity_snapshot numeric(16,3) not null default 0 check (owned_quantity_snapshot >= 0),
  reserved_quantity numeric(16,3) not null default 0 check (reserved_quantity >= 0),
  purchase_quantity numeric(16,3) not null default 0 check (purchase_quantity >= 0),
  unit_price numeric(14,2) not null default 0 check (unit_price >= 0),
  requirement_source text not null default 'mission_catalog',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (care_plan_id, product_name, unit),
  check (reserved_quantity <= owned_quantity_snapshot),
  check (purchase_quantity = greatest(required_quantity - reserved_quantity, 0))
);

create table if not exists public.rooster_daily_missions (
  id uuid primary key default gen_random_uuid(),
  care_plan_id uuid not null references public.rooster_care_plans(id) on delete cascade,
  mission_template_id uuid not null references public.care_mission_templates(id) on delete restrict,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  customer_animal_id uuid not null references public.customer_animals(id) on delete restrict,
  caretaker_id uuid references public.caretakers(id) on delete set null,
  caretaker_task_id uuid references public.caretaker_tasks(id) on delete set null,
  plan_day integer not null check (plan_day between 1 and 180),
  catalog_day integer not null check (catalog_day between 1 and 180),
  mission_date date not null,
  timezone text not null default 'Asia/Manila' check (timezone = 'Asia/Manila'),
  status text not null default 'scheduled' check (status in (
    'scheduled','active','submitted','approved','backjob','overdue','watch','isolate_and_escalate','cancelled'
  )),
  health_status text check (health_status in ('pass','watch','isolate_and_escalate')),
  generated_at timestamptz not null default now(),
  submitted_at timestamptz,
  reviewed_at timestamptz,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (care_plan_id, plan_day),
  unique (care_plan_id, mission_date)
);

create table if not exists public.care_plan_events (
  id uuid primary key default gen_random_uuid(),
  care_plan_id uuid not null references public.rooster_care_plans(id) on delete cascade,
  daily_mission_id uuid references public.rooster_daily_missions(id) on delete set null,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  event_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.caretaker_tasks
  add column if not exists care_plan_id uuid references public.rooster_care_plans(id) on delete set null,
  add column if not exists daily_mission_id uuid references public.rooster_daily_missions(id) on delete set null,
  add column if not exists mission_day_number integer,
  add column if not exists mission_date date;

alter table public.task_proofs
  add column if not exists daily_mission_id uuid references public.rooster_daily_missions(id) on delete set null,
  add column if not exists health_status text,
  add column if not exists checklist_results jsonb not null default '{}'::jsonb,
  add column if not exists inventory_usage jsonb not null default '[]'::jsonb;

alter table public.inventory_usage_logs
  add column if not exists care_plan_id uuid references public.rooster_care_plans(id) on delete set null,
  add column if not exists daily_mission_id uuid references public.rooster_daily_missions(id) on delete set null,
  add column if not exists task_proof_id uuid references public.task_proofs(id) on delete set null,
  add column if not exists inventory_item_id uuid references public.customer_inventory_items(id) on delete set null,
  add column if not exists quantity_before numeric(16,3),
  add column if not exists quantity_after numeric(16,3),
  add column if not exists created_at timestamptz not null default now();

create unique index if not exists uq_caretaker_task_daily_mission
  on public.caretaker_tasks(daily_mission_id) where daily_mission_id is not null;
create unique index if not exists uq_inventory_usage_proof_item
  on public.inventory_usage_logs(task_proof_id, inventory_item_id)
  where task_proof_id is not null and inventory_item_id is not null;
create index if not exists idx_daily_missions_due on public.rooster_daily_missions(mission_date, status);
create index if not exists idx_care_plan_events_plan on public.care_plan_events(care_plan_id, created_at desc);

alter table public.care_mission_templates enable row level security;
alter table public.rooster_care_plans enable row level security;
alter table public.care_plan_supply_requirements enable row level security;
alter table public.rooster_daily_missions enable row level security;
alter table public.care_plan_events enable row level security;

drop policy if exists "mission templates authenticated read" on public.care_mission_templates;
create policy "mission templates authenticated read" on public.care_mission_templates
  for select to authenticated using (true);

drop policy if exists "care plans linked read" on public.rooster_care_plans;
create policy "care plans linked read" on public.rooster_care_plans for select to authenticated using (
  profile_id = public.current_profile_id() or public.is_admin() or assigned_caretaker_id in (
    select id from public.caretakers where profile_id=public.current_profile_id() or caretaker_profile_id=public.current_profile_id()
  )
);

drop policy if exists "care supplies linked read" on public.care_plan_supply_requirements;
create policy "care supplies linked read" on public.care_plan_supply_requirements for select to authenticated using (
  exists (select 1 from public.rooster_care_plans plan where plan.id=care_plan_id and (
    plan.profile_id=public.current_profile_id() or public.is_admin() or plan.assigned_caretaker_id in (
      select id from public.caretakers where profile_id=public.current_profile_id() or caretaker_profile_id=public.current_profile_id()
    )
  ))
);

drop policy if exists "daily missions linked read" on public.rooster_daily_missions;
create policy "daily missions linked read" on public.rooster_daily_missions for select to authenticated using (
  profile_id=public.current_profile_id() or public.is_admin() or caretaker_id in (
    select id from public.caretakers where profile_id=public.current_profile_id() or caretaker_profile_id=public.current_profile_id()
  )
);

drop policy if exists "care plan events linked read" on public.care_plan_events;
create policy "care plan events linked read" on public.care_plan_events for select to authenticated using (
  exists (select 1 from public.rooster_care_plans plan where plan.id=care_plan_id and (
    plan.profile_id=public.current_profile_id() or public.is_admin() or plan.assigned_caretaker_id in (
      select id from public.caretakers where profile_id=public.current_profile_id() or caretaker_profile_id=public.current_profile_id()
    )
  ))
);

-- No direct client writes to care-plan tables. All writes use guarded functions.

create or replace function public.admin_assign_care_request(
  p_care_request_id uuid, p_caretaker_id uuid default null, p_admin_note text default null
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
  if v_request.status <> 'paid_pending_assignment' then raise exception 'CARE_REQUEST_NOT_READY_FOR_ASSIGNMENT'; end if;

  select id into v_caretaker_id from public.caretakers
  where (p_caretaker_id is null or id=p_caretaker_id) and coalesce(status,'active') in ('active','approved','on_duty')
  order by created_at asc limit 1;
  if v_caretaker_id is null then raise exception 'NO_ACTIVE_CARETAKER'; end if;

  insert into public.caretaker_tasks(
    care_request_id,profile_id,caretaker_id,assigned_by_profile_id,animal_id,rooster_name,rooster_tag,
    task_type,customer_note,admin_note,required_proof,status,priority,due_at,task_metadata
  ) values (
    v_request.id,v_request.profile_id,v_caretaker_id,v_admin_id,null,v_request.rooster_name,v_request.rooster_tag,
    v_request.service_name,v_request.customer_note,p_admin_note,v_request.required_proof,'active',
    case when v_request.service_name ilike '%vet%' or v_request.service_name ilike '%health%' then 'urgent' else 'normal' end,
    now()+interval '1 day',jsonb_build_object('source','care_request','assignment_version',58)
  ) returning id into v_task_id;

  update public.farm_care_requests set assigned_caretaker_id=v_caretaker_id,assigned_task_id=v_task_id,
    admin_note=p_admin_note,status='assigned',updated_at=now() where id=v_request.id;
  insert into public.inbox_items(profile_id,category,title,body,created_at) values
    (v_request.profile_id,'care','Care Request Assigned','Admin assigned your paid care request. Updates appear after proof review.',now());
  return v_task_id;
end; $$;

create or replace function public.generate_due_care_plan_missions(p_run_date date default (now() at time zone 'Asia/Manila')::date)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_plan record; v_template public.care_mission_templates%rowtype; v_mission_id uuid; v_task_id uuid; v_created integer:=0;
begin
  if auth.uid() is not null and not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  update public.rooster_daily_missions set status='overdue',updated_at=now()
    where mission_date<p_run_date and status in ('scheduled','active');

  for v_plan in select plan.*,animal.animal_name,animal.animal_code
    from public.rooster_care_plans plan join public.customer_animals animal on animal.id=plan.customer_animal_id
    where plan.status='active' and p_run_date between plan.start_date and plan.end_date
  loop
    select * into v_template from public.care_mission_templates
      where catalog_version=v_plan.catalog_version
        and day_number=v_plan.start_day_number+(p_run_date-v_plan.start_date);
    if not found then continue; end if;

    insert into public.rooster_daily_missions(
      care_plan_id,mission_template_id,profile_id,customer_animal_id,caretaker_id,plan_day,catalog_day,mission_date,status
    ) values (
      v_plan.id,v_template.id,v_plan.profile_id,v_plan.customer_animal_id,v_plan.assigned_caretaker_id,
      (p_run_date-v_plan.start_date)+1,v_template.day_number,p_run_date,'active'
    ) on conflict (care_plan_id,mission_date) do nothing returning id into v_mission_id;
    if v_mission_id is null then continue; end if;

    insert into public.caretaker_tasks(
      care_plan_id,daily_mission_id,mission_day_number,mission_date,profile_id,caretaker_id,assigned_by_profile_id,
      animal_id,rooster_name,rooster_tag,task_type,required_proof,status,priority,due_at,workflow_type,qr_scan_required,task_metadata
    ) values (
      v_plan.id,v_mission_id,v_template.day_number,p_run_date,v_plan.profile_id,v_plan.assigned_caretaker_id,null,
      null,v_plan.animal_name,v_plan.animal_code,'Day '||v_template.day_number||': '||v_template.primary_mission,
      'Complete required checklist, time-stamped evidence, health status, and actual inventory usage.',
      'active','normal',(p_run_date::timestamp+time '17:15') at time zone 'Asia/Manila','care_plan_daily_mission',true,
      jsonb_build_object('catalog_day',v_template.day_number,'life_stage',v_template.life_stage,'primary_mission',v_template.primary_mission,
        'time_schedule',v_template.time_schedule,'needed_today',v_template.needed_today,'feeding_standard',v_template.feeding_standard,
        'supplement_checklist',v_template.supplement_checklist,'vaccine_checklist',v_template.vaccine_checklist,
        'operations_checklist',v_template.operations_checklist,'housing_checklist',v_template.housing_checklist,
        'health_checklist',v_template.health_checklist,'evidence_requirements',v_template.evidence_requirements,
        'emergency_stop_rule',v_template.emergency_stop_rule,'completion_gate',v_template.completion_gate,
        'feed_grams_min',v_template.feed_grams_min,'feed_grams_max',v_template.feed_grams_max))
    returning id into v_task_id;
    update public.rooster_daily_missions set caretaker_task_id=v_task_id where id=v_mission_id;
    insert into public.care_plan_events(care_plan_id,daily_mission_id,event_type,event_data)
      values(v_plan.id,v_mission_id,'mission_generated',jsonb_build_object('mission_date',p_run_date,'task_id',v_task_id));
    v_created:=v_created+1;
  end loop;
  return jsonb_build_object('run_date',p_run_date,'created',v_created,'timezone','Asia/Manila');
end; $$;

revoke all on function public.generate_due_care_plan_missions(date) from public,anon;
grant execute on function public.generate_due_care_plan_missions(date) to authenticated,service_role;
revoke all on function public.admin_assign_care_request(uuid,uuid,text) from public,anon;
grant execute on function public.admin_assign_care_request(uuid,uuid,text) to authenticated;

-- Storage contract now matches the caretaker UI: private images/video, max 50 MB.
update storage.buckets set public=false,file_size_limit=52428800,
  allowed_mime_types=array['image/jpeg','image/png','image/webp','video/mp4','video/webm','video/quicktime']::text[]
where id='caretaker-task-proofs';

commit;

select jsonb_build_object(
  'migration','058_care_plan_mission_engine_foundation',
  'templates_table',to_regclass('public.care_mission_templates') is not null,
  'plans_table',to_regclass('public.rooster_care_plans') is not null,
  'missions_table',to_regclass('public.rooster_daily_missions') is not null,
  'scheduler_function',to_regprocedure('public.generate_due_care_plan_missions(date)') is not null
) verification;
