-- FarmConnect private withdrawal payout-proof storage.
-- Admin uploads the real external payout receipt. The linked customer can read
-- only the proof attached to their own withdrawal request.

begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'withdrawal-proofs',
  'withdrawal-proofs',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "withdrawal proof admin upload" on storage.objects;
create policy "withdrawal proof admin upload"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'withdrawal-proofs'
  and public.is_admin()
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "withdrawal proof linked read" on storage.objects;
create policy "withdrawal proof linked read"
on storage.objects for select to authenticated
using (
  bucket_id = 'withdrawal-proofs'
  and (
    public.is_admin()
    or exists (
      select 1
      from public.withdrawal_requests request
      where request.admin_receipt_url = name
        and request.profile_id = public.current_profile_id()
    )
  )
);

drop policy if exists "withdrawal proof admin update" on storage.objects;
create policy "withdrawal proof admin update"
on storage.objects for update to authenticated
using (bucket_id = 'withdrawal-proofs' and public.is_admin())
with check (bucket_id = 'withdrawal-proofs' and public.is_admin());

commit;

select 'withdrawal_payout_proof_storage_ready' as check_name, count(*) as count
from storage.buckets
where id = 'withdrawal-proofs' and public = false;
