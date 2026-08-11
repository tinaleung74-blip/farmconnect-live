# FarmConnect Backend Wiring Status

Last updated: 2026-08-11

## Rule

FarmConnect is not considered working when a page only changes UI state. A flow is working only when it:

1. writes to Supabase,
2. reads back from Supabase after refresh,
3. creates logs/receipts/evidence when needed,
4. respects RLS/functions,
5. shows friendly UI messages when DB fails.

## Backend-Wired Now

- Support chat escalation:
  - `support_chat_sessions`
  - `support_chat_messages`
  - support RPC functions
  - admin live chat queue

- KYC base:
  - `customer_kyc_profiles`
  - `kyc_documents`
  - KYC consent/check/review functions

- Wallet PIN:
  - `change_wallet_pin`
  - server verification in `customer_submit_withdrawal_request_guarded`
  - failed-attempt counter and temporary lock

- Customer signup:
  - `trg_create_customer_profile_after_auth_signup`
  - `customer_ensure_signup_profile`
  - customer-only role enforcement

- Withdrawal:
  - `customer_payout_methods`
  - `withdrawal_requests`
  - `customer_submit_withdrawal_request_guarded`
  - KYC + Wallet PIN checked before wallet hold
  - admin payout proof and customer confirmation

- Farm Buy backend target:
  - `farm_products`
  - `farm_cart_items`
  - `customer_buy_cart`
  - `customer_inventory_items`
  - `customer_animals`
  - `wallet_transactions`
  - `inbox_items`

- Manual payment review:
  - `manual_payment_requests`
  - `payment_evidence_logs`
  - `customer_submit_manual_payment`
  - `admin_review_manual_payment`
  - `012_manual_payment_care_request_sync.sql` links approved/rejected care payments back to `farm_care_requests`

- Farm Requests -> Caretaker task flow:
  - `farm_care_requests`
  - `caretaker_tasks`
  - `task_proofs`
  - `customer_create_care_request`
  - `admin_assign_care_request`
  - `caretaker_submit_task_proof`
  - `admin_review_task_proof`
  - customer request page creates DB requests
  - caretaker active tasks can load DB tasks and submit proof
  - admin farm/caretaker/evidence desks show live request/proof queues

## Still UI-Heavy / Needs Backend Hardening

- Cash-In:
  - UI/tutorial exists
  - needs real upload, OCR/check result, duplicate reference handling, admin queue

- Savings / Locked FC:
  - UI exists
  - needs savings pockets table and lock/unlock RPC

- Care Logs:
  - partially reads `inventory_usage_logs` and `task_proofs`
  - still has demo fallback/local proof fallback

- Caretaker tasks/proofs:
  - DB task/proof path exists
  - needs real storage upload and system checker for blur/fresh photo/device/source
  - needs inventory deduction by exact quantity after proof approval

- Admin customer desk:
  - mostly workflow UI
  - needs real case/queue tables and action functions per desk

## Backend Audit SQL

Run:

```sql
-- database/applied/008_backend_wiring_audit.sql
```

Expected:

- no `missing` rows for required tables/functions/columns,
- RLS should be `ok`,
- policy count should be greater than `0` on user-owned tables.

## Immediate Next Backend Priority

1. Run `011_care_task_safe_backend.sql`.
2. Run `012_manual_payment_care_request_sync.sql`.
3. Run `008_backend_wiring_audit.sql` or `00_app_db_health_check.sql`.
4. Manual test Farm Buy:
   - wallet deducts,
   - supplies appear in Inventory,
   - chicks appear in My Roosters,
   - receipt appears in Inbox,
   - refresh keeps records.
5. Manual test Care Request:
   - customer creates request,
   - paid request goes to manual payment,
   - admin approves payment,
   - admin assigns caretaker,
   - caretaker sees task,
   - caretaker submits proof,
   - admin approves/backjobs/rejects proof,
   - customer inbox/care log updates.
