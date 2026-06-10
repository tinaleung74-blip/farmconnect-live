"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { supabase } from "@/lib/supabase";

type Caretaker = {
  id: string;
  full_name: string;
  assigned_farm?: string | null;
};

export default function CaretakerFeedingPage() {
  const [caretaker, setCaretaker] = useState<Caretaker | null>(null);
  const [feedType, setFeedType] = useState("");
  const [quantityKg, setQuantityKg] = useState("");
  const [waterLiters, setWaterLiters] = useState("");
  const [vitamins, setVitamins] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("farmconnect_caretaker");

    if (saved) {
      setCaretaker(JSON.parse(saved));
    }
  }, []);

  async function saveFeedingLog() {
    if (!caretaker) {
      alert("Please login again.");
      return;
    }

    if (!feedType || !quantityKg) {
      alert("Please enter feed type and quantity.");
      return;
    }

    setSaving(true);

    const { error } = await supabase.from("feeding_logs").insert({
      caretaker_id: caretaker.id,
      feed_type: feedType,
      quantity_kg: Number(quantityKg),
      water_liters: Number(waterLiters || 0),
      vitamins,
      notes,
    });

    setSaving(false);

    if (error) {
      alert("Failed to save feeding log.");
      console.error(error);
      return;
    }

    alert("Feeding log saved successfully.");

    setFeedType("");
    setQuantityKg("");
    setWaterLiters("");
    setVitamins("");
    setNotes("");
  }

  return (
    <main style={page}>
      <div style={topBar}>
        <div>
          <h1 style={title}>Feeding Logs</h1>
          <p style={subtitle}>
            Daily feed, water, vitamins, and care update.
          </p>
        </div>

        <Link href="/caretaker/dashboard" style={backButton}>
          Back
        </Link>
      </div>

      <section style={card}>
        <div style={infoBox}>
          <strong>Caretaker:</strong>{" "}
          {caretaker?.full_name || "Not loaded"}
          <br />
          <strong>Farm:</strong>{" "}
          {caretaker?.assigned_farm || "No assigned farm"}
        </div>

        <label style={label}>Feed Type</label>
        <input
          style={input}
          placeholder="Example: Starter Feed / Grower Feed"
          value={feedType}
          onChange={(e) => setFeedType(e.target.value)}
        />

        <label style={label}>Quantity KG</label>
        <input
          style={input}
          type="number"
          placeholder="Example: 25"
          value={quantityKg}
          onChange={(e) => setQuantityKg(e.target.value)}
        />

        <label style={label}>Water Liters</label>
        <input
          style={input}
          type="number"
          placeholder="Example: 100"
          value={waterLiters}
          onChange={(e) => setWaterLiters(e.target.value)}
        />

        <label style={label}>Vitamins / Supplements</label>
        <input
          style={input}
          placeholder="Example: Multivitamins, electrolytes"
          value={vitamins}
          onChange={(e) => setVitamins(e.target.value)}
        />

        <label style={label}>Notes</label>
        <textarea
          style={textarea}
          placeholder="Example: All birds active, normal feeding behavior."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        <button style={button} onClick={saveFeedingLog} disabled={saving}>
          {saving ? "Saving..." : "Save Feeding Log"}
        </button>
      </section>
    </main>
  );
}

const page: CSSProperties = {
  minHeight: "100vh",
  background: "#020617",
  color: "white",
  padding: 24,
};

const topBar: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 16,
  marginBottom: 24,
};

const title: CSSProperties = {
  fontSize: 32,
  fontWeight: 800,
  margin: 0,
};

const subtitle: CSSProperties = {
  color: "#94a3b8",
  marginTop: 8,
};

const backButton: CSSProperties = {
  color: "white",
  textDecoration: "none",
  background: "#334155",
  padding: "10px 14px",
  borderRadius: 10,
  fontWeight: 700,
};

const card: CSSProperties = {
  maxWidth: 640,
  background: "#0f172a",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 20,
  padding: 24,
};

const infoBox: CSSProperties = {
  background: "rgba(255,255,255,0.05)",
  borderRadius: 14,
  padding: 16,
  marginBottom: 20,
  color: "#e5e7eb",
};

const label: CSSProperties = {
  display: "block",
  marginBottom: 8,
  marginTop: 14,
  fontWeight: 700,
};

const input: CSSProperties = {
  width: "100%",
  padding: 14,
  borderRadius: 10,
  border: "1px solid #334155",
  background: "#020617",
  color: "white",
};

const textarea: CSSProperties = {
  width: "100%",
  minHeight: 110,
  padding: 14,
  borderRadius: 10,
  border: "1px solid #334155",
  background: "#020617",
  color: "white",
};

const button: CSSProperties = {
  width: "100%",
  marginTop: 20,
  padding: 14,
  borderRadius: 10,
  border: "none",
  fontWeight: 800,
  cursor: "pointer",
};