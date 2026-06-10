"use client";

import { useState } from "react";
import Link from "next/link";

export default function PhotosPage() {
  const [note, setNote] = useState("");
  const [fileName, setFileName] = useState("");
  const [saved, setSaved] = useState(false);

  function submitUpdate(e: React.FormEvent) {
    e.preventDefault();

    const record = {
      type: "photo",
      fileName,
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
    setNote("");
    setFileName("");
  }

  return (
    <main style={page}>
      <Link href="/caretaker/dashboard" style={back}>← Back</Link>

      <div style={card}>
        <h1 style={title}>📸 Photo Update</h1>
        <p style={subtitle}>Upload photo name muna. Next natin iconnect sa Supabase Storage.</p>

        {saved && <div style={success}>✅ Photo update saved.</div>}

        <form onSubmit={submitUpdate} style={form}>
          <label style={label}>Choose Photo</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setFileName(e.target.files?.[0]?.name || "")}
            required
            style={input}
          />

          <label style={label}>Photo Note</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Example: Healthy, active, good condition"
            style={textarea}
          />

          <button style={button}>Submit Photo Update</button>
        </form>
      </div>
    </main>
  );
}

const page: React.CSSProperties = {
  minHeight: "100vh",
  background: "linear-gradient(180deg, #ffe4e6, #fef9c3)",
  padding: 20,
  fontFamily: "Arial, sans-serif",
};

const back: React.CSSProperties = {
  display: "inline-block",
  marginBottom: 16,
  color: "#be123c",
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
  background: "#f43f5e",
  color: "white",
  fontSize: 17,
  fontWeight: 900,
  cursor: "pointer",
};

const success: React.CSSProperties = {
  background: "#ffe4e6",
  color: "#be123c",
  padding: 12,
  borderRadius: 14,
  marginBottom: 14,
  fontWeight: 800,
};