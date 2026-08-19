import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const source = fs.readFileSync(path.join(process.cwd(), "lib", "farmconnect-v1.tsx"), "utf8");
const checks = [
  {
    name: "Withdrawal Inbox records are detected before generic payment receipts",
    ok: /const isWithdrawalRecord = rawCategory === "withdraw" \|\| searchable\.includes\("withdrawal"\)/.test(source)
      && /const tab = isWithdrawalRecord \? "Alerts" : isPaymentRecord \? "Receipts"/.test(source),
  },
  {
    name: "Withdrawal Inbox action opens the withdrawal workflow",
    ok: /const href = isWithdrawalRecord \? "\/customer\/withdraw"/.test(source),
  },
  {
    name: "Withdrawal Inbox button has a truthful label",
    ok: /item\.action === "withdrawal" \? "Open Withdrawal"/.test(source),
  },
];

const passed = checks.every((check) => check.ok);
console.log(`[Customer Inbox Routing] ${passed ? "PASS" : "FAIL"}`);
for (const check of checks) console.log(`- ${check.ok ? "PASS" : "FAIL"}: ${check.name}`);
if (!passed) process.exitCode = 1;
