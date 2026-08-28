-- Additive correction/report support. Does not rewrite historical business rows.
begin;
alter table public.task_proofs add column if not exists daily_report jsonb;
alter table public.task_proofs add column if not exists submission_key text;
create unique index if not exists task_proofs_submission_key_unique
  on public.task_proofs(caretaker_task_id, submission_key) where submission_key is not null;

-- The original read policy covered only proof_url (the first photo).
drop policy if exists "caretaker task proof read linked" on storage.objects;
create policy "caretaker task proof read linked" on storage.objects
for select to authenticated using (
  bucket_id = 'caretaker-task-proofs' and (
    (storage.foldername(name))[1] = auth.uid()::text or public.is_admin()
    or exists (select 1 from public.task_proofs proof
      where (proof.proof_url = name or name = any(proof.proof_file_urls))
        and proof.profile_id = public.current_profile_id()
        and proof.admin_review_status = 'approved')
  )
);

-- Keep v3 unchanged for the existing mission RPCs. New clients use v4.
create or replace function public.caretaker_submit_task_proof_v4(
  p_task_id uuid, p_proof_urls text[], p_preset_note text,
  p_free_note text, p_qr_verified boolean, p_serial_exception boolean,
  p_feed_quantity_used numeric, p_feed_unit text,
  p_daily_report jsonb, p_submission_key text
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_entry jsonb;
begin
  if auth.uid() is null then raise exception 'LOGIN_REQUIRED'; end if;
  -- Check ownership even on idempotent retries, before returning any proof ID.
  perform 1 from public.caretaker_tasks t
    join public.caretakers c on c.id = t.caretaker_id
    join public.profiles p on (p.id = c.profile_id or p.id = c.caretaker_profile_id)
    where t.id = p_task_id and p.auth_user_id = auth.uid();
  if not found then raise exception 'TASK_NOT_ASSIGNED_TO_CURRENT_CARETAKER'; end if;
  if p_submission_key is null or length(trim(p_submission_key)) not between 8 and 100 then
    raise exception 'SUBMISSION_KEY_REQUIRED';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_task_id::text || ':' || p_submission_key, 0));
  select id into v_id from public.task_proofs
    where caretaker_task_id = p_task_id and submission_key = p_submission_key;
  if found then return v_id; end if;
  if coalesce(cardinality(p_proof_urls), 0) not between 1 and 5 then
    raise exception 'ONE_TO_FIVE_PROOFS_REQUIRED';
  end if;
  if exists (select 1 from unnest(p_proof_urls) path
    where path is null or path not like auth.uid()::text || '/tasks/' || p_task_id::text || '/%'
      or path like '%..%') then raise exception 'PROOF_PATH_INVALID'; end if;
  if p_daily_report is not null then
    if jsonb_typeof(p_daily_report) <> 'array' then raise exception 'DAILY_REPORT_INVALID'; end if;
    if jsonb_array_length(p_daily_report) not between 1 and 5
       or jsonb_array_length(p_daily_report) <> cardinality(p_proof_urls) then
      raise exception 'ONE_PHOTO_PER_ENTRY_REQUIRED';
    end if;
    for v_entry in select value from jsonb_array_elements(p_daily_report) loop
      if jsonb_typeof(v_entry) <> 'object'
        or coalesce(v_entry->>'period', '') not in ('Morning','Midday','Afternoon','Evening')
        or coalesce(v_entry->>'time', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
        or length(trim(coalesce(v_entry->>'work', ''))) not between 3 and 2000
        or length(trim(coalesce(v_entry->>'findings', ''))) not between 3 and 2000 then
        raise exception 'DAILY_REPORT_ENTRY_INVALID';
      end if;
    end loop;
  end if;
  v_id := public.caretaker_submit_task_proof_v3(p_task_id, p_proof_urls,
    p_preset_note, case when p_daily_report is null then p_free_note
      else '[FARMCONNECT_DAILY_REPORT_V1]' || chr(10) || p_daily_report::text end,
    p_qr_verified, p_serial_exception,
    p_feed_quantity_used, p_feed_unit);
  update public.task_proofs set daily_report = p_daily_report,
    submission_key = p_submission_key where id = v_id;
  return v_id;
end;
$$;
revoke all on function public.caretaker_submit_task_proof_v4(uuid,text[],text,text,boolean,boolean,numeric,text,jsonb,text) from public, anon;
grant execute on function public.caretaker_submit_task_proof_v4(uuid,text[],text,text,boolean,boolean,numeric,text,jsonb,text) to authenticated;
commit;
select jsonb_build_object('migration','088_care_report_submission_guard',
  'submission_rpc',to_regprocedure('public.caretaker_submit_task_proof_v4(uuid,text[],text,text,boolean,boolean,numeric,text,jsonb,text)') is not null,
  'business_records_changed',false) as verification;
