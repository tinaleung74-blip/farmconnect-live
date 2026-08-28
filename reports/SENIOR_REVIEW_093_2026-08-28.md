# Senior review of recent backend/API work — 2026-08-28

Follow-up: the two Support findings below were subsequently fixed locally. See `FIX_SUPPORT_OUTBOX_2026-08-28.md` for 51-test results and remaining runtime prerequisites. The findings below describe the audited pre-fix state.

Reviewer: one agent using three separate review perspectives, not three independent people. Scope: the recent Support changes, SQL 093, its API/frontend integration, and the FIX_093 report/tests. This does not certify every customer, admin, caretaker, payment, or KYC workflow.

## Findings first

### P2 — Multiple tabs can erase another pending operation's recovery record

Evidence: `lib/support-conversation.tsx`, initialization key `farmconnect.support.pending.${profile.id}`, send's localStorage.setItem, and unconditional localStorage.removeItem after confirmation or reconciliation.

Reproduced using the actual transpiled component handler with two mocked tabs sharing storage:
1. Tab A sends operation A.
2. Tab B sends operation B; the one per-account storage slot now holds B.
3. A is confirmed and deletes that slot, even though it now belongs to B.
4. B's response and reconciliation fail. B remains unconfirmed in memory but has no durable recovery key after a reload.

The database's same-key idempotency is not disproven. The UI loses the key needed to use it. Re-entering the message can create a new operation and a duplicate if B actually committed.

Recommended fix: persist separate records keyed by account AND operation ID, delete only the confirmed operation, and reconcile pending records on initialization. If choosing a single-flight design instead, coordinate tabs reliably; a per-component busy ref is insufficient. Add a multi-tab regression test.

### P2 — Saved user messages have no recovery path for failed automatic replies

Evidence: `lib/support-conversation.tsx`, confirmation clears pending/storage before saveKaFarmSupportMessage; initialization restores only pending user submissions. `lib/backend/support-chat.ts` calls the reply endpoint once. The UI poll only reads messages/status.

Reproduced: message save succeeds, reply returns an error, pending and storage are empty, and the UI merely says automatic reply unavailable. Reopening does not schedule the missing reply. Closing the tab between the save and reply calls has the same gap.

This does NOT lose the already saved user message and does not imply it was unseen by admin. It leaves the promised automated reply unrecovered. SQL 093 prevents duplicate replies when retried, but nothing here guarantees that retry occurs.

Recommended fix: expose a safe reply-only retry using the original receipt, and/or process saved operations with missing replies in trusted backend logic. Never resend the user message to recover a bot reply. Test interrupted delivery between the two calls and verify one user message plus one reply.

### Local test prerequisite missing — database configuration

A fresh process loaded this repository's development environment using @next/env. Only presence booleans were printed:
- NEXT_PUBLIC_SUPABASE_URL: absent
- NEXT_PUBLIC_SUPABASE_ANON_KEY: absent
- SUPABASE_SERVICE_ROLE_KEY: absent

This is NOT an inspection of Vercel or an already-running server process with a different environment. It establishes that tests launched with the checked local environment cannot exercise the real configured database. Do not copy production secrets into an isolated test setup; use matching test-project credentials.

## 1. Senior backend perspective

SQL 093 correctly closes the old arbitrary-body reply RPC in its definition, revokes authenticated execution, restricts the trusted writer to service_role, checks a stored operation, and serializes reply creation. Session status is checked under a row lock before insertion. These are sound source-level improvements.

The user's supplied 093 result supports the reported role privileges; this reviewer did not execute it independently. Actual concurrent Postgres execution, trigger side effects, and full RLS policies have not been tested here. The missing KYC helper/trigger definitions remain an explicit verification gap, not a proven defect.

## 2. Senior API perspective

The route validates the bearer token with getUser, reads the receipt using that verified user ID, rejects extra client fields, and generates reply text from the saved body. It does not trust a client-supplied actor or system message. Failure responses do not expose a server secret.

However, the route's ability to safely accept a retry is not equivalent to a working end-to-end retry mechanism. The reply-recovery finding above is the missing link. Server configuration/deployment must also be validated before calling the integration complete.

## 3. Software engineer perspective — cross-checking the work and report

The earlier fixes address real defects, but the delivery design still has gaps between browser persistence, database acknowledgement, and bot response. Both senior perspectives must be combined: a safe database operation alone does not guarantee the customer finishes the workflow.

Corrections to interpretation of the previous report:
- '42 tests passed' is accurate; re-run produced 42 passes. They are mocked behavior and source contracts, not 42 real workflows.
- 'Duplicate protection' is limited to retries retaining the same operation key; the multi-tab case loses that guarantee at the frontend.
- 'Recovery' covers initialization/user-send reconciliation, not missing bot replies.
- 'Another user receipt' tests mock a missing result and inspect filters; they are not an actual cross-account database attack test.
- SQL 093 applied status is user-reported, and deployment remains unverified. Earlier report language saying it still needs application predates that supplied verification.

## Evidence and next work

Run `node reports/senior-support-audit-repro.mjs` from the repository. It reproduces the two gaps with fake services; it makes no network calls or real data changes. Existing six test files still pass 42/42 while those gaps reproduce, demonstrating the coverage limitation.

Order: repair per-operation browser persistence; add independent reply recovery; configure an isolated target; then run real customer/caretaker/admin checks with disconnects, two tabs, and same-operation retries. Resolve the KYC definition gap separately before KYC sign-off.

Verdict: approve the direction of the security fix, withhold end-to-end completion sign-off. Audit artifacts only were added in this review; application and production data were not changed.
