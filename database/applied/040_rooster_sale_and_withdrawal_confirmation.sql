-- FarmConnect rooster sale + withdrawal confirmation workflow.
-- Run after 039_task_proof_customer_release_fix.sql.
-- Safety: sale credit is posted exactly once, only after final caretaker proof is approved.

begin;

create extension if not exists pgcrypto;

alter table public.customer_animals
  add column if not exists sale_status text not null default 'not_listed',
  add column if not exists approved_sale_price numeric,
  add column if not exists sold_at timestamptz;

alter table public.task_proofs
  add column if not exists declared_amount numeric;

create table if not exists public.rooster_sale_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  customer_animal_id uuid not null references public.customer_animals(id) on delete restrict,
  status text not null default 'price_requested',
  caretaker_quoted_price numeric,
  approved_sale_price numeric,
  price_care_request_id uuid references public.farm_care_requests(id) on delete set null,
  price_task_id uuid references public.caretaker_tasks(id) on delete set null,
  price_proof_id uuid references public.task_proofs(id) on delete set null,
  release_care_request_id uuid references public.farm_care_requests(id) on delete set null,
  release_task_id uuid references public.caretaker_tasks(id) on delete set null,
  release_proof_id uuid references public.task_proofs(id) on delete set null,
  wallet_transaction_id uuid,
  customer_note text,
  admin_note text,
  reviewed_by_profile_id uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rooster_sale_requests_status_check check (status in (
    'price_requested','price_assigned','price_submitted','price_backjob','price_ready',
    'sale_requested','sale_rejected','release_pending_assignment','release_assigned',
    'release_submitted','release_backjob','completed','cancelled'
  )),
  constraint rooster_sale_positive_price check (
    caretaker_quoted_price is null or caretaker_quoted_price > 0
  ),
  constraint rooster_sale_positive_approved_price check (
    approved_sale_price is null or approved_sale_price > 0
  )
);

create unique index if not exists rooster_sale_one_open_per_animal
  on public.rooster_sale_requests(customer_animal_id)
  where status not in ('completed','cancelled');
create index if not exists idx_rooster_sale_profile
  on public.rooster_sale_requests(profile_id, created_at desc);
create index if not exists idx_rooster_sale_status
  on public.rooster_sale_requests(status, created_at desc);

create table if not exists public.rooster_sale_events (
  id uuid primary key default gen_random_uuid(),
  sale_request_id uuid not null references public.rooster_sale_requests(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null,
  details jsonb not null default '{}'::jsonb,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_rooster_sale_events_request
  on public.rooster_sale_events(sale_request_id, created_at desc);

alter table public.rooster_sale_requests enable row level security;
alter table public.rooster_sale_events enable row level security;

drop policy if exists "rooster sale owner admin read" on public.rooster_sale_requests;
create policy "rooster sale owner admin read" on public.rooster_sale_requests
  for select to authenticated
  using (profile_id = public.current_profile_id() or public.is_admin());

drop policy if exists "rooster sale events owner admin read" on public.rooster_sale_events;
create policy "rooster sale events owner admin read" on public.rooster_sale_events
  for select to authenticated
  using (profile_id = public.current_profile_id() or public.is_admin());

create or replace function public.current_rooster_sale_request(p_customer_animal_id uuid)
returns public.rooster_sale_requests
language sql
stable
security definer
set search_path = public
as $$
  select sale.*
  from public.rooster_sale_requests sale
  where sale.customer_animal_id = p_customer_animal_id
    and sale.status not in ('completed','cancelled')
    and (sale.profile_id = public.current_profile_id() or public.is_admin())
  order by sale.created_at desc
  limit 1
$$;

create or replace function public.customer_request_rooster_sale_price(
  p_customer_animal_id uuid,
  p_customer_note text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_animal public.customer_animals%rowtype;
  v_sale_id uuid;
  v_care_id uuid;
begin
  select id into v_profile_id from public.profiles where auth_user_id = auth.uid() limit 1;
  if v_profile_id is null then raise exception 'LOGIN_REQUIRED'; end if;

  select * into v_animal
  from public.customer_animals
  where id = p_customer_animal_id and profile_id = v_profile_id
  for update;
  if not found then raise exception 'ROOSTER_NOT_FOUND_OR_NOT_OWNED'; end if;
  if v_animal.status in ('sold','removed') then raise exception 'ROOSTER_ALREADY_SOLD'; end if;
  if exists (
    select 1 from public.rooster_sale_requests
    where customer_animal_id = v_animal.id and status not in ('completed','cancelled')
  ) then raise exception 'SALE_REQUEST_ALREADY_OPEN'; end if;

  insert into public.rooster_sale_requests(profile_id, customer_animal_id, customer_note)
  values (v_profile_id, v_animal.id, nullif(trim(coalesce(p_customer_note,'')),''))
  returning id into v_sale_id;

  insert into public.farm_care_requests(
    profile_id, customer_animal_id, rooster_name, rooster_tag, service_name,
    service_category, service_price, required_proof, customer_note, status
  ) values (
    v_profile_id, v_animal.id, coalesce(v_animal.animal_name,'Owned Rooster'),
    v_animal.animal_code, 'Sale Price Inspection', 'sale_price_inspection', 0,
    'Enter the inspected rooster price, upload a clear current photo, then verify the rooster QR.',
    coalesce(nullif(trim(coalesce(p_customer_note,'')),''),'Customer requested a sale price inspection.'),
    'paid_pending_assignment'
  ) returning id into v_care_id;

  update public.rooster_sale_requests
  set price_care_request_id = v_care_id, updated_at = now()
  where id = v_sale_id;

  update public.customer_animals
  set sale_status = 'price_requested', updated_at = now()
  where id = v_animal.id;

  insert into public.rooster_sale_events(sale_request_id, profile_id, event_type, details, actor_profile_id)
  values (v_sale_id, v_profile_id, 'price_requested', jsonb_build_object(
    'customer_animal_id', v_animal.id, 'care_request_id', v_care_id
  ), v_profile_id);

  insert into public.inbox_items(profile_id, category, title, body, created_at)
  values (v_profile_id, 'care', 'Sale Price Inspection Requested',
    'Your rooster is waiting for caretaker price inspection. The final Sell button stays locked until admin approves the submitted price.', now());
  return v_sale_id;
end;
$$;

create or replace function public.customer_confirm_rooster_sale(
  p_sale_request_id uuid,
  p_customer_note text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_sale public.rooster_sale_requests%rowtype;
begin
  select id into v_profile_id from public.profiles where auth_user_id = auth.uid() limit 1;
  if v_profile_id is null then raise exception 'LOGIN_REQUIRED'; end if;
  select * into v_sale from public.rooster_sale_requests
  where id = p_sale_request_id and profile_id = v_profile_id for update;
  if not found then raise exception 'SALE_REQUEST_NOT_FOUND'; end if;
  if v_sale.status not in ('price_ready','sale_rejected') then raise exception 'SALE_PRICE_NOT_READY'; end if;
  if coalesce(v_sale.approved_sale_price,0) <= 0 then raise exception 'APPROVED_PRICE_REQUIRED'; end if;

  update public.rooster_sale_requests
  set status = 'sale_requested', customer_note = coalesce(nullif(trim(coalesce(p_customer_note,'')),''),customer_note),
      admin_note = null, updated_at = now()
  where id = v_sale.id;
  update public.customer_animals set sale_status = 'sale_requested', updated_at = now()
  where id = v_sale.customer_animal_id;
  insert into public.rooster_sale_events(sale_request_id, profile_id, event_type, details, actor_profile_id)
  values (v_sale.id, v_profile_id, 'customer_confirmed_sale', jsonb_build_object('approved_price',v_sale.approved_sale_price),v_profile_id);
  return v_sale.id;
end;
$$;

create or replace function public.admin_review_rooster_sale(
  p_sale_request_id uuid,
  p_decision text,
  p_admin_note text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid;
  v_sale public.rooster_sale_requests%rowtype;
  v_animal public.customer_animals%rowtype;
  v_care_id uuid;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if p_decision not in ('approved','rejected') then raise exception 'INVALID_DECISION'; end if;
  if nullif(trim(coalesce(p_admin_note,'')),'') is null then raise exception 'ADMIN_NOTE_REQUIRED'; end if;
  select id into v_admin_id from public.profiles where auth_user_id = auth.uid() limit 1;
  select * into v_sale from public.rooster_sale_requests where id = p_sale_request_id for update;
  if not found then raise exception 'SALE_REQUEST_NOT_FOUND'; end if;
  if v_sale.status <> 'sale_requested' then raise exception 'SALE_REQUEST_NOT_READY_FOR_ADMIN'; end if;
  select * into v_animal from public.customer_animals where id = v_sale.customer_animal_id;

  if p_decision = 'rejected' then
    update public.rooster_sale_requests set status='sale_rejected', admin_note=p_admin_note,
      reviewed_by_profile_id=v_admin_id, reviewed_at=now(), updated_at=now() where id=v_sale.id;
    update public.customer_animals set sale_status='price_ready', updated_at=now() where id=v_sale.customer_animal_id;
    insert into public.inbox_items(profile_id,category,title,body,created_at)
    values(v_sale.profile_id,'care','Rooster Sale Request Rejected',
      'Admin did not release the rooster for sale. Reason: '||p_admin_note||'. You may review the approved price and submit again.',now());
  else
    insert into public.farm_care_requests(
      profile_id, customer_animal_id, rooster_name, rooster_tag, service_name,
      service_category, service_price, required_proof, customer_note, status, admin_note
    ) values (
      v_sale.profile_id, v_sale.customer_animal_id, coalesce(v_animal.animal_name,'Owned Rooster'),
      v_animal.animal_code, 'Final Sale Confirmation', 'sale_release_confirmation', 0,
      'Read the sale instruction, confirm the rooster is released for sale, and submit documentation. No photo or QR scan is required.',
      'Customer confirmed sale at '||v_sale.approved_sale_price::text||'.', 'paid_pending_assignment', p_admin_note
    ) returning id into v_care_id;
    update public.rooster_sale_requests set status='release_pending_assignment', release_care_request_id=v_care_id,
      admin_note=p_admin_note, reviewed_by_profile_id=v_admin_id, reviewed_at=now(), updated_at=now() where id=v_sale.id;
    update public.customer_animals set sale_status='release_pending_assignment', updated_at=now() where id=v_sale.customer_animal_id;
    insert into public.inbox_items(profile_id,category,title,body,created_at)
    values(v_sale.profile_id,'care','Rooster Sale Approved for Release',
      'Admin approved your sale request. The farm will assign a caretaker for final physical release confirmation.',now());
  end if;
  insert into public.rooster_sale_events(sale_request_id,profile_id,event_type,details,actor_profile_id)
  values(v_sale.id,v_sale.profile_id,'admin_sale_'||p_decision,jsonb_build_object('note',p_admin_note,'release_care_request_id',v_care_id),v_admin_id);
  return v_sale.id;
end;
$$;

create or replace function public.prepare_rooster_sale_task()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_request public.farm_care_requests%rowtype;
  v_sale_id uuid;
  v_qr_identity_id uuid;
  v_qr_payload text;
begin
  select * into v_request from public.farm_care_requests where id = new.care_request_id;
  if not found or v_request.service_category not in ('sale_price_inspection','sale_release_confirmation') then return new; end if;
  select id into v_sale_id from public.rooster_sale_requests
  where price_care_request_id=v_request.id or release_care_request_id=v_request.id limit 1;
  new.workflow_type := v_request.service_category;
  new.qr_scan_required := v_request.service_category = 'sale_price_inspection';
  if v_request.service_category = 'sale_price_inspection' then
    select qr_identity_id, qr_payload into v_qr_identity_id, v_qr_payload
    from public.customer_animals where id=v_request.customer_animal_id;
    new.qr_identity_id := v_qr_identity_id;
    new.qr_payload := v_qr_payload;
  end if;
  new.task_metadata := coalesce(new.task_metadata,'{}'::jsonb)||jsonb_build_object('sale_request_id',v_sale_id);
  if v_request.service_category='sale_price_inspection' then
    new.required_proof := 'Enter inspected price, upload clear current rooster photo, and verify QR.';
  else
    new.required_proof := 'Documentation and caretaker acknowledgement only. No photo or QR required.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prepare_rooster_sale_task on public.caretaker_tasks;
create trigger trg_prepare_rooster_sale_task
before insert on public.caretaker_tasks
for each row execute function public.prepare_rooster_sale_task();

create or replace function public.track_rooster_sale_task_assignment()
returns trigger language plpgsql set search_path=public as $$
begin
  if new.workflow_type='sale_price_inspection' then
    update public.rooster_sale_requests set status='price_assigned',price_task_id=new.id,updated_at=now()
    where id=nullif(new.task_metadata->>'sale_request_id','')::uuid;
  elsif new.workflow_type='sale_release_confirmation' then
    update public.rooster_sale_requests set status='release_assigned',release_task_id=new.id,updated_at=now()
    where id=nullif(new.task_metadata->>'sale_request_id','')::uuid;
  end if;
  return new;
end $$;
drop trigger if exists trg_track_rooster_sale_task_assignment on public.caretaker_tasks;
create trigger trg_track_rooster_sale_task_assignment after insert on public.caretaker_tasks
for each row execute function public.track_rooster_sale_task_assignment();

create or replace function public.caretaker_submit_rooster_sale_task(
  p_task_id uuid,
  p_declared_amount numeric default null,
  p_proof_urls text[] default '{}'::text[],
  p_free_note text default null,
  p_qr_verified boolean default false,
  p_serial_exception boolean default false
) returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_profile_id uuid;
  v_task public.caretaker_tasks%rowtype;
  v_proof_id uuid;
  v_sale_id uuid;
begin
  select id into v_profile_id from public.profiles where auth_user_id=auth.uid() limit 1;
  if v_profile_id is null then raise exception 'LOGIN_REQUIRED'; end if;
  select task.* into v_task from public.caretaker_tasks task
  join public.caretakers caretaker on caretaker.id=task.caretaker_id
  where task.id=p_task_id
    and (caretaker.profile_id=v_profile_id or caretaker.caretaker_profile_id=v_profile_id)
    and task.status in ('active','in_progress','backjob')
    and task.workflow_type in ('sale_price_inspection','sale_release_confirmation')
  for update of task;
  if not found then raise exception 'SALE_TASK_NOT_ASSIGNED_TO_CURRENT_CARETAKER'; end if;
  if nullif(trim(coalesce(p_free_note,'')),'') is null then raise exception 'WORK_DOCUMENTATION_REQUIRED'; end if;
  v_sale_id := nullif(v_task.task_metadata->>'sale_request_id','')::uuid;
  if v_sale_id is null then raise exception 'SALE_REQUEST_LINK_MISSING'; end if;

  if v_task.workflow_type='sale_price_inspection' then
    if coalesce(p_declared_amount,0)<=0 then raise exception 'ROOSTER_PRICE_REQUIRED'; end if;
    if coalesce(array_length(p_proof_urls,1),0)=0 then raise exception 'PROOF_FILE_REQUIRED'; end if;
    if not p_qr_verified and not p_serial_exception then raise exception 'QR_VERIFICATION_REQUIRED'; end if;
  end if;

  insert into public.task_proofs(
    task_id,caretaker_task_id,care_request_id,profile_id,caretaker_id,proof_type,
    proof_url,thumbnail_url,proof_file_urls,preset_note,free_note,qr_verified,serial_exception,
    proof_check_status,admin_review_status,captured_at,declared_amount
  ) values (
    v_task.id,v_task.id,v_task.care_request_id,v_task.profile_id,v_task.caretaker_id,
    case when v_task.workflow_type='sale_price_inspection' then 'sale_price_photo' else 'sale_release_acknowledgement' end,
    case when v_task.workflow_type='sale_price_inspection' then p_proof_urls[1] else 'farmconnect://sale-release/'||v_task.id::text end,
    case when v_task.workflow_type='sale_price_inspection' then p_proof_urls[1] else null end,
    case when v_task.workflow_type='sale_price_inspection' then p_proof_urls else '{}'::text[] end,
    case when v_task.workflow_type='sale_price_inspection' then 'Rooster price inspection completed' else 'Final sale release acknowledged' end,
    p_free_note,p_qr_verified,p_serial_exception,
    case when p_qr_verified or v_task.workflow_type='sale_release_confirmation' then 'passed' else 'needs_review' end,
    'pending',now(),p_declared_amount
  ) returning id into v_proof_id;
  update public.caretaker_tasks set status='submitted',submitted_at=now(),updated_at=now() where id=v_task.id;
  update public.farm_care_requests set status='proof_submitted',updated_at=now() where id=v_task.care_request_id;
  update public.rooster_sale_requests
  set status=case when v_task.workflow_type='sale_price_inspection' then 'price_submitted' else 'release_submitted' end,
      caretaker_quoted_price=case when v_task.workflow_type='sale_price_inspection' then p_declared_amount else caretaker_quoted_price end,
      price_proof_id=case when v_task.workflow_type='sale_price_inspection' then v_proof_id else price_proof_id end,
      release_proof_id=case when v_task.workflow_type='sale_release_confirmation' then v_proof_id else release_proof_id end,
      updated_at=now()
  where id=v_sale_id;
  insert into public.rooster_sale_events(sale_request_id,profile_id,event_type,details,actor_profile_id)
  values(v_sale_id,v_task.profile_id,'caretaker_'||v_task.workflow_type||'_submitted',
    jsonb_build_object('task_id',v_task.id,'proof_id',v_proof_id,'declared_amount',p_declared_amount),v_profile_id);
  return v_proof_id;
end;
$$;

create or replace function public.finalize_rooster_sale_from_proof()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_task public.caretaker_tasks%rowtype;
  v_sale public.rooster_sale_requests%rowtype;
  v_wallet_tx_id uuid;
begin
  if old.admin_review_status is not distinct from new.admin_review_status or new.admin_review_status='pending' then return new; end if;
  select * into v_task from public.caretaker_tasks where id=coalesce(new.caretaker_task_id,new.task_id);
  if not found or v_task.workflow_type not in ('sale_price_inspection','sale_release_confirmation') then return new; end if;
  select * into v_sale from public.rooster_sale_requests
  where id=nullif(v_task.task_metadata->>'sale_request_id','')::uuid for update;
  if not found then raise exception 'SALE_REQUEST_NOT_FOUND_FOR_PROOF'; end if;

  if v_task.workflow_type='sale_price_inspection' then
    if new.admin_review_status='approved' then
      if coalesce(new.declared_amount,0)<=0 then raise exception 'APPROVED_PRICE_MISSING'; end if;
      update public.rooster_sale_requests set status='price_ready',caretaker_quoted_price=new.declared_amount,
        approved_sale_price=new.declared_amount,price_proof_id=new.id,admin_note=new.admin_note,
        reviewed_by_profile_id=new.reviewed_by_profile_id,reviewed_at=now(),updated_at=now() where id=v_sale.id;
      update public.customer_animals set sale_status='price_ready',approved_sale_price=new.declared_amount,updated_at=now()
      where id=v_sale.customer_animal_id;
      insert into public.inbox_items(profile_id,category,title,body,created_at)
      values(v_sale.profile_id,'care','Rooster Sale Price Ready',
        'Admin approved the caretaker inspection price of '||new.declared_amount::text||'. Open My Roosters to review and confirm the sale.',now());
    else
      update public.rooster_sale_requests set status='price_backjob',admin_note=new.admin_note,updated_at=now() where id=v_sale.id;
      update public.customer_animals set sale_status='price_inspection',updated_at=now() where id=v_sale.customer_animal_id;
    end if;
  else
    if new.admin_review_status='approved' then
      if v_sale.status='completed' or v_sale.wallet_transaction_id is not null then return new; end if;
      update public.profiles set wallet_balance=coalesce(wallet_balance,0)+v_sale.approved_sale_price,updated_at=now()
      where id=v_sale.profile_id;
      insert into public.wallet_transactions(profile_id,transaction_type,amount,description,status,created_at)
      values(v_sale.profile_id,'ROOSTER_SALE_CREDIT',v_sale.approved_sale_price,
        'Rooster sale '||v_sale.id::text,'COMPLETED',now()) returning id into v_wallet_tx_id;
      update public.customer_animals set status='sold',sale_status='completed',sold_at=now(),updated_at=now()
      where id=v_sale.customer_animal_id;
      update public.rooster_sale_requests set status='completed',wallet_transaction_id=v_wallet_tx_id,
        release_proof_id=new.id,completed_at=now(),updated_at=now() where id=v_sale.id;
      insert into public.inbox_items(profile_id,category,title,body,created_at)
      values(v_sale.profile_id,'wallet','Rooster Sale Completed',
        'Your rooster sale was completed. '||v_sale.approved_sale_price::text||' was added to your wallet and logged.',now());
    else
      update public.rooster_sale_requests set status='release_backjob',admin_note=new.admin_note,updated_at=now() where id=v_sale.id;
      update public.customer_animals set sale_status='release_backjob',updated_at=now() where id=v_sale.customer_animal_id;
    end if;
  end if;
  insert into public.rooster_sale_events(sale_request_id,profile_id,event_type,details,actor_profile_id)
  values(v_sale.id,v_sale.profile_id,v_task.workflow_type||'_'||new.admin_review_status,
    jsonb_build_object('proof_id',new.id,'admin_note',new.admin_note,'wallet_transaction_id',v_wallet_tx_id),new.reviewed_by_profile_id);
  return new;
end;
$$;

drop trigger if exists trg_finalize_rooster_sale_from_proof on public.task_proofs;
create trigger trg_finalize_rooster_sale_from_proof
after update of admin_review_status on public.task_proofs
for each row execute function public.finalize_rooster_sale_from_proof();

-- Customer-owned payout methods are saved once, snapshotted into every
-- withdrawal request, and remain private to their owner and admins.
create table if not exists public.customer_payout_methods (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null,
  account_holder text not null,
  account_number text not null,
  status text not null default 'active',
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.customer_payout_methods
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists profile_id uuid references public.profiles(id) on delete cascade,
  add column if not exists provider text,
  add column if not exists account_holder text,
  add column if not exists account_number text,
  add column if not exists status text not null default 'active',
  add column if not exists is_default boolean not null default false,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create index if not exists customer_payout_methods_profile_idx
  on public.customer_payout_methods(profile_id,status,created_at desc);

alter table public.customer_payout_methods enable row level security;
drop policy if exists "payout methods owner read" on public.customer_payout_methods;
create policy "payout methods owner read" on public.customer_payout_methods
for select to authenticated using (
  profile_id=public.current_profile_id() or public.is_admin()
);

create or replace function public.customer_save_payout_method(
  p_provider text,p_account_holder text,p_account_number text,p_is_default boolean default true
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_profile_id uuid; v_id uuid;
begin
  select id into v_profile_id from public.profiles where auth_user_id=auth.uid() limit 1;
  if v_profile_id is null then raise exception 'LOGIN_REQUIRED'; end if;
  if nullif(trim(coalesce(p_provider,'')),'') is null
    or nullif(trim(coalesce(p_account_holder,'')),'') is null
    or length(trim(coalesce(p_account_number,'')))<6 then
    raise exception 'VALID_PAYOUT_DETAILS_REQUIRED';
  end if;
  if p_is_default then
    update public.customer_payout_methods set is_default=false,updated_at=now()
    where profile_id=v_profile_id and status='active';
  end if;
  select id into v_id from public.customer_payout_methods
  where profile_id=v_profile_id and lower(provider)=lower(trim(p_provider))
    and account_number=trim(p_account_number) and status='active'
  order by created_at desc limit 1;
  if v_id is null then
    insert into public.customer_payout_methods(profile_id,provider,account_holder,account_number,status,is_default)
    values(v_profile_id,trim(p_provider),trim(p_account_holder),trim(p_account_number),'active',coalesce(p_is_default,false))
    returning id into v_id;
  else
    update public.customer_payout_methods set account_holder=trim(p_account_holder),
      is_default=coalesce(p_is_default,false),updated_at=now() where id=v_id;
  end if;
  insert into public.inbox_items(profile_id,category,title,body,created_at)
  values(v_profile_id,'security','Payout Method Saved',
    trim(p_provider)||' payout details were saved. Contact admin immediately if you did not make this change.',now());
  return v_id;
end $$;

-- Withdrawal funds are reserved at request time, refunded on rejection, and
-- permanently released only after the customer confirms the external payout.
alter table public.withdrawal_requests
  add column if not exists wallet_hold_applied boolean not null default false,
  add column if not exists wallet_hold_applied_at timestamptz,
  add column if not exists wallet_refunded_at timestamptz,
  add column if not exists customer_confirmation_note text;

create or replace function public.customer_submit_withdrawal_request(
  p_amount numeric,p_payout_method text,p_payout_holder text,p_payout_account text,p_customer_note text default null
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_profile public.profiles%rowtype; v_id uuid;
begin
  select * into v_profile from public.profiles where auth_user_id=auth.uid() for update;
  if v_profile.id is null then raise exception 'LOGIN_REQUIRED'; end if;
  if coalesce(v_profile.kyc_status,v_profile.verification_status,'') not in ('approved','verified','passed') then raise exception 'KYC_REQUIRED'; end if;
  if coalesce(p_amount,0)<100 then raise exception 'MINIMUM_WITHDRAWAL_100'; end if;
  if coalesce(v_profile.wallet_balance,0)<p_amount then raise exception 'INSUFFICIENT_WALLET_BALANCE'; end if;
  if nullif(trim(coalesce(p_payout_method,'')),'') is null or nullif(trim(coalesce(p_payout_holder,'')),'') is null
    or nullif(trim(coalesce(p_payout_account,'')),'') is null then raise exception 'PAYOUT_DETAILS_REQUIRED'; end if;
  update public.profiles set wallet_balance=coalesce(wallet_balance,0)-p_amount,
    wallet_on_hold=coalesce(wallet_on_hold,0)+p_amount,updated_at=now() where id=v_profile.id;
  insert into public.withdrawal_requests(profile_id,amount,payout_method,payout_holder,payout_account,customer_note,status,wallet_hold_applied,wallet_hold_applied_at)
  values(v_profile.id,p_amount,trim(p_payout_method),trim(p_payout_holder),trim(p_payout_account),p_customer_note,'for_review',true,now()) returning id into v_id;
  insert into public.wallet_transactions(profile_id,transaction_type,amount,description,status,created_at)
  values(v_profile.id,'WITHDRAWAL_HOLD',p_amount,'Withdrawal hold '||v_id::text,'PENDING',now());
  insert into public.withdrawal_evidence_logs(withdrawal_request_id,profile_id,event_type,title,details,actor_profile_id)
  values(v_id,v_profile.id,'withdrawal_submitted','Withdrawal submitted and funds held',jsonb_build_object('amount',p_amount,'method',p_payout_method),v_profile.id);
  insert into public.inbox_items(profile_id,category,title,body,created_at)
  values(v_profile.id,'withdraw','Withdrawal For Review','Your withdrawal was submitted and the amount is now held until payout confirmation.',now());
  return v_id;
end $$;

create or replace function public.admin_review_withdrawal_request(
  p_withdrawal_request_id uuid,p_decision text,p_admin_note text default null,
  p_admin_reference_number text default null,p_admin_receipt_url text default null,p_admin_receipt_file_name text default null
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_admin_id uuid; v_request public.withdrawal_requests%rowtype; v_status text;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if p_decision not in ('approved','rejected','needs_info') then raise exception 'INVALID_DECISION'; end if;
  if p_decision='approved' and (nullif(trim(coalesce(p_admin_reference_number,'')),'') is null or nullif(trim(coalesce(p_admin_receipt_url,'')),'') is null)
    then raise exception 'PAYOUT_REFERENCE_AND_RECEIPT_REQUIRED'; end if;
  if p_decision<>'approved' and nullif(trim(coalesce(p_admin_note,'')),'') is null then raise exception 'ADMIN_NOTE_REQUIRED'; end if;
  select id into v_admin_id from public.profiles where auth_user_id=auth.uid() limit 1;
  select * into v_request from public.withdrawal_requests where id=p_withdrawal_request_id for update;
  if not found then raise exception 'WITHDRAWAL_NOT_FOUND'; end if;
  if v_request.status not in ('for_review','needs_info') then raise exception 'WITHDRAWAL_NOT_READY_FOR_REVIEW'; end if;
  v_status:=case when p_decision='approved' then 'sent_for_customer_confirmation' else p_decision end;
  update public.withdrawal_requests set status=v_status,admin_note=p_admin_note,
    admin_reference_number=nullif(trim(coalesce(p_admin_reference_number,'')),''),admin_receipt_url=nullif(trim(coalesce(p_admin_receipt_url,'')),''),
    admin_receipt_file_name=nullif(trim(coalesce(p_admin_receipt_file_name,'')),''),admin_reviewed_by=v_admin_id,admin_reviewed_at=now(),updated_at=now()
  where id=v_request.id;
  if p_decision='rejected' and v_request.wallet_hold_applied and v_request.wallet_refunded_at is null then
    update public.profiles set wallet_balance=coalesce(wallet_balance,0)+v_request.amount,
      wallet_on_hold=greatest(coalesce(wallet_on_hold,0)-v_request.amount,0),updated_at=now() where id=v_request.profile_id;
    update public.withdrawal_requests set wallet_refunded_at=now() where id=v_request.id;
    insert into public.wallet_transactions(profile_id,transaction_type,amount,description,status,created_at)
    values(v_request.profile_id,'WITHDRAWAL_REFUND',v_request.amount,'Rejected withdrawal refund '||v_request.id::text,'COMPLETED',now());
  end if;
  insert into public.withdrawal_evidence_logs(withdrawal_request_id,profile_id,event_type,title,details,actor_profile_id)
  values(v_request.id,v_request.profile_id,'admin_'||p_decision,'Admin withdrawal decision: '||p_decision,
    jsonb_build_object('amount',v_request.amount,'payout_method',v_request.payout_method,'payout_holder',v_request.payout_holder,
      'payout_account',v_request.payout_account,'admin_note',p_admin_note,'reference',p_admin_reference_number,
      'receipt_url',p_admin_receipt_url,'receipt_file_name',p_admin_receipt_file_name),v_admin_id);
  insert into public.inbox_items(profile_id,category,title,body,created_at)
  values(v_request.profile_id,'withdraw',case when p_decision='approved' then 'Confirm Withdrawal Payout' when p_decision='rejected' then 'Withdrawal Rejected and Refunded' else 'Withdrawal Needs Information' end,
    case when p_decision='approved' then 'Admin sent payout proof. Open Withdrawal, check method, reference and receipt, then confirm or report a problem.'
      when p_decision='rejected' then 'Withdrawal rejected. Held funds were returned. Reason: '||p_admin_note
      else 'Admin needs more information: '||p_admin_note end,now());
  return v_request.id;
end $$;

create or replace function public.customer_confirm_withdrawal_result(
  p_withdrawal_request_id uuid,p_received boolean,p_customer_note text default null
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_profile_id uuid; v_request public.withdrawal_requests%rowtype;
begin
  select id into v_profile_id from public.profiles where auth_user_id=auth.uid() limit 1;
  if v_profile_id is null then raise exception 'LOGIN_REQUIRED'; end if;
  select * into v_request from public.withdrawal_requests where id=p_withdrawal_request_id and profile_id=v_profile_id for update;
  if not found then raise exception 'WITHDRAWAL_NOT_FOUND'; end if;
  if v_request.status<>'sent_for_customer_confirmation' then raise exception 'WITHDRAWAL_NOT_WAITING_FOR_CONFIRMATION'; end if;
  if not p_received and nullif(trim(coalesce(p_customer_note,'')),'') is null then raise exception 'PROBLEM_NOTE_REQUIRED'; end if;
  if p_received then
    update public.profiles set wallet_on_hold=greatest(coalesce(wallet_on_hold,0)-v_request.amount,0),updated_at=now() where id=v_profile_id;
    update public.withdrawal_requests set status='completed',customer_confirmed_at=now(),customer_confirmation_note=p_customer_note,updated_at=now() where id=v_request.id;
  else
    update public.withdrawal_requests set status='needs_info',customer_confirmation_note=p_customer_note,updated_at=now() where id=v_request.id;
  end if;
  insert into public.withdrawal_evidence_logs(withdrawal_request_id,profile_id,event_type,title,details,actor_profile_id)
  values(v_request.id,v_profile_id,case when p_received then 'customer_confirmed_received' else 'customer_reported_payout_problem' end,
    case when p_received then 'Customer confirmed payout received' else 'Customer reported payout problem' end,
    jsonb_build_object('reference',v_request.admin_reference_number,'method',v_request.payout_method,'note',p_customer_note),v_profile_id);
  return v_request.id;
end $$;

revoke all on function public.customer_request_rooster_sale_price(uuid,text) from public,anon;
revoke all on function public.customer_confirm_rooster_sale(uuid,text) from public,anon;
revoke all on function public.admin_review_rooster_sale(uuid,text,text) from public,anon;
revoke all on function public.caretaker_submit_rooster_sale_task(uuid,numeric,text[],text,boolean,boolean) from public,anon;
revoke all on function public.customer_confirm_withdrawal_result(uuid,boolean,text) from public,anon;
revoke all on function public.customer_save_payout_method(text,text,text,boolean) from public,anon;
grant execute on function public.current_rooster_sale_request(uuid) to authenticated;
grant execute on function public.customer_request_rooster_sale_price(uuid,text) to authenticated;
grant execute on function public.customer_confirm_rooster_sale(uuid,text) to authenticated;
grant execute on function public.admin_review_rooster_sale(uuid,text,text) to authenticated;
grant execute on function public.caretaker_submit_rooster_sale_task(uuid,numeric,text[],text,boolean,boolean) to authenticated;
grant execute on function public.customer_confirm_withdrawal_result(uuid,boolean,text) to authenticated;
grant execute on function public.customer_save_payout_method(text,text,text,boolean) to authenticated;

create or replace function public.rooster_sale_workflow_version()
returns integer language sql stable set search_path=public as $$ select 40 $$;

commit;

select 'rooster_sale_workflow_ready' as check_name,count(*) as count
from information_schema.routines where routine_schema='public' and routine_name='rooster_sale_workflow_version'
union all select 'rooster_sale_requests_ready',count(*) from information_schema.tables where table_schema='public' and table_name='rooster_sale_requests'
union all select 'withdrawal_customer_confirmation_ready',count(*) from information_schema.routines where routine_schema='public' and routine_name='customer_confirm_withdrawal_result'
union all select 'customer_payout_methods_ready',count(*) from information_schema.tables where table_schema='public' and table_name='customer_payout_methods'
union all select 'customer_save_payout_method_ready',count(*) from information_schema.routines where routine_schema='public' and routine_name='customer_save_payout_method';
