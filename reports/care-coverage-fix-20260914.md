# Care approval/Diary repair — local, not released

## Implemented
- One RPC approves a care payment and assigns its task/activates its plan in one transaction, preserving existing payment, inventory and mission guards.
- Reuses the rooster's QR-task caretaker unless the admin explicitly selects one. Rejects inactive workers, cross-profile/payment mismatches and conflicting existing assignments.
- Does not fall back to separate approval if the new RPC is absent or assignment fails.
- Diary prioritizes an active/paid plan over a newer unpaid draft, handles paused/draft states, refuses payment after a failed refresh, and does not substitute a different rooster when an ID is missing.
- UI prevents starting another monthly payment when a paid plan is already known.

## Verification
- PASS: 8 executable display/selection unit tests.
- PASS: 1 SQL source-contract test (not a database execution).
- PASS: existing care-plan contract script (static).
- PASS: TypeScript check.
- BLOCKED: isolated PostgreSQL execution, transactional rollback, real RPC authorization and retry/concurrency tests. No local PostgreSQL/Docker executable or isolated database was available in this session.
- NOT RUN: browser end-to-end payment/approval/Diary journey.
- NOT VERIFIED: Kelso's actual live payment and plan linkage. No production records accessed or changed.

## Still unfinished: bundled Add Rooster checkout
The current Add Rooster monthly selection stores a preference and charges only the rooster price. This patch does NOT convert that into a combined payment. A safe combined flow requires a server-priced package allocation linked to the plan, plus feed reservation/fulfillment. Existing monthly setup requires customer-owned feed while the UI advertises included feed; do not remove inventory guards or manufacture paid plans to conceal this mismatch.

## Release gate
Do not deploy the UI without validating and applying database/pending/109_care_payment_approve_assign.sql in an isolated environment first. It is intentionally not filed under applied. Do not run a bulk backfill or charge existing customers again. Existing paid records need explicit reconciliation by payment ID.

Remaining DB scenarios: pending monthly -> approved+active; pending daily -> approved+assigned; inventory failure -> approval rolled back; same operation repeated -> no duplicate task; missing/stale caretaker -> rejected; customer/anonymous caller -> denied; wrong owner/payment relation -> denied; legacy approved payment -> assign once; both bundled and skip orders -> correct coverage.
