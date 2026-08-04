-- FarmConnect Support Chat Phase 3A reference
-- REFERENCE ONLY.
-- This records the DB objects confirmed by chat output.
-- Do not run this file as a migration.

-- Confirmed tables:
-- public.support_chat_sessions
-- public.support_chat_messages

-- Confirmed functions:
-- public.customer_support_send_message(
--   p_session_id uuid,
--   p_body text,
--   p_force_escalate boolean
-- )
--
-- public.caretaker_support_send_message(
--   p_session_id uuid,
--   p_body text,
--   p_force_escalate boolean
-- )
--
-- public.kafarm_support_send_message(
--   p_session_id uuid,
--   p_body text,
--   p_metadata jsonb default '{}'::jsonb
-- )
--
-- public.admin_support_join_chat(p_session_id uuid)
-- public.admin_support_send_message(p_session_id uuid, p_body text)
-- public.admin_support_end_chat(p_session_id uuid)
-- public.admin_support_complete_chat(p_session_id uuid)
-- public.log_support_chat_evidence(...)

-- Confirmed admin view:
-- public.admin_support_escalated_chats

-- Expected sender roles in messages:
-- customer
-- caretaker
-- kafarm
-- admin

-- Expected session statuses:
-- ai_only
-- escalated
-- admin_joined
-- ended
-- completed

-- Verification query, SAFE TO RUN:
select
  'tables' as section,
  jsonb_agg(table_name order by table_name) as data
from information_schema.tables
where table_schema = 'public'
  and table_name in ('support_chat_sessions', 'support_chat_messages')

union all

select
  'functions' as section,
  jsonb_agg(proname order by proname) as data
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and proname in (
    'admin_support_complete_chat',
    'admin_support_end_chat',
    'admin_support_join_chat',
    'admin_support_send_message',
    'caretaker_support_send_message',
    'customer_support_send_message',
    'kafarm_support_send_message',
    'log_support_chat_evidence'
  )

union all

select
  'admin_view' as section,
  jsonb_agg(table_name order by table_name) as data
from information_schema.views
where table_schema = 'public'
  and table_name = 'admin_support_escalated_chats';
