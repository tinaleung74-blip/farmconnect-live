"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  wallet_balance: number | null;
};

type WalletTransaction = {
  id: string;
  profile_id?: string | null;
  customer_id?: string | null;
  transaction_type?: string | null;
  type?: string | null;
  amount?: number | string | null;
  reference_no?: string | null;
  reference?: string | null;
  remarks?: string | null;
  description?: string | null;
  status?: string | null;
  created_at?: string | null;
};

type CashRequest = {
  id: string;
  profile_id?: string | null;
  customer_id?: string | null;
  amount?: number | string | null;
  payment_method?: string | null;
  channel?: string | null;
  method?: string | null;
  account_name?: string | null;
  account_number?: string | null;
  reference_no?: string | null;
  reference_number?: string | null;
  status?: string | null;
  created_at?: string | null;
};

type PaymentSettings = {
  id: string;
  gcash_number: string | null;
  maya_number: string | null;
  gcash_name: string | null;
  maya_name: string | null;
};

const CASHOUT_FEE_RATE = 0.02;

export default function WalletPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [walletBalance, setWalletBalance] = useState(0);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [cashinRequests, setCashinRequests] = useState<CashRequest[]>([]);
  const [cashoutRequests, setCashoutRequests] = useState<CashRequest[]>([]);
  const [paymentSettings, setPaymentSettings] =
    useState<PaymentSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [cashinMethod, setCashinMethod] = useState("GCASH");
  const [cashinAmount, setCashinAmount] = useState(0);
  const [cashinReference, setCashinReference] = useState("");

  const [cashoutMethod, setCashoutMethod] = useState("GCASH");
  const [cashoutAmount, setCashoutAmount] = useState(0);
  const [cashoutName, setCashoutName] = useState("");
  const [cashoutNumber, setCashoutNumber] = useState("");

  const cashoutFee = cashoutAmount * CASHOUT_FEE_RATE;
  const cashoutReceives = cashoutAmount - cashoutFee;
  const loginRequired = !profile;

  useEffect(() => {
    loadWallet();
  }, []);

  async function resolveProfile() {
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData.user) {
      setMessage("Login required.");
      return null;
    }

    const authUser = authData.user;

    const { data: profileById } = await supabase
      .from("profiles")
      .select("id,email,full_name,wallet_balance")
      .eq("id", authUser.id)
      .maybeSingle();

    if (profileById) return profileById as Profile;

    const { data: profileByEmail } = await supabase
      .from("profiles")
      .select("id,email,full_name,wallet_balance")
      .eq("email", authUser.email)
      .maybeSingle();

    if (profileByEmail) return profileByEmail as Profile;

    setMessage("Login required. Customer profile not found.");
    return null;
  }

  async function loadWallet() {
    setLoading(true);
    setMessage("");

    const resolvedProfile = await resolveProfile();
    setProfile(resolvedProfile);

    if (!resolvedProfile?.id) {
      setWalletBalance(0);
      setTransactions([]);
      setCashinRequests([]);
      setCashoutRequests([]);
      setLoading(false);
      return;
    }

    const profileId = resolvedProfile.id;

    const [
      profileRes,
      txRes,
      cashinRes,
      cashoutRes,
      paymentRes,
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select("id,email,full_name,wallet_balance")
        .eq("id", profileId)
        .maybeSingle(),

      supabase
        .from("wallet_transactions")
        .select("*")
        .eq("profile_id", profileId)
        .order("created_at", { ascending: false })
        .limit(30),

      supabase
        .from("cashin_requests")
        .select("*")
        .eq("profile_id", profileId)
        .order("created_at", { ascending: false })
        .limit(15),

      supabase
        .from("cashout_requests")
        .select("*")
        .eq("profile_id", profileId)
        .order("created_at", { ascending: false })
        .limit(15),

      supabase
        .from("payment_settings")
        .select("*")
        .limit(1)
        .maybeSingle(),
    ]);

    if (profileRes.error) {
      setMessage(`Wallet profile load error: ${profileRes.error.message}`);
    }

    if (txRes.error) {
      setMessage(`Wallet history load error: ${txRes.error.message}`);
    }

    if (cashinRes.error) {
      setMessage(`Cash-in history load error: ${cashinRes.error.message}`);
    }

    if (cashoutRes.error) {
      setMessage(`Cash-out history load error: ${cashoutRes.error.message}`);
    }

    setWalletBalance(Number(profileRes.data?.wallet_balance || 0));
    setTransactions((txRes.data || []) as WalletTransaction[]);
    setCashinRequests((cashinRes.data || []) as CashRequest[]);
    setCashoutRequests((cashoutRes.data || []) as CashRequest[]);
    setPaymentSettings((paymentRes.data as PaymentSettings) || null);
    setLoading(false);
  }

  async function submitCashIn() {
    if (!profile?.id) {
      alert("Login required.");
      return;
    }

    if (!cashinAmount || cashinAmount <= 0) {
      alert("Please enter cash-in amount.");
      return;
    }

    if (!cashinReference.trim()) {
      alert("Please enter your GCash/Maya reference number.");
      return;
    }

    const referenceNo = cashinReference.trim();

    const { error: requestError } = await supabase.from("cashin_requests").insert({
      profile_id: profile.id,
      amount: cashinAmount,
      payment_method: cashinMethod,
      channel: cashinMethod,
      reference_no: referenceNo,
      status: "PENDING",
      created_at: new Date().toISOString(),
    });

    if (requestError) {
      alert(requestError.message);
      return;
    }

    const { error: txError } = await supabase.from("wallet_transactions").insert({
      profile_id: profile.id,
      transaction_type: "CASH_IN_REQUEST",
      amount: cashinAmount,
      reference_no: referenceNo,
      remarks: `${cashinMethod} cash-in request submitted. Waiting for admin approval.`,
      status: "PENDING",
      created_at: new Date().toISOString(),
    });

    if (txError) {
      alert(txError.message);
      return;
    }

    alert(`${cashinMethod} cash-in request submitted. Waiting for admin approval.`);
    setCashinAmount(0);
    setCashinReference("");
    await loadWallet();
  }

  async function submitCashOut() {
    if (!profile?.id) {
      alert("Login required.");
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

    if (!cashoutName.trim() || !cashoutNumber.trim()) {
      alert("Please enter account name and mobile number.");
      return;
    }

    const referenceNo = `FC-CASHOUT-${Date.now()}`;

    const { error: requestError } = await supabase
      .from("cashout_requests")
      .insert({
        profile_id: profile.id,
        amount: cashoutAmount,
        payment_method: cashoutMethod,
        channel: cashoutMethod,
        account_name: cashoutName.trim(),
        account_number: cashoutNumber.trim(),
        reference_no: referenceNo,
        status: "PENDING",
        created_at: new Date().toISOString(),
      });

    if (requestError) {
      alert(requestError.message);
      return;
    }

    const { error: txError } = await supabase.from("wallet_transactions").insert({
      profile_id: profile.id,
      transaction_type: "CASH_OUT_REQUEST",
      amount: cashoutAmount * -1,
      reference_no: referenceNo,
      remarks: `${cashoutMethod} cash-out request submitted. Fee: ${formatPeso(
        cashoutFee
      )}. Customer receives: ${formatPeso(cashoutReceives)}. Waiting for admin approval.`,
      status: "PENDING",
      created_at: new Date().toISOString(),
    });

    if (txError) {
      alert(txError.message);
      return;
    }

    alert(`${cashoutMethod} cash-out request submitted. Waiting for admin approval.`);
    setCashoutAmount(0);
    setCashoutName("");
    setCashoutNumber("");
    await loadWallet();
  }

  const pendingRequests = useMemo(
    () =>
      [...cashinRequests, ...cashoutRequests].filter(
        (r) => statusText(r.status) === "PENDING"
      ).length,
    [cashinRequests, cashoutRequests]
  );

  const combinedRequests = useMemo(() => {
    return [...cashinRequests, ...cashoutRequests].sort(
      (a, b) =>
        new Date(b.created_at ?? 0).getTime() -
        new Date(a.created_at ?? 0).getTime()
    );
  }, [cashinRequests, cashoutRequests]);

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
              Cash-in through FarmConnect GCash/Maya. Cash-out has 2% technical fee.
            </p>

            {profile && (
              <p className="text-sm text-green-700 font-bold mt-2">
                Customer: {profile.full_name || profile.email || "Profile"}
              </p>
            )}
          </div>

          <Link
            href="/customer/dashboard"
            className="bg-white border border-green-100 px-5 py-3 rounded-2xl font-black text-green-700 shadow"
          >
            ← Dashboard
          </Link>
        </div>

        {message && (
          <div className="bg-white rounded-3xl p-5 mb-6 shadow border border-yellow-100 text-yellow-700 font-black">
            {message}
          </div>
        )}

        {loginRequired && !loading && (
          <div className="bg-white rounded-3xl p-6 mb-6 shadow border border-red-100 text-red-700 font-black">
            Login required.
          </div>
        )}

        <section className="grid md:grid-cols-4 gap-5 mb-8">
          <div className="bg-white rounded-3xl p-6 shadow border border-green-100">
            <p className="text-gray-500 font-semibold">Available Balance</p>
            <h2 className="text-4xl font-black text-green-700 mt-2">
              {loading ? "Loading..." : formatPeso(walletBalance)}
            </h2>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow border border-green-100">
            <p className="text-gray-500 font-semibold">GCash Number</p>
            <h2 className="text-xl font-black text-green-700 mt-2">
              {paymentSettings?.gcash_number || "09288985979"}
            </h2>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow border border-green-100">
            <p className="text-gray-500 font-semibold">Maya Number</p>
            <h2 className="text-xl font-black text-green-700 mt-2">
              {paymentSettings?.maya_number || "09498387452"}
            </h2>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow border border-green-100">
            <p className="text-gray-500 font-semibold">Pending Requests</p>
            <h2 className="text-4xl font-black text-orange-500 mt-2">
              {pendingRequests}
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
                disabled={loginRequired}
                className="border rounded-2xl p-4 font-bold disabled:bg-gray-100"
              >
                <option value="GCASH">GCash</option>
                <option value="MAYA">Maya</option>
              </select>

              <div className="bg-green-50 rounded-2xl p-4 text-sm text-gray-700">
                <p className="font-black text-green-800 mb-2">
                  Send Payment To
                </p>

                <div className="bg-white rounded-xl p-3 mb-2">
                  <p className="font-bold">GCash</p>
                  <p className="text-xl font-black text-green-800">
                    {paymentSettings?.gcash_number || "09288985979"}
                  </p>
                  <p className="text-xs text-gray-500">
                    Account Name: {paymentSettings?.gcash_name || "FarmConnect"}
                  </p>
                </div>

                <div className="bg-white rounded-xl p-3 mb-3">
                  <p className="font-bold">Maya</p>
                  <p className="text-xl font-black text-green-800">
                    {paymentSettings?.maya_number || "09498387452"}
                  </p>
                  <p className="text-xs text-gray-500">
                    Account Name: {paymentSettings?.maya_name || "FarmConnect"}
                  </p>
                </div>

                <p>
                  Send payment first using your selected channel. After payment,
                  enter the exact amount and reference number from your receipt.
                </p>
              </div>

              <input
                type="number"
                value={cashinAmount}
                onChange={(e) => setCashinAmount(Number(e.target.value))}
                disabled={loginRequired}
                placeholder="Cash-in amount"
                className="border rounded-2xl p-4 font-bold disabled:bg-gray-100"
              />

              <input
                value={cashinReference}
                onChange={(e) => setCashinReference(e.target.value)}
                disabled={loginRequired}
                placeholder="GCash/Maya reference number"
                className="border rounded-2xl p-4 font-bold disabled:bg-gray-100"
              />

              <button
                onClick={submitCashIn}
                disabled={loginRequired}
                className="bg-green-700 hover:bg-green-800 text-white p-4 rounded-2xl font-black disabled:bg-gray-400"
              >
                {loginRequired ? "Login Required" : "Submit Cash-In Request"}
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
                disabled={loginRequired}
                className="border rounded-2xl p-4 font-bold disabled:bg-gray-100"
              >
                <option value="GCASH">GCash</option>
                <option value="MAYA">Maya</option>
              </select>

              <input
                type="number"
                value={cashoutAmount}
                onChange={(e) => setCashoutAmount(Number(e.target.value))}
                disabled={loginRequired}
                placeholder="Cash-out amount"
                className="border rounded-2xl p-4 font-bold disabled:bg-gray-100"
              />

              <div className="bg-red-50 rounded-2xl p-4">
                <p className="font-black text-red-700">Technical Fee (2%)</p>
                <p className="font-bold text-gray-700">
                  Fee: {formatPeso(cashoutFee)}
                </p>
                <p className="font-bold text-gray-700">
                  Customer Receives: {formatPeso(cashoutReceives)}
                </p>
              </div>

              <input
                value={cashoutName}
                onChange={(e) => setCashoutName(e.target.value)}
                disabled={loginRequired}
                placeholder="GCash/Maya account name"
                className="border rounded-2xl p-4 font-bold disabled:bg-gray-100"
              />

              <input
                value={cashoutNumber}
                onChange={(e) => setCashoutNumber(e.target.value)}
                disabled={loginRequired}
                placeholder="GCash/Maya mobile number"
                className="border rounded-2xl p-4 font-bold disabled:bg-gray-100"
              />

              <div className="bg-yellow-50 rounded-2xl p-4 text-sm text-gray-700">
                <p className="font-black text-yellow-800 mb-1">
                  Admin Approval Required
                </p>
                <p>
                  Admin will verify the request and send the net amount manually
                  to your selected GCash/Maya account.
                </p>
              </div>

              <button
                onClick={submitCashOut}
                disabled={loginRequired}
                className="bg-green-700 hover:bg-green-800 text-white p-4 rounded-2xl font-black disabled:bg-gray-400"
              >
                {loginRequired ? "Login Required" : "Submit Cash-Out Request"}
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
                {transactions.map((tx) => {
                  const txType = tx.transaction_type || tx.type || "Wallet";
                  const txRef = tx.reference_no || tx.reference || "No reference";
                  const txRemarks = tx.remarks || tx.description || txType;

                  return (
                    <div
                      key={tx.id}
                      className="border border-green-100 rounded-2xl p-4"
                    >
                      <div className="flex justify-between gap-4">
                        <div>
                          <p className="font-black text-gray-900">
                            {txRemarks}
                          </p>
                          <p className="text-sm text-gray-500">
                            {txRef} • {formatDate(tx.created_at)}
                          </p>
                          <span
                            className={`inline-block mt-2 rounded-full px-3 py-1 text-xs font-black ${statusColor(
                              tx.status
                            )}`}
                          >
                            {statusText(tx.status)}
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
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-white rounded-3xl p-6 shadow border border-green-100">
            <h2 className="text-2xl font-black text-gray-900 mb-4">
              📋 Cash Request History
            </h2>

            {combinedRequests.length === 0 ? (
              <p className="text-gray-500">No cash requests yet.</p>
            ) : (
              <div className="space-y-3">
                {combinedRequests.map((req) => {
                  const requestRef =
                    req.reference_no ||
                    req.reference_number ||
                    req.account_number ||
                    "No reference";

                  return (
                    <div
                      key={req.id}
                      className="border border-green-100 rounded-2xl p-4"
                    >
                      <div className="flex justify-between gap-4">
                        <div>
                          <p className="font-black text-gray-900">
                            {req.channel ||
                              req.payment_method ||
                              req.method ||
                              "Cash Request"}
                          </p>
                          <p className="text-sm text-gray-500">
                            {requestRef} • {formatDate(req.created_at)}
                          </p>
                          <span
                            className={`inline-block mt-2 rounded-full px-3 py-1 text-xs font-black ${statusColor(
                              req.status
                            )}`}
                          >
                            {statusText(req.status)}
                          </span>
                        </div>

                        <p className="font-black text-green-700">
                          {formatPeso(Number(req.amount || 0))}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function formatPeso(amount: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(Number(amount || 0));
}

function statusText(value?: string | null) {
  return String(value || "PENDING").toUpperCase();
}

function statusColor(value?: string | null) {
  const s = statusText(value);

  if (s === "APPROVED" || s === "COMPLETED" || s === "POSTED") {
    return "bg-green-100 text-green-700";
  }

  if (s === "REJECTED" || s === "FAILED") {
    return "bg-red-100 text-red-700";
  }

  return "bg-yellow-100 text-yellow-700";
}

function formatDate(value?: string | null) {
  if (!value) return "No date";
  return new Date(value).toLocaleDateString("en-PH");
}