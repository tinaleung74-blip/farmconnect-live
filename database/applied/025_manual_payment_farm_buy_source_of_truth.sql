-- FarmConnect manual payment approval source-of-truth repair
-- Run after:
-- 009_manual_payment_review_flow.sql
-- 007_farm_buy_checkout_flow.sql
--
-- Purpose:
-- - Admin approval for Farm Buy must post items from the submitted payment summary.
-- - Do not depend only on currently-active cart rows because the cart can be stale,
--   changed, or skipped by preview/local UI.
-- - Approval creates customer_animals for breed chicks and customer_inventory_items
--   for supplies, then sends an inbox receipt.

create or replace function public.admin_review_manual_payment(
  p_payment_request_id uuid,
  p_decision text,
  p_admin_note text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid;
  v_payment public.manual_payment_requests%rowtype;
  v_receipt_id uuid := gen_random_uuid();
  v_lines jsonb := '[]'::jsonb;
  v_line jsonb;
  v_cart record;
  v_product public.farm_products%rowtype;
  v_product_id_text text;
  v_name text;
  v_category text;
  v_product_type text;
  v_bloodline text;
  v_breed text;
  v_unit_label text;
  v_image_url text;
  v_quantity numeric;
  v_unit_price numeric;
  v_line_total numeric;
  v_i int;
  v_item_code text;
begin
  if not public.is_admin() then
    raise exception 'ADMIN_REQUIRED';
  end if;

  select id into v_admin_id
  from public.profiles
  where auth_user_id = auth.uid()
  limit 1;

  select * into v_payment
  from public.manual_payment_requests
  where id = p_payment_request_id
  for update;

  if not found then
    raise exception 'PAYMENT_NOT_FOUND';
  end if;

  if p_decision not in ('approved','rejected','needs_info') then
    raise exception 'INVALID_DECISION';
  end if;

  if v_payment.status not in ('for_review','needs_info') then
    raise exception 'PAYMENT_ALREADY_REVIEWED';
  end if;

  update public.manual_payment_requests
  set status = p_decision,
      admin_note = p_admin_note,
      admin_reviewed_by = v_admin_id,
      admin_reviewed_at = now(),
      updated_at = now()
  where id = p_payment_request_id;

  insert into public.payment_evidence_logs(payment_request_id, profile_id, event_type, title, details, actor_profile_id)
  values (
    p_payment_request_id,
    v_payment.profile_id,
    'admin_' || p_decision,
    'Admin payment decision: ' || p_decision,
    jsonb_build_object(
      'admin_note', p_admin_note,
      'amount_expected', v_payment.amount_expected,
      'reference_number', v_payment.reference_number,
      'source_type', v_payment.source_type,
      'summary', v_payment.summary
    ),
    v_admin_id
  );

  if p_decision = 'approved' and v_payment.source_type = 'farm_buy' then
    if jsonb_typeof(v_payment.summary -> 'lines') = 'array'
       and jsonb_array_length(v_payment.summary -> 'lines') > 0 then
      for v_line in select value from jsonb_array_elements(v_payment.summary -> 'lines')
      loop
        v_product_id_text := nullif(v_line ->> 'id', '');
        v_name := coalesce(nullif(v_line ->> 'name', ''), 'Farm item');
        v_category := coalesce(nullif(v_line ->> 'category', ''), 'Farm Items');
        v_quantity := greatest(coalesce((v_line ->> 'quantity')::numeric, 0), 0);
        v_unit_price := greatest(coalesce((v_line ->> 'unit_price')::numeric, 0), 0);
        v_line_total := greatest(coalesce((v_line ->> 'total')::numeric, v_quantity * v_unit_price), 0);
        v_product_type := nullif(v_line ->> 'product_type', '');
        v_bloodline := nullif(v_line ->> 'bloodline', '');
        v_breed := nullif(v_line ->> 'breed', '');
        v_unit_label := nullif(v_line ->> 'unit_label', '');
        v_image_url := nullif(v_line ->> 'image_url', '');
        v_product := null;

        if v_product_id_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
          select * into v_product
          from public.farm_products
          where id::text = v_product_id_text
          limit 1;

          if found then
            v_name := coalesce(v_product.name, v_name);
            v_category := coalesce(v_product.category, v_category);
            v_product_type := coalesce(v_product.product_type, v_product_type);
            v_bloodline := coalesce(v_product.bloodline, v_bloodline);
            v_breed := coalesce(v_product.breed, v_breed, v_bloodline);
            v_unit_label := coalesce(v_product.unit_label, v_unit_label);
            v_image_url := coalesce(v_product.image_url, v_image_url);

            update public.farm_products
            set stock_quantity = greatest(0, coalesce(stock_quantity, 0) - v_quantity)
            where id = v_product.id;
          end if;
        end if;

        if v_quantity <= 0 then
          continue;
        end if;

        if lower(coalesce(v_product_type, '')) in ('breed_chick','chick','rooster')
           or lower(coalesce(v_category, '')) like '%chick%'
           or lower(coalesce(v_name, '')) like '%chick%' then
          for v_i in 1..greatest(1, floor(v_quantity)::int) loop
            v_item_code := 'FC-' || upper(substr(replace(v_receipt_id::text, '-', ''), 1, 6)) || '-' || lpad(v_i::text, 2, '0');

            insert into public.customer_animals(
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
              v_payment.profile_id,
              coalesce(v_breed, v_bloodline, v_name),
              v_item_code,
              'active',
              'farm_buy',
              now(),
              v_product_id_text,
              v_name,
              v_bloodline,
              coalesce(v_breed, v_bloodline),
              jsonb_build_object(
                'payment_request_id', p_payment_request_id,
                'receipt_id', v_receipt_id,
                'reference_number', v_payment.reference_number,
                'unit_price', v_unit_price,
                'source', 'approved_payment'
              )
            );
          end loop;
        else
          insert into public.customer_inventory_items(
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
            inventory_metadata,
            updated_at
          ) values (
            v_payment.profile_id,
            coalesce(v_product_id_text, md5(v_name || v_category)),
            v_name,
            v_category,
            v_unit_label,
            v_unit_price,
            v_image_url,
            v_quantity,
            coalesce(v_product_type, 'supply'),
            v_bloodline,
            v_breed,
            jsonb_build_object(
              'payment_request_id', p_payment_request_id,
              'receipt_id', v_receipt_id,
              'reference_number', v_payment.reference_number,
              'source', 'approved_payment'
            ),
            now()
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

        v_lines := v_lines || jsonb_build_array(jsonb_build_object(
          'id', v_product_id_text,
          'name', v_name,
          'category', v_category,
          'quantity', v_quantity,
          'unit_price', v_unit_price,
          'line_total', v_line_total,
          'product_type', coalesce(v_product_type, case when lower(v_category) like '%chick%' then 'breed_chick' else 'supply' end)
        ));
      end loop;
    else
      for v_cart in
        select
          c.id as cart_id,
          c.quantity,
          c.unit_price,
          c.product_id::text as product_id,
          c.product_type as cart_product_type,
          c.bloodline_snapshot as cart_bloodline,
          c.breed_snapshot as cart_breed,
          c.product_name_snapshot as cart_product_name,
          p.name,
          p.category,
          p.product_type,
          p.bloodline,
          p.breed,
          p.unit_label,
          p.image_url
        from public.farm_cart_items c
        left join public.farm_products p on p.id::text = c.product_id::text
        where c.profile_id = v_payment.profile_id and c.status = 'active'
        order by c.id asc
      loop
        v_line := jsonb_build_object(
          'id', v_cart.product_id,
          'name', coalesce(v_cart.name, v_cart.cart_product_name, 'Farm item'),
          'category', coalesce(v_cart.category, 'Farm Items'),
          'quantity', v_cart.quantity,
          'unit_price', v_cart.unit_price,
          'total', v_cart.quantity * v_cart.unit_price,
          'product_type', coalesce(v_cart.cart_product_type, v_cart.product_type),
          'bloodline', coalesce(v_cart.bloodline, v_cart.cart_bloodline),
          'breed', coalesce(v_cart.breed, v_cart.cart_breed),
          'unit_label', v_cart.unit_label,
          'image_url', v_cart.image_url
        );
        -- Reuse the summary processing path on the next approval guard by appending
        -- a synthetic line to v_payment.summary in-memory.
        v_payment.summary := jsonb_set(
          coalesce(v_payment.summary, '{}'::jsonb),
          '{lines}',
          coalesce(v_payment.summary -> 'lines', '[]'::jsonb) || jsonb_build_array(v_line),
          true
        );
      end loop;

      if jsonb_typeof(v_payment.summary -> 'lines') = 'array'
         and jsonb_array_length(v_payment.summary -> 'lines') > 0 then
        update public.manual_payment_requests
        set summary = v_payment.summary
        where id = p_payment_request_id;

        -- Run the function once more now that legacy cart rows have been converted
        -- into immutable payment summary lines.
        update public.manual_payment_requests
        set status = 'for_review'
        where id = p_payment_request_id;
        return public.admin_review_manual_payment(p_payment_request_id, p_decision, p_admin_note);
      end if;
    end if;

    update public.farm_cart_items
    set status = 'purchased', checkout_id = v_receipt_id, purchased_at = now()
    where profile_id = v_payment.profile_id and status = 'active';

    insert into public.payment_evidence_logs(payment_request_id, profile_id, event_type, title, details, actor_profile_id)
    values (
      p_payment_request_id,
      v_payment.profile_id,
      'farm_buy_posted',
      'Farm Buy items posted after admin approval',
      jsonb_build_object('receipt_id', v_receipt_id, 'lines', v_lines),
      v_admin_id
    );
  end if;

  if p_decision = 'approved' and v_payment.source_type = 'care_request' then
    insert into public.inbox_items(profile_id, category, title, body, created_at)
    values (
      v_payment.profile_id,
      'care',
      'Care Request Approved',
      'Admin approved your care request payment. Reference: ' || v_payment.reference_number || '. The farm team can now assign the task.',
      now()
    );
  elsif p_decision = 'approved' and v_payment.source_type = 'farm_buy' then
    insert into public.inbox_items(profile_id, category, title, body, created_at)
    values (
      v_payment.profile_id,
      'receipt',
      'Farm Buy Approved',
      'Farm Buy payment approved. Total: ' || v_payment.amount_expected::text || '. Receipt ID: ' || v_receipt_id::text || '. Reference: ' || v_payment.reference_number || '. Items are now in My Roosters or Inventory.',
      now()
    );
  elsif p_decision = 'approved' then
    insert into public.inbox_items(profile_id, category, title, body, created_at)
    values (
      v_payment.profile_id,
      'receipt',
      'Payment Approved',
      'Payment approved. Amount: ' || v_payment.amount_expected::text || '. Receipt ID: ' || v_receipt_id::text || '. Reference: ' || v_payment.reference_number || '.',
      now()
    );
  elsif p_decision = 'rejected' then
    insert into public.inbox_items(profile_id, category, title, body, created_at)
    values (
      v_payment.profile_id,
      'alert',
      'Payment Rejected',
      'Payment was rejected. Reason: ' || coalesce(p_admin_note, 'Please check your proof, payment method, and reference number.') || '. Reference: ' || v_payment.reference_number || '. You can resubmit after correcting it.',
      now()
    );
  else
    insert into public.inbox_items(profile_id, category, title, body, created_at)
    values (
      v_payment.profile_id,
      'alert',
      'Payment Needs More Info',
      'Admin needs more info. Note: ' || coalesce(p_admin_note, 'Please submit clearer payment details.') || '. Reference: ' || v_payment.reference_number || '.',
      now()
    );
  end if;

  return p_payment_request_id;
end;
$$;

revoke all on function public.admin_review_manual_payment(uuid,text,text) from public;
grant execute on function public.admin_review_manual_payment(uuid,text,text) to authenticated;

select 'manual_payment_farm_buy_source_of_truth_ready' as check_name, count(*) as count
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'admin_review_manual_payment';
