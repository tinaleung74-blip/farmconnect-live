import type { KaFarmInvariantDefinition } from "./types";

export const kaFarmInvariantRegistry: KaFarmInvariantDefinition[] = [
  {
    id: "FC-FARMBUY-001",
    workflow: "farm_buy",
    severity: "high",
    findingCodes: ["farm_buy_approved_without_result"],
    expected: "Approved Farm Buy has exactly-once inventory, rooster ownership, or posting evidence linked to the approved request.",
    evidenceSource: "kafarm_workflow_chain_snapshot",
    remediationCategory: "resume_from_first_missing_downstream_record",
    autoActionEligibility: "read_only_only",
    protectedZones: ["payment_approval", "rooster_ownership"],
  },
  {
    id: "FC-CARE-001",
    workflow: "care_request",
    severity: "high",
    findingCodes: ["care_request_missing_assignment", "paid_care_waiting_too_long"],
    expected: "An approved paid care request has one linked assigned task and a known next workflow step.",
    evidenceSource: "kafarm_workflow_chain_snapshot",
    remediationCategory: "task_assignment_reconciliation",
    autoActionEligibility: "read_only_only",
    protectedZones: [],
  },
  {
    id: "FC-PROOF-001",
    workflow: "caretaker_proof",
    severity: "high",
    findingCodes: ["submitted_task_without_proof", "approved_proof_chain_mismatch"],
    expected: "Approved caretaker proof releases the linked task and Care Log and records verified inventory use exactly once.",
    evidenceSource: "kafarm_workflow_chain_snapshot and care-plan health snapshot",
    remediationCategory: "proof_care_log_inventory_reconciliation",
    autoActionEligibility: "read_only_only",
    protectedZones: [],
  },
  {
    id: "FC-SALE-001",
    workflow: "rooster_sale",
    severity: "high",
    findingCodes: ["sale_price_ready_without_evidence", "completed_sale_chain_mismatch"],
    expected: "A completed sale has approved price evidence, sold ownership state, and one linked wallet ledger entry.",
    evidenceSource: "kafarm_workflow_chain_snapshot",
    remediationCategory: "sale_ownership_wallet_reconciliation",
    autoActionEligibility: "never",
    protectedZones: ["rooster_ownership", "wallet_balance"],
  },
  {
    id: "FC-WITHDRAW-001",
    workflow: "withdrawal",
    severity: "high",
    findingCodes: ["withdrawal_approved_without_proof", "withdrawal_rejection_not_refunded", "completed_withdrawal_not_confirmed"],
    expected: "A completed withdrawal reconciles payout proof, hold/refund state, customer confirmation, ledger, and Inbox evidence.",
    evidenceSource: "kafarm_workflow_chain_snapshot",
    remediationCategory: "withdrawal_ledger_payout_inbox_reconciliation",
    autoActionEligibility: "never",
    protectedZones: ["withdrawal", "payout_release", "wallet_balance"],
  },
  {
    id: "FC-KYC-001",
    workflow: "customer_kyc",
    severity: "high",
    findingCodes: ["approved_kyc_profile_mismatch"],
    expected: "Approved KYC and the customer profile verification state agree without exposing private KYC evidence.",
    evidenceSource: "kafarm_workflow_chain_snapshot and KYC health metadata",
    remediationCategory: "kyc_profile_state_reconciliation",
    autoActionEligibility: "never",
    protectedZones: ["kyc_decision", "identity"],
  },
];

export function findInvariantByFindingCode(code: string) {
  return kaFarmInvariantRegistry.find((item) => item.findingCodes.includes(code)) ?? null;
}

export function findInvariantsForWorkflow(workflow: string) {
  const normalized = workflow.trim().toLowerCase();
  return kaFarmInvariantRegistry.filter((item) => item.workflow.includes(normalized) || normalized.includes(item.workflow));
}
