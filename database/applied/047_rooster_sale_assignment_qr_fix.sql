-- FarmConnect rooster sale assignment QR schema fix
-- SAFE TO RUN after 035 and 040.
--
-- Migration 040 incorrectly read qr_payload from customer_animals. The payload
-- is authoritative in animal_qr_identities; customer_animals stores only its ID.

begin;

create or replace function public.prepare_rooster_sale_task()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_request public.farm_care_requests%rowtype;
  v_sale_id uuid;
  v_qr_identity_id uuid;
  v_qr_payload text;
begin
  select * into v_request
  from public.farm_care_requests
  where id = new.care_request_id;

  if not found or v_request.service_category not in ('sale_price_inspection','sale_release_confirmation') then
    return new;
  end if;

  select id into v_sale_id
  from public.rooster_sale_requests
  where price_care_request_id=v_request.id or release_care_request_id=v_request.id
  limit 1;

  new.workflow_type := v_request.service_category;
  new.qr_scan_required := v_request.service_category='sale_price_inspection';

  if v_request.service_category='sale_price_inspection' then
    select animal.qr_identity_id
    into v_qr_identity_id
    from public.customer_animals animal
    where animal.id=v_request.customer_animal_id;

    if v_qr_identity_id is null then
      v_qr_identity_id := public.create_or_get_animal_qr_identity(v_request.customer_animal_id,null);
    end if;

    select identity.qr_payload
    into v_qr_payload
    from public.animal_qr_identities identity
    where identity.id=v_qr_identity_id;

    new.qr_identity_id := v_qr_identity_id;
    new.qr_payload := v_qr_payload;
  end if;

  new.task_metadata := coalesce(new.task_metadata,'{}'::jsonb)
    || jsonb_build_object('sale_request_id',v_sale_id);
  new.required_proof := case
    when v_request.service_category='sale_price_inspection'
      then 'Enter inspected price, upload clear current rooster photo, and verify QR.'
    else 'Documentation and caretaker acknowledgement only. No photo or QR required.'
  end;
  return new;
end;
$$;

create or replace function public.rooster_sale_assignment_qr_fix_version()
returns text
language sql
stable
as $$ select '047'::text $$;

revoke all on function public.prepare_rooster_sale_task() from public,anon;
revoke all on function public.rooster_sale_assignment_qr_fix_version() from public,anon;
grant execute on function public.rooster_sale_assignment_qr_fix_version() to authenticated;

commit;

select 'rooster_sale_assignment_qr_fix_ready' as check_name,count(*) as count
from information_schema.routines
where routine_schema='public'
  and routine_name='rooster_sale_assignment_qr_fix_version';
