-- FarmConnect migration 084
-- Restore the narrowly-scoped RLS identity helper required by authenticated
-- customer/caretaker reads after migration 083 removed PUBLIC execution.
-- This changes function EXECUTE privilege only; it does not mutate business data.

begin;

do $migration$
declare
  v_signature regprocedure;
begin
  v_signature := to_regprocedure('public.current_caretaker_id()');
  if v_signature is null then
    raise exception 'Required RLS helper public.current_caretaker_id() does not exist';
  end if;

  execute format('revoke execute on function %s from public, anon', v_signature);
  execute format('grant execute on function %s to authenticated, service_role', v_signature);
end
$migration$;

create or replace function public.farmconnect_rls_identity_helper_version()
returns jsonb
language sql
stable
set search_path = pg_catalog, public
as $function$
  select jsonb_build_object(
    'migration', '084_restore_rls_identity_helper_execute',
    'current_caretaker_id_exists', to_regprocedure('public.current_caretaker_id()') is not null,
    'authenticated_can_execute', case
      when to_regprocedure('public.current_caretaker_id()') is null then false
      else has_function_privilege('authenticated', to_regprocedure('public.current_caretaker_id()'), 'EXECUTE')
    end,
    'anonymous_can_execute', case
      when to_regprocedure('public.current_caretaker_id()') is null then false
      else has_function_privilege('anon', to_regprocedure('public.current_caretaker_id()'), 'EXECUTE')
    end,
    'business_records_changed', false
  );
$function$;

revoke all on function public.farmconnect_rls_identity_helper_version() from public, anon, authenticated;
grant execute on function public.farmconnect_rls_identity_helper_version() to service_role;

commit;

select public.farmconnect_rls_identity_helper_version() as verification;
