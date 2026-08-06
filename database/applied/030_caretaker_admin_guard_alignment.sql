-- FarmConnect caretaker admin guard alignment.
-- Run after 023_caretaker_application_review_fix.sql.
-- Purpose:
--   Use one strict active-admin predicate for RLS and caretaker decisions.
--   Diagnose ADMIN_REQUIRED without email fallback or access broadening.
--   Block ambiguous sessions that have duplicate profiles.
-- Idempotent: safe to run again after verification.

begin;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select
    count(*) = 1
    and coalesce(bool_and(
      lower(coalesce(p.role, '')) = 'admin'
      and lower(coalesce(p.account_status, '')) = 'active'
    ), false)
  from public.profiles p
  where p.auth_user_id = auth.uid()
$function$;

revoke all on function public.is_admin() from public;
revoke all on function public.is_admin() from anon;
grant execute on function public.is_admin() to authenticated;

create or replace function public.admin_session_guard_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_profile public.profiles%rowtype;
  v_profile_count integer := 0;
begin
  if auth.uid() is null then
    return jsonb_build_object(
      'ok', false,
      'reason', 'NO_AUTH_SESSION'
    );
  end if;

  select count(*) into v_profile_count
  from public.profiles
  where auth_user_id = auth.uid();

  if v_profile_count = 0 then
    return jsonb_build_object(
      'ok', false,
      'reason', 'NO_PROFILE_FOR_AUTH_SESSION'
    );
  end if;

  if v_profile_count > 1 then
    return jsonb_build_object(
      'ok', false,
      'reason', 'DUPLICATE_PROFILES_FOR_AUTH_SESSION',
      'profile_count', v_profile_count
    );
  end if;

  select * into v_profile
  from public.profiles
  where auth_user_id = auth.uid()
  limit 1;

  return jsonb_build_object(
    'ok',
      lower(coalesce(v_profile.role, '')) = 'admin'
      and lower(coalesce(v_profile.account_status, '')) = 'active',
    'reason',
      case
        when lower(coalesce(v_profile.role, '')) <> 'admin' then 'PROFILE_ROLE_IS_NOT_ADMIN'
        when lower(coalesce(v_profile.account_status, '')) <> 'active' then 'ADMIN_PROFILE_NOT_ACTIVE'
        else 'ACTIVE_ADMIN_SESSION'
      end,
    'profile_role', v_profile.role,
    'profile_account_status', v_profile.account_status
  );
end;
$function$;

revoke all on function public.admin_session_guard_status() from public;
revoke all on function public.admin_session_guard_status() from anon;
grant execute on function public.admin_session_guard_status() to authenticated;

create unique index if not exists caretakers_profile_id_unique
on public.caretakers(profile_id)
where profile_id is not null;

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
      'approved',
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
          resume_review_status = 'approved',
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
  'migration', '030_caretaker_admin_guard_alignment',
  'is_admin_ready', to_regprocedure('public.is_admin()') is not null,
  'session_diagnostic_ready', to_regprocedure('public.admin_session_guard_status()') is not null,
  'caretaker_review_ready',
    to_regprocedure('public.admin_review_caretaker_application(uuid,text,text)') is not null
) as migration_result;
