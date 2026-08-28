# Audit / fix cycles — 27 August 2026

## Changes and repeat checks

Cycle 1 addressed the three findings from REAUDIT_090:

- Payment recovery and normal success set a synchronous terminal latch; repeated clicks cannot resubmit on that page, even before a React rerender. Submit is visibly disabled once saved.
- Support recovery now uses a server reconciliation RPC. A saved operation returns its session. An unsaved operation gets a cancellation marker under the same transaction lock as sending, so a late request cannot save after the user is allowed to edit. SQL 091 is required; it has NOT been executed here.
- KYC forms/handlers block pending, approved, loading and error states. Handler checks current saved status again before uploads. In-flight guard covers auth and uploads. Unknown submission outcomes stop immediate resubmission rather than falsely claiming failure.

Cycle 2 inspected failure paths:

- Fixed auth-error cleanup so KYC cannot retain an in-flight lock after an exception.
- Added explicit verification loading/error text instead of an empty form area.
- Added sequence checks so a delayed support refresh cannot replace a newer response.

Cycle 3 repeated local checks:

- 16 tests PASS, including execution of extracted payment/KYC handlers and mocked support component recovery. These are not live database or browser E2E tests.
- Production build PASS (before final polling sequence refinement); final support lint PASS; final TypeScript check reported separately by the task.
- Care-report source contracts PASS.
- Critical lint PASS; full legacy lint debt remains (185 errors, 129 warnings at this run).

## Not yet proven / blocking further completion

There is no claim that the entire application has zero bugs. No configured isolated write-test database or local PostgreSQL tools were available for this run. SQL 091 lock/late-arrival behavior still needs real PostgreSQL concurrency tests and three-role browser tests. Production data was not touched and nothing was pushed.

Existing KYC and support functions have incomplete checked-in definitions. The frontend KYC guard is not a substitute for atomic server-side duplicate protection, especially across tabs or refreshes after an unknown outcome. Session ownership in the underlying support RPCs also needs verification. Do not invent those definitions or disable RLS to complete testing.

Next required evidence: run reports/READ_ONLY_WORKFLOW_BASELINE.sql against the relevant project and provide its definitions; configure an isolated test project; apply/review 091 there. Then test simultaneous retry, late arrival after cancellation, denied ownership, closed chat, and KYC reject/resubmit/unknown response in the actual application.

Deploy new support frontend only together with 091. Without it, recovery remains fail-closed (original key retained) rather than guessing that a request was not saved.
