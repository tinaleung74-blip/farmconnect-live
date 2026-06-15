"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  wallet_balance: number | null;
  verification_status: string | null;
  membership_status: string | null;
  membership_expiry: string | null;
  account_status: string | null;
};

const cards = [
  {
    title: "My Flock",
    icon: "🐣",
    href: "/customer/chicks",
    desc: "Monitor chicks as they grow into mature chickens and ready-to-sell tandang.",
    badge: "Core",
    locked: true,
  },
  {
    title: "Hire Caretaker",
    icon: "🧑‍🌾",
    href: "/customer/caretakers",
    desc: "Hire a verified FarmConnect caretaker for your poultry batch.",
    badge: "Care",
    locked: true,
  },
  {
    title: "Marketplace",
    icon: "🛒",
    href: "/customer/marketplace",
    desc: "Buy chicks, feeds, vitamins, vaccines, and supplements.",
    badge: "Shop",
    locked: true,
  },
  {
    title: "Inventory",
    icon: "📦",
    href: "/customer/inventory",
    desc: "View supplies purchased from marketplace and synced to flock inventory.",
    badge: "Stock",
    locked: true,
  },
  {
    title: "Weight Tracker",
    icon: "📈",
    href: "/customer/weight-updates",
    desc: "View caretaker-submitted chicken weight and growth updates.",
    badge: "Growth",
    locked: true,
  },
  {
    title: "Photo Updates",
    icon: "📸",
    href: "/customer/photo-updates",
    desc: "View real farm photos as chicks grow into mature chickens.",
    badge: "Proof",
    locked: true,
  },
  {
    title: "Live Camera",
    icon: "📹",
    href: "/customer/live-camera",
    desc: "Watch your poultry area through live camera monitoring.",
    badge: "Live",
    locked: true,
  },
  {
    title: "Sell Chicken",
    icon: "🐓",
    href: "/customer/sell-chicken",
    desc: "Sell mature chickens one by one when they become tandang and market-ready.",
    badge: "Sales",
    locked: true,
  },
  {
    title: "Wallet",
    icon: "💰",
    href: "/customer/wallet",
    desc: "Cash-in, cash-out, wallet balance, and FarmConnect credits.",
    badge: "Money",
    locked: true,
  },
  {
    title: "Membership",
    icon: "💳",
    href: "/customer/membership",
    desc: "Pay and monitor your Annual Investor Membership status.",
    badge: "Required",
    locked: false,
  },
  {
    title: "Notifications",
    icon: "🔔",
    href: "/customer/notifications",
    desc: "Receive farm alerts, caretaker reports, and selling reminders.",
    badge: "Alerts",
    locked: false,
  },
  {
    title: "Settings",
    icon: "⚙️",
    href: "/customer/settings",
    desc: "Manage profile, account security, farm preferences, and notification settings.",
    badge: "Account",
    locked: false,
  },
  {
    title: "Customer Service",
    icon: "🤖",
    href: "/customer/customer-service",
    desc: "Chat with FarmConnect AI Assistant or request admin support.",
    badge: "AI Help",
    locked: false,
  },
];

export default function DashboardPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [userName, setUserName] = useState("Farmer");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, []);

  function getStoredProfileId() {
    if (typeof window === "undefined") return "";

    const directId =
      localStorage.getItem("farmconnect_profile_id") ||
      localStorage.getItem("profile_id") ||
      localStorage.getItem("customer_id") ||
      "";

    const rawUser = localStorage.getItem("farmconnect_user");

    if (directId) return directId;

    if (rawUser) {
      try {
        const parsed = JSON.parse(rawUser);
        return parsed?.id || parsed?.profile_id || parsed?.customer_id || "";
      } catch {
        return "";
      }
    }

    return "";
  }

  async function loadProfile() {
    const profileId = getStoredProfileId();

    if (!profileId) {
      router.push("/customer/login");
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select(
        "id,full_name,email,phone,wallet_balance,verification_status,membership_status,membership_expiry,account_status"
      )
      .eq("id", profileId)
      .maybeSingle();

    if (error || !data) {
      localStorage.removeItem("farmconnect_user");
      localStorage.removeItem("farmconnect_profile_id");
      localStorage.removeItem("profile_id");
      localStorage.removeItem("customer_id");
      router.push("/customer/login");
      return;
    }

    localStorage.setItem("farmconnect_user", JSON.stringify(data));
    localStorage.setItem("farmconnect_profile_id", data.id);
    localStorage.setItem("profile_id", data.id);
    localStorage.setItem("customer_id", data.id);

    setProfile(data as Profile);
    setUserName(data.full_name || "Farmer");
    setLoading(false);
  }

  const membershipActive =
    (profile?.membership_status || "").toUpperCase() === "ACTIVE";

  const kycApproved =
    (profile?.verification_status || "").toUpperCase() === "APPROVED";

  const accountActive =
    (profile?.account_status || "").toUpperCase() === "ACTIVE";

  const fullAccess = membershipActive && kycApproved && accountActive;

  const accessMessage = useMemo(() => {
    if (!membershipActive) {
      return "Activate your Annual Investor Membership to unlock Wallet, Marketplace, My Flock, Caretaker Hiring, and Sell Chicken.";
    }

    if (!kycApproved) {
      return "Your membership is active, but your KYC is still pending Admin approval.";
    }

    if (!accountActive) {
      return "Your account is not fully active yet. Please wait for FarmConnect Admin review.";
    }

    return "Full FarmConnect access is active.";
  }, [membershipActive, kycApproved, accountActive]);

  function logout() {
    localStorage.removeItem("farmconnect_user");
    localStorage.removeItem("farmconnect_profile_id");
    localStorage.removeItem("profile_id");
    localStorage.removeItem("customer_id");
    window.location.href = "/customer/login";
  }

  function statusColor(status: string | null | undefined) {
    const cleanStatus = (status || "PENDING").toUpperCase();

    if (["ACTIVE", "APPROVED", "VERIFIED"].includes(cleanStatus)) {
      return "bg-green-100 text-green-800";
    }

    if (["REJECTED", "SUSPENDED", "EXPIRED"].includes(cleanStatus)) {
      return "bg-red-100 text-red-800";
    }

    return "bg-yellow-100 text-yellow-800";
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-sky-300 via-lime-100 to-green-300 p-6">
        <div className="mx-auto max-w-7xl rounded-[30px] border-4 border-white bg-white/90 p-8 text-center text-xl font-black text-green-900 shadow-xl">
          Loading FarmConnect dashboard...
        </div>
      </main>
    );
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
          <div className="absolute bottom-3 right-10 text-8xl">🐓</div>
          <div className="absolute bottom-12 right-36 text-5xl">🐣</div>
          <div className="absolute bottom-4 left-10 text-7xl">🌾</div>
          <div className="absolute right-8 top-5 text-5xl">🚜</div>

          <div className="relative max-w-3xl">
            <p className="mb-4 w-fit rounded-full bg-white px-4 py-2 text-sm font-black text-green-800">
              🌞 Premium Poultry Operations
            </p>

            <h1 className="text-4xl font-black leading-tight text-white drop-shadow md:text-6xl">
              Welcome, {userName}! 🐣
            </h1>

            <p className="mt-4 text-lg font-black text-green-950">
              Monitor chicks as they grow into chickens and mature tandang,
              manage supplies, view caretaker updates, and sell market-ready
              chickens one by one.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              {fullAccess ? (
                <>
                  <Link
                    href="/customer/chicks"
                    className="rounded-full bg-white px-5 py-3 font-black text-green-800 shadow hover:bg-yellow-200"
                  >
                    🐣 Open My Flock
                  </Link>

                  <Link
                    href="/customer/sell-chicken"
                    className="rounded-full bg-yellow-300 px-5 py-3 font-black text-green-950 shadow hover:bg-yellow-400"
                  >
                    🐓 Sell Chicken
                  </Link>
                </>
              ) : (
                <Link
                  href="/customer/membership"
                  className="rounded-full bg-yellow-300 px-5 py-3 font-black text-green-950 shadow hover:bg-yellow-400"
                >
                  💳 Activate Membership
                </Link>
              )}
            </div>
          </div>
        </section>

        {!fullAccess && (
          <section className="mb-6 rounded-[30px] border-4 border-yellow-300 bg-yellow-100 p-6 shadow-xl">
            <div className="grid gap-4 md:grid-cols-[1fr_260px] md:items-center">
              <div>
                <h2 className="text-2xl font-black text-yellow-900">
                  🔒 Membership Access Required
                </h2>
                <p className="mt-2 font-bold text-yellow-800">
                  {accessMessage}
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <span
                    className={`rounded-full px-4 py-2 text-sm font-black ${statusColor(
                      profile?.membership_status
                    )}`}
                  >
                    Membership: {profile?.membership_status || "UNPAID"}
                  </span>

                  <span
                    className={`rounded-full px-4 py-2 text-sm font-black ${statusColor(
                      profile?.verification_status
                    )}`}
                  >
                    KYC: {profile?.verification_status || "PENDING"}
                  </span>

                  <span
                    className={`rounded-full px-4 py-2 text-sm font-black ${statusColor(
                      profile?.account_status
                    )}`}
                  >
                    Account: {profile?.account_status || "PENDING_MEMBERSHIP"}
                  </span>
                </div>
              </div>

              <Link
                href="/customer/membership"
                className="rounded-2xl bg-green-700 px-5 py-4 text-center font-black text-white shadow hover:bg-green-800"
              >
                Pay ₱999 Membership
              </Link>
            </div>
          </section>
        )}

        <section className="mb-6 grid gap-4 md:grid-cols-4">
          <div className="rounded-[28px] border-4 border-white bg-white/90 p-5 shadow-xl backdrop-blur">
            <p className="font-black text-green-700">💳 Membership</p>
            <h2 className="mt-2 text-2xl font-black text-green-950">
              {profile?.membership_status || "UNPAID"}
            </h2>
            <p className="text-sm font-bold text-gray-500">
              {profile?.membership_expiry
                ? `Until ${profile.membership_expiry}`
                : "Annual access required"}
            </p>
          </div>

          <div className="rounded-[28px] border-4 border-white bg-white/90 p-5 shadow-xl backdrop-blur">
            <p className="font-black text-green-700">🪪 KYC</p>
            <h2 className="mt-2 text-2xl font-black text-green-950">
              {profile?.verification_status || "PENDING"}
            </h2>
            <p className="text-sm font-bold text-gray-500">
              Admin identity review
            </p>
          </div>

          <div className="rounded-[28px] border-4 border-white bg-white/90 p-5 shadow-xl backdrop-blur">
            <p className="font-black text-green-700">💰 Wallet</p>
            <h2 className="mt-2 text-2xl font-black text-green-950">
              ₱{Number(profile?.wallet_balance || 0).toLocaleString()}
            </h2>
            <p className="text-sm font-bold text-gray-500">
              FarmConnect wallet balance
            </p>
          </div>

          <div className="rounded-[28px] border-4 border-white bg-white/90 p-5 shadow-xl backdrop-blur">
            <p className="font-black text-green-700">🔐 Access</p>
            <h2 className="mt-2 text-2xl font-black text-green-950">
              {fullAccess ? "ACTIVE" : "LOCKED"}
            </h2>
            <p className="text-sm font-bold text-gray-500">
              {fullAccess ? "Full modules unlocked" : "Membership required"}
            </p>
          </div>
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
          {cards.map((card) => {
            const locked = card.locked && !fullAccess;
            const href = locked ? "/customer/membership" : card.href;

            return (
              <Link
                key={card.title}
                href={href}
                className={`group relative rounded-[30px] border-4 border-white bg-white/90 p-6 shadow-xl backdrop-blur transition hover:-translate-y-2 hover:shadow-2xl ${
                  locked ? "opacity-80" : ""
                }`}
              >
                {locked && (
                  <div className="absolute right-4 top-4 rounded-full bg-yellow-300 px-3 py-1 text-xs font-black text-green-950 shadow">
                    🔒 Locked
                  </div>
                )}

                <div className="mb-5 flex items-start justify-between">
                  <div className="grid h-16 w-16 place-items-center rounded-3xl bg-gradient-to-br from-lime-100 to-green-200 text-4xl shadow-inner">
                    {card.icon}
                  </div>

                  {!locked && (
                    <span className="rounded-full bg-yellow-200 px-3 py-1 text-xs font-black text-green-950">
                      {card.badge}
                    </span>
                  )}
                </div>

                <h3 className="text-2xl font-black text-green-950 group-hover:text-green-700">
                  {card.title}
                </h3>

                <p className="mt-2 min-h-[48px] font-semibold text-gray-600">
                  {locked
                    ? "Activate your Annual Investor Membership first to unlock this module."
                    : card.desc}
                </p>

                <div className="mt-5 flex items-center justify-between border-t border-green-100 pt-4">
                  <span className="font-black text-green-700">
                    {locked ? "Go to Membership" : "Open Module"}
                  </span>
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-green-700 text-white shadow group-hover:bg-yellow-300 group-hover:text-green-950">
                    →
                  </span>
                </div>
              </Link>
            );
          })}
        </section>
      </div>
    </main>
  );
}