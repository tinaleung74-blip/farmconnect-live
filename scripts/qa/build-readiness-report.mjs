import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const resultDir = path.join(root, "test-results");
const dbPath = path.join(resultDir, "kafarm", "database-contract.json");
const buildPath = path.join(resultDir, "kafarm", "production-build.json");
const businessPath = path.join(resultDir, "kafarm", "business-flow-contract.json");
const lintPath = path.join(resultDir, "kafarm", "critical-lint.json");
const browserPath = path.join(resultDir, "playwright", "results.json");
const outputPath = path.join(resultDir, "kafarm", "production-readiness.md");

function readJson(file) {
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function collectSpecs(suites = [], output = []) {
  for (const suite of suites) {
    for (const spec of suite.specs || []) output.push(spec);
    collectSpecs(suite.suites || [], output);
  }
  return output;
}

const database = readJson(dbPath);
const build = readJson(buildPath);
const business = readJson(businessPath);
const lint = readJson(lintPath);
const browser = readJson(browserPath);
const specs = collectSpecs(browser?.suites || []);
const tests = specs.flatMap(spec => spec.tests || []);
const failedTests = tests.filter(item => item.status !== "expected");
const skippedTests = tests.filter(item => item.status === "skipped");
const browserPassed = Boolean(browser) && failedTests.length === 0 && skippedTests.length === 0;
const databasePassed = database?.passed === true;
const buildPassed = build?.passed === true;
const businessPassed = business?.passed === true;
const lintPassed = lint?.passed === true;
const passed = buildPassed && browserPassed && databasePassed && businessPassed && lintPassed;

const lines = [
  "# FarmConnect Production Readiness Report",
  "",
  `Generated: ${new Date().toISOString()}`,
  `Overall: ${passed ? "PASS" : "NOT READY"}`,
  "",
  "## Gates",
  "",
  `- Production build: ${buildPassed ? "PASS" : "FAIL"}`,
  `- Runtime-critical lint: ${lintPassed ? "PASS" : "FAIL"}`,
  `- Live database/RLS contract: ${databasePassed ? "PASS" : "FAIL"}`,
  `- Critical business workflow contract: ${businessPassed ? "PASS" : "FAIL"}`,
  `- Browser E2E on desktop, phone, and tablet: ${browserPassed ? "PASS" : "FAIL"}`,
  `- Browser test cases: ${tests.length}`,
  `- Failed browser cases: ${failedTests.length}`,
  `- Skipped browser cases: ${skippedTests.length}`,
  "",
  "## Database",
  "",
  `- Missing required objects: ${database?.missingObjects?.length ?? "unknown"}`,
  `- Open database findings: ${database?.databaseFindings?.length ?? "unknown"}`,
  `- Critical table/RLS checks passed: ${database?.tableChecks?.filter(item => item.ok).length ?? 0}/${database?.tableChecks?.length ?? 0}`,
  `- Sensitive function checks passed: ${database?.functionChecks?.filter(item => item.ok).length ?? 0}/${database?.functionChecks?.length ?? 0}`,
  "",
  "## Maintenance Debt",
  "",
  `- Legacy lint errors outside the runtime-critical gate: ${lint?.legacyDebt?.errors ?? "unknown"}`,
  `- Legacy lint warnings: ${lint?.legacyDebt?.warnings ?? "unknown"}`,
  "",
  "## Browser Failures",
  "",
];

if (!failedTests.length) lines.push("No failed browser test was recorded.");
for (const item of failedTests) {
  lines.push(`- ${item.projectName || "browser"}: ${item.title || "Unnamed test"}`);
}

lines.push(
  "",
  "## Decision Rule",
  "",
  "Do not call the app production-ready unless build, database/RLS, and every role/device E2E gate pass without skipped tests.",
  "",
);

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${lines.join("\n")}\n`);
console.log(`[KaFarm Readiness] ${passed ? "PASS" : "NOT READY"}`);
console.log(`[KaFarm Readiness] Report: ${outputPath}`);
if (!passed) process.exitCode = 1;
