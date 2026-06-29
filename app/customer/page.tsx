"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  Animal,
  dateText,
  isChicken,
  money,
  resolveCustomerProfile,
  shellClass,
  statusPill,
  type CustomerProfile,
} from "@/lib/customer-auth";

type Stats = {
  flocks: number;
  alive: number;
  pendingCashin: number;
  pendingCashout: number;
  pendingSell: number;
  activeHires: number;
  lowStock: number;
  latestPhoto?: any;
  latestWeight?: any;
  baseImage?: string | null;
  walletTx?: any[];
};

export default function CustomerDashboardPage() {
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [stats, setStats] = useState<Stats>({
    flocks: 0,
    alive: 0,
    pendingCashin: 0,
    pendingCashout: 0,
    pendingSell: 0,
    activeHires: 0,
    lowStock: 0,
    walletTx: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const p = await resolveCustomerProfile();
    setProfile(p);
    if (!p) {
      setLoading(false);
      return;
    }

    const [flocks, cashin, cashout, sell, hires, inv, animalsRes, tx] = await Promise.all([
      supabase.from("flocks").select("id,alive_count,status").eq("profile_id", p.id),
      supabase.from("cashin_requests").select("id,status").eq("profile_id", p.id).eq("status", "PENDING"),
      supabase.from("cashout_requests").select("id,status").eq("profile_id", p.id).in("status", ["PENDING", "PROCESSING", "APPROVED"]),
      supabase.from("sell_chicken_requests").select("id,status").eq("profile_id", p.id).eq("status", "PENDING_ADMIN_APPROVAL"),
      supabase.from("customer_caretaker_hires").select("id,status").eq("profile_id", p.id).eq("status", "ACTIVE"),
      supabase.from("flock_inventory").select("id,remaining_qty,low_stock_level").eq("profile_id", p.id),
      supabase.from("animals").select("id,code,name,type,breed,image_url,profile_id,flock_id").eq("profile_id", p.id).order("created_at", { ascending: false }),
      supabase.from("wallet_transactions").select("id,transaction_type,amount,remarks,status,created_at").eq("profile_id", p.id).order("created_at", { ascending: false }).limit(5),
    ]);

    const flockRows = flocks.data || [];
    const customerAnimals = ((animalsRes.data || []) as Animal[]).filter(isChicken);
    const animalIds = customerAnimals.map((animal) => animal.id);

    let latestPhoto = null;
    let latestWeight = null;

    if (animalIds.length > 0) {
      const [photoRes, weightRes] = await Promise.all([
        supabase.from("animal_photos").select("id,animal_id,photo_url,caption,created_at").in("animal_id", animalIds).order("created_at", { ascending: false }).limit(1),
        supabase.from("animal_weights").select("id,animal_id,weight_kg,note,recorded_at").in("animal_id", animalIds).order("recorded_at", { ascending: false }).limit(1),
      ]);
      latestPhoto = photoRes.data?.[0] || null;
      latestWeight = weightRes.data?.[0] || null;
    }

    const baseImage = latestPhoto?.photo_url || customerAnimals.find((animal) => animal.image_url)?.image_url || null;

    setStats({
      flocks: flockRows.length,
      alive: flockRows.reduce((sum: number, flock: any) => sum + Number(flock.alive_count || 0), 0),
      pendingCashin: cashin.data?.length || 0,
      pendingCashout: cashout.data?.length || 0,
      pendingSell: sell.data?.length || 0,
      activeHires: hires.data?.length || 0,
      lowStock: (inv.data || []).filter((item: any) => Number(item.remaining_qty || 0) <= Number(item.low_stock_level || 0)).length,
      latestPhoto,
      latestWeight,
      baseImage,
      walletTx: tx.data || [],
    });
    setLoading(false);
  }

  const cards = useMemo(
    () => [
      ["Wallet", money(profile?.wallet_balance), "Available balance"],
      ["Active Flocks", stats.flocks, `${stats.alive} chickens alive`],
      ["Caretakers", stats.activeHires, "Active assignments"],
      ["Low Stock", stats.lowStock, "Needs attention"],
      ["Pending Cash-In", stats.pendingCashin, "Admin review"],
      ["Pending Cash-Out", stats.pendingCashout, "Payout flow"],
      ["Sell Requests", stats.pendingSell, "Waiting approval"],
    ],
    [profile, stats]
  );

  return (
    <main className={`${shellClass} p-4 pb-28 md:p-8`}>
      <div className="mx-auto max-w-7xl">
        <section className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
          <div className="rounded-[36px] border border-emerald-300/20 bg-white/10 p-7 text-white shadow-2xl backdrop-blur-xl">
            <p className="w-fit rounded-full bg-amber-300 px-4 py-2 text-sm font-black text-emerald-950">Customer Command Center</p>
            <h1 className="mt-4 text-4xl font-black md:text-6xl">Welcome, {profile?.full_name || "Farm Owner"}</h1>
            <p className="mt-3 max-w-2xl text-emerald-50">Your real-time FarmConnect workspace for flock, wallet, marketplace, and caretaker updates.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              {[
                ["My Flock", "/customer/chicks"],
                ["Marketplace", "/customer/marketplace"],
                ["Wallet", "/customer/wallet"],
                ["Sell Chicken", "/customer/sell-chicken"],
                ["Hire Caretaker", "/customer/caretakers"],
                ["Live Camera", "/customer/live-camera"],
                ["Notifications", "/customer/notifications"],
              ].map(([label, href]) => (
                <Link key={href} href={href} className="rounded-full bg-white px-4 py-3 text-sm font-black text-emerald-950 shadow">
                  {label}
                </Link>
              ))}
            </div>
          </div>

          <div className="rounded-[36px] bg-white p-5 shadow-2xl">
            <h2 className="text-2xl font-black text-emerald-950">Latest farm reference</h2>
            {stats.baseImage ? (
              <img src={stats.baseImage} alt="Latest farm" className="mt-4 h-56 w-full rounded-3xl object-cover" />
            ) : (
              <div className="mt-4 grid h-56 place-items-center rounded-3xl bg-emerald-50 font-black text-emerald-700">No latest photo yet</div>
            )}
            <p className="mt-3 text-sm font-bold text-slate-500">
              {stats.latestPhoto?.caption || (stats.baseImage ? "Marketplace base photo is active until the next uploaded farm photo." : "Caretaker photo updates will appear here.")}
            </p>
          </div>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {cards.map(([title, value, note]: any) => (
            <div key={title} className="rounded-[28px] bg-white p-5 shadow-xl">
              <p className="font-bold text-slate-500">{title}</p>
              <h3 className="mt-2 text-3xl font-black text-emerald-900">{loading ? "..." : value}</h3>
              <p className="mt-1 text-sm text-slate-500">{note}</p>
            </div>
          ))}
        </section>

        <section className="mt-6 grid gap-5 lg:grid-cols-2">
          <div className="rounded-[32px] bg-white p-6 shadow-xl">
            <h2 className="text-2xl font-black text-emerald-950">Latest Weight</h2>
            <p className="mt-3 text-4xl font-black text-emerald-700">{stats.latestWeight ? `${Number(stats.latestWeight.weight_kg || 0)} kg` : "No record"}</p>
            <p className="mt-1 text-sm font-bold text-slate-500">{stats.latestWeight?.note || "Weight updates will sync from caretaker task evidence."}</p>
          </div>

          <div className="rounded-[32px] bg-white p-6 shadow-xl">
            <h2 className="text-2xl font-black text-emerald-950">Recent Activity</h2>
            <div className="mt-4 space-y-3">
              {(stats.walletTx || []).map((tx: any) => (
                <div key={tx.id} className="rounded-2xl border p-4">
                  <div className="flex justify-between gap-3">
                    <p className="font-black">{tx.remarks || tx.transaction_type}</p>
                    <p className="font-black text-emerald-700">{money(tx.amount)}</p>
                  </div>
                  <span className={`mt-2 inline-block rounded-full border px-3 py-1 text-xs font-black ${statusPill(tx.status)}`}>{tx.status}</span>
                </div>
              ))}
              {(stats.walletTx || []).length === 0 && <p className="text-slate-500">No activity yet.</p>}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
