# FarmConnect Applied Database Ledger

Last updated: 2026-08-09

This is the human-readable database memory from our chat.

## 45. Operational Workflow Guard V3

Status: **applied and database/business/browser verified 2026-08-09**

File: `045_operational_workflow_guard.sql`

- Tracks care, caretaker task, proof, sale, withdrawal, and KYC state changes.
- Prevents duplicate withdrawal holds and treats repeated admin decisions idempotently.
- Expands KaFarm reconciliation across every sensitive role-to-role chain.
- Does not auto-approve, auto-reject, delete, transfer ownership, or send payout.

## 44. Workflow Chain Guard V2

Status: **applied and verified 2026-08-09**

File: `044_workflow_chain_guard.sql`

- Durable workflow runs and append-only step events
- Idempotent manual-payment submit and review wrappers
- Admin-only KaFarm business reconciliation reader
- Initial scope is Farm Buy and care-request manual payments
- No automatic approval, wallet movement, ownership transfer, or sensitive deletion
- Database contract passed after execution.
- Isolated business contract passed with retry, approve, reject, and resubmit coverage.

## 00. Current Health Check Status

Status: **passed**

Latest `database/00_app_db_health_check.sql` output:

- Missing tables: `[]`
- Missing columns: `[]`
- Missing functions: `[]`
- RLS enabled on required app tables: yes
- Required app support/KYC/farm/cart/inventory/wallet objects: present

## 01. KYC Security / Checker System

Status: **implemented / user reported success**

Confirmed from user outputs:

- Dangerous public KYC storage policies removed:
  - `danger_storage_policies_left = 0`
  - `public_kyc_buckets_left = 0`
- Dangerous public profile update policy removed:
  - `danger_profiles_update_policy_left = 0`
- KYC functions exist:
  - `customer_record_kyc_consent`
  - `customer_submit_kyc`
  - `run_kyc_system_checks`
  - `admin_review_customer_kyc`
- KYC tables exist:
  - `customer_kyc_profiles`
  - `kyc_documents`
  - plus related consent/evidence tables from the KYC bundle
- KYC profile uniqueness:
  - `customer_kyc_profiles_profile_id_key`
  - one KYC profile per customer profile
- Inbox category check includes:
  - `kyc`
  - `wallet`
  - `cashin`
  - `withdraw`
  - `care`
  - `support`
  - `security`

Known KYC function signature from user output:

```text
customer_submit_kyc(
  p_legal_name text,
  p_birthdate date,
  p_address_line text,
  p_city text,
  p_province text,
  p_postal_code text,
  p_id_type text,
  p_id_number_last4 text,
  p_payout_name_to_match text,
  p_valid_id_front_url text,
  p_selfie_url text,
  p_valid_id_back_url text default null,
  p_address_proof_url text default null
)
```

Risk note:

- Frontend currently passes `idLast4` even though brainstorming later wanted full ID number and ID length validation. This needs a future KYC Phase update.
- Facial recognition / OCR engine is not production-grade yet. It needs consent, clear disclaimers, manual review fallback, and a lawful provider/engine before real release.

## 02. Support Chat Phase 3A

Status: **implemented / user reported SQL success**

Confirmed from user output:

Tables:

- `support_chat_sessions`
- `support_chat_messages`

Functions:

- `customer_support_send_message`
- `caretaker_support_send_message`
- `kafarm_support_send_message`
- `admin_support_join_chat`
- `admin_support_send_message`
- `admin_support_end_chat`
- `admin_support_complete_chat`
- `log_support_chat_evidence`

Admin view:

- `admin_support_escalated_chats`

Confirmed app behavior:

- Customer support sends DB-backed messages.
- Caretaker support sends DB-backed messages.
- KaFarm auto-replies are persisted as DB messages using sender role `kafarm`.
- Admin live chat reads `admin_support_escalated_chats`.
- Admin join/reply/end/complete calls DB functions.

Remaining verification gate:

- Admin login/profile must be valid to fully confirm admin transcript and admin actions in live deployment.

## 03. Admin Test Profile

Status: **SQL was provided, final output not confirmed in chat summary**

Auth user confirmed by user:

```text
id: 58bcd918-9e43-41af-a077-f853dccefc35
email: admin@test.com
```

Purpose of SQL given:

- Insert/update `public.profiles` for `admin@test.com`
- Set role to `admin`
- Set account to active/verified

Need to verify:

- `profiles.auth_user_id` matches Supabase Auth user id.
- `profiles.role = admin`
- `profiles.account_status = active`
- Admin login opens `/admin`.

## 04. Farm Buy / Inventory / Care Logs

Status: **partially wired**

App currently expects:

- `farm_products`
- `farm_cart_items`
- function `customer_buy_cart`
- `inventory_usage_logs`
- `task_proofs`
- `animals`
- `caretakers`
- `wallet_transactions`
- `inbox_items`

Known app behavior:

- Farm Buy reads products from `farm_products`.
- Cart saves to `farm_cart_items`.
- Checkout calls `customer_buy_cart`.
- Inventory and care logs read from usage/proof tables.
- Care logs combine:
  - `inventory_usage_logs`
  - `task_proofs`

Need to verify:

- Purchase creates invoice/receipt in `inbox_items`.
- Purchase deducts wallet balance.
- Purchase adds customer inventory.
- Care task usage deducts customer-owned inventory.
- Care logs display product cost and labor cost correctly.

## 05. Caretaker Task Proof

Status: **partially wired**

Frontend calls:

```text
caretaker_submit_task_proof(
  p_external_task_id,
  p_rooster_name,
  p_rooster_tag,
  p_task_type,
  p_customer_note,
  p_required_proof,
  p_proof_url,
  p_preset_note,
  p_free_note
)
```

Need to verify:

- Function exists.
- Inserts `task_proofs`.
- Updates `caretaker_tasks`.
- Logs feed quantity/product usage when applicable.
- Creates evidence log.
- Admin/care logs can read the proof.

## 06. Wallet / PIN / Withdrawals

Status: **partially wired**

Known function:

- `change_wallet_pin` was missing in the 2026-07-29 health check.
- Fix SQL created locally:
  - `database/applied/004_wallet_pin_function.sql`

Need to verify/create later:

- Add cash flow tables/functions.
- Withdrawal request tables/functions.
- Payout account add/verify flow.
- Wallet PIN reset by admin with forced customer logout.
- Locked savings tables/functions.
- Wallet transaction history and receipts.

Important rule:

- Wallet credit/debit, withdrawal release, PIN reset, and savings movement must go through secure functions, not direct client table updates.

## 07. Evidence Logs

Status: **exists / used by support and KYC, but not fully normalized**

Need to standardize:

- `evidence_logs` should link to:
  - support session
  - KYC profile/document
  - cash-in request
  - withdrawal request
  - caretaker task/proof
  - farm buy order/invoice
  - admin action

Goal:

- Every sensitive action has who/what/when/why/evidence.

## 08. Current Local DB Files

Current files:

- `database/00_app_db_health_check.sql`
- `database/applied/000_database_applied_ledger.md`
- `database/applied/001_support_chat_phase_3a_reference.sql`
- `database/applied/002_kyc_reference.sql`
- `database/applied/003_app_database_map.md`
- `database/applied/004_wallet_pin_function.sql`

Next:

- Run `004_wallet_pin_function.sql`.
- Send output.
- Re-run `database/00_app_db_health_check.sql`.
- Confirm missing functions becomes empty.

Latest result:

- `change_wallet_pin_ready = 1`
- Health check after run has no missing functions.

## 09. Gamefowl Bloodline / Breed Chicks

Status: **SQL ready, pending Supabase run**

File:

- `database/applied/005_gamefowl_bloodlines.sql`

Purpose:

- Make Farm Buy breed chicks database-backed instead of UI-only.
- Add bloodline/breed fields to `farm_products`.
- Add bloodline/breed fields to `animals`.
- Add bloodline snapshots to `farm_cart_items` and `customer_animals`.
- Seed gamefowl starter chick products:
  - Hatch, Kelso, Sweater, Roundhead, Lemon, Claret, Albany, Grey, Law Grey, Regular Grey, Lacy Roundhead, Boston Roundhead, Butcher, Radio, Whitehackle, McLean Hatch, Blueface Hatch, Yellow Leg Hatch, Gilmore Hatch, Spangled Hatch, Mug, Sid Taylor, Blackwater, Brown Red, Black McRae, Harold Brown Grey, Madigin Grey, Cardinal Kelso, Out and Out Kelso, Jumper Kelso, Firebird Kelso, Possum Sweater, 5K Sweater, 5000 Sweater, Yellow Leg Sweater, Lemon 84, Duke Hulsey, Shamo, Asil, Brazilian, Peruvian, Spanish Game, Sweater-Kelso, Hatch-Claret, Hatch-Grey, Lemon-Hatch, Roundhead-Hatch, Kelso-Roundhead.

Important:

- This does not move wallet money.
- This does not approve KYC.
- This does not change ownership by itself.
- It only prepares product/animal bloodline fields and seed products.

After run:

- Re-run `database/00_app_db_health_check.sql`.
- Confirm bloodline columns exist.
- Confirm `breed_chick_products` count is greater than 0.

## 24. KaFarm Temporary SQL Gateway Bootstrap

Status: **bootstrap applied previously / app gateway removed 2026-08-09**

File:

- `database/applied/024_kafarm_sql_gateway_bootstrap.sql`

Purpose:

- Create a temporary dev-only Supabase SQL gateway for KaFarm.
- Allows Buddy/KaFarm to run FarmConnect-only SQL checks and controlled SQL chunks through the app.
- Adds `public.kafarm_sql_gateway_audit_logs` for every gateway execution.
- Adds `public.kafarm_dev_exec_sql(...)` RPC.

Safety:

- Intended for FarmConnect only.
- App API route hard-checks the FarmConnect Supabase URL.
- Server-side service role only; never expose service role key in browser.
- API route requires:
  - `KAFARM_SQL_GATEWAY_ENABLED=true`
  - active admin session
  - gateway token
- RPC execute grant is only for `service_role`.
- Disable before real production users:
  - `KAFARM_SQL_GATEWAY_ENABLED=false`
  - or delete `/admin/kafarm/sql-gateway` and `/api/kafarm/sql-gateway`.

Current app state:

- Both gateway routes have been deleted after applying migration 044.
- Production KaFarm uses allowlisted read-only readers only.
- The historical bootstrap file remains as database provenance; its service-role-only RPC is not exposed by an app route.

Expected success output:

- `kafarm_sql_gateway_ready = 1`

## 25. Manual Payment Farm Buy Source Of Truth

Status: **Applied**

File:

- `database/applied/025_manual_payment_farm_buy_source_of_truth.sql`

Purpose:

- Make admin-approved Farm Buy payments use the submitted payment summary as the source of truth.
- Approved breed/chick/rooster products create `customer_animals`.
- Approved feeds, vitamins, supplements, vaccines, and equipment update `customer_inventory_items`.
- Rejected or needs-info payments send customer inbox notices without moving items.

Verified:

- Farm Buy chick payment approval created a customer rooster.
- Farm Buy feeds payment approval created customer inventory.
- Payment page no longer fakes local success when Supabase submit fails.

## 26. Care Task Assignment Customer Animal FK Fix

Status: **Applied**

File:

- `database/applied/026_care_task_assignment_customer_animal_fk_fix.sql`

Purpose:

- Fix care task assignment when care requests reference `customer_animals`.
- `caretaker_tasks.animal_id` belongs to the legacy `animals` table, so task assignment now leaves it null and uses care request/rooster fields.

Verified:

- Admin can assign an approved paid care request to an active caretaker.

## 27. Manual Payment Care Request Sync Harden

Status: **Applied**

File:

- `database/applied/027_manual_payment_care_request_sync_harden.sql`

Purpose:

- Make approved care request payments move `farm_care_requests` to `paid_pending_assignment`.
- Backfill previously approved care payments that did not sync.

Verified:

- After admin payment approval, care request becomes assignable.

## 28. Task Proof Task ID Alias Fix

Status: **Applied**

File:

- `database/applied/028_task_proof_task_id_alias_fix.sql`

Purpose:

- Fix caretaker proof submission by writing both `task_id` and `caretaker_task_id`.

Verified:

- Caretaker can submit proof.
- Admin can approve proof.
- Customer receives inbox care update.

## 29. Admin Required Diagnostics

Status: **Applied**

File:

- `database/applied/029_admin_required_diagnostics.sql`

Purpose:

- Keep admin authorization strict through `profiles.auth_user_id = auth.uid()`.
- Recreate `is_admin()` with the strict active-admin profile check.
- Add `admin_session_guard_status()` so `ADMIN_REQUIRED` can be diagnosed without guessing.

Expected success output:

- `admin_required_diagnostics_ready = 2`

Notes:

- This does not broaden admin access by email fallback.
- If admin review still says `ADMIN_REQUIRED`, run:
  - `select public.admin_session_guard_status();`
  - It will show whether the current auth session has no profile, wrong role, inactive status, or active admin session.

## 33. Caretaker Task Proof Storage

Status: **Applied**

File:

- `database/applied/033_caretaker_task_proof_storage.sql`

Purpose:

- Store caretaker task photos in a private Supabase bucket.
- Save all linked proof paths on `task_proofs`.
- Allow caretaker upload, admin review, and approved customer read only.
- Add the QR-gated `caretaker_submit_task_proof_v3` RPC.

Expected success output:

- `caretaker_task_proof_storage_ready = 1`
- `caretaker_task_proof_v3_ready = 1`

Verified by owner:

- `caretaker_task_proof_storage_ready = 1`
- `caretaker_task_proof_v3_ready = 1`

## 34. Withdrawal Payout Proof Storage

Status: **Applied**

File:

- `database/applied/034_withdrawal_payout_proof_storage.sql`

Purpose:

- Store the admin's real external payout receipt in a private Supabase bucket.
- Allow admin upload/review and linked customer read only.
- Keep the receipt path attached to `withdrawal_requests.admin_receipt_url`.

Expected success output:

- `withdrawal_payout_proof_storage_ready = 1`

## 35. Rooster QR Identity and Task Automation

Status: **Pending run**

File:

- `database/applied/035_rooster_qr_identity_task_automation.sql`

Purpose:

- Read approved Farm Buy rooster ownership records.
- Create one stable QR identity and one system-generated QR Tagging request per rooster.
- Mark assigned QR Tagging tasks as documentation/photo-only with no QR scan step.
- Activate the rooster QR only after admin approves caretaker proof.
- Keep QR lifecycle events and prevent duplicate identities, requests, and fulfillment.

Expected success output:

- `approved_purchase_reader_ready = 1`
- `assigned_qr_task_reader_ready = 1`
- `qr_identity_engine_ready = 1`
- `qr_task_engine_ready = 1`
- `qr_identity_table_ready = 1`

## 36. Caretaker Task Submission Identity Fix

Status: **Pending run**

File:

- `database/applied/036_caretaker_task_submission_identity_fix.sql`

Purpose:

- Use the caretaker assigned on the task as the submission source of truth.
- Support accounts that still have multiple legacy caretaker rows.
- Preserve QR-tagging documentation/photo submission and admin verification.

Expected success output:

- `caretaker_task_submission_identity_fix_ready >= 1`

## 37. Task Proof ID Compatibility Guard

Status: **Pending run**

File:

- `database/applied/037_task_proof_id_compatibility_guard.sql`

Purpose:

- Synchronize legacy `task_id` and canonical `caretaker_task_id` automatically.
- Prevent proof submission failures when old and new task-proof code paths coexist.
- Repair existing records that have only one of the two task identifiers.

Expected success output:

- `task_proof_id_compatibility_guard_ready = 1`

Verified output:

- `approved_purchase_reader_ready = 1`
- `assigned_qr_task_reader_ready = 1`
- `qr_identity_engine_ready = 1`
- `qr_task_engine_ready = 1`
- `qr_identity_table_ready = 1`
## 038_admin_rls_helper_execute_grant.sql

Status: Applied

Purpose:

- Restore authenticated execute permission for `is_admin()` and `current_profile_id()` used by RLS policies.
- Allow a real active admin session to read caretaker proof submissions without broadening admin authority.

Expected success output:

- `admin_rls_helper_execute_ready = 1`

## 039_task_proof_customer_release_fix.sql

Status: Pending run

Purpose:

- Use the assigned caretaker task as the authoritative customer link during proof review.
- Release approved caretaker proof to the correct customer Inbox and Care Logs.
- Backfill already-approved proof records whose customer update was missing.

Expected success output:

- `task_proof_customer_release_ready = 1`

## 040_rooster_sale_and_withdrawal_confirmation.sql

Status: **APPLIED** (owner-confirmed; all five verification checks returned `count = 1`)

Purpose:

- Turn the My Roosters Sell button into a two-stage caretaker and admin workflow.
- Save the approved sale price before the customer confirms a final sale.
- Remove the sold rooster and credit the customer wallet exactly once only after final caretaker proof approval.
- Save customer payout methods, hold withdrawal funds at request time, attach admin payout receipt/reference, and require customer confirmation.
- Keep sale, wallet, withdrawal, inbox, and evidence records connected.

Expected success output:

- `rooster_sale_workflow_ready = 1`
- `rooster_sale_requests_ready = 1`
- `withdrawal_customer_confirmation_ready = 1`
- `customer_payout_methods_ready = 1`
- `customer_save_payout_method_ready = 1`

## 041_inbox_read_state.sql

Status: **Applied**

Purpose:

- Persist customer Inbox read/unread state across refreshes and devices.
- Clear the Inbox notification badge when the customer opens or marks an owned item as read.
- Prevent one customer from marking another customer's Inbox record.

Expected success output:

- `inbox_read_state_ready = 1`

## 042_kafarm_device_usage_audit.sql

Status: **APPLIED**

Verified from Supabase SQL output:

- `kafarm_device_usage_logs_ready = 1`
- `kafarm_record_device_usage_ready = 1`
- `admin_kafarm_device_usage_summary_ready = 1`

Purpose:

- Classify active sessions as phone, tablet, or desktop and record the selected layout mode.
- Save privacy-safe route/device audit logs on the server without raw fingerprints, IP addresses, secrets, or full user-agent strings.
- Let active admins and the KaFarm Whole-App Reader review device usage across Customer, Caretaker, and Admin routes.
- Preserve responsive behavior: desktop layout stays unchanged, while tablet and phone use their dedicated breakpoints.

Expected success output:

- `kafarm_device_usage_logs_ready = 1`
- `kafarm_record_device_usage_ready = 1`
- `admin_kafarm_device_usage_summary_ready = 1`

## 043_farmbuy_common_gamefowl_bloodlines.sql

Status: **APPLIED** (verified through KaFarm SQL gateway; 12 visible bloodlines)

Purpose:

- Limit the Farm Buy breed-chick catalog to 12 common Philippine gamefowl bloodlines.
- Keep older product rows and purchase history intact instead of deleting them.
- Mark catalog visibility in `farm_products.product_metadata` for database auditing.

Expected success output:

- `farmbuy_common_gamefowl_bloodlines_ready = 12`

## 046_payment_correction_and_video_evidence.sql

Status: **APPLIED** (verified through KaFarm SQL gateway on 2026-08-09; audit `9491ddfb-f809-4701-954d-8b9339b8624d`)

Purpose:

- Route rejected Farm Buy and care payments to the exact customer correction page.
- Preserve the original payment request, admin reason, evidence, and customer resubmission link.
- Allow private caretaker task evidence to include supported image and video files.

Expected success output:

- `payment_correction_video_evidence_ready = 1`

## 047_rooster_sale_assignment_qr_fix.sql

Status: **APPLIED** (verified through KaFarm SQL gateway on 2026-08-09; audit `2c2a0be2-5783-45e9-aec1-c1422dd8ccdf`)

Purpose:

- Repair sale task assignment by reading `qr_payload` from `animal_qr_identities` instead of `customer_animals`.
- Preserve the existing rooster identity while preparing the caretaker sale task.

Expected success output:

- `rooster_sale_assignment_qr_fix_ready = 1`

## 048_task_proof_sale_type_constraint_fix.sql

Status: **APPLIED** (verified through the service-only audited executor on 2026-08-09; audit `ed558916-4534-4d37-a9d4-d1be4b6889ba`)

Purpose:

- Allow the proof types emitted by the rooster sale-price and final-release task RPC.
- Preserve the existing photo and video proof types.
- Prevent caretaker sale submission from failing before it reaches Admin Task Verification.

Expected success output:

- `task_proof_sale_type_constraint_fix_ready = 1`

## 049_customer_kyc_digest_schema_fix.sql

Status: **APPLIED** (verified through the service-only audited executor on 2026-08-09; audit `b2db9940-6281-466f-9eaf-715ef68e2feb`)

Purpose:

- Preserve the live `customer_submit_kyc` function and its existing signature.
- Qualify the function's `digest()` call with the actual `pgcrypto` extension schema.
- Prevent KYC submission from failing with PostgreSQL error `42883` without changing customer or KYC rows.

Expected success condition:

- The live `customer_submit_kyc` definition contains a schema-qualified `digest()` call.

## 050_kyc_system_checks_digest_schema_fix.sql

Status: **APPLIED** (verified through the service-only audited executor on 2026-08-09; audit `f95e6df7-97e2-4bd4-84d7-605a5bcfd209`)

Purpose:

- Preserve the live `run_kyc_system_checks` function and its existing signature.
- Qualify every remaining `digest()` call with the actual `pgcrypto` extension schema.
- Complete the KYC submission repair without changing customer, KYC, or review rows.

Expected success condition:

- Both `customer_submit_kyc` and `run_kyc_system_checks` report `qualified=yes` in the live definition check.

## 051_customer_kyc_private_storage_wiring.sql

Status: **APPLIED / OWNER VERIFIED 2026-08-09**

Purpose:

- Keep the `farmconnect-customer-kyc` bucket private with a 10 MB file limit.
- Allow customers to upload and read only evidence below their own `auth.uid()/submissions` folder.
- Allow active admins to create signed review links without exposing KYC evidence publicly.
- Prevent browser-only `blob:` preview URLs and filename-only records from becoming new KYC evidence.

Expected success output:

- `customer_kyc_private_bucket_ready = 1`
- `customer_kyc_storage_policies_ready = 1`

## 052_customer_kyc_review_status_guard.sql

Status: **PREPARED / NOT YET VERIFIED LIVE**

Purpose:

- Accept the live `ready_for_review` KYC status in the guarded admin decision RPC.
- Require a clear admin note when KYC is rejected for customer resubmission.
- Keep duplicate approved/rejected decisions idempotent without changing any KYC row during migration.

Expected success output:

- `customer_kyc_review_status_guard_ready = 1`

## 053_customer_kyc_approved_state_reconciliation.sql

Status: **APPLIED / OWNER VERIFIED**

Purpose:

- Keep repeat KYC decisions idempotent and reconcile already-approved KYC rows with the customer profile.

## 054_customer_kyc_profile_approval_sync.sql

Status: **APPLIED / OWNER VERIFIED**

Purpose:

- Synchronize approved KYC state to both `profiles.kyc_status` and `profiles.verification_status`.
- Unlock customer withdrawal only after the approved profile state is visible.

## 055_customer_signup_profile_guard.sql

Status: **APPLIED / OWNER VERIFIED 2026-08-11**

Purpose:

- Create customer profiles transactionally from new `auth.users` records.
- Keep every self-service signup fixed to the customer role.
- Provide an idempotent authenticated recovery RPC for interrupted profile creation.

Expected success output:

- `signup_trigger = true`
- `ensure_rpc = true`

## 056_withdrawal_wallet_pin_guard.sql

Status: **APPLIED / OWNER VERIFIED 2026-08-11**

Purpose:

- Keep payout-method setup available before KYC approval.
- Require KYC and a server-verified Wallet PIN only when a withdrawal is submitted.
- Remove the legacy withdrawal RPC signature that could submit without a PIN.
- Persist failed PIN attempts and temporarily lock verification after five failures.

Expected success output:

- `guarded_signature = true`
- `legacy_signature_removed = true`

## 057_withdrawal_completion_inbox_sync.sql

Status: **APPLIED / OWNER VERIFIED 2026-08-12**

Purpose:

- Replace the actionable payout-confirmation Inbox card after the customer responds.
- Show an explicit `Withdrawal Completed` notification after payout receipt confirmation.
- Return payout problem reports to Admin without leaving stale confirmation instructions.
- Reconcile the latest stale confirmation card for already-completed withdrawals without changing money or withdrawal state.

Expected success output:

- `completed_with_stale_confirmation_notice = 0`

## 072_withdrawal_recovery_and_ledger_integrity.sql

Status: **APPLIED / OWNER VERIFIED 2026-08-19**

Purpose:

- Let a customer correct a `needs_info` withdrawal without creating another request or wallet hold.
- Give Admin a guarded `needs_info` recovery path and recheck live KYC inside the approval transaction.
- Close or reverse the original `WITHDRAWAL_HOLD` ledger row when the request completes or is rejected.
- Preserve payout corrections, decisions, Inbox notices, and evidence as an auditable state transition.

Expected success output:

- `customer_correction_rpc = true`
- `admin_kyc_guard = true`
- `ledger_trigger = true`

## 073_manual_withdrawal_dispute_investigation.sql

Status: **APPLIED / OWNER VERIFIED 2026-08-19**

Purpose:

- Route a customer `Report a Problem` action into a locked manual Issue Management case.
- Preserve the original payout method, amount, Admin reference, and receipt for investigation.
- Prevent direct customer correction or repeated payout while investigation is open.
- Allow only two guarded Admin resolutions: corrected external payout with new evidence, or customer-detail fault with the existing evidence and a professional explanation.
- Keep external GCash, Maya, and bank verification manual; FarmConnect records evidence and decisions but does not claim provider access.

Expected success output:

- `dispute_table = true`
- `customer_report_rpc = true`
- `admin_resolution_rpc = true`
- `direct_customer_resubmit_revoked = true`

## 058_care_plan_mission_engine_foundation.sql

Status: **APPLIED / CONTROLLED E2E VERIFIED (2026-08-14 ASIA/MANILA)**

Purpose:

- Create private, RPC-only Care Plan, daily mission, supply, and event records.
- Generate idempotent Asia/Manila caretaker missions without requiring a customer page visit.
- Keep ordinary paid Care Request assignment idempotent and paid-only.

## 059_care_mission_catalog_seed.sql

Status: **APPLIED / 180-DAY CATALOG VERIFIED (2026-08-14 ASIA/MANILA)**

Purpose:

- Seed exactly 180 unique welfare-centered daily mission templates from the approved source file.
- Preserve veterinarian authorization and emergency stop instructions in each daily record.

## 060_care_plan_mission_proof_inventory_guard.sql

Status: **APPLIED / CONTROLLED E2E VERIFIED (2026-08-14 ASIA/MANILA)**

Purpose:

- Require complete operations, housing, supplement, vaccine-authority, and health evidence.
- Require every PASS label and position to match the authoritative mission catalog.
- Require exact feed usage and deduct inventory only inside atomic admin approval.
- Prevent duplicate proof/item deductions.

## 061_care_plan_quote_payment_activation.sql

Status: **APPLIED / SUPERSEDED IN PART BY 062**

Purpose:

- Add customer request, locked quote, payment synchronization, and paid activation lifecycle.
- Migration 062 replaces the quote and activation safety details; both must be applied in order.

## 062_care_plan_production_lifecycle.sql

Status: **APPLIED / CONTROLLED E2E VERIFIED (2026-08-14 ASIA/MANILA)**

Purpose:

- Convert inventory packs to exact kilograms and compute required feed server-side from the catalog.
- Bind manual payments to the owner and exact locked quote; fulfill missing feed only after payment approval and stock locking.
- Backfill missed scheduler dates as overdue, extend paused coverage, support guarded reassignment/cancellation, and audit external refunds.
- Complete plans only after every required mission is admin-approved and expose a read-only KaFarm health snapshot.

Deployment requirements:

- Configure `CRON_SECRET` and existing `SUPABASE_SERVICE_ROLE_KEY` in Vercel.
- Keep the Vercel cron at `5 16 * * *` (12:05 AM Asia/Manila).
- Run `database/00_verify_applied_sql_status.sql` and `kafarm_care_plan_health_snapshot()` after reviewed migration application.

## 063_unified_care_plan_manual_mission_inventory_guard.sql

Status: **APPLIED AND VERIFIED — 2026-08-14**

Verification result:

- `manual_care_inventory_reservations`: present
- `manual_care_inventory_usage`: present
- `caretaker_submit_manual_mission_proof`: present
- `admin_review_manual_mission_proof_guarded`: present
- `kafarm_care_plan_health_snapshot`: unified paid/manual reader present

Purpose:

- Keep paid Care Plans automatic while exposing the same 180-day premium mission standard through manual Care Requests.
- Block duplicate manual care when a rooster already has paid automation.
- Check and reserve the exact customer-owned inventory required before a manual request is accepted.
- Give manual caretaker tasks the same procedures, safety protocols, checklists, evidence, and stop-and-report rule.
- Deduct actual manual-care inventory exactly once and only after admin proof approval; release reservations on rejection.
- Consolidate customer entry under Farm Requests and the sixth Care Plan box in My Roosters.

## 064_care_plan_task_management_assignment.sql

Status: **PENDING REVIEWED APPLICATION**

Purpose:

- Put paid and approved Care Plans directly in Admin Task Management.
- Assign one active caretaker once, activate the plan, and create the first due mission in one guarded RPC.
- Keep exact-payment, mission-catalog, feed reservation, active-caretaker, and idempotency protections.
- Remove the separate Care Plan Operations page from the normal Admin workflow; subsequent daily tasks remain server-generated.

## 065_fixed_5000_care_plan_package_day1_readiness.sql

Status: **PENDING REVIEWED APPLICATION**

Purpose:

- Lock the only available Care Plan at 30 days and PHP 5,000.
- Prepare the payment context and exact age-based feed requirement immediately from Farm Requests.
- Reserve a complete six-part standard package; medicine and emergency treatment remain separately authorized.
- Make the first caretaker task combine package readiness with the real Day 1 mission.
- Hold later automatic missions until Admin approves the caretaker's Day 1 readiness proof.

## 066_care_plan_task_checklist_compatibility.sql

Status: **PENDING REVIEWED APPLICATION**

Purpose:

- Validate paid Care Plan proofs against the exact immutable checklist stored on the assigned caretaker task.
- Preserve Day 1 package-readiness items added by migration 065 instead of comparing only with the shorter base mission catalog.
- Keep PASS, exact feed usage, evidence, QR-exception, atomic Admin approval, and idempotency guards unchanged.

## 069_care_plan_customer_feed_balance_pricing_contract.sql

Status: **APPLIED — PRODUCTION SQL VERIFIED 2026-08-18 (Asia/Manila)**

Verification:

- `prepare_rpc = true`
- `request_rpc = true`
- `version_rpc = true`
- `fixed_total = 5000`
- `average_daily_rate = 166.67`
- Contract version: `069_care_plan_customer_feed_balance_pricing_v1`
- Read-only health counts after application: `catalog_days = 180`, `active_supply_conversion_missing = 0`, `negative_inventory = 0`, `pending_refunds = 0`, `overdue_missions = 0`, `unreviewed_proofs = 0`.
- `paid_manual_open_conflicts = 1` was traced read-only to an open `QR Tagging` request beside an active Care Plan. No record was changed. The KaFarm classifier must distinguish QR/system setup tasks from manual daily-care conflicts before this count is treated as a business blocker.

Purpose:

- Remove the obsolete PHP 350 Care Plan test assumption and keep the service total at PHP 5,000 for 30 days (PHP 166.67 displayed average per day).
- Derive the 30-day mission window from the rooster's official ownership date instead of trusting a customer-entered program day.
- Compute exact required kilograms from the matching 30-day slice of the 180-day mission catalog.
- Require and reserve sufficient customer-owned feed before payment; include active manual-care and Care Plan reservations in the available-balance check.
- Never auto-purchase, manufacture, or credit missing feed through Care Plan preparation.
- Preserve exact approved-usage deduction, Day 1 readiness, Task Management assignment, and daily mission behavior from migrations 060-066.

## 070_kafarm_care_plan_health_qr_classification.sql

Status: **APPLIED — PRODUCTION SQL VERIFIED 2026-08-18 (Asia/Manila)**

Verification:

- `health_rpc = true`
- `version_rpc = true`
- `qr_system_tasks_excluded = true`
- Classifier version: `070_kafarm_care_plan_health_qr_classification_v1`
- Read-only post-check: `paid_manual_open_conflicts = 0`.
- The original QR/system overlap remains present as `qr_system_overlap_preserved = 1`; no request, task, payment, inventory, or Care Plan record was changed or deleted.

Purpose:

- Keep QR Tagging and other system setup tasks out of `paid_manual_open_conflicts`.
- Count only authoritative `manual_standard_mission` care requests against an open paid Care Plan.
- Preserve every other read-only Care Plan and manual-care health key.
- Change no customer, request, task, payment, inventory, or Care Plan record.

## 071_customer_kyc_risk_review_guard.sql

Status: **APPLIED — PRODUCTION SQL VERIFIED 2026-08-19 (Asia/Manila)**

Verification:

- `guard_accepts_high_risk = true`
- `guard_accepts_duplicate_risk = true`
- `guard_enforces_risk_floor = true`
- `risk_rows_waiting_for_admin = 2` (read-only count; no decision was created)

Purpose:

- Treat `high_risk` and `duplicate_risk` as review-required KYC queue states, not completed decisions.
- Keep the active-admin guard, row lock, rejection-note requirement, idempotent completed decisions, and canonical KYC review RPC.
- Allow only an authenticated active Admin to approve or reject a risk-flagged submission.
- Change no existing KYC decision or customer profile during migration application.
