# FarmConnect: fixes and remaining proof

## Sa madaling salita

Naayos ang ilang lugar na puwedeng magmukhang successful kahit walang confirmed save. Hindi pa ito buong-app production certification.

### Code changes

1. **Database target:** explicit environment variables; no hidden production fallback. A visible configuration warning replaces silent targeting. Localhost writes to the known production project are blocked. See LOCAL_DATABASE_SETUP.md.
2. **Payment:** pending operation key survives refresh; retry checks the saved operation record first. A missing response no longer claims that nothing was submitted. Changed details cannot silently reuse an unconfirmed operation. Explicit first-attempt database validation rejection releases the key; unknown transport outcomes retain it.
3. **Support (customer and caretaker):** no optimistic saved chat bubbles. The draft stays until the server returns a receipt. Retry uses a durable key. New SQL 090 wraps the existing message RPC in a transaction with an operation ledger and payload check. Incoming replies are polled every five seconds. Automatic reply failure does not falsely say the customer's saved message failed.
4. **Submitted work:** reads real task_proofs scoped to the caretaker, not a static/local completed list.
5. **Admin Evidence:** read-only real evidence, with a link to actual task review. Removed the fake local decision controls from this route.
6. **Signup:** account creation leads to a dedicated verification route using the existing ID/selfie form. Login resumes verification when no KYC record exists. This is a two-step registration, NOT an atomic signup-plus-KYC transaction. Existing backend access rules remain necessary. Users may still visit their rooster page while verification is incomplete.
7. **KYC display:** removed localStorage copies of the sensitive review record and fake local inbox receipt. An uncertain response no longer claims submission definitely failed. Existing server KYC/consent functions are unchanged.

## Checks performed

- Production build: PASS before final small retry/lint refinements; TypeScript check after payment recovery changes: PASS.
- Care-report source contracts: PASS (not a SQL execution test).
- Care-report behavioral tests: 3/3 PASS.
- Delivery-state tests: 5/5 PASS. Three exercise the pending-operation helper; two are source assertions. They do not prove live database behavior.
- Runtime-critical lint: PASS. Full repository lint still has legacy debt; do not interpret this as zero lint errors.
- RPC inventory: 54 call sites, 49 name/parameter-name matches; 2 dynamic sites and 3 reference-only function definitions still require live review.

## Required before claiming complete

1. Configure a genuinely isolated Supabase project. Existing local environment did not provide the browser database URL/public key. No secret was overwritten. Do not put a service-role key in NEXT_PUBLIC variables.
2. Review and run `database/applied/090_support_delivery_guard.sql` on that isolated project with the existing support baseline. It is prepared, NOT applied by this task. The new support frontend requires it. Do not deploy the frontend independently.
3. Export the live definitions of customer_submit_kyc, customer_record_kyc_consent, the role-specific support RPCs, and kafarm_support_send_message. The repository only contains reference declarations for parts of that baseline; recreating them by guessing would be unsafe. SQL 090 deliberately fails if its role-specific dependencies are absent.
4. Test with customer, caretaker and admin accounts: submit → database row → recipient queue → approve/reject → originating UI; test permission denial, network loss after commit, retry, and refresh. Confirm exactly one message/payment on retry and no access to another user's records.
5. Test signup email confirmation, KYC submission/return/resubmit, payment approval, assignment, daily report rejection/resubmission, diary evidence, sales, withdrawal/dispute, inbox and support end-to-end. These were NOT all executed in this task.

No push, deployment, production SQL, or production business-data changes were performed.
