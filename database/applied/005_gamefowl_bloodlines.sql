-- FarmConnect gamefowl bloodline database support
-- Run after: 004_wallet_pin_function.sql
-- Purpose:
-- - Make Farm Buy breed chicks database-backed.
-- - Store rooster bloodline/breed on animal records.
-- - Keep ownership/cart/invoice evidence able to reference the purchased bloodline.

begin;

-- 1) Product bloodline fields. Main app reads public.farm_products.
alter table if exists public.farm_products
  add column if not exists product_type text,
  add column if not exists stage text,
  add column if not exists bloodline text,
  add column if not exists breed text,
  add column if not exists product_metadata jsonb not null default '{}'::jsonb;

-- Optional compatibility if older marketplace table is still present.
alter table if exists public.marketplace_products
  add column if not exists product_type text,
  add column if not exists stage text,
  add column if not exists bloodline text,
  add column if not exists breed text,
  add column if not exists product_metadata jsonb not null default '{}'::jsonb;

-- 2) Rooster/animal bloodline fields.
alter table if exists public.animals
  add column if not exists bloodline text,
  add column if not exists breed text,
  add column if not exists stage text,
  add column if not exists source_product_id text,
  add column if not exists source_product_name text,
  add column if not exists source_product_type text,
  add column if not exists animal_metadata jsonb not null default '{}'::jsonb;

-- 3) Customer ownership snapshot fields. This protects receipts/evidence
-- even if product name or bloodline label changes later.
alter table if exists public.customer_animals
  add column if not exists bloodline_snapshot text,
  add column if not exists breed_snapshot text,
  add column if not exists source_product_id text,
  add column if not exists source_product_name text,
  add column if not exists ownership_metadata jsonb not null default '{}'::jsonb;

-- 4) Cart snapshot fields for checkout/invoice evidence.
alter table if exists public.farm_cart_items
  add column if not exists product_type text,
  add column if not exists bloodline_snapshot text,
  add column if not exists breed_snapshot text,
  add column if not exists product_name_snapshot text,
  add column if not exists cart_metadata jsonb not null default '{}'::jsonb;

-- 5) Inventory movement snapshot fields, if present.
alter table if exists public.inventory_items
  add column if not exists product_type text,
  add column if not exists bloodline text,
  add column if not exists breed text,
  add column if not exists source_product_id text,
  add column if not exists inventory_metadata jsonb not null default '{}'::jsonb;

alter table if exists public.inventory_movements
  add column if not exists product_type text,
  add column if not exists bloodline_snapshot text,
  add column if not exists breed_snapshot text,
  add column if not exists movement_metadata jsonb not null default '{}'::jsonb;

-- 6) Normalize existing starter chick rows.
update public.farm_products
set
  name = 'Starter Chick (Hatch)',
  category = 'starter_chicks',
  product_type = 'breed_chick',
  stage = 'starter_chick',
  bloodline = 'Hatch',
  breed = 'Hatch',
  product_metadata = coalesce(product_metadata, '{}'::jsonb) || jsonb_build_object('normalized_from', 'starter_chick')
where to_regclass('public.farm_products') is not null
  and (
    lower(name) in ('standard starter chick', 'starter chick')
    or lower(category) in ('starter chicks', 'starter_chicks')
  );

do $$
begin
  if to_regclass('public.marketplace_products') is not null then
    update public.marketplace_products
    set
      name = 'Starter Chick (Hatch)',
      category = 'starter_chicks',
      product_type = 'breed_chick',
      stage = 'starter_chick',
      bloodline = 'Hatch',
      breed = 'Hatch',
      product_metadata = coalesce(product_metadata, '{}'::jsonb) || jsonb_build_object('normalized_from', 'starter_chick')
    where lower(name) in ('standard starter chick', 'starter chick')
       or lower(category) in ('starter chicks', 'starter_chicks');
  end if;
end $$;

-- 7) Seed Farm Buy gamefowl starter chick products.
do $$
declare
  v_bloodline text;
  v_index int := 0;
  v_price numeric;
  v_stock numeric;
  v_lines text[] := array[
    'Hatch','Kelso','Sweater','Roundhead','Lemon','Claret','Albany','Grey','Law Grey','Regular Grey',
    'Lacy Roundhead','Boston Roundhead','Butcher','Radio','Whitehackle','McLean Hatch','Blueface Hatch',
    'Yellow Leg Hatch','Gilmore Hatch','Spangled Hatch','Mug','Sid Taylor','Blackwater','Brown Red',
    'Black McRae','Harold Brown Grey','Madigin Grey','Cardinal Kelso','Out and Out Kelso','Jumper Kelso',
    'Firebird Kelso','Possum Sweater','5K Sweater','5000 Sweater','Yellow Leg Sweater','Lemon 84',
    'Duke Hulsey','Shamo','Asil','Brazilian','Peruvian','Spanish Game','Sweater-Kelso','Hatch-Claret',
    'Hatch-Grey','Lemon-Hatch','Roundhead-Hatch','Kelso-Roundhead'
  ];
begin
  if to_regclass('public.farm_products') is null then
    return;
  end if;

  foreach v_bloodline in array v_lines loop
    v_price := 450 + ((v_index % 8) * 75);
    v_stock := greatest(6, 30 - ((v_index % 7) * 3));

    if not exists (
      select 1
      from public.farm_products
      where lower(name) = lower('Starter Chick (' || v_bloodline || ')')
    ) then
      insert into public.farm_products (
        name,
        category,
        unit_label,
        unit_price,
        image_url,
        description,
        stock_quantity,
        status,
        product_type,
        stage,
        bloodline,
        breed,
        product_metadata
      )
      values (
        'Starter Chick (' || v_bloodline || ')',
        'starter_chicks',
        'per head',
        v_price,
        '/farmconnect/roosters/fc-stage-1-chick-base.jpg',
        'Starter chick bloodline: ' || v_bloodline,
        v_stock,
        'available',
        'breed_chick',
        'starter_chick',
        v_bloodline,
        v_bloodline,
        jsonb_build_object('seeded_by', '005_gamefowl_bloodlines', 'bloodline', v_bloodline)
      );
    end if;

    v_index := v_index + 1;
  end loop;
end $$;

-- 8) Backfill demo/current rooster bloodlines if those records exist.
update public.animals
set bloodline = coalesce(bloodline, 'Hatch-Kelso'),
    breed = coalesce(breed, 'Hatch-Kelso'),
    stage = coalesce(stage, 'young_rooster')
where to_regclass('public.animals') is not null
  and lower(name) = lower('Thunder King');

update public.animals
set bloodline = coalesce(bloodline, 'Asil'),
    breed = coalesce(breed, 'Asil'),
    stage = coalesce(stage, 'starter')
where to_regclass('public.animals') is not null
  and lower(name) = lower('Red Ace');

update public.animals
set bloodline = coalesce(bloodline, 'Sweater-Roundhead'),
    breed = coalesce(breed, 'Sweater-Roundhead'),
    stage = coalesce(stage, 'adult')
where to_regclass('public.animals') is not null
  and lower(name) = lower('Bantay');

-- 9) Helpful indexes for filtering/searching.
create index if not exists idx_farm_products_product_type
  on public.farm_products (product_type);

create index if not exists idx_farm_products_bloodline
  on public.farm_products (lower(bloodline));

create index if not exists idx_animals_bloodline
  on public.animals (lower(bloodline));

commit;

-- Verification query:
-- select 'breed_chick_products' as check_name, count(*) from public.farm_products where product_type = 'breed_chick'
-- union all
-- select 'animals_with_bloodline', count(*) from public.animals where bloodline is not null
-- union all
-- select 'cart_bloodline_columns', count(*) from information_schema.columns where table_schema = 'public' and table_name = 'farm_cart_items' and column_name in ('product_type','bloodline_snapshot','breed_snapshot','product_name_snapshot');
