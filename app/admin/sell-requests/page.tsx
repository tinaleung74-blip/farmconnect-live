"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type SellRequest = {
  id: string;
  profile_id: string;
  flock_id: string;
  batch_no: string;
  breed: string;
  chicken_stage: string;
  quantity: number;
  price_per_chicken: number;
  total_amount: number;
  status: string;
  admin_notes: string | null;
  created_at: string;
  approved_at: string | null;
};

const TECHNICAL_FEE_RATE = 0.02;

export default function AdminSellRequestsPage() {
  const [requests, setRequests] = useState<SellRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState("");

  async function loadRequests() {
    setLoading(true);

    const { data, error } = await supabase
      .from("sell_chicken_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    setRequests((data || []) as SellRequest[]);
    setLoading(false);
  }

  useEffect(() => {
    loadRequests();
  }, []);

  async function approveRequest(req: SellRequest) {
    if (req.status === "APPROVED") return;

    const confirmApprove = confirm(
      `Approve sell request for ${req.quantity} chicken(s)? Customer wallet will be credited 98% and FarmConnect will record 2% fee.`
    );

    if (!confirmApprove) return;

    setProcessingId(req.id);

    try {
      const grossAmount = Number(req.total_amount || 0);
      const farmConnectFee = grossAmount * TECHNICAL_FEE_RATE;
      const customerNetAmount = grossAmount - farmConnectFee;
      const referenceBase = Date.now();

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id,wallet_balance")
        .eq("id", req.profile_id)
        .single();

      if (profileError) throw profileError;

      const currentWalletBalance = Number(profile?.wallet_balance || 0);
      const newWalletBalance = currentWalletBalance + customerNetAmount;

      const { error: walletUpdateError } = await supabase
        .from("profiles")
        .update({
          wallet_balance: newWalletBalance,
        })
        .eq("id", req.profile_id);

      if (walletUpdateError) throw walletUpdateError;

      const { error: walletLogError } = await supabase
        .from("wallet_transactions")
        .insert([
          {
            profile_id: req.profile_id,
            transaction_type: "CHICKEN_SALE_NET_CREDIT",
            amount: customerNetAmount,
            reference_no: `FC-SELL-NET-${referenceBase}`,
            remarks: `Chicken sale approved: ${req.quantity} chicken(s) from ${req.batch_no}. Net 98% credited to customer wallet.`,
            status: "COMPLETED",
          },
          {
            profile_id: req.profile_id,
            transaction_type: "FARMCONNECT_SELL_CHICKEN_FEE",
            amount: farmConnectFee,
            reference_no: `FC-SELL-FEE-${referenceBase}`,
            remarks: `2% FarmConnect technical fee from chicken sale: ${req.quantity} chicken(s) from ${req.batch_no}.`,
            status: "COMPLETED",
          },
        ]);

      if (walletLogError) throw walletLogError;

      const { error: requestUpdateError } = await supabase
        .from("sell_chicken_requests")
        .update({
          status: "APPROVED",
          admin_notes:
            "Approved by admin. Customer wallet credited 98%. FarmConnect 2% fee recorded.",
          approved_at: new Date().toISOString(),
        })
        .eq("id", req.id);

      if (requestUpdateError) throw requestUpdateError;

      alert("Sell request approved. Customer wallet credited.");
      await loadRequests();
    } catch (err: any) {
      alert(err?.message || "Approval failed.");
    } finally {
      setProcessingId("");
    }
  }

  async function rejectRequest(req: SellRequest) {
    if (req.status === "REJECTED") return;

    const confirmReject = confirm(
      `Reject sell request for ${req.quantity} chicken(s)? Reserved chickens will be returned to the flock.`
    );

    if (!confirmReject) return;

    setProcessingId(req.id);

    try {
      const { data: flock, error: flockError } = await supabase
        .from("flocks")
        .select("id,alive_count,status")
        .eq("id", req.flock_id)
        .single();

      if (flockError) throw flockError;

      const currentAlive = Number(flock?.alive_count || 0);
      const restoredAlive = currentAlive + Number(req.quantity || 0);

      const { error: flockUpdateError } = await supabase
        .from("flocks")
        .update({
          alive_count: restoredAlive,
          status: "ACTIVE",
        })
        .eq("id", req.flock_id);

      if (flockUpdateError) throw flockUpdateError;

      const { error: requestUpdateError } = await supabase
        .from("sell_chicken_requests")
        .update({
          status: "REJECTED",
          admin_notes:
            "Rejected by admin. Reserved chickens returned to flock. Customer wallet unchanged.",
        })
        .eq("id", req.id);

      if (requestUpdateError) throw requestUpdateError;

      await supabase.from("wallet_transactions").insert({
        profile_id: req.profile_id,
        transaction_type: "CHICKEN_SALE_REJECTED",
        amount: 0,
        reference_no: `FC-SELL-REJECT-${Date.now()}`,
        remarks: `Chicken sale rejected: ${req.quantity} chicken(s) returned to ${req.batch_no}.`,
        status: "COMPLETED",
      });

      alert("Sell request rejected. Chickens returned to flock.");
      await loadRequests();
    } catch (err: any) {
      alert(err?.message || "Rejection failed.");
    } finally {
      setProcessingId("");
    }
  }

  function statusStyle(status: string) {
    if (status === "APPROVED") return "bg-green-100 text-green-700";
    if (status === "REJECTED") return "bg-red-100 text-red-700";
    return "bg-yellow-100 text-yellow-700";
  }

  function formatPeso(amount: number) {
    return Number(amount || 0).toLocaleString("en-PH", {
      style: "currency",
      currency: "PHP",
      maximumFractionDigits: 0,
    });
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-green-50 via-white to-yellow-50 p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black text-green-900">
              🐓 Sell Chicken Requests
            </h1>
            <p className="font-semibold text-green-700">
              Approve customer chicken selling requests. Customer receives 98%;
              FarmConnect records 2%.
            </p>
          </div>

          <Link
            href="/admin"
            className="rounded-full bg-green-700 px-5 py-3 font-black text-white"
          >
            Back Admin
          </Link>
        </div>

        <section className="mb-6 grid gap-4 md:grid-cols-4">
          <div className="rounded-3xl border bg-white p-5 shadow">
            <p className="font-bold text-gray-500">Total Requests</p>
            <h2 className="text-3xl font-black text-green-900">
              {requests.length}
            </h2>
          </div>

          <div className="rounded-3xl border bg-white p-5 shadow">
            <p className="font-bold text-gray-500">Pending</p>
            <h2 className="text-3xl font-black text-yellow-600">
              {
                requests.filter((r) => r.status === "PENDING_ADMIN_APPROVAL")
                  .length
              }
            </h2>
          </div>

          <div className="rounded-3xl border bg-white p-5 shadow">
            <p className="font-bold text-gray-500">Approved</p>
            <h2 className="text-3xl font-black text-green-700">
              {requests.filter((r) => r.status === "APPROVED").length}
            </h2>
          </div>

          <div className="rounded-3xl border bg-white p-5 shadow">
            <p className="font-bold text-gray-500">Rejected</p>
            <h2 className="text-3xl font-black text-red-600">
              {requests.filter((r) => r.status === "REJECTED").length}
            </h2>
          </div>
        </section>

        <section className="rounded-3xl border bg-white p-6 shadow-xl">
          <h2 className="mb-4 text-2xl font-black text-green-900">
            Request Queue
          </h2>

          {loading ? (
            <div className="rounded-2xl bg-gray-50 p-6 text-center font-black">
              Loading requests...
            </div>
          ) : requests.length === 0 ? (
            <div className="rounded-2xl bg-gray-50 p-6 text-center">
              <h3 className="text-xl font-black">No sell requests yet.</h3>
              <p className="mt-1 text-gray-500">
                Customer sell chicken requests will appear here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-green-50 text-green-900">
                  <tr>
                    <th className="p-3 text-left">Date</th>
                    <th className="p-3 text-left">Customer ID</th>
                    <th className="p-3 text-left">Batch</th>
                    <th className="p-3 text-left">Breed</th>
                    <th className="p-3 text-left">Stage</th>
                    <th className="p-3 text-left">Qty</th>
                    <th className="p-3 text-left">Gross</th>
                    <th className="p-3 text-left">Net 98%</th>
                    <th className="p-3 text-left">Fee 2%</th>
                    <th className="p-3 text-left">Status</th>
                    <th className="p-3 text-left">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {requests.map((req) => {
                    const grossAmount = Number(req.total_amount || 0);
                    const feeAmount = grossAmount * TECHNICAL_FEE_RATE;
                    const netAmount = grossAmount - feeAmount;

                    return (
                      <tr key={req.id} className="border-t">
                        <td className="p-3 font-bold">
                          {new Date(req.created_at).toLocaleDateString()}
                        </td>

                        <td className="p-3">
                          <span className="font-mono text-xs">
                            {req.profile_id}
                          </span>
                        </td>

                        <td className="p-3 font-black">{req.batch_no}</td>
                        <td className="p-3">{req.breed}</td>
                        <td className="p-3">{req.chicken_stage}</td>
                        <td className="p-3 font-black">{req.quantity}</td>

                        <td className="p-3 font-black text-green-700">
                          {formatPeso(grossAmount)}
                        </td>

                        <td className="p-3 font-black text-emerald-700">
                          {formatPeso(netAmount)}
                        </td>

                        <td className="p-3 font-black text-orange-600">
                          {formatPeso(feeAmount)}
                        </td>

                        <td className="p-3">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-black ${statusStyle(
                              req.status
                            )}`}
                          >
                            {req.status}
                          </span>
                        </td>

                        <td className="p-3">
                          {req.status === "PENDING_ADMIN_APPROVAL" ? (
                            <div className="flex gap-2">
                              <button
                                onClick={() => approveRequest(req)}
                                disabled={processingId === req.id}
                                className="rounded-xl bg-green-700 px-4 py-2 font-black text-white disabled:bg-gray-400"
                              >
                                {processingId === req.id
                                  ? "Processing..."
                                  : "Approve"}
                              </button>

                              <button
                                onClick={() => rejectRequest(req)}
                                disabled={processingId === req.id}
                                className="rounded-xl bg-red-600 px-4 py-2 font-black text-white disabled:bg-gray-400"
                              >
                                {processingId === req.id
                                  ? "Processing..."
                                  : "Reject"}
                              </button>
                            </div>
                          ) : (
                            <span className="font-bold text-gray-400">
                              Completed
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}