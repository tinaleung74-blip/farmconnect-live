"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type SellRequest = {
  id: string;
  profile_id: string;
  flock_id: string | null;
  batch_no: string | null;
  breed: string | null;
  chicken_stage: string | null;
  quantity: number | null;
  price_per_chicken: number | null;
  total_amount: number | null;
  status: string | null;
  admin_notes?: string | null;
  created_at: string;
};

type PriceSetting = {
  price_per_chicken: number;
  technical_fee_rate: number;
};

const DEFAULT_TECHNICAL_FEE_RATE = 0.02;

export default function AdminSellRequestsPage() {
  const [requests, setRequests] = useState<SellRequest[]>([]);
  const [priceSetting, setPriceSetting] = useState<PriceSetting | null>(null);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setMessage("");

    await Promise.all([loadActivePriceSetting(), loadRequests()]);

    setLoading(false);
  }

  async function loadActivePriceSetting() {
    const { data, error } = await supabase
      .from("sell_chicken_price_settings")
      .select("price_per_chicken, technical_fee_rate")
      .eq("status", "ACTIVE")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      setMessage(`Price setting load error: ${error.message}`);
      setPriceSetting(null);
      return;
    }

    setPriceSetting((data as PriceSetting) || null);
  }

  async function loadRequests() {
    const { data, error } = await supabase
      .from("sell_chicken_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(`Sell requests load error: ${error.message}`);
      setRequests([]);
      return;
    }

    setRequests((data || []) as SellRequest[]);
  }

  function activeFeeRate() {
    return Number(priceSetting?.technical_fee_rate ?? DEFAULT_TECHNICAL_FEE_RATE);
  }

  function grossAmount(request: SellRequest) {
    return Number(request.total_amount || 0);
  }

  function farmConnectFee(request: SellRequest) {
    return grossAmount(request) * activeFeeRate();
  }

  function customerNet(request: SellRequest) {
    return grossAmount(request) - farmConnectFee(request);
  }

  async function approveRequest(request: SellRequest) {
    const confirmApprove = confirm(
      `Approve sell request and credit customer wallet with ${money(
        customerNet(request)
      )}?`
    );

    if (!confirmApprove) return;

    setProcessingId(request.id);
    setMessage("");

    const gross = grossAmount(request);
    const fee = farmConnectFee(request);
    const net = customerNet(request);

    const referenceNo = `SELL-${request.id.slice(0, 8).toUpperCase()}`;

    const { error: walletError } = await supabase
      .from("wallet_transactions")
      .insert({
        profile_id: request.profile_id,
        transaction_type: "SELL_CHICKEN_CREDIT",
        amount: net,
        reference_no: referenceNo,
        description: `Sell chicken approved. Gross: ${money(
          gross
        )}, FarmConnect fee: ${money(fee)}, Net: ${money(net)}`,
        status: "COMPLETED",
        created_at: new Date().toISOString(),
      });

    if (walletError) {
      setMessage(`Wallet credit error: ${walletError.message}`);
      setProcessingId(null);
      return;
    }

    const { error: updateError } = await supabase
      .from("sell_chicken_requests")
      .update({
        status: "APPROVED",
        admin_notes: `Approved. Customer net credited using current active pricing policy. Fee: ${money(
          fee
        )}. Net: ${money(net)}.`,
      })
      .eq("id", request.id);

    if (updateError) {
      setMessage(`Approval update error: ${updateError.message}`);
      setProcessingId(null);
      return;
    }

    setMessage("✅ Sell request approved and wallet credited.");
    await loadRequests();
    setProcessingId(null);
  }

  async function rejectRequest(request: SellRequest) {
    const confirmReject = confirm(
      "Reject this sell request? Reserved chickens will be restored to the flock."
    );

    if (!confirmReject) return;

    setProcessingId(request.id);
    setMessage("");

    if (request.flock_id) {
      const { data: flockData } = await supabase
        .from("flocks")
        .select("alive_count")
        .eq("id", request.flock_id)
        .maybeSingle();

      const restoredAlive =
        Number(flockData?.alive_count || 0) + Number(request.quantity || 0);

      const { error: restoreError } = await supabase
        .from("flocks")
        .update({
          alive_count: restoredAlive,
          status: "ACTIVE",
        })
        .eq("id", request.flock_id);

      if (restoreError) {
        setMessage(`Flock restore error: ${restoreError.message}`);
        setProcessingId(null);
        return;
      }
    }

    const { error: updateError } = await supabase
      .from("sell_chicken_requests")
      .update({
        status: "REJECTED",
        admin_notes: "Rejected by admin. Reserved chickens restored.",
      })
      .eq("id", request.id);

    if (updateError) {
      setMessage(`Reject update error: ${updateError.message}`);
      setProcessingId(null);
      return;
    }

    setMessage("✅ Sell request rejected and flock restored.");
    await loadRequests();
    setProcessingId(null);
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-yellow-50 via-white to-green-100 p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-4xl font-black text-green-900">
              🐓 Admin Sell Requests
            </h1>
            <p className="font-semibold text-green-700">
              Customer receives Net Amount based on current active pricing policy.
            </p>
          </div>

          <Link
            href="/admin"
            className="rounded-full bg-green-700 px-5 py-3 font-black text-white"
          >
            Back Admin
          </Link>
        </div>

        {message && (
          <div className="mb-6 rounded-3xl bg-white p-5 font-black text-green-700 shadow">
            {message}
          </div>
        )}

        <section className="mb-6 grid gap-5 md:grid-cols-3">
          <Card label="Sell Requests" value={requests.length} />
          <Card
            label="Active Fee Policy"
            value={`${(activeFeeRate() * 100).toLocaleString()}%`}
          />
          <Card
            label="Active Sell Price"
            value={money(priceSetting?.price_per_chicken || 0)}
          />
        </section>

        {loading ? (
          <div className="rounded-3xl bg-white p-8 text-center font-black shadow">
            Loading sell requests...
          </div>
        ) : requests.length === 0 ? (
          <div className="rounded-3xl bg-white p-10 text-center shadow">
            <h2 className="text-2xl font-black text-gray-900">
              No sell requests yet.
            </h2>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-3xl bg-white p-6 shadow-xl">
            <table className="w-full text-sm">
              <thead className="bg-green-50 text-green-900">
                <tr>
                  <th className="p-3 text-left">Date</th>
                  <th className="p-3 text-left">Batch</th>
                  <th className="p-3 text-left">Breed</th>
                  <th className="p-3 text-left">Stage</th>
                  <th className="p-3 text-left">Qty</th>
                  <th className="p-3 text-left">Price</th>
                  <th className="p-3 text-left">Gross</th>
                  <th className="p-3 text-left">Fee</th>
                  <th className="p-3 text-left">Net</th>
                  <th className="p-3 text-left">Status</th>
                  <th className="p-3 text-left">Action</th>
                </tr>
              </thead>

              <tbody>
                {requests.map((request) => {
                  const isPending =
                    String(request.status || "").toUpperCase() ===
                    "PENDING_ADMIN_APPROVAL";

                  return (
                    <tr key={request.id} className="border-t">
                      <td className="p-3 font-bold">
                        {formatDate(request.created_at)}
                      </td>
                      <td className="p-3">{request.batch_no || "—"}</td>
                      <td className="p-3">{request.breed || "—"}</td>
                      <td className="p-3">{request.chicken_stage || "—"}</td>
                      <td className="p-3">{request.quantity || 0}</td>
                      <td className="p-3">
                        {money(request.price_per_chicken || 0)}
                      </td>
                      <td className="p-3">{money(grossAmount(request))}</td>
                      <td className="p-3 text-orange-700 font-black">
                        {money(farmConnectFee(request))}
                      </td>
                      <td className="p-3 text-green-700 font-black">
                        {money(customerNet(request))}
                      </td>
                      <td className="p-3 font-black text-orange-600">
                        {request.status}
                      </td>
                      <td className="p-3">
                        {isPending ? (
                          <div className="flex gap-2">
                            <button
                              onClick={() => approveRequest(request)}
                              disabled={processingId === request.id}
                              className="rounded-xl bg-green-700 px-4 py-2 font-black text-white disabled:bg-gray-400"
                            >
                              Approve
                            </button>

                            <button
                              onClick={() => rejectRequest(request)}
                              disabled={processingId === request.id}
                              className="rounded-xl bg-red-600 px-4 py-2 font-black text-white disabled:bg-gray-400"
                            >
                              Reject
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
      </div>
    </main>
  );
}

function Card({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-3xl bg-white p-6 shadow border border-green-100">
      <p className="font-semibold text-gray-500">{label}</p>
      <h2 className="mt-2 text-3xl font-black text-green-700">{value}</h2>
    </div>
  );
}

function money(value: any) {
  const amount = Number(value || 0);

  return amount.toLocaleString("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  });
}

function formatDate(value?: string | null) {
  if (!value) return "No date";
  return new Date(value).toLocaleDateString("en-PH");
}