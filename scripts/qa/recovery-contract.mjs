import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const outputDir = path.join(root, "test-results", "kafarm");
const reportPath = path.join(outputDir, "recovery-contract.json");
const migrationPaths = [
  "database/applied/044_workflow_chain_guard.sql",
  "database/applied/045_operational_workflow_guard.sql",
];
const migrationChecks = migrationPaths.map(file => {
  const content = fs.readFileSync(path.join(root, file), "utf8");
  return { file, transactional: /\bbegin\s*;/i.test(content) && /\bcommit\s*;/i.test(content) };
});
const runbookPresent = fs.existsSync(path.join(root, "docs", "production-operations.md"));
const restoreDrillAttested = process.env.PRODUCTION_RESTORE_DRILL_ATTESTED === "true";
const passed = runbookPresent && migrationChecks.every(check => check.transactional) && restoreDrillAttested;
const report = { generatedAt: new Date().toISOString(), passed, runbookPresent, migrationChecks, restoreDrillAttested };
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`[KaFarm Recovery Contract] ${passed ? "PASS" : "FAIL"}`);
console.log(`- ${runbookPresent ? "PASS" : "FAIL"}: production rollback runbook`);
console.log(`- ${migrationChecks.every(check => check.transactional) ? "PASS" : "FAIL"}: transactional workflow migrations`);
console.log(`- ${restoreDrillAttested ? "PASS" : "FAIL"}: external Supabase restore drill attestation`);
if (!passed) process.exitCode = 1;
