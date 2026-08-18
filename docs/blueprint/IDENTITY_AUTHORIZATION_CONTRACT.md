# FarmConnect Identity, Authorization, and Security Contract

Version: `0.1.0-draft`
Status: **HOLD**

## 1. Identity equation

Every protected request must prove:

```text
verified Supabase session user ID
= profiles.auth_user_id
+ active authorized role
+ allowed relationship to the target record
+ legal current workflow state
```

Any mismatch is `BLOCK`. Client routing, hidden buttons, email text, query parameters, and model output do not grant authority.

## 2. Role and route matrix

| Capability | Customer | Caretaker | Admin | KaFarm/system |
|---|---:|---:|---:|---:|
| Public preview/signup/login | Yes | Application/login | Login | No special authority |
| Read own profile/records | Yes | Yes | Authorized operational read | Minimized read for active Admin diagnosis |
| Read another customer's private record | No | Only minimum linked assigned task context | Yes when operationally required | Only minimized through controlled tool |
| Submit payment/care/sale/withdrawal | Own only | No | No | No |
| Submit task proof | No | Own assigned task only | No | No |
| Approve payment/KYC/proof/withdrawal/sale | No | No | Guarded path only | Never |
| Assign caretaker | No | No | Active eligible caretaker only | Never |
| Move wallet/ownership/inventory | No direct path | No direct path | No direct table edit; guarded workflow only | Never |
| View raw private KYC/resume/payout proof | Own permitted KYC/status | Own applicant files | Time-limited authorized viewer | Model never receives raw document |
| Arbitrary SQL/schema/RLS | No | No | No app surface | Never |

## 3. Authentication contract

- Supabase Auth is the authentication authority.
- Session is verified server-side for server routes/RPCs; token presence alone is insufficient.
- Role comes from the linked active profile, not a login-page hint.
- Caretaker additionally requires a valid approved caretaker relationship.
- Admin APIs re-authenticate and re-authorize each request. Guardian currently requires role `admin` and `account_status = active`.
- Expired/invalid refresh sessions are cleared and the user signs in again; the app must not loop or silently reuse stale identity.
- Multiple tabs on one origin share the current Supabase browser session. Final isolation/warning design is DEC-008.

### Auth UID-only resolution

`lib/customer-auth.ts` now queries `profiles.auth_user_id = auth user id` only. Email is retained only as display/contact data. The remaining gate is a live wrong-user/missing-profile regression check, not another fallback path.

## 4. Ownership/relationship rules

| Record | Customer relationship | Caretaker relationship | Admin exception |
|---|---|---|---|
| Profile/KYC | `profile.auth_user_id = auth.uid()` | Own applicant/profile only | Active Admin for review with audit |
| Customer animal/inventory | `record.profile_id = own profile.id` | Only through assigned task and minimum fields | Operational review through guarded reader/action |
| Payment/withdrawal/payout | own `profile_id` | None | Review through canonical RPC; private proof access logged |
| Care request/plan | own `profile_id` and own rooster | Assigned caretaker ID/task only | Assignment/review/control through canonical RPC |
| Task/proof | customer linked read after approval | `task.caretaker_id = own caretaker.id` | Review/assignment with audit |
| Sale | own profile and animal until legal completion | Assigned price/release task only | Review through canonical RPC |
| Inbox/support | own participant/profile | own participant | Admin joins escalated/authorized session |
| KaFarm incident | own minimized incident where policy permits | own minimized incident where policy permits | Active Admin all authorized operational incidents |

## 5. Server authorization and canonical paths

- All financial, identity, role, proof, and ownership decisions are rechecked inside guarded RPCs.
- `security definer` is allowed only with explicit caller checks, fixed `search_path`, least-privilege grants, and transactional invariants.
- Service-role key is server-only and may be used for minimized controlled readers or scheduled system work. It is never returned to browser/model.
- The historical KaFarm SQL gateway app route is removed. No replacement arbitrary SQL interface is allowed.
- Guardian function tools are read-only and narrowly typed. Model output passes a deterministic gate and cannot invoke a protected mutation.

## 6. Input, output, and web security

| Area | Contract | Current gap |
|---|---|---|
| Validation | Validate types, lengths, enums, quantities, ownership, current state, and file metadata on client and server | Central schema library not identified |
| SQL injection | Parameterized Supabase queries/RPC args only; no concatenated arbitrary SQL | Historical service-only gateway RPC must remain unreachable |
| XSS | React escaped rendering; sanitize any future rich text; never render incident/model HTML unsafely | Automated XSS suite not identified |
| CSRF | Supabase bearer-token APIs plus same-site/browser protections; any cookie-auth server action requires CSRF design | Exact cookie strategy not applicable/confirmed |
| CORS | Allow only required FarmConnect origins for custom APIs; do not wildcard privileged routes | Deployment values not documented |
| Rate limiting | Login/signup/upload/support/payment/withdrawal/Guardian thresholds required | UNKNOWN DEC-010 |
| Error exposure | User-safe code/message; server logs safe technical detail; no SQL/schema/key/PII dump | Legacy raw error rendering must be audited |
| Secrets | Environment only, server-only; rotate if exposed | Public anon key is not a service secret; service/model/cron keys are secrets |
| Model safety | PII minimization, tool allowlist, prompt injection treated as untrusted evidence | Live model proof pending |

## 7. Upload authorization

- Validate MIME and size server/storage-side, not only browser accept attributes.
- Generate non-guessable paths scoped to the authenticated owner/workflow.
- Private buckets only for KYC, resumes, task proof, payment proof, and payout proof.
- Signed URLs are short-lived and issued only after relationship/role recheck.
- Malware/content scanning policy is **UNKNOWN** and required before real high-volume production.
- Deletion is not user-initiated unless a retention/legal policy and audit path are approved.

## 8. Financial and protected-zone rules

Protected zones: wallet balance/holds, payment approval, withdrawal/payout, KYC decision, rooster ownership, role/account activation, PIN/password security, fraud marking, destructive data, RLS/schema, and arbitrary SQL.

For these zones:

- UI may request; only canonical backend decides.
- Admin action requires current record re-read and legal transition.
- Retry is idempotent.
- Before/after state and audit evidence are mandatory.
- KaFarm cannot execute or recommend a bypass. Any future adapter needs explicit Admin approval plus independent verification, rollback, and audit storage.

## 9. Logging and privacy

Log: timestamp, actor UID/profile/role, workflow ID, action, target record ID, previous/new state, result, safe error code, source release/operation key.

Never log: passwords, PINs, Auth/refresh tokens, service/model/cron keys, full payout account, full ID number, raw KYC images, unnecessary message/file content.

Retention and privacy rights for every evidence category remain DEC-012.

## 10. Authorization verification gate

- [ ] All protected pages have active role guards.
- [ ] All protected RPCs prove Auth UID, role/status, relationship, and legal state.
- [ ] Email fallback removed from authorization paths.
- [ ] Cross-user negative RLS tests pass for every table/storage bucket.
- [ ] Repeated decision/idempotency tests pass.
- [ ] Upload type/size/privacy/signed URL tests pass.
- [ ] Rate-limit and abuse policy approved/tested.
- [ ] No raw secret/PII in logs/model/browser.
- [ ] Guardian cannot mutate protected zones.

# HOLD — IDENTITY FALLBACK, RATE LIMITS, RETENTION, AND LIVE RLS PROOF REMAIN
