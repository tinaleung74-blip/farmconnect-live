# Chief software engineer: pre-test gate

Verdict: GO for local unit/mock/contract testing; NO-GO for claiming end-to-end readiness or testing customer workflows against production. This review checks readiness evidence, not every app feature.

## Current evidence

- Previous full run: 62 local tests passed; TypeScript and targeted lint passed. Those are not 62 live workflows.
- This review ran `isolated-target-contract.mjs`: guard unit cases passed. Its printed statement about permanently blocking production writes applies to the tested guard, not proof that every possible app/network route is protected.
- This review ran `local-care-plan-preflight.mjs`: reported FAIL on all nine prerequisite checks. Docker command was not found, local Supabase CLI absent, database URL/anon key/service key/cron secret absent, schema-only baseline absent.
- Missing baseline causes the table/dependency and copied-data checks to fail too; this does not establish that existing live tables are missing or production data was copied.
- These are local-environment observations, not Vercel configuration checks. Docker/CLI are needed for the local Supabase path; a properly isolated hosted test project is another option. The Care Plan cron requirement is not a prerequisite for every isolated Support test.

## Blockers, ranked

1. No usable test target configured. Cannot establish the real browser → API → database → receiving-role path.
2. No complete schema baseline available at the configured local path. The numbered SQL folder is not a complete replayable database build: for example `database/applied/002_kyc_reference.sql` explicitly says REFERENCE ONLY and cannot be applied as a migration. Do not blindly run every numbered file to build a fresh database.
3. Test deployment identity is not locked down. There are substantial uncommitted/untracked changes. This is not itself a defect, but tests and eventual deployment need an identifiable code version matching the database changes. User-supplied SQL 093 results do not establish that the matching API/frontend is running.
4. Cross-role acceptance evidence is incomplete. Need isolated customer/caretaker/admin accounts and controlled test records, with expected outcomes for success, rejection, timeout and retry.
5. KYC consent helper/trigger definitions remain unverified. The read-only investigation query is prepared; KYC cannot receive a completion sign-off yet.

## Correction to earlier reporting

SQL 093's `'business_records_changed',false` is a literal in the verification SELECT (line 62), not a computed comparison. Its privilege fields use real permission queries, but the literal is not independent evidence that zero business rows changed. Source review supports that 093 does not intentionally rewrite existing business rows; an empirical claim requires actual data comparison/audit evidence. Apply the same distinction to prior migration reports.

## Test-entry requirements

1. Choose an isolated hosted project or provision local Supabase. Supply matching project configuration securely, never secrets in chat.
2. Establish a schema-only baseline with required functions, policies, triggers and storage settings; apply only relevant executable migrations. Confirm 093 permissions on that target.
3. Run the intended code/API version against that target and record its identity. Verify credentials/project consistency without printing secrets.
4. Use test accounts for all three roles and test-only records. Start with Support, then independently qualify signup/KYC, payment/assignment, care-report review/resubmission/diary, and sale/withdrawal workflows as implemented.
5. For each case capture browser action, request, response, database result and recipient-visible outcome. Include two tabs, dropped responses, repeated receipt keys, closed support sessions, rejected/resubmitted reports and role access denial. Do not use bot text or a spinner as proof of a database commit.

## Authority and changes

No application fixes, production queries/writes, installs, secrets, push or deployment performed. Added this report and ran local diagnostic scripts only. Safe next work is provisioning/verifying the isolated environment, not another unsupported whole-app all-clear.
