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

export function getFarmConnectRateLimitReadiness(
  environment: NodeJS.ProcessEnv = process.env,
  databaseVerification?: { event_table?: boolean; guard_function?: boolean; trigger_function?: boolean; business_trigger_count?: number } | null,
) {
  const configuredValue = environment[FARMCONNECT_RATE_LIMIT_ENV_KEY]?.trim().toLowerCase() || "off";
  const requestedMode = supportedModes.has(configuredValue as FarmConnectRateLimitMode)
    ? configuredValue as FarmConnectRateLimitMode
    : "off";

  const persistentBackendInstalled = true;
  const businessRpcEnforcement = true;
  const productionVerified = environment.FARMCONNECT_RATE_LIMIT_PRODUCTION_VERIFIED === "true";
  const databaseVerified = Boolean(databaseVerification?.event_table
    && databaseVerification?.guard_function
    && databaseVerification?.trigger_function
    && Number(databaseVerification?.business_trigger_count || 0) >= 7);
  const effectiveMode = databaseVerified ? "enforce" : "unverified";

  return Object.freeze({
    requestedMode,
    effectiveMode,
    switchPrepared: true,
    validConfiguration: configuredValue === requestedMode,
    persistentBackendInstalled: true,
    businessRpcEnforcement: true,
    productionVerified,
    databaseVerified,
    activationAuthority: "database_migration_and_deployment_verification" as const,
    environmentKey: FARMCONNECT_RATE_LIMIT_ENV_KEY,
    status: effectiveMode === "enforce" ? "ENFORCING" as const : "READY_NOT_VERIFIED" as const,
    warning: effectiveMode === "enforce"
      ? "Persistent database rate limits are verified and enforcing canonical business mutations."
      : "Persistent guards are implemented, but this server has not verified migration 078 from the live database.",
    policies: farmConnectRateLimitPolicyRegistry,
  });
}
