import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const npmCli = process.env.npm_execpath;

function run(script) {
  if (!npmCli) throw new Error("npm CLI path is unavailable.");
  const result = spawnSync(process.execPath, [npmCli, "run", script], {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${script} failed with exit code ${result.status}.`);
}

let accountsCreated = false;
let failed = false;
const buildMarker = path.join(process.cwd(), "test-results", "kafarm", "production-build.json");

try {
  fs.rmSync(buildMarker, { force: true });
  run("build");
  fs.mkdirSync(path.dirname(buildMarker), { recursive: true });
  fs.writeFileSync(buildMarker, `${JSON.stringify({ passed: true, generatedAt: new Date().toISOString() }, null, 2)}\n`);
  run("test:lint-critical");
  run("test:db");
  run("test:accounts:create");
  accountsCreated = true;
  run("test:business");
  run("test:e2e");
  run("test:report");
} catch (error) {
  failed = true;
  console.error(`[KaFarm Readiness] FAIL: ${error.message}`);
} finally {
  if (accountsCreated) {
    try {
      run("test:accounts:delete");
    } catch (cleanupError) {
      failed = true;
      console.error(`[KaFarm Readiness] CLEANUP FAILED: ${cleanupError.message}`);
    }
  }
}

if (failed) process.exitCode = 1;
else console.log("[KaFarm Readiness] PASS");
