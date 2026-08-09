import path from "node:path";
import process from "node:process";
import fs from "node:fs";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const playwrightCli = path.join(root, "node_modules", "@playwright", "test", "cli.js");
const projects = ["desktop-chromium", "phone-chromium", "tablet-chromium"];
const reportDir = path.join(root, "test-results", "playwright");
fs.mkdirSync(reportDir, { recursive: true });
for (const file of fs.readdirSync(reportDir)) {
  if (/^results(?:-.+)?\.json$/.test(file)) fs.rmSync(path.join(reportDir, file), { force: true });
}

for (const project of projects) {
  console.log(`[KaFarm E2E Matrix] Starting ${project}`);
  const result = spawnSync(process.execPath, [playwrightCli, "test", `--project=${project}`], {
    cwd: root,
    env: { ...process.env, E2E_REPORT_SUFFIX: `results-${project}` },
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${project} failed with exit code ${result.status}`);
  }
  console.log(`[KaFarm E2E Matrix] PASS ${project}`);
}

console.log("[KaFarm E2E Matrix] PASS all devices");
