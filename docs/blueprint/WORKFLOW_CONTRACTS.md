# FarmConnect Workflow Contracts

Version: `0.1.0-draft`
Status: **HOLD**

Legend: FE = frontend; BE = authoritative backend/RPC; DB = authoritative records. All protected calls require authenticated UID, authorized active role, permitted relationship, idempotency where retry is possible, and an evidence event.

## AUTH-WF-001 — Customer signup and role login

| Step | Actor/current state | Action | FE effect | BE/DB effect | Failure/recovery |
|---|---|---|---|---|---|
| AUTH-01 | Public | Submit customer signup | Validate required fields, consent, password; disable once | Supabase Auth signup; `customer_ensure_signup_profile`; exactly one customer profile | Before submit: correct input. After Auth success/profile failure: resume profile creation, never create another Auth user blindly. |
| AUTH-02 | Any registered user | Submit one login form | “Checking account role”; no caller-selected role trust | Auth password check; lookup profile by `auth_user_id`; check role/status | Invalid credentials: neutral error. Missing/inactive profile: no workspace access. |
| AUTH-03 | Active user | Route by DB role | Customer `/customer/dashboard`; Caretaker `/caretaker/dashboard`; Admin `/admin` | No business mutation | Wrong role/route guard redirects or blocks. |

Allowed account transition intent: customer signup → active customer profile; caretaker applicant → pending approval → approved/active caretaker. Exact customer initial `account_status` needs live-schema confirmation. Illegal: unauthenticated → protected workspace; inactive applicant → caretaker operations.

## CARETAKER-WF-001 — Caretaker application and activation

| Step | Actor/state | Action and next state | FE | BE/DB/evidence | Failure/recovery |
|---|---|---|---|---|---|
| CTREG-01 | Public | Open permanent signup link | Explain application/approval boundary | None | Link unavailable is operational incident. |
| CTREG-02 | Applicant | Submit identity/contact/role/payment fields, selfie, resume | Validate types/sizes; one submit/loading state | Auth account + private uploads + `submit_caretaker_application`; pending application | Upload partial: preserve safe references and resume first incomplete step. |
| CTREG-03 | Admin | Review private application evidence | Approve/reject/needs correction with note | `admin_review_caretaker_application_guarded`; activate profile/caretaker exactly once; audit | Duplicate decision idempotent; invalid role/status blocked. |
| CTREG-04 | Applicant | Log in after approval | Open caretaker workspace | Role guard confirms active caretaker | Pending/rejected remains blocked with clear status. |

Current implementation statuses include pending-like, approved, rejected, and needs-update variants across application/profile/resume records. **CONTRACT NORMALIZATION REQUIRED:** exact canonical status family must be locked.

## KYC-WF-001 — Customer KYC

| Step | Actor/state | Action and next state | FE | BE/DB/evidence | Failure/recovery |
|---|---|---|---|---|---|
| KYC-01 | Customer/no approved KYC | Record consent and upload ID front/back/selfie | Show privacy purpose, file validation, submission progress | Private storage; consent record; `customer_submit_kyc`; review queue | Failed upload/submission never shows approved. Resume missing file/record. |
| KYC-02 | Admin/pending | Inspect evidence and decide | Queue, secure viewer, approve/reject/needs-info note | `admin_review_customer_kyc_guarded`; evidence event | Already-reviewed decision returns controlled result, not duplicate action. |
| KYC-03 | System/approved | Reconcile profile | Customer sees approved status; queue item closes | `sync_approved_customer_kyc_to_profile`; zero mismatch invariant | Mismatch is confirmed incident; do not approve again blindly. |

Allowed: draft/submitted → under review → approved or rejected/needs-info → resubmitted. Illegal: customer self-approval; approved KYC with profile pending.

## BUY-WF-001 — Farm Buy to ownership/inventory

| Step | Actor/state | Action and next state | FE | BE/DB/evidence | Failure/recovery |
|---|---|---|---|---|---|
| BUY-01 | Customer | Filter product, set quantity, build cart | Stock/quantity validation; cart summary | `farm_products`, own `farm_cart_items` | Out of stock disables purchase. |
| BUY-02 | Customer/cart ready | Choose Pay | Navigate to payment with immutable summary/reference | No ownership yet | Lost navigation reloads cart/source summary. |
| BUY-03 | Customer | Upload proof and submit once | Loading/duplicate-click protection; status “for review” | `customer_submit_manual_payment_guarded`; `manual_payment_requests`, evidence, workflow chain | Retry same idempotency key returns canonical request. |
| BUY-04 | Admin/for_review | Review receipt; approve/reject/needs-info | Queue updates; final item leaves open queue | `admin_review_manual_payment_guarded` | Missing proof/invalid state blocks. |
| BUY-05 | System/approved | Materialize outcome | Customer sees Inventory/My Roosters and invoice/Inbox | `customer_animals` for rooster/chick or `customer_inventory_items` for supplies; exactly once | If payment approved but materialization missing, resume at first missing downstream step; do not re-charge/re-approve. |

Manual payment states in source: `for_review → needs_info | approved | rejected | completed`. Direct `draft → completed` is a contract violation.

## CARE-WF-001 — One-time premium-standard care

| Step | Actor/state | Action and next state | FE | BE/DB/evidence | Failure/recovery |
|---|---|---|---|---|---|
| CARE-01 | Customer/owned rooster | Select rooster/service and submit | Show inventory sufficiency and price/payment boundary | `customer_create_care_request`; reserve required customer inventory | Missing stock blocks acceptance and explains needed product. |
| CARE-02 | Customer/payment required | Submit payment proof | Standard payment feedback | Guarded manual payment tied to care request | Retry idempotently. |
| CARE-03 | Admin/paid_pending_assignment | Select active caretaker, assign | Task Management refresh | `admin_assign_care_request`; create one `caretaker_tasks` link | Inactive caretaker or wrong state blocked. |
| CARE-04 | Caretaker/active | Read procedure/safety; perform work; report health, notes, proof, Feed Used/Remaining | Read-only procedure; actionable evidence fields | `caretaker_submit_manual_mission_proof`; `task_proofs`; no authoritative deduction yet | Health issue stays open/escalated. |
| CARE-05 | Admin/submitted | Approve/backjob/reject | Queue moves appropriately | `admin_review_manual_mission_proof_guarded`; approved actual inventory deduction once | Backjob preserves attempt/reservation. Rejection releases reservation. |
| CARE-06 | Customer/approved | View Care Log and Inbox | Official approved evidence only | Care log sources + Inbox event | Missing visibility after approval is downstream incident. |

Care request source state family: `draft → payment_for_review → paid_pending_assignment → assigned → in_progress/proof_submitted → released_to_customer`; rejection/cancel/backjob branches are permitted only through guarded paths.

## PLAN-WF-001 — Fixed ₱5,000 30-day Care Plan

| Step | Actor/state | Action and next state | FE | BE/DB/evidence | Failure/recovery |
|---|---|---|---|---|---|
| PLAN-01 | Customer/owned rooster, no live plan | Request 30-day plan from Farm Requests | Fixed package and ₱5,000 clearly shown | `customer_request_care_plan` | Duplicate live plan blocked. |
| PLAN-02 | System/draft | Prepare fixed package/payment | Show ₱5,000 total, ₱166.67 average/day, exact required kg, and reserved customer feed | `customer_prepare_fixed_care_plan_payment`; derive day from ownership date; lock `5000.00`; reserve customer inventory | Insufficient customer feed blocks before payment; no auto-purchase/credit. |
| PLAN-03 | Customer/payment_for_review | Upload proof through standard payment | Status and next step | Guarded manual payment linked to plan | Amount mismatch/expired or duplicate payment blocked/idempotent. |
| PLAN-04 | Admin/for_review | Approve payment | Move to Task Management | Guarded payment review; plan `paid_pending_setup` | No separate discretionary plan activation. |
| PLAN-05 | Admin/paid_pending_setup or ready | Assign active caretaker | Assignment confirmation | `admin_assign_care_plan`; plan active/readiness assigned; create Day 1 | Duplicate/different assignment blocked. |
| PLAN-06 | Caretaker/Day 1 | Prepare rooster and complete package readiness; submit proof/health/use | Full day procedure/safety; read-only checklist; evidence fields | Mission proof; on approval readiness verified; on issue plan blocked/ready | Never continue normal completion while readiness blocked. |
| PLAN-07 | System/active days 2–30 | Generate one due mission per Manila date | Caretaker receives current task | `generate_due_care_plan_missions`; unique plan/day task | Retry creates zero duplicates; missed days become backjob/overdue per catalog. |
| PLAN-08 | Caretaker/Admin | Submit and review daily mission | Customer sees current status, then approved Care Log | Proof review; exact actual-use deduction once; events | Health escalation cannot be approved as routine. |
| PLAN-09 | System/30 approved missions | Complete plan and release unused reservation | Customer sees completion/history | Plan completed, unused supplies released, final event/Inbox | Count mismatch blocks completion. |

Current source statuses include: `draft`, `payment_for_review`, `payment_submitted`, `paid_pending_setup`, `ready`, `active`, `paused`, `completed`, `cancelled`, `expired`; daily missions include scheduled/active/overdue/backjob/submitted/approved/cancelled variants. Illegal: draft → active without approved payment and assignment; active → completed without required approved missions.

## PROOF-WF-001 — Generic caretaker proof review

| Step | Actor/state | Action | Authoritative effect | Failure/recovery |
|---|---|---|---|---|
| PROOF-01 | Assigned caretaker; active/in_progress/backjob | Submit permitted files, observations, health, actual use, task identity | One pending `task_proofs` attempt linked to assigned task | Wrong caretaker/task, missing required evidence, invalid type/size blocked. |
| PROOF-02 | Admin/pending | Approve or return backjob/reject with note | Guarded RPC updates proof/task/source workflow atomically | Already reviewed is idempotent or explicitly rejected as stale. |
| PROOF-03 | System/approved | Deduct approved actual use once; publish customer result | Usage ledger, task/source completion, Care Log/Inbox | Deduction or customer release missing: resume downstream only. |

Illegal: proof pending → customer official log; health escalation → approved routine completion; direct client deduction.

## SALE-WF-001 — Rooster sale

| Step | Actor/state | Action and next state | Authoritative effect | Failure/recovery |
|---|---|---|---|---|
| SALE-01 | Customer/owned unsold rooster | Request price | `rooster_sale_requests.price_requested`; inspection request/task | Existing open sale returns canonical record. |
| SALE-02 | Admin | Assign inspection caretaker | price task assigned | Inactive/wrong caretaker blocked. |
| SALE-03 | Caretaker | Inspect and submit declared amount/proof | `price_submitted` | Missing proof/invalid amount blocked/backjob. |
| SALE-04 | Admin | Approve inspection price | `price_ready`, positive approved price, customer notice | No guaranteed value before this state. |
| SALE-05 | Customer | Confirm sale at reviewed price | `sale_requested` | Wrong/stale price blocks. |
| SALE-06 | Admin | Approve release | `release_pending_assignment`; final physical release task | Rejection returns to price-ready decision without wallet/ownership change. |
| SALE-07 | Caretaker/Admin | Submit and approve release proof | In one protected completion: sold ownership, wallet transaction/credit, sale completed, evidence/Inbox | Retry must not double-credit; partial failure resumes at first missing step. |

Illegal: `price_requested → completed`; wallet credit before final proof approval; sale completion while ownership remains active.

## WITHDRAW-WF-001 — Secure withdrawal

| Step | Actor/state | Action and next state | Authoritative effect | Failure/recovery |
|---|---|---|---|---|
| WD-01 | Customer | Save payout method | Own active `customer_payout_methods` | KYC is not required at this step. |
| WD-02 | Customer/eligible | Enter amount and Wallet PIN; submit | `customer_submit_withdrawal_request_guarded`; one wallet hold; `for_review` | KYC/PIN/minimum/balance/method failure makes no hold/request. Retry cannot double-hold. |
| WD-03 | Admin/for_review or needs_info | Approve with real reference+receipt, reject, or needs-info | Approved → `sent_for_customer_confirmation`; rejected → refund once | Missing reference/receipt blocks approval. |
| WD-04 | Customer | Confirm receipt or report problem | Yes → `completed`; problem → `needs_info`; Inbox/evidence | No response policy is UNKNOWN; Builder may not auto-complete. |

Illegal: no-KYC → for_review; for_review → completed without payout proof/customer confirmation; rejected hold not refunded; duplicate refund.

## SUPPORT-WF-001 — Support and Admin escalation

| Step | Actor | Action | Effect | Failure/recovery |
|---|---|---|---|---|
| SUP-01 | Customer/Caretaker | Send support message | Persist message/session | Failed persistence is visible; do not show sent. |
| SUP-02 | KaFarm | Provide low-risk guidance or identify sensitive category | Persisted KaFarm response; sensitive issue escalated | No financial/identity decision. |
| SUP-03 | Admin | Join/reply/end/complete | Audited session status and transcript | Lost connection reloads transcript, not duplicate message. |

## KAFARM-WF-001 — Diagnosis and Resume From Failure

| Step | Actor/state | Action | Result | Forbidden behavior |
|---|---|---|---|---|
| KF-01 | Active Admin | State route/workflow, expected and actual result | Re-authenticated Admin context | Sending passwords/PINs/raw KYC. |
| KF-02 | Guardian | Read system map, safe source references, current DB/workflow evidence, incidents, tests | Evidence bundle with PII minimization | Generic SQL/model access to secrets. |
| KF-03 | Guardian | Compare blueprint/invariants against evidence | Last proven-good, first broken/unproven, confidence, affected records | Labeling root cause confirmed without sufficient current evidence. |
| KF-04 | Deterministic gate | PASS/HOLD/APPROVAL_REQUIRED/BLOCK | Proof requirements and safe next action | Model overriding protected-zone gate. |
| KF-05 | Admin/future recovery adapter | Explicitly approve an allowlisted official resume step | Audited, rollback-aware continuation from first incomplete step | Blind restart, fabricated data, arbitrary mutation. Current adapter does not exist. |

## Global frontend and error contract

For every submitted action:

```text
User action
→ client validation
→ disable/loading state
→ authoritative request with stable idempotency identity when applicable
→ success: refresh source and downstream records
→ failure: visible safe error + retry/resume guidance
```

- Back/reload/multiple tabs must not create a second transaction.
- Expired session must stop the action and require reauthentication.
- Timeout means outcome unknown; re-read canonical state before retry.
- No false success, silent failure, or partial critical state.

# HOLD — STATE/PRODUCT CONFLICTS IN THE MASTER BLUEPRINT MUST BE RESOLVED
