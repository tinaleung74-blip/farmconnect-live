-- FarmConnect care task assignment FK fix
-- Run after 011_care_task_safe_backend.sql.
-- Purpose: customer care requests store customer_animals.id, while caretaker_tasks.animal_id
-- references the legacy animals table. Do not copy the customer_animals id into that FK.

create or replace function public.admin_assign_care_request(
  p_care_request_id uuid,
  p_caretaker_id uuid default null,
  p_admin_note text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid;
  v_request public.farm_care_requests%rowtype;
  v_caretaker_id uuid;
  v_task_id uuid;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;

  select id into v_admin_id
  from public.profiles
  where auth_user_id = auth.uid()
  limit 1;

  select * into v_request
  from public.farm_care_requests
  where id = p_care_request_id
  for update;

  if not found then raise exception 'CARE_REQUEST_NOT_FOUND'; end if;

  if v_request.status not in ('paid_pending_assignment', 'assigned', 'proof_submitted') then
    raise exception 'CARE_REQUEST_NOT_READY_FOR_ASSIGNMENT';
  end if;

  if p_caretaker_id is null then
    select id into v_caretaker_id
    from public.caretakers
    where coalesce(status,'active') in ('active','approved','on_duty')
    order by created_at asc
    limit 1;
  else
    select id into v_caretaker_id
    from public.caretakers
    where id = p_caretaker_id
      and coalesce(status,'active') in ('active','approved','on_duty');
  end if;

  if v_caretaker_id is null then raise exception 'NO_ACTIVE_CARETAKER'; end if;

  insert into public.caretaker_tasks(
    care_request_id,
    profile_id,
    caretaker_id,
    assigned_by_profile_id,
    animal_id,
    rooster_name,
    rooster_tag,
    task_type,
    customer_note,
    admin_note,
    required_proof,
    status,
    priority,
    due_at
  ) values (
    v_request.id,
    v_request.profile_id,
    v_caretaker_id,
    v_admin_id,
    null,
    v_request.rooster_name,
    v_request.rooster_tag,
    v_request.service_name,
    v_request.customer_note,
    p_admin_note,
    v_request.required_proof,
    'active',
    case when v_request.service_name ilike '%vet%' or v_request.service_name ilike '%health%' then 'urgent' else 'normal' end,
    now() + interval '1 day'
  ) returning id into v_task_id;

  update public.farm_care_requests
  set assigned_caretaker_id = v_caretaker_id,
      assigned_task_id = v_task_id,
      admin_note = p_admin_note,
      status = 'assigned',
      updated_at = now()
  where id = v_request.id;

  insert into public.inbox_items(profile_id, category, title, body, created_at)
  values (
    v_request.profile_id,
    'care',
    'Care Request Assigned',
    'Admin assigned your care request to the farm team. You will see the update after proof review.',
    now()
  );

  return v_task_id;
end;
$$;

grant execute on function public.admin_assign_care_request(uuid,uuid,text) to authenticated;

select
  'care_task_assignment_customer_animal_fk_fix_ready' as check_name,
  count(*) as count
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'admin_assign_care_request';
