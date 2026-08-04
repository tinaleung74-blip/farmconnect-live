-- FarmConnect manual payment -> care request sync
-- Run after:
-- 009_manual_payment_review_flow.sql
-- 011_care_task_safe_backend.sql

create or replace function public.sync_manual_payment_care_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.source_type = 'care_request'
     and nullif(new.source_ref, '') is not null
     and exists (
       select 1
       from public.farm_care_requests fcr
       where fcr.id::text = new.source_ref
          or fcr.payment_request_id = new.id
     ) then
    update public.farm_care_requests
    set
      payment_request_id = new.id,
      status = case
        when new.status = 'approved' then 'paid_pending_assignment'
        when new.status = 'rejected' then 'payment_rejected'
        when new.status in ('needs_info','reviewing') then 'payment_for_review'
        else public.farm_care_requests.status
      end,
      admin_note = coalesce(new.admin_note, public.farm_care_requests.admin_note),
      updated_at = now()
    where id::text = new.source_ref
       or payment_request_id = new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_manual_payment_care_request on public.manual_payment_requests;
create trigger trg_sync_manual_payment_care_request
after insert or update of status, admin_note, source_type, source_ref
on public.manual_payment_requests
for each row
execute function public.sync_manual_payment_care_request();

-- Backfill already-reviewed care payments.
update public.farm_care_requests fcr
set
  payment_request_id = mpr.id,
  status = case
    when mpr.status = 'approved' then 'paid_pending_assignment'
    when mpr.status = 'rejected' then 'payment_rejected'
    when mpr.status in ('needs_info','reviewing') then 'payment_for_review'
    else fcr.status
  end,
  admin_note = coalesce(mpr.admin_note, fcr.admin_note),
  updated_at = now()
from public.manual_payment_requests mpr
where mpr.source_type = 'care_request'
  and mpr.source_ref = fcr.id::text;

select
  'manual_payment_care_request_sync_ready' as check_name,
  count(*) as trigger_count
from pg_trigger
where tgname = 'trg_sync_manual_payment_care_request';
