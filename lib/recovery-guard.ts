import { supabase } from "@/lib/supabase";

export type RecoveryState =
  | "created" | "sending" | "received" | "processing" | "completed"
  | "failed_retryable" | "retrying" | "reconciling" | "failed_terminal"
  | "manual_review" | "dead_letter" | "resolved" | "cancelled";

export async function safeFingerprint(value: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

export async function beginRecoveryOperation(input: {
  operationId: string;
  correlationId: string;
  workflow: string;
  action: string;
  route?: string;
  targetType?: string;
  targetId?: string | null;
  fingerprint: string;
}) {
  const result = await supabase.rpc("kafarm_recovery_begin", {
    p_operation_id: input.operationId,
    p_correlation_id: input.correlationId,
    p_workflow: input.workflow,
    p_action: input.action,
    p_route: input.route || null,
    p_target_type: input.targetType || null,
    p_target_id: input.targetId || null,
    p_request_fingerprint: input.fingerprint,
  });
  if (result.error) throw result.error;
  return result.data as { status: RecoveryState; duplicate: boolean; result_reference?: string | null };
}

export async function markRecoverySending(operationId: string) {
  const result = await supabase.rpc("kafarm_recovery_mark_sending", { p_operation_id: operationId });
  if (result.error) throw result.error;
  return result.data as { status: RecoveryState; duplicate: boolean; result_reference?: string | null };
}

export async function reconcileRecoveryOperation(operationId: string) {
  const result = await supabase.rpc("kafarm_recovery_reconcile", { p_operation_id: operationId });
  if (result.error) throw result.error;
  return result.data as { state: RecoveryState; verified: boolean; result_reference?: string | null };
}

export async function retrySafeRead<T>(
  read: () => Promise<T>,
  options: { attempts?: number; delaysMs?: number[] } = {},
): Promise<T> {
  const attempts = Math.max(1, Math.min(3, options.attempts ?? 3));
  const delays = options.delaysMs ?? [250, 750];
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await read();
    } catch (error) {
      lastError = error;
      if (attempt + 1 < attempts) {
        await new Promise(resolve => setTimeout(resolve, delays[Math.min(attempt, delays.length - 1)] ?? 750));
      }
    }
  }
  throw lastError;
}
