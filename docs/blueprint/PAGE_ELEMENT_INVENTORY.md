# FarmConnect Page and Element Inventory

Version: `0.1.0-draft`
Evidence base: 110 page routes and 139 statically reachable actions from the 2026-08-18 generated KaFarm snapshot, plus direct source inspection.
Status: **HOLD** — route presence does not mean the route is owner-approved.

## Shared page-state and responsive codes

To avoid repeating the same contract 110 times, each route references these mandatory profiles.

| Code | Loading | Empty | Error | Mobile/tablet/desktop |
|---|---|---|---|---|
| ST-PUB | No fake content; short page-level loading only when Auth is checked | Explain the next action | Safe inline message; preserve entered non-secret fields where appropriate | Single column phone; centered card tablet/desktop |
| ST-CUS | Verify session/profile before private data; show explicit loading | “No records yet” plus valid first action; never demo data | No false success; identify safe retry/next step | Mobile-first; tablet may use 2 columns; desktop max-width multi-panel |
| ST-CARE | Verify approved active caretaker and task relationship | “Waiting for assignment” | Preserve draft proof locally only if safe; reload canonical task before retry | Mobile-first task cards; tablet/desktop split task list/details |
| ST-ADM | Verify active Admin; load queue and selected detail independently | “No actionable records” and historical destination | Keep selected record; show canonical error and refresh/re-auth option | Desktop-first 3-pane; tablet 2-pane; phone stacked emergency usability |
| ST-KAF | Active Admin check; evidence reads display progress | “No diagnosis run” or “no confirmed finding” | Evidence gap is `UNPROVEN`, not success | Desktop-first report; tablet/phone stacked read-only sections |
| ST-ALIAS | Immediate canonical redirect | Not applicable | If redirect fails, show canonical link | Same as target |

Entry code `NAV` means role navigation; `DEEP` means a linked record/notification may deep-link; `ALIAS` means compatibility redirect. Exit code `ROLE` means other same-role destinations and safe logout; `FLOW` means the next workflow page.

## Complete public/system route inventory

| Page ID | Route | Surface/purpose | Entry → exit | Required data | State |
|---|---|---|---|---|---|
| SYS-PG-001 | `/` | Unified sign-in/sign-up landing | Public → role workspace/signup/view-farm/forgot-password | Auth submission; optional role profile lookup | ST-PUB |
| SYS-PG-002 | `/login` | Compatibility redirect to `/` | ALIAS → `/` | None | ST-ALIAS |
| SYS-PG-003 | `/signup` | Customer signup | Public/landing → customer dashboard or sign-in | Auth, profile fields, consent | ST-PUB |
| SYS-PG-004 | `/forgot-password` | Password recovery placeholder | Landing → `/` | **UNKNOWN; no reset backend** | ST-PUB; DEC-005 |
| SYS-PG-005 | `/view-farm` | Public, read-only feature preview | Landing → sign-in/create account | Static approved marketing copy only | ST-PUB |

## Complete customer route inventory

| Page ID | Route | Canonical surface/purpose | Entry → exit | Required data | State |
|---|---|---|---|---|---|
| CUS-PG-001 | `/customer` | Customer Dashboard alias surface | login/NAV → ROLE | profile, roosters, requests, wallet, activity, guidance | ST-CUS |
| CUS-PG-002 | `/customer/dashboard` | Customer command center | login/NAV → ROLE/FLOW | same as above | ST-CUS |
| CUS-PG-003 | `/customer/roosters` | My Roosters details/actions | NAV/ownership result → care logs, care request, sell | own `customer_animals`, care/plan/sale overview | ST-CUS |
| CUS-PG-004 | `/customer/chicks` | Legacy alias rendering rooster surface | DEEP → My Roosters destinations | own roosters | ST-CUS; product decision required |
| CUS-PG-005 | `/customer/caretakers` | Legacy alias rendering rooster surface | DEEP → My Roosters destinations | own rooster/care overview | ST-CUS; product decision required |
| CUS-PG-006 | `/customer/caretakers/dashboard` | Legacy alias rendering rooster surface | DEEP → My Roosters destinations | own rooster/care overview | ST-CUS; product decision required |
| CUS-PG-007 | `/customer/farm-buy` | Product catalog and cart | NAV/care supply link → payment | products, stock, cart, optional care purpose | ST-CUS |
| CUS-PG-008 | `/customer/marketplace` | Legacy alias rendering Farm Buy | DEEP → payment | same as Farm Buy | ST-CUS; alias decision required |
| CUS-PG-009 | `/customer/marketplace/dashboard` | Legacy alias rendering Farm Buy | DEEP → payment | same as Farm Buy | ST-CUS; alias decision required |
| CUS-PG-010 | `/customer/store` | Legacy alias rendering Farm Buy | DEEP → payment | same as Farm Buy | ST-CUS; alias decision required |
| CUS-PG-011 | `/customer/farm-requests` | Care service and Care Plan entry/status | NAV/My Roosters → payment/status/Care Logs | own roosters, services, requests, plans, inventory sufficiency | ST-CUS |
| CUS-PG-012 | `/customer/care-plans` | Redirect to Farm Requests | ALIAS → `/customer/farm-requests` | None | ST-ALIAS |
| CUS-PG-013 | `/customer/live-camera` | Legacy alias rendering Farm Requests | DEEP → request flow | same as Farm Requests | ST-CUS; scope decision required |
| CUS-PG-014 | `/customer/photo-updates` | Legacy alias rendering Farm Requests | DEEP → request flow | same as Farm Requests | ST-CUS; scope decision required |
| CUS-PG-015 | `/customer/weight-updates` | Legacy alias rendering Farm Requests | DEEP → request flow | same as Farm Requests | ST-CUS; scope decision required |
| CUS-PG-016 | `/customer/payment` | Manual payment proof submission | Farm Buy/Farm Requests → request status/inbox | immutable source summary, amount, channel, reference, receipt | ST-CUS |
| CUS-PG-017 | `/customer/inventory` | Owned supply quantities | NAV/Farm Buy result/care warning → Farm Buy | own inventory, reservation/need context | ST-CUS |
| CUS-PG-018 | `/customer/care-logs` | Approved care evidence history | My Roosters/Inbox → proof detail/My Roosters | approved proofs, usage logs, caretaker/task links | ST-CUS |
| CUS-PG-019 | `/customer/sell-rooster` | Sale price request/customer confirmation | My Roosters → status/My Roosters | own rooster, open sale request, approved price | ST-CUS |
| CUS-PG-020 | `/customer/sell-chicken` | Redirect to Sell Rooster | ALIAS → `/customer/sell-rooster` | search parameter must be preserved/verified | ST-ALIAS |
| CUS-PG-021 | `/customer/wallet` | Balance and transaction history | NAV/sale completion → withdrawal/cashin | profile balance/hold, wallet transactions | ST-CUS |
| CUS-PG-022 | `/customer/membership` | Legacy alias rendering Wallet | DEEP → wallet flows | wallet; membership rules UNKNOWN | ST-CUS; DEC-011 |
| CUS-PG-023 | `/customer/cashin` | Cash-in method/proof surface | Wallet → method/receipt status | methods/history; current backend authority must be confirmed | ST-CUS; DEC-011 |
| CUS-PG-024 | `/customer/cashin/bpi` | BPI QR instructions | Cash-in → Cash-in/payment | static QR/channel data | ST-CUS |
| CUS-PG-025 | `/customer/cashin/gcash` | GCash QR instructions | Cash-in → Cash-in/payment | static QR/channel data | ST-CUS |
| CUS-PG-026 | `/customer/cashin/maya` | Maya QR instructions | Cash-in → Cash-in/payment | static QR/channel data | ST-CUS |
| CUS-PG-027 | `/customer/withdraw` | Withdrawal submission/history/confirmation | Wallet → payout method/Inbox | KYC status, Wallet PIN gate, available balance, methods, own requests | ST-CUS |
| CUS-PG-028 | `/customer/withdraw/add-payout` | Add payout method | Withdrawal → Withdrawal | own profile; provider/holder/account | ST-CUS |
| CUS-PG-029 | `/customer/inbox` | Notifications/evidence entry | NAV/transition → invoice/related flow | own Inbox items/read state | ST-CUS |
| CUS-PG-030 | `/customer/notifications` | Legacy alias rendering Inbox | DEEP → invoice/flow | own Inbox items | ST-CUS; alias decision required |
| CUS-PG-031 | `/customer/inbox/invoice/farm-buy` | Farm Buy invoice/result | Inbox/payment → Farm Buy/Inbox | reference-linked payment/invoice/evidence | ST-CUS |
| CUS-PG-032 | `/customer/inbox/invoice/care-request` | Care invoice/result | Inbox/payment → Farm Requests/Inbox | reference-linked payment/care evidence | ST-CUS |
| CUS-PG-033 | `/customer/inbox/invoice/cashin` | Cash-in invoice/result | Inbox/cashin → Wallet/Inbox | reference-linked cashin evidence | ST-CUS; authority decision required |
| CUS-PG-034 | `/customer/support` | KaFarm/support chat and escalation | NAV → same/Inbox | own support session/messages | ST-CUS |
| CUS-PG-035 | `/customer/customer-service` | Legacy alias rendering Support | DEEP → support | same as Support | ST-CUS; alias decision required |
| CUS-PG-036 | `/customer/settings` | Profile, KYC, security, contact details | NAV/withdrawal gate → Withdrawal/Dashboard | own profile, KYC/doc status, security state | ST-CUS |
| CUS-PG-037 | `/customer/login` | Unified login with customer hint | Public → role workspace | Auth/profile role | ST-PUB |
| CUS-PG-038 | `/customer/register` | Customer signup alias surface | Public → customer dashboard | signup/profile | ST-PUB |

## Complete caretaker route inventory

| Page ID | Route | Canonical surface/purpose | Entry → exit | Required data | State |
|---|---|---|---|---|---|
| CT-PG-001 | `/caretaker` | Caretaker home | login/NAV → dashboard/tasks | active caretaker profile, task summary | ST-CARE |
| CT-PG-002 | `/caretaker/dashboard` | Operation checker/dashboard | login/NAV → tasks | assigned active tasks/steps | ST-CARE |
| CT-PG-003 | `/caretaker/tasks` | Full active task execution/proof | NAV/assignment → submitted state/chat | assigned tasks, rooster identity, procedure, safety, inventory, proof attempts | ST-CARE |
| CT-PG-004 | `/caretaker/feeding` | Legacy alias rendering Tasks | DEEP → task flow | same as Tasks | ST-CARE; alias decision required |
| CT-PG-005 | `/caretaker/photos` | Legacy alias rendering Tasks | DEEP → task flow | same as Tasks | ST-CARE; alias decision required |
| CT-PG-006 | `/caretaker/weight` | Legacy alias rendering Tasks | DEEP → task flow | same as Tasks | ST-CARE; alias decision required |
| CT-PG-007 | `/caretaker/completed` | Approved/completed task history | NAV → task evidence | own completed tasks/proofs | ST-CARE |
| CT-PG-008 | `/caretaker/chat` | Admin support chat | NAV/task → tasks | caretaker support session/messages | ST-CARE |
| CT-PG-009 | `/caretaker/mortality` | Legacy alias rendering Chat | DEEP → chat | same as Chat | ST-CARE; scope decision required |
| CT-PG-010 | `/caretaker/notes` | Legacy alias rendering Chat | DEEP → chat | same as Chat | ST-CARE; scope decision required |
| CT-PG-011 | `/caretaker/profile` | Approved caretaker profile | NAV → ROLE | own profile/status | ST-CARE |
| CT-PG-012 | `/caretaker/signup` | Caretaker application | permanent link → pending/login | form, private selfie/resume | ST-PUB |
| CT-PG-013 | `/caretaker/login` | Unified login with caretaker hint | Public → role workspace | Auth/profile role | ST-PUB |

## Complete Admin route inventory

| Page ID | Route | Canonical surface/purpose | Entry → exit | Required data | State |
|---|---|---|---|---|---|
| ADM-PG-001 | `/admin` | Admin dashboard/queues/chat/actions | login/NAV → Admin domains | active Admin, queue summaries, chats, selected record | ST-ADM |
| ADM-PG-002 | `/admin/analytics` | Alias rendering Admin dashboard | DEEP → Admin domains | same as Admin dashboard | ST-ADM; alias decision required |
| ADM-PG-003 | `/admin/login` | Unified login with Admin hint | Public → role workspace | Auth/profile role | ST-PUB |
| ADM-PG-004 | `/admin/customer-requests` | Unified Customer Requests desk | NAV → payment/care/task/sell/withdraw | actionable customer queues | ST-ADM |
| ADM-PG-005 | `/admin/customer-requests/payment` | Manual payment review | Customer Requests → invoice/evidence | pending payment requests, profiles, receipt | ST-ADM |
| ADM-PG-006 | `/admin/customer-requests/care` | Care request review compatibility surface | Customer Requests → Task/Payment | care requests/payments | ST-ADM |
| ADM-PG-007 | `/admin/customer-requests/task` | Task Management: assignment and proof review | payment/care → caretaker task/evidence | paid requests/plans, active caretakers, tasks/proofs | ST-ADM |
| ADM-PG-008 | `/admin/customer-requests/sell` | Sale inspection/release review | Customer Requests → task/evidence | sale requests, approved price/proof | ST-ADM |
| ADM-PG-009 | `/admin/sell-requests` | Alias rendering sale queue | DEEP → sale review | same as above | ST-ADM |
| ADM-PG-010 | `/admin/customer-requests/withdraw` | Withdrawal review | Customer Requests → receipt/evidence | withdrawal requests, payout method/proof | ST-ADM |
| ADM-PG-011 | `/admin/customer-requests/kyc` | Redirect to Account Verification | ALIAS → `/admin/account-verification` | None | ST-ALIAS |
| ADM-PG-012 | `/admin/customer-requests/security` | Redirect to Account Verification | ALIAS → `/admin/account-verification` | None | ST-ALIAS |
| ADM-PG-013 | `/admin/customer-requests/wallet` | Redirect to payment queue | ALIAS → `/admin/customer-requests/payment` | None | ST-ALIAS; IA decision required |
| ADM-PG-014 | `/admin/customer-requests/resolved` | Redirect to Evidence | ALIAS → `/admin/evidence` | None | ST-ALIAS |
| ADM-PG-015 | `/admin/customers` | Alias rendering Customer Requests workspace | DEEP → customer queue | customer request data | ST-ADM; alias decision required |
| ADM-PG-016 | `/admin/customers/[id]` | Alias rendering Customer Requests; dynamic ID currently not a distinct detail contract | DEEP → customer queue | customer ID is not clearly consumed | ST-ADM; contract gap |
| ADM-PG-017 | `/admin/memberships` | Alias rendering Customer Requests | DEEP → customer queue | membership rules UNKNOWN | ST-ADM; DEC-011 |
| ADM-PG-018 | `/admin/account-verification` | Unified customer/caretaker verification | NAV → secure evidence/queue/history | KYC and caretaker applications/profiles/docs | ST-ADM |
| ADM-PG-019 | `/admin/caretaker-management` | Registration link, directory, assignment/proof/history | NAV → task/evidence | applications, caretakers, tasks, proofs | ST-ADM |
| ADM-PG-020 | `/admin/caretaker-registration` | Redirect to Caretaker Management | ALIAS → `/admin/caretaker-management` | None | ST-ALIAS |
| ADM-PG-021 | `/admin/caretaker-hires` | Alias rendering Caretaker Management | DEEP → caretaker desk | same as above | ST-ADM; alias decision required |
| ADM-PG-022 | `/admin/caretakers` | Alias rendering Caretaker Management | DEEP → caretaker desk | same as above | ST-ADM; alias decision required |
| ADM-PG-023 | `/admin/caretakers/[id]` | Alias rendering Caretaker Management; dynamic ID is not a distinct detail contract | DEEP → caretaker desk | caretaker ID is not clearly consumed | ST-ADM; contract gap |
| ADM-PG-024 | `/admin/care-plans` | Redirect to Task Management | ALIAS → `/admin/customer-requests/task` | None | ST-ALIAS |
| ADM-PG-025 | `/admin/farm-operations` | Farm operations desk | NAV → evidence/requests | sales/customer/care operational summaries | ST-ADM; exact approved widgets incomplete |
| ADM-PG-026 | `/admin/operations` | Alias rendering Farm Operations | DEEP → farm desk | same as above | ST-ADM; alias decision required |
| ADM-PG-027 | `/admin/harvest` | Alias rendering Farm Operations | DEEP → farm desk | same as above | ST-ADM; scope decision required |
| ADM-PG-028 | `/admin/sell-price` | Alias rendering Farm Operations | DEEP → farm desk | same as above | ST-ADM; alias decision required |
| ADM-PG-029 | `/admin/sell-pricetag` | Alias rendering Farm Operations | DEEP → farm desk | same as above | ST-ADM; alias decision required |
| ADM-PG-030 | `/admin/issue-management` | Customer/caretaker issue desk | NAV → KaFarm/evidence | incidents/reports/selected evidence | ST-ADM |
| ADM-PG-031 | `/admin/evidence` | Evidence desk | NAV/queues → linked records | customer/caretaker/Admin evidence | ST-ADM |
| ADM-PG-032 | `/admin/audit-logs` | Alias rendering Evidence | DEEP → evidence | same as above | ST-ADM; alias decision required |
| ADM-PG-033 | `/admin/reports` | Alias rendering Evidence | DEEP → evidence | same as above | ST-ADM; alias decision required |
| ADM-PG-034 | `/admin/risk-management` | Alias rendering Evidence | DEEP → evidence | same as above | ST-ADM; alias decision required |
| ADM-PG-035 | `/admin/live-chat` | Escalated customer/caretaker/Admin chat | NAV → issue/evidence | escalated sessions/messages | ST-ADM |
| ADM-PG-036 | `/admin/transactions` | Redirect to payment review | ALIAS → payment | None | ST-ALIAS |
| ADM-PG-037 | `/admin/transactions/cashin` | Redirect to payment review | ALIAS → payment | None | ST-ALIAS |
| ADM-PG-038 | `/admin/transactions/cashout` | Redirect to withdrawal review | ALIAS → withdrawal | None | ST-ALIAS |
| ADM-PG-039 | `/admin/treasury` | Redirect to payment review | ALIAS → payment | None | ST-ALIAS; IA decision required |
| ADM-PG-040 | `/admin/wallet` | Redirect to payment review | ALIAS → payment | None | ST-ALIAS; IA decision required |

## Complete KaFarm route inventory

| Page ID | Route | Surface/purpose | Entry → exit | Required data | State |
|---|---|---|---|---|---|
| KAF-PG-001 | `/admin/kafarm` | Legacy KaFarm report/command center | Admin NAV → reader/troubleshooting/Guardian/Admin | incidents, DB/care-plan health, generated snapshot | ST-KAF |
| KAF-PG-002 | `/admin/kafarm/whole-app-reader` | Run read-only whole-app report with technical/simple outputs | KaFarm → copy/report/Admin | static snapshot + active Admin runtime readers | ST-KAF |
| KAF-PG-003 | `/admin/kafarm/troubleshooting` | Incident diagnosis and guarded recovery preparation | KaFarm/incident → canonical affected route | incident queue, auth, safe recovery rules | ST-KAF |
| KAF-PG-004 | `/admin/kafarm/guardian` | Evidence-grounded diagnosis and deterministic gate | KaFarm → reader/report/Admin | owner blueprint, map, safe evidence tools, optional LLM | ST-KAF; exact IA pending DEC-007 |
| KAF-PG-005 | `/admin/kafarm/approvals` | Legacy focus surface | KaFarm → report | legacy incident/report data | ST-KAF; consolidation decision |
| KAF-PG-006 | `/admin/kafarm/ask` | Legacy focus surface | KaFarm → report | legacy incident/report data | ST-KAF; consolidation decision |
| KAF-PG-007 | `/admin/kafarm/auto-fixed-logs` | Legacy focus surface; name conflicts with no-auto-fix safety | KaFarm → report | legacy data | ST-KAF; rename/remove decision |
| KAF-PG-008 | `/admin/kafarm/buddy-reports` | Legacy focus surface | KaFarm → report | legacy report data | ST-KAF; consolidation decision |
| KAF-PG-009 | `/admin/kafarm/daily-briefing` | Legacy focus surface | KaFarm → report | legacy report data | ST-KAF; consolidation decision |
| KAF-PG-010 | `/admin/kafarm/database-health` | Legacy focus database-health surface | KaFarm → report | health RPC | ST-KAF; consolidation decision |
| KAF-PG-011 | `/admin/kafarm/escalated-chats` | Legacy focus chat surface | KaFarm → live chat | incidents/chat | ST-KAF; consolidation decision |
| KAF-PG-012 | `/admin/kafarm/evidence-finder` | Legacy focus evidence surface | KaFarm → evidence | incident/evidence refs | ST-KAF; consolidation decision |
| KAF-PG-013 | `/admin/kafarm/qa-test-lab` | Legacy focus QA surface | KaFarm → reports | static/current test artifacts | ST-KAF; consolidation decision |
| KAF-PG-014 | `/admin/kafarm/system-health` | Legacy focus health surface | KaFarm → report | static/runtime health | ST-KAF; consolidation decision |

## Meaningful element inventory — shared shells

| Element ID | Page(s) | Label/purpose | Visibility/enabled | Action → feedback/next state | Failure behavior |
|---|---|---|---|---|---|
| SH-AUTH-001 | Login | Email | Public; required | Enter identity | Inline validation; never echo credentials |
| SH-AUTH-002 | Login | Password | Public; required; masked | Enter secret | Remains masked; generic auth error |
| SH-AUTH-003 | Login | Sign In | Required fields, not loading | Authenticate/role-check → workspace | Disable once; no false success |
| SH-AUTH-004 | Login | Sign Up | Public | Open customer signup | Preserve no secret state |
| SH-CUS-NAV-001..008 | Customer | My Roosters, Farm Buy, Farm Requests, Wallet, Inbox, Support, Inventory, Settings | Active Customer | Navigate without mutation | Active page indicated |
| SH-CARE-NAV-001..004 | Caretaker | Active Tasks, Completed, Chat Admin, Profile | Active Caretaker | Navigate | Wrong role blocked |
| SH-ADM-NAV-001..008 | Admin | Dashboard, Customer Requests, Caretaker Management, Farm Operations, Issue Management, Account Verification, Evidence, KaFarm | Active Admin | Navigate | Wrong role blocked |
| SH-LOGOUT-001 | All protected | Logout safely | Authenticated | End local session → login | Clear stale session; no cross-role residue |

## Meaningful customer elements

| Element ID | Page | Label/purpose | Enabled condition | Action → immediate/next state | Failure behavior |
|---|---|---|---|---|---|
| CUS-DASH-001 | Dashboard | Total Roosters | Data loaded | Show owned count → My Roosters | Never include demo/default records |
| CUS-DASH-002 | Dashboard | 180-day maturity progress | Rooster has acquisition date | Show `elapsed/180 × 100`, capped 0–100 | Missing date shows “Not available,” not fabricated age |
| CUS-DASH-003 | Dashboard | Requests summary | Own requests loaded | Open Farm Requests | Use authoritative statuses |
| CUS-DASH-004 | Dashboard | Wallet summary | Own wallet loaded | Open Wallet | Balance hidden/loading until authoritative read |
| CUS-DASH-005 | Dashboard | Featured/selected rooster | Own rooster exists | Open My Roosters | Empty state CTA to Farm Buy |
| CUS-DASH-006 | Dashboard | Latest Activity | Own events loaded | Open linked evidence | Broken deep link shows safe route |
| CUS-DASH-007 | Dashboard | KaFarm Insight/today guidance | Current daily guidance exists | Explain today's per-rooster action | Must distinguish guidance from completed work |
| CUS-ROOST-001 | My Roosters | Rooster list | Own records only | Select rooster → detail | Empty state, no demo rooster |
| CUS-ROOST-002 | My Roosters | Ownership identity/image/status | Selected own rooster | Read-only official details | Missing field says pending/unavailable |
| CUS-ROOST-003..008 | My Roosters | Breed/value/health/pen/caretaker/Care Plan boxes | Selected own rooster | Read-only summary; Care Plan box shows paid progress or unpaid guidance | Sixth-box layout and data mapping need visual acceptance |
| CUS-ROOST-009 | My Roosters | Request Care | Eligible rooster | Open Farm Requests with rooster context | Missing inventory explained before submission |
| CUS-ROOST-010 | My Roosters | Care Logs | Selected rooster | Open approved logs | No unapproved proof |
| CUS-ROOST-011 | My Roosters | Sell | Unsold own rooster | Open no-price/price-ready sale flow | Locked with explanation if ineligible |
| CUS-BUY-001 | Farm Buy | Category filters | Products loaded | Filter visible product cards | Empty category explains no stock |
| CUS-BUY-002 | Farm Buy | Product card | Available product | Show purpose, price, unit, stock | No static fallback treated as purchasable DB stock |
| CUS-BUY-003/004 | Farm Buy | − / + quantity | Within 0..stock | Update cart summary | Cannot exceed stock/negative |
| CUS-BUY-005 | Farm Buy | Cart | Quantity > 0 | Show immutable line totals | Reconcile latest stock before pay |
| CUS-BUY-006 | Farm Buy | Pay | Valid nonempty cart | Open payment flow; no ownership yet | Disabled/no duplicate submit |
| CUS-REQ-001 | Farm Requests | Rooster selection | Own active rooster | Select context | Cross-owner blocked |
| CUS-REQ-002 | Farm Requests | Service selection | Rooster selected | Show procedure, cost, inventory need | Unsupported service not submitted |
| CUS-REQ-003 | Farm Requests | Request note/proof preference | Valid selection | Record customer instruction | Validate size/required fields |
| CUS-REQ-004 | Farm Requests | Submit/request Care | Inventory sufficient and no conflicting live workflow | Create request → payment/assignment status | Visible exact blocking reason |
| CUS-REQ-005 | Farm Requests | Request 30-day Care Plan | Eligible rooster/no live plan | Create fixed package → ₱5,000 payment | No separate top-nav plan flow |
| CUS-REQ-006 | Farm Requests | Request logs/status | Own requests | View current/next step | Final records not actionable |
| CUS-PAY-001 | Payment | Channel/QR | Source summary valid | Select/view official payment destination | Destination mismatch blocks submission |
| CUS-PAY-002 | Payment | Receipt upload | Accepted type/size | Preview file locally | Private upload; visible error |
| CUS-PAY-003 | Payment | Reference/sender fields | Required | Prepare request | Duplicate reference check |
| CUS-PAY-004 | Payment | Submit Proof | Valid proof/details, not loading | One guarded request → for review | Stable idempotency; unknown outcome re-read |
| CUS-INV-001 | Inventory | Category/filter and quantity list | Own items loaded | Inspect exact decimal balance | Empty CTA to Farm Buy |
| CUS-LOG-001 | Care Logs | Rooster/status filters | Approved logs loaded | Filter approved evidence | Never expose other customer/unapproved proof |
| CUS-SALE-001 | Sell | Request Price | Own eligible rooster/no approved price | Create inspection flow | Explain waiting state |
| CUS-SALE-002 | Sell | Reviewed price | `price_ready` | Display Admin-reviewed value | No profit guarantee |
| CUS-SALE-003 | Sell | Confirm Sell | Positive approved price/current request | Create sale request | Duplicate/stale state blocked |
| CUS-WAL-001 | Wallet | Available/on-hold balance | Own wallet loaded | Read only | No UI-derived balance |
| CUS-WAL-002 | Wallet | Transaction history | Own ledger loaded | Inspect reference/evidence | Empty state, no fake entries |
| CUS-WAL-003 | Wallet | Withdraw | Eligible route navigation | Open withdrawal | Eligibility rechecked at submit |
| CUS-WD-001 | Withdrawal | Payout method | Active own method | Select/add method | Adding allowed without KYC |
| CUS-WD-002 | Withdrawal | Amount and Wallet PIN | Submit eligibility | Validate and request one hold | PIN masked/limited; no request on failure |
| CUS-WD-003 | Withdrawal | Request Withdrawal | KYC+PIN+method+balance valid | Guarded request → Admin review | Idempotent hold |
| CUS-WD-004 | Withdrawal | View payout proof | Admin proof available | Secure short-lived viewer | No public receipt URL |
| CUS-WD-005/006 | Withdrawal | I Received / Report Problem | Awaiting confirmation | Complete or needs-info | No silent auto-completion |
| CUS-INBOX-001 | Inbox | Category filter | Own items | Filter | Counts derive from unread state |
| CUS-INBOX-002/003 | Inbox | Mark read / Mark all read | Unread own items | Persist read state | Failure leaves item unread visibly |
| CUS-INBOX-004 | Inbox | Open linked invoice/evidence | Valid owned link | Deep-link and mark read | Invalid link stays safe |
| CUS-SUP-001/002 | Support | Message / Send | Authenticated, nonempty, not sending | Persist message | No optimistic sent state on failure |
| CUS-SUP-003 | Support | Open Admin escalation | Sensitive/explicit request | Create/join escalated support | Explain Admin handoff |
| CUS-SET-001 | Settings | Profile photo/contact | Valid own fields/file | Save own permitted data | Private/safe file validation |
| CUS-SET-002..004 | Settings/KYC | ID front/back/selfie uploads | KYC eligible, valid private file | Stage private evidence | Never public URL/raw log |
| CUS-SET-005 | Settings/KYC | Submit KYC | Consent+required fields/files | Review queue | No auto approval |
| CUS-SET-006 | Settings | Change Wallet PIN | Current/new PIN valid | Guarded PIN change | Mask, rate-limit, generic error |

## Meaningful caretaker elements

| Element ID | Page | Label/purpose | Enabled condition | Action → next state | Failure behavior |
|---|---|---|---|---|---|
| CT-TASK-001 | Tasks | Assigned task queue | Own active/backjob tasks | Select task | Empty “Waiting for assignment” |
| CT-TASK-002 | Tasks | Rooster identity/QR | Task selected | Verify QR/allowed documented exception | Wrong identity blocks proof |
| CT-TASK-003 | Tasks | Today procedure and safety | Task selected | Read-only guidance | Never checkbox-as-proof |
| CT-TASK-004 | Tasks | Work documentation | Task selected | Enter actual work/observation | Required before routine pass |
| CT-TASK-005 | Tasks | Feed Used | Reserved item exists | Enter exact decimal used | Cannot exceed authorized available amount |
| CT-TASK-006 | Tasks | Remaining Feed | Feed context exists | Report observed remaining; server also computes authoritative after approval | Discrepancy flagged, not silently overwritten |
| CT-TASK-007 | Tasks | Health result | Task selected | Pass/watch/isolate+escalate | Non-pass cannot routine-complete |
| CT-TASK-008 | Tasks | Add Evidence | Accepted types/count/size | Private upload/preview | Failed file remains unsubmitted |
| CT-TASK-009 | Tasks | Submit Work | Required evidence/fields and assigned state | Pending Admin review | One attempt/idempotent identity |
| CT-TASK-010 | Tasks | Ask Admin | Task selected | Open linked chat/escalation | Preserve task context without secrets |
| CT-COMP-001 | Completed | Completed task history | Own approved/completed tasks | Read evidence/status | No other caretaker data |
| CT-CHAT-001/002 | Chat | Message/Send | Active caretaker | Persist Admin chat | No false sent |

## Meaningful Admin elements

| Element ID | Page | Label/purpose | Enabled condition | Action → next state | Failure behavior |
|---|---|---|---|---|---|
| ADM-QUEUE-001 | Customer Requests | Queue tabs/counts | Active Admin/data loaded | Select payment/care/task/sell/withdraw | Counts exclude final records |
| ADM-QUEUE-002 | Queue | Record list | Actionable records | Select detail | Stale item refreshed before decision |
| ADM-QUEUE-003 | Queue | Receipt/invoice/proof secure viewer | Linked private evidence | Open signed viewer | Missing object is incident, not automatic reject |
| ADM-QUEUE-004 | Queue | Admin note | Decision requiring rationale | Enter safe note | Required for rejection/needs-info/backjob |
| ADM-QUEUE-005..007 | Queue | Approve / Needs Info / Reject | Correct current state, required proof | Canonical guarded RPC; refresh/move queue | Disable once; stale/already-reviewed handled explicitly |
| ADM-TASK-001 | Task Management | Paid request/plan queue | `paid_pending_assignment`/`paid_pending_setup`/ready | Select item | No final/duplicate item |
| ADM-TASK-002 | Task Management | Active caretaker selector | Eligible item | Choose caretaker | Inactive caretaker unavailable |
| ADM-TASK-003 | Task Management | Assign Task | Valid item+caretaker | Create/link one task/Day 1 | Retry canonical; no duplicate |
| ADM-PROOF-001 | Task Management/Caretaker Management | Submitted proof queue | Pending proof | Select evidence | Preserve prior attempts |
| ADM-PROOF-002/003 | Proof | Approve / Backjob or Reject | Valid pending proof; safe health status for approve | Guarded review; update task/source/customer | No routine approval of health escalation |
| ADM-VER-001 | Account Verification | Customer/Caretaker tabs | Active Admin | Filter queues/history | Final items separated |
| ADM-VER-002 | Account Verification | Secure evidence viewer | Authorized selected record | Open short-lived file | Never public raw evidence |
| ADM-VER-003/004 | Account Verification | Approve/Reject/Needs Info | Valid pending record | Guarded decision | Already reviewed explicit result |
| ADM-CARE-001 | Caretaker Management | Permanent signup link/copy | Active Admin | Copy public application link | No credential included |
| ADM-CARE-002 | Caretaker Management | Directory/task/history | Active Admin | Select caretaker | Minimum necessary personal data |
| ADM-CHAT-001..003 | Live Chat | Join/Send/End/Complete | Active Admin/session state | Persist audited chat action | Re-read session on timeout |
| ADM-EVID-001 | Evidence | Person/workflow filters | Active Admin | Find linked events/proofs | No generic unrestricted data dump |

## Meaningful KaFarm elements

| Element ID | Page | Label/purpose | Enabled condition | Action → next state | Failure behavior |
|---|---|---|---|---|---|
| KAF-READ-001 | Whole-App Reader | Run | Active Admin | Read snapshot/runtime evidence → two reports | No mutation; evidence gaps explicit |
| KAF-READ-002/003 | Whole-App Reader | Technical / Simple Explanation columns | Report exists | Read/copy respective output | Simple mode may not omit severity/evidence status |
| KAF-READ-004/005 | Whole-App Reader | Copy Technical / Copy Simple | Report exists | Clipboard only | Visible copy failure |
| KAF-TRI-001 | Troubleshooting | Incident selector | Active Admin/queue loaded | Select incident | No issue fabrication |
| KAF-TRI-002 | Troubleshooting | Prepare Safe Recovery | Confirmed current evidence and allowlisted path | Produce recovery plan, not business mutation | BLOCK protected/unproven path |
| KAF-GUA-001 | Guardian | Investigation prompt | Active Admin | Describe expected/actual route/workflow without secrets | Warn/redact sensitive content |
| KAF-GUA-002 | Guardian | Run Guardian Diagnosis | Active Admin/not running | Evidence tools → reasoning → deterministic gate | Fallback reports no LLM if key absent |
| KAF-GUA-003 | Guardian | Technical/owner explanation, trace, evidence, gate | Diagnosis exists | Read only | Cannot claim repair executed |

# HOLD — OWNER MUST DECIDE LEGACY/ALIAS ROUTE REMOVAL AND UNRESOLVED UI CONTRACTS
