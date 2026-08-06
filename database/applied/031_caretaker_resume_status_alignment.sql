-- FarmConnect caretaker resume status alignment.
-- Run after 030_caretaker_admin_guard_alignment.sql.
-- Evidence:
--   The live constraint allows pending, reviewed, needs_update, and rejected.
--   The approval RPC incorrectly wrote approved to resume_review_status.
-- Purpose:
--   Keep the application decision approved while mapping the accepted resume
--   to the existing reviewed caretaker status.
-- Idempotent: safe to run again after verification.

begin;

do $preflight$
declare
  v_constraint_definition text;
begin
  select pg_get_constraintdef(c.oid)
  into v_constraint_definition
  from pg_constraint c
  where c.conrelid = 'public.caretakers'::regclass
    and c.conname = 'caretakers_resume_review_status_check'
  limit 1;

  if v_constraint_definition is null then
    raise exception 'CARETAKER_RESUME_STATUS_CONSTRAINT_NOT_FOUND';
  end if;

  if position('reviewed' in lower(v_constraint_definition)) = 0 then
    raise exception 'CARETAKER_RESUME_STATUS_REVIEWED_NOT_ALLOWED';
  end if;
end;
$preflight$;

create or replace function public.admin_review_caretaker_application(
  p_application_id uuid,
  p_decision text,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_profile_id uuid;
  v_app public.caretaker_applications%rowtype;
  v_profile_id uuid;
  v_caretaker_id uuid;
begin
  if not public.is_admin() then
    raise exception 'ADMIN_REQUIRED';
  end if;

  select id into v_admin_profile_id
  from public.profiles
  where auth_user_id = auth.uid()
    and lower(coalesce(role, '')) = 'admin'
    and lower(coalesce(account_status, '')) = 'active'
  limit 1;

  if v_admin_profile_id is null then
    raise exception 'ADMIN_PROFILE_RESOLUTION_FAILED';
  end if;

  if p_decision not in ('approved', 'rejected', 'needs_info') then
    raise exception 'INVALID_CARETAKER_REVIEW_DECISION';
  end if;

  select * into v_app
  from public.caretaker_applications
  where id = p_application_id
  for update;

  if v_app.id is null then
    raise exception 'CARETAKER_APPLICATION_NOT_FOUND';
  end if;

  if p_decision = 'approved' then
    select id into v_profile_id
    from public.profiles
    where auth_user_id = v_app.auth_user_id
    limit 1;

    if v_profile_id is null then
      insert into public.profiles (
        auth_user_id,
        email,
        phone,
        full_name,
        display_name,
        avatar_url,
        role,
        account_status,
        verification_status,
        membership_status,
        birthdate,
        updated_at
      )
      values (
        v_app.auth_user_id,
        v_app.email,
        v_app.phone,
        v_app.full_name,
        coalesce(v_app.display_name, v_app.full_name),
        v_app.avatar_url,
        'caretaker',
        'active',
        'pending',
        'inactive',
        v_app.birthdate,
        now()
      )
      returning id into v_profile_id;
    else
      update public.profiles
      set email = v_app.email,
          phone = v_app.phone,
          full_name = v_app.full_name,
          display_name = coalesce(v_app.display_name, v_app.full_name),
          avatar_url = coalesce(v_app.avatar_url, avatar_url),
          role = 'caretaker',
          account_status = 'active',
          verification_status = coalesce(verification_status, 'pending'),
          birthdate = v_app.birthdate,
          updated_at = now()
      where id = v_profile_id;
    end if;

    insert into public.caretakers (
      profile_id,
      caretaker_profile_id,
      email,
      full_name,
      display_name,
      phone,
      avatar_url,
      resume_url,
      farm_role,
      status,
      payment_mode,
      payment_account_name,
      payment_account_number,
      payout_method,
      payout_details,
      work_pin_set,
      resume_review_status,
      resume_reviewed_by,
      resume_reviewed_at,
      created_at,
      updated_at
    )
    values (
      v_profile_id,
      v_profile_id,
      v_app.email,
      v_app.full_name,
      coalesce(v_app.display_name, v_app.full_name),
      v_app.phone,
      v_app.avatar_url,
      v_app.resume_url,
      v_app.farm_role,
      'active',
      v_app.payment_method,
      v_app.payment_account_name,
      v_app.payment_account_number,
      v_app.payment_method,
      jsonb_build_object(
        'method', v_app.payment_method,
        'account_name', v_app.payment_account_name,
        'account_number', v_app.payment_account_number,
        'emergency_contact_name', v_app.emergency_contact_name,
        'emergency_contact_phone', v_app.emergency_contact_phone
      ),
      v_app.work_pin_set,
      'reviewed',
      v_admin_profile_id,
      now(),
      now(),
      now()
    )
    on conflict (profile_id) where profile_id is not null do update
      set caretaker_profile_id = excluded.caretaker_profile_id,
          email = excluded.email,
          full_name = excluded.full_name,
          display_name = excluded.display_name,
          phone = excluded.phone,
          avatar_url = excluded.avatar_url,
          resume_url = excluded.resume_url,
          farm_role = excluded.farm_role,
          status = 'active',
          payment_mode = excluded.payment_mode,
          payment_account_name = excluded.payment_account_name,
          payment_account_number = excluded.payment_account_number,
          payout_method = excluded.payout_method,
          payout_details = excluded.payout_details,
          work_pin_set = excluded.work_pin_set,
          resume_review_status = 'reviewed',
          resume_reviewed_by = v_admin_profile_id,
          resume_reviewed_at = now(),
          updated_at = now()
    returning id into v_caretaker_id;
  end if;

  update public.caretaker_applications
  set status = p_decision,
      admin_note = p_note,
      reviewed_by_profile_id = v_admin_profile_id,
      reviewed_at = now(),
      created_profile_id = coalesce(v_profile_id, created_profile_id),
      created_caretaker_id = coalesce(v_caretaker_id, created_caretaker_id),
      updated_at = now()
  where id = p_application_id;

  insert into public.caretaker_application_logs (
    application_id,
    profile_id,
    action,
    note,
    metadata,
    created_by_profile_id
  )
  values (
    p_application_id,
    v_profile_id,
    'admin_' || p_decision,
    p_note,
    jsonb_build_object('decision', p_decision, 'caretaker_id', v_caretaker_id),
    v_admin_profile_id
  );

  return p_application_id;
end;
$$;

revoke all on function public.admin_review_caretaker_application(uuid, text, text) from public;
revoke all on function public.admin_review_caretaker_application(uuid, text, text) from anon;
grant execute on function public.admin_review_caretaker_application(uuid, text, text) to authenticated;

commit;

select jsonb_build_object(
  'migration', '031_caretaker_resume_status_alignment',
  'constraint_supports_reviewed',
    exists (
      select 1
      from pg_constraint c
      where c.conrelid = 'public.caretakers'::regclass
        and c.conname = 'caretakers_resume_review_status_check'
        and position('reviewed' in lower(pg_get_constraintdef(c.oid))) > 0
    ),
  'caretaker_review_ready',
    to_regprocedure('public.admin_review_caretaker_application(uuid,text,text)') is not null,
  'resume_status_mapping', 'approved_application_to_reviewed_resume'
) as migration_result;
