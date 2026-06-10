"use client";

import { useState } from "react";
import Link from "next/link";

export default function MortalityPage() {
  const [count, setCount] = useState("");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(false);

  const submitReport = (e: React.FormEvent) => {
    e.preventDefault();

    const report = {
      type: "mortality",
      count,
      reason,
      note,
      created_at: new Date().toISOString(),
    };

    const existing = JSON.parse(
      localStorage.getItem("caretaker_updates") || "[]"
    );

    localStorage.setItem(
      "caretaker_updates",
      JSON.stringify([report, ...existing])
    );

    setSaved(true);
    setCount("");
    setReason("");
    setNote("");
  };

  return (
    <main style={page}>
      <Link href="/caretaker/dashboard" style={backBtn}>
        ← Back to Dashboard
      </Link>

      <div style={card}>
        <h1 style={title}>🐔 Mortality Report</h1>

        <p style={subtitle}>
          Report any mortality or missing chickens immediately.
        </p>

        {saved && (
          <div style={successBox}>
            ✅ Mortality report submitted successfully.
          </div>
        )}

        <form onSubmit={submitReport} style={form}>
          <label style={label}>Number of Chickens</label>

          <input
            type="number"
            min="1"
            value={count}
            onChange={(e) => setCount(e.target.value)}
            placeholder="Enter quantity"
            required
            style={input}
          />

          <label style={label}>Reason</label>

          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
            style={input}
          >
            <option value="">Select Reason</option>
            <option value="Disease">Disease</option>
            <option value="Weak Chick">Weak Chick</option>
            <option value="Accident">Accident</option>
            <option value="Predator">Predator</option>
            <option value="Unknown">Unknown</option>
          </select>

          <label style={label}>Additional Notes</label>

          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional notes..."
            style={textarea}
          />

          <button type="submit" style={button}>
            Submit Report
          </button>
        </form>
      </div>
    </main>
  );
}

const page: React.CSSProperties = {
  minHeight: "100vh",
  background:
    "linear-gradient(180deg, #fff7ed 0%, #ffedd5 50%, #fed7aa 100%)",
  padding: 20,
};

const backBtn: React.CSSProperties = {
  textDecoration: "none",
  color: "#c2410c",
  fontWeight: 700,
};

const card: React.CSSProperties = {
  maxWidth: 600,
  margin: "20px auto",
  background: "#ffffff",
  padding: 24,
  borderRadius: 24,
  boxShadow: "0 15px 40px rgba(0,0,0,0.08)",
};

const title: React.CSSProperties = {
  fontSize: 34,
  marginBottom: 10,
};

const subtitle: React.CSSProperties = {
  color: "#64748b",
  marginBottom: 20,
};

const form: React.CSSProperties = {
  display: "grid",
  gap: 14,
};

const label: React.CSSProperties = {
  fontWeight: 700,
};

const input: React.CSSProperties = {
  padding: 14,
  borderRadius: 12,
  border: "1px solid #cbd5e1",
};

const textarea: React.CSSProperties = {
  padding: 14,
  borderRadius: 12,
  border: "1px solid #cbd5e1",
  minHeight: 120,
};

const button: React.CSSProperties = {
  padding: 16,
  borderRadius: 14,
  border: "none",
  background: "#ea580c",
  color: "#fff",
  fontWeight: 800,
  cursor: "pointer",
};

const successBox: React.CSSProperties = {
  background: "#dcfce7",
  color: "#166534",
  padding: 12,
  borderRadius: 12,
  marginBottom: 20,
  fontWeight: 700,
};