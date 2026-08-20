import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const migration = read("database/applied/078_persistent_business_rate_limit.sql");
const readiness = read("lib/security/farmconnect-rate-limit.ts");

const protectedWorkflows = [
  "payment", "caretaker_application", "care_request", "withdrawal",
  "rooster_sale", "care_plan", "customer_kyc",
];
const checks = [
  ["Persistent event table uses RLS", /alter table public\.farmconnect_rate_limit_events enable row level security/i.test(migration)],
  ["Browser roles cannot read or write rate events", /revoke all on table public\.farmconnect_rate_limit_events from public, anon, authenticated/i.test(migration)],
  ["Concurrent attempts serialize per actor and workflow", /pg_advisory_xact_lock/.test(migration)],
  ["Old per-actor events are bounded", /occurred_at < now\(\) - interval '7 days'/.test(migration)],
  ["Every required business workflow is guarded", protectedWorkflows.every(workflow => migration.includes(`'${workflow}'`))],
  ["Limiter rejects above-threshold attempts", /FARMCONNECT_RATE_LIMITED/.test(migration)],
  ["Active Admin review throughput has a bounded operational ceiling", /public\.is_admin\(\).*p_max_attempts \* 10/.test(migration)],
  ["Limiter does not mutate business money or ownership", !/(?:update|delete from) public\.(?:profiles|wallet_ledger|customer_animals|withdrawal_requests|manual_payment_requests)/i.test(migration)],
  ["Production status fails closed without database evidence", /const effectiveMode = databaseVerified \? "enforce" : "unverified"/.test(readiness)],
  ["Production verification uses a server-only environment key", /FARMCONNECT_RATE_LIMIT_PRODUCTION_VERIFIED/.test(readiness) && /import "server-only"/.test(readiness)],
];

for (const [name, passed] of checks) console.log(`${passed ? "PASS" : "FAIL"}: ${name}`);
const passed = checks.every(([, value]) => value);
console.log(`[FarmConnect Rate Limit Contract] ${passed ? "PASS" : "FAIL"}`);
if (!passed) process.exitCode = 1;
