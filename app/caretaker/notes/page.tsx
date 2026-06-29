"use client";

import { useState } from "react";
import Link from "next/link";

const navLinks = [
  { href: "/caretaker/dashboard", label: "Dashboard" },
  { href: "/caretaker/tasks", label: "Tasks" },
  { href: "/caretaker/feeding", label: "Feeding" },
  { href: "/caretaker/photos", label: "Photos" },
  { href: "/caretaker/weight", label: "Weight" },
  { href: "/caretaker/mortality", label: "Mortality" },
];

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
      <nav style={topNav}>
        <Link href="/caretaker/dashboard" style={back}>← Dashboard</Link>
        <div style={navPills}>
          {navLinks.map((item) => (
            <Link key={item.href} href={item.href} style={navPill}>
              {item.label}
            </Link>
          ))}
        </div>
      </nav>

      <div style={shell}>
        <aside style={infoCard}>
          <p style={kicker}>Admin concern desk</p>
          <h1 style={heroTitle}>📝 Notes / Concern</h1>
          <p style={heroText}>
            Send caretaker concerns in a clear format so Admin can quickly review
            farm issues, supply needs, and chicken health updates.
          </p>
        </aside>

        <section style={card}>
          <h2 style={title}>Send a note</h2>
          <p style={subtitle}>No customer direct message. Admin record only.</p>

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
        </section>
      </div>
    </main>
  );
}

const page: React.CSSProperties = {
  minHeight: "100vh",
  background: "radial-gradient(circle at top left, rgba(139,92,246,0.20), transparent 34%), linear-gradient(180deg, #ede9fe, #dbeafe)",
  padding: "18px clamp(14px, 3vw, 28px) 28px",
  fontFamily: "Arial, sans-serif",
};

const topNav: React.CSSProperties = {
  maxWidth: 980,
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
  color: "#6d28d9",
  background: "rgba(255,255,255,0.88)",
  border: "1px solid rgba(139,92,246,0.18)",
  borderRadius: 999,
  padding: "10px 13px",
  fontSize: 13,
  fontWeight: 900,
};

const back: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  color: "#6d28d9",
  fontWeight: 950,
  textDecoration: "none",
  background: "rgba(255,255,255,0.9)",
  border: "1px solid rgba(139,92,246,0.18)",
  borderRadius: 999,
  padding: "10px 14px",
  boxShadow: "0 10px 22px rgba(15,23,42,0.06)",
};

const shell: React.CSSProperties = {
  maxWidth: 980,
  margin: "0 auto",
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: 18,
  alignItems: "stretch",
};

const infoCard: React.CSSProperties = {
  background: "linear-gradient(135deg, #7c3aed, #a855f7)",
  color: "white",
  borderRadius: 30,
  padding: "clamp(22px, 4vw, 32px)",
  boxShadow: "0 22px 48px rgba(124,58,237,0.20)",
  minHeight: 320,
};

const kicker: React.CSSProperties = {
  margin: 0,
  opacity: 0.9,
  fontWeight: 950,
  letterSpacing: 1.5,
  textTransform: "uppercase",
  fontSize: 12,
};

const heroTitle: React.CSSProperties = {
  fontSize: "clamp(34px, 6vw, 48px)",
  margin: "16px 0 0",
  fontWeight: 950,
  lineHeight: 1.05,
};

const heroText: React.CSSProperties = {
  margin: "18px 0 0",
  color: "#ede9fe",
  lineHeight: 1.7,
  fontWeight: 700,
};

const card: React.CSSProperties = {
  background: "rgba(255,255,255,0.96)",
  borderRadius: 30,
  padding: "clamp(20px, 4vw, 30px)",
  boxShadow: "0 22px 48px rgba(15,23,42,0.10)",
  border: "1px solid rgba(255,255,255,0.76)",
};

const title: React.CSSProperties = {
  fontSize: 30,
  margin: 0,
  fontWeight: 950,
  color: "#0f172a",
};

const subtitle: React.CSSProperties = {
  color: "#64748b",
  lineHeight: 1.6,
  fontWeight: 700,
};

const form: React.CSSProperties = {
  display: "grid",
  gap: 13,
};

const label: React.CSSProperties = {
  fontWeight: 900,
  color: "#334155",
};

const input: React.CSSProperties = {
  padding: "15px 16px",
  borderRadius: 16,
  border: "1px solid #cbd5e1",
  background: "#f8fafc",
  fontSize: 16,
  outlineColor: "#8b5cf6",
  width: "100%",
  boxSizing: "border-box",
};

const textarea: React.CSSProperties = {
  ...input,
  minHeight: 150,
  resize: "vertical",
};

const button: React.CSSProperties = {
  marginTop: 10,
  padding: 17,
  borderRadius: 18,
  border: "none",
  background: "linear-gradient(135deg, #7c3aed, #8b5cf6)",
  color: "white",
  fontSize: 17,
  fontWeight: 950,
  cursor: "pointer",
  boxShadow: "0 16px 30px rgba(139,92,246,0.24)",
};

const success: React.CSSProperties = {
  background: "#ede9fe",
  color: "#6d28d9",
  padding: 14,
  borderRadius: 16,
  marginBottom: 16,
  fontWeight: 850,
  lineHeight: 1.5,
};
