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

Recommended next database workflow:

1. Run `../00_app_db_health_check.sql`.
2. Paste output back to Buddy.
3. Generate only the missing fix SQL.
4. Save every accepted SQL here.
