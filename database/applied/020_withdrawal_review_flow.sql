-- FarmConnect Withdrawal Review Flow
-- Purpose: external/manual payout review with admin proof, customer inbox notice, and evidence logs.
-- Safe mode: this records payout review/proof only. Wallet debit/credit stays controlled by separate wallet ledger functions.

begin;

create extension if not exists pgcrypto;

create table if not exists public.withdrawal_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric not null check (amount >= 0),
  payout_method text not null,
  payout_holder text not null,
  payout_account text not null,
  customer_note text,
  status text not null default 'for_review' check (status in ('kyc_required','for_review','sent_for_customer_confirmation','approved','rejected','needs_info','completed')),
  admin_note text,
  admin_reference_number text,
  admin_receipt_url text,
  admin_receipt_file_name text,
  admin_reviewed_by uuid references public.profiles(id),
  admin_reviewed_at timestamptz,
  customer_confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_withdrawal_requests_profile on public.withdrawal_requests(profile_id, created_at desc);
create index if not exists idx_withdrawal_requests_status on public.withdrawal_requests(status, created_at desc);
create index if not exists idx_withdrawal_requests_reference on public.withdrawal_requests(admin_reference_number);

create table if not exists public.withdrawal_evidence_logs (
  id uuid primary key default gen_random_uuid(),
  withdrawal_request_id uuid not null references public.withdrawal_requests(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null,
  title text not null,
  details jsonb not null default '{}'::jsonb,
  actor_profile_id uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_withdrawal_evidence_request on public.withdrawal_evidence_logs(withdrawal_request_id, created_at desc);
create index if not exists idx_withdrawal_evidence_profile on public.withdrawal_evidence_logs(profile_id, created_at desc);

alter table public.withdrawal_requests enable row level security;
alter table public.withdrawal_evidence_logs enable row level security;

drop policy if exists "withdrawals customer read own" on public.withdrawal_requests;
create policy "withdrawals customer read own" on public.withdrawal_requests
  for select to authenticated
  using (profile_id = public.current_profile_id() or public.is_admin());

drop policy if exists "withdrawals customer insert own" on public.withdrawal_requests;
create policy "withdrawals customer insert own" on public.withdrawal_requests
  for insert to authenticated
  with check (profile_id = public.current_profile_id());

drop policy if exists "withdrawals admin update" on public.withdrawal_requests;
create policy "withdrawals admin update" on public.withdrawal_requests
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "withdrawal evidence read linked" on public.withdrawal_evidence_logs;
create policy "withdrawal evidence read linked" on public.withdrawal_evidence_logs
  for select to authenticated
  using (profile_id = public.current_profile_id() or public.is_admin());

create or replace function public.customer_submit_withdrawal_request(
  p_amount numeric,
  p_payout_method text,
  p_payout_holder text,
  p_payout_account text,
  p_customer_note text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_request_id uuid;
  v_status text := 'for_review';
begin
  select * into v_profile
  from public.profiles
  where auth_user_id = auth.uid();

  if v_profile.id is null then
    raise exception 'LOGIN_REQUIRED';
  end if;

  if coalesce(p_amount, 0) < 100 then
    raise exception 'MINIMUM_WITHDRAWAL_100';
  end if;

  if coalesce(trim(p_payout_method), '') = '' or coalesce(trim(p_payout_holder), '') = '' or coalesce(trim(p_payout_account), '') = '' then
    raise exception 'PAYOUT_DETAILS_REQUIRED';
  end if;

  if coalesce(v_profile.kyc_status, v_profile.verification_status, '') not in ('approved','verified','passed') then
    v_status := 'kyc_required';
  end if;

  insert into public.withdrawal_requests(
    profile_id, amount, payout_method, payout_holder, payout_account, customer_note, status
  ) values (
    v_profile.id, p_amount, trim(p_payout_method), trim(p_payout_holder), trim(p_payout_account), p_customer_note, v_status
  ) returning id into v_request_id;

  insert into public.withdrawal_evidence_logs(withdrawal_request_id, profile_id, event_type, title, details, actor_profile_id)
  values (v_request_id, v_profile.id, 'withdrawal_submitted', 'Withdrawal request submitted', jsonb_build_object(
    'amount', p_amount,
    'payout_method', p_payout_method,
    'payout_holder', p_payout_holder,
    'payout_account', p_payout_account,
    'status', v_status,
    'customer_note', p_customer_note
  ), v_profile.id);

  insert into public.inbox_items(profile_id, category, title, body, created_at)
  values (
    v_profile.id,
    'withdraw',
    case when v_status = 'kyc_required' then 'Withdrawal Needs KYC' else 'Withdrawal For Review' end,
    case when v_status = 'kyc_required'
      then 'Your withdrawal was recorded, but KYC must be approved before payout can be released. Amount: ' || p_amount::text || '.'
      else 'Your withdrawal request is now for admin review. Amount: ' || p_amount::text || '. Method: ' || trim(p_payout_method) || '.'
    end,
    now()
  );

  return v_request_id;
end;
$$;

create or replace function public.admin_review_withdrawal_request(
  p_withdrawal_request_id uuid,
  p_decision text,
  p_admin_note text default null,
  p_admin_reference_number text default null,
  p_admin_receipt_url text default null,
  p_admin_receipt_file_name text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid;
  v_request public.withdrawal_requests%rowtype;
  v_new_status text;
begin
  if not public.is_admin() then
    raise exception 'ADMIN_REQUIRED';
  end if;

  select id into v_admin_id from public.profiles where auth_user_id = auth.uid();

  select * into v_request
  from public.withdrawal_requests
  where id = p_withdrawal_request_id
  for update;

  if not found then
    raise exception 'WITHDRAWAL_NOT_FOUND';
  end if;

  if p_decision not in ('approved','rejected','needs_info') then
    raise exception 'INVALID_DECISION';
  end if;

  if p_decision = 'approved' and coalesce(trim(p_admin_reference_number), '') = '' then
    raise exception 'ADMIN_REFERENCE_REQUIRED';
  end if;

  v_new_status := case when p_decision = 'approved' then 'sent_for_customer_confirmation' else p_decision end;

  update public.withdrawal_requests
  set status = v_new_status,
      admin_note = p_admin_note,
      admin_reference_number = nullif(trim(p_admin_reference_number), ''),
      admin_receipt_url = nullif(trim(p_admin_receipt_url), ''),
      admin_receipt_file_name = nullif(trim(p_admin_receipt_file_name), ''),
      admin_reviewed_by = v_admin_id,
      admin_reviewed_at = now(),
      updated_at = now()
  where id = p_withdrawal_request_id;

  insert into public.withdrawal_evidence_logs(withdrawal_request_id, profile_id, event_type, title, details, actor_profile_id)
  values (p_withdrawal_request_id, v_request.profile_id, 'admin_' || p_decision, 'Admin withdrawal decision: ' || p_decision, jsonb_build_object(
    'amount', v_request.amount,
    'payout_method', v_request.payout_method,
    'payout_holder', v_request.payout_holder,
    'payout_account', v_request.payout_account,
    'admin_note', p_admin_note,
    'admin_reference_number', p_admin_reference_number,
    'admin_receipt_url', p_admin_receipt_url,
    'admin_receipt_file_name', p_admin_receipt_file_name
  ), v_admin_id);

  insert into public.inbox_items(profile_id, category, title, body, created_at)
  values (
    v_request.profile_id,
    'withdraw',
    case when p_decision = 'approved' then 'Withdrawal Payout Sent' when p_decision = 'rejected' then 'Withdrawal Rejected' else 'Withdrawal Needs More Info' end,
    case when p_decision = 'approved'
      then 'Admin sent your payout. Amount: ' || v_request.amount::text || '. Method: ' || v_request.payout_method || '. Reference: ' || coalesce(trim(p_admin_reference_number), 'not provided') || '. Please check your account.'
      when p_decision = 'rejected'
      then 'Your withdrawal was rejected/held. Reason: ' || coalesce(p_admin_note, 'Please check your payout details and try again.')
      else 'Admin needs more information before releasing your withdrawal. Note: ' || coalesce(p_admin_note, 'Please review your payout details.')
    end,
    now()
  );

  return p_withdrawal_request_id;
end;
$$;

revoke all on function public.customer_submit_withdrawal_request(numeric,text,text,text,text) from public;
grant execute on function public.customer_submit_withdrawal_request(numeric,text,text,text,text) to authenticated;

revoke all on function public.admin_review_withdrawal_request(uuid,text,text,text,text,text) from public;
grant execute on function public.admin_review_withdrawal_request(uuid,text,text,text,text,text) to authenticated;

commit;

-- Verify after run:
-- select 'withdrawal_requests' as check_name, count(*) from information_schema.tables where table_schema='public' and table_name='withdrawal_requests'
-- union all select 'withdrawal_evidence_logs', count(*) from information_schema.tables where table_schema='public' and table_name='withdrawal_evidence_logs'
-- union all select 'customer_submit_withdrawal_request', count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='customer_submit_withdrawal_request'
-- union all select 'admin_review_withdrawal_request', count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='admin_review_withdrawal_request';
