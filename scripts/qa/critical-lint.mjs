import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const reportPath = path.join(root, "test-results", "kafarm", "critical-lint.json");
const eslintBin = path.join(root, "node_modules", "eslint", "bin", "eslint.js");
const criticalRules = new Set([
  "react-hooks/rules-of-hooks",
  "react-hooks/purity",
  "@next/next/no-location-assign-relative-destination",
]);

const run = spawnSync(process.execPath, [eslintBin, ".", "--format", "json"], {
  cwd: root,
  encoding: "utf8",
  maxBuffer: 64 * 1024 * 1024,
});
if (run.error) throw run.error;

const files = JSON.parse(run.stdout || "[]");
const messages = files.flatMap(file => (file.messages || []).map(message => ({
  file: path.relative(root, file.filePath),
  line: message.line,
  severity: message.severity,
  ruleId: message.ruleId,
  message: message.message,
})));
const critical = messages.filter(message => message.severity === 2 && criticalRules.has(message.ruleId));
const report = {
  generatedAt: new Date().toISOString(),
  passed: critical.length === 0,
  critical,
  legacyDebt: {
    errors: messages.filter(message => message.severity === 2).length,
    warnings: messages.filter(message => message.severity === 1).length,
    byRule: Object.entries(messages.reduce((counts, message) => {
      const key = message.ruleId || "unknown";
      counts[key] = (counts[key] || 0) + 1;
      return counts;
    }, {})).sort((a, b) => b[1] - a[1]),
  },
};

fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`[KaFarm Critical Lint] ${report.passed ? "PASS" : "FAIL"}`);
console.log(`[KaFarm Critical Lint] Legacy debt: ${report.legacyDebt.errors} errors, ${report.legacyDebt.warnings} warnings`);
if (!report.passed) process.exitCode = 1;
