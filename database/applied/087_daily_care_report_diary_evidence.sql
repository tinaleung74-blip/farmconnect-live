-- FarmConnect daily care report diary evidence.
-- Keeps the existing task/proof workflow and exposes every approved proof image
-- so one reviewed daily report can render multiple timed diary entries.

begin;

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
    'images',coalesce(to_jsonb(proof.proof_file_urls),'[]'::jsonb),
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

revoke all on function public.customer_get_rooster_diary(uuid) from public,anon;
grant execute on function public.customer_get_rooster_diary(uuid) to authenticated;

commit;

select jsonb_build_object(
  'verification',jsonb_build_object(
    'migration','087_daily_care_report_diary_evidence',
    'diary_rpc',to_regprocedure('public.customer_get_rooster_diary(uuid)') is not null,
    'business_records_changed',false,
    'anonymous_can_execute',has_function_privilege('anon','public.customer_get_rooster_diary(uuid)','EXECUTE'),
    'authenticated_can_execute',has_function_privilege('authenticated','public.customer_get_rooster_diary(uuid)','EXECUTE')
  )
) verification;
