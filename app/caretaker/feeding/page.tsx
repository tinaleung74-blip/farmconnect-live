"use client";

import { useState } from "react";
import Link from "next/link";

export default function FeedingPage() {
  const [status, setStatus] = useState("");
  const [photoName, setPhotoName] = useState("");
  const [saved, setSaved] = useState(false);

  const isComplete = status !== "" && photoName !== "";

  function submitUpdate(e: React.FormEvent) {
    e.preventDefault();

    if (!isComplete) return;

    const record = {
      type: "feeding",
      status,
      photoName,
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
    setStatus("");
    setPhotoName("");
  }

  return (
    <main style={page}>
      <Link href="/caretaker/dashboard" style={back}>
        ← Back to Dashboard
      </Link>

      <div style={layout}>
        <section style={leftCard}>
          <div style={heroIcon}>🌽</div>
          <h1 style={title}>Feeding Proof</h1>
          <p style={subtitle}>
            Simple lang: piliin status, tapos buksan camera para picturan ang pakain.
          </p>

          <form onSubmit={submitUpdate} style={form}>
            <label style={label}>Feeding Status</label>

            <div style={statusGrid}>
              {["Fed Today ✅", "Need Feed Supply 🌽", "Emergency 🚨"].map(
                (item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setStatus(item)}
                    style={{
                      ...statusBtn,
                      ...(status === item ? activeStatusBtn : {}),
                    }}
                  >
                    {item}
                  </button>
                )
              )}
            </div>

            <button
              type="submit"
              disabled={!isComplete}
              style={{
                ...saveButton,
                opacity: isComplete ? 1 : 0.45,
                cursor: isComplete ? "pointer" : "not-allowed",
              }}
            >
              {isComplete ? "Save Feeding Proof ✅" : "Complete Photo + Status 🔒"}
            </button>

            {saved && (
              <div style={success}>
                ✅ Saved! Feeding proof sent to admin record.
              </div>
            )}
          </form>
        </section>

        <section style={rightCard}>
          <div style={cameraBox}>
            <div style={cameraIcon}>{photoName ? "✅" : "📷"}</div>

            <h2 style={photoTitle}>
              {photoName ? "Photo Captured" : "Open Camera"}
            </h2>

            <p style={photoText}>
              {photoName
                ? "Ready na. Pwede mo nang i-save."
                : "Kailangan munang mag-camera bago ma-save."}
            </p>

            <label style={cameraButton}>
              Open Camera
              <input
                type="file"
                accept="image/*"
                capture="environment"
                required
                onChange={(e) =>
                  setPhotoName(e.target.files?.[0]?.name || "")
                }
                style={{ display: "none" }}
              />
            </label>

            {photoName && <div style={photoNameBox}>📸 {photoName}</div>}
          </div>

          <div style={lockBox}>
            {!isComplete ? (
              <>🔒 Save button locked until status + camera photo is complete.</>
            ) : (
              <>✅ Complete. Ready to save feeding update.</>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

const page: React.CSSProperties = {
  minHeight: "100vh",
  background:
    "linear-gradient(135deg, #fef9c3 0%, #dcfce7 45%, #bbf7d0 100%)",
  padding: 20,
  fontFamily: "Arial, sans-serif",
};

const back: React.CSSProperties = {
  display: "inline-block",
  marginBottom: 18,
  color: "#166534",
  fontWeight: 900,
  textDecoration: "none",
};

const layout: React.CSSProperties = {
  maxWidth: 980,
  margin: "0 auto",
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
  gap: 18,
};

const leftCard: React.CSSProperties = {
  background: "rgba(255,255,255,0.96)",
  borderRadius: 30,
  padding: 24,
  boxShadow: "0 22px 50px rgba(22,101,52,0.18)",
  border: "1px solid rgba(34,197,94,0.18)",
};

const rightCard: React.CSSProperties = {
  background: "linear-gradient(180deg, #ffffff, #ecfccb)",
  borderRadius: 30,
  padding: 24,
  boxShadow: "0 22px 50px rgba(22,101,52,0.18)",
  border: "1px solid rgba(34,197,94,0.18)",
};

const heroIcon: React.CSSProperties = {
  width: 92,
  height: 92,
  borderRadius: 28,
  background: "linear-gradient(135deg, #facc15, #22c55e)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 48,
  marginBottom: 16,
};

const title: React.CSSProperties = {
  fontSize: 36,
  margin: 0,
  fontWeight: 900,
  color: "#14532d",
};

const subtitle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 16,
  marginBottom: 20,
};

const form: React.CSSProperties = {
  display: "grid",
  gap: 16,
};

const label: React.CSSProperties = {
  fontWeight: 900,
  color: "#14532d",
};

const statusGrid: React.CSSProperties = {
  display: "grid",
  gap: 12,
};

const statusBtn: React.CSSProperties = {
  padding: 16,
  borderRadius: 18,
  border: "2px solid #bbf7d0",
  background: "#f7fee7",
  color: "#14532d",
  fontWeight: 900,
  fontSize: 16,
  textAlign: "left",
  cursor: "pointer",
};

const activeStatusBtn: React.CSSProperties = {
  background: "#22c55e",
  color: "white",
  border: "2px solid #16a34a",
  boxShadow: "0 10px 20px rgba(34,197,94,0.28)",
};

const saveButton: React.CSSProperties = {
  marginTop: 8,
  padding: 18,
  borderRadius: 20,
  border: "none",
  background: "linear-gradient(135deg, #16a34a, #15803d)",
  color: "white",
  fontSize: 17,
  fontWeight: 900,
};

const cameraBox: React.CSSProperties = {
  minHeight: 360,
  borderRadius: 26,
  border: "3px dashed #86efac",
  background:
    "linear-gradient(180deg, rgba(240,253,244,0.9), rgba(254,249,195,0.9))",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center",
  padding: 22,
};

const cameraIcon: React.CSSProperties = {
  width: 100,
  height: 100,
  borderRadius: 30,
  background: "#dcfce7",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 52,
  marginBottom: 16,
};

const photoTitle: React.CSSProperties = {
  color: "#14532d",
  fontSize: 28,
  fontWeight: 900,
  margin: 0,
};

const photoText: React.CSSProperties = {
  color: "#64748b",
  marginBottom: 20,
};

const cameraButton: React.CSSProperties = {
  padding: "17px 28px",
  borderRadius: 999,
  background: "linear-gradient(135deg, #facc15, #22c55e)",
  color: "#14532d",
  fontWeight: 900,
  fontSize: 17,
  cursor: "pointer",
  boxShadow: "0 12px 24px rgba(34,197,94,0.28)",
};

const photoNameBox: React.CSSProperties = {
  marginTop: 16,
  padding: 12,
  borderRadius: 14,
  background: "white",
  color: "#166534",
  fontWeight: 800,
  maxWidth: "100%",
  wordBreak: "break-word",
};

const lockBox: React.CSSProperties = {
  marginTop: 16,
  padding: 16,
  borderRadius: 18,
  background: "#ffffff",
  color: "#166534",
  fontWeight: 900,
  textAlign: "center",
};

const success: React.CSSProperties = {
  background: "#dcfce7",
  color: "#166534",
  padding: 14,
  borderRadius: 16,
  fontWeight: 900,
};