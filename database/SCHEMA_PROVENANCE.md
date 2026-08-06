# FarmConnect Database Source Of Truth

This repository's `database/applied` directory is an applied-change ledger, not a complete baseline dump of the original Supabase schema.

## Authority Order

1. Live FarmConnect Supabase metadata returned by the admin-only `kafarm_database_health_snapshot()` function.
2. Owner-confirmed output from `database/00_app_db_health_check.sql` and `database/00_verify_applied_sql_status.sql`.
3. `database/applied/000_database_applied_ledger.md`.
4. Static SQL and source-code references.

## Required Reporting Rule

- Absence of `CREATE TABLE` in this repository does not mean the live table is missing.
- Static absence is a documentation/provenance gap only.
- A table, column, function, view, policy, or RLS configuration may be reported as missing only when live database metadata explicitly returns it as missing.
- Never propose or run a replacement `CREATE TABLE` for an existing core object based only on repository scanning.
- Sensitive objects such as `profiles`, wallets, KYC, payments, withdrawals, ownership, and evidence logs require live metadata plus admin review before SQL changes.

## Core Upstream Objects

The original FarmConnect Supabase project already contained core objects before the numbered applied-change ledger was created. These include `profiles`, `farm_products`, `farm_cart_items`, `wallet_transactions`, `inbox_items`, `inventory_usage_logs`, `animals`, `support_chat_sessions`, and `support_chat_messages`.

Their current existence and shape must be checked through the live reader or the read-only health SQL. The numbered migrations extend or harden them and are not proof of their original creation history.

## Classification

- Live metadata says missing: confirmed database blocker.
- Live metadata says present: healthy object, even if no base `CREATE` file exists locally.
- Live metadata was not run: unknown / needs live verification, not missing.
- Only static migration history is incomplete: documentation gap, not a production blocker.
