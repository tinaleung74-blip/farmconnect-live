"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

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

export default function AdminCaretakerHiresPage() {
  const [requests, setRequests] = useState<HireRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    loadRequests();
  }, []);

  async function loadRequests() {
    setLoading(true);
    setMessage("");
    setErrorMessage("");

    const { data, error } = await supabase
      .from("customer_caretaker_hires")
      .select(
        "id,profile_id,caretaker_id,caretaker_name,flock_id,duration_days,rate_per_chick,total_chicks,total_fee,status,payment_status,start_date,end_date,created_at"
      )
      .order("created_at", { ascending: false });

    if (error) {
      setErrorMessage(`Load request error: ${error.message}`);
      setRequests([]);
      setLoading(false);
      return;
    }

    setRequests((data || []) as HireRequest[]);
    setLoading(false);
  }

  const filteredRequests = useMemo(() => {
    const cleanSearch = search.trim().toLowerCase();

    if (!cleanSearch) return requests;

    return requests.filter((request) => {
      return (
        request.id.toLowerCase().includes(cleanSearch) ||
        request.profile_id.toLowerCase().includes(cleanSearch) ||
        request.caretaker_id.toLowerCase().includes(cleanSearch) ||
        request.caretaker_name.toLowerCase().includes(cleanSearch) ||
        request.status.toLowerCase().includes(cleanSearch) ||
        request.payment_status.toLowerCase().includes(cleanSearch)
      );
    });
  }, [requests, search]);

  const pendingCount = requests.filter(
    (request) => request.status === "PENDING"
  ).length;

  const activeCount = requests.filter(
    (request) => request.status === "ACTIVE"
  ).length;

  const paidCount = requests.filter(
    (request) => request.payment_status === "PAID"
  ).length;

  const readyForAssignmentCount = requests.filter(
    (request) =>
      request.status === "ACTIVE" && request.payment_status === "PAID"
  ).length;

  async function approveRequest(request: HireRequest) {
    await updateRequest(request.id, {
      status: "ACTIVE",
    });
  }

  async function rejectRequest(request: HireRequest) {
    await updateRequest(request.id, {
      status: "REJECTED",
    });
  }

  async function markPaid(request: HireRequest) {
    await updateRequest(request.id, {
      payment_status: "PAID",
    });
  }

  async function updateRequest(
    requestId: string,
    payload: Partial<Pick<HireRequest, "status" | "payment_status">>
  ) {
    setActionLoading(requestId);
    setMessage("");
    setErrorMessage("");

    const { error } = await supabase
      .from("customer_caretaker_hires")
      .update(payload)
      .eq("id", requestId);

    if (error) {
      setErrorMessage(`Update request error: ${error.message}`);
      setActionLoading("");
      return;
    }

    const actionText =
      payload.status === "ACTIVE"
        ? "approved"
        : payload.status === "REJECTED"
        ? "rejected"
        : payload.payment_status === "PAID"
        ? "marked as paid"
        : "updated";

    setMessage(`Caretaker hire request ${actionText} successfully.`);
    await loadRequests();
    setActionLoading("");
  }

  function formatPeso(amount: number | null | undefined) {
    const safeAmount = Number(amount || 0);

    return safeAmount.toLocaleString("en-PH", {
      style: "currency",
      currency: "PHP",
      maximumFractionDigits: 0,
    });
  }

  function formatDate(date: string | null) {
    if (!date) return "Pending";

    return new Date(date).toLocaleDateString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function statusClass(status: string) {
    const cleanStatus = (status || "").toUpperCase();

    if (cleanStatus === "ACTIVE") {
      return "bg-green-100 text-green-800 ring-green-200";
    }

    if (cleanStatus === "REJECTED") {
      return "bg-red-100 text-red-800 ring-red-200";
    }

    return "bg-yellow-100 text-yellow-900 ring-yellow-200";
  }

  function paymentClass(paymentStatus: string) {
    const cleanStatus = (paymentStatus || "").toUpperCase();

    if (cleanStatus === "PAID") {
      return "bg-green-100 text-green-800 ring-green-200";
    }

    return "bg-orange-100 text-orange-800 ring-orange-200";
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-yellow-50 p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.25em] text-green-700">
              FarmConnect Admin
            </p>
            <h1 className="mt-2 text-4xl font-black text-green-950">
              Caretaker Hire Approval Center
            </h1>
            <p className="mt-2 max-w-3xl text-lg font-semibold text-slate-600">
              Review customer caretaker hire requests. Approve, reject, and
              verify payment before the caretaker becomes assignable in My
              Flock.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              onClick={loadRequests}
              className="rounded-2xl bg-green-700 px-6 py-3 text-sm font-black text-white shadow-md transition hover:bg-green-800"
            >
              Refresh
            </button>

            <Link
              href="/admin"
              className="rounded-2xl bg-white px-6 py-3 text-center text-sm font-black text-green-800 shadow-md ring-1 ring-green-100 transition hover:bg-green-50"
            >
              ← Admin Dashboard
            </Link>
          </div>
        </div>

        <section className="mb-6 grid gap-4 md:grid-cols-4">
          <div className="rounded-[2rem] bg-white p-5 shadow-md ring-1 ring-green-100">
            <p className="text-sm font-black text-slate-500">
              Pending Requests
            </p>
            <p className="mt-2 text-4xl font-black text-yellow-700">
              {pendingCount}
            </p>
          </div>

          <div className="rounded-[2rem] bg-white p-5 shadow-md ring-1 ring-green-100">
            <p className="text-sm font-black text-slate-500">
              Active Approved
            </p>
            <p className="mt-2 text-4xl font-black text-green-700">
              {activeCount}
            </p>
          </div>

          <div className="rounded-[2rem] bg-white p-5 shadow-md ring-1 ring-green-100">
            <p className="text-sm font-black text-slate-500">
              Paid Requests
            </p>
            <p className="mt-2 text-4xl font-black text-emerald-700">
              {paidCount}
            </p>
          </div>

          <div className="rounded-[2rem] bg-white p-5 shadow-md ring-1 ring-green-100">
            <p className="text-sm font-black text-slate-500">
              Ready For Assignment
            </p>
            <p className="mt-2 text-4xl font-black text-green-950">
              {readyForAssignmentCount}
            </p>
          </div>
        </section>

        <section className="mb-6 rounded-[2rem] bg-white p-5 shadow-md ring-1 ring-green-100">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-black text-green-950">
                Hire Requests
              </h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                Only ACTIVE + PAID requests can be assigned by customers in My
                Flock.
              </p>
            </div>

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search request, profile, caretaker, status..."
              className="w-full rounded-2xl border border-green-100 bg-green-50 px-5 py-3 text-sm font-bold text-slate-700 outline-none transition focus:border-green-400 md:max-w-md"
            />
          </div>
        </section>

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
          <div className="rounded-[2rem] bg-white p-10 text-center text-xl font-black text-slate-600 shadow-md ring-1 ring-green-100">
            Loading caretaker hire requests...
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="rounded-[2rem] bg-white p-10 text-center text-xl font-black text-slate-600 shadow-md ring-1 ring-green-100">
            No caretaker hire requests found.
          </div>
        ) : (
          <section className="grid gap-5">
            {filteredRequests.map((request) => {
              const isPending = request.status === "PENDING";
              const isActive = request.status === "ACTIVE";
              const isRejected = request.status === "REJECTED";
              const isPaid = request.payment_status === "PAID";
              const isReady = isActive && isPaid;
              const busy = actionLoading === request.id;

              return (
                <div
                  key={request.id}
                  className="rounded-[2rem] bg-white p-6 shadow-md ring-1 ring-green-100"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-sm font-black uppercase tracking-[0.2em] text-green-700">
                        Customer Caretaker Hire Request
                      </p>

                      <h3 className="mt-2 text-3xl font-black text-green-950">
                        {request.caretaker_name}
                      </h3>

                      <div className="mt-3 grid gap-2 text-sm font-bold text-slate-500">
                        <p className="break-all">
                          Request ID:{" "}
                          <span className="text-slate-800">{request.id}</span>
                        </p>
                        <p className="break-all">
                          Profile ID:{" "}
                          <span className="text-slate-800">
                            {request.profile_id}
                          </span>
                        </p>
                        <p className="break-all">
                          Caretaker ID:{" "}
                          <span className="text-slate-800">
                            {request.caretaker_id}
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <span
                        className={`rounded-full px-4 py-2 text-sm font-black ring-1 ${statusClass(
                          request.status
                        )}`}
                      >
                        {request.status}
                      </span>

                      <span
                        className={`rounded-full px-4 py-2 text-sm font-black ring-1 ${paymentClass(
                          request.payment_status
                        )}`}
                      >
                        Payment: {request.payment_status}
                      </span>

                      {isReady && (
                        <span className="rounded-full bg-green-700 px-4 py-2 text-sm font-black text-white">
                          READY FOR MY FLOCK
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-6 grid gap-4 md:grid-cols-4 xl:grid-cols-7">
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
                        Duration
                      </p>
                      <p className="mt-1 text-lg font-black text-slate-800">
                        {request.duration_days} days
                      </p>
                    </div>

                    <div className="rounded-3xl bg-slate-50 p-4">
                      <p className="text-xs font-black text-slate-500">
                        Rate / Chick
                      </p>
                      <p className="mt-1 text-lg font-black text-slate-800">
                        {formatPeso(request.rate_per_chick)}
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
                        {formatDate(request.start_date)}
                      </p>
                    </div>

                    <div className="rounded-3xl bg-slate-50 p-4">
                      <p className="text-xs font-black text-slate-500">
                        End Date
                      </p>
                      <p className="mt-1 text-lg font-black text-slate-800">
                        {formatDate(request.end_date)}
                      </p>
                    </div>

                    <div className="rounded-3xl bg-slate-50 p-4">
                      <p className="text-xs font-black text-slate-500">
                        Created
                      </p>
                      <p className="mt-1 text-lg font-black text-slate-800">
                        {formatDate(request.created_at)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 rounded-3xl bg-green-50 p-5">
                    <p className="text-center text-sm font-black text-slate-600">
                      Assignment Rule: customer can assign caretaker only when
                      request is ACTIVE and payment is PAID.
                    </p>
                  </div>

                  <div className="mt-6 grid gap-3 md:grid-cols-3">
                    <button
                      onClick={() => approveRequest(request)}
                      disabled={busy || isActive || isRejected}
                      className="rounded-2xl bg-green-700 px-5 py-4 text-base font-black text-white shadow-md transition hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {busy ? "Updating..." : "Approve"}
                    </button>

                    <button
                      onClick={() => rejectRequest(request)}
                      disabled={busy || isRejected}
                      className="rounded-2xl bg-red-700 px-5 py-4 text-base font-black text-white shadow-md transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {busy ? "Updating..." : "Reject"}
                    </button>

                    <button
                      onClick={() => markPaid(request)}
                      disabled={busy || isPaid || isRejected}
                      className="rounded-2xl bg-yellow-500 px-5 py-4 text-base font-black text-yellow-950 shadow-md transition hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {busy ? "Updating..." : "Mark Paid"}
                    </button>
                  </div>
                </div>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}