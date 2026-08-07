-- FarmConnect Farm Buy common gamefowl catalog
-- Purpose:
-- - Keep only 12 common Philippine gamefowl bloodlines visible in Farm Buy.
-- - Preserve older products and purchase history; no product row is deleted.

begin;

update public.farm_products p
set product_metadata = coalesce(p.product_metadata, '{}'::jsonb) || jsonb_build_object(
  'farmbuy_visible', false,
  'catalog_revision', '043_common_ph_gamefowl'
)
where p.product_type = 'breed_chick'
   or lower(coalesce(p.category, '')) in ('breed chicks', 'starter chicks', 'starter_chicks');

with allowed_bloodlines(bloodline) as (
  values
    ('Hatch'),
    ('Kelso'),
    ('Sweater'),
    ('Roundhead'),
    ('Lemon'),
    ('Claret'),
    ('Albany'),
    ('Grey'),
    ('Lacy Roundhead'),
    ('Radio'),
    ('Whitehackle'),
    ('Yellow Leg Hatch')
), ranked_products as (
  select
    p.id,
    row_number() over (
      partition by lower(coalesce(p.bloodline, p.breed, ''))
      order by p.id::text
    ) as catalog_position
  from public.farm_products p
  join allowed_bloodlines a
    on lower(a.bloodline) = lower(coalesce(p.bloodline, p.breed, ''))
  where p.product_type = 'breed_chick'
     or lower(coalesce(p.category, '')) in ('breed chicks', 'starter chicks', 'starter_chicks')
)
update public.farm_products p
set product_metadata = coalesce(p.product_metadata, '{}'::jsonb) || jsonb_build_object(
  'farmbuy_visible', true,
  'catalog_revision', '043_common_ph_gamefowl'
)
from ranked_products r
where p.id = r.id
  and r.catalog_position = 1;

commit;

-- Expected result: exactly 12 visible breed-chick products.
select
  'farmbuy_common_gamefowl_bloodlines_ready' as check_name,
  count(*) as count
from public.farm_products
where (product_type = 'breed_chick'
       or lower(coalesce(category, '')) in ('breed chicks', 'starter chicks', 'starter_chicks'))
  and coalesce((product_metadata ->> 'farmbuy_visible')::boolean, false);
