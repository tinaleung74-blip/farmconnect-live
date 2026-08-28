# FarmConnect Three-Role Application Audit

Date: 2026-08-27

## Executive verdict

FarmConnect has a strong guarded-workflow and security foundation. Production compilation, critical lint, security, rate limiting, dependency safety, care-plan rules, withdrawal recovery, Inbox routing, and KaFarm safety all pass.

The app is **not ready for unrestricted public rollout**. It is suitable only for continued development or a closely supervised pilot after the P1 daily-care issues below are fixed and tested in an isolated writable Supabase project.

## 1. Backend Developer audit

### What is strong

- Sensitive workflow mutations use guarded PostgreSQL RPCs.
- Admin decisions recheck Admin identity in the database.
- Customer diary access checks `auth.uid()` and rooster ownership.
- Anonymous execution of the diary RPC is revoked.
- Private evidence buckets and RLS protections exist.
- Withdrawal holds, disputes, reversals, and evidence flows have strong contract coverage.
- Persistent rate limits serialize concurrent attempts and fail closed.
- Migration 087 did not alter existing business records.

### Findings

#### P1 — Customer diary receives private paths, not viewable signed URLs

Migration 087 returns all `task_proofs.proof_file_urls`, but those values are private storage paths. `getCustomerRoosterDiary()` currently passes them directly to image elements. Admin creates signed URLs; Customer V2 Diary does not. The customer may see broken photos even though the proof exists.

Required fix: sign every approved diary proof path before rendering, or expose a strictly owner-checked server/RPC mechanism that returns short-lived signed URLs.

#### P1 — Correction history exists in the database, but the editable draft is not restored

The backend correctly preserves the old proof and allows a `backjob` task to create a new proof. However, reopening the task clears the caretaker's timed entries and selected files. The caretaker must reconstruct the report instead of correcting only the rejected part.

Required fix: load the latest backjob proof into a correction draft, show the Admin note beside the affected entry, keep the previous proof immutable, and create a new proof version on resubmit.

#### P1 — Task-proof submission has no idempotency key

Payments and withdrawals use guarded/idempotent patterns. `caretaker_submit_task_proof_v3` can insert another pending proof when the client loses the response and retries after the task returns to an allowed state. UI button locking reduces accidental duplicates but is not a database guarantee.

Required fix: add a per-task submission/version idempotency key with a unique database constraint and duplicate-safe RPC response.

#### P1 — Seven historical caretaker tasks remain without durable customer-rooster identity

The last verified migration result reported seven linked workflow tasks with no safe `customer_animal_id` source. They must be classified manually; matching by rooster name would be unsafe.

#### P2 — Daily report structure is stored inside `free_note`

Timed entries currently use a version marker plus JSON inside a text column. This works for the current UI but is brittle for reporting, validation, partial correction, analytics, and future mobile clients.

Required fix: create a dedicated daily report plus child entry model, or at minimum a validated JSONB column with schema/version checks.

#### P2 — Restore readiness is not proven

Transactional migrations and rollback documentation pass, but the real isolated Supabase backup/restore drill is not attested.

## 2. API Developer audit

### Current API model

- 4 Next.js route handlers.
- 53 Supabase RPC call sites.
- 75 direct Supabase table call sites.
- Most business APIs are PostgreSQL RPCs called directly from the browser and protected by Auth/RLS.

This model can be secure, but the database functions are the public API. Their parameters, return shapes, errors, idempotency, and versioning must therefore be treated like formal API contracts.

### Findings

#### P1 — The diary silently falls back from ID matching to name/tag matching

If `customer_get_rooster_diary` fails, the UI catches every error, loads legacy care logs, and filters by rooster name/tag. This hides real API outages and risks mixing records after rename or duplicate names.

Required fix: make the ID-based RPC authoritative. Show a retryable error when it fails; never silently substitute name matching.

#### P1 — Daily report API is not a single atomic contract

The client serializes daily entries, uploads files, and then calls a generic proof RPC. The database validates proof presence and ownership, but it does not validate one image per entry, allowed period values, time format, entry count, or report date.

Required fix: one versioned `caretaker_submit_daily_report` RPC should validate the complete report and insert it atomically.

#### P2 — Error handling is inconsistent

Many data functions correctly throw errors, but several UI paths swallow errors or use broad fallback behavior. This makes a backend/API failure look like empty data or an old workflow.

Required fix: standardize API errors into `code`, `message`, `retryable`, `workflow`, and `recordId`; show an explicit failed/pending state instead of silently changing data sources.

#### P2 — Permanent Reject exists in the backend but is absent from the active Admin proof UI

The database supports `approved`, `backjob`, and `rejected`. The Admin UI exposes Approve and a combined red `Reject / Send Backjob` button that actually sends `backjob`. Permanent rejection is not available or clearly separated.

Required fix: use separate actions: `Approve`, `Return for Correction`, and a guarded `Close as Invalid` action with stronger confirmation and mandatory reason.

## 3. Software Engineer audit

### What is strong

- Production build succeeds across 132 generated pages/routes.
- Runtime-critical lint passes.
- Security and dependency gates pass; no high or critical dependency vulnerability is reported.
- KaFarm is read-only for business workflows and its mutation gate remains frozen by default.
- Withdrawal/dispute recovery has extensive contract coverage.

### Findings

#### P1 — No isolated cross-role E2E proof

The current environment has no writable isolated Supabase target. Customer → Admin → Caretaker → Admin → Customer tests, retry/idempotency checks, browser matrix, and cleanup are blocked. Production data is correctly protected from test writes, but that means the most important workflow is not yet proven automatically.

#### P2 — The main application component is too large

`lib/farmconnect-v1.tsx` is about 13,133 lines and contains Customer, Caretaker, Admin, and shared workflow UI. A change in one role has a large regression surface.

Required fix: split by bounded workflow: account/KYC, rooster purchase, care report, proof review, diary, sell, withdrawal, and support.

#### P2 — Route surface remains oversized

There are about 130 application page routes, including legacy Customer routes beside Customer V2. Old routes increase test cost and can send users into obsolete UX.

Required fix: publish one canonical route per user action, redirect legacy URLs, then remove dead components after verified traffic and rollback windows.

#### P2 — Legacy lint debt is high

The critical gate passes, but the latest run reports 193 errors and 126 warnings outside that gate. These are not all runtime failures, but they reduce signal and make future regressions harder to spot.

#### P2 — Public rollout operational gates remain incomplete

The current rollout verdict is `NOT_READY`. Missing evidence includes isolated writable E2E, browser matrix, production monitor attestation in the rollout environment, live password-reset callback, restore drill, owner rehearsal, legal/privacy review, named incident owner, and seven-day controlled pilot.

## ELI5 explanation

Imagine FarmConnect as a delivery company:

1. **Backend is the warehouse.** The doors and locks are mostly good. Only the correct Customer, Caretaker, or Admin can enter the correct area.
2. **API is the delivery truck.** Most trucks know where to go, but the Daily Report truck currently carries the report inside a handwritten note instead of a properly labeled package.
3. **Frontend is the receiving desk.** It can show the report, but Customer photos may arrive as a locked-box address instead of an openable temporary link.
4. **Correction flow keeps the old package**, which is good, but the caretaker does not receive a copy of the old form to edit. They must write everything again.
5. **Testing is the fire drill.** The building looks strong, but the team has not completed a full drill in a safe duplicate building. Therefore we cannot honestly promise that every real emergency path works.

## Priority order

1. Sign Customer Diary private images correctly.
2. Replace silent name/tag fallback with an explicit retry state.
3. Restore the previous timed report and Admin note during backjob correction.
4. Add atomic, idempotent, schema-validated Daily Report submission.
5. Separate Return for Correction from Permanent Reject.
6. Classify the seven unlinked historical tasks without guessing.
7. Run isolated three-role E2E on phone, tablet, and desktop.
8. Complete restore, owner, legal/support, and controlled-pilot attestations.

## Test evidence from this audit

- PASS: production build
- PASS: runtime-critical lint
- PASS: security contract
- PASS: rate-limit contract
- PASS: dependency contract (0 high, 0 critical)
- PASS: KaFarm Guardian and protected-action gate
- PASS: care-plan contract
- PASS: withdrawal/dispute recovery
- PASS: Inbox routing
- PASS: production-write isolation
- BLOCKED: live DB contract and workflow reconciliation because local public Supabase URL/key are absent
- FAIL: restore drill attestation
- VERDICT: `NOT_READY` for unrestricted public rollout
