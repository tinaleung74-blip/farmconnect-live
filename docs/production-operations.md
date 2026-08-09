# FarmConnect Production Operations

## Release Gate

1. Run `npm run test:readiness` against staging with isolated test accounts.
2. Require zero skipped browser tests and zero open high-severity KaFarm chain findings.
3. Confirm `KAFARM_SQL_GATEWAY_ENABLED=false` in Vercel and remove any unused gateway token.
4. Confirm the deployed commit matches the tested commit.
5. Confirm a recent Supabase backup can be restored into a separate non-production project.

## Database Change Rule

- Use numbered, append-only migrations and run one migration at a time.
- Prefer additive schema changes. Never delete or rewrite production records during a release.
- Run the read-only database contract and KaFarm workflow reconciliation immediately after each migration.
- Stop the release when a migration, RLS contract, or business invariant fails.

## Rollback

- Code failure: redeploy the last verified Vercel commit.
- Additive database failure: leave compatible objects in place, disable the new app path, and ship a forward-fix migration.
- Data corruption or destructive incident: stop writes, preserve logs, and restore the verified Supabase backup into a separate project before any production cutover.
- Never repair wallet balances, ownership, KYC, or approvals by editing one visible row without reconciling its ledger and evidence chain.

## Incident Evidence

Record timestamp, deployed commit, role, route, action, expected result, actual result, request/RPC name, HTTP status, affected record IDs, KaFarm finding, and rollback decision. Do not include passwords, tokens, service keys, full payout numbers, or raw identity documents.

## Restore Drill

The owner must restore a current backup into a separate project, run `test:db` against it, and verify representative customer, caretaker, payment, task proof, wallet, and inbox records. Set `PRODUCTION_RESTORE_DRILL_ATTESTED=true` only for the readiness run that follows a successful documented drill.
