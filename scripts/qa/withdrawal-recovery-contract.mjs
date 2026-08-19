import fs from "node:fs";

const ui = fs.readFileSync("lib/farmconnect-v1.tsx", "utf8");
const data = fs.readFileSync("lib/farmconnect-data.ts", "utf8");
const sql = fs.readFileSync("database/applied/072_withdrawal_recovery_and_ledger_integrity.sql", "utf8");
const disputeSql = fs.readFileSync("database/applied/073_manual_withdrawal_dispute_investigation.sql", "utf8");
const reconciliationSql = fs.readFileSync("database/applied/074_withdrawal_legacy_problem_to_investigation.sql", "utf8");
const inboxSchemaFixSql = fs.readFileSync("database/applied/075_withdrawal_dispute_inbox_schema_fix.sql", "utf8");
const reopenCycleSql = fs.readFileSync("database/applied/076_withdrawal_dispute_reopen_cycle.sql", "utf8");

const checks = [
  ["Customer payout problem opens a dispute instead of a retry", ui.includes("reportWithdrawalProblem(row.id") && data.includes('rpc("customer_report_withdrawal_problem"')],
  ["Direct customer resubmit is removed from the UI and revoked", !ui.includes("Use Selected Method and Resubmit") && disputeSql.includes("revoke all on function public.customer_resubmit_withdrawal_request")],
  ["Issue Management loads live withdrawal disputes", ui.includes("getAdminWithdrawalDisputes") && data.includes('from("withdrawal_disputes")')],
  ["Successful resolution opens the completed case without losing its success notice", ui.includes('setMode("completed")') && ui.includes("loadIssues({ preserveMessage: true, selectId: resolvedId })") && ui.includes("setMessage(successMessage)")],
  ["Customer cannot send an empty payout problem", ui.includes("problemNote.trim().length < 5") && ui.includes("One report opens one locked Admin investigation")],
  ["Admin resolution stays disabled until the required manual evidence is complete", ui.includes('resolutionNote.trim().length < 10 || (resolution === "farm_corrected_payout" && (!reference.trim() || !receiptFile))')],
  ["Only the two approved manual resolutions are exposed", ui.includes("Farm Fault — Correct Payout") && ui.includes("Customer Detail Fault — Send Explanation")],
  ["Open disputes lock the withdrawal", disputeSql.includes("status='under_investigation'") && disputeSql.includes("No second payout will be sent")],
  ["Corrected payout requires new external evidence", disputeSql.includes("CORRECTED_PAYOUT_EVIDENCE_REQUIRED")],
  ["Customer-detail fault uses preserved original evidence", disputeSql.includes("original_admin_reference") && disputeSql.includes("original_admin_receipt_url")],
  ["Legacy payout problems become investigation cases", reconciliationSql.includes("customer_reported_payout_problem") && reconciliationSql.includes("status='under_investigation'")],
  ["Old cached negative confirmation is guarded", reconciliationSql.includes("customer_report_withdrawal_problem(p_withdrawal_request_id,p_customer_note)")],
  ["Live payout-problem RPC matches the Inbox schema", inboxSchemaFixSql.includes("create or replace function public.customer_report_withdrawal_problem") && inboxSchemaFixSql.includes("update public.inbox_items") && !/update public\.inbox_items[\s\S]*?updated_at\s*=/.test(inboxSchemaFixSql)],
  ["Inbox schema fix preserves the customer and withdrawal guards", inboxSchemaFixSql.includes("auth_user_id=auth.uid()") && inboxSchemaFixSql.includes("profile_id=v_profile_id") && inboxSchemaFixSql.includes("WITHDRAWAL_NOT_WAITING_FOR_CONFIRMATION")],
  ["Corrected payout rejection reopens the same dispute", reopenCycleSql.includes("on conflict(withdrawal_request_id) do update") && reopenCycleSql.includes("status='under_investigation'") && reopenCycleSql.includes("withdrawal_dispute_reopened")],
  ["Reopened investigation snapshots the latest payout evidence", reopenCycleSql.includes("original_admin_reference=excluded.original_admin_reference") && reopenCycleSql.includes("original_admin_receipt_url=excluded.original_admin_receipt_url")],
  ["Reopen migration repairs stranded status pairs without moving money", reopenCycleSql.includes("stranded_cases_remaining") && !reopenCycleSql.includes("wallet_balance=") && !reopenCycleSql.includes("wallet_on_hold=" )],
  ["Reopened Inbox update matches the live schema", reopenCycleSql.includes("update public.inbox_items") && !/update public\.inbox_items[\s\S]*?updated_at\s*=/.test(reopenCycleSql)],
  ["Customer sees waiting-only legacy state", ui.includes('Waiting for Admin investigation') && !ui.includes("Use Selected Method and Resubmit")],
  ["Admin approval rechecks live KYC", sql.includes("p_decision='approved' and v_kyc not in")],
  ["Completed holds close in the wallet ledger", sql.includes("sync_withdrawal_wallet_ledger_status") && sql.includes("status='COMPLETED'")],
  ["Rejected holds are closed as reversed in the wallet ledger", sql.includes("description='Reversed withdrawal hold '")],
];

for (const [name, ok] of checks) {
  if (!ok) throw new Error(`FAIL: ${name}`);
  console.log(`PASS: ${name}`);
}
