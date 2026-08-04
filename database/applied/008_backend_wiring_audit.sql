-- FarmConnect backend wiring audit
-- Safe to run: read-only checks only.
-- Purpose:
-- - Show if the app is truly backend-wired, not UI-only.
-- - Paste the full result back to Buddy/Codex.

with required_tables(table_name, flow) as (
  values
    ('profiles', 'auth/profile'),
    ('farm_products', 'farm_buy'),
    ('farm_cart_items', 'farm_buy'),
    ('customer_inventory_items', 'farm_buy_inventory'),
    ('customer_animals', 'farm_buy_roosters'),
    ('wallet_transactions', 'wallet_money'),
    ('inbox_items', 'receipt_inbox'),
    ('support_chat_sessions', 'support_chat'),
    ('support_chat_messages', 'support_chat'),
    ('evidence_logs', 'evidence'),
    ('customer_kyc_profiles', 'kyc'),
    ('kyc_documents', 'kyc'),
    ('caretaker_tasks', 'caretaker_tasks'),
    ('task_proofs', 'caretaker_proofs'),
    ('inventory_usage_logs', 'care_inventory_usage')
),
required_functions(function_name, flow) as (
  values
    ('customer_buy_cart', 'farm_buy_checkout'),
    ('customer_submit_kyc', 'kyc_submit'),
    ('run_kyc_system_checks', 'kyc_checker'),
    ('admin_review_customer_kyc', 'kyc_admin_review'),
    ('change_wallet_pin', 'wallet_security'),
    ('customer_support_send_message', 'customer_support'),
    ('caretaker_support_send_message', 'caretaker_support'),
    ('kafarm_support_send_message', 'kafarm_support'),
    ('admin_support_join_chat', 'admin_support'),
    ('admin_support_send_message', 'admin_support'),
    ('admin_support_end_chat', 'admin_support'),
    ('admin_support_complete_chat', 'admin_support'),
    ('caretaker_submit_task_proof', 'caretaker_proof_submit')
),
required_columns(table_name, column_name, flow) as (
  values
    ('profiles', 'auth_user_id', 'auth/profile'),
    ('profiles', 'wallet_balance', 'wallet_money'),
    ('farm_products', 'stock_quantity', 'farm_buy'),
    ('farm_products', 'product_type', 'farm_buy'),
    ('farm_products', 'bloodline', 'farm_buy'),
    ('farm_cart_items', 'profile_id', 'farm_buy'),
    ('farm_cart_items', 'product_id', 'farm_buy'),
    ('farm_cart_items', 'quantity', 'farm_buy'),
    ('farm_cart_items', 'status', 'farm_buy'),
    ('farm_cart_items', 'checkout_id', 'farm_buy'),
    ('customer_inventory_items', 'profile_id', 'farm_buy_inventory'),
    ('customer_inventory_items', 'product_id', 'farm_buy_inventory'),
    ('customer_inventory_items', 'quantity', 'farm_buy_inventory'),
    ('customer_animals', 'profile_id', 'farm_buy_roosters'),
    ('customer_animals', 'animal_name', 'farm_buy_roosters'),
    ('customer_animals', 'source_product_id', 'farm_buy_roosters'),
    ('customer_animals', 'bloodline_snapshot', 'farm_buy_roosters'),
    ('inbox_items', 'profile_id', 'receipt_inbox'),
    ('inbox_items', 'category', 'receipt_inbox'),
    ('inbox_items', 'title', 'receipt_inbox'),
    ('inbox_items', 'body', 'receipt_inbox'),
    ('support_chat_sessions', 'status', 'support_chat'),
    ('support_chat_messages', 'sender_role', 'support_chat'),
    ('support_chat_messages', 'body', 'support_chat')
),
table_results as (
  select
    'tables' as section,
    rt.flow,
    rt.table_name as object_name,
    case when t.table_name is null then 'missing' else 'ok' end as status
  from required_tables rt
  left join information_schema.tables t
    on t.table_schema = 'public'
   and t.table_name = rt.table_name
),
function_results as (
  select
    'functions' as section,
    rf.flow,
    rf.function_name as object_name,
    case when p.proname is null or n.nspname is null then 'missing' else 'ok' end as status
  from required_functions rf
  left join pg_proc p
    on p.proname = rf.function_name
  left join pg_namespace n
    on n.oid = p.pronamespace
   and n.nspname = 'public'
),
column_results as (
  select
    'columns' as section,
    rc.flow,
    rc.table_name || '.' || rc.column_name as object_name,
    case when c.column_name is null then 'missing' else 'ok' end as status
  from required_columns rc
  left join information_schema.columns c
    on c.table_schema = 'public'
   and c.table_name = rc.table_name
   and c.column_name = rc.column_name
),
rls_results as (
  select
    'rls' as section,
    tablename as flow,
    tablename as object_name,
    case when rowsecurity then 'ok' else 'rls_off' end as status
  from pg_tables
  where schemaname = 'public'
    and tablename in (
      'profiles',
      'farm_cart_items',
      'customer_inventory_items',
      'customer_animals',
      'inbox_items',
      'support_chat_sessions',
      'support_chat_messages',
      'customer_kyc_profiles',
      'kyc_documents'
    )
),
policy_results as (
  select
    'policies' as section,
    tablename as flow,
    tablename as object_name,
    count(*)::text as status
  from pg_policies
  where schemaname = 'public'
    and tablename in (
      'profiles',
      'farm_cart_items',
      'customer_inventory_items',
      'customer_animals',
      'inbox_items',
      'support_chat_sessions',
      'support_chat_messages',
      'customer_kyc_profiles',
      'kyc_documents'
    )
  group by tablename
)
select *
from table_results
union all
select *
from function_results
union all
select *
from column_results
union all
select *
from rls_results
union all
select *
from policy_results
order by section, flow, object_name;
