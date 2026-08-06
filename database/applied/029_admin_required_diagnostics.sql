-- FarmConnect ADMIN_REQUIRED diagnostics
-- Run after: 009_manual_payment_review_flow.sql, 023_caretaker_application_review_fix.sql
-- Purpose:
--   Keep admin authorization strict, but make ADMIN_REQUIRED easier to diagnose.
--   This does NOT broaden admin access. Admin still requires profiles.auth_user_id = auth.uid().

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.auth_user_id = auth.uid()
      and lower(coalesce(p.role, '')) = 'admin'
      and lower(coalesce(p.account_status, 'active')) = 'active'
  )
$$;

create or replace function public.admin_session_guard_status()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
begin
  select * into v_profile
  from public.profiles
  where auth_user_id = auth.uid()
  order by updated_at desc nulls last, created_at desc nulls last
  limit 1;

  if v_profile.id is null then
    return jsonb_build_object(
      'ok', false,
      'reason', 'NO_PROFILE_FOR_AUTH_SESSION',
      'auth_uid_present', auth.uid() is not null
    );
  end if;

  return jsonb_build_object(
    'ok',
    lower(coalesce(v_profile.role, '')) = 'admin'
      and lower(coalesce(v_profile.account_status, 'active')) = 'active',
    'profile_id', v_profile.id,
    'email', v_profile.email,
    'role', v_profile.role,
    'account_status', v_profile.account_status,
    'reason',
    case
      when lower(coalesce(v_profile.role, '')) <> 'admin' then 'PROFILE_ROLE_IS_NOT_ADMIN'
      when lower(coalesce(v_profile.account_status, 'active')) <> 'active' then 'ADMIN_PROFILE_NOT_ACTIVE'
      else 'ACTIVE_ADMIN_SESSION'
    end
  );
end;
$$;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.admin_session_guard_status() to authenticated;

select
  'admin_required_diagnostics_ready' as check_name,
  count(*) as count
from information_schema.routines
where routine_schema = 'public'
  and routine_name in ('is_admin', 'admin_session_guard_status');

