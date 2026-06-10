"use client";

import { useState } from "react";
import Link from "next/link";

export default function WeightPage() {
  const [averageWeight, setAverageWeight] = useState("");
  const [sampleCount, setSampleCount] = useState("");
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(false);

  function submitUpdate(e: React.FormEvent) {
    e.preventDefault();

    const record = {
      type: "weight",
      averageWeight,
      sampleCount,
      note,
      date: new Date().toISOString(),
    };

    const existing = JSON.parse(
      localStorage.getItem("caretaker_updates") || "[]"
    );

    localStorage.setItem(
      "caretaker_updates",
      JSON.stringify([record, ...existing])
    );

    setSaved(true);
    setAverageWeight("");
    setSampleCount("");
    setNote("");
  }

  return (
    <main style={page}>
      <Link href="/caretaker/dashboard" style={back}>← Back</Link>

      <div style={card}>
        <h1 style={title}>⚖️ Weight Update</h1>
        <p style={subtitle}>Average weight ng manok today.</p>

        {saved && <div style={success}>✅ Weight update saved.</div>}

        <form onSubmit={submitUpdate} style={form}>
          <label style={label}>Average Weight</label>
          <input
            value={averageWeight}
            onChange={(e) => setAverageWeight(e.target.value)}
            required
            placeholder="Example: 1.2 kg"
            style={input}
          />

          <label style={label}>Sample Count</label>
          <input
            value={sampleCount}
            onChange={(e) => setSampleCount(e.target.value)}
            required
            placeholder="Example: 10 chickens"
            style={input}
          />

          <label style={label}>Note</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional note"
            style={textarea}
          />

          <button style={button}>Submit Weight Update</button>
        </form>
      </div>
    </main>
  );
}

const page: React.CSSProperties = {
  minHeight: "100vh",
  background: "linear-gradient(180deg, #dbeafe, #ecfccb)",
  padding: 20,
  fontFamily: "Arial, sans-serif",
};

const back: React.CSSProperties = {
  display: "inline-block",
  marginBottom: 16,
  color: "#0369a1",
  fontWeight: 900,
  textDecoration: "none",
};

const card: React.CSSProperties = {
  maxWidth: 520,
  margin: "0 auto",
  background: "white",
  borderRadius: 28,
  padding: 24,
  boxShadow: "0 20px 45px rgba(0,0,0,0.1)",
};

const title: React.CSSProperties = {
  fontSize: 32,
  margin: 0,
  fontWeight: 900,
};

const subtitle: React.CSSProperties = {
  color: "#64748b",
};

const form: React.CSSProperties = {
  display: "grid",
  gap: 12,
};

const label: React.CSSProperties = {
  fontWeight: 900,
};

const input: React.CSSProperties = {
  padding: 14,
  borderRadius: 14,
  border: "1px solid #cbd5e1",
  fontSize: 16,
};

const textarea: React.CSSProperties = {
  ...input,
  minHeight: 110,
};

const button: React.CSSProperties = {
  marginTop: 10,
  padding: 16,
  borderRadius: 16,
  border: "none",
  background: "#0ea5e9",
  color: "white",
  fontSize: 17,
  fontWeight: 900,
  cursor: "pointer",
};

const success: React.CSSProperties = {
  background: "#dbeafe",
  color: "#075985",
  padding: 12,
  borderRadius: 14,
  marginBottom: 14,
  fontWeight: 800,
};