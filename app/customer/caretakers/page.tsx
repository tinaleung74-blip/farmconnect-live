"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Caretaker = {
  id: string;
  full_name: string;
  status: string | null;
  daily_rate: number | null;
  level: string | null;
};

type HireRecord = {
  id: string;
  caretaker_id: string;
  caretaker_name: string;
  duration_days: number;
  rate_per_chick: number;
  total_chicks: number;
  total_fee: number;
  status: string;
  payment_status: string;
  start_date: string;
  end_date: string | null;
};

export default function CustomerCaretakersPage() {
  const [profileId, setProfileId] = useState<string>("");
  const [caretakers, setCaretakers] = useState<Caretaker[]>([]);
  const [hires, setHires] = useState<HireRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string>("");
  const [message, setMessage] = useState("");

  const [durationDays, setDurationDays] = useState(30);
  const [totalChicks, setTotalChicks] = useState(100);
  const ratePerChick = 10;

  useEffect(() => {
    loadPage();
  }, []);

  async function loadPage() {
    setLoading(true);
    setMessage("");

    const storedProfileId =
      localStorage.getItem("farmconnect_profile_id") ||
      localStorage.getItem("profile_id") ||
      localStorage.getItem("customer_id") ||
      "";

    setProfileId(storedProfileId);

    const { data: caretakerData, error: caretakerError } = await supabase
      .from("caretakers")
      .select("id,full_name,status,daily_rate,level")
      .order("full_name", { ascending: true });

    if (caretakerError) {
      setMessage("Unable to load caretakers.");
      console.error(caretakerError);
    } else {
      setCaretakers(caretakerData || []);
    }

    if (storedProfileId) {
      const { data: hireData, error: hireError } = await supabase
        .from("customer_caretaker_hires")
        .select("*")
        .eq("profile_id", storedProfileId)
        .order("created_at", { ascending: false });

      if (hireError) {
        setMessage("Unable to load your hired caretakers.");
        console.error(hireError);
      } else {
        setHires(hireData || []);
      }
    }

    setLoading(false);
  }

  const hiredCaretakerIds = useMemo(() => {
    return new Set(hires.map((hire) => hire.caretaker_id));
  }, [hires]);

  function getLevelBadge(level: string | null) {
    if (level === "EXPERT") return "⭐ EXPERT";
    if (level === "ADVANCED") return "🔥 ADVANCED";
    if (level === "MASTER") return "🏆 MASTER";
    return "🐔 STANDARD";
  }

  function getDaysRemaining(endDate: string | null) {
    if (!endDate) return durationDays;

    const today = new Date();
    const end = new Date(endDate);
    const diff = end.getTime() - today.getTime();

    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }

  async function hireCaretaker(caretaker: Caretaker) {
    if (!profileId) {
      setMessage("Please login again. Missing customer profile.");
      return;
    }

    setSavingId(caretaker.id);
    setMessage("");

    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(startDate.getDate() + durationDays);

    const totalFee = totalChicks * ratePerChick;

    const { error } = await supabase.from("customer_caretaker_hires").insert({
      profile_id: profileId,
      caretaker_id: caretaker.id,
      caretaker_name: caretaker.full_name,
      duration_days: durationDays,
      rate_per_chick: ratePerChick,
      total_chicks: totalChicks,
      total_fee: totalFee,
      status: "ACTIVE",
      payment_status: "PENDING",
      start_date: startDate.toISOString().slice(0, 10),
      end_date: endDate.toISOString().slice(0, 10),
    });

    if (error) {
      console.error(error);
      setMessage("Hiring failed. Please try again.");
      setSavingId("");
      return;
    }

    setMessage(`${caretaker.full_name} hired successfully. Payment pending.`);
    setSavingId("");
    await loadPage();
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-yellow-50 via-green-50 to-orange-100 p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-black text-green-900">
              🧑‍🌾 Hire FarmConnect Caretaker
            </h1>
            <p className="mt-1 text-sm text-green-700">
              Customer hires through FarmConnect only. No direct customer to caretaker communication.
            </p>
          </div>

          <Link
            href="/customer/dashboard"
            className="rounded-xl bg-green-700 px-5 py-3 text-center font-bold text-white shadow hover:bg-green-800"
          >
            Back to Dashboard
          </Link>
        </div>

        {message && (
          <div className="mb-5 rounded-2xl border border-green-200 bg-white p-4 font-semibold text-green-800 shadow">
            {message}
          </div>
        )}

        <section className="mb-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl bg-white p-5 shadow">
            <p className="text-sm font-bold text-gray-500">Duration</p>
            <select
              value={durationDays}
              onChange={(e) => setDurationDays(Number(e.target.value))}
              className="mt-2 w-full rounded-xl border p-3 font-bold"
            >
              <option value={15}>15 Days</option>
              <option value={30}>30 Days</option>
              <option value={45}>45 Days Full Cycle</option>
            </select>
          </div>

          <div className="rounded-3xl bg-white p-5 shadow">
            <p className="text-sm font-bold text-gray-500">Total Chicks</p>
            <input
              type="number"
              value={totalChicks}
              onChange={(e) => setTotalChicks(Number(e.target.value))}
              className="mt-2 w-full rounded-xl border p-3 font-bold"
              min={1}
            />
          </div>

          <div className="rounded-3xl bg-white p-5 shadow">
            <p className="text-sm font-bold text-gray-500">Service Fee</p>
            <h2 className="mt-2 text-2xl font-black text-green-900">
              ₱{(totalChicks * ratePerChick).toLocaleString()}
            </h2>
            <p className="text-xs text-gray-500">
              ₱{ratePerChick} per chick / service cycle
            </p>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="mb-4 text-xl font-black text-green-900">
            Available FarmConnect Caretakers
          </h2>

          {loading ? (
            <div className="rounded-3xl bg-white p-8 text-center font-bold shadow">
              Loading caretakers...
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
              {caretakers.map((caretaker) => {
                const alreadyHired = hiredCaretakerIds.has(caretaker.id);

                return (
                  <div
                    key={caretaker.id}
                    className="rounded-3xl border border-green-100 bg-white p-5 shadow"
                  >
                    <div className="mb-3 text-4xl">🧑‍🌾</div>

                    <h3 className="text-lg font-black text-green-900">
                      {caretaker.full_name}
                    </h3>

                    <p className="mt-1 text-sm font-bold text-orange-600">
                      {getLevelBadge(caretaker.level)}
                    </p>

                    <div className="mt-4 rounded-2xl bg-green-50 p-3">
                      <p className="text-xs font-bold text-gray-500">Status</p>
                      <p className="font-black text-green-800">
                        {caretaker.status || "AVAILABLE"}
                      </p>
                    </div>

                    <div className="mt-3 rounded-2xl bg-yellow-50 p-3">
                      <p className="text-xs font-bold text-gray-500">Daily Rate</p>
                      <p className="font-black text-yellow-800">
                        ₱{Number(caretaker.daily_rate || 0).toLocaleString()} / day
                      </p>
                    </div>

                    <button
                      onClick={() => hireCaretaker(caretaker)}
                      disabled={alreadyHired || savingId === caretaker.id}
                      className={`mt-5 w-full rounded-xl px-4 py-3 font-black shadow ${
                        alreadyHired
                          ? "bg-gray-300 text-gray-600"
                          : "bg-green-700 text-white hover:bg-green-800"
                      }`}
                    >
                      {alreadyHired
                        ? "Already Hired"
                        : savingId === caretaker.id
                        ? "Hiring..."
                        : "Hire Caretaker"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-4 text-xl font-black text-green-900">
            My Hired Caretakers
          </h2>

          {hires.length === 0 ? (
            <div className="rounded-3xl bg-white p-6 text-center font-bold text-gray-600 shadow">
              No hired caretaker yet.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {hires.map((hire) => (
                <div
                  key={hire.id}
                  className="rounded-3xl border border-green-100 bg-white p-5 shadow"
                >
                  <h3 className="text-xl font-black text-green-900">
                    {hire.caretaker_name}
                  </h3>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-green-50 p-3">
                      <p className="text-xs font-bold text-gray-500">Duration</p>
                      <p className="font-black text-green-800">
                        {hire.duration_days} days
                      </p>
                    </div>

                    <div className="rounded-2xl bg-orange-50 p-3">
                      <p className="text-xs font-bold text-gray-500">Days Left</p>
                      <p className="font-black text-orange-700">
                        {getDaysRemaining(hire.end_date)} days
                      </p>
                    </div>

                    <div className="rounded-2xl bg-yellow-50 p-3">
                      <p className="text-xs font-bold text-gray-500">Payment</p>
                      <p className="font-black text-yellow-800">
                        {hire.payment_status}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-blue-50 p-3">
                      <p className="text-xs font-bold text-gray-500">Total Fee</p>
                      <p className="font-black text-blue-800">
                        ₱{Number(hire.total_fee || 0).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <p className="mt-4 text-xs font-semibold text-gray-500">
                    This caretaker can be assigned from My Flock after hiring record is active.
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}