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
    name: "Withdrawal Inbox action opens the inline payout evidence",
    ok: /if \(item\.action === "withdrawal"\) \{[\s\S]*setExpandedInboxKey/.test(source)
      && /i\.withdrawalDetails\?\.reference \|\| i\.withdrawalDetails\?\.receiptUrl/.test(source),
  },
  {
    name: "Withdrawal Inbox button has a truthful label",
    ok: /i\.action === "withdrawal" && expandedInboxKey === i\.inboxKey \? "Close" : "View"/.test(source),
  },
];

const passed = checks.every((check) => check.ok);
console.log(`[Customer Inbox Routing] ${passed ? "PASS" : "FAIL"}`);
for (const check of checks) console.log(`- ${check.ok ? "PASS" : "FAIL"}: ${check.name}`);
if (!passed) process.exitCode = 1;
