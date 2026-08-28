-- Requires 090-092. Test on an isolated database before production.
-- No historical messages, payments, or KYC records are rewritten.
begin;

alter table public.support_delivery_operations
  add column if not exists reply_message_id uuid references public.support_chat_messages(id);
grant select on public.support_delivery_operations to service_role;

-- Retain the old signature, but fail closed even if another grant exists.
create or replace function public.kafarm_support_send_message(p_session_id uuid, p_body text, p_metadata jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
begin
  raise exception 'TRUSTED_REPLY_REQUIRED';
end $$;
revoke all on function public.kafarm_support_send_message(uuid,text,jsonb) from public,anon,authenticated;

create or replace function public.support_save_trusted_reply(p_actor uuid,p_key uuid,p_body text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare
  delivery public.support_delivery_operations%rowtype;
  session_status text;
  reply_id uuid;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'SERVER_ONLY'; end if;
  if p_actor is null or p_key is null or nullif(btrim(p_body),'') is null or length(p_body)>10000 then
    raise exception 'INVALID_REPLY';
  end if;
  -- Same lock as send/reconcile: exactly one automatic reply per saved operation.
  perform pg_advisory_xact_lock(hashtextextended(p_actor::text || p_key::text,0));
  select * into delivery from public.support_delivery_operations
    where user_id=p_actor and operation_key=p_key for update;
  if not found then raise exception 'SUPPORT_RECEIPT_MISSING'; end if;
  if delivery.reply_message_id is not null then return delivery.reply_message_id; end if;
  if not exists(select 1 from public.profiles where auth_user_id=p_actor
    and role::text in ('customer','caretaker') and role::text=delivery.request->>'role') then
    raise exception 'SUPPORT_ROLE_NOT_ALLOWED';
  end if;
  select status::text into session_status from public.support_chat_sessions
    where id=delivery.session_id for update;
  if not found then raise exception 'CHAT_NOT_FOUND'; end if;
  -- Recheck under the session lock; admin closure/escalation can race the API call.
  if session_status not in ('open','kafarm_solved') or session_status is null
     or coalesce((delivery.request->>'escalate')::boolean,false) then return null; end if;
  insert into public.support_chat_messages(session_id,sender_role,body,metadata)
    values(delivery.session_id,'kafarm',btrim(p_body),jsonb_build_object(
      'source','kafarm_server_rule_reply','operation_key',p_key)) returning id into reply_id;
  update public.support_delivery_operations set reply_message_id=reply_id
    where user_id=p_actor and operation_key=p_key;
  update public.support_chat_sessions set updated_at=now() where id=delivery.session_id;
  return reply_id;
end $$;
revoke all on function public.support_save_trusted_reply(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.support_save_trusted_reply(uuid,uuid,text) to service_role;
commit;

select jsonb_build_object(
  'migration','093_support_trusted_replies',
  'authenticated_can_forge_reply',has_function_privilege('authenticated','public.kafarm_support_send_message(uuid,text,jsonb)','EXECUTE'),
  'authenticated_can_save_trusted_reply',has_function_privilege('authenticated','public.support_save_trusted_reply(uuid,uuid,text)','EXECUTE'),
  'anonymous_can_save_trusted_reply',has_function_privilege('anon','public.support_save_trusted_reply(uuid,uuid,text)','EXECUTE'),
  'server_can_save_trusted_reply',has_function_privilege('service_role','public.support_save_trusted_reply(uuid,uuid,text)','EXECUTE'),
  'business_records_changed',false
) as verification;
