-- FarmConnect workflow chain guard V2
-- SAFE TO RUN after 009 and 025.
--
-- Scope:
-- - Adds durable workflow state and append-only step events.
-- - Adds idempotent customer submission and admin review wrappers.
-- - Adds an admin-only reconciliation reader for real business inconsistencies.
-- - Does not move money, change ownership, or auto-approve any request.

begin;

create table if not exists public.workflow_operation_keys (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  workflow_type text not null,
  idempotency_key text not null,
  source_record_id uuid,
  created_at timestamptz not null default now(),
  primary key (profile_id, workflow_type, idempotency_key)
);

create table if not exists public.workflow_chain_runs (
  id uuid primary key default gen_random_uuid(),
  workflow_type text not null,
  source_table text not null,
  source_record_id uuid not null,
  subject_profile_id uuid not null references public.profiles(id) on delete cascade,
  current_status text not null,
  last_successful_step text not null,
  error_code text,
  retry_allowed boolean not null default false,
  needs_admin boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (workflow_type, source_record_id)
);

create table if not exists public.workflow_chain_events (
  id uuid primary key default gen_random_uuid(),
  workflow_run_id uuid not null references public.workflow_chain_runs(id) on delete cascade,
  event_key text not null,
  step text not null,
  status text not null,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (workflow_run_id, event_key)
);

create index if not exists idx_workflow_chain_runs_subject
  on public.workflow_chain_runs(subject_profile_id, updated_at desc);
create index if not exists idx_workflow_chain_runs_status
  on public.workflow_chain_runs(workflow_type, current_status, updated_at desc);
create index if not exists idx_workflow_chain_events_run
  on public.workflow_chain_events(workflow_run_id, created_at desc);

alter table public.workflow_operation_keys enable row level security;
alter table public.workflow_chain_runs enable row level security;
alter table public.workflow_chain_events enable row level security;

drop policy if exists "workflow operation owner read" on public.workflow_operation_keys;
create policy "workflow operation owner read" on public.workflow_operation_keys
for select to authenticated
using (profile_id = public.current_profile_id() or public.is_admin());

drop policy if exists "workflow runs linked read" on public.workflow_chain_runs;
create policy "workflow runs linked read" on public.workflow_chain_runs
for select to authenticated
using (subject_profile_id = public.current_profile_id() or public.is_admin());

drop policy if exists "workflow events linked read" on public.workflow_chain_events;
create policy "workflow events linked read" on public.workflow_chain_events
for select to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.workflow_chain_runs run
    where run.id = workflow_run_id
      and run.subject_profile_id = public.current_profile_id()
  )
);

create or replace function public.track_manual_payment_workflow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run_id uuid;
  v_workflow_type text;
  v_step text;
  v_actor_id uuid;
  v_event_time timestamptz;
begin
  v_workflow_type := case
    when new.source_type = 'farm_buy' then 'farm_buy'
    when new.source_type = 'care_request' then 'care_request'
    else 'manual_payment'
  end;
  v_step := case new.status
    when 'for_review' then 'submitted_for_admin_review'
    when 'needs_info' then 'customer_correction_required'
    when 'approved' then 'admin_approved'
    when 'rejected' then 'admin_rejected'
    else 'status_' || coalesce(new.status, 'unknown')
  end;
  v_actor_id := coalesce(new.admin_reviewed_by, new.profile_id);
  v_event_time := coalesce(new.admin_reviewed_at, new.updated_at, new.created_at, now());

  insert into public.workflow_chain_runs(
    workflow_type, source_table, source_record_id, subject_profile_id,
    current_status, last_successful_step, retry_allowed, needs_admin,
    metadata, started_at, updated_at, completed_at
  ) values (
    v_workflow_type, 'manual_payment_requests', new.id, new.profile_id,
    new.status, v_step,
    new.status in ('needs_info','rejected'),
    new.status in ('for_review','needs_info'),
    jsonb_build_object(
      'source_type', new.source_type,
      'amount_expected', new.amount_expected,
      'reference_last4', right(coalesce(new.reference_number, ''), 4)
    ),
    coalesce(new.created_at, now()),
    coalesce(new.updated_at, now()),
    case when new.status in ('approved','rejected') then coalesce(new.admin_reviewed_at, now()) else null end
  )
  on conflict (workflow_type, source_record_id)
  do update set
    current_status = excluded.current_status,
    last_successful_step = excluded.last_successful_step,
    retry_allowed = excluded.retry_allowed,
    needs_admin = excluded.needs_admin,
    metadata = public.workflow_chain_runs.metadata || excluded.metadata,
    updated_at = excluded.updated_at,
    completed_at = excluded.completed_at
  returning id into v_run_id;

  insert into public.workflow_chain_events(
    workflow_run_id, event_key, step, status, actor_profile_id, details, created_at
  ) values (
    v_run_id,
    new.status || ':' || extract(epoch from v_event_time)::bigint::text,
    v_step,
    new.status,
    v_actor_id,
    jsonb_build_object('source_type', new.source_type),
    v_event_time
  )
  on conflict (workflow_run_id, event_key) do nothing;

  return new;
end;
$$;

drop trigger if exists trg_track_manual_payment_workflow on public.manual_payment_requests;
create trigger trg_track_manual_payment_workflow
after insert or update of status on public.manual_payment_requests
for each row execute function public.track_manual_payment_workflow();

revoke all on function public.track_manual_payment_workflow() from public;

-- Backfill existing requests without changing their business state.
insert into public.workflow_chain_runs(
  workflow_type, source_table, source_record_id, subject_profile_id,
  current_status, last_successful_step, retry_allowed, needs_admin,
  metadata, started_at, updated_at, completed_at
)
select
  case when request.source_type='farm_buy' then 'farm_buy'
       when request.source_type='care_request' then 'care_request'
       else 'manual_payment' end,
  'manual_payment_requests', request.id, request.profile_id, request.status,
  case request.status
    when 'for_review' then 'submitted_for_admin_review'
    when 'needs_info' then 'customer_correction_required'
    when 'approved' then 'admin_approved'
    when 'rejected' then 'admin_rejected'
    else 'status_' || coalesce(request.status, 'unknown') end,
  request.status in ('needs_info','rejected'),
  request.status in ('for_review','needs_info'),
  jsonb_build_object(
    'source_type', request.source_type,
    'amount_expected', request.amount_expected,
    'reference_last4', right(coalesce(request.reference_number, ''), 4)
  ),
  request.created_at, request.updated_at,
  case when request.status in ('approved','rejected') then request.admin_reviewed_at else null end
from public.manual_payment_requests request
on conflict (workflow_type, source_record_id) do nothing;

create or replace function public.customer_submit_manual_payment_guarded(
  p_source_type text,
  p_source_ref text,
  p_amount_expected numeric,
  p_summary jsonb,
  p_payment_method text,
  p_receiver_account text,
  p_sender_name text,
  p_reference_number text,
  p_receipt_image_url text,
  p_idempotency_key text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_payment_id uuid;
  v_existing_id uuid;
  v_inserted int;
begin
  v_profile_id := public.current_profile_id();
  if v_profile_id is null then raise exception 'LOGIN_REQUIRED'; end if;
  if coalesce(length(trim(p_idempotency_key)), 0) < 12 then
    raise exception 'INVALID_IDEMPOTENCY_KEY';
  end if;

  insert into public.workflow_operation_keys(profile_id, workflow_type, idempotency_key)
  values (v_profile_id, 'manual_payment_submit', trim(p_idempotency_key))
  on conflict do nothing;
  get diagnostics v_inserted = row_count;

  if v_inserted = 0 then
    select source_record_id into v_existing_id
    from public.workflow_operation_keys
    where profile_id = v_profile_id
      and workflow_type = 'manual_payment_submit'
      and idempotency_key = trim(p_idempotency_key);
    if v_existing_id is null then raise exception 'OPERATION_IN_PROGRESS_RETRY'; end if;
    return jsonb_build_object('id', v_existing_id, 'duplicate', true, 'status', 'for_review');
  end if;

  v_payment_id := public.customer_submit_manual_payment(
    p_source_type, p_source_ref, p_amount_expected, p_summary, p_payment_method,
    p_receiver_account, p_sender_name, p_reference_number, p_receipt_image_url
  );

  update public.workflow_operation_keys
  set source_record_id = v_payment_id
  where profile_id = v_profile_id
    and workflow_type = 'manual_payment_submit'
    and idempotency_key = trim(p_idempotency_key);

  return jsonb_build_object('id', v_payment_id, 'duplicate', false, 'status', 'for_review');
end;
$$;

create or replace function public.admin_review_manual_payment_guarded(
  p_payment_request_id uuid,
  p_decision text,
  p_admin_note text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_result uuid;
  v_run_id uuid;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if p_decision not in ('approved','rejected','needs_info') then
    raise exception 'INVALID_DECISION';
  end if;

  select status into v_status
  from public.manual_payment_requests
  where id = p_payment_request_id
  for update;
  if not found then raise exception 'PAYMENT_NOT_FOUND'; end if;

  if v_status = p_decision then
    select id into v_run_id from public.workflow_chain_runs
    where source_table='manual_payment_requests' and source_record_id=p_payment_request_id;
    return jsonb_build_object('id', p_payment_request_id, 'duplicate', true, 'status', v_status, 'workflow_id', v_run_id);
  end if;
  if v_status not in ('for_review','needs_info') then
    raise exception 'PAYMENT_ALREADY_REVIEWED';
  end if;

  v_result := public.admin_review_manual_payment(p_payment_request_id, p_decision, p_admin_note);
  select id into v_run_id from public.workflow_chain_runs
  where source_table='manual_payment_requests' and source_record_id=p_payment_request_id;
  return jsonb_build_object('id', v_result, 'duplicate', false, 'status', p_decision, 'workflow_id', v_run_id);
end;
$$;

create or replace function public.kafarm_workflow_chain_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_findings jsonb;
  v_counts jsonb;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;

  with findings as (
    select
      'farm_buy_approved_without_result'::text as finding_code,
      'high'::text as severity,
      request.id as source_record_id,
      request.profile_id,
      'Approved Farm Buy has no linked rooster, inventory item, or posting evidence.'::text as message
    from public.manual_payment_requests request
    where request.source_type='farm_buy' and request.status='approved'
      and not exists (
        select 1 from public.payment_evidence_logs evidence
        where evidence.payment_request_id=request.id and evidence.event_type='farm_buy_posted'
      )
      and not exists (
        select 1 from public.customer_animals animal
        where animal.profile_id=request.profile_id
          and animal.ownership_metadata->>'payment_request_id'=request.id::text
      )
      and not exists (
        select 1 from public.customer_inventory_items item
        where item.profile_id=request.profile_id
          and item.inventory_metadata->>'payment_request_id'=request.id::text
      )
    union all
    select
      'payment_decision_without_notification', 'medium', request.id, request.profile_id,
      'Payment decision has no matching customer inbox notification.'
    from public.manual_payment_requests request
    where request.status in ('approved','rejected','needs_info')
      and request.admin_reviewed_at is not null
      and not exists (
        select 1 from public.inbox_items inbox
        where inbox.profile_id=request.profile_id
          and inbox.created_at >= request.admin_reviewed_at - interval '5 seconds'
          and (
            (request.status='approved' and inbox.title in ('Farm Buy Approved','Care Request Approved','Payment Approved'))
            or (request.status='rejected' and inbox.title='Payment Rejected')
            or (request.status='needs_info' and inbox.title='Payment Needs More Info')
          )
      )
    union all
    select
      'payment_stuck_for_review', 'medium', request.id, request.profile_id,
      'Payment has remained in the admin queue for more than 24 hours.'
    from public.manual_payment_requests request
    where request.status='for_review' and request.created_at < now() - interval '24 hours'
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'finding_code', finding_code,
    'severity', severity,
    'source_record_id', source_record_id,
    'profile_id', profile_id,
    'message', message
  ) order by severity, finding_code), '[]'::jsonb)
  into v_findings
  from findings;

  select coalesce(jsonb_object_agg(current_status, row_count), '{}'::jsonb)
  into v_counts
  from (
    select current_status, count(*)::int as row_count
    from public.workflow_chain_runs
    group by current_status
  ) status_counts;

  return jsonb_build_object(
    'generated_at', now(),
    'mode', 'read_only_business_reconciliation',
    'counts_by_status', v_counts,
    'findings', v_findings,
    'finding_count', jsonb_array_length(v_findings)
  );
end;
$$;

revoke all on function public.customer_submit_manual_payment_guarded(text,text,numeric,jsonb,text,text,text,text,text,text) from public;
grant execute on function public.customer_submit_manual_payment_guarded(text,text,numeric,jsonb,text,text,text,text,text,text) to authenticated;
revoke all on function public.admin_review_manual_payment_guarded(uuid,text,text) from public;
grant execute on function public.admin_review_manual_payment_guarded(uuid,text,text) to authenticated;
revoke all on function public.kafarm_workflow_chain_snapshot() from public;
grant execute on function public.kafarm_workflow_chain_snapshot() to authenticated;

commit;

select 'workflow_chain_guard_ready' as check_name, count(*) as count
from information_schema.routines
where routine_schema='public'
  and routine_name in (
    'customer_submit_manual_payment_guarded',
    'admin_review_manual_payment_guarded',
    'kafarm_workflow_chain_snapshot'
  );
