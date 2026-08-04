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

    ('022_kafarm_database_reader.sql','function','kafarm_database_health_snapshot')
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
      when kind = 'column' then exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = split_part(object_name, '.', 1)
          and column_name = split_part(object_name, '.', 2)
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
