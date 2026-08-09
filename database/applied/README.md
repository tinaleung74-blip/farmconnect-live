# Applied SQL Ledger

This folder records the database work already discussed/run for FarmConnect.

Purpose:

- Keep a local memory of what was added to Supabase.
- Avoid rerunning random SQL from chat.
- Make it easy for Buddy/Codex to read the current database expectations before making new SQL.

Important:

- Files here are mostly **records/reference**, not automatic migrations.
- Only run SQL marked `SAFE TO RUN`.
- Anything marked `REFERENCE ONLY` is for backread and comparison.
- The true source of production state is still Supabase; use `../00_app_db_health_check.sql` to verify.

Current confirmed areas:

- KYC database guard/checker system was run and verified.
- Support chat Phase 3A tables/functions were run and verified.
- KaFarm support messages have a DB function: `kafarm_support_send_message`.
- App still has direct DB calls for KYC, wallet PIN, profile contact, farm cart, caretaker task proof, care logs, and inbox.

Latest applied migrations:

- `050_kyc_system_checks_digest_schema_fix.sql` repairs the remaining `pgcrypto.digest()` call inside the KYC system-check helper. Applied and verified on 2026-08-09 through audit `f95e6df7-97e2-4bd4-84d7-605a5bcfd209`.
- `049_customer_kyc_digest_schema_fix.sql` preserves the live KYC function while schema-qualifying its `pgcrypto.digest()` call. Applied and verified on 2026-08-09 through audit `b2db9940-6281-466f-9eaf-715ef68e2feb`.
- `048_task_proof_sale_type_constraint_fix.sql` keeps caretaker sale-price and final-release proofs compatible with the live `task_proofs` validation constraint. Applied and verified on 2026-08-09 through audit `ed558916-4534-4d37-a9d4-d1be4b6889ba`.
- `047_rooster_sale_assignment_qr_fix.sql` repairs sale task assignment by reading the QR payload from `animal_qr_identities`, its actual source of truth.
- `046_payment_correction_and_video_evidence.sql` connects rejected Farm Buy/care payments to an exact customer correction page and allows caretaker task videos in the private proof bucket.

Both version checks and the caretaker video bucket configuration passed against the live FarmConnect database on 2026-08-09.

- `045_operational_workflow_guard.sql` expands retry protection and reconciliation to the remaining sensitive workflows.
- Applied through the temporary service-only executor on 2026-08-09 after a successful production build.

- `044_workflow_chain_guard.sql` adds the first scoped workflow guard for manual-payment-backed Farm Buy and care requests.
- Applied through the local-only gateway and verified by database and isolated business-flow contracts on 2026-08-09.

Recommended next database workflow:

1. Run `../00_app_db_health_check.sql`.
2. Paste output back to Buddy.
3. Generate only the missing fix SQL.
4. Save every accepted SQL here.
