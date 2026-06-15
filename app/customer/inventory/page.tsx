"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type InventoryItem = {
  id: string;
  name: string;
  category: string;
  quantity: number;
  startingQty: number;
  lowStockLevel: number;
  unit: string;
  status: string;
  source: string;
};

const categories = ["ALL", "FEEDS", "VITAMINS", "VACCINES", "SUPPLEMENTS"];

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("ALL");

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
    return category || "Supplies";
  }

  async function loadInventory() {
    const user = localStorage.getItem("farmconnect_user");
    if (!user) {
      setLoading(false);
      return;
    }

    const profile = JSON.parse(user);

    const { data, error } = await supabase
      .from("flock_inventory")
      .select(
        "id,item_name,category,remaining_qty,starting_qty,low_stock_level,unit,status"
      )
      .eq("profile_id", profile.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setItems([]);
      setLoading(false);
      return;
    }

    setItems(
      (data || []).map((item: any) => ({
        id: item.id,
        name: item.item_name,
        category: item.category || "SUPPLIES",
        quantity: Number(item.remaining_qty || 0),
        startingQty: Number(item.starting_qty || 0),
        lowStockLevel: Number(item.low_stock_level || 0),
        unit: item.unit || "item",
        status: item.status || "AVAILABLE",
        source: "Marketplace",
      }))
    );

    setLoading(false);
  }

  useEffect(() => {
    loadInventory();
  }, []);

  const filteredItems =
    activeCategory === "ALL"
      ? items
      : items.filter((item) => item.category === activeCategory);

  const lowStockItems = useMemo(() => {
    return items.filter((item) => item.quantity <= item.lowStockLevel);
  }, [items]);

  const totalRemaining = useMemo(() => {
    return items.reduce((sum, item) => sum + item.quantity, 0);
  }, [items]);

  return (
    <main className="min-h-screen bg-[#f3fbf5] p-6 md:p-10">
      <div className="max-w-7xl mx-auto">
        <section className="rounded-[32px] bg-gradient-to-r from-green-800 via-green-600 to-emerald-500 text-white p-8 mb-8 shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
            <div>
              <p className="bg-white/20 w-fit px-4 py-2 rounded-full text-sm font-bold mb-4">
                📦 FarmConnect Inventory
              </p>

              <h1 className="text-4xl md:text-5xl font-black">
                Farm Stock Room
              </h1>

              <p className="mt-3 text-green-50 max-w-2xl">
                Live supplies from Marketplace purchases. Feeds, vitamins,
                vaccines, and supplements are tracked here.
              </p>
            </div>

            <div className="bg-white/15 rounded-3xl p-5 min-w-[260px]">
              <p className="text-green-50">Available Supplies</p>
              <h2 className="text-3xl font-black">
                {items.length}
              </h2>
              <p className="text-sm text-green-50 mt-1">
                Total Remaining: {totalRemaining.toLocaleString()}
              </p>
            </div>
          </div>
        </section>

        <section className="grid md:grid-cols-4 gap-5 mb-8">
          <div className="bg-white rounded-3xl p-6 shadow border border-green-100">
            <p className="text-gray-500 font-semibold">Total Items</p>
            <h2 className="text-4xl font-black text-green-700 mt-2">
              {items.length}
            </h2>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow border border-green-100">
            <p className="text-gray-500 font-semibold">Feeds</p>
            <h2 className="text-4xl font-black text-green-700 mt-2">
              {items.filter((i) => i.category === "FEEDS").length}
            </h2>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow border border-green-100">
            <p className="text-gray-500 font-semibold">Health Supplies</p>
            <h2 className="text-4xl font-black text-green-700 mt-2">
              {
                items.filter(
                  (i) =>
                    i.category === "VITAMINS" ||
                    i.category === "VACCINES" ||
                    i.category === "SUPPLEMENTS"
                ).length
              }
            </h2>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow border border-red-100">
            <p className="text-gray-500 font-semibold">Low Stock</p>
            <h2 className="text-4xl font-black text-red-600 mt-2">
              {lowStockItems.length}
            </h2>
          </div>
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
                {cat === "ALL" ? "All Supplies" : label(cat)}
              </button>
            ))}
          </section>

          <Link
            href="/customer/marketplace"
            className="bg-green-700 text-white px-6 py-3 rounded-2xl font-black shadow text-center"
          >
            + Buy Supplies
          </Link>
        </div>

        {loading && (
          <div className="bg-white rounded-3xl p-8 shadow border border-green-100 text-center font-black text-green-700">
            Loading inventory...
          </div>
        )}

        {!loading && filteredItems.length === 0 && (
          <div className="bg-white rounded-3xl p-10 shadow border border-green-100 text-center">
            <div className="text-6xl mb-4">🛒</div>

            <h2 className="text-2xl font-black text-gray-900">
              No supplies yet
            </h2>

            <p className="text-gray-500 mt-2">
              Buy feeds, vitamins, vaccines, or supplements from Marketplace.
            </p>

            <Link
              href="/customer/marketplace"
              className="inline-block mt-5 bg-green-700 text-white px-6 py-3 rounded-2xl font-black"
            >
              Go To Marketplace
            </Link>
          </div>
        )}

        {!loading && filteredItems.length > 0 && (
          <section className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filteredItems.map((item) => {
              const percent =
                item.startingQty > 0
                  ? Math.min(100, Math.round((item.quantity / item.startingQty) * 100))
                  : 0;

              const isLow = item.quantity <= item.lowStockLevel;

              return (
                <div
                  key={item.id}
                  className="bg-white rounded-3xl p-6 shadow border border-green-100"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="text-5xl">{icon(item.category)}</div>

                    <span
                      className={`px-3 py-1 rounded-full text-xs font-black ${
                        isLow
                          ? "bg-red-100 text-red-700"
                          : "bg-green-100 text-green-700"
                      }`}
                    >
                      {isLow ? "LOW STOCK" : item.source}
                    </span>
                  </div>

                  <h2 className="text-2xl font-black text-gray-900">
                    {item.name}
                  </h2>

                  <p className="text-gray-500 mt-1">
                    {label(item.category)}
                  </p>

                  <div className="mt-5 bg-[#f3fbf5] rounded-2xl p-5">
                    <p className="text-gray-500 font-semibold">
                      Available Stock
                    </p>

                    <h3 className="text-4xl font-black text-green-700 mt-2">
                      {item.quantity} {item.unit}
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
                        Alert Level
                      </p>
                      <p className="text-xl font-black text-gray-900">
                        {item.lowStockLevel}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 rounded-2xl bg-green-50 p-4">
                    <p className="text-sm text-gray-500 font-semibold">
                      Inventory Status
                    </p>
                    <p className="font-black text-green-700">
                      {item.status}
                    </p>
                  </div>
                </div>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}