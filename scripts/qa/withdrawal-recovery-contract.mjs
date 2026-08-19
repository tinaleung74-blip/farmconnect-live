import fs from "node:fs";

const ui = fs.readFileSync("lib/farmconnect-v1.tsx", "utf8");
const data = fs.readFileSync("lib/farmconnect-data.ts", "utf8");
const sql = fs.readFileSync("database/applied/072_withdrawal_recovery_and_ledger_integrity.sql", "utf8");

const checks = [
  ["Admin exposes Needs Info", ui.includes('setDecision("needs_info")')],
  ["Customer can resubmit an existing request", ui.includes("Use Selected Method and Resubmit") && data.includes('rpc("customer_resubmit_withdrawal_request"')],
  ["Correction keeps the existing request and active hold", sql.includes("v_request.status <> 'needs_info'") && sql.includes("WITHDRAWAL_HOLD_NOT_ACTIVE")],
  ["Admin approval rechecks live KYC", sql.includes("p_decision='approved' and v_kyc not in")],
  ["Completed holds close in the wallet ledger", sql.includes("sync_withdrawal_wallet_ledger_status") && sql.includes("status='COMPLETED'")],
  ["Rejected holds are closed as reversed in the wallet ledger", sql.includes("description='Reversed withdrawal hold '")],
];

for (const [name, ok] of checks) {
  if (!ok) throw new Error(`FAIL: ${name}`);
  console.log(`PASS: ${name}`);
}
