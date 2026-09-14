// Real embedded PostgreSQL transaction tests over a bounded fixture schema.
// Auth and the legacy order/mission adapters below are fixtures, NOT live E2E.
const fs=require('node:fs');
const assert=require('node:assert/strict');
const {PGlite}=require(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const db=new PGlite();
const profile='00000000-0000-4000-8000-000000000001';
const product='00000000-0000-4000-8000-000000000002';
const caretaker='00000000-0000-4000-8000-000000000003';
const feed='00000000-0000-4000-8000-000000000004';
const read=p=>fs.readFileSync(p,'utf8').replace(/\r/g,'');
async function main(){
await db.exec(`
create role authenticated; create role anon; create role service_role;
create function current_profile_id() returns uuid language sql as $$ select nullif(current_setting('test.profile',true),'')::uuid $$;
create function is_admin() returns boolean language sql as $$ select coalesce(current_setting('test.admin',true),'false')='true' $$;
create schema auth;
create function auth.uid() returns uuid language sql as $$ select public.current_profile_id() $$;
create table profiles(id uuid primary key,auth_user_id uuid);
create table farm_products(id uuid primary key,name text,category text,product_type text,status text,stock_quantity numeric,unit_price numeric,product_metadata jsonb default '{}',unit_label text,image_url text,updated_at timestamptz);
create table manual_payment_requests(id uuid primary key default gen_random_uuid(),profile_id uuid,source_type text,source_ref text,amount_expected numeric,summary jsonb,status text default 'for_review',reference_number text);
create table customer_animals(id uuid primary key default gen_random_uuid(),profile_id uuid,source_product_id text,ownership_metadata jsonb);
create table caretakers(id uuid primary key,status text);
create table farm_care_requests(id uuid primary key default gen_random_uuid(),profile_id uuid,customer_animal_id uuid,payment_request_id uuid,service_category text,status text,created_at timestamptz default now(),assigned_caretaker_id uuid);
create table caretaker_tasks(id uuid primary key default gen_random_uuid(),care_plan_id uuid,mission_date date,task_type text,required_proof text,task_metadata jsonb default '{}');
create table customer_inventory_items(id uuid primary key default gen_random_uuid(),profile_id uuid,product_id text,product_name text,category text,unit_label text,unit_price numeric,image_url text,quantity numeric,product_type text,inventory_metadata jsonb,updated_at timestamptz,unique(profile_id,product_id));
create table care_mission_templates(catalog_version text,day_number int,feed_grams_max numeric);
create table rooster_care_plans(id uuid primary key default gen_random_uuid(),profile_id uuid,customer_animal_id uuid,duration_days int,start_day_number int,requested_start_day int,status text,catalog_version text default 'farmconnect-premium-rooster-180-v1',payment_request_id uuid,assigned_caretaker_id uuid,feed_required_kg numeric,feed_inventory_item_id uuid,labor_price numeric default 0,supply_price numeric default 0,service_fee numeric default 0,package_total numeric generated always as (labor_price+supply_price+service_fee) stored,quote_note text,quoted_at timestamptz,quote_expires_at timestamptz,quoted_by_profile_id uuid,preparation_status text default 'not_started',updated_at timestamptz,start_date date,end_date date,schedule_shift_days int,activated_at timestamptz,preparation_verified_at timestamptz);
create unique index one_live_plan on rooster_care_plans(customer_animal_id) where status in ('payment_for_review','payment_submitted','paid_pending_setup','ready','active','paused');
create table care_plan_supply_requirements(id uuid primary key default gen_random_uuid(),care_plan_id uuid,inventory_item_id uuid,product_id text,product_name text,unit text,required_quantity numeric,owned_quantity_snapshot numeric,reserved_quantity numeric,purchase_quantity numeric,unit_price numeric,requirement_source text,inventory_unit_label text,kg_per_inventory_unit numeric,required_inventory_units numeric,reserved_inventory_units numeric,purchase_inventory_units numeric,reservation_status text,purchase_fulfilled_at timestamptz,updated_at timestamptz);
create table care_plan_package_items(care_plan_id uuid,item_kind text,product_id text,linked_inventory_item_id uuid,item_name text,required_quantity numeric,unit text,stock_controlled boolean,use_rule text,status text default 'planned',updated_at timestamptz);
create table care_plan_events(care_plan_id uuid,actor_profile_id uuid,event_type text,event_data jsonb);
create table inbox_items(profile_id uuid,category text,title text,body text,created_at timestamptz);
create table test_keys(key text primary key,payment_id uuid);
create function customer_submit_manual_payment_guarded(text,text,numeric,jsonb,text,text,text,text,text,text) returns jsonb language plpgsql as $$
declare p uuid;
begin
  select payment_id into p from test_keys where key=$10;
  if found then return jsonb_build_object('id',p,'duplicate',true); end if;
  insert into manual_payment_requests(profile_id,source_type,source_ref,amount_expected,summary,reference_number)
    values(current_profile_id(),$1,$2,$3,$4,$8) returning id into p;
  insert into test_keys values($10,p);
  return jsonb_build_object('id',p,'duplicate',false);
end $$;
create function admin_review_manual_payment_guarded(uuid,text,text) returns jsonb language plpgsql as $$
declare p manual_payment_requests%rowtype; a uuid;
begin
  if not is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  select * into p from manual_payment_requests where id=$1 for update;
  if p.status='approved' then return jsonb_build_object('id',p.id); end if;
  update manual_payment_requests set status=$2 where id=p.id;
  if p.source_type='farm_buy' and $2='approved' then
    update farm_products set stock_quantity=stock_quantity-1 where id::text=p.summary->'lines'->0->>'id';
    insert into customer_animals(profile_id,source_product_id,ownership_metadata)
      values(p.profile_id,p.summary->'lines'->0->>'id',jsonb_build_object('payment_request_id',p.id)) returning id into a;
    insert into farm_care_requests(profile_id,customer_animal_id,payment_request_id,service_category,status)
      values(p.profile_id,a,p.id,'system_qr_tagging','paid_pending_assignment');
  end if;
  return jsonb_build_object('id',p.id);
end $$;
create function admin_assign_care_request(uuid,uuid,text) returns uuid language plpgsql as $$
declare t uuid;
begin
  update farm_care_requests set assigned_caretaker_id=$2,status='assigned' where id=$1;
  insert into caretaker_tasks default values returning id into t; return t;
end $$;
create function generate_due_care_plan_missions(date) returns jsonb language sql as $$ select '{"created":0}'::jsonb $$;
insert into profiles values('${profile}','${profile}');
insert into farm_products(id,name,category,product_type,status,stock_quantity,unit_price,unit_label) values
 ('${product}','Kelso chick','Breed Chicks','breed_chick','available',10,1000,'piece'),
 ('${feed}','Starter feed','Feed','feed','available',100,100,'kg');
insert into caretakers values('${caretaker}','active');
insert into care_mission_templates select 'farmconnect-premium-rooster-180-v1',n,30 from generate_series(1,30) n;
set test.profile='${profile}'; set test.admin='true';
`);
const lifecycle=read('database/applied/062_care_plan_production_lifecycle.sql');
const start=lifecycle.indexOf('create or replace function public.fulfill_care_plan_feed(');
await db.exec(lifecycle.slice(start,lifecycle.indexOf('end; $$;',start)+8));
await db.exec(read('database/pending/110_rooster_monthly_bundle.sql'));
const summary={care_bundle_version:'110',lines:[{id:product,quantity:1,unit_price:1000,total:1000}]};
async function submit(amount=6000,key='first',body=summary){
  return (await db.query('select customer_submit_rooster_bundle($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) as result',
    ['farm_buy','active-cart',amount,JSON.stringify(body),'GCash','fixture','fixture','ref-'+key,'fixture',key])).rows[0].result;
}
async function approve(id){return db.query('select admin_approve_assign_rooster_order($1,$2,null)',[id,caretaker]);}
let passed=0;
async function check(name,fn){await fn(); console.log('PASS '+name);passed++;}
await check('wrong price rejected before creating a payment',async()=>{await assert.rejects(submit(1000),/BUNDLE_PRICE_CHANGED/);});
await check('multiple rooster quantities rejected',async()=>{await assert.rejects(submit(6000,'qty',{...summary,lines:[{...summary.lines[0],quantity:2}]}),/ONE_ROOSTER/);});
const first=await submit();
await check('retry reuses one payment',async()=>{assert.equal((await submit()).id,first.id);assert.equal((await db.query('select count(*)::int n from manual_payment_requests')).rows[0].n,1);});
await check('customer cannot approve',async()=>{await db.exec("set test.admin='false'");await assert.rejects(approve(first.id),/ADMIN_REQUIRED/);await db.exec("set test.admin='true'");});
await check('one approval creates linked paid care without second payment',async()=>{
  await approve(first.id);
  const row=(await db.query('select p.status,p.package_total,b.care_amount,p.assigned_caretaker_id from rooster_order_care_bundles b join rooster_care_plans p on p.id=b.care_plan_id')).rows[0];
  assert.equal(row.status,'ready');assert.equal(Number(row.package_total),5000);assert.equal(row.assigned_caretaker_id,caretaker);
  assert.equal((await db.query('select count(*)::int n from manual_payment_requests')).rows[0].n,1);
});
await check('repeat approval does not create a second plan/task',async()=>{
  await approve(first.id);
  assert.equal((await db.query('select count(*)::int n from rooster_care_plans')).rows[0].n,1);
  assert.equal((await db.query('select count(*)::int n from caretaker_tasks')).rows[0].n,1);
});
await check('payment terms cannot be changed after allocation',async()=>{
  await assert.rejects(db.query('update manual_payment_requests set amount_expected=1 where id=$1',[first.id]),/TERMS_IMMUTABLE/);
});
const second=await submit(6000,'second');
await check('missing feed rolls back approval, animal, plan and stock',async()=>{
  await db.exec(`update farm_products set stock_quantity=0 where id='${feed}'`);
  const stock=(await db.query('select stock_quantity from farm_products where id=$1',[product])).rows[0].stock_quantity;
  await assert.rejects(approve(second.id),/FEED_PACKAGE_UNAVAILABLE/);
  assert.equal((await db.query('select status from manual_payment_requests where id=$1',[second.id])).rows[0].status,'for_review');
  assert.equal((await db.query('select count(*)::int n from customer_animals')).rows[0].n,1);
  assert.equal((await db.query('select stock_quantity from farm_products where id=$1',[product])).rows[0].stock_quantity,stock);
});
await check('legacy preference alone never grants paid care',async()=>{
  await db.exec(`insert into manual_payment_requests(profile_id,source_type,amount_expected,summary,status) values('${profile}','farm_buy',1000,'{"care_preference":"monthly"}','for_review')`);
  assert.equal((await db.query('select count(*)::int n from rooster_order_care_bundles')).rows[0].n,2);
});
await check('raw approval cannot bypass assignment',async()=>{
  await db.exec(`update farm_products set stock_quantity=100 where id='${feed}'`);
  await assert.rejects(db.query("select admin_review_manual_payment_guarded($1,'approved',null)",[second.id]),/REQUIRES_LINKED_CARE_ASSIGNMENT/);
  assert.equal((await db.query('select status from manual_payment_requests where id=$1',[second.id])).rows[0].status,'for_review');
});
await check('anonymous cannot submit a bundle',async()=>{
  await db.exec('set role anon');
  await assert.rejects(submit(6000,'anon'),/permission denied/);
  await db.exec('reset role');
});
await check('authenticated cannot invoke internal package preparation or write allocations',async()=>{
  await db.exec('set role authenticated');
  await assert.rejects(db.query('select prepare_included_rooster_bundle_plan(null)'),/permission denied/);
  await assert.rejects(db.query('delete from rooster_order_care_bundles'),/permission denied/);
  await db.exec('reset role');
});
await check('owner can read allocation but another customer cannot',async()=>{
  await db.exec("set test.admin='false'; set role authenticated");
  assert.equal((await db.query('select count(*)::int n from rooster_order_care_bundles')).rows[0].n,2);
  await db.exec("set test.profile='00000000-0000-4000-8000-000000000009'");
  assert.equal((await db.query('select count(*)::int n from rooster_order_care_bundles')).rows[0].n,0);
  await db.exec('reset role');
});
console.log(`${passed} embedded PostgreSQL fixture tests passed. Full Supabase/mission/browser E2E NOT RUN.`);
await db.close();
}
main().catch(async error=>{console.error(error.message);await db.close();process.exitCode=1;});
