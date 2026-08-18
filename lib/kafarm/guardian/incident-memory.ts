type IncidentLike = {
  id?: string;
  title?: string;
  category?: string;
  severity?: string;
  route?: string;
  message?: string;
  evidence?: string;
  status?: string;
  created_at?: string;
};

const stopWords = new Set(["the", "and", "for", "with", "from", "this", "that", "button", "request", "failed", "error", "farmconnect", "kafarm"]);

function terms(value: IncidentLike) {
  return new Set(`${value.title || ""} ${value.category || ""} ${value.route || ""} ${value.message || ""}`
    .toLowerCase()
    .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/g, " record_id ")
    .split(/[^a-z0-9_/-]+/)
    .filter((term) => term.length > 2 && !stopWords.has(term)));
}

function similarity(left: Set<string>, right: Set<string>) {
  const intersection = [...left].filter((item) => right.has(item)).length;
  const union = new Set([...left, ...right]).size;
  return union ? intersection / union : 0;
}

export function buildIncidentMemoryView(incidents: IncidentLike[], query: string) {
  const queryTerms = terms({ title: query });
  return incidents.map((incident) => {
    const incidentTerms = terms(incident);
    return {
      incident,
      semanticSignature: [...incidentTerms].sort().slice(0, 30),
      similarity: Number(similarity(queryTerms, incidentTerms).toFixed(3)),
      memoryRule: "Similar incident candidate only; revalidate against current code, deployment, database, and runtime evidence.",
    };
  }).sort((a, b) => b.similarity - a.similarity);
}
