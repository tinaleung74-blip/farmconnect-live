begin;

alter table public.withdrawal_requests drop constraint if exists withdrawal_requests_status_check;
alter table public.withdrawal_requests add constraint withdrawal_requests_status_check
check (status in ('kyc_required','for_review','sent_for_customer_confirmation','approved','rejected','needs_info','under_investigation','resolved_by_investigation','completed'));

create table if not exists public.withdrawal_disputes (
  id uuid primary key default gen_random_uuid(),
  withdrawal_request_id uuid not null unique references public.withdrawal_requests(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'under_investigation' check (status in ('under_investigation','awaiting_customer_confirmation','resolved')),
  customer_report text not null,
  original_payout_method text not null,
  original_payout_holder text not null,
  original_payout_account text not null,
  original_amount numeric not null,
  original_admin_reference text,
  original_admin_receipt_url text,
  original_admin_receipt_file_name text,
  resolution_type text check (resolution_type in ('farm_corrected_payout','customer_fault_explained')),
  resolution_note text,
  corrected_payout_reference text,
  corrected_payout_receipt_url text,
  corrected_payout_receipt_file_name text,
  investigated_by uuid references public.profiles(id),
  investigated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_withdrawal_disputes_status_created on public.withdrawal_disputes(status,created_at desc);
alter table public.withdrawal_disputes enable row level security;

drop policy if exists "withdrawal disputes owner read" on public.withdrawal_disputes;
create policy "withdrawal disputes owner read" on public.withdrawal_disputes for select to authenticated
using (profile_id=public.current_profile_id());
drop policy if exists "withdrawal disputes admin read" on public.withdrawal_disputes;
create policy "withdrawal disputes admin read" on public.withdrawal_disputes for select to authenticated
using (public.is_admin());

create or replace function public.customer_report_withdrawal_problem(
  p_withdrawal_request_id uuid,
  p_customer_note text
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_profile_id uuid; v_request public.withdrawal_requests%rowtype; v_dispute_id uuid;
begin
  select id into v_profile_id from public.profiles where auth_user_id=auth.uid() limit 1;
  if v_profile_id is null then raise exception 'LOGIN_REQUIRED'; end if;
  if length(trim(coalesce(p_customer_note,''))) < 5 then raise exception 'PROBLEM_NOTE_REQUIRED'; end if;
  select * into v_request from public.withdrawal_requests
  where id=p_withdrawal_request_id and profile_id=v_profile_id for update;
  if not found then raise exception 'WITHDRAWAL_NOT_FOUND'; end if;
  if v_request.status='under_investigation' then
    select id into v_dispute_id from public.withdrawal_disputes where withdrawal_request_id=v_request.id;
    return v_dispute_id;
  end if;
  if v_request.status<>'sent_for_customer_confirmation' then raise exception 'WITHDRAWAL_NOT_WAITING_FOR_CONFIRMATION'; end if;

  insert into public.withdrawal_disputes(
    withdrawal_request_id,profile_id,customer_report,
    original_payout_method,original_payout_holder,original_payout_account,original_amount,
    original_admin_reference,original_admin_receipt_url,original_admin_receipt_file_name
  ) values(
    v_request.id,v_profile_id,trim(p_customer_note),
    v_request.payout_method,v_request.payout_holder,v_request.payout_account,v_request.amount,
    v_request.admin_reference_number,v_request.admin_receipt_url,v_request.admin_receipt_file_name
  ) on conflict(withdrawal_request_id) do update set customer_report=excluded.customer_report,updated_at=now()
  returning id into v_dispute_id;

  update public.withdrawal_requests set status='under_investigation',customer_confirmation_note=trim(p_customer_note),updated_at=now() where id=v_request.id;
  insert into public.withdrawal_evidence_logs(withdrawal_request_id,profile_id,event_type,title,details,actor_profile_id)
  values(v_request.id,v_profile_id,'withdrawal_dispute_opened','Withdrawal payout reported for manual investigation',
    jsonb_build_object('customer_report',trim(p_customer_note),'reference',v_request.admin_reference_number),v_profile_id);
  update public.inbox_items set title='Withdrawal Under Investigation',
    body='Your payout report is locked for manual Admin investigation. No second payout will be sent until the existing request, reference, and receipt are reviewed.',
    is_read=false,read_at=null,updated_at=now()
  where id=(select id from public.inbox_items where profile_id=v_profile_id and category='withdraw' order by created_at desc limit 1);
  return v_dispute_id;
end $$;

revoke all on function public.customer_report_withdrawal_problem(uuid,text) from public,anon;
grant execute on function public.customer_report_withdrawal_problem(uuid,text) to authenticated;
revoke all on function public.customer_resubmit_withdrawal_request(uuid,text,text,text,text,text) from authenticated;

create or replace function public.admin_resolve_withdrawal_dispute(
  p_dispute_id uuid,
  p_resolution_type text,
  p_resolution_note text,
  p_corrected_reference text default null,
  p_corrected_receipt_url text default null,
  p_corrected_receipt_file_name text default null
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_admin_id uuid; v_dispute public.withdrawal_disputes%rowtype; v_request public.withdrawal_requests%rowtype;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if p_resolution_type not in ('farm_corrected_payout','customer_fault_explained') then raise exception 'INVALID_DISPUTE_RESOLUTION'; end if;
  if length(trim(coalesce(p_resolution_note,''))) < 10 then raise exception 'INVESTIGATION_NOTE_REQUIRED'; end if;
  if p_resolution_type='farm_corrected_payout' and (
    nullif(trim(coalesce(p_corrected_reference,'')),'') is null or
    nullif(trim(coalesce(p_corrected_receipt_url,'')),'') is null
  ) then raise exception 'CORRECTED_PAYOUT_EVIDENCE_REQUIRED'; end if;
  select id into v_admin_id from public.profiles where auth_user_id=auth.uid() limit 1;
  select * into v_dispute from public.withdrawal_disputes where id=p_dispute_id for update;
  if not found then raise exception 'WITHDRAWAL_DISPUTE_NOT_FOUND'; end if;
  if v_dispute.status<>'under_investigation' then raise exception 'WITHDRAWAL_DISPUTE_ALREADY_RESOLVED'; end if;
  select * into v_request from public.withdrawal_requests where id=v_dispute.withdrawal_request_id for update;
  if v_request.status<>'under_investigation' then raise exception 'WITHDRAWAL_NOT_UNDER_INVESTIGATION'; end if;

  update public.withdrawal_disputes set resolution_type=p_resolution_type,resolution_note=trim(p_resolution_note),
    corrected_payout_reference=nullif(trim(coalesce(p_corrected_reference,'')),''),
    corrected_payout_receipt_url=nullif(trim(coalesce(p_corrected_receipt_url,'')),''),
    corrected_payout_receipt_file_name=nullif(trim(coalesce(p_corrected_receipt_file_name,'')),''),
    status=case when p_resolution_type='farm_corrected_payout' then 'awaiting_customer_confirmation' else 'resolved' end,
    investigated_by=v_admin_id,investigated_at=now(),updated_at=now()
  where id=v_dispute.id;

  if p_resolution_type='farm_corrected_payout' then
    update public.withdrawal_requests set status='sent_for_customer_confirmation',
      admin_note=trim(p_resolution_note),admin_reference_number=trim(p_corrected_reference),
      admin_receipt_url=trim(p_corrected_receipt_url),admin_receipt_file_name=p_corrected_receipt_file_name,
      admin_reviewed_by=v_admin_id,admin_reviewed_at=now(),updated_at=now()
    where id=v_request.id;
    insert into public.inbox_items(profile_id,category,title,body,created_at)
    values(v_request.profile_id,'withdraw','Corrected Withdrawal Payout Sent',
      'Admin confirmed a farm payout error and sent a corrected payout. Open Withdrawal to review the new reference and receipt, then confirm receipt.',now());
  else
    update public.profiles set wallet_on_hold=greatest(coalesce(wallet_on_hold,0)-v_request.amount,0),updated_at=now() where id=v_request.profile_id;
    update public.wallet_transactions set status='COMPLETED',description='Resolved withdrawal by manual investigation '||v_request.id::text
    where profile_id=v_request.profile_id and transaction_type='WITHDRAWAL_HOLD'
      and description in ('Withdrawal hold '||v_request.id::text,'Completed withdrawal '||v_request.id::text) and status='PENDING';
    update public.withdrawal_requests set status='resolved_by_investigation',
      customer_confirmation_note='Resolved by manual investigation: customer-submitted payout details were followed.',
      admin_note=trim(p_resolution_note),updated_at=now() where id=v_request.id;
    insert into public.inbox_items(profile_id,category,title,body,created_at)
    values(v_request.profile_id,'withdraw','Withdrawal Investigation Resolved',
      'Admin reviewed your submitted payout account, the existing payout receipt, and reference. The payout followed the account details supplied with your withdrawal. Open Withdrawal to review the recorded evidence and explanation.',now());
  end if;

  insert into public.withdrawal_evidence_logs(withdrawal_request_id,profile_id,event_type,title,details,actor_profile_id)
  values(v_request.id,v_request.profile_id,'withdrawal_dispute_resolved','Manual withdrawal investigation resolved',
    jsonb_build_object('resolution_type',p_resolution_type,'note',trim(p_resolution_note),'corrected_reference',p_corrected_reference),v_admin_id);
  return v_dispute.id;
end $$;

revoke all on function public.admin_resolve_withdrawal_dispute(uuid,text,text,text,text,text) from public,anon;
grant execute on function public.admin_resolve_withdrawal_dispute(uuid,text,text,text,text,text) to authenticated;

create or replace function public.sync_withdrawal_dispute_after_customer_confirmation()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.status='completed' and old.status='sent_for_customer_confirmation' then
    update public.withdrawal_disputes set status='resolved',updated_at=now()
    where withdrawal_request_id=new.id and status='awaiting_customer_confirmation';
  end if;
  return new;
end $$;

drop trigger if exists sync_withdrawal_dispute_after_customer_confirmation on public.withdrawal_requests;
create trigger sync_withdrawal_dispute_after_customer_confirmation after update of status on public.withdrawal_requests
for each row execute function public.sync_withdrawal_dispute_after_customer_confirmation();

create or replace function public.withdrawal_dispute_investigation_version()
returns text language sql stable as $$ select '073_manual_withdrawal_dispute_investigation_v1'::text $$;

commit;

select jsonb_build_object(
  'migration','073_manual_withdrawal_dispute_investigation',
  'dispute_table',to_regclass('public.withdrawal_disputes') is not null,
  'customer_report_rpc',to_regprocedure('public.customer_report_withdrawal_problem(uuid,text)') is not null,
  'admin_resolution_rpc',to_regprocedure('public.admin_resolve_withdrawal_dispute(uuid,text,text,text,text,text)') is not null,
  'direct_customer_resubmit_revoked',not has_function_privilege('authenticated','public.customer_resubmit_withdrawal_request(uuid,text,text,text,text,text)','EXECUTE')
) as verification;
