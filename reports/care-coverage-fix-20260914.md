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

## Bundled Add Rooster checkout — now implemented locally
Migration 110 adds a server-validated allocation of one receipt (rooster price + PHP 5,000), creates the linked plan on ownership approval, includes starter-feed inventory through the existing package/fulfillment engine, and assigns the same caretaker. It does not create a second payment. Day 1 readiness remains required before later missions: `ready` means paid and assigned for preparation, not care already performed.

The UI uses the bundle-specific RPC and disables the monthly selection when its version check is unavailable. A legacy preference is never upgraded into paid care. Existing paid records are NOT backfilled.

Additional verification: 13 real embedded PostgreSQL fixture tests PASS (price, quantity, retry, non-admin/anonymous guards, ownership visibility, immutable allocation, no duplicate payment/plan/task, stock rollback, legacy preference, deferred approval integrity). Auth, legacy order posting and mission generation adapters are fixtures; this is NOT full Supabase integration or mission E2E. 12 display/total/source-contract tests PASS. No production data accessed.

Rendered mobile checkout: 3 Playwright fixture scenarios PASS at http://127.0.0.1:3101/customer-v2/roosters (390x844): monthly total 6,000 for 1,000 rooster + 5,000 care and dedicated RPC; skip total 1,000 and normal RPC; missing migration disables monthly selection. Screenshots saved outside repo in the task visualization folder as bundle-monthly-phone.png and bundle-skip-phone.png. No pageerror in successful runs. Initial Turbopack symlink-root failure was avoided using webpack; blocked Google Font downloads used fallback fonts. Official Browser skill was unavailable; Playwright was used. This is mocked browser/API testing, not actual money transfer or full durable Supabase E2E.

## Release gate
Do not deploy without full isolated-Supabase validation of migrations 109 and 110, in that order. Both remain under `database/pending`, not `applied`. Migration 110 is a one-time transactional migration. Do not run a bulk backfill or charge existing customers again. Existing paid records need explicit reconciliation by payment ID. Bundle approval rejects missing starter feed, exhausted stock or incomplete mission catalog; operations must resolve or return the request, never ask for another payment.

Remaining DB scenarios: pending monthly -> approved+active; pending daily -> approved+assigned; inventory failure -> approval rolled back; same operation repeated -> no duplicate task; missing/stale caretaker -> rejected; customer/anonymous caller -> denied; wrong owner/payment relation -> denied; legacy approved payment -> assign once; both bundled and skip orders -> correct coverage.
