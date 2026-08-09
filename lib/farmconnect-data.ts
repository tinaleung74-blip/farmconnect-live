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

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getCurrentCaretakerProfile() {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const { data, error } = await supabase
    .from("caretakers")
    .select("id,profile_id,full_name,display_name,email,phone,farm_role,status,avatar_url,resume_url,resume_review_status")
    .eq("profile_id", profile.id)
    .maybeSingle();

  if (error) throw error;
  return data ? { ...data, profile } : { profile };
}

export async function getFarmProducts() {
  const { data, error } = await supabase
    .from("farm_products")
    .select("id,name,category,unit_label,unit_price,image_url,description,stock_quantity,status,product_type,stage,bloodline,breed,product_metadata")
    .eq("status", "available")
    .order("category", { ascending: true })
    .order("name", { ascending: true });

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

  const { data: existing, error: findError } = await supabase
    .from("farm_cart_items")
    .select("id")
    .eq("profile_id", profile.id)
    .eq("product_id", productId)
    .eq("status", "active")
    .maybeSingle();

  if (findError && !/multiple|no rows/i.test(findError.message)) throw findError;

  const query = existing?.id
    ? supabase.from("farm_cart_items").update(payload).eq("id", existing.id)
    : supabase.from("farm_cart_items").insert(payload);

  const { error } = await query;

  if (error && /farm_request_id|caretaker_task_id|animal_id|purpose_note|product_type|bloodline_snapshot|breed_snapshot|product_name_snapshot/i.test(error.message)) {
    const fallbackPayload = {
      profile_id: profile.id,
      product_id: productId,
      quantity,
      unit_price: unitPrice,
      status: "active",
    };
    const fallbackQuery = existing?.id
      ? supabase.from("farm_cart_items").update(fallbackPayload).eq("id", existing.id)
      : supabase.from("farm_cart_items").insert(fallbackPayload);
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
  const { data, error } = await supabase
    .from("animals")
    .select("*")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}


export async function getCustomerOwnedRoosters() {
  const profile = await getCurrentProfile();
  if (!profile) return [];

  const { data, error } = await supabase
    .from("customer_animals")
    .select("id,animal_name,animal_code,status,acquired_from,acquired_at,source_product_id,source_product_name,bloodline_snapshot,breed_snapshot,ownership_metadata,sale_status,approved_sale_price,sold_at")
    .eq("profile_id", profile.id)
    .neq("status", "sold")
    .order("acquired_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getCustomerInventoryItems() {
  const profile = await getCurrentProfile();
  if (!profile) return [];

  const { data, error } = await supabase
    .from("customer_inventory_items")
    .select("id,product_id,product_name,category,unit_label,unit_price,image_url,quantity,product_type,bloodline,breed,updated_at")
    .eq("profile_id", profile.id)
    .order("updated_at", { ascending: false });

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

  const { data, error } = await supabase
    .from("farm_care_requests")
    .select("*")
    .eq("profile_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw error;
  return data || [];
}

export async function getAdminCareRequests() {
  const { data, error } = await supabase
    .from("farm_care_requests")
    .select("*, profiles(full_name,email,display_name), caretakers(full_name,display_name)")
    .order("created_at", { ascending: false })
    .limit(80);

  if (error) throw error;
  return (data || []).map((row: any) => {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    const storedName = String(row.customer_name || "").trim();
    const customerName =
      profile?.display_name ||
      profile?.full_name ||
      profile?.email ||
      (storedName.toLowerCase() !== "customer" ? storedName : "") ||
      row.customer_email ||
      "Customer";

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
  const { data, error } = await supabase
    .from("caretakers")
    .select("id,full_name,display_name,farm_role,status")
    .in("status", ["active", "approved", "on_duty"])
    .order("full_name", { ascending: true })
    .limit(100);

  if (error) throw error;
  return data || [];
}

export async function getAdminCaretakerDirectory() {
  const { data, error } = await supabase
    .from("caretakers")
    .select("*")
    .order("full_name", { ascending: true })
    .limit(200);

  if (error) throw error;
  return data || [];
}

export async function getAdminCaretakerTasks() {
  const { data: tasks, error } = await supabase
    .from("caretaker_tasks")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) throw error;
  const rows = tasks || [];
  const profileIds = Array.from(new Set(rows.map(row => row.profile_id).filter(Boolean)));
  const caretakerIds = Array.from(new Set(rows.map(row => row.caretaker_id).filter(Boolean)));
  const profileMap = new Map<string, any>();
  const caretakerMap = new Map<string, any>();

  if (profileIds.length) {
    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("id,full_name,display_name,email")
      .in("id", profileIds);
    if (profileError) throw profileError;
    for (const profile of profiles || []) profileMap.set(profile.id, profile);
  }

  if (caretakerIds.length) {
    const { data: caretakers, error: caretakerError } = await supabase
      .from("caretakers")
      .select("id,full_name,display_name,email")
      .in("id", caretakerIds);
    if (caretakerError) throw caretakerError;
    for (const caretaker of caretakers || []) caretakerMap.set(caretaker.id, caretaker);
  }

  return rows.map(row => ({
    ...row,
    profiles: profileMap.get(row.profile_id) || null,
    caretakers: caretakerMap.get(row.caretaker_id) || null,
  }));
}

export async function getCaretakerActiveTasks() {
  const { data, error } = await supabase
    .from("caretaker_tasks")
    .select("*")
    .in("status", ["active", "in_progress", "backjob"])
    .order("due_at", { ascending: true })
    .limit(80);

  if (error) throw error;
  return data || [];
}

export async function submitCaretakerTaskProof(payload: {
  taskId: string;
  proofUrl?: string | null;
  proofUrls?: string[];
  presetNote?: string | null;
  freeNote?: string | null;
  qrVerified?: boolean;
  serialException?: boolean;
  feedQuantityUsed?: number | null;
  feedUnit?: string | null;
}) {
  const proofUrls = (payload.proofUrls || [payload.proofUrl]).filter((value): value is string => Boolean(value));
  const { data, error } = await supabase.rpc("caretaker_submit_task_proof_v3", {
    p_task_id: payload.taskId,
    p_proof_urls: proofUrls,
    p_preset_note: payload.presetNote || null,
    p_free_note: payload.freeNote || null,
    p_qr_verified: payload.qrVerified ?? true,
    p_serial_exception: payload.serialException ?? false,
    p_feed_quantity_used: payload.feedQuantityUsed ?? null,
    p_feed_unit: payload.feedUnit || null,
  });

  if (error) throw error;
  return data as string;
}

export async function getAdminTaskProofs() {
  const { data: proofs, error } = await supabase
    .from("task_proofs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(80);

  if (error) throw error;
  const rows = proofs || [];
  const taskIds = Array.from(new Set(rows.map(row => row.caretaker_task_id || row.task_id).filter(Boolean)));
  const caretakerIds = Array.from(new Set(rows.map(row => row.caretaker_id).filter(Boolean)));

  const taskMap = new Map<string, any>();
  if (taskIds.length) {
    const { data: tasks, error: taskError } = await supabase
      .from("caretaker_tasks")
      .select("id,profile_id,task_type,rooster_name,rooster_tag,status,workflow_type,qr_scan_required,qr_payload,task_metadata,reviewed_at")
      .in("id", taskIds);
    if (taskError) throw taskError;
    for (const task of tasks || []) taskMap.set(task.id, task);
  }

  const caretakerMap = new Map<string, any>();
  if (caretakerIds.length) {
    const { data: caretakers, error: caretakerError } = await supabase
      .from("caretakers")
      .select("id,full_name,display_name")
      .in("id", caretakerIds);
    if (caretakerError) throw caretakerError;
    for (const caretaker of caretakers || []) caretakerMap.set(caretaker.id, caretaker);
  }

  const profileIds = Array.from(new Set(Array.from(taskMap.values()).map(task => task.profile_id).filter(Boolean)));
  const profileMap = new Map<string, any>();
  if (profileIds.length) {
    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("id,full_name,display_name,email")
      .in("id", profileIds);
    if (profileError) throw profileError;
    for (const profile of profiles || []) profileMap.set(profile.id, profile);
  }

  return rows.map(row => ({
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

export async function getCustomerRoosterSaleRequest(customerAnimalId: string) {
  const { data, error } = await supabase
    .from("rooster_sale_requests")
    .select("*")
    .eq("customer_animal_id", customerAnimalId)
    .not("status", "in", "(completed,cancelled)")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
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
  const { data, error } = await supabase
    .from("rooster_sale_requests")
    .select("*, customer_animals(animal_name,animal_code,breed_snapshot,bloodline_snapshot,ownership_metadata), profiles!rooster_sale_requests_profile_id_fkey(full_name,display_name,email)")
    .in("status", ["sale_requested", "sale_rejected", "release_pending_assignment", "release_assigned", "release_submitted"])
    .order("created_at", { ascending: true });
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

export async function submitCaretakerRoosterSaleTask(payload: {
  taskId: string;
  declaredAmount?: number | null;
  proofUrls?: string[];
  freeNote: string;
  qrVerified?: boolean;
  serialException?: boolean;
}) {
  const { data, error } = await supabase.rpc("caretaker_submit_rooster_sale_task", {
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
  const { data, error } = await supabase
    .from("wallet_transactions")
    .select("*")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) throw error;
  return data || [];
}

export async function getInboxItems(profileId: string) {
  const { data, error } = await supabase
    .from("inbox_items")
    .select("*")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false })
    .limit(50);

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
};

function formatDateTime(value?: string | null) {
  if (!value) return { uploaded: "Today", time: "" };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { uploaded: "Today", time: "" };
  return {
    uploaded: date.toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" }),
    time: date.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" }),
  };
}

function prettyStatus(status?: string | null) {
  const raw = String(status || "pending").replaceAll("_", " ");
  return raw.replace(/\b\w/g, char => char.toUpperCase());
}

export async function getCareLogRecords(): Promise<CareLogRecord[]> {
  const records: CareLogRecord[] = [];
  const profile = await getCurrentProfile();
  if (!profile?.id) return records;

  const { data: usageRows, error: usageError } = await supabase
    .from("inventory_usage_logs")
    .select(`
      id,
      quantity_used,
      unit,
      note,
      created_at,
      farm_products(name, unit_price, unit_label, image_url),
      animals(name, code, pen_location),
      caretakers(full_name, display_name)
    `)
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

  const { data: proofRows, error: proofError } = await supabase
    .from("task_proofs")
    .select("id,caretaker_task_id,task_id,caretaker_id,profile_id,proof_type,proof_url,thumbnail_url,proof_file_urls,preset_note,free_note,captured_at,admin_review_status,proof_check_status,created_at")
    .eq("profile_id", profile.id)
    .eq("admin_review_status", "approved")
    .order("created_at", { ascending: false })
    .limit(50);

  if (proofError) throw proofError;

  const approvedProofs = proofRows || [];
  const taskIds = Array.from(new Set(approvedProofs.map(row => row.caretaker_task_id || row.task_id).filter(Boolean)));
  const caretakerIds = Array.from(new Set(approvedProofs.map(row => row.caretaker_id).filter(Boolean)));
  const taskMap = new Map<string, any>();
  const caretakerMap = new Map<string, any>();

  if (taskIds.length) {
    const { data: tasks, error: taskError } = await supabase
      .from("caretaker_tasks")
      .select("id,task_type,rooster_name,rooster_tag,status,workflow_type")
      .in("id", taskIds);
    if (taskError) throw taskError;
    for (const task of tasks || []) taskMap.set(task.id, task);
  }

  if (caretakerIds.length) {
    const { data: caretakers, error: caretakerError } = await supabase
      .from("caretakers")
      .select("id,full_name,display_name")
      .in("id", caretakerIds);
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
  const { data, error } = await supabase
    .from("caretaker_tasks")
    .select("*")
    .eq("caretaker_id", caretakerId)
    .in("status", ["active", "submitted", "needs_review"])
    .order("due_at", { ascending: true });

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

export type ManualPaymentSource = "farm_buy" | "care_request" | "cashin" | "other";

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

  const { data, error } = await supabase
    .from("manual_payment_requests")
    .select("*")
    .eq("profile_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw error;
  return data || [];
}

export async function getAdminManualPaymentRequests() {
  const { data, error } = await supabase
    .from("manual_payment_requests")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(80);

  if (error) throw error;
  const rows = data || [];
  const profileIds = Array.from(new Set(rows.map((row: any) => row.profile_id).filter(Boolean)));
  if (!profileIds.length) return rows;

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id,full_name,email,display_name")
    .in("id", profileIds);

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

  const { data, error } = await supabase
    .from("customer_payout_methods")
    .select("id,provider,account_holder,account_number,status,is_default,created_at,updated_at")
    .eq("profile_id", profile.id)
    .eq("status", "active")
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });

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
  });

  if (error) throw error;
  const result = data as GuardedWorkflowResult;
  if (!result?.id) throw new Error("WORKFLOW_RESULT_MISSING");
  return result;
}

export async function getCustomerWithdrawalRequests() {
  const profile = await getCurrentProfile();
  if (!profile) return [];

  const { data, error } = await supabase
    .from("withdrawal_requests")
    .select("*")
    .eq("profile_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw error;
  return data || [];
}

export async function getAdminWithdrawalRequests() {
  const { data, error } = await supabase
    .from("withdrawal_requests")
    .select("*, profiles!withdrawal_requests_profile_id_fkey(full_name,email,display_name)")
    .order("created_at", { ascending: false })
    .limit(80);

  if (error) throw error;
  return data || [];
}

export async function adminReviewWithdrawalRequest(
  withdrawalRequestId: string,
  decision: "approved" | "rejected" | "needs_info",
  adminNote: string,
  adminReferenceNumber?: string | null,
  adminReceiptUrl?: string | null,
  adminReceiptFileName?: string | null,
) {
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

export async function getCaretakerApplications(statuses?: string[]) {
  let query = supabase
    .from("caretaker_applications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(80);

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

  const { data, error } = await supabase
    .from("customer_kyc_profiles")
    .select("*")
    .eq("profile_id", profile.id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const row = data as Record<string, unknown>;
  const status = String(row.status || row.verification_status || row.review_status || "submitted").trim().toLowerCase();
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
  const { data: kycRows, error: kycError } = await supabase
    .from("customer_kyc_profiles")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (kycError) throw kycError;

  const rows = (kycRows || []) as CustomerKycRecord[];
  const profileIds = [...new Set(rows.map(row => row.profile_id).filter(Boolean))];
  const kycIds = rows.map(row => row.id).filter(Boolean);

  const profilesResult = profileIds.length
    ? await supabase
        .from("profiles")
        .select("id,auth_user_id,full_name,display_name,email,phone,birthdate,verification_status,account_status,kyc_risk_level,kyc_verified_at")
        .in("id", profileIds)
    : { data: [], error: null };

  if (profilesResult.error) throw profilesResult.error;

  const documentsResult = kycIds.length
    ? await supabase
        .from("kyc_documents")
        .select("id,kyc_profile_id,document_type,file_url,status,quality_result,created_at")
        .in("kyc_profile_id", kycIds)
        .order("created_at", { ascending: false })
    : { data: [], error: null };

  if (documentsResult.error) throw documentsResult.error;

  const profiles = (profilesResult.data || []) as VerificationProfileSummary[];
  const documents = (documentsResult.data || []) as VerificationDocumentSummary[];
  const profileById = new Map(profiles.map(profile => [profile.id, profile]));
  const documentsByKycId = new Map<string, VerificationDocumentSummary[]>();
  for (const document of documents) {
    const current = documentsByKycId.get(document.kyc_profile_id) || [];
    current.push(document);
    documentsByKycId.set(document.kyc_profile_id, current);
  }

  return rows.map(row => ({
    ...row,
    profile: profileById.get(row.profile_id) || null,
    documents: documentsByKycId.get(row.id) || [],
  }));
}

export async function adminReviewCustomerKyc(
  kycProfileId: string,
  decision: "approved" | "rejected",
  note: string,
  riskLevel: "low" | "medium" | "high" = "low",
) {
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
  return value.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "file";
}

function storageExtension(file: File) {
  const fromName = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "");
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

  const folder = options.folder
    .split("/")
    .filter(Boolean)
    .map(safeStorageSegment)
    .join("/");
  const fileName = `${safeStorageSegment(options.kind)}.${storageExtension(options.file)}`;
  const path = [authData.user.id, folder, fileName].filter(Boolean).join("/");
  const { error } = await client.storage
    .from(options.bucket)
    .upload(path, options.file, {
      cacheControl: "3600",
      contentType: options.file.type,
      upsert: options.upsert ?? true,
    });

  if (error) throw error;
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
  const storedBucket = knownBuckets.find(candidate => value.startsWith(`${candidate}/`));
  const resolvedBucket = storedBucket || bucket;
  const normalizedPath = storedBucket ? value.slice(storedBucket.length + 1) : value;
  const { data, error } = await supabase.storage.from(resolvedBucket).createSignedUrl(normalizedPath, 600);
  if (error) throw error;
  if (!data?.signedUrl) throw new Error("signed_url_missing");
  return data.signedUrl;
}

