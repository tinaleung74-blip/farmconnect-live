-- Repair for 007_farm_buy_checkout_flow.sql
-- Safe purpose: allows customer_buy_cart() return type to be replaced by SQL 007.
-- Run this first, then rerun database/applied/007_farm_buy_checkout_flow.sql.

drop function if exists public.customer_buy_cart();

-- After this succeeds, rerun:
-- database/applied/007_farm_buy_checkout_flow.sql
--
-- Then verify:
-- select routine_name
-- from information_schema.routines
-- where routine_schema = 'public'
--   and routine_name in ('customer_buy_cart', 'customer_add_farm_cart_item');
--
-- select to_regclass('public.customer_inventory_items') as customer_inventory_items;
