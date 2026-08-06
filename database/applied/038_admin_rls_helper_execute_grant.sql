-- FarmConnect: restore authenticated access to RLS helper functions.
-- Safe/idempotent. This does not make a user an admin; is_admin() still checks
-- profiles.auth_user_id, role = admin, and account_status = active.

begin;

do $$
begin
  if to_regprocedure('public.is_admin()') is null then
    raise exception 'MISSING_FUNCTION: public.is_admin()';
  end if;
  if to_regprocedure('public.current_profile_id()') is null then
    raise exception 'MISSING_FUNCTION: public.current_profile_id()';
  end if;
end
$$;

grant usage on schema public to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.current_profile_id() to authenticated;

commit;

select 'admin_rls_helper_execute_ready' as check_name,
       (has_function_privilege('authenticated', 'public.is_admin()', 'EXECUTE')
        and has_function_privilege('authenticated', 'public.current_profile_id()', 'EXECUTE'))::int as count;
