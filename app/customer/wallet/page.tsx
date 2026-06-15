"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type WalletTransaction = {
  id: string;
  profile_id: string;
  transaction_type: string;
  amount: number;
  reference_no: string | null;
  remarks: string | null;
  status: string;
  created_at: string;
};

type CashRequest = {
  id: string;
  profile_id: string;
  amount: number;
  payment_method?: string | null;
  channel?: string | null;
  account_name?: string | null;
  account_number?: string | null;
  reference_no?: string | null;
  status: string;
  created_at: string;
};

export default function WalletPage() {
  const [walletBalance, setWalletBalance] = useState(0);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [cashinRequests, setCashinRequests] = useState<CashRequest[]>([]);
  const [cashoutRequests, setCashoutRequests] = useState<CashRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const [cashinMethod, setCashinMethod] = useState("GCASH");
  const [cashinAmount, setCashinAmount] = useState(0);
  const [cashinReference, setCashinReference] = useState("");

  const [cashoutMethod, setCashoutMethod] = useState("GCASH");
  const [cashoutAmount, setCashoutAmount] = useState(0);
  const [cashoutName, setCashoutName] = useState("");
  const [cashoutNumber, setCashoutNumber] = useState("");

  function getProfile() {
    const savedUser =
      typeof window !== "undefined"
        ? localStorage.getItem("farmconnect_user")
        : null;

    if (!savedUser) return null;
    return JSON.parse(savedUser);
  }

  function formatPeso(amount: number) {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      maximumFractionDigits: 2,
    }).format(Number(amount || 0));
  }

  function statusColor(status: string) {
    if (status === "APPROVED" || status === "COMPLETED") {
      return "bg-green-100 text-green-700";
    }

    if (status === "REJECTED" || status === "FAILED") {
      return "bg-red-100 text-red-700";
    }

    return "bg-yellow-100 text-yellow-700";
  }

  async function loadWallet() {
    setLoading(true);

    const user = getProfile();

    if (!user) {
      setWalletBalance(0);
      setTransactions([]);
      setCashinRequests([]);
      setCashoutRequests([]);
      setLoading(false);
      return;
    }

    const { data: profileData } = await supabase
      .from("profiles")
      .select("wallet_balance")
      .eq("id", user.id)
      .maybeSingle();

    const { data: txData } = await supabase
      .from("wallet_transactions")
      .select("*")
      .eq("profile_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);

    const { data: cashinData } = await supabase
      .from("cashin_requests")
      .select("*")
      .eq("profile_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10);

    const { data: cashoutData } = await supabase
      .from("cashout_requests")
      .select("*")
      .eq("profile_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10);

    setWalletBalance(Number(profileData?.wallet_balance || 0));
    setTransactions(txData || []);
    setCashinRequests(cashinData || []);
    setCashoutRequests(cashoutData || []);
    setLoading(false);
  }

  useEffect(() => {
    loadWallet();
  }, []);

  async function submitCashIn() {
    const user = getProfile();

    if (!user) {
      alert("Please login first.");
      return;
    }

    if (!cashinAmount || cashinAmount <= 0) {
      alert("Please enter cash-in amount.");
      return;
    }

    const { error } = await supabase.from("cashin_requests").insert({
      profile_id: user.id,
      amount: cashinAmount,
      payment_method: cashinMethod,
      channel: cashinMethod,
      reference_no: cashinReference || "NO_REFERENCE",
      status: "PENDING",
    });

    if (error) {
      alert(error.message);
      return;
    }

    await supabase.from("wallet_transactions").insert({
      profile_id: user.id,
      transaction_type: "CASH_IN_REQUEST",
      amount: cashinAmount,
      reference_no: cashinReference || "PENDING-" + Date.now(),
      remarks: `${cashinMethod} cash-in request submitted`,
      status: "PENDING",
    });

    alert(`${cashinMethod} cash-in request submitted. Waiting for admin approval.`);
    setCashinAmount(0);
    setCashinReference("");
    await loadWallet();
  }

  async function submitCashOut() {
    const user = getProfile();

    if (!user) {
      alert("Please login first.");
      return;
    }

    if (!cashoutAmount || cashoutAmount <= 0) {
      alert("Please enter cash-out amount.");
      return;
    }

    if (cashoutAmount > walletBalance) {
      alert("Insufficient wallet balance.");
      return;
    }

    if (!cashoutName || !cashoutNumber) {
      alert("Please enter account name and mobile number.");
      return;
    }

    const { error } = await supabase.from("cashout_requests").insert({
      profile_id: user.id,
      amount: cashoutAmount,
      payment_method: cashoutMethod,
      channel: cashoutMethod,
      account_name: cashoutName,
      account_number: cashoutNumber,
      status: "PENDING",
    });

    if (error) {
      alert(error.message);
      return;
    }

    await supabase.from("wallet_transactions").insert({
      profile_id: user.id,
      transaction_type: "CASH_OUT_REQUEST",
      amount: cashoutAmount * -1,
      reference_no: "FC-CASHOUT-" + Date.now(),
      remarks: `${cashoutMethod} cash-out request submitted`,
      status: "PENDING",
    });

    alert(`${cashoutMethod} cash-out request submitted. Waiting for admin approval.`);
    setCashoutAmount(0);
    setCashoutName("");
    setCashoutNumber("");
    await loadWallet();
  }

  return (
    <main className="min-h-screen bg-[#f3fbf5] p-6 md:p-10">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="bg-green-100 text-green-700 w-fit px-4 py-2 rounded-full text-sm font-black mb-3">
              💰 Farm Payment Center
            </p>

            <h1 className="text-4xl font-black text-gray-900">Farm Wallet</h1>

            <p className="text-gray-500 mt-2">
              GCash and Maya cash-in/cash-out requests are routed to admin approval.
            </p>
          </div>

          <Link
            href="/customer/dashboard"
            className="bg-white border border-green-100 px-5 py-3 rounded-2xl font-black text-green-700 shadow"
          >
            ← Dashboard
          </Link>
        </div>

        <section className="grid md:grid-cols-4 gap-5 mb-8">
          <div className="bg-white rounded-3xl p-6 shadow border border-green-100">
            <p className="text-gray-500 font-semibold">Available Balance</p>
            <h2 className="text-4xl font-black text-green-700 mt-2">
              {loading ? "Loading..." : formatPeso(walletBalance)}
            </h2>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow border border-green-100">
            <p className="text-gray-500 font-semibold">GCash</p>
            <h2 className="text-xl font-black text-green-700 mt-2">
              Cash-In / Cash-Out
            </h2>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow border border-green-100">
            <p className="text-gray-500 font-semibold">Maya</p>
            <h2 className="text-xl font-black text-green-700 mt-2">
              Cash-In / Cash-Out
            </h2>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow border border-green-100">
            <p className="text-gray-500 font-semibold">Pending Requests</p>
            <h2 className="text-4xl font-black text-orange-500 mt-2">
              {
                [...cashinRequests, ...cashoutRequests].filter(
                  (r) => r.status === "PENDING"
                ).length
              }
            </h2>
          </div>
        </section>

        <section className="grid lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-3xl p-6 shadow border border-green-100">
            <h2 className="text-2xl font-black text-gray-900 mb-4">
              📥 Cash-In via GCash / Maya
            </h2>

            <div className="grid gap-4">
              <select
                value={cashinMethod}
                onChange={(e) => setCashinMethod(e.target.value)}
                className="border rounded-2xl p-4 font-bold"
              >
                <option value="GCASH">GCash</option>
                <option value="MAYA">Maya</option>
              </select>

              <input
                type="number"
                value={cashinAmount}
                onChange={(e) => setCashinAmount(Number(e.target.value))}
                placeholder="Cash-in amount"
                className="border rounded-2xl p-4 font-bold"
              />

              <input
                value={cashinReference}
                onChange={(e) => setCashinReference(e.target.value)}
                placeholder="GCash/Maya reference number"
                className="border rounded-2xl p-4 font-bold"
              />

              <div className="bg-green-50 rounded-2xl p-4 text-sm text-gray-700">
                <p className="font-black text-green-800 mb-1">
                  Payment Instruction
                </p>
                <p>
                  Send payment using your selected channel, enter your reference
                  number, then submit for admin verification.
                </p>
              </div>

              <button
                onClick={submitCashIn}
                className="bg-green-700 hover:bg-green-800 text-white p-4 rounded-2xl font-black"
              >
                Submit Cash-In Request
              </button>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow border border-green-100">
            <h2 className="text-2xl font-black text-gray-900 mb-4">
              📤 Cash-Out to GCash / Maya
            </h2>

            <div className="grid gap-4">
              <select
                value={cashoutMethod}
                onChange={(e) => setCashoutMethod(e.target.value)}
                className="border rounded-2xl p-4 font-bold"
              >
                <option value="GCASH">GCash</option>
                <option value="MAYA">Maya</option>
              </select>

              <input
                type="number"
                value={cashoutAmount}
                onChange={(e) => setCashoutAmount(Number(e.target.value))}
                placeholder="Cash-out amount"
                className="border rounded-2xl p-4 font-bold"
              />

              <input
                value={cashoutName}
                onChange={(e) => setCashoutName(e.target.value)}
                placeholder="GCash/Maya account name"
                className="border rounded-2xl p-4 font-bold"
              />

              <input
                value={cashoutNumber}
                onChange={(e) => setCashoutNumber(e.target.value)}
                placeholder="GCash/Maya mobile number"
                className="border rounded-2xl p-4 font-bold"
              />

              <div className="bg-yellow-50 rounded-2xl p-4 text-sm text-gray-700">
                <p className="font-black text-yellow-800 mb-1">
                  Admin Approval Required
                </p>
                <p>
                  Cash-out will be processed after admin verifies wallet balance
                  and payout details.
                </p>
              </div>

              <button
                onClick={submitCashOut}
                className="bg-green-700 hover:bg-green-800 text-white p-4 rounded-2xl font-black"
              >
                Submit Cash-Out Request
              </button>
            </div>
          </div>
        </section>

        <section className="grid lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-3xl p-6 shadow border border-green-100">
            <h2 className="text-2xl font-black text-gray-900 mb-4">
              🧾 Wallet Transaction History
            </h2>

            {transactions.length === 0 ? (
              <p className="text-gray-500">No wallet transactions yet.</p>
            ) : (
              <div className="space-y-3">
                {transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="border border-green-100 rounded-2xl p-4"
                  >
                    <div className="flex justify-between gap-4">
                      <div>
                        <p className="font-black text-gray-900">
                          {tx.remarks || tx.transaction_type}
                        </p>
                        <p className="text-sm text-gray-500">
                          {tx.reference_no || "No reference"} •{" "}
                          {new Date(tx.created_at).toLocaleDateString()}
                        </p>
                        <span
                          className={`inline-block mt-2 rounded-full px-3 py-1 text-xs font-black ${statusColor(
                            tx.status
                          )}`}
                        >
                          {tx.status}
                        </span>
                      </div>

                      <p
                        className={`font-black ${
                          Number(tx.amount || 0) >= 0
                            ? "text-green-700"
                            : "text-red-600"
                        }`}
                      >
                        {formatPeso(Number(tx.amount || 0))}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-3xl p-6 shadow border border-green-100">
            <h2 className="text-2xl font-black text-gray-900 mb-4">
              📋 Cash Request History
            </h2>

            {[...cashinRequests, ...cashoutRequests].length === 0 ? (
              <p className="text-gray-500">No cash requests yet.</p>
            ) : (
              <div className="space-y-3">
                {[...cashinRequests, ...cashoutRequests]
                  .sort(
                    (a, b) =>
                      new Date(b.created_at).getTime() -
                      new Date(a.created_at).getTime()
                  )
                  .map((req) => (
                    <div
                      key={req.id}
                      className="border border-green-100 rounded-2xl p-4"
                    >
                      <div className="flex justify-between gap-4">
                        <div>
                          <p className="font-black text-gray-900">
                            {req.channel || req.payment_method || "Cash Request"}
                          </p>
                          <p className="text-sm text-gray-500">
                            {req.reference_no || req.account_number || "No reference"} •{" "}
                            {new Date(req.created_at).toLocaleDateString()}
                          </p>
                          <span
                            className={`inline-block mt-2 rounded-full px-3 py-1 text-xs font-black ${statusColor(
                              req.status
                            )}`}
                          >
                            {req.status}
                          </span>
                        </div>

                        <p className="font-black text-green-700">
                          {formatPeso(Number(req.amount || 0))}
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}