"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Animal = {
  id: string;
  code: string | null;
  name: string | null;
  type: string | null;
};

type AnimalRelation = Animal | Animal[] | null;

type AnimalPhoto = {
  id: string;
  animal_id: string | null;
  photo_url: string | null;
  caption: string | null;
  created_at: string | null;
  animals: AnimalRelation;
};

export default function CustomerPhotoUpdatesPage() {
  const [photos, setPhotos] = useState<AnimalPhoto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPhotos();
  }, []);

  async function loadPhotos() {
    setLoading(true);

    const { data, error } = await supabase
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
      .order("created_at", { ascending: false });

    if (error) {
      alert(`Photo load error: ${error.message}`);
      setPhotos([]);
      setLoading(false);
      return;
    }

    const chickenOnly = (data || []).filter((item: any) => {
      const animal = normalizeAnimal(item.animals);
      return String(animal?.type || "").toLowerCase().includes("chicken");
    });

    setPhotos(chickenOnly as AnimalPhoto[]);
    setLoading(false);
  }

  return (
    <main style={page}>
      <section style={hero}>
        <div>
          <Link href="/customer/dashboard" style={back}>
            Back to Dashboard
          </Link>

          <p style={eyebrow}>FarmConnect Live Monitoring</p>
          <h1 style={title}>Photo Updates</h1>

          <p style={subtitle}>
            View-only chicken photo updates uploaded by caretakers. Customers
            can monitor updates but cannot upload, edit, or delete records.
          </p>
        </div>

        <div style={heroCard}>
          <span>Latest Chicken Photos</span>
          <strong>{photos.length}</strong>
          <small>Caretaker uploads</small>
        </div>
      </section>

      <section style={summaryGrid}>
        <div style={summaryCard}>
          <span>PHOTO</span>
          <div>
            <p>Chicken Photo Updates</p>
            <strong>{photos.length}</strong>
          </div>
        </div>

        <div style={summaryCard}>
          <span>CHICKEN</span>
          <div>
            <p>Chicken Records</p>
            <strong>{new Set(photos.map((p) => p.animal_id)).size}</strong>
          </div>
        </div>

        <div style={summaryCard}>
          <span>SAFE</span>
          <div>
            <p>Access Type</p>
            <strong>View Only</strong>
          </div>
        </div>
      </section>

      {loading ? (
        <section style={empty}>Loading chicken photo updates...</section>
      ) : photos.length === 0 ? (
        <section style={empty}>
          No chicken photo updates yet. Once the caretaker uploads monitoring
          photos, they will appear here.
        </section>
      ) : (
        <section style={grid}>
          {photos.map((photo) => (
            <article key={photo.id} style={card}>
              <div style={imageWrap}>
                {photo.photo_url ? (
                  <img
                    src={photo.photo_url}
                    alt={photo.caption || "Chicken photo update"}
                    style={image}
                  />
                ) : (
                  <div style={placeholder}>No photo preview</div>
                )}
              </div>

              <div style={content}>
                <div style={badge}>Caretaker Photo Update</div>

                <h2 style={cardTitle}>
                  {normalizeAnimal(photo.animals)?.name || "Unnamed Chicken"}
                </h2>

                <p style={info}>
                  Chicken Code: {normalizeAnimal(photo.animals)?.code || "No code"}
                </p>

                <p style={info}>
                  Chicken Type: {normalizeAnimal(photo.animals)?.type || "Chicken"}
                </p>

                <p style={captionText}>
                  {photo.caption || "No caption provided."}
                </p>

                <p style={dateText}>
                  Uploaded: {formatDate(photo.created_at)}
                </p>
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}

function normalizeAnimal(value: AnimalRelation): Animal | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

function formatDate(value?: string | null) {
  if (!value) return "No date";
  return new Date(value).toLocaleString("en-PH");
}

const page: React.CSSProperties = {
  minHeight: "100vh",
  padding: 28,
  background:
    "radial-gradient(circle at top left, #bbf7d0, transparent 30%), radial-gradient(circle at top right, #bae6fd, transparent 28%), linear-gradient(135deg, #f0fdf4 0%, #eff6ff 55%, #fff7ed 100%)",
  color: "#0f172a",
};

const hero: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 22,
  alignItems: "center",
  maxWidth: 1180,
  margin: "0 auto 22px",
  background: "rgba(255,255,255,0.86)",
  borderRadius: 32,
  padding: 30,
  boxShadow: "0 24px 65px rgba(15,23,42,0.13)",
};

const back: React.CSSProperties = {
  display: "inline-block",
  marginBottom: 14,
  color: "#166534",
  fontWeight: 950,
  textDecoration: "none",
};

const eyebrow: React.CSSProperties = {
  margin: 0,
  color: "#15803d",
  fontWeight: 950,
  letterSpacing: 1,
  textTransform: "uppercase",
};

const title: React.CSSProperties = {
  margin: "8px 0",
  fontSize: 42,
  lineHeight: 1.05,
  fontWeight: 950,
  color: "#14532d",
};

const subtitle: React.CSSProperties = {
  margin: 0,
  color: "#475569",
  maxWidth: 760,
  fontSize: 16,
  lineHeight: 1.5,
};

const heroCard: React.CSSProperties = {
  minWidth: 210,
  padding: 24,
  borderRadius: 26,
  background: "linear-gradient(135deg, #16a34a, #22c55e)",
  color: "white",
  display: "grid",
  gap: 8,
  boxShadow: "0 22px 45px rgba(22,163,74,0.3)",
};

const summaryGrid: React.CSSProperties = {
  maxWidth: 1180,
  margin: "0 auto 22px",
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 16,
};

const summaryCard: React.CSSProperties = {
  display: "flex",
  gap: 14,
  alignItems: "center",
  padding: 18,
  borderRadius: 24,
  background: "rgba(255,255,255,0.86)",
  boxShadow: "0 15px 38px rgba(15,23,42,0.09)",
};

const grid: React.CSSProperties = {
  maxWidth: 1180,
  margin: "0 auto",
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))",
  gap: 20,
};

const card: React.CSSProperties = {
  background: "rgba(255,255,255,0.93)",
  borderRadius: 28,
  overflow: "hidden",
  boxShadow: "0 18px 45px rgba(15,23,42,0.12)",
  border: "1px solid rgba(255,255,255,0.95)",
};

const imageWrap: React.CSSProperties = {
  width: "100%",
  height: 220,
  background: "#e2e8f0",
};

const image: React.CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
};

const placeholder: React.CSSProperties = {
  width: "100%",
  height: "100%",
  display: "grid",
  placeItems: "center",
  color: "#64748b",
  fontWeight: 900,
};

const content: React.CSSProperties = {
  padding: 20,
};

const badge: React.CSSProperties = {
  display: "inline-block",
  background: "#dcfce7",
  color: "#166534",
  padding: "7px 11px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 950,
  marginBottom: 12,
};

const cardTitle: React.CSSProperties = {
  margin: 0,
  fontSize: 21,
  color: "#14532d",
  fontWeight: 950,
};

const info: React.CSSProperties = {
  color: "#475569",
  margin: "8px 0 0",
  fontWeight: 800,
};

const captionText: React.CSSProperties = {
  color: "#334155",
  marginTop: 12,
};

const dateText: React.CSSProperties = {
  color: "#64748b",
  fontSize: 13,
  marginTop: 12,
};

const empty: React.CSSProperties = {
  maxWidth: 1180,
  margin: "0 auto",
  background: "rgba(255,255,255,0.9)",
  borderRadius: 24,
  padding: 30,
  color: "#64748b",
};