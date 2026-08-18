# FarmConnect Care Plan deployment runbook (058-066 + 069-070)

Migrations 058-062 were applied in order and passed a controlled customer-admin-caretaker E2E on 2026-08-14 (Asia/Manila). Migrations 063-066 and 069 change the current workflow and require a new isolated qualification before release. The historical pass does not prove those later changes.

## 0. Isolated local qualification

Do not point account creation or business-flow tests at the FarmConnect production Supabase project. The E2E harness permanently rejects `bfckjrqrixbtqqvsxgjq.supabase.co`, even when a write flag is set.

1. Run `npm run test:e2e-target`. It must pass.
2. Use a dedicated non-production Supabase test project. A local Docker stack is optional, not required.
3. Export **schema only** from production into `test-results/local-supabase/public-schema.sql`. Never copy customer rows, auth users, evidence, payments, wallets, KYC, or storage objects into the isolated test project.
4. Configure `.env.local` with the isolated test-project URL/keys and a test cron secret. Environment files remain Git-ignored.
5. Run `npm run test:local-care-plan-preflight`. Every line must pass before creating test accounts. The target guard must prove that the URL is not the FarmConnect production project.
6. Apply migrations 058-066 and 069 to the isolated database and run the complete readiness suite there.

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
6. `database/applied/063_unified_care_plan_manual_mission_inventory_guard.sql`
7. `database/applied/064_care_plan_task_management_assignment.sql`
8. `database/applied/065_fixed_5000_care_plan_package_day1_readiness.sql`
9. `database/applied/066_care_plan_task_checklist_compatibility.sql`
10. `database/applied/069_care_plan_customer_feed_balance_pricing_contract.sql`
11. `database/applied/070_kafarm_care_plan_health_qr_classification.sql`

Files 067 and 068 are unapplied KaFarm Guardian proposals and are not part of this Care Plan deployment sequence.

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

1. Give the isolated customer one approved rooster and a customer-owned feed item with a verified kg-per-unit conversion.
2. Lower the feed balance below the catalog requirement. Confirm the 30-day Care Plan request fails with `CARE_PLAN_CUSTOMER_FEED_BALANCE_INSUFFICIENT` and creates no payable plan.
3. Restore sufficient customer-owned feed, then request one 30-day Care Plan. Confirm the server derives the start day from `acquired_at`, reserves the exact catalog kilograms, sets purchase quantity to zero, and locks PHP 5,000.
4. Customer submits the exact manual-payment amount with test evidence.
5. Admin approves once. Confirm the plan is `paid_pending_setup`.
6. Admin assigns one active caretaker through Task Management. Confirm Day 1 preparation plus care is generated once and no farm-stock purchase or customer inventory credit occurs.
7. Run the scheduler again for the same date and confirm it creates zero duplicates.
8. Assigned caretaker completes one mission with checklist evidence and actual feed kilograms.
9. Admin approves once. Confirm inventory changed once to three decimal places and the customer received an inbox calculation.
10. Pause and resume the plan in a controlled test. Confirm the remaining schedule shifts by the paused days while total mission count remains equal to the package duration.
11. Read KaFarm Care Plan health again. Any new finding blocks production activation until reviewed.

## 5. Release gate

The feature is production-ready only after the production build, Care Plan contract, security contract, database verification, controlled role test, scheduler retry, exact inventory assertion, and KaFarm health check all pass on the same deployed revision.

Historical controlled qualification result for migrations 058-062 (2026-08-14 Asia/Manila): **PASS**. Current 063-066 + 069 qualification: **NOT YET RUN**.
