-- FarmConnect persistent Inbox read state
-- Purpose:
-- - Opening an Inbox item clears its unread badge across refreshes/devices.
-- - Customers can mark only their own Inbox records as read.

begin;

alter table public.inbox_items
  add column if not exists is_read boolean not null default false,
  add column if not exists read_at timestamptz;

create index if not exists idx_inbox_items_profile_unread
  on public.inbox_items(profile_id, is_read, created_at desc);

create or replace function public.customer_mark_inbox_item_read(
  p_inbox_item_id uuid
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
begin
  select id into v_profile_id
  from public.profiles
  where auth_user_id = auth.uid()
    and account_status = 'active'
  limit 1;

  if v_profile_id is null then
    raise exception 'ACTIVE_PROFILE_REQUIRED';
  end if;

  update public.inbox_items
  set is_read = true,
      read_at = coalesce(read_at, now())
  where id = p_inbox_item_id
    and profile_id = v_profile_id;

  if not found then
    raise exception 'INBOX_ITEM_NOT_FOUND_OR_NOT_OWNED';
  end if;

  return p_inbox_item_id;
end;
$$;

revoke all on function public.customer_mark_inbox_item_read(uuid) from public;
grant execute on function public.customer_mark_inbox_item_read(uuid) to authenticated;

commit;

select 'inbox_read_state_ready' as check_name, count(*) as count
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'customer_mark_inbox_item_read';
