begin;

create or replace function public.customer_resubmit_withdrawal_request(
  p_withdrawal_request_id uuid,
  p_payout_method text,
  p_payout_holder text,
  p_payout_account text,
  p_customer_note text,
  p_wallet_pin text
) returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_profile public.profiles%rowtype;
  v_request public.withdrawal_requests%rowtype;
  v_failed integer;
  v_now timestamptz := now();
begin
  select * into v_profile from public.profiles where auth_user_id = auth.uid() for update;
  if v_profile.id is null then raise exception 'LOGIN_REQUIRED'; end if;
  if lower(coalesce(v_profile.kyc_status, v_profile.verification_status, '')) not in ('approved','verified','passed') then raise exception 'KYC_REQUIRED'; end if;
  if p_wallet_pin is null or p_wallet_pin !~ '^[0-9]{6}$' then raise exception 'WALLET_PIN_REQUIRED'; end if;
  if v_profile.wallet_pin_hash is null or not coalesce(v_profile.wallet_pin_set, false) then return jsonb_build_object('error','WALLET_PIN_NOT_SET','status','blocked'); end if;
  if v_profile.wallet_pin_locked_until is not null and v_profile.wallet_pin_locked_until > v_now then return jsonb_build_object('error','WALLET_PIN_LOCKED','status','blocked'); end if;
  if crypt(p_wallet_pin, v_profile.wallet_pin_hash) <> v_profile.wallet_pin_hash then
    v_failed := coalesce(v_profile.wallet_pin_failed_attempts, 0) + 1;
    update public.profiles set wallet_pin_failed_attempts = v_failed,
      wallet_pin_locked_until = case when v_failed >= 5 then v_now + interval '15 minutes' else null end,
      updated_at = v_now where id = v_profile.id;
    return jsonb_build_object('error',case when v_failed >= 5 then 'WALLET_PIN_LOCKED' else 'WALLET_PIN_INVALID' end,'status','blocked','attempts_remaining',greatest(0,5-v_failed));
  end if;
  update public.profiles set wallet_pin_failed_attempts = 0, wallet_pin_locked_until = null, updated_at = v_now where id = v_profile.id;

  select * into v_request from public.withdrawal_requests
  where id = p_withdrawal_request_id and profile_id = v_profile.id for update;
  if not found then raise exception 'WITHDRAWAL_NOT_FOUND'; end if;
  if v_request.status <> 'needs_info' then raise exception 'WITHDRAWAL_NOT_WAITING_FOR_CORRECTION'; end if;
  if not coalesce(v_request.wallet_hold_applied, false) or v_request.wallet_refunded_at is not null then raise exception 'WITHDRAWAL_HOLD_NOT_ACTIVE'; end if;
  if nullif(trim(coalesce(p_payout_method,'')),'') is null or nullif(trim(coalesce(p_payout_holder,'')),'') is null or nullif(trim(coalesce(p_payout_account,'')),'') is null then raise exception 'PAYOUT_DETAILS_REQUIRED'; end if;

  update public.withdrawal_requests set
    payout_method = trim(p_payout_method), payout_holder = trim(p_payout_holder), payout_account = trim(p_payout_account),
    customer_note = nullif(trim(coalesce(p_customer_note,'')),''), status = 'for_review',
    admin_note = null, admin_reference_number = null, admin_receipt_url = null, admin_receipt_file_name = null,
    admin_reviewed_by = null, admin_reviewed_at = null, customer_confirmation_note = null, updated_at = v_now
  where id = v_request.id;

  insert into public.withdrawal_evidence_logs(withdrawal_request_id,profile_id,event_type,title,details,actor_profile_id)
  values(v_request.id,v_profile.id,'customer_resubmitted_payout_details','Customer corrected payout details',
    jsonb_build_object('method',trim(p_payout_method),'note',nullif(trim(coalesce(p_customer_note,'')),'')),v_profile.id);
  insert into public.inbox_items(profile_id,category,title,body,created_at)
  values(v_profile.id,'withdraw','Withdrawal Returned for Review','Your corrected payout details were returned to Admin. The original amount remains on hold; no duplicate withdrawal was created.',v_now);
  return jsonb_build_object('id',v_request.id,'duplicate',false,'status','for_review');
end;
$$;

revoke all on function public.customer_resubmit_withdrawal_request(uuid,text,text,text,text,text) from public, anon;
grant execute on function public.customer_resubmit_withdrawal_request(uuid,text,text,text,text,text) to authenticated;

create or replace function public.admin_review_withdrawal_request_guarded(
  p_withdrawal_request_id uuid,p_decision text,p_admin_note text default null,
  p_admin_reference_number text default null,p_admin_receipt_url text default null,
  p_admin_receipt_file_name text default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_status text; v_expected text; v_result uuid; v_kyc text;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if p_decision not in ('approved','rejected','needs_info') then raise exception 'INVALID_DECISION'; end if;
  v_expected:=case when p_decision='approved' then 'sent_for_customer_confirmation' else p_decision end;
  select w.status,lower(coalesce(p.kyc_status,p.verification_status,'')) into v_status,v_kyc
  from public.withdrawal_requests w join public.profiles p on p.id=w.profile_id
  where w.id=p_withdrawal_request_id for update of w,p;
  if not found then raise exception 'WITHDRAWAL_NOT_FOUND'; end if;
  if v_status=v_expected then return jsonb_build_object('id',p_withdrawal_request_id,'duplicate',true,'status',v_status); end if;
  if v_status not in ('for_review','needs_info') then raise exception 'WITHDRAWAL_ALREADY_REVIEWED'; end if;
  if p_decision='approved' and v_kyc not in ('approved','verified','passed') then raise exception 'KYC_REQUIRED'; end if;
  v_result:=public.admin_review_withdrawal_request(p_withdrawal_request_id,p_decision,p_admin_note,p_admin_reference_number,p_admin_receipt_url,p_admin_receipt_file_name);
  return jsonb_build_object('id',v_result,'duplicate',false,'status',v_expected);
end $$;

create or replace function public.sync_withdrawal_wallet_ledger_status()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.status = old.status then return new; end if;
  if new.status = 'completed' then
    update public.wallet_transactions set status='COMPLETED', description='Completed withdrawal '||new.id::text
    where profile_id=new.profile_id and transaction_type='WITHDRAWAL_HOLD'
      and description='Withdrawal hold '||new.id::text and status='PENDING';
  elsif new.status = 'rejected' then
    update public.wallet_transactions set status='COMPLETED', description='Reversed withdrawal hold '||new.id::text
    where profile_id=new.profile_id and transaction_type='WITHDRAWAL_HOLD'
      and description='Withdrawal hold '||new.id::text and status='PENDING';
  end if;
  return new;
end;
$$;

drop trigger if exists sync_withdrawal_wallet_ledger_status on public.withdrawal_requests;
create trigger sync_withdrawal_wallet_ledger_status after update of status on public.withdrawal_requests
for each row execute function public.sync_withdrawal_wallet_ledger_status();

create or replace function public.withdrawal_recovery_integrity_version()
returns text language sql stable as $$ select '072_withdrawal_recovery_and_ledger_integrity_v1'::text $$;

commit;

select jsonb_build_object(
  'migration','072_withdrawal_recovery_and_ledger_integrity',
  'customer_correction_rpc',to_regprocedure('public.customer_resubmit_withdrawal_request(uuid,text,text,text,text,text)') is not null,
  'admin_kyc_guard',to_regprocedure('public.admin_review_withdrawal_request_guarded(uuid,text,text,text,text,text)') is not null,
  'ledger_trigger',exists(select 1 from pg_trigger where tgname='sync_withdrawal_wallet_ledger_status' and not tgisinternal)
) as verification;
