"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Animal = {
  id: string;
  code: string | null;
  name: string | null;
  type: string | null;
};

type AnimalRelation = Animal[] | null;

type AnimalWeight = {
  id: string;
  animal_id: string;
  weight_kg: number | null;
  note: string | null;
  recorded_at: string | null;
  animals: AnimalRelation;
};

type NormalizedAnimalWeight = AnimalWeight & {
  animal: Animal | null;
};

type AnimalPhoto = {
  id: string;
  animal_id: string;
  photo_url: string | null;
  caption: string | null;
  created_at: string | null;
  animals: AnimalRelation;
};

type NormalizedAnimalPhoto = AnimalPhoto & {
  animal: Animal | null;
};

type Row = Record<string, any>;

export default function AdminReportsPage() {
  const [feedingLogs, setFeedingLogs] = useState<Row[]>([]);
  const [mortalityLogs, setMortalityLogs] = useState<Row[]>([]);
  const [weightActivity, setWeightActivity] = useState<NormalizedAnimalWeight[]>([]);
  const [photoActivity, setPhotoActivity] = useState<NormalizedAnimalPhoto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReports();
  }, []);

  async function loadReports() {
    setLoading(true);

    const [feedingRes, mortalityRes, weightRes, photoRes] = await Promise.all([
      supabase
        .from("feeding_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(300),

      supabase
        .from("mortality_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(300),

      supabase
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
            type
          )
        `)
        .order("recorded_at", { ascending: false })
        .limit(300),

      supabase
        .from("animal_photos")
        .select(`
          id,
          animal_id,
          photo_url,
          caption,
          created_at,
          animals (
            id,
            code,
            name,
            type
          )
        `)
        .order("created_at", { ascending: false })
        .limit(300),
    ]);

    const chickenWeights = (weightRes.data || []).filter((item) => {
      const animal = item.animals?.[0] ?? null;
      return String(animal?.type || "").toLowerCase().includes("chicken");
    });

    const normalizedWeights = chickenWeights.map((row) => ({
      ...row,
      animal: row.animals?.[0] ?? null,
    }));

    const chickenPhotos = (photoRes.data || []).filter((item) => {
      const animal = item.animals?.[0] ?? null;
      return String(animal?.type || "").toLowerCase().includes("chicken");
    });

    const normalizedPhotos = chickenPhotos.map((row) => ({
      ...row,
      animal: row.animals?.[0] ?? null,
    }));

    setFeedingLogs(feedingRes.data || []);
    setMortalityLogs(mortalityRes.data || []);
    setWeightActivity(normalizedWeights);
    setPhotoActivity(normalizedPhotos);
    setLoading(false);
  }

  const stats = useMemo(
    () => ({
      feeding: feedingLogs.length,
      mortality: mortalityLogs.length,
      weight: weightActivity.length,
      photos: photoActivity.length,
    }),
    [feedingLogs, mortalityLogs, weightActivity, photoActivity]
  );

  return (
    <main style={page}>
      <section style={hero}>
        <div>
          <Link href="/admin" style={back}>
            ← Back Admin
          </Link>
          <p style={eyebrow}>FarmConnect Reports</p>
          <h1 style={title}>Production Reports Center</h1>
          <p style={subtitle}>
            Synced reports from caretaker feeding, mortality, chicken weight,
            and chicken photo activity.
          </p>
        </div>

        <button onClick={loadReports} style={refreshBtn}>
          {loading ? "Refreshing..." : "Refresh Reports"}
        </button>
      </section>

      <section style={grid}>
        <Card label="Feeding Logs" value={stats.feeding} code="FEED" />
        <Card label="Mortality Logs" value={stats.mortality} code="MORT" />
        <Card label="Weight Activity" value={stats.weight} code="KG" />
        <Card label="Photo Activity" value={stats.photos} code="PIC" />
      </section>

      <section style={twoColumn}>
        <section style={panel}>
          <h2 style={sectionTitle}>Weight Activity</h2>
          <p style={muted}>From animal_weights joined with animals.</p>

          {loading ? (
            <div style={empty}>Loading weight activity...</div>
          ) : weightActivity.length === 0 ? (
            <div style={empty}>No chicken weight activity yet.</div>
          ) : (
            <div style={list}>
              {weightActivity.slice(0, 20).map((item) => {
                const animal = item.animal;

                return (
                  <div key={item.id} style={itemCard}>
                    <div>
                      <p style={typeText}>{animal?.type || "Chicken"}</p>
                      <h3 style={itemTitle}>
                        {animal?.name || "Unnamed Chicken"}
                      </h3>
                      <p style={meta}>Code: {animal?.code || "No code"}</p>
                      <p style={bigValue}>{item.weight_kg ?? "—"} kg</p>
                      <p style={desc}>{item.note || "No note."}</p>
                    </div>
                    <small style={dateText}>{formatDate(item.recorded_at)}</small>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section style={panel}>
          <h2 style={sectionTitle}>Photo Activity</h2>
          <p style={muted}>From animal_photos joined with animals.</p>

          {loading ? (
            <div style={empty}>Loading photo activity...</div>
          ) : photoActivity.length === 0 ? (
            <div style={empty}>No chicken photo activity yet.</div>
          ) : (
            <div style={list}>
              {photoActivity.slice(0, 20).map((item) => {
                const animal = item.animal;

                return (
                  <div key={item.id} style={photoCard}>
                    {item.photo_url ? (
                      <img
                        src={item.photo_url}
                        alt={item.caption || "Chicken photo"}
                        style={photoPreview}
                      />
                    ) : (
                      <div style={noPhoto}>No Photo</div>
                    )}

                    <div>
                      <p style={typeText}>{animal?.type || "Chicken"}</p>
                      <h3 style={itemTitle}>
                        {animal?.name || "Unnamed Chicken"}
                      </h3>
                      <p style={meta}>Code: {animal?.code || "No code"}</p>
                      <p style={desc}>{item.caption || "No caption."}</p>
                      <small style={dateText}>{formatDate(item.created_at)}</small>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

function Card({
  label,
  value,
  code,
}: {
  label: string;
  value: number;
  code: string;
}) {
  return (
    <div style={card}>
      <span style={codeBadge}>{code}</span>
      <p style={cardLabel}>{label}</p>
      <h2 style={cardValue}>{value.toLocaleString()}</h2>
    </div>
  );
}


function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-PH");
}

const page: React.CSSProperties = {
  minHeight: "100vh",
  padding: 28,
  background: "linear-gradient(135deg, #ecfdf5 0%, #f8fafc 45%, #eff6ff 100%)",
  color: "#0f172a",
};

const hero: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "space-between",
  gap: 20,
  alignItems: "center",
  padding: 30,
  borderRadius: 30,
  background: "linear-gradient(135deg, #052e16, #047857, #2563eb)",
  color: "white",
  boxShadow: "0 20px 45px rgba(15,23,42,.18)",
  marginBottom: 22,
};

const back: React.CSSProperties = {
  display: "inline-block",
  marginBottom: 12,
  color: "white",
  fontWeight: 950,
  textDecoration: "none",
};

const eyebrow: React.CSSProperties = {
  margin: 0,
  fontSize: 13,
  fontWeight: 900,
  letterSpacing: 1.5,
  textTransform: "uppercase",
  opacity: 0.9,
};

const title: React.CSSProperties = {
  margin: "8px 0",
  fontSize: 42,
  fontWeight: 950,
};

const subtitle: React.CSSProperties = {
  margin: 0,
  maxWidth: 760,
  fontSize: 15,
  lineHeight: 1.6,
  opacity: 0.92,
};

const refreshBtn: React.CSSProperties = {
  border: "none",
  borderRadius: 16,
  padding: "13px 18px",
  fontWeight: 950,
  color: "#064e3b",
  background: "white",
  cursor: "pointer",
};

const grid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
  gap: 16,
  marginBottom: 20,
};

const card: React.CSSProperties = {
  padding: 20,
  borderRadius: 24,
  background: "rgba(255,255,255,.96)",
  border: "1px solid rgba(148,163,184,.28)",
  boxShadow: "0 14px 30px rgba(15,23,42,.08)",
};

const codeBadge: React.CSSProperties = {
  display: "inline-block",
  padding: "7px 10px",
  borderRadius: 999,
  background: "#e0f2fe",
  color: "#075985",
  fontSize: 12,
  fontWeight: 950,
  marginBottom: 10,
};

const cardLabel: React.CSSProperties = {
  margin: 0,
  color: "#64748b",
  fontWeight: 800,
};

const cardValue: React.CSSProperties = {
  margin: "8px 0 0",
  color: "#0f172a",
  fontSize: 32,
  fontWeight: 950,
};

const twoColumn: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
  gap: 20,
};

const panel: React.CSSProperties = {
  padding: 22,
  borderRadius: 28,
  background: "rgba(255,255,255,.96)",
  border: "1px solid rgba(148,163,184,.3)",
  boxShadow: "0 20px 45px rgba(15,23,42,.08)",
};

const sectionTitle: React.CSSProperties = {
  margin: 0,
  fontSize: 23,
  fontWeight: 950,
};

const muted: React.CSSProperties = {
  margin: "6px 0 18px",
  color: "#64748b",
  fontSize: 14,
};

const list: React.CSSProperties = {
  display: "grid",
  gap: 14,
};

const itemCard: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "space-between",
  gap: 16,
  padding: 16,
  borderRadius: 20,
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
};

const photoCard: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "120px 1fr",
  gap: 14,
  padding: 16,
  borderRadius: 20,
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
};

const photoPreview: React.CSSProperties = {
  width: 120,
  height: 100,
  objectFit: "cover",
  borderRadius: 16,
  border: "1px solid #cbd5e1",
};

const noPhoto: React.CSSProperties = {
  width: 120,
  height: 100,
  display: "grid",
  placeItems: "center",
  borderRadius: 16,
  background: "#e2e8f0",
  color: "#64748b",
  fontWeight: 900,
};

const typeText: React.CSSProperties = {
  margin: 0,
  color: "#15803d",
  fontSize: 12,
  fontWeight: 950,
  textTransform: "uppercase",
};

const itemTitle: React.CSSProperties = {
  margin: "4px 0",
  color: "#14532d",
  fontSize: 18,
  fontWeight: 950,
};

const meta: React.CSSProperties = {
  margin: 0,
  color: "#64748b",
  fontSize: 13,
  fontWeight: 800,
};

const bigValue: React.CSSProperties = {
  margin: "10px 0 0",
  color: "#075985",
  fontSize: 24,
  fontWeight: 950,
};

const desc: React.CSSProperties = {
  margin: "6px 0 0",
  color: "#334155",
  fontSize: 14,
};

const dateText: React.CSSProperties = {
  display: "block",
  marginTop: 8,
  color: "#64748b",
  fontSize: 12,
};

const empty: React.CSSProperties = {
  padding: 28,
  borderRadius: 18,
  background: "#f8fafc",
  color: "#64748b",
  textAlign: "center",
  fontWeight: 850,
};
