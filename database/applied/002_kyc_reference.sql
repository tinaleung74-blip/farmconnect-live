-- FarmConnect KYC system reference
-- REFERENCE ONLY.
-- This records confirmed KYC objects/policies from chat output.
-- Do not run this file as a migration.

-- Confirmed functions:
-- public.admin_review_customer_kyc(
--   p_kyc_profile_id uuid,
--   p_decision text,
--   p_note text default null,
--   p_risk_level text default 'low'
-- )
--
-- public.customer_record_kyc_consent(
--   p_consent_version text,
--   p_consent_text text,
--   p_metadata jsonb default '{}'::jsonb
-- )
--
-- public.customer_submit_kyc(
--   p_legal_name text,
--   p_birthdate date,
--   p_address_line text,
--   p_city text,
--   p_province text,
--   p_postal_code text,
--   p_id_type text,
--   p_id_number_last4 text,
--   p_payout_name_to_match text,
--   p_valid_id_front_url text,
--   p_selfie_url text,
--   p_valid_id_back_url text default null,
--   p_address_proof_url text default null
-- )
--
-- public.run_kyc_system_checks(
--   p_profile_id uuid,
--   p_legal_name text,
--   p_birthdate date,
--   p_address_line text,
--   p_city text,
--   p_province text,
--   p_postal_code text,
--   p_id_type text,
--   p_id_number text,
--   p_valid_id_front_url text,
--   p_valid_id_back_url text,
--   p_selfie_url text
-- )

-- Confirmed safety results from chat:
-- danger_storage_policies_left = 0
-- public_kyc_buckets_left = 0
-- danger_profiles_update_policy_left = 0
-- customer_submit_kyc_function = 1
-- run_kyc_system_checks_function = 1
-- kyc_tables_exist = 4
-- safe_profile_update_policies = 2

-- Confirmed safe profile update policies after cleanup:
-- profiles admin update
-- profiles owner safe update

-- Confirmed index:
-- customer_kyc_profiles_profile_id_key on public.customer_kyc_profiles(profile_id)

-- Verification query, SAFE TO RUN:
select
  'kyc_functions' as section,
  jsonb_agg(proname order by proname) as data
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and proname in (
    'admin_review_customer_kyc',
    'customer_record_kyc_consent',
    'customer_submit_kyc',
    'run_kyc_system_checks'
  )

union all

select
  'kyc_tables' as section,
  jsonb_agg(table_name order by table_name) as data
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'customer_kyc_profiles',
    'kyc_documents',
    'kyc_consents',
    'kyc_system_checks'
  )

union all

select
  'profile_update_policies' as section,
  jsonb_agg(policyname order by policyname) as data
from pg_policies
where schemaname = 'public'
  and tablename = 'profiles'
  and cmd = 'UPDATE';
