"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const cards = [
  {
    title: "My Flock",
    icon: "🐣",
    href: "/customer/chicks",
    desc: "Manage chick batches, caretaker assignment, survival rate, and harvest schedule.",
    badge: "Core",
    meta: "1 active batch",
  },
  {
    title: "Marketplace",
    icon: "🛒",
    href: "/customer/marketplace",
    desc: "Buy chicks, feeds, vitamins, vaccines, and supplements by category.",
    badge: "Shop",
    meta: "5 categories",
  },
  {
    title: "Inventory",
    icon: "📦",
    href: "/customer/inventory",
    desc: "View feeds, vitamins, vaccines, and supplies purchased from marketplace.",
    badge: "Stock",
    meta: "4 items",
  },
  {
    title: "Weight Tracker",
    icon: "📈",
    href: "/customer/weight-updates",
    desc: "Track daily growth and average weight updates.",
    badge: "Growth",
    meta: "22% progress",
  },
  {
    title: "Photo Updates",
    icon: "📸",
    href: "/customer/photo-updates",
    desc: "View latest farm photos and chick development updates.",
    badge: "Proof",
    meta: "Weekly reports",
  },
  {
    title: "Live Camera",
    icon: "📹",
    href: "/customer/live-camera",
    desc: "Watch your poultry area through live camera monitoring.",
    badge: "Live",
    meta: "Online",
  },
  {
    title: "Harvest",
    icon: "🐔",
    href: "/customer/harvest",
    desc: "View projected revenue, harvest date, and profit estimates.",
    badge: "ROI",
    meta: "₱12,500 est.",
  },
  {
    title: "Wallet",
    icon: "💰",
    href: "/customer/wallet",
    desc: "Track earnings, payouts, cash-ins, and wallet transactions.",
    badge: "Money",
    meta: "GCash/Maya pending",
  },
  {
    title: "Notifications",
    icon: "🔔",
    href: "/customer/notifications",
    desc: "Receive farm alerts, caretaker reports, and harvest reminders.",
    badge: "Alerts",
    meta: "3 updates",
  },
];

const activities = [
  "🐣 Batch A001 assigned to caretaker",
  "📈 Latest weight updated to 0.55 KG",
  "📦 Inventory has 4 active supplies",
  "🐔 Harvest projection updated",
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
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-b from-sky-100 via-green-50 to-green-100 p-4 md:p-8">
      <div className="pointer-events-none absolute left-[-80px] top-10 h-56 w-56 rounded-full bg-white/80 blur-3xl" />
      <div className="pointer-events-none absolute right-10 top-24 h-64 w-64 rounded-full bg-white/70 blur-3xl" />
      <div className="pointer-events-none absolute left-1/3 top-48 h-40 w-40 rounded-full bg-yellow-100/70 blur-3xl" />

      <div className="pointer-events-none absolute bottom-0 left-[-10%] h-72 w-[120%] rounded-t-[100%] bg-green-300/40" />
      <div className="pointer-events-none absolute bottom-0 left-[-20%] h-52 w-[140%] rounded-t-[100%] bg-green-500/20" />

      <div className="relative z-10 mx-auto max-w-7xl">
        <section className="relative overflow-hidden rounded-[36px] border border-white/40 bg-white/20 p-7 text-white shadow-2xl backdrop-blur-xl md:p-10">
          <div className="absolute inset-0 bg-gradient-to-br from-green-950/90 via-green-800/75 to-emerald-500/60" />
          <div className="absolute right-[-80px] top-[-80px] h-72 w-72 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute bottom-[-90px] left-[-70px] h-80 w-80 rounded-full bg-lime-300/20 blur-3xl" />

          <div className="relative grid gap-8 lg:grid-cols-[1.4fr_.8fr] lg:items-center">
            <div>
              <div className="mb-5 flex flex-wrap gap-3">
                <span className="rounded-full bg-white/15 px-4 py-2 text-sm font-black">
                  🟢 Live Poultry Portal
                </span>
                <span className="rounded-full bg-yellow-300 px-4 py-2 text-sm font-black text-green-950">
                  Investor Monitoring Active
                </span>
              </div>

              <h1 className="text-4xl font-black leading-tight md:text-6xl">
                Own Real Chickens.
                <br />
                Track Growth. Earn From Harvest.
              </h1>

              <p className="mt-5 max-w-2xl text-lg text-green-50">
                Welcome back, <b>{userName}</b>. Monitor your flock, buy farm
                supplies, track weight, view harvest projections, and manage
                farm earnings from one digital livestock dashboard.
              </p>

              <div className="mt-7 flex flex-wrap gap-4">
                <Link
                  href="/customer/chicks"
                  className="rounded-2xl bg-white px-6 py-4 font-black text-green-800 shadow-xl hover:bg-green-50"
                >
                  Open My Flock
                </Link>

                <Link
                  href="/customer/live-camera"
                  className="rounded-2xl border border-white/30 bg-white/10 px-6 py-4 font-black text-white hover:bg-white/20"
                >
                  Watch Live Farm
                </Link>
              </div>
            </div>

            <div className="rounded-[30px] border border-white/20 bg-white/15 p-6 backdrop-blur">
              <p className="text-sm font-bold text-green-50">Farm Status</p>
              <h2 className="mt-2 text-4xl font-black">ACTIVE</h2>

              <div className="mt-6 grid gap-3">
                {activities.map((item) => (
                  <div
                    key={item}
                    className="rounded-2xl bg-white/15 px-4 py-3 text-sm font-bold"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-5 md:grid-cols-4">
          {[
            ["🐣 Active Flock", "1", "Current chick batch"],
            ["📈 Growth", "22%", "Target weight progress"],
            ["📦 Inventory", "4", "Feeds and farm supplies"],
            ["💰 Projected ROI", "₱12,500", "Estimated harvest earnings"],
          ].map(([label, value, note]) => (
            <div
              key={label}
              className="rounded-[28px] border border-white/70 bg-white/80 p-6 shadow-sm backdrop-blur"
            >
              <p className="font-bold text-gray-500">{label}</p>
              <h2 className="mt-2 text-4xl font-black text-green-700">
                {value}
              </h2>
              <p className="mt-1 text-sm text-gray-400">{note}</p>
            </div>
          ))}
        </section>

        <section className="mb-5 mt-8 flex flex-col justify-between gap-3 md:flex-row md:items-end">
          <div>
            <h2 className="text-3xl font-black text-gray-900">
              Farm Management
            </h2>
            <p className="text-gray-500">
              Choose a module below to manage your poultry investment.
            </p>
          </div>

          <div className="rounded-full bg-green-100 px-5 py-3 text-sm font-black text-green-700">
            9 customer modules active
          </div>
        </section>

        <section className="grid gap-5 md:grid-cols-3">
          {cards.map((card) => (
            <Link
              key={card.title}
              href={card.href}
              className="group rounded-[30px] border border-white/70 bg-white/85 p-6 shadow-sm backdrop-blur transition hover:-translate-y-1 hover:shadow-xl"
            >
              <div className="mb-5 flex items-start justify-between">
                <div className="grid h-16 w-16 place-items-center rounded-3xl bg-[#f3fbf5] text-4xl">
                  {card.icon}
                </div>

                <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-black text-green-700">
                  {card.badge}
                </span>
              </div>

              <h3 className="text-2xl font-black text-gray-900 group-hover:text-green-700">
                {card.title}
              </h3>

              <p className="mt-2 min-h-[48px] text-gray-500">{card.desc}</p>

              <div className="mt-5 flex items-center justify-between border-t border-green-50 pt-4">
                <span className="text-sm font-black text-gray-400">
                  {card.meta}
                </span>

                <span className="grid h-10 w-10 place-items-center rounded-full bg-green-700 text-white transition group-hover:bg-green-800">
                  →
                </span>
              </div>
            </Link>
          ))}
        </section>
      </div>
    </main>
  );
}