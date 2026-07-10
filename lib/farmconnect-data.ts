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
    .select("id,name,category,unit_label,unit_price,image_url,description,stock_quantity,status")
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
  };

  const { error } = await supabase
    .from("farm_cart_items")
    .upsert(payload, { onConflict: "profile_id,product_id" });

  if (error && /farm_request_id|caretaker_task_id|animal_id|purpose_note/i.test(error.message)) {
    const { error: fallbackError } = await supabase
      .from("farm_cart_items")
      .upsert(
        {
          profile_id: profile.id,
          product_id: productId,
          quantity,
          unit_price: unitPrice,
          status: "active",
        },
        { onConflict: "profile_id,product_id" },
      );
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
