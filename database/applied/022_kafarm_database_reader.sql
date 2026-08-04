-- FarmConnect KaFarm admin-only database reader
-- Purpose: read-only database health/snapshot for KaFarm Investigation.
-- Safe scope: metadata, counts/estimates, functions, RLS/policies, and missing-object findings.
-- No wallet movement, KYC approval, withdrawal release, password/PIN exposure, or sensitive raw records.

create or replace function public.kafarm_database_health_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expected jsonb;
  v_missing jsonb;
  v_tables jsonb;
  v_functions jsonb;
  v_policies jsonb;
  v_rls jsonb;
  v_findings jsonb;
begin
  if not public.is_admin() then
    raise exception 'ADMIN_REQUIRED';
  end if;

  with expected(kind, object_name) as (
    values
      ('table','profiles'),
      ('table','caretakers'),
      ('table','caretaker_applications'),
      ('table','caretaker_application_logs'),
      ('table','customer_kyc_profiles'),
      ('table','wallet_transactions'),
      ('table','manual_payment_requests'),
      ('table','payment_evidence_logs'),
      ('table','withdrawal_requests'),
      ('table','withdrawal_evidence_logs'),
      ('table','inbox_items'),
      ('table','marketplace_products'),
      ('table','farm_products'),
      ('table','farm_cart_items'),
      ('table','customer_inventory_items'),
      ('table','animals'),
      ('table','customer_animals'),
      ('table','animal_photos'),
      ('table','animal_weights'),
      ('table','farm_care_requests'),
      ('table','caretaker_tasks'),
      ('table','task_proofs'),
      ('table','support_chat_sessions'),
      ('table','support_chat_messages'),
      ('table','kafarm_incidents'),
      ('function','current_profile_id'),
      ('function','is_admin'),
      ('function','submit_caretaker_application'),
      ('function','admin_review_caretaker_application'),
      ('function','customer_submit_kyc'),
      ('function','run_kyc_system_checks'),
      ('function','admin_review_customer_kyc'),
      ('function','customer_record_kyc_consent'),
      ('function','change_wallet_pin'),
      ('function','admin_reset_customer_wallet_pin'),
      ('function','customer_submit_manual_payment'),
      ('function','admin_review_manual_payment'),
      ('function','customer_submit_withdrawal_request'),
      ('function','admin_review_withdrawal_request'),
      ('function','customer_buy_cart'),
      ('function','customer_create_care_request'),
      ('function','admin_assign_care_request'),
      ('function','caretaker_submit_task_proof'),
      ('function','admin_review_task_proof'),
      ('function','customer_support_send_message'),
      ('function','caretaker_support_send_message'),
      ('function','kafarm_support_send_message'),
      ('function','admin_support_join_chat'),
      ('function','admin_support_send_message'),
      ('function','admin_support_complete_chat'),
      ('function','kafarm_record_incident'),
      ('function','admin_kafarm_update_incident_status'),
      ('function','kafarm_database_health_snapshot'),
      ('view','admin_support_escalated_chats'),
      ('view','admin_kafarm_incident_queue')
  ),
  status as (
    select
      kind,
      object_name,
      case
        when kind = 'table' then to_regclass('public.' || object_name) is not null
        when kind = 'view' then exists (
          select 1 from information_schema.views
          where table_schema = 'public' and table_name = object_name
        )
        when kind = 'function' then exists (
          select 1 from information_schema.routines
          where routine_schema = 'public' and routine_name = object_name
        )
        else false
      end as exists
    from expected
  )
  select
    coalesce(jsonb_agg(jsonb_build_object('kind', kind, 'object_name', object_name, 'exists', exists) order by kind, object_name), '[]'::jsonb),
    coalesce(jsonb_agg(jsonb_build_object('kind', kind, 'object_name', object_name) order by kind, object_name) filter (where not exists), '[]'::jsonb)
  into v_expected, v_missing
  from status;

  with public_tables as (
    select
      c.relname,
      c.relrowsecurity,
      greatest(c.reltuples::bigint, 0) as estimated_rows
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r','p')
  ),
  column_counts as (
    select table_name, count(*) as column_count
    from information_schema.columns
    where table_schema = 'public'
    group by table_name
  ),
  policy_counts as (
    select tablename as table_name, count(*) as policy_count
    from pg_policies
    where schemaname = 'public'
    group by tablename
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'table_name', t.relname,
      'rls_enabled', t.relrowsecurity,
      'estimated_rows', t.estimated_rows,
      'columns', coalesce(cc.column_count, 0),
      'policies', coalesce(pc.policy_count, 0)
    )
    order by t.relname
  ), '[]'::jsonb)
  into v_tables
  from public_tables t
  left join column_counts cc on cc.table_name = t.relname
  left join policy_counts pc on pc.table_name = t.relname;

  with public_functions as (
    select
      r.specific_schema,
      r.specific_name,
      r.routine_name,
      r.data_type
    from information_schema.routines r
    where r.routine_schema = 'public'
  ),
  argument_rows as (
    select
      p.specific_schema,
      p.specific_name,
      string_agg(coalesce(p.parameter_name, '') || ' ' || p.data_type, ', ' order by p.ordinal_position) as arguments
    from information_schema.parameters p
    where p.specific_schema = 'public'
      and p.parameter_mode in ('IN','INOUT')
    group by p.specific_schema, p.specific_name
  ),
  security_rows as (
    select p.proname as routine_name, bool_or(p.prosecdef) as security_definer
    from pg_proc p
    join pg_namespace pn on pn.oid = p.pronamespace
    where pn.nspname = 'public'
    group by p.proname
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'function_name', pf.routine_name,
      'arguments', coalesce(ar.arguments, ''),
      'returns', pf.data_type,
      'security_definer', coalesce(sr.security_definer, false)
    )
    order by pf.routine_name
  ), '[]'::jsonb)
  into v_functions
  from public_functions pf
  left join argument_rows ar
    on ar.specific_schema = pf.specific_schema
   and ar.specific_name = pf.specific_name
  left join security_rows sr
    on sr.routine_name = pf.routine_name;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'table_name', tablename,
      'policy_name', policyname,
      'cmd', cmd,
      'roles', roles,
      'qual', qual,
      'with_check', with_check
    )
    order by tablename, policyname
  ), '[]'::jsonb)
  into v_policies
  from pg_policies
  where schemaname = 'public';

  with public_tables as (
    select c.relname, c.relrowsecurity
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r','p')
  ),
  policy_counts as (
    select tablename as table_name, count(*) as policy_count
    from pg_policies
    where schemaname = 'public'
    group by tablename
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'table_name', t.relname,
      'rls_enabled', t.relrowsecurity,
      'policy_count', coalesce(pc.policy_count, 0)
    )
    order by t.relname
  ), '[]'::jsonb)
  into v_rls
  from public_tables t
  left join policy_counts pc on pc.table_name = t.relname
  where not t.relrowsecurity
    or coalesce(pc.policy_count, 0) = 0;

  v_findings := '[]'::jsonb;

  if jsonb_array_length(v_missing) > 0 then
    v_findings := v_findings || jsonb_build_array(jsonb_build_object(
      'severity', 'High',
      'title', 'Missing required database object',
      'meaning', 'May table/function/view na expected ng app pero wala sa database. Pwedeng maputol ang frontend-backend flow.',
      'evidence', v_missing,
      'next_action', 'Run the matching database/applied SQL migration or update code to match the live schema.'
    ));
  end if;

  if jsonb_array_length(v_rls) > 0 then
    v_findings := v_findings || jsonb_build_array(jsonb_build_object(
      'severity', 'Medium',
      'title', 'RLS/policy needs review',
      'meaning', 'May public table na walang RLS or walang policy. Pwedeng blocked ang app flow or unsafe ang access.',
      'evidence', v_rls,
      'next_action', 'Review RLS and policies. Do not open broad public access for sensitive tables.'
    ));
  end if;

  return jsonb_build_object(
    'generated_at', now(),
    'mode', 'admin_read_only_database_reader',
    'expected_objects', v_expected,
    'missing_objects', v_missing,
    'tables', v_tables,
    'functions', v_functions,
    'policies', v_policies,
    'rls_review', v_rls,
    'findings', v_findings,
    'safety', jsonb_build_object(
      'raw_sensitive_rows_returned', false,
      'admin_required', true,
      'read_only', true
    )
  );
end;
$$;

grant execute on function public.kafarm_database_health_snapshot() to authenticated;

-- Verification:
-- select public.kafarm_database_health_snapshot();



