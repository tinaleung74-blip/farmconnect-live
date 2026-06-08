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
  },
  {
    title: "Marketplace",
    icon: "🛒",
    href: "/customer/marketplace",
    desc: "Buy chicks, feeds, vitamins, vaccines, and supplements by category.",
    badge: "Shop",
  },
  {
    title: "Inventory",
    icon: "📦",
    href: "/customer/inventory",
    desc: "View feeds, vitamins, vaccines, and supplies purchased from marketplace.",
    badge: "Stock",
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
  {
    title: "Settings",
    icon: "⚙️",
    href: "/customer/settings",
    desc: "Manage profile, account security, and farm preferences.",
    badge: "Account",
  },
  {
    title: "Customer Service",
    icon: "🎧",
    href: "/customer/customer-service",
    desc: "Ask support, report an issue, or request assistance.",
    badge: "Help",
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

  function logout() {
    localStorage.removeItem("farmconnect_user");
    window.location.href = "/customer/login";
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-b from-sky-300 via-lime-100 to-green-300 p-4 md:p-8">
      <div className="absolute right-8 top-8 h-32 w-32 rounded-full bg-yellow-300 shadow-[0_0_100px_rgba(250,204,21,1)]" />
      <div className="absolute left-10 top-20 text-7xl">☁️</div>
      <div className="absolute right-56 top-24 text-7xl">☁️</div>
      <div className="absolute left-1/2 top-36 text-5xl">☁️</div>

      <div className="absolute bottom-0 left-[-20%] h-96 w-[140%] rounded-t-[100%] bg-green-500" />
      <div className="absolute bottom-0 left-[-10%] h-72 w-[120%] rounded-t-[100%] bg-lime-400" />
      <div className="absolute bottom-0 left-0 h-36 w-full bg-green-700/30" />

      <div className="relative z-10 mx-auto max-w-7xl">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div className="rounded-full border-4 border-white bg-yellow-200 px-5 py-3 font-black text-green-950 shadow-xl">
            🚜 FarmConnect Live
          </div>

          <button
            onClick={logout}
            className="rounded-full border-4 border-white bg-red-500 px-5 py-3 font-black text-white shadow-xl hover:bg-red-600"
          >
            🚪 Logout
          </button>
        </div>

        <section className="relative mb-8 overflow-hidden rounded-[40px] border-4 border-white bg-gradient-to-br from-green-700 via-emerald-500 to-lime-400 p-7 text-white shadow-2xl md:p-10">
          <div className="absolute bottom-3 right-10 text-8xl">🐔</div>
          <div className="absolute bottom-12 right-36 text-5xl">🐣</div>
          <div className="absolute bottom-4 left-10 text-7xl">🌾</div>
          <div className="absolute right-8 top-5 text-5xl">🚜</div>

          <div className="relative max-w-3xl">
            <p className="mb-4 w-fit rounded-full bg-white px-4 py-2 text-sm font-black text-green-800">
              🌞 Your Digital Poultry Farm Is Active
            </p>

            <h1 className="text-4xl font-black leading-tight text-white drop-shadow md:text-6xl">
              Welcome, {userName}! 🐣
            </h1>

            <p className="mt-4 text-lg font-black text-green-950">
              Monitor your flock, buy farm supplies, track growth, view harvest
              projections, and manage poultry earnings in one dashboard.
            </p>
          </div>
        </section>

        <section className="mb-6 grid gap-4 md:grid-cols-4">
          {[
            ["🐣 Active Flock", "1", "Batch A001"],
            ["📈 Growth", "22%", "On track"],
            ["📦 Supplies", "4", "In inventory"],
            ["💰 Est. ROI", "₱12,500", "Harvest value"],
          ].map(([label, value, note]) => (
            <div
              key={label}
              className="rounded-[28px] border-4 border-white bg-white/90 p-5 shadow-xl backdrop-blur"
            >
              <p className="font-black text-green-700">{label}</p>
              <h2 className="mt-2 text-3xl font-black text-green-950">
                {value}
              </h2>
              <p className="text-sm font-bold text-gray-500">{note}</p>
            </div>
          ))}
        </section>

        <section className="mb-5">
          <h2 className="text-3xl font-black text-green-950">
            Farm Management
          </h2>
          <p className="font-semibold text-green-800">
            Choose a module below to manage your poultry investment.
          </p>
        </section>

        <section className="grid gap-5 md:grid-cols-3">
          {cards.map((card) => (
            <Link
              key={card.title}
              href={card.href}
              className="group rounded-[30px] border-4 border-white bg-white/90 p-6 shadow-xl backdrop-blur transition hover:-translate-y-2 hover:shadow-2xl"
            >
              <div className="mb-5 flex items-start justify-between">
                <div className="grid h-16 w-16 place-items-center rounded-3xl bg-gradient-to-br from-lime-100 to-green-200 text-4xl shadow-inner">
                  {card.icon}
                </div>

                <span className="rounded-full bg-yellow-200 px-3 py-1 text-xs font-black text-green-950">
                  {card.badge}
                </span>
              </div>

              <h3 className="text-2xl font-black text-green-950 group-hover:text-green-700">
                {card.title}
              </h3>

              <p className="mt-2 min-h-[48px] font-semibold text-gray-600">
                {card.desc}
              </p>

              <div className="mt-5 flex items-center justify-between border-t border-green-100 pt-4">
                <span className="font-black text-green-700">Open Module</span>
                <span className="grid h-10 w-10 place-items-center rounded-full bg-green-700 text-white shadow group-hover:bg-yellow-300 group-hover:text-green-950">
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