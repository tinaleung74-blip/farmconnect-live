-- Complete the corrected-payout rejection loop.
-- Reuses one dispute per withdrawal, snapshots the latest payout evidence, and
-- reopens the case for Admin investigation without creating or sending money.

begin;

-- Reconcile cases already stranded by the previous conflict behavior.
update public.withdrawal_disputes dispute
set status='under_investigation',
    customer_report=coalesce(nullif(trim(request.customer_confirmation_note),''),dispute.customer_report),
    original_admin_reference=request.admin_reference_number,
    original_admin_receipt_url=request.admin_receipt_url,
    original_admin_receipt_file_name=request.admin_receipt_file_name,
    resolution_type=null,
    resolution_note=null,
    corrected_payout_reference=null,
    corrected_payout_receipt_url=null,
    corrected_payout_receipt_file_name=null,
    investigated_by=null,
    investigated_at=null,
    updated_at=now()
from public.withdrawal_requests request
where request.id=dispute.withdrawal_request_id
  and request.status='under_investigation'
  and dispute.status='awaiting_customer_confirmation';

create or replace function public.customer_report_withdrawal_problem(
  p_withdrawal_request_id uuid,
  p_customer_note text
) returns uuid language plpgsql security definer set search_path=public as $$
declare
  v_profile_id uuid;
  v_request public.withdrawal_requests%rowtype;
  v_dispute_id uuid;
  v_existing_status text;
  v_event_type text;
  v_event_title text;
begin
  select id into v_profile_id
  from public.profiles
  where auth_user_id=auth.uid()
  limit 1;

  if v_profile_id is null then raise exception 'LOGIN_REQUIRED'; end if;
  if length(trim(coalesce(p_customer_note,''))) < 5 then raise exception 'PROBLEM_NOTE_REQUIRED'; end if;

  select * into v_request
  from public.withdrawal_requests
  where id=p_withdrawal_request_id and profile_id=v_profile_id
  for update;

  if not found then raise exception 'WITHDRAWAL_NOT_FOUND'; end if;

  select status into v_existing_status
  from public.withdrawal_disputes
  where withdrawal_request_id=v_request.id;

  if v_request.status='under_investigation' and v_existing_status='under_investigation' then
    select id into v_dispute_id
    from public.withdrawal_disputes
    where withdrawal_request_id=v_request.id;
    return v_dispute_id;
  end if;

  if v_request.status<>'sent_for_customer_confirmation' then
    raise exception 'WITHDRAWAL_NOT_WAITING_FOR_CONFIRMATION';
  end if;

  insert into public.withdrawal_disputes(
    withdrawal_request_id,profile_id,customer_report,
    original_payout_method,original_payout_holder,original_payout_account,original_amount,
    original_admin_reference,original_admin_receipt_url,original_admin_receipt_file_name
  ) values(
    v_request.id,v_profile_id,trim(p_customer_note),
    v_request.payout_method,v_request.payout_holder,v_request.payout_account,v_request.amount,
    v_request.admin_reference_number,v_request.admin_receipt_url,v_request.admin_receipt_file_name
  ) on conflict(withdrawal_request_id) do update set
    customer_report=excluded.customer_report,
    original_payout_method=excluded.original_payout_method,
    original_payout_holder=excluded.original_payout_holder,
    original_payout_account=excluded.original_payout_account,
    original_amount=excluded.original_amount,
    original_admin_reference=excluded.original_admin_reference,
    original_admin_receipt_url=excluded.original_admin_receipt_url,
    original_admin_receipt_file_name=excluded.original_admin_receipt_file_name,
    status='under_investigation',
    resolution_type=null,
    resolution_note=null,
    corrected_payout_reference=null,
    corrected_payout_receipt_url=null,
    corrected_payout_receipt_file_name=null,
    investigated_by=null,
    investigated_at=null,
    updated_at=now()
  returning id into v_dispute_id;

  update public.withdrawal_requests
  set status='under_investigation',
      customer_confirmation_note=trim(p_customer_note),
      updated_at=now()
  where id=v_request.id;

  v_event_type:=case when v_existing_status is null then 'withdrawal_dispute_opened' else 'withdrawal_dispute_reopened' end;
  v_event_title:=case when v_existing_status is null then 'Withdrawal payout reported for manual investigation' else 'Corrected withdrawal payout reported again' end;

  insert into public.withdrawal_evidence_logs(
    withdrawal_request_id,profile_id,event_type,title,details,actor_profile_id
  ) values(
    v_request.id,v_profile_id,v_event_type,v_event_title,
    jsonb_build_object(
      'customer_report',trim(p_customer_note),
      'reference',v_request.admin_reference_number,
      'receipt_url',v_request.admin_receipt_url,
      'prior_dispute_status',v_existing_status
    ),
    v_profile_id
  );

  update public.inbox_items
  set title='Withdrawal Under Investigation',
      body='Your latest payout report is locked for manual Admin investigation. No additional payout or resubmission is allowed until the current reference and receipt are reviewed.',
      is_read=false,
      read_at=null
  where id=(
    select id from public.inbox_items
    where profile_id=v_profile_id and category='withdraw'
    order by created_at desc
    limit 1
  );

  return v_dispute_id;
end $$;

revoke all on function public.customer_report_withdrawal_problem(uuid,text) from public,anon;
grant execute on function public.customer_report_withdrawal_problem(uuid,text) to authenticated;

create or replace function public.withdrawal_dispute_reopen_cycle_version()
returns text language sql stable
as $$ select '076_withdrawal_dispute_reopen_cycle_v1'::text $$;

commit;

select jsonb_build_object(
  'migration','076_withdrawal_dispute_reopen_cycle',
  'customer_report_rpc',to_regprocedure('public.customer_report_withdrawal_problem(uuid,text)') is not null,
  'version_rpc',to_regprocedure('public.withdrawal_dispute_reopen_cycle_version()') is not null,
  'stranded_cases_remaining',(
    select count(*)
    from public.withdrawal_disputes dispute
    join public.withdrawal_requests request on request.id=dispute.withdrawal_request_id
    where request.status='under_investigation'
      and dispute.status='awaiting_customer_confirmation'
  )
) as verification;
