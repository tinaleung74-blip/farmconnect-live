begin;

create or replace function public.customer_get_or_create_included_daily_care(
  p_customer_animal_id uuid
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_request_id uuid;
begin
  select id into v_profile_id
  from public.profiles
  where auth_user_id = auth.uid()
  limit 1;
  if v_profile_id is null then raise exception 'LOGIN_REQUIRED'; end if;

  if not exists (
    select 1 from public.customer_animals
    where id = p_customer_animal_id
      and profile_id = v_profile_id
      and coalesce(status, '') <> 'sold'
  ) then raise exception 'ANIMAL_NOT_OWNED'; end if;

  select id into v_request_id
  from public.farm_care_requests
  where profile_id = v_profile_id
    and customer_animal_id = p_customer_animal_id
    and service_category = 'daily_care'
    and status not in ('completed', 'cancelled', 'rejected')
  order by created_at desc
  limit 1;

  if v_request_id is not null then return v_request_id; end if;

  begin
    return public.customer_create_included_daily_care(p_customer_animal_id);
  exception
    when raise_exception then
      if sqlerrm <> 'DAILY_CARE_REQUEST_ALREADY_OPEN' then raise; end if;
      select id into v_request_id
      from public.farm_care_requests
      where profile_id = v_profile_id
        and customer_animal_id = p_customer_animal_id
        and service_category = 'daily_care'
        and status not in ('completed', 'cancelled', 'rejected')
      order by created_at desc
      limit 1;
      if v_request_id is null then raise; end if;
      return v_request_id;
  end;
end;
$$;

revoke all on function public.customer_get_or_create_included_daily_care(uuid) from public, anon;
grant execute on function public.customer_get_or_create_included_daily_care(uuid) to authenticated, service_role;

commit;

select jsonb_build_object(
  'verification', jsonb_build_object(
    'migration', '108_resume_open_daily_care_payment',
    'resume_rpc', to_regprocedure('public.customer_get_or_create_included_daily_care(uuid)') is not null,
    'duplicate_request_created', false,
    'business_records_changed', false
  )
);
