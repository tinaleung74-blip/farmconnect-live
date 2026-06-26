"use client";

import { useEffect, useMemo, useState } from "react";
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

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  description: string;
  date: string | null;
  href: string;
  badge: string;
};

type CashRequest = {
  id: string;
  profile_id?: string | null;
  customer_id?: string | null;
  amount?: number | null;
  status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type WalletTransaction = {
  id: string;
  profile_id: string | null;
  amount: number | null;
  transaction_type: string | null;
  description: string | null;
  status: string | null;
  created_at: string | null;
};

type Hire = {
  id: string;
  customer_id: string | null;
  caretaker_id: string | null;
  status: string | null;
  payment_status: string | null;
  created_at: string | null;
};

type SellChickenRequest = {
  id: string;
  profile_id?: string | null;
  customer_id?: string | null;
  flock_id?: string | null;
  status?: string | null;
  expected_amount?: number | null;
  amount?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type AnimalPhoto = {
  id: string;
  animal_id: string | null;
  photo_url: string | null;
  caption: string | null;
  created_at: string | null;
  animals: AnimalRelation;
};

type AnimalWeight = {
  id: string;
  animal_id: string | null;
  weight_kg: number | null;
  note: string | null;
  recorded_at: string | null;
  animals: AnimalRelation;
};

type MortalityLog = {
  id: string;
  animal_id: string | null;
  mortality_count: number | null;
  reason: string | null;
  notes: string | null;
  created_at: string | null;
  animals: AnimalRelation;
};

export default function CustomerNotificationsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const latestNotifications = useMemo(() => {
    return [...notifications].sort((a, b) => {
      return new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime();
    });
  }, [notifications]);

  useEffect(() => {
    loadNotifications();
  }, []);

  async function loadNotifications() {
    setLoading(true);
    setMessage("");

    const resolvedProfile = await resolveCustomerProfile();

    if (!resolvedProfile) {
      setProfile(null);
      setNotifications([]);
      setMessage("Please login to view your notifications.");
      setLoading(false);
      return;
    }

    setProfile(resolvedProfile);

    const { data: flocks, error: flockError } = await supabase
      .from("flocks")
      .select("id")
      .eq("customer_id", resolvedProfile.id);

    if (flockError) {
      setNotifications([]);
      setMessage(`Flock load error: ${flockError.message}`);
      setLoading(false);
      return;
    }

    const flockIds = unique((flocks || []).map((flock: Flock) => flock.id).filter(Boolean));

    const animalIds = await loadCustomerChickenIds(flockIds);
    const items: NotificationItem[] = [];

    items.push(...(await loadCashinNotifications(resolvedProfile.id)));
    items.push(...(await loadCashoutNotifications(resolvedProfile.id)));
    items.push(...(await loadWalletNotifications(resolvedProfile.id)));
    items.push(...(await loadCaretakerHireNotifications(resolvedProfile.id)));
    items.push(...(await loadSellChickenNotifications(resolvedProfile.id, flockIds)));

    if (animalIds.length > 0) {
      items.push(...(await loadPhotoNotifications(animalIds)));
      items.push(...(await loadWeightNotifications(animalIds)));
      items.push(...(await loadMortalityNotifications(animalIds)));
    }

    setNotifications(items);
    setLoading(false);
  }

  async function loadCustomerChickenIds(flockIds: string[]) {
    if (flockIds.length === 0) return [];

    const { data, error } = await supabase
      .from("animals")
      .select("id, code, name, type, flock_id")
      .in("flock_id", flockIds);

    if (error) return [];

    return (data || []).filter(isChicken).map((animal) => animal.id);
  }

  async function loadCashinNotifications(profileId: string) {
    const { data } = await supabase
      .from("cashin_requests")
      .select("id, profile_id, customer_id, amount, status, created_at, updated_at")
      .or(`profile_id.eq.${profileId},customer_id.eq.${profileId}`)
      .order("created_at", { ascending: false })
      .limit(50);

    return (data || []).map((item: CashRequest) => ({
      id: `cashin-${item.id}`,
      type: "cashin",
      title: `💰 Cash In ${item.status || "Request"}`,
      description: `Cash in request ${formatPeso(item.amount)} is ${formatStatus(item.status)}.`,
      date: item.updated_at || item.created_at || null,
      href: "/customer/wallet",
      badge: item.status || "CASH IN",
    }));
  }

  async function loadCashoutNotifications(profileId: string) {
    const { data } = await supabase
      .from("cashout_requests")
      .select("id, profile_id, customer_id, amount, status, created_at, updated_at")
      .or(`profile_id.eq.${profileId},customer_id.eq.${profileId}`)
      .order("created_at", { ascending: false })
      .limit(50);

    return (data || []).map((item: CashRequest) => ({
      id: `cashout-${item.id}`,
      type: "cashout",
      title: `💸 Cash Out ${item.status || "Request"}`,
      description: `Cash out request ${formatPeso(item.amount)} is ${formatStatus(item.status)}.`,
      date: item.updated_at || item.created_at || null,
      href: "/customer/wallet",
      badge: item.status || "CASH OUT",
    }));
  }

  async function loadWalletNotifications(profileId: string) {
    const { data } = await supabase
      .from("wallet_transactions")
      .select("id, profile_id, amount, transaction_type, description, status, created_at")
      .eq("profile_id", profileId)
      .order("created_at", { ascending: false })
      .limit(80);

    return (data || []).map((item: WalletTransaction) => ({
      id: `wallet-${item.id}`,
      type: "wallet",
      title: `Wallet ${item.transaction_type || "Activity"}`,
      description: `${item.description || "Wallet transaction"} — ${formatPeso(item.amount)} (${formatStatus(item.status)}).`,
      date: item.created_at,
      href: "/customer/transactions",
      badge: item.transaction_type || "WALLET",
    }));
  }

  async function loadCaretakerHireNotifications(profileId: string) {
    const { data } = await supabase
      .from("customer_caretaker_hires")
      .select("id, customer_id, caretaker_id, status, payment_status, created_at")
      .eq("customer_id", profileId)
      .order("created_at", { ascending: false })
      .limit(50);

    return (data || []).map((item: Hire) => ({
      id: `hire-${item.id}`,
      type: "hire",
      title: "👨‍🌾 Caretaker Hire Update",
      description: `Caretaker hire is ${formatStatus(item.status)} and payment is ${formatStatus(item.payment_status)}.`,
      date: item.created_at,
      href: "/customer/caretaker-hiring",
      badge: item.status || "CARETAKER",
    }));
  }

  async function loadSellChickenNotifications(profileId: string, flockIds: string[]) {
    let query = supabase
      .from("sell_chicken_requests")
      .select("id, profile_id, customer_id, flock_id, status, expected_amount, amount, created_at, updated_at")
      .order("created_at", { ascending: false })
      .limit(80);

    const customerFilter = `profile_id.eq.${profileId},customer_id.eq.${profileId}`;
    const flockFilter = flockIds.length > 0 ? `,flock_id.in.(${flockIds.join(",")})` : "";
    query = query.or(`${customerFilter}${flockFilter}`);

    const { data } = await query;

    return (data || []).map((item: SellChickenRequest) => ({
      id: `sell-${item.id}`,
      type: "sell",
      title: `🛒 Chicken Sale ${item.status || "Request"}`,
      description: `Chicken sale request is ${formatStatus(item.status)}. Amount: ${formatPeso(item.amount ?? item.expected_amount)}.`,
      date: item.updated_at || item.created_at || null,
      href: "/customer/harvest",
      badge: item.status || "SELL",
    }));
  }

  async function loadPhotoNotifications(animalIds: string[]) {
    const { data } = await supabase
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
      .in("animal_id", animalIds)
      .order("created_at", { ascending: false })
      .limit(80);

    return (data || [])
      .filter((item: AnimalPhoto) => isChicken(normalizeAnimal(item.animals)))
      .map((item: AnimalPhoto) => {
        const animal = normalizeAnimal(item.animals);

        return {
          id: `photo-${item.id}`,
          type: "photo",
          title: "🐔 New Chicken Photo",
          description: `${animal?.name || "Chicken"} (${animal?.code || "No code"}) has a new monitoring photo. ${item.caption || ""}`.trim(),
          date: item.created_at,
          href: "/customer/live-camera",
          badge: "PHOTO",
        };
      });
  }

  async function loadWeightNotifications(animalIds: string[]) {
    const { data } = await supabase
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
          type,
          flock_id
        )
      `)
      .in("animal_id", animalIds)
      .order("recorded_at", { ascending: false })
      .limit(80);

    return (data || [])
      .filter((item: AnimalWeight) => isChicken(normalizeAnimal(item.animals)))
      .map((item: AnimalWeight) => {
        const animal = normalizeAnimal(item.animals);

        return {
          id: `weight-${item.id}`,
          type: "weight",
          title: "⚖️ Weight Updated",
          description: `${animal?.name || "Chicken"} (${animal?.code || "No code"}) weight is ${item.weight_kg ?? "—"} kg. ${item.note || ""}`.trim(),
          date: item.recorded_at,
          href: "/customer/weight",
          badge: "WEIGHT",
        };
      });
  }

  async function loadMortalityNotifications(animalIds: string[]) {
    const { data } = await supabase
      .from("mortality_logs")
      .select(`
        id,
        animal_id,
        mortality_count,
        reason,
        notes,
        created_at,
        animals (
          id,
          code,
          name,
          type,
          flock_id
        )
      `)
      .in("animal_id", animalIds)
      .order("created_at", { ascending: false })
      .limit(80);

    return (data || [])
      .filter((item: MortalityLog) => isChicken(normalizeAnimal(item.animals)))
      .map((item: MortalityLog) => {
        const animal = normalizeAnimal(item.animals);

        return {
          id: `mortality-${item.id}`,
          type: "mortality",
          title: "⚠️ Mortality Report",
          description: `${animal?.name || "Chicken"} (${animal?.code || "No code"}) mortality count: ${item.mortality_count ?? 0}. Reason: ${item.reason || "No reason"}.`,
          date: item.created_at,
          href: "/customer/notifications",
          badge: "MORTALITY",
        };
      });
  }

  return (
    <main style={page}>
      <Link href="/customer/dashboard" style={back}>
        ← Back
      </Link>

      <section style={card}>
        <div style={header}>
          <div>
            <h1 style={title}>🔔 Notifications</h1>
            <p style={subtitle}>
              Real production events from wallet, caretaker hiring, chicken photos,
              weights, mortality, and sell chicken requests.
            </p>
          </div>

          <button onClick={loadNotifications} disabled={loading} style={refreshButton}>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {message && <div style={notice}>{message}</div>}

        {loading ? (
          <p style={muted}>Loading notifications...</p>
        ) : latestNotifications.length === 0 ? (
          <p style={muted}>No production notifications yet.</p>
        ) : (
          <div style={list}>
            {latestNotifications.map((item) => (
              <Link key={item.id} href={item.href} style={notificationCard}>
                <div>
                  <p style={badge}>{item.badge}</p>
                  <h2 style={notificationTitle}>{item.title}</h2>
                  <p style={description}>{item.description}</p>
                  <p style={dateText}>{formatDate(item.date)}</p>
                </div>
              </Link>
            ))}
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

function formatStatus(value?: string | null) {
  return String(value || "PENDING").replaceAll("_", " ");
}

function formatPeso(value?: number | null) {
  const amount = Number(value || 0);
  return amount.toLocaleString("en-PH", {
    style: "currency",
    currency: "PHP",
  });
}

function formatDate(value?: string | null) {
  if (!value) return "No date";
  return new Date(value).toLocaleString("en-PH");
}

const page: React.CSSProperties = {
  minHeight: "100vh",
  background: "linear-gradient(180deg, #f0fdf4, #dbeafe)",
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
  maxWidth: 680,
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
  gap: 12,
  marginTop: 20,
};

const notificationCard: React.CSSProperties = {
  display: "block",
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: 18,
  padding: 16,
  textDecoration: "none",
  color: "inherit",
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

const notificationTitle: React.CSSProperties = {
  margin: 0,
  color: "#14532d",
  fontSize: 20,
  fontWeight: 900,
};

const description: React.CSSProperties = {
  margin: "8px 0 0",
  color: "#334155",
  fontWeight: 700,
};

const dateText: React.CSSProperties = {
  margin: "8px 0 0",
  color: "#64748b",
  fontSize: 13,
};
