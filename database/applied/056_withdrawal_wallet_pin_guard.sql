-- FarmConnect withdrawal Wallet PIN guard.
-- Purpose:
-- - Keep payout-method setup available before KYC approval.
-- - Require KYC only for the actual withdrawal request.
-- - Verify the entered Wallet PIN on the server before any wallet hold.
-- - Persist failed-attempt counters and a 15-minute lock after five failures.

begin;

create extension if not exists pgcrypto;

create or replace function public.change_wallet_pin(
  p_current_pin text,
  p_new_pin text
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_profile public.profiles%rowtype;
  v_now timestamptz := now();
  v_failed integer;
begin
  select * into v_profile
  from public.profiles
  where auth_user_id = auth.uid()
  for update;

  if v_profile.id is null then raise exception 'LOGIN_REQUIRED'; end if;
  if p_new_pin is null or p_new_pin !~ '^[0-9]{6}$' then raise exception 'WALLET_PIN_REQUIRED'; end if;
  if p_current_pin is not null and p_current_pin !~ '^[0-9]{6}$' then raise exception 'WALLET_PIN_REQUIRED'; end if;

  if v_profile.wallet_pin_locked_until is not null and v_profile.wallet_pin_locked_until > v_now then
    raise exception 'WALLET_PIN_LOCKED';
  end if;

  if v_profile.wallet_pin_hash is null then
    update public.profiles
    set wallet_pin_hash = crypt(p_new_pin, gen_salt('bf')),
        wallet_pin_set = true,
        wallet_pin_failed_attempts = 0,
        wallet_pin_locked_until = null,
        wallet_pin_changed_at = v_now,
        last_pin_changed_at = v_now,
        updated_at = v_now
    where id = v_profile.id;
    return true;
  end if;

  if p_current_pin is null or crypt(p_current_pin, v_profile.wallet_pin_hash) <> v_profile.wallet_pin_hash then
    v_failed := coalesce(v_profile.wallet_pin_failed_attempts, 0) + 1;
    update public.profiles
    set wallet_pin_failed_attempts = v_failed,
        wallet_pin_locked_until = case when v_failed >= 5 then v_now + interval '15 minutes' else null end,
        updated_at = v_now
    where id = v_profile.id;
    return false;
  end if;

  update public.profiles
  set wallet_pin_hash = crypt(p_new_pin, gen_salt('bf')),
      wallet_pin_set = true,
      wallet_pin_failed_attempts = 0,
      wallet_pin_locked_until = null,
      wallet_pin_changed_at = v_now,
      last_pin_changed_at = v_now,
      updated_at = v_now
  where id = v_profile.id;

  return true;
end;
$$;

revoke all on function public.change_wallet_pin(text, text) from public, anon;
grant execute on function public.change_wallet_pin(text, text) to authenticated;

revoke all on function public.customer_submit_withdrawal_request_guarded(numeric,text,text,text,text,text) from public, anon, authenticated;
drop function if exists public.customer_submit_withdrawal_request_guarded(numeric,text,text,text,text,text);

create or replace function public.customer_submit_withdrawal_request_guarded(
  p_amount numeric,
  p_payout_method text,
  p_payout_holder text,
  p_payout_account text,
  p_customer_note text,
  p_idempotency_key text,
  p_wallet_pin text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_profile public.profiles%rowtype;
  v_request_id uuid;
  v_existing_id uuid;
  v_inserted integer;
  v_failed integer;
  v_now timestamptz := now();
begin
  select * into v_profile
  from public.profiles
  where auth_user_id = auth.uid()
  for update;

  if v_profile.id is null then raise exception 'LOGIN_REQUIRED'; end if;
  if lower(coalesce(v_profile.kyc_status, v_profile.verification_status, '')) not in ('approved','verified','passed') then
    raise exception 'KYC_REQUIRED';
  end if;
  if p_wallet_pin is null or p_wallet_pin !~ '^[0-9]{6}$' then raise exception 'WALLET_PIN_REQUIRED'; end if;
  if v_profile.wallet_pin_hash is null or not coalesce(v_profile.wallet_pin_set, false) then
    return jsonb_build_object('error','WALLET_PIN_NOT_SET','status','blocked');
  end if;
  if v_profile.wallet_pin_locked_until is not null and v_profile.wallet_pin_locked_until > v_now then
    return jsonb_build_object('error','WALLET_PIN_LOCKED','status','blocked');
  end if;

  if crypt(p_wallet_pin, v_profile.wallet_pin_hash) <> v_profile.wallet_pin_hash then
    v_failed := coalesce(v_profile.wallet_pin_failed_attempts, 0) + 1;
    update public.profiles
    set wallet_pin_failed_attempts = v_failed,
        wallet_pin_locked_until = case when v_failed >= 5 then v_now + interval '15 minutes' else null end,
        updated_at = v_now
    where id = v_profile.id;
    return jsonb_build_object(
      'error', case when v_failed >= 5 then 'WALLET_PIN_LOCKED' else 'WALLET_PIN_INVALID' end,
      'status', 'blocked',
      'attempts_remaining', greatest(0, 5 - v_failed)
    );
  end if;

  update public.profiles
  set wallet_pin_failed_attempts = 0,
      wallet_pin_locked_until = null,
      updated_at = v_now
  where id = v_profile.id;

  if coalesce(length(trim(p_idempotency_key)), 0) < 12 then
    raise exception 'INVALID_IDEMPOTENCY_KEY';
  end if;

  insert into public.workflow_operation_keys(profile_id, workflow_type, idempotency_key)
  values(v_profile.id, 'withdrawal_submit', trim(p_idempotency_key))
  on conflict do nothing;
  get diagnostics v_inserted = row_count;

  if v_inserted = 0 then
    select source_record_id into v_existing_id
    from public.workflow_operation_keys
    where profile_id = v_profile.id
      and workflow_type = 'withdrawal_submit'
      and idempotency_key = trim(p_idempotency_key);
    if v_existing_id is null then raise exception 'OPERATION_IN_PROGRESS_RETRY'; end if;
    return jsonb_build_object('id',v_existing_id,'duplicate',true,'status','for_review');
  end if;

  v_request_id := public.customer_submit_withdrawal_request(
    p_amount,
    p_payout_method,
    p_payout_holder,
    p_payout_account,
    p_customer_note
  );

  update public.workflow_operation_keys
  set source_record_id = v_request_id
  where profile_id = v_profile.id
    and workflow_type = 'withdrawal_submit'
    and idempotency_key = trim(p_idempotency_key);

  return jsonb_build_object('id',v_request_id,'duplicate',false,'status','for_review');
end;
$$;

revoke all on function public.customer_submit_withdrawal_request_guarded(numeric,text,text,text,text,text,text) from public, anon;
grant execute on function public.customer_submit_withdrawal_request_guarded(numeric,text,text,text,text,text,text) to authenticated;

create or replace function public.withdrawal_wallet_pin_guard_version()
returns text
language sql
stable
as $$ select '056_withdrawal_wallet_pin_guard_v1'::text $$;

grant execute on function public.withdrawal_wallet_pin_guard_version() to authenticated;

commit;

select jsonb_build_object(
  'migration', public.withdrawal_wallet_pin_guard_version(),
  'guarded_signature', to_regprocedure('public.customer_submit_withdrawal_request_guarded(numeric,text,text,text,text,text,text)') is not null,
  'legacy_signature_removed', to_regprocedure('public.customer_submit_withdrawal_request_guarded(numeric,text,text,text,text,text)') is null
) as verification;
