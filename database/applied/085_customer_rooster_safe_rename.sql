-- 085_customer_rooster_safe_rename.sql
-- Allows an authenticated owner to rename only their own active rooster.
-- QR identity, ownership, care, payment, and sale fields are never changed.

create or replace function public.rename_customer_rooster(
  p_customer_animal_id uuid,
  p_animal_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile_id uuid;
  v_name text;
  v_animal public.customer_animals%rowtype;
begin
  if auth.uid() is null then
    raise exception 'LOGIN_REQUIRED';
  end if;

  v_profile_id := public.current_profile_id();
  if v_profile_id is null then
    raise exception 'PROFILE_NOT_FOUND';
  end if;

  v_name := trim(regexp_replace(coalesce(p_animal_name, ''), '\s+', ' ', 'g'));
  if char_length(v_name) < 2 or char_length(v_name) > 40 then
    raise exception 'ROOSTER_NAME_INVALID';
  end if;

  update public.customer_animals
  set animal_name = v_name,
      updated_at = now()
  where id = p_customer_animal_id
    and profile_id = v_profile_id
    and coalesce(status, 'active') <> 'sold'
  returning * into v_animal;

  if v_animal.id is null then
    raise exception 'CUSTOMER_ROOSTER_NOT_FOUND';
  end if;

  return jsonb_build_object(
    'id', v_animal.id,
    'animal_name', v_animal.animal_name
  );
end;
$$;

revoke all on function public.rename_customer_rooster(uuid, text) from public;
revoke all on function public.rename_customer_rooster(uuid, text) from anon;
grant execute on function public.rename_customer_rooster(uuid, text) to authenticated;

comment on function public.rename_customer_rooster(uuid, text) is
  'Safely renames the authenticated customer owner''s active rooster without changing business identity or workflow fields.';

select jsonb_build_object(
  'verification', jsonb_build_object(
    'migration', '085_customer_rooster_safe_rename',
    'rename_rpc', to_regprocedure('public.rename_customer_rooster(uuid,text)') is not null,
    'anonymous_can_execute', has_function_privilege('anon', 'public.rename_customer_rooster(uuid,text)', 'execute'),
    'authenticated_can_execute', has_function_privilege('authenticated', 'public.rename_customer_rooster(uuid,text)', 'execute'),
    'business_records_changed', false
  )
) as verification;
