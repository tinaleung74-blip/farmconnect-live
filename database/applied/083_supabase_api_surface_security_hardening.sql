-- FarmConnect migration 083
-- Least-privilege hardening for the exposed Supabase API surface.
-- This migration changes privileges and execution context only. It does not
-- mutate customer, payment, wallet, ownership, KYC, or caretaker business rows.

begin;

-- PostgreSQL grants EXECUTE on new functions to PUBLIC by default. Remove that
-- implicit access from every SECURITY DEFINER function. Server jobs retain an
-- explicit service_role grant. Browser-facing authenticated grants are kept and
-- are further narrowed for the internal-only functions below.
do $migration$
declare
  v_function record;
begin
  for v_function in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
  loop
    execute format('revoke execute on function %s from public, anon', v_function.signature);
    execute format('grant execute on function %s to service_role', v_function.signature);
  end loop;
end
$migration$;

-- Trigger, synchronization, evidence, and system-link helpers are invoked by
-- trusted database workflows. They must not be callable directly through
-- /rest/v1/rpc by a signed-in browser user.
do $migration$
declare
  v_function record;
  v_internal_names constant text[] := array[
    'audit_row_changes',
    'create_receipt_and_inbox',
    'finalize_rooster_sale_from_proof',
    'log_customer_evidence',
    'log_support_chat_evidence',
    'record_inventory_usage',
    'set_cashin_normalized_fields',
    'sync_care_plan_day1_readiness',
    'sync_withdrawal_dispute_after_customer_confirmation',
    'sync_withdrawal_wallet_ledger_status',
    'system_link_assigned_qr_task',
    'system_read_approved_rooster_purchase',
    'system_read_assigned_qr_task'
  ];
begin
  for v_function in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any(v_internal_names)
  loop
    execute format(
      'revoke execute on function %s from public, anon, authenticated',
      v_function.signature
    );
    execute format('grant execute on function %s to service_role', v_function.signature);
  end loop;
end
$migration$;

-- Apply caller-context RLS to every view reported by the Supabase linter.
-- All listed objects carry private/Admin operational data. Anonymous access is
-- removed; authenticated access still depends on the underlying table RLS.
do $migration$
declare
  v_view_name text;
  v_views constant text[] := array[
    'admin_customer_profile_photos',
    'admin_support_escalated_chats',
    'admin_kafarm_incident_queue',
    'admin_live_chat_queue',
    'support_thread_messages',
    'admin_kafarm_device_usage_summary',
    'admin_kyc_review_queue',
    'admin_kyc_consent_queue',
    'admin_caretaker_proof_review_queue',
    'admin_caretaker_list_resume_view',
    'admin_caretaker_payroll_dashboard',
    'admin_caretaker_logs_dashboard',
    'admin_operation_shortcuts_view',
    'admin_evidence_main_log_view'
  ];
begin
  foreach v_view_name in array v_views
  loop
    if exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = v_view_name
        and c.relkind = 'v'
    ) then
      execute format('alter view public.%I set (security_invoker = true)', v_view_name);
      execute format('revoke all on table public.%I from public, anon', v_view_name);
      execute format('grant select on table public.%I to authenticated', v_view_name);
    end if;
  end loop;
end
$migration$;

-- Lock every mutable search_path function reported by the linter. The extension
-- schema remains explicit for cryptographic helpers; application objects remain
-- schema-qualified or resolve from public.
do $migration$
declare
  v_function record;
  v_names constant text[] := array[
    'touch_updated_at',
    'normalize_payment_reference',
    'kafarm_support_needs_escalation',
    'detect_support_issue_type',
    'support_priority_for_issue',
    'normalize_kyc_id_number',
    'kyc_id_rule_label',
    'kyc_id_number_is_valid',
    'kafarm_support_risk_level',
    'kafarm_support_related_record',
    'payment_correction_video_evidence_version',
    'customer_signup_profile_guard_version',
    'rooster_sale_assignment_qr_fix_version',
    'withdrawal_dispute_inbox_schema_fix_version',
    'withdrawal_dispute_investigation_version',
    'withdrawal_dispute_reopen_cycle_version',
    'withdrawal_legacy_problem_reconciliation_version',
    'withdrawal_recovery_integrity_version',
    'withdrawal_wallet_pin_guard_version'
  ];
begin
  for v_function in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any(v_names)
  loop
    execute format(
      'alter function %s set search_path = pg_catalog, public, extensions',
      v_function.signature
    );
  end loop;
end
$migration$;

-- Audit logs are authoritative server evidence. Browser clients must not be
-- able to manufacture rows merely to satisfy an always-true INSERT policy.
do $migration$
begin
  if to_regclass('public.kafarm_sql_gateway_audit_logs') is not null then
    execute 'drop policy if exists "kafarm sql audit service insert" on public.kafarm_sql_gateway_audit_logs';
    execute 'revoke insert on table public.kafarm_sql_gateway_audit_logs from public, anon, authenticated';
    execute 'grant insert, select on table public.kafarm_sql_gateway_audit_logs to service_role';
  end if;
end
$migration$;

-- These three tables intentionally have RLS with no browser policies. Preserve
-- the deny-all client boundary and make the intended owner explicit.
do $migration$
declare
  v_table_name text;
begin
  foreach v_table_name in array array[
    'farmconnect_rate_limit_events',
    'kafarm_guardian_monitor_runs',
    'kafarm_monitor_baselines'
  ]
  loop
    if to_regclass(format('public.%I', v_table_name)) is not null then
      execute format('alter table public.%I enable row level security', v_table_name);
      execute format('revoke all on table public.%I from public, anon, authenticated', v_table_name);
    end if;
  end loop;
end
$migration$;

create or replace function public.farmconnect_security_hardening_version()
returns jsonb
language sql
stable
set search_path = pg_catalog, public
as $function$
  select jsonb_build_object(
    'migration', '083_supabase_api_surface_security_hardening',
    'anonymous_security_definer_execute_count', (
      select count(*)
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.prosecdef
        and has_function_privilege('anon', p.oid, 'EXECUTE')
    ),
    'authenticated_internal_execute_count', (
      select count(*)
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = any(array[
          'audit_row_changes',
          'create_receipt_and_inbox',
          'finalize_rooster_sale_from_proof',
          'log_customer_evidence',
          'log_support_chat_evidence',
          'record_inventory_usage',
          'set_cashin_normalized_fields',
          'sync_care_plan_day1_readiness',
          'sync_withdrawal_dispute_after_customer_confirmation',
          'sync_withdrawal_wallet_ledger_status',
          'system_link_assigned_qr_task',
          'system_read_approved_rooster_purchase',
          'system_read_assigned_qr_task'
        ])
        and has_function_privilege('authenticated', p.oid, 'EXECUTE')
    ),
    'security_definer_view_count', (
      select count(*)
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relkind = 'v'
        and not coalesce(c.reloptions, '{}'::text[]) @> array['security_invoker=true']
        and c.relname = any(array[
          'admin_customer_profile_photos',
          'admin_support_escalated_chats',
          'admin_kafarm_incident_queue',
          'admin_live_chat_queue',
          'support_thread_messages',
          'admin_kafarm_device_usage_summary',
          'admin_kyc_review_queue',
          'admin_kyc_consent_queue',
          'admin_caretaker_proof_review_queue',
          'admin_caretaker_list_resume_view',
          'admin_caretaker_payroll_dashboard',
          'admin_caretaker_logs_dashboard',
          'admin_operation_shortcuts_view',
          'admin_evidence_main_log_view'
        ])
    ),
    'business_records_changed', false
  );
$function$;

revoke all on function public.farmconnect_security_hardening_version() from public, anon, authenticated;
grant execute on function public.farmconnect_security_hardening_version() to service_role;

commit;

-- Verification (run with the SQL editor after applying the migration):
select public.farmconnect_security_hardening_version() as verification;

