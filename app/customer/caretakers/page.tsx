"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  farmBgClass,
  goldButtonClass,
  money,
  panelClass,
  resolveCustomerProfile,
  statusPill,
  statusText,
  type CustomerProfile,
} from "@/lib/customer-auth";

type Caretaker = {
  id: string;
  full_name?: string | null;
  status?: string | null;
  daily_rate?: number | string | null;
  level?: string | null;
};

type Hire = {
  id: string;
  caretaker_id: string | null;
  caretaker_name: string | null;
  flock_id: string | null;
  total_fee: number | string | null;
  total_chicks: number | null;
  rate_per_chick: number | string | null;
  duration_days: number | null;
  status: string | null;
  payment_status: string | null;
  created_at: string | null;
};

type Flock = {
  id: string;
  batch_no: string | null;
  breed?: string | null;
  total_chicks: number | null;
  alive_count: number | null;
  status?: string | null;
};

const DEFAULT_RATE_PER_CHICK = 10;
const DEFAULT_DURATION_DAYS = 30;
const PLATFORM_FEE_RATE = 0.02;

function caretakerName(caretaker: Caretaker | null) {
  return caretaker?.full_name || "FarmConnect Caretaker";
}

export default function CustomerCaretakersPage() {
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [caretakers, setCaretakers] = useState<Caretaker[]>([]);
  const [hires, setHires] = useState<Hire[]>([]);
  const [flocks, setFlocks] = useState<Flock[]>([]);
  const [selectedFlock, setSelectedFlock] = useState("");
  const [selectedCaretakerId, setSelectedCaretakerId] = useState("");
  const [message, setMessage] = useState("");
  const [hiring, setHiring] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPage();
  }, []);

  async function loadPage() {
    setLoading(true);
    setMessage("");

    const currentProfile = await resolveCustomerProfile();
    setProfile(currentProfile);

    if (!currentProfile) {
      setCaretakers([]);
      setHires([]);
      setFlocks([]);
      setLoading(false);
      return;
    }

    const [caretakerRes, hireRes, flockRes] = await Promise.all([
      supabase
        .from("caretakers")
        .select("id,full_name,status,daily_rate,level")
        .in("status", ["AVAILABLE", "ACTIVE", "ASSIGNED"])
        .order("full_name", { ascending: true }),

      supabase
        .from("customer_caretaker_hires")
        .select(
          "id,caretaker_id,caretaker_name,flock_id,total_fee,total_chicks,rate_per_chick,duration_days,status,payment_status,created_at",
        )
        .eq("profile_id", currentProfile.id)
        .order("created_at", { ascending: false }),

      supabase
        .from("flocks")
        .select("id,batch_no,breed,total_chicks,alive_count,status")
        .eq("profile_id", currentProfile.id)
        .eq("status", "ACTIVE")
        .order("created_at", { ascending: false }),
    ]);

    if (caretakerRes.error) setMessage(caretakerRes.error.message);
    if (hireRes.error) setMessage(hireRes.error.message);
    if (flockRes.error) setMessage(flockRes.error.message);

    const caretakerRows = (caretakerRes.data || []) as Caretaker[];
    const flockRows = (flockRes.data || []) as Flock[];

    setCaretakers(caretakerRows);
    setHires((hireRes.data || []) as Hire[]);
    setFlocks(flockRows);

    if (!selectedFlock && flockRows[0]) setSelectedFlock(flockRows[0].id);
    if (!selectedCaretakerId && caretakerRows[0]) setSelectedCaretakerId(caretakerRows[0].id);

    setLoading(false);
  }

  const selectedFlockRow = useMemo(
    () => flocks.find((flock) => flock.id === selectedFlock) || flocks[0] || null,
    [flocks, selectedFlock],
  );

  const selectedCaretaker = useMemo(
    () => caretakers.find((caretaker) => caretaker.id === selectedCaretakerId) || caretakers[0] || null,
    [caretakers, selectedCaretakerId],
  );

  const totalChicks = Number(selectedFlockRow?.alive_count || selectedFlockRow?.total_chicks || 0);
  const totalFee = totalChicks * DEFAULT_RATE_PER_CHICK;
  const platformFee = totalFee * PLATFORM_FEE_RATE;
  const caretakerServiceFund = totalFee - platformFee;
  const walletBalance = Number(profile?.wallet_balance || 0);
  const insufficient = walletBalance < totalFee;

  async function hireCaretaker() {
    if (!profile) return setMessage("Login required.");
    if (!selectedCaretaker) return setMessage("Choose an available caretaker first.");
    if (!selectedFlockRow) return setMessage("Choose an active flock first.");
    if (totalChicks <= 0) return setMessage("Selected flock has no active chickens.");
    if (insufficient) return setMessage("Insufficient wallet balance for caretaker hiring.");

    const ok = window.confirm(
      `Pay ${money(totalFee)} to submit caretaker hire request? FarmConnect platform fee is ${money(platformFee)}.`,
    );
    if (!ok) return;

    setHiring(true);
    setMessage("");

    const { error } = await supabase.rpc("hire_caretaker", {
      p_profile_id: profile.id,
      p_caretaker_id: selectedCaretaker.id,
      p_total_chicks: totalChicks,
      p_duration_days: DEFAULT_DURATION_DAYS,
      p_rate_per_chick: DEFAULT_RATE_PER_CHICK,
      p_flock_id: selectedFlockRow.id,
    });

    setHiring(false);
    if (error) return setMessage(error.message);

    setMessage("Caretaker hire paid and submitted. Admin approval is required before active assignment.");
    await loadPage();
  }

  return (
    <main className={`${farmBgClass} min-h-screen p-4 pb-28 md:p-8`}>
      <div className="mx-auto max-w-7xl">
        <section className="rounded-[44px] border border-white/15 bg-white/10 p-6 text-white shadow-2xl backdrop-blur-xl md:p-8">
          <p className="w-fit rounded-full bg-amber-300 px-4 py-2 text-sm font-black text-emerald-950">
            Caretaker Hiring
          </p>

          <div className="mt-5 grid gap-6 xl:grid-cols-[1fr_390px] xl:items-end">
            <div>
              <h1 className="text-4xl font-black leading-tight md:text-6xl">
                Hire farm care for your flock.
              </h1>
              <p className="mt-3 max-w-2xl text-emerald-50">
                Wallet deduction, hire request, FarmConnect 2% platform fee, and caretaker service fund stay synced through RPC.
              </p>
            </div>

            <div className="rounded-[30px] bg-white/10 p-5 ring-1 ring-white/10">
              <p className="text-sm font-black uppercase tracking-[0.16em] text-amber-200">Your Wallet</p>
              <h2 className="mt-2 text-4xl font-black">{money(profile?.wallet_balance)}</h2>
              <p className="mt-1 text-sm font-bold text-emerald-50">
                Hiring stays pending until Admin approval.
              </p>
            </div>
          </div>
        </section>

        {message && (
          <div className="mt-5 rounded-2xl bg-white p-4 font-black text-emerald-800 shadow">
            {message}
          </div>
        )}

        <section className="mt-6 grid gap-6 xl:grid-cols-[1fr_430px]">
          <div>
            <div className="mb-4 flex flex-col gap-3 text-white md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-2xl font-black">Available caretakers</h2>
                <p className="font-bold text-emerald-50">
                  Customer chooses, Admin controls final activation.
                </p>
              </div>
              <button
                onClick={loadPage}
                className="w-fit rounded-full bg-white/15 px-5 py-3 font-black hover:bg-white/25"
              >
                {loading ? "Refreshing..." : "Refresh"}
              </button>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              {caretakers.map((caretaker) => {
                const active = selectedCaretaker?.id === caretaker.id;

                return (
                  <button
                    key={caretaker.id}
                    onClick={() => setSelectedCaretakerId(caretaker.id)}
                    className={`rounded-[36px] bg-white p-6 text-left shadow-2xl transition hover:-translate-y-1 ${
                      active ? "ring-4 ring-amber-300" : "ring-1 ring-white/10"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="grid h-20 w-20 place-items-center rounded-[26px] bg-emerald-100 text-4xl">
                          👨‍🌾
                        </div>
                        <div>
                          <h3 className="text-2xl font-black text-emerald-950">
                            {caretakerName(caretaker)}
                          </h3>
                          <p className="mt-1 font-bold text-slate-500">
                            {caretaker.level || "FarmConnect Care"}
                          </p>
                        </div>
                      </div>

                      <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusPill(caretaker.status)}`}>
                        {statusText(caretaker.status || "AVAILABLE")}
                      </span>
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-3">
                      <div className="rounded-2xl bg-emerald-50 p-4">
                        <p className="text-xs font-black uppercase text-slate-500">Rate</p>
                        <p className="mt-1 text-xl font-black text-emerald-900">
                          {money(caretaker.daily_rate || DEFAULT_RATE_PER_CHICK)} / chick
                        </p>
                      </div>
                      <div className="rounded-2xl bg-amber-50 p-4">
                        <p className="text-xs font-black uppercase text-slate-500">Cycle</p>
                        <p className="mt-1 text-xl font-black text-amber-800">
                          {DEFAULT_DURATION_DAYS} days
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {!loading && caretakers.length === 0 && (
              <div className="rounded-[32px] bg-white p-10 text-center font-black text-slate-500 shadow-2xl">
                No caretakers found yet.
              </div>
            )}
          </div>

          <aside className={`${panelClass} sticky top-24 h-fit p-6`}>
            <h2 className="text-2xl font-black text-emerald-950">Hire Preview</h2>

            <label className="mt-5 block text-sm font-black uppercase tracking-[0.12em] text-slate-500">
              Assign to flock
            </label>

            <select
              value={selectedFlockRow?.id || ""}
              onChange={(event) => setSelectedFlock(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-200 p-4 font-bold outline-none focus:border-emerald-500"
            >
              {flocks.map((flock) => (
                <option key={flock.id} value={flock.id}>
                  {flock.batch_no || "Flock"} • {flock.alive_count || 0} alive
                </option>
              ))}
            </select>

            <div className="mt-5 rounded-[28px] bg-emerald-50 p-5">
              <p className="text-sm font-black uppercase tracking-[0.14em] text-emerald-700">
                Selected Caretaker
              </p>
              <h3 className="mt-2 text-2xl font-black text-emerald-950">
                {selectedCaretaker ? caretakerName(selectedCaretaker) : "Choose caretaker"}
              </h3>
              <p className="mt-1 font-bold text-slate-500">
                Status starts PENDING_ADMIN_APPROVAL after wallet payment.
              </p>
            </div>

            <div className="mt-5 space-y-3 rounded-[28px] bg-slate-50 p-5">
              <FeeRow label="Total hire payment" value={money(totalFee)} strong />
              <FeeRow label="FarmConnect platform fee 2%" value={money(platformFee)} />
              <FeeRow label="Caretaker service fund 98%" value={money(caretakerServiceFund)} />
              <FeeRow label="Remaining wallet after payment" value={money(walletBalance - totalFee)} strong />
            </div>

            {insufficient && (
              <p className="mt-4 rounded-2xl bg-red-50 p-4 font-bold text-red-700">
                Insufficient wallet balance. Cash-in first.
              </p>
            )}

            <button
              onClick={hireCaretaker}
              disabled={hiring || insufficient || !selectedCaretaker || !selectedFlockRow}
              className={`mt-5 w-full ${goldButtonClass}`}
            >
              {hiring ? "Processing..." : "Pay & Submit Hire Request"}
            </button>

            <h3 className="mt-7 text-xl font-black text-emerald-950">My Hire Requests</h3>

            <div className="mt-3 max-h-[360px] space-y-3 overflow-y-auto pr-1">
              {hires.slice(0, 8).map((hire) => (
                <article key={hire.id} className="rounded-2xl border border-slate-100 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="font-black text-slate-900">{hire.caretaker_name || "Caretaker"}</h4>
                      <p className="text-sm font-bold text-slate-500">
                        {money(hire.total_fee)} • Payment {statusText(hire.payment_status)}
                      </p>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusPill(hire.status)}`}>
                      {statusText(hire.status)}
                    </span>
                  </div>
                </article>
              ))}

              {hires.length === 0 && (
                <p className="rounded-2xl bg-slate-50 p-5 font-bold text-slate-500">
                  No hire request yet.
                </p>
              )}
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

function FeeRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-3 last:border-b-0 last:pb-0">
      <span className={strong ? "font-black text-slate-700" : "font-bold text-slate-500"}>
        {label}
      </span>
      <b className={strong ? "text-lg text-emerald-900" : "text-emerald-800"}>
        {value}
      </b>
    </div>
  );
}