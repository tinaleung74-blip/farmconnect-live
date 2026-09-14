// Display only: entitlement and payment authorization remain in PostgreSQL.
const priority: Record<string, number> = {
  active: 0, paused: 1, paid_pending_setup: 2, ready: 3,
  payment_submitted: 4, payment_for_review: 5, draft: 6,
};

export function selectRoosterCarePlan<T extends { customer_animal_id: string; status: string }>(plans: T[], animalId: string): T | null {
  return plans.filter((plan) => plan.customer_animal_id === animalId && plan.status in priority)
    .reduce<T | null>((selected, plan) => !selected || priority[plan.status] < priority[selected.status] ? plan : selected, null);
}

export function careCoverageStatus(monthly: string, daily: string, day = 1, duration = 30, unavailable = false) {
  if (unavailable) return { badge: "Status unavailable", label: "Care status could not be refreshed. Please try again before paying." };
  if (monthly === "active") return { badge: "Monthly Active", label: `Day ${day} · ${duration}-day coverage` };
  if (monthly === "paused") return { badge: "Monthly Paused", label: "Your paid Monthly Care is paused. Contact support to resume." };
  if (["paid_pending_setup", "ready"].includes(monthly)) return { badge: "Monthly Paid", label: "Payment approved. Care setup is pending—do not pay again." };
  if (["assigned", "in_progress", "proof_submitted", "paid_pending_assignment"].includes(daily)) return { badge: daily === "paid_pending_assignment" ? "Daily Paid" : "Daily Active", label: daily === "paid_pending_assignment" ? "Payment approved. Care assignment is pending—do not pay again." : "Your Daily Care request is being handled." };
  if (["payment_for_review", "payment_submitted"].includes(monthly)) return { badge: "Monthly Review", label: "Your Monthly Care payment is being reviewed." };
  if (daily === "payment_for_review") return { badge: "Daily Review", label: "Your Daily Care payment is being reviewed." };
  if (monthly === "draft") return { badge: "Payment needed", label: "Monthly Care was prepared but is not paid yet." };
  return { badge: "No Active Care", label: "No active Daily or Monthly Care" };
}
