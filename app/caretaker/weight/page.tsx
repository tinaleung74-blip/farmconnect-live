"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Caretaker = {
  id: string;
  caretaker_profile_id: string | null;
  email: string | null;
  full_name: string | null;
};

type PaidHire = {
  animal_id: string | null;
  flock_id: string | null;
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

type AnimalWeight = {
  id: string;
  animal_id: string;
  weight_kg: number | null;
  note: string | null;
  recorded_at: string | null;
  animals: AnimalRelation;
};

export default function WeightPage() {
  const [caretaker, setCaretaker] = useState<Caretaker | null>(null);
  const [assignedAnimalIds, setAssignedAnimalIds] = useState<string[]>([]);
  const [assignedFlockIds, setAssignedFlockIds] = useState<string[]>([]);
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [weights, setWeights] = useState<AnimalWeight[]>([]);
  const [animalId, setAnimalId] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

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
      setWeights([]);
      setMessage(context.message || "Please login as caretaker.");
      setLoading(false);
      return;
    }

    setCaretaker(context.caretaker);
    setAssignedAnimalIds(context.animalIds);
    setAssignedFlockIds(context.flockIds);

    await Promise.all([
      loadAnimals(context.animalIds, context.flockIds),
      loadWeights(context.animalIds, context.flockIds),
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

    query = animalIds.length > 0 ? query.in("id", animalIds) : query.in("flock_id", flockIds);

    const { data, error } = await query;

    if (error) {
      setAnimals([]);
      setMessage(`Animal load error: ${error.message}`);
      return;
    }

    setAnimals((data || []).filter(isChicken));
  }

  async function loadWeights(animalIds: string[], flockIds: string[]) {
    if (animalIds.length === 0 && flockIds.length === 0) {
      setWeights([]);
      return;
    }

    const { data, error } = await supabase
      .from("animal_weights")
      .select(`
        id,
        animal_id,
        weight_kg,
        note,
        recorded_at,
        animals (
          id,
          code,
          name,
          type,
          flock_id
        )
      `)
      .order("recorded_at", { ascending: false })
      .limit(300);

    if (error) {
      setWeights([]);
      setMessage(`Weight history load error: ${error.message}`);
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

    setWeights(chickenOnly as AnimalWeight[]);
  }

  async function submitUpdate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    const parsedWeight = Number(weightKg);

    if (!caretaker) {
      setMessage("Caretaker session not found. Please login again.");
      setSaving(false);
      return;
    }

    if (!animalId || !animals.some((animal) => animal.id === animalId)) {
      setMessage("Please select one assigned chicken.");
      setSaving(false);
      return;
    }

    if (!Number.isFinite(parsedWeight) || parsedWeight <= 0) {
      setMessage("Please enter a valid weight in kg.");
      setSaving(false);
      return;
    }

    const { error } = await supabase.from("animal_weights").insert({
      animal_id: animalId,
      weight_kg: parsedWeight,
      note: note.trim() || null,
      recorded_at: new Date().toISOString(),
    });

    if (error) {
      setMessage(`Weight save error: ${error.message}`);
      setSaving(false);
      return;
    }

    setAnimalId("");
    setWeightKg("");
    setNote("");
    setMessage("✅ Weight update saved and synced.");
    await loadWeights(assignedAnimalIds, assignedFlockIds);
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
          <h1 style={title}>⚖️ Chicken Weight Update</h1>
          <p style={subtitle}>
            Submit weight only for ACTIVE and PAID assigned chickens.
          </p>

          {message && <div style={notice}>{message}</div>}

          {loading ? (
            <p style={muted}>Loading assigned chickens...</p>
          ) : (
            <form onSubmit={submitUpdate} style={form}>
              <label style={label}>Select Assigned Chicken</label>
              <select value={animalId} onChange={(e) => setAnimalId(e.target.value)} required style={input}>
                <option value="">Choose assigned chicken</option>
                {animals.map((animal) => (
                  <option key={animal.id} value={animal.id}>
                    {animal.name || "Unnamed Chicken"} — {animal.code || "No Code"} — {animal.type || "Chicken"}
                  </option>
                ))}
              </select>

              <label style={label}>Weight (kg)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                required
                placeholder="Example: 1.25"
                style={input}
              />

              <label style={label}>Note</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Optional caretaker note"
                style={textarea}
              />

              <button disabled={saving || animals.length === 0} style={button}>
                {saving ? "Saving..." : "Submit Weight Update"}
              </button>
            </form>
          )}
        </section>

        <section style={historyCard}>
          <h2 style={sectionTitle}>Latest Chicken Weight History</h2>

          {loading ? (
            <p style={muted}>Loading weight history...</p>
          ) : weights.length === 0 ? (
            <p style={muted}>No assigned chicken weight records yet.</p>
          ) : (
            <div style={historyList}>
              {weights.map((item) => {
                const animal = normalizeAnimal(item.animals);

                return (
                  <div key={item.id} style={historyItem}>
                    <div>
                      <p style={typeText}>{animal?.type || "Chicken"}</p>
                      <h3 style={animalName}>{animal?.name || "Unnamed Chicken"}</h3>
                      <p style={animalCode}>Code: {animal?.code || "No code"}</p>
                      <p style={weightText}>{item.weight_kg ?? "—"} kg</p>
                      <p style={noteText}>{item.note || "No note."}</p>
                    </div>

                    <p style={dateText}>{formatDate(item.recorded_at)}</p>
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
    .select("animal_id, flock_id")
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

function isChicken(animal: Animal | null | undefined) {
  const type = String(animal?.type || "").toLowerCase();
  const code = String(animal?.code || "").toUpperCase();
  if (["SWINE-002", "COW-001", "COW-002"].includes(code)) return false;
  return type.includes("chicken") || type.includes("poultry");
}

function formatDate(value?: string | null) {
  if (!value) return "No date";
  return new Date(value).toLocaleString("en-PH");
}

const page: React.CSSProperties = {
  minHeight: "100vh",
  background: "radial-gradient(circle at top left, rgba(14,165,233,0.18), transparent 32%), linear-gradient(180deg, #dbeafe, #ecfccb)",
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
  color: "#0369a1",
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
  color: "#0369a1",
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
  outlineColor: "#0ea5e9",
  width: "100%",
  boxSizing: "border-box",
};

const textarea: React.CSSProperties = { ...input, minHeight: 110 };

const button: React.CSSProperties = {
  marginTop: 10,
  padding: 17,
  borderRadius: 18,
  border: "none",
  background: "linear-gradient(135deg, #0284c7, #0ea5e9)",
  color: "white",
  fontSize: 17,
  fontWeight: 950,
  cursor: "pointer",
  boxShadow: "0 16px 30px rgba(14,165,233,0.24)",
};

const notice: React.CSSProperties = {
  background: "#dbeafe",
  color: "#075985",
  padding: 14,
  borderRadius: 16,
  marginBottom: 16,
  fontWeight: 850,
  lineHeight: 1.5,
};

const muted: React.CSSProperties = { color: "#64748b", fontWeight: 700 };

const historyList: React.CSSProperties = { display: "grid", gap: 12 };

const historyItem: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "space-between",
  gap: 16,
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: 18,
  padding: 16,
};

const typeText: React.CSSProperties = {
  margin: 0,
  color: "#15803d",
  fontSize: 12,
  fontWeight: 900,
  textTransform: "uppercase",
};

const animalName: React.CSSProperties = {
  margin: "4px 0",
  color: "#14532d",
  fontSize: 20,
  fontWeight: 900,
};

const animalCode: React.CSSProperties = {
  margin: 0,
  color: "#64748b",
  fontSize: 14,
  fontWeight: 700,
};

const weightText: React.CSSProperties = {
  margin: "10px 0 0",
  color: "#075985",
  fontSize: 24,
  fontWeight: 900,
};

const noteText: React.CSSProperties = { margin: "4px 0 0", color: "#334155" };

const dateText: React.CSSProperties = {
  margin: 0,
  color: "#64748b",
  fontSize: 13,
  whiteSpace: "nowrap",
};
