-- FarmConnect private caretaker task-proof storage.
-- Proof files remain private. Caretakers can manage only their own task files;
-- admins can read proof files while reviewing submitted work.

begin;

alter table public.task_proofs
  add column if not exists proof_file_urls text[] not null default '{}'::text[];

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'caretaker-task-proofs',
  'caretaker-task-proofs',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "caretaker task proof upload own" on storage.objects;
create policy "caretaker task proof upload own"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'caretaker-task-proofs'
  and (storage.foldername(name))[1] = auth.uid()::text
  and (storage.foldername(name))[2] = 'tasks'
);

drop policy if exists "caretaker task proof read linked" on storage.objects;
create policy "caretaker task proof read linked"
on storage.objects for select to authenticated
using (
  bucket_id = 'caretaker-task-proofs'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_admin()
    or exists (
      select 1
      from public.task_proofs proof
      where proof.proof_url = name
        and proof.profile_id = public.current_profile_id()
        and proof.admin_review_status = 'approved'
    )
  )
);

drop policy if exists "caretaker task proof update own" on storage.objects;
create policy "caretaker task proof update own"
on storage.objects for update to authenticated
using (
  bucket_id = 'caretaker-task-proofs'
  and (storage.foldername(name))[1] = auth.uid()::text
  and (storage.foldername(name))[2] = 'tasks'
)
with check (
  bucket_id = 'caretaker-task-proofs'
  and (storage.foldername(name))[1] = auth.uid()::text
  and (storage.foldername(name))[2] = 'tasks'
);

create or replace function public.caretaker_submit_task_proof_v3(
  p_task_id uuid,
  p_proof_urls text[] default '{}'::text[],
  p_preset_note text default null,
  p_free_note text default null,
  p_qr_verified boolean default true,
  p_serial_exception boolean default false,
  p_feed_quantity_used numeric default null,
  p_feed_unit text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_proof_id uuid;
begin
  if coalesce(array_length(p_proof_urls, 1), 0) = 0 then
    raise exception 'PROOF_FILE_REQUIRED';
  end if;

  v_proof_id := public.caretaker_submit_task_proof(
    p_task_id,
    p_proof_urls[1],
    p_preset_note,
    p_free_note,
    p_qr_verified,
    p_serial_exception,
    p_feed_quantity_used,
    p_feed_unit
  );

  update public.task_proofs
  set proof_file_urls = p_proof_urls,
      thumbnail_url = p_proof_urls[1]
  where id = v_proof_id;

  return v_proof_id;
end;
$$;

revoke all on function public.caretaker_submit_task_proof_v3(uuid,text[],text,text,boolean,boolean,numeric,text) from public;
revoke all on function public.caretaker_submit_task_proof_v3(uuid,text[],text,text,boolean,boolean,numeric,text) from anon;
grant execute on function public.caretaker_submit_task_proof_v3(uuid,text[],text,text,boolean,boolean,numeric,text) to authenticated;

commit;

select 'caretaker_task_proof_storage_ready' as check_name, count(*) as count
from storage.buckets
where id = 'caretaker-task-proofs' and public = false
union all
select 'caretaker_task_proof_v3_ready', count(*)
from information_schema.routines
where routine_schema = 'public' and routine_name = 'caretaker_submit_task_proof_v3';
