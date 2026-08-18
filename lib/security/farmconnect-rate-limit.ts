import "server-only";

export const FARMCONNECT_RATE_LIMIT_ENV_KEY = "FARMCONNECT_RATE_LIMIT_MODE" as const;

export type FarmConnectRateLimitMode = "off" | "observe" | "enforce";

const supportedModes = new Set<FarmConnectRateLimitMode>(["off", "observe", "enforce"]);

export const farmConnectRateLimitPolicyRegistry = Object.freeze([
  { workflow: "authentication", authority: "Supabase Auth or edge enforcement required" },
  { workflow: "customer_payment", authority: "persistent server or database enforcement required" },
  { workflow: "customer_kyc", authority: "persistent server or database enforcement required" },
  { workflow: "care_plan", authority: "persistent server or database enforcement required" },
  { workflow: "withdrawal", authority: "persistent server or database enforcement required" },
  { workflow: "admin_decision", authority: "persistent server or database enforcement required" },
] as const);

export function getFarmConnectRateLimitReadiness(environment: NodeJS.ProcessEnv = process.env) {
  const configuredValue = environment[FARMCONNECT_RATE_LIMIT_ENV_KEY]?.trim().toLowerCase() || "off";
  const requestedMode = supportedModes.has(configuredValue as FarmConnectRateLimitMode)
    ? configuredValue as FarmConnectRateLimitMode
    : "off";

  return Object.freeze({
    requestedMode,
    effectiveMode: "off" as const,
    switchPrepared: true,
    validConfiguration: configuredValue === requestedMode,
    persistentBackendInstalled: false,
    businessRpcEnforcement: false,
    activationAuthority: "deployment_environment_only" as const,
    environmentKey: FARMCONNECT_RATE_LIMIT_ENV_KEY,
    status: "PREPARED_NOT_ENFORCING" as const,
    warning: requestedMode === "off"
      ? "Rate limiting is intentionally OFF. No FarmConnect business action is blocked by this switch."
      : "The requested mode is recorded, but remains OFF until persistent backend enforcement is installed and verified.",
    policies: farmConnectRateLimitPolicyRegistry,
  });
}
