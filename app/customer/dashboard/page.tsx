"use client";

import { useEffect, useState } from "react";

const cards = [
  {
    title: "My Flock",
    icon: "🐣",
    href: "/customer/chicks",
    desc: "Manage chick batches, survival rate, and harvest schedule.",
    badge: "Core",
  },
  {
    title: "Marketplace",
    icon: "🛒",
    href: "/customer/marketplace",
    desc: "Buy chicks, feeds, vitamins, vaccines, and supplements by category.",
    badge: "Shop",
  },
  {
    title: "Caretakers",
    icon: "👨‍🌾",
    href: "/customer/caretakers",
    desc: "Assign trusted farm caretakers to monitor your flock.",
    badge: "Assign",
  },
  {
    title: "Weight Tracker",
    icon: "📈",
    href: "/customer/weight-updates",
    desc: "Track daily growth and average weight updates.",
    badge: "Growth",
  },
  {
    title: "Photo Updates",
    icon: "📸",
    href: "/customer/photo-updates",
    desc: "View latest farm photos and chick development updates.",
    badge: "Proof",
  },
  {
    title: "Live Camera",
    icon: "📹",
    href: "/customer/live-camera",
    desc: "Watch your poultry area through live camera monitoring.",
    badge: "Live",
  },
  {
    title: "Harvest",
    icon: "🐔",
    href: "/customer/harvest",
    desc: "View projected revenue, harvest date, and profit estimates.",
    badge: "ROI",
  },
  {
    title: "Wallet",
    icon: "💰",
    href: "/customer/wallet",
    desc: "Track earnings, payouts, cash-ins, and wallet transactions.",
    badge: "Money",
  },
  {
    title: "Notifications",
    icon: "🔔",
    href: "/customer/notifications",
    desc: "Receive farm alerts, caretaker reports, and harvest reminders.",
    badge: "Alerts",
  },
];

export default function DashboardPage() {
  const [userName, setUserName] = useState("Farmer");

  useEffect(() => {
    const user = localStorage.getItem("farmconnect_user");
    if (user) {
      const parsed = JSON.parse(user);
      setUserName(parsed.full_name || "Farmer");
    }
  }, []);

  return (
    <main className="min-h-screen bg-[#f3fbf5] p-6 md:p-10">
      <div className="max-w-7xl mx-auto">
        <section className="rounded-[32px] bg-gradient-to-r from-green-800 via-green-600 to-emerald-500 text-white p-8 md:p-10 mb-8 shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <p className="bg-white/20 w-fit px-4 py-2 rounded-full text-sm font-bold mb-4">
                🟢 Poultry Management Portal
              </p>

              <h1 className="text-4xl md:text-5xl font-black">
                FarmConnect LIVE
              </h1>

              <p className="mt-3 text-lg text-green-50">
                Welcome back, <b>{userName}</b>
              </p>

              <p className="mt-4 max-w-2xl text-green-50">
                Monitor your flock, buy farm supplies, assign caretakers, track
                growth, view harvest projections, and manage poultry earnings in
                one clean dashboard.
              </p>
            </div>

            <div className="bg-white/15 rounded-3xl p-6 min-w-[240px]">
              <p className="text-green-50">Farm Status</p>
              <h2 className="text-3xl font-black mt-2">ACTIVE</h2>
              <p className="mt-2 text-sm text-green-50">
                Subscriber monitoring enabled
              </p>
            </div>
          </div>
        </section>

        <section className="grid md:grid-cols-4 gap-5 mb-8">
          <div className="bg-white rounded-3xl p-6 shadow border border-green-100">
            <p className="text-gray-500 font-semibold">🐣 Active Flocks</p>
            <h2 className="text-4xl font-black text-green-700 mt-2">1</h2>
            <p className="text-sm text-gray-400 mt-1">Current chick batch</p>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow border border-green-100">
            <p className="text-gray-500 font-semibold">🛒 Marketplace</p>
            <h2 className="text-4xl font-black text-green-700 mt-2">5</h2>
            <p className="text-sm text-gray-400 mt-1">Product categories</p>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow border border-green-100">
            <p className="text-gray-500 font-semibold">⚖ Avg Weight</p>
            <h2 className="text-4xl font-black text-green-700 mt-2">0.55 KG</h2>
            <p className="text-sm text-gray-400 mt-1">Growth monitoring</p>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow border border-green-100">
            <p className="text-gray-500 font-semibold">💰 Projected Earnings</p>
            <h2 className="text-4xl font-black text-green-700 mt-2">
              ₱12,500
            </h2>
            <p className="text-sm text-gray-400 mt-1">Estimated harvest ROI</p>
          </div>
        </section>

        <section className="mb-5">
          <h2 className="text-2xl font-black text-gray-900">
            Farm Management
          </h2>
          <p className="text-gray-500">
            Choose a module below to manage your poultry investment.
          </p>
        </section>

        <section className="grid md:grid-cols-3 gap-5">
          {cards.map((card) => (
            <a
              key={card.title}
              href={card.href}
              className="group bg-white rounded-3xl p-6 shadow border border-green-100 hover:-translate-y-1 hover:shadow-xl transition block"
            >
              <div className="flex items-start justify-between mb-5">
                <div className="text-5xl">{card.icon}</div>

                <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-black">
                  {card.badge}
                </span>
              </div>

              <h3 className="text-2xl font-black text-gray-900 group-hover:text-green-700">
                {card.title}
              </h3>

              <p className="text-gray-500 mt-2 min-h-[48px]">
                {card.desc}
              </p>

              <div className="mt-6 flex items-center justify-between">
                <span className="text-green-700 font-black">Open Module</span>

                <span className="bg-green-600 text-white rounded-full w-9 h-9 grid place-items-center group-hover:bg-green-700">
                  →
                </span>
              </div>
            </a>
          ))}
        </section>
      </div>
    </main>
  );
}