# User action → database → visible result audit

Date: 2026-08-27

## Verdict, madaling salita

May tunay na backend connection ang maraming importanteng actions. Pero HINDI pa lahat ng page/action ay consistent, at hindi pa natin napapatunayang bawat click ay nakakarating at naipapakita nang tama.

This was a source-code audit of current app/lib RPC calls, major business handlers and checked-in SQL, not a live browser/network or database execution test. No customer records were created/changed. Migration 089 success is user-supplied evidence, not an independent live signature/permission audit.

## How this app actually sends requests

Customer/Caretaker/Admin click → React handler → Supabase JavaScript client → HTTPS Auth/PostgREST RPC or Storage → PostgreSQL function/RLS/transaction → HTTP response → React state/reload of records.

Most business actions do NOT require a separate Next.js `/api` route. Supabase is the backend. The app's own API routes mainly cover KaFarm and scheduled care operations. Opening a modal, filtering, or changing tabs normally does not need a database request.

## Findings to fix

### P1 — Local UI and test scripts do not share one database target configuration

`lib/supabase.ts:3` hard-codes the browser project's URL and public anon key. Data helpers import that client. `scripts/qa/database-contract.mjs` instead reads environment variables. Changing the test environment does not change the browser app's database target. `createIsolatedSupabaseClient` isolates the auth session, NOT the database project.

Impact: a localhost test can touch the same hosted records as live users. Missing test-script environment variables do not mean the browser app is unconnected. The anon key is a public client credential, not by itself a leaked service-role secret.

Fix direction: a shared, explicit environment configuration plus a visible non-production environment indicator; block destructive/test workflows against the production project.

### P1 — Payment response can falsely say nothing was submitted

`lib/farmconnect-v1.tsx:5325` catches a network error and says “Nothing was submitted to admin.” A response can be lost after the database commits. The guarded RPC has a retry key, but this wording claims something the client does not know. The attempt key also lives only in a React ref, so reload loses it.

Fix direction: distinguish confirmed failure from unknown delivery; reconcile by stable operation key and preserve the draft/key until its result is confirmed. Do not automatically create another payment operation.

### P1 — Caretaker Completed Tasks is not database-backed

`app/caretaker/completed/page.tsx` renders `CompletedTasks`. At `lib/farmconnect-v1.tsx:7804`, that component reads localStorage and appends the static `completedTasks` collection. The live submit path writes Supabase, not this local history.

Impact: successfully submitted/approved tasks may not appear there; demo items can appear as though they are actual work. This is a broken database-to-visible-result link.

Fix direction: query authorized task/proof records, show actual submission/review states, and remove unlabeled demo rows from operational routes.

### P1 — Support messages look sent before persistence is confirmed

Customer Support (`lib/farmconnect-v1.tsx:5785`) and Caretaker Chat (`:7930`) append messages and clear the input before awaiting the database RPC. On failure the bubble stays, with only a general warning. If the user message saved but saving the KaFarm response fails, the UI still describes the operation generically as a DB-save failure.

Impact: visible chat bubbles are not evidence that Admin received the message. Support pages load on mount/session changes, with no continuing subscription/poll in these components, so later Admin replies are not guaranteed to appear while the page stays open.

Fix direction: per-message pending/sent/failed status and a stable retry identifier; retain failed text; separate user-message acknowledgement from the automatic reply; refresh/subscription for incoming replies.

### P2 — Signup still does not include the agreed ID/selfie step

`app/signup/page.tsx` renders `FarmerSignupPage`. `lib/farmconnect-v1.tsx:12938` creates Auth/profile records and explicitly sends users to submit KYC later in Settings. The real KYC handler is at `:6240`, with uploads, consent RPC and KYC RPC.

Impact: account signup exists, but the planned combined signup + KYC user journey is not implemented on this route. Account-created does not mean KYC-submitted.

### P2 — Evidence review controls can only change local screen state

`app/admin/evidence/page.tsx` uses the evidence workspace. Unlike farm/issues/verification early returns, it reaches `AdminOperationsDeskFormat`. Its `mark()` at `lib/farmconnect-v1.tsx:12552` only calls React setters. Buttons “Mark Reviewed” / “Flag Issue” do not send an API request or store that decision.

Fix direction: make it explicitly read-only/navigation-only, or implement an authorized persistent evidence-review workflow. Do not present local state as saved Admin action.

### P2 — Some backend source definitions are only reference notes

Support and KYC base definitions in `database/applied/001_support_chat_phase_3a_reference.sql` and `002_kyc_reference.sql` are explicitly reference-only, not recreatable migrations. Later patches rely on those live functions. Source inspection cannot establish their current body, role checks and transaction behavior.

This is NOT proof the live RPCs are missing. It is a reproducibility/audit gap. Obtain read-only live definitions/grants and maintain a complete schema baseline before declaring those backend paths verified.

## Main journey map

| User action | Request/backend | Database/result path | Current source verdict |
|---|---|---|---|
| Signup | Auth signUp → ensure signup profile | Auth user + profiles → route change | Connected; separate KYC, not combined |
| Submit KYC | Private uploads → consent → customer_submit_kyc | KYC/documents → Admin verification | Calls exist; base backend source incomplete, live behavior unverified |
| Add rooster/payment | submitManualPaymentRequest → customer_submit_manual_payment_guarded | manual_payment_requests → Admin review → ownership/inbox | Connected; unknown-network-result wording unsafe |
| Request daily/monthly care | customer_create_care_request / customer_request_care_plan + prepare payment | care request/plan → payment context → payment page | Connected; multiple sequential steps, not one atomic user journey |
| Admin payment approval | admin_review_manual_payment_guarded | guarded business updates → reload queue | Source connected; live transaction not observed |
| Assign caretaker | admin_assign_care_request / admin_assign_care_plan | caretaker_tasks/missions → task read | Source connected; caretaker task page primarily reloads on mount |
| Submit work/correction | caretaker_submit_report_guarded | task_proofs + task/mission state → Admin queue | New unified source path; 089 live execution not tested here |
| Approve work | guarded generic/mission review | review state + existing inventory rules → diary RPC | Source connected; no live multi-role acceptance test |
| View completed work | CompletedTasks | localStorage + static array | NOT a live database history |
| Diary | customer_get_rooster_diary + private signed URLs | approved owner-linked proof → rendered feed | Source connected; photo failure now explicit |
| Sell/evaluate | customer_request_rooster_sale_price / customer_confirm_rooster_sale | sale requests/tasks → reviewed price/release | Source connected; not live verified |
| Withdraw/report problem | guarded withdrawal + dispute RPCs | withdrawal/ledger/dispute → inbox/reload | Source connected; external payout remains manual |
| Inbox read | customer_mark_inbox_item_read | inbox_items → display refresh | Source connected; inbox polling is 10 seconds, not instant delivery |
| Support | role-selected support RPCs | chat messages/sessions → reload | Connected calls, optimistic/partial-failure and incoming-refresh gaps |
| Evidence Mark Reviewed | React setters | no persistence in this handler | UI-only action |

## Static inventory result

Ran `node scripts/qa/audit-rpc-wiring.mjs` (read-only):

- 53 RPC call sites found across app/lib.
- 48 literal call sites match checked-in function names and supplied parameter names.
- 2 use dynamic support function selection; names correspond to reference documentation.
- 3 literal calls have reference-only definitions rather than complete checked-in CREATE FUNCTION bodies: KYC submit/consent and KaFarm support reply.

Matching names is NOT a test of required parameters, types, grants, RLS, deployed version, network delivery or transaction success. Direct `.from(...)`, Auth and Storage requests were reviewed selectively in the journeys above, not exhaustively executed.

## Next work, in order

1. Establish safe shared environment targeting before any write tests.
2. Correct ambiguous payment/support delivery states and persistent retry tracking.
3. Replace completed-task demo/local history with database records; remove or wire fake save/review controls.
4. Align the signup/KYC journey and recoverable multi-step care/payment handoff.
5. Read actual deployed RPC definitions/grants, then run isolated Customer → Admin → Caretaker → Customer tests with both successful responses and interrupted responses.

No claim of “all actions passed” is supported yet.
