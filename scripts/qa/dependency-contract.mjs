import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const outputDir = path.join(process.cwd(), "test-results", "kafarm");
const reportPath = path.join(outputDir, "dependency-contract.json");
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error("npm CLI path is unavailable.");

const run = spawnSync(process.execPath, [npmCli, "audit", "--omit=dev", "--json"], {
  cwd: process.cwd(), encoding: "utf8", maxBuffer: 16 * 1024 * 1024,
});
const audit = JSON.parse(run.stdout || "{}");
const counts = audit.metadata?.vulnerabilities || {};
const passed = Number(counts.high || 0) === 0 && Number(counts.critical || 0) === 0;
const report = { generatedAt: new Date().toISOString(), passed, vulnerabilities: counts };
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`[KaFarm Dependency Contract] ${passed ? "PASS" : "FAIL"}`);
console.log(`[KaFarm Dependency Contract] high=${counts.high || 0} critical=${counts.critical || 0}`);
if (!passed || run.error) process.exitCode = 1;
