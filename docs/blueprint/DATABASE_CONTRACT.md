# FarmConnect Database Contract

Version: `0.1.0-draft`
Status: **HOLD** — this is a repository-derived intended contract. Live Supabase metadata must be compared before lock.
Authority: Supabase project `bfckjrqrixbtqqvsxgjq` is the production data source of truth.

## 1. Global database rules

1. UUID primary keys for business records unless a legacy table has a separately approved key.
2. User-owned records link to `profiles.id`; authentication links through `profiles.auth_user_id = auth.uid()`.
3. Foreign keys prevent orphans; destructive cascades are allowed only for non-production test cleanup or explicitly approved dependent evidence. Critical production evidence must not disappear through an incidental parent delete.
4. Sensitive state transitions use guarded `security definer` functions with fixed `search_path`, explicit role/relationship checks, and revoked/unnecessary grants.
5. RLS is enabled on every user, evidence, financial, identity, care, sale, workflow, and KaFarm incident table. A table with no required policy is not ready.
6. Critical transition and downstream materialization occur in one transaction or produce a resumable workflow-chain record identifying the first incomplete step.
7. Idempotency keys and unique constraints prevent duplicate submissions, decisions, missions, ownership, inventory use, wallet credit, and withdrawal hold/refund.
8. Decimal inventory uses numeric quantities with a canonical base unit; no rounding to whole units when actual use is fractional.
9. Wallet balance is a projection/reconciled value backed by `wallet_transactions`; holds and credits must reconcile.
10. Numbered migrations are append-only. “Applied” in a filename is repository provenance; live application must be verified independently.

## 2. Identity and reference spine

| Table | Purpose and key | Required relationships/columns | Constraints/index/RLS | Workflow |
|---|---|---|---|---|
| `profiles` | App identity; PK `id` | `auth_user_id` unique, `role`, `account_status`, contact data, KYC/verification fields, wallet balance/hold, Wallet PIN security fields | Unique Auth UID; role/status constraints; RLS; index Auth UID/email only for lookup, never email authorization | All |
| `caretakers` | Approved caretaker operational identity; PK `id` | `profile_id` FK unique, name/contact, status, evidence refs, farm role | Unique `profile_id`; own/Admin RLS; status index | CARETAKER/PROOF |
| `caretaker_applications` | Pending application; PK `id` | Auth/profile identity, form fields, selfie/resume private paths, review status/note/actor/time | One open application per Auth user; own/Admin RLS | CARETAKER-WF-001 |
| `caretaker_application_logs` | Append-only application decisions | application/profile/actor/action/result/time | Admin read, controlled insert; no normal update/delete | CARETAKER-WF-001 |

**Current source contract:** customer profile resolution uses `profiles.auth_user_id = auth.uid()` only. Email remains display/contact data and is never an authorization relationship. Live regression proof is still required.

## 3. Farm Buy, ownership, and inventory

| Table | Purpose/PK | Required fields and relationships | Constraints/index/RLS | States/rules |
|---|---|---|---|---|
| `farm_products` | Farm catalog | product identity/name/category/type/unit price/unit label/stock/status/breed/bloodline/metadata | Product ID unique; nonnegative stock/price; Admin write/authenticated read policy as approved | available/unavailable/out-of-stock family must be normalized |
| `farm_cart_items` | Customer cart line | `profile_id`, `product_id`, quantity, status, product snapshot | One active line/profile/product; own RLS | active → purchased/cancelled |
| `manual_payment_requests` | Canonical manual-payment review; PK `id` | `profile_id`, `source_type`, `source_ref`, amount, summary snapshot, method/receiver/sender/reference, private receipt path, status, Admin review fields, idempotency key | Index profile/status/reference; unique operation/idempotency key; own/Admin RLS | `for_review`, `needs_info`, `approved`, `rejected`, `completed` |
| `payment_evidence_logs` | Append-only payment events | payment request, profile, event, safe metadata, actor/time | Index request/profile; linked read; no secret/raw KYC | append-only |
| `customer_animals` | Official customer ownership; PK `id` | `profile_id`, optional legacy `animal_id`, name/code/status, source product/payment metadata, breed/bloodline, acquisition, sale fields | Index profile/animal/bloodline; one materialization per approved source; own/Admin RLS | pending_assignment/in care/active/sold/cancelled family requires live normalization |
| `customer_inventory_items` | Owned supplies; PK `id` | `profile_id`, product snapshot, exact quantity/unit/base conversion, updated time | Unique profile/product where mergeable; nonnegative quantity; profile index; own/Admin RLS | quantity never negative |
| `animals` | Legacy farm/animal source | farm identity/profile linkage and physical attributes | Must not conflict with `customer_animals`; exact role needs schema decision | legacy/current integration |

Atomic approval invariant:

```text
manual payment approved
→ exactly one ownership record OR exact inventory increase
→ invoice/Inbox/evidence
```

No partial or double materialization is legal.

## 4. Care requests, tasks, proofs, and inventory use

| Table | Purpose/PK | Required fields and relationships | Constraints/index/RLS | State family |
|---|---|---|---|---|
| `farm_care_requests` | One-time care, assignment request, and generated workflow link; PK `id` | customer `profile_id`, `customer_animal_id` where available, service/price/note, payment request, assigned caretaker/task, status, Admin note | Index profile/status; FK assigned task/caretaker; own/Admin/caretaker-linked RLS | draft, payment_for_review, payment_rejected, paid_pending_assignment, assigned, in_progress, proof_submitted, released_to_customer, rejected, cancelled |
| `caretaker_tasks` | Assigned physical work; PK `id` | request/plan/mission/profile/caretaker/assigner links, rooster identity, type/workflow, procedure/safety/required proof metadata, status, due/submitted/reviewed times | Index caretaker/status/due and profile; unique plan/day mission; assigned/linked RLS | active, in_progress, submitted, approved, rejected, backjob, cancelled plus health escalation mapping |
| `task_proofs` | Versioned work attempt; PK `id` | task/caretaker/profile/source links, private file paths, notes, health, checklist snapshot, actual inventory usage, check/review states, actors/times | Both legacy `task_id` and canonical task alias synchronized; index task/review; linked RLS | proof check pending/passed/needs_review/failed; Admin pending/approved/rejected/backjob |
| `manual_care_inventory_reservations` | Reserve own inventory before accepting manual care | care request/profile/item, available/reserved base quantity, status/expiry | Index item; one active reservation per request/item; linked RLS | active/consumed/released |
| `manual_care_inventory_usage` | Approved exact manual-care deduction | request/proof/profile/item, quantity before/used/after/base unit, Admin actor/time | Unique proof/item; nonnegative before/after; linked RLS | append-only approved use |
| `inventory_usage_logs` | Legacy/general usage evidence | customer/item/task/proof quantities/cost/time | Must reconcile with canonical actual-use tables; own/Admin linked RLS | append-only |

Only Admin-approved proof may consume a reservation. Backjob retains it; rejection/cancellation releases it. Caretaker-reported Remaining Feed is observation; the database-computed remaining quantity after approval is authoritative.

## 5. Care Plan schema

| Table | Purpose/PK | Required fields/relationships | Constraints/index/RLS | State family |
|---|---|---|---|---|
| `care_mission_templates` | Approved 180-day procedure/safety catalog | day/stage/objective, operations/housing/supplement/vaccine/health guidance, evidence requirements, feed target | Unique catalog day/version; authenticated read; controlled Admin/migration write | active/versioned catalog |
| `rooster_care_plans` | Customer/rooster paid plan; PK `id` | profile, customer animal, assigned caretaker, 30-day duration/start/end/current day, fixed price, payment, readiness, status, refund fields | One live plan/rooster; profile/status indexes; linked RLS | draft, payment_for_review, payment_submitted, paid_pending_setup, ready, active, paused, completed, cancelled, expired |
| `care_plan_supply_requirements` | Reserved/quoted package need | plan, inventory/product source, required kg, conversion, reserved amount, status | Nonnegative conversion/quantities; linked RLS | quoted/active/consumed/released |
| `care_plan_package_items` | Fixed ₱5,000 package contents/readiness | plan, item/product, required amount/unit, status, evidence | Linked RLS; package status planned/assigned/verified/blocked/consumed | readiness |
| `rooster_daily_missions` | One mission per plan/day | plan/template/date/day/status, task/proof/review links | Unique plan/day; due/status index; linked RLS | scheduled, active, overdue, submitted, approved, backjob, cancelled |
| `care_plan_inventory_usage` | Approved plan actual use | plan/mission/proof/profile/item, quantity before/used/after/unit, Admin actor/time | Unique proof/item; no negative balance; linked RLS | append-only |
| `care_plan_events` | Plan audit timeline | plan/mission/actor/event/metadata/time | Plan/time index; linked read; append-only | event type registry required |

Care Plan price invariant: `duration_days = 30` and current approved service price = `5000.00` (`166.67` displayed average/day). Migration 069 and repository QA agree in source; runtime application and isolated E2E remain required.

Supply invariant: the exact 30-day kilograms are derived from the 180-day catalog and reserved from customer-owned feed before payment. Active manual-care and Care Plan reservations reduce availability. Insufficient balance blocks; Care Plan preparation does not auto-purchase or credit feed.

## 6. Sale, wallet, payout, and withdrawal

| Table | Purpose/PK | Required fields/relationships | Constraints/index/RLS | State family |
|---|---|---|---|---|
| `rooster_sale_requests` | Sale inspection/confirmation/release spine; PK `id` | profile/customer animal, price task/proof/amount, release request/task/proof, wallet transaction, notes/times | One open sale per animal; status/profile indexes; own/Admin/caretaker linked RLS | price_requested, price_assigned, price_submitted, price_backjob, price_ready, sale_requested, sale_rejected, release_pending_assignment, release_assigned, release_submitted, release_backjob, completed, cancelled |
| `rooster_sale_events` | Append-only sale timeline | sale/profile/actor/event/metadata/time | Index sale/time; linked read | append-only |
| `wallet_transactions` | Wallet ledger | profile, typed amount/direction/reference/source, balance metadata/time | Unique source operation; profile/time index; own/Admin read; no client update/delete | posted/reversed taxonomy needs live confirmation |
| `customer_payout_methods` | Customer payout destination | profile, provider, holder, encrypted/masked account data, status/default | No plaintext exposure in UI/logs; profile index; own RLS | active/inactive |
| `withdrawal_requests` | Hold, payout, confirmation spine; PK `id` | profile, amount, payout snapshot, status, hold/refund markers, Admin reference/receipt/note, customer confirmation, idempotency key/times | Profile/status/reference indexes; one hold/refund; own/Admin RLS | kyc_required, for_review, needs_info, sent_for_customer_confirmation, approved legacy, rejected, completed |
| `withdrawal_evidence_logs` | Append-only withdrawal events | request/profile/event/metadata/actor/time | Index request/profile; linked RLS | append-only |

Sale completion and withdrawal hold/refund are ACID-protected. Direct edits to visible balance or ownership are forbidden.

## 7. KYC, Inbox, support, and evidence

| Table/view | Purpose | Required relationships/security | Contract gap |
|---|---|---|---|
| `customer_kyc_profiles` | One customer KYC submission/review record | Unique profile; private fields; own status/Admin review | Full ID vs last-four/retention DEC-006 |
| `kyc_documents` | Private document metadata/path | KYC profile/document type/status; no public URL | Retention DEC-012 |
| KYC consent/evidence tables | Consent and checks | profile/KYC/actor/time | Exact live inventory required |
| `inbox_items` | Customer-visible result/action | profile/category/title/message/reference/read/time | Notification taxonomy/version needs normalization |
| `support_chat_sessions` | Support lifecycle | participant/role/status/escalation | Retention/closing rules incomplete |
| `support_chat_messages` | Persisted transcript | session/sender role/profile/content/time | Redaction/retention incomplete |
| `admin_support_escalated_chats` | Admin queue view | Minimized joined session state | View definition must be verified live |
| `evidence_logs` and domain evidence tables | Sensitive-action audit | workflow/subject/actor/result/time/minimized metadata | Normalized universal schema is incomplete |

## 8. Workflow and KaFarm observability

| Table/view | Purpose | Contract |
|---|---|---|
| `workflow_operation_keys` | Idempotency registry | Unique role/profile/workflow/key; linked read |
| `workflow_chain_runs` | Current cross-role chain | Subject/source/current state/last good/retry/Admin flags/times |
| `workflow_chain_events` | Append-only chain steps | Run/step/state/result/safe metadata/time |
| `kafarm_incidents` | Runtime incident evidence | Role/route/action/request/status/profile/minimized metadata; Admin/owner read |
| `admin_kafarm_incident_queue` | Admin-safe incident view | No secrets or cross-user exposure |
| `kafarm_device_usage_logs` | Layout/route usage | Minimized telemetry, documented retention |
| `kafarm_sql_gateway_audit_logs` | Historical dev gateway provenance | App gateway is removed/disabled; RPC must not be exposed |
| proposed Guardian monitor/memory tables | Future proactive monitoring and semantic incident memory | **PROPOSED, NOT APPLIED**; retention/authority review required |

## 9. Authoritative RPC registry

| Domain | Canonical/current guarded paths |
|---|---|
| Signup/profile | `customer_ensure_signup_profile` |
| Farm Buy/payment | `customer_submit_manual_payment_guarded`, `admin_review_manual_payment_guarded` |
| Manual care | `customer_create_care_request`, `admin_assign_care_request`, `caretaker_submit_manual_mission_proof`, `admin_review_manual_mission_proof_guarded` |
| Care Plan | `customer_request_care_plan`, `customer_prepare_fixed_care_plan_payment`, guarded payment RPCs, `admin_assign_care_plan`, `generate_due_care_plan_missions`, `caretaker_submit_mission_proof`, `admin_review_mission_proof_guarded` |
| Generic proof | `caretaker_submit_task_proof_v3`, `admin_review_task_proof_guarded` |
| Sale | `customer_request_rooster_sale_price`, `customer_confirm_rooster_sale`, `admin_review_rooster_sale_guarded`, `caretaker_submit_rooster_sale_task` |
| Payout/withdrawal | `customer_save_payout_method`, `customer_submit_withdrawal_request_guarded`, `admin_review_withdrawal_request_guarded`, `customer_confirm_withdrawal_result` |
| Caretaker registration | `submit_caretaker_application`, `admin_review_caretaker_application_guarded` |
| KYC | `customer_record_kyc_consent`, `customer_submit_kyc`, `admin_review_customer_kyc_guarded` |
| KaFarm reads | `kafarm_database_health_snapshot`, `kafarm_workflow_chain_snapshot`, `kafarm_care_plan_health_snapshot` |

Older unguarded overloads/functions may remain for migration compatibility but must not be separate authoritative implementations. Their grants and callers require live review.

## 10. Storage contract

| Evidence | Location/current bucket evidence | Upload/read | Limits from source | Deletion/retention |
|---|---|---|---|---|
| Customer KYC | Private KYC bucket from migration 051 | Customer own upload/read; Admin authorized read via signed URL | JPG/PNG/WebP expected; exact size from UI/storage contract must be unified | UNKNOWN DEC-012 |
| Caretaker selfie/resume | `caretaker-resumes` private | Applicant own upload; Admin review | Selfie JPG/PNG/WebP ≤5MB; resume PDF/DOC/DOCX/JPG/PNG/WebP ≤10MB | UNKNOWN |
| Task proof | private caretaker-task proof bucket from migration 033 | Assigned caretaker upload; Admin review; approved linked customer read | UI accepts image/video; source filters images ≤10MB, videos ≤50MB, 1–5 files in task text | UNKNOWN |
| Withdrawal payout proof | private bucket from migration 034 | Admin upload; linked customer signed read | Accepted image types/size must be locked | UNKNOWN |
| Manual payment proof | private evidence upload path in app | Customer upload; Admin review; customer linked receipt | Accepted types/size must be locked consistently | UNKNOWN |

Signed URLs are short-lived (current helper uses 600 seconds). Stored DB values should be bucket/path, not long-lived signed URL.

## 11. Concurrency and recovery invariants

- Use row locks for wallet hold/refund, inventory deduction, proof review, sale finalization, and Care Plan reservation consumption.
- Repeated identical request/decision returns the same canonical outcome or an explicit already-reviewed response.
- Unknown network outcome triggers a read of the operation key/source record before retry.
- Partial chain records identify last successful step and first missing step.
- Never use a notification row as proof that money/ownership changed.

## 12. Database verification gate

- [ ] Live metadata contains all required tables/functions/columns.
- [ ] RLS enabled and policies prove least privilege.
- [ ] Security-definer functions have fixed search path and minimum execute grants.
- [ ] No obsolete unguarded caller remains.
- [ ] Status constraints match this blueprint.
- [ ] PK/FK/unique/index contracts pass.
- [x] Fixed ₱5,000 Care Plan source/test conflict resolved; isolated runtime E2E still pending.
- [ ] Isolated concurrency/idempotency/rollback tests pass.
- [ ] Production restore drill attested.

# HOLD — LIVE DATABASE AND UNRESOLVED CONTRACTS ARE NOT YET LOCKED
