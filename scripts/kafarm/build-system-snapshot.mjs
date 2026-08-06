import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, join, relative, resolve, sep } from "node:path";

const root = process.cwd();
const outputPath = join(root, "lib", "kafarm-system-snapshot.generated.json");
const contractPath = join(root, "scripts", "kafarm", "farmconnect-system-contract.json");
const schemaProvenancePath = join(root, "database", "SCHEMA_PROVENANCE.md");
const sourceRoots = ["app", "lib", "components", "hooks", "utils"];
const sourceExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".mts"]);
const routeExtensions = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".mts"];
const ignoredDirectories = new Set([".git", ".next", "node_modules", "coverage", "dist", "build"]);
const importantAction = /approve|reject|submit|send|save|pay|withdraw|assign|upload|scan|camera|confirm|delete|release|review|resubmit|needs info|backjob|complete|open|copy|run/i;

const toPosix = (value) => value.split(sep).join("/");
const relativePath = (value) => toPosix(relative(root, value));
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const lineOf = (source, offset) => source.slice(0, offset).split(/\r?\n/).length;
const unique = (values) => [...new Set(values.filter(Boolean))];

function walk(directory, acceptedExtensions = sourceExtensions) {
  if (!existsSync(directory)) return [];
  const results = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) results.push(...walk(fullPath, acceptedExtensions));
    else if (entry.isFile() && acceptedExtensions.has(extname(entry.name))) results.push(fullPath);
  }
  return results;
}

function readSafe(file) {
  try {
    return readFileSync(file, "utf8").replace(/^\uFEFF/, "");
  } catch {
    return "";
  }
}

function routeFromPage(file) {
  let path = relativePath(file).replace(/^app\//, "").replace(/(?:^|\/)page\.(tsx?|jsx?|mjs|mts)$/, "");
  path = path
    .split("/")
    .filter((part) => part && !/^\(.*\)$/.test(part) && !part.startsWith("@"))
    .join("/");
  return `/${path}`.replace(/\/$/, "") || "/";
}

function routeFromHandler(file) {
  let path = relativePath(file).replace(/^app\//, "").replace(/(?:^|\/)route\.(tsx?|jsx?|mjs|mts)$/, "");
  path = path
    .split("/")
    .filter((part) => part && !/^\(.*\)$/.test(part) && !part.startsWith("@"))
    .join("/");
  return `/${path}`.replace(/\/$/, "") || "/";
}

function routePatternMatches(route, knownRoute) {
  if (route === knownRoute) return true;
  const pattern = knownRoute
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\\\[\\\[\\\.\\\.\\\.[^\]]+\\\]\\\]/g, ".+")
    .replace(/\\\[\\\.\\\.\\\.[^\]]+\\\]/g, ".+")
    .replace(/\\\[[^\]]+\\\]/g, "[^/]+");
  return new RegExp(`^${pattern}/?$`).test(route);
}

function normalizeTarget(value) {
  if (!value || !value.startsWith("/")) return null;
  if (value.startsWith("//") || value.startsWith("/_next") || value.startsWith("/api/")) return null;
  return value.split(/[?#]/)[0].replace(/\/$/, "") || "/";
}

function importSpecifiers(source) {
  const specs = [];
  const patterns = [
    /(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']/g,
    /(?:import|require)\s*\(\s*["']([^"']+)["']\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) specs.push(match[1]);
  }
  return unique(specs);
}

function namedImports(source) {
  const imports = [];
  for (const match of source.matchAll(/import\s*\{([\s\S]*?)\}\s*from\s*["']([^"']+)["']/g)) {
    for (const rawPart of match[1].split(",")) {
      const cleaned = rawPart.replace(/^\s*type\s+/, "").trim();
      if (!cleaned) continue;
      const [importedName, localName] = cleaned.split(/\s+as\s+/).map((part) => part.trim());
      if (/^[A-Za-z_$][\w$]*$/.test(importedName)) {
        imports.push({ importedName, localName: localName || importedName, specifier: match[2] });
      }
    }
  }
  return imports;
}

function enclosingExportName(source, offset) {
  let owner = null;
  const pattern = /export\s+(?:default\s+)?(?:async\s+)?(?:function|class|const|let)\s+([A-Za-z_$][\w$]*)/g;
  for (const match of source.matchAll(pattern)) {
    if ((match.index || 0) > offset) break;
    owner = match[1];
  }
  return owner;
}

function resolveImport(fromFile, specifier) {
  let base;
  if (specifier.startsWith("@/")) base = join(root, specifier.slice(2));
  else if (specifier.startsWith(".")) base = resolve(dirname(fromFile), specifier);
  else return null;

  const candidates = [base];
  if (!extname(base)) {
    for (const extension of routeExtensions) candidates.push(`${base}${extension}`);
    for (const extension of routeExtensions) candidates.push(join(base, `index${extension}`));
  }
  return candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile()) || null;
}

function detectRole(route, file) {
  const text = `${route} ${file}`.toLowerCase();
  if (text.includes("/customer")) return "customer";
  if (text.includes("/caretaker")) return "caretaker";
  if (text.includes("/admin")) return "admin";
  return "system";
}

function labelFromJsx(block) {
  return block
    .replace(/<[^>]+>/g, " ")
    .replace(/\{[^{}]*\}/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100) || "Unlabeled button";
}

function openingButtonTag(block) {
  let quote = null;
  let braceDepth = 0;
  for (let index = 0; index < block.length; index += 1) {
    const character = block[index];
    const previous = index > 0 ? block[index - 1] : "";
    if (quote) {
      if (character === quote && previous !== "\\") quote = null;
      continue;
    }
    if (character === '"' || character === "'" || character === "`") {
      quote = character;
      continue;
    }
    if (character === "{") braceDepth += 1;
    else if (character === "}") braceDepth = Math.max(0, braceDepth - 1);
    else if (character === ">" && braceDepth === 0) return block.slice(0, index + 1);
  }
  return block;
}

function handlerContext(source, rawHandler) {
  const handler = String(rawHandler || "").trim();
  if (!handler) return "";
  const identifier = handler.match(/^([A-Za-z_$][\w$]*)$/)?.[1];
  if (!identifier) return handler.slice(0, 2500);
  const escaped = identifier.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`(?:async\\s+)?function\\s+${escaped}\\s*\\(`),
    new RegExp(`(?:const|let)\\s+${escaped}\\s*=\\s*(?:async\\s*)?`),
  ];
  for (const pattern of patterns) {
    const index = source.search(pattern);
    if (index >= 0) return source.slice(index, index + 3500);
  }
  return handler;
}

function wiringFromContext(context, hasHandler, isSubmit) {
  if (/\.from\s*\(|\.rpc\s*\(|fetch\s*\(|\.upload\s*\(|\.insert\s*\(|\.update\s*\(/.test(context)) return "backend";
  if (/router\.(?:push|replace)\s*\(|window\.location|location\.href|href\s*=/.test(context)) return "route";
  if (/navigator\.clipboard/.test(context)) return "clipboard";
  if (isSubmit) return /onSubmit\s*=/.test(context) ? "form-handler" : "form-submit";
  if (hasHandler && /^\s*(?:set[A-Z]|toggle|open|close)/.test(context)) return "ui-only";
  if (hasHandler) return "handled-unproven";
  return "unwired";
}

function finding({ id, confidence = "possible", severity = "medium", scope = "system", role = "system", page = "unknown", action = "Source check", title, expected, actual, evidence, nextStep }) {
  return { id, confidence, severity, scope, role, page, action, title, expected, actual, evidence, nextStep };
}

const sourceFiles = sourceRoots.flatMap((folder) => walk(join(root, folder)));
const sourceSet = new Set(sourceFiles);
const pageFiles = sourceFiles.filter((file) => /\/page\.(tsx?|jsx?|mjs|mts)$/.test(toPosix(file)));
const routeHandlerFiles = sourceFiles.filter((file) => /\/route\.(tsx?|jsx?|mjs|mts)$/.test(toPosix(file)));
const layoutFiles = sourceFiles.filter((file) => /\/layout\.(tsx?|jsx?|mjs|mts)$/.test(toPosix(file)));
const middlewareFiles = sourceFiles.filter((file) => /\/(?:middleware|proxy)\.(tsx?|jsx?|mjs|mts)$/.test(toPosix(file)));
const entryFiles = unique([...pageFiles, ...routeHandlerFiles, ...layoutFiles, ...middlewareFiles]);
const activeFiles = new Set();
const unresolvedImports = [];
const queue = [...entryFiles];

while (queue.length) {
  const current = queue.shift();
  if (!current || activeFiles.has(current)) continue;
  activeFiles.add(current);
  const source = readSafe(current);
  for (const specifier of importSpecifiers(source)) {
    if (!specifier.startsWith(".") && !specifier.startsWith("@/")) continue;
    const resolved = resolveImport(current, specifier);
    if (resolved && sourceSet.has(resolved) && !activeFiles.has(resolved)) queue.push(resolved);
    else if (!resolved) unresolvedImports.push({ source: relativePath(current), specifier });
  }
}

const routes = pageFiles.map((file) => ({ route: routeFromPage(file), file: relativePath(file), role: detectRole(routeFromPage(file), relativePath(file)) })).sort((a, b) => a.route.localeCompare(b.route));
const apiEndpoints = routeHandlerFiles.map((file) => {
  const source = readSafe(file);
  const endpoint = routeFromHandler(file);
  const methods = unique([...source.matchAll(/export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\b/g)].map((match) => match[1]));
  return { route: endpoint, file: relativePath(file), methods: methods.length ? methods : ["UNKNOWN"], role: detectRole(endpoint, relativePath(file)) };
}).sort((a, b) => a.route.localeCompare(b.route));
const routeNames = routes.map((item) => item.route);
const symbolConsumers = new Map();
for (const route of routes) {
  const pageFile = join(root, route.file);
  const pageSource = readSafe(pageFile);
  for (const namedImport of namedImports(pageSource)) {
    const resolved = resolveImport(pageFile, namedImport.specifier);
    if (!resolved) continue;
    const key = `${relativePath(resolved)}::${namedImport.importedName}`;
    const current = symbolConsumers.get(key) || [];
    current.push(route.route);
    symbolConsumers.set(key, unique(current));
  }
}

function sourceLocation(fileName, source, offset, fallbackRoute) {
  const exportName = enclosingExportName(source, offset);
  const consumers = exportName ? (symbolConsumers.get(`${fileName}::${exportName}`) || []) : [];
  const page = consumers.length ? consumers.join(", ") : fallbackRoute;
  const roles = unique(consumers.map((route) => detectRole(route, fileName)));
  const role = roles.length ? roles.join(", ") : detectRole(page, fileName);
  const sharedExportWithoutPageConsumer = fileName.startsWith("lib/") && Boolean(exportName) && consumers.length === 0;
  return { exportName, consumers, page, role, sharedExportWithoutPageConsumer };
}

const actions = [];
const backendReferences = [];
const routeReferences = [];
const clientStorageKeys = [];
const findings = [];

for (const file of [...activeFiles].sort()) {
  const source = readSafe(file);
  const fileName = relativePath(file);
  const ownerRoute = routes.find((item) => item.file === fileName)?.route || routes.find((item) => fileName.startsWith(dirname(item.file).replace(/\\/g, "/")))?.route || fileName;
  const role = detectRole(ownerRoute, fileName);

  const backendPatterns = [
    { kind: "table", regex: /\.from\s*\(\s*["'`]([^"'`]+)["'`]\s*\)/g },
    { kind: "rpc", regex: /\.rpc\s*\(\s*["'`]([^"'`]+)["'`]/g },
    { kind: "api", regex: /fetch\s*\(\s*["'`]([^"'`]+)["'`]/g },
    { kind: "storage", regex: /storage\s*\.\s*from\s*\(\s*["'`]([^"'`]+)["'`]\s*\)/g },
  ];
  for (const definition of backendPatterns) {
    for (const match of source.matchAll(definition.regex)) {
      const location = sourceLocation(fileName, source, match.index || 0, ownerRoute);
      backendReferences.push({ kind: definition.kind, name: match[1], file: fileName, line: lineOf(source, match.index || 0), role: location.role, route: location.page, exportName: location.exportName });
    }
  }


  for (const match of source.matchAll(/\b(localStorage|sessionStorage)\s*\.\s*(getItem|setItem|removeItem)\s*\(\s*["'`]([^"'`]+)["'`]/g)) {
    const location = sourceLocation(fileName, source, match.index || 0, ownerRoute);
    clientStorageKeys.push({
      storage: match[1],
      operation: match[2],
      key: match[3],
      file: fileName,
      line: lineOf(source, match.index || 0),
      role: location.role,
      route: location.page,
    });
  }

  const targetPattern = /(?:href\s*=\s*["']|router\.(?:push|replace)\s*\(\s*["']|window\.location(?:\.href)?\s*=\s*["'])(\/[^"']*)["']/g;
  for (const match of source.matchAll(targetPattern)) {
    const target = normalizeTarget(match[1]);
    if (!target) continue;
    const exists = routeNames.some((known) => routePatternMatches(target, known));
    const location = sourceLocation(fileName, source, match.index || 0, ownerRoute);
    routeReferences.push({ source: fileName, line: lineOf(source, match.index || 0), ownerRoute: location.page, target, exists, exportName: location.exportName });
    if (!exists && !location.sharedExportWithoutPageConsumer) {
      findings.push(finding({
        id: `missing-route-${sha256(`${fileName}:${match.index}:${target}`).slice(0, 12)}`,
        confidence: "confirmed",
        severity: "high",
        scope: location.role,
        role: location.role,
        page: location.page,
        action: `Navigate to ${target}`,
        title: "Route target is missing from the active app",
        expected: `The action should open an existing page: ${target}.`,
        actual: `No active app/page source matches ${target}.`,
        evidence: `${fileName}:${lineOf(source, match.index || 0)} references ${target}; active route inventory has no match.`,
        nextStep: "Confirm the intended destination, then add the route or change the action target. Runtime navigation still needs manual verification.",
      }));
    }
  }

  for (const match of source.matchAll(/<button\b[\s\S]*?<\/button>/gi)) {
    const block = match[0];
    const openingTag = openingButtonTag(block);
    if (/data-kafarm-monitor-ignore/.test(openingTag)) continue;
    const line = lineOf(source, match.index || 0);
    const location = sourceLocation(fileName, source, match.index || 0, ownerRoute);
    if (location.sharedExportWithoutPageConsumer) continue;
    const label = labelFromJsx(block.slice(openingTag.length));
    const handler = openingTag.match(/onClick\s*=\s*\{([\s\S]*)\}\s*>$/)?.[1] || "";
    const hasHandler = /onClick\s*=/.test(openingTag);
    const sourceBeforeButton = source.slice(0, match.index || 0);
    const insideForm = sourceBeforeButton.lastIndexOf("<form") > sourceBeforeButton.lastIndexOf("</form>");
    const isExplicitButton = /type\s*=\s*["']button["']/.test(openingTag);
    const isSubmit = /type\s*=\s*["']submit["']/.test(openingTag) || /formAction\s*=/.test(openingTag) || (insideForm && !isExplicitButton);
    const isDisabled = /\bdisabled(?:\s|=|>)/.test(openingTag);
    let context = handlerContext(source, handler);
    if (isSubmit) {
      const before = source.slice(Math.max(0, (match.index || 0) - 5000), match.index || 0);
      const formStart = before.lastIndexOf("<form");
      if (formStart >= 0) context += ` ${before.slice(formStart)}`;
    }
    const wiring = isDisabled && !hasHandler && !isSubmit ? "disabled" : wiringFromContext(context, hasHandler, isSubmit);
    actions.push({ kind: "button", label, file: fileName, line, role: location.role, route: location.page, exportName: location.exportName, wiring, handler: handler.slice(0, 120) || null });

    if (wiring === "unwired") {
      findings.push(finding({
        id: `unwired-button-${sha256(`${fileName}:${line}:${label}`).slice(0, 12)}`,
        confidence: "confirmed",
        severity: importantAction.test(label) ? "high" : "medium",
        scope: location.role,
        role: location.role,
        page: location.page,
        action: label,
        title: "Reachable button has no visible action wiring",
        expected: "The button should navigate, submit a form, open a controlled UI, or call a defined handler.",
        actual: "The reachable JSX button has no onClick, formAction, or submit semantics.",
        evidence: `${fileName}:${line} contains button “${label}” without visible action wiring.`,
        nextStep: "Trace the intended business action and connect it to a real route or database-backed handler before manual flow verification.",
      }));
    } else if (wiring === "ui-only" && importantAction.test(label)) {
      findings.push(finding({
        id: `ui-only-${sha256(`${fileName}:${line}:${label}`).slice(0, 12)}`,
        confidence: "possible",
        severity: "medium",
        scope: location.role,
        role: location.role,
        page: location.page,
        action: label,
        title: "Business action appears limited to local UI state",
        expected: "A business action should leave a traceable route, database, API, RPC, storage, or cross-role signal.",
        actual: "Static reading found a state/UI handler but did not prove a durable backend or receiving-role connection.",
        evidence: `${fileName}:${line} handler signal: ${handler.slice(0, 100) || "local setter"}.`,
        nextStep: "Inspect the full handler and receiving role. Mark confirmed only after runtime/network or database evidence agrees.",
      }));
    }
  }
}

for (const item of unresolvedImports) {
  findings.push(finding({
    id: `unresolved-import-${sha256(`${item.source}:${item.specifier}`).slice(0, 12)}`,
    confidence: "confirmed",
    severity: "high",
    scope: detectRole(item.source, item.source),
    role: detectRole(item.source, item.source),
    page: item.source,
    action: "Load active dependency",
    title: "Active source import cannot be resolved",
    expected: `Import ${item.specifier} should resolve to a local source file.`,
    actual: "No matching local file was found by the active-route dependency reader.",
    evidence: `${item.source} imports ${item.specifier}.`,
    nextStep: "Confirm alias/path casing and the intended file. The normal build remains the final compile check.",
  }));
}

const databaseFiles = walk(join(root, "database"), new Set([".sql"]));
const activeText = [...activeFiles, ...databaseFiles].map(readSafe).join("\n").toLowerCase();
let contract = { flows: [], featureDependencies: [], safetyRules: [] };
if (existsSync(contractPath)) {
  try { contract = JSON.parse(readFileSync(contractPath, "utf8")); } catch { /* Contract check is reported below. */ }
}

const contractCoverage = [];
for (const flow of contract.flows || []) {
  const signals = (flow.requiredSignals || []).map((signal) => ({
    id: signal.id,
    label: signal.label,
    present: (signal.any || []).some((term) => activeText.includes(String(term).toLowerCase())),
  }));
  const missing = signals.filter((signal) => !signal.present);
  contractCoverage.push({ id: flow.id, name: flow.name, producerRole: flow.producerRole, receiverRoles: flow.receiverRoles, signals, missing: missing.map((item) => item.label) });
  if (missing.length) {
    findings.push(finding({
      id: `flow-gap-${flow.id}`,
      confidence: "possible",
      severity: missing.length >= Math.ceil(signals.length / 2) ? "high" : "medium",
      scope: "flow",
      role: unique([flow.producerRole, ...(flow.receiverRoles || [])]).join(" -> "),
      page: "Cross-role flow contract",
      action: flow.name,
      title: "Cross-role flow support is incomplete in static evidence",
      expected: `Active source should expose all required signals for ${flow.name}.`,
      actual: `Missing static signals: ${missing.map((item) => item.label).join(", ")}.`,
      evidence: `${signals.length - missing.length}/${signals.length} contract signals were found across active source and database SQL references.`,
      nextStep: "Review producer record, admin queue, receiver update, notification, and evidence chain. Confirm with real records before changing SQL.",
    }));
  }
}

const featureDependencies = [];
for (const feature of contract.featureDependencies || []) {
  const present = (group) => (group || []).some((term) => activeText.includes(String(term).toLowerCase()));
  const support = {
    producer: present(feature.producerSignals),
    storage: present(feature.storageSignals),
    consumer: present(feature.consumerSignals),
  };
  const connected = support.producer && support.storage && support.consumer;
  featureDependencies.push({ id: feature.id, name: feature.name, ...support, connected });
  if (!connected && Object.values(support).some(Boolean)) {
    const missing = Object.entries(support).filter(([, value]) => !value).map(([key]) => key);
    findings.push(finding({
      id: `support-gap-${feature.id}`,
      confidence: "possible",
      severity: "high",
      scope: "flow",
      role: "cross-role",
      page: "Feature dependency graph",
      action: feature.name,
      title: "Feature exists but its support chain is incomplete",
      expected: "Producer, durable storage/identity, and consumer should all be connected.",
      actual: `Static evidence did not find: ${missing.join(", ")}.`,
      evidence: `producer=${support.producer}; storage=${support.storage}; consumer=${support.consumer}.`,
      nextStep: "Check whether the missing side is intentionally deferred. If not, add the supporting material and rerun the reader.",
    }));
  }
}

let gitCommit = null;
let gitBranch = null;
let dirtyFiles = [];
try {
  gitCommit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  gitBranch = execFileSync("git", ["branch", "--show-current"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  dirtyFiles = execFileSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => line.slice(3))
    .filter((file) => existsSync(join(root, file)))
    .filter((file) => !file.startsWith("docs/"));
} catch { /* Git metadata is optional. */ }

const manifest = [...activeFiles].sort().map((file) => ({ file: relativePath(file), sha256: sha256(readSafe(file)) }));
const snapshot = {
  schemaVersion: "2.2.0",
  generatedAt: new Date().toISOString(),
  sourceFingerprint: sha256(manifest.map((item) => `${item.file}:${item.sha256}`).join("\n")),
  git: { commit: gitCommit, branch: gitBranch, dirtyFiles },
  safety: {
    mode: "read-only-static-analysis",
    autoFix: false,
    sqlExecution: false,
    sensitiveActions: false,
    rules: contract.safetyRules || [],
  },
  databaseAuthority: {
    sourceOfTruth: "live-supabase-metadata",
    liveReader: "kafarm_database_health_snapshot",
    provenanceFile: relativePath(schemaProvenancePath),
    provenancePresent: existsSync(schemaProvenancePath),
    staticMigrationAbsenceMeans: "documentation-gap-not-missing-object",
    rules: [
      "Absence of CREATE TABLE in repository files is not proof that a live database object is missing.",
      "Only live database metadata may confirm a missing table, column, function, view, policy, or RLS configuration.",
      "Do not propose replacement CREATE TABLE SQL for core objects without a confirmed live-metadata finding and admin review.",
    ],
  },
  counts: {
    routes: routes.length,
    apiEndpoints: apiEndpoints.length,
    clientStorageKeys: clientStorageKeys.length,
    activeFiles: activeFiles.size,
    unreachableFiles: sourceFiles.length - activeFiles.size,
    actions: actions.length,
    backendReferences: backendReferences.length,
    findings: findings.length,
  },
  routes,
  apiEndpoints,
  actions,
  backendReferences,
  routeReferences,
  clientStorageKeys,
  contractCoverage,
  featureDependencies,
  findings: findings.sort((a, b) => {
    const confidence = { confirmed: 0, possible: 1, stale: 2 };
    const severity = { critical: 0, high: 1, medium: 2, low: 3 };
    return (confidence[a.confidence] - confidence[b.confidence]) || (severity[a.severity] - severity[b.severity]) || a.page.localeCompare(b.page);
  }),
  activeManifest: manifest,
  unreachableFiles: sourceFiles.filter((file) => !activeFiles.has(file)).map(relativePath).sort(),
};

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
console.log(`[KaFarm Reader V2.2] Snapshot written: ${relativePath(outputPath)}`);
console.log(`[KaFarm Reader V2.2] Routes=${snapshot.counts.routes}, APIs=${snapshot.counts.apiEndpoints}, storage keys=${snapshot.counts.clientStorageKeys}, actions=${snapshot.counts.actions}, findings=${snapshot.counts.findings}`);
console.log("[KaFarm Reader V2.2] Read-only static analysis only. Runtime/manual verification is still required.");
