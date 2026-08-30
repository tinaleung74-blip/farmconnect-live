begin;

create or replace function public.rooster_growth_day(p_acquired_at timestamptz)
returns integer
language sql
stable
set search_path = public
as $$
  select greatest(1, (current_date - coalesce(p_acquired_at, now())::date) + 1)
$$;

create or replace function public.guard_customer_animal_growth_day()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.acquired_at is not null and new.acquired_at > now() + interval '5 minutes' then
    raise exception 'INVALID_ACQUIRED_AT';
  end if;
  new.ownership_metadata := coalesce(new.ownership_metadata, '{}'::jsonb)
    || jsonb_build_object('growth_day', public.rooster_growth_day(new.acquired_at));
  return new;
end;
$$;

drop trigger if exists trg_guard_customer_animal_growth_day on public.customer_animals;
create trigger trg_guard_customer_animal_growth_day
before insert or update of acquired_at, ownership_metadata on public.customer_animals
for each row execute function public.guard_customer_animal_growth_day();

create or replace function public.customer_request_rooster_sale_price(
  p_customer_animal_id uuid,
  p_customer_note text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_animal public.customer_animals%rowtype;
  v_sale_id uuid;
  v_care_id uuid;
  v_growth_day integer;
begin
  select id into v_profile_id from public.profiles where auth_user_id = auth.uid() limit 1;
  if v_profile_id is null then raise exception 'LOGIN_REQUIRED'; end if;

  select * into v_animal
  from public.customer_animals
  where id = p_customer_animal_id and profile_id = v_profile_id
  for update;
  if not found then raise exception 'ROOSTER_NOT_FOUND_OR_NOT_OWNED'; end if;
  if v_animal.status in ('sold','removed') then raise exception 'ROOSTER_ALREADY_SOLD'; end if;

  v_growth_day := public.rooster_growth_day(v_animal.acquired_at);
  if v_growth_day < 91 then raise exception 'ROOSTER_NOT_READY_FOR_SALE'; end if;

  if exists (
    select 1 from public.rooster_sale_requests
    where customer_animal_id = v_animal.id and status not in ('completed','cancelled')
  ) then raise exception 'SALE_REQUEST_ALREADY_OPEN'; end if;

  insert into public.rooster_sale_requests(profile_id, customer_animal_id, customer_note)
  values (v_profile_id, v_animal.id, nullif(trim(coalesce(p_customer_note,'')),''))
  returning id into v_sale_id;

  insert into public.farm_care_requests(
    profile_id, customer_animal_id, rooster_name, rooster_tag, service_name,
    service_category, service_price, required_proof, customer_note, status
  ) values (
    v_profile_id, v_animal.id, coalesce(v_animal.animal_name,'Owned Rooster'),
    v_animal.animal_code, 'Sale Price Inspection', 'sale_price_inspection', 0,
    'Enter the inspected rooster price, upload a clear current photo, then verify the rooster QR.',
    coalesce(nullif(trim(coalesce(p_customer_note,'')),''),'Customer requested a sale price inspection.'),
    'paid_pending_assignment'
  ) returning id into v_care_id;

  update public.rooster_sale_requests set price_care_request_id = v_care_id, updated_at = now() where id = v_sale_id;
  update public.customer_animals set sale_status = 'price_requested', updated_at = now() where id = v_animal.id;

  insert into public.rooster_sale_events(sale_request_id, profile_id, event_type, details, actor_profile_id)
  values (v_sale_id, v_profile_id, 'price_requested', jsonb_build_object(
    'customer_animal_id', v_animal.id, 'care_request_id', v_care_id, 'growth_day', v_growth_day
  ), v_profile_id);

  insert into public.inbox_items(profile_id, category, title, body, created_at)
  values (v_profile_id, 'care', 'Sale Price Inspection Requested',
    'Your rooster is waiting for price inspection. The final Sell button stays locked until the submitted price is approved.', now());
  return v_sale_id;
end;
$$;

revoke all on function public.rooster_growth_day(timestamptz) from public, anon;
grant execute on function public.rooster_growth_day(timestamptz) to authenticated, service_role;
revoke all on function public.customer_request_rooster_sale_price(uuid,text) from public, anon;
grant execute on function public.customer_request_rooster_sale_price(uuid,text) to authenticated, service_role;

commit;

select jsonb_build_object(
  'verification', jsonb_build_object(
    'migration', '095_rooster_growth_stage_guard',
    'growth_day_function', to_regprocedure('public.rooster_growth_day(timestamptz)') is not null,
    'sale_age_guard', to_regprocedure('public.customer_request_rooster_sale_price(uuid,text)') is not null,
    'business_records_changed', false
  )
);
