import type { SupabaseClient, User } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabase";

export type CustomerSignupProfileInput = {
  email: string;
  phone: string;
  fullName: string;
  displayName?: string | null;
  birthdate: string;
};

export function isFreshSupabaseSignup(user: User | null) {
  return Boolean(user && (!Array.isArray(user.identities) || user.identities.length > 0));
}

function isMissingEnsureProfileRpc(error: { code?: string; message?: string; details?: string }) {
  const message = `${error.code || ""} ${error.message || ""} ${error.details || ""}`.toLowerCase();
  return message.includes("pgrst202")
    || (message.includes("customer_ensure_signup_profile") && message.includes("schema cache"));
}

function isDuplicateProfileError(error: { code?: string; message?: string }) {
  return error.code === "23505" || String(error.message || "").toLowerCase().includes("duplicate");
}

export async function ensureCustomerSignupProfile(
  userId: string,
  input: CustomerSignupProfileInput,
  client: SupabaseClient = supabase,
) {
  const { data, error } = await client.rpc("customer_ensure_signup_profile");
  if (!error) {
    if (!data) throw new Error("Customer profile creation did not return a profile identifier.");
    return String(data);
  }

  // Backward-compatible bridge while migration 055 is being deployed. Once the
  // SECURITY DEFINER RPC is live, normal signups never depend on this RLS path.
  if (!isMissingEnsureProfileRpc(error)) throw error;

  const { error: insertError } = await client.from("profiles").insert({
    auth_user_id: userId,
    email: input.email,
    phone: input.phone,
    full_name: input.fullName,
    display_name: input.displayName || input.fullName,
    birthdate: input.birthdate,
    role: "customer",
    account_status: "active",
    verification_status: "pending",
    membership_status: "inactive",
  });
  if (insertError && !isDuplicateProfileError(insertError)) throw insertError;
  return userId;
}
