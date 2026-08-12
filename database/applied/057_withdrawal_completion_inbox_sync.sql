-- FarmConnect withdrawal completion Inbox synchronization.
-- Purpose:
-- - Replace the actionable payout-confirmation notice after the customer responds.
-- - Show an explicit final success notification when the withdrawal is completed.
-- - Keep problem reports visible to the customer while returning the request to Admin.

begin;

do $preflight$
begin
  if to_regclass('public.withdrawal_requests') is null then
    raise exception 'WITHDRAWAL_REQUESTS_NOT_FOUND';
  end if;

  if to_regclass('public.inbox_items') is null then
    raise exception 'INBOX_ITEMS_NOT_FOUND';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'inbox_items'
      and column_name = 'is_read'
  ) or not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'inbox_items'
      and column_name = 'read_at'
  ) then
    raise exception 'INBOX_READ_STATE_COLUMNS_NOT_FOUND';
  end if;
end;
$preflight$;

create or replace function public.customer_confirm_withdrawal_result(
  p_withdrawal_request_id uuid,
  p_received boolean,
  p_customer_note text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_request public.withdrawal_requests%rowtype;
  v_inbox_item_id uuid;
  v_notification_title text;
  v_notification_body text;
begin
  select id into v_profile_id
  from public.profiles
  where auth_user_id = auth.uid()
  limit 1;

  if v_profile_id is null then raise exception 'LOGIN_REQUIRED'; end if;

  select * into v_request
  from public.withdrawal_requests
  where id = p_withdrawal_request_id
    and profile_id = v_profile_id
  for update;

  if not found then raise exception 'WITHDRAWAL_NOT_FOUND'; end if;
  if v_request.status <> 'sent_for_customer_confirmation' then
    raise exception 'WITHDRAWAL_NOT_WAITING_FOR_CONFIRMATION';
  end if;
  if not p_received and nullif(trim(coalesce(p_customer_note, '')), '') is null then
    raise exception 'PROBLEM_NOTE_REQUIRED';
  end if;

  if p_received then
    update public.profiles
    set wallet_on_hold = greatest(coalesce(wallet_on_hold, 0) - v_request.amount, 0),
        updated_at = now()
    where id = v_profile_id;

    update public.withdrawal_requests
    set status = 'completed',
        customer_confirmed_at = now(),
        customer_confirmation_note = p_customer_note,
        updated_at = now()
    where id = v_request.id;

    v_notification_title := 'Withdrawal Completed';
    v_notification_body := concat(
      'You confirmed receipt of the payout. Amount: ', v_request.amount,
      '. Method: ', coalesce(nullif(trim(v_request.payout_method), ''), 'Saved payout method'),
      '. Reference: ', coalesce(nullif(trim(v_request.admin_reference_number), ''), 'Not provided'),
      '. This withdrawal is complete and remains in your wallet records.'
    );
  else
    update public.withdrawal_requests
    set status = 'needs_info',
        customer_confirmation_note = p_customer_note,
        updated_at = now()
    where id = v_request.id;

    v_notification_title := 'Withdrawal Problem Reported';
    v_notification_body := concat(
      'Your payout problem was sent back to Admin for review. Reference: ',
      coalesce(nullif(trim(v_request.admin_reference_number), ''), 'Not provided'),
      '. Your note: ', trim(p_customer_note),
      '.'
    );
  end if;

  -- Reuse the latest actionable confirmation card for this customer so the
  -- Inbox never keeps asking them to confirm an already-resolved withdrawal.
  select inbox.id into v_inbox_item_id
  from public.inbox_items inbox
  where inbox.profile_id = v_profile_id
    and lower(coalesce(inbox.category, '')) = 'withdraw'
    and inbox.title = 'Confirm Withdrawal Payout'
    and inbox.created_at >= v_request.created_at
  order by inbox.created_at desc
  limit 1
  for update;

  if v_inbox_item_id is null then
    insert into public.inbox_items(
      profile_id,
      category,
      title,
      body,
      is_read,
      read_at,
      created_at
    ) values (
      v_profile_id,
      'withdraw',
      v_notification_title,
      v_notification_body,
      false,
      null,
      now()
    )
    returning id into v_inbox_item_id;
  else
    update public.inbox_items
    set title = v_notification_title,
        body = v_notification_body,
        is_read = false,
        read_at = null,
        created_at = now()
    where id = v_inbox_item_id;
  end if;

  insert into public.withdrawal_evidence_logs(
    withdrawal_request_id,
    profile_id,
    event_type,
    title,
    details,
    actor_profile_id
  ) values (
    v_request.id,
    v_profile_id,
    case when p_received then 'customer_confirmed_received' else 'customer_reported_payout_problem' end,
    case when p_received then 'Customer confirmed payout received' else 'Customer reported payout problem' end,
    jsonb_build_object(
      'reference', v_request.admin_reference_number,
      'method', v_request.payout_method,
      'note', p_customer_note,
      'inbox_item_id', v_inbox_item_id
    ),
    v_profile_id
  );

  return v_request.id;
end;
$$;

revoke all on function public.customer_confirm_withdrawal_result(uuid, boolean, text) from public, anon;
grant execute on function public.customer_confirm_withdrawal_result(uuid, boolean, text) to authenticated;

-- Reconcile the latest stale confirmation card for customers who completed a
-- withdrawal before this migration. This changes notification copy only; it
-- does not change withdrawal, wallet, KYC, or payment state.
with latest_completed as (
  select distinct on (request.profile_id)
    request.profile_id,
    request.amount,
    request.payout_method,
    request.admin_reference_number,
    request.customer_confirmed_at
  from public.withdrawal_requests request
  where request.status = 'completed'
    and request.customer_confirmed_at is not null
  order by request.profile_id, request.customer_confirmed_at desc
), latest_stale_notice as (
  select distinct on (inbox.profile_id)
    inbox.id,
    completed.amount,
    completed.payout_method,
    completed.admin_reference_number
  from public.inbox_items inbox
  join latest_completed completed on completed.profile_id = inbox.profile_id
  where lower(coalesce(inbox.category, '')) = 'withdraw'
    and inbox.title = 'Confirm Withdrawal Payout'
    and inbox.created_at <= completed.customer_confirmed_at
  order by inbox.profile_id, inbox.created_at desc
)
update public.inbox_items inbox
set title = 'Withdrawal Completed',
    body = concat(
      'You confirmed receipt of the payout. Amount: ', stale.amount,
      '. Method: ', coalesce(nullif(trim(stale.payout_method), ''), 'Saved payout method'),
      '. Reference: ', coalesce(nullif(trim(stale.admin_reference_number), ''), 'Not provided'),
      '. This withdrawal is complete and remains in your wallet records.'
    ),
    is_read = false,
    read_at = null,
    created_at = now()
from latest_stale_notice stale
where inbox.id = stale.id;

create or replace function public.withdrawal_completion_inbox_sync_version()
returns text
language sql
stable
set search_path = public
as $$
  select '057_withdrawal_completion_inbox_sync_v1'::text;
$$;

revoke all on function public.withdrawal_completion_inbox_sync_version() from public, anon;
grant execute on function public.withdrawal_completion_inbox_sync_version() to authenticated;

commit;

-- Read-only post-migration verification. Expected mismatch count: 0.
select jsonb_build_object(
  'migration', public.withdrawal_completion_inbox_sync_version(),
  'completed_with_stale_confirmation_notice', count(*)
) as verification
from public.withdrawal_requests request
where request.status = 'completed'
  and request.customer_confirmed_at is not null
  and exists (
    select 1
    from public.inbox_items inbox
    where inbox.profile_id = request.profile_id
      and lower(coalesce(inbox.category, '')) = 'withdraw'
      and inbox.title = 'Confirm Withdrawal Payout'
      and inbox.created_at <= request.customer_confirmed_at
  );
