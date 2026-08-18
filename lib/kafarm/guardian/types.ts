export type KaFarmAutonomyLevel = "green" | "yellow" | "orange" | "red";
export type KaFarmGateDecision = "PASS" | "HOLD" | "APPROVAL_REQUIRED" | "BLOCK";
export type KaFarmRootCauseConfidence = "CONFIRMED" | "HIGH_CONFIDENCE" | "LIKELY" | "UNKNOWN" | "CONTRADICTORY";
export type KaFarmProofKey = "build" | "static_check" | "unit_or_contract" | "database_contract" | "role_test" | "invariant" | "browser" | "integration" | "regression" | "independent_verification" | "explicit_approval" | "before_state" | "after_state" | "rollback_plan" | "audit_evidence" | "targeted_test" | "browser_or_integration";

export type KaFarmEvidenceReference = {
  source: "system_map" | "source_inventory" | "database_metadata" | "workflow_event" | "incident" | "test_result" | "git_history" | "owner_blueprint";
  title: string;
  detail: string;
  locator: string;
  capturedAt?: string | null;
};

export type KaFarmActionProposal = {
  id: string;
  title: string;
  description: string;
  requestedLevel: KaFarmAutonomyLevel;
  mutation: boolean;
  reversible: boolean;
  idempotent: boolean;
  testAvailable: boolean;
  blastRadius: "none" | "low" | "medium" | "high" | "unknown";
  rootCauseConfidence: KaFarmRootCauseConfidence;
  protectedZones: string[];
  destructive: boolean;
  explicitApproval: boolean;
  blueprintPass: boolean;
  invariantPass: boolean;
};

export type KaFarmGateResult = {
  decision: KaFarmGateDecision;
  level: KaFarmAutonomyLevel;
  aiActionsFrozen: boolean;
  reasons: string[];
  requiredProof: KaFarmProofKey[];
  executionAllowed: boolean;
};

export type KaFarmGuardianDiagnosis = {
  mode: "openai_evidence_reasoning" | "deterministic_fallback";
  summary: string;
  workflow: string;
  symptom: string;
  expectedState: string;
  actualState: string;
  lastProvenGoodStep: string;
  firstBrokenOrUnprovenStep: string;
  rootCause: string;
  confidence: KaFarmRootCauseConfidence;
  hypothesesTested: string[];
  blastRadius: string;
  containment: string[];
  safeRecovery: string[];
  technicalExplanation: string;
  ownerExplanation: string;
  evidence: KaFarmEvidenceReference[];
  proposedAction: KaFarmActionProposal;
  gate: KaFarmGateResult;
  proofOfDone: Array<{ key: KaFarmProofKey; status: "PASS" | "FAIL" | "NOT_RUN" | "NOT_AVAILABLE"; detail: string }>;
  limitations: string[];
};

export type KaFarmInvariantDefinition = {
  id: string;
  workflow: string;
  severity: "critical" | "high" | "medium" | "low";
  findingCodes: string[];
  expected: string;
  evidenceSource: string;
  remediationCategory: string;
  autoActionEligibility: "never" | "read_only_only" | "green_only";
  protectedZones: string[];
};
