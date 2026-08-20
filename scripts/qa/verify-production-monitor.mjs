import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const envFile = path.join(root, ".env.local");
const local = fs.existsSync(envFile)
  ? Object.fromEntries(fs.readFileSync(envFile, "utf8").split(/\r?\n/)
    .map(line => line.match(/^([^#=]+)=(.*)$/)).filter(Boolean)
    .map(match => [match[1].trim(), match[2].trim().replace(/^['"]|['"]$/g, "")]))
  : {};
const env = { ...local, ...process.env };
const baseUrl = (env.PRODUCTION_BASE_URL || "https://farmconnect-live.vercel.app").replace(/\/$/, "");
const secret = (env.CRON_SECRET || "").trim();

if (!secret) {
  console.error("[Production Monitor Verification] FAIL: CRON_SECRET is required locally for this authorized operational check.");
  process.exit(1);
}

const response = await fetch(`${baseUrl}/api/kafarm/guardian/monitor`, {
  headers: { Authorization: `Bearer ${secret}`, "Cache-Control": "no-store" },
});
const body = await response.json().catch(() => ({}));
const passed = response.ok && body.ok === true && body.heartbeatPersisted === true
  && body.businessMutationAttempted === false;

console.log(JSON.stringify({
  checkedAt: new Date().toISOString(),
  url: `${baseUrl}/api/kafarm/guardian/monitor`,
  httpStatus: response.status,
  passed,
  findingCount: body.findingCount ?? null,
  findingSummary: body.findingSummary ?? null,
  persistedCount: body.persistedCount ?? null,
  heartbeatPersisted: body.heartbeatPersisted ?? false,
  deploymentCommit: body.deploymentCommit ?? null,
  truthModelVersion: body.truthModelVersion ?? null,
  error: body.error || body.heartbeatError || body.persistenceError || null,
}, null, 2));

if (!passed) process.exitCode = 1;
