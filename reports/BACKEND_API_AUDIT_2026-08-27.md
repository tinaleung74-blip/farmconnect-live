# FarmConnect Backend and API Audit

Date: 2026-08-27

## Verdict

The core guarded workflows are structurally sound and the production build passes. The app is not yet fully end-to-end proven because the local audit environment has no Supabase URL/key, seven historical caretaker tasks still lack a durable customer-rooster identity, and the restore drill is not attested.

## Backend developer review

### Passed

- Migration 086 preserves the legacy `caretaker_tasks.animal_id -> animals.id` foreign key.
- Customer ownership now has a separate `caretaker_tasks.customer_animal_id -> customer_animals.id` relationship.
- `customer_get_rooster_diary(uuid)` verifies the caller through `auth.uid()` and rejects a rooster not owned by that customer.
- Anonymous execution is revoked; authenticated execution is granted only through the owner-checked RPC.
- Payment, care-plan, task-proof, withdrawal, rate-limit, and KaFarm safety contracts pass.
- The Next.js production build completes for all 132 routes.

### Findings

#### P1 — Seven caretaker tasks remain unlinked

`unlinked_tasks_remaining = 7` means the task points to a care request, daily mission, or care plan, but none of those linked source rows currently provides a `customer_animal_id` that Migration 086 can safely copy. These rows must not be guessed or auto-linked by rooster name.

Read-only diagnostic:

```sql
select
  task.id as task_id,
  task.status as task_status,
  task.workflow_type,
  task.rooster_name,
  task.rooster_tag,
  task.care_request_id,
  request.customer_animal_id as request_customer_animal_id,
  task.daily_mission_id,
  mission.customer_animal_id as mission_customer_animal_id,
  task.care_plan_id,
  plan.customer_animal_id as plan_customer_animal_id,
  task.created_at
from public.caretaker_tasks task
left join public.farm_care_requests request on request.id = task.care_request_id
left join public.rooster_daily_missions mission on mission.id = task.daily_mission_id
left join public.rooster_care_plans plan on plan.id = task.care_plan_id
where task.customer_animal_id is null
  and (
    task.care_request_id is not null
    or task.daily_mission_id is not null
    or task.care_plan_id is not null
  )
order by task.created_at desc;
```

#### P1 — Diary silently falls back to name matching

If `customer_get_rooster_diary` fails, the Customer V2 Diary catches every error and falls back to the legacy care-log query, then matches records by rooster name or tag. That can hide an RPC outage and can mix records after a rename or when two roosters share a name. The durable ID-based RPC should be authoritative; an error should produce a retryable error state rather than a name-based fallback.

#### P2 — Trigger does not reject a conflicting supplied identity

The Migration 086 trigger derives `customer_animal_id` only when the field is null. Normal writes are Admin-only and current RPCs supply null, so the standard path is safe. For stronger database integrity, a future hardening migration should derive the expected customer animal from the linked source and reject a non-null conflicting value.

#### P2 — Restore readiness is unproven

The recovery contract fails only on the external Supabase restore-drill attestation. Rollback documentation and transactional migrations pass, but a real isolated restore drill is still required.

#### P3 — Legacy route surface remains large

The build still exposes 130 application routes, including old Customer pages beside Customer V2. This does not currently break the API, but it increases test scope and the chance that users enter an obsolete workflow.

## Software/API engineer review

### Verified relationship

1. Customer selects Daily or Monthly Care for a `customer_animals.id`.
2. The frontend creates a care request or care plan using that exact ID.
3. Manual payment uses a guarded RPC with an idempotency key.
4. Admin approval and assignment use guarded Admin RPCs.
5. The task identity trigger copies the source `customer_animal_id` into `caretaker_tasks.customer_animal_id`.
6. Caretaker proof submission uses a guarded proof RPC.
7. Admin proof review releases only approved evidence.
8. Customer Diary reads approved proofs through the owner-checked, ID-based RPC.

### API contract status

- TypeScript: PASS
- Production build: PASS
- Runtime-critical lint: PASS (legacy debt remains: 193 errors and 124 warnings outside the critical gate)
- Security contract: PASS
- Care Plan contract: PASS
- Inbox routing contract: PASS
- Withdrawal/dispute recovery: PASS
- Rate-limit contract: PASS
- KaFarm Guardian and action gate: PASS
- Dependency vulnerability contract: PASS (0 high, 0 critical)
- Database/workflow reconciliation: BLOCKED locally because Supabase URL/key are absent
- Writable business E2E: BLOCKED until an isolated writable Supabase project is configured

## Release recommendation

Do not call the new cross-role care flow fully verified yet. First classify the seven unlinked tasks, remove the Diary's name-based fallback, run authenticated Customer/Admin/Caretaker E2E against an isolated Supabase project, and attest a backup/restore drill. No payment or ownership mutation is required to perform the seven-row diagnostic.
