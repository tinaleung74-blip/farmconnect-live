import { findInvariantByFindingCode } from "./invariants";

type WorkflowFinding = {
  finding_code?: string;
  severity?: string;
  source_record_id?: string;
  message?: string;
  [key: string]: unknown;
};

const stepHints: Record<string, { lastGood: string; firstBroken: string; containment: string; recovery: string }> = {
  farm_buy_approved_without_result: {
    lastGood: "Farm Buy payment was approved.",
    firstBroken: "The required ownership/inventory posting is missing or unproven.",
    containment: "Do not re-approve the payment or create duplicate ownership.",
    recovery: "Reconcile the approved request against posting evidence, then resume only the missing exactly-once posting step through the official workflow.",
  },
  care_request_missing_assignment: {
    lastGood: "The Care Request reached an assignment-requiring state.",
    firstBroken: "The official linked Caretaker task is missing or unproven.",
    containment: "Keep the request visible for Admin review and do not fabricate a completed task.",
    recovery: "Confirm payment and request status, then perform one guarded Task Management assignment.",
  },
  submitted_task_without_proof: {
    lastGood: "The Caretaker task was submitted.",
    firstBroken: "Required proof was not linked to the submitted task.",
    containment: "Do not approve or release a Care Log without the required proof.",
    recovery: "Request the missing proof against the same task rather than creating a replacement workflow.",
  },
  approved_proof_chain_mismatch: {
    lastGood: "Admin approved the Caretaker proof.",
    firstBroken: "Task/Care Request/Care Log release is inconsistent after proof approval.",
    containment: "Do not approve the proof again and do not deduct inventory twice.",
    recovery: "Identify the first missing downstream status or Care Log/usage record and resume that idempotent release step.",
  },
  completed_sale_chain_mismatch: {
    lastGood: "The sale reached completed status.",
    firstBroken: "Ownership release or wallet ledger evidence is inconsistent.",
    containment: "Freeze automated sale recovery; do not manually credit wallet or transfer ownership.",
    recovery: "Admin must independently reconcile sale proof, ownership state, and the official ledger before any authorized correction.",
  },
  withdrawal_rejection_not_refunded: {
    lastGood: "The withdrawal was rejected after a wallet hold.",
    firstBroken: "The official refund ledger state is missing or unproven.",
    containment: "Do not manually add money and do not repeat the withdrawal review.",
    recovery: "Admin must reconcile hold/refund ledger entries and use the official idempotent refund workflow only after approval.",
  },
  approved_kyc_profile_mismatch: {
    lastGood: "The KYC record reached an approved state.",
    firstBroken: "The linked profile verification state does not match.",
    containment: "Do not repeat the KYC decision or expose private KYC evidence.",
    recovery: "Admin must verify the approved record and use the reviewed profile-sync path with independent evidence.",
  },
};

export function traceWorkflowFinding(finding: WorkflowFinding) {
  const code = String(finding.finding_code || "unknown_workflow_finding");
  const invariant = findInvariantByFindingCode(code);
  const hint = stepHints[code];
  return {
    findingCode: code,
    severity: String(finding.severity || invariant?.severity || "medium"),
    workflow: invariant?.workflow || "unknown",
    sourceRecordId: finding.source_record_id || null,
    expectedState: invariant?.expected || "The required downstream FarmConnect state exists and reconciles.",
    actualState: String(finding.message || "A workflow invariant did not match."),
    lastProvenGoodStep: hint?.lastGood || "The last successful step is not available in this snapshot.",
    firstBrokenOrUnprovenStep: hint?.firstBroken || "The first failing step needs workflow-event evidence.",
    rootCause: "Not established. This evidence confirms an invariant violation, not the underlying cause.",
    rootCauseConfidence: "UNKNOWN",
    blastRadius: "The linked workflow record and its downstream customer-visible result; related records must be checked before expanding scope.",
    containment: hint?.containment || "Preserve evidence and prevent blind workflow repetition.",
    safeRecovery: hint?.recovery || "Resume from the first verified incomplete official step after Admin review.",
    autoActionEligibility: invariant?.autoActionEligibility || "never",
    protectedZones: invariant?.protectedZones || [],
  };
}

export function traceWorkflowFindings(findings: WorkflowFinding[]) {
  return findings.map(traceWorkflowFinding);
}
