# FarmConnect Six-Checker Blueprint Review

Version reviewed: `0.1.0-draft`
Review date: 2026-08-18
Overall verdict: **HOLD**

This is the first structured review, not six independent approvals. Human checkers remain unassigned/unapproved.

## AI Checker 1 — Target user / zero assistance

Verdict: **PARTIAL**

Strengths:

- Core Customer navigation and workflows expose recognizable next steps.
- Customer, Admin, and Caretaker roles are separated.
- Payment, Care, Sale, and Withdrawal have evidence/status concepts.

Blocking gaps:

- Unlabeled buttons exist in static inventory.
- Many legacy routes silently render another surface instead of explaining or redirecting.
- Forgot Password is a placeholder.
- Dashboard replacement metrics and multi-rooster daily guidance layout are not decided.
- Care Plan supply-source behavior when stock is insufficient is unclear.
- Admin generic/alias pages may appear finished while lacking a distinct contract.

Required proof: moderated task walkthrough with a new Customer, newly approved Caretaker, and Admin who did not build the app; no coaching.

## AI Checker 2 — Real-world behavior

Verdict: **PARTIAL**

Covered in current architecture/tests:

- Stable idempotency for guarded payment and several Admin reviews.
- Mission uniqueness/retry behavior.
- Backjob and health escalation concepts.
- Stale session incident capture.

Blocking gaps:

- Full current-release reload/back/multiple-tab matrix is not proven.
- Multi-tab roles share the same browser session without a locked UX policy.
- Slow upload, interrupted file upload, offline recovery, and unknown network outcome need explicit tests.
- Rate limits/abuse behavior is undefined.
- No-response timeout for payout confirmation is undefined.

Required proof: isolated browser matrix for double click, reload, back, timeout, expired session, two tabs, and interrupted upload.

## AI Checker 3 — Hidden technical guardian

Verdict: **PARTIAL / ENFORCEABLE FOUNDATION**

Strengths:

- Generated route/action/backend map and owner blueprint foundation.
- Guarded RPCs, RLS-focused QA, workflow-chain records, incident evidence.
- KaFarm Guardian is read-only with a deterministic gate and frozen actions.

Blocking gaps:

- System map is largely static and does not prove runtime edges.
- Six invariant definitions do not cover the whole app.
- Proposed Guardian SQL 067–068 is unapplied.
- No repair adapter exists, which is currently the safe outcome.
- Live OpenAI reasoning and PII-redaction evidence are not demonstrated.
- Legacy KaFarm has unreachable/placeholder surfaces.

Required proof: current-release live metadata diff, runtime traces, invariant fixtures, safe model evaluation, and no-mutation test.

## Human Checker 1 — Product/business

Status: **NOT APPROVED**

Must decide:

- Dashboard KPIs and multi-rooster guidance presentation.
- Runtime proof that migration 069 blocks insufficient customer feed and never auto-purchases/credits it.
- Membership, Cash-in, and locked-savings scope.
- KYC data depth/retention.
- KaFarm final page information architecture.
- Evidence retention, payout dispute timeout, operations/release authority.

Owner-approved facts already captured: fixed ₱5,000/30-day Care Plan, Task Management assignment, no Care Plan top-nav item, premium standard for paid/unpaid, exact inventory actual use after approval, full guarded buy/care/sale/withdrawal chains.

## Human Checker 2 — UI/UX

Status: **NOT APPROVED**

Must review:

- Customer phone layouts and all page empty/loading/error states.
- Sixth My Roosters Care Plan box for paid/unpaid cases.
- Caretaker task reading order, read-only procedure, Feed Used/Remaining Feed.
- Unified Admin queue and 3-pane desktop layout.
- Font/token consistency, button labeling, keyboard/focus/zoom.
- Redirect vs removal of legacy routes.

Required artifact: approved desktop/tablet/phone screenshots or design references for each canonical surface.

## Human Checker 3 — Principal full-stack engineer

Status: **NOT APPROVED**

Must review:

- Live schema vs `DATABASE_CONTRACT.md`, including legacy tables not created in repository history.
- Every guarded RPC's Auth UID/role/relationship/state checks, grants, search path, transaction, locks, and idempotency.
- Auth UID-only customer profile regression across legacy callers.
- Fixed Care Plan/source agreement is complete; isolated migration 069 E2E remains pending.
- Storage MIME/size/privacy/retention, CORS/CSRF applicability, rate limits, error exposure.
- Backup restore drill and release compatibility.
- Oversized `lib/farmconnect-v1.tsx`/legacy KaFarm maintainability risk without unapproved refactor.

## Consolidated gate

| Gate | State |
|---|---|
| Purpose/roles | READY FOR OWNER REVIEW |
| Page inventory | COMPLETE AS CURRENT-STATE INVENTORY; legacy scope decisions remain |
| Element inventory | CANONICAL CRITICAL ELEMENTS DOCUMENTED; accessibility audit remains |
| Workflow/state machines | DOCUMENTED; status normalization/live proof remains |
| Business rules | SOURCE-ALIGNED for Care Plan price/feed; other unknowns remain |
| Database | BLOCKED pending live metadata/security review |
| Identity/security | Auth UID source aligned; BLOCKED by rate/retention/live-regression gaps |
| UI/UX | BLOCKED by owner/design decisions |
| Deployment/recovery | BLOCKED by restore/approval gaps |
| Owner approval | NOT GIVEN |
| Builder comprehension | HOLD |

# HOLD — APP DEFINITION IS NOT COMPLETE
