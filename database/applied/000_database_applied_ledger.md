# FarmConnect Applied Database Ledger

Last updated: 2026-07-29

This is the human-readable database memory from our chat.

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

Status: **SQL ready, run only while building FarmConnect**

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
