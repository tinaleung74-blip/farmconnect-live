"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Caretaker = {
  id: string;
  caretaker_profile_id: string | null;
  email: string | null;
  full_name: string | null;
};

type PaidHire = {
  animal_id: string | null;
  flock_id: string | null;
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

export default function CaretakerPhotosPage() {
  const [caretaker, setCaretaker] = useState<Caretaker | null>(null);
  const [assignedAnimalIds, setAssignedAnimalIds] = useState<string[]>([]);
  const [assignedFlockIds, setAssignedFlockIds] = useState<string[]>([]);
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [photos, setPhotos] = useState<AnimalPhoto[]>([]);
  const [animalId, setAnimalId] = useState("");
  const [caption, setCaption] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setMessage("");

    const context = await resolveCaretakerContext();

    if (!context.caretaker) {
      setCaretaker(null);
      setAssignedAnimalIds([]);
      setAssignedFlockIds([]);
      setAnimals([]);
      setPhotos([]);
      setMessage(context.message || "Please login as caretaker.");
      setLoading(false);
      return;
    }

    setCaretaker(context.caretaker);
    setAssignedAnimalIds(context.animalIds);
    setAssignedFlockIds(context.flockIds);

    await Promise.all([
      loadAnimals(context.animalIds, context.flockIds),
      loadPhotos(context.animalIds, context.flockIds),
    ]);

    setLoading(false);
  }

  async function loadAnimals(animalIds: string[], flockIds: string[]) {
    if (animalIds.length === 0 && flockIds.length === 0) {
      setAnimals([]);
      return;
    }

    let query = supabase
      .from("animals")
      .select("id, code, name, type, flock_id")
      .order("code", { ascending: true });

    query = animalIds.length > 0 ? query.in("id", animalIds) : query.in("flock_id", flockIds);

    const { data, error } = await query;

    if (error) {
      setAnimals([]);
      setMessage(`Animal load error: ${error.message}`);
      return;
    }

    setAnimals((data || []).filter(isChicken));
  }

  async function loadPhotos(animalIds: string[], flockIds: string[]) {
    if (animalIds.length === 0 && flockIds.length === 0) {
      setPhotos([]);
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
      .order("created_at", { ascending: false })
      .limit(300);

    if (error) {
      setPhotos([]);
      setMessage(`Photo history load error: ${error.message}`);
      return;
    }

    const allowedAnimalIds = new Set(animalIds);
    const allowedFlockIds = new Set(flockIds);

    const chickenOnly = (data || []).filter((item: any) => {
      const animal = normalizeAnimal(item.animals);
      if (!isChicken(animal)) return false;
      if (allowedAnimalIds.size > 0 && allowedAnimalIds.has(String(item.animal_id))) return true;
      if (allowedFlockIds.size > 0 && allowedFlockIds.has(String(animal?.flock_id || ""))) return true;
      return false;
    });

    setPhotos(chickenOnly as AnimalPhoto[]);
  }

  async function submitPhoto(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    if (!caretaker) {
      setMessage("Caretaker session not found. Please login again.");
      setSaving(false);
      return;
    }

    if (!animalId || !animals.some((animal) => animal.id === animalId)) {
      setMessage("Please select one assigned chicken.");
      setSaving(false);
      return;
    }

    if (!file) {
      setMessage("Please select a photo to upload.");
      setSaving(false);
      return;
    }

    const extension = file.name.split(".").pop() || "jpg";
    const path = `${caretaker.id}/${animalId}/${Date.now()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("animal-photos")
      .upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || "image/jpeg",
      });

    if (uploadError) {
      setMessage(`Photo upload error: ${uploadError.message}`);
      setSaving(false);
      return;
    }

    const { data: publicUrlData } = supabase.storage
      .from("animal-photos")
      .getPublicUrl(path);

    const { error: insertError } = await supabase.from("animal_photos").insert({
      animal_id: animalId,
      photo_url: publicUrlData.publicUrl,
      caption: caption.trim() || null,
      created_at: new Date().toISOString(),
    });

    if (insertError) {
      setMessage(`Photo record save error: ${insertError.message}`);
      setSaving(false);
      return;
    }

    setAnimalId("");
    setCaption("");
    setFile(null);

    const input = document.getElementById("photo-file") as HTMLInputElement | null;
    if (input) input.value = "";

    setMessage("✅ Chicken photo uploaded and synced.");
    await loadPhotos(assignedAnimalIds, assignedFlockIds);
    setSaving(false);
  }

  return (
    <main style={page}>
      <Link href="/caretaker/dashboard" style={back}>
        ← Back
      </Link>

      <div style={container}>
        <section style={card}>
          <h1 style={title}>📸 Chicken Photo Upload</h1>
          <p style={subtitle}>
            Upload photos only for ACTIVE and PAID assigned chickens.
          </p>

          {message && <div style={notice}>{message}</div>}

          {loading ? (
            <p style={muted}>Loading assigned chickens...</p>
          ) : (
            <form onSubmit={submitPhoto} style={form}>
              <label style={label}>Select Assigned Chicken</label>
              <select value={animalId} onChange={(e) => setAnimalId(e.target.value)} required style={input}>
                <option value="">Choose assigned chicken</option>
                {animals.map((animal) => (
                  <option key={animal.id} value={animal.id}>
                    {animal.name || "Unnamed Chicken"} — {animal.code || "No Code"} — {animal.type || "Chicken"}
                  </option>
                ))}
              </select>

              <label style={label}>Photo</label>
              <input
                id="photo-file"
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                required
                style={input}
              />

              <label style={label}>Caption</label>
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Example: Healthy chicken monitoring update"
                style={textarea}
              />

              <button disabled={saving || animals.length === 0} style={button}>
                {saving ? "Uploading..." : "Upload Chicken Photo"}
              </button>
            </form>
          )}
        </section>

        <section style={historyCard}>
          <h2 style={sectionTitle}>Latest Chicken Photo History</h2>

          {loading ? (
            <p style={muted}>Loading photo history...</p>
          ) : photos.length === 0 ? (
            <p style={muted}>No assigned chicken photo uploads yet.</p>
          ) : (
            <div style={historyList}>
              {photos.map((item) => {
                const animal = normalizeAnimal(item.animals);

                return (
                  <div key={item.id} style={historyItem}>
                    {item.photo_url ? (
                      <img src={item.photo_url} alt={item.caption || "Chicken monitoring photo"} style={photoPreview} />
                    ) : (
                      <div style={noPhoto}>No Photo</div>
                    )}

                    <div>
                      <p style={typeText}>{animal?.type || "Chicken"}</p>
                      <h3 style={animalName}>{animal?.name || "Unnamed Chicken"}</h3>
                      <p style={animalCode}>Code: {animal?.code || "No code"}</p>
                      <p style={noteText}>{item.caption || "No caption provided."}</p>
                      <p style={dateText}>Uploaded: {formatDate(item.created_at)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

async function resolveCaretakerContext() {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  const user = authData.user;

  if (authError || !user) {
    return { caretaker: null, animalIds: [], flockIds: [], message: "Please login as caretaker." };
  }

  const email = user.email || "";
  const { data: caretaker, error: caretakerError } = await supabase
    .from("caretakers")
    .select("id, caretaker_profile_id, email, full_name")
    .or(`caretaker_profile_id.eq.${user.id},email.eq.${email}`)
    .maybeSingle();

  if (caretakerError || !caretaker) {
    return { caretaker: null, animalIds: [], flockIds: [], message: "Caretaker profile not found." };
  }

  const { data: hires, error: hiresError } = await supabase
    .from("customer_caretaker_hires")
    .select("animal_id, flock_id")
    .eq("caretaker_id", caretaker.id)
    .eq("status", "ACTIVE")
    .eq("payment_status", "PAID");

  if (hiresError) {
    return { caretaker, animalIds: [], flockIds: [], message: `Assigned job load error: ${hiresError.message}` };
  }

  const animalIds = unique((hires || []).map((hire: PaidHire) => hire.animal_id).filter(Boolean) as string[]);
  const flockIds = unique((hires || []).map((hire: PaidHire) => hire.flock_id).filter(Boolean) as string[]);

  if (animalIds.length === 0 && flockIds.length === 0) {
    return { caretaker, animalIds, flockIds, message: "No ACTIVE and PAID assigned chicken jobs yet." };
  }

  return { caretaker, animalIds, flockIds, message: "" };
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

const container: React.CSSProperties = {
  maxWidth: 920,
  margin: "0 auto",
  display: "grid",
  gap: 20,
};

const card: React.CSSProperties = {
  background: "white",
  borderRadius: 28,
  padding: 24,
  boxShadow: "0 20px 45px rgba(0,0,0,0.1)",
};

const historyCard: React.CSSProperties = { ...card };

const title: React.CSSProperties = { fontSize: 32, margin: 0, fontWeight: 900 };

const sectionTitle: React.CSSProperties = { fontSize: 24, margin: "0 0 16px", fontWeight: 900 };

const subtitle: React.CSSProperties = { color: "#64748b" };

const form: React.CSSProperties = { display: "grid", gap: 12 };

const label: React.CSSProperties = { fontWeight: 900 };

const input: React.CSSProperties = {
  padding: 14,
  borderRadius: 14,
  border: "1px solid #cbd5e1",
  fontSize: 16,
};

const textarea: React.CSSProperties = { ...input, minHeight: 110 };

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

const notice: React.CSSProperties = {
  background: "#dbeafe",
  color: "#075985",
  padding: 12,
  borderRadius: 14,
  marginBottom: 14,
  fontWeight: 800,
};

const muted: React.CSSProperties = { color: "#64748b", fontWeight: 700 };

const historyList: React.CSSProperties = { display: "grid", gap: 12 };

const historyItem: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "140px 1fr",
  gap: 14,
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: 18,
  padding: 16,
};

const photoPreview: React.CSSProperties = {
  width: 140,
  height: 110,
  objectFit: "cover",
  borderRadius: 16,
  border: "1px solid #cbd5e1",
};

const noPhoto: React.CSSProperties = {
  width: 140,
  height: 110,
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
  fontSize: 14,
  fontWeight: 700,
};

const noteText: React.CSSProperties = {
  margin: "10px 0 0",
  color: "#334155",
};

const dateText: React.CSSProperties = {
  margin: "8px 0 0",
  color: "#64748b",
  fontSize: 13,
};
