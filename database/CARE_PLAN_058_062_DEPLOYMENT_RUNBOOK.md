# FarmConnect Care Plan deployment runbook

Migrations 058-062 were applied in order and passed a controlled customer-admin-caretaker E2E on 2026-08-14 (Asia/Manila). The isolated dummy profile and all of its transaction records were removed after verification. Deploy only the same reviewed application revision and keep the release gate below green.

## 0. Isolated local qualification

Do not point account creation or business-flow tests at the FarmConnect production Supabase project. The E2E harness permanently rejects `bfckjrqrixbtqqvsxgjq.supabase.co`, even when a write flag is set.

1. Run `npm run test:e2e-target`. It must pass.
2. Start a local Supabase stack with Docker.
3. Export **schema only** from production into `test-results/local-supabase/public-schema.sql`. Never copy customer rows, auth users, evidence, payments, wallets, KYC, or storage objects into the local test stack.
4. Configure `.env.local` with loopback Supabase URL/keys and a local cron secret. Environment files remain Git-ignored.
5. Run `npm run test:local-care-plan-preflight`. Every line must pass before creating test accounts.
6. Apply migrations 058-062 to the isolated local database and run the complete readiness suite there.

The repository change ledger is not a complete baseline dump, so a fresh empty Supabase database is insufficient by itself. Use a reviewed schema-only baseline of the live public schema.

## 1. Pre-deployment

1. Take a Supabase database backup or confirm point-in-time recovery.
2. Deploy the application code only in a controlled maintenance window.
3. Configure these Vercel Production environment variables without copying their values into Git:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `CRON_SECRET`
4. Use a long random `CRON_SECRET`. Vercel Cron must send it as `Authorization: Bearer <CRON_SECRET>`.

## 2. Apply database migrations

Run these files one at a time in this exact order:

1. `database/applied/058_care_plan_mission_engine_foundation.sql`
2. `database/applied/059_care_mission_catalog_seed.sql`
3. `database/applied/060_care_plan_mission_proof_inventory_guard.sql`
4. `database/applied/061_care_plan_quote_payment_activation.sql`
5. `database/applied/062_care_plan_production_lifecycle.sql`

Stop immediately if a transaction fails. Do not skip ahead. Preserve the complete SQL error and the last successful verification result.

## 3. Required verification

Run `database/00_verify_applied_sql_status.sql`, then as an authenticated admin run:

```sql
select public.kafarm_care_plan_health_snapshot();
```

Required starting state:

- `catalog_days = 180`
- `active_supply_conversion_missing = 0`
- `negative_inventory = 0`
- `pending_refunds = 0` unless a real refund is already waiting
- no missing object in `database/00_verify_applied_sql_status.sql`

## 4. Controlled end-to-end validation

Use one clearly labelled test rooster and the existing approved customer, admin, and caretaker test roles. Do not use real payment money.

1. Customer requests one 30-day Care Plan.
2. Admin selects an active caretaker and a feed inventory item, records its verified kg-per-unit conversion, and locks the quote.
3. Customer submits the exact quoted manual-payment amount with test evidence.
4. Admin approves once. Confirm the plan is `paid_pending_setup`.
5. Admin activates with a future Manila start date. Confirm missing feed stock is purchased once and the exact package feed is reserved once.
6. Run the scheduler for the eligible date. Run it again and confirm the second call creates zero duplicates.
7. Assigned caretaker completes one mission with checklist evidence and actual feed kilograms.
8. Admin approves once. Confirm inventory changed once to three decimal places and the customer received an inbox calculation.
9. Pause and resume the plan in a controlled test. Confirm the remaining schedule shifts by the paused days while total mission count remains equal to the package duration.
10. Read KaFarm Care Plan health again. Any new finding blocks production activation until reviewed.

## 5. Release gate

The feature is production-ready only after the production build, Care Plan contract, security contract, database verification, controlled role test, scheduler retry, exact inventory assertion, and KaFarm health check all pass on the same deployed revision.

Controlled qualification result (2026-08-14 Asia/Manila): **PASS**. Scheduler retry created `1` then `0`; approved mission usage changed the dummy feed ledger from `100.000` to `99.975` kg exactly; final KaFarm Care Plan health returned zero open issues; pre-test database counts were restored after cleanup.
