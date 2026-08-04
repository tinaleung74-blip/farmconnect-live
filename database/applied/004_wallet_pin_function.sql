-- FarmConnect wallet PIN function
-- SAFE TO RUN.
-- Purpose:
-- - Adds secure wallet PIN hash columns if missing.
-- - Creates public.change_wallet_pin(p_current_pin text, p_new_pin text).
-- - Requires current PIN when a PIN hash already exists.
-- - Allows first-time PIN setup when no hash exists yet.
-- - Locks PIN changes briefly after repeated wrong attempts.

create extension if not exists pgcrypto;

alter table public.profiles
  add column if not exists wallet_pin_hash text,
  add column if not exists wallet_pin_changed_at timestamptz,
  add column if not exists wallet_pin_failed_attempts integer not null default 0,
  add column if not exists wallet_pin_locked_until timestamptz;

create or replace function public.change_wallet_pin(
  p_current_pin text,
  p_new_pin text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_now timestamptz := now();
begin
  select *
  into v_profile
  from public.profiles
  where auth_user_id = auth.uid()
  limit 1;

  if v_profile.id is null then
    raise exception 'Login required';
  end if;

  if p_new_pin is null or p_new_pin !~ '^[0-9]{6}$' then
    raise exception 'New wallet PIN must be exactly 6 digits';
  end if;

  if p_current_pin is not null and p_current_pin !~ '^[0-9]{6}$' then
    raise exception 'Current wallet PIN must be exactly 6 digits';
  end if;

  if v_profile.wallet_pin_locked_until is not null
     and v_profile.wallet_pin_locked_until > v_now then
    raise exception 'Wallet PIN is temporarily locked. Please try again later.';
  end if;

  -- First-time setup or legacy account without a hash.
  if v_profile.wallet_pin_hash is null then
    update public.profiles
    set wallet_pin_hash = crypt(p_new_pin, gen_salt('bf')),
        wallet_pin_set = true,
        wallet_pin_failed_attempts = 0,
        wallet_pin_locked_until = null,
        wallet_pin_changed_at = v_now,
        last_pin_changed_at = v_now,
        updated_at = v_now
    where id = v_profile.id;

    return true;
  end if;

  if p_current_pin is null or crypt(p_current_pin, v_profile.wallet_pin_hash) <> v_profile.wallet_pin_hash then
    update public.profiles
    set wallet_pin_failed_attempts = coalesce(wallet_pin_failed_attempts, 0) + 1,
        wallet_pin_locked_until = case
          when coalesce(wallet_pin_failed_attempts, 0) + 1 >= 5 then v_now + interval '15 minutes'
          else wallet_pin_locked_until
        end,
        updated_at = v_now
    where id = v_profile.id;

    raise exception 'Current wallet PIN is incorrect';
  end if;

  update public.profiles
  set wallet_pin_hash = crypt(p_new_pin, gen_salt('bf')),
      wallet_pin_set = true,
      wallet_pin_failed_attempts = 0,
      wallet_pin_locked_until = null,
      wallet_pin_changed_at = v_now,
      last_pin_changed_at = v_now,
      updated_at = v_now
  where id = v_profile.id;

  return true;
end;
$$;

revoke all on function public.change_wallet_pin(text, text) from public;
grant execute on function public.change_wallet_pin(text, text) to authenticated;

select
  'change_wallet_pin_ready' as check_name,
  count(*) as count
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'change_wallet_pin';
