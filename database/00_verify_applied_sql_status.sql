-- FarmConnect Applied SQL Status Verifier
-- Safe/read-only. Use this in Supabase SQL Editor to see which migration objects exist.
-- This does not call protected app RPCs, so it works even when SQL Editor has no auth.uid().

with expected(migration, kind, object_name) as (
  values
    ('001_support_chat_phase_3a_reference.sql','table','support_chat_sessions'),
    ('001_support_chat_phase_3a_reference.sql','table','support_chat_messages'),
    ('001_support_chat_phase_3a_reference.sql','function','customer_support_send_message'),
    ('001_support_chat_phase_3a_reference.sql','function','caretaker_support_send_message'),
    ('001_support_chat_phase_3a_reference.sql','function','kafarm_support_send_message'),
    ('001_support_chat_phase_3a_reference.sql','function','admin_support_join_chat'),
    ('001_support_chat_phase_3a_reference.sql','function','admin_support_send_message'),
    ('001_support_chat_phase_3a_reference.sql','function','admin_support_complete_chat'),
    ('001_support_chat_phase_3a_reference.sql','view','admin_support_escalated_chats'),

    ('002_kyc_reference.sql','table','customer_kyc_profiles'),
    ('002_kyc_reference.sql','function','customer_submit_kyc'),
    ('002_kyc_reference.sql','function','run_kyc_system_checks'),
    ('002_kyc_reference.sql','function','admin_review_customer_kyc'),
    ('002_kyc_reference.sql','function','customer_record_kyc_consent'),

    ('004_wallet_pin_function.sql','function','change_wallet_pin'),
    ('004_wallet_pin_function.sql','function','set_wallet_pin'),
    ('004_wallet_pin_function.sql','function','verify_wallet_pin'),
    ('004_wallet_pin_function.sql','function','admin_reset_customer_wallet_pin'),

    ('005_gamefowl_bloodlines.sql','column','farm_products.bloodline'),
    ('005_gamefowl_bloodlines.sql','column','farm_products.breed'),
    ('005_gamefowl_bloodlines.sql','column','animals.bloodline'),
    ('005_gamefowl_bloodlines.sql','column','customer_animals.bloodline_snapshot'),
    ('005_gamefowl_bloodlines.sql','column','farm_cart_items.bloodline_snapshot'),

    ('006_customer_animals_ownership_table.sql','table','animals'),
    ('006_customer_animals_ownership_table.sql','table','customer_animals'),
    ('006_customer_animals_ownership_table.sql','table','animal_photos'),
    ('006_customer_animals_ownership_table.sql','table','animal_weights'),

    ('007_farm_buy_checkout_flow.sql','table','farm_products'),
    ('007_farm_buy_checkout_flow.sql','table','farm_cart_items'),
    ('007_farm_buy_checkout_flow.sql','table','customer_inventory_items'),
    ('007_farm_buy_checkout_flow.sql','function','customer_buy_cart'),

    ('008_backend_wiring_audit.sql','table','inbox_items'),
    ('008_backend_wiring_audit.sql','function','log_customer_evidence'),

    ('009_manual_payment_review_flow.sql','table','manual_payment_requests'),
    ('009_manual_payment_review_flow.sql','table','payment_evidence_logs'),
    ('009_manual_payment_review_flow.sql','function','customer_submit_manual_payment'),
    ('009_manual_payment_review_flow.sql','function','admin_review_manual_payment'),
    ('009_manual_payment_review_flow.sql','function','normalize_payment_reference'),

    ('010_auth_role_guardian_caretaker_applications.sql','table','caretaker_applications'),
    ('010_auth_role_guardian_caretaker_applications.sql','table','caretaker_application_logs'),
    ('010_auth_role_guardian_caretaker_applications.sql','function','submit_caretaker_application'),
    ('010_auth_role_guardian_caretaker_applications.sql','function','admin_review_caretaker_application'),

    ('011_care_task_safe_backend.sql','table','farm_care_requests'),
    ('011_care_task_safe_backend.sql','table','caretaker_tasks'),
    ('011_care_task_safe_backend.sql','table','task_proofs'),
    ('011_care_task_safe_backend.sql','function','customer_create_care_request'),
    ('011_care_task_safe_backend.sql','function','admin_assign_care_request'),
    ('011_care_task_safe_backend.sql','function','caretaker_submit_task_proof'),
    ('011_care_task_safe_backend.sql','function','admin_review_task_proof'),

    ('012_manual_payment_care_request_sync.sql','function','customer_create_paid_farm_request'),

    ('020_withdrawal_review_flow.sql','table','withdrawal_requests'),
    ('020_withdrawal_review_flow.sql','table','withdrawal_evidence_logs'),
    ('020_withdrawal_review_flow.sql','function','customer_submit_withdrawal_request'),
    ('020_withdrawal_review_flow.sql','function','admin_review_withdrawal_request'),

    ('021_kafarm_incident_monitoring.sql','table','kafarm_incidents'),
    ('021_kafarm_incident_monitoring.sql','function','kafarm_record_incident'),
    ('021_kafarm_incident_monitoring.sql','function','admin_kafarm_update_incident_status'),
    ('021_kafarm_incident_monitoring.sql','view','admin_kafarm_incident_queue'),

    ('022_kafarm_database_reader.sql','function','kafarm_database_health_snapshot'),

    ('023_caretaker_application_review_fix.sql','index','caretakers_profile_id_unique'),
    ('023_caretaker_application_review_fix.sql','function','admin_review_caretaker_application'),

    ('025_manual_payment_farm_buy_source_of_truth.sql','function','admin_review_manual_payment'),
    ('025_manual_payment_farm_buy_source_of_truth.sql','table','manual_payment_requests'),
    ('025_manual_payment_farm_buy_source_of_truth.sql','table','customer_animals'),
    ('025_manual_payment_farm_buy_source_of_truth.sql','table','customer_inventory_items'),

    ('041_inbox_read_state.sql','column','inbox_items.is_read'),
    ('041_inbox_read_state.sql','column','inbox_items.read_at'),
    ('041_inbox_read_state.sql','function','customer_mark_inbox_item_read'),

    ('042_kafarm_device_usage_audit.sql','table','kafarm_device_usage_logs'),
    ('042_kafarm_device_usage_audit.sql','function','kafarm_record_device_usage'),
    ('042_kafarm_device_usage_audit.sql','view','admin_kafarm_device_usage_summary'),

    ('026_care_task_assignment_customer_animal_fk_fix.sql','function','admin_assign_care_request'),
    ('026_care_task_assignment_customer_animal_fk_fix.sql','table','caretaker_tasks'),
    ('026_care_task_assignment_customer_animal_fk_fix.sql','table','farm_care_requests'),

    ('027_manual_payment_care_request_sync_harden.sql','function','sync_manual_payment_care_request'),
    ('027_manual_payment_care_request_sync_harden.sql','trigger','trg_sync_manual_payment_care_request'),
    ('027_manual_payment_care_request_sync_harden.sql','table','manual_payment_requests'),
    ('027_manual_payment_care_request_sync_harden.sql','table','farm_care_requests'),

    ('028_task_proof_task_id_alias_fix.sql','function','caretaker_submit_task_proof'),
    ('028_task_proof_task_id_alias_fix.sql','table','task_proofs'),
    ('028_task_proof_task_id_alias_fix.sql','column','task_proofs.task_id'),
    ('028_task_proof_task_id_alias_fix.sql','column','task_proofs.caretaker_task_id'),

    ('029_admin_required_diagnostics.sql','function','is_admin'),
    ('029_admin_required_diagnostics.sql','function','admin_session_guard_status'),

    ('033_caretaker_task_proof_storage.sql','bucket','caretaker-task-proofs'),
    ('033_caretaker_task_proof_storage.sql','column','task_proofs.proof_file_urls'),
    ('033_caretaker_task_proof_storage.sql','function','caretaker_submit_task_proof_v3'),

    ('034_withdrawal_payout_proof_storage.sql','bucket','withdrawal-proofs'),

    ('035_rooster_qr_identity_task_automation.sql','table','animal_qr_identities'),
    ('035_rooster_qr_identity_task_automation.sql','table','animal_qr_events'),
    ('035_rooster_qr_identity_task_automation.sql','column','customer_animals.qr_identity_id'),
    ('035_rooster_qr_identity_task_automation.sql','column','caretaker_tasks.workflow_type'),
    ('035_rooster_qr_identity_task_automation.sql','function','create_or_get_animal_qr_identity'),
    ('035_rooster_qr_identity_task_automation.sql','function','create_qr_tagging_task_request'),
    ('035_rooster_qr_identity_task_automation.sql','trigger','trg_read_approved_rooster_purchase'),
    ('035_rooster_qr_identity_task_automation.sql','trigger','trg_read_assigned_qr_task_before')
    ,('036_caretaker_task_submission_identity_fix.sql','function','caretaker_submit_task_proof')
    ,('037_task_proof_id_compatibility_guard.sql','function','sync_task_proof_task_ids')
    ,('037_task_proof_id_compatibility_guard.sql','trigger','trg_sync_task_proof_task_ids')
    ,('039_task_proof_customer_release_fix.sql','function','task_proof_customer_release_version')
    ,('040_rooster_sale_and_withdrawal_confirmation.sql','table','rooster_sale_requests')
    ,('040_rooster_sale_and_withdrawal_confirmation.sql','table','rooster_sale_events')
    ,('040_rooster_sale_and_withdrawal_confirmation.sql','table','customer_payout_methods')
    ,('040_rooster_sale_and_withdrawal_confirmation.sql','column','customer_animals.sale_status')
    ,('040_rooster_sale_and_withdrawal_confirmation.sql','column','customer_animals.approved_sale_price')
    ,('040_rooster_sale_and_withdrawal_confirmation.sql','function','customer_request_rooster_sale_price')
    ,('040_rooster_sale_and_withdrawal_confirmation.sql','function','customer_confirm_rooster_sale')
    ,('040_rooster_sale_and_withdrawal_confirmation.sql','function','admin_review_rooster_sale')
    ,('040_rooster_sale_and_withdrawal_confirmation.sql','function','caretaker_submit_rooster_sale_task')
    ,('040_rooster_sale_and_withdrawal_confirmation.sql','function','customer_save_payout_method')
    ,('040_rooster_sale_and_withdrawal_confirmation.sql','function','customer_confirm_withdrawal_result')
    ,('057_withdrawal_completion_inbox_sync.sql','function','withdrawal_completion_inbox_sync_version')
    ,('072_withdrawal_recovery_and_ledger_integrity.sql','function','customer_resubmit_withdrawal_request')
    ,('072_withdrawal_recovery_and_ledger_integrity.sql','function','withdrawal_recovery_integrity_version')
    ,('073_manual_withdrawal_dispute_investigation.sql','table','withdrawal_disputes')
    ,('073_manual_withdrawal_dispute_investigation.sql','function','customer_report_withdrawal_problem')
    ,('073_manual_withdrawal_dispute_investigation.sql','function','admin_resolve_withdrawal_dispute')
    ,('073_manual_withdrawal_dispute_investigation.sql','function','withdrawal_dispute_investigation_version')
    ,('074_withdrawal_legacy_problem_to_investigation.sql','function','withdrawal_legacy_problem_reconciliation_version')
    ,('075_withdrawal_dispute_inbox_schema_fix.sql','function','withdrawal_dispute_inbox_schema_fix_version')
    ,('076_withdrawal_dispute_reopen_cycle.sql','function','withdrawal_dispute_reopen_cycle_version')
    ,('077_kafarm_guardian_durable_monitor.sql','function','kafarm_guardian_monitor_snapshot')
    ,('040_rooster_sale_and_withdrawal_confirmation.sql','function','rooster_sale_workflow_version')
    ,('044_workflow_chain_guard.sql','table','workflow_operation_keys')
    ,('044_workflow_chain_guard.sql','table','workflow_chain_runs')
    ,('044_workflow_chain_guard.sql','table','workflow_chain_events')
    ,('044_workflow_chain_guard.sql','function','customer_submit_manual_payment_guarded')
    ,('044_workflow_chain_guard.sql','function','admin_review_manual_payment_guarded')
    ,('044_workflow_chain_guard.sql','function','kafarm_workflow_chain_snapshot')
    ,('045_operational_workflow_guard.sql','function','customer_submit_withdrawal_request_guarded')
    ,('049_customer_kyc_digest_schema_fix.sql','function','customer_submit_kyc')
    ,('050_kyc_system_checks_digest_schema_fix.sql','function','run_kyc_system_checks')
    ,('045_operational_workflow_guard.sql','function','admin_review_task_proof_guarded')
    ,('045_operational_workflow_guard.sql','function','admin_review_withdrawal_request_guarded')
    ,('045_operational_workflow_guard.sql','function','admin_review_rooster_sale_guarded')
    ,('045_operational_workflow_guard.sql','function','admin_review_caretaker_application_guarded')
    ,('053_customer_kyc_approved_state_reconciliation.sql','function','admin_review_customer_kyc_guarded')
    ,('053_customer_kyc_approved_state_reconciliation.sql','function','kyc_review_reconciliation_version')
    ,('054_customer_kyc_profile_approval_sync.sql','function','sync_approved_customer_kyc_to_profile')
    ,('054_customer_kyc_profile_approval_sync.sql','function','customer_kyc_profile_approval_sync_version')
    ,('055_customer_signup_profile_guard.sql','function','customer_ensure_signup_profile')
    ,('055_customer_signup_profile_guard.sql','function','customer_signup_profile_guard_version')
    ,('055_customer_signup_profile_guard.sql','trigger','trg_create_customer_profile_after_auth_signup')
    ,('056_withdrawal_wallet_pin_guard.sql','function','change_wallet_pin')
    ,('056_withdrawal_wallet_pin_guard.sql','function','customer_submit_withdrawal_request_guarded')
    ,('056_withdrawal_wallet_pin_guard.sql','function','withdrawal_wallet_pin_guard_version')
    ,('046_payment_correction_and_video_evidence.sql','function','payment_correction_video_evidence_version')
    ,('047_rooster_sale_assignment_qr_fix.sql','function','rooster_sale_assignment_qr_fix_version')
    ,('048_task_proof_sale_type_constraint_fix.sql','function','task_proof_sale_type_constraint_fix_version')
    ,('058_care_plan_mission_engine_foundation.sql','table','care_mission_templates')
    ,('058_care_plan_mission_engine_foundation.sql','table','rooster_care_plans')
    ,('058_care_plan_mission_engine_foundation.sql','table','care_plan_supply_requirements')
    ,('058_care_plan_mission_engine_foundation.sql','table','rooster_daily_missions')
    ,('058_care_plan_mission_engine_foundation.sql','table','care_plan_events')
    ,('058_care_plan_mission_engine_foundation.sql','function','generate_due_care_plan_missions')
    ,('059_care_mission_catalog_seed.sql','table','care_mission_templates')
    ,('060_care_plan_mission_proof_inventory_guard.sql','table','care_plan_inventory_usage')
    ,('060_care_plan_mission_proof_inventory_guard.sql','function','care_mission_checklist_passes')
    ,('060_care_plan_mission_proof_inventory_guard.sql','function','caretaker_get_task_inventory')
    ,('060_care_plan_mission_proof_inventory_guard.sql','function','caretaker_submit_mission_proof')
    ,('060_care_plan_mission_proof_inventory_guard.sql','function','admin_review_mission_proof_guarded')
    ,('061_care_plan_quote_payment_activation.sql','function','customer_request_care_plan')
    ,('061_care_plan_quote_payment_activation.sql','trigger','trg_sync_manual_payment_care_plan')
    ,('061_care_plan_quote_payment_activation.sql','function','admin_activate_care_plan')
    ,('062_care_plan_production_lifecycle.sql','function','admin_prepare_care_plan_quote_v2')
    ,('062_care_plan_production_lifecycle.sql','function','fulfill_care_plan_feed')
    ,('062_care_plan_production_lifecycle.sql','function','customer_cancel_care_plan')
    ,('062_care_plan_production_lifecycle.sql','function','admin_control_care_plan')
    ,('062_care_plan_production_lifecycle.sql','function','admin_record_care_plan_refund')
    ,('062_care_plan_production_lifecycle.sql','function','kafarm_care_plan_health_snapshot')
    ,('063_unified_care_plan_manual_mission_inventory_guard.sql','table','manual_care_inventory_reservations')
    ,('063_unified_care_plan_manual_mission_inventory_guard.sql','table','manual_care_inventory_usage')
    ,('063_unified_care_plan_manual_mission_inventory_guard.sql','function','caretaker_submit_manual_mission_proof')
    ,('063_unified_care_plan_manual_mission_inventory_guard.sql','function','admin_review_manual_mission_proof_guarded')
    ,('064_care_plan_task_management_assignment.sql','function','admin_assign_care_plan')
    ,('065_fixed_5000_care_plan_package_day1_readiness.sql','table','care_plan_package_items')
    ,('065_fixed_5000_care_plan_package_day1_readiness.sql','function','customer_prepare_fixed_care_plan_payment')
    ,('065_fixed_5000_care_plan_package_day1_readiness.sql','function','sync_care_plan_day1_readiness')
    ,('066_care_plan_task_checklist_compatibility.sql','function','care_plan_task_checklist_compatibility_version')
    ,('069_care_plan_customer_feed_balance_pricing_contract.sql','function','care_plan_customer_inventory_contract_version')
    ,('070_kafarm_care_plan_health_qr_classification.sql','function','kafarm_care_plan_health_classifier_version')
    ,('071_customer_kyc_risk_review_guard.sql','function','kyc_risk_review_guard_version')
),
object_status as (
  select
    migration,
    kind,
    object_name,
    case
      when kind = 'table' then to_regclass('public.' || object_name) is not null
      when kind = 'view' then exists (
        select 1 from information_schema.views
        where table_schema = 'public'
          and table_name = object_name
      )
      when kind = 'function' then exists (
        select 1 from information_schema.routines
        where routine_schema = 'public'
          and routine_name = object_name
        )
      when kind = 'bucket' then exists (
        select 1 from storage.buckets where id = object_name
      )
      when kind = 'column' then exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = split_part(object_name, '.', 1)
          and column_name = split_part(object_name, '.', 2)
      )
      when kind = 'index' then exists (
        select 1
        from pg_indexes
        where schemaname = 'public'
          and indexname = object_name
      )
      when kind = 'trigger' then exists (
        select 1
        from pg_trigger
        where tgname = object_name
          and not tgisinternal
      )
      else false
    end as exists
  from expected
),
migration_summary as (
  select
    migration,
    count(*) as expected_objects,
    count(*) filter (where exists) as existing_objects,
    count(*) filter (where not exists) as missing_objects,
    case
      when count(*) filter (where not exists) = 0 then 'APPLIED'
      when count(*) filter (where exists) = 0 then 'NOT RUN'
      else 'PARTIAL'
    end as status
  from object_status
  group by migration
),
missing_detail as (
  select
    migration,
    coalesce(jsonb_agg(jsonb_build_object('kind', kind, 'object_name', object_name) order by kind, object_name), '[]'::jsonb) as missing
  from object_status
  where not exists
  group by migration
)
select
  ms.migration,
  ms.status,
  ms.existing_objects,
  ms.expected_objects,
  ms.missing_objects,
  coalesce(md.missing, '[]'::jsonb) as missing_detail
from migration_summary ms
left join missing_detail md on md.migration = ms.migration
order by ms.migration;

-- Optional detail view:
-- select * from object_status order by migration, kind, object_name;
