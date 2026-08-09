-- FarmConnect customer KYC review-status guard repair.
-- SAFE TO RUN after 045_operational_workflow_guard.sql.
-- This changes only the guarded review wrapper; it does not review any KYC row.

begin;

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
  v_row jsonb;
  v_status text;
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

  select to_jsonb(kyc)
  into v_row
  from public.customer_kyc_profiles kyc
  where id = p_kyc_profile_id
  for update;

  if v_row is null then
    raise exception 'KYC_PROFILE_NOT_FOUND';
  end if;

  v_status := lower(replace(coalesce(
    v_row->>'status',
    v_row->>'verification_status',
    v_row->>'review_status',
    'pending'
  ), ' ', '_'));

  if v_status = lower(p_decision) then
    return jsonb_build_object(
      'id', p_kyc_profile_id,
      'duplicate', true,
      'status', v_status
    );
  end if;

  if v_status not in (
    'pending',
    'submitted',
    'for_review',
    'ready_for_review',
    'needs_info'
  ) then
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
    'status', lower(p_decision)
  );
end;
$$;

revoke all on function public.admin_review_customer_kyc_guarded(uuid,text,text,text) from public, anon;
grant execute on function public.admin_review_customer_kyc_guarded(uuid,text,text,text) to authenticated;

commit;

select 'customer_kyc_review_status_guard_ready' as check_name, count(*) as count
from information_schema.routines
where routine_schema = 'public'
  and routine_name = 'admin_review_customer_kyc_guarded';
