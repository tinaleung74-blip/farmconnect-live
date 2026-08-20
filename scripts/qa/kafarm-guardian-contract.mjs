import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const exists = (file) => fs.existsSync(path.join(root, file));
const outputPath = path.join(root, "test-results", "kafarm", "guardian-contract.json");

const reasoning = read("lib/kafarm/guardian/reasoning.ts");
const tools = read("lib/kafarm/guardian/evidence-tools.ts");
const gate = read("lib/kafarm/guardian/logic-gate.ts");
const auth = read("lib/kafarm/guardian/admin-auth.ts");
const monitor = read("app/api/kafarm/guardian/monitor/route.ts");
const monitorRunLedger = read("database/applied/079_kafarm_monitor_run_ledger.sql");
const truthEvidenceMigration = read("database/applied/080_kafarm_truth_reference_current_evidence.sql");
const guardianRoute = read("app/api/kafarm/guardian/route.ts");
const truthReference = read("lib/kafarm/guardian/truth-reference.ts");
const guardianClient = read("app/admin/kafarm/guardian/_components/GuardianClient.tsx");
const blueprint = JSON.parse(read("config/kafarm/farmconnect-blueprint.v1.json"));
const map = JSON.parse(read("lib/kafarm/guardian/system-map.generated.json"));

const checks = [
  { name: "FarmConnect-only owner blueprint exists", ok: blueprint.application === "FarmConnect" && blueprint.blueprintId === "farmconnect-owner-blueprint" },
  { name: "Protected zones cover every required sensitive category", ok: ["wallet_balance", "withdrawal", "payment_approval", "rooster_ownership", "kyc_decision", "account_role", "pin_password_security", "destructive_data", "rls_policy", "production_schema", "arbitrary_sql"].every((item) => blueprint.protectedZones.includes(item)) },
  { name: "OpenAI Responses API is server-side only", ok: /import "server-only"/.test(reasoning) && /https:\/\/api\.openai\.com\/v1\/responses/.test(reasoning) && !/NEXT_PUBLIC_OPENAI/.test(reasoning) },
  { name: "Structured output and strict function tools are enabled", ok: /json_schema/.test(reasoning) && /strict: true/.test(reasoning) && /kaFarmEvidenceToolDefinitions/.test(reasoning) },
  { name: "Controlled evidence tools cover the required read domains", ok: ["system_map_lookup", "source_code_lookup", "route_lookup", "dependency_lookup", "database_metadata_read", "workflow_event_read", "incident_read", "test_result_read", "git_change_history_read", "blueprint_lookup"].every((item) => tools.includes(`name: \"${item}\"`)) },
  { name: "No mutation-named model tool is exposed", ok: !/name: "(?:insert|update|delete|execute_sql|approve|reject|pay|transfer|repair|fix)_/i.test(tools) },
  { name: "Every Guardian request rechecks active Admin", ok: /authenticateKaFarmAdmin/.test(guardianRoute) && /ACTIVE_ADMIN_REQUIRED/.test(auth) && /PROJECT_URL_NOT_FARMCONNECT/.test(auth) },
  { name: "AI action freeze defaults to enabled", ok: /KAFARM_AI_ACTIONS_FROZEN \?\? "true"/.test(gate) && /AI ACTIONS FROZEN/.test(gate) },
  { name: "Gate separates reasoning from execution", ok: /APPROVAL_REQUIRED/.test(gate) && /executionAllowed/.test(gate) && /protectedZones/.test(gate) },
  { name: "Guardian API has no execution adapter", ok: /This endpoint has no mutation adapter/.test(guardianRoute) && /attempted: false/.test(guardianRoute) },
  { name: "Proactive monitor is disabled by default and never mutates business workflows", ok: /KAFARM_MONITOR_ENABLED \|\| "false"/.test(monitor) && /businessMutationAttempted: false/.test(monitor) && /automaticRepairAttempted: false/.test(monitor) },
  { name: "Monitor findings persist only as deduplicated Admin incidents", ok: /from\("kafarm_incidents"\)/.test(monitor) && /ignoreDuplicates: true/.test(monitor) && /guardian_monitor/.test(monitor) },
  { name: "Durable monitor SQL is explicit and service-role guarded", ok: exists("database/applied/077_kafarm_guardian_durable_monitor.sql") && /KAFARM_MONITOR_AUTH_REQUIRED/.test(read("database/applied/077_kafarm_guardian_durable_monitor.sql")) && /grant execute.*service_role/i.test(read("database/applied/077_kafarm_guardian_durable_monitor.sql")) },
  { name: "Every authorized monitor run writes a durable heartbeat", ok: /kafarm_guardian_monitor_runs/.test(monitor) && /heartbeatPersisted/.test(monitor) && /businessMutationAttempted: false/.test(monitor) && /kafarm_guardian_monitor_health/.test(monitorRunLedger) },
  { name: "Truth Reference uses the live monitor ledger and open incident evidence", ok: /kafarm_guardian_monitor_runs/.test(truthReference) && /kafarm_incidents/.test(truthReference) && /groupIncidents/.test(truthReference) },
  { name: "Truth Reference separates confirmed, unproven, and stale evidence", ok: /CONFIRMED_HEALTHY/.test(truthReference) && /CONFIRMED_ISSUE/.test(truthReference) && /UNPROVEN/.test(truthReference) && /STALE_IGNORE/.test(truthReference) },
  { name: "Truth Reference is explicitly read-only", ok: /businessMutationAttempted: false/.test(truthReference) && /automaticRepairAttempted: false/.test(truthReference) && !/\.insert\(|\.update\(|\.upsert\(|\.delete\(/.test(truthReference) },
  { name: "Truth Reference requires a current deployment evidence boundary", ok: /deploymentBoundary/.test(truthReference) && /current-deployment-v2/.test(truthReference) && /source === "guardian_monitor" \? "UNPROVEN"/.test(truthReference) },
  { name: "Monitor never wraps an existing runtime incident as a new incident", ok: /persistableFindings/.test(monitor) && /item\.code !== "open_runtime_incident"/.test(monitor) && !/open_runtime_incident/.test(truthEvidenceMigration) },
  { name: "Monitor heartbeat preserves grouped current leads even when no new incident is inserted", ok: /summarizeFindings/.test(monitor) && /findingSummary/.test(monitor) && /monitorLeadGroups/.test(truthReference) },
  { name: "Guardian page exposes one copyable Truth Reference", ok: /KaFarm Truth Reference/.test(guardianClient) && /Copy Truth Reference/.test(guardianClient) && /groupedRootCauses/.test(guardianClient) },
  { name: "Living system map is generated and explicitly caveated", ok: map.application === "FarmConnect" && map.counts.pages > 0 && map.counts.edges > 0 && Array.isArray(map.limitations) && map.limitations.length > 0 },
  { name: "Guardian Admin page exists", ok: exists("app/admin/kafarm/guardian/page.tsx") && exists("app/admin/kafarm/guardian/_components/GuardianClient.tsx") },
];

const report = {
  generatedAt: new Date().toISOString(),
  commit: map.git?.commit || null,
  passed: checks.every((item) => item.ok),
  checks,
  proofRule: "This static contract proves safety wiring exists. It does not prove an OpenAI call, live database read, browser workflow, or production deployment passed.",
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
for (const item of checks) console.log(`- ${item.ok ? "PASS" : "FAIL"}: ${item.name}`);
console.log(`[KaFarm Guardian Contract] ${report.passed ? "PASS" : "FAIL"}`);
if (!report.passed) process.exitCode = 1;
