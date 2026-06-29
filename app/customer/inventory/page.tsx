"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  categoryIcon,
  dateText,
  money,
  resolveCustomerProfile,
  shellClass,
  statusPill,
  type CustomerProfile,
} from "@/lib/customer-auth";

type InventoryItem = {
  id: string;
  profile_id: string | null;
  flock_id?: string | null;
  product_id?: string | null;
  marketplace_product_id?: string | null;
  item_name?: string | null;
  name?: string | null;
  category?: string | null;
  unit?: string | null;
  starting_qty?: number | string | null;
  remaining_qty?: number | string | null;
  quantity?: number | string | null;
  low_stock_level?: number | string | null;
  status?: string | null;
  source?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type UsageLog = {
  id: string;
  profile_id?: string | null;
  flock_id?: string | null;
  inventory_id?: string | null;
  item_name?: string | null;
  category?: string | null;
  qty_used?: number | string | null;
  quantity?: number | string | null;
  unit?: string | null;
  used_by?: string | null;
  purpose?: string | null;
  status?: string | null;
  created_at?: string | null;
  used_at?: string | null;
};

type WalletTransaction = {
  id: string;
  profile_id?: string | null;
  customer_id?: string | null;
  transaction_type?: string | null;
  type?: string | null;
  amount?: number | string | null;
  reference_no?: string | null;
  reference?: string | null;
  description?: string | null;
  remarks?: string | null;
  status?: string | null;
  created_at?: string | null;
};

type Product = {
  id: string;
  name?: string | null;
  category?: string | null;
  stock?: number | string | null;
  price?: number | string | null;
  status?: string | null;
  image_url?: string | null;
};

type NormalizedInventoryItem = InventoryItem & {
  displayName: string;
  normalizedCategory: string;
  startingQty: number;
  remainingQty: number;
  lowStockLevel: number;
  isLow: boolean;
  isOut: boolean;
  percentLeft: number;
  marketplaceProduct: Product | null;
};

const MARKETPLACE_CATEGORIES = [
  "ALL",
  "FEEDS",
  "VITAMINS",
  "VACCINES",
  "SUPPLEMENTS",
  "EQUIPMENT",
];

export default function InventoryPage() {
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [logs, setLogs] = useState<UsageLog[]>([]);
  const [walletTx, setWalletTx] = useState<WalletTransaction[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [activeCategory, setActiveCategory] = useState("ALL");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadInventory();
  }, []);

  async function loadInventory() {
    setLoading(true);
    setMessage("");

    const currentProfile = await resolveCustomerProfile();
    setProfile(currentProfile);

    if (!currentProfile) {
      setItems([]);
      setLogs([]);
      setWalletTx([]);
      setProducts([]);
      setMessage("Login required to view inventory.");
      setLoading(false);
      return;
    }

    const [inventoryRes, usageRes, walletRes, productRes] = await Promise.all([
      supabase
        .from("flock_inventory")
        .select("*")
        .eq("profile_id", currentProfile.id)
        .order("created_at", { ascending: false }),

      supabase
        .from("inventory_usage_logs")
        .select("*")
        .eq("profile_id", currentProfile.id)
        .order("created_at", { ascending: false })
        .limit(150),

      supabase
        .from("wallet_transactions")
        .select("*")
        .eq("profile_id", currentProfile.id)
        .order("created_at", { ascending: false })
        .limit(150),

      supabase
        .from("marketplace_products")
        .select("id,name,category,stock,price,status,image_url")
        .order("created_at", { ascending: false }),
    ]);

    const errors = [inventoryRes.error, usageRes.error, walletRes.error, productRes.error]
      .filter(Boolean)
      .map((error) => error?.message)
      .join(" | ");

    if (errors) setMessage(errors);

    setItems((inventoryRes.data || []) as InventoryItem[]);
    setLogs((usageRes.data || []) as UsageLog[]);
    setWalletTx((walletRes.data || []) as WalletTransaction[]);
    setProducts((productRes.data || []) as Product[]);
    setLoading(false);
  }

  const productByName = useMemo(() => {
    const map = new Map<string, Product>();
    products.forEach((product) => {
      const key = normalizeText(product.name);
      if (key && !map.has(key)) map.set(key, product);
    });
    return map;
  }, [products]);

  const productById = useMemo(() => {
    const map = new Map<string, Product>();
    products.forEach((product) => map.set(product.id, product));
    return map;
  }, [products]);

  const normalizedItems = useMemo<NormalizedInventoryItem[]>(() => {
    return items.map((item) => {
      const displayName = item.item_name || item.name || "Farm Supply";
      const normalizedCategory = normalizeCategory(item.category || displayName);
      const remainingQty = toNumber(item.remaining_qty ?? item.quantity ?? 0);
      const startingQty = toNumber(item.starting_qty ?? item.quantity ?? remainingQty);
      const lowStockLevel = toNumber(item.low_stock_level ?? 0);
      const marketplaceProduct =
        productById.get(String(item.marketplace_product_id || item.product_id || "")) ||
        productByName.get(normalizeText(displayName)) ||
        null;
      const percentLeft = startingQty > 0 ? Math.min(100, Math.round((remainingQty / startingQty) * 100)) : 0;

      return {
        ...item,
        displayName,
        normalizedCategory,
        startingQty,
        remainingQty,
        lowStockLevel,
        isLow: lowStockLevel > 0 && remainingQty <= lowStockLevel && remainingQty > 0,
        isOut: remainingQty <= 0,
        percentLeft,
        marketplaceProduct,
      };
    });
  }, [items, productById, productByName]);

  const categories = useMemo(() => {
    const existing = Array.from(new Set(normalizedItems.map((item) => item.normalizedCategory)));
    return MARKETPLACE_CATEGORIES.filter((category) => category === "ALL" || existing.includes(category));
  }, [normalizedItems]);

  const filteredItems = useMemo(() => {
    return normalizedItems.filter((item) => {
      const matchesCategory = activeCategory === "ALL" || item.normalizedCategory === activeCategory;
      const haystack = `${item.displayName} ${item.normalizedCategory} ${item.status || ""}`.toLowerCase();
      return matchesCategory && haystack.includes(search.toLowerCase());
    });
  }, [activeCategory, normalizedItems, search]);

  const marketplacePurchases = useMemo(() => {
    return walletTx.filter((tx) => {
      const text = `${tx.transaction_type || tx.type || ""} ${tx.description || ""} ${tx.remarks || ""}`.toUpperCase();
      return text.includes("MARKETPLACE") || text.includes("PURCHASE") || text.includes("SUPPLY") || text.includes("INVENTORY");
    });
  }, [walletTx]);

  const summary = useMemo(() => {
    const lowStock = normalizedItems.filter((item) => item.isLow).length;
    const outOfStock = normalizedItems.filter((item) => item.isOut).length;
    const totalRemaining = normalizedItems.reduce((sum, item) => sum + item.remainingQty, 0);
    const usedToday = logs.filter((log) => isToday(log.created_at || log.used_at)).length;
    const spent = marketplacePurchases.reduce((sum, tx) => sum + Math.abs(toNumber(tx.amount)), 0);

    return {
      supplies: normalizedItems.length,
      totalRemaining,
      lowStock,
      outOfStock,
      usedToday,
      spent,
    };
  }, [logs, marketplacePurchases, normalizedItems]);

  return (
    <main className={`${shellClass} p-4 pb-28 md:p-8`}>
      <div className="mx-auto max-w-7xl">
        <section className="overflow-hidden rounded-[36px] border border-emerald-300/20 bg-white/10 text-white shadow-2xl shadow-black/20 backdrop-blur-xl">
          <div className="grid gap-6 p-7 lg:grid-cols-[1fr_380px] lg:p-8">
            <div>
              <p className="w-fit rounded-full bg-amber-300 px-4 py-2 text-sm font-black text-emerald-950">
                Marketplace-Synced Inventory
              </p>
              <h1 className="mt-4 text-5xl font-black leading-tight">
                Farm stock room.
              </h1>
              <p className="mt-3 max-w-3xl font-semibold leading-7 text-emerald-50">
                Feeds, vitamins, vaccines, supplements, and equipment purchased from Marketplace appear here after the purchase RPC updates flock_inventory.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  onClick={loadInventory}
                  className="rounded-full bg-white px-5 py-3 font-black text-emerald-950"
                >
                  {loading ? "Refreshing..." : "Refresh Sync"}
                </button>
                <Link
                  href="/customer/marketplace"
                  className="rounded-full bg-amber-300 px-5 py-3 font-black text-emerald-950"
                >
                  Buy Supplies
                </Link>
                <Link
                  href="/customer/chicks"
                  className="rounded-full border border-white/20 bg-white/10 px-5 py-3 font-black text-white"
                >
                  My Flock
                </Link>
              </div>
            </div>

            <aside className="rounded-[30px] border border-white/10 bg-[#06130d]/55 p-6 backdrop-blur-xl">
              <p className="text-sm font-black uppercase tracking-[0.18em] text-emerald-100/70">
                Sync Rule
              </p>
              <h2 className="mt-2 text-3xl font-black">Marketplace → Inventory</h2>
              <p className="mt-3 text-sm font-semibold leading-6 text-emerald-50/70">
                Customer buys a supply product, wallet is deducted by purchase_marketplace_item, then stock is added to this inventory for caretaker/admin usage tracking.
              </p>
              <div className="mt-5 rounded-3xl bg-white/10 p-4">
                <p className="text-xs font-black uppercase tracking-wide text-emerald-100/60">Wallet</p>
                <h3 className="mt-1 text-2xl font-black">{money(profile?.wallet_balance)}</h3>
              </div>
            </aside>
          </div>
        </section>

        {message && (
          <div className="mt-5 rounded-2xl border border-emerald-100 bg-white p-4 font-black text-emerald-800 shadow-xl">
            {message}
          </div>
        )}

        <section className="mt-6 grid gap-4 md:grid-cols-3 xl:grid-cols-6">
          <Summary label="Supplies" value={summary.supplies.toLocaleString()} icon="📦" />
          <Summary label="Remaining" value={summary.totalRemaining.toLocaleString()} icon="📊" />
          <Summary label="Low Stock" value={summary.lowStock.toLocaleString()} icon="⚠️" danger />
          <Summary label="Out" value={summary.outOfStock.toLocaleString()} icon="🚫" danger />
          <Summary label="Used Today" value={summary.usedToday.toLocaleString()} icon="🧾" />
          <Summary label="Market Spend" value={money(summary.spent)} icon="🛒" />
        </section>

        <section className="mt-6 grid gap-3 lg:grid-cols-[1fr_auto]">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search feeds, vitamins, vaccines, supplements, equipment..."
            className="rounded-2xl border border-white/20 bg-white px-5 py-4 font-bold text-emerald-950 shadow-xl outline-none focus:border-amber-300"
          />
          <Link
            href="/customer/marketplace"
            className="rounded-2xl bg-emerald-950 px-6 py-4 text-center font-black text-white shadow-xl"
          >
            Reorder From Marketplace
          </Link>
        </section>

        <div className="mt-5 flex gap-3 overflow-x-auto pb-2">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setActiveCategory(category)}
              className={`shrink-0 rounded-full px-5 py-3 font-black shadow-xl ${
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
            Loading marketplace-synced inventory...
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="mt-6 rounded-[32px] bg-white p-10 text-center shadow-2xl">
            <div className="text-6xl">🛒</div>
            <h2 className="mt-4 text-3xl font-black text-emerald-950">
              No synced supplies found.
            </h2>
            <p className="mt-2 font-bold text-slate-500">
              Buy feeds, vitamins, vaccines, supplements, or equipment from Marketplace.
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
            {filteredItems.map((item) => (
              <article key={item.id} className="rounded-[32px] bg-white p-6 shadow-2xl ring-1 ring-emerald-100/50">
                <div className="flex items-start justify-between gap-4">
                  <div className="grid h-16 w-16 place-items-center rounded-3xl bg-emerald-50 text-4xl">
                    {categoryIcon(item.normalizedCategory)}
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-xs font-black ${inventoryPill(item)}`}>
                    {item.isOut ? "OUT" : item.isLow ? "LOW STOCK" : item.status || "ACTIVE"}
                  </span>
                </div>

                <h2 className="mt-5 text-2xl font-black text-emerald-950">
                  {item.displayName}
                </h2>
                <p className="mt-1 font-bold text-slate-500">
                  {item.normalizedCategory} • Marketplace synced • Added {dateText(item.created_at)}
                </p>

                <div className="mt-5 rounded-3xl bg-emerald-50 p-5">
                  <p className="font-bold text-slate-500">Remaining Stock</p>
                  <h3 className="mt-1 text-4xl font-black text-emerald-800">
                    {item.remainingQty.toLocaleString()} {item.unit || "item"}
                  </h3>
                </div>

                <div className="mt-5">
                  <div className="mb-2 flex justify-between text-sm font-black text-slate-500">
                    <span>Stock progress</span>
                    <span>{item.percentLeft}% left</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full ${item.isLow || item.isOut ? "bg-red-500" : "bg-emerald-600"}`}
                      style={{ width: `${item.percentLeft}%` }}
                    />
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <Mini label="Starting" value={`${item.startingQty.toLocaleString()} ${item.unit || ""}`} />
                  <Mini label="Low Level" value={item.lowStockLevel ? `${item.lowStockLevel.toLocaleString()} ${item.unit || ""}` : "—"} />
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <Mini label="Market Stock" value={item.marketplaceProduct ? `${toNumber(item.marketplaceProduct.stock).toLocaleString()}` : "Matched by RPC"} />
                  <Mini label="Market Price" value={item.marketplaceProduct ? money(item.marketplaceProduct.price) : "—"} />
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  <Link href="/customer/marketplace" className="rounded-2xl bg-emerald-700 px-4 py-3 text-sm font-black text-white">
                    Reorder
                  </Link>
                  <Link href="/customer/chicks" className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-black text-slate-700">
                    Flock
                  </Link>
                </div>
              </article>
            ))}
          </section>
        )}

        <section className="mt-7 grid gap-5 lg:grid-cols-[1fr_.8fr]">
          <section className="rounded-[32px] bg-white p-6 shadow-2xl">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.18em] text-emerald-700">
                  Usage History
                </p>
                <h2 className="mt-1 text-3xl font-black text-emerald-950">
                  Caretaker supply usage
                </h2>
              </div>
              <button onClick={loadInventory} className="rounded-2xl bg-emerald-700 px-5 py-3 font-black text-white">
                Refresh
              </button>
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
                          {toNumber(log.qty_used ?? log.quantity).toLocaleString()} {log.unit || ""} • {log.used_by || "Caretaker"}
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-500">
                          {log.purpose || log.status || "Farm operation"}
                        </p>
                      </div>
                      <p className="text-sm font-black text-emerald-700">
                        {dateText(log.created_at || log.used_at)}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-[32px] bg-white p-6 shadow-2xl">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-emerald-700">
              Marketplace Purchases
            </p>
            <h2 className="mt-1 text-3xl font-black text-emerald-950">
              Purchase ledger
            </h2>
            <p className="mt-2 text-sm font-bold leading-6 text-slate-500">
              These are wallet transactions that look related to marketplace / supply purchases.
            </p>

            {marketplacePurchases.length === 0 ? (
              <div className="mt-5 rounded-3xl bg-slate-50 p-6 text-center font-bold text-slate-500">
                No marketplace purchase ledger found yet.
              </div>
            ) : (
              <div className="mt-5 space-y-3">
                {marketplacePurchases.slice(0, 10).map((tx) => (
                  <article key={tx.id} className="rounded-3xl bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-black text-slate-900">{tx.transaction_type || tx.type || "Marketplace Purchase"}</h3>
                        <p className="mt-1 text-sm font-bold text-slate-500">{tx.description || tx.remarks || tx.reference_no || tx.reference || "Purchase record"}</p>
                        <p className="mt-1 text-xs font-black text-emerald-700">{dateText(tx.created_at)}</p>
                      </div>
                      <b className="text-emerald-800">{money(Math.abs(toNumber(tx.amount)))}</b>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
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
  if (text.includes("CHICK") || text.includes("ROOSTER") || text.includes("CHICKEN")) return "CHICKEN";
  return text || "SUPPLIES";
}

function normalizeText(value?: string | null) {
  return String(value || "").trim().toLowerCase();
}

function toNumber(value: any) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function isToday(value?: string | null) {
  if (!value) return false;
  return new Date(value).toDateString() === new Date().toDateString();
}

function inventoryPill(item: NormalizedInventoryItem) {
  if (item.isOut) return "border-red-200 bg-red-100 text-red-800";
  if (item.isLow) return "border-orange-200 bg-orange-100 text-orange-800";
  return statusPill(item.status);
}

function Summary({ label, value, icon, danger }: { label: string; value: string; icon: string; danger?: boolean }) {
  return (
    <div className="rounded-[28px] bg-white p-5 shadow-2xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-bold text-slate-500">{label}</p>
          <h2 className={`mt-1 text-2xl font-black ${danger ? "text-red-600" : "text-emerald-800"}`}>
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
