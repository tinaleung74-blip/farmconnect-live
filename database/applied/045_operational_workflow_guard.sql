-- FarmConnect operational workflow guard V3
-- SAFE TO RUN after 044_workflow_chain_guard.sql.
--
-- Adds durable tracking for the remaining role-to-role workflows, protects
-- retry-prone financial/admin actions, and expands KaFarm reconciliation.
-- No request is approved, rejected, deleted, or paid by this migration.

begin;

create or replace function public.track_operational_workflow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb := to_jsonb(new);
  v_source_id uuid := nullif(v_row->>'id','')::uuid;
  v_profile_id uuid := nullif(v_row->>'profile_id','')::uuid;
  v_status text;
  v_workflow_type text;
  v_step text;
  v_run_id uuid;
  v_event_time timestamptz;
begin
  if v_source_id is null or v_profile_id is null then return new; end if;

  v_status := coalesce(
    nullif(v_row->>'admin_review_status',''),
    nullif(v_row->>'status',''),
    nullif(v_row->>'verification_status',''),
    'unknown'
  );
  v_workflow_type := case tg_table_name
    when 'farm_care_requests' then 'care_request_delivery'
    when 'caretaker_tasks' then 'caretaker_task'
    when 'task_proofs' then 'task_proof_review'
    when 'withdrawal_requests' then 'withdrawal'
    when 'rooster_sale_requests' then 'rooster_sale'
    when 'customer_kyc_profiles' then 'customer_kyc'
    else tg_table_name
  end;
  v_step := tg_table_name || ':' || v_status;
  v_event_time := coalesce(
    nullif(v_row->>'updated_at','')::timestamptz,
    nullif(v_row->>'reviewed_at','')::timestamptz,
    nullif(v_row->>'created_at','')::timestamptz,
    now()
  );

  insert into public.workflow_chain_runs(
    workflow_type, source_table, source_record_id, subject_profile_id,
    current_status, last_successful_step, retry_allowed, needs_admin,
    metadata, started_at, updated_at, completed_at
  ) values (
    v_workflow_type, tg_table_name, v_source_id, v_profile_id,
    v_status, v_step,
    v_status in ('needs_info','rejected','backjob','price_backjob','release_backjob'),
    v_status in ('for_review','pending','pending_approval','submitted','proof_submitted','sale_requested'),
    jsonb_build_object('table',tg_table_name),
    coalesce(nullif(v_row->>'created_at','')::timestamptz,now()),
    v_event_time,
    case when v_status in ('completed','approved','released_to_customer','rejected','cancelled') then v_event_time else null end
  )
  on conflict (workflow_type,source_record_id) do update set
    current_status=excluded.current_status,
    last_successful_step=excluded.last_successful_step,
    retry_allowed=excluded.retry_allowed,
    needs_admin=excluded.needs_admin,
    metadata=public.workflow_chain_runs.metadata||excluded.metadata,
    updated_at=excluded.updated_at,
    completed_at=excluded.completed_at
  returning id into v_run_id;

  insert into public.workflow_chain_events(
    workflow_run_id,event_key,step,status,actor_profile_id,details,created_at
  ) values (
    v_run_id,tg_table_name||':'||v_status||':'||extract(epoch from v_event_time)::bigint::text,
    v_step,v_status,public.current_profile_id(),jsonb_build_object('table',tg_table_name),v_event_time
  ) on conflict (workflow_run_id,event_key) do nothing;
  return new;
end;
$$;

revoke all on function public.track_operational_workflow() from public,anon,authenticated;

drop trigger if exists trg_track_care_request_workflow on public.farm_care_requests;
create trigger trg_track_care_request_workflow after insert or update of status on public.farm_care_requests
for each row execute function public.track_operational_workflow();
drop trigger if exists trg_track_caretaker_task_workflow on public.caretaker_tasks;
create trigger trg_track_caretaker_task_workflow after insert or update of status on public.caretaker_tasks
for each row execute function public.track_operational_workflow();
drop trigger if exists trg_track_task_proof_workflow on public.task_proofs;
create trigger trg_track_task_proof_workflow after insert or update of admin_review_status on public.task_proofs
for each row execute function public.track_operational_workflow();
drop trigger if exists trg_track_withdrawal_workflow on public.withdrawal_requests;
create trigger trg_track_withdrawal_workflow after insert or update of status on public.withdrawal_requests
for each row execute function public.track_operational_workflow();
drop trigger if exists trg_track_rooster_sale_workflow on public.rooster_sale_requests;
create trigger trg_track_rooster_sale_workflow after insert or update of status on public.rooster_sale_requests
for each row execute function public.track_operational_workflow();
drop trigger if exists trg_track_customer_kyc_workflow on public.customer_kyc_profiles;
create trigger trg_track_customer_kyc_workflow after insert or update on public.customer_kyc_profiles
for each row execute function public.track_operational_workflow();

create or replace function public.customer_submit_withdrawal_request_guarded(
  p_amount numeric,
  p_payout_method text,
  p_payout_holder text,
  p_payout_account text,
  p_customer_note text,
  p_idempotency_key text
) returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_profile_id uuid := public.current_profile_id();
  v_request_id uuid;
  v_existing_id uuid;
  v_inserted int;
begin
  if v_profile_id is null then raise exception 'LOGIN_REQUIRED'; end if;
  if coalesce(length(trim(p_idempotency_key)),0)<12 then raise exception 'INVALID_IDEMPOTENCY_KEY'; end if;
  insert into public.workflow_operation_keys(profile_id,workflow_type,idempotency_key)
  values(v_profile_id,'withdrawal_submit',trim(p_idempotency_key)) on conflict do nothing;
  get diagnostics v_inserted=row_count;
  if v_inserted=0 then
    select source_record_id into v_existing_id from public.workflow_operation_keys
    where profile_id=v_profile_id and workflow_type='withdrawal_submit' and idempotency_key=trim(p_idempotency_key);
    if v_existing_id is null then raise exception 'OPERATION_IN_PROGRESS_RETRY'; end if;
    return jsonb_build_object('id',v_existing_id,'duplicate',true,'status','for_review');
  end if;
  v_request_id:=public.customer_submit_withdrawal_request(
    p_amount,p_payout_method,p_payout_holder,p_payout_account,p_customer_note
  );
  update public.workflow_operation_keys set source_record_id=v_request_id
  where profile_id=v_profile_id and workflow_type='withdrawal_submit' and idempotency_key=trim(p_idempotency_key);
  return jsonb_build_object('id',v_request_id,'duplicate',false,'status','for_review');
end;
$$;

create or replace function public.admin_review_task_proof_guarded(
  p_proof_id uuid,p_decision text,p_admin_note text default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_status text; v_result uuid;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  select admin_review_status into v_status from public.task_proofs where id=p_proof_id for update;
  if not found then raise exception 'PROOF_NOT_FOUND'; end if;
  if v_status=p_decision then return jsonb_build_object('id',p_proof_id,'duplicate',true,'status',v_status); end if;
  if v_status<>'pending' then raise exception 'PROOF_ALREADY_REVIEWED'; end if;
  v_result:=public.admin_review_task_proof(p_proof_id,p_decision,p_admin_note);
  return jsonb_build_object('id',v_result,'duplicate',false,'status',p_decision);
end $$;

create or replace function public.admin_review_withdrawal_request_guarded(
  p_withdrawal_request_id uuid,p_decision text,p_admin_note text default null,
  p_admin_reference_number text default null,p_admin_receipt_url text default null,
  p_admin_receipt_file_name text default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_status text; v_expected text; v_result uuid;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  v_expected:=case when p_decision='approved' then 'sent_for_customer_confirmation' else p_decision end;
  select status into v_status from public.withdrawal_requests where id=p_withdrawal_request_id for update;
  if not found then raise exception 'WITHDRAWAL_NOT_FOUND'; end if;
  if v_status=v_expected then return jsonb_build_object('id',p_withdrawal_request_id,'duplicate',true,'status',v_status); end if;
  if v_status not in ('for_review','needs_info') then raise exception 'WITHDRAWAL_ALREADY_REVIEWED'; end if;
  v_result:=public.admin_review_withdrawal_request(p_withdrawal_request_id,p_decision,p_admin_note,p_admin_reference_number,p_admin_receipt_url,p_admin_receipt_file_name);
  return jsonb_build_object('id',v_result,'duplicate',false,'status',v_expected);
end $$;

create or replace function public.admin_review_rooster_sale_guarded(
  p_sale_request_id uuid,p_decision text,p_admin_note text default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_status text; v_expected text; v_result uuid;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  v_expected:=case when p_decision='approved' then 'release_pending_assignment' else 'sale_rejected' end;
  select status into v_status from public.rooster_sale_requests where id=p_sale_request_id for update;
  if not found then raise exception 'SALE_REQUEST_NOT_FOUND'; end if;
  if v_status=v_expected then return jsonb_build_object('id',p_sale_request_id,'duplicate',true,'status',v_status); end if;
  if v_status<>'sale_requested' then raise exception 'SALE_REQUEST_ALREADY_REVIEWED'; end if;
  v_result:=public.admin_review_rooster_sale(p_sale_request_id,p_decision,p_admin_note);
  return jsonb_build_object('id',v_result,'duplicate',false,'status',v_expected);
end $$;

create or replace function public.admin_review_caretaker_application_guarded(
  p_application_id uuid,p_decision text,p_note text default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_status text; v_result uuid;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  select status into v_status from public.caretaker_applications where id=p_application_id for update;
  if not found then raise exception 'CARETAKER_APPLICATION_NOT_FOUND'; end if;
  if v_status=p_decision then return jsonb_build_object('id',p_application_id,'duplicate',true,'status',v_status); end if;
  if v_status not in ('pending_approval','needs_info') then raise exception 'CARETAKER_APPLICATION_ALREADY_REVIEWED'; end if;
  v_result:=public.admin_review_caretaker_application(p_application_id,p_decision,p_note);
  return jsonb_build_object('id',v_result,'duplicate',false,'status',p_decision);
end $$;

create or replace function public.admin_review_customer_kyc_guarded(
  p_kyc_profile_id uuid,p_decision text,p_note text default null,p_risk_level text default 'low'
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_row jsonb; v_status text; v_result uuid;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  select to_jsonb(kyc) into v_row from public.customer_kyc_profiles kyc where id=p_kyc_profile_id for update;
  if v_row is null then raise exception 'KYC_PROFILE_NOT_FOUND'; end if;
  v_status:=coalesce(v_row->>'status',v_row->>'verification_status',v_row->>'review_status','pending');
  if lower(v_status)=lower(p_decision) then return jsonb_build_object('id',p_kyc_profile_id,'duplicate',true,'status',v_status); end if;
  if lower(v_status) not in ('pending','submitted','for_review','needs_info') then raise exception 'KYC_ALREADY_REVIEWED'; end if;
  v_result:=public.admin_review_customer_kyc(p_kyc_profile_id,p_decision,p_note,p_risk_level);
  return jsonb_build_object('id',v_result,'duplicate',false,'status',p_decision);
end $$;

create or replace function public.kafarm_workflow_chain_snapshot()
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_findings jsonb; v_counts jsonb;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  with findings as (
    select 'farm_buy_approved_without_result'::text finding_code,'high'::text severity,r.id source_record_id,r.profile_id,
      'Approved Farm Buy has no linked rooster, inventory item, or posting evidence.'::text message
    from public.manual_payment_requests r where r.source_type='farm_buy' and r.status='approved'
      and not exists(select 1 from public.payment_evidence_logs e where e.payment_request_id=r.id and e.event_type='farm_buy_posted')
      and not exists(select 1 from public.customer_animals a where a.profile_id=r.profile_id and a.ownership_metadata->>'payment_request_id'=r.id::text)
      and not exists(select 1 from public.customer_inventory_items i where i.profile_id=r.profile_id and i.inventory_metadata->>'payment_request_id'=r.id::text)
    union all select 'payment_stuck_for_review','medium',r.id,r.profile_id,'Payment has remained in the admin queue for more than 24 hours.'
      from public.manual_payment_requests r where r.status='for_review' and r.created_at<now()-interval '24 hours'
    union all select 'care_request_missing_assignment','high',c.id,c.profile_id,'Care request status requires an assigned task, but no task link exists.'
      from public.farm_care_requests c where c.status in ('assigned','in_progress','proof_submitted') and c.assigned_task_id is null
    union all select 'paid_care_waiting_too_long','medium',c.id,c.profile_id,'Paid care request has waited more than 24 hours for caretaker assignment.'
      from public.farm_care_requests c where c.status='paid_pending_assignment' and c.created_at<now()-interval '24 hours'
    union all select 'submitted_task_without_proof','high',t.id,t.profile_id,'Caretaker task is submitted but has no pending or reviewed proof.'
      from public.caretaker_tasks t where t.status='submitted' and not exists(select 1 from public.task_proofs p where coalesce(p.caretaker_task_id,p.task_id)=t.id)
    union all select 'approved_proof_chain_mismatch','high',p.id,t.profile_id,'Approved proof did not release the linked task and care request consistently.'
      from public.task_proofs p join public.caretaker_tasks t on t.id=coalesce(p.caretaker_task_id,p.task_id)
      left join public.farm_care_requests c on c.id=coalesce(p.care_request_id,t.care_request_id)
      where p.admin_review_status='approved'
        and (t.status<>'approved' or (c.id is not null and c.assigned_task_id=t.id and c.status<>'released_to_customer'))
    union all select 'sale_price_ready_without_evidence','high',s.id,s.profile_id,'Sale price is marked ready without an approved price and price proof.'
      from public.rooster_sale_requests s where s.status='price_ready' and (coalesce(s.approved_sale_price,0)<=0 or s.price_proof_id is null)
    union all select 'completed_sale_chain_mismatch','high',s.id,s.profile_id,'Completed rooster sale is missing wallet posting or sold ownership state.'
      from public.rooster_sale_requests s left join public.customer_animals a on a.id=s.customer_animal_id
      where s.status='completed' and (s.wallet_transaction_id is null or coalesce(a.status,'')<>'sold' or coalesce(a.sale_status,'')<>'completed')
    union all select 'withdrawal_approved_without_proof','high',w.id,w.profile_id,'Withdrawal awaits customer confirmation without admin reference or receipt.'
      from public.withdrawal_requests w where w.status='sent_for_customer_confirmation'
        and (nullif(trim(coalesce(w.admin_reference_number,'')),'') is null or nullif(trim(coalesce(w.admin_receipt_url,'')),'') is null)
    union all select 'withdrawal_rejection_not_refunded','high',w.id,w.profile_id,'Rejected withdrawal has no recorded wallet refund.'
      from public.withdrawal_requests w where w.status='rejected' and w.wallet_hold_applied and w.wallet_refunded_at is null
    union all select 'completed_withdrawal_not_confirmed','high',w.id,w.profile_id,'Completed withdrawal has no customer confirmation timestamp.'
      from public.withdrawal_requests w where w.status='completed' and w.customer_confirmed_at is null
    union all select 'approved_caretaker_not_activated','high',a.id,a.created_profile_id,'Approved caretaker application did not create both active profile and caretaker records.'
      from public.caretaker_applications a left join public.profiles p on p.id=a.created_profile_id
      left join public.caretakers c on c.id=a.created_caretaker_id
      where a.status='approved' and (p.id is null or c.id is null or lower(coalesce(p.role,''))<>'caretaker' or lower(coalesce(p.account_status,''))<>'active')
    union all select 'approved_kyc_profile_mismatch','high',k.id,k.profile_id,'Approved KYC record is not reflected in the customer profile verification state.'
      from public.customer_kyc_profiles k join public.profiles p on p.id=k.profile_id
      where lower(coalesce(to_jsonb(k)->>'status',to_jsonb(k)->>'verification_status',to_jsonb(k)->>'review_status','')) in ('approved','verified','passed')
        and lower(coalesce(p.kyc_status,p.verification_status,'')) not in ('approved','verified','passed')
  )
  select coalesce(jsonb_agg(jsonb_build_object('finding_code',finding_code,'severity',severity,'source_record_id',source_record_id,'profile_id',profile_id,'message',message) order by severity,finding_code),'[]'::jsonb)
  into v_findings from findings;
  select coalesce(jsonb_object_agg(current_status,row_count),'{}'::jsonb) into v_counts
  from (select current_status,count(*)::int row_count from public.workflow_chain_runs group by current_status) x;
  return jsonb_build_object('generated_at',now(),'mode','read_only_business_reconciliation','counts_by_status',v_counts,'findings',v_findings,'finding_count',jsonb_array_length(v_findings));
end $$;

revoke all on function public.customer_submit_withdrawal_request_guarded(numeric,text,text,text,text,text) from public,anon;
grant execute on function public.customer_submit_withdrawal_request_guarded(numeric,text,text,text,text,text) to authenticated;
revoke all on function public.admin_review_task_proof_guarded(uuid,text,text) from public,anon;
grant execute on function public.admin_review_task_proof_guarded(uuid,text,text) to authenticated;
revoke all on function public.admin_review_withdrawal_request_guarded(uuid,text,text,text,text,text) from public,anon;
grant execute on function public.admin_review_withdrawal_request_guarded(uuid,text,text,text,text,text) to authenticated;
revoke all on function public.admin_review_rooster_sale_guarded(uuid,text,text) from public,anon;
grant execute on function public.admin_review_rooster_sale_guarded(uuid,text,text) to authenticated;
revoke all on function public.admin_review_caretaker_application_guarded(uuid,text,text) from public,anon;
grant execute on function public.admin_review_caretaker_application_guarded(uuid,text,text) to authenticated;
revoke all on function public.admin_review_customer_kyc_guarded(uuid,text,text,text) from public,anon;
grant execute on function public.admin_review_customer_kyc_guarded(uuid,text,text,text) to authenticated;
revoke all on function public.kafarm_workflow_chain_snapshot() from public,anon;
grant execute on function public.kafarm_workflow_chain_snapshot() to authenticated;

commit;

select 'operational_workflow_guard_ready' check_name,count(*) count
from information_schema.routines where routine_schema='public' and routine_name in (
  'customer_submit_withdrawal_request_guarded','admin_review_task_proof_guarded',
  'admin_review_withdrawal_request_guarded','admin_review_rooster_sale_guarded',
  'admin_review_caretaker_application_guarded','admin_review_customer_kyc_guarded'
);
