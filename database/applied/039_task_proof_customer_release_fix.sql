-- FarmConnect task proof -> customer release hardening
-- The assigned caretaker task is the authoritative customer link.

begin;

create or replace function public.admin_review_task_proof(
  p_proof_id uuid,
  p_decision text,
  p_admin_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid;
  v_proof public.task_proofs%rowtype;
  v_task public.caretaker_tasks%rowtype;
  v_customer_profile_id uuid;
  v_care_profile_id uuid;
  v_is_qr_tagging boolean;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if p_decision not in ('approved','rejected','backjob') then raise exception 'INVALID_DECISION'; end if;
  if p_decision in ('rejected','backjob') and nullif(trim(coalesce(p_admin_note,'')), '') is null then
    raise exception 'ADMIN_NOTE_REQUIRED';
  end if;

  select id into v_admin_id
  from public.profiles
  where auth_user_id = auth.uid()
  limit 1;

  select * into v_proof
  from public.task_proofs
  where id = p_proof_id
  for update;
  if not found then raise exception 'PROOF_NOT_FOUND'; end if;
  if v_proof.admin_review_status <> 'pending' then raise exception 'PROOF_ALREADY_REVIEWED'; end if;

  select * into v_task
  from public.caretaker_tasks
  where id = coalesce(v_proof.caretaker_task_id, v_proof.task_id)
  for update;
  if not found then raise exception 'TASK_NOT_FOUND'; end if;

  if v_proof.care_request_id is not null then
    select profile_id into v_care_profile_id
    from public.farm_care_requests
    where id = v_proof.care_request_id;
  end if;

  v_customer_profile_id := coalesce(v_task.profile_id, v_care_profile_id, v_proof.profile_id);
  if v_customer_profile_id is null then raise exception 'CUSTOMER_PROFILE_NOT_FOUND'; end if;

  v_is_qr_tagging := v_task.workflow_type = 'qr_tagging' and v_task.qr_identity_id is not null;

  update public.task_proofs
  set admin_review_status = p_decision,
      admin_note = p_admin_note,
      reviewed_at = now(),
      reviewed_by_profile_id = v_admin_id,
      profile_id = v_customer_profile_id
  where id = p_proof_id;

  update public.caretaker_tasks
  set status = case when p_decision = 'approved' then 'approved'
                    when p_decision = 'backjob' then 'backjob'
                    else 'rejected' end,
      reviewed_at = now(),
      reviewed_by_profile_id = v_admin_id,
      updated_at = now()
  where id = v_task.id;

  update public.farm_care_requests
  set status = case when p_decision = 'approved' then 'released_to_customer'
                    when p_decision = 'backjob' then 'assigned'
                    else 'rejected' end,
      admin_note = p_admin_note,
      updated_at = now()
  where id = v_proof.care_request_id;

  if v_is_qr_tagging then
    update public.animal_qr_identities
    set status = case when p_decision = 'approved' then 'verified'
                      when p_decision = 'backjob' then 'assigned'
                      else 'reserved' end,
        verified_at = case when p_decision = 'approved' then now() else null end,
        verified_by_profile_id = case when p_decision = 'approved' then v_admin_id else null end,
        updated_at = now()
    where id = v_task.qr_identity_id;

    update public.customer_animals
    set status = case when p_decision = 'approved' then 'active' else 'pending_qr_tagging' end,
        qr_status = case when p_decision = 'approved' then 'verified'
                         when p_decision = 'backjob' then 'tagging_backjob'
                         else 'tagging_required' end,
        ownership_metadata = coalesce(ownership_metadata, '{}'::jsonb) || jsonb_build_object(
          'qr_status', case when p_decision = 'approved' then 'verified' else 'needs_correction' end,
          'qr_verified_at', case when p_decision = 'approved' then now() else null end,
          'qr_proof_id', p_proof_id
        ),
        updated_at = now()
    where qr_identity_id = v_task.qr_identity_id;

    insert into public.animal_qr_events(
      qr_identity_id, customer_animal_id, profile_id, event_type, details, actor_profile_id
    )
    select identity.id, identity.customer_animal_id, identity.profile_id,
           case when p_decision = 'approved' then 'tagging_verified'
                when p_decision = 'backjob' then 'tagging_backjob'
                else 'tagging_rejected' end,
           jsonb_build_object('proof_id', p_proof_id, 'admin_note', p_admin_note),
           v_admin_id
    from public.animal_qr_identities identity
    where identity.id = v_task.qr_identity_id;
  end if;

  insert into public.inbox_items(profile_id, category, title, body, created_at)
  values (
    v_customer_profile_id,
    'farm_update',
    case
      when v_is_qr_tagging and p_decision = 'approved' then 'Rooster QR Tag Verified'
      when v_is_qr_tagging and p_decision = 'backjob' then 'Rooster QR Tag Needs Correction'
      when v_is_qr_tagging then 'Rooster QR Tag Rejected'
      when p_decision = 'approved' then 'Care Update Approved'
      when p_decision = 'backjob' then 'Care Update Needs Correction'
      else 'Care Update Rejected'
    end,
    case
      when v_is_qr_tagging and p_decision = 'approved' then 'Admin verified the attached FarmConnect QR tag. Your rooster QR record is now active.'
      when v_is_qr_tagging then 'The QR tagging proof needs correction. Admin note: ' || coalesce(p_admin_note, 'Please submit clearer proof.')
      when p_decision = 'approved' then 'Admin approved the caretaker proof. Open Care Logs to view the documentation.'
      when p_decision = 'backjob' then 'Admin asked the caretaker to correct the proof. Note: ' || coalesce(p_admin_note, 'Needs correction.')
      else 'Admin rejected the caretaker proof. Note: ' || coalesce(p_admin_note, 'Proof was not accepted.')
    end,
    now()
  );

  return p_proof_id;
end;
$$;

revoke all on function public.admin_review_task_proof(uuid,text,text) from public, anon;
grant execute on function public.admin_review_task_proof(uuid,text,text) to authenticated;

create or replace function public.task_proof_customer_release_version()
returns integer
language sql
stable
set search_path = public
as $$ select 39 $$;

-- Repair the customer link on old proof rows from the authoritative assigned task.
update public.task_proofs proof
set profile_id = task.profile_id
from public.caretaker_tasks task
where task.id = coalesce(proof.caretaker_task_id, proof.task_id)
  and task.profile_id is not null
  and proof.profile_id is distinct from task.profile_id;

-- Release already-approved proofs that did not create a customer inbox event.
insert into public.inbox_items(profile_id, category, title, body, created_at)
select
  task.profile_id,
  'farm_update',
  case when task.workflow_type = 'qr_tagging' then 'Rooster QR Tag Verified' else 'Care Update Approved' end,
  case when task.workflow_type = 'qr_tagging'
       then 'Admin verified the attached FarmConnect QR tag. Your rooster QR record is now active.'
       else 'Admin approved the caretaker proof. Open Care Logs to view the documentation.' end,
  coalesce(proof.reviewed_at, now())
from public.task_proofs proof
join public.caretaker_tasks task
  on task.id = coalesce(proof.caretaker_task_id, proof.task_id)
where proof.admin_review_status = 'approved'
  and task.profile_id is not null
  and not exists (
    select 1
    from public.inbox_items inbox
    where inbox.profile_id = task.profile_id
      and inbox.title = case when task.workflow_type = 'qr_tagging' then 'Rooster QR Tag Verified' else 'Care Update Approved' end
      and inbox.created_at between coalesce(proof.reviewed_at, proof.created_at) - interval '2 minutes'
                               and coalesce(proof.reviewed_at, proof.created_at) + interval '2 minutes'
  );

commit;

select 'task_proof_customer_release_ready' as check_name, count(*) as count
from information_schema.routines
where routine_schema = 'public'
  and routine_name = 'task_proof_customer_release_version';
