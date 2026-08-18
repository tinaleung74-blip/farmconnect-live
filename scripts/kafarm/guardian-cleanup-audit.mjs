import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const outputPath = path.join(root, "test-results", "kafarm", "guardian-cleanup-audit.json");
const roots = ["app/admin/kafarm", "app/api/kafarm", "lib/kafarm"];
const files = roots.flatMap((relative) => {
  const base = path.join(root, relative);
  if (!fs.existsSync(base)) return [];
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]);
  return walk(base).filter((file) => /\.(?:ts|tsx|json)$/.test(file));
});
const relative = (file) => path.relative(root, file).replaceAll("\\", "/");
const sourceFiles = files.filter((file) => /\.(?:ts|tsx)$/.test(file));
const oversized = sourceFiles.map((file) => ({ file: relative(file), lines: fs.readFileSync(file, "utf8").split(/\r?\n/).length })).filter((item) => item.lines > 1200).sort((a, b) => b.lines - a.lines);
const unreachable = sourceFiles.flatMap((file) => {
  const content = fs.readFileSync(file, "utf8");
  return /const simpleReportView = true/.test(content) ? [{ file: relative(file), evidence: "const simpleReportView = true leaves the following branch unreachable" }] : [];
});
const placeholders = sourceFiles.flatMap((file) => {
  const content = fs.readFileSync(file, "utf8");
  return ["Passed local QA", "Future Safe Fix", "Phase later"].filter((token) => content.includes(token)).map((token) => ({ file: relative(file), token }));
});
let head = null;
try { head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(); } catch {}
const mapPath = path.join(root, "lib/kafarm/guardian/system-map.generated.json");
const map = fs.existsSync(mapPath) ? JSON.parse(fs.readFileSync(mapPath, "utf8")) : null;
const report = {
  generatedAt: new Date().toISOString(),
  mode: "read-only-cleanup-audit",
  mutationAttempted: false,
  dependencyProofRequiredBeforeDeletion: true,
  oversized,
  unreachable,
  placeholders,
  generatedMap: { present: Boolean(map), commit: map?.git?.commit || null, currentCommit: head, stale: Boolean(map && head && map.git?.commit !== head) },
  recommendations: [
    "Split oversized KaFarm UI only after component dependencies and current behavior have focused tests.",
    "Remove unreachable branches only after preserving any unique live-read behavior in reachable surfaces.",
    "Replace placeholder health claims with current-release evidence or an explicit NOT RUN state.",
  ],
};
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`[KaFarm Cleanup Audit] oversized=${oversized.length}, unreachable=${unreachable.length}, placeholders=${placeholders.length}, mapStale=${report.generatedMap.stale}`);
console.log(`[KaFarm Cleanup Audit] Report: ${outputPath}`);
