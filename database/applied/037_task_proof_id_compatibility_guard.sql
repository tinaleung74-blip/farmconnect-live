-- FarmConnect task proof ID compatibility guard.
-- Keeps the legacy task_id and canonical caretaker_task_id synchronized for
-- every current and future task-proof insert/update path.

begin;

create or replace function public.sync_task_proof_task_ids()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.task_id := coalesce(new.task_id, new.caretaker_task_id);
  new.caretaker_task_id := coalesce(new.caretaker_task_id, new.task_id);

  if new.task_id is null or new.caretaker_task_id is null then
    raise exception 'TASK_PROOF_TASK_ID_REQUIRED';
  end if;

  if new.task_id <> new.caretaker_task_id then
    raise exception 'TASK_PROOF_TASK_ID_MISMATCH';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_task_proof_task_ids on public.task_proofs;
create trigger trg_sync_task_proof_task_ids
before insert or update of task_id, caretaker_task_id
on public.task_proofs
for each row execute function public.sync_task_proof_task_ids();

-- Repair nullable aliases on existing records without touching valid IDs.
update public.task_proofs
set task_id = coalesce(task_id, caretaker_task_id),
    caretaker_task_id = coalesce(caretaker_task_id, task_id)
where task_id is null or caretaker_task_id is null;

commit;

select 'task_proof_id_compatibility_guard_ready' as check_name, count(*) as count
from pg_trigger
where tgrelid = 'public.task_proofs'::regclass
  and tgname = 'trg_sync_task_proof_task_ids'
  and not tgisinternal;
