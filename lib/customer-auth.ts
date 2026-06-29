import { supabase } from "@/lib/supabase";

export type CustomerProfile = {
  id: string;
  email: string | null;
  full_name: string | null;
  phone?: string | null;
  wallet_balance?: number | string | null;
  verification_status?: string | null;
  membership_status?: string | null;
  membership_expiry?: string | null;
  account_status?: string | null;
};

export type Animal = {
  id: string;
  code: string | null;
  name: string | null;
  type: string | null;
  breed?: string | null;
  current_weight?: number | string | null;
  target_weight?: number | string | null;
  health_status?: string | null;
  image_url?: string | null;
  created_at?: string | null;
  flock_id?: string | null;
  profile_id?: string | null;
};

export type AnimalRelation = Animal | Animal[] | null;

export async function resolveCustomerProfile(): Promise<CustomerProfile | null> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return null;

  const user = authData.user;
  const email = user.email || "";

  const { data: profileById } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (profileById) return profileById as CustomerProfile;

  const { data: profileByEmail } = await supabase
    .from("profiles")
    .select("*")
    .eq("email", email)
    .maybeSingle();

  return (profileByEmail as CustomerProfile) || null;
}

export function isActiveCustomer(profile: CustomerProfile | null) {
  if (!profile) return false;
  return (
    String(profile.membership_status || "").toUpperCase() === "ACTIVE" &&
    String(profile.verification_status || "").toUpperCase() === "APPROVED" &&
    String(profile.account_status || "").toUpperCase() === "ACTIVE"
  );
}

export function normalizeAnimal(value: AnimalRelation): Animal | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export function isChicken(animal: Animal | null | undefined) {
  const type = String(animal?.type || "").toLowerCase();
  const code = String(animal?.code || "").toUpperCase();
  if (["SWINE-002", "COW-001", "COW-002"].includes(code)) return false;
  return type.includes("chicken") || type.includes("poultry") || type.includes("rooster") || type.includes("tandang");
}

export function money(value: number | string | null | undefined) {
  return Number(value || 0).toLocaleString("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  });
}

export function peso(value: number | string | null | undefined) {
  return Number(value || 0).toLocaleString("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function dateText(value?: string | null) {
  if (!value) return "No date";
  return new Date(value).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function dateTimeText(value?: string | null) {
  if (!value) return "No date";
  return new Date(value).toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function statusText(value?: string | null) {
  return String(value || "PENDING").replaceAll("_", " ").toUpperCase();
}

export function statusPill(status?: string | null) {
  const clean = String(status || "PENDING").toUpperCase();
  if (["ACTIVE", "APPROVED", "COMPLETED", "PAID", "POSTED", "AVAILABLE"].includes(clean)) {
    return "bg-emerald-100 text-emerald-800 border-emerald-200";
  }
  if (["REJECTED", "FAILED", "CANCELLED", "EXPIRED", "OUT_OF_STOCK", "OUT OF STOCK"].includes(clean)) {
    return "bg-red-100 text-red-800 border-red-200";
  }
  if (["PROCESSING", "PENDING", "PENDING_ADMIN_APPROVAL", "PENDING APPROVAL"].includes(clean)) {
    return "bg-amber-100 text-amber-800 border-amber-200";
  }
  return "bg-slate-100 text-slate-700 border-slate-200";
}

export function daysOld(value?: string | null) {
  if (!value) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86400000));
}

export function roosterStage(days: number) {
  if (days < 15) return "Starter";
  if (days < 30) return "Growing";
  if (days < 45) return "Young Tandang";
  return "Mature Tandang";
}

export function categoryIcon(category?: string | null) {
  const value = String(category || "").toUpperCase();
  if (value.includes("FEED")) return "🌾";
  if (value.includes("VITAMIN")) return "💊";
  if (value.includes("VACCINE")) return "💉";
  if (value.includes("SUPPLEMENT")) return "🧪";
  if (value.includes("EQUIPMENT")) return "🧰";
  if (value.includes("CHICK")) return "🐓";
  return "📦";
}

export const shellClass =
  "min-h-screen bg-[radial-gradient(circle_at_top_left,#34623f_0,#12281c_35%,#06130d_100%)] text-slate-950";

export const farmBgClass =
  "bg-[radial-gradient(circle_at_10%_0%,rgba(250,204,21,.22),transparent_28%),radial-gradient(circle_at_90%_15%,rgba(16,185,129,.20),transparent_30%),linear-gradient(135deg,#0a1d13_0%,#12351f_48%,#050d09_100%)]";

export const glassCardClass =
  "rounded-[36px] border border-white/15 bg-white/10 shadow-2xl shadow-black/20 backdrop-blur-xl";

export const panelClass =
  "rounded-[32px] border border-white/10 bg-white/95 shadow-2xl shadow-black/20";

export const darkPanelClass =
  "rounded-[32px] border border-emerald-300/20 bg-[#0c2318]/90 text-white shadow-2xl shadow-black/30";

export const primaryButtonClass =
  "rounded-2xl bg-emerald-700 px-5 py-4 text-center font-black text-white shadow-lg shadow-emerald-900/20 transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500";

export const goldButtonClass =
  "rounded-2xl bg-amber-300 px-5 py-4 text-center font-black text-emerald-950 shadow-lg shadow-amber-900/10 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500";
