-- Read-only verification for migration 054.
-- Expected result: no rows.

select
  kyc.id as kyc_profile_id,
  kyc.profile_id,
  lower(replace(coalesce(kyc.status, ''), ' ', '_')) as kyc_status,
  lower(coalesce(profile_row.kyc_status, '')) as profile_kyc_status,
  lower(coalesce(profile_row.verification_status, '')) as profile_verification_status,
  profile_row.kyc_verified_at
from public.customer_kyc_profiles kyc
join public.profiles profile_row on profile_row.id = kyc.profile_id
where lower(replace(coalesce(kyc.status, ''), ' ', '_'))
      in ('approved', 'verified', 'passed', 'accepted')
  and (
    lower(coalesce(profile_row.kyc_status, '')) not in ('approved', 'verified', 'passed')
    or lower(coalesce(profile_row.verification_status, '')) not in ('approved', 'verified', 'passed')
    or profile_row.kyc_verified_at is null
  )
order by kyc.id;

select coalesce(
  to_regprocedure('public.customer_kyc_profile_approval_sync_version()')::text,
  'NOT_APPLIED'
) as approval_sync_version_function;
