"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  dateTimeText,
  isChicken,
  money,
  normalizeAnimal,
  resolveCustomerProfile,
  shellClass,
  statusPill,
  type Animal,
  type AnimalRelation,
} from "@/lib/customer-auth";

type NotificationItem = {
  id: string;
  kind: string;
  title: string;
  description: string;
  amount?: number | string | null;
  status?: string | null;
  date: string | null;
  href: string;
  icon: string;
};

type PhotoEvent = {
  id: string;
  animal_id: string | null;
  photo_url: string | null;
  caption: string | null;
  created_at: string | null;
  animals: AnimalRelation;
};

type WeightEvent = {
  id: string;
  animal_id: string | null;
  weight_kg: number | string | null;
  note: string | null;
  recorded_at: string | null;
  animals: AnimalRelation;
};

type MortalityEvent = {
  id: string;
  animal_id: string | null;
  mortality_count: number | null;
  reason: string | null;
  notes: string | null;
  created_at: string | null;
  animals: AnimalRelation;
};

export default function CustomerNotificationsPage() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadNotifications();
  }, []);

  async function loadNotifications() {
    setLoading(true);
    setMessage("");

    const profile = await resolveCustomerProfile();
    if (!profile) {
      setItems([]);
      setMessage("Login required to view notifications.");
      setLoading(false);
      return;
    }

    const animalRows = await loadCustomerAnimals(profile.id);
    const animalIds = animalRows.map((animal) => animal.id);

    const [walletRes, cashinRes, cashoutRes, sellRes, hireRes, memberRes] = await Promise.all([
      supabase
        .from("wallet_transactions")
        .select("id,transaction_type,amount,reference_no,remarks,description,status,created_at")
        .eq("profile_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("cashin_requests")
        .select("id,amount,status,created_at,reference_no,payment_method")
        .eq("profile_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("cashout_requests")
        .select("id,amount,status,created_at,reference_no,payment_method")
        .eq("profile_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("sell_chicken_requests")
        .select("id,total_amount,customer_net_amount,status,created_at,batch_no,breed,chicken_stage")
        .eq("profile_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("customer_caretaker_hires")
        .select("id,caretaker_name,total_fee,status,payment_status,created_at")
        .eq("profile_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("membership_payments")
        .select("id,amount,status,created_at,reference_no,payment_method")
        .eq("profile_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    const farmEvents = animalIds.length > 0 ? await loadFarmEvents(animalIds) : [];

    const walletItems: NotificationItem[] = (walletRes.data || []).map((row) => ({
      id: `wallet-${row.id}`,
      kind: "Wallet",
      title: row.remarks || row.description || row.transaction_type || "Wallet activity",
      description: `${row.reference_no || "No reference"} • ${row.transaction_type || "Transaction"}`,
      amount: row.amount,
      status: row.status,
      date: row.created_at,
      href: "/customer/wallet",
      icon: "💰",
    }));

    const cashinItems: NotificationItem[] = (cashinRes.data || []).map((row) => ({
      id: `cashin-${row.id}`,
      kind: "Cash-In",
      title: `${row.payment_method || "Cash-In"} request`,
      description: `Reference ${row.reference_no || "pending"}`,
      amount: row.amount,
      status: row.status,
      date: row.created_at,
      href: "/customer/wallet",
      icon: "📥",
    }));

    const cashoutItems: NotificationItem[] = (cashoutRes.data || []).map((row) => ({
      id: `cashout-${row.id}`,
      kind: "Cash-Out",
      title: `${row.payment_method || "Cash-Out"} request`,
      description: `Reference ${row.reference_no || "pending"}`,
      amount: row.amount,
      status: row.status,
      date: row.created_at,
      href: "/customer/wallet",
      icon: "📤",
    }));

    const sellItems: NotificationItem[] = (sellRes.data || []).map((row) => ({
      id: `sell-${row.id}`,
      kind: "Sell Chicken",
      title: row.chicken_stage || row.breed || row.batch_no || "Sell request",
      description: "Per-rooster sell request update",
      amount: row.customer_net_amount || row.total_amount,
      status: row.status,
      date: row.created_at,
      href: "/customer/sell-chicken",
      icon: "🏷️",
    }));

    const hireItems: NotificationItem[] = (hireRes.data || []).map((row) => ({
      id: `hire-${row.id}`,
      kind: "Caretaker",
      title: row.caretaker_name || "Caretaker request",
      description: `Payment: ${row.payment_status || "PENDING"}`,
      amount: row.total_fee,
      status: row.status,
      date: row.created_at,
      href: "/customer/caretakers",
      icon: "👨‍🌾",
    }));

    const memberItems: NotificationItem[] = (memberRes.data || []).map((row) => ({
      id: `membership-${row.id}`,
      kind: "Membership",
      title: `${row.payment_method || "Membership"} payment`,
      description: `Reference ${row.reference_no || "pending"}`,
      amount: row.amount,
      status: row.status,
      date: row.created_at,
      href: "/customer/membership",
      icon: "🥇",
    }));

    const combined = [
      ...walletItems,
      ...cashinItems,
      ...cashoutItems,
      ...sellItems,
      ...hireItems,
      ...memberItems,
      ...farmEvents,
    ].sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());

    if (walletRes.error || cashinRes.error || cashoutRes.error || sellRes.error || hireRes.error || memberRes.error) {
      setMessage("Some notification sources could not load. Refresh again after database sync.");
    }

    setItems(combined);
    setLoading(false);
  }

  const groupedItems = useMemo(() => {
    const today = new Date().toDateString();
    const yesterdayDate = new Date(Date.now() - 86400000).toDateString();

    return {
      Today: items.filter((item) => item.date && new Date(item.date).toDateString() === today),
      Yesterday: items.filter((item) => item.date && new Date(item.date).toDateString() === yesterdayDate),
      Earlier: items.filter((item) => {
        if (!item.date) return true;
        const itemDate = new Date(item.date).toDateString();
        return itemDate !== today && itemDate !== yesterdayDate;
      }),
    };
  }, [items]);

  return (
    <main className={`${shellClass} p-4 pb-28 md:p-8`}>
      <div className="mx-auto max-w-5xl">
        <section className="rounded-[36px] border border-emerald-300/20 bg-white/10 p-7 text-white shadow-2xl shadow-black/20 backdrop-blur-xl">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="w-fit rounded-full bg-amber-300 px-4 py-2 text-sm font-black text-emerald-950">
                Notifications
              </p>
              <h1 className="mt-4 text-5xl font-black leading-tight">
                Farm activity inbox.
              </h1>
              <p className="mt-2 max-w-3xl font-semibold text-emerald-50">
                Real events from wallet, cash requests, rooster sales, caretaker hires, photos, weights, mortality, and membership.
              </p>
            </div>

            <button
              onClick={loadNotifications}
              className="rounded-full bg-white px-5 py-3 font-black text-emerald-950"
            >
              Refresh
            </button>
          </div>
        </section>

        {message && (
          <div className="mt-5 rounded-2xl border border-emerald-100 bg-white p-4 font-black text-emerald-800 shadow-xl">
            {message}
          </div>
        )}

        {loading ? (
          <div className="mt-6 rounded-[32px] bg-white p-8 text-center font-black text-emerald-800 shadow-2xl">
            Loading notifications...
          </div>
        ) : items.length === 0 ? (
          <div className="mt-6 rounded-[32px] bg-white p-10 text-center shadow-2xl">
            <div className="text-6xl">🔔</div>
            <h2 className="mt-4 text-3xl font-black text-emerald-950">
              No production notifications yet.
            </h2>
            <p className="mt-2 font-bold text-slate-500">
              Wallet, marketplace, caretaker, and farm updates will appear here.
            </p>
          </div>
        ) : (
          <div className="mt-6 space-y-7">
            {Object.entries(groupedItems).map(([label, rows]) =>
              rows.length > 0 ? (
                <section key={label}>
                  <h2 className="mb-3 text-xl font-black text-white">{label}</h2>
                  <div className="space-y-4">
                    {rows.map((item) => (
                      <Link
                        key={item.id}
                        href={item.href}
                        className="block rounded-[28px] bg-white p-5 shadow-2xl transition hover:-translate-y-1"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex gap-4">
                            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-3xl">
                              {item.icon}
                            </div>
                            <div>
                              <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
                                {item.kind}
                              </p>
                              <h3 className="mt-1 text-xl font-black text-emerald-950">
                                {item.title}
                              </h3>
                              <p className="mt-1 text-sm font-bold text-slate-500">
                                {item.description} • {dateTimeText(item.date)}
                              </p>
                            </div>
                          </div>

                          <div className="shrink-0 text-right">
                            {item.amount !== undefined && (
                              <p className="font-black text-emerald-700">{money(item.amount)}</p>
                            )}
                            <span className={`mt-2 inline-block rounded-full border px-3 py-1 text-xs font-black ${statusPill(item.status)}`}>
                              {item.status || "INFO"}
                            </span>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>
              ) : null
            )}
          </div>
        )}
      </div>
    </main>
  );
}

async function loadCustomerAnimals(profileId: string) {
  const direct = await supabase
    .from("animals")
    .select("id,code,name,type,breed,profile_id,flock_id")
    .eq("profile_id", profileId);

  if (!direct.error) return ((direct.data || []) as Animal[]).filter(isChicken);

  const flocks = await supabase.from("flocks").select("id").eq("profile_id", profileId);
  const flockIds = (flocks.data || []).map((flock) => flock.id).filter(Boolean);
  if (flockIds.length === 0) return [];

  const byFlock = await supabase
    .from("animals")
    .select("id,code,name,type,breed,profile_id,flock_id")
    .in("flock_id", flockIds);

  return ((byFlock.data || []) as Animal[]).filter(isChicken);
}

async function loadFarmEvents(animalIds: string[]) {
  const [photoRes, weightRes, mortalityRes] = await Promise.all([
    supabase
      .from("animal_photos")
      .select("id,animal_id,photo_url,caption,created_at,animals(id,code,name,type,breed)")
      .in("animal_id", animalIds)
      .order("created_at", { ascending: false })
      .limit(12),
    supabase
      .from("animal_weights")
      .select("id,animal_id,weight_kg,note,recorded_at,animals(id,code,name,type,breed)")
      .in("animal_id", animalIds)
      .order("recorded_at", { ascending: false })
      .limit(12),
    supabase
      .from("mortality_logs")
      .select("id,animal_id,mortality_count,reason,notes,created_at,animals(id,code,name,type,breed)")
      .in("animal_id", animalIds)
      .order("created_at", { ascending: false })
      .limit(12),
  ]);

  const photoItems: NotificationItem[] = ((photoRes.data || []) as PhotoEvent[])
    .filter((photo) => isChicken(normalizeAnimal(photo.animals)))
    .map((photo) => {
      const animal = normalizeAnimal(photo.animals);
      return {
        id: `photo-${photo.id}`,
        kind: "Photo Update",
        title: animal?.name || animal?.code || "New rooster photo",
        description: photo.caption || "Latest caretaker/customer uploaded photo",
        status: "PHOTO",
        date: photo.created_at,
        href: "/customer/photo-updates",
        icon: "📸",
      };
    });

  const weightItems: NotificationItem[] = ((weightRes.data || []) as WeightEvent[])
    .filter((weight) => isChicken(normalizeAnimal(weight.animals)))
    .map((weight) => {
      const animal = normalizeAnimal(weight.animals);
      return {
        id: `weight-${weight.id}`,
        kind: "Weight Update",
        title: `${animal?.name || animal?.code || "Rooster"} • ${weight.weight_kg || "—"} kg`,
        description: weight.note || "Latest weight record",
        status: "WEIGHT",
        date: weight.recorded_at,
        href: "/customer/weight-updates",
        icon: "⚖️",
      };
    });

  const mortalityItems: NotificationItem[] = ((mortalityRes.data || []) as MortalityEvent[])
    .filter((mortality) => isChicken(normalizeAnimal(mortality.animals)))
    .map((mortality) => {
      const animal = normalizeAnimal(mortality.animals);
      return {
        id: `mortality-${mortality.id}`,
        kind: "Mortality",
        title: animal?.name || animal?.code || "Mortality report",
        description: mortality.reason || mortality.notes || "Mortality log submitted",
        amount: mortality.mortality_count,
        status: "ALERT",
        date: mortality.created_at,
        href: "/customer/notifications",
        icon: "⚠️",
      };
    });

  return [...photoItems, ...weightItems, ...mortalityItems];
}
