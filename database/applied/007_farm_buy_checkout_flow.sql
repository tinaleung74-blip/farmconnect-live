-- FarmConnect Farm Buy checkout flow
-- Run after: 006_customer_animals_ownership_table.sql
-- Purpose:
-- - Make Farm Buy atomic and database-backed.
-- - Checkout deducts customer wallet, deducts farm product stock, adds customer inventory,
--   creates customer-owned rooster/chick records, creates wallet transaction, and sends inbox receipt.

begin;

create table if not exists public.customer_inventory_items (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  product_id text not null,
  product_name text not null,
  category text,
  unit_label text,
  unit_price numeric not null default 0,
  image_url text,
  quantity numeric not null default 0,
  product_type text,
  bloodline text,
  breed text,
  inventory_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(profile_id, product_id)
);

alter table public.customer_inventory_items
  add column if not exists profile_id uuid references public.profiles(id) on delete cascade,
  add column if not exists product_id text,
  add column if not exists product_name text,
  add column if not exists category text,
  add column if not exists unit_label text,
  add column if not exists unit_price numeric not null default 0,
  add column if not exists image_url text,
  add column if not exists quantity numeric not null default 0,
  add column if not exists product_type text,
  add column if not exists bloodline text,
  add column if not exists breed text,
  add column if not exists inventory_metadata jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists customer_inventory_items_profile_product_key
  on public.customer_inventory_items(profile_id, product_id);
create index if not exists idx_customer_inventory_items_profile
  on public.customer_inventory_items(profile_id);

alter table public.customer_inventory_items enable row level security;

drop policy if exists "customer inventory owner read" on public.customer_inventory_items;
create policy "customer inventory owner read"
on public.customer_inventory_items
for select
to authenticated
using (profile_id = public.current_profile_id() or public.is_admin());

drop policy if exists "customer inventory admin write" on public.customer_inventory_items;
create policy "customer inventory admin write"
on public.customer_inventory_items
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

alter table if exists public.farm_cart_items
  add column if not exists checkout_id uuid,
  add column if not exists purchased_at timestamptz,
  add column if not exists product_type text,
  add column if not exists bloodline_snapshot text,
  add column if not exists breed_snapshot text,
  add column if not exists product_name_snapshot text,
  add column if not exists cart_metadata jsonb not null default '{}'::jsonb;

create or replace function public.customer_buy_cart()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_wallet numeric := 0;
  v_total numeric := 0;
  v_checkout_id uuid := gen_random_uuid();
  v_lines jsonb := '[]'::jsonb;
  v_line record;
  v_i int;
  v_item_name text;
  v_item_code text;
begin
  select id, coalesce(wallet_balance, 0)
    into v_profile_id, v_wallet
  from public.profiles
  where auth_user_id = auth.uid()
  limit 1;

  if v_profile_id is null then
    raise exception 'LOGIN_REQUIRED';
  end if;

  select coalesce(sum(ci.quantity * ci.unit_price), 0)
    into v_total
  from public.farm_cart_items ci
  where ci.profile_id = v_profile_id
    and ci.status = 'active'
    and ci.quantity > 0;

  if v_total <= 0 then
    raise exception 'CART_EMPTY';
  end if;

  if v_wallet < v_total then
    raise exception 'NOT_ENOUGH_FUNDS';
  end if;

  for v_line in
    select
      ci.id as cart_id,
      ci.product_id::text as cart_product_id,
      ci.quantity,
      ci.unit_price,
      ci.purpose_note,
      coalesce(ci.product_name_snapshot, fp.name, 'Farm item') as product_name,
      coalesce(ci.product_type, fp.product_type, case when lower(coalesce(fp.category,'')) like '%chick%' then 'breed_chick' else 'supply' end) as product_type,
      coalesce(ci.bloodline_snapshot, fp.bloodline, fp.breed) as bloodline,
      coalesce(ci.breed_snapshot, fp.breed, fp.bloodline) as breed,
      fp.category,
      fp.unit_label,
      fp.image_url,
      fp.stock_quantity
    from public.farm_cart_items ci
    join public.farm_products fp on fp.id::text = ci.product_id::text
    where ci.profile_id = v_profile_id
      and ci.status = 'active'
      and ci.quantity > 0
    order by ci.id asc
  loop
    if coalesce(v_line.stock_quantity, 0) < v_line.quantity then
      raise exception 'INSUFFICIENT_STOCK';
    end if;
  end loop;

  update public.profiles
     set wallet_balance = coalesce(wallet_balance, 0) - v_total,
         updated_at = now()
   where id = v_profile_id;

  for v_line in
    select
      ci.id as cart_id,
      ci.product_id::text as cart_product_id,
      ci.quantity,
      ci.unit_price,
      ci.purpose_note,
      coalesce(ci.product_name_snapshot, fp.name, 'Farm item') as product_name,
      coalesce(ci.product_type, fp.product_type, case when lower(coalesce(fp.category,'')) like '%chick%' then 'breed_chick' else 'supply' end) as product_type,
      coalesce(ci.bloodline_snapshot, fp.bloodline, fp.breed) as bloodline,
      coalesce(ci.breed_snapshot, fp.breed, fp.bloodline) as breed,
      fp.category,
      fp.unit_label,
      fp.image_url
    from public.farm_cart_items ci
    join public.farm_products fp on fp.id::text = ci.product_id::text
    where ci.profile_id = v_profile_id
      and ci.status = 'active'
      and ci.quantity > 0
    order by ci.id asc
  loop
    update public.farm_products
       set stock_quantity = greatest(0, coalesce(stock_quantity, 0) - v_line.quantity)
     where id::text = v_line.cart_product_id;

    if lower(coalesce(v_line.product_type, '')) in ('breed_chick','chick','rooster')
       or lower(coalesce(v_line.category, '')) like '%chick%' then
      for v_i in 1..floor(v_line.quantity)::int loop
        v_item_name := coalesce(v_line.breed, v_line.bloodline, 'FarmConnect') || ' Chick';
        v_item_code := 'FC-' || upper(substr(replace(v_checkout_id::text, '-', ''), 1, 6)) || '-' || lpad(v_i::text, 2, '0');

        insert into public.customer_animals (
          profile_id,
          animal_name,
          animal_code,
          status,
          acquired_from,
          acquired_at,
          source_product_id,
          source_product_name,
          bloodline_snapshot,
          breed_snapshot,
          ownership_metadata
        ) values (
          v_profile_id,
          v_item_name,
          v_item_code,
          'active',
          'farm_buy',
          now(),
          v_line.cart_product_id,
          v_line.product_name,
          v_line.bloodline,
          v_line.breed,
          jsonb_build_object('checkout_id', v_checkout_id, 'cart_id', v_line.cart_id, 'unit_price', v_line.unit_price)
        );
      end loop;
    else
      insert into public.customer_inventory_items (
        profile_id,
        product_id,
        product_name,
        category,
        unit_label,
        unit_price,
        image_url,
        quantity,
        product_type,
        bloodline,
        breed,
        inventory_metadata
      ) values (
        v_profile_id,
        v_line.cart_product_id,
        v_line.product_name,
        v_line.category,
        v_line.unit_label,
        v_line.unit_price,
        v_line.image_url,
        v_line.quantity,
        v_line.product_type,
        v_line.bloodline,
        v_line.breed,
        jsonb_build_object('checkout_id', v_checkout_id, 'last_cart_id', v_line.cart_id)
      )
      on conflict (profile_id, product_id)
      do update set
        quantity = public.customer_inventory_items.quantity + excluded.quantity,
        product_name = excluded.product_name,
        category = excluded.category,
        unit_label = excluded.unit_label,
        unit_price = excluded.unit_price,
        image_url = excluded.image_url,
        product_type = excluded.product_type,
        bloodline = excluded.bloodline,
        breed = excluded.breed,
        inventory_metadata = public.customer_inventory_items.inventory_metadata || excluded.inventory_metadata,
        updated_at = now();
    end if;

    update public.farm_cart_items
       set status = 'purchased',
           checkout_id = v_checkout_id,
           purchased_at = now(),
           product_type = v_line.product_type,
           bloodline_snapshot = v_line.bloodline,
           breed_snapshot = v_line.breed,
           product_name_snapshot = v_line.product_name
     where id = v_line.cart_id;

    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'product_id', v_line.cart_product_id,
      'name', v_line.product_name,
      'quantity', v_line.quantity,
      'unit_price', v_line.unit_price,
      'line_total', v_line.quantity * v_line.unit_price,
      'type', v_line.product_type,
      'bloodline', v_line.bloodline
    ));
  end loop;

  insert into public.wallet_transactions (
    profile_id,
    transaction_type,
    amount,
    description,
    status,
    created_at
  ) values (
    v_profile_id,
    'FARM_BUY_DEBIT',
    v_total,
    'Farm Buy checkout ' || v_checkout_id::text,
    'COMPLETED',
    now()
  );

  insert into public.inbox_items (
    profile_id,
    category,
    title,
    body,
    created_at
  ) values (
    v_profile_id,
    'receipt',
    'Farm Buy Receipt',
    'Farm Buy completed. Total: ' || v_total::text || '. Receipt ID: ' || v_checkout_id::text,
    now()
  );

  return jsonb_build_object(
    'checkout_id', v_checkout_id,
    'total', v_total,
    'wallet_balance_after', v_wallet - v_total,
    'lines', v_lines
  );
end;
$$;

revoke all on function public.customer_buy_cart() from public;
grant execute on function public.customer_buy_cart() to authenticated;

commit;

-- Verification after run:
-- select 'customer_buy_cart_ready' as check_name, count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'customer_buy_cart'
-- union all
-- select 'customer_inventory_items_ready', count(*) from information_schema.tables where table_schema = 'public' and table_name = 'customer_inventory_items';