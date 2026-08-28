-- Read-only: supply these definitions to resolve the outstanding consent audit gap.
select p.oid::regprocedure::text as signature, pg_get_functiondef(p.oid) as definition
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in
 ('customer_record_kyc_consent','customer_submit_kyc','run_kyc_system_checks');

select c.relname as table_name, t.tgname as trigger_name,
 pg_get_triggerdef(t.oid) as trigger_definition,
 pg_get_functiondef(t.tgfoid) as trigger_function
from pg_trigger t join pg_class c on c.oid=t.tgrelid
join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in ('kyc_consents','customer_kyc_profiles')
and not t.tgisinternal;
