-- Reconcile an already-approved customer profile with a stale KYC queue row.
--
-- Safety rules:
--   * This migration never creates an approval or rejection decision.
--   * It only copies an existing approved/verified/passed profile decision to
--     the linked customer_kyc_profiles.status when that row is still pending.
--   * Rejected, missing, and ambiguous profile states remain blocked.
--   * The existing admin guard, row lock, and underlying review RPC remain in use.

begin;

do $preflight$
begin
  if to_regprocedure('public.admin_review_customer_kyc(uuid,text,text,text)') is null then
    raise exception 'ADMIN_REVIEW_CUSTOMER_KYC_NOT_FOUND';
  end if;

  if to_regclass('public.customer_kyc_profiles') is null then
    raise exception 'CUSTOMER_KYC_PROFILES_NOT_FOUND';
  end if;

  if to_regclass('public.profiles') is null then
    raise exception 'PROFILES_NOT_FOUND';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'customer_kyc_profiles'
      and column_name = 'status'
  ) then
    raise exception 'CUSTOMER_KYC_STATUS_COLUMN_NOT_FOUND';
  end if;
end;
$preflight$;

create or replace function public.admin_review_customer_kyc_guarded(
  p_kyc_profile_id uuid,
  p_decision text,
  p_note text default null,
  p_risk_level text default 'low'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kyc_row jsonb;
  v_kyc_status text;
  v_profile_status text;
  v_profile_id uuid;
  v_result uuid;
begin
  if not public.is_admin() then
    raise exception 'ADMIN_REQUIRED';
  end if;

  if lower(coalesce(p_decision, '')) not in ('approved', 'rejected') then
    raise exception 'INVALID_DECISION';
  end if;

  if lower(p_decision) = 'rejected'
    and nullif(trim(coalesce(p_note, '')), '') is null then
    raise exception 'REJECTION_NOTE_REQUIRED';
  end if;

  select to_jsonb(kyc), kyc.profile_id
  into v_kyc_row, v_profile_id
  from public.customer_kyc_profiles kyc
  where kyc.id = p_kyc_profile_id
  for update;

  if v_kyc_row is null then
    raise exception 'KYC_PROFILE_NOT_FOUND';
  end if;

  v_kyc_status := lower(replace(coalesce(
    v_kyc_row->>'status',
    v_kyc_row->>'verification_status',
    v_kyc_row->>'review_status',
    'pending'
  ), ' ', '_'));

  select lower(replace(coalesce(
    to_jsonb(profile_row)->>'kyc_status',
    to_jsonb(profile_row)->>'verification_status',
    ''
  ), ' ', '_'))
  into v_profile_status
  from public.profiles profile_row
  where profile_row.id = v_profile_id;

  if lower(p_decision) = 'approved'
    and v_kyc_status in ('approved', 'verified', 'passed', 'accepted') then
    return jsonb_build_object(
      'id', p_kyc_profile_id,
      'duplicate', true,
      'reconciled', false,
      'status', 'approved'
    );
  end if;

  if lower(p_decision) = 'rejected'
    and v_kyc_status in ('rejected', 'declined', 'denied') then
    return jsonb_build_object(
      'id', p_kyc_profile_id,
      'duplicate', true,
      'reconciled', false,
      'status', 'rejected'
    );
  end if;

  -- Repair only an approval that already exists on the linked profile. This
  -- removes a stale queue row without creating a new KYC decision.
  if v_kyc_status in ('pending', 'submitted', 'for_review', 'ready_for_review', 'needs_info')
    and v_profile_status in ('approved', 'verified', 'passed', 'accepted') then
    update public.customer_kyc_profiles
    set status = 'approved'
    where id = p_kyc_profile_id;

    return jsonb_build_object(
      'id', p_kyc_profile_id,
      'duplicate', true,
      'reconciled', true,
      'status', 'approved'
    );
  end if;

  if v_kyc_status not in ('pending', 'submitted', 'for_review', 'ready_for_review', 'needs_info') then
    raise exception 'KYC_ALREADY_REVIEWED';
  end if;

  v_result := public.admin_review_customer_kyc(
    p_kyc_profile_id,
    lower(p_decision),
    p_note,
    p_risk_level
  );

  return jsonb_build_object(
    'id', v_result,
    'duplicate', false,
    'reconciled', false,
    'status', lower(p_decision)
  );
end;
$$;

revoke all on function public.admin_review_customer_kyc_guarded(uuid,text,text,text) from public, anon;
grant execute on function public.admin_review_customer_kyc_guarded(uuid,text,text,text) to authenticated;

create or replace function public.kyc_review_reconciliation_version()
returns text
language sql
stable
set search_path = public
as $$
  select '053_customer_kyc_approved_state_reconciliation_v1'::text;
$$;

revoke all on function public.kyc_review_reconciliation_version() from public, anon;
grant execute on function public.kyc_review_reconciliation_version() to authenticated;

commit;

-- Read-only post-migration verification. A nonzero mismatch count requires
-- manual investigation; this query does not repair or decide any record.
select jsonb_build_object(
  'migration', public.kyc_review_reconciliation_version(),
  'approved_profile_pending_kyc_mismatches', count(*)
) as verification
from public.customer_kyc_profiles kyc
join public.profiles profile_row on profile_row.id = kyc.profile_id
where lower(replace(coalesce(to_jsonb(kyc)->>'status', ''), ' ', '_'))
      in ('pending', 'submitted', 'for_review', 'ready_for_review', 'needs_info')
  and lower(replace(coalesce(
        to_jsonb(profile_row)->>'kyc_status',
        to_jsonb(profile_row)->>'verification_status',
        ''
      ), ' ', '_'))
      in ('approved', 'verified', 'passed', 'accepted');
