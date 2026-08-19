import fs from "node:fs";

const ui = fs.readFileSync("lib/farmconnect-v1.tsx", "utf8");
const data = fs.readFileSync("lib/farmconnect-data.ts", "utf8");
const sql = fs.readFileSync("database/applied/072_withdrawal_recovery_and_ledger_integrity.sql", "utf8");
const disputeSql = fs.readFileSync("database/applied/073_manual_withdrawal_dispute_investigation.sql", "utf8");
const reconciliationSql = fs.readFileSync("database/applied/074_withdrawal_legacy_problem_to_investigation.sql", "utf8");

const checks = [
  ["Customer payout problem opens a dispute instead of a retry", ui.includes("reportWithdrawalProblem(row.id") && data.includes('rpc("customer_report_withdrawal_problem"')],
  ["Direct customer resubmit is removed from the UI and revoked", !ui.includes("Use Selected Method and Resubmit") && disputeSql.includes("revoke all on function public.customer_resubmit_withdrawal_request")],
  ["Issue Management loads live withdrawal disputes", ui.includes("getAdminWithdrawalDisputes") && data.includes('from("withdrawal_disputes")')],
  ["Only the two approved manual resolutions are exposed", ui.includes("Farm Fault — Correct Payout") && ui.includes("Customer Detail Fault — Send Explanation")],
  ["Open disputes lock the withdrawal", disputeSql.includes("status='under_investigation'") && disputeSql.includes("No second payout will be sent")],
  ["Corrected payout requires new external evidence", disputeSql.includes("CORRECTED_PAYOUT_EVIDENCE_REQUIRED")],
  ["Customer-detail fault uses preserved original evidence", disputeSql.includes("original_admin_reference") && disputeSql.includes("original_admin_receipt_url")],
  ["Legacy payout problems become investigation cases", reconciliationSql.includes("customer_reported_payout_problem") && reconciliationSql.includes("status='under_investigation'")],
  ["Old cached negative confirmation is guarded", reconciliationSql.includes("customer_report_withdrawal_problem(p_withdrawal_request_id,p_customer_note)")],
  ["Customer sees waiting-only legacy state", ui.includes('Waiting for Admin investigation') && !ui.includes("Use Selected Method and Resubmit")],
  ["Admin approval rechecks live KYC", sql.includes("p_decision='approved' and v_kyc not in")],
  ["Completed holds close in the wallet ledger", sql.includes("sync_withdrawal_wallet_ledger_status") && sql.includes("status='COMPLETED'")],
  ["Rejected holds are closed as reversed in the wallet ledger", sql.includes("description='Reversed withdrawal hold '")],
];

for (const [name, ok] of checks) {
  if (!ok) throw new Error(`FAIL: ${name}`);
  console.log(`PASS: ${name}`);
}
