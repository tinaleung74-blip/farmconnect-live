import { supabase } from "@/lib/supabase";

export type AppRole = "customer" | "caretaker" | "admin";

export async function getCurrentProfile() {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("auth_user_id", authData.user.id)
    .maybeSingle();

  if (error) throw error;
  return data;
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
    .select("id,animal_name,animal_code,status,acquired_from,acquired_at,source_product_id,source_product_name,bloodline_snapshot,breed_snapshot,ownership_metadata")
    .eq("profile_id", profile.id)
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
  return data || [];
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
  presetNote?: string | null;
  freeNote?: string | null;
  qrVerified?: boolean;
  serialException?: boolean;
  feedQuantityUsed?: number | null;
  feedUnit?: string | null;
}) {
  const { data, error } = await supabase.rpc("caretaker_submit_task_proof", {
    p_task_id: payload.taskId,
    p_proof_url: payload.proofUrl || null,
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
  const { data, error } = await supabase
    .from("task_proofs")
    .select("*, caretaker_tasks(task_type,rooster_name,rooster_tag,status), caretakers(full_name,display_name)")
    .order("created_at", { ascending: false })
    .limit(80);

  if (error) throw error;
  return data || [];
}

export async function adminReviewTaskProof(proofId: string, decision: "approved" | "rejected" | "backjob", note?: string | null) {
  const { data, error } = await supabase.rpc("admin_review_task_proof", {
    p_proof_id: proofId,
    p_decision: decision,
    p_admin_note: note || null,
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
    .select(`
      id,
      proof_type,
      proof_url,
      thumbnail_url,
      preset_note,
      free_note,
      captured_at,
      admin_review_status,
      proof_check_status,
      created_at,
      caretaker_tasks(task_type),
      animals(name, code, pen_location),
      caretakers(full_name, display_name)
    `)
    .order("created_at", { ascending: false })
    .limit(50);

  if (proofError && !/relationship|schema cache/i.test(proofError.message)) throw proofError;

  for (const row of proofRows || []) {
    const task = Array.isArray(row.caretaker_tasks) ? row.caretaker_tasks[0] : row.caretaker_tasks;
    const animal = Array.isArray(row.animals) ? row.animals[0] : row.animals;
    const caretaker = Array.isArray(row.caretakers) ? row.caretakers[0] : row.caretakers;
    const { uploaded, time } = formatDateTime(row.captured_at || row.created_at);
    const title = task?.task_type || `${prettyStatus(row.proof_type)} Update`;
    records.push({
      rooster: animal?.name || animal?.code || "Rooster",
      title,
      type: prettyStatus(row.proof_type),
      item: row.preset_note || row.free_note || "Care proof",
      amount: "1 upload",
      productCost: 0,
      laborCost: 0,
      detail: row.free_note || row.preset_note || "Caretaker uploaded care proof.",
      status: row.admin_review_status === "approved" ? "Approved" : row.proof_check_status === "passed" ? "Verified" : "Waiting Review",
      caretaker: caretaker?.display_name || caretaker?.full_name || "Caretaker",
      uploaded,
      time,
      proof: prettyStatus(row.proof_type),
      reviewer: prettyStatus(row.admin_review_status || row.proof_check_status),
      image: row.thumbnail_url || row.proof_url || "/farmconnect/roosters/fc-stage-3-young-rooster-base.jpg",
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
};

export async function submitManualPaymentRequest(payload: ManualPaymentPayload) {
  const { data, error } = await supabase.rpc("customer_submit_manual_payment", {
    p_source_type: payload.sourceType,
    p_source_ref: payload.sourceRef || null,
    p_amount_expected: payload.amountExpected,
    p_summary: payload.summary || {},
    p_payment_method: payload.paymentMethod,
    p_receiver_account: payload.receiverAccount,
    p_sender_name: payload.senderName,
    p_reference_number: payload.referenceNumber,
    p_receipt_image_url: payload.receiptImageUrl || null,
  });

  if (error) throw error;
  return data as string;
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
    .select("*, profiles(full_name,email,display_name)")
    .order("created_at", { ascending: false })
    .limit(80);

  if (error) throw error;
  return data || [];
}

export async function adminReviewManualPayment(paymentRequestId: string, decision: "approved" | "rejected" | "needs_info", note: string) {
  const { data, error } = await supabase.rpc("admin_review_manual_payment", {
    p_payment_request_id: paymentRequestId,
    p_decision: decision,
    p_admin_note: note || null,
  });

  if (error) throw error;
  return data as string;
}


export type WithdrawalRequestPayload = {
  amount: number;
  payoutMethod: string;
  payoutHolder: string;
  payoutAccount: string;
  customerNote?: string | null;
};

export async function submitWithdrawalRequest(payload: WithdrawalRequestPayload) {
  const { data, error } = await supabase.rpc("customer_submit_withdrawal_request", {
    p_amount: payload.amount,
    p_payout_method: payload.payoutMethod,
    p_payout_holder: payload.payoutHolder,
    p_payout_account: payload.payoutAccount,
    p_customer_note: payload.customerNote || null,
  });

  if (error) throw error;
  return data as string;
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
  const { data, error } = await supabase.rpc("admin_review_withdrawal_request", {
    p_withdrawal_request_id: withdrawalRequestId,
    p_decision: decision,
    p_admin_note: adminNote || null,
    p_admin_reference_number: adminReferenceNumber || null,
    p_admin_receipt_url: adminReceiptUrl || null,
    p_admin_receipt_file_name: adminReceiptFileName || null,
  });

  if (error) throw error;
  return data as string;
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

export async function submitCaretakerApplication(payload: CaretakerApplicationPayload) {
  const { data, error } = await supabase.rpc("submit_caretaker_application", {
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

export async function getCaretakerApplications() {
  const { data, error } = await supabase
    .from("caretaker_applications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(80);

  if (error) throw error;
  return data || [];
}

export async function adminReviewCaretakerApplication(applicationId: string, decision: "approved" | "rejected" | "needs_info", note: string) {
  const { data, error } = await supabase.rpc("admin_review_caretaker_application", {
    p_application_id: applicationId,
    p_decision: decision,
    p_note: note || null,
  });

  if (error) throw error;
  return data as string;
}

