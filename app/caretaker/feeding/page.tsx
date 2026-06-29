"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Caretaker = {
  id: string;
  caretaker_profile_id: string | null;
  email: string | null;
  full_name: string | null;
};

type PaidHire = {
  id: string;
  caretaker_id: string | null;
  customer_id: string | null;
  flock_id: string | null;
  animal_id: string | null;
  status: string | null;
  payment_status: string | null;
};

type Animal = {
  id: string;
  code: string | null;
  name: string | null;
  type: string | null;
  flock_id: string | null;
};

type AnimalRelation = Animal | Animal[] | null;

const navLinks = [
  { href: "/caretaker/dashboard", label: "Dashboard" },
  { href: "/caretaker/tasks", label: "Tasks" },
  { href: "/caretaker/feeding", label: "Feeding" },
  { href: "/caretaker/photos", label: "Photos" },
  { href: "/caretaker/weight", label: "Weight" },
  { href: "/caretaker/mortality", label: "Mortality" },
  { href: "/caretaker/notes", label: "Notes" },
];

type InventoryItem = {
  id: string;
  item_name: string | null;
  quantity: number | null;
  unit: string | null;
};

type FlockInventoryRelation = InventoryItem | InventoryItem[] | null;

type FeedingLog = {
  id: string;
  animal_id: string | null;
  inventory_id: string | null;
  qty_used: number | null;
  photo_url: string | null;
  status: string | null;
  created_at: string | null;
  animals: AnimalRelation;
  flock_inventory: FlockInventoryRelation;
};

export default function CaretakerFeedingPage() {
  const [caretaker, setCaretaker] = useState<Caretaker | null>(null);
  const [assignedAnimalIds, setAssignedAnimalIds] = useState<string[]>([]);
  const [assignedFlockIds, setAssignedFlockIds] = useState<string[]>([]);
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [history, setHistory] = useState<FeedingLog[]>([]);

  const [animalId, setAnimalId] = useState("");
  const [inventoryId, setInventoryId] = useState("");
  const [qtyUsed, setQtyUsed] = useState("");
  const [status, setStatus] = useState("FED TODAY");
  const [file, setFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const selectedInventory = useMemo(
    () => inventory.find((item) => item.id === inventoryId) || null,
    [inventory, inventoryId],
  );

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setMessage("");

    const context = await resolveCaretakerContext();

    if (!context.caretaker) {
      setCaretaker(null);
      setAssignedAnimalIds([]);
      setAssignedFlockIds([]);
      setAnimals([]);
      setInventory([]);
      setHistory([]);
      setMessage(context.message || "Please login as caretaker.");
      setLoading(false);
      return;
    }

    setCaretaker(context.caretaker);
    setAssignedAnimalIds(context.animalIds);
    setAssignedFlockIds(context.flockIds);

    await Promise.all([
      loadAnimals(context.animalIds, context.flockIds),
      loadInventory(context.flockIds),
      loadHistory(context.animalIds, context.flockIds),
    ]);

    setLoading(false);
  }

  async function loadAnimals(animalIds: string[], flockIds: string[]) {
    if (animalIds.length === 0 && flockIds.length === 0) {
      setAnimals([]);
      return;
    }

    let query = supabase
      .from("animals")
      .select("id, code, name, type, flock_id")
      .order("code", { ascending: true });

    if (animalIds.length > 0) {
      query = query.in("id", animalIds);
    } else {
      query = query.in("flock_id", flockIds);
    }

    const { data, error } = await query;

    if (error) {
      setAnimals([]);
      setMessage(`Animal load error: ${error.message}`);
      return;
    }

    const chickenOnly = (data || []).filter(isChicken);
    setAnimals(chickenOnly);
  }

  async function loadInventory(flockIds: string[]) {
    let query = supabase
      .from("flock_inventory")
      .select("id, item_name, quantity, unit")
      .order("item_name", { ascending: true });

    if (flockIds.length > 0) {
      query = query.in("flock_id", flockIds);
    }

    const { data, error } = await query;

    if (error) {
      setInventory([]);
      setMessage(`Inventory load error: ${error.message}`);
      return;
    }

    setInventory(data || []);
  }

  async function loadHistory(animalIds: string[], flockIds: string[]) {
    if (animalIds.length === 0 && flockIds.length === 0) {
      setHistory([]);
      return;
    }

    const { data, error } = await supabase
      .from("inventory_usage_logs")
      .select(`
        id,
        animal_id,
        inventory_id,
        qty_used,
        photo_url,
        status,
        created_at,
        animals (
          id,
          code,
          name,
          type,
          flock_id
        ),
        flock_inventory (
          id,
          item_name,
          quantity,
          unit
        )
      `)
      .order("created_at", { ascending: false })
      .limit(300);

    if (error) {
      setHistory([]);
      setMessage(`Feeding history load error: ${error.message}`);
      return;
    }

    const allowedAnimalIds = new Set(animalIds);
    const allowedFlockIds = new Set(flockIds);

    const chickenOnly = (data || []).filter((item: any) => {
      const animal = normalizeAnimal(item.animals);
      if (!isChicken(animal)) return false;
      if (allowedAnimalIds.size > 0 && allowedAnimalIds.has(String(item.animal_id))) return true;
      if (allowedFlockIds.size > 0 && allowedFlockIds.has(String(animal?.flock_id || ""))) return true;
      return false;
    });

    setHistory(chickenOnly as FeedingLog[]);
  }

  async function submitFeeding(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    const parsedQty = Number(qtyUsed);

    if (!caretaker) {
      setMessage("Caretaker session not found. Please login again.");
      setSaving(false);
      return;
    }

    if (!animalId || !isAssignedAnimal(animalId, animals)) {
      setMessage("Please select one assigned chicken.");
      setSaving(false);
      return;
    }

    if (!inventoryId || !selectedInventory) {
      setMessage("Please select a feed item.");
      setSaving(false);
      return;
    }

    if (!Number.isFinite(parsedQty) || parsedQty <= 0) {
      setMessage("Please enter a valid quantity used.");
      setSaving(false);
      return;
    }

    if (Number(selectedInventory.quantity || 0) < parsedQty) {
      setMessage("Not enough feed inventory for this quantity.");
      setSaving(false);
      return;
    }

    if (!file) {
      setMessage("Please upload a feeding proof photo.");
      setSaving(false);
      return;
    }

    const extension = file.name.split(".").pop() || "jpg";
    const path = `${caretaker.id}/${animalId}/${Date.now()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("feeding-proofs")
      .upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || "image/jpeg",
      });

    if (uploadError) {
      setMessage(`Feeding photo upload error: ${uploadError.message}`);
      setSaving(false);
      return;
    }

    const { data: publicUrlData } = supabase.storage
      .from("feeding-proofs")
      .getPublicUrl(path);

    const photoUrl = publicUrlData.publicUrl;

    const { error: insertError } = await supabase.from("inventory_usage_logs").insert({
      animal_id: animalId,
      inventory_id: inventoryId,
      qty_used: parsedQty,
      photo_url: photoUrl,
      status,
      created_at: new Date().toISOString(),
    });

    if (insertError) {
      setMessage(`Feeding log save error: ${insertError.message}`);
      setSaving(false);
      return;
    }

    const newQuantity = Number(selectedInventory.quantity || 0) - parsedQty;

    const { error: updateError } = await supabase
      .from("flock_inventory")
      .update({ quantity: newQuantity })
      .eq("id", inventoryId);

    if (updateError) {
      setMessage(`Inventory update error: ${updateError.message}`);
      setSaving(false);
      return;
    }

    setAnimalId("");
    setInventoryId("");
    setQtyUsed("");
    setStatus("FED TODAY");
    setFile(null);

    const input = document.getElementById("feeding-photo") as HTMLInputElement | null;
    if (input) input.value = "";

    setMessage("✅ Feeding record saved, proof uploaded, and inventory updated.");
    await Promise.all([
      loadInventory(assignedFlockIds),
      loadHistory(assignedAnimalIds, assignedFlockIds),
    ]);
    setSaving(false);
  }

  return (
    <main style={page}>
      <nav style={topNav}>
        <Link href="/caretaker/dashboard" style={back}>
          ← Dashboard
        </Link>
        <div style={navPills}>
          {navLinks.map((item) => (
            <Link key={item.href} href={item.href} style={navPill}>
              {item.label}
            </Link>
          ))}
        </div>
      </nav>

      <div style={container}>
        <section style={card}>
          <h1 style={title}>🐔 Chicken Feeding</h1>
          <p style={subtitle}>
            Record feeding proof for ACTIVE and PAID assigned chickens only.
          </p>

          {message && <div style={notice}>{message}</div>}

          {loading ? (
            <p style={muted}>Loading feeding form...</p>
          ) : (
            <form onSubmit={submitFeeding} style={form}>
              <label style={label}>Select Assigned Chicken</label>
              <select
                value={animalId}
                onChange={(e) => setAnimalId(e.target.value)}
                required
                style={input}
              >
                <option value="">Choose assigned chicken</option>
                {animals.map((animal) => (
                  <option key={animal.id} value={animal.id}>
                    {animal.name || "Unnamed Chicken"} — {animal.code || "No Code"} — {animal.type || "Chicken"}
                  </option>
                ))}
              </select>

              <label style={label}>Feed Item</label>
              <select
                value={inventoryId}
                onChange={(e) => setInventoryId(e.target.value)}
                required
                style={input}
              >
                <option value="">Choose feed item</option>
                {inventory.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.item_name || "Feed Item"} — Stock: {item.quantity ?? 0} {item.unit || ""}
                  </option>
                ))}
              </select>

              <label style={label}>Quantity Used</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={qtyUsed}
                onChange={(e) => setQtyUsed(e.target.value)}
                required
                placeholder="Example: 2"
                style={input}
              />

              <label style={label}>Feeding Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} required style={input}>
                <option value="FED TODAY">FED TODAY</option>
                <option value="NEED FEED SUPPLY">NEED FEED SUPPLY</option>
                <option value="EMERGENCY">EMERGENCY</option>
              </select>

              <label style={label}>Feeding Proof Photo</label>
              <input
                id="feeding-photo"
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                required
                style={input}
              />

              <button disabled={saving || animals.length === 0} style={button}>
                {saving ? "Saving..." : "Submit Feeding Record"}
              </button>
            </form>
          )}
        </section>

        <section style={historyCard}>
          <h2 style={sectionTitle}>Latest Feeding History</h2>

          {loading ? (
            <p style={muted}>Loading feeding history...</p>
          ) : history.length === 0 ? (
            <p style={muted}>No assigned chicken feeding records yet.</p>
          ) : (
            <div style={historyList}>
              {history.map((item) => {
                const animal = normalizeAnimal(item.animals);
                const inventoryItem = normalizeFlockInventory(item.flock_inventory);

                return (
                  <div key={item.id} style={historyItem}>
                    {item.photo_url ? (
                      <img src={item.photo_url} alt="Feeding proof" style={photoPreview} />
                    ) : (
                      <div style={noPhoto}>No Photo</div>
                    )}

                    <div>
                      <p style={typeText}>{animal?.type || "Chicken"}</p>
                      <h3 style={animalName}>{animal?.name || "Unnamed Chicken"}</h3>
                      <p style={animalCode}>Code: {animal?.code || "No code"}</p>
                      <p style={detailText}>Feed Item: {inventoryItem?.item_name || "Feed item"}</p>
                      <p style={detailText}>Quantity Used: {item.qty_used ?? 0} {inventoryItem?.unit || ""}</p>
                      <p style={statusText}>Status: {item.status || "FED TODAY"}</p>
                      <p style={dateText}>Date: {formatDate(item.created_at)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

async function resolveCaretakerContext() {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  const user = authData.user;

  if (authError || !user) {
    return { caretaker: null, animalIds: [], flockIds: [], message: "Please login as caretaker." };
  }

  const email = user.email || "";
  const { data: caretaker, error: caretakerError } = await supabase
    .from("caretakers")
    .select("id, caretaker_profile_id, email, full_name")
    .or(`caretaker_profile_id.eq.${user.id},email.eq.${email}`)
    .maybeSingle();

  if (caretakerError || !caretaker) {
    return { caretaker: null, animalIds: [], flockIds: [], message: "Caretaker profile not found." };
  }

  const { data: hires, error: hiresError } = await supabase
    .from("customer_caretaker_hires")
    .select("id, caretaker_id, customer_id, flock_id, animal_id, status, payment_status")
    .eq("caretaker_id", caretaker.id)
    .eq("status", "ACTIVE")
    .eq("payment_status", "PAID");

  if (hiresError) {
    return { caretaker, animalIds: [], flockIds: [], message: `Assigned job load error: ${hiresError.message}` };
  }

  const animalIds = unique((hires || []).map((hire: PaidHire) => hire.animal_id).filter(Boolean) as string[]);
  const flockIds = unique((hires || []).map((hire: PaidHire) => hire.flock_id).filter(Boolean) as string[]);

  if (animalIds.length === 0 && flockIds.length === 0) {
    return { caretaker, animalIds, flockIds, message: "No ACTIVE and PAID assigned chicken jobs yet." };
  }

  return { caretaker, animalIds, flockIds, message: "" };
}

function unique(values: string[]) {
  return Array.from(new Set(values));
}

function normalizeAnimal(value: AnimalRelation): Animal | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function normalizeFlockInventory(value: FlockInventoryRelation): InventoryItem | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function isChicken(animal: Animal | null | undefined) {
  const type = String(animal?.type || "").toLowerCase();
  const code = String(animal?.code || "").toUpperCase();

  if (["SWINE-002", "COW-001", "COW-002"].includes(code)) return false;

  return type.includes("chicken") || type.includes("poultry");
}

function isAssignedAnimal(animalId: string, animals: Animal[]) {
  return animals.some((animal) => animal.id === animalId);
}

function formatDate(value?: string | null) {
  if (!value) return "No date";
  return new Date(value).toLocaleString("en-PH");
}

const page: React.CSSProperties = {
  minHeight: "100vh",
  background: "radial-gradient(circle at top left, rgba(255,199,0,0.38), transparent 34%), linear-gradient(180deg, #ffffff 0%, #fff7cf 55%, #ffe68a 100%)",
  padding: "18px clamp(14px, 3vw, 28px) 28px",
  fontFamily: "Arial, sans-serif",
};

const topNav: React.CSSProperties = {
  maxWidth: 1020,
  margin: "0 auto 18px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
};

const navPills: React.CSSProperties = {
  display: "flex",
  gap: 8,
  overflowX: "auto",
  maxWidth: "100%",
  paddingBottom: 4,
};

const navPill: React.CSSProperties = {
  whiteSpace: "nowrap",
  textDecoration: "none",
  color: "#ca8a04",
  background: "rgba(255,255,255,0.88)",
  border: "1px solid rgba(14,165,233,0.18)",
  borderRadius: 999,
  padding: "10px 13px",
  fontSize: 13,
  fontWeight: 900,
};

const back: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  color: "#ca8a04",
  fontWeight: 950,
  textDecoration: "none",
  background: "rgba(255,255,255,0.9)",
  border: "1px solid rgba(14,165,233,0.18)",
  borderRadius: 999,
  padding: "10px 14px",
  boxShadow: "0 10px 22px rgba(15,23,42,0.06)",
};

const container: React.CSSProperties = {
  maxWidth: 1020,
  margin: "0 auto",
  display: "grid",
  gap: 20,
};

const card: React.CSSProperties = {
  background: "rgba(255,255,255,0.96)",
  borderRadius: 30,
  padding: "clamp(20px, 4vw, 30px)",
  boxShadow: "0 22px 48px rgba(15,23,42,0.10)",
  border: "1px solid rgba(255,255,255,0.75)",
};

const historyCard: React.CSSProperties = { ...card };

const title: React.CSSProperties = { fontSize: "clamp(28px, 5vw, 38px)", margin: 0, fontWeight: 950, color: "#0f172a" };

const sectionTitle: React.CSSProperties = { fontSize: 24, margin: "0 0 16px", fontWeight: 900 };

const subtitle: React.CSSProperties = { color: "#64748b", lineHeight: 1.6, fontWeight: 700 };

const form: React.CSSProperties = { display: "grid", gap: 13 };

const label: React.CSSProperties = { fontWeight: 900 };

const input: React.CSSProperties = {
  padding: "15px 16px",
  borderRadius: 16,
  border: "1px solid #cbd5e1",
  background: "#f8fafc",
  fontSize: 16,
  outlineColor: "#facc15",
  width: "100%",
  boxSizing: "border-box",
};

const button: React.CSSProperties = {
  marginTop: 10,
  padding: 17,
  borderRadius: 18,
  border: "none",
  background: "linear-gradient(135deg, #facc15, #fbbf24)",
  color: "white",
  fontSize: 17,
  fontWeight: 950,
  cursor: "pointer",
  boxShadow: "0 16px 30px rgba(14,165,233,0.24)",
};

const notice: React.CSSProperties = {
  background: "#fef3c7",
  color: "#854d0e",
  padding: 14,
  borderRadius: 16,
  marginBottom: 16,
  fontWeight: 850,
  lineHeight: 1.5,
};

const muted: React.CSSProperties = { color: "#64748b", fontWeight: 700 };

const historyList: React.CSSProperties = { display: "grid", gap: 12 };

const historyItem: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(110px, 140px) minmax(0, 1fr)",
  gap: 14,
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: 18,
  padding: 16,
};

const photoPreview: React.CSSProperties = {
  width: 140,
  height: 110,
  objectFit: "cover",
  borderRadius: 16,
  border: "1px solid #cbd5e1",
};

const noPhoto: React.CSSProperties = {
  width: 140,
  height: 110,
  display: "grid",
  placeItems: "center",
  borderRadius: 16,
  background: "#e2e8f0",
  color: "#64748b",
  fontWeight: 900,
};

const typeText: React.CSSProperties = {
  margin: 0,
  color: "#ca8a04",
  fontSize: 12,
  fontWeight: 900,
  textTransform: "uppercase",
};

const animalName: React.CSSProperties = {
  margin: "4px 0",
  color: "#0f172a",
  fontSize: 20,
  fontWeight: 900,
};

const animalCode: React.CSSProperties = {
  margin: 0,
  color: "#64748b",
  fontSize: 14,
  fontWeight: 700,
};

const detailText: React.CSSProperties = {
  margin: "8px 0 0",
  color: "#334155",
  fontWeight: 700,
};

const statusText: React.CSSProperties = {
  margin: "8px 0 0",
  color: "#854d0e",
  fontWeight: 900,
};

const dateText: React.CSSProperties = {
  margin: "8px 0 0",
  color: "#64748b",
  fontSize: 13,
};
