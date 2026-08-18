# FarmConnect Blueprint Decision Log

Version: `0.1.0-draft`
Purpose: preserve owner decisions, their evidence class, and later conflicts. Secrets/test-account passwords are intentionally excluded.

## Accepted owner decisions

| Decision ID | Date/context | Decision | Classification | Blueprint impact |
|---|---|---|---|---|
| DL-001 | Recorded owner workflow | Customer, Admin, and Caretaker form one end-to-end operational system. | OWNER APPROVED | Three primary human roles; cross-role evidence chains required. |
| DL-002 | Live checklist/test | Core production flow passed signup/KYC, Farm Buy, care assignment/proof, sale/wallet, withdrawal/Inbox. | VERIFIED BASELINE | Historical release evidence `LIVE-20260813-E2E-01`; not proof of later code. |
| DL-003 | Withdrawal correction | Adding payout method is allowed without KYC; withdrawal submission is blocked until KYC approved. | OWNER APPROVED | KYC gate belongs at submit, not payout-method setup. |
| DL-004 | Care Plan definition | Paid Care Plan automates daily caretaker tasks; unpaid customer still gets premium-standard daily guidance. | OWNER APPROVED | Paid/unpaid differ in automation/assignment, not care quality. |
| DL-005 | Care Plan operating path | Request in Farm Requests → payment review → Task Management assignment → automatic daily tasks; customer checks Care Logs. | OWNER APPROVED | No separate operational Admin Care Plan approval page. |
| DL-006 | Care Plan price | 30 days = ₱5,000. | OWNER APPROVED | Server fixed price; correct stale variable-price tests. |
| DL-007 | Day 1 | Caretaker prepares rooster and complete required products/package; part of Day 1. | OWNER APPROVED | Readiness gate before normal mission completion. |
| DL-008 | Mission catalog | 180-day procedure/safety file guides caretaker tasks; caretaker/farm retains physical judgment and responsibility. | OWNER APPROVED | Read-only procedure/safety; evidence/health remains actionable. |
| DL-009 | Customer IA | Remove Care Plans from top navigation; show/request in Farm Requests and per-rooster Care Plan box. | OWNER APPROVED | `/customer/care-plans` redirects; sixth My Roosters box. |
| DL-010 | Inventory | Check sufficient available quantity before accepting consuming care; deduct exact decimal actual use only after approved proof; notify/log before/after. | OWNER APPROVED | Reservation + approved-use ledger, no double deduction. |
| DL-011 | Caretaker task UI | Remove duplicate Reserved/Actual control; keep Feed Used and add Remaining Feed; checklist/procedure is read-only. | OWNER APPROVED | Task-detail UI contract. |
| DL-012 | Admin care queue | Present one normal care queue instead of separate one-time/Care Plan review sections. | OWNER APPROVED | Unified queue visual; source type retained in data. |
| DL-013 | Care Plan feed source | Require sufficient customer-owned age-based feed before payment; never auto-purchase or credit missing feed. | OWNER APPROVED | Implemented in migration 069; isolated E2E pending. |
| DL-014 | Customer identity | Resolve profiles by Auth UID only; email remains contact/display data. | OWNER APPROVED | Legacy helper corrected; security contract added. |
| DL-013 | Sale | Show no-price state, caretaker inspection, Admin-reviewed price, customer decision, final release proof, then wallet credit. | OWNER APPROVED | No guaranteed profit/price. |
| DL-014 | KaFarm | Three conceptual surfaces: report/reader, simple+technical comparison, and troubleshooting/continuity; diagnose and resume official workflow without fabricating records. | OWNER APPROVED DIRECTION | Exact current route consolidation still undecided. |
| DL-015 | KaFarm safety | No generic SQL gateway; no automatic protected action; Admin remains final authority. | OWNER APPROVED | Guardian read-only/frozen foundation. |
| DL-016 | Dashboard maturity | Use 180 days (six months) as maturity duration; day 60 ≈ 33.3%. | OWNER APPROVED | Maturity progress formula. |
| DL-017 | Device focus | Customer/Caretaker mobile-first; Admin laptop/desktop-first. | OWNER APPROVED | Responsive contracts. |
| DL-018 | Release testing | Do not repeat sensitive production transactions when the already-tested workflow code did not change; use non-destructive regression. | OWNER APPROVED SAFETY | Historical lock plus scoped current smoke tests. |

## Conflicts and superseded implementation

| Conflict ID | Sources | Current disposition |
|---|---|---|
| CF-001 | Owner fixed ₱5,000 vs stale `scripts/qa/business-flow-contract.mjs` ₱350 test | RESOLVED IN SOURCE: fixed ₱5,000 business test; isolated E2E pending. |
| CF-002 | Owner says no Care Plan top-nav/separate Admin step vs exported legacy `CustomerCarePlansPage`/`AdminCarePlansPage` | Current route redirects align; dead/legacy component removal needs dependency proof. |
| CF-003 | Auth UID identity rule vs email fallback in `resolveCustomerProfile` | RESOLVED IN SOURCE: Auth UID-only lookup; live caller regression pending. |
| CF-004 | Owner wants read-only task procedure vs older interactive checklist proof expectations | Latest owner decision wins; backend may retain checklist snapshot validation, but UI checkboxes cannot be treated as physical proof. Exact mapping needs engineering review. |
| CF-005 | Owner wants one unified care queue vs earlier separate “One-Time Care Payment Queue”/Care Plan review UI | Unified queue wins; ensure source type remains traceable. |
| CF-006 | KaFarm “auto-fixed logs” label vs explicit no-auto-fix/protected-zone rule | Safety rule wins; rename/remove/consolidate after IA decision. |
| CF-007 | Global Geist setup vs Arial/Helvetica body | UI checker/owner must select one. |

## Open owner decisions

| Decision ID | Question | Options/impact | Status |
|---|---|---|---|
| DEC-001 | Which Dashboard metrics replace low-value Growing/Ready for Sale/Needs Attention cards? | Must support actual daily decisions and authoritative data. | OPEN |
| DEC-002 | How are daily insights presented for multiple roosters? | Per-rooster list, priority queue, or carousel; must never hide urgent health work. | OPEN |
| DEC-004 | Who supplies/funds the Care Plan feed when customer inventory is short? | RESOLVED: request is blocked until sufficient customer-owned feed exists; no silent farm subsidy or automatic credit. | CLOSED |
| DEC-005 | How does password recovery work? | Supabase reset email and/or Admin-assisted identity process; security/rate/audit required. | OPEN |
| DEC-006 | KYC ID data depth and retention? | Last four vs full encrypted ID, validation provider, retention/legal basis. | OPEN |
| DEC-007 | Final KaFarm page architecture? | Consolidated 3 pages or legacy pages + Guardian; affects navigation/debt. | OPEN |
| DEC-008 | Multi-tab role behavior? | Warn/switch all tabs, isolate sessions by subdomain/browser profile, or disallow mixed-role tabs. | OPEN |
| DEC-009 | Backup/release operations? | RPO/RTO, restore cadence, approvers, contacts. | OPEN |
| DEC-010 | Rate-limit thresholds? | Per IP/user/device/workflow; affects abuse and UX. | OPEN |
| DEC-011 | Membership/Cash-in/locked savings scope? | Keep and specify, hide, or remove after dependency proof. | OPEN |
| DEC-012 | Evidence retention/deletion? | Category-specific legal/business periods and deletion authority. | OPEN |
| DEC-013 | No-response withdrawal confirmation policy? | Reminders/escalation/manual investigation; no automatic completion without approval. | OPEN |

## Approval record

Blueprint owner approval: **NOT GIVEN**
UI/UX human approval: **NOT GIVEN**
Principal engineering approval: **NOT GIVEN**
Locked version/date/exceptions: **NONE**

# HOLD — OWNER DECISIONS REMAIN OPEN
