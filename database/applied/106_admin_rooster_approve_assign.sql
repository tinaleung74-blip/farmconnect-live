-- One safe Admin action: approve a rooster order and assign its generated QR task.
begin;

create or replace function public.admin_approve_assign_rooster_order(
  p_payment_request_id uuid,
  p_caretaker_id uuid,
  p_admin_note text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.manual_payment_requests%rowtype;
  v_request record;
  v_task_id uuid;
  v_task_ids jsonb := '[]'::jsonb;
  v_assignment_count integer := 0;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if p_caretaker_id is null then raise exception 'CARETAKER_REQUIRED'; end if;
  if not exists (
    select 1 from public.caretakers
    where id = p_caretaker_id and coalesce(status,'active') in ('active','approved','on_duty')
  ) then raise exception 'ACTIVE_CARETAKER_REQUIRED'; end if;

  select * into v_payment
  from public.manual_payment_requests
  where id = p_payment_request_id
  for update;
  if not found then raise exception 'PAYMENT_NOT_FOUND'; end if;
  if v_payment.source_type <> 'farm_buy' then raise exception 'ROOSTER_ORDER_REQUIRED'; end if;

  if v_payment.status in ('for_review','needs_info') then
    perform public.admin_review_manual_payment_guarded(
      p_payment_request_id,
      'approved',
      coalesce(nullif(trim(p_admin_note),''),'Payment approved and rooster assigned by Admin.')
    );
  elsif v_payment.status <> 'approved' then
    raise exception 'PAYMENT_NOT_READY_FOR_ASSIGNMENT';
  end if;

  for v_request in
    select request.id
    from public.farm_care_requests request
    where request.payment_request_id = p_payment_request_id
      and request.service_category = 'system_qr_tagging'
      and request.status in ('paid_pending_assignment','assigned')
    order by request.created_at asc
    for update
  loop
    v_task_id := public.admin_assign_care_request(
      v_request.id,
      p_caretaker_id,
      coalesce(nullif(trim(p_admin_note),''),'Attach and verify the system-generated rooster QR.')
    );
    v_task_ids := v_task_ids || jsonb_build_array(v_task_id);
    v_assignment_count := v_assignment_count + 1;
  end loop;

  if v_assignment_count = 0 then
    raise exception 'ROOSTER_ASSIGNMENT_REQUEST_NOT_CREATED';
  end if;

  return jsonb_build_object(
    'payment_request_id', p_payment_request_id,
    'status', 'approved_and_assigned',
    'caretaker_id', p_caretaker_id,
    'assignment_count', v_assignment_count,
    'task_ids', v_task_ids
  );
end;
$$;

revoke all on function public.admin_approve_assign_rooster_order(uuid,uuid,text) from public, anon;
grant execute on function public.admin_approve_assign_rooster_order(uuid,uuid,text) to authenticated, service_role;

commit;

select jsonb_build_object('verification',jsonb_build_object(
  'migration','106_admin_rooster_approve_assign',
  'approve_assign_rpc',to_regprocedure('public.admin_approve_assign_rooster_order(uuid,uuid,text)') is not null,
  'business_records_changed',false
));
