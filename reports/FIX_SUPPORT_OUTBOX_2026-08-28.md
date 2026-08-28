# Senior review follow-up: Support recovery fixes

## Fixed locally

1. Every pending operation now has its own account-scoped localStorage entry. Confirming or cancelling one operation deletes only that entry. Other tabs' pending submissions survive and are restored on reopening.
2. After a user message is acknowledged, its operation becomes a durable reply-recovery record BEFORE the automatic reply is requested. Failed replies show **Retry reply**. This action calls only the reply API, never the user-message submission RPC. Reopening restores the action.
3. If the browser closes or storage fails before recording the acknowledgement, the original submission record remains. Its retry uses the same SQL idempotency key, not a new message key.
4. Multiple recovered operations are handled one at a time. Finishing one exposes the next. Valid legacy single-slot drafts are imported; damaged entries are preserved until explicit recovery.

No new SQL migration is required: these changes rely on existing 090-093, including server-side reply deduplication. No production data, secrets, deployment, or push was changed.

## Verification

- 51 tests passed, including 9 new component-handler regression cases.
- The two-tab overwrite scenario now preserves the second operation after the first completes and after reload.
- Customer and caretaker reply retries after reload make zero user-submit RPC calls.
- Network exceptions, interrupted reply calls, storage failure during phase transition, account isolation, queue draining, and escalation behavior covered.
- TypeScript and targeted ESLint passed.
- Tests run transpiled application code with mocked services/storage; these are NOT actual browser/Postgres end-to-end results.
- The old `reports/senior-support-audit-repro.mjs` entry now runs the regression suite instead of asserting that historical defects remain present.

## Rollout and limits

Deploy matching frontend/API code and reload old Support tabs so they no longer run the previous single-slot writer. Retrying an operation from multiple new tabs relies on existing SQL 091/093 same-key protections.

Reply recovery is user-triggered, not a background worker. It requires reopening the same browser profile with its local storage retained. This fix does not recover records manually cleared from browser storage or reconstruct already lost legacy operations.

Local database URL/anon/server-key configuration remains missing from the environment previously checked. Set up an isolated target before real workflow tests. Vercel configuration was not inspected. KYC consent helper/trigger verification is still a separate open audit item.
