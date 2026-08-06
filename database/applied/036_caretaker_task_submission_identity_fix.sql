-- FarmConnect caretaker task submission identity hardening.
-- The assigned task is the source of truth, even when one auth profile has
-- more than one legacy caretaker row.

begin;

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
  v_task public.caretaker_tasks%rowtype;
  v_proof_id uuid;
  v_is_qr_tagging boolean;
begin
  select id into v_profile_id
  from public.profiles
  where auth_user_id = auth.uid()
  limit 1;

  if v_profile_id is null then raise exception 'LOGIN_REQUIRED'; end if;

  select task.* into v_task
  from public.caretaker_tasks task
  join public.caretakers caretaker on caretaker.id = task.caretaker_id
  where task.id = p_task_id
    and (
      caretaker.profile_id = v_profile_id
      or caretaker.caretaker_profile_id = v_profile_id
    )
    and task.status in ('active','in_progress','backjob')
  for update of task;

  if not found then raise exception 'TASK_NOT_ASSIGNED_TO_CURRENT_CARETAKER'; end if;

  v_is_qr_tagging := v_task.workflow_type = 'qr_tagging' and not v_task.qr_scan_required;
  if nullif(trim(coalesce(p_free_note, '')), '') is null then raise exception 'WORK_DOCUMENTATION_REQUIRED'; end if;
  if nullif(trim(coalesce(p_proof_url, '')), '') is null then raise exception 'PROOF_FILE_REQUIRED'; end if;

  insert into public.task_proofs(
    task_id, caretaker_task_id, care_request_id, profile_id, caretaker_id, proof_type,
    proof_url, thumbnail_url, preset_note, free_note, qr_verified, serial_exception,
    feed_quantity_used, feed_unit, proof_check_status, admin_review_status, captured_at
  ) values (
    v_task.id, v_task.id, v_task.care_request_id, v_task.profile_id, v_task.caretaker_id,
    'photo', p_proof_url, p_proof_url, p_preset_note, p_free_note,
    case when v_is_qr_tagging then false else coalesce(p_qr_verified, true) end,
    case when v_is_qr_tagging then false else coalesce(p_serial_exception, false) end,
    p_feed_quantity_used, p_feed_unit,
    case when v_is_qr_tagging or coalesce(p_qr_verified, true) then 'passed' else 'needs_review' end,
    'pending', now()
  ) returning id into v_proof_id;

  update public.caretaker_tasks
  set status = 'submitted', submitted_at = now(), updated_at = now()
  where id = v_task.id;

  update public.farm_care_requests
  set status = 'proof_submitted', updated_at = now()
  where id = v_task.care_request_id;

  if v_is_qr_tagging then
    insert into public.animal_qr_events(
      qr_identity_id, customer_animal_id, profile_id, event_type, details
    )
    select identity.id, identity.customer_animal_id, identity.profile_id,
           'tagging_proof_submitted',
           jsonb_build_object('caretaker_task_id', v_task.id, 'proof_id', v_proof_id)
    from public.animal_qr_identities identity
    where identity.id = v_task.qr_identity_id;
  end if;

  return v_proof_id;
end;
$$;

revoke all on function public.caretaker_submit_task_proof(uuid,text,text,text,boolean,boolean,numeric,text) from public, anon;
grant execute on function public.caretaker_submit_task_proof(uuid,text,text,text,boolean,boolean,numeric,text) to authenticated;

commit;

select 'caretaker_task_submission_identity_fix_ready' as check_name, count(*) as count
from information_schema.routines
where routine_schema = 'public'
  and routine_name = 'caretaker_submit_task_proof';
