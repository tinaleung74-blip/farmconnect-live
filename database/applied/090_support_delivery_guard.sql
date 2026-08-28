-- Deploy together with the support delivery UI. Does not alter existing messages.
begin;
do $$ begin
  if to_regprocedure('public.customer_support_send_message(uuid,text,boolean)') is null
    or to_regprocedure('public.caretaker_support_send_message(uuid,text,boolean)') is null then
    raise exception 'SUPPORT_BASELINE_REQUIRED: install and verify the existing support RPCs first';
  end if;
end $$;
create table if not exists public.support_delivery_operations (
  user_id uuid not null references auth.users(id),
  operation_key uuid not null,
  request jsonb not null,
  session_id uuid not null,
  created_at timestamptz not null default now(),
  primary key(user_id, operation_key)
);
alter table public.support_delivery_operations enable row level security;
revoke all on public.support_delivery_operations from public, anon, authenticated;
create or replace function public.support_send_guarded(p_key uuid, p_role text, p_session_id uuid, p_body text, p_force_escalate boolean default false)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  actor uuid := auth.uid();
  actual_role text;
  request_data jsonb;
  prior public.support_delivery_operations%rowtype;
  result_id uuid;
begin
  if actor is null then raise exception 'LOGIN_REQUIRED'; end if;
  select role::text into actual_role from public.profiles where auth_user_id = actor;
  if actual_role not in ('customer','caretaker') or actual_role is null or p_role is distinct from actual_role then
    raise exception 'SUPPORT_ROLE_NOT_ALLOWED';
  end if;
  if p_key is null or nullif(btrim(p_body),'') is null or length(p_body) > 10000 then raise exception 'INVALID_MESSAGE'; end if;
  request_data := jsonb_build_object('role',p_role,'session',p_session_id,'body',p_body,'escalate',p_force_escalate);
  perform pg_advisory_xact_lock(hashtextextended(actor::text || p_key::text,0));
  select * into prior from public.support_delivery_operations where user_id=actor and operation_key=p_key;
  if found then
    if prior.request is distinct from request_data then raise exception 'OPERATION_PAYLOAD_CHANGED'; end if;
    return prior.session_id;
  end if;
  -- Existing RPCs remain responsible for session ownership and account rules.
  if actual_role='customer' then
    result_id := public.customer_support_send_message(p_session_id,p_body,p_force_escalate);
  else
    result_id := public.caretaker_support_send_message(p_session_id,p_body,p_force_escalate);
  end if;
  if result_id is null then raise exception 'SUPPORT_RECEIPT_MISSING'; end if;
  insert into public.support_delivery_operations(user_id,operation_key,request,session_id) values(actor,p_key,request_data,result_id);
  return result_id;
end $$;
revoke all on function public.support_send_guarded(uuid,text,uuid,text,boolean) from public,anon;
grant execute on function public.support_send_guarded(uuid,text,uuid,text,boolean) to authenticated;
commit;
select jsonb_build_object('migration','090_support_delivery_guard','guarded_rpc',to_regprocedure('public.support_send_guarded(uuid,text,uuid,text,boolean)') is not null,'business_records_changed',false) as verification;
