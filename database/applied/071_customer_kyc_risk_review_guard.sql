-- Allow an Admin to review KYC submissions that automated checks flagged for
-- elevated or duplicate risk. These are queue states, not completed decisions.
--
-- Safety rules:
--   * This migration does not approve, reject, or rewrite any KYC record.
--   * Only the existing guarded Admin RPC is replaced.
--   * Active-admin authorization, row locking, rejection notes, canonical
--     review behavior, and idempotent completed decisions remain enforced.

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
  v_effective_risk_level text;
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

  v_effective_risk_level := case
    when v_kyc_status = 'high_risk' then 'high'
    when v_kyc_status = 'duplicate_risk' then 'medium'
    when lower(coalesce(p_risk_level, 'low')) in ('low', 'medium', 'high')
      then lower(p_risk_level)
    else 'low'
  end;

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

  -- Reconcile only an approval that already exists on the linked profile.
  -- This removes a stale queue row without creating a new KYC decision.
  if v_kyc_status in (
      'pending',
      'submitted',
      'for_review',
      'ready_for_review',
      'needs_info',
      'high_risk',
      'duplicate_risk'
    )
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

  if v_kyc_status not in (
    'pending',
    'submitted',
    'for_review',
    'ready_for_review',
    'needs_info',
    'high_risk',
    'duplicate_risk'
  ) then
    raise exception 'KYC_ALREADY_REVIEWED';
  end if;

  v_result := public.admin_review_customer_kyc(
    p_kyc_profile_id,
    lower(p_decision),
    p_note,
    v_effective_risk_level
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

create or replace function public.kyc_risk_review_guard_version()
returns text
language sql
stable
set search_path = public
as $$
  select '071_customer_kyc_risk_review_guard_v1'::text;
$$;

revoke all on function public.kyc_risk_review_guard_version() from public, anon;
grant execute on function public.kyc_risk_review_guard_version() to authenticated;

commit;

-- Read-only verification. Existing risk rows remain waiting for a real Admin
-- decision; this query proves only that the guard is installed and reviewable.
select jsonb_build_object(
  'migration', public.kyc_risk_review_guard_version(),
  'guard_accepts_high_risk', position(
    '''high_risk'''
    in pg_get_functiondef('public.admin_review_customer_kyc_guarded(uuid,text,text,text)'::regprocedure)
  ) > 0,
  'guard_accepts_duplicate_risk', position(
    '''duplicate_risk'''
    in pg_get_functiondef('public.admin_review_customer_kyc_guarded(uuid,text,text,text)'::regprocedure)
  ) > 0,
  'guard_enforces_risk_floor', position(
    'v_effective_risk_level'
    in pg_get_functiondef('public.admin_review_customer_kyc_guarded(uuid,text,text,text)'::regprocedure)
  ) > 0,
  'risk_rows_waiting_for_admin', (
    select count(*)
    from public.customer_kyc_profiles
    where lower(replace(coalesce(status, ''), ' ', '_')) in ('high_risk', 'duplicate_risk')
  )
) as verification;
