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
  profile_id: string | null;
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
  const [customerName, setCustomerName] = useState<string>("Customer");
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

  function getStoredProfile() {
    let storedProfileId =
      localStorage.getItem("farmconnect_profile_id") ||
      localStorage.getItem("profile_id") ||
      localStorage.getItem("customer_id") ||
      "";

    let storedCustomerName = "Customer";

    const userRaw = localStorage.getItem("farmconnect_user");

    if (userRaw) {
      try {
        const user = JSON.parse(userRaw);

        storedProfileId =
          storedProfileId ||
          user.id ||
          user.profile_id ||
          user.customer_id ||
          "";

        storedCustomerName =
          user.full_name ||
          user.name ||
          user.email ||
          "Customer";

        if (storedProfileId) {
          localStorage.setItem("farmconnect_profile_id", storedProfileId);
        }
      } catch (err) {
        console.error("Unable to parse farmconnect_user:", err);
      }
    }

    return {
      storedProfileId,
      storedCustomerName,
    };
  }

  async function loadPage() {
    setLoading(true);
    setMessage("");

    const { storedProfileId, storedCustomerName } = getStoredProfile();

    setProfileId(storedProfileId);
    setCustomerName(storedCustomerName);

    const { data: caretakerData, error: caretakerError } = await supabase
      .from("caretakers")
      .select("id,full_name,status,daily_rate,level")
      .order("full_name", { ascending: true });

    if (caretakerError) {
      console.error(caretakerError);
      setMessage(`Unable to load caretakers: ${caretakerError.message}`);
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
        console.error(hireError);
        setMessage(`Unable to load your hired caretakers: ${hireError.message}`);
      } else {
        setHires(hireData || []);
      }
    } else {
      setHires([]);
    }

    setLoading(false);
  }

  const hiredCaretakerIds = useMemo(() => {
    return new Set(hires.map((hire) => hire.caretaker_id));
  }, [hires]);

  function getLevelBadge(level: string | null) {
    if (level === "MASTER") return "🏆 MASTER";
    if (level === "EXPERT") return "⭐ EXPERT";
    if (level === "ADVANCED") return "🔥 ADVANCED";
    return "🐔 STANDARD";
  }

  function getLevelColor(level: string | null) {
    if (level === "MASTER") return "bg-purple-100 text-purple-800";
    if (level === "EXPERT") return "bg-yellow-100 text-yellow-800";
    if (level === "ADVANCED") return "bg-orange-100 text-orange-800";
    return "bg-green-100 text-green-800";
  }

  function getStatusColor(status: string | null) {
    if (status === "ASSIGNED") return "bg-blue-100 text-blue-800";
    if (status === "HIRED") return "bg-yellow-100 text-yellow-800";
    if (status === "AVAILABLE") return "bg-green-100 text-green-800";
    return "bg-gray-100 text-gray-800";
  }

  function getDaysRemaining(endDate: string | null) {
    if (!endDate) return durationDays;

    const today = new Date();
    const end = new Date(endDate);
    const diff = end.getTime() - today.getTime();

    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }

  async function hireCaretaker(caretaker: Caretaker) {
    const { storedProfileId, storedCustomerName } = getStoredProfile();

    if (!storedProfileId) {
      setMessage(
        "Please login again. Missing customer profile ID from farmconnect_user."
      );
      return;
    }

    setProfileId(storedProfileId);
    setCustomerName(storedCustomerName);
    setSavingId(caretaker.id);
    setMessage("");

    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(startDate.getDate() + durationDays);

    const totalFee = totalChicks * ratePerChick;

    const duplicateHire = hires.find(
      (hire) =>
        hire.caretaker_id === caretaker.id &&
        hire.status === "ACTIVE"
    );

    if (duplicateHire) {
      setMessage(`${caretaker.full_name} is already hired for your account.`);
      setSavingId("");
      return;
    }

    const { error } = await supabase.from("customer_caretaker_hires").insert({
      profile_id: storedProfileId,
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
      setMessage(`Hiring failed: ${error.message}`);
      setSavingId("");
      return;
    }

    setMessage(`${caretaker.full_name} hired successfully. Payment pending.`);
    setSavingId("");
    await loadPage();
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-yellow-50 via-green-50 to-orange-100 p-4 md:p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="mb-2 w-fit rounded-full bg-green-100 px-4 py-2 text-xs font-black text-green-800">
              FARMCONNECT VERIFIED CARETAKER SERVICE
            </p>

            <h1 className="text-3xl font-black text-green-900 md:text-4xl">
              🧑‍🌾 Hire FarmConnect Caretaker
            </h1>

            <p className="mt-2 max-w-2xl text-sm font-semibold text-green-700">
              Customer hires through FarmConnect only. FarmConnect manages
              operations, payroll, and assignment. No direct customer to
              caretaker communication.
            </p>
          </div>

          <Link
            href="/customer/dashboard"
            className="rounded-2xl bg-green-700 px-5 py-3 text-center font-black text-white shadow hover:bg-green-800"
          >
            ← Back to Dashboard
          </Link>
        </div>

        <section className="mb-6 grid gap-4 md:grid-cols-4">
          <div className="rounded-3xl border border-green-100 bg-white p-5 shadow">
            <p className="text-xs font-black text-gray-500">CUSTOMER</p>
            <h2 className="mt-2 text-xl font-black text-green-900">
              {customerName}
            </h2>
            <p className="mt-1 text-xs font-semibold text-gray-500">
              {profileId ? "Profile connected" : "Profile not found"}
            </p>
          </div>

          <div className="rounded-3xl border border-green-100 bg-white p-5 shadow">
            <p className="text-xs font-black text-gray-500">VERIFIED POOL</p>
            <h2 className="mt-2 text-3xl font-black text-green-900">
              {caretakers.length}
            </h2>
            <p className="mt-1 text-xs font-semibold text-gray-500">
              FarmConnect caretakers
            </p>
          </div>

          <div className="rounded-3xl border border-green-100 bg-white p-5 shadow">
            <p className="text-xs font-black text-gray-500">MY HIRES</p>
            <h2 className="mt-2 text-3xl font-black text-green-900">
              {hires.length}
            </h2>
            <p className="mt-1 text-xs font-semibold text-gray-500">
              Active service records
            </p>
          </div>

          <div className="rounded-3xl border border-green-100 bg-white p-5 shadow">
            <p className="text-xs font-black text-gray-500">SERVICE FEE</p>
            <h2 className="mt-2 text-3xl font-black text-green-900">
              ₱{(totalChicks * ratePerChick).toLocaleString()}
            </h2>
            <p className="mt-1 text-xs font-semibold text-gray-500">
              ₱{ratePerChick} per chick / cycle
            </p>
          </div>
        </section>

        {message && (
          <div className="mb-5 rounded-2xl border border-green-200 bg-white p-4 font-bold text-green-800 shadow">
            {message}
          </div>
        )}

        <section className="mb-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl bg-white p-5 shadow">
            <p className="text-sm font-black text-gray-500">Duration</p>
            <select
              value={durationDays}
              onChange={(e) => setDurationDays(Number(e.target.value))}
              className="mt-2 w-full rounded-xl border p-3 font-bold outline-none focus:border-green-600"
            >
              <option value={15}>15 Days Support</option>
              <option value={30}>30 Days Support</option>
              <option value={45}>45 Days Full Grow Cycle</option>
            </select>
          </div>

          <div className="rounded-3xl bg-white p-5 shadow">
            <p className="text-sm font-black text-gray-500">Total Chicks</p>
            <input
              type="number"
              value={totalChicks}
              onChange={(e) => setTotalChicks(Number(e.target.value || 0))}
              className="mt-2 w-full rounded-xl border p-3 font-bold outline-none focus:border-green-600"
              min={1}
            />
          </div>

          <div className="rounded-3xl bg-white p-5 shadow">
            <p className="text-sm font-black text-gray-500">Payment Status</p>
            <h2 className="mt-2 text-2xl font-black text-yellow-700">
              PENDING
            </h2>
            <p className="text-xs font-semibold text-gray-500">
              Payment goes to FarmConnect Treasury first.
            </p>
          </div>
        </section>

        <section className="mb-8 rounded-[32px] border border-green-100 bg-white/80 p-5 shadow">
          <h2 className="mb-2 text-xl font-black text-green-900">
            How Caretaker Hiring Works
          </h2>

          <div className="grid gap-3 md:grid-cols-4">
            {[
              ["1", "Customer hires through FarmConnect"],
              ["2", "FarmConnect records service contract"],
              ["3", "Payment status starts as pending"],
              ["4", "Caretaker becomes assignable in My Flock"],
            ].map(([step, text]) => (
              <div key={step} className="rounded-2xl bg-green-50 p-4">
                <div className="mb-2 grid h-8 w-8 place-items-center rounded-full bg-green-700 font-black text-white">
                  {step}
                </div>
                <p className="text-sm font-bold text-green-900">{text}</p>
              </div>
            ))}
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
          ) : caretakers.length === 0 ? (
            <div className="rounded-3xl bg-white p-8 text-center font-bold text-gray-500 shadow">
              No caretakers found in database.
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
              {caretakers.map((caretaker) => {
                const alreadyHired = hiredCaretakerIds.has(caretaker.id);

                return (
                  <div
                    key={caretaker.id}
                    className="rounded-3xl border border-green-100 bg-white p-5 shadow transition hover:-translate-y-1 hover:shadow-xl"
                  >
                    <div className="mb-3 flex items-start justify-between">
                      <div className="text-4xl">🧑‍🌾</div>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-black ${getStatusColor(
                          caretaker.status
                        )}`}
                      >
                        {caretaker.status || "AVAILABLE"}
                      </span>
                    </div>

                    <h3 className="text-lg font-black text-green-900">
                      {caretaker.full_name}
                    </h3>

                    <p
                      className={`mt-2 w-fit rounded-full px-3 py-1 text-xs font-black ${getLevelColor(
                        caretaker.level
                      )}`}
                    >
                      {getLevelBadge(caretaker.level)}
                    </p>

                    <div className="mt-4 rounded-2xl bg-yellow-50 p-3">
                      <p className="text-xs font-black text-gray-500">
                        Daily Rate
                      </p>
                      <p className="font-black text-yellow-800">
                        ₱{Number(caretaker.daily_rate || 0).toLocaleString()} /
                        day
                      </p>
                    </div>

                    <div className="mt-3 rounded-2xl bg-green-50 p-3">
                      <p className="text-xs font-black text-gray-500">
                        Service Contract
                      </p>
                      <p className="font-black text-green-800">
                        ₱{(totalChicks * ratePerChick).toLocaleString()}
                      </p>
                      <p className="text-xs font-semibold text-gray-500">
                        {totalChicks} chicks • {durationDays} days
                      </p>
                    </div>

                    <button
                      onClick={() => hireCaretaker(caretaker)}
                      disabled={alreadyHired || savingId === caretaker.id}
                      className={`mt-5 w-full rounded-xl px-4 py-3 font-black shadow ${
                        alreadyHired
                          ? "cursor-not-allowed bg-gray-300 text-gray-600"
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
              No hired caretaker yet. Hire one above to make them available in
              My Flock assignment.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {hires.map((hire) => (
                <div
                  key={hire.id}
                  className="rounded-3xl border border-green-100 bg-white p-5 shadow"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-xl font-black text-green-900">
                        {hire.caretaker_name}
                      </h3>
                      <p className="mt-1 text-xs font-bold text-gray-500">
                        Service Contract ID: {hire.id.slice(0, 8)}
                      </p>
                    </div>

                    <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-black text-green-800">
                      {hire.status}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-green-50 p-3">
                      <p className="text-xs font-black text-gray-500">
                        Duration
                      </p>
                      <p className="font-black text-green-800">
                        {hire.duration_days} days
                      </p>
                    </div>

                    <div className="rounded-2xl bg-orange-50 p-3">
                      <p className="text-xs font-black text-gray-500">
                        Days Left
                      </p>
                      <p className="font-black text-orange-700">
                        {getDaysRemaining(hire.end_date)} days
                      </p>
                    </div>

                    <div className="rounded-2xl bg-yellow-50 p-3">
                      <p className="text-xs font-black text-gray-500">
                        Payment
                      </p>
                      <p className="font-black text-yellow-800">
                        {hire.payment_status}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-blue-50 p-3">
                      <p className="text-xs font-black text-gray-500">
                        Total Fee
                      </p>
                      <p className="font-black text-blue-800">
                        ₱{Number(hire.total_fee || 0).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <Link
                    href="/customer/chicks"
                    className="mt-5 block rounded-xl bg-green-700 px-4 py-3 text-center font-black text-white shadow hover:bg-green-800"
                  >
                    Assign in My Flock →
                  </Link>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}