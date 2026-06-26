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

type Hire = {
  id: string;
  customer_id: string | null;
  caretaker_id: string | null;
  flock_id: string | null;
  animal_id: string | null;
  status: string | null;
  payment_status: string | null;
  created_at: string | null;
};

type Animal = {
  id: string;
  code: string | null;
  name: string | null;
  type: string | null;
  flock_id: string | null;
};

type TaskCard = {
  hire: Hire;
  animal: Animal | null;
};

export default function CaretakerTasksPage() {
  const [caretaker, setCaretaker] = useState<Caretaker | null>(null);
  const [tasks, setTasks] = useState<TaskCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadTasks();
  }, []);

  async function loadTasks() {
    setLoading(true);
    setMessage("");

    const resolvedCaretaker = await resolveCaretaker();

    if (!resolvedCaretaker) {
      setCaretaker(null);
      setTasks([]);
      setMessage("Please login as caretaker.");
      setLoading(false);
      return;
    }

    setCaretaker(resolvedCaretaker);

    const { data: hires, error: hireError } = await supabase
      .from("customer_caretaker_hires")
      .select("id, customer_id, caretaker_id, flock_id, animal_id, status, payment_status, created_at")
      .eq("caretaker_id", resolvedCaretaker.id)
      .eq("status", "ACTIVE")
      .eq("payment_status", "PAID")
      .order("created_at", { ascending: false });

    if (hireError) {
      setTasks([]);
      setMessage(`Assigned job load error: ${hireError.message}`);
      setLoading(false);
      return;
    }

    const paidHires = hires || [];
    const animalIds = unique(paidHires.map((hire: Hire) => hire.animal_id).filter(Boolean) as string[]);
    const flockIds = unique(paidHires.map((hire: Hire) => hire.flock_id).filter(Boolean) as string[]);

    let animals: Animal[] = [];

    if (animalIds.length > 0 || flockIds.length > 0) {
      let animalQuery = supabase
        .from("animals")
        .select("id, code, name, type, flock_id")
        .order("code", { ascending: true });

      if (animalIds.length > 0) {
        animalQuery = animalQuery.in("id", animalIds);
      } else {
        animalQuery = animalQuery.in("flock_id", flockIds);
      }

      const { data: animalData, error: animalError } = await animalQuery;

      if (animalError) {
        setMessage(`Chicken load error: ${animalError.message}`);
      }

      animals = (animalData || []).filter(isChicken);
    }

    const animalById = new Map(animals.map((animal) => [animal.id, animal]));
    const firstAnimalByFlock = new Map<string, Animal>();

    animals.forEach((animal) => {
      if (animal.flock_id && !firstAnimalByFlock.has(animal.flock_id)) {
        firstAnimalByFlock.set(animal.flock_id, animal);
      }
    });

    const cards = paidHires.map((hire: Hire) => {
      const directAnimal = hire.animal_id ? animalById.get(hire.animal_id) || null : null;
      const flockAnimal = hire.flock_id ? firstAnimalByFlock.get(hire.flock_id) || null : null;

      return {
        hire,
        animal: directAnimal || flockAnimal,
      };
    });

    setTasks(cards.filter((card) => !card.animal || isChicken(card.animal)));
    setLoading(false);
  }

  return (
    <main style={page}>
      <Link href="/caretaker/dashboard" style={back}>
        ← Back
      </Link>

      <section style={card}>
        <div style={header}>
          <div>
            <h1 style={title}>🧑‍🌾 Caretaker Tasks</h1>
            <p style={subtitle}>
              ACTIVE and PAID assigned chicken jobs only. Use these shortcuts for feeding,
              photos, weight, and mortality updates.
            </p>
          </div>

          <button onClick={loadTasks} disabled={loading} style={refreshButton}>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {message && <div style={notice}>{message}</div>}

        {loading ? (
          <p style={muted}>Loading assigned jobs...</p>
        ) : tasks.length === 0 ? (
          <p style={muted}>No ACTIVE and PAID assigned chicken jobs yet.</p>
        ) : (
          <div style={list}>
            {tasks.map((task) => (
              <article key={task.hire.id} style={taskCard}>
                <div>
                  <p style={badge}>{task.hire.payment_status || "PAID"}</p>
                  <h2 style={taskTitle}>
                    {task.animal?.name || "Assigned Chicken Job"}
                  </h2>
                  <p style={detailText}>Code: {task.animal?.code || "Flock assignment"}</p>
                  <p style={detailText}>Type: {task.animal?.type || "Chicken"}</p>
                  <p style={detailText}>Status: {task.hire.status || "ACTIVE"}</p>
                  <p style={dateText}>Assigned: {formatDate(task.hire.created_at)}</p>
                </div>

                <div style={actions}>
                  <Link href="/caretaker/feeding" style={actionButton}>Feeding</Link>
                  <Link href="/caretaker/photos" style={actionButton}>Photos</Link>
                  <Link href="/caretaker/weight" style={actionButton}>Weight</Link>
                  <Link href="/caretaker/mortality" style={dangerButton}>Mortality</Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

async function resolveCaretaker(): Promise<Caretaker | null> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  const user = authData.user;

  if (authError || !user) return null;

  const email = user.email || "";

  const { data, error } = await supabase
    .from("caretakers")
    .select("id, caretaker_profile_id, email, full_name")
    .or(`caretaker_profile_id.eq.${user.id},email.eq.${email}`)
    .maybeSingle();

  if (error || !data) return null;
  return data;
}

function unique(values: string[]) {
  return Array.from(new Set(values));
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
  maxWidth: 980,
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

const title: React.CSSProperties = {
  fontSize: 32,
  margin: 0,
  fontWeight: 900,
};

const subtitle: React.CSSProperties = {
  color: "#64748b",
  maxWidth: 720,
};

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

const muted: React.CSSProperties = {
  color: "#64748b",
  fontWeight: 700,
};

const list: React.CSSProperties = {
  display: "grid",
  gap: 14,
  marginTop: 20,
};

const taskCard: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr auto",
  gap: 16,
  alignItems: "center",
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: 20,
  padding: 16,
};

const badge: React.CSSProperties = {
  display: "inline-block",
  margin: 0,
  marginBottom: 8,
  background: "#dcfce7",
  color: "#166534",
  borderRadius: 999,
  padding: "5px 10px",
  fontSize: 12,
  fontWeight: 900,
};

const taskTitle: React.CSSProperties = {
  margin: 0,
  color: "#14532d",
  fontSize: 20,
  fontWeight: 900,
};

const detailText: React.CSSProperties = {
  margin: "6px 0 0",
  color: "#334155",
  fontWeight: 700,
};

const dateText: React.CSSProperties = {
  margin: "8px 0 0",
  color: "#64748b",
  fontSize: 13,
};

const actions: React.CSSProperties = {
  display: "grid",
  gap: 8,
  minWidth: 140,
};

const actionButton: React.CSSProperties = {
  display: "block",
  textAlign: "center",
  padding: "10px 12px",
  borderRadius: 12,
  background: "#0ea5e9",
  color: "white",
  textDecoration: "none",
  fontWeight: 900,
};

const dangerButton: React.CSSProperties = {
  ...actionButton,
  background: "#dc2626",
};
