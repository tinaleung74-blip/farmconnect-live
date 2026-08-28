# Ten focused audit passes

These are ten scoped local reviews/checks, NOT ten full live end-to-end audits. No production records were changed and nothing was pushed.

| Pass | Focus and evidence | Outcome |
|---|---|---|
| 1 | Payment terminal/retry handler; extracted-handler execution | Recovered success blocks a second click before React rerenders. PASS. |
| 2 | KYC state gate; executed pending/approved/loading/error handler cases | No upload initiated in those states. PASS for frontend; live server transition rules remain unverified. |
| 3 | Support rejected/confirmed/unknown reconciliation; mocked component execution | Draft unlocks only after not_sent; sent clears draft; unavailable reconciliation keeps operation. PASS locally; SQL 091 needs execution testing. |
| 4 | Support account/init boundaries | FIXED: disabled Send until initialization completes; validate saved draft structure; recheck profile before sending. New initialization/account-switch tests PASS. |
| 5 | Delayed support reads | Reviewed refresh sequence invalidation; source assertion PASS. Actual network/browser timing not tested. |
| 6 | Evidence role, photos, navigation | FIXED: explicit caretaker/admin role check, expose every photo through signed links rather than asynchronous popup, ignore superseded photo loads, clear links and stale rows when refresh fails. Source checks PASS. |
| 7 | Missing/malformed environment and production target guard | Executed real compiled configuration module with mocked fetch. Missing/malformed config fails closed; localhost production POST is blocked. PASS. |
| 8 | SQL cancellation/ownership boundaries and RPC wiring | Same-lock/cancellation source assertions PASS. 55 RPC sites: 50 name/parameter matches, 2 dynamic sites, 3 reference-only definitions. Live permission/transaction behavior UNVERIFIED. |
| 9 | Care report rejection/resubmission/evidence contract | Existing behavioral draft tests and source contracts PASS. Does not execute SQL 089. |
| 10 | Combined tests/build/lint | 24 tests PASS. Build PASS before final evidence request-sequence refinement; final TypeScript/lint rerun follows that refinement. Runtime-critical lint checked separately; legacy lint debt remains. |

## Files changed this round

- lib/support-conversation.tsx
- lib/live-evidence-pages.tsx
- scripts/qa/reaudit-behavior.test.mjs
- scripts/qa/ten-pass-contract.test.mjs
- generated KaFarm maps updated by normal build

## Completion boundary

No claim of a bug-free app. The remaining live checks require an isolated Supabase project and the actual KYC/support definitions from reports/READ_ONLY_WORKFLOW_BASELINE.sql. In particular, frontend KYC gating does not prove server-side duplicate prevention across tabs or after unknown responses. Support session ownership still depends on the existing role-specific RPCs. SQL 091 is prepared but has not been applied or PostgreSQL-tested by this task.

Do not independently deploy the support frontend without its required SQL. The latest local tests are not a public-rollout approval.
