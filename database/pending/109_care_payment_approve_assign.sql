-- PENDING: validate in an isolated database before applying or deploying the UI.
-- No existing payment, balance, ownership, or coverage records are backfilled.
begin;

create or replace function public.admin_approve_assign_care_payment(
  p_payment_request_id uuid, p_caretaker_id uuid default null, p_admin_note text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_payment public.manual_payment_requests%rowtype;
  v_plan public.rooster_care_plans%rowtype;
  v_request public.farm_care_requests%rowtype;
  v_task_id uuid;
  v_assignment jsonb;
  v_caretaker_id uuid := p_caretaker_id;
  v_animal_id uuid;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;

  select * into v_payment from public.manual_payment_requests
    where id=p_payment_request_id for update;
  if not found then raise exception 'PAYMENT_NOT_FOUND'; end if;
  if v_payment.source_type not in ('care_plan','care_request') then
    raise exception 'CARE_PAYMENT_REQUIRED';
  end if;
  if v_payment.status not in ('for_review','needs_info','approved') then
    raise exception 'PAYMENT_NOT_READY_FOR_ASSIGNMENT';
  end if;

  -- Verify the durable relation, not the client-supplied summary.
  if v_payment.source_type='care_plan' then
    select * into v_plan from public.rooster_care_plans
      where id::text=v_payment.source_ref and profile_id=v_payment.profile_id
        and payment_request_id=v_payment.id for update;
    if not found then raise exception 'CARE_PLAN_PAYMENT_LINK_MISMATCH'; end if;
    v_animal_id := v_plan.customer_animal_id;
    v_caretaker_id := coalesce(v_caretaker_id,v_plan.assigned_caretaker_id);
    if v_plan.assigned_caretaker_id is not null and v_plan.assigned_caretaker_id<>v_caretaker_id then
      raise exception 'CARE_PLAN_ALREADY_ASSIGNED';
    end if;
  else
    select * into v_request from public.farm_care_requests
      where id::text=v_payment.source_ref and profile_id=v_payment.profile_id
        and payment_request_id=v_payment.id for update;
    if not found then raise exception 'CARE_REQUEST_PAYMENT_LINK_MISMATCH'; end if;
    v_animal_id := v_request.customer_animal_id;
    v_caretaker_id := coalesce(v_caretaker_id,v_request.assigned_caretaker_id);
    if v_request.assigned_caretaker_id is not null and v_request.assigned_caretaker_id<>v_caretaker_id then
      raise exception 'CARE_REQUEST_ALREADY_ASSIGNED';
    end if;
  end if;

  if v_caretaker_id is null then
    -- Reuse the caretaker selected during order approval, never an arbitrary worker.
    select assigned_caretaker_id into v_caretaker_id from public.farm_care_requests
      where customer_animal_id=v_animal_id and profile_id=v_payment.profile_id
        and service_category='system_qr_tagging' and status not in ('cancelled','rejected')
        and assigned_caretaker_id is not null
      order by created_at desc limit 1;
  end if;
  if v_caretaker_id is null or not exists (
    select 1 from public.caretakers where id=v_caretaker_id
      and coalesce(status,'active') in ('active','approved','on_duty')
  ) then raise exception 'ACTIVE_CARETAKER_REQUIRED'; end if;

  perform public.admin_review_manual_payment_guarded(v_payment.id,'approved',p_admin_note);
  -- Existing functions enforce exact payment, inventory, ownership and catalog
  -- requirements. An exception rolls approval and assignment back together.
  if v_payment.source_type='care_plan' then
    v_assignment := public.admin_assign_care_plan(v_plan.id,v_caretaker_id,p_admin_note);
  else
    v_task_id := public.admin_assign_care_request(v_request.id,v_caretaker_id,p_admin_note);
    v_assignment := jsonb_build_object('task_id',v_task_id);
  end if;
  return jsonb_build_object('id',v_payment.id,'status','approved_and_assigned',
    'assignment',v_assignment,'caretaker_id',v_caretaker_id);
end;
$$;

revoke all on function public.admin_approve_assign_care_payment(uuid,uuid,text) from public,anon;
grant execute on function public.admin_approve_assign_care_payment(uuid,uuid,text) to authenticated,service_role;
commit;
