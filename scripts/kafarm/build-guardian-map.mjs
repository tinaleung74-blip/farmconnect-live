import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const snapshotPath = path.join(root, "lib", "kafarm-system-snapshot.generated.json");
const blueprintPath = path.join(root, "config", "kafarm", "farmconnect-blueprint.v1.json");
const outputPath = path.join(root, "lib", "kafarm", "guardian", "system-map.generated.json");
const packagePath = path.join(root, "package.json");

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function git(args, fallback = null) {
  try {
    return execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim() || fallback;
  } catch {
    return fallback;
  }
}

const snapshot = readJson(snapshotPath);
const blueprint = readJson(blueprintPath);
const pkg = readJson(packagePath);
const generatedAt = new Date().toISOString();
const commit = git(["rev-parse", "HEAD"]);
const branch = git(["branch", "--show-current"]);
const dirtyFiles = (git(["status", "--porcelain"], "") || "").split(/\r?\n/).filter(Boolean);

const routeNodes = snapshot.routes.map((item) => ({
  id: `route:${item.route}`,
  type: "page",
  name: item.route,
  file: item.file,
  role: item.role,
}));
const apiNodes = snapshot.apiEndpoints.map((item) => ({
  id: `api:${item.route}`,
  type: "api",
  name: item.route,
  file: item.file,
  role: item.role,
  methods: item.methods,
}));
const actionNodes = snapshot.actions.map((item, index) => ({
  id: `action:${item.file}:${item.line}:${index}`,
  type: "action",
  name: item.label,
  file: item.file,
  line: item.line,
  role: item.role,
  route: item.route,
  wiring: item.wiring,
  handler: item.handler,
}));
const backendNodes = snapshot.backendReferences.map((item, index) => ({
  id: `backend:${item.kind}:${item.name}:${item.file}:${item.line}:${index}`,
  type: item.kind,
  name: item.name,
  file: item.file,
  line: item.line,
  role: item.role,
  route: item.route,
}));

const edges = [];
for (const action of actionNodes) {
  edges.push({ from: `route:${action.route}`, to: action.id, relation: "contains_action", confidence: "confirmed", evidence: `${action.file}:${action.line}` });
  const nearby = backendNodes
    .filter((backend) => backend.file === action.file && Math.abs(Number(backend.line) - Number(action.line)) <= 160)
    .sort((a, b) => Math.abs(Number(a.line) - Number(action.line)) - Math.abs(Number(b.line) - Number(action.line)))
    .slice(0, 4);
  for (const backend of nearby) {
    edges.push({
      from: action.id,
      to: backend.id,
      relation: "nearby_backend_reference",
      confidence: "possible",
      evidence: `${action.file}:${action.line} near ${backend.file}:${backend.line}`,
    });
  }
}
for (const reference of snapshot.routeReferences) {
  edges.push({
    from: `route:${reference.ownerRoute}`,
    to: `route:${reference.target}`,
    relation: "navigates_to",
    confidence: reference.exists ? "confirmed" : "possible",
    evidence: `${reference.source}:${reference.line}`,
  });
}

const testCatalog = Object.entries(pkg.scripts || {})
  .filter(([name]) => name.startsWith("test:"))
  .map(([name, command]) => ({ name, command, exists: true, currentReleaseStatus: "NOT_RUN_CURRENT_RELEASE" }));

const mapCore = {
  schemaVersion: "1.0.0",
  application: "FarmConnect",
  generatedAt,
  sourceSnapshot: {
    generatedAt: snapshot.generatedAt,
    sourceFingerprint: snapshot.sourceFingerprint,
    schemaVersion: snapshot.schemaVersion,
  },
  git: { commit, branch, dirtyFiles },
  blueprint: { id: blueprint.blueprintId, version: blueprint.schemaVersion, updatedAt: blueprint.updatedAt },
  counts: {
    pages: routeNodes.length,
    apiRoutes: apiNodes.length,
    actions: actionNodes.length,
    backendReferences: backendNodes.length,
    edges: edges.length,
    tests: testCatalog.length,
  },
  nodes: [...routeNodes, ...apiNodes, ...actionNodes, ...backendNodes],
  edges,
  featureDependencies: snapshot.featureDependencies,
  contractCoverage: snapshot.contractCoverage,
  tests: testCatalog,
  limitations: [
    "Nearby action-to-backend edges are hypotheses until runtime or exact call-graph evidence confirms them.",
    "Database objects and RLS remain authoritative only when read from the live admin health RPC.",
    "A test script existing does not mean it passed on this commit or deployment.",
    "The generated map contains source references, not unrestricted runtime source-code access.",
  ],
};

const fingerprint = crypto.createHash("sha256").update(JSON.stringify(mapCore)).digest("hex");
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify({ ...mapCore, fingerprint }, null, 2)}\n`);
console.log(`KaFarm Guardian system map: ${outputPath}`);
console.log(`Fingerprint: ${fingerprint}`);
console.log(`Nodes: ${mapCore.nodes.length}; edges: ${edges.length}`);
