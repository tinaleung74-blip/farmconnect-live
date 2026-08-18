import type { KaFarmActionProposal, KaFarmAutonomyLevel, KaFarmGateResult, KaFarmProofKey } from "./types";

const levelOrder: Record<KaFarmAutonomyLevel, number> = { green: 0, yellow: 1, orange: 2, red: 3 };

export function kaFarmAiActionsFrozen() {
  return String(process.env.KAFARM_AI_ACTIONS_FROZEN ?? "true").toLowerCase() !== "false";
}

export function requiredProofForLevel(level: KaFarmAutonomyLevel): KaFarmProofKey[] {
  if (level === "green") return ["static_check", "targeted_test"];
  if (level === "yellow") return ["static_check", "unit_or_contract", "browser_or_integration", "regression"];
  if (level === "orange") return ["build", "database_contract", "role_test", "invariant", "browser", "regression", "explicit_approval"];
  return ["independent_verification", "explicit_approval", "before_state", "after_state", "invariant", "rollback_plan", "audit_evidence"];
}

export function highestAutonomyLevel(levels: KaFarmAutonomyLevel[]) {
  return levels.reduce<KaFarmAutonomyLevel>((highest, item) => levelOrder[item] > levelOrder[highest] ? item : highest, "green");
}

export function evaluateKaFarmAction(proposal: KaFarmActionProposal, frozen = kaFarmAiActionsFrozen()): KaFarmGateResult {
  const reasons: string[] = [];
  let decision: KaFarmGateResult["decision"] = "PASS";
  const protectedAction = proposal.protectedZones.length > 0;

  if (!proposal.blueprintPass) reasons.push("Owner blueprint validation did not pass.");
  if (!proposal.invariantPass) reasons.push("Required FarmConnect invariant did not pass.");
  if (proposal.rootCauseConfidence !== "CONFIRMED") reasons.push("Root cause is not confirmed by sufficient evidence.");
  if (proposal.blastRadius === "unknown" || proposal.blastRadius === "high") reasons.push(`Blast radius is ${proposal.blastRadius}.`);
  if (proposal.destructive) reasons.push("The proposed action is destructive.");
  if (protectedAction) reasons.push(`Protected zone involved: ${proposal.protectedZones.join(", ")}.`);

  if (proposal.mutation && frozen) {
    decision = "BLOCK";
    reasons.unshift("AI ACTIONS FROZEN is enabled; mutation is forbidden.");
  } else if (proposal.destructive) {
    decision = "BLOCK";
  } else if (protectedAction || proposal.requestedLevel === "red" || proposal.requestedLevel === "orange") {
    decision = proposal.explicitApproval ? "HOLD" : "APPROVAL_REQUIRED";
    reasons.push(proposal.explicitApproval
      ? "Approval is recorded, but independent verification and an execution adapter are still required."
      : "Explicit Admin/owner approval and independent verification are required.");
  } else if (
    !proposal.blueprintPass ||
    !proposal.invariantPass ||
    proposal.rootCauseConfidence !== "CONFIRMED" ||
    !proposal.reversible ||
    !proposal.idempotent ||
    !proposal.testAvailable ||
    proposal.blastRadius !== "low"
  ) {
    decision = "HOLD";
  }

  const executionAllowed = decision === "PASS" && (!proposal.mutation || !frozen);
  if (!reasons.length) reasons.push("Confirmed, reversible, idempotent, low-blast-radius action with a test and no protected-zone impact.");

  return {
    decision,
    level: proposal.requestedLevel,
    aiActionsFrozen: frozen,
    reasons,
    requiredProof: requiredProofForLevel(proposal.requestedLevel),
    executionAllowed,
  };
}
