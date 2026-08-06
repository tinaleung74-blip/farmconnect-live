-- FarmConnect approved rooster purchase -> QR identity -> QR tagging task automation.
-- Run after 025, 026, 028, and 033.
--
-- Readers:
-- 1. system_read_approved_rooster_purchase: reacts only to a customer_animal created
--    from an approved Farm Buy payment.
-- 2. system_read_assigned_qr_task: recognizes a QR-tagging request when admin assigns it.
--
-- Engines:
-- 1. Existing migration 025 remains the purchase fulfillment engine.
-- 2. create_or_get_animal_qr_identity creates one stable QR identity per animal.
-- 3. create_qr_tagging_task_request creates one assignable system request per identity.

begin;

create extension if not exists pgcrypto;

create table if not exists public.animal_qr_identities (
  id uuid primary key default gen_random_uuid(),
  customer_animal_id uuid not null references public.customer_animals(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  payment_request_id uuid references public.manual_payment_requests(id) on delete set null,
  qr_token text not null,
  qr_payload text not null,
  status text not null default 'reserved'
    check (status in ('reserved','assignment_ready','assigned','verified','revoked')),
  care_request_id uuid references public.farm_care_requests(id) on delete set null,
  caretaker_task_id uuid references public.caretaker_tasks(id) on delete set null,
  verified_at timestamptz,
  verified_by_profile_id uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint animal_qr_identities_customer_animal_key unique (customer_animal_id),
  constraint animal_qr_identities_qr_token_key unique (qr_token)
);

create table if not exists public.animal_qr_events (
  id uuid primary key default gen_random_uuid(),
  qr_identity_id uuid not null references public.animal_qr_identities(id) on delete cascade,
  customer_animal_id uuid not null references public.customer_animals(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null,
  details jsonb not null default '{}'::jsonb,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.customer_animals
  add column if not exists qr_identity_id uuid references public.animal_qr_identities(id) on delete set null,
  add column if not exists qr_status text not null default 'not_required';

alter table public.farm_care_requests
  add column if not exists system_generated boolean not null default false,
  add column if not exists request_origin text not null default 'customer',
  add column if not exists system_key text,
  add column if not exists qr_identity_id uuid references public.animal_qr_identities(id) on delete set null;

create unique index if not exists farm_care_requests_system_key_unique
  on public.farm_care_requests(system_key)
  where system_key is not null;

alter table public.caretaker_tasks
  add column if not exists workflow_type text not null default 'standard_care',
  add column if not exists qr_scan_required boolean not null default true,
  add column if not exists qr_identity_id uuid references public.animal_qr_identities(id) on delete set null,
  add column if not exists qr_payload text,
  add column if not exists task_metadata jsonb not null default '{}'::jsonb;

create index if not exists idx_animal_qr_identities_profile
  on public.animal_qr_identities(profile_id, created_at desc);
create index if not exists idx_animal_qr_events_identity
  on public.animal_qr_events(qr_identity_id, created_at desc);
create index if not exists idx_caretaker_tasks_workflow
  on public.caretaker_tasks(workflow_type, status, created_at desc);

alter table public.animal_qr_identities enable row level security;
alter table public.animal_qr_events enable row level security;

drop policy if exists "animal qr identity read linked" on public.animal_qr_identities;
create policy "animal qr identity read linked"
on public.animal_qr_identities for select to authenticated
using (
  profile_id = public.current_profile_id()
  or public.is_admin()
  or exists (
    select 1
    from public.caretaker_tasks task
    join public.caretakers caretaker on caretaker.id = task.caretaker_id
    where task.qr_identity_id = animal_qr_identities.id
      and (caretaker.profile_id = public.current_profile_id()
        or caretaker.caretaker_profile_id = public.current_profile_id())
  )
);

drop policy if exists "animal qr identity admin write" on public.animal_qr_identities;
create policy "animal qr identity admin write"
on public.animal_qr_identities for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "animal qr events read linked" on public.animal_qr_events;
create policy "animal qr events read linked"
on public.animal_qr_events for select to authenticated
using (profile_id = public.current_profile_id() or public.is_admin());

drop policy if exists "animal qr events admin write" on public.animal_qr_events;
create policy "animal qr events admin write"
on public.animal_qr_events for all to authenticated
using (public.is_admin())
with check (public.is_admin());

create or replace function public.create_or_get_animal_qr_identity(
  p_customer_animal_id uuid,
  p_payment_request_id uuid
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_animal public.customer_animals%rowtype;
  v_identity_id uuid;
  v_token text;
begin
  select * into v_animal
  from public.customer_animals
  where id = p_customer_animal_id
  for update;

  if not found then raise exception 'CUSTOMER_ANIMAL_NOT_FOUND'; end if;

  select id into v_identity_id
  from public.animal_qr_identities
  where customer_animal_id = p_customer_animal_id;

  if v_identity_id is not null then return v_identity_id; end if;

  v_token := 'FCQR-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16));

  insert into public.animal_qr_identities(
    customer_animal_id, profile_id, payment_request_id, qr_token, qr_payload,
    status, metadata
  ) values (
    v_animal.id,
    v_animal.profile_id,
    p_payment_request_id,
    v_token,
    'farmconnect:rooster:' || v_token,
    'reserved',
    jsonb_build_object(
      'animal_code', v_animal.animal_code,
      'breed', v_animal.breed_snapshot,
      'bloodline', v_animal.bloodline_snapshot,
      'source', 'approved_farm_buy'
    )
  )
  on conflict (customer_animal_id) do update
    set updated_at = now()
  returning id into v_identity_id;

  update public.customer_animals
  set qr_identity_id = v_identity_id,
      qr_status = 'tagging_required',
      status = 'pending_qr_tagging',
      ownership_metadata = coalesce(ownership_metadata, '{}'::jsonb)
        || jsonb_build_object('qr_identity_id', v_identity_id, 'qr_status', 'tagging_required'),
      updated_at = now()
  where id = v_animal.id;

  insert into public.animal_qr_events(
    qr_identity_id, customer_animal_id, profile_id, event_type, details
  ) values (
    v_identity_id, v_animal.id, v_animal.profile_id, 'identity_reserved',
    jsonb_build_object('payment_request_id', p_payment_request_id, 'qr_token', v_token)
  );

  return v_identity_id;
end;
$$;

create or replace function public.create_qr_tagging_task_request(
  p_qr_identity_id uuid
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_identity public.animal_qr_identities%rowtype;
  v_animal public.customer_animals%rowtype;
  v_request_id uuid;
  v_system_key text;
begin
  select * into v_identity
  from public.animal_qr_identities
  where id = p_qr_identity_id
  for update;

  if not found then raise exception 'QR_IDENTITY_NOT_FOUND'; end if;

  select * into v_animal
  from public.customer_animals
  where id = v_identity.customer_animal_id;

  v_system_key := 'qr-tagging:' || v_identity.id::text;

  insert into public.farm_care_requests(
    profile_id, customer_animal_id, rooster_name, rooster_tag,
    service_name, service_category, service_price, required_proof,
    customer_note, status, payment_request_id, system_generated,
    request_origin, system_key, qr_identity_id
  ) values (
    v_identity.profile_id,
    v_identity.customer_animal_id,
    coalesce(v_animal.animal_name, v_animal.source_product_name, 'Purchased rooster'),
    coalesce(v_animal.animal_code, v_identity.qr_token),
    'QR Tagging',
    'system_qr_tagging',
    0,
    'Attach the generated QR tag, write documentation, and upload clear rooster and QR-tag photos.',
    'System request created after approved rooster purchase.',
    'paid_pending_assignment',
    v_identity.payment_request_id,
    true,
    'approved_rooster_purchase',
    v_system_key,
    v_identity.id
  )
  on conflict (system_key) where system_key is not null do update
    set updated_at = now()
  returning id into v_request_id;

  update public.animal_qr_identities
  set care_request_id = v_request_id,
      status = case when status = 'reserved' then 'assignment_ready' else status end,
      updated_at = now()
  where id = v_identity.id;

  insert into public.animal_qr_events(
    qr_identity_id, customer_animal_id, profile_id, event_type, details
  )
  select v_identity.id, v_identity.customer_animal_id, v_identity.profile_id,
         'tagging_request_created', jsonb_build_object('care_request_id', v_request_id)
  where not exists (
    select 1 from public.animal_qr_events
    where qr_identity_id = v_identity.id and event_type = 'tagging_request_created'
  );

  insert into public.inbox_items(profile_id, category, title, body, created_at)
  select v_identity.profile_id, 'farm_update', 'Rooster QR Tagging Scheduled',
         'Your purchased rooster now has reserved QR ' || v_identity.qr_token || '. Admin will assign a caretaker to attach and verify the tag.', now()
  where not exists (
    select 1 from public.inbox_items
    where profile_id = v_identity.profile_id
      and title = 'Rooster QR Tagging Scheduled'
      and body like '%' || v_identity.qr_token || '%'
  );

  return v_request_id;
end;
$$;

create or replace function public.system_read_approved_rooster_purchase()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment_id uuid;
  v_identity_id uuid;
begin
  if new.acquired_from <> 'farm_buy' then return new; end if;

  begin
    v_payment_id := nullif(new.ownership_metadata ->> 'payment_request_id', '')::uuid;
  exception when invalid_text_representation then
    return new;
  end;

  if v_payment_id is null or not exists (
    select 1 from public.manual_payment_requests payment
    where payment.id = v_payment_id
      and payment.profile_id = new.profile_id
      and payment.source_type = 'farm_buy'
      and payment.status = 'approved'
  ) then
    return new;
  end if;

  v_identity_id := public.create_or_get_animal_qr_identity(new.id, v_payment_id);
  perform public.create_qr_tagging_task_request(v_identity_id);
  return new;
end;
$$;

drop trigger if exists trg_read_approved_rooster_purchase on public.customer_animals;
create trigger trg_read_approved_rooster_purchase
after insert on public.customer_animals
for each row execute function public.system_read_approved_rooster_purchase();

create or replace function public.system_read_assigned_qr_task()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.farm_care_requests%rowtype;
  v_identity public.animal_qr_identities%rowtype;
begin
  if new.care_request_id is null then return new; end if;

  select * into v_request
  from public.farm_care_requests
  where id = new.care_request_id;

  if not found or v_request.service_category <> 'system_qr_tagging' then
    return new;
  end if;

  select * into v_identity
  from public.animal_qr_identities
  where id = v_request.qr_identity_id;

  new.workflow_type := 'qr_tagging';
  new.qr_scan_required := false;
  new.qr_identity_id := v_identity.id;
  new.qr_payload := v_identity.qr_payload;
  new.task_type := 'QR Tagging';
  new.required_proof := 'Work documentation plus clear rooster and attached QR-tag photos.';
  new.task_metadata := coalesce(new.task_metadata, '{}'::jsonb) || jsonb_build_object(
    'reader', 'assigned_qr_task',
    'qr_token', v_identity.qr_token,
    'customer_animal_id', v_identity.customer_animal_id
  );
  return new;
end;
$$;

drop trigger if exists trg_read_assigned_qr_task_before on public.caretaker_tasks;
create trigger trg_read_assigned_qr_task_before
before insert or update of care_request_id on public.caretaker_tasks
for each row execute function public.system_read_assigned_qr_task();

create or replace function public.system_link_assigned_qr_task()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.workflow_type = 'qr_tagging' and new.qr_identity_id is not null then
    update public.animal_qr_identities
    set caretaker_task_id = new.id,
        status = 'assigned',
        updated_at = now()
    where id = new.qr_identity_id;

    update public.customer_animals
    set qr_status = 'tagging_assigned', updated_at = now()
    where qr_identity_id = new.qr_identity_id;

    insert into public.animal_qr_events(
      qr_identity_id, customer_animal_id, profile_id, event_type, details, actor_profile_id
    )
    select identity.id, identity.customer_animal_id, identity.profile_id,
           'tagging_task_assigned',
           jsonb_build_object('caretaker_task_id', new.id, 'caretaker_id', new.caretaker_id),
           new.assigned_by_profile_id
    from public.animal_qr_identities identity
    where identity.id = new.qr_identity_id
      and not exists (
        select 1 from public.animal_qr_events event
        where event.qr_identity_id = identity.id
          and event.event_type = 'tagging_task_assigned'
          and event.details ->> 'caretaker_task_id' = new.id::text
      );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_link_assigned_qr_task_after on public.caretaker_tasks;
create trigger trg_link_assigned_qr_task_after
after insert or update of caretaker_id on public.caretaker_tasks
for each row execute function public.system_link_assigned_qr_task();

-- Special submission rule: QR-tagging creates the tag, so it requires photos and
-- documentation but intentionally does not require scanning that same QR first.
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
  v_is_qr_tagging boolean;
begin
  select id into v_profile_id from public.profiles where auth_user_id = auth.uid() limit 1;
  if v_profile_id is null then raise exception 'LOGIN_REQUIRED'; end if;

  select id into v_caretaker_id
  from public.caretakers
  where profile_id = v_profile_id or caretaker_profile_id = v_profile_id
  order by created_at asc limit 1;
  if v_caretaker_id is null then raise exception 'CARETAKER_PROFILE_REQUIRED'; end if;

  select * into v_task
  from public.caretaker_tasks
  where id = p_task_id
    and caretaker_id = v_caretaker_id
    and status in ('active','in_progress','backjob')
  for update;
  if not found then raise exception 'TASK_NOT_ASSIGNED_TO_CARETAKER'; end if;

  v_is_qr_tagging := v_task.workflow_type = 'qr_tagging' and not v_task.qr_scan_required;
  if nullif(trim(coalesce(p_free_note, '')), '') is null then raise exception 'WORK_DOCUMENTATION_REQUIRED'; end if;
  if p_proof_url is null then raise exception 'PROOF_FILE_REQUIRED'; end if;

  insert into public.task_proofs(
    caretaker_task_id, care_request_id, profile_id, caretaker_id, proof_type,
    proof_url, thumbnail_url, preset_note, free_note, qr_verified, serial_exception,
    feed_quantity_used, feed_unit, proof_check_status, admin_review_status, captured_at
  ) values (
    v_task.id, v_task.care_request_id, v_task.profile_id, v_task.caretaker_id,
    'photo', p_proof_url, p_proof_url, p_preset_note, p_free_note,
    case when v_is_qr_tagging then false else coalesce(p_qr_verified, true) end,
    case when v_is_qr_tagging then false else coalesce(p_serial_exception, false) end,
    p_feed_quantity_used, p_feed_unit,
    case when v_is_qr_tagging or coalesce(p_qr_verified, true) then 'passed' else 'needs_review' end,
    'pending', now()
  ) returning id into v_proof_id;

  update public.caretaker_tasks
  set status = 'submitted', submitted_at = now(), updated_at = now()
  where id = v_task.id;

  update public.farm_care_requests
  set status = 'proof_submitted', updated_at = now()
  where id = v_task.care_request_id;

  if v_is_qr_tagging then
    insert into public.animal_qr_events(
      qr_identity_id, customer_animal_id, profile_id, event_type, details
    )
    select identity.id, identity.customer_animal_id, identity.profile_id,
           'tagging_proof_submitted',
           jsonb_build_object('caretaker_task_id', v_task.id, 'proof_id', v_proof_id)
    from public.animal_qr_identities identity
    where identity.id = v_task.qr_identity_id;
  end if;

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
  v_task public.caretaker_tasks%rowtype;
  v_is_qr_tagging boolean;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if p_decision not in ('approved','rejected','backjob') then raise exception 'INVALID_DECISION'; end if;
  if p_decision in ('rejected','backjob') and nullif(trim(coalesce(p_admin_note,'')), '') is null then
    raise exception 'ADMIN_NOTE_REQUIRED';
  end if;

  select id into v_admin_id from public.profiles where auth_user_id = auth.uid() limit 1;
  select * into v_proof from public.task_proofs where id = p_proof_id for update;
  if not found then raise exception 'PROOF_NOT_FOUND'; end if;
  if v_proof.admin_review_status <> 'pending' then raise exception 'PROOF_ALREADY_REVIEWED'; end if;

  select * into v_task from public.caretaker_tasks where id = v_proof.caretaker_task_id for update;
  v_is_qr_tagging := v_task.workflow_type = 'qr_tagging' and v_task.qr_identity_id is not null;

  update public.task_proofs
  set admin_review_status = p_decision,
      admin_note = p_admin_note,
      reviewed_at = now(),
      reviewed_by_profile_id = v_admin_id
  where id = p_proof_id;

  update public.caretaker_tasks
  set status = case when p_decision = 'approved' then 'approved'
                    when p_decision = 'backjob' then 'backjob'
                    else 'rejected' end,
      reviewed_at = now(), reviewed_by_profile_id = v_admin_id, updated_at = now()
  where id = v_task.id;

  update public.farm_care_requests
  set status = case when p_decision = 'approved' then 'released_to_customer'
                    when p_decision = 'backjob' then 'assigned'
                    else 'rejected' end,
      admin_note = p_admin_note, updated_at = now()
  where id = v_proof.care_request_id;

  if v_is_qr_tagging then
    update public.animal_qr_identities
    set status = case when p_decision = 'approved' then 'verified'
                      when p_decision = 'backjob' then 'assigned'
                      else 'reserved' end,
        verified_at = case when p_decision = 'approved' then now() else null end,
        verified_by_profile_id = case when p_decision = 'approved' then v_admin_id else null end,
        updated_at = now()
    where id = v_task.qr_identity_id;

    update public.customer_animals
    set status = case when p_decision = 'approved' then 'active' else 'pending_qr_tagging' end,
        qr_status = case when p_decision = 'approved' then 'verified'
                         when p_decision = 'backjob' then 'tagging_backjob'
                         else 'tagging_required' end,
        ownership_metadata = coalesce(ownership_metadata, '{}'::jsonb) || jsonb_build_object(
          'qr_status', case when p_decision = 'approved' then 'verified' else 'needs_correction' end,
          'qr_verified_at', case when p_decision = 'approved' then now() else null end,
          'qr_proof_id', p_proof_id
        ),
        updated_at = now()
    where qr_identity_id = v_task.qr_identity_id;

    insert into public.animal_qr_events(
      qr_identity_id, customer_animal_id, profile_id, event_type, details, actor_profile_id
    )
    select identity.id, identity.customer_animal_id, identity.profile_id,
           case when p_decision = 'approved' then 'tagging_verified'
                when p_decision = 'backjob' then 'tagging_backjob'
                else 'tagging_rejected' end,
           jsonb_build_object('proof_id', p_proof_id, 'admin_note', p_admin_note),
           v_admin_id
    from public.animal_qr_identities identity
    where identity.id = v_task.qr_identity_id;

    insert into public.inbox_items(profile_id, category, title, body, created_at)
    values (
      v_proof.profile_id,
      'farm_update',
      case when p_decision = 'approved' then 'Rooster QR Tag Verified'
           when p_decision = 'backjob' then 'Rooster QR Tag Needs Correction'
           else 'Rooster QR Tag Rejected' end,
      case when p_decision = 'approved' then 'Admin verified the attached FarmConnect QR tag. Your rooster QR record is now active.'
           else 'The QR tagging proof needs correction. Admin note: ' || coalesce(p_admin_note, 'Please submit clearer proof.') end,
      now()
    );
  else
    insert into public.inbox_items(profile_id, category, title, body, created_at)
    values (
      v_proof.profile_id,
      'farm_update',
      case when p_decision = 'approved' then 'Care Update Approved'
           when p_decision = 'backjob' then 'Care Update Needs Correction'
           else 'Care Update Rejected' end,
      case when p_decision = 'approved' then 'Admin approved the caretaker proof. Your care log is ready.'
           when p_decision = 'backjob' then 'Admin asked the caretaker to correct the proof. Note: ' || coalesce(p_admin_note,'Needs correction.')
           else 'Admin rejected the caretaker proof. Note: ' || coalesce(p_admin_note,'Proof was not accepted.') end,
      now()
    );
  end if;

  return p_proof_id;
end;
$$;

revoke all on function public.create_or_get_animal_qr_identity(uuid,uuid) from public, anon, authenticated;
revoke all on function public.create_qr_tagging_task_request(uuid) from public, anon, authenticated;
revoke all on function public.caretaker_submit_task_proof(uuid,text,text,text,boolean,boolean,numeric,text) from public, anon;
revoke all on function public.admin_review_task_proof(uuid,text,text) from public, anon;
grant execute on function public.caretaker_submit_task_proof(uuid,text,text,text,boolean,boolean,numeric,text) to authenticated;
grant execute on function public.admin_review_task_proof(uuid,text,text) to authenticated;

-- Backfill only approved Farm Buy ownership rows that have a valid payment id and no QR.
do $$
declare
  v_row record;
  v_identity_id uuid;
begin
  for v_row in
    select animal.id,
           (animal.ownership_metadata ->> 'payment_request_id')::uuid as payment_request_id
    from public.customer_animals animal
    join public.manual_payment_requests payment
      on payment.id::text = animal.ownership_metadata ->> 'payment_request_id'
    where animal.acquired_from = 'farm_buy'
      and payment.source_type = 'farm_buy'
      and payment.status = 'approved'
      and animal.qr_identity_id is null
  loop
    v_identity_id := public.create_or_get_animal_qr_identity(v_row.id, v_row.payment_request_id);
    perform public.create_qr_tagging_task_request(v_identity_id);
  end loop;
end $$;

commit;

select 'approved_purchase_reader_ready' as check_name, count(*) as count
from pg_trigger where tgname = 'trg_read_approved_rooster_purchase' and not tgisinternal
union all
select 'assigned_qr_task_reader_ready', count(*)
from pg_trigger where tgname = 'trg_read_assigned_qr_task_before' and not tgisinternal
union all
select 'qr_identity_engine_ready', count(*)
from information_schema.routines where routine_schema='public' and routine_name='create_or_get_animal_qr_identity'
union all
select 'qr_task_engine_ready', count(*)
from information_schema.routines where routine_schema='public' and routine_name='create_qr_tagging_task_request'
union all
select 'qr_identity_table_ready', count(*)
from information_schema.tables where table_schema='public' and table_name='animal_qr_identities';
