"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Caretaker = {
  id: string;
  full_name: string;
  status: string | null;
  daily_rate: number | null;
  level: string | null;
};

type HireRequest = {
  id: string;
  profile_id: string;
  caretaker_id: string;
  caretaker_name: string;
  flock_id: string | null;
  duration_days: number;
  rate_per_chick: number;
  total_chicks: number;
  total_fee: number;
  status: string;
  payment_status: string;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
};

const TOTAL_CHICKS = 100;
const DURATION_DAYS = 30;
const RATE_PER_CHICK = 10;
const REQUEST_AMOUNT = TOTAL_CHICKS * RATE_PER_CHICK;

export default function CustomerCaretakersPage() {
  const [caretakers, setCaretakers] = useState<Caretaker[]>([]);
  const [requests, setRequests] = useState<HireRequest[]>([]);
  const [profileId, setProfileId] = useState("");
  const [profileName, setProfileName] = useState("");
  const [loading, setLoading] = useState(true);
  const [requestLoading, setRequestLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const sortedCaretakers = useMemo(() => {
    return [...caretakers].sort((a, b) => {
      const aStatus = (a.status || "").toUpperCase();
      const bStatus = (b.status || "").toUpperCase();

      if (aStatus === "AVAILABLE" && bStatus !== "AVAILABLE") return -1;
      if (aStatus !== "AVAILABLE" && bStatus === "AVAILABLE") return 1;

      return (a.full_name || "").localeCompare(b.full_name || "");
    });
  }, [caretakers]);

  useEffect(() => {
    initializePage();
  }, []);

  async function initializePage() {
    setLoading(true);
    setMessage("");
    setErrorMessage("");

    const detectedProfile = getCurrentProfile();

    if (!detectedProfile.id) {
      setProfileId("");
      setProfileName("");
      setErrorMessage(
        "Missing customer profile ID. Please login again before submitting a caretaker hire request."
      );
      await loadCaretakers();
      setLoading(false);
      return;
    }

    setProfileId(detectedProfile.id);
    setProfileName(detectedProfile.name);

    await loadCaretakers();
    await loadRequests(detectedProfile.id);

    setLoading(false);
  }

  function getCurrentProfile() {
    if (typeof window === "undefined") {
      return { id: "", name: "" };
    }

    const directProfileId =
      localStorage.getItem("farmconnect_profile_id") ||
      localStorage.getItem("profile_id") ||
      localStorage.getItem("customer_id") ||
      "";

    let detectedId = directProfileId;
    let detectedName = "";

    const rawUser = localStorage.getItem("farmconnect_user");

    if (rawUser) {
      try {
        const parsedUser = JSON.parse(rawUser);

        detectedId =
          detectedId ||
          parsedUser?.profile_id ||
          parsedUser?.customer_id ||
          parsedUser?.id ||
          "";

        detectedName =
          parsedUser?.full_name ||
          parsedUser?.name ||
          parsedUser?.email ||
          "";
      } catch {
        detectedName = rawUser;
      }
    }

    if (detectedId) {
      localStorage.setItem("farmconnect_profile_id", detectedId);
      localStorage.setItem("profile_id", detectedId);
      localStorage.setItem("customer_id", detectedId);
    }

    return {
      id: detectedId,
      name: detectedName,
    };
  }

  async function loadCaretakers() {
    const { data, error } = await supabase
      .from("caretakers")
      .select("id,full_name,status,daily_rate,level")
      .order("full_name", { ascending: true });

    if (error) {
      setErrorMessage(`Caretaker load error: ${error.message}`);
      setCaretakers([]);
      return;
    }

    setCaretakers((data || []) as Caretaker[]);
  }

  async function loadRequests(currentProfileId: string) {
    if (!currentProfileId) {
      setRequests([]);
      return;
    }

    const { data, error } = await supabase
      .from("customer_caretaker_hires")
      .select(
        "id,profile_id,caretaker_id,caretaker_name,flock_id,duration_days,rate_per_chick,total_chicks,total_fee,status,payment_status,start_date,end_date,created_at"
      )
      .eq("profile_id", currentProfileId)
      .order("created_at", { ascending: false });

    if (error) {
      setErrorMessage(`Request load error: ${error.message}`);
      setRequests([]);
      return;
    }

    setRequests((data || []) as HireRequest[]);
  }

  async function submitHireRequest(caretaker: Caretaker) {
    setMessage("");
    setErrorMessage("");

    const detectedProfile = getCurrentProfile();

    if (!detectedProfile.id) {
      setErrorMessage(
        "Missing customer profile ID. Please logout, login again, then submit the hire request."
      );
      return;
    }

    setProfileId(detectedProfile.id);
    setProfileName(detectedProfile.name);
    setRequestLoading(true);

    const alreadyPendingOrActive = requests.find((request) => {
      return (
        request.caretaker_id === caretaker.id &&
        ["PENDING", "ACTIVE"].includes((request.status || "").toUpperCase()) &&
        ["PENDING", "PAID"].includes(
          (request.payment_status || "").toUpperCase()
        )
      );
    });

    if (alreadyPendingOrActive) {
      setRequestLoading(false);
      setErrorMessage(
        "You already submitted a request for this caretaker. Please wait for FarmConnect Admin review."
      );
      return;
    }

    const today = new Date();
    const endDate = new Date();
    endDate.setDate(today.getDate() + DURATION_DAYS);

    const requestPayload = {
      profile_id: detectedProfile.id,
      caretaker_id: caretaker.id,
      caretaker_name: caretaker.full_name,
      flock_id: null,
      duration_days: DURATION_DAYS,
      rate_per_chick: RATE_PER_CHICK,
      total_chicks: TOTAL_CHICKS,
      total_fee: REQUEST_AMOUNT,
      status: "PENDING",
      payment_status: "PENDING",
      start_date: today.toISOString().slice(0, 10),
      end_date: endDate.toISOString().slice(0, 10),
    };

    const { error } = await supabase
      .from("customer_caretaker_hires")
      .insert(requestPayload);

    if (error) {
      setRequestLoading(false);
      setErrorMessage(`Submit request error: ${error.message}`);
      return;
    }

    setMessage(
      "Caretaker hire request submitted. Waiting for FarmConnect Admin approval and payment verification."
    );

    await loadRequests(detectedProfile.id);
    await loadCaretakers();

    setRequestLoading(false);
  }

  function formatPeso(amount: number | null | undefined) {
    const safeAmount = Number(amount || 0);

    return safeAmount.toLocaleString("en-PH", {
      style: "currency",
      currency: "PHP",
      maximumFractionDigits: 0,
    });
  }

  function levelBadge(level: string | null) {
    const cleanLevel = (level || "STANDARD").toUpperCase();

    if (cleanLevel === "EXPERT") return "⭐ EXPERT";
    if (cleanLevel === "ADVANCED") return "🔥 ADVANCED";

    return "🐔 STANDARD";
  }

  function statusBadge(status: string | null) {
    return (status || "AVAILABLE").toUpperCase();
  }

  function daysLeft(endDate: string | null) {
    if (!endDate) return DURATION_DAYS;

    const today = new Date();
    const end = new Date(endDate);
    const diff = end.getTime() - today.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

    return Math.max(days, 0);
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-yellow-50 p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.25em] text-green-700">
              FarmConnect Premium Care
            </p>
            <h1 className="mt-2 text-4xl font-black text-green-950">
              Hire Caretaker
            </h1>
            <p className="mt-2 max-w-3xl text-lg font-semibold text-slate-600">
              Submit a caretaker hire request for FarmConnect Admin review.
              Caretakers become assignable only after approval and payment
              verification.
            </p>
          </div>

          <Link
            href="/customer/dashboard"
            className="rounded-2xl bg-white px-6 py-3 text-center text-sm font-black text-green-800 shadow-md ring-1 ring-green-100 transition hover:bg-green-50"
          >
            ← Back to Dashboard
          </Link>
        </div>

        <div className="mb-6 rounded-[2rem] bg-white p-5 shadow-md ring-1 ring-green-100">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-3xl bg-green-50 p-5">
              <p className="text-sm font-black text-slate-500">Profile ID</p>
              <p className="mt-1 break-all text-lg font-black text-green-950">
                {profileId || "Not detected"}
              </p>
            </div>

            <div className="rounded-3xl bg-yellow-50 p-5">
              <p className="text-sm font-black text-slate-500">Customer</p>
              <p className="mt-1 text-lg font-black text-green-950">
                {profileName || "FarmConnect Customer"}
              </p>
            </div>

            <div className="rounded-3xl bg-emerald-50 p-5">
              <p className="text-sm font-black text-slate-500">Request Model</p>
              <p className="mt-1 text-lg font-black text-green-950">
                Pending Approval
              </p>
            </div>

            <div className="rounded-3xl bg-orange-50 p-5">
              <p className="text-sm font-black text-slate-500">Assignment</p>
              <p className="mt-1 text-lg font-black text-green-950">
                Active + Paid Only
              </p>
            </div>
          </div>
        </div>

        {message && (
          <div className="mb-6 rounded-3xl bg-green-100 p-5 text-center text-lg font-black text-green-900 ring-1 ring-green-200">
            {message}
          </div>
        )}

        {errorMessage && (
          <div className="mb-6 rounded-3xl bg-red-100 p-5 text-center text-lg font-black text-red-800 ring-1 ring-red-200">
            {errorMessage}
          </div>
        )}

        {loading ? (
          <div className="rounded-[2rem] bg-white p-10 text-center text-xl font-black text-slate-600 shadow-md">
            Loading caretaker hiring center...
          </div>
        ) : (
          <>
            <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
              {sortedCaretakers.map((caretaker) => {
                const currentStatus = statusBadge(caretaker.status);
                const isAvailable = currentStatus === "AVAILABLE";

                return (
                  <div
                    key={caretaker.id}
                    className="rounded-[2rem] bg-white p-6 shadow-md ring-1 ring-green-100"
                  >
                    <div className="mb-6 flex items-start justify-between">
                      <div className="text-5xl">👨‍🌾</div>
                      <div
                        className={`rounded-full px-5 py-2 text-sm font-black ${
                          isAvailable
                            ? "bg-green-100 text-green-800"
                            : "bg-yellow-100 text-yellow-800"
                        }`}
                      >
                        {currentStatus}
                      </div>
                    </div>

                    <h2 className="text-2xl font-black text-green-950">
                      {caretaker.full_name}
                    </h2>

                    <div className="mt-4 inline-flex rounded-full bg-yellow-100 px-4 py-2 text-sm font-black text-yellow-900">
                      {levelBadge(caretaker.level)}
                    </div>

                    <div className="mt-6 rounded-3xl bg-yellow-50 p-5">
                      <p className="text-sm font-black text-slate-500">
                        Daily Rate
                      </p>
                      <p className="mt-1 text-2xl font-black text-yellow-900">
                        {formatPeso(caretaker.daily_rate)} / day
                      </p>
                    </div>

                    <div className="mt-4 rounded-3xl bg-green-50 p-5">
                      <p className="text-sm font-black text-slate-500">
                        Request Amount
                      </p>
                      <p className="mt-1 text-2xl font-black text-green-900">
                        {formatPeso(REQUEST_AMOUNT)}
                      </p>
                      <p className="mt-1 text-sm font-bold text-slate-600">
                        {TOTAL_CHICKS} chicks • {DURATION_DAYS} days
                      </p>
                    </div>

                    <button
                      onClick={() => submitHireRequest(caretaker)}
                      disabled={requestLoading}
                      className="mt-6 w-full rounded-2xl bg-green-700 px-5 py-4 text-lg font-black text-white shadow-md transition hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {requestLoading
                        ? "Submitting..."
                        : "Submit Hire Request"}
                    </button>
                  </div>
                );
              })}
            </section>

            <section className="mt-10">
              <h2 className="mb-5 text-3xl font-black text-green-950">
                My Caretaker Requests
              </h2>

              {requests.length === 0 ? (
                <div className="rounded-[2rem] bg-white p-8 text-center text-lg font-black text-slate-600 shadow-md ring-1 ring-green-100">
                  No caretaker request yet. Submit one above for FarmConnect
                  Admin review.
                </div>
              ) : (
                <div className="grid gap-5">
                  {requests.map((request) => {
                    const activeAndPaid =
                      request.status === "ACTIVE" &&
                      request.payment_status === "PAID";

                    return (
                      <div
                        key={request.id}
                        className="rounded-[2rem] bg-white p-6 shadow-md ring-1 ring-green-100"
                      >
                        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                          <div>
                            <p className="text-sm font-black uppercase tracking-[0.2em] text-green-700">
                              Caretaker Request
                            </p>
                            <h3 className="mt-2 text-2xl font-black text-green-950">
                              {request.caretaker_name}
                            </h3>
                            <p className="mt-1 break-all text-sm font-bold text-slate-500">
                              Request ID: {request.id}
                            </p>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <span className="rounded-full bg-yellow-100 px-4 py-2 text-sm font-black text-yellow-900">
                              {request.status}
                            </span>
                            <span className="rounded-full bg-green-100 px-4 py-2 text-sm font-black text-green-900">
                              Payment: {request.payment_status}
                            </span>
                          </div>
                        </div>

                        <div className="mt-6 grid gap-4 md:grid-cols-5">
                          <div className="rounded-3xl bg-slate-50 p-4">
                            <p className="text-xs font-black text-slate-500">
                              Duration
                            </p>
                            <p className="mt-1 text-lg font-black text-slate-800">
                              {request.duration_days} days
                            </p>
                          </div>

                          <div className="rounded-3xl bg-slate-50 p-4">
                            <p className="text-xs font-black text-slate-500">
                              Days Left
                            </p>
                            <p className="mt-1 text-lg font-black text-slate-800">
                              {daysLeft(request.end_date)} days
                            </p>
                          </div>

                          <div className="rounded-3xl bg-slate-50 p-4">
                            <p className="text-xs font-black text-slate-500">
                              Total Chicks
                            </p>
                            <p className="mt-1 text-lg font-black text-slate-800">
                              {request.total_chicks}
                            </p>
                          </div>

                          <div className="rounded-3xl bg-slate-50 p-4">
                            <p className="text-xs font-black text-slate-500">
                              Total Fee
                            </p>
                            <p className="mt-1 text-lg font-black text-slate-800">
                              {formatPeso(request.total_fee)}
                            </p>
                          </div>

                          <div className="rounded-3xl bg-slate-50 p-4">
                            <p className="text-xs font-black text-slate-500">
                              Start Date
                            </p>
                            <p className="mt-1 text-lg font-black text-slate-800">
                              {request.start_date || "Pending"}
                            </p>
                          </div>
                        </div>

                        <div className="mt-6 rounded-3xl bg-green-50 p-5">
                          {activeAndPaid ? (
                            <Link
                              href="/customer/chicks"
                              className="block rounded-2xl bg-green-700 px-5 py-4 text-center text-lg font-black text-white shadow-md transition hover:bg-green-800"
                            >
                              Assign in My Flock
                            </Link>
                          ) : (
                            <p className="text-center text-base font-black text-slate-600">
                              Waiting for FarmConnect Admin approval and payment
                              verification before assignment.
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}