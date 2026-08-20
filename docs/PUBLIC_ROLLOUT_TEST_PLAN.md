# FarmConnect Public Rollout Test Plan

## Release rule

Run `npm.cmd run test:public-rollout`. The only acceptable public-release verdict is `PUBLIC_ROLLOUT_READY`. Missing evidence is a blocker, not a skipped pass.

The gate never writes to the FarmConnect production database. Writable E2E runs only against localhost Supabase or a disposable project explicitly acknowledged with `E2E_ISOLATED_PROJECT_ACK=true`.

## Automated coverage

- Production build and runtime-critical lint.
- Dependency and security contracts.
- Auth ownership, private KYC storage, password recovery, and production-write isolation.
- Customer payment retry idempotency and Admin decision idempotency.
- Farm Buy ownership creation exactly once.
- Care Plan price, customer-owned feed sufficiency, daily mission generation, caretaker evidence, health escalation, exact inventory deduction, cancellation, and external refund audit.
- Sell, wallet, withdrawal, dispute, Inbox, and recovery guards.
- Customer, caretaker, and Admin page matrix on desktop, phone, and tablet.
- KaFarm protected-action freeze and durable incident-monitor safety.

## Required external proof

After performing each real check, set its environment flag to `true` for the final run:

- `PRODUCTION_MONITOR_VERIFIED`
- `PASSWORD_RESET_LIVE_VERIFIED`
- `PRODUCTION_RESTORE_DRILL_ATTESTED`
- `OWNER_REHEARSAL_ATTESTED`
- `LEGAL_PRIVACY_REVIEW_ATTESTED`
- `SUPPORT_ESCALATION_READY`
- `CONTROLLED_PILOT_ATTESTED`

Never set an attestation merely to make the report green. Preserve screenshots, timestamps, operator name, test project ID, and incident/restore evidence outside the repository.

## Public release blockers

- Any critical/high defect.
- Any duplicate wallet, inventory, payment, ownership, or approval mutation.
- Any cross-account data visibility.
- A missing or failed backup/restore drill.
- Missing persistent rate-limit enforcement.
- Any failed or skipped role/device workflow.
- No named incident owner.
- Owner cannot operate the Admin queues without developer intervention.
