import { supabase } from "@/lib/supabase";

import type { SupabaseClient } from "@supabase/supabase-js";

export type AppRole = "customer" | "caretaker" | "admin";

export async function getCurrentProfile() {
  // Prefer the locally cached session so a brief auth endpoint outage does not
  // block an otherwise valid, RLS-protected customer action.
  const { data: sessionData } = await supabase.auth.getSession();
  let user = sessionData.session?.user || null;

  if (!user) {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) return null;
    user = authData.user;
  }

  const { data, error } = await supabase.from("profiles").select("*").eq("auth_user_id", user.id).maybeSingle();

  if (error) throw error;
  return data;
}

export async function getCurrentCaretakerProfile() {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const { data, error } = await supabase.from("caretakers").select("id,profile_id,full_name,display_name,email,phone,farm_role,status,avatar_url,resume_url,resume_review_status").eq("profile_id", profile.id).maybeSingle();

  if (error) throw error;
  return data ? { ...data, profile } : { profile };
}

export async function getFarmProducts() {
  const { data, error } = await supabase.from("farm_products").select("id,name,category,unit_label,unit_price,image_url,description,stock_quantity,status,product_type,stage,bloodline,breed,product_metadata").eq("status", "available").order("category", { ascending: true }).order("name", { ascending: true });

  if (error) throw error;
  return data || [];
}

export type FarmCartContext = {
  farmRequestId?: string | null;
  caretakerTaskId?: string | null;
  animalId?: string | null;
  purposeNote?: string | null;
  productType?: string | null;
  bloodline?: string | null;
  breed?: string | null;
  productName?: string | null;
};

export async function saveCartItem(productId: string, quantity: number, unitPrice: number, context?: FarmCartContext) {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error("login_required");

  const payload = {
    profile_id: profile.id,
    product_id: productId,
    quantity,
    unit_price: unitPrice,
    status: "active",
    farm_request_id: context?.farmRequestId || null,
    caretaker_task_id: context?.caretakerTaskId || null,
    animal_id: context?.animalId || null,
    purpose_note: context?.purposeNote || null,
    product_type: context?.productType || null,
    bloodline_snapshot: context?.bloodline || null,
    breed_snapshot: context?.breed || null,
    product_name_snapshot: context?.productName || null,
  };

  const { data: existing, error: findError } = await supabase.from("farm_cart_items").select("id").eq("profile_id", profile.id).eq("product_id", productId).eq("status", "active").maybeSingle();

  if (findError && !/multiple|no rows/i.test(findError.message)) throw findError;

  const query = existing?.id ? supabase.from("farm_cart_items").update(payload).eq("id", existing.id) : supabase.from("farm_cart_items").insert(payload);

  const { error } = await query;

  if (error && /farm_request_id|caretaker_task_id|animal_id|purpose_note|product_type|bloodline_snapshot|breed_snapshot|product_name_snapshot/i.test(error.message)) {
    const fallbackPayload = {
      profile_id: profile.id,
      product_id: productId,
      quantity,
      unit_price: unitPrice,
      status: "active",
    };
    const fallbackQuery = existing?.id ? supabase.from("farm_cart_items").update(fallbackPayload).eq("id", existing.id) : supabase.from("farm_cart_items").insert(fallbackPayload);
    const { error: fallbackError } = await fallbackQuery;
    if (fallbackError) throw fallbackError;
    return;
  }

  if (error) throw error;
}

export async function checkoutFarmCart() {
  const { data, error } = await supabase.rpc("customer_buy_cart");
  if (error) throw error;
  return data as string;
}

export async function getCustomerRoosters(profileId: string) {
  const { data, error } = await supabase.from("animals").select("*").eq("profile_id", profileId).order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getCustomerOwnedRoosters() {
  const profile = await getCurrentProfile();
  if (!profile) return [];

  const { data, error } = await supabase.from("customer_animals").select("id,animal_name,animal_code,status,acquired_from,acquired_at,source_product_id,source_product_name,bloodline_snapshot,breed_snapshot,ownership_metadata,sale_status,approved_sale_price,sold_at").eq("profile_id", profile.id).neq("status", "sold").order("acquired_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getCustomerInventoryItems() {
  const profile = await getCurrentProfile();
  if (!profile) return [];

  const { data, error } = await supabase.from("customer_inventory_items").select("id,product_id,product_name,category,unit_label,unit_price,image_url,quantity,product_type,bloodline,breed,updated_at").eq("profile_id", profile.id).order("updated_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

export type CareRequestPayload = {
  customerAnimalId?: string | null;
  roosterName: string;
  roosterTag?: string | null;
  serviceName: string;
  serviceCategory?: string | null;
  servicePrice: number;
  requiredProof?: string | null;
  customerNote?: string | null;
};

export async function createCareRequest(payload: CareRequestPayload) {
  const { data, error } = await supabase.rpc("customer_create_care_request", {
    p_customer_animal_id: payload.customerAnimalId || null,
    p_rooster_name: payload.roosterName,
    p_rooster_tag: payload.roosterTag || null,
    p_service_name: payload.serviceName,
    p_service_category: payload.serviceCategory || null,
    p_service_price: payload.servicePrice || 0,
    p_required_proof: payload.requiredProof || null,
    p_customer_note: payload.customerNote || null,
  });

  if (error) throw error;
  return data as string;
}

export async function getCustomerCareRequests() {
  const profile = await getCurrentProfile();
  if (!profile) return [];

  const { data, error } = await supabase.from("farm_care_requests").select("*").eq("profile_id", profile.id).order("created_at", { ascending: false }).limit(50);

  if (error) throw error;
  return data || [];
}

export async function getAdminCareRequests() {
  const { data, error } = await supabase.from("farm_care_requests").select("*, profiles(full_name,email,display_name), caretakers(full_name,display_name)").order("created_at", { ascending: false }).limit(80);

  if (error) throw error;
  return (data || []).map((row: any) => {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    const storedName = String(row.customer_name || "").trim();
    const customerName = profile?.display_name || profile?.full_name || profile?.email || (storedName.toLowerCase() !== "customer" ? storedName : "") || row.customer_email || "Customer";

    return {
      ...row,
      customer_name: customerName,
      customer_email: profile?.email || row.customer_email || null,
    };
  });
}

export async function adminAssignCareRequest(careRequestId: string, caretakerId?: string | null, adminNote?: string | null) {
  const { data, error } = await supabase.rpc("admin_assign_care_request", {
    p_care_request_id: careRequestId,
    p_caretaker_id: caretakerId || null,
    p_admin_note: adminNote || null,
  });

  if (error) throw error;
  return data as string;
}

export async function getActiveCaretakersForAssignment() {
  const { data, error } = await supabase.from("caretakers").select("id,full_name,display_name,farm_role,status").in("status", ["active", "approved", "on_duty"]).order("full_name", { ascending: true }).limit(100);

  if (error) throw error;
  return data || [];
}

export async function getAdminCaretakerDirectory() {
  const { data, error } = await supabase.from("caretakers").select("*").order("full_name", { ascending: true }).limit(200);

  if (error) throw error;
  return data || [];
}

export async function getAdminCaretakerTasks() {
  const { data: tasks, error } = await supabase.from("caretaker_tasks").select("*").order("created_at", { ascending: false }).limit(200);

  if (error) throw error;
  const rows = tasks || [];
  const profileIds = Array.from(new Set(rows.map((row) => row.profile_id).filter(Boolean)));
  const caretakerIds = Array.from(new Set(rows.map((row) => row.caretaker_id).filter(Boolean)));
  const profileMap = new Map<string, any>();
  const caretakerMap = new Map<string, any>();

  if (profileIds.length) {
    const { data: profiles, error: profileError } = await supabase.from("profiles").select("id,full_name,display_name,email").in("id", profileIds);
    if (profileError) throw profileError;
    for (const profile of profiles || []) profileMap.set(profile.id, profile);
  }

  if (caretakerIds.length) {
    const { data: caretakers, error: caretakerError } = await supabase.from("caretakers").select("id,full_name,display_name,email").in("id", caretakerIds);
    if (caretakerError) throw caretakerError;
    for (const caretaker of caretakers || []) caretakerMap.set(caretaker.id, caretaker);
  }

  return rows.map((row) => ({
    ...row,
    profiles: profileMap.get(row.profile_id) || null,
    caretakers: caretakerMap.get(row.caretaker_id) || null,
  }));
}

export async function getCaretakerActiveTasks() {
  const { data, error } = await supabase.from("caretaker_tasks").select("*").in("status", ["active", "in_progress", "backjob"]).order("due_at", { ascending: true }).limit(80);

  if (error) throw error;
  const rows = data || [];
  const backjobIds = rows.filter((row) => row.status === "backjob").map((row) => row.id);
  if (!backjobIds.length) return rows;
  const { data: proofs, error: proofError } = await supabase.from("task_proofs").select("id,caretaker_task_id,task_id,free_note,preset_note,daily_report,proof_file_urls,proof_url,health_status,checklist_results,inventory_usage,feed_quantity_used,actual_remaining_feed,admin_note,reviewed_at,created_at").in("caretaker_task_id", backjobIds).eq("admin_review_status", "backjob").order("created_at", { ascending: false });
  if (proofError) throw proofError;
  const proofMap = new Map<string, NonNullable<typeof proofs>[number] & { stored_paths: string[]; signed_urls: string[] }>();
  for (const proof of proofs || []) {
    const taskId = proof.caretaker_task_id || proof.task_id;
    if (!taskId || proofMap.has(taskId)) continue;
    const storedPaths = (Array.isArray(proof.proof_file_urls) && proof.proof_file_urls.length ? proof.proof_file_urls : proof.proof_url ? [proof.proof_url] : []).filter(Boolean);
    const signedUrls = (await Promise.all(storedPaths.map(async (stored: string) => {
      try { return await createPrivateEvidenceUrl("caretaker-task-proofs", stored); } catch { return ""; }
    })));
    proofMap.set(taskId, { ...proof, stored_paths: storedPaths, signed_urls: signedUrls });
  }
  return rows.map((row) => ({ ...row, backjob_proof: proofMap.get(row.id) || null }));
}

export async function getCustomerCarePlans() {
  const profile = await getCurrentProfile();
  if (!profile) return [];
  const { data, error } = await supabase.from("rooster_care_plans").select("*, customer_animals(animal_name,animal_code,breed_snapshot), care_plan_supply_requirements(*), care_plan_package_items(*)").eq("profile_id", profile.id).order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export type CustomerRoosterCareOverview = {
  customerAnimalId: string;
  planId: string | null;
  planStatus: string | null;
  paid: boolean;
  durationDays: number | null;
  planDay: number | null;
  catalogDay: number;
  missionTitle: string;
  lifeStage: string;
  feedGramsMax: number | null;
};

function manilaDayNumber(value: string | Date) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return Math.floor(Date.UTC(year, month - 1, day) / 86400000);
  }
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((entry) => entry.type === type)?.value || 0);
  return Math.floor(Date.UTC(part("year"), part("month") - 1, part("day")) / 86400000);
}

export async function getCustomerRoosterCareOverviews(): Promise<CustomerRoosterCareOverview[]> {
  const [animals, plans] = await Promise.all([getCustomerOwnedRoosters(), getCustomerCarePlans()]);
  const today = manilaDayNumber(new Date());
  const liveStatuses = new Set(["draft", "payment_for_review", "payment_submitted", "paid_pending_setup", "ready", "active", "paused"]);
  const paidStatuses = new Set(["paid_pending_setup", "ready", "active", "paused"]);
  const draftRows = animals.map((animal: any) => {
    const plan = plans.find((row: any) => row.customer_animal_id === animal.id && liveStatuses.has(String(row.status))) || null;
    const acquiredDay = animal.acquired_at ? manilaDayNumber(animal.acquired_at) : today;
    const ownershipDay = Math.min(180, Math.max(1, today - acquiredDay + 1));
    let planDay: number | null = null;
    let catalogDay = Number(plan?.requested_start_day || plan?.start_day_number || ownershipDay);
    if (plan?.start_date && ["active", "paused"].includes(String(plan.status))) {
      planDay = Math.min(Number(plan.duration_days || 1), Math.max(1, today - manilaDayNumber(plan.start_date) - Number(plan.schedule_shift_days || 0) + 1));
      catalogDay = Number(plan.start_day_number || 1) + planDay - 1;
    }
    return {
      animal,
      plan,
      planDay,
      catalogDay: Math.min(180, Math.max(1, catalogDay)),
    };
  });
  const days = Array.from(new Set(draftRows.map((row) => row.catalogDay)));
  const { data: templates, error } = await supabase
    .from("care_mission_templates")
    .select("day_number,life_stage,primary_mission,feed_grams_max")
    .eq("catalog_version", "farmconnect-premium-rooster-180-v1")
    .in("day_number", days);
  if (error) throw error;
  const templateByDay = new Map((templates || []).map((row: any) => [Number(row.day_number), row]));
  return draftRows.map(({ animal, plan, planDay, catalogDay }) => {
    const template: any = templateByDay.get(catalogDay);
    return {
      customerAnimalId: animal.id,
      planId: plan?.id || null,
      planStatus: plan?.status || null,
      paid: paidStatuses.has(String(plan?.status || "")),
      durationDays: plan ? Number(plan.duration_days || 0) : null,
      planDay,
      catalogDay,
      missionTitle: template?.primary_mission || "Review today’s standard care procedure",
      lifeStage: template?.life_stage || "Standard rooster care",
      feedGramsMax: template?.feed_grams_max == null ? null : Number(template.feed_grams_max),
    };
  });
}

export async function requestCustomerCarePlan(customerAnimalId: string, durationDays: 30 | 60 | 90 | 180, requestedStartDay: number) {
  const { data, error } = await supabase.rpc("customer_request_care_plan", {
    p_customer_animal_id: customerAnimalId,
    p_duration_days: durationDays,
    p_requested_start_day: requestedStartDay,
  });
  if (error) throw error;
  return data as string;
}

export async function prepareCustomerCarePlanPayment(carePlanId: string) {
  const { data, error } = await supabase.rpc("customer_prepare_fixed_care_plan_payment", {
    p_care_plan_id: carePlanId,
  });
  if (error) throw error;
  return data as GuardedWorkflowResult & {
    package_total: number;
    daily_service_rate: number;
    feed_required_kg: number;
    average_daily_feed_kg: number;
    feed_inventory_item_id: string;
    feed_product_name: string;
    available_feed_kg: number;
    duration_days: number;
    requested_start_day: number;
  };
}

export async function getAdminCarePlans() {
  const { data, error } = await supabase.from("rooster_care_plans").select("*, customer:profiles!rooster_care_plans_profile_id_fkey(full_name,display_name,email), customer_animals(animal_name,animal_code,breed_snapshot), assigned_caretaker:caretakers!rooster_care_plans_assigned_caretaker_id_fkey(full_name,display_name), care_plan_supply_requirements(*), care_plan_package_items(*)").order("created_at", { ascending: false }).limit(100);
  if (error) throw error;
  return data || [];
}

export async function getAdminCustomerInventory(profileId: string) {
  const { data, error } = await supabase.from("customer_inventory_items").select("id,product_name,category,unit_label,unit_price,quantity,product_type").eq("profile_id", profileId).or("category.ilike.%feed%,product_type.eq.feed").gt("quantity", 0).order("product_name");
  if (error) throw error;
  return data || [];
}

export async function getAvailableFarmFeedProducts() {
  const { data, error } = await supabase.from("farm_products").select("id,name,category,unit_label,unit_price,stock_quantity,product_type").eq("status", "available").or("category.ilike.%feed%,product_type.eq.feed").gt("stock_quantity", 0).order("name");
  if (error) throw error;
  return data || [];
}

export async function prepareAdminCarePlanQuote(payload: { carePlanId: string; caretakerId: string; feedInventoryItemId?: string | null; feedProductId?: string | null; kgPerInventoryUnit: number; unquantifiedDayFeedGrams: number; laborPrice: number; serviceFee: number; quoteNote?: string | null }) {
  const { data, error } = await supabase.rpc("admin_prepare_care_plan_quote_v2", {
    p_care_plan_id: payload.carePlanId,
    p_caretaker_id: payload.caretakerId,
    p_feed_inventory_item_id: payload.feedInventoryItemId || null,
    p_feed_product_id: payload.feedProductId || null,
    p_kg_per_inventory_unit: payload.kgPerInventoryUnit,
    p_unquantified_day_feed_grams: payload.unquantifiedDayFeedGrams,
    p_labor_price: payload.laborPrice,
    p_service_fee: payload.serviceFee,
    p_quote_note: payload.quoteNote || null,
  });
  if (error) throw error;
  return data as GuardedWorkflowResult & {
    package_total?: number;
    feed_required_kg?: number;
    required_inventory_units?: number;
    reserved_inventory_units?: number;
    purchase_inventory_units?: number;
    supply_price?: number;
    unquantified_days?: number;
  };
}

export async function activateAdminCarePlan(carePlanId: string, startDate: string) {
  const { data, error } = await supabase.rpc("admin_activate_care_plan", {
    p_care_plan_id: carePlanId,
    p_start_date: startDate,
  });
  if (error) throw error;
  return data as GuardedWorkflowResult;
}

export async function assignAdminCarePlan(carePlanId: string, caretakerId: string, adminNote?: string | null) {
  const { data, error } = await supabase.rpc("admin_assign_care_plan", {
    p_care_plan_id: carePlanId,
    p_caretaker_id: caretakerId,
    p_admin_note: adminNote || null,
  });
  if (error) throw error;
  return data as GuardedWorkflowResult & {
    created_missions?: number;
    start_date?: string;
    end_date?: string;
  };
}

export async function cancelCustomerCarePlan(carePlanId: string, reason: string) {
  const { data, error } = await supabase.rpc("customer_cancel_care_plan", {
    p_care_plan_id: carePlanId,
    p_reason: reason,
  });
  if (error) throw error;
  return data as GuardedWorkflowResult & { refund_due_amount?: number };
}

export async function controlAdminCarePlan(payload: { carePlanId: string; action: "pause" | "resume" | "reassign" | "cancel"; note: string; newCaretakerId?: string | null }) {
  const { data, error } = await supabase.rpc("admin_control_care_plan", {
    p_care_plan_id: payload.carePlanId,
    p_action: payload.action,
    p_note: payload.note,
    p_new_caretaker_id: payload.newCaretakerId || null,
  });
  if (error) throw error;
  return data as GuardedWorkflowResult & { refund_due_amount?: number };
}

export async function recordAdminCarePlanRefund(carePlanId: string, reference: string, note?: string | null) {
  const { data, error } = await supabase.rpc("admin_record_care_plan_refund", {
    p_care_plan_id: carePlanId,
    p_reference: reference,
    p_note: note || null,
  });
  if (error) throw error;
  return data as GuardedWorkflowResult & {
    amount?: number;
    reference?: string;
  };
}

export async function generateTodayCarePlanMissions() {
  const { data, error } = await supabase.rpc("generate_due_care_plan_missions");
  if (error) throw error;
  return data as { run_date?: string; created?: number; timezone?: string };
}

export async function getKaFarmCarePlanHealth() {
  const { data, error } = await supabase.rpc("kafarm_care_plan_health_snapshot");
  if (error) throw error;
  return data as {
    catalog_days: number;
    open_plans: number;
    active_plans: number;
    overdue_missions: number;
    unreviewed_proofs: number;
    active_supply_conversion_missing: number;
    negative_inventory: number;
    pending_refunds: number;
    generated_at: string;
  };
}

export type CareTaskInventoryItem = {
  id: string;
  product_name: string;
  category?: string | null;
  unit_label?: string | null;
  quantity: number;
  product_type?: string | null;
  kg_per_inventory_unit?: number | null;
  reserved_inventory_units?: number | null;
  reserved_kg?: number | null;
  usage_unit?: "kg" | "inventory_unit" | null;
};

export async function getCaretakerTaskInventory(taskId: string): Promise<CareTaskInventoryItem[]> {
  const { data, error } = await supabase.rpc("caretaker_get_task_inventory", {
    p_task_id: taskId,
  });
  if (error) throw error;
  return Array.isArray(data) ? (data as CareTaskInventoryItem[]) : [];
}

export async function submitCaretakerMissionProof(payload: {
  submissionKey: string;
  dailyReport: unknown[];
  actualRemainingFeed: number;
  taskId: string;
  proofUrls: string[];
  freeNote: string;
  qrVerified: boolean;
  serialException: boolean;
  healthStatus: "pass" | "watch" | "isolate_and_escalate";
  checklistResults: {
    operations: Array<{ label: string; checked: boolean }>;
    housing: Array<{ label: string; checked: boolean }>;
    supplements: Array<{ label: string; checked: boolean }>;
    vaccines: Array<{ label: string; checked: boolean }>;
    health: Array<{ label: string; checked: boolean }>;
  };
  inventoryUsage: Array<{
    inventory_item_id: string;
    quantity: number;
    unit: "kg";
  }>;
}) {
  const { data, error } = await submitCaretakerProofRequest({
    p_submission_key: payload.submissionKey,
    p_daily_report: payload.dailyReport,
    p_actual_remaining_feed: payload.actualRemainingFeed,
    p_task_id: payload.taskId,
    p_proof_urls: payload.proofUrls,
    p_free_note: payload.freeNote,
    p_qr_verified: payload.qrVerified,
    p_serial_exception: payload.serialException,
    p_health_status: payload.healthStatus,
    p_checklist_results: payload.checklistResults,
    p_inventory_usage: payload.inventoryUsage,
  });
  if (error) throw error;
  return data as string;
}

export async function submitCaretakerManualMissionProof(payload: {
  submissionKey: string;
  dailyReport: unknown[];
  actualRemainingFeed: number;
  taskId: string;
  proofUrls: string[];
  freeNote: string;
  qrVerified: boolean;
  serialException: boolean;
  healthStatus: "pass" | "watch" | "isolate_and_escalate";
  checklistResults: {
    operations: Array<{ label: string; checked: boolean }>;
    housing: Array<{ label: string; checked: boolean }>;
    supplements: Array<{ label: string; checked: boolean }>;
    vaccines: Array<{ label: string; checked: boolean }>;
    health: Array<{ label: string; checked: boolean }>;
  };
  inventoryUsage: Array<{
    inventory_item_id: string;
    quantity: number;
    unit: "kg" | "inventory_unit";
  }>;
}) {
  const { data, error } = await submitCaretakerProofRequest({
    p_submission_key: payload.submissionKey,
    p_daily_report: payload.dailyReport,
    p_actual_remaining_feed: payload.actualRemainingFeed,
    p_task_id: payload.taskId,
    p_proof_urls: payload.proofUrls,
    p_free_note: payload.freeNote,
    p_qr_verified: payload.qrVerified,
    p_serial_exception: payload.serialException,
    p_health_status: payload.healthStatus,
    p_checklist_results: payload.checklistResults,
    p_inventory_usage: payload.inventoryUsage,
  });
  if (error) throw error;
  return data as string;
}

export async function adminReviewManualMissionProof(proofId: string, decision: "approved" | "rejected" | "backjob", note?: string | null) {
  const { data, error } = await supabase.rpc("admin_review_manual_mission_proof_guarded", {
    p_proof_id: proofId,
    p_decision: decision,
    p_admin_note: note || null,
  });
  if (error) throw error;
  return data as GuardedWorkflowResult;
}

export async function submitCaretakerTaskProof(payload: { taskId: string; proofUrl?: string | null; proofUrls?: string[]; presetNote?: string | null; freeNote?: string | null; qrVerified?: boolean; serialException?: boolean; feedQuantityUsed?: number | null; feedUnit?: string | null; dailyReport?: unknown[] | null; submissionKey?: string | null }) {
  const proofUrls = (payload.proofUrls || [payload.proofUrl]).filter((value): value is string => Boolean(value));
  const { data, error } = await submitCaretakerProofRequest({
    p_task_id: payload.taskId,
    p_proof_urls: proofUrls,
    p_preset_note: payload.presetNote || null,
    p_free_note: payload.freeNote || null,
    p_qr_verified: payload.qrVerified ?? true,
    p_serial_exception: payload.serialException ?? false,
    p_feed_quantity_used: payload.feedQuantityUsed ?? null,
    p_feed_unit: payload.feedUnit || null,
    p_daily_report: payload.dailyReport || null,
    p_submission_key: payload.submissionKey || null,
  });

  if (error) throw error;
  return data as string;
}

function submitCaretakerProofRequest(request: Record<string, unknown>) {
  return supabase.rpc("caretaker_submit_report_guarded", { p_request: request });
}

export async function getAdminTaskProofs() {
  const { data: proofs, error } = await supabase.from("task_proofs").select("*").order("created_at", { ascending: false }).limit(80);

  if (error) throw error;
  const rows = proofs || [];
  const taskIds = Array.from(new Set(rows.map((row) => row.caretaker_task_id || row.task_id).filter(Boolean)));
  const caretakerIds = Array.from(new Set(rows.map((row) => row.caretaker_id).filter(Boolean)));

  const taskMap = new Map<string, any>();
  if (taskIds.length) {
    const { data: tasks, error: taskError } = await supabase.from("caretaker_tasks").select("id,profile_id,task_type,rooster_name,rooster_tag,status,workflow_type,qr_scan_required,qr_payload,task_metadata,reviewed_at").in("id", taskIds);
    if (taskError) throw taskError;
    for (const task of tasks || []) taskMap.set(task.id, task);
  }

  const caretakerMap = new Map<string, any>();
  if (caretakerIds.length) {
    const { data: caretakers, error: caretakerError } = await supabase.from("caretakers").select("id,full_name,display_name").in("id", caretakerIds);
    if (caretakerError) throw caretakerError;
    for (const caretaker of caretakers || []) caretakerMap.set(caretaker.id, caretaker);
  }

  const profileIds = Array.from(
    new Set(
      Array.from(taskMap.values())
        .map((task) => task.profile_id)
        .filter(Boolean),
    ),
  );
  const profileMap = new Map<string, any>();
  if (profileIds.length) {
    const { data: profiles, error: profileError } = await supabase.from("profiles").select("id,full_name,display_name,email").in("id", profileIds);
    if (profileError) throw profileError;
    for (const profile of profiles || []) profileMap.set(profile.id, profile);
  }

  return rows.map((row) => ({
    ...row,
    caretaker_tasks: taskMap.get(row.caretaker_task_id || row.task_id) || null,
    caretakers: caretakerMap.get(row.caretaker_id) || null,
    profiles: profileMap.get(taskMap.get(row.caretaker_task_id || row.task_id)?.profile_id) || null,
  }));
}

export async function adminReviewTaskProof(proofId: string, decision: "approved" | "rejected" | "backjob", note?: string | null) {
  const { data, error } = await supabase.rpc("admin_review_task_proof_guarded", {
    p_proof_id: proofId,
    p_decision: decision,
    p_admin_note: note || null,
  });

  if (error) throw error;
  return data as GuardedWorkflowResult;
}

export async function adminReviewMissionProof(proofId: string, decision: "approved" | "rejected" | "backjob", note?: string | null) {
  const { data, error } = await supabase.rpc("admin_review_mission_proof_guarded", {
    p_proof_id: proofId,
    p_decision: decision,
    p_admin_note: note || null,
  });
  if (error) throw error;
  return data as GuardedWorkflowResult;
}

export async function getCustomerRoosterSaleRequest(customerAnimalId: string) {
  const { data, error } = await supabase.from("rooster_sale_requests").select("*").eq("customer_animal_id", customerAnimalId).not("status", "in", "(completed,cancelled)").order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return data;
}

export async function requestRoosterSalePrice(customerAnimalId: string, note?: string | null) {
  const { data, error } = await supabase.rpc("customer_request_rooster_sale_price", {
    p_customer_animal_id: customerAnimalId,
    p_customer_note: note || null,
  });
  if (error) throw error;
  return data as string;
}

export async function confirmRoosterSale(saleRequestId: string, note?: string | null) {
  const { data, error } = await supabase.rpc("customer_confirm_rooster_sale", {
    p_sale_request_id: saleRequestId,
    p_customer_note: note || null,
  });
  if (error) throw error;
  return data as string;
}

export async function getAdminRoosterSaleRequests() {
  const { data, error } = await supabase.from("rooster_sale_requests").select("*, customer_animals(animal_name,animal_code,breed_snapshot,bloodline_snapshot,ownership_metadata), profiles!rooster_sale_requests_profile_id_fkey(full_name,display_name,email)").in("status", ["sale_requested", "sale_rejected", "release_pending_assignment", "release_assigned", "release_submitted"]).order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function adminReviewRoosterSale(saleRequestId: string, decision: "approved" | "rejected", note: string) {
  const { data, error } = await supabase.rpc("admin_review_rooster_sale_guarded", {
    p_sale_request_id: saleRequestId,
    p_decision: decision,
    p_admin_note: note,
  });
  if (error) throw error;
  return data as GuardedWorkflowResult;
}

export async function submitCaretakerRoosterSaleTask(payload: { taskId: string; submissionKey: string; declaredAmount?: number | null; proofUrls?: string[]; freeNote: string; qrVerified?: boolean; serialException?: boolean }) {
  const { data, error } = await submitCaretakerProofRequest({
    p_submission_key: payload.submissionKey,
    p_task_id: payload.taskId,
    p_declared_amount: payload.declaredAmount ?? null,
    p_proof_urls: payload.proofUrls || [],
    p_free_note: payload.freeNote,
    p_qr_verified: payload.qrVerified ?? false,
    p_serial_exception: payload.serialException ?? false,
  });
  if (error) throw error;
  return data as string;
}
export async function getWalletTransactions(profileId: string) {
  const { data, error } = await supabase.from("wallet_transactions").select("*").eq("profile_id", profileId).order("created_at", { ascending: false }).limit(30);

  if (error) throw error;
  return data || [];
}

export async function getInboxItems(profileId: string) {
  const { data, error } = await supabase.from("inbox_items").select("*").eq("profile_id", profileId).order("created_at", { ascending: false }).limit(50);

  if (error) throw error;
  return data || [];
}

export async function markInboxItemRead(inboxItemId: string) {
  const { data, error } = await supabase.rpc("customer_mark_inbox_item_read", {
    p_inbox_item_id: inboxItemId,
  });

  if (error) throw error;
  return data as string;
}

export type CareLogRecord = {
  customerAnimalId?: string | null;
  rooster: string;
  title: string;
  type: string;
  item: string;
  amount: string;
  productCost: number;
  laborCost: number;
  detail: string;
  status: string;
  caretaker: string;
  uploaded: string;
  time: string;
  proof: string;
  reviewer: string;
  image: string;
  images?: string[];
};

export async function getCustomerRoosterDiary(customerAnimalId: string): Promise<CareLogRecord[]> {
  const { data, error } = await supabase.rpc("customer_get_rooster_diary", {
    p_customer_animal_id: customerAnimalId,
  });
  if (error) throw error;
  const rows = Array.isArray(data) ? data : [];
  return Promise.all(rows.map(async (row: any) => {
    const date = row.created_at ? new Date(row.created_at) : null;
    const storedImages = (Array.isArray(row.images) && row.images.length ? row.images : row.image ? [row.image] : []).filter(Boolean);
    const signedImages = (await Promise.all(storedImages.map(async (stored: string) => {
      try {
        return await createPrivateEvidenceUrl("caretaker-task-proofs", stored);
      } catch {
        throw new Error("A diary photo could not be loaded. Please try again; your report has not been changed.");
      }
    })));
    return {
      customerAnimalId: row.customer_animal_id || customerAnimalId,
      rooster: "",
      title: row.title || "Care Update",
      type: row.proof_type || "Care",
      item: "",
      amount: "",
      productCost: 0,
      laborCost: 0,
      detail: row.detail || "Care documentation completed.",
      status: row.status || "Verified",
      caretaker: "",
      uploaded: date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" }) : "Today",
      time: date && !Number.isNaN(date.getTime()) ? date.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" }) : "",
      proof: row.proof_type || "Care documentation",
      reviewer: "Verified",
      image: signedImages[0] || "",
      images: signedImages,
    };
  }));
}

function formatDateTime(value?: string | null) {
  if (!value) return { uploaded: "Today", time: "" };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { uploaded: "Today", time: "" };
  return {
    uploaded: date.toLocaleDateString("en-PH", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
    time: date.toLocaleTimeString("en-PH", {
      hour: "numeric",
      minute: "2-digit",
    }),
  };
}

function prettyStatus(status?: string | null) {
  const raw = String(status || "pending").replaceAll("_", " ");
  return raw.replace(/\b\w/g, (char) => char.toUpperCase());
}

export async function getCareLogRecords(): Promise<CareLogRecord[]> {
  const records: CareLogRecord[] = [];
  const profile = await getCurrentProfile();
  if (!profile?.id) return records;

  const { data: usageRows, error: usageError } = await supabase
    .from("inventory_usage_logs")
    .select(
      `
      id,
      quantity_used,
      unit,
      note,
      created_at,
      farm_products(name, unit_price, unit_label, image_url),
      animals(name, code, pen_location),
      caretakers(full_name, display_name)
    `,
    )
    .order("created_at", { ascending: false })
    .limit(50);

  if (usageError && !/column|relationship|schema cache/i.test(usageError.message)) throw usageError;

  for (const row of usageRows || []) {
    const product = Array.isArray(row.farm_products) ? row.farm_products[0] : row.farm_products;
    const animal = Array.isArray(row.animals) ? row.animals[0] : row.animals;
    const caretaker = Array.isArray(row.caretakers) ? row.caretakers[0] : row.caretakers;
    const { uploaded, time } = formatDateTime(row.created_at);
    const productName = product?.name || "Care supply";
    const unit = row.unit || product?.unit_label || "unit";
    const quantity = Number(row.quantity_used || 0);
    const price = Number(product?.unit_price || 0);
    records.push({
      rooster: animal?.name || animal?.code || "Rooster",
      title: productName.toLowerCase().includes("feed") ? "Feeding" : "Supply Used",
      type: "Usage",
      item: productName,
      amount: `${quantity} ${String(unit).replace(/^per\s+/i, "")}`,
      productCost: Math.round(quantity * price),
      laborCost: 0,
      detail: row.note || `${productName} used from customer-owned inventory.`,
      status: "Verified",
      caretaker: caretaker?.display_name || caretaker?.full_name || "Caretaker",
      uploaded,
      time,
      proof: "Usage record",
      reviewer: "Inventory updated",
      image: product?.image_url || "/farmconnect/marketplace/fc-product-feeds.jpg",
    });
  }

  const { data: proofRows, error: proofError } = await supabase.from("task_proofs").select("id,caretaker_task_id,task_id,caretaker_id,profile_id,proof_type,proof_url,thumbnail_url,proof_file_urls,preset_note,free_note,captured_at,admin_review_status,proof_check_status,created_at").eq("profile_id", profile.id).eq("admin_review_status", "approved").order("created_at", { ascending: false }).limit(50);

  if (proofError) throw proofError;

  const approvedProofs = proofRows || [];
  const taskIds = Array.from(new Set(approvedProofs.map((row) => row.caretaker_task_id || row.task_id).filter(Boolean)));
  const caretakerIds = Array.from(new Set(approvedProofs.map((row) => row.caretaker_id).filter(Boolean)));
  const taskMap = new Map<string, any>();
  const caretakerMap = new Map<string, any>();

  if (taskIds.length) {
    const { data: tasks, error: taskError } = await supabase.from("caretaker_tasks").select("id,task_type,rooster_name,rooster_tag,status,workflow_type").in("id", taskIds);
    if (taskError) throw taskError;
    for (const task of tasks || []) taskMap.set(task.id, task);
  }

  if (caretakerIds.length) {
    const { data: caretakers, error: caretakerError } = await supabase.from("caretakers").select("id,full_name,display_name").in("id", caretakerIds);
    if (caretakerError) throw caretakerError;
    for (const caretaker of caretakers || []) caretakerMap.set(caretaker.id, caretaker);
  }

  for (const row of approvedProofs) {
    const task = taskMap.get(row.caretaker_task_id || row.task_id);
    const caretaker = caretakerMap.get(row.caretaker_id);
    const { uploaded, time } = formatDateTime(row.captured_at || row.created_at);
    const title = task?.task_type || `${prettyStatus(row.proof_type)} Update`;
    const storedProof = row.proof_file_urls?.[0] || row.thumbnail_url || row.proof_url;
    let proofImage = "/farmconnect/roosters/fc-stage-3-young-rooster-base.jpg";
    if (storedProof) {
      try {
        proofImage = await createPrivateEvidenceUrl("caretaker-task-proofs", storedProof);
      } catch {
        // Legacy or removed evidence must not turn the Care Logs page into a 404 link.
      }
    }
    records.push({
      rooster: task?.rooster_name || task?.rooster_tag || "Rooster",
      title,
      type: prettyStatus(row.proof_type),
      item: row.preset_note || row.free_note || "Care proof",
      amount: "1 upload",
      productCost: 0,
      laborCost: 0,
      detail: row.free_note || row.preset_note || "Caretaker uploaded care proof.",
      status: "Approved",
      caretaker: caretaker?.display_name || caretaker?.full_name || "Caretaker",
      uploaded,
      time,
      proof: prettyStatus(row.proof_type),
      reviewer: prettyStatus(row.admin_review_status || row.proof_check_status),
      image: proofImage,
    });
  }

  return records.sort((a, b) => {
    const aTime = new Date(`${a.uploaded} ${a.time}`).getTime();
    const bTime = new Date(`${b.uploaded} ${b.time}`).getTime();
    return (Number.isNaN(bTime) ? 0 : bTime) - (Number.isNaN(aTime) ? 0 : aTime);
  });
}

export async function getCaretakerTasks(caretakerId: string) {
  const { data, error } = await supabase.from("caretaker_tasks").select("*").eq("caretaker_id", caretakerId).in("status", ["active", "submitted", "needs_review"]).order("due_at", { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function createSupportConversation(roleScope: AppRole, issueType = "general") {
  const profile = await getCurrentProfile();
  const { data, error } = await supabase
    .from("support_conversations")
    .insert({
      profile_id: profile?.id || null,
      role_scope: roleScope,
      issue_type: issueType,
      status: "ai_only",
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export type ManualPaymentSource = "farm_buy" | "care_request" | "care_plan" | "cashin" | "other";

export type ManualPaymentPayload = {
  sourceType: ManualPaymentSource;
  sourceRef?: string;
  amountExpected: number;
  summary: Record<string, unknown>;
  paymentMethod: string;
  receiverAccount: string;
  senderName: string;
  referenceNumber: string;
  receiptImageUrl?: string | null;
  idempotencyKey: string;
};

type GuardedWorkflowResult = {
  id: string;
  duplicate: boolean;
  status: string;
  workflow_id?: string | null;
  error?: string | null;
};

export async function submitManualPaymentRequest(payload: ManualPaymentPayload) {
  const { data, error } = await supabase.rpc("customer_submit_manual_payment_guarded", {
    p_source_type: payload.sourceType,
    p_source_ref: payload.sourceRef || null,
    p_amount_expected: payload.amountExpected,
    p_summary: payload.summary || {},
    p_payment_method: payload.paymentMethod,
    p_receiver_account: payload.receiverAccount,
    p_sender_name: payload.senderName,
    p_reference_number: payload.referenceNumber,
    p_receipt_image_url: payload.receiptImageUrl || null,
    p_idempotency_key: payload.idempotencyKey,
  });

  if (error) throw error;
  const result = data as GuardedWorkflowResult;
  if (!result?.id) throw new Error("WORKFLOW_RESULT_MISSING");
  return result;
}

export async function getCustomerManualPaymentRequests() {
  const profile = await getCurrentProfile();
  if (!profile) return [];

  const { data, error } = await supabase.from("manual_payment_requests").select("*").eq("profile_id", profile.id).order("created_at", { ascending: false }).limit(50);

  if (error) throw error;
  return data || [];
}

export async function getAdminManualPaymentRequests() {
  const { data, error } = await supabase.from("manual_payment_requests").select("*").in("status", ["for_review", "needs_info"]).order("created_at", { ascending: false }).limit(80);

  if (error) throw error;
  const rows = data || [];
  const profileIds = Array.from(new Set(rows.map((row: any) => row.profile_id).filter(Boolean)));
  if (!profileIds.length) return rows;

  const { data: profiles } = await supabase.from("profiles").select("id,full_name,email,display_name").in("id", profileIds);

  const profileMap = new Map((profiles || []).map((profile: any) => [profile.id, profile]));
  return rows.map((row: any) => ({
    ...row,
    profiles: profileMap.get(row.profile_id) || null,
  }));
}

export async function adminReviewManualPayment(paymentRequestId: string, decision: "approved" | "rejected" | "needs_info", note: string) {
  const { data, error } = await supabase.rpc("admin_review_manual_payment_guarded", {
    p_payment_request_id: paymentRequestId,
    p_decision: decision,
    p_admin_note: note || null,
  });

  if (error) throw error;
  const result = data as GuardedWorkflowResult;
  if (!result?.id) throw new Error("WORKFLOW_RESULT_MISSING");
  return result;
}

export type WithdrawalRequestPayload = {
  amount: number;
  payoutMethod: string;
  payoutHolder: string;
  payoutAccount: string;
  customerNote?: string | null;
  idempotencyKey: string;
  walletPin: string;
};

export type CustomerPayoutMethodPayload = {
  provider: string;
  accountHolder: string;
  accountNumber: string;
  isDefault?: boolean;
};

export async function getCustomerPayoutMethods() {
  const profile = await getCurrentProfile();
  if (!profile) return [];

  const { data, error } = await supabase.from("customer_payout_methods").select("id,provider,account_holder,account_number,status,is_default,created_at,updated_at").eq("profile_id", profile.id).eq("status", "active").order("is_default", { ascending: false }).order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function saveCustomerPayoutMethod(payload: CustomerPayoutMethodPayload) {
  const { data, error } = await supabase.rpc("customer_save_payout_method", {
    p_provider: payload.provider,
    p_account_holder: payload.accountHolder,
    p_account_number: payload.accountNumber,
    p_is_default: payload.isDefault ?? true,
  });

  if (error) throw error;
  return data as string;
}

export async function submitWithdrawalRequest(payload: WithdrawalRequestPayload) {
  const { data, error } = await supabase.rpc("customer_submit_withdrawal_request_guarded", {
    p_amount: payload.amount,
    p_payout_method: payload.payoutMethod,
    p_payout_holder: payload.payoutHolder,
    p_payout_account: payload.payoutAccount,
    p_customer_note: payload.customerNote || null,
    p_idempotency_key: payload.idempotencyKey,
    p_wallet_pin: payload.walletPin,
  });

  if (error) throw error;
  const result = data as GuardedWorkflowResult;
  if (result?.error) throw new Error(result.error);
  if (!result?.id) throw new Error("WORKFLOW_RESULT_MISSING");
  return result;
}

export async function getCustomerWithdrawalRequests() {
  const profile = await getCurrentProfile();
  if (!profile) return [];

  const { data, error } = await supabase.from("withdrawal_requests").select("*").eq("profile_id", profile.id).order("created_at", { ascending: false }).limit(50);

  if (error) throw error;
  return data || [];
}

export async function getAdminWithdrawalRequests() {
  const { data, error } = await supabase.from("withdrawal_requests").select("*, profiles!withdrawal_requests_profile_id_fkey(full_name,email,display_name)").order("created_at", { ascending: false }).limit(80);

  if (error) throw error;
  return data || [];
}

export async function adminReviewWithdrawalRequest(withdrawalRequestId: string, decision: "approved" | "rejected" | "needs_info", adminNote: string, adminReferenceNumber?: string | null, adminReceiptUrl?: string | null, adminReceiptFileName?: string | null) {
  const { data, error } = await supabase.rpc("admin_review_withdrawal_request_guarded", {
    p_withdrawal_request_id: withdrawalRequestId,
    p_decision: decision,
    p_admin_note: adminNote || null,
    p_admin_reference_number: adminReferenceNumber || null,
    p_admin_receipt_url: adminReceiptUrl || null,
    p_admin_receipt_file_name: adminReceiptFileName || null,
  });

  if (error) throw error;
  return data as GuardedWorkflowResult;
}
export type CaretakerApplicationPayload = {
  fullName: string;
  displayName?: string;
  phone: string;
  birthdate?: string | null;
  addressLine?: string;
  avatarUrl?: string;
  resumeUrl: string;
  farmRole?: string;
  paymentMethod?: string;
  paymentAccountName?: string;
  paymentAccountNumber?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  workPinSet?: boolean;
};

export async function submitCaretakerApplication(payload: CaretakerApplicationPayload, client: SupabaseClient = supabase) {
  const { data, error } = await client.rpc("submit_caretaker_application", {
    p_full_name: payload.fullName,
    p_display_name: payload.displayName || null,
    p_phone: payload.phone,
    p_birthdate: payload.birthdate || null,
    p_address_line: payload.addressLine || null,
    p_avatar_url: payload.avatarUrl || null,
    p_resume_url: payload.resumeUrl,
    p_farm_role: payload.farmRole || null,
    p_payment_method: payload.paymentMethod || null,
    p_payment_account_name: payload.paymentAccountName || null,
    p_payment_account_number: payload.paymentAccountNumber || null,
    p_emergency_contact_name: payload.emergencyContactName || null,
    p_emergency_contact_phone: payload.emergencyContactPhone || null,
    p_work_pin_set: Boolean(payload.workPinSet),
  });

  if (error) throw error;
  return data as string;
}

export async function confirmWithdrawalResult(withdrawalRequestId: string, received: boolean, note?: string | null) {
  const { data, error } = await supabase.rpc("customer_confirm_withdrawal_result", {
    p_withdrawal_request_id: withdrawalRequestId,
    p_received: received,
    p_customer_note: note || null,
  });
  if (error) throw error;
  return data as string;
}

export async function adminApproveAndAssignRoosterOrder(paymentRequestId: string, caretakerId: string, note?: string | null) {
  const { data, error } = await supabase.rpc("admin_approve_assign_rooster_order", {
    p_payment_request_id: paymentRequestId,
    p_caretaker_id: caretakerId,
    p_admin_note: note || null,
  });
  if (error) throw error;
  return data as { status: string; assignment_count: number; task_ids: string[] };
}

export async function reportWithdrawalProblem(withdrawalRequestId: string, note: string) {
  const { data, error } = await supabase.rpc("customer_report_withdrawal_problem", {
    p_withdrawal_request_id: withdrawalRequestId,
    p_customer_note: note,
  });
  if (error) throw error;
  return data as string;
}

export async function getAdminWithdrawalDisputes() {
  const { data, error } = await supabase
    .from("withdrawal_disputes")
    .select("*,withdrawal_requests(*,profiles!withdrawal_requests_profile_id_fkey(id,email,full_name,display_name))")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return data || [];
}

export async function renameCustomerRooster(customerAnimalId: string, animalName: string) {
  const name = animalName.trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 40) throw new Error("ROOSTER_NAME_INVALID");

  const { data, error } = await supabase.rpc("rename_customer_rooster", {
    p_customer_animal_id: customerAnimalId,
    p_animal_name: name,
  });

  if (error) throw error;
  return data;
}

export async function resolveWithdrawalDispute(payload: {
  disputeId: string;
  resolutionType: "farm_corrected_payout" | "customer_fault_explained";
  resolutionNote: string;
  correctedReference?: string | null;
  correctedReceiptUrl?: string | null;
  correctedReceiptFileName?: string | null;
}) {
  const { data, error } = await supabase.rpc("admin_resolve_withdrawal_dispute", {
    p_dispute_id: payload.disputeId,
    p_resolution_type: payload.resolutionType,
    p_resolution_note: payload.resolutionNote,
    p_corrected_reference: payload.correctedReference || null,
    p_corrected_receipt_url: payload.correctedReceiptUrl || null,
    p_corrected_receipt_file_name: payload.correctedReceiptFileName || null,
  });
  if (error) throw error;
  return data as string;
}

export async function getCaretakerApplications(statuses?: string[]) {
  let query = supabase.from("caretaker_applications").select("*").order("created_at", { ascending: false }).limit(80);

  if (statuses?.length) query = query.in("status", statuses);

  const { data, error } = await query;

  if (error) throw error;
  return data || [];
}

export async function adminReviewCaretakerApplication(applicationId: string, decision: "approved" | "rejected" | "needs_info", note: string) {
  const { data, error } = await supabase.rpc("admin_review_caretaker_application_guarded", {
    p_application_id: applicationId,
    p_decision: decision,
    p_note: note || null,
  });

  if (error) throw error;
  return data as GuardedWorkflowResult;
}

type CustomerKycRecord = {
  id: string;
  profile_id: string;
  [key: string]: unknown;
};

export type CustomerKycSubmission = {
  id: string;
  status: string;
  adminNote: string | null;
  submittedAt: string | null;
};

export async function getCurrentCustomerKycSubmission(): Promise<CustomerKycSubmission | null> {
  const profile = await getCurrentProfile();
  if (!profile?.id) return null;

  const { data, error } = await supabase.from("customer_kyc_profiles").select("*").eq("profile_id", profile.id).maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const row = data as Record<string, unknown>;
  const status = String(row.status || row.verification_status || row.review_status || "submitted")
    .trim()
    .toLowerCase();
  const note = row.admin_note || row.review_note || row.rejection_reason || row.decision_note;
  const submittedAt = row.submitted_at || row.updated_at || row.created_at;
  return {
    id: String(row.id),
    status,
    adminNote: typeof note === "string" && note.trim() ? note.trim() : null,
    submittedAt: typeof submittedAt === "string" ? submittedAt : null,
  };
}

type VerificationProfileSummary = {
  id: string;
  auth_user_id?: string | null;
  full_name?: string | null;
  display_name?: string | null;
  email?: string | null;
  phone?: string | null;
  birthdate?: string | null;
  verification_status?: string | null;
  account_status?: string | null;
  kyc_risk_level?: string | null;
  kyc_verified_at?: string | null;
};

type VerificationDocumentSummary = {
  id: string;
  kyc_profile_id: string;
  document_type: string;
  file_url: string;
  status?: string | null;
  quality_result?: string | null;
  created_at?: string | null;
};

export async function getCustomerKycVerificationRecords() {
  const { data: kycRows, error: kycError } = await supabase.from("customer_kyc_profiles").select("*").order("created_at", { ascending: false }).limit(100);

  if (kycError) throw kycError;

  const rows = (kycRows || []) as CustomerKycRecord[];
  const profileIds = [...new Set(rows.map((row) => row.profile_id).filter(Boolean))];
  const kycIds = rows.map((row) => row.id).filter(Boolean);

  const profilesResult = profileIds.length ? await supabase.from("profiles").select("id,auth_user_id,full_name,display_name,email,phone,birthdate,verification_status,account_status,kyc_risk_level,kyc_verified_at").in("id", profileIds) : { data: [], error: null };

  if (profilesResult.error) throw profilesResult.error;

  const documentsResult = kycIds.length ? await supabase.from("kyc_documents").select("id,kyc_profile_id,document_type,file_url,status,quality_result,created_at").in("kyc_profile_id", kycIds).order("created_at", { ascending: false }) : { data: [], error: null };

  if (documentsResult.error) throw documentsResult.error;

  const profiles = (profilesResult.data || []) as VerificationProfileSummary[];
  const documents = (documentsResult.data || []) as VerificationDocumentSummary[];
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const documentsByKycId = new Map<string, VerificationDocumentSummary[]>();
  for (const document of documents) {
    const current = documentsByKycId.get(document.kyc_profile_id) || [];
    current.push(document);
    documentsByKycId.set(document.kyc_profile_id, current);
  }

  return rows.map((row) => ({
    ...row,
    profile: profileById.get(row.profile_id) || null,
    documents: documentsByKycId.get(row.id) || [],
  }));
}

export async function adminReviewCustomerKyc(kycProfileId: string, decision: "approved" | "rejected", note: string, riskLevel: "low" | "medium" | "high" = "low") {
  const { data, error } = await supabase.rpc("admin_review_customer_kyc_guarded", {
    p_kyc_profile_id: kycProfileId,
    p_decision: decision,
    p_note: note || null,
    p_risk_level: riskLevel,
  });

  if (error) throw error;
  const result = data as GuardedWorkflowResult;
  if (!result?.id) throw new Error("KYC_REVIEW_RESULT_MISSING");
  return result;
}

type PrivateEvidenceUploadOptions = {
  bucket: "caretaker-resumes" | "caretaker-task-proofs" | "farmconnect-customer-kyc" | "withdrawal-proofs";
  folder: string;
  kind: string;
  file: File;
  maxBytes: number;
  allowedMimeTypes: string[];
  upsert?: boolean;
};

function safeStorageSegment(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "file"
  );
}

function storageExtension(file: File) {
  const fromName = file.name
    .split(".")
    .pop()
    ?.toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  if (fromName && fromName !== file.name.toLowerCase()) return fromName;
  const byMime: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "application/pdf": "pdf",
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  };
  return byMime[file.type] || "bin";
}

export async function uploadPrivateEvidenceFile(options: PrivateEvidenceUploadOptions, client: SupabaseClient = supabase) {
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError || !authData.user) throw new Error("login_required");
  if (options.file.size <= 0) throw new Error("empty_file");
  if (options.file.size > options.maxBytes) throw new Error("file_too_large");
  if (!options.allowedMimeTypes.includes(options.file.type)) throw new Error("unsupported_file_type");

  const folder = options.folder.split("/").filter(Boolean).map(safeStorageSegment).join("/");
  const fileName = `${safeStorageSegment(options.kind)}.${storageExtension(options.file)}`;
  const path = [authData.user.id, folder, fileName].filter(Boolean).join("/");
  const upload = () =>
    client.storage.from(options.bucket).upload(path, options.file, {
      cacheControl: "3600",
      contentType: options.file.type,
      upsert: options.upsert ?? true,
    });

  let result;
  try {
    result = await upload();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || "");
    if (!/failed to fetch|network|load failed/i.test(message)) throw error;
    await new Promise((resolve) => window.setTimeout(resolve, 350));
    result = await upload();
  }

  if (result.error) throw result.error;
  return path;
}

export async function createPrivateEvidenceUrl(bucket: string, storedValue?: string | null) {
  const value = String(storedValue || "").trim();
  if (!value) throw new Error("file_missing");
  if (/^blob:/i.test(value)) throw new Error("legacy_browser_url");
  if (/^data:/i.test(value)) throw new Error("legacy_inline_data");
  if (/^farmconnect:/i.test(value)) throw new Error("internal_record_reference");
  if (/^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value);
      const storageMatch = url.pathname.match(/\/storage\/v1\/object\/(?:public|authenticated|sign)\/([^/]+)\/(.+)$/i);
      if (!storageMatch) return value;
      const [, urlBucket, urlPath] = storageMatch;
      const { data, error } = await supabase.storage.from(urlBucket).createSignedUrl(decodeURIComponent(urlPath), 600);
      if (error) throw error;
      if (!data?.signedUrl) throw new Error("signed_url_missing");
      return data.signedUrl;
    } catch (error) {
      if (error instanceof TypeError) return value;
      throw error;
    }
  }
  if (!value.includes("/")) throw new Error("legacy_filename_only");

  const knownBuckets = ["caretaker-resumes", "caretaker-task-proofs", "farmconnect-customer-kyc", "withdrawal-proofs", "kyc-docs", "kyc-documents", "profile-photos"];
  const storedBucket = knownBuckets.find((candidate) => value.startsWith(`${candidate}/`));
  const resolvedBucket = storedBucket || bucket;
  const normalizedPath = storedBucket ? value.slice(storedBucket.length + 1) : value;
  const { data, error } = await supabase.storage.from(resolvedBucket).createSignedUrl(normalizedPath, 600);
  if (error) throw error;
  if (!data?.signedUrl) throw new Error("signed_url_missing");
  return data.signedUrl;
}
