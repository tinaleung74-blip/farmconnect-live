# FarmConnect Live Testing Findings

Date started: 2026-08-31  
Test mode: Continue testing after errors; record findings for later repair.

## Test Accounts

- Customer: `o@gmail.com`
- Caretaker: `l@gmail.com`

## Status Guide

- `[ ]` Not tested
- `[x]` Passed
- `[!]` Error or unexpected behavior found; continue to next test
- `[-]` Blocked by an earlier requirement

## Round 1 — Signup and Login

### Customer

- [ ] C-01 Open customer homepage
- [ ] C-02 Open customer signup
- [ ] C-03 Complete customer signup and KYC submission
- [ ] C-04 Confirm signup success message/status
- [ ] C-05 Log out
- [ ] C-06 Log in using `o@gmail.com`
- [ ] C-07 Confirm correct customer destination after login
- [ ] C-08 Confirm KYC status is visible and accurate
- [ ] C-09 Refresh page and confirm session remains correct

### Caretaker

- [ ] T-01 Open caretaker careers/homepage
- [ ] T-02 Find and open caretaker registration
- [ ] T-03 Confirm signup appears before the caretaker application/KYC form
- [ ] T-04 Create caretaker account using `l@gmail.com`
- [ ] T-05 Complete caretaker application and KYC submission
- [ ] T-06 Confirm submission success message/status
- [ ] T-07 Log out
- [ ] T-08 Log in using `l@gmail.com`
- [ ] T-09 Confirm correct caretaker destination after login
- [ ] T-10 Confirm application/KYC status is visible and accurate
- [ ] T-11 Refresh page and confirm session remains correct
- [!] T-12 Reject caretaker application from Admin, then verify caretaker can correct and resubmit

## Findings

Record each issue without stopping the test sequence.

| ID | Role | Page / Action | Expected | Actual | Severity | Evidence / Notes | Fix Status |
|---|---|---|---|---|---|---|---|
| F-001 | Caretaker | Rejected application/KYC | A rejected caretaker should see the rejection reason and a **Resubmit** button, then be able to correct the form/documents and submit again | There is no way to resubmit after Admin rejects the application | Critical | Caretaker becomes permanently stuck in rejected status | Implemented; retest |
| F-002 | Customer | Wallet → Request Withdrawal button on phone | The Request Withdrawal button should fit correctly, remain fully visible, and not overlap other UI | The Request Withdrawal button has a layout/overlay problem on phone | Medium | Verify button width/position, viewport overflow, safe-area spacing, and fixed-element overlap | Implemented; retest |
| F-003 | Admin | Navigate from Dashboard to Account Verification | Account Verification should keep the same Admin navbar, branding, items, order, and responsive behavior | The navbar changes after opening Account Verification | High | Likely an old/duplicate page shell or route-specific navigation component; verify desktop, tablet, and phone | Implemented; retest |
| F-004 | Customer + Admin | Support → Customer selects “Yes” after “Would you like to talk to a live agent?” | A support conversation/ticket should be created once, acknowledged to the customer, and immediately appear in the Admin support queue | The request does not appear on the Admin side | Critical | Audit click handler → API request → authenticated RPC/route → database ticket/message → Admin query/realtime refresh; preserve correlation/delivery status | Implemented; retest |
| F-005 | Customer | Support conversation UI | “What do you need help with?” and its quick choices should appear naturally inside the conversation as chat messages/options | Help choices are presented outside the conversation and the UI feels disconnected | Medium | Render KaFarm question and tappable choices inside the chat timeline; keep Other → typed question → live-agent Yes/No flow | Implemented; retest |
| F-006 | Caretaker + Customer | Support topics and workflow | Both roles may share one chat component, but each must receive role-specific help topics, answers, ticket context, and Admin routing | Caretaker Support is the same as Customer Support, including topics that do not match caretaker work | High | Customer topics: rooster purchase/care/payment/sale/withdrawal. Caretaker topics: assigned tasks, daily reports, photo proof, rejected/resubmitted work, schedule, payout, account/KYC. Attach role and relevant record ID to every escalated ticket | Implemented; retest |
| F-007 | Admin + Customer | Admin approves rooster/order → Customer “Your Roosters” | A successful approval should atomically activate/create the owned-rooster record, confirm delivery, and make it appear on Your Roosters without requiring a new login | The approved rooster does not become live/visible on the Customer Your Roosters page | Critical | Trace approval click → API/RPC result → order/payment state → customer_animals ownership record → customer query/RLS → cache/realtime refresh. Reconcile by operation ID; do not create a duplicate rooster on retry | Implemented; retest |
| F-008 | Customer | Settings | Settings should be a short, useful account page containing editable Account Details, Change Password, and a KYC status/resubmission section that appears when verification is rejected | Current Customer Settings needs simplification and does not provide a clear rejected-KYC correction/resubmission path | High | Remove redundant/technical sections. Show rejection reason, editable allowed fields/documents, and Resubmit only when rejected; pending stays locked, approved shows status only. Use secure reauthentication/current-password rules for password changes | Implemented; retest |
| F-009 | Admin | Roosters and Task Reports information architecture | Keep Roosters focused on rooster order, ownership, assignment, and sale; use a separate Task Reports page for caretaker care submissions grouped by customer and rooster | Rooster operations and caretaker report reviews are too broad when combined, making queues and resubmissions hard to follow | High | Task Reports queues: New Submission → Approved / Rejected; rejected report returns to caretaker with reason; corrected report appears in Resubmissions while preserving original report/version history; only approved report is sent to that rooster's customer Diary | Implemented; retest |
| F-010 | Caretaker | Signup/application form | Initial application should request only the minimum information needed to create the account, identify/contact the applicant, review the résumé, and complete KYC | The caretaker signup asks for difficult or repetitive details already covered by the résumé, including emergency-contact details too early in the journey | Medium | Keep: full name, email, mobile number, password, résumé, valid ID, selfie, required consent. Remove duplicated work-history/profile questions. Collect emergency contact only after approval in Caretaker Account Details, before active task assignment | Implemented; retest |
| F-011 | Caretaker | Care History / My Diary | Show a simple My Diary page grouped by assigned rooster; caretaker selects a rooster and sees that rooster's chronological tasks, submissions, photos, findings, and review status | Current care history does not present the work as an easy rooster-by-rooster diary | Medium | First view: rooster cards/name and latest activity. After selection: newest-first timeline with date/time, care period, work done, photo, findings, and Pending/Approved/Rejected/Resubmitted status. Rejected entry shows reason and Resubmit; preserve report versions. Customer sees only Admin-approved diary content | Implemented; retest |

## Page Check Progress

- [x] Customer Dashboard — working properly
- [!] Customer Wallet — Request Withdrawal button mobile layout/overlay issue recorded as F-002
- [!] Customer Settings — simplify to Account Details, Change Password, and conditional rejected-KYC Resubmission — F-008

## Round 2 — Admin Pages and Actions

### Dashboard and KaFarm

- [ ] A-01 Open Admin Dashboard
- [ ] A-02 Confirm system-health cards and counts load correctly
- [ ] A-03 Open reported issue/finding from Dashboard
- [ ] A-04 Open KaFarm Recovery panel
- [ ] A-05 Confirm incidents, status, and recovery actions are understandable to a non-coder

### Account Verification

- [!] A-06 Open Account Verification — navbar changes unexpectedly; recorded as F-003
- [ ] A-07 Open a customer KYC submission
- [ ] A-08 Approve or reject customer KYC and verify status updates
- [ ] A-09 Open a caretaker application/KYC submission
- [ ] A-10 Approve caretaker application and verify status updates
- [ ] A-11 Reject caretaker application and verify rejection reason is saved

### Roosters, Tasks, and Payments

- [ ] A-12 Open Roosters workflow
- [!] A-13 Approved rooster does not become live on Customer Your Roosters — F-007
- [ ] A-14 Assign approved rooster/care work to a caretaker
- [ ] A-15 Review caretaker daily-care submission, photos, time, and findings
- [ ] A-16 Approve the care report and confirm it reaches the customer Diary
- [ ] A-17 Reject the care report and confirm it returns for resubmission
- [ ] A-18 Review sale-price request and sale flow
- [ ] A-19 Review withdrawal request and complete it with receipt/reference

### Support

- [!] A-20 Customer live-agent request does not enter Admin support queue — F-004
- [!] A-21 Caretaker support duplicates Customer support instead of using caretaker-specific help — F-006
- [ ] A-22 Confirm replies arrive in the correct user's Inbox

## Testing Rule

When an error appears:

1. Record its test ID and exact message.
2. Take a screenshot if visual.
3. Mark the item `[!]`.
4. Continue to the next safe test.
5. Fix findings together after the testing round.
