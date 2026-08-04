-- FarmConnect Manual Payment Review Flow
-- Purpose: turn paid customer actions into external payment proof + admin approval.
-- Safe mode: no gateway, no auto wallet debit/credit. Admin decision finalizes records.

begin;

create extension if not exists pgcrypto;

create table if not exists public.manual_payment_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  source_type text not null check (source_type in ('farm_buy','care_request','cashin','other')),
  source_ref text,
  amount_expected numeric not null default 0 check (amount_expected >= 0),
  summary jsonb not null default '{}'::jsonb,
  payment_method text not null,
  receiver_account text,
  sender_name text not null,
  reference_number text not null,
  receipt_image_url text,
  status text not null default 'for_review' check (status in ('for_review','needs_info','approved','rejected','completed')),
  risk_status text not null default 'unchecked' check (risk_status in ('unchecked','clear','possible_duplicate','needs_review')),
  admin_note text,
  admin_reviewed_by uuid references public.profiles(id),
  admin_reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_manual_payment_profile on public.manual_payment_requests(profile_id, created_at desc);
create index if not exists idx_manual_payment_status on public.manual_payment_requests(status, created_at desc);
create index if not exists idx_manual_payment_reference on public.manual_payment_requests(reference_number);

create table if not exists public.payment_evidence_logs (
  id uuid primary key default gen_random_uuid(),
  payment_request_id uuid not null references public.manual_payment_requests(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null,
  title text not null,
  details jsonb not null default '{}'::jsonb,
  actor_profile_id uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_payment_evidence_payment on public.payment_evidence_logs(payment_request_id, created_at desc);
create index if not exists idx_payment_evidence_profile on public.payment_evidence_logs(profile_id, created_at desc);

alter table public.manual_payment_requests enable row level security;
alter table public.payment_evidence_logs enable row level security;

drop policy if exists "manual payments customer read own" on public.manual_payment_requests;
create policy "manual payments customer read own" on public.manual_payment_requests
  for select to authenticated
  using (profile_id = public.current_profile_id() or public.is_admin());

drop policy if exists "manual payments customer insert own" on public.manual_payment_requests;
create policy "manual payments customer insert own" on public.manual_payment_requests
  for insert to authenticated
  with check (profile_id = public.current_profile_id());

drop policy if exists "manual payments admin update" on public.manual_payment_requests;
create policy "manual payments admin update" on public.manual_payment_requests
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "payment evidence read linked" on public.payment_evidence_logs;
create policy "payment evidence read linked" on public.payment_evidence_logs
  for select to authenticated
  using (profile_id = public.current_profile_id() or public.is_admin());

create or replace function public.customer_submit_manual_payment(
  p_source_type text,
  p_source_ref text,
  p_amount_expected numeric,
  p_summary jsonb,
  p_payment_method text,
  p_receiver_account text,
  p_sender_name text,
  p_reference_number text,
  p_receipt_image_url text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_payment_id uuid;
  v_duplicate_count int;
  v_risk text := 'clear';
begin
  select id into v_profile_id
  from public.profiles
  where auth_user_id = auth.uid();

  if v_profile_id is null then
    raise exception 'LOGIN_REQUIRED';
  end if;

  if coalesce(trim(p_reference_number), '') = '' then
    raise exception 'REFERENCE_REQUIRED';
  end if;

  if coalesce(trim(p_sender_name), '') = '' then
    raise exception 'SENDER_REQUIRED';
  end if;

  select count(*) into v_duplicate_count
  from public.manual_payment_requests
  where lower(reference_number) = lower(trim(p_reference_number));

  if v_duplicate_count > 0 then
    v_risk := 'possible_duplicate';
  end if;

  insert into public.manual_payment_requests(
    profile_id, source_type, source_ref, amount_expected, summary,
    payment_method, receiver_account, sender_name, reference_number,
    receipt_image_url, status, risk_status
  ) values (
    v_profile_id, p_source_type, p_source_ref, coalesce(p_amount_expected,0), coalesce(p_summary,'{}'::jsonb),
    p_payment_method, p_receiver_account, trim(p_sender_name), trim(p_reference_number),
    p_receipt_image_url, 'for_review', v_risk
  ) returning id into v_payment_id;

  insert into public.payment_evidence_logs(payment_request_id, profile_id, event_type, title, details, actor_profile_id)
  values (v_payment_id, v_profile_id, 'payment_submitted', 'Payment proof submitted', jsonb_build_object(
    'source_type', p_source_type,
    'amount_expected', p_amount_expected,
    'payment_method', p_payment_method,
    'receiver_account', p_receiver_account,
    'sender_name', p_sender_name,
    'reference_number', p_reference_number,
    'receipt_image_url', p_receipt_image_url,
    'risk_status', v_risk,
    'summary', coalesce(p_summary,'{}'::jsonb)
  ), v_profile_id);

  insert into public.inbox_items(profile_id, category, title, body, created_at)
  values (
    v_profile_id,
    case when p_source_type = 'care_request' then 'care' when p_source_type = 'cashin' then 'cashin' else 'receipt' end,
    case when p_source_type = 'farm_buy' then 'Farm Buy Payment For Review' when p_source_type = 'care_request' then 'Care Request Payment For Review' else 'Payment For Review' end,
    'Payment proof submitted. Amount: ' || coalesce(p_amount_expected,0)::text || '. Method: ' || p_payment_method || '. Reference: ' || trim(p_reference_number) || '. Status: For admin review.',
    now()
  );

  return v_payment_id;
end;
$$;

create or replace function public.admin_review_manual_payment(
  p_payment_request_id uuid,
  p_decision text,
  p_admin_note text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid;
  v_payment public.manual_payment_requests%rowtype;
  v_line record;
  v_receipt_id uuid := gen_random_uuid();
  v_lines jsonb := '[]'::jsonb;
begin
  if not public.is_admin() then
    raise exception 'ADMIN_REQUIRED';
  end if;

  select id into v_admin_id from public.profiles where auth_user_id = auth.uid();

  select * into v_payment
  from public.manual_payment_requests
  where id = p_payment_request_id
  for update;

  if not found then
    raise exception 'PAYMENT_NOT_FOUND';
  end if;

  if p_decision not in ('approved','rejected','needs_info') then
    raise exception 'INVALID_DECISION';
  end if;

  update public.manual_payment_requests
  set status = p_decision,
      admin_note = p_admin_note,
      admin_reviewed_by = v_admin_id,
      admin_reviewed_at = now(),
      updated_at = now()
  where id = p_payment_request_id;

  insert into public.payment_evidence_logs(payment_request_id, profile_id, event_type, title, details, actor_profile_id)
  values (p_payment_request_id, v_payment.profile_id, 'admin_' || p_decision, 'Admin payment decision: ' || p_decision, jsonb_build_object(
    'admin_note', p_admin_note,
    'amount_expected', v_payment.amount_expected,
    'reference_number', v_payment.reference_number,
    'source_type', v_payment.source_type
  ), v_admin_id);

  if p_decision = 'approved' and v_payment.source_type = 'farm_buy' then
    for v_line in
      select c.id as cart_id, c.quantity, c.unit_price, c.product_id, p.name, p.category, p.unit_label, p.image_url, p.product_type, p.bloodline, p.breed
      from public.farm_cart_items c
      left join public.farm_products p on p.id = c.product_id
      where c.profile_id = v_payment.profile_id and c.status = 'active'
    loop
      update public.farm_products
      set stock_quantity = greatest(0, coalesce(stock_quantity,0) - v_line.quantity)
      where id = v_line.product_id;

      if coalesce(v_line.product_type, '') = 'breed_chick' or v_line.category ilike '%chick%' or v_line.name ilike '%chick%' then
        insert into public.customer_animals(profile_id, animal_name, animal_code, status, acquired_from, source_product_id, source_product_name, bloodline_snapshot, breed_snapshot, ownership_metadata)
        values (v_payment.profile_id, v_line.name, 'FC-' || upper(substr(v_receipt_id::text,1,8)), 'pending_assignment', 'manual_payment_approved', v_line.product_id, v_line.name, v_line.bloodline, coalesce(v_line.breed, v_line.bloodline), jsonb_build_object('payment_request_id', p_payment_request_id, 'receipt_id', v_receipt_id));
      else
        insert into public.customer_inventory_items(profile_id, product_id, product_name, category, unit_label, unit_price, image_url, quantity, product_type, bloodline, breed, updated_at)
        values (v_payment.profile_id, v_line.product_id, v_line.name, v_line.category, v_line.unit_label, v_line.unit_price, v_line.image_url, v_line.quantity, v_line.product_type, v_line.bloodline, v_line.breed, now())
        on conflict (profile_id, product_id)
        do update set quantity = public.customer_inventory_items.quantity + excluded.quantity, updated_at = now();
      end if;

      update public.farm_cart_items
      set status = 'purchased', checkout_id = v_receipt_id, purchased_at = now()
      where id = v_line.cart_id;

      v_lines := v_lines || jsonb_build_array(jsonb_build_object('name', v_line.name, 'quantity', v_line.quantity, 'line_total', v_line.quantity * v_line.unit_price));
    end loop;
  end if;

  if p_decision = 'approved' and v_payment.source_type = 'care_request' then
    insert into public.inbox_items(profile_id, category, title, body, created_at)
    values (v_payment.profile_id, 'care', 'Care Request Approved', 'Admin approved your care request payment. Reference: ' || v_payment.reference_number || '. The farm team can now assign/continue the task.', now());
  elsif p_decision = 'approved' then
    insert into public.inbox_items(profile_id, category, title, body, created_at)
    values (v_payment.profile_id, 'receipt', 'Payment Approved', 'Payment approved. Amount: ' || v_payment.amount_expected::text || '. Receipt ID: ' || v_receipt_id::text || '. Reference: ' || v_payment.reference_number || '.', now());
  elsif p_decision = 'rejected' then
    insert into public.inbox_items(profile_id, category, title, body, created_at)
    values (v_payment.profile_id, 'alert', 'Payment Needs Correction', 'Payment was not approved. Reason: ' || coalesce(p_admin_note, 'Please check your proof and reference number.') || '. Reference: ' || v_payment.reference_number || '.', now());
  else
    insert into public.inbox_items(profile_id, category, title, body, created_at)
    values (v_payment.profile_id, 'alert', 'Payment Needs More Info', 'Admin needs more info. Note: ' || coalesce(p_admin_note, 'Please submit clearer payment details.') || '. Reference: ' || v_payment.reference_number || '.', now());
  end if;

  return p_payment_request_id;
end;
$$;

revoke all on function public.customer_submit_manual_payment(text,text,numeric,jsonb,text,text,text,text,text) from public;
grant execute on function public.customer_submit_manual_payment(text,text,numeric,jsonb,text,text,text,text,text) to authenticated;

revoke all on function public.admin_review_manual_payment(uuid,text,text) from public;
grant execute on function public.admin_review_manual_payment(uuid,text,text) to authenticated;

commit;

-- Verify after run:
-- select 'manual_payment_requests' as check_name, count(*) from information_schema.tables where table_schema='public' and table_name='manual_payment_requests'
-- union all select 'payment_evidence_logs', count(*) from information_schema.tables where table_schema='public' and table_name='payment_evidence_logs'
-- union all select 'customer_submit_manual_payment', count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='customer_submit_manual_payment'
-- union all select 'admin_review_manual_payment', count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='admin_review_manual_payment';