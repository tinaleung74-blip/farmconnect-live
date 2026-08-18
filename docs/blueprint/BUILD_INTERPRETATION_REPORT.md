# FarmConnect Build Interpretation Report

Blueprint version interpreted: `0.1.0-draft`
Builder status: **HOLD — DO NOT CODE**

This report proves what a Builder would implement if the blueprint were locked. It does not authorize implementation.

| Requirement ID | Builder interpretation | Expected implementation area | FE behavior | BE/DB effect | Verification | Match |
|---|---|---|---|---|---|---|
| AUTH-WF-001 / BR-AUTH-001 | One login; server/data role decides workspace | login/profile/auth helpers/guards | No trusted role picker | Auth UID profile lookup | wrong-role/expired/missing-profile tests | MATCH — legacy email fallback removed; live regression still required |
| CARETAKER-WF-001 | Applicant uploads private selfie/resume; Admin activates once | unified verification UI, storage, guarded RPC | pending until review | application/profile/caretaker/audit | own/cross-user/approve/reject/retry | MATCH concept; status normalization UNKNOWN |
| KYC-WF-001 | Customer submits private KYC; Admin decides; profile syncs | Settings, Account Verification, KYC RPC/storage | review/correction/final status | KYC/profile reconciliation | RLS, approve/reject/resubmit/mismatch | PARTIAL — ID/retention unknown |
| BUY-WF-001 | Payment review precedes inventory/ownership | Farm Buy, Payment, Admin queue, manual-payment RPC | for-review then official result | materialize exactly once | retry/approve/reject/stock/ownership | MATCH |
| CARE-WF-001 | Reserve sufficient stock; assign; proof; Admin review; approved actual-use deduction | Farm Requests, Task Management, Tasks, Care Logs | show stock gate and next role | reservation/task/proof/use/event | insufficient stock, backjob, health, decimal use | MATCH concept; current E2E needed |
| BR-PLAN-001 | Care Plan is exactly 30 days and ₱5,000 | Farm Requests/payment/RPC/migration/test | fixed package summary | fixed amount/package | amount mismatch and exact value | MATCH IN SOURCE — migration 069 and isolated E2E application still required |
| BR-PLAN-002/003 | No top-nav/separate Admin plan step; payment → Task Management assignment | nav/redirects/Admin queue | request in Farm Requests; assign in Task | plan payment/assignment | route/nav/queue/E2E | MATCH current route intent |
| BR-PLAN-004/005 | One daily task; Day 1 readiness/package | scheduler/mission/task/proof | Day 1 procedure and readiness | unique plan/day; preparation state | retry/no duplicate/blocked readiness | PARTIAL — full current E2E needed |
| BR-PLAN-007 | Unpaid rooster gets daily standard guidance, not caretaker automation | Dashboard/My Roosters guidance | label rooster/task as guidance | no task/proof mutation | multiple-rooster/paid-unpaid UI tests | UNKNOWN — layout/priority undecided |
| BR-TASK-002/003 | Procedure read-only; Feed Used + Remaining Feed | Caretaker task detail | no checkbox-as-proof/duplicate reserved control | actual use approved later | DOM/a11y/proof/backjob/quantity tests | MATCH owner intent; current UI proof required |
| SALE-WF-001 | Inspection and reviewed price precede customer sale; final proof triggers one wallet credit/ownership release | My Roosters/Sell/Admin/Tasks/RPC | no-price/waiting/reviewed states | atomic sale completion | price/retry/backjob/double-credit | MATCH |
| WITHDRAW-WF-001 | Save method without KYC; KYC+PIN at submit; Admin proof; customer confirmation | Settings/Withdrawal/Admin/RPC | exact eligibility and confirmation | one hold/refund/completion evidence | KYC/PIN/duplicate/reject/dispute | MATCH |
| BR-QUEUE-001 | Final decisions leave open queue | Admin queue filters/refetch | select next or empty | final state retained in history | approve/reject queue test | MATCH concept |
| BR-KAF-001/002 | Evidence diagnosis and safe official resume; no bypass/generic SQL | KaFarm Reader/Troubleshooting/Guardian | explain last-good/first-broken/gate | read-only evidence today | no-mutation/prompt injection/role tests | PARTIAL — final IA/live model unknown |
| UI-CUS | Customer/Caretaker mobile-first; Admin desktop-first | shells/components/styles | responsive without hidden actions | none | 390×844/tablet/desktop screenshots+a11y | PARTIAL |
| DB-GLOBAL | RLS, FK, unique, transaction, idempotency, exact decimals | migrations/RPCs/QA | errors map safely | protected invariants | isolated DB/concurrency/live metadata | PARTIAL |
| DEPLOY-001 | Release commit/schema/env/test alignment and restore proof | CI/Vercel/Supabase/runbook | no incompatible release | migration/readiness evidence | full non-prod readiness + restore drill | UNKNOWN/blocked |

## Critical mismatches

1. `BR-PLAN-001`: source/test conflict corrected; migration 069 and isolated E2E remain unverified.
2. `BR-AUTH-003`: Auth UID-only profile resolution is implemented; live caller regression remains unverified.
3. `DEC-004`: customer-owned feed is required/reserved; insufficient balance blocks before payment.
4. `DEC-005/006/008/009/010/012/013`: security/operations behavior is incomplete.
5. `DEC-001/002/007`: required UX/information architecture is incomplete.

## Traceability template for future implementation

Every future change must include:

```text
Locked requirement ID
→ exact file(s)
→ canonical API/RPC/table/storage object
→ targeted test artifact
→ current-release browser/integration evidence
→ regression result
```

Code without a locked requirement is `UNAUTHORIZED IMPLEMENTATION`.

# HOLD — DO NOT CODE

Critical interpretation contains `PARTIAL`, `CONFLICT`, and `UNKNOWN`.
