# Support recovery: local implementation completion

## Completed for the five-angle findings

- Bot-reply recovery is separate from pending user submissions. The message composer and human-support action remain available during a failed or in-flight automatic reply.
- The reply helper has a 15-second deadline covering session lookup, HTTP fetch and response parsing. It aborts the fetch and returns an unconfirmed result on timeout.
- The UI has a 20-second outer deadline covering account revalidation too. Late completion after this deadline cannot delete the stored receipt. The user-message sending flag is independent of reply processing.
- Only a valid `saved` or `skipped` reply response clears the durable receipt. An HTTP 200 with an unexpected body is not accepted as confirmation.
- Per-operation storage, reload restoration and same-key reply-only retries remain intact. A new message does not overwrite the prior bot-reply receipt.

Timeout means unknown outcome, not proof the database did not save. Retry uses the original receipt and SQL 093's idempotency protection. These client changes need no new migration.

## Checks performed

62 local tests passed across eight files. Coverage includes old guards and new timeout/composer regressions: stalled auth, stalled fetch, stalled response body, stalled account recheck, late reply completion, malformed success responses, customer/caretaker reply-only retry, two tabs, reload, and human escalation while a bot receipt remains pending. TypeScript and targeted ESLint also passed.

These tests use transpiled code and mocked services/timers/storage, plus SQL source contracts. They are not real browser or Postgres end-to-end results. No claim of whole-app readiness is made.

## Still required outside this local fix

- Configure an isolated test project URL, anon key and server-only service key, and confirm migrations through 093 there. The previously inspected local environment lacked those values; Vercel was not inspected.
- Run real customer/caretaker/admin workflow tests against that target, including timeout and concurrency cases.
- Verify KYC consent using the outstanding read-only helper/trigger query.
- Deploy the matching frontend/API together and reload old tabs. No push, deployment, production SQL, business-data mutation or secret changes were performed here.

Reply retries are user-triggered; no background worker or cross-device recovery was introduced. This deadline is specific to automatic reply handling, not a claim that every app request now has a timeout.
