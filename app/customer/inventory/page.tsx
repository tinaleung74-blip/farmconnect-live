"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type InventoryItem = {
  id: number;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  source: string;
};

const defaultInventory: InventoryItem[] = [
  {
    id: 1,
    name: "Starter Feed",
    category: "Feeds",
    quantity: 25,
    unit: "kg",
    source: "Marketplace",
  },
  {
    id: 2,
    name: "Grower Feed",
    category: "Feeds",
    quantity: 50,
    unit: "kg",
    source: "Marketplace",
  },
  {
    id: 3,
    name: "Vitamin B Complex",
    category: "Vitamins",
    quantity: 10,
    unit: "bottles",
    source: "Marketplace",
  },
  {
    id: 4,
    name: "Newcastle Vaccine",
    category: "Vaccines",
    quantity: 20,
    unit: "doses",
    source: "Marketplace",
  },
];

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem("farmconnect_inventory");

    if (saved) {
      setItems(JSON.parse(saved));
    } else {
      localStorage.setItem(
        "farmconnect_inventory",
        JSON.stringify(defaultInventory)
      );
      setItems(defaultInventory);
    }
  }, []);

  return (
    <main className="min-h-screen bg-[#f3fbf5] p-6 md:p-10">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="bg-green-100 text-green-700 w-fit px-4 py-2 rounded-full text-sm font-black mb-3">
              📦 Farm Stock Room
            </p>

            <h1 className="text-4xl font-black text-gray-900">
              Inventory
            </h1>

            <p className="text-gray-500 mt-2">
              Feeds, vitamins, vaccines, supplements, and supplies purchased
              from Marketplace.
            </p>
          </div>

          <Link
            href="/customer/dashboard"
            className="bg-white border border-green-100 px-5 py-3 rounded-2xl font-black text-green-700 shadow"
          >
            ← Dashboard
          </Link>
        </div>

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
              {items.filter((i) => i.category === "Feeds").length}
            </h2>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow border border-green-100">
            <p className="text-gray-500 font-semibold">Vitamins</p>
            <h2 className="text-4xl font-black text-green-700 mt-2">
              {items.filter((i) => i.category === "Vitamins").length}
            </h2>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow border border-green-100">
            <p className="text-gray-500 font-semibold">Vaccines</p>
            <h2 className="text-4xl font-black text-green-700 mt-2">
              {items.filter((i) => i.category === "Vaccines").length}
            </h2>
          </div>
        </section>

        <section className="grid md:grid-cols-2 gap-5">
          {items.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-3xl p-6 shadow border border-green-100"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-2xl font-black text-gray-900">
                    {item.name}
                  </h3>

                  <p className="text-gray-500 mt-1">{item.category}</p>
                </div>

                <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-black">
                  {item.source}
                </span>
              </div>

              <div className="bg-[#f3fbf5] rounded-2xl p-5">
                <p className="text-gray-500 font-semibold">Available Stock</p>

                <h2 className="text-4xl font-black text-green-700 mt-2">
                  {item.quantity} {item.unit}
                </h2>
              </div>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}