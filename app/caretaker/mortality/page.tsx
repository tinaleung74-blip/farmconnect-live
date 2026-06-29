"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Animal = {
  id: string;
  code: string | null;
  name: string | null;
  type: string | null;
};

type AnimalRelation = Animal | Animal[] | null;

type MortalityLog = {
  id: string;
  animal_id: string | null;
  mortality_count: number | null;
  reason: string | null;
  notes: string | null;
  created_at: string | null;
  animals: AnimalRelation;
};

export default function CaretakerMortalityPage() {
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [history, setHistory] = useState<MortalityLog[]>([]);

  const [animalId, setAnimalId] = useState("");
  const [mortalityCount, setMortalityCount] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const selectedAnimal = useMemo(
    () => animals.find((animal) => animal.id === animalId) || null,
    [animals, animalId],
  );

  const totalMortality = useMemo(() => {
    return history.reduce((sum, item) => sum + Number(item.mortality_count || 0), 0);
  }, [history]);

  const latestRecord = history[0] || null;

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setMessage("");

    await Promise.all([loadAnimals(), loadHistory()]);

    setLoading(false);
  }

  async function loadAnimals() {
    const { data, error } = await supabase
      .from("animals")
      .select("id, code, name, type")
      .order("code", { ascending: true });

    if (error) {
      setAnimals([]);
      setMessage(`Animal load error: ${error.message}`);
      return;
    }

    const chickenOnly = (data || []).filter(isChicken);

    setAnimals(chickenOnly);
  }

  async function loadHistory() {
    const { data, error } = await supabase
      .from("mortality_logs")
      .select(`
        id,
        animal_id,
        mortality_count,
        reason,
        notes,
        created_at,
        animals (
          id,
          code,
          name,
          type
        )
      `)
      .order("created_at", { ascending: false })
      .limit(300);

    if (error) {
      setHistory([]);
      setMessage(`Mortality history load error: ${error.message}`);
      return;
    }

    const chickenOnly = (data || []).filter((item: any) => {
      const animal = normalizeAnimal(item.animals);
      return isChicken(animal);
    });

    setHistory(chickenOnly as MortalityLog[]);
  }

  async function submitMortality(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    const parsedCount = Number(mortalityCount);

    if (!animalId) {
      setMessage("Please select one chicken.");
      setSaving(false);
      return;
    }

    if (!Number.isFinite(parsedCount) || parsedCount < 0) {
      setMessage("Please enter a valid mortality count.");
      setSaving(false);
      return;
    }

    if (!reason.trim()) {
      setMessage("Please enter the reason.");
      setSaving(false);
      return;
    }

    const { error } = await supabase.from("mortality_logs").insert({
      animal_id: animalId,
      mortality_count: parsedCount,
      reason: reason.trim(),
      notes: notes.trim() || null,
      created_at: new Date().toISOString(),
    });

    if (error) {
      setMessage(`Mortality save error: ${error.message}`);
      setSaving(false);
      return;
    }

    setAnimalId("");
    setMortalityCount("");
    setReason("");
    setNotes("");

    setMessage("✅ Mortality record saved and synced.");
    await loadHistory();
    setSaving(false);
  }

  return (
    <main style={page}>
      <div style={shell}>
        <nav style={topNav}>
          <Link href="/caretaker/dashboard" style={backLink}>
            ← Dashboard
          </Link>

          <div style={navLinks}>
            <Link href="/caretaker/feeding" style={navLink}>Feeding</Link>
            <Link href="/caretaker/photos" style={navLink}>Photos</Link>
            <Link href="/caretaker/weight" style={navLink}>Weight</Link>
            <Link href="/caretaker/tasks" style={navLink}>Tasks</Link>
          </div>
        </nav>

        <section style={hero}>
          <div style={heroCopy}>
            <p style={eyebrow}>Chicken Health Watch</p>
            <h1 style={title}>⚠️ Mortality Report</h1>
            <p style={subtitle}>
              Record chicken mortality incidents clearly with count, reason, notes,
              and a visible history trail for quick monitoring.
            </p>
          </div>

          <div style={heroPanel}>
            <span style={heroPanelLabel}>Latest Status</span>
            <strong style={heroPanelValue}>
              {loading ? "Checking..." : latestRecord ? "Reported" : "No records"}
            </strong>
            <small style={heroPanelText}>
              {latestRecord
                ? formatDate(latestRecord.created_at)
                : "Mortality history will appear here."}
            </small>
          </div>
        </section>

        <section style={summaryGrid}>
          <div style={summaryCard}>
            <span style={summaryIcon}>🐔</span>
            <div>
              <p style={summaryLabel}>Chicken Options</p>
              <h2 style={summaryValue}>{loading ? "..." : animals.length}</h2>
              <p style={summaryHint}>Chicken-only selection</p>
            </div>
          </div>

          <div style={summaryCard}>
            <span style={summaryIcon}>📋</span>
            <div>
              <p style={summaryLabel}>Reports</p>
              <h2 style={summaryValue}>{loading ? "..." : history.length}</h2>
              <p style={summaryHint}>Latest mortality logs</p>
            </div>
          </div>

          <div style={summaryCard}>
            <span style={summaryIcon}>🚨</span>
            <div>
              <p style={summaryLabel}>Total Count</p>
              <h2 style={summaryValue}>{loading ? "..." : totalMortality}</h2>
              <p style={summaryHint}>From loaded history</p>
            </div>
          </div>
        </section>

        {message && <div style={notice}>{message}</div>}

        <div style={contentGrid}>
          <section style={card}>
            <div style={sectionHeader}>
              <div>
                <p style={sectionEyebrow}>Caretaker Input</p>
                <h2 style={sectionTitle}>Submit Mortality Details</h2>
              </div>

              <button onClick={loadData} disabled={loading || saving} type="button" style={refreshButton}>
                {loading ? "Refreshing..." : "Refresh"}
              </button>
            </div>

            {loading ? (
              <div style={emptyBox}>Loading chicken mortality form...</div>
            ) : (
              <form onSubmit={submitMortality} style={form}>
                <label style={label}>Select Chicken</label>
                <select
                  value={animalId}
                  onChange={(e) => setAnimalId(e.target.value)}
                  required
                  style={input}
                >
                  <option value="">Choose chicken</option>
                  {animals.map((animal) => (
                    <option key={animal.id} value={animal.id}>
                      {animal.name || "Unnamed Chicken"} — {animal.code || "No Code"} — {animal.type || "Chicken"}
                    </option>
                  ))}
                </select>

                {selectedAnimal && (
                  <div style={selectedBox}>
                    <strong>{selectedAnimal.name || "Selected Chicken"}</strong>
                    <span>Code: {selectedAnimal.code || "No code"}</span>
                  </div>
                )}

                <label style={label}>Mortality Count</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={mortalityCount}
                  onChange={(e) => setMortalityCount(e.target.value)}
                  required
                  placeholder="Example: 1"
                  style={input}
                />

                <label style={label}>Reason</label>
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                  placeholder="Example: Illness, injury, heat stress"
                  style={input}
                />

                <label style={label}>Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional caretaker notes"
                  style={textarea}
                />

                <button disabled={saving || animals.length === 0} style={button}>
                  {saving ? "Saving..." : "Submit Mortality Report"}
                </button>
              </form>
            )}
          </section>

          <aside style={guideCard}>
            <p style={sectionEyebrow}>Field Guide</p>
            <h2 style={guideTitle}>Before submitting</h2>
            <div style={guideList}>
              <div style={guideItem}>
                <span>1</span>
                <p>Select only the affected chicken record.</p>
              </div>
              <div style={guideItem}>
                <span>2</span>
                <p>Enter the exact count observed.</p>
              </div>
              <div style={guideItem}>
                <span>3</span>
                <p>Add a clear reason and short notes for admin review.</p>
              </div>
            </div>
          </aside>
        </div>

        <section style={historyCard}>
          <div style={sectionHeader}>
            <div>
              <p style={sectionEyebrow}>Timeline</p>
              <h2 style={sectionTitle}>Latest Mortality History</h2>
            </div>
            <span style={historyBadge}>{history.length} records</span>
          </div>

          {loading ? (
            <div style={emptyBox}>Loading mortality history...</div>
          ) : history.length === 0 ? (
            <div style={emptyBox}>No mortality records yet.</div>
          ) : (
            <div style={historyList}>
              {history.map((item) => {
                const animal = normalizeAnimal(item.animals);

                return (
                  <article key={item.id} style={historyItem}>
                    <div style={countBadge}>
                      <span>{item.mortality_count ?? 0}</span>
                      <small>count</small>
                    </div>

                    <div style={historyBody}>
                      <p style={typeText}>{animal?.type || "Chicken"}</p>
                      <h3 style={animalName}>{animal?.name || "Unnamed Chicken"}</h3>
                      <p style={animalCode}>Code: {animal?.code || "No code"}</p>

                      <div style={detailGrid}>
                        <div style={detailBox}>
                          <span>Reason</span>
                          <strong>{item.reason || "No reason"}</strong>
                        </div>

                        <div style={detailBox}>
                          <span>Notes</span>
                          <strong>{item.notes || "No notes"}</strong>
                        </div>
                      </div>
                    </div>

                    <p style={dateText}>{formatDate(item.created_at)}</p>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function normalizeAnimal(value: AnimalRelation): Animal | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
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
  background: "radial-gradient(circle at top left, rgba(255,199,0,0.38), transparent 34%), linear-gradient(180deg, #ffffff 0%, #fff7cf 55%, #ffe68a 100%)",
  padding: "18px clamp(14px, 3vw, 28px) 28px",
  fontFamily: "Arial, sans-serif",
};

const shell: React.CSSProperties = {
  maxWidth: 1180,
  margin: "0 auto",
};

const topNav: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
  marginBottom: 16,
};

const backLink: React.CSSProperties = {
  color: "#854d0e",
  fontWeight: 900,
  textDecoration: "none",
  background: "rgba(255,255,255,0.9)",
  borderRadius: 999,
  padding: "10px 14px",
  border: "1px solid rgba(153,27,27,0.14)",
};

const navLinks: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const navLink: React.CSSProperties = {
  color: "#0f172a",
  background: "rgba(255,255,255,0.8)",
  border: "1px solid rgba(153,27,27,0.12)",
  borderRadius: 999,
  padding: "9px 12px",
  textDecoration: "none",
  fontSize: 13,
  fontWeight: 900,
};

const hero: React.CSSProperties = {
  background: "linear-gradient(135deg, #facc15, #fbbf24)",
  borderRadius: 30,
  padding: 24,
  color: "white",
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: 20,
  boxShadow: "0 24px 50px rgba(220,38,38,0.24)",
};

const heroCopy: React.CSSProperties = {
  minWidth: 0,
};

const eyebrow: React.CSSProperties = {
  margin: 0,
  opacity: 0.9,
  fontSize: 13,
  fontWeight: 900,
  letterSpacing: 1.5,
  textTransform: "uppercase",
};

const title: React.CSSProperties = {
  margin: "8px 0",
  fontSize: "clamp(32px, 7vw, 54px)",
  lineHeight: 1,
  fontWeight: 900,
};

const subtitle: React.CSSProperties = {
  margin: 0,
  maxWidth: 700,
  color: "rgba(255,255,255,0.88)",
  fontSize: 16,
  lineHeight: 1.6,
};

const heroPanel: React.CSSProperties = {
  background: "rgba(255,255,255,0.18)",
  border: "1px solid rgba(255,255,255,0.32)",
  borderRadius: 24,
  padding: 20,
  display: "grid",
  alignContent: "center",
  backdropFilter: "blur(12px)",
};

const heroPanelLabel: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  opacity: 0.85,
  textTransform: "uppercase",
  letterSpacing: 1.1,
};

const heroPanelValue: React.CSSProperties = {
  marginTop: 8,
  fontSize: 30,
  lineHeight: 1,
};

const heroPanelText: React.CSSProperties = {
  marginTop: 8,
  opacity: 0.86,
  lineHeight: 1.4,
};

const summaryGrid: React.CSSProperties = {
  marginTop: 18,
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 14,
};

const summaryCard: React.CSSProperties = {
  background: "rgba(255,255,255,0.92)",
  borderRadius: 24,
  padding: 18,
  border: "1px solid rgba(153,27,27,0.1)",
  display: "flex",
  alignItems: "center",
  gap: 14,
  boxShadow: "0 12px 28px rgba(15,23,42,0.08)",
};

const summaryIcon: React.CSSProperties = {
  width: 54,
  height: 54,
  borderRadius: 18,
  display: "grid",
  placeItems: "center",
  background: "#fef3c7",
  fontSize: 28,
};

const summaryLabel: React.CSSProperties = {
  margin: 0,
  color: "#64748b",
  fontSize: 12,
  fontWeight: 900,
  textTransform: "uppercase",
};

const summaryValue: React.CSSProperties = {
  margin: "4px 0",
  color: "#0f172a",
  fontSize: 30,
  fontWeight: 900,
};

const summaryHint: React.CSSProperties = {
  margin: 0,
  color: "#64748b",
  fontSize: 13,
  fontWeight: 700,
};

const notice: React.CSSProperties = {
  marginTop: 18,
  background: "#fef3c7",
  color: "#854d0e",
  padding: 16,
  borderRadius: 18,
  border: "1px solid rgba(153,27,27,0.14)",
  fontWeight: 900,
  textAlign: "center",
};

const contentGrid: React.CSSProperties = {
  marginTop: 18,
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: 18,
  alignItems: "start",
};

const card: React.CSSProperties = {
  background: "rgba(255,255,255,0.96)",
  borderRadius: 28,
  padding: 24,
  boxShadow: "0 20px 45px rgba(15,23,42,0.1)",
  border: "1px solid rgba(153,27,27,0.09)",
};

const historyCard: React.CSSProperties = {
  ...card,
  marginTop: 18,
};

const sectionHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 14,
  flexWrap: "wrap",
  marginBottom: 18,
};

const sectionEyebrow: React.CSSProperties = {
  margin: 0,
  color: "#ca8a04",
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: 1.2,
  textTransform: "uppercase",
};

const sectionTitle: React.CSSProperties = {
  margin: "4px 0 0",
  color: "#0f172a",
  fontSize: 26,
  fontWeight: 900,
};

const refreshButton: React.CSSProperties = {
  border: "none",
  background: "#854d0e",
  color: "white",
  borderRadius: 14,
  padding: "11px 15px",
  fontWeight: 900,
  cursor: "pointer",
};

const form: React.CSSProperties = {
  display: "grid",
  gap: 12,
};

const label: React.CSSProperties = {
  color: "#0f172a",
  fontSize: 13,
  fontWeight: 900,
};

const input: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: 14,
  borderRadius: 16,
  border: "1px solid #cbd5e1",
  fontSize: 16,
  outline: "none",
  background: "#fff",
};

const textarea: React.CSSProperties = {
  ...input,
  minHeight: 120,
  resize: "vertical",
};

const selectedBox: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
  background: "#fffbeb",
  color: "#854d0e",
  padding: 14,
  borderRadius: 16,
  border: "1px solid #fde68a",
};

const button: React.CSSProperties = {
  marginTop: 8,
  padding: 16,
  borderRadius: 18,
  border: "none",
  background: "linear-gradient(135deg, #facc15, #fbbf24)",
  color: "white",
  fontSize: 17,
  fontWeight: 900,
  cursor: "pointer",
  boxShadow: "0 14px 28px rgba(220,38,38,0.22)",
};

const guideCard: React.CSSProperties = {
  ...card,
  background: "#fffbeb",
};

const guideTitle: React.CSSProperties = {
  margin: "4px 0 16px",
  color: "#854d0e",
  fontSize: 24,
  fontWeight: 900,
};

const guideList: React.CSSProperties = {
  display: "grid",
  gap: 12,
};

const guideItem: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "36px 1fr",
  gap: 10,
  alignItems: "center",
  color: "#334155",
  fontWeight: 800,
};

const historyBadge: React.CSSProperties = {
  background: "#fef3c7",
  color: "#854d0e",
  borderRadius: 999,
  padding: "8px 12px",
  fontSize: 12,
  fontWeight: 900,
};

const emptyBox: React.CSSProperties = {
  background: "#f8fafc",
  borderRadius: 20,
  padding: 18,
  textAlign: "center",
  color: "#64748b",
  fontWeight: 800,
};

const historyList: React.CSSProperties = {
  display: "grid",
  gap: 14,
};

const historyItem: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 16,
  alignItems: "flex-start",
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: 22,
  padding: 16,
};

const countBadge: React.CSSProperties = {
  width: 76,
  height: 76,
  borderRadius: 22,
  display: "grid",
  placeItems: "center",
  background: "#fef3c7",
  color: "#854d0e",
  fontWeight: 900,
};

const historyBody: React.CSSProperties = {
  minWidth: 0,
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
  fontSize: 21,
  fontWeight: 900,
};

const animalCode: React.CSSProperties = {
  margin: 0,
  color: "#64748b",
  fontSize: 14,
  fontWeight: 700,
};

const detailGrid: React.CSSProperties = {
  marginTop: 12,
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 10,
};

const detailBox: React.CSSProperties = {
  background: "white",
  borderRadius: 16,
  padding: 12,
  border: "1px solid #e2e8f0",
};

const dateText: React.CSSProperties = {
  margin: 0,
  color: "#64748b",
  fontSize: 13,
  fontWeight: 800,
  whiteSpace: "normal",
};
