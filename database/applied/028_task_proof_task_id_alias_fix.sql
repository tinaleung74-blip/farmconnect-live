-- FarmConnect task proof task_id alias fix
-- Run after 011_care_task_safe_backend.sql.
-- Purpose: current task_proofs table requires both legacy task_id and caretaker_task_id.

create or replace function public.caretaker_submit_task_proof(
  p_task_id uuid,
  p_proof_url text,
  p_preset_note text default null,
  p_free_note text default null,
  p_qr_verified boolean default true,
  p_serial_exception boolean default false,
  p_feed_quantity_used numeric default null,
  p_feed_unit text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_caretaker_id uuid;
  v_task public.caretaker_tasks%rowtype;
  v_proof_id uuid;
begin
  select id into v_profile_id
  from public.profiles
  where auth_user_id = auth.uid()
  limit 1;

  if v_profile_id is null then raise exception 'LOGIN_REQUIRED'; end if;

  select id into v_caretaker_id
  from public.caretakers
  where profile_id = v_profile_id
     or caretaker_profile_id = v_profile_id
  order by created_at asc
  limit 1;

  if v_caretaker_id is null then raise exception 'CARETAKER_PROFILE_REQUIRED'; end if;

  select * into v_task
  from public.caretaker_tasks
  where id = p_task_id
    and caretaker_id = v_caretaker_id
    and status in ('active','in_progress','backjob')
  for update;

  if not found then raise exception 'TASK_NOT_ASSIGNED_TO_CARETAKER'; end if;

  insert into public.task_proofs(
    task_id,
    caretaker_task_id,
    care_request_id,
    profile_id,
    caretaker_id,
    proof_type,
    proof_url,
    thumbnail_url,
    preset_note,
    free_note,
    qr_verified,
    serial_exception,
    feed_quantity_used,
    feed_unit,
    proof_check_status,
    admin_review_status,
    captured_at
  ) values (
    v_task.id,
    v_task.id,
    v_task.care_request_id,
    v_task.profile_id,
    v_task.caretaker_id,
    case when coalesce(v_task.required_proof, '') ilike '%video%' then 'video' else 'photo' end,
    p_proof_url,
    p_proof_url,
    p_preset_note,
    p_free_note,
    coalesce(p_qr_verified,true),
    coalesce(p_serial_exception,false),
    p_feed_quantity_used,
    p_feed_unit,
    case when coalesce(p_qr_verified,true) and p_proof_url is not null then 'passed' else 'needs_review' end,
    'pending',
    now()
  ) returning id into v_proof_id;

  update public.caretaker_tasks
  set status = 'submitted',
      submitted_at = now(),
      updated_at = now()
  where id = v_task.id;

  update public.farm_care_requests
  set status = 'proof_submitted',
      updated_at = now()
  where id = v_task.care_request_id;

  return v_proof_id;
end;
$$;

grant execute on function public.caretaker_submit_task_proof(uuid,text,text,text,boolean,boolean,numeric,text) to authenticated;

select
  'task_proof_task_id_alias_fix_ready' as check_name,
  count(*) as count
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'caretaker_submit_task_proof';
