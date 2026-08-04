-- FarmConnect safe backend wiring for care requests and caretaker task proof.
-- Run after: 009_manual_payment_review_flow.sql
-- This is intentionally narrow:
-- - Customer can create care requests.
-- - Admin can assign care requests to caretakers.
-- - Caretaker can submit proof only for tasks assigned to their own caretaker profile.
-- - Admin reviews proof before customer release.

begin;

create extension if not exists pgcrypto;

create table if not exists public.farm_care_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  customer_animal_id uuid references public.customer_animals(id) on delete set null,
  rooster_name text not null,
  rooster_tag text,
  service_name text not null,
  service_category text,
  service_price numeric not null default 0,
  required_proof text,
  customer_note text,
  status text not null default 'draft' check (status in ('draft','payment_for_review','payment_rejected','paid_pending_assignment','assigned','in_progress','proof_submitted','released_to_customer','rejected','cancelled')),
  payment_request_id uuid references public.manual_payment_requests(id) on delete set null,
  assigned_caretaker_id uuid references public.caretakers(id) on delete set null,
  assigned_task_id uuid,
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.farm_care_requests
  add column if not exists profile_id uuid references public.profiles(id) on delete cascade,
  add column if not exists customer_animal_id uuid references public.customer_animals(id) on delete set null,
  add column if not exists rooster_name text,
  add column if not exists rooster_tag text,
  add column if not exists service_name text,
  add column if not exists service_category text,
  add column if not exists service_price numeric not null default 0,
  add column if not exists required_proof text,
  add column if not exists customer_note text,
  add column if not exists status text not null default 'draft',
  add column if not exists payment_request_id uuid references public.manual_payment_requests(id) on delete set null,
  add column if not exists assigned_caretaker_id uuid references public.caretakers(id) on delete set null,
  add column if not exists assigned_task_id uuid,
  add column if not exists admin_note text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.farm_care_requests
  drop constraint if exists farm_care_requests_status_check,
  add constraint farm_care_requests_status_check
  check (status in ('draft','payment_for_review','payment_rejected','paid_pending_assignment','assigned','in_progress','proof_submitted','released_to_customer','rejected','cancelled'));

create table if not exists public.caretaker_tasks (
  id uuid primary key default gen_random_uuid(),
  care_request_id uuid references public.farm_care_requests(id) on delete set null,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  caretaker_id uuid references public.caretakers(id) on delete set null,
  assigned_by_profile_id uuid references public.profiles(id) on delete set null,
  animal_id uuid references public.customer_animals(id) on delete set null,
  rooster_name text not null,
  rooster_tag text,
  task_type text not null,
  customer_note text,
  admin_note text,
  required_proof text,
  status text not null default 'active' check (status in ('active','in_progress','submitted','approved','rejected','backjob','cancelled')),
  priority text not null default 'normal',
  due_at timestamptz,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.caretaker_tasks
  add column if not exists care_request_id uuid references public.farm_care_requests(id) on delete set null,
  add column if not exists profile_id uuid references public.profiles(id) on delete cascade,
  add column if not exists caretaker_id uuid references public.caretakers(id) on delete set null,
  add column if not exists assigned_by_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists animal_id uuid references public.customer_animals(id) on delete set null,
  add column if not exists rooster_name text,
  add column if not exists rooster_tag text,
  add column if not exists task_type text,
  add column if not exists customer_note text,
  add column if not exists admin_note text,
  add column if not exists required_proof text,
  add column if not exists status text not null default 'active',
  add column if not exists priority text not null default 'normal',
  add column if not exists due_at timestamptz,
  add column if not exists submitted_at timestamptz,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.caretaker_tasks
  drop constraint if exists caretaker_tasks_status_check,
  add constraint caretaker_tasks_status_check
  check (status in ('active','in_progress','submitted','approved','rejected','backjob','cancelled'));

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'farm_care_requests_assigned_task_fk'
      and conrelid = 'public.farm_care_requests'::regclass
  ) then
    alter table public.farm_care_requests
      add constraint farm_care_requests_assigned_task_fk
      foreign key (assigned_task_id) references public.caretaker_tasks(id) on delete set null;
  end if;
end $$;

create table if not exists public.task_proofs (
  id uuid primary key default gen_random_uuid(),
  caretaker_task_id uuid references public.caretaker_tasks(id) on delete cascade,
  care_request_id uuid references public.farm_care_requests(id) on delete set null,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  caretaker_id uuid references public.caretakers(id) on delete set null,
  proof_type text not null default 'photo',
  proof_url text,
  thumbnail_url text,
  preset_note text,
  free_note text,
  qr_verified boolean not null default false,
  serial_exception boolean not null default false,
  feed_quantity_used numeric,
  feed_unit text,
  proof_check_status text not null default 'pending' check (proof_check_status in ('pending','passed','needs_review','failed')),
  admin_review_status text not null default 'pending' check (admin_review_status in ('pending','approved','rejected','backjob')),
  admin_note text,
  captured_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.task_proofs
  add column if not exists caretaker_task_id uuid references public.caretaker_tasks(id) on delete cascade,
  add column if not exists care_request_id uuid references public.farm_care_requests(id) on delete set null,
  add column if not exists profile_id uuid references public.profiles(id) on delete cascade,
  add column if not exists caretaker_id uuid references public.caretakers(id) on delete set null,
  add column if not exists proof_type text not null default 'photo',
  add column if not exists proof_url text,
  add column if not exists thumbnail_url text,
  add column if not exists preset_note text,
  add column if not exists free_note text,
  add column if not exists qr_verified boolean not null default false,
  add column if not exists serial_exception boolean not null default false,
  add column if not exists feed_quantity_used numeric,
  add column if not exists feed_unit text,
  add column if not exists proof_check_status text not null default 'pending',
  add column if not exists admin_review_status text not null default 'pending',
  add column if not exists admin_note text,
  add column if not exists captured_at timestamptz,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists created_at timestamptz not null default now();

alter table public.task_proofs
  drop constraint if exists task_proofs_proof_check_status_check,
  drop constraint if exists task_proofs_admin_review_status_check,
  add constraint task_proofs_proof_check_status_check
  check (proof_check_status in ('pending','passed','needs_review','failed')),
  add constraint task_proofs_admin_review_status_check
  check (admin_review_status in ('pending','approved','rejected','backjob'));

create index if not exists idx_farm_care_requests_profile on public.farm_care_requests(profile_id, created_at desc);
create index if not exists idx_farm_care_requests_status on public.farm_care_requests(status, created_at desc);
create index if not exists idx_caretaker_tasks_caretaker on public.caretaker_tasks(caretaker_id, status, due_at);
create index if not exists idx_caretaker_tasks_profile on public.caretaker_tasks(profile_id, created_at desc);
create index if not exists idx_task_proofs_task on public.task_proofs(caretaker_task_id, created_at desc);
create index if not exists idx_task_proofs_status on public.task_proofs(admin_review_status, created_at desc);

alter table public.farm_care_requests enable row level security;
alter table public.caretaker_tasks enable row level security;
alter table public.task_proofs enable row level security;

drop policy if exists "care requests owner admin read" on public.farm_care_requests;
create policy "care requests owner admin read" on public.farm_care_requests
  for select to authenticated
  using (profile_id = public.current_profile_id() or public.is_admin());

drop policy if exists "care requests customer insert own" on public.farm_care_requests;
create policy "care requests customer insert own" on public.farm_care_requests
  for insert to authenticated
  with check (profile_id = public.current_profile_id());

drop policy if exists "care requests admin update" on public.farm_care_requests;
create policy "care requests admin update" on public.farm_care_requests
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "caretaker tasks read linked" on public.caretaker_tasks;
create policy "caretaker tasks read linked" on public.caretaker_tasks
  for select to authenticated
  using (
    public.is_admin()
    or profile_id = public.current_profile_id()
    or caretaker_id in (
      select id from public.caretakers
      where profile_id = public.current_profile_id()
         or caretaker_profile_id = public.current_profile_id()
    )
  );

drop policy if exists "caretaker tasks admin write" on public.caretaker_tasks;
create policy "caretaker tasks admin write" on public.caretaker_tasks
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "task proofs read linked" on public.task_proofs;
create policy "task proofs read linked" on public.task_proofs
  for select to authenticated
  using (
    public.is_admin()
    or profile_id = public.current_profile_id()
    or caretaker_id in (
      select id from public.caretakers
      where profile_id = public.current_profile_id()
         or caretaker_profile_id = public.current_profile_id()
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
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_request_id uuid;
begin
  select id into v_profile_id from public.profiles where auth_user_id = auth.uid() limit 1;
  if v_profile_id is null then raise exception 'LOGIN_REQUIRED'; end if;

  if p_customer_animal_id is not null and not exists (
    select 1 from public.customer_animals where id = p_customer_animal_id and profile_id = v_profile_id
  ) then
    raise exception 'ANIMAL_NOT_OWNED';
  end if;

  insert into public.farm_care_requests(
    profile_id, customer_animal_id, rooster_name, rooster_tag, service_name, service_category,
    service_price, required_proof, customer_note, status
  ) values (
    v_profile_id, p_customer_animal_id, coalesce(nullif(trim(p_rooster_name),''),'Rooster'), p_rooster_tag,
    coalesce(nullif(trim(p_service_name),''),'Care Request'), p_service_category,
    coalesce(p_service_price,0), p_required_proof, p_customer_note,
    case when coalesce(p_service_price,0) > 0 then 'payment_for_review' else 'paid_pending_assignment' end
  ) returning id into v_request_id;

  insert into public.inbox_items(profile_id, category, title, body, created_at)
  values (v_profile_id, 'care', 'Care Request Submitted', 'Your request for ' || coalesce(p_rooster_name,'rooster') || ' is recorded. Service: ' || coalesce(p_service_name,'Care Request') || '.', now());

  return v_request_id;
end;
$$;

create or replace function public.admin_assign_care_request(
  p_care_request_id uuid,
  p_caretaker_id uuid default null,
  p_admin_note text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid;
  v_request public.farm_care_requests%rowtype;
  v_caretaker_id uuid;
  v_task_id uuid;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  select id into v_admin_id from public.profiles where auth_user_id = auth.uid() limit 1;
  select * into v_request from public.farm_care_requests where id = p_care_request_id for update;
  if not found then raise exception 'CARE_REQUEST_NOT_FOUND'; end if;

  if p_caretaker_id is null then
    select id into v_caretaker_id from public.caretakers where coalesce(status,'active') in ('active','approved','on_duty') order by created_at asc limit 1;
  else
    select id into v_caretaker_id from public.caretakers where id = p_caretaker_id and coalesce(status,'active') in ('active','approved','on_duty');
  end if;

  if v_caretaker_id is null then raise exception 'NO_ACTIVE_CARETAKER'; end if;

  insert into public.caretaker_tasks(
    care_request_id, profile_id, caretaker_id, assigned_by_profile_id, animal_id,
    rooster_name, rooster_tag, task_type, customer_note, admin_note, required_proof,
    status, priority, due_at
  ) values (
    v_request.id, v_request.profile_id, v_caretaker_id, v_admin_id, v_request.customer_animal_id,
    v_request.rooster_name, v_request.rooster_tag, v_request.service_name, v_request.customer_note,
    p_admin_note, v_request.required_proof, 'active',
    case when v_request.service_name ilike '%vet%' or v_request.service_name ilike '%health%' then 'urgent' else 'normal' end,
    now() + interval '1 day'
  ) returning id into v_task_id;

  update public.farm_care_requests
  set assigned_caretaker_id = v_caretaker_id,
      assigned_task_id = v_task_id,
      admin_note = p_admin_note,
      status = 'assigned',
      updated_at = now()
  where id = v_request.id;

  insert into public.inbox_items(profile_id, category, title, body, created_at)
  values (v_request.profile_id, 'care', 'Care Request Assigned', 'Admin assigned your care request to the farm team. You will see the update after proof review.', now());

  return v_task_id;
end;
$$;

create or replace function public.caretaker_submit_task_proof(
  p_task_id uuid,
  p_proof_url text,
  p_preset_note text default null,
  p_free_note text default null,
  p_qr_verified boolean default true,
  p_serial_exception boolean default false,
  p_feed_quantity_used numeric default null,
  p_feed_unit text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_caretaker_id uuid;
  v_task public.caretaker_tasks%rowtype;
  v_proof_id uuid;
begin
  select id into v_profile_id from public.profiles where auth_user_id = auth.uid() limit 1;
  if v_profile_id is null then raise exception 'LOGIN_REQUIRED'; end if;

  select id into v_caretaker_id
  from public.caretakers
  where profile_id = v_profile_id or caretaker_profile_id = v_profile_id
  order by created_at asc
  limit 1;

  if v_caretaker_id is null then raise exception 'CARETAKER_PROFILE_REQUIRED'; end if;

  select * into v_task
  from public.caretaker_tasks
  where id = p_task_id
    and caretaker_id = v_caretaker_id
    and status in ('active','in_progress','backjob')
  for update;

  if not found then raise exception 'TASK_NOT_ASSIGNED_TO_CARETAKER'; end if;

  insert into public.task_proofs(
    caretaker_task_id, care_request_id, profile_id, caretaker_id, proof_type,
    proof_url, thumbnail_url, preset_note, free_note, qr_verified, serial_exception,
    feed_quantity_used, feed_unit, proof_check_status, admin_review_status, captured_at
  ) values (
    v_task.id, v_task.care_request_id, v_task.profile_id, v_task.caretaker_id,
    case when coalesce(v_task.required_proof, '') ilike '%video%' then 'video' else 'photo' end,
    p_proof_url, p_proof_url, p_preset_note, p_free_note, coalesce(p_qr_verified,true), coalesce(p_serial_exception,false),
    p_feed_quantity_used, p_feed_unit,
    case when coalesce(p_qr_verified,true) and p_proof_url is not null then 'passed' else 'needs_review' end,
    'pending', now()
  ) returning id into v_proof_id;

  update public.caretaker_tasks set status = 'submitted', submitted_at = now(), updated_at = now() where id = v_task.id;
  update public.farm_care_requests set status = 'proof_submitted', updated_at = now() where id = v_task.care_request_id;

  return v_proof_id;
end;
$$;

create or replace function public.admin_review_task_proof(
  p_proof_id uuid,
  p_decision text,
  p_admin_note text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid;
  v_proof public.task_proofs%rowtype;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if p_decision not in ('approved','rejected','backjob') then raise exception 'INVALID_DECISION'; end if;
  select id into v_admin_id from public.profiles where auth_user_id = auth.uid() limit 1;
  select * into v_proof from public.task_proofs where id = p_proof_id for update;
  if not found then raise exception 'PROOF_NOT_FOUND'; end if;

  update public.task_proofs set admin_review_status = p_decision, admin_note = p_admin_note, reviewed_at = now(), reviewed_by_profile_id = v_admin_id where id = p_proof_id;
  update public.caretaker_tasks set status = case when p_decision = 'approved' then 'approved' when p_decision = 'backjob' then 'backjob' else 'rejected' end, reviewed_at = now(), reviewed_by_profile_id = v_admin_id, updated_at = now() where id = v_proof.caretaker_task_id;
  update public.farm_care_requests set status = case when p_decision = 'approved' then 'released_to_customer' when p_decision = 'backjob' then 'assigned' else 'rejected' end, admin_note = p_admin_note, updated_at = now() where id = v_proof.care_request_id;

  insert into public.inbox_items(profile_id, category, title, body, created_at)
  values (
    v_proof.profile_id,
    'farm_update',
    case when p_decision = 'approved' then 'Care Update Approved' when p_decision = 'backjob' then 'Care Update Needs Correction' else 'Care Update Rejected' end,
    case when p_decision = 'approved' then 'Admin approved the caretaker proof. Your care log is ready.'
      when p_decision = 'backjob' then 'Admin asked the caretaker to correct the proof. Note: ' || coalesce(p_admin_note,'Needs correction.')
      else 'Admin rejected the caretaker proof. Note: ' || coalesce(p_admin_note,'Proof was not accepted.') end,
    now()
  );

  return p_proof_id;
end;
$$;

grant execute on function public.customer_create_care_request(uuid,text,text,text,text,numeric,text,text) to authenticated;
grant execute on function public.admin_assign_care_request(uuid,uuid,text) to authenticated;
grant execute on function public.caretaker_submit_task_proof(uuid,text,text,text,boolean,boolean,numeric,text) to authenticated;
grant execute on function public.admin_review_task_proof(uuid,text,text) to authenticated;

commit;

select 'farm_care_requests' as check_name, count(*) from information_schema.tables where table_schema='public' and table_name='farm_care_requests'
union all select 'caretaker_tasks', count(*) from information_schema.tables where table_schema='public' and table_name='caretaker_tasks'
union all select 'task_proofs', count(*) from information_schema.tables where table_schema='public' and table_name='task_proofs'
union all select 'customer_create_care_request', count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='customer_create_care_request'
union all select 'admin_assign_care_request', count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='admin_assign_care_request'
union all select 'caretaker_submit_task_proof', count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='caretaker_submit_task_proof'
union all select 'admin_review_task_proof', count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='admin_review_task_proof';
