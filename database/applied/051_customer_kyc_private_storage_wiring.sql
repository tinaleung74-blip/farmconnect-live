-- FarmConnect customer KYC private-storage wiring.
-- SAFE TO RUN after 029_admin_required_diagnostics.sql and 032_unified_account_verification_storage.sql.
-- This migration does not change KYC decisions or customer profile data.

begin;

do $preflight$
begin
  if not exists (select 1 from storage.buckets where id = 'farmconnect-customer-kyc') then
    raise exception 'CUSTOMER_KYC_BUCKET_NOT_FOUND';
  end if;

  if to_regprocedure('public.is_admin()') is null then
    raise exception 'IS_ADMIN_NOT_FOUND';
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
      'application/pdf'
    ]::text[]
where id = 'farmconnect-customer-kyc';

drop policy if exists "farmconnect kyc owner upload evidence" on storage.objects;
create policy "farmconnect kyc owner upload evidence"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'farmconnect-customer-kyc'
  and (storage.foldername(name))[1] = auth.uid()::text
  and (storage.foldername(name))[2] = 'submissions'
);

drop policy if exists "farmconnect kyc owner read evidence" on storage.objects;
create policy "farmconnect kyc owner read evidence"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'farmconnect-customer-kyc'
  and (storage.foldername(name))[1] = auth.uid()::text
  and (storage.foldername(name))[2] = 'submissions'
);

drop policy if exists "farmconnect kyc owner update evidence" on storage.objects;
create policy "farmconnect kyc owner update evidence"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'farmconnect-customer-kyc'
  and (storage.foldername(name))[1] = auth.uid()::text
  and (storage.foldername(name))[2] = 'submissions'
)
with check (
  bucket_id = 'farmconnect-customer-kyc'
  and (storage.foldername(name))[1] = auth.uid()::text
  and (storage.foldername(name))[2] = 'submissions'
);

drop policy if exists "farmconnect kyc admin read evidence" on storage.objects;
create policy "farmconnect kyc admin read evidence"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'farmconnect-customer-kyc'
  and public.is_admin()
);

commit;

select 'customer_kyc_private_bucket_ready' as check_name, count(*) as count
from storage.buckets
where id = 'farmconnect-customer-kyc'
  and not public
  and file_size_limit = 10485760
union all
select 'customer_kyc_storage_policies_ready', count(*)
from (
  select 1
  from pg_policies
  where schemaname = 'storage'
    and tablename = 'objects'
    and policyname in (
      'farmconnect kyc owner upload evidence',
      'farmconnect kyc owner read evidence',
      'farmconnect kyc owner update evidence',
      'farmconnect kyc admin read evidence'
    )
  having count(*) = 4
) ready;
