"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  dateTimeText,
  farmBgClass,
  goldButtonClass,
  money,
  panelClass,
  primaryButtonClass,
  resolveCustomerProfile,
  statusPill,
  statusText,
  type CustomerProfile,
} from "@/lib/customer-auth";

type WalletTransaction = {
  id: string;
  transaction_type?: string | null;
  amount?: number | string | null;
  reference_no?: string | null;
  remarks?: string | null;
  description?: string | null;
  status?: string | null;
  created_at?: string | null;
};

type CashRequest = {
  id: string;
  amount?: number | string | null;
  payment_method?: string | null;
  channel?: string | null;
  account_name?: string | null;
  account_number?: string | null;
  reference_no?: string | null;
  status?: string | null;
  created_at?: string | null;
  kind: "CASH_IN" | "CASH_OUT";
};

type PaymentSettings = {
  gcash_number?: string | null;
  gcash_name?: string | null;
  maya_number?: string | null;
  maya_name?: string | null;
};

type WalletMode = "cashin" | "cashout" | "history";

const presetAmounts = [500, 1000, 2500, 5000, 10000];
const CASHOUT_FEE_RATE = 0.02;

export default function WalletPage() {
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [requests, setRequests] = useState<CashRequest[]>([]);
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings | null>(null);
  const [mode, setMode] = useState<WalletMode>("cashin");
  const [method, setMethod] = useState("GCASH");
  const [cashinAmount, setCashinAmount] = useState(0);
  const [cashinReference, setCashinReference] = useState("");
  const [cashoutAmount, setCashoutAmount] = useState(0);
  const [cashoutName, setCashoutName] = useState("");
  const [cashoutNumber, setCashoutNumber] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadWallet();
  }, []);

  async function loadWallet() {
    setLoading(true);
    setMessage("");

    const currentProfile = await resolveCustomerProfile();
    setProfile(currentProfile);

    if (!currentProfile) {
      setTransactions([]);
      setRequests([]);
      setPaymentSettings(null);
      setLoading(false);
      return;
    }

    const [profileRes, txRes, cashinRes, cashoutRes, settingsRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("*")
        .eq("id", currentProfile.id)
        .maybeSingle(),
      supabase
        .from("wallet_transactions")
        .select("id,transaction_type,amount,reference_no,remarks,description,status,created_at")
        .eq("profile_id", currentProfile.id)
        .order("created_at", { ascending: false })
        .limit(40),
      supabase
        .from("cashin_requests")
        .select("id,amount,payment_method,channel,reference_no,status,created_at")
        .eq("profile_id", currentProfile.id)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("cashout_requests")
        .select("id,amount,payment_method,channel,account_name,account_number,reference_no,status,created_at")
        .eq("profile_id", currentProfile.id)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase.from("payment_settings").select("*").limit(1).maybeSingle(),
    ]);

    if (profileRes.data) setProfile(profileRes.data as CustomerProfile);
    if (txRes.error) setMessage(txRes.error.message);

    const cashin = ((cashinRes.data || []) as Omit<CashRequest, "kind">[]).map((row) => ({
      ...row,
      kind: "CASH_IN" as const,
    }));

    const cashout = ((cashoutRes.data || []) as Omit<CashRequest, "kind">[]).map((row) => ({
      ...row,
      kind: "CASH_OUT" as const,
    }));

    setTransactions((txRes.data || []) as WalletTransaction[]);
    setRequests([...cashin, ...cashout].sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()));
    setPaymentSettings((settingsRes.data as PaymentSettings) || null);
    setLoading(false);
  }

  async function submitCashin() {
    if (!profile) return setMessage("Login required.");
    if (cashinAmount <= 0) return setMessage("Enter a valid cash-in amount.");
    if (!cashinReference.trim()) return setMessage("Enter your GCash/Maya reference number.");

    setSubmitting(true);
    setMessage("");

    const { error } = await supabase.rpc("customer_submit_cashin", {
      p_profile_id: profile.id,
      p_amount: cashinAmount,
      p_payment_method: method,
      p_reference_no: cashinReference.trim(),
      p_proof_url: null,
    });

    setSubmitting(false);
    if (error) return setMessage(error.message);

    setMessage("Cash-in submitted. Admin will verify and credit your wallet.");
    setCashinAmount(0);
    setCashinReference("");
    setMode("history");
    await loadWallet();
  }

  async function submitCashout() {
    if (!profile) return setMessage("Login required.");
    if (cashoutAmount <= 0) return setMessage("Enter a valid cash-out amount.");
    if (cashoutAmount > Number(profile.wallet_balance || 0)) return setMessage("Insufficient wallet balance.");
    if (!cashoutName.trim() || !cashoutNumber.trim()) return setMessage("Enter account name and mobile number.");

    setSubmitting(true);
    setMessage("");

    const { error } = await supabase.rpc("customer_submit_cashout", {
      p_profile_id: profile.id,
      p_amount: cashoutAmount,
      p_payment_method: method,
      p_account_name: cashoutName.trim(),
      p_account_number: cashoutNumber.trim(),
    });

    setSubmitting(false);
    if (error) return setMessage(error.message);

    setMessage("Cash-out submitted. Amount is reserved while Admin processes payout.");
    setCashoutAmount(0);
    setCashoutName("");
    setCashoutNumber("");
    setMode("history");
    await loadWallet();
  }

  async function cancelCashout(requestId: string) {
    if (!profile) return setMessage("Login required.");
    const confirmCancel = window.confirm("Cancel this pending cash-out and refund the reserved amount?");
    if (!confirmCancel) return;

    setMessage("");
    const { error } = await supabase.rpc("customer_cancel_cashout", {
      p_request_id: requestId,
      p_profile_id: profile.id,
    });

    if (error) return setMessage(error.message);
    setMessage("Cash-out cancelled and amount refunded.");
    await loadWallet();
  }

  const pendingCount = useMemo(
    () => requests.filter((request) => ["PENDING", "PROCESSING", "APPROVED"].includes(String(request.status).toUpperCase())).length,
    [requests],
  );

  const selectedNumber = method === "GCASH" ? paymentSettings?.gcash_number : paymentSettings?.maya_number;
  const selectedName = method === "GCASH" ? paymentSettings?.gcash_name : paymentSettings?.maya_name;
  const cashoutFee = cashoutAmount * CASHOUT_FEE_RATE;
  const cashoutNet = Math.max(cashoutAmount - cashoutFee, 0);

  return (
    <main className={`${farmBgClass} min-h-screen p-4 pb-28 md:p-8`}>
      <div className="mx-auto max-w-7xl">
        <section className="grid gap-5 xl:grid-cols-[1.05fr_.95fr]">
          <div className="rounded-[42px] border border-white/15 bg-white/10 p-5 text-white shadow-2xl backdrop-blur-xl md:p-7">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="w-fit rounded-full bg-amber-300 px-4 py-2 text-sm font-black text-emerald-950">
                  FarmConnect Wallet
                </p>
                <h1 className="mt-5 text-4xl font-black leading-tight md:text-6xl">
                  Fast, clear, cash-ready.
                </h1>
                <p className="mt-3 max-w-xl text-emerald-50">
                  GCash-style wallet experience, but fully FarmConnect-branded and synced through production RPCs.
                </p>
              </div>
              <button onClick={loadWallet} className="rounded-full bg-white/15 px-5 py-3 font-black text-white transition hover:bg-white/25">
                {loading ? "Refreshing..." : "Refresh"}
              </button>
            </div>

            <div className="mt-7 overflow-hidden rounded-[34px] border border-emerald-300/20 bg-gradient-to-br from-emerald-500 via-emerald-700 to-[#06130d] p-6 shadow-2xl">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-black uppercase tracking-[0.2em] text-emerald-100">Available Balance</p>
                  <h2 className="mt-2 text-5xl font-black md:text-6xl">{loading ? "..." : money(profile?.wallet_balance)}</h2>
                  <p className="mt-2 text-sm font-bold text-emerald-100">{profile?.full_name || profile?.email || "FarmConnect Customer"}</p>
                </div>
                <div className="grid h-20 w-20 place-items-center rounded-[28px] bg-white/15 text-4xl shadow-inner">💳</div>
              </div>

              <div className="mt-6 grid grid-cols-3 gap-3">
                <button onClick={() => setMode("cashin")} className="rounded-2xl bg-white p-4 font-black text-emerald-950 shadow">
                  📥 Cash-In
                </button>
                <button onClick={() => setMode("cashout")} className="rounded-2xl bg-white p-4 font-black text-emerald-950 shadow">
                  📤 Cash-Out
                </button>
                <button onClick={() => setMode("history")} className="rounded-2xl bg-white p-4 font-black text-emerald-950 shadow">
                  🧾 History
                </button>
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <Link href="/customer/marketplace" className="rounded-[24px] bg-white/10 p-5 font-black text-white ring-1 ring-white/10 transition hover:bg-white/15">
                🛒 Buy supplies
              </Link>
              <Link href="/customer/inventory" className="rounded-[24px] bg-white/10 p-5 font-black text-white ring-1 ring-white/10 transition hover:bg-white/15">
                📦 Inventory
              </Link>
              <Link href="/customer/notifications" className="rounded-[24px] bg-white/10 p-5 font-black text-white ring-1 ring-white/10 transition hover:bg-white/15">
                🔔 {pendingCount} pending
              </Link>
            </div>
          </div>

          <div className={`${panelClass} p-5 md:p-6`}>
            <div className="mb-5 grid grid-cols-3 gap-2 rounded-full bg-slate-100 p-2">
              {([
                ["cashin", "Cash-In"],
                ["cashout", "Cash-Out"],
                ["history", "History"],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setMode(value)}
                  className={`rounded-full px-4 py-3 text-sm font-black transition ${mode === value ? "bg-emerald-700 text-white shadow" : "text-slate-500 hover:bg-white"}`}
                >
                  {label}
                </button>
              ))}
            </div>

            {message && <div className="mb-5 rounded-2xl bg-amber-50 p-4 font-black text-amber-800">{message}</div>}

            {mode === "cashin" && (
              <section>
                <h2 className="text-3xl font-black text-emerald-950">Cash-In</h2>
                <p className="mt-1 font-bold text-slate-500">Send through GCash or Maya, then submit reference number.</p>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  {(["GCASH", "MAYA"] as const).map((item) => (
                    <button
                      key={item}
                      onClick={() => setMethod(item)}
                      className={`rounded-2xl border p-4 text-left font-black ${method === item ? "border-emerald-700 bg-emerald-50 text-emerald-900" : "border-slate-200 bg-white text-slate-600"}`}
                    >
                      {item === "GCASH" ? "🟦" : "🟩"} {item}
                    </button>
                  ))}
                </div>

                <div className="mt-4 rounded-[26px] bg-emerald-50 p-5">
                  <p className="text-sm font-black uppercase text-emerald-700">Send Payment To</p>
                  <h3 className="mt-1 text-2xl font-black text-emerald-950">{selectedNumber || "Payment number not set"}</h3>
                  <p className="font-bold text-slate-500">Account Name: {selectedName || "FarmConnect"}</p>
                </div>

                <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                  {presetAmounts.map((amount) => (
                    <button key={amount} onClick={() => setCashinAmount(amount)} className="rounded-full bg-slate-100 px-4 py-3 text-sm font-black text-slate-700 hover:bg-emerald-100">
                      {money(amount)}
                    </button>
                  ))}
                </div>

                <input
                  type="number"
                  value={cashinAmount || ""}
                  onChange={(event) => setCashinAmount(Number(event.target.value))}
                  placeholder="Cash-in amount"
                  className="mt-4 w-full rounded-2xl border border-slate-200 p-4 font-bold outline-none focus:border-emerald-500"
                />
                <input
                  value={cashinReference}
                  onChange={(event) => setCashinReference(event.target.value)}
                  placeholder="GCash/Maya reference number"
                  className="mt-3 w-full rounded-2xl border border-slate-200 p-4 font-bold outline-none focus:border-emerald-500"
                />
                <button onClick={submitCashin} disabled={submitting} className={`mt-4 w-full ${primaryButtonClass}`}>
                  {submitting ? "Submitting..." : "Submit Cash-In Request"}
                </button>
              </section>
            )}

            {mode === "cashout" && (
              <section>
                <h2 className="text-3xl font-black text-emerald-950">Cash-Out</h2>
                <p className="mt-1 font-bold text-slate-500">Amount is reserved immediately. Admin processes payout.</p>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  {(["GCASH", "MAYA"] as const).map((item) => (
                    <button
                      key={item}
                      onClick={() => setMethod(item)}
                      className={`rounded-2xl border p-4 text-left font-black ${method === item ? "border-emerald-700 bg-emerald-50 text-emerald-900" : "border-slate-200 bg-white text-slate-600"}`}
                    >
                      {item === "GCASH" ? "🟦" : "🟩"} {item}
                    </button>
                  ))}
                </div>

                <input
                  type="number"
                  value={cashoutAmount || ""}
                  onChange={(event) => setCashoutAmount(Number(event.target.value))}
                  placeholder="Cash-out amount"
                  className="mt-4 w-full rounded-2xl border border-slate-200 p-4 font-bold outline-none focus:border-emerald-500"
                />
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-red-50 p-4">
                    <p className="text-xs font-black uppercase text-red-600">2% Fee</p>
                    <h3 className="text-xl font-black text-red-700">{money(cashoutFee)}</h3>
                  </div>
                  <div className="rounded-2xl bg-emerald-50 p-4">
                    <p className="text-xs font-black uppercase text-emerald-700">You Receive</p>
                    <h3 className="text-xl font-black text-emerald-800">{money(cashoutNet)}</h3>
                  </div>
                </div>
                <input
                  value={cashoutName}
                  onChange={(event) => setCashoutName(event.target.value)}
                  placeholder="GCash/Maya account name"
                  className="mt-3 w-full rounded-2xl border border-slate-200 p-4 font-bold outline-none focus:border-emerald-500"
                />
                <input
                  value={cashoutNumber}
                  onChange={(event) => setCashoutNumber(event.target.value)}
                  placeholder="Mobile number"
                  className="mt-3 w-full rounded-2xl border border-slate-200 p-4 font-bold outline-none focus:border-emerald-500"
                />
                <button onClick={submitCashout} disabled={submitting} className={`mt-4 w-full ${goldButtonClass}`}>
                  {submitting ? "Submitting..." : "Submit Cash-Out Request"}
                </button>
              </section>
            )}

            {mode === "history" && (
              <section>
                <h2 className="text-3xl font-black text-emerald-950">Wallet History</h2>
                <p className="mt-1 font-bold text-slate-500">Transactions and requests are synced from production tables.</p>
                <div className="mt-5 max-h-[520px] space-y-3 overflow-y-auto pr-1">
                  {transactions.map((tx) => (
                    <article key={tx.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="font-black text-slate-900">{tx.remarks || tx.description || statusText(tx.transaction_type)}</h3>
                          <p className="mt-1 text-sm font-bold text-slate-500">{tx.reference_no || "No reference"} • {dateTimeText(tx.created_at)}</p>
                          <span className={`mt-2 inline-block rounded-full border px-3 py-1 text-xs font-black ${statusPill(tx.status)}`}>{statusText(tx.status)}</span>
                        </div>
                        <p className={`font-black ${Number(tx.amount || 0) < 0 ? "text-red-600" : "text-emerald-700"}`}>{money(tx.amount)}</p>
                      </div>
                    </article>
                  ))}
                  {transactions.length === 0 && <div className="rounded-2xl bg-slate-50 p-5 text-center font-bold text-slate-500">No wallet transactions yet.</div>}
                </div>
              </section>
            )}
          </div>
        </section>

        <section className="mt-6 grid gap-5 lg:grid-cols-[.9fr_1.1fr]">
          <div className={`${panelClass} p-6`}>
            <h2 className="text-2xl font-black text-emerald-950">Cash Requests</h2>
            <div className="mt-4 space-y-3">
              {requests.slice(0, 8).map((request) => {
                const pending = request.kind === "CASH_OUT" && String(request.status || "").toUpperCase() === "PENDING";
                return (
                  <article key={`${request.kind}-${request.id}`} className="rounded-2xl border border-slate-100 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-black uppercase text-emerald-700">{request.kind === "CASH_IN" ? "Cash-In" : "Cash-Out"}</p>
                        <h3 className="font-black text-slate-900">{request.payment_method || request.channel || "Wallet Request"}</h3>
                        <p className="text-sm font-bold text-slate-500">{request.reference_no || request.account_number || "No reference"} • {dateTimeText(request.created_at)}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-emerald-700">{money(request.amount)}</p>
                        <span className={`mt-2 inline-block rounded-full border px-3 py-1 text-xs font-black ${statusPill(request.status)}`}>{statusText(request.status)}</span>
                      </div>
                    </div>
                    {pending && (
                      <button onClick={() => cancelCashout(request.id)} className="mt-3 rounded-full bg-red-50 px-4 py-2 text-sm font-black text-red-700 hover:bg-red-100">
                        Cancel & Refund
                      </button>
                    )}
                  </article>
                );
              })}
              {requests.length === 0 && <p className="rounded-2xl bg-slate-50 p-5 font-bold text-slate-500">No cash requests yet.</p>}
            </div>
          </div>

          <div className="rounded-[32px] border border-amber-300/20 bg-[#0c2318]/90 p-6 text-white shadow-2xl">
            <p className="w-fit rounded-full bg-amber-300 px-4 py-2 text-sm font-black text-emerald-950">Wallet Guide</p>
            <h2 className="mt-4 text-3xl font-black">Simple wallet flow</h2>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              {[
                ["1", "Cash-In", "Send via GCash/Maya and submit reference."],
                ["2", "Admin Check", "Admin verifies request and posts wallet update."],
                ["3", "Use Balance", "Buy supplies, hire caretaker, or request payout."],
              ].map(([no, title, text]) => (
                <div key={no} className="rounded-[24px] bg-white/10 p-5 ring-1 ring-white/10">
                  <div className="grid h-10 w-10 place-items-center rounded-2xl bg-amber-300 font-black text-emerald-950">{no}</div>
                  <h3 className="mt-4 font-black">{title}</h3>
                  <p className="mt-1 text-sm text-emerald-50">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
