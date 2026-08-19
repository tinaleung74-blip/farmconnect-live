-- Reconcile payout problems created by the pre-073 customer confirmation flow.
-- Only needs_info rows with proven customer_reported_payout_problem evidence are moved.
begin;

insert into public.withdrawal_disputes(
  withdrawal_request_id,profile_id,customer_report,
  original_payout_method,original_payout_holder,original_payout_account,original_amount,
  original_admin_reference,original_admin_receipt_url,original_admin_receipt_file_name
)
select
  request.id,request.profile_id,
  coalesce(nullif(trim(request.customer_confirmation_note),''),'Customer reported a payout problem before the investigation workflow was deployed.'),
  request.payout_method,request.payout_holder,request.payout_account,request.amount,
  request.admin_reference_number,request.admin_receipt_url,request.admin_receipt_file_name
from public.withdrawal_requests request
where request.status='needs_info'
  and exists (
    select 1 from public.withdrawal_evidence_logs evidence
    where evidence.withdrawal_request_id=request.id
      and evidence.event_type='customer_reported_payout_problem'
  )
on conflict(withdrawal_request_id) do nothing;

update public.withdrawal_requests request
set status='under_investigation',updated_at=now()
where request.status='needs_info'
  and exists (
    select 1 from public.withdrawal_disputes dispute
    where dispute.withdrawal_request_id=request.id
      and dispute.status='under_investigation'
  );

update public.inbox_items inbox
set title='Withdrawal Under Investigation',
    body='Your payout report is locked for manual Admin investigation. No second payout will be sent until the existing request, reference, and receipt are reviewed.',
    is_read=false,read_at=null
where inbox.id in (
  select distinct on (request.profile_id) latest.id
  from public.withdrawal_requests request
  join lateral (
    select item.id from public.inbox_items item
    where item.profile_id=request.profile_id and item.category='withdraw'
    order by item.created_at desc limit 1
  ) latest on true
  where request.status='under_investigation'
    and exists (
      select 1 from public.withdrawal_disputes dispute
      where dispute.withdrawal_request_id=request.id
        and dispute.status='under_investigation'
    )
  order by request.profile_id,request.updated_at desc
);

-- Old cached clients may still call this RPC with p_received=false. Route that
-- action into the same guarded dispute workflow instead of restoring needs_info.
create or replace function public.customer_confirm_withdrawal_result(
  p_withdrawal_request_id uuid,
  p_received boolean,
  p_customer_note text default null
) returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_profile_id uuid;
  v_request public.withdrawal_requests%rowtype;
  v_dispute_id uuid;
begin
  select id into v_profile_id from public.profiles where auth_user_id=auth.uid() limit 1;
  if v_profile_id is null then raise exception 'LOGIN_REQUIRED'; end if;
  select * into v_request from public.withdrawal_requests
  where id=p_withdrawal_request_id and profile_id=v_profile_id for update;
  if not found then raise exception 'WITHDRAWAL_NOT_FOUND'; end if;

  if not p_received then
    if v_request.status='under_investigation' then return v_request.id; end if;
    if v_request.status<>'sent_for_customer_confirmation' then raise exception 'WITHDRAWAL_NOT_WAITING_FOR_CONFIRMATION'; end if;
    v_dispute_id:=public.customer_report_withdrawal_problem(p_withdrawal_request_id,p_customer_note);
    return p_withdrawal_request_id;
  end if;

  if v_request.status<>'sent_for_customer_confirmation' then raise exception 'WITHDRAWAL_NOT_WAITING_FOR_CONFIRMATION'; end if;
  update public.profiles
  set wallet_on_hold=greatest(coalesce(wallet_on_hold,0)-v_request.amount,0),updated_at=now()
  where id=v_profile_id;
  update public.withdrawal_requests
  set status='completed',customer_confirmed_at=now(),customer_confirmation_note=p_customer_note,updated_at=now()
  where id=v_request.id;
  update public.inbox_items
  set title='Withdrawal Completed',
      body=concat('You confirmed receipt of the payout. Amount: ',v_request.amount,
        '. Method: ',coalesce(nullif(trim(v_request.payout_method),''),'Saved payout method'),
        '. Reference: ',coalesce(nullif(trim(v_request.admin_reference_number),''),'Not provided'),
        '. This withdrawal is complete and remains in your wallet records.'),
      is_read=false,read_at=null
  where id=(select id from public.inbox_items where profile_id=v_profile_id and category='withdraw' order by created_at desc limit 1);
  insert into public.withdrawal_evidence_logs(withdrawal_request_id,profile_id,event_type,title,details,actor_profile_id)
  values(v_request.id,v_profile_id,'customer_confirmed_received','Customer confirmed payout received',
    jsonb_build_object('reference',v_request.admin_reference_number,'method',v_request.payout_method,'note',p_customer_note),v_profile_id);
  return v_request.id;
end $$;

revoke all on function public.customer_confirm_withdrawal_result(uuid,boolean,text) from public,anon;
grant execute on function public.customer_confirm_withdrawal_result(uuid,boolean,text) to authenticated;

create or replace function public.withdrawal_legacy_problem_reconciliation_version()
returns text language sql stable as $$ select '074_withdrawal_legacy_problem_reconciliation_v1'::text $$;

commit;

select jsonb_build_object(
  'migration','074_withdrawal_legacy_problem_to_investigation',
  'legacy_problem_rows_remaining',(
    select count(*) from public.withdrawal_requests request
    where request.status='needs_info'
      and exists (
        select 1 from public.withdrawal_evidence_logs evidence
        where evidence.withdrawal_request_id=request.id
          and evidence.event_type='customer_reported_payout_problem'
      )
  ),
  'open_investigation_cases',(select count(*) from public.withdrawal_disputes where status='under_investigation'),
  'legacy_rpc_guarded',to_regprocedure('public.withdrawal_legacy_problem_reconciliation_version()') is not null
) as verification;
