"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type AnimalPhoto = {
  id: string;
  animal_id?: string | null;
  flock_id?: string | null;
  photo_url?: string | null;
  caption?: string | null;
  created_at?: string | null;
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
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      alert(`Photo load error: ${error.message}`);
      setPhotos([]);
    } else {
      setPhotos(data || []);
    }

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
            View the latest farm photos uploaded from caretaker operations. This
            page is view-only and does not allow direct customer-to-caretaker
            communication.
          </p>
        </div>

        <div style={heroCard}>
          <span>Latest Photos</span>
          <strong>{photos.length}</strong>
          <small>Caretaker uploads</small>
        </div>
      </section>

      <section style={summaryGrid}>
        <div style={summaryCard}>
          <span>PHOTO</span>
          <div>
            <p>Total Updates</p>
            <strong>{photos.length}</strong>
          </div>
        </div>

        <div style={summaryCard}>
          <span>FLOCK</span>
          <div>
            <p>Linked Records</p>
            <strong>
              {new Set(photos.map((p) => p.flock_id || p.animal_id)).size}
            </strong>
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
        <section style={empty}>Loading photo updates...</section>
      ) : photos.length === 0 ? (
        <section style={empty}>
          No caretaker photo updates yet. Once the caretaker uploads farm photos,
          they will appear here.
        </section>
      ) : (
        <section style={grid}>
          {photos.map((photo) => (
            <article key={photo.id} style={card}>
              <div style={imageWrap}>
                {photo.photo_url ? (
                  <img src={photo.photo_url} alt="Farm update" style={image} />
                ) : (
                  <div style={placeholder}>No photo preview</div>
                )}
              </div>

              <div style={content}>
                <div style={badge}>Caretaker Photo Update</div>

                <h2 style={cardTitle}>
                  {photo.caption || "Farm condition update"}
                </h2>

                <p style={info}>
                  Flock ID: {photo.flock_id || photo.animal_id || "Not linked"}
                </p>

                <p style={dateText}>Uploaded: {formatDate(photo.created_at)}</p>
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}

function formatDate(value?: string | null) {
  if (!value) return "No date";
  return new Date(value).toLocaleString();
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
  marginTop: 10,
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