# KaFarm Guardian Implementation Status

Generated for the `agent/kafarm-guardian` implementation branch.

## Current classification

KaFarm now has a production-compiling **evidence-grounded Guardian foundation**. It does not yet have an authorized production repair adapter, applied Guardian database schema, demonstrated live OpenAI response, or complete whole-app invariant coverage.

Do not call the 20-phase target complete.

## What is implemented

- A versioned, FarmConnect-only owner blueprint with product, UX, visual, business, security, protected-zone, and proof rules.
- A generated system map built during `predev` and `prebuild`, containing current route, API, action, backend-reference, dependency, test-catalog, commit, branch, and source-fingerprint evidence.
- A server-only OpenAI Responses API reasoning path using strict function tools and strict structured output.
- Ten controlled, read-only evidence tools:
  - system map;
  - route;
  - safe source reference;
  - dependency;
  - live database metadata;
  - workflow reconciliation;
  - incidents;
  - test catalog/result evidence;
  - build-time Git identity;
  - owner blueprint/invariants.
- Active-Admin re-authentication and re-authorization on every Guardian request.
- PII/secret minimization before evidence is sent to the model.
- A deterministic gate with `PASS`, `HOLD`, `APPROVAL_REQUIRED`, and `BLOCK`.
- Green, Yellow, Orange, and Red autonomy levels.
- `AI ACTIONS FROZEN`, safe-default enabled.
- No model-accessible SQL, approval, wallet, payment, KYC, identity, ownership, destructive, or generic mutation tool.
- Six critical invariant definitions covering Farm Buy, care assignment, Caretaker proof, sale, withdrawal, and KYC reconciliation.
- An Anti-Malfunction trace foundation that distinguishes a confirmed invariant violation from an unproven root cause.
- Similar-incident candidate matching over existing durable KaFarm incidents, with mandatory current-system revalidation.
- A read-only proactive monitor route with severity and deduplication. It is disabled by default.
- A Guardian Admin UI at `/admin/kafarm/guardian` with technical explanation, owner explanation, workflow trace, evidence, gate result, and proof-of-done states.
- A read-only cleanup audit that identifies oversized, unreachable, stale, and placeholder KaFarm surfaces without deleting them.
- Guardian static safety contract and executable logic-gate unit tests.

## What is staged but not activated

The following files are proposals and were not applied to Supabase:

- `database/proposed/067_kafarm_guardian_read_only_monitor.sql`
- `database/proposed/068_kafarm_guardian_semantic_incident_memory.sql`

The scheduled monitor remains fail-closed unless all of these are true:

- the proposed monitor RPC is independently reviewed and explicitly applied;
- `CRON_SECRET` exists;
- `SUPABASE_SERVICE_ROLE_KEY` exists server-side;
- `NEXT_PUBLIC_SUPABASE_URL` is the exact FarmConnect project;
- `KAFARM_MONITOR_ENABLED=true` is explicitly configured.

## Environment controls

- `OPENAI_API_KEY`: server-only. If absent, Guardian returns a deterministic evidence fallback and never claims that LLM reasoning ran.
- `KAFARM_OPENAI_MODEL`: optional; defaults to `gpt-5.4`.
- `KAFARM_AI_ACTIONS_FROZEN`: defaults to `true`. Set to `false` only as part of a reviewed future execution rollout.
- `KAFARM_MONITOR_ENABLED`: defaults to `false`.
- `CRON_SECRET`: authenticates scheduled routes.
- `SUPABASE_SERVICE_ROLE_KEY`: server-only and never supplied to the model or browser.

## Phase truth table

| Phase | Status | Evidence / remaining work |
|---|---|---|
| 1. Preserve and map | Foundation implemented | Existing KaFarm reused; generated map and cleanup audit added. Full dynamic call graph remains partial. |
| 2. Real LLM reasoning | Implemented, live proof pending | Server-only Responses API path exists. Needs a configured key and an active-Admin live test. |
| 3. Living system map | Partial | Rebuilt on dev/build with 110 pages/API inventory and graph edges. Possible proximity edges still require runtime confirmation. |
| 4. Owner blueprint | Implemented | Versioned JSON blueprint. Owner changes require a reviewed version update. |
| 5. Anti-Malfunction | Partial | Selected invariant findings produce last-good/first-unproven traces. Not all workflows are covered. |
| 6. Durable workflow spine | Existing + partial strengthening | Existing workflow-chain tables/RPC are reused. Coverage is not complete for every app action. |
| 7. Invariant engine | Partial | Six critical invariant definitions plus existing reconciliation RPC. Generic invariant executor is not complete. |
| 8. Proactive monitoring | Staged, disabled | Read-only route/schedule exists; proposed RPC is unapplied and flag defaults off. |
| 9. Root-cause engine | Implemented path, live proof pending | LLM tool loop and confidence downgrade exist. It cannot label `CONFIRMED` without multi-source runtime evidence. |
| 10. Logic gate | Implemented and unit tested | Five decision scenarios pass. |
| 11. Protected areas | Implemented boundary | No mutation tool or execution adapter exists. |
| 12. Safe Builder | Not implemented | Requests may be assessed, but code/database repair execution is unavailable. |
| 13. Self-cleanup | Audit only | Debt is reported; no automatic deletion. |
| 14. Test orchestration | Partial | Existing suite plus Guardian contracts are wired. Full live readiness still needs isolated DB and E2E prerequisites. |
| 15. Proof of Done | Implemented model/UI contract | PASS is downgraded when no matching current-release artifact exists. |
| 16. Incident memory | Partial/staged | Existing incidents get similarity candidates; durable enriched table is proposed but unapplied. |
| 17. Owner Teacher Mode | Implemented output contract/UI | Requires live reasoning or deterministic fallback evidence. |
| 18. Autonomy levels | Implemented | Green/Yellow/Orange/Red feed the deterministic gate. |
| 19. Kill switch | Implemented | Default is frozen. No mutation adapter exists even when unfrozen. |
| 20. Progressive migration | In progress | Existing incident, scanner, health, workflow, and UI pieces remain; weak hardcoded surfaces are documented, not blindly deleted. |

## Current verification

- Production build: **PASS**.
- TypeScript: **PASS**.
- Targeted Guardian ESLint: **PASS**.
- Guardian safety contract: **PASS** (14 checks).
- Guardian logic-gate unit tests: **PASS** (5 scenarios).
- Local browser page render: **PASS**.
- Local active-Admin boundary: **PASS** (unauthenticated request rejected).
- Browser console errors on Guardian page: **none captured**.
- Live OpenAI reasoning: **NOT RUN** (`OPENAI_API_KEY` was not supplied to this isolated worktree).
- Live database evidence reads: **NOT RUN** (no active Admin session in the isolated browser).
- Proposed Guardian SQL: **NOT APPLIED**.
- Production deployment: **NOT PERFORMED**.
- Production mutation/transaction: **NONE**.

## Existing cleanup debt discovered

- `app/admin/kafarm/_components/KafarmPhaseOne.tsx` remains oversized.
- `simpleReportView = true` leaves a lower KaFarm branch unreachable.
- Existing placeholder health claims still appear in the legacy component.

These were not deleted because dependency and regression proof for that cleanup does not yet exist.

## Safe next rollout

1. Review this branch and the two proposed SQL files.
2. Configure a server-side OpenAI key in an isolated Preview deployment.
3. Run one active-Admin Guardian diagnosis against known non-sensitive evidence.
4. Verify tool citations, PII redaction, confidence downgrade, and gate behavior.
5. Independently review and apply only the monitor proposal if proactive database monitoring is approved.
6. Keep the incident-memory proposal unapplied until retention, privacy, and update authority are decided.
7. Expand invariants workflow by workflow, with a failing fixture and a passing fixture for each.
8. Do not add a repair adapter until approval storage, independent verification, rollback, audit evidence, and isolated execution tests exist.
