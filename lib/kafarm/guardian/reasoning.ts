import "server-only";

import blueprint from "@/config/kafarm/farmconnect-blueprint.v1.json";
import type { KaFarmAdminContext } from "./admin-auth";
import { kaFarmEvidenceToolDefinitions, runKaFarmEvidenceTool } from "./evidence-tools";
import { evaluateKaFarmAction, highestAutonomyLevel, kaFarmAiActionsFrozen } from "./logic-gate";
import type { KaFarmActionProposal, KaFarmAutonomyLevel, KaFarmEvidenceReference, KaFarmGuardianDiagnosis, KaFarmProofKey, KaFarmRootCauseConfidence } from "./types";

type JsonRecord = Record<string, unknown>;
type ResponsesOutputItem = {
  type?: string;
  name?: string;
  call_id?: string;
  arguments?: string;
  content?: Array<{ type?: string; text?: string }>;
  [key: string]: unknown;
};
type ResponsesApiResult = { output?: ResponsesOutputItem[]; output_text?: string; error?: { message?: string } };

const confidenceValues: KaFarmRootCauseConfidence[] = ["CONFIRMED", "HIGH_CONFIDENCE", "LIKELY", "UNKNOWN", "CONTRADICTORY"];
const proofKeys: KaFarmProofKey[] = ["build", "static_check", "unit_or_contract", "database_contract", "role_test", "invariant", "browser", "integration", "regression", "independent_verification", "explicit_approval", "before_state", "after_state", "rollback_plan", "audit_evidence", "targeted_test", "browser_or_integration"];

const diagnosisSchema = {
  type: "object",
  properties: {
    summary: { type: "string" },
    workflow: { type: "string" },
    symptom: { type: "string" },
    expectedState: { type: "string" },
    actualState: { type: "string" },
    lastProvenGoodStep: { type: "string" },
    firstBrokenOrUnprovenStep: { type: "string" },
    rootCause: { type: "string" },
    confidence: { type: "string", enum: confidenceValues },
    hypothesesTested: { type: "array", items: { type: "string" } },
    blastRadius: { type: "string" },
    containment: { type: "array", items: { type: "string" } },
    safeRecovery: { type: "array", items: { type: "string" } },
    technicalExplanation: { type: "string" },
    ownerExplanation: { type: "string" },
    proposedAction: {
      type: "object",
      properties: {
        id: { type: "string" },
        title: { type: "string" },
        description: { type: "string" },
        mutation: { type: "boolean" },
        reversible: { type: "boolean" },
        idempotent: { type: "boolean" },
        testAvailable: { type: "boolean" },
        blastRadius: { type: "string", enum: ["none", "low", "medium", "high", "unknown"] },
        rootCauseConfidence: { type: "string", enum: confidenceValues },
        protectedZones: { type: "array", items: { type: "string" } },
        destructive: { type: "boolean" },
        explicitApproval: { type: "boolean" },
        blueprintPass: { type: "boolean" },
        invariantPass: { type: "boolean" }
      },
      required: ["id", "title", "description", "mutation", "reversible", "idempotent", "testAvailable", "blastRadius", "rootCauseConfidence", "protectedZones", "destructive", "explicitApproval", "blueprintPass", "invariantPass"],
      additionalProperties: false
    },
    proofOfDone: {
      type: "array",
      items: {
        type: "object",
        properties: {
          key: { type: "string", enum: proofKeys },
          status: { type: "string", enum: ["PASS", "FAIL", "NOT_RUN", "NOT_AVAILABLE"] },
          detail: { type: "string" }
        },
        required: ["key", "status", "detail"],
        additionalProperties: false
      }
    },
    limitations: { type: "array", items: { type: "string" } }
  },
  required: ["summary", "workflow", "symptom", "expectedState", "actualState", "lastProvenGoodStep", "firstBrokenOrUnprovenStep", "rootCause", "confidence", "hypothesesTested", "blastRadius", "containment", "safeRecovery", "technicalExplanation", "ownerExplanation", "proposedAction", "proofOfDone", "limitations"],
  additionalProperties: false
} as const;

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function text(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 5000) : fallback;
}

function stringList(value: unknown, fallback: string[] = []) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").map((item) => item.trim().slice(0, 1000)).filter(Boolean).slice(0, 20) : fallback;
}

function bool(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function confidence(value: unknown): KaFarmRootCauseConfidence {
  return confidenceValues.includes(value as KaFarmRootCauseConfidence) ? value as KaFarmRootCauseConfidence : "UNKNOWN";
}

function extractOutputText(result: ResponsesApiResult) {
  if (typeof result.output_text === "string" && result.output_text.trim()) return result.output_text;
  for (const item of result.output || []) {
    if (item.type !== "message") continue;
    for (const content of item.content || []) {
      if (content.type === "output_text" && content.text) return content.text;
    }
  }
  return "";
}

function protectedZonesFromText(value: string) {
  const checks: Array<[RegExp, string]> = [
    [/wallet|ledger|credit|balance/i, "wallet_balance"],
    [/withdraw/i, "withdrawal"],
    [/payout/i, "payout_release"],
    [/payment.*approv|approv.*payment/i, "payment_approval"],
    [/ownership|owner/i, "rooster_ownership"],
    [/kyc/i, "kyc_decision"],
    [/identity|profile role|account role/i, "account_role"],
    [/pin|password|security/i, "pin_password_security"],
    [/fraud/i, "fraud_marking"],
    [/delete|destructive|truncate/i, "destructive_data"],
    [/rls|policy/i, "rls_policy"],
    [/schema|migration|alter table/i, "production_schema"],
    [/arbitrary sql|raw sql/i, "arbitrary_sql"],
  ];
  return checks.filter(([pattern]) => pattern.test(value)).map(([, zone]) => zone);
}

function classifyLevel(proposal: Omit<KaFarmActionProposal, "requestedLevel">): KaFarmAutonomyLevel {
  if (proposal.protectedZones.length || proposal.destructive) return "red";
  if (/database|schema|migration|business rule|rpc|rls/i.test(`${proposal.title} ${proposal.description}`)) return "orange";
  if (proposal.mutation) return "yellow";
  return "green";
}

function evidenceSupportsConfirmed(evidence: KaFarmEvidenceReference[]) {
  const sources = new Set(evidence.map((item) => item.source));
  const runtime = evidence.some((item) => ["incident", "workflow_event", "database_metadata"].includes(item.source));
  const currentTestPass = evidence.some((item) => item.source === "test_result" && /\bpass(?:ed)?\b/i.test(item.detail) && !/not[_ ]run|not available/i.test(item.detail));
  return (runtime || currentTestPass) && sources.size >= 2;
}

function normalizeDiagnosis(raw: unknown, evidence: KaFarmEvidenceReference[], mode: KaFarmGuardianDiagnosis["mode"]): KaFarmGuardianDiagnosis {
  const item = asRecord(raw);
  const rawProposal = asRecord(item.proposedAction);
  let rootConfidence = confidence(item.confidence);
  if (rootConfidence === "CONFIRMED" && !evidenceSupportsConfirmed(evidence)) rootConfidence = "LIKELY";

  const inferredZones = protectedZonesFromText(`${text(item.workflow, "")} ${text(item.rootCause, "")} ${text(rawProposal.title, "")} ${text(rawProposal.description, "")}`);
  const allowedZones = new Set(blueprint.protectedZones);
  const proposedZones = [...new Set([...stringList(rawProposal.protectedZones), ...inferredZones])].filter((zone) => allowedZones.has(zone));
  const proposalWithoutLevel: Omit<KaFarmActionProposal, "requestedLevel"> = {
    id: text(rawProposal.id, "kafarm-proposal"),
    title: text(rawProposal.title, "Continue read-only investigation"),
    description: text(rawProposal.description, "Collect sufficient evidence before proposing a change."),
    mutation: bool(rawProposal.mutation),
    reversible: bool(rawProposal.reversible),
    idempotent: bool(rawProposal.idempotent),
    testAvailable: bool(rawProposal.testAvailable),
    blastRadius: ["none", "low", "medium", "high", "unknown"].includes(String(rawProposal.blastRadius)) ? rawProposal.blastRadius as KaFarmActionProposal["blastRadius"] : "unknown",
    rootCauseConfidence: rootConfidence,
    protectedZones: proposedZones,
    destructive: bool(rawProposal.destructive) || /delete|truncate|drop table/i.test(text(rawProposal.description, "")),
    explicitApproval: false,
    blueprintPass: bool(rawProposal.blueprintPass),
    invariantPass: bool(rawProposal.invariantPass),
  };
  const proposedAction: KaFarmActionProposal = { ...proposalWithoutLevel, requestedLevel: classifyLevel(proposalWithoutLevel) };
  const rawProof = Array.isArray(item.proofOfDone) ? item.proofOfDone.map(asRecord) : [];
  const proofOfDone: KaFarmGuardianDiagnosis["proofOfDone"] = rawProof.slice(0, 20).map((entry) => ({
    key: proofKeys.includes(entry.key as KaFarmProofKey) ? entry.key as KaFarmProofKey : "targeted_test",
    status: ["PASS", "FAIL", "NOT_RUN", "NOT_AVAILABLE"].includes(String(entry.status)) ? entry.status as "PASS" | "FAIL" | "NOT_RUN" | "NOT_AVAILABLE" : "NOT_RUN",
    detail: text(entry.detail, "No current-release evidence supplied."),
  })).map((entry) => entry.status === "PASS" && !evidence.some((reference) => reference.source === "test_result" && /\bpass(ed)?\b/i.test(reference.detail))
    ? { ...entry, status: "NOT_RUN" as const, detail: `${entry.detail} No matching current-release PASS artifact was supplied to KaFarm.` }
    : entry);

  const gate = evaluateKaFarmAction(proposedAction);
  return {
    mode,
    summary: text(item.summary, "KaFarm could not establish a complete diagnosis."),
    workflow: text(item.workflow, "unknown"),
    symptom: text(item.symptom, "No precise symptom supplied."),
    expectedState: text(item.expectedState, "Expected state is not yet proven."),
    actualState: text(item.actualState, "Actual state is not yet proven."),
    lastProvenGoodStep: text(item.lastProvenGoodStep, "Unknown"),
    firstBrokenOrUnprovenStep: text(item.firstBrokenOrUnprovenStep, "Unknown"),
    rootCause: text(item.rootCause, "Root cause is not yet proven."),
    confidence: rootConfidence,
    hypothesesTested: stringList(item.hypothesesTested, ["No hypothesis was proven."]),
    blastRadius: text(item.blastRadius, "Unknown until evidence identifies affected records and roles."),
    containment: stringList(item.containment, ["Keep sensitive actions on hold and preserve current evidence."]),
    safeRecovery: stringList(item.safeRecovery, ["Resume only from the first verified incomplete workflow step."]),
    technicalExplanation: text(item.technicalExplanation, "Insufficient technical evidence."),
    ownerExplanation: text(item.ownerExplanation, "Hindi pa sapat ang ebidensya para sabihing alam na ang totoong dahilan."),
    evidence,
    proposedAction,
    gate,
    proofOfDone,
    limitations: [...new Set([
      ...stringList(item.limitations),
      "KaFarm Guardian exposes read-only evidence tools only; it has no production mutation tool.",
      `AI ACTIONS FROZEN is ${kaFarmAiActionsFrozen() ? "enabled" : "disabled"}.`,
    ])],
  };
}

async function deterministicFallback(question: string, context: KaFarmAdminContext, reason: string): Promise<KaFarmGuardianDiagnosis> {
  const route = question.match(/\/[a-z0-9_?=&/-]+/i)?.[0]?.split("?")[0] || "";
  const query = route || question.slice(0, 120);
  const toolResults = await Promise.all([
    runKaFarmEvidenceTool(route ? "route_lookup" : "system_map_lookup", { query }, context),
    runKaFarmEvidenceTool("workflow_event_read", { query }, context),
    runKaFarmEvidenceTool("incident_read", { query }, context),
    runKaFarmEvidenceTool("blueprint_lookup", { query }, context),
  ]);
  const evidence = toolResults.flatMap((item) => item.references);
  const failures = toolResults.filter((item) => !item.ok).map((item) => `${item.tool}: ${item.error || "unavailable"}`);
  const runtimeEvidence = toolResults.find((item) => item.tool === "incident_read")?.data;
  const workflowEvidence = toolResults.find((item) => item.tool === "workflow_event_read")?.data;
  const hasEvidence = evidence.length > 0;
  return normalizeDiagnosis({
    summary: "Deterministic evidence collection completed; real LLM reasoning was unavailable.",
    workflow: route || "FarmConnect investigation",
    symptom: question,
    expectedState: "The requested FarmConnect workflow matches the versioned owner blueprint and all required downstream records exist.",
    actualState: hasEvidence ? `Read-only evidence was collected from ${evidence.length} source reference(s).` : "No authoritative evidence was available.",
    lastProvenGoodStep: "Not established by the deterministic fallback.",
    firstBrokenOrUnprovenStep: "The first step without direct workflow or runtime proof.",
    rootCause: "Unknown. Evidence collection alone is not root-cause proof.",
    confidence: "UNKNOWN",
    hypothesesTested: [
      `Route/system-map evidence: ${JSON.stringify(toolResults[0]?.data || null).slice(0, 300)}`,
      `Workflow evidence available: ${Boolean(workflowEvidence)}`,
      `Runtime incident evidence available: ${Boolean(runtimeEvidence)}`,
    ],
    blastRadius: "Unknown until the affected workflow records and user-visible result are correlated.",
    containment: ["Do not repeat sensitive production transactions.", "Preserve the current request, proof, incident, and workflow IDs."],
    safeRecovery: ["Confirm the last proven-good step.", "Resume from the first incomplete official step only after the logic gate allows it."],
    technicalExplanation: `OpenAI reasoning did not run: ${reason}. KaFarm returned deterministic read-only evidence without claiming a root cause.`,
    ownerExplanation: "Nabasa ni KaFarm ang ligtas na ebidensya, pero hindi niya iimbentuhin ang dahilan. Kailangan pa ng sapat na proof bago mag-fix.",
    proposedAction: {
      id: "continue-read-only-investigation",
      title: "Continue read-only evidence correlation",
      description: "Correlate the exact route, workflow record, incident, database metadata, and current-release test result.",
      mutation: false,
      reversible: true,
      idempotent: true,
      testAvailable: true,
      blastRadius: "low",
      rootCauseConfidence: "UNKNOWN",
      protectedZones: protectedZonesFromText(question),
      destructive: false,
      explicitApproval: false,
      blueprintPass: true,
      invariantPass: false,
    },
    proofOfDone: [{ key: "targeted_test", status: "NOT_RUN", detail: "No current-release targeted test result was supplied." }],
    limitations: [reason, ...failures],
  }, evidence, "deterministic_fallback");
}

export async function diagnoseWithKaFarmGuardian(question: string, context: KaFarmAdminContext): Promise<KaFarmGuardianDiagnosis> {
  const apiKey = (process.env.OPENAI_API_KEY || "").trim();
  if (!apiKey) return deterministicFallback(question, context, "OPENAI_API_KEY is not configured on the server");

  const model = (process.env.KAFARM_OPENAI_MODEL || "gpt-5.4").trim();
  const evidence: KaFarmEvidenceReference[] = [];
  const input: unknown[] = [{
    role: "user",
    content: [{ type: "input_text", text: `Investigate this FarmConnect-only request:\n${question}\n\nUse evidence tools before reaching a conclusion. Do not infer completion from code or test existence. Never request or propose direct money, ownership, KYC, identity, role, credential, RLS, production-schema, destructive, or arbitrary-SQL mutation.` }],
  }];

  try {
    for (let iteration = 0; iteration < 5; iteration += 1) {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          store: false,
          instructions: "You are KaFarm Guardian for FarmConnect only. Use only supplied FarmConnect evidence. A symptom or regex category is not a root cause. CONFIRMED requires sufficient direct evidence. Distinguish test existence from a current-release test pass. Return technical truth and a clear, non-patronizing Taglish owner explanation. You may recommend a minimum change, but you have no execution authority and must respect the deterministic gate.",
          input,
          tools: kaFarmEvidenceToolDefinitions,
          tool_choice: iteration === 0 ? "required" : "auto",
          parallel_tool_calls: false,
          text: { format: { type: "json_schema", name: "kafarm_guardian_diagnosis", strict: true, schema: diagnosisSchema } },
        }),
        signal: AbortSignal.timeout(45000),
      });
      const result = await response.json() as ResponsesApiResult;
      if (!response.ok) throw new Error(result.error?.message || `OPENAI_HTTP_${response.status}`);
      const output = result.output || [];
      const calls = output.filter((item) => item.type === "function_call" && item.name && item.call_id);
      if (calls.length) {
        input.push(...output);
        for (const call of calls) {
          let args: unknown = {};
          try { args = JSON.parse(call.arguments || "{}"); } catch { args = {}; }
          const toolResult = await runKaFarmEvidenceTool(String(call.name), args, context);
          evidence.push(...toolResult.references);
          input.push({ type: "function_call_output", call_id: call.call_id, output: JSON.stringify({ ok: toolResult.ok, data: toolResult.data, references: toolResult.references, error: toolResult.error || null }) });
        }
        continue;
      }

      const outputText = extractOutputText(result);
      if (!outputText) throw new Error("OPENAI_EMPTY_STRUCTURED_OUTPUT");
      return normalizeDiagnosis(JSON.parse(outputText), evidence, "openai_evidence_reasoning");
    }
    return deterministicFallback(question, context, "OpenAI tool-call limit reached before a final diagnosis");
  } catch (error) {
    return deterministicFallback(question, context, error instanceof Error ? error.message : "Unknown OpenAI reasoning error");
  }
}

export function getKaFarmGuardianCapabilities() {
  return {
    application: "FarmConnect",
    guardianVersion: "foundation-1.0.0",
    blueprint: { id: blueprint.blueprintId, version: blueprint.schemaVersion, updatedAt: blueprint.updatedAt },
    ai: {
      configured: Boolean((process.env.OPENAI_API_KEY || "").trim()),
      model: (process.env.KAFARM_OPENAI_MODEL || "gpt-5.4").trim(),
      serverOnly: true,
      unrestrictedDatabaseMutation: false,
    },
    killSwitch: { aiActionsFrozen: kaFarmAiActionsFrozen(), safeDefault: true },
    evidenceTools: kaFarmEvidenceToolDefinitions.map((item) => item.name),
    autonomyLevels: ["green", "yellow", "orange", "red"],
    highestProtectedLevel: highestAutonomyLevel(["red"]),
    executionAdapters: { available: false, reason: "This foundation intentionally exposes no mutation or repair adapter." },
  };
}
