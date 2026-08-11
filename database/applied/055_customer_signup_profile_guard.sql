-- FarmConnect customer signup/profile guard.
-- Purpose:
-- - Create the customer profile in the same database transaction as auth.users.
-- - Never trust client metadata to create an admin or caretaker role.
-- - Provide an authenticated, idempotent repair RPC for an interrupted signup.

begin;

create or replace function public.create_customer_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := lower(trim(coalesce(new.raw_user_meta_data->>'role', '')));
begin
  if v_role <> 'customer' then
    return new;
  end if;

  if exists (select 1 from public.profiles where auth_user_id = new.id) then
    return new;
  end if;

  insert into public.profiles (
    auth_user_id,
    email,
    phone,
    full_name,
    display_name,
    birthdate,
    role,
    account_status,
    verification_status,
    membership_status
  ) values (
    new.id,
    lower(trim(coalesce(new.email, ''))),
    nullif(trim(coalesce(new.raw_user_meta_data->>'phone', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data->>'full_name', '')), ''),
    coalesce(
      nullif(trim(coalesce(new.raw_user_meta_data->>'display_name', '')), ''),
      nullif(trim(coalesce(new.raw_user_meta_data->>'full_name', '')), ''),
      lower(trim(coalesce(new.email, '')))
    ),
    case
      when coalesce(new.raw_user_meta_data->>'birthdate', '') ~ '^\d{4}-\d{2}-\d{2}$'
        then (new.raw_user_meta_data->>'birthdate')::date
      else null
    end,
    'customer',
    'active',
    'pending',
    'inactive'
  );

  return new;
exception
  when unique_violation then
    return new;
end;
$$;

drop trigger if exists trg_create_customer_profile_after_auth_signup on auth.users;
create trigger trg_create_customer_profile_after_auth_signup
after insert on auth.users
for each row execute function public.create_customer_profile_for_auth_user();

create or replace function public.customer_ensure_signup_profile()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user auth.users%rowtype;
  v_profile public.profiles%rowtype;
begin
  if auth.uid() is null then
    raise exception 'LOGIN_REQUIRED';
  end if;

  select * into v_auth_user
  from auth.users
  where id = auth.uid();

  if v_auth_user.id is null then
    raise exception 'AUTH_USER_NOT_FOUND';
  end if;

  select * into v_profile
  from public.profiles
  where auth_user_id = v_auth_user.id
  limit 1;

  if v_profile.id is not null then
    if lower(coalesce(v_profile.role, '')) <> 'customer' then
      raise exception 'CUSTOMER_PROFILE_ROLE_MISMATCH';
    end if;
    return v_profile.id;
  end if;

  insert into public.profiles (
    auth_user_id,
    email,
    phone,
    full_name,
    display_name,
    birthdate,
    role,
    account_status,
    verification_status,
    membership_status
  ) values (
    v_auth_user.id,
    lower(trim(coalesce(v_auth_user.email, ''))),
    nullif(trim(coalesce(v_auth_user.raw_user_meta_data->>'phone', '')), ''),
    nullif(trim(coalesce(v_auth_user.raw_user_meta_data->>'full_name', '')), ''),
    coalesce(
      nullif(trim(coalesce(v_auth_user.raw_user_meta_data->>'display_name', '')), ''),
      nullif(trim(coalesce(v_auth_user.raw_user_meta_data->>'full_name', '')), ''),
      lower(trim(coalesce(v_auth_user.email, '')))
    ),
    case
      when coalesce(v_auth_user.raw_user_meta_data->>'birthdate', '') ~ '^\d{4}-\d{2}-\d{2}$'
        then (v_auth_user.raw_user_meta_data->>'birthdate')::date
      else null
    end,
    'customer',
    'active',
    'pending',
    'inactive'
  )
  returning * into v_profile;

  return v_profile.id;
exception
  when unique_violation then
    select * into v_profile
    from public.profiles
    where auth_user_id = auth.uid()
    limit 1;
    if v_profile.id is null or lower(coalesce(v_profile.role, '')) <> 'customer' then
      raise exception 'CUSTOMER_PROFILE_ROLE_MISMATCH';
    end if;
    return v_profile.id;
end;
$$;

revoke all on function public.create_customer_profile_for_auth_user() from public, anon, authenticated;
revoke all on function public.customer_ensure_signup_profile() from public, anon;
grant execute on function public.customer_ensure_signup_profile() to authenticated;

create or replace function public.customer_signup_profile_guard_version()
returns text
language sql
stable
as $$ select '055_customer_signup_profile_guard_v1'::text $$;

grant execute on function public.customer_signup_profile_guard_version() to authenticated;

commit;

select jsonb_build_object(
  'migration', public.customer_signup_profile_guard_version(),
  'signup_trigger', exists (
    select 1 from pg_trigger
    where tgname = 'trg_create_customer_profile_after_auth_signup'
      and not tgisinternal
  ),
  'ensure_rpc', exists (
    select 1 from information_schema.routines
    where routine_schema = 'public'
      and routine_name = 'customer_ensure_signup_profile'
  )
) as verification;
