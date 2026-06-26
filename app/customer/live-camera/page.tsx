"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  email: string | null;
};

type Flock = {
  id: string;
};

type Animal = {
  id: string;
  code: string | null;
  name: string | null;
  type: string | null;
  flock_id: string | null;
};

type AnimalRelation = Animal | Animal[] | null;

type AnimalPhoto = {
  id: string;
  animal_id: string;
  photo_url: string | null;
  caption: string | null;
  created_at: string | null;
  animals: AnimalRelation;
};

export default function CustomerLiveCameraPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [photos, setPhotos] = useState<AnimalPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadLivePhotos();
  }, []);

  async function loadLivePhotos() {
    setLoading(true);
    setMessage("");

    const resolvedProfile = await resolveCustomerProfile();

    if (!resolvedProfile) {
      setProfile(null);
      setPhotos([]);
      setMessage("Please login to view your live chicken updates.");
      setLoading(false);
      return;
    }

    setProfile(resolvedProfile);

    const { data: flocks, error: flockError } = await supabase
      .from("flocks")
      .select("id")
      .eq("customer_id", resolvedProfile.id);

    if (flockError) {
      setPhotos([]);
      setMessage(`Flock load error: ${flockError.message}`);
      setLoading(false);
      return;
    }

    const flockIds = unique((flocks || []).map((flock: Flock) => flock.id).filter(Boolean));

    if (flockIds.length === 0) {
      setPhotos([]);
      setMessage("No flock found for this customer yet.");
      setLoading(false);
      return;
    }

    const { data: animals, error: animalError } = await supabase
      .from("animals")
      .select("id, code, name, type, flock_id")
      .in("flock_id", flockIds);

    if (animalError) {
      setPhotos([]);
      setMessage(`Chicken load error: ${animalError.message}`);
      setLoading(false);
      return;
    }

    const chickenIds = (animals || []).filter(isChicken).map((animal) => animal.id);

    if (chickenIds.length === 0) {
      setPhotos([]);
      setMessage("No chicken records found for live monitoring.");
      setLoading(false);
      return;
    }

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
          type,
          flock_id
        )
      `)
      .in("animal_id", chickenIds)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      setPhotos([]);
      setMessage(`Live camera load error: ${error.message}`);
      setLoading(false);
      return;
    }

    const chickenPhotos = (data || []).filter((photo: any) => {
      const animal = normalizeAnimal(photo.animals);
      return isChicken(animal);
    });

    setPhotos(chickenPhotos as AnimalPhoto[]);
    setLoading(false);
  }

  return (
    <main style={page}>
      <Link href="/customer/dashboard" style={back}>
        ← Back
      </Link>

      <section style={card}>
        <div style={header}>
          <div>
            <h1 style={title}>📷 Live Chicken Camera</h1>
            <p style={subtitle}>
              View-only latest real chicken monitoring photos from your caretaker updates.
            </p>
          </div>

          <button onClick={loadLivePhotos} disabled={loading} style={refreshButton}>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {message && <div style={notice}>{message}</div>}

        {loading ? (
          <p style={muted}>Loading live camera...</p>
        ) : photos.length === 0 ? (
          <p style={muted}>No live chicken photos yet.</p>
        ) : (
          <div style={grid}>
            {photos.map((photo, index) => {
              const animal = normalizeAnimal(photo.animals);

              return (
                <article key={photo.id} style={index === 0 ? featuredPhotoCard : photoCard}>
                  {photo.photo_url ? (
                    <img
                      src={photo.photo_url}
                      alt={photo.caption || "Chicken live update"}
                      style={index === 0 ? featuredImage : image}
                    />
                  ) : (
                    <div style={index === 0 ? featuredEmptyImage : emptyImage}>No Photo</div>
                  )}

                  <div style={body}>
                    <p style={typeText}>{index === 0 ? "LATEST UPDATE" : animal?.type || "Chicken"}</p>
                    <h2 style={animalName}>{animal?.name || "Unnamed Chicken"}</h2>
                    <p style={animalCode}>Code: {animal?.code || "No code"}</p>
                    <p style={caption}>{photo.caption || "No caption provided."}</p>
                    <p style={dateText}>Uploaded: {formatDate(photo.created_at)}</p>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

async function resolveCustomerProfile(): Promise<Profile | null> {
  const { data: authData } = await supabase.auth.getUser();
  const user = authData.user;

  if (!user) return null;

  const email = user.email || "";
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email")
    .or(`id.eq.${user.id},email.eq.${email}`)
    .maybeSingle();

  if (error || !data) return null;
  return data;
}

function unique(values: string[]) {
  return Array.from(new Set(values));
}

function normalizeAnimal(value: AnimalRelation): Animal | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function isChicken(animal: Animal | null | undefined) {
  const type = String(animal?.type || "").toLowerCase();
  const code = String(animal?.code || "").toUpperCase();

  if (["SWINE-002", "COW-001", "COW-002"].includes(code)) return false;

  return type.includes("chicken") || type.includes("poultry");
}

function formatDate(value?: string | null) {
  if (!value) return "No date";
  return new Date(value).toLocaleString("en-PH");
}

const page: React.CSSProperties = {
  minHeight: "100vh",
  background: "linear-gradient(180deg, #ecfccb, #dbeafe)",
  padding: 20,
  fontFamily: "Arial, sans-serif",
};

const back: React.CSSProperties = {
  display: "inline-block",
  marginBottom: 16,
  color: "#15803d",
  fontWeight: 900,
  textDecoration: "none",
};

const card: React.CSSProperties = {
  maxWidth: 1100,
  margin: "0 auto",
  background: "white",
  borderRadius: 28,
  padding: 24,
  boxShadow: "0 20px 45px rgba(0,0,0,0.1)",
};

const header: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  alignItems: "flex-start",
  flexWrap: "wrap",
};

const title: React.CSSProperties = { fontSize: 32, margin: 0, fontWeight: 900 };

const subtitle: React.CSSProperties = { color: "#64748b", maxWidth: 680 };

const refreshButton: React.CSSProperties = {
  padding: "12px 16px",
  borderRadius: 14,
  border: "none",
  background: "#16a34a",
  color: "white",
  fontWeight: 900,
  cursor: "pointer",
};

const notice: React.CSSProperties = {
  background: "#dcfce7",
  color: "#166534",
  padding: 12,
  borderRadius: 14,
  marginBottom: 14,
  fontWeight: 800,
};

const muted: React.CSSProperties = { color: "#64748b", fontWeight: 700 };

const grid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: 16,
  marginTop: 20,
};

const photoCard: React.CSSProperties = {
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: 20,
  overflow: "hidden",
};

const featuredPhotoCard: React.CSSProperties = {
  ...photoCard,
  gridColumn: "1 / -1",
};

const image: React.CSSProperties = {
  width: "100%",
  height: 220,
  objectFit: "cover",
};

const featuredImage: React.CSSProperties = {
  ...image,
  height: 360,
};

const emptyImage: React.CSSProperties = {
  height: 220,
  display: "grid",
  placeItems: "center",
  background: "#e2e8f0",
  color: "#64748b",
  fontWeight: 900,
};

const featuredEmptyImage: React.CSSProperties = {
  ...emptyImage,
  height: 360,
};

const body: React.CSSProperties = { padding: 16 };

const typeText: React.CSSProperties = {
  margin: 0,
  color: "#15803d",
  fontSize: 12,
  fontWeight: 900,
  textTransform: "uppercase",
};

const animalName: React.CSSProperties = {
  margin: "4px 0",
  color: "#14532d",
  fontSize: 20,
  fontWeight: 900,
};

const animalCode: React.CSSProperties = {
  margin: 0,
  color: "#64748b",
  fontWeight: 700,
};

const caption: React.CSSProperties = { color: "#334155", fontWeight: 700 };

const dateText: React.CSSProperties = { color: "#64748b", fontSize: 13 };
