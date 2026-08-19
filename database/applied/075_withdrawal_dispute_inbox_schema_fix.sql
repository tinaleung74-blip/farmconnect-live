-- Fix customer payout-problem submission against the live inbox_items schema.
-- The prior RPC attempted to update inbox_items.updated_at, but that column does
-- not exist. This replacement preserves the guarded dispute workflow and only
-- updates columns that are present in the live Inbox table.

begin;

create or replace function public.customer_report_withdrawal_problem(
  p_withdrawal_request_id uuid,
  p_customer_note text
) returns uuid language plpgsql security definer set search_path=public as $$
declare
  v_profile_id uuid;
  v_request public.withdrawal_requests%rowtype;
  v_dispute_id uuid;
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

  if v_request.status='under_investigation' then
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
  ) on conflict(withdrawal_request_id) do update
    set customer_report=excluded.customer_report,updated_at=now()
  returning id into v_dispute_id;

  update public.withdrawal_requests
  set status='under_investigation',
      customer_confirmation_note=trim(p_customer_note),
      updated_at=now()
  where id=v_request.id;

  insert into public.withdrawal_evidence_logs(
    withdrawal_request_id,profile_id,event_type,title,details,actor_profile_id
  ) values(
    v_request.id,v_profile_id,'withdrawal_dispute_opened',
    'Withdrawal payout reported for manual investigation',
    jsonb_build_object('customer_report',trim(p_customer_note),'reference',v_request.admin_reference_number),
    v_profile_id
  );

  update public.inbox_items
  set title='Withdrawal Under Investigation',
      body='Your payout report is locked for manual Admin investigation. No second payout will be sent until the existing request, reference, and receipt are reviewed.',
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

create or replace function public.withdrawal_dispute_inbox_schema_fix_version()
returns text language sql stable
as $$ select '075_withdrawal_dispute_inbox_schema_fix_v1'::text $$;

commit;

select jsonb_build_object(
  'migration','075_withdrawal_dispute_inbox_schema_fix',
  'customer_report_rpc',to_regprocedure('public.customer_report_withdrawal_problem(uuid,text)') is not null,
  'version_rpc',to_regprocedure('public.withdrawal_dispute_inbox_schema_fix_version()') is not null,
  'inbox_updated_at_absent',not exists(
    select 1 from information_schema.columns
    where table_schema='public' and table_name='inbox_items' and column_name='updated_at'
  )
) as verification;
