-- Synchronize a confirmed approved KYC submission to the linked customer profile.
-- This migration never creates a KYC decision. It only mirrors an existing
-- approved/verified/passed/accepted customer_kyc_profiles.status value.

begin;

do $preflight$
begin
  if to_regclass('public.customer_kyc_profiles') is null then
    raise exception 'CUSTOMER_KYC_PROFILES_NOT_FOUND';
  end if;

  if to_regclass('public.profiles') is null then
    raise exception 'PROFILES_NOT_FOUND';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'customer_kyc_profiles' and column_name = 'status'
  ) then
    raise exception 'CUSTOMER_KYC_STATUS_COLUMN_NOT_FOUND';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'kyc_status'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'verification_status'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'kyc_verified_at'
  ) then
    raise exception 'PROFILE_KYC_SYNC_COLUMNS_NOT_FOUND';
  end if;
end;
$preflight$;

create or replace function public.sync_approved_customer_kyc_to_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if lower(replace(coalesce(new.status, ''), ' ', '_'))
      in ('approved', 'verified', 'passed', 'accepted') then
    update public.profiles
    set kyc_status = 'approved',
        verification_status = 'approved',
        kyc_verified_at = coalesce(kyc_verified_at, now())
    where id = new.profile_id
      and (
        lower(coalesce(kyc_status, '')) <> 'approved'
        or lower(coalesce(verification_status, '')) <> 'approved'
        or kyc_verified_at is null
      );
  end if;

  return new;
end;
$$;

revoke all on function public.sync_approved_customer_kyc_to_profile() from public, anon, authenticated;

drop trigger if exists trg_sync_approved_customer_kyc_to_profile on public.customer_kyc_profiles;
create trigger trg_sync_approved_customer_kyc_to_profile
after insert or update of status on public.customer_kyc_profiles
for each row
when (lower(replace(coalesce(new.status, ''), ' ', '_')) in ('approved', 'verified', 'passed', 'accepted'))
execute function public.sync_approved_customer_kyc_to_profile();

-- Backfill only profiles whose linked KYC row already contains a terminal
-- approval. No pending or rejected KYC row can enter this update.
update public.profiles profile_row
set kyc_status = 'approved',
    verification_status = 'approved',
    kyc_verified_at = coalesce(profile_row.kyc_verified_at, now())
from public.customer_kyc_profiles kyc
where kyc.profile_id = profile_row.id
  and lower(replace(coalesce(kyc.status, ''), ' ', '_'))
      in ('approved', 'verified', 'passed', 'accepted')
  and (
    lower(coalesce(profile_row.kyc_status, '')) <> 'approved'
    or lower(coalesce(profile_row.verification_status, '')) <> 'approved'
    or profile_row.kyc_verified_at is null
  );

create or replace function public.customer_kyc_profile_approval_sync_version()
returns text
language sql
stable
set search_path = public
as $$
  select '054_customer_kyc_profile_approval_sync_v1'::text;
$$;

revoke all on function public.customer_kyc_profile_approval_sync_version() from public, anon;
grant execute on function public.customer_kyc_profile_approval_sync_version() to authenticated;

commit;

-- Read-only post-migration verification. Expected mismatch count: 0.
select jsonb_build_object(
  'migration', public.customer_kyc_profile_approval_sync_version(),
  'approved_kyc_profile_mismatches', count(*)
) as verification
from public.customer_kyc_profiles kyc
join public.profiles profile_row on profile_row.id = kyc.profile_id
where lower(replace(coalesce(kyc.status, ''), ' ', '_'))
      in ('approved', 'verified', 'passed', 'accepted')
  and (
    lower(coalesce(profile_row.kyc_status, '')) not in ('approved', 'verified', 'passed')
    or lower(coalesce(profile_row.verification_status, '')) not in ('approved', 'verified', 'passed')
    or profile_row.kyc_verified_at is null
  );
