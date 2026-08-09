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
