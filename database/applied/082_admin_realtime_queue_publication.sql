-- Live Admin queue publication with RLS-preserving Supabase Realtime delivery.
-- This publishes row changes only. It performs no approval, payment, KYC,
-- ownership, inventory, payout, or other business mutation.

begin;

do $$
declare
  v_table text;
  v_tables text[] := array[
    'customer_kyc_profiles',
    'caretaker_applications',
    'manual_payment_requests',
    'farm_care_requests',
    'rooster_care_plans',
    'caretaker_tasks',
    'task_proofs',
    'rooster_sale_requests',
    'withdrawal_requests',
    'withdrawal_disputes'
  ];
begin
  foreach v_table in array v_tables loop
    if to_regclass(format('public.%I', v_table)) is not null
      and not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = v_table
      ) then
      execute format('alter publication supabase_realtime add table public.%I', v_table);
    end if;
  end loop;
end;
$$;

create or replace function public.kafarm_admin_realtime_status()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'migration', '082_admin_realtime_queue_publication',
    'published_tables', coalesce(jsonb_agg(tablename order by tablename), '[]'::jsonb),
    'published_count', count(*)
  )
  from pg_publication_tables
  where pubname = 'supabase_realtime'
    and schemaname = 'public'
    and tablename = any(array[
      'customer_kyc_profiles','caretaker_applications','manual_payment_requests',
      'farm_care_requests','rooster_care_plans','caretaker_tasks','task_proofs',
      'rooster_sale_requests','withdrawal_requests','withdrawal_disputes'
    ]);
$$;

revoke all on function public.kafarm_admin_realtime_status() from public, anon, authenticated;
grant execute on function public.kafarm_admin_realtime_status() to service_role;

commit;

select public.kafarm_admin_realtime_status() as verification;
