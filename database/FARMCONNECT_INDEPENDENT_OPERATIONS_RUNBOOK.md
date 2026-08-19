# FarmConnect Independent Operations Runbook

## Required production configuration

1. Apply `database/applied/077_kafarm_guardian_durable_monitor.sql` in the FarmConnect Supabase project and preserve its verification output.
2. In Vercel, configure `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, and `KAFARM_MONITOR_ENABLED=true`. Never expose the service-role key through a `NEXT_PUBLIC_` variable.
3. In Supabase Auth URL Configuration, add the production callback `https://farmconnect-live.vercel.app/reset-password` and keep the production Site URL accurate.
4. Leave `FARMCONNECT_RATE_LIMIT_MODE=off` until persistent rate-limit enforcement has been separately reviewed and tested.

## Daily unattended behavior

- Care Plan daily mission generation runs from the existing guarded cron.
- KaFarm Guardian reads stuck workflows, recent runtime incidents, and overdue Care Plan missions.
- New findings are deduplicated into `kafarm_incidents` and appear in Admin KaFarm System Health.
- Monitoring never approves, rejects, pays, refunds, changes ownership, changes KYC, or repairs a workflow.

## Admin operating rule

Open KaFarm System Health daily. For each finding, confirm the source record and first failed step. Use only the existing canonical Admin workflow to continue it. Never repeat a payment, withdrawal, ownership transfer, or approval blindly.

## Recovery and access

- Customers, caretakers, and Admins use Forgot Password for self-service recovery.
- The recovery response never reveals whether an email exists.
- A successful password change signs the user out so they must authenticate with the new password.

## Deployment acceptance

Before calling a release independent-ready:

1. `npm.cmd run build`
2. `npm.cmd run test:security`
3. `npm.cmd run test:kafarm-guardian`
4. `npm.cmd run test:withdrawal-recovery`
5. Apply and verify every new SQL migration.
6. Confirm the production cron returns HTTP 200 with `persistenceError: null`.
7. In an isolated test project, confirm a safe non-business monitor finding appears once, not repeatedly, in Admin System Health.

This runbook does not eliminate the need for a real human Admin. It removes dependence on the developer logging into customer or caretaker accounts for routine operation and diagnosis.
