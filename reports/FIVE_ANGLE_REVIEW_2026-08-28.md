# Five-angle senior review

Follow-up: the timeout and composer-blocking findings below are now fixed locally. See `SUPPORT_RECOVERY_COMPLETION_2026-08-28.md` for the 62-test verification and remaining runtime prerequisites. The review below records the pre-fix state.

Scope: latest Support recovery changes and their SQL/API integration. One reviewer, five perspectives; not five independent reviewers or a whole-app certification. Read-only review; no app fixes or production writes.

## 1. Security

Positive: SQL 093 denies ordinary callers access to the trusted writer, checks service_role, and disables the former arbitrary-body RPC. The API validates the user and scopes receipt lookup to that user. Browser-supplied reply content is not accepted.

Evidence: `database/applied/093_support_trusted_replies.sql:15,24,52`; `app/api/support/reply/route.ts:22-29`.

Limit: privilege output is user-supplied; no new live cross-account/RLS test was performed. KYC consent helper/trigger verification remains unresolved. No new confirmed security defect in this focused pass.

## 2. Data integrity

Positive: per-operation persistence retains the other tab's recovery key. SQL's operation lock and reply ID support same-key deduplication. The nine outbox regression tests were rerun and passed.

Evidence: `lib/support-conversation.tsx:135-143`; SQL 093:29-33; `scripts/qa/support-outbox.test.mjs`.

Limit: these are mocked frontend regressions, not a live database concurrency test. Cleared browser storage and operations already lost by the old code cannot be reconstructed by this change.

## 3. Reliability — P2, no application-controlled reply deadline

The reply fetch has no AbortSignal/timeout. The component holds busy=true and sending=true until the awaited call settles, and its message poll skips work while busy. If a connection stalls rather than rejecting, the application has no bounded path to release the UI. Platform/network timeouts may eventually intervene, but the application does not control that duration.

Evidence: `lib/backend/support-chat.ts:53-58`; `lib/support-conversation.tsx:121,128,147,175,182`.

Proposed change: bound reply attempts, preserve the durable receipt on timeout, and unlock the UI. A timeout must mean unknown outcome, not proof the server failed to save. Retrying must use the same receipt. Add never-settling-request tests, not only immediate network exceptions.

## 4. UI/UX — P2, bot failure blocks human support

After the user message is saved, a failed bot reply stays in pending with phase='reply'. The textarea is disabled for every pending value, and the human-support button renders only when pending is absent. Therefore an unavailable bot can prevent a new message or escalation through this UI, even though the original user message is already saved. Reopening restores the same blocking state.

Evidence: `lib/support-conversation.tsx:87,174-176,195,200`.

Proposed change: keep automatic reply recovery separate from the message composer. Allow a new message/human escalation while retaining the old reply receipt. Do not delete the receipt or resend the previous message just to unlock the form. Test a persistent bot outage with a working user-message endpoint.

## 5. Deployment and test evidence

The previous local environment inspection found URL, anon key and server key absent; this review did not inspect Vercel or a differently configured running process. Local setup and actual cross-role testing remain prerequisites. The 51-test total is from the preceding full run; nine focused regressions were rerun in this review and passed.

Next gate: configure an isolated target, confirm matching frontend/API/SQL versions, then exercise customer and caretaker sends, admin escalation/closure, two tabs, and stalled/lost responses in a real browser against the test database. Reload old tabs during rollout so they stop running the old single-slot code.

## Overall verdict

The security and persistence fixes are useful and their targeted regressions still pass. Do not mark the Support journey complete: separate bot availability from the user's ability to contact support and add a bounded timeout. No evidence here establishes readiness of unrelated payment, KYC, withdrawal, or caretaker-task workflows.
