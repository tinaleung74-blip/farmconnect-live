"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
};

type InventoryItem = {
  id: string;
  profile_id: string | null;
  item_name: string | null;
  category: string | null;
  quantity: number | null;
  unit: string | null;
  created_at: string | null;
  starting_qty?: number | null;
  remaining_qty?: number | null;
  low_stock_level?: number | null;
  status?: string | null;
};

type Animal = {
  id: string;
  code: string | null;
  name: string | null;
  type: string | null;
};

type AnimalRelation = Animal | Animal[] | null;

type FlockInventoryRelation = InventoryItem | InventoryItem[] | null;

type UsageLog = {
  id: string;
  animal_id: string | null;
  inventory_id: string | null;
  qty_used: number | null;
  status: string | null;
  created_at: string | null;
  animals: AnimalRelation;
  flock_inventory: FlockInventoryRelation;
};

const categories = ["ALL", "FEEDS", "VITAMINS", "VACCINES", "SUPPLEMENTS"];

export default function InventoryPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [usageLogs, setUsageLogs] = useState<UsageLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("ALL");
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadInventoryPage();
  }, []);

  async function loadInventoryPage() {
    setLoading(true);
    setMessage("");

    const resolvedProfile = await resolveProfile();

    if (!resolvedProfile) {
      setItems([]);
      setUsageLogs([]);
      setLoading(false);
      return;
    }

    setProfile(resolvedProfile);

    await Promise.all([
      loadInventory(resolvedProfile.id),
      loadUsageHistory(resolvedProfile.id),
    ]);

    setLoading(false);
  }

  async function resolveProfile() {
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData.user) {
      setMessage("Please login to view your chicken supplies.");
      return null;
    }

    const authUser = authData.user;

    const { data: profileById } = await supabase
      .from("profiles")
      .select("id, email, full_name")
      .eq("id", authUser.id)
      .maybeSingle();

    if (profileById) return profileById as Profile;

    const { data: profileByEmail } = await supabase
      .from("profiles")
      .select("id, email, full_name")
      .eq("email", authUser.email)
      .maybeSingle();

    if (profileByEmail) return profileByEmail as Profile;

    setMessage("Customer profile not found.");
    return null;
  }

  async function loadInventory(profileId: string) {
    const richSelect =
      "id, profile_id, item_name, category, quantity, unit, created_at, starting_qty, remaining_qty, low_stock_level, status";

    const basicSelect =
      "id, profile_id, item_name, category, quantity, unit, created_at";

    const primary = await supabase
      .from("flock_inventory")
      .select(richSelect)
      .eq("profile_id", profileId)
      .order("created_at", { ascending: false });

    let inventoryRows: InventoryItem[] = [];

    if (!primary.error) {
      inventoryRows = (primary.data || []) as InventoryItem[];
    } else {
      const fallback = await supabase
        .from("flock_inventory")
        .select(basicSelect)
        .eq("profile_id", profileId)
        .order("created_at", { ascending: false });

      if (fallback.error) {
        setItems([]);
        setMessage(`Inventory load error: ${fallback.error.message}`);
        return;
      }

      inventoryRows = (fallback.data || []) as InventoryItem[];
    }

    setItems(inventoryRows);
  }

  async function loadUsageHistory(profileId: string) {
    const { data, error } = await supabase
      .from("inventory_usage_logs")
      .select(`
        id,
        animal_id,
        inventory_id,
        qty_used,
        status,
        created_at,
        animals (
          id,
          code,
          name,
          type
        ),
        flock_inventory (
          id,
          profile_id,
          item_name,
          category,
          quantity,
          unit,
          created_at
        )
      `)
      .order("created_at", { ascending: false })
      .limit(300);

    if (error) {
      setUsageLogs([]);
      setMessage(`Usage history load error: ${error.message}`);
      return;
    }

    const customerChickenUsage = (data || []).filter((log: any) => {
      const animal = normalizeAnimal(log.animals);
      const inventory = normalizeFlockInventory(log.flock_inventory);
      const belongsToCustomer = inventory?.profile_id === profileId;
      const isChicken = String(animal?.type || "")
        .toLowerCase()
        .includes("chicken");

      return belongsToCustomer && isChicken;
    });

    setUsageLogs(customerChickenUsage as UsageLog[]);
  }

  const normalizedItems = useMemo(() => {
    return items.map((item) => {
      const quantity = Number(item.remaining_qty ?? item.quantity ?? 0);
      const startingQty = Number(item.starting_qty ?? item.quantity ?? quantity);
      const lowStockLevel = Number(item.low_stock_level ?? 0);

      return {
        ...item,
        displayCategory: normalizeCategory(item.category),
        quantity,
        startingQty,
        lowStockLevel,
        status: item.status || "AVAILABLE",
      };
    });
  }, [items]);

  const filteredItems =
    activeCategory === "ALL"
      ? normalizedItems
      : normalizedItems.filter((item) => item.displayCategory === activeCategory);

  const lowStockItems = normalizedItems.filter(
    (item) => item.lowStockLevel > 0 && item.quantity <= item.lowStockLevel
  );

  const totalRemaining = normalizedItems.reduce(
    (sum, item) => sum + item.quantity,
    0
  );

  return (
    <main className="min-h-screen bg-[#f3fbf5] p-6 md:p-10">
      <div className="max-w-7xl mx-auto">
        <section className="rounded-[32px] bg-gradient-to-r from-green-800 via-green-600 to-emerald-500 text-white p-8 mb-8 shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
            <div>
              <p className="bg-white/20 w-fit px-4 py-2 rounded-full text-sm font-bold mb-4">
                📦 FarmConnect Poultry Inventory
              </p>

              <h1 className="text-4xl md:text-5xl font-black">
                Farm Stock Room
              </h1>

              <p className="mt-3 text-green-50 max-w-2xl">
                Chicken supplies from Marketplace purchases and caretaker feeding
                usage. Feeds, vitamins, vaccines, and supplements are tracked here.
              </p>

              {profile && (
                <p className="mt-3 text-sm text-green-50">
                  Customer: {profile.full_name || profile.email || "Profile"}
                </p>
              )}
            </div>

            <div className="bg-white/15 rounded-3xl p-5 min-w-[260px]">
              <p className="text-green-50">Chicken Supplies</p>
              <h2 className="text-3xl font-black">{normalizedItems.length}</h2>
              <p className="text-sm text-green-50 mt-1">
                Total Stock: {totalRemaining.toLocaleString()}
              </p>
            </div>
          </div>
        </section>

        {message && (
          <div className="bg-white rounded-3xl p-5 mb-6 shadow border border-yellow-100 text-yellow-700 font-bold">
            {message}
          </div>
        )}

        <section className="grid md:grid-cols-4 gap-5 mb-8">
          <Summary label="Chicken Supplies" value={normalizedItems.length} />
          <Summary
            label="Feeds"
            value={normalizedItems.filter((i) => i.displayCategory === "FEEDS").length}
          />
          <Summary
            label="Health Supplies"
            value={
              normalizedItems.filter((i) =>
                ["VITAMINS", "VACCINES", "SUPPLEMENTS"].includes(i.displayCategory)
              ).length
            }
          />
          <Summary label="Low Stock" value={lowStockItems.length} danger />
        </section>

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <section className="flex gap-3 overflow-x-auto">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-5 py-3 rounded-full font-black whitespace-nowrap ${
                  activeCategory === cat
                    ? "bg-green-700 text-white"
                    : "bg-white text-green-700 border border-green-100"
                }`}
              >
                {cat === "ALL" ? "All Chicken Supplies" : label(cat)}
              </button>
            ))}
          </section>

          <Link
            href="/customer/marketplace"
            className="bg-green-700 text-white px-6 py-3 rounded-2xl font-black shadow text-center"
          >
            + Buy Chicken Supplies
          </Link>
        </div>

        {loading ? (
          <div className="bg-white rounded-3xl p-8 shadow border border-green-100 text-center font-black text-green-700">
            Loading inventory...
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="bg-white rounded-3xl p-10 shadow border border-green-100 text-center mb-8">
            <div className="text-6xl mb-4">🛒</div>

            <h2 className="text-2xl font-black text-gray-900">
              No chicken supplies yet
            </h2>

            <p className="text-gray-500 mt-2">
              Buy feeds, vitamins, vaccines, or supplements from Marketplace.
            </p>
          </div>
        ) : (
          <section className="grid md:grid-cols-2 xl:grid-cols-3 gap-5 mb-10">
            {filteredItems.map((item) => {
              const percent =
                item.startingQty > 0
                  ? Math.min(
                      100,
                      Math.round((item.quantity / item.startingQty) * 100)
                    )
                  : 0;

              const isLow =
                item.lowStockLevel > 0 && item.quantity <= item.lowStockLevel;

              return (
                <div
                  key={item.id}
                  className="bg-white rounded-3xl p-6 shadow border border-green-100"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="text-5xl">{icon(item.displayCategory)}</div>

                    <span
                      className={`px-3 py-1 rounded-full text-xs font-black ${
                        isLow
                          ? "bg-red-100 text-red-700"
                          : "bg-green-100 text-green-700"
                      }`}
                    >
                      {isLow ? "LOW STOCK" : item.status}
                    </span>
                  </div>

                  <h2 className="text-2xl font-black text-gray-900">
                    {item.item_name || "Chicken Supply"}
                  </h2>

                  <p className="text-gray-500 mt-1">
                    {label(item.displayCategory)}
                  </p>

                  <div className="mt-5 bg-[#f3fbf5] rounded-2xl p-5">
                    <p className="text-gray-500 font-semibold">
                      Current Inventory Stock
                    </p>

                    <h3 className="text-4xl font-black text-green-700 mt-2">
                      {item.quantity} {item.unit || "item"}
                    </h3>
                  </div>

                  <div className="mt-5">
                    <div className="flex justify-between text-sm font-bold text-gray-500 mb-2">
                      <span>Stock Usage</span>
                      <span>{percent}% remaining</span>
                    </div>

                    <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          isLow ? "bg-red-500" : "bg-green-600"
                        }`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-green-100 p-4">
                      <p className="text-gray-500 text-sm font-semibold">
                        Starting
                      </p>
                      <p className="text-xl font-black text-gray-900">
                        {item.startingQty}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-green-100 p-4">
                      <p className="text-gray-500 text-sm font-semibold">
                        Low Stock Level
                      </p>
                      <p className="text-xl font-black text-gray-900">
                        {item.lowStockLevel || "—"}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </section>
        )}

        <section className="bg-white rounded-3xl p-6 shadow border border-green-100">
          <h2 className="text-2xl font-black text-green-800">
            Latest Caretaker Feeding / Usage Records
          </h2>

          <p className="text-gray-500 mt-1 mb-5">
            Synced from caretaker feeding logs through inventory_usage_logs.
          </p>

          {loading ? (
            <p className="font-bold text-green-700">Loading usage history...</p>
          ) : usageLogs.length === 0 ? (
            <p className="text-gray-500 font-bold">
              No caretaker feeding or usage records yet.
            </p>
          ) : (
            <div className="grid gap-4">
              {usageLogs.map((log) => {
                const animal = normalizeAnimal(log.animals);
                const inventory = normalizeFlockInventory(log.flock_inventory);

                return (
                  <div
                    key={log.id}
                    className="rounded-2xl bg-green-50 border border-green-100 p-5"
                  >
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                      <div>
                        <p className="text-xs font-black text-green-700 uppercase">
                          {animal?.type || "Chicken"}
                        </p>

                        <h3 className="text-xl font-black text-gray-900 mt-1">
                          {animal?.name || "Unnamed Chicken"}
                        </h3>

                        <p className="text-gray-500 font-bold">
                          Chicken Code: {animal?.code || "No code"}
                        </p>

                        <p className="text-gray-700 mt-3 font-bold">
                          Feed Item: {inventory?.item_name || "Chicken feed item"}
                        </p>

                        <p className="text-gray-700 font-bold">
                          Quantity Used: {log.qty_used ?? 0} {inventory?.unit || ""}
                        </p>
                      </div>

                      <div className="text-left md:text-right">
                        <span className="inline-block px-3 py-1 rounded-full bg-white text-green-700 text-xs font-black">
                          {log.status || "USED"}
                        </span>

                        <p className="text-gray-500 text-sm mt-2">
                          Date: {formatDate(log.created_at)}
                        </p>
                      </div>
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

function normalizeAnimal(value: AnimalRelation): Animal | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function normalizeFlockInventory(
  value: FlockInventoryRelation
): InventoryItem | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function Summary({
  label,
  value,
  danger,
}: {
  label: string;
  value: number;
  danger?: boolean;
}) {
  return (
    <div
      className={`bg-white rounded-3xl p-6 shadow border ${
        danger ? "border-red-100" : "border-green-100"
      }`}
    >
      <p className="text-gray-500 font-semibold">{label}</p>
      <h2
        className={`text-4xl font-black mt-2 ${
          danger ? "text-red-600" : "text-green-700"
        }`}
      >
        {value}
      </h2>
    </div>
  );
}

function normalizeCategory(value?: string | null) {
  const text = String(value || "").toUpperCase();

  if (text.includes("FEED")) return "FEEDS";
  if (text.includes("VITAMIN")) return "VITAMINS";
  if (text.includes("VACCINE")) return "VACCINES";
  if (text.includes("SUPPLEMENT")) return "SUPPLEMENTS";

  return "SUPPLEMENTS";
}

function icon(category: string) {
  if (category === "FEEDS") return "🌾";
  if (category === "VITAMINS") return "💊";
  if (category === "VACCINES") return "💉";
  if (category === "SUPPLEMENTS") return "🧴";
  return "📦";
}

function label(category: string) {
  if (category === "FEEDS") return "Feeds";
  if (category === "VITAMINS") return "Vitamins";
  if (category === "VACCINES") return "Vaccines";
  if (category === "SUPPLEMENTS") return "Supplements";
  return "Chicken Supplies";
}

function formatDate(value?: string | null) {
  if (!value) return "No date";
  return new Date(value).toLocaleString("en-PH");
}