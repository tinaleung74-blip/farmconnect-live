"use client";

import { useState } from "react";
import Link from "next/link";

export default function NotesPage() {
  const [category, setCategory] = useState("");
  const [message, setMessage] = useState("");
  const [saved, setSaved] = useState(false);

  function submitUpdate(e: React.FormEvent) {
    e.preventDefault();

    const record = {
      type: "note",
      category,
      message,
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
    setCategory("");
    setMessage("");
  }

  return (
    <main style={page}>
      <Link href="/caretaker/dashboard" style={back}>← Back</Link>

      <div style={card}>
        <h1 style={title}>📝 Notes / Concern</h1>
        <p style={subtitle}>Send concern to admin. No customer direct message.</p>

        {saved && <div style={success}>✅ Note sent to admin record.</div>}

        <form onSubmit={submitUpdate} style={form}>
          <label style={label}>Concern Type</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            required
            style={input}
          >
            <option value="">Select concern</option>
            <option value="Feed Supply">Feed Supply</option>
            <option value="Medicine / Vitamins">Medicine / Vitamins</option>
            <option value="Chicken Health">Chicken Health</option>
            <option value="Farm Issue">Farm Issue</option>
            <option value="Other">Other</option>
          </select>

          <label style={label}>Message</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            required
            placeholder="Type your concern here"
            style={textarea}
          />

          <button style={button}>Send to Admin</button>
        </form>
      </div>
    </main>
  );
}

const page: React.CSSProperties = {
  minHeight: "100vh",
  background: "linear-gradient(180deg, #ede9fe, #dbeafe)",
  padding: 20,
  fontFamily: "Arial, sans-serif",
};

const back: React.CSSProperties = {
  display: "inline-block",
  marginBottom: 16,
  color: "#6d28d9",
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
  minHeight: 130,
};

const button: React.CSSProperties = {
  marginTop: 10,
  padding: 16,
  borderRadius: 16,
  border: "none",
  background: "#8b5cf6",
  color: "white",
  fontSize: 17,
  fontWeight: 900,
  cursor: "pointer",
};

const success: React.CSSProperties = {
  background: "#ede9fe",
  color: "#6d28d9",
  padding: 12,
  borderRadius: 14,
  marginBottom: 14,
  fontWeight: 800,
};