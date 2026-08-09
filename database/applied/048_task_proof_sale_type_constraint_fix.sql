-- FarmConnect task proof sale-type compatibility fix.
-- Safe migration: expands the existing proof type constraint without changing rows.

begin;

alter table public.task_proofs
  drop constraint if exists task_proofs_proof_type_check;

alter table public.task_proofs
  add constraint task_proofs_proof_type_check
  check (proof_type in (
    'photo',
    'video',
    'sale_price_photo',
    'sale_release_acknowledgement'
  ));

create or replace function public.task_proof_sale_type_constraint_fix_version()
returns text
language sql
stable
set search_path = public
as $$
  select '048_task_proof_sale_type_constraint_fix';
$$;

revoke all on function public.task_proof_sale_type_constraint_fix_version() from public, anon;
grant execute on function public.task_proof_sale_type_constraint_fix_version() to authenticated, service_role;

commit;

select
  'task_proof_sale_type_constraint_fix_ready' as check_name,
  count(*) as count
from pg_constraint
where conrelid = 'public.task_proofs'::regclass
  and conname = 'task_proofs_proof_type_check'
  and pg_get_constraintdef(oid) like '%sale_price_photo%'
  and pg_get_constraintdef(oid) like '%sale_release_acknowledgement%';
