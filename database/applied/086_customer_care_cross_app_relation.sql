-- Durable Customer -> Admin -> Caretaker -> Customer Diary relation.
-- Repairs task-to-rooster identity without changing payment, assignment, or proof decisions.

begin;

-- caretaker_tasks.animal_id is a legacy FK to public.animals(id). Customer
-- workflows use public.customer_animals(id), so keep the two identities in
-- separate columns instead of copying an incompatible UUID into animal_id.
alter table public.caretaker_tasks
  add column if not exists customer_animal_id uuid
  references public.customer_animals(id) on delete set null;

create index if not exists idx_caretaker_tasks_customer_animal_id
  on public.caretaker_tasks(customer_animal_id);

create or replace function public.sync_caretaker_task_animal_identity()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if new.customer_animal_id is null and new.care_request_id is not null then
    select request.customer_animal_id into new.customer_animal_id
    from public.farm_care_requests request
    where request.id=new.care_request_id;
  end if;
  if new.customer_animal_id is null and new.daily_mission_id is not null then
    select mission.customer_animal_id into new.customer_animal_id
    from public.rooster_daily_missions mission
    where mission.id=new.daily_mission_id;
  end if;
  if new.customer_animal_id is null and new.care_plan_id is not null then
    select plan.customer_animal_id into new.customer_animal_id
    from public.rooster_care_plans plan
    where plan.id=new.care_plan_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_caretaker_task_animal_identity on public.caretaker_tasks;
create trigger trg_sync_caretaker_task_animal_identity
before insert or update of care_request_id,daily_mission_id,care_plan_id,customer_animal_id
on public.caretaker_tasks
for each row execute function public.sync_caretaker_task_animal_identity();

update public.caretaker_tasks task
set customer_animal_id=coalesce(request.customer_animal_id,mission.customer_animal_id,plan.customer_animal_id),
    updated_at=now()
from (select task_row.id from public.caretaker_tasks task_row where task_row.customer_animal_id is null) missing
left join public.farm_care_requests request on request.id=(select care_request_id from public.caretaker_tasks where id=missing.id)
left join public.rooster_daily_missions mission on mission.id=(select daily_mission_id from public.caretaker_tasks where id=missing.id)
left join public.rooster_care_plans plan on plan.id=(select care_plan_id from public.caretaker_tasks where id=missing.id)
where task.id=missing.id
  and coalesce(request.customer_animal_id,mission.customer_animal_id,plan.customer_animal_id) is not null;

create or replace function public.customer_get_rooster_diary(p_customer_animal_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_profile_id uuid;
  v_result jsonb;
begin
  select id into v_profile_id from public.profiles where auth_user_id=auth.uid() limit 1;
  if v_profile_id is null then raise exception 'LOGIN_REQUIRED'; end if;
  if not exists(
    select 1 from public.customer_animals animal
    where animal.id=p_customer_animal_id and animal.profile_id=v_profile_id
  ) then raise exception 'ROOSTER_NOT_OWNED'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',proof.id,
    'customer_animal_id',task.customer_animal_id,
    'title',coalesce(nullif(task.task_type,''),'Care Update'),
    'detail',coalesce(nullif(proof.free_note,''),nullif(proof.preset_note,''),'Care documentation completed.'),
    'status','Verified',
    'created_at',coalesce(proof.captured_at,proof.created_at),
    'proof_type',proof.proof_type,
    'image',coalesce(proof.proof_file_urls[1],proof.thumbnail_url,proof.proof_url),
    'workflow_type',task.workflow_type,
    'care_request_id',task.care_request_id,
    'care_plan_id',task.care_plan_id,
    'daily_mission_id',task.daily_mission_id
  ) order by coalesce(proof.captured_at,proof.created_at) desc),'[]'::jsonb)
  into v_result
  from public.task_proofs proof
  join public.caretaker_tasks task on task.id=coalesce(proof.caretaker_task_id,proof.task_id)
  where task.profile_id=v_profile_id
    and task.customer_animal_id=p_customer_animal_id
    and proof.admin_review_status='approved';

  return v_result;
end;
$$;

revoke all on function public.sync_caretaker_task_animal_identity() from public,anon,authenticated;
revoke all on function public.customer_get_rooster_diary(uuid) from public,anon;
grant execute on function public.customer_get_rooster_diary(uuid) to authenticated;

commit;

select jsonb_build_object(
  'verification',jsonb_build_object(
    'migration','086_customer_care_cross_app_relation',
    'identity_trigger',exists(select 1 from pg_trigger where tgname='trg_sync_caretaker_task_animal_identity' and not tgisinternal),
    'diary_rpc',to_regprocedure('public.customer_get_rooster_diary(uuid)') is not null,
    'legacy_animal_fk_preserved',true,
    'unlinked_tasks_remaining',(select count(*) from public.caretaker_tasks task where task.customer_animal_id is null and (task.care_request_id is not null or task.daily_mission_id is not null or task.care_plan_id is not null)),
    'business_payment_mutation',false
  )
) verification;
