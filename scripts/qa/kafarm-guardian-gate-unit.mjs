import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const outputPath = path.join(root, "test-results", "kafarm", "guardian-gate-unit.json");
const { evaluateKaFarmAction } = await import(pathToFileURL(path.join(root, "lib", "kafarm", "guardian", "logic-gate.ts")).href);

const base = {
  id: "unit",
  title: "Read-only source reference lookup",
  description: "Read an existing safe source reference.",
  requestedLevel: "green",
  mutation: false,
  reversible: true,
  idempotent: true,
  testAvailable: true,
  blastRadius: "low",
  rootCauseConfidence: "CONFIRMED",
  protectedZones: [],
  destructive: false,
  explicitApproval: false,
  blueprintPass: true,
  invariantPass: true,
};

const cases = [
  { name: "confirmed read-only green action passes", result: evaluateKaFarmAction(base, true), expected: "PASS" },
  { name: "mutation is blocked by kill switch", result: evaluateKaFarmAction({ ...base, mutation: true, requestedLevel: "yellow" }, true), expected: "BLOCK" },
  { name: "protected action requires approval when unfrozen", result: evaluateKaFarmAction({ ...base, mutation: true, requestedLevel: "red", protectedZones: ["wallet_balance"] }, false), expected: "APPROVAL_REQUIRED" },
  { name: "unconfirmed root cause is held", result: evaluateKaFarmAction({ ...base, rootCauseConfidence: "LIKELY" }, false), expected: "HOLD" },
  { name: "destructive action is blocked", result: evaluateKaFarmAction({ ...base, mutation: true, destructive: true }, false), expected: "BLOCK" },
].map((item) => ({ ...item, passed: item.result.decision === item.expected }));

const report = { generatedAt: new Date().toISOString(), passed: cases.every((item) => item.passed), cases };
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
for (const item of cases) console.log(`- ${item.passed ? "PASS" : "FAIL"}: ${item.name} => ${item.result.decision}`);
console.log(`[KaFarm Guardian Gate Unit] ${report.passed ? "PASS" : "FAIL"}`);
if (!report.passed) process.exitCode = 1;
