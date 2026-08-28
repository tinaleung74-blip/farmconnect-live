# FarmConnect: fix pass and re-audit

Date: 2026-08-27

## Verdict in plain language

May naayos nang totoong problema sa code. Hindi pa ito full live PASS.
Kailangan munang patakbuhin ang migration 088 at subukan ang buong correction-to-diary flow sa isolated test database. Walang production business records na binago o binura sa fix pass na ito. Walang push/deploy.

## 1. Backend developer — ang tagabantay ng records

- Added migration `088_care_report_submission_guard.sql`.
- New generic submission RPC v4 checks the assigned caretaker, validates report fields and task-scoped evidence paths, and writes structured report data.
- A unique submission key and transaction lock return the same proof on a retry instead of inserting another report.
- Existing v3 remains for specialized mission callers; their inventory guards are not bypassed.
- Customer storage reads now cover all photos linked to an approved proof, not only the first photo. This policy is pending migration application.

Remaining: specialized monthly/manual mission RPCs still use their existing submission path and marker-based report format. The new v4 idempotency guarantee must NOT be claimed for those paths. Full migration of these callers requires dedicated inventory/retry tests.

## 2. API developer — ang tagahatid ng request at response

- Customer Diary signs private evidence URLs before displaying them.
- Removed silent diary fallback that matched old records by name/tag. A failed ID-based read now shows a retry/error state instead of potentially unrelated history.
- Missing signed images retain their original positions, so a later photo is not shown against the wrong entry.
- Caretaker backjob loads the newest returned report, notes and photo paths.
- Generic submissions call v4 with a stable key for retries during the open task session.

Remaining: keys are not persisted across browser reloads; the task-state guard still blocks another submission after success, but recovery UX across reloads needs a live test. Upload retry can leave unreferenced files; no automatic cleanup was added. Signed URL expiry needs a long-session test.

## 3. Software engineer — ang tagabantay ng buong journey

- Admin actions now distinguish Return for Correction from Reject and Close Task, with a confirmation for closing.
- Returned reports restore timed entries and previous photos instead of starting empty.
- Entry order stays aligned with photo order. Removing an entry removes its matching photo. Removing a daily-report photo also removes the paired entry; the replacement entry/photo is added again.
- Frontend validates the same time, text-length and five-entry limits as the new generic backend.
- KaFarm generated maps were refreshed by the build; this is a static map, not live evidence.

Remaining: mission checklist/feed quantities are not fully restored by the draft loader and must be re-entered/verified. Legacy routes, the large shared UI module and lint debt remain. Seven previously reported unlinked historical tasks require factual identification, not automatic guessing. This pass does not claim those records were repaired.

## Re-audit results

| Check | Result |
|---|---|
| Production build and TypeScript | PASS |
| Runtime-critical lint | PASS; full legacy lint is not clean |
| Security source contract | PASS |
| Care-plan contract | PASS |
| Inbox routing contract | PASS |
| Withdrawal recovery contract | PASS |
| KaFarm Guardian and protected-action gate | PASS |
| New care-report submission source contract | PASS; static assertions only |
| Live database contract | BLOCKED: missing local Supabase public URL/key |
| Live workflow reconciliation | BLOCKED: missing local Supabase URL |
| SQL 088 execution and concurrent retry test | NOT RUN |
| Browser three-role E2E | NOT RUN |

These passes are not proof that all workflows work in production. No zero-bug or unrestricted-rollout claim is made.

## Required next test

1. Apply migration 088 before using the modified frontend (it needs the new columns and RPC).
2. In an isolated test project: caretaker sends a report with three timed photos.
3. Admin returns it with a correction note. Caretaker reopens and verifies the old entries/photos are present, corrects and resubmits.
4. Retry the same generic submission key concurrently: exactly one proof ID must result.
5. Admin approves. Customer sees only their rooster's approved entries with matching photos.
6. A different customer cannot read/sign those photos. Pending/rejected photos stay private.
7. Test Reject and Close separately; no correction task or approved diary entry should result.
8. Test monthly/manual mission paths separately, including inventory deductions and returned checklists.

Public rollout remains NOT_READY until the earlier isolated E2E, restore drill, owner rehearsal and operational release gates are genuinely satisfied.
