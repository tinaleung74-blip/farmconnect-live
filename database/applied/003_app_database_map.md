# Current App Database Map

This is what the current frontend/backend code expects from Supabase.

## Shared Profile/Auth

Used by:

- `lib/farmconnect-data.ts`
- `lib/customer-auth.ts`
- `lib/farmconnect-v1.tsx`

Expected:

- `profiles.id`
- `profiles.auth_user_id`
- `profiles.email`
- `profiles.full_name`
- `profiles.display_name`
- `profiles.role`
- `profiles.account_status`
- `profiles.wallet_balance`
- `profiles.wallet_pin_set`
- `profiles.wallet_locked_savings`
- `profiles.birthdate`
- `profiles.kyc_status`

Potential issue:

- `customer-auth.ts` still checks `profiles.id = auth user id` before email fallback. Main app uses `auth_user_id`. Later cleanup should standardize this.

## Farm Buy

Reads:

- `farm_products`

Writes:

- `farm_cart_items`

RPC:

- `customer_buy_cart`

Expected after checkout:

- wallet deduction
- farm inventory/customer inventory update
- inbox receipt/invoice
- wallet transaction
- evidence/audit log

## Inventory / Care Logs

Reads:

- `inventory_usage_logs`
- `task_proofs`
- `animals`
- `caretakers`

Expected:

- Feed usage supports decimal quantity such as kg used.
- Vitamins/supplements/vaccines support unit count/dose count.
- Product cost and labor cost should be visible to customer.

## Customer Settings / KYC

RPC:

- `customer_record_kyc_consent`
- `customer_submit_kyc`
- `change_wallet_pin`

Direct update:

- `profiles` contact update by `auth_user_id`

Needs cleanup later:

- Profile photo upload/storage function.
- Full ID number validation instead of only last 4.
- OCR/face checks must be evidence-only until legal/consent/engine is finalized.

## Support Chat

Backend helper:

- `lib/backend/support-chat.ts`

Tables:

- `support_chat_sessions`
- `support_chat_messages`

RPC:

- `customer_support_send_message`
- `caretaker_support_send_message`
- `kafarm_support_send_message`
- `admin_support_join_chat`
- `admin_support_send_message`
- `admin_support_end_chat`
- `admin_support_complete_chat`

View:

- `admin_support_escalated_chats`

## Caretaker Tasks

RPC:

- `caretaker_submit_task_proof`

Expected:

- verify selected rooster/task
- insert proof
- update task status
- create evidence log
- deduct inventory usage if feed/product was used

## Admin Desk

Many pages are still frontend shells.

Must eventually connect:

- KYC review
- Wallet issue review
- Withdrawal check/send
- Care evidence review
- Security/wallet PIN reset
- Resolved cases
- Evidence finder
- Daily reports
- QA test lab
