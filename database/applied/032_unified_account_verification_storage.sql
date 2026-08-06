-- FarmConnect unified Account Verification storage/access hardening.
-- Prepared from live read-only audit on 2026-08-05.
-- Purpose:
--   1. Reuse the existing private caretaker-resumes bucket for applicant evidence.
--   2. Allow an authenticated applicant to upload/read/update only their own
--      auth.uid()/applications folder before a caretaker record exists.
--   3. Keep customer KYC and caretaker submission/review RPCs unavailable to anon.
--   4. Preserve admin-only approval decisions inside the existing RPC guards.
-- No application rows or evidence files are deleted or rewritten.

begin;

do $preflight$
begin
  if not exists (select 1 from storage.buckets where id = 'caretaker-resumes') then
    raise exception 'CARETAKER_RESUMES_BUCKET_NOT_FOUND';
  end if;

  if not exists (select 1 from storage.buckets where id = 'farmconnect-customer-kyc') then
    raise exception 'CUSTOMER_KYC_BUCKET_NOT_FOUND';
  end if;

  if to_regprocedure('public.submit_caretaker_application(text,text,text,date,text,text,text,text,text,text,text,text,text,boolean)') is null then
    raise exception 'SUBMIT_CARETAKER_APPLICATION_NOT_FOUND';
  end if;

  if to_regprocedure('public.admin_review_caretaker_application(uuid,text,text)') is null then
    raise exception 'ADMIN_REVIEW_CARETAKER_APPLICATION_NOT_FOUND';
  end if;

  if to_regprocedure('public.customer_submit_kyc(text,date,text,text,text,text,text,text,text,text,text,text,text)') is null then
    raise exception 'CUSTOMER_SUBMIT_KYC_NOT_FOUND';
  end if;

  if to_regprocedure('public.admin_review_customer_kyc(uuid,text,text,text)') is null then
    raise exception 'ADMIN_REVIEW_CUSTOMER_KYC_NOT_FOUND';
  end if;
end;
$preflight$;

update storage.buckets
set public = false,
    file_size_limit = 10485760,
    allowed_mime_types = array[
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]::text[]
where id = 'caretaker-resumes';

drop policy if exists "farmconnect caretaker applicants upload own evidence" on storage.objects;
create policy "farmconnect caretaker applicants upload own evidence"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'caretaker-resumes'
  and (storage.foldername(name))[1] = auth.uid()::text
  and (storage.foldername(name))[2] = 'applications'
);

drop policy if exists "farmconnect caretaker applicants read own evidence" on storage.objects;
create policy "farmconnect caretaker applicants read own evidence"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'caretaker-resumes'
  and (storage.foldername(name))[1] = auth.uid()::text
  and (storage.foldername(name))[2] = 'applications'
);

drop policy if exists "farmconnect caretaker applicants update own evidence" on storage.objects;
create policy "farmconnect caretaker applicants update own evidence"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'caretaker-resumes'
  and (storage.foldername(name))[1] = auth.uid()::text
  and (storage.foldername(name))[2] = 'applications'
)
with check (
  bucket_id = 'caretaker-resumes'
  and (storage.foldername(name))[1] = auth.uid()::text
  and (storage.foldername(name))[2] = 'applications'
);

revoke all on function public.submit_caretaker_application(
  text, text, text, date, text, text, text, text, text, text, text, text, text, boolean
) from public;
revoke all on function public.submit_caretaker_application(
  text, text, text, date, text, text, text, text, text, text, text, text, text, boolean
) from anon;
grant execute on function public.submit_caretaker_application(
  text, text, text, date, text, text, text, text, text, text, text, text, text, boolean
) to authenticated;

revoke all on function public.admin_review_caretaker_application(uuid, text, text) from public;
revoke all on function public.admin_review_caretaker_application(uuid, text, text) from anon;
grant execute on function public.admin_review_caretaker_application(uuid, text, text) to authenticated;

revoke all on function public.customer_submit_kyc(
  text, date, text, text, text, text, text, text, text, text, text, text, text
) from public;
revoke all on function public.customer_submit_kyc(
  text, date, text, text, text, text, text, text, text, text, text, text, text
) from anon;
grant execute on function public.customer_submit_kyc(
  text, date, text, text, text, text, text, text, text, text, text, text, text
) to authenticated;

revoke all on function public.admin_review_customer_kyc(uuid, text, text, text) from public;
revoke all on function public.admin_review_customer_kyc(uuid, text, text, text) from anon;
grant execute on function public.admin_review_customer_kyc(uuid, text, text, text) to authenticated;

commit;

select jsonb_build_object(
  'migration', '032_unified_account_verification_storage',
  'caretaker_bucket_private',
    coalesce((select not public from storage.buckets where id = 'caretaker-resumes'), false),
  'caretaker_bucket_limit_10mb',
    coalesce((select file_size_limit = 10485760 from storage.buckets where id = 'caretaker-resumes'), false),
  'applicant_storage_policies',
    (
      select count(*)
      from pg_policies
      where schemaname = 'storage'
        and tablename = 'objects'
        and policyname in (
          'farmconnect caretaker applicants upload own evidence',
          'farmconnect caretaker applicants read own evidence',
          'farmconnect caretaker applicants update own evidence'
        )
    ),
  'anon_submit_caretaker_execute',
    has_function_privilege(
      'anon',
      'public.submit_caretaker_application(text,text,text,date,text,text,text,text,text,text,text,text,text,boolean)',
      'EXECUTE'
    ),
  'anon_review_caretaker_execute',
    has_function_privilege('anon', 'public.admin_review_caretaker_application(uuid,text,text)', 'EXECUTE'),
  'anon_submit_kyc_execute',
    has_function_privilege(
      'anon',
      'public.customer_submit_kyc(text,date,text,text,text,text,text,text,text,text,text,text,text)',
      'EXECUTE'
    ),
  'anon_review_kyc_execute',
    has_function_privilege('anon', 'public.admin_review_customer_kyc(uuid,text,text,text)', 'EXECUTE'),
  'authenticated_submit_caretaker_execute',
    has_function_privilege(
      'authenticated',
      'public.submit_caretaker_application(text,text,text,date,text,text,text,text,text,text,text,text,text,boolean)',
      'EXECUTE'
    ),
  'authenticated_review_caretaker_execute',
    has_function_privilege('authenticated', 'public.admin_review_caretaker_application(uuid,text,text)', 'EXECUTE'),
  'authenticated_submit_kyc_execute',
    has_function_privilege(
      'authenticated',
      'public.customer_submit_kyc(text,date,text,text,text,text,text,text,text,text,text,text,text)',
      'EXECUTE'
    ),
  'authenticated_review_kyc_execute',
    has_function_privilege('authenticated', 'public.admin_review_customer_kyc(uuid,text,text,text)', 'EXECUTE')
) as migration_result;
