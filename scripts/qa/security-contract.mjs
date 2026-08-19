import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const outputDir = path.join(root, "test-results", "kafarm");
const reportPath = path.join(outputDir, "security-contract.json");

function read(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
}

function walk(dir, output = []) {
  if (!fs.existsSync(dir)) return output;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, output);
    else if (/\.(?:ts|tsx|js|mjs)$/.test(entry.name)) output.push(full);
  }
  return output;
}

const env = Object.fromEntries(read(path.join(root, ".env.local")).split(/\r?\n/)
  .map(line => line.match(/^([^#=]+)=(.*)$/)).filter(Boolean)
  .map(match => [match[1].trim(), match[2].trim().replace(/^['"]|['"]$/g, "")]));
const clientFiles = [...walk(path.join(root, "app")), ...walk(path.join(root, "lib"))];
const customerAppSource = read(path.join(root, "lib", "farmconnect-v1.tsx"));
const customerAuthSource = read(path.join(root, "lib", "customer-auth.ts"));
const verificationAppSource = read(path.join(root, "lib", "farmconnect-unified-account-verification.tsx"));
const kycReviewGuardSource = read(path.join(root, "database", "applied", "052_customer_kyc_review_status_guard.sql"));
const kycRiskReviewGuardSource = read(path.join(root, "database", "applied", "071_customer_kyc_risk_review_guard.sql"));
const isolatedTargetGuardSource = read(path.join(root, "scripts", "qa", "isolated-supabase-guard.mjs"));
const rateLimitSource = read(path.join(root, "lib", "security", "farmconnect-rate-limit.ts"));
const guardianApiSource = read(path.join(root, "app", "api", "kafarm", "guardian", "route.ts"));
const guardianClientSource = read(path.join(root, "app", "admin", "kafarm", "guardian", "_components", "GuardianClient.tsx"));
const clientSecretReferences = clientFiles
  .filter(file => !file.includes(`${path.sep}api${path.sep}`))
  .filter(file => !/^\s*import\s+["']server-only["'];?/m.test(read(file)))
  .filter(file => /SUPABASE_SERVICE_ROLE_KEY|KAFARM_SQL_GATEWAY_TOKEN/.test(read(file)))
  .map(file => path.relative(root, file));
const openAiClientReferences = clientFiles
  .filter(file => !file.includes(`${path.sep}api${path.sep}`))
  .filter(file => !/^\s*import\s+["']server-only["'];?/m.test(read(file)))
  .filter(file => /OPENAI_API_KEY/.test(read(file)))
  .map(file => path.relative(root, file));

const checks = [
  { name: "SQL gateway API removed", ok: !fs.existsSync(path.join(root, "app", "api", "kafarm", "sql-gateway", "route.ts")) },
  { name: "SQL gateway admin page removed", ok: !fs.existsSync(path.join(root, "app", "admin", "kafarm", "sql-gateway", "page.tsx")) },
  { name: "SQL gateway disabled in local deployment config", ok: env.KAFARM_SQL_GATEWAY_ENABLED !== "true" },
  { name: "No service key or gateway token in client modules", ok: clientSecretReferences.length === 0, evidence: clientSecretReferences },
  { name: "No OpenAI API key reference in client modules", ok: openAiClientReferences.length === 0, evidence: openAiClientReferences },
  { name: "Environment files are ignored", ok: /(?:^|\n)\.env\*/.test(read(path.join(root, ".gitignore"))) || /(?:^|\n)\.env\.local/.test(read(path.join(root, ".gitignore"))) },
  { name: "Security headers configured", ok: /Content-Security-Policy|X-Content-Type-Options|frame-ancestors/.test(read(path.join(root, "next.config.ts"))) },
  { name: "KYC evidence uploads use private storage", ok: /uploadPrivateEvidenceFile\(\{\s*bucket:\s*"farmconnect-customer-kyc"/.test(customerAppSource) },
  { name: "KYC RPC receives permanent storage paths", ok: /p_valid_id_front_url: frontPath/.test(customerAppSource) && /p_valid_id_back_url: backPath/.test(customerAppSource) && /p_selfie_url: selfiePath/.test(customerAppSource) },
  { name: "KYC RPC does not receive browser preview URLs", ok: !/p_valid_id_front_url: kycIdPhoto/.test(customerAppSource) && !/p_valid_id_back_url: kycIdBackPhoto/.test(customerAppSource) && !/p_selfie_url: kycSelfiePhoto/.test(customerAppSource) },
  { name: "KYC private-storage policy migration exists", ok: fs.existsSync(path.join(root, "database", "applied", "051_customer_kyc_private_storage_wiring.sql")) },
  { name: "KYC admin guard accepts live review status", ok: /ready_for_review/.test(kycReviewGuardSource) && /REJECTION_NOTE_REQUIRED/.test(kycReviewGuardSource) },
  { name: "Customer KYC settings distinguish pending rejected and approved", ok: /Your KYC is in review/.test(customerAppSource) && /KYC rejected for resubmission/.test(customerAppSource) && /Approved and locked/.test(customerAppSource) },
  { name: "Admin KYC rejection explicitly reopens resubmission", ok: /Reject for Resubmission/.test(verificationAppSource) && /upload corrected KYC evidence/.test(verificationAppSource) },
  { name: "Admin KYC queue keeps risk-flagged submissions reviewable", ok: /customerQueueStatuses[\s\S]*?"high_risk"[\s\S]*?"duplicate_risk"/.test(verificationAppSource) },
  { name: "Admin KYC risk badge prioritizes risk-flagged submission status", ok: /status === "high_risk" \|\| status === "duplicate_risk"[\s\S]*?\? status/.test(verificationAppSource) },
  { name: "Guarded Admin KYC review accepts risk-flagged queue states", ok: /admin_review_customer_kyc_guarded/.test(kycRiskReviewGuardSource) && /'high_risk'/.test(kycRiskReviewGuardSource) && /'duplicate_risk'/.test(kycRiskReviewGuardSource) && /REJECTION_NOTE_REQUIRED/.test(kycRiskReviewGuardSource) },
  { name: "Guarded Admin KYC review enforces risk-flag minimums", ok: /when v_kyc_status = 'high_risk' then 'high'/.test(kycRiskReviewGuardSource) && /when v_kyc_status = 'duplicate_risk' then 'medium'/.test(kycRiskReviewGuardSource) && /v_effective_risk_level/.test(kycRiskReviewGuardSource) },
  { name: "Customer identity resolves by Auth UID only", ok: /\.eq\("auth_user_id", user\.id\)/.test(customerAuthSource) && !/\.eq\("email",/.test(customerAuthSource) && !/profileByEmail/.test(customerAuthSource) },
  { name: "Rate-limit readiness defaults to honest OFF mode", ok: /effectiveMode:\s*"off"/.test(rateLimitSource) && /businessRpcEnforcement:\s*false/.test(rateLimitSource) && /persistentBackendInstalled:\s*false/.test(rateLimitSource) },
  { name: "Rate-limit activation is deployment controlled and Admin visible", ok: /deployment_environment_only/.test(rateLimitSource) && /getFarmConnectRateLimitReadiness/.test(guardianApiSource) && /Rate Limit OFF · Deployment Controlled/.test(guardianClientSource) },
  { name: "Rate-limit configuration is server-only", ok: /^\s*import\s+["']server-only["'];?/m.test(rateLimitSource) && !guardianClientSource.includes("FARMCONNECT_RATE_LIMIT_MODE") },
  { name: "E2E harness permanently rejects the FarmConnect production database", ok: /E2E_PRODUCTION_DATABASE_BLOCKED/.test(isolatedTargetGuardSource) && /bfckjrqrixbtqqvsxgjq\.supabase\.co/.test(isolatedTargetGuardSource) },
];
const report = { generatedAt: new Date().toISOString(), passed: checks.every(check => check.ok), checks };
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`[KaFarm Security Contract] ${report.passed ? "PASS" : "FAIL"}`);
for (const check of checks) console.log(`- ${check.ok ? "PASS" : "FAIL"}: ${check.name}`);
if (!report.passed) process.exitCode = 1;
