# Pre-test audit after migration 088

Date: 2026-08-27. Scope: current local care submission, correction, Admin review and customer diary code plus migrations. Read-only code audit; no application changes, database mutations, browser workflow tests or test-account actions. The user supplied successful migration 088 output; live definitions and permissions were not independently queried.

## Verdict

HOLD the final acceptance test. The earlier build/source-contract PASS did not prove workflow correctness. The following gaps remain, including gaps in the recent fixes.

## Backend developer

### P1: Approved evidence is not immutable in the checked-in storage policy

`database/applied/033_caretaker_task_proof_storage.sql:50` allows an authenticated uploader to update their own task-folder objects without checking whether the photo has already been submitted/approved. Migration 088 changes SELECT, not this UPDATE policy. The normal UI uses non-overwriting uploads, but that is not a backend restriction.

Simple example: the photo reviewed by Admin could later be replaced at the same path. Customer sees a different image under the old approval. This is a policy-level risk, not an observed live exploit.

Proposed fix: make submitted evidence immutable; corrections must create new objects and new proof versions. Verify the actual live storage policies before changing them.

### P2: v4 is only one submission path

`lib/farmconnect-v1.tsx:7297` uses specialized mission RPCs for paid/manual missions; the generic branch alone passes the v4 submission key. SQL 088 also accepts `p_daily_report = null` without checking whether the task requires a daily report, and validates path shape rather than object existence.

Proposed fix: enforce report requirements by workflow on the server and extend retry/validation guarantees to specialized paths without bypassing inventory rules. Do not describe all submissions as idempotent based on v4 alone.

## API developer

### P1: Mission checklist completion is manufactured by the client

`lib/farmconnect-v1.tsx:7267` and the following four groups map every checklist item to `checked: true`. The screen at approximately line 7470 renders these as a static list, not per-item completion inputs. Admin then displays those counts as completed.

Simple example: the report says every health/housing check was done even though the caretaker never marked those items. This is a correctness issue independent of database connectivity.

Proposed fix: explicit completion inputs, or remove the claim that a displayed instruction list is verified completion. The backend should validate actual required answers.

### P2: Diary can silently lose legacy photos or hide retrieval failure

`lib/farmconnect-data.ts:778` chooses `row.images` whenever it is an array, even if empty. Migration 087 returns an empty array for a legacy proof with no `proof_file_urls`, while still returning a valid scalar `image`. That scalar is ignored. Signing failures at line 782 are also converted to blank images without a visible evidence error.

Proposed fix: fall back to the scalar image when the array is empty; keep positional placeholders and show a retryable photo error rather than silently omitting evidence.

## Software engineer

### P1: Returned mission health state is reset to PASS

`lib/farmconnect-v1.tsx:6945` sets health to PASS on opening any task. `getCaretakerActiveTasks()` at `lib/farmconnect-data.ts:246` does not retrieve the prior health result, checklist or inventory usage. Notes/photos restore, but a returned WATCH or ISOLATE report starts as PASS.

Simple example: Admin asks for a corrected photo, but the report's health choice changes as well unless the caretaker notices. Proposed fix: restore all correction fields; where old data is missing, require a fresh explicit choice instead of defaulting to PASS.

### P1: Automatic next-task selection skips correction restoration

`lib/farmconnect-v1.tsx:7324` selects the next task directly after submission, then clears notes/photos. It does not call `resetDraft(nextTask)`. If that next task is a backjob, it appears open with an empty draft; mission health/feed state can also remain from the previous task until the queue item is clicked again.

Proposed fix: use one task-opening initializer for initial load, queue clicks and automatic next-task selection, or leave no task selected after submission.

## What is supported by the audit

- v4 contains an ownership check, transaction lock and unique key for generic submission retries.
- 088 expands customer photo reads to every photo in an approved linked proof.
- Diary reads use rooster ID rather than silently falling back to name/tag matching.
- Correction and final rejection are distinct Admin actions.

These are source-code observations, not live E2E PASS results. The migration verification output only establishes the reported RPC-presence check; it does not test all report, storage or role behavior.

## Recommended order

1. Fix truthful checklist/health handling and next-task initialization.
2. Fix legacy-photo fallback and visible evidence errors.
3. Close backend evidence-mutability and workflow-validation gaps with a new migration, not by silently rewriting the already-applied 088.
4. Then run isolated three-role tests: submit, return, restore, resubmit, approve, customer diary; include a WATCH return, two queued tasks, duplicate retry and another customer's denied access.
