-- FarmConnect rejected-payment correction and caretaker video evidence
-- SAFE TO RUN after 033, 044, and 045.

begin;

update storage.buckets
set file_size_limit = 52428800,
    allowed_mime_types = array[
      'image/jpeg', 'image/png', 'image/webp',
      'video/mp4', 'video/webm', 'video/quicktime'
    ]::text[]
where id = 'caretaker-task-proofs';

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
  v_profile_id uuid;
  v_source_type text;
  v_reference text;
  v_notice_title text;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if p_decision not in ('approved','rejected','needs_info') then
    raise exception 'INVALID_DECISION';
  end if;

  select status, profile_id, source_type, reference_number
  into v_status, v_profile_id, v_source_type, v_reference
  from public.manual_payment_requests
  where id = p_payment_request_id
  for update;
  if not found then raise exception 'PAYMENT_NOT_FOUND'; end if;

  if v_status = p_decision then
    select id into v_run_id from public.workflow_chain_runs
    where source_table='manual_payment_requests' and source_record_id=p_payment_request_id;
    return jsonb_build_object('id',p_payment_request_id,'duplicate',true,'status',v_status,'workflow_id',v_run_id);
  end if;
  if v_status not in ('for_review','needs_info') then
    raise exception 'PAYMENT_ALREADY_REVIEWED';
  end if;

  v_result := public.admin_review_manual_payment(p_payment_request_id,p_decision,p_admin_note);

  if p_decision in ('rejected','needs_info') then
    v_notice_title := case
      when v_source_type='care_request' and p_decision='rejected' then 'Care Request Payment Rejected'
      when v_source_type='care_request' then 'Care Request Payment Needs Info'
      when v_source_type='farm_buy' and p_decision='rejected' then 'Farm Buy Payment Rejected'
      when v_source_type='farm_buy' then 'Farm Buy Payment Needs Info'
      when p_decision='rejected' then 'Payment Rejected'
      else 'Payment Needs More Info'
    end;

    update public.inbox_items
    set title = v_notice_title,
        body = rtrim(body,'.') || '. Source: ' || coalesce(v_source_type,'manual_payment') ||
          '. Payment Request: ' || p_payment_request_id::text ||
          '. Open this notice to explain and resubmit corrected evidence.'
    where id = (
      select inbox.id
      from public.inbox_items inbox
      where inbox.profile_id=v_profile_id
        and inbox.created_at>=now()-interval '2 minutes'
        and inbox.title in ('Payment Rejected','Payment Needs More Info','Payment Needs Correction')
        and inbox.body ilike '%' || coalesce(v_reference,'') || '%'
      order by inbox.created_at desc
      limit 1
    );
  end if;

  select id into v_run_id from public.workflow_chain_runs
  where source_table='manual_payment_requests' and source_record_id=p_payment_request_id;
  return jsonb_build_object('id',v_result,'duplicate',false,'status',p_decision,'workflow_id',v_run_id);
end;
$$;

-- Make already-returned demo/test notices open the correct correction page.
update public.inbox_items inbox
set title = case
      when payment.source_type='care_request' and payment.status='rejected' then 'Care Request Payment Rejected'
      when payment.source_type='care_request' then 'Care Request Payment Needs Info'
      when payment.source_type='farm_buy' and payment.status='rejected' then 'Farm Buy Payment Rejected'
      when payment.source_type='farm_buy' then 'Farm Buy Payment Needs Info'
      else inbox.title
    end,
    body = rtrim(inbox.body,'.') || '. Source: ' || payment.source_type ||
      '. Payment Request: ' || payment.id::text ||
      '. Open this notice to explain and resubmit corrected evidence.'
from public.manual_payment_requests payment
where inbox.profile_id=payment.profile_id
  and payment.status in ('rejected','needs_info')
  and inbox.title in ('Payment Rejected','Payment Needs More Info','Payment Needs Correction')
  and inbox.body ilike '%' || payment.reference_number || '%'
  and inbox.body not ilike '%Payment Request:%';

create or replace function public.payment_correction_video_evidence_version()
returns text
language sql
stable
as $$ select '046'::text $$;

revoke all on function public.admin_review_manual_payment_guarded(uuid,text,text) from public,anon;
grant execute on function public.admin_review_manual_payment_guarded(uuid,text,text) to authenticated;
revoke all on function public.payment_correction_video_evidence_version() from public,anon;
grant execute on function public.payment_correction_video_evidence_version() to authenticated;

commit;

select 'payment_correction_video_evidence_ready' as check_name,count(*) as count
from information_schema.routines
where routine_schema='public'
  and routine_name='payment_correction_video_evidence_version';
