-- FarmConnect full read-only SQL audit checker
-- Safe: SELECT only. Use this in Supabase SQL Editor, then paste output into KaFarm Database Health.

with expected_objects(kind, object_name) as (
  values
    ('table','profiles'),
    ('table','caretakers'),
    ('table','customer_kyc_profiles'),
    ('table','customer_kyc_documents'),
    ('table','customer_kyc_consents'),
    ('table','kyc_review_logs'),
    ('table','wallets'),
    ('table','wallet_transactions'),
    ('table','customer_payout_methods'),
    ('table','wallet_pin_audit_logs'),
    ('table','manual_payment_requests'),
    ('table','payment_evidence_logs'),
    ('table','inbox_items'),
    ('table','withdrawal_requests'),
    ('table','withdrawal_evidence_logs'),
    ('table','marketplace_products'),
    ('table','farm_cart_items'),
    ('table','customer_inventory_items'),
    ('table','customer_animals'),
    ('table','animals'),
    ('table','animal_photos'),
    ('table','animal_weights'),
    ('table','care_logs'),
    ('table','care_requests'),
    ('table','care_task_assignments'),
    ('table','care_task_submissions'),
    ('table','care_task_evidence_logs'),
    ('table','caretaker_applications'),
    ('table','support_chat_sessions'),
    ('table','support_chat_messages'),
    ('table','kafarm_incidents'),
    ('function','current_profile_id'),
    ('function','is_admin'),
    ('function','customer_submit_kyc'),
    ('function','run_kyc_system_checks'),
    ('function','admin_review_customer_kyc'),
    ('function','customer_record_kyc_consent'),
    ('function','change_wallet_pin'),
    ('function','admin_reset_wallet_pin'),
    ('function','customer_submit_manual_payment'),
    ('function','admin_review_manual_payment'),
    ('function','customer_submit_withdrawal_request'),
    ('function','admin_review_withdrawal_request'),
    ('function','customer_buy_cart'),
    ('function','customer_add_farm_cart_item'),
    ('function','customer_create_care_request'),
    ('function','admin_assign_care_request'),
    ('function','caretaker_submit_task_proof'),
    ('function','admin_review_task_proof'),
    ('function','submit_caretaker_application'),
    ('function','admin_review_caretaker_application'),
    ('function','customer_support_send_message'),
    ('function','caretaker_support_send_message'),
    ('function','kafarm_support_send_message'),
    ('function','admin_support_join_chat'),
    ('function','admin_support_send_message'),
    ('function','admin_support_complete_chat'),
    ('function','kafarm_record_incident'),
    ('function','admin_kafarm_update_incident_status'),
    ('view','admin_support_escalated_chats'),
    ('view','admin_kafarm_incident_queue')
), object_status as (
  select kind, object_name,
    case
      when kind = 'table' then to_regclass('public.' || object_name) is not null
      when kind = 'view' then exists (select 1 from information_schema.views where table_schema='public' and table_name=object_name)
      when kind = 'function' then exists (select 1 from information_schema.routines where routine_schema='public' and routine_name=object_name)
      else false
    end as exists
  from expected_objects
), policy_status as (
  select 'policy'::text as kind, p as object_name,
    exists (select 1 from pg_policies where schemaname='public' and lower(policyname) like '%' || lower(p) || '%') as exists
  from unnest(array[
    'profiles self read',
    'profiles owner safe update',
    'kyc',
    'wallet',
    'payment evidence read linked',
    'withdrawal evidence read linked',
    'inventory',
    'customer animals',
    'care task',
    'caretaker',
    'support sessions read own',
    'support messages read own',
    'evidence',
    'kafarm incidents admin read all',
    'kafarm incidents owner read own'
  ]) p
)
select kind, object_name, exists
from object_status
union all
select kind, object_name, exists
from policy_status
order by kind, object_name;
