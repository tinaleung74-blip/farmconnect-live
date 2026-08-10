-- Read-only verification for migration 053.
-- Returns IDs and statuses only; it does not expose KYC documents or modify rows.

select
  kyc.id as kyc_profile_id,
  kyc.profile_id,
  lower(replace(coalesce(
    to_jsonb(kyc)->>'status',
    to_jsonb(kyc)->>'verification_status',
    to_jsonb(kyc)->>'review_status',
    ''
  ), ' ', '_')) as kyc_status,
  lower(replace(coalesce(
    to_jsonb(profile_row)->>'kyc_status',
    to_jsonb(profile_row)->>'verification_status',
    ''
  ), ' ', '_')) as profile_kyc_status
from public.customer_kyc_profiles kyc
join public.profiles profile_row on profile_row.id = kyc.profile_id
where lower(replace(coalesce(
        to_jsonb(kyc)->>'status',
        to_jsonb(kyc)->>'verification_status',
        to_jsonb(kyc)->>'review_status',
        ''
      ), ' ', '_'))
      in ('pending', 'submitted', 'for_review', 'ready_for_review', 'needs_info')
  and lower(replace(coalesce(
        to_jsonb(profile_row)->>'kyc_status',
        to_jsonb(profile_row)->>'verification_status',
        ''
      ), ' ', '_'))
      in ('approved', 'verified', 'passed', 'accepted')
order by kyc.id;

select coalesce(
  to_regprocedure('public.kyc_review_reconciliation_version()')::text,
  'NOT_APPLIED'
) as reconciliation_version_function;
