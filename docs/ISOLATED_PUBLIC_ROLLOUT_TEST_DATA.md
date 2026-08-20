# Isolated Public Rollout Test Data Plan

Use a local or disposable Supabase project. Never point writable E2E variables to `bfckjrqrixbtqqvsxgjq`.

## Required temporary roles

- One active Admin fixture.
- One new Customer fixture.
- One approved Caretaker fixture.
- A second Customer used only for RLS isolation checks.

## Required fixtures

- One breed-chick Farm Buy product.
- Customer-owned feed with enough quantity for a 30-day Care Plan.
- One insufficient-feed state to prove the request is blocked.
- Private payment, KYC, caretaker-proof, and withdrawal-proof storage objects.
- A wallet balance and payout method created only inside the isolated project.

## Required adversarial cases

- Repeated submit and repeated Admin approval.
- Duplicate payment reference and stale browser retry.
- Customer attempts to read another customer’s records.
- Caretaker attempts to open an unassigned task.
- Non-Admin attempts an Admin RPC.
- Invalid/expired session and password reset.
- Interrupted upload and refresh during processing.
- Wrong payout account, corrected payout, dispute reopening, and final closure.
- WATCH/failed health evidence cannot be approved as complete.
- Inventory never becomes negative and deducts exactly once.

The automated cleanup must pass. If cleanup fails, preserve the isolated project for investigation and do not reuse it as a clean test target.
