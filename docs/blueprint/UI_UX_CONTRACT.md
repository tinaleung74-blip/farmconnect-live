# FarmConnect UI/UX Contract

Version: `0.1.0-draft`
Status: **HOLD**

## 1. Design tokens and hierarchy

| Token | Approved/current use |
|---|---|
| Primary | Farm green `#1f6b45` |
| Deep green | `#075f48`, `#063e30`, `#102017` |
| Accent | Farm gold `#ffd84a`; amber for attention/actions |
| Surface | Warm cream `#f6f3e8`; white/cream translucent cards |
| Text | Near-black green `#14251f`/`#17251d`; muted `#667267` |
| Success | Emerald/green only for verified/approved/completed |
| Pending | Amber/yellow for waiting/needs attention |
| Error | Red for rejected, failed, blocked, destructive warning |
| Typeface | Current app loads Geist but global body sets Arial/Helvetica; **DESIGN DECISION REQUIRED** for one authoritative family |
| Shape | Rounded cards 20–36px; rounded buttons 12–24px; pill statuses |
| Spacing | 4px base rhythm; page 16px phone, 24px tablet/desktop; section gaps 16–24px |

Buttons: one strong primary action per card/step; destructive/reject is red; secondary is warm neutral. Buttons must have visible text or an accessible name. The generated snapshot found unlabeled buttons; these are accessibility defects, not approved design.

Inputs: label above or programmatically associated; never placeholder-only for critical fields. Password/PIN masked. Disabled state must include explanation, not color alone.

Tables/lists: selectable record on the left, detail in the center, actions on the right for Admin desktop. Preserve selection on refresh unless the item legitimately leaves the open queue.

## 2. Responsive contract

### Customer

- Phone is primary. Bottom/compact navigation must not cover actions; content has safe bottom padding.
- Product grid may use two phone columns only when price, title, unit, stock, and quantity controls remain readable; otherwise one column.
- Tablet uses two-column dashboard/details where space permits.
- Desktop uses max-width content and multi-panel layouts without stretching text excessively.

### Caretaker

- Phone is primary because work occurs on the farm.
- Task procedure, safety guidance, health result, Feed Used, Remaining Feed, evidence, and submit action must appear in the actual reading order.
- Long daily procedures may use anchored sections, but required safety context cannot be collapsed by default.

### Admin

- Desktop/laptop is primary.
- Preferred layout: queue/list left, selected details middle, decision/actions right; internal columns scroll, not the entire desktop when practical.
- Tablet collapses to list/detail with sticky action area.
- Phone is emergency-use stacked mode; no sensitive decision should rely on hover.

## 3. Global UX sequence

Every page answers in its first viewport:

1. Where am I?
2. What is the current authoritative state?
3. What is the next valid action?
4. What evidence/result will that action produce?

Every submitted action follows:

```text
Validate
→ show loading and disable duplicate submit
→ call canonical backend
→ re-read authoritative record
→ show success or exact safe failure
→ reveal the next action
```

Timeout is not rejection and not success. The app re-reads canonical state before allowing retry.

## 4. Customer page contracts

| Page | First understanding | Primary action | Success | Mistake/loading/empty/failure |
|---|---|---|---|---|
| Dashboard | Farm status and items requiring attention today | Open the relevant rooster/request/wallet/guidance | Linked authoritative page | Skeleton/explicit empty; no demo data; failed card read says unavailable |
| My Roosters | Which rooster is selected and its official status | Request Care, Care Logs, or Sell | Opens context-preserving flow | No rooster → Farm Buy CTA; ineligible action explains why |
| Farm Buy | What products exist, price/unit/stock | Set quantity and Pay | Payment flow with frozen cart summary | Stock refresh before pay; empty category clear |
| Farm Requests | Which rooster, which service, cost/stock consequence | Submit care or request fixed Care Plan | Payment or waiting-for-assignment status | Insufficient stock/conflicting workflow shown before submit |
| Payment | What is being paid, exact amount, destination, proof required | Submit proof once | `for_review`, reference, expected Admin step | Preserve safe fields; upload/duplicate/stale errors visible |
| Inventory | Exact owned/reserved/available supply | Buy needed supply or inspect history | Updated ledger after approved event | Zero inventory is valid empty state |
| Care Logs | Only approved care evidence | Filter/read selected log | Secure proof/usage detail | Pending proof never presented as official |
| Sell | No-price vs reviewed-price state | Request price or Confirm Sell | Next Admin/caretaker step | No profit promise; stale reviewed price blocks |
| Wallet | Available, held, and transaction evidence | Withdraw or inspect transaction | Linked request/receipt | Balance hidden until authoritative load |
| Withdrawal | Eligibility and payout confirmation state | Submit request / confirm / report problem | For review or completed evidence | KYC/PIN/balance errors explain exact safe resolution |
| Inbox | What changed and what needs action | Open linked evidence/action | Persistent read state | Broken link retains message and safe fallback |
| Support | Ask for help and know when Admin is involved | Send/escalate | Persisted transcript | No “sent” without persistence |
| Settings/KYC | Profile/security/KYC state | Save allowed field or submit KYC | Visible saved/review state | Private evidence rules and correction path |

### Dashboard decisions still required

- Current desired maturity basis is 180 days; day 60 displays approximately 33.3%.
- `Total Roosters` is approved as useful.
- Final replacements for Growing, Ready for Sale, and Needs Attention are **not locked** (DEC-001).
- For five roosters, the daily insight must clearly identify each relevant rooster; final carousel/list/priority behavior is **not locked** (DEC-002).

### My Roosters Care Plan box

The selected rooster detail has six status boxes. The sixth is Care Plan:

- Paid: plan active/readiness/day progress/today mission/assigned caretaker; customer reads approved work through Care Logs.
- Unpaid: today's standard task/guidance for that rooster and Request Care/Care Plan action; never imply assigned caretaker work.

Care Plan is not a customer top-nav item.

## 5. Caretaker task-detail contract

Reading order:

1. Rooster identity and task day/type.
2. Today's objective.
3. Full procedure and safety protocols from the approved mission catalog.
4. Read-only checklist/guidance (not interactive proof by checkbox).
5. Health result and escalation guidance.
6. Work documentation.
7. Feed Used and Remaining Feed.
8. Evidence upload.
9. Submit Work and Ask Admin.

Do not show a duplicate `Reserved Inventory Used / Actual Used` control group when Feed Used is the input. The server may display the authorized item and before quantity as read-only context. The caretaker reports observed remaining; the approved server calculation remains authoritative and discrepancies are flagged.

## 6. Admin UX contract

- Open queue shows actionable records only.
- Selecting a record never triggers a decision.
- Evidence viewer is separate from decision buttons.
- Approval requires all mandatory proof/state checks.
- Rejection, needs-info, and backjob require a note.
- After a successful final decision, remove the item from open queue, retain it in evidence/history, and select the next record or show empty state.
- Care Plan uses the standard flow: payment review → Task Management assignment → automatic daily tasks. A separate Admin Care Plans step is not part of the approved operating chain.
- One-time care and Care Plan may share a unified queue visual while retaining source type in the record/detail; the user should not need separate “One-Time vs Care Plan Review” page sections.

## 7. KaFarm UX contract

### Whole-App Reader

One Run button. Output area has two columns:

- Technical Report: exact evidence, route, request/RPC/status, confidence, reproduction, safe next check.
- Simple Explanation: plain-language meaning, impact, and next safe step. UI label must not say “ELI5.”

Each column has Copy. No extra operational controls are visible on this primary surface.

### Troubleshooting

Select a real incident, trace current evidence, then prepare a safe recovery plan. “Prepare” does not mean execute. It may deep-link to a functioning canonical Admin page. It must not bypass payment, KYC, ownership, proof, wallet, or RLS.

### Guardian

Evidence Investigation → technical/owner explanation → workflow trace → evidence citations → deterministic gate/proof-of-done. Display `AI ACTIONS FROZEN`, monitor status, and lack of execution adapter honestly. Exact consolidation with the other KaFarm pages requires DEC-007.

## 8. Accessibility contract

- All buttons/links/inputs have accessible names.
- Keyboard focus order follows visual/workflow order; focus visible at 3:1 minimum.
- Status is conveyed by text/icon plus color.
- Minimum target 44×44 CSS px for core phone actions.
- Images carrying evidence have meaningful alt/context; decorative images use empty alt.
- Modal focus is trapped and returned; Escape/Close available unless a critical confirmation requires explicit choice.
- Text supports zoom to 200% without loss of action/data.
- Error message is associated with the relevant field and summarized near submit.

## 9. Known UX conflicts/gaps

| ID | Gap |
|---|---|
| UX-GAP-001 | Global font loads Geist but body specifies Arial/Helvetica. |
| UX-GAP-002 | Static scanner found unlabeled/dynamic-label buttons. |
| UX-GAP-003 | Many legacy routes render the same component without explicit alias messaging or redirect. |
| UX-GAP-004 | Dynamic Admin customer/caretaker `[id]` routes do not have a proven distinct detail contract. |
| UX-GAP-005 | Forgot Password is a placeholder. |
| UX-GAP-006 | Dashboard replacement metrics and multi-rooster daily insight layout are undecided. |
| UX-GAP-007 | Multi-tab role switching shares one browser auth session; user-facing behavior is undecided. |

# HOLD — DESIGN AND UX DECISIONS REMAIN
