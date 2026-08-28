# Migration 083 deployment runbook

## What it changes

- Removes anonymous execution from every `SECURITY DEFINER` function.
- Removes authenticated direct execution from known trigger/system helpers.
- Makes the 14 flagged views use caller-context RLS.
- Locks the 19 flagged function search paths.
- Makes KaFarm SQL audit insertion service-role-only.
- Preserves the three server-only RLS tables without client policies.

It does not update business rows, money, KYC, ownership, payments, tasks, or inventory.

## Before Run

1. Export current function/view definitions and ACLs from production.
2. Confirm a recoverable database backup exists.
3. Keep the current production deployment unchanged while applying SQL.

## Apply

Run `database/applied/083_supabase_api_surface_security_hardening.sql` once in a new Supabase SQL Editor tab.

Expected verification:

- `anonymous_security_definer_execute_count = 0`
- `authenticated_internal_execute_count = 0`
- `security_definer_view_count = 0`
- `business_records_changed = false`

## Required live smoke tests

Test in this order and stop on the first unexpected permission error:

1. Anonymous: Sign In and Sign Up pages load; privileged RPC calls are denied.
2. Customer: login, Dashboard, KYC read, Farm Buy submission, Inbox, My Roosters, Inventory.
3. Caretaker: login, assigned task read, proof submission.
4. Admin: Account Verification, Payment, Care, Task, Sell, Withdrawal, Issue Management.
5. KaFarm: Guardian monitor heartbeat and Truth Reference.

Do not repeat money-moving or ownership-changing production actions solely for this migration. Use existing read-only records, or an isolated writable project for the full mutation matrix.

## Auth dashboard setting

Enable leaked-password protection separately in Supabase Auth. This cannot be applied by migration 083.

## Rollback principle

Use the pre-run ACL/view-definition export to restore only the specific object that fails. Do not grant `EXECUTE` back to `PUBLIC`. Restore the narrowest required role grant and preserve internal identity checks.

