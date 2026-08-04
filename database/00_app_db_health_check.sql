-- FarmConnect app database health check
-- Safe to run: read-only checks only.
-- Paste the full result back to Buddy/Codex.

with required_tables(table_name) as (
  values
    ('profiles'),
    ('farm_products'),
    ('farm_cart_items'),
    ('animals'),
    ('customer_animals'),
    ('wallet_transactions'),
    ('inbox_items'),
    ('inventory_usage_logs'),
    ('task_proofs'),
    ('caretaker_tasks'),
    ('caretakers'),
    ('support_chat_sessions'),
    ('support_chat_messages'),
    ('evidence_logs'),
    ('customer_kyc_profiles'),
    ('kyc_documents')
),
required_functions(function_name) as (
  values
    ('customer_buy_cart'),
    ('customer_record_kyc_consent'),
    ('customer_submit_kyc'),
    ('run_kyc_system_checks'),
    ('admin_review_customer_kyc'),
    ('change_wallet_pin'),
    ('caretaker_submit_task_proof'),
    ('customer_support_send_message'),
    ('caretaker_support_send_message'),
    ('kafarm_support_send_message'),
    ('admin_support_join_chat'),
    ('admin_support_send_message'),
    ('admin_support_end_chat'),
    ('admin_support_complete_chat'),
    ('log_support_chat_evidence')
),
required_relations(relation_name, relation_type) as (
  values
    ('admin_support_escalated_chats', 'view')
),
required_columns(table_name, column_name) as (
  values
    ('profiles','id'),
    ('profiles','auth_user_id'),
    ('profiles','email'),
    ('profiles','full_name'),
    ('profiles','display_name'),
    ('profiles','role'),
    ('profiles','account_status'),
    ('profiles','wallet_balance'),
    ('profiles','wallet_pin_set'),
    ('profiles','wallet_locked_savings'),
    ('profiles','birthdate'),
    ('profiles','kyc_status'),
    ('farm_products','id'),
    ('farm_products','name'),
    ('farm_products','category'),
    ('farm_products','unit_label'),
    ('farm_products','unit_price'),
    ('farm_products','image_url'),
    ('farm_products','stock_quantity'),
    ('farm_products','status'),
    ('farm_products','product_type'),
    ('farm_products','stage'),
    ('farm_products','bloodline'),
    ('farm_products','breed'),
    ('farm_products','product_metadata'),
    ('farm_cart_items','profile_id'),
    ('farm_cart_items','product_id'),
    ('farm_cart_items','quantity'),
    ('farm_cart_items','unit_price'),
    ('farm_cart_items','status'),
    ('farm_cart_items','farm_request_id'),
    ('farm_cart_items','caretaker_task_id'),
    ('farm_cart_items','animal_id'),
    ('farm_cart_items','purpose_note'),
    ('farm_cart_items','product_type'),
    ('farm_cart_items','bloodline_snapshot'),
    ('farm_cart_items','breed_snapshot'),
    ('farm_cart_items','product_name_snapshot'),
    ('animals','id'),
    ('animals','profile_id'),
    ('animals','name'),
    ('animals','code'),
    ('animals','pen_location'),
    ('animals','bloodline'),
    ('animals','breed'),
    ('animals','stage'),
    ('customer_animals','id'),
    ('customer_animals','bloodline_snapshot'),
    ('customer_animals','breed_snapshot'),
    ('customer_animals','source_product_id'),
    ('customer_animals','source_product_name'),
    ('wallet_transactions','profile_id'),
    ('wallet_transactions','transaction_type'),
    ('wallet_transactions','amount'),
    ('wallet_transactions','status'),
    ('inbox_items','profile_id'),
    ('inbox_items','category'),
    ('inbox_items','title'),
    ('inbox_items','body'),
    ('inventory_usage_logs','quantity_used'),
    ('inventory_usage_logs','unit'),
    ('inventory_usage_logs','note'),
    ('task_proofs','proof_type'),
    ('task_proofs','proof_url'),
    ('task_proofs','thumbnail_url'),
    ('task_proofs','admin_review_status'),
    ('task_proofs','proof_check_status'),
    ('caretaker_tasks','caretaker_id'),
    ('caretaker_tasks','status'),
    ('caretaker_tasks','due_at'),
    ('support_chat_sessions','id'),
    ('support_chat_sessions','status'),
    ('support_chat_sessions','updated_at'),
    ('support_chat_messages','session_id'),
    ('support_chat_messages','sender_role'),
    ('support_chat_messages','body'),
    ('support_chat_messages','created_at')
),
table_check as (
  select
    '01_required_tables' as section,
    jsonb_agg(
      jsonb_build_object(
        'table', rt.table_name,
        'exists', (t.table_name is not null)
      )
      order by rt.table_name
    ) as data
  from required_tables rt
  left join information_schema.tables t
    on t.table_schema = 'public'
   and t.table_name = rt.table_name
),
function_check as (
  select
    '02_required_functions' as section,
    jsonb_agg(
      jsonb_build_object(
        'function', rf.function_name,
        'exists', (p.proname is not null)
      )
      order by rf.function_name
    ) as data
  from required_functions rf
  left join pg_proc p
    on p.proname = rf.function_name
  left join pg_namespace n
    on n.oid = p.pronamespace
   and n.nspname = 'public'
),
relation_check as (
  select
    '03_required_views' as section,
    jsonb_agg(
      jsonb_build_object(
        'relation', rr.relation_name,
        'type', rr.relation_type,
        'exists', (c.relname is not null)
      )
      order by rr.relation_name
    ) as data
  from required_relations rr
  left join pg_class c
    on c.relname = rr.relation_name
  left join pg_namespace n
    on n.oid = c.relnamespace
   and n.nspname = 'public'
),
column_check as (
  select
    '04_required_columns' as section,
    jsonb_agg(
      jsonb_build_object(
        'table', rc.table_name,
        'column', rc.column_name,
        'exists', (c.column_name is not null)
      )
      order by rc.table_name, rc.column_name
    ) as data
  from required_columns rc
  left join information_schema.columns c
    on c.table_schema = 'public'
   and c.table_name = rc.table_name
   and c.column_name = rc.column_name
),
rls_check as (
  select
    '05_rls_enabled' as section,
    jsonb_agg(
      jsonb_build_object(
        'table', rt.table_name,
        'rls_enabled', coalesce(pc.relrowsecurity, false),
        'force_rls', coalesce(pc.relforcerowsecurity, false)
      )
      order by rt.table_name
    ) as data
  from required_tables rt
  left join pg_class pc
    on pc.relname = rt.table_name
  left join pg_namespace pn
    on pn.oid = pc.relnamespace
   and pn.nspname = 'public'
),
policy_check as (
  select
    '06_policy_counts' as section,
    jsonb_agg(
      jsonb_build_object(
        'table', rt.table_name,
        'policy_count', coalesce(p.policy_count, 0)
      )
      order by rt.table_name
    ) as data
  from required_tables rt
  left join (
    select tablename, count(*) as policy_count
    from pg_policies
    where schemaname = 'public'
    group by tablename
  ) p on p.tablename = rt.table_name
),
missing_summary as (
  select
    '07_missing_summary' as section,
    jsonb_build_object(
      'missing_tables', (
        select coalesce(jsonb_agg(rt.table_name order by rt.table_name), '[]'::jsonb)
        from required_tables rt
        left join information_schema.tables t
          on t.table_schema = 'public'
         and t.table_name = rt.table_name
        where t.table_name is null
      ),
      'missing_functions', (
        select coalesce(jsonb_agg(rf.function_name order by rf.function_name), '[]'::jsonb)
        from required_functions rf
        left join pg_proc p on p.proname = rf.function_name
        left join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
        where p.proname is null
      ),
      'missing_columns', (
        select coalesce(jsonb_agg((rc.table_name || '.' || rc.column_name) order by rc.table_name, rc.column_name), '[]'::jsonb)
        from required_columns rc
        left join information_schema.columns c
          on c.table_schema = 'public'
         and c.table_name = rc.table_name
         and c.column_name = rc.column_name
        where c.column_name is null
      )
    ) as data
)
select section, data from table_check
union all select section, data from function_check
union all select section, data from relation_check
union all select section, data from column_check
union all select section, data from rls_check
union all select section, data from policy_check
union all select section, data from missing_summary
order by section;
