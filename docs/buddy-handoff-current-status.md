# FarmConnect Buddy Handoff

Last updated: 2026-08-05

## Current Goal

Build FarmConnect into a production-ready app with three connected workspaces:

- Customer app
- Admin app
- Caretaker app

The owner wants the app to stop feeling like static UI. The priority is real wiring:

Customer action -> database record -> admin review -> caretaker task if needed -> customer notification -> evidence logs.

## Important Working Style

- Use simple Taglish when reporting.
- Do not say "testing na" unless the flow is actually ready for readiness testing.
- First do investigation/build verification, then manual testing.
- The owner wants fewer scattered pages and more clear operational desks.
- Admin app should be dense, business-style, and fast to scan.
- Customer app can be more pleasant/enjoyable.
- KaFarm should be the internal system helper, but it must not perform sensitive actions without admin approval.

## Repo / Branch

- Project path: `C:\Users\HP\Desktop\projects\farmconnect-live`
- Branch: `master`
- Latest pushed commit: `5bd86ec Harden payment and KaFarm database flows`
- Remote: `https://github.com/tinaleung74-blip/farmconnect-live`

## Recent Push

Committed and pushed:

- KaFarm SQL gateway page/API
- Applied SQL docs/checker updates
- Manual payment source-of-truth SQL
- Care task FK/sync hardening SQL
- Task proof alias SQL
- Payment page error handling cleanup

## SQL / Database Reference

Database tracking files:

- `database/applied/000_database_applied_ledger.md`
- `database/00_verify_applied_sql_status.sql`

Latest user-provided verification showed all expected migrations applied:

- `001_support_chat_phase_3a_reference.sql`
- `002_kyc_reference.sql`
- `004_wallet_pin_function.sql`
- `005_gamefowl_bloodlines.sql`
- `006_customer_animals_ownership_table.sql`
- `007_farm_buy_checkout_flow.sql`
- `008_backend_wiring_audit.sql`
- `009_manual_payment_review_flow.sql`
- `010_auth_role_guardian_caretaker_applications.sql`
- `011_care_task_safe_backend.sql`
- `012_manual_payment_care_request_sync.sql`
- `020_withdrawal_review_flow.sql`
- `021_kafarm_incident_monitoring.sql`
- `022_kafarm_database_reader.sql`
- `023_caretaker_application_review_fix.sql`
- `025_manual_payment_farm_buy_source_of_truth.sql`
- `026_care_task_assignment_customer_animal_fk_fix.sql`
- `027_manual_payment_care_request_sync_harden.sql`
- `028_task_proof_task_id_alias_fix.sql`

## KaFarm SQL Gateway

Temporary/dev-only gateway added:

- Page: `/admin/kafarm/sql-gateway`
- API: `/api/kafarm/sql-gateway`
- Bootstrap SQL: `database/applied/024_kafarm_sql_gateway_bootstrap.sql`

Purpose:

- Allow admin-approved SQL health/migration checks during app building.
- Intended to be removed/disabled before real production users.

Safety note:

- Do not expose service keys or tokens.
- Do not keep this open for real production unless heavily locked down.

## Verified Payment Flow

Manual/demo payment backend flow was tested.

Passed:

1. Customer login works for test user.
2. Farm Buy page loaded live products.
3. Item added to cart.
4. Pay page showed amount and payment method choices.
5. Payment RPC created `manual_payment_requests` row.
6. Customer inbox got `Farm Buy Payment For Review`.
7. Admin payment queue showed the request.
8. Admin approval RPC worked.
9. Approved supply item appeared in `customer_inventory_items`.
10. Customer inbox got `Farm Buy Approved`.
11. `payment_evidence_logs` captured submit, approval, and farm buy posted events.

Known limitation in Codex browser test:

- In-app browser automation could not attach a real file because file chooser simulation was blocked.
- Demo used `demo://receipt/not-real-for-demo`.
- Real user/manual browser upload still needs to be tested by owner.

## Payment Flow Expected Behavior

Farm Buy:

1. Customer adds product to cart.
2. Customer clicks Pay.
3. Customer chooses GCash/Maya/Bank.
4. Customer enters sender name/reference and uploads receipt.
5. Request goes to admin Customer Requests > Payment.
6. Customer inbox shows pending invoice/status.
7. Admin approves or rejects.
8. If approved, product goes to My Roosters or Inventory.
9. If rejected, customer gets inbox note with reason and can resubmit.
10. All actions must have evidence logs.

Care Request:

1. Customer selects owned rooster.
2. Customer selects care service.
3. Paid service goes through same manual payment approval flow.
4. After approval, admin assigns caretaker.
5. Caretaker receives task.
6. Caretaker submits proof/docs.
7. Admin approves/rejects proof.
8. Customer receives inbox/care log update.

Withdrawal:

1. Customer requests withdrawal.
2. Admin reviews payout method.
3. Admin sends money externally.
4. Admin uploads payout receipt/reference.
5. Customer inbox gets receipt/status.
6. If rejected/returned, customer gets reason and can correct.

## Admin App Revision Direction

The owner wants admin rebuilt around clear operational desks:

### Dashboard

Should be mostly indicators:

- Issues count
- Request count
- Task review count
- Money in
- Money out
- Priority
- Earnings
- System alerts

### Customer Requests Management

This replaces confusing Customer Desk naming.

Main areas:

- Payment requests
- Care requests
- Task management
- Withdrawal requests

Payment request page:

- Box 1: customer queue only pending admin action
- Box 2: customer submitted receipt/reference/payment method/cart items/total
- Box 3: approve/reject with note, invoice view, submit final decision

Care request page:

- Similar queue/work/action pattern
- After payment approval, move to task management

Task management:

- Assign caretaker to approved care request
- Task should appear in caretaker app

Withdrawal request:

- Show customer withdrawal method/details
- Admin uploads payout receipt and reference
- Approve/reject/return with notes

### Caretaker Management

Pages:

- Registration
- Verification
- List
- Task verification
- Completed tasks

Registration:

- One box only
- Permanent caretaker signup link
- Copy link button
- Count of registered caretakers

Verification:

- Box 1: applicant queue
- Box 2: selfie/resume/payment/contact details
- Box 3: approve/reject with notes

Caretaker list:

- List approved caretakers
- Show selfie/resume
- Show assigned customers/tasks

Task verification:

- Queue of submitted caretaker tasks
- Show submitted proof/docs/notes
- Approve/reject
- Approved goes to completed tasks and customer update
- Rejected goes back to caretaker backjob

Completed tasks:

- Select caretaker
- Show completed task history and evidence

### Farm Operations

Pages/ideas:

- Product sales summary
- Account logs
- Paid care requests

Product sales summary:

- Product list
- Amount per product
- Number sold
- Total sales
- Daily/monthly/calendar filters

Account logs:

- Buttons: clients/customers and caretakers
- Selecting an account shows that account's actions
- For customer: product buys, care requests, withdrawals, receipts, invoices, caretaker submissions
- For caretaker: assigned tasks, submissions, admin actions, related customer receipt

Paid care requests:

- First box: caretaker list
- Second box: care request/service totals per selected caretaker
- Third box: totals

### Issue Management

Separate:

- Customer reports
- Caretaker reports
- Completed issues

Issue page pattern:

- Box 1: account queue
- Box 2: KaFarm findings/diagnosis/evidence
- Box 3: admin decision/solution buttons/notes

### Evidence Logs

Separate:

- Customer evidence
- Caretaker evidence
- Admin evidence

Goal:

- Organized per person.
- Easy to see who did what, when, and what proof exists.

## KaFarm Direction

KaFarm should be:

- Internal control helper
- Investigation engine
- Support sidekick
- System monitor
- Buddy handoff reporter

KaFarm should not be only scripted chat.

Desired behavior:

- Understand unclear admin/customer text.
- Collect evidence.
- Investigate whole-app risks.
- Report root cause candidates, not guesses.
- Produce copy-ready report for Buddy.
- Before user-facing errors happen, run investigation guards.

KaFarm tools/scopes:

- Database
- System
- Customer
- Caretaker
- Admin
- Flow
- Production Error

Investigation categories requested by owner:

- Functional
- Logical
- Workflow
- System-level integration
- Out of bound
- Security
- Performance
- Compatibility
- Usability
- Concurrency
- Data integrity
- Database
- API
- Authentication
- Authorization
- Validation
- Configuration
- Deployment
- Regression
- UI/Visual
- Accessibility
- Network/connectivity
- Error handling
- Memory/resource leak
- Session/state management
- Synchronization
- Localization/time zone
- Payment/transaction
- Backup/recovery

Do not focus on one tiny issue only. KaFarm should scan broad scope and only show findings when a blocker/risk exists.

## Known Not Fully Tested

These are not yet proven clean end-to-end:

- Real browser receipt upload with actual image file
- Customer KYC submit to admin review
- Care request full UI flow
- Admin task assignment UI
- Caretaker task visible in caretaker app
- Caretaker proof upload and admin review UI
- Withdrawal full UI flow
- Reject/resubmit loops
- Empty new customer pages after signup
- KaFarm investigation showing zero findings after all flows
- Live/Vercel production test

## Previous Problems Reported By Owner

Owner manually saw:

- New accounts showing default demo roosters/inbox/wallet data.
- Farm request page showing roosters before purchase.
- Inventory warning/default notices despite empty account.
- Payment request did not initially appear in admin until SQL/backend fixes.
- Caretaker application approval failed due SQL/check constraint.
- KaFarm investigation sometimes reported false button-click issues from clicking report lines.
- Admin pages were visually confusing and too button-heavy.

Some of these were partially addressed, but do not assume all are fixed.

## Useful Test Accounts

Admin:

- Email: `asira1031@gmail.com`
- Password given by owner: `12345678`

Do not expose any Supabase service keys or gateway tokens in reports.

## Recommended Next Step

Do not jump to "manual testing ready" yet.

Next Buddy should:

1. Pull latest `master`.
2. Run build.
3. Use database checker.
4. Verify empty-state behavior for a fresh customer.
5. Test payment UI with real browser upload.
6. Verify payment appears in admin UI.
7. Approve/reject both paths.
8. Test care request after payment.
9. Test caretaker assignment and proof.
10. Test withdrawal request and admin payout proof.
11. Fix any blockers.
12. Only then call it manual/live readiness testing.

