# FarmConnect Database Workbench

This folder is the local source of truth for database cleanup.

Run order for database work:

1. `00_app_db_health_check.sql`
   - Read-only checker.
   - Use this before writing new SQL.
   - Paste the result back to Buddy/Codex so missing objects can be fixed exactly.

Rules:

- Do not run destructive SQL without a backup.
- Keep every production SQL change in this folder.
- Use health checks after each SQL run.
- Sensitive actions such as wallet, KYC, withdrawals, profile security, and evidence logs must go through functions/RLS, not direct public table updates.
