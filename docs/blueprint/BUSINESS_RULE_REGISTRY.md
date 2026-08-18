# FarmConnect Business Rule Registry

Version: `0.1.0-draft`
Status: **HOLD**
Rule: only `OWNER APPROVED` rules may become product requirements. `EXISTING` rules describe current code and require confirmation if they affect product intent.

## Authentication and identity

| Rule ID | Classification | Exact rule | Applies to | Required condition/output | Forbidden behavior |
|---|---|---|---|---|---|
| BR-AUTH-001 | OWNER APPROVED | One login routes the user according to the active database role. | All roles | Auth user has one authorized active profile/role; open role workspace. | Trust a role selected only in the UI. |
| BR-AUTH-002 | OWNER APPROVED | Caretaker access begins only after Admin approval. | Caretaker registration | Application approved; profile/caretaker relationship active. | Applicant opening caretaker operations early. |
| BR-AUTH-003 | SECURITY CONTRACT | Protected identity is `auth.uid()` linked through `profiles.auth_user_id`. | Protected actions | Exact UID, role, status, relationship match. | Email-only authorization. |
| BR-AUTH-004 | CONFLICTING | `resolveCustomerProfile` currently falls back to email after querying `profiles.id = user.id`. | Legacy customer-auth helper | Requires engineering decision and removal/migration plan. | Treat fallback as blueprint authority. |
| BR-AUTH-005 | UNKNOWN | Approved password reset and admin-assisted recovery policy. | Forgot password | DEC-005. | Builder inventing reset rules. |

## KYC

| Rule ID | Classification | Exact rule | Applies to | Required condition/output | Forbidden behavior |
|---|---|---|---|---|---|
| BR-KYC-001 | OWNER APPROVED | Customer submits consent and private ID/selfie evidence; Admin makes the decision. | KYC-WF-001 | Private evidence, audit, guarded Admin review. | Automatic final KYC approval. |
| BR-KYC-002 | OWNER APPROVED | Approved KYC must synchronize the customer profile verification state. | KYC approval | Zero approved-KYC/profile mismatches. | Queue stays open after completed review. |
| BR-KYC-003 | OWNER APPROVED | Adding a payout method does not require KYC; submitting a withdrawal does. | Payout/withdrawal | Save method allowed; withdrawal gate checks KYC. | Blocking payout-method setup solely for missing KYC. |
| BR-KYC-004 | UNKNOWN | Full ID vs last-four storage and retention is not decided. | KYC form/database | DEC-006. | Expanding retained identity data without approval. |

## Farm Buy and ownership

| Rule ID | Classification | Exact rule | Applies to | Required condition/output | Forbidden behavior |
|---|---|---|---|---|---|
| BR-BUY-001 | OWNER APPROVED | Payment submission creates a review request, not ownership. | BUY-WF-001 | Status `for_review`; Admin queue/evidence exists. | Optimistic inventory/rooster creation. |
| BR-BUY-002 | OWNER APPROVED | Approved breed/chick/rooster purchase creates official ownership exactly once. | Admin payment approval | `customer_animals` linked to payment/source and customer. | Duplicate ownership on retry. |
| BR-BUY-003 | OWNER APPROVED | Approved supplies create/update customer inventory exactly once. | Admin payment approval | Exact product/quantity linkage. | Direct client inventory increase. |
| BR-BUY-004 | OWNER APPROVED | Rejected/needs-info payment changes no ownership/inventory and gives a correction path. | Admin payment decision | Notice/history retained. | False success or destructive deletion. |

## Manual care

| Rule ID | Classification | Exact rule | Applies to | Required condition/output | Forbidden behavior |
|---|---|---|---|---|---|
| BR-CARE-001 | OWNER APPROVED | Care may be requested only for a rooster owned by the customer. | CARE-WF-001 | Own active `customer_animals` relationship. | Cross-customer request. |
| BR-CARE-002 | OWNER APPROVED | Before accepting a care task that consumes supplies, check and reserve sufficient available quantity. | Care request | Reservation excludes stock already committed elsewhere. | Promise feed that is unavailable. |
| BR-CARE-003 | OWNER APPROVED | A paid approved request enters Task Management for Admin assignment. | Care payment | `paid_pending_assignment`. | Caretaker self-assignment. |
| BR-CARE-004 | OWNER APPROVED | Paid and unpaid roosters follow the same premium-standard care procedure; automation/assignment is the paid benefit. | Daily guidance/tasks | Procedure/safety quality does not degrade. | Unsafe lower standard for unpaid customers. |
| BR-CARE-005 | OWNER APPROVED | Only approved proof becomes a customer Care Log. | Proof review | Approved proof, actor, time, rooster, task. | Unreviewed/rejected proof shown as official. |

## Paid Care Plan

| Rule ID | Classification | Exact rule | Applies to | Required condition/output | Forbidden behavior |
|---|---|---|---|---|---|
| BR-PLAN-001 | OWNER APPROVED | Standard package is 30 days at exactly ₱5,000. | PLAN-WF-001 | Server-authoritative amount `5000.00`. | Variable quote changing the approved package price. |
| BR-PLAN-002 | OWNER APPROVED | Customer requests the Care Plan in Farm Requests and pays through the existing payment review flow. | Customer UI | No separate top-nav Care Plans entry. | Separate disconnected payment/approval path. |
| BR-PLAN-003 | OWNER APPROVED | After payment approval, the plan appears in Task Management for Admin assignment. | Admin | One assignment to an active approved caretaker. | Extra Admin activation page as a required operational step. |
| BR-PLAN-004 | OWNER APPROVED | Assignment generates Day 1 and daily missions automatically/idempotently. | Scheduler | At most one mission/task per plan/day. | Duplicate task on retry. |
| BR-PLAN-005 | OWNER APPROVED | Day 1 includes rooster readiness and complete package/supply readiness. | Day 1 task | Caretaker procedure, safety, required package items. | Starting normal missions while readiness is blocked. |
| BR-PLAN-006 | OWNER APPROVED | Customer monitors plan status/progress in My Roosters and approved work in Care Logs. | Customer | Per-rooster sixth Care Plan box. | Care Plan top navigation. |
| BR-PLAN-007 | OWNER APPROVED | Unpaid customer sees today's standard KaFarm guidance and may request care; no automatic caretaker task. | My Roosters/Dashboard | Daily guidance tied to each rooster. | Claim a caretaker performed unpaid work. |
| BR-PLAN-008 | IMPLEMENTED / E2E PENDING | Migration 069, UI, and `test:business` use fixed ₱5,000 and ₱166.67 displayed average/day. | QA/release | Apply 069 and pass isolated E2E. | Treating static source agreement as runtime proof. |
| BR-PLAN-009 | OWNER APPROVED / IMPLEMENTED | Customer-owned feed must cover the exact age-based 30-day catalog requirement before payment. | Quote/payment/setup | Include manual and plan reservations; insufficient balance blocks; purchase quantity stays zero. | Silent farm subsidy, auto-credit, or double reservation. |

## Caretaker task and inventory proof

| Rule ID | Classification | Exact rule | Applies to | Required condition/output | Forbidden behavior |
|---|---|---|---|---|---|
| BR-TASK-001 | OWNER APPROVED | Task details show exact rooster, daily procedure, safety guidance, proof requirement, and inventory context. | Caretaker task | Readable, mobile-first task detail. | Ambiguous generic work order. |
| BR-TASK-002 | OWNER APPROVED | Procedure/checklist is read-only guidance; caretaker records what was done and makes farm judgment. | Task UI | Evidence/notes/health result remain actionable. | UI checkboxes falsely proving physical work. |
| BR-TASK-003 | OWNER APPROVED | Record Feed Used and caretaker-reported Remaining Feed; authoritative deduction occurs after Admin approval. | Proof/inventory | Decimal quantity, before/after audit. | Duplicate “Reserved Inventory Used/Actual Used” controls or pre-approval deduction. |
| BR-TASK-004 | OWNER APPROVED | Health `watch`/`isolate_and_escalate` cannot be approved as routine completion. | Proof review | Remains open/backjob/escalated. | Hiding a health problem as complete. |
| BR-TASK-005 | OWNER APPROVED | Backjob returns to the assigned caretaker with Admin notes and preserves earlier attempts. | Proof review | Versioned evidence/history. | Deleting rejected evidence. |

## Sale and wallet

| Rule ID | Classification | Exact rule | Applies to | Required condition/output | Forbidden behavior |
|---|---|---|---|---|---|
| BR-SALE-001 | OWNER APPROVED | No sale price is promised before caretaker inspection and Admin review. | SALE-WF-001 | UI shows no-price/waiting state. | Guaranteed appreciation/profit. |
| BR-SALE-002 | OWNER APPROVED | Customer confirms sale only after an approved positive price exists. | Customer sale | `price_ready` and amount > 0. | Direct draft-to-sale completion. |
| BR-SALE-003 | OWNER APPROVED | Wallet credit and ownership release occur once, after final release proof is approved. | Sale completion | Atomic linked wallet transaction, sold ownership state, Inbox evidence. | Manual wallet credit or early ownership removal. |
| BR-WALLET-001 | OWNER APPROVED | Wallet is ledger-backed; holds and available balance must reconcile. | Wallet | Auditable transaction/hold records. | Manufacturing balance in UI/KaFarm. |

## Withdrawal

| Rule ID | Classification | Exact rule | Applies to | Required condition/output | Forbidden behavior |
|---|---|---|---|---|---|
| BR-WD-001 | OWNER APPROVED | Withdrawal submission requires approved KYC, valid 6-digit Wallet PIN, active payout method, minimum amount, and available balance. | WITHDRAW-WF-001 | Guarded RPC applies one hold. | Client-only eligibility. |
| BR-WD-002 | OWNER APPROVED | Admin approval requires a real external reference and private payout receipt. | Admin review | `sent_for_customer_confirmation`. | Claiming payout without proof. |
| BR-WD-003 | OWNER APPROVED | Customer confirms receipt or reports a problem; completion creates/updates Inbox evidence. | Confirmation | Complete or needs-info/dispute. | Automatic completion without customer confirmation. |
| BR-WD-004 | OWNER APPROVED | Rejection refunds a held amount exactly once. | Admin rejection | Ledger/hold reconciliation. | Double refund or direct balance edit. |

## Queue, notification, support, and KaFarm

| Rule ID | Classification | Exact rule | Applies to | Required condition/output | Forbidden behavior |
|---|---|---|---|---|---|
| BR-QUEUE-001 | OWNER APPROVED | Open queues contain actionable records only; final reviewed records leave open queue and remain in history. | Admin queues | Consistent filters/status. | Approved/rejected item remaining actionable. |
| BR-NOTIF-001 | OWNER APPROVED | Each critical cross-role transition produces an appropriate customer/caretaker/Admin-visible result. | Critical workflows | Linked Inbox/event/evidence. | Notification used as source of truth for money/ownership. |
| BR-SUPPORT-001 | OWNER APPROVED | Sensitive identity, money, fraud, ownership, or security issues escalate to Admin. | Support | Persisted session/messages. | KaFarm making a sensitive final decision. |
| BR-KAF-001 | OWNER APPROVED | KaFarm diagnoses from current evidence and identifies last proven-good and first broken/unproven steps. | KAFARM-WF-001 | Evidence citations and confidence. | Guessing root cause. |
| BR-KAF-002 | OWNER APPROVED | KaFarm may prepare a guarded official recovery but may not bypass business rules or execute generic SQL. | Troubleshooting | Admin authority remains final. | Hidden mutation, manual wallet credit, fake payment/proof. |
| BR-KAF-003 | EXISTING SAFE FOUNDATION | Guardian defaults to `AI ACTIONS FROZEN`; monitor disabled; no mutation adapter. | Guardian | PASS/HOLD/APPROVAL_REQUIRED/BLOCK gate. | Enabling repair without separate approval/storage/rollback design. |

## Commercial, operations, and governance unknowns

| Rule ID | Classification | Required owner decision |
|---|---|---|
| BR-COM-001 | UNKNOWN | Membership product, pricing, benefits, and lifecycle. |
| BR-COM-002 | UNKNOWN | Cash-in and locked-savings commercial rules and whether legacy pages stay in scope. |
| BR-GOV-001 | UNKNOWN | Retention/deletion periods for each evidence category. |
| BR-GOV-002 | UNKNOWN | Rate limits and abuse controls. |
| BR-OPS-001 | UNKNOWN | Backup RPO/RTO, restore cadence, release approvers, incident contacts. |

# HOLD — BUSINESS RULE CONFLICTS AND UNKNOWNS REMAIN
