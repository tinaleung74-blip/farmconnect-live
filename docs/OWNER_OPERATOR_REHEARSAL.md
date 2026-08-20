# FarmConnect Owner Operator Rehearsal

The owner is an operator, not a developer. They must complete this rehearsal without code, SQL, Supabase, Vercel, or developer guidance.

## Scenario checklist

- Sign in and identify every open Admin queue.
- Approve one valid KYC and reject one invalid KYC with a clear reason.
- Review one Farm Buy payment proof and confirm that ownership appears only after approval.
- Assign one Care Request/Care Plan task to a caretaker.
- Review caretaker evidence and choose approve or backjob correctly.
- Review a Sell Request, record a reviewed price, and follow the controlled sale flow.
- Review a withdrawal payout using the exact customer payout method and amount.
- Investigate a reported withdrawal problem in Issue Management and choose either corrected payout or customer-detail explanation using evidence.
- Open KaFarm System Health, identify a finding, and escalate it without running SQL or repeating a transaction.
- Sign out and recover access using Forgot Password.

## Passing criteria

- No developer takes control of the owner account.
- No queue item is approved without evidence.
- No transaction is repeated to “see if it works.”
- The owner knows when to stop and escalate.
- Every test record reaches the correct customer/caretaker Inbox or history.

Record the rehearsal date, owner name, observed mistakes, retraining performed, and final result. Only then set `OWNER_REHEARSAL_ATTESTED=true`.
