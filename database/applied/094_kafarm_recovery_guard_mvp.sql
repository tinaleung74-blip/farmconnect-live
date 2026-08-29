-- KaFarm Recovery Guard MVP. Additive only: no existing business row is rewritten.
-- Apply after 093. First integrated workflow: guarded Support delivery.
begin;

create table if not exists public.kafarm_recovery_operations (
  operation_id uuid primary key,
  correlation_id uuid not null,
  actor_auth_id uuid not null references auth.users(id),
  actor_profile_id uuid not null references public.profiles(id),
  workflow text not null check (workflow ~ '^[a-z][a-z0-9_]{1,63}$'),
  action text not null check (action ~ '^[a-z][a-z0-9_]{1,63}$'),
  route text,
  target_type text,
  target_id uuid,
  request_fingerprint text,
  status text not null default 'created' check (status in (
    'created','sending','received','processing','completed','failed_retryable',
    'retrying','reconciling','failed_terminal','manual_review','dead_letter',
    'resolved','cancelled'
  )),
  attempt_count integer not null default 0 check (attempt_count between 0 and 100),
  max_attempts integer not null default 3 check (max_attempts between 1 and 10),
  error_code text,
  error_source text check (error_source is null or error_source in ('browser','network','api','database','realtime','validation','system')),
  error_message_safe text,
  technical_error_ref uuid,
  result_reference text,
  metadata jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_attempt_at timestamptz,
  next_retry_at timestamptz,
  completed_at timestamptz,
  dead_lettered_at timestamptz,
  constraint kafarm_recovery_safe_error_length check (length(coalesce(error_message_safe,'')) <= 500),
  constraint kafarm_recovery_reference_length check (length(coalesce(result_reference,'')) <= 500),
  unique (actor_auth_id, workflow, operation_id)
);

create table if not exists public.kafarm_recovery_audit (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid not null references public.kafarm_recovery_operations(operation_id),
  actor_auth_id uuid,
  actor_role text not null,
  action text not null,
  from_status text,
  to_status text,
  reason_safe text,
  technical_error_ref uuid,
  verified boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint kafarm_recovery_audit_reason_length check (length(coalesce(reason_safe,'')) <= 500)
);

create table if not exists public.kafarm_recovery_incidents (
  id uuid primary key default gen_random_uuid(),
  incident_key text not null unique,
  workflow text not null,
  route text,
  error_code text not null,
  severity text not null check (severity in ('info','warning','critical')),
  status text not null default 'open' check (status in ('open','investigating','resolved','cancelled')),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  occurrence_count bigint not null default 1 check (occurrence_count > 0),
  operation_ids uuid[] not null default '{}',
  summary_safe text not null,
  assigned_to uuid references public.profiles(id),
  resolved_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  constraint kafarm_recovery_incident_summary_length check (length(summary_safe) <= 500)
);

create index if not exists kafarm_recovery_operations_actor_idx
  on public.kafarm_recovery_operations(actor_auth_id,last_seen_at desc);
create index if not exists kafarm_recovery_operations_queue_idx
  on public.kafarm_recovery_operations(status,last_seen_at desc);
create index if not exists kafarm_recovery_audit_operation_idx
  on public.kafarm_recovery_audit(operation_id,created_at);
create index if not exists kafarm_recovery_incidents_queue_idx
  on public.kafarm_recovery_incidents(status,severity,last_seen_at desc);

alter table public.kafarm_recovery_operations enable row level security;
alter table public.kafarm_recovery_audit enable row level security;
alter table public.kafarm_recovery_incidents enable row level security;
revoke all on public.kafarm_recovery_operations from public,anon,authenticated;
revoke all on public.kafarm_recovery_audit from public,anon,authenticated;
revoke all on public.kafarm_recovery_incidents from public,anon,authenticated;

drop policy if exists "recovery operation owner or admin read" on public.kafarm_recovery_operations;
create policy "recovery operation owner or admin read" on public.kafarm_recovery_operations
for select to authenticated using (actor_auth_id=auth.uid() or public.is_admin());
drop policy if exists "recovery audit owner or admin read" on public.kafarm_recovery_audit;
create policy "recovery audit owner or admin read" on public.kafarm_recovery_audit
for select to authenticated using (public.is_admin() or exists(
  select 1 from public.kafarm_recovery_operations operation
  where operation.operation_id=kafarm_recovery_audit.operation_id and operation.actor_auth_id=auth.uid()
));
drop policy if exists "recovery incident admin read" on public.kafarm_recovery_incidents;
create policy "recovery incident admin read" on public.kafarm_recovery_incidents
for select to authenticated using (public.is_admin());

create or replace function public.kafarm_recovery_transition_allowed(p_from text,p_to text)
returns boolean language sql immutable set search_path=public,pg_temp as $$
  select case p_from
    when 'created' then p_to in ('sending','reconciling','manual_review','cancelled')
    when 'sending' then p_to in ('received','completed','failed_retryable','reconciling','failed_terminal','manual_review','dead_letter')
    when 'received' then p_to in ('processing','completed','failed_retryable','reconciling','failed_terminal','manual_review','dead_letter')
    when 'processing' then p_to in ('completed','failed_retryable','reconciling','failed_terminal','manual_review','dead_letter')
    when 'failed_retryable' then p_to in ('retrying','reconciling','manual_review','dead_letter')
    when 'retrying' then p_to in ('received','processing','completed','failed_retryable','reconciling','failed_terminal','dead_letter')
    when 'reconciling' then p_to in ('completed','retrying','failed_terminal','manual_review','dead_letter','cancelled')
    when 'failed_terminal' then p_to in ('reconciling','manual_review','dead_letter','cancelled')
    when 'manual_review' then p_to in ('reconciling','resolved','cancelled','dead_letter')
    when 'dead_letter' then p_to in ('manual_review','resolved','cancelled')
    else false
  end
$$;

create or replace function public.kafarm_recovery_enforce_transition()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
  if old.status is distinct from new.status and not public.kafarm_recovery_transition_allowed(old.status,new.status) then
    raise exception 'RECOVERY_STATUS_TRANSITION_NOT_ALLOWED:%->%',old.status,new.status;
  end if;
  if old.actor_auth_id is distinct from new.actor_auth_id
     or old.actor_profile_id is distinct from new.actor_profile_id
     or old.workflow is distinct from new.workflow
     or old.action is distinct from new.action
     or old.request_fingerprint is distinct from new.request_fingerprint then
    raise exception 'RECOVERY_OPERATION_IDENTITY_IMMUTABLE';
  end if;
  new.last_seen_at:=now();
  if new.status='completed' then new.completed_at:=coalesce(new.completed_at,now()); end if;
  if new.status='dead_letter' then new.dead_lettered_at:=coalesce(new.dead_lettered_at,now()); end if;
  return new;
end $$;
drop trigger if exists kafarm_recovery_transition_guard on public.kafarm_recovery_operations;
create trigger kafarm_recovery_transition_guard before update on public.kafarm_recovery_operations
for each row execute function public.kafarm_recovery_enforce_transition();

create or replace function public.kafarm_recovery_record_audit(
  p_operation_id uuid,p_action text,p_from text,p_to text,p_reason text,p_verified boolean,p_metadata jsonb default '{}'::jsonb
) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  insert into public.kafarm_recovery_audit(operation_id,actor_auth_id,actor_role,action,from_status,to_status,reason_safe,verified,metadata)
  values(p_operation_id,auth.uid(),coalesce(auth.role(),'system'),p_action,p_from,p_to,left(nullif(p_reason,''),500),p_verified,coalesce(p_metadata,'{}'::jsonb));
end $$;
revoke all on function public.kafarm_recovery_record_audit(uuid,text,text,text,text,boolean,jsonb) from public,anon,authenticated;

create or replace function public.kafarm_recovery_begin(
  p_operation_id uuid,p_correlation_id uuid,p_workflow text,p_action text,p_route text default null,
  p_target_type text default null,p_target_id uuid default null,p_request_fingerprint text default null
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  actor uuid:=auth.uid();
  profile_id uuid;
  prior public.kafarm_recovery_operations%rowtype;
begin
  if actor is null then raise exception 'LOGIN_REQUIRED'; end if;
  if p_operation_id is null or p_correlation_id is null then raise exception 'OPERATION_ID_REQUIRED'; end if;
  if coalesce(p_workflow,'') !~ '^[a-z][a-z0-9_]{1,63}$'
     or coalesce(p_action,'') !~ '^[a-z][a-z0-9_]{1,63}$' then raise exception 'RECOVERY_OPERATION_INVALID'; end if;
  select id into profile_id from public.profiles where auth_user_id=actor;
  if profile_id is null then raise exception 'PROFILE_REQUIRED'; end if;
  perform pg_advisory_xact_lock(hashtextextended('recovery:'||p_operation_id::text,0));
  select * into prior from public.kafarm_recovery_operations where operation_id=p_operation_id for update;
  if found then
    if prior.actor_auth_id is distinct from actor or prior.workflow is distinct from p_workflow
       or prior.action is distinct from p_action or prior.request_fingerprint is distinct from p_request_fingerprint then
      raise exception 'OPERATION_PAYLOAD_CHANGED';
    end if;
    return jsonb_build_object('operation_id',prior.operation_id,'correlation_id',prior.correlation_id,
      'status',prior.status,'duplicate',true,'result_reference',prior.result_reference);
  end if;
  insert into public.kafarm_recovery_operations(operation_id,correlation_id,actor_auth_id,actor_profile_id,
    workflow,action,route,target_type,target_id,request_fingerprint,status,attempt_count,last_attempt_at)
  values(p_operation_id,p_correlation_id,actor,profile_id,p_workflow,p_action,left(p_route,300),
    left(p_target_type,100),p_target_id,p_request_fingerprint,'created',0,null);
  perform public.kafarm_recovery_record_audit(p_operation_id,'begin',null,'created','Operation recorded before execution.',true);
  return jsonb_build_object('operation_id',p_operation_id,'correlation_id',p_correlation_id,'status','created','duplicate',false);
end $$;

create or replace function public.kafarm_recovery_mark_sending(p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare operation public.kafarm_recovery_operations%rowtype; old_status text;
begin
  select * into operation from public.kafarm_recovery_operations where operation_id=p_operation_id and actor_auth_id=auth.uid() for update;
  if not found then raise exception 'RECOVERY_OPERATION_NOT_FOUND'; end if;
  if operation.status='sending' then return jsonb_build_object('status','sending','duplicate',true); end if;
  if operation.status='completed' then return jsonb_build_object('status','completed','duplicate',true,'result_reference',operation.result_reference); end if;
  old_status:=operation.status;
  update public.kafarm_recovery_operations set status='sending',attempt_count=attempt_count+1,last_attempt_at=now(),next_retry_at=null where operation_id=p_operation_id;
  perform public.kafarm_recovery_record_audit(p_operation_id,'send_attempt',old_status,'sending','Execution attempt started.',true);
  return jsonb_build_object('status','sending','duplicate',false);
end $$;

create or replace function public.kafarm_recovery_mark_error(
  p_operation_id uuid,p_retryable boolean,p_error_code text,p_error_source text,p_error_message_safe text,p_technical_error_ref uuid default null
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare operation public.kafarm_recovery_operations%rowtype; next_status text;
begin
  select * into operation from public.kafarm_recovery_operations where operation_id=p_operation_id and actor_auth_id=auth.uid() for update;
  if not found then raise exception 'RECOVERY_OPERATION_NOT_FOUND'; end if;
  if operation.status='completed' then return jsonb_build_object('status','completed','result_reference',operation.result_reference); end if;
  next_status:=case when p_retryable and operation.attempt_count<operation.max_attempts then 'failed_retryable' else 'failed_terminal' end;
  update public.kafarm_recovery_operations set status=next_status,error_code=left(coalesce(p_error_code,'UNKNOWN'),100),
    error_source=p_error_source,error_message_safe=left(coalesce(p_error_message_safe,'Request could not be confirmed.'),500),
    technical_error_ref=p_technical_error_ref,next_retry_at=case when next_status='failed_retryable' then now()+interval '3 seconds' end
    where operation_id=p_operation_id;
  perform public.kafarm_recovery_record_audit(p_operation_id,'record_error',operation.status,next_status,
    left(coalesce(p_error_message_safe,'Request could not be confirmed.'),500),false,
    jsonb_build_object('error_code',left(coalesce(p_error_code,'UNKNOWN'),100),'error_source',p_error_source));
  return jsonb_build_object('status',next_status,'retryable',next_status='failed_retryable');
end $$;

create or replace function public.kafarm_recovery_reconcile(p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare operation public.kafarm_recovery_operations%rowtype; support_session uuid; old_status text;
begin
  select * into operation from public.kafarm_recovery_operations where operation_id=p_operation_id
    and (actor_auth_id=auth.uid() or public.is_admin()) for update;
  if not found then raise exception 'RECOVERY_OPERATION_NOT_FOUND'; end if;
  if operation.status='completed' then
    return jsonb_build_object('state','completed','result_reference',operation.result_reference,'verified',true);
  end if;
  old_status:=operation.status;
  if old_status in ('created','sending','received','processing','failed_retryable','retrying','failed_terminal','manual_review') then
    update public.kafarm_recovery_operations set status='reconciling' where operation_id=p_operation_id;
  end if;
  if operation.workflow='support_delivery' then
    select session_id into support_session from public.support_delivery_operations
      where user_id=operation.actor_auth_id and operation_key=operation.operation_id;
    if found then
      update public.kafarm_recovery_operations set status='completed',result_reference=support_session::text,
        error_code=null,error_source=null,error_message_safe=null,next_retry_at=null where operation_id=p_operation_id;
      perform public.kafarm_recovery_record_audit(p_operation_id,'reconcile',old_status,'completed',
        'Authoritative support delivery receipt verified.',true,jsonb_build_object('source','support_delivery_operations'));
      return jsonb_build_object('state','completed','result_reference',support_session,'verified',true);
    end if;
    if exists(select 1 from public.support_delivery_cancellations
      where user_id=operation.actor_auth_id and operation_key=operation.operation_id) then
      update public.kafarm_recovery_operations set status='cancelled',error_code='VERIFIED_NOT_COMMITTED',
        error_source='database',error_message_safe='The message was verified as not sent.',next_retry_at=null
        where operation_id=p_operation_id;
      perform public.kafarm_recovery_record_audit(p_operation_id,'reconcile',old_status,'cancelled',
        'Authoritative cancellation record verified that the message was not committed.',true,
        jsonb_build_object('source','support_delivery_cancellations'));
      return jsonb_build_object('state','cancelled','verified',true);
    end if;
  end if;
  update public.kafarm_recovery_operations set status='manual_review',next_retry_at=null where operation_id=p_operation_id;
  perform public.kafarm_recovery_record_audit(p_operation_id,'reconcile',old_status,'manual_review',
    'No authoritative committed result was found.',true);
  insert into public.kafarm_recovery_incidents(incident_key,workflow,route,error_code,severity,first_seen_at,last_seen_at,
    occurrence_count,operation_ids,summary_safe)
  values(operation.workflow||'|'||coalesce(operation.error_code,'UNRESOLVED')||'|'||coalesce(operation.route,'unknown'),
    operation.workflow,operation.route,coalesce(operation.error_code,'UNRESOLVED'),
    case when operation.workflow in ('payment','withdrawal','rooster_sale','ownership_transfer','kyc') then 'critical' else 'warning' end,
    now(),now(),1,array[operation.operation_id],'No authoritative committed result was found during reconciliation.')
  on conflict(incident_key) do update set last_seen_at=now(),
    occurrence_count=kafarm_recovery_incidents.occurrence_count+1,
    operation_ids=(select array(select distinct unnest(kafarm_recovery_incidents.operation_ids||excluded.operation_ids))),
    summary_safe=excluded.summary_safe,status='open';
  return jsonb_build_object('state','manual_review','verified',true);
end $$;

create or replace function public.kafarm_recovery_admin_action(p_operation_id uuid,p_action text,p_reason text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare operation public.kafarm_recovery_operations%rowtype; next_status text;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if nullif(btrim(p_reason),'') is null then raise exception 'RECOVERY_REASON_REQUIRED'; end if;
  select * into operation from public.kafarm_recovery_operations where operation_id=p_operation_id for update;
  if not found then raise exception 'RECOVERY_OPERATION_NOT_FOUND'; end if;
  next_status:=case p_action when 'manual_review' then 'manual_review' when 'dead_letter' then 'dead_letter'
    when 'resolve' then 'resolved' when 'cancel' then 'cancelled' else null end;
  if next_status is null then raise exception 'RECOVERY_ACTION_NOT_ALLOWED'; end if;
  update public.kafarm_recovery_operations set status=next_status where operation_id=p_operation_id;
  perform public.kafarm_recovery_record_audit(p_operation_id,p_action,operation.status,next_status,left(p_reason,500),true);
  if next_status in ('manual_review','dead_letter') then
    insert into public.kafarm_recovery_incidents(incident_key,workflow,route,error_code,severity,first_seen_at,last_seen_at,
      occurrence_count,operation_ids,summary_safe)
    values(operation.workflow||'|'||coalesce(operation.error_code,'UNRESOLVED')||'|'||coalesce(operation.route,'unknown'),
      operation.workflow,operation.route,coalesce(operation.error_code,'UNRESOLVED'),
      case when operation.workflow in ('payment','withdrawal','rooster_sale','ownership_transfer','kyc') then 'critical' else 'warning' end,
      now(),now(),1,array[operation.operation_id],left(p_reason,500))
    on conflict(incident_key) do update set last_seen_at=now(),
      occurrence_count=kafarm_recovery_incidents.occurrence_count+1,
      operation_ids=(select array(select distinct unnest(kafarm_recovery_incidents.operation_ids||excluded.operation_ids))),
      summary_safe=excluded.summary_safe,status='open';
  end if;
  return jsonb_build_object('operation_id',p_operation_id,'status',next_status,'verified',true);
end $$;

revoke all on function public.kafarm_recovery_begin(uuid,uuid,text,text,text,text,uuid,text) from public,anon;
revoke all on function public.kafarm_recovery_mark_sending(uuid) from public,anon;
revoke all on function public.kafarm_recovery_mark_error(uuid,boolean,text,text,text,uuid) from public,anon;
revoke all on function public.kafarm_recovery_reconcile(uuid) from public,anon;
revoke all on function public.kafarm_recovery_admin_action(uuid,text,text) from public,anon,authenticated;
grant execute on function public.kafarm_recovery_begin(uuid,uuid,text,text,text,text,uuid,text) to authenticated;
grant execute on function public.kafarm_recovery_mark_sending(uuid) to authenticated;
grant execute on function public.kafarm_recovery_mark_error(uuid,boolean,text,text,text,uuid) to authenticated;
grant execute on function public.kafarm_recovery_reconcile(uuid) to authenticated;
grant execute on function public.kafarm_recovery_admin_action(uuid,text,text) to authenticated;

-- Tables remain append-only/guarded through SECURITY DEFINER functions.
revoke all on function public.kafarm_recovery_enforce_transition() from public,anon,authenticated;
revoke all on function public.kafarm_recovery_transition_allowed(text,text) from public,anon;
grant execute on function public.kafarm_recovery_transition_allowed(text,text) to authenticated;

commit;

select jsonb_build_object(
  'migration','094_kafarm_recovery_guard_mvp',
  'operation_ledger',to_regclass('public.kafarm_recovery_operations') is not null,
  'unique_operation_id',true,
  'strict_transition_guard',to_regprocedure('public.kafarm_recovery_enforce_transition()') is not null,
  'reconciliation_rpc',to_regprocedure('public.kafarm_recovery_reconcile(uuid)') is not null,
  'dead_letter_queue',to_regclass('public.kafarm_recovery_incidents') is not null,
  'business_records_changed',false
) as verification;
