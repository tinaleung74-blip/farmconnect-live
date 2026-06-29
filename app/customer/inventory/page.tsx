"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  categoryIcon,
  dateText,
  resolveCustomerProfile,
  shellClass,
  statusPill,
} from "@/lib/customer-auth";

type InventoryItem = {
  id: string;
  profile_id: string | null;
  flock_id?: string | null;
  item_name: string | null;
  category: string | null;
  unit: string | null;
  starting_qty: number | string | null;
  remaining_qty: number | string | null;
  low_stock_level: number | string | null;
  status: string | null;
  created_at: string | null;
  quantity?: number | string | null;
};

type UsageLog = {
  id: string;
  profile_id: string | null;
  flock_id: string | null;
  inventory_id: string | null;
  item_name: string | null;
  qty_used: number | string | null;
  unit: string | null;
  used_by: string | null;
  purpose: string | null;
  created_at: string | null;
};

type NormalizedInventoryItem = InventoryItem & {
  normalizedCategory: string;
  startingQty: number;
  remainingQty: number;
  lowStockLevel: number;
  isLow: boolean;
};

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [logs, setLogs] = useState<UsageLog[]>([]);
  const [activeCategory, setActiveCategory] = useState("ALL");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadInventory();
  }, []);

  async function loadInventory() {
    setLoading(true);
    setMessage("");

    const profile = await resolveCustomerProfile();
    if (!profile) {
      setItems([]);
      setLogs([]);
      setMessage("Login required to view inventory.");
      setLoading(false);
      return;
    }

    const [inventoryRes, usageRes] = await Promise.all([
      supabase
        .from("flock_inventory")
        .select("id,profile_id,flock_id,item_name,category,unit,starting_qty,remaining_qty,low_stock_level,status,created_at")
        .eq("profile_id", profile.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("inventory_usage_logs")
        .select("id,profile_id,flock_id,inventory_id,item_name,qty_used,unit,used_by,purpose,created_at")
        .eq("profile_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(120),
    ]);

    if (inventoryRes.error) setMessage(inventoryRes.error.message);
    if (usageRes.error) setMessage(usageRes.error.message);

    setItems((inventoryRes.data || []) as InventoryItem[]);
    setLogs((usageRes.data || []) as UsageLog[]);
    setLoading(false);
  }

  const normalizedItems = useMemo<NormalizedInventoryItem[]>(() => {
    return items.map((item) => {
      const remainingQty = Number(item.remaining_qty ?? item.quantity ?? 0);
      const startingQty = Number(item.starting_qty ?? item.quantity ?? remainingQty);
      const lowStockLevel = Number(item.low_stock_level ?? 0);
      const normalizedCategory = normalizeCategory(item.category);

      return {
        ...item,
        normalizedCategory,
        startingQty,
        remainingQty,
        lowStockLevel,
        isLow: lowStockLevel > 0 && remainingQty <= lowStockLevel,
      };
    });
  }, [items]);

  const categories = useMemo(() => {
    return ["ALL", ...Array.from(new Set(normalizedItems.map((item) => item.normalizedCategory)))];
  }, [normalizedItems]);

  const filteredItems = useMemo(() => {
    if (activeCategory === "ALL") return normalizedItems;
    return normalizedItems.filter((item) => item.normalizedCategory === activeCategory);
  }, [activeCategory, normalizedItems]);

  const summary = useMemo(() => {
    const lowStock = normalizedItems.filter((item) => item.isLow).length;
    const supplies = normalizedItems.length;
    const totalRemaining = normalizedItems.reduce((sum, item) => sum + item.remainingQty, 0);
    const usedToday = logs.filter((log) => {
      if (!log.created_at) return false;
      return new Date(log.created_at).toDateString() === new Date().toDateString();
    }).length;

    return { supplies, totalRemaining, lowStock, usedToday };
  }, [logs, normalizedItems]);

  return (
    <main className={`${shellClass} p-4 pb-28 md:p-8`}>
      <div className="mx-auto max-w-7xl">
        <section className="rounded-[36px] border border-emerald-300/20 bg-white/10 p-7 text-white shadow-2xl shadow-black/20 backdrop-blur-xl">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="w-fit rounded-full bg-amber-300 px-4 py-2 text-sm font-black text-emerald-950">
                Inventory
              </p>
              <h1 className="mt-4 text-5xl font-black leading-tight">
                Farm stock room.
              </h1>
              <p className="mt-2 max-w-3xl font-semibold text-emerald-50">
                Supplies come from marketplace purchases. Usage history comes from caretaker completion logs.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={loadInventory}
                className="rounded-full bg-white px-5 py-3 font-black text-emerald-950"
              >
                Refresh
              </button>
              <Link
                href="/customer/marketplace"
                className="rounded-full bg-amber-300 px-5 py-3 font-black text-emerald-950"
              >
                Buy Supplies
              </Link>
            </div>
          </div>
        </section>

        {message && (
          <div className="mt-5 rounded-2xl border border-emerald-100 bg-white p-4 font-black text-emerald-800 shadow-xl">
            {message}
          </div>
        )}

        <section className="mt-6 grid gap-4 md:grid-cols-4">
          <Summary label="Supplies" value={summary.supplies.toLocaleString()} icon="📦" />
          <Summary label="Total Remaining" value={summary.totalRemaining.toLocaleString()} icon="📊" />
          <Summary label="Low Stock" value={summary.lowStock.toLocaleString()} icon="⚠️" danger />
          <Summary label="Used Today" value={summary.usedToday.toLocaleString()} icon="🧾" />
        </section>

        <div className="mt-6 flex gap-3 overflow-x-auto pb-2">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setActiveCategory(category)}
              className={`shrink-0 rounded-full px-5 py-3 font-black ${
                activeCategory === category
                  ? "bg-amber-300 text-emerald-950"
                  : "bg-white text-emerald-800"
              }`}
            >
              {category === "ALL" ? "All Supplies" : `${categoryIcon(category)} ${category}`}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="mt-6 rounded-[32px] bg-white p-8 text-center font-black text-emerald-800 shadow-2xl">
            Loading inventory...
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="mt-6 rounded-[32px] bg-white p-10 text-center shadow-2xl">
            <div className="text-6xl">🛒</div>
            <h2 className="mt-4 text-3xl font-black text-emerald-950">
              No supplies found.
            </h2>
            <p className="mt-2 font-bold text-slate-500">
              Buy feeds, vitamins, vaccines, or supplies from Marketplace.
            </p>
            <Link
              href="/customer/marketplace"
              className="mt-5 inline-block rounded-2xl bg-emerald-700 px-6 py-4 font-black text-white"
            >
              Open Marketplace
            </Link>
          </div>
        ) : (
          <section className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredItems.map((item) => {
              const percent = item.startingQty > 0 ? Math.min(100, Math.round((item.remainingQty / item.startingQty) * 100)) : 0;

              return (
                <article key={item.id} className="rounded-[32px] bg-white p-6 shadow-2xl">
                  <div className="flex items-start justify-between gap-4">
                    <div className="grid h-16 w-16 place-items-center rounded-3xl bg-emerald-50 text-4xl">
                      {categoryIcon(item.normalizedCategory)}
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-xs font-black ${item.isLow ? "border-red-200 bg-red-100 text-red-800" : statusPill(item.status)}`}>
                      {item.isLow ? "LOW STOCK" : item.status || "ACTIVE"}
                    </span>
                  </div>

                  <h2 className="mt-5 text-2xl font-black text-emerald-950">
                    {item.item_name || "Farm Supply"}
                  </h2>
                  <p className="mt-1 font-bold text-slate-500">
                    {item.normalizedCategory} • Added {dateText(item.created_at)}
                  </p>

                  <div className="mt-5 rounded-3xl bg-emerald-50 p-5">
                    <p className="font-bold text-slate-500">Remaining Stock</p>
                    <h3 className="mt-1 text-4xl font-black text-emerald-800">
                      {item.remainingQty.toLocaleString()} {item.unit || "item"}
                    </h3>
                  </div>

                  <div className="mt-5">
                    <div className="mb-2 flex justify-between text-sm font-black text-slate-500">
                      <span>Usage progress</span>
                      <span>{percent}% left</span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full ${item.isLow ? "bg-red-500" : "bg-emerald-600"}`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <Mini label="Starting" value={item.startingQty.toLocaleString()} />
                    <Mini label="Low Level" value={item.lowStockLevel ? item.lowStockLevel.toLocaleString() : "—"} />
                  </div>
                </article>
              );
            })}
          </section>
        )}

        <section className="mt-7 rounded-[32px] bg-white p-6 shadow-2xl">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.18em] text-emerald-700">
                Usage History
              </p>
              <h2 className="mt-1 text-3xl font-black text-emerald-950">
                Caretaker supply usage
              </h2>
            </div>
            <Link href="/customer/chicks" className="font-black text-emerald-700">
              View My Flock →
            </Link>
          </div>

          {logs.length === 0 ? (
            <div className="mt-5 rounded-3xl bg-slate-50 p-6 text-center font-bold text-slate-500">
              No inventory usage logs yet.
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {logs.map((log) => (
                <article key={log.id} className="rounded-3xl border border-slate-100 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <h3 className="font-black text-emerald-950">
                        {log.item_name || "Supply used"}
                      </h3>
                      <p className="mt-1 text-sm font-bold text-slate-500">
                        {log.qty_used || 0} {log.unit || ""} • {log.used_by || "Caretaker"}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-500">
                        {log.purpose || "Farm operation"}
                      </p>
                    </div>
                    <p className="text-sm font-black text-emerald-700">
                      {dateText(log.created_at)}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function normalizeCategory(value?: string | null) {
  const text = String(value || "SUPPLIES").toUpperCase();
  if (text.includes("FEED")) return "FEEDS";
  if (text.includes("VITAMIN")) return "VITAMINS";
  if (text.includes("VACCINE")) return "VACCINES";
  if (text.includes("SUPPLEMENT")) return "SUPPLEMENTS";
  if (text.includes("EQUIPMENT")) return "EQUIPMENT";
  return text || "SUPPLIES";
}

function Summary({ label, value, icon, danger }: { label: string; value: string; icon: string; danger?: boolean }) {
  return (
    <div className="rounded-[28px] bg-white p-5 shadow-2xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-bold text-slate-500">{label}</p>
          <h2 className={`mt-1 text-3xl font-black ${danger ? "text-red-600" : "text-emerald-800"}`}>
            {value}
          </h2>
        </div>
        <div className="text-4xl">{icon}</div>
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-xs font-bold text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-black text-slate-900">{value}</p>
    </div>
  );
}
