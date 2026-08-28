-- Apply after 088, before deploying the matching client. No historical row rewrite.
begin;
alter table public.task_proofs add column if not exists submission_payload jsonb;
alter table public.task_proofs add column if not exists actual_remaining_feed numeric;

-- Evidence uses new object names for every correction. No client may overwrite/delete it.
drop policy if exists "caretaker task proof update own" on storage.objects;
drop policy if exists "caretaker evidence immutable update" on storage.objects;
create policy "caretaker evidence immutable update" on storage.objects as restrictive
for update to authenticated using (bucket_id <> 'caretaker-task-proofs')
with check (bucket_id <> 'caretaker-task-proofs');
drop policy if exists "caretaker evidence immutable delete" on storage.objects;
create policy "caretaker evidence immutable delete" on storage.objects as restrictive
for delete to authenticated using (bucket_id <> 'caretaker-task-proofs');

create or replace function public.caretaker_submit_report_guarded(p_request jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_task public.caretaker_tasks%rowtype;
  v_task_id uuid := (p_request->>'p_task_id')::uuid;
  v_key text := p_request->>'p_submission_key';
  v_id uuid;
  v_old_payload jsonb;
  v_paths text[];
  v_path text;
  v_report jsonb := nullif(p_request->'p_daily_report','null'::jsonb);
  v_entry jsonb;
  v_note text := p_request->>'p_free_note';
  v_health text := p_request->>'p_health_status';
  v_remaining numeric := (p_request->>'p_actual_remaining_feed')::numeric;
  v_qr boolean := coalesce((p_request->>'p_qr_verified')::boolean,false);
  v_exception boolean := coalesce((p_request->>'p_serial_exception')::boolean,false);
begin
  if auth.uid() is null then raise exception 'LOGIN_REQUIRED'; end if;
  if jsonb_typeof(p_request) is distinct from 'object' then raise exception 'INVALID_REQUEST'; end if;
  if v_key is null or length(v_key) not between 8 and 100 then raise exception 'SUBMISSION_KEY_REQUIRED'; end if;
  -- Serialize all submissions of this task, including different keys.
  select t.* into v_task from public.caretaker_tasks t
    join public.caretakers c on c.id=t.caretaker_id
    join public.profiles p on (p.id=c.profile_id or p.id=c.caretaker_profile_id)
    where t.id=v_task_id and p.auth_user_id=auth.uid() for update of t;
  if not found then raise exception 'TASK_NOT_ASSIGNED_TO_CURRENT_CARETAKER'; end if;
  select id,submission_payload into v_id,v_old_payload from public.task_proofs
    where caretaker_task_id=v_task_id and submission_key=v_key;
  if found then
    if v_old_payload is distinct from p_request then raise exception 'SUBMISSION_KEY_PAYLOAD_CHANGED'; end if;
    return v_id;
  end if;
  if v_task.status not in ('active','in_progress','backjob') then raise exception 'TASK_ALREADY_SUBMITTED'; end if;
  if jsonb_typeof(p_request->'p_proof_urls') is distinct from 'array' then raise exception 'PROOF_ARRAY_REQUIRED'; end if;
  select coalesce(array_agg(value),'{}'::text[]) into v_paths
    from jsonb_array_elements_text(p_request->'p_proof_urls');
  if v_task.workflow_type='sale_release_confirmation' then
    if cardinality(v_paths)<>0 then raise exception 'RELEASE_PHOTOS_NOT_REQUIRED'; end if;
  elsif cardinality(v_paths) not between 1 and 5 then raise exception 'ONE_TO_FIVE_PROOFS_REQUIRED'; end if;
  if (select count(distinct path) from unnest(v_paths) path) <> cardinality(v_paths) then
    raise exception 'DISTINCT_PROOF_FILES_REQUIRED';
  end if;
  foreach v_path in array v_paths loop
    if v_path is null or v_path like '%..%' or split_part(v_path,'/',2)<>'tasks'
      or split_part(v_path,'/',3)<>v_task_id::text then raise exception 'PROOF_PATH_INVALID'; end if;
    if split_part(v_path,'/',1)<>auth.uid()::text and not exists (
      select 1 from public.task_proofs proof where proof.caretaker_task_id=v_task_id
        and (proof.proof_url=v_path or v_path=any(proof.proof_file_urls))
    ) then raise exception 'PROOF_NOT_LINKED_TO_TASK'; end if;
    perform 1 from storage.objects where bucket_id='caretaker-task-proofs' and name=v_path for share;
    if not found then raise exception 'PROOF_OBJECT_MISSING'; end if;
  end loop;
  if coalesce(v_task.workflow_type,'') not in ('qr_tagging','sale_price_inspection','sale_release_confirmation') then
    if jsonb_typeof(v_report) is distinct from 'array' then raise exception 'DAILY_REPORT_REQUIRED'; end if;
    if jsonb_array_length(v_report) not between 1 and 5 or jsonb_array_length(v_report)<>cardinality(v_paths) then
      raise exception 'ONE_PHOTO_PER_ENTRY_REQUIRED'; end if;
    for v_entry in select value from jsonb_array_elements(v_report) loop
      if jsonb_typeof(v_entry) is distinct from 'object'
        or coalesce(v_entry->>'period','') not in ('Morning','Midday','Afternoon','Evening')
        or coalesce(v_entry->>'time','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
        or length(trim(coalesce(v_entry->>'work',''))) not between 3 and 2000
        or length(trim(coalesce(v_entry->>'findings',''))) not between 3 and 2000 then
        raise exception 'DAILY_REPORT_ENTRY_INVALID'; end if;
    end loop;
    v_note := '[FARMCONNECT_DAILY_REPORT_V1]' || chr(10) || v_report::text;
  end if;
  if v_task.workflow_type in ('care_plan_daily_mission','manual_standard_mission') then
    if coalesce(v_health,'') not in ('pass','watch','isolate_and_escalate') then raise exception 'HEALTH_RESULT_REQUIRED'; end if;
    if v_remaining is null or v_remaining<0 or v_remaining::text in ('NaN','Infinity','-Infinity') then raise exception 'ACTUAL_REMAINING_FEED_REQUIRED'; end if;
    if jsonb_typeof(p_request->'p_checklist_results') is distinct from 'object'
      or jsonb_typeof(p_request->'p_inventory_usage') is distinct from 'array' then raise exception 'MISSION_DETAILS_REQUIRED'; end if;
    if v_task.workflow_type='care_plan_daily_mission' then
      v_id := public.caretaker_submit_mission_proof(v_task_id,v_paths,v_note,v_qr,v_exception,
        v_health,p_request->'p_checklist_results',p_request->'p_inventory_usage');
    else
      v_id := public.caretaker_submit_manual_mission_proof(v_task_id,v_paths,v_note,v_qr,v_exception,
        v_health,p_request->'p_checklist_results',p_request->'p_inventory_usage');
    end if;
  elsif v_task.workflow_type in ('sale_price_inspection','sale_release_confirmation') then
    v_id := public.caretaker_submit_rooster_sale_task(v_task_id,(p_request->>'p_declared_amount')::numeric,
      v_paths,v_note,v_qr,v_exception);
  else
    v_id := public.caretaker_submit_task_proof_v3(v_task_id,v_paths,p_request->>'p_preset_note',
      v_note,v_qr,v_exception,(p_request->>'p_feed_quantity_used')::numeric,p_request->>'p_feed_unit');
  end if;
  update public.task_proofs set submission_key=v_key,submission_payload=p_request,
    daily_report=v_report,actual_remaining_feed=v_remaining where id=v_id;
  return v_id;
end;
$$;

-- Prevent browser callers bypassing the unified checks. SECURITY DEFINER callers retain access.
revoke all on function public.caretaker_submit_task_proof(uuid,text,text,text,boolean,boolean,numeric,text) from public,anon,authenticated;
revoke all on function public.caretaker_submit_task_proof_v3(uuid,text[],text,text,boolean,boolean,numeric,text) from public,anon,authenticated;
revoke all on function public.caretaker_submit_task_proof_v4(uuid,text[],text,text,boolean,boolean,numeric,text,jsonb,text) from public,anon,authenticated;
revoke all on function public.caretaker_submit_mission_proof(uuid,text[],text,boolean,boolean,text,jsonb,jsonb) from public,anon,authenticated;
revoke all on function public.caretaker_submit_manual_mission_proof(uuid,text[],text,boolean,boolean,text,jsonb,jsonb) from public,anon,authenticated;
revoke all on function public.caretaker_submit_rooster_sale_task(uuid,numeric,text[],text,boolean,boolean) from public,anon,authenticated;
revoke all on function public.caretaker_submit_report_guarded(jsonb) from public,anon;
grant execute on function public.caretaker_submit_report_guarded(jsonb) to authenticated;
commit;
select jsonb_build_object('migration','089_care_report_integrity',
  'unified_submission_rpc',to_regprocedure('public.caretaker_submit_report_guarded(jsonb)') is not null,
  'anonymous_can_execute',has_function_privilege('anon','public.caretaker_submit_report_guarded(jsonb)','execute'),
  'legacy_direct_submit_allowed',has_function_privilege('authenticated','public.caretaker_submit_task_proof_v3(uuid,text[],text,text,boolean,boolean,numeric,text)','execute'),
  'business_records_changed',false) as verification;
