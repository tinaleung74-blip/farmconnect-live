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
const clientSecretReferences = clientFiles
  .filter(file => !file.includes(`${path.sep}api${path.sep}`))
  .filter(file => /SUPABASE_SERVICE_ROLE_KEY|KAFARM_SQL_GATEWAY_TOKEN/.test(read(file)))
  .map(file => path.relative(root, file));

const checks = [
  { name: "SQL gateway API removed", ok: !fs.existsSync(path.join(root, "app", "api", "kafarm", "sql-gateway", "route.ts")) },
  { name: "SQL gateway admin page removed", ok: !fs.existsSync(path.join(root, "app", "admin", "kafarm", "sql-gateway", "page.tsx")) },
  { name: "SQL gateway disabled in local deployment config", ok: env.KAFARM_SQL_GATEWAY_ENABLED !== "true" },
  { name: "No service key or gateway token in client modules", ok: clientSecretReferences.length === 0, evidence: clientSecretReferences },
  { name: "Environment files are ignored", ok: /(?:^|\n)\.env\*/.test(read(path.join(root, ".gitignore"))) || /(?:^|\n)\.env\.local/.test(read(path.join(root, ".gitignore"))) },
  { name: "Security headers configured", ok: /Content-Security-Policy|X-Content-Type-Options|frame-ancestors/.test(read(path.join(root, "next.config.ts"))) },
];
const report = { generatedAt: new Date().toISOString(), passed: checks.every(check => check.ok), checks };
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`[KaFarm Security Contract] ${report.passed ? "PASS" : "FAIL"}`);
for (const check of checks) console.log(`- ${check.ok ? "PASS" : "FAIL"}: ${check.name}`);
if (!report.passed) process.exitCode = 1;
