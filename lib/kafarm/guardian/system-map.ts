import systemMap from "./system-map.generated.json";

type MapNode = {
  id: string;
  type: string;
  name: string;
  file?: string;
  line?: number;
  role?: string;
  route?: string;
  methods?: string[];
  wiring?: string;
  handler?: string | null;
};

type MapEdge = {
  from: string;
  to: string;
  relation: string;
  confidence: "confirmed" | "possible";
  evidence: string;
};

export type KaFarmGuardianSystemMap = typeof systemMap;

const nodes = systemMap.nodes as MapNode[];
const edges = systemMap.edges as MapEdge[];

export function getKaFarmSystemMapStatus() {
  const ageMs = Date.now() - Date.parse(systemMap.generatedAt);
  const sourceAgeMs = Date.now() - Date.parse(systemMap.sourceSnapshot.generatedAt);
  const currentCommit = process.env.VERCEL_GIT_COMMIT_SHA || process.env.NEXT_PUBLIC_GIT_COMMIT_SHA || null;
  return {
    schemaVersion: systemMap.schemaVersion,
    generatedAt: systemMap.generatedAt,
    fingerprint: systemMap.fingerprint,
    git: systemMap.git,
    counts: systemMap.counts,
    ageMinutes: Number.isFinite(ageMs) ? Math.max(0, Math.round(ageMs / 60000)) : null,
    sourceAgeMinutes: Number.isFinite(sourceAgeMs) ? Math.max(0, Math.round(sourceAgeMs / 60000)) : null,
    commitMatchesDeployment: currentCommit ? currentCommit === systemMap.git.commit : null,
    limitations: systemMap.limitations,
  };
}

export function lookupSystemMap(query: string, limit = 20) {
  const terms = query.toLowerCase().split(/[^a-z0-9_/-]+/).filter((item) => item.length > 1);
  const ranked = nodes.map((node) => {
    const haystack = `${node.id} ${node.type} ${node.name} ${node.file || ""} ${node.role || ""} ${node.route || ""}`.toLowerCase();
    return { node, score: terms.reduce((score, term) => score + (haystack.includes(term) ? 1 : 0), 0) };
  }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score).slice(0, Math.min(Math.max(limit, 1), 50));
  const ids = new Set(ranked.map((item) => item.node.id));
  return {
    query,
    nodes: ranked.map((item) => item.node),
    edges: edges.filter((edge) => ids.has(edge.from) || ids.has(edge.to)).slice(0, 80),
    mapFingerprint: systemMap.fingerprint,
  };
}

export function lookupRoute(route: string) {
  const normalized = route.trim().split("?")[0] || "/";
  const matched = nodes.filter((node) => node.name === normalized || node.route === normalized);
  const ids = new Set(matched.map((node) => node.id));
  const relatedEdges = edges.filter((edge) => ids.has(edge.from) || ids.has(edge.to));
  const relatedIds = new Set(relatedEdges.flatMap((edge) => [edge.from, edge.to]));
  return {
    route: normalized,
    nodes: nodes.filter((node) => ids.has(node.id) || relatedIds.has(node.id)).slice(0, 80),
    edges: relatedEdges.slice(0, 120),
    found: matched.length > 0,
    mapFingerprint: systemMap.fingerprint,
  };
}

export function lookupSourceReference(query: string) {
  const result = lookupSystemMap(query, 30);
  return {
    query,
    references: result.nodes.map((node) => ({
      type: node.type,
      name: node.name,
      file: node.file || null,
      line: node.line || null,
      route: node.route || null,
      wiring: node.wiring || null,
      handler: node.handler || null,
    })),
    rule: "This tool returns build-time source references only. It does not expose arbitrary runtime filesystem reads.",
    mapFingerprint: systemMap.fingerprint,
  };
}

export function getTestCatalog() {
  return systemMap.tests;
}
