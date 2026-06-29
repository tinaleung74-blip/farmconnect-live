"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  dateTimeText,
  money,
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

type WalletMode = "cashin" | "cashout" | "history";
type PaymentMethod = "GCASH" | "MAYA" | "BPI";

const presetAmounts = [500, 1000, 2000, 2500, 5000, 10000];
const CASHOUT_FEE_RATE = 0.02;

const PAYMENT_INFO: Record<
  PaymentMethod,
  { name: string; number: string; qr: string; dot: string }
> = {
  GCASH: {
    name: "JANICA MALDIVES",
    number: "+63 928 898 ****",
    qr: "/fc-gcash-qr.png",
    dot: "🔵",
  },
  MAYA: {
    name: "JANICA MALDIVES",
    number: "+63 *** *** 7452",
    qr: "/fc-maya-qr.png",
    dot: "🟢",
  },
  BPI: {
    name: "JANICA MALDIVES",
    number: "**********905",
    qr: "/fc-bpi-qr.png",
    dot: "🔴",
  },
};

export default function WalletPage() {
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [requests, setRequests] = useState<CashRequest[]>([]);
  const [mode, setMode] = useState<WalletMode>("cashin");
  const [method, setMethod] = useState<PaymentMethod>("GCASH");
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
      setMessage("Login required.");
      setLoading(false);
      return;
    }

    const [profileRes, txRes, cashinRes, cashoutRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", currentProfile.id).maybeSingle(),
      supabase
        .from("wallet_transactions")
        .select("id,transaction_type,amount,reference_no,remarks,status,created_at")
        .eq("profile_id", currentProfile.id)
        .order("created_at", { ascending: false })
        .limit(80),
      supabase
        .from("cashin_requests")
        .select("id,amount,payment_method,channel,reference_no,status,created_at")
        .eq("profile_id", currentProfile.id)
        .order("created_at", { ascending: false })
        .limit(40),
      supabase
        .from("cashout_requests")
        .select("id,amount,payment_method,channel,account_name,account_number,reference_no,status,created_at")
        .eq("profile_id", currentProfile.id)
        .order("created_at", { ascending: false })
        .limit(40),
    ]);

    if (profileRes.data) setProfile(profileRes.data as CustomerProfile);

    const loadErrors = [txRes.error?.message, cashinRes.error?.message, cashoutRes.error?.message].filter(Boolean);
    if (loadErrors.length) setMessage(loadErrors.join(" | "));

    const cashin = ((cashinRes.data || []) as Omit<CashRequest, "kind">[]).map((row) => ({
      ...row,
      kind: "CASH_IN" as const,
    }));

    const cashout = ((cashoutRes.data || []) as Omit<CashRequest, "kind">[]).map((row) => ({
      ...row,
      kind: "CASH_OUT" as const,
    }));

    setTransactions((txRes.data || []) as WalletTransaction[]);
    setRequests(
      [...cashin, ...cashout].sort(
        (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime(),
      ),
    );

    setLoading(false);
  }

  async function submitCashin() {
    if (!profile) return setMessage("Login required.");
    if (cashinAmount <= 0) return setMessage("Enter a valid cash-in amount.");
    if (!cashinReference.trim()) return setMessage("Enter your payment reference number.");

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
    if (!cashoutName.trim() || !cashoutNumber.trim()) return setMessage("Enter account name and mobile/account number.");

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
    if (!window.confirm("Cancel this pending cash-out and refund the reserved amount?")) return;

    const { error } = await supabase.rpc("customer_cancel_cashout", {
      p_request_id: requestId,
      p_profile_id: profile.id,
    });

    if (error) return setMessage(error.message);

    setMessage("Cash-out cancelled and amount refunded.");
    await loadWallet();
  }

  const payment = PAYMENT_INFO[method];

  function openSelectedQr() {
    window.open(payment.qr, "_blank", "noopener,noreferrer");
  }

  const cashoutFee = cashoutAmount * CASHOUT_FEE_RATE;
  const cashoutNet = Math.max(cashoutAmount - cashoutFee, 0);

  const pendingCount = useMemo(
    () =>
      requests.filter((request) =>
        ["PENDING", "PROCESSING", "APPROVED"].includes(String(request.status || "").toUpperCase()),
      ).length,
    [requests],
  );

  return (
    <main className="min-h-screen bg-[#f3f7ff] p-4 pb-28 text-[#10213f] md:p-8">
      <div className="mx-auto max-w-7xl">
        <section className="grid gap-5 xl:grid-cols-[1fr_460px]">
          <div className="rounded-[36px] bg-gradient-to-br from-[#007cff] via-[#0064e8] to-[#043b91] p-6 text-white shadow-2xl md:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="w-fit rounded-full bg-white/15 px-4 py-2 text-sm font-black">FarmConnect Wallet</p>
                <h1 className="mt-5 text-4xl font-black md:text-6xl">
                  {loading ? "..." : money(profile?.wallet_balance)}
                </h1>
                <p className="mt-2 font-bold text-white/80">
                  {profile?.full_name || profile?.email || "FarmConnect Customer"}
                </p>
              </div>
              <button onClick={loadWallet} className="rounded-full bg-white/15 px-5 py-3 font-black hover:bg-white/25">
                Refresh
              </button>
            </div>

            <div className="mt-8 grid grid-cols-3 gap-3">
              <Action onClick={() => setMode("cashin")} icon="＋" label="Cash-In" active={mode === "cashin"} />
              <Action onClick={() => setMode("cashout")} icon="↗" label="Cash-Out" active={mode === "cashout"} />
              <Action onClick={() => setMode("history")} icon="☰" label="History" active={mode === "history"} />
            </div>

            <div className="mt-8 grid gap-3 md:grid-cols-3">
              <Link href="/customer/marketplace" className="rounded-[24px] bg-white/15 p-5 font-black hover:bg-white/25">
                🛒 Marketplace
              </Link>
              <Link href="/customer/inventory" className="rounded-[24px] bg-white/15 p-5 font-black hover:bg-white/25">
                📦 Inventory
              </Link>
              <Link href="/customer/notifications" className="rounded-[24px] bg-white/15 p-5 font-black hover:bg-white/25">
                🔔 {pendingCount} Pending
              </Link>
            </div>
          </div>

          <div className="rounded-[36px] bg-white p-5 shadow-xl md:p-6">
            <div className="grid grid-cols-3 gap-2 rounded-full bg-[#eef5ff] p-2">
              {(["cashin", "cashout", "history"] as WalletMode[]).map((value) => (
                <button
                  key={value}
                  onClick={() => setMode(value)}
                  className={`rounded-full px-4 py-3 text-sm font-black transition ${
                    mode === value ? "bg-[#007cff] text-white shadow" : "text-[#52627a] hover:bg-white"
                  }`}
                >
                  {value === "cashin" ? "Cash-In" : value === "cashout" ? "Cash-Out" : "History"}
                </button>
              ))}
            </div>

            {message && <div className="mt-5 rounded-2xl bg-[#eef5ff] p-4 font-black text-[#0064e8]">{message}</div>}

            {mode === "cashin" && (
              <section className="mt-6">
                <h2 className="text-3xl font-black">Cash-In</h2>
                <p className="mt-1 font-bold text-[#61708a]">Scan QR, pay, then submit reference number.</p>

                <Method method={method} setMethod={setMethod} />

                <div className="mt-4 rounded-[26px] bg-[#eef5ff] p-5">
                  <p className="text-sm font-black uppercase text-[#0064e8]">Send Payment To</p>
                  <h3 className="mt-1 text-2xl font-black">{payment.name}</h3>
                  <p className="font-bold text-[#61708a]">
                    {method}: {payment.number}
                  </p>
                </div>

                <div className="mt-4 rounded-[26px] bg-white p-4 text-center shadow">
                  <p className="mb-3 text-sm font-black uppercase text-[#0064e8]">Scan QR to Pay</p>
                  <img
                    src={payment.qr}
                    alt={`${method} QR`}
                    className="mx-auto max-h-80 rounded-2xl object-contain"
                    onError={() => setMessage(`QR image not found. Check public${payment.qr}`)}
                  />
                  <button
                    type="button"
                    onClick={openSelectedQr}
                    className="mt-4 w-full rounded-2xl bg-[#007cff] p-4 font-black text-white shadow-lg hover:bg-[#0064e8]"
                  >
                    Open {method} QR
                  </button>
                </div>

                <AmountButtons setAmount={setCashinAmount} />
                <InputNumber value={cashinAmount} onChange={setCashinAmount} placeholder="Cash-in amount" />
                <InputText value={cashinReference} onChange={setCashinReference} placeholder={`${method} reference number`} />

                <button
                  onClick={submitCashin}
                  disabled={submitting}
                  className="mt-4 w-full rounded-2xl bg-[#007cff] p-4 font-black text-white shadow-lg disabled:bg-slate-300"
                >
                  {submitting ? "Submitting..." : "Submit Cash-In Request"}
                </button>
              </section>
            )}

            {mode === "cashout" && (
              <section className="mt-6">
                <h2 className="text-3xl font-black">Cash-Out</h2>
                <p className="mt-1 font-bold text-[#61708a]">Amount is reserved immediately. Admin processes payout.</p>

                <Method method={method} setMethod={setMethod} />
                <InputNumber value={cashoutAmount} onChange={setCashoutAmount} placeholder="Cash-out amount" />

                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-red-50 p-4">
                    <p className="text-xs font-black uppercase text-red-600">2% Fee</p>
                    <h3 className="text-xl font-black text-red-700">{money(cashoutFee)}</h3>
                  </div>
                  <div className="rounded-2xl bg-blue-50 p-4">
                    <p className="text-xs font-black uppercase text-[#0064e8]">You Receive</p>
                    <h3 className="text-xl font-black text-[#0064e8]">{money(cashoutNet)}</h3>
                  </div>
                </div>

                <InputText value={cashoutName} onChange={setCashoutName} placeholder={`${method} account name`} />
                <InputText value={cashoutNumber} onChange={setCashoutNumber} placeholder={`${method} mobile/account number`} />

                <button
                  onClick={submitCashout}
                  disabled={submitting}
                  className="mt-4 w-full rounded-2xl bg-[#00a1ff] p-4 font-black text-white shadow-lg disabled:bg-slate-300"
                >
                  {submitting ? "Submitting..." : "Submit Cash-Out Request"}
                </button>
              </section>
            )}

            {mode === "history" && (
              <section className="mt-6">
                <h2 className="text-3xl font-black">Wallet History</h2>
                <div className="mt-5 max-h-[560px] space-y-3 overflow-y-auto pr-1">
                  {transactions.map((tx) => (
                    <article key={tx.id} className="rounded-2xl border border-[#edf2fa] bg-white p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="font-black">{tx.remarks || statusText(tx.transaction_type)}</h3>
                          <p className="mt-1 text-sm font-bold text-[#61708a]">
                            {tx.reference_no || "No reference"} • {dateTimeText(tx.created_at)}
                          </p>
                          <span className={`mt-2 inline-block rounded-full border px-3 py-1 text-xs font-black ${statusPill(tx.status)}`}>
                            {statusText(tx.status)}
                          </span>
                        </div>
                        <p className={`font-black ${Number(tx.amount || 0) < 0 ? "text-red-600" : "text-[#007cff]"}`}>
                          {money(tx.amount)}
                        </p>
                      </div>
                    </article>
                  ))}
                  {transactions.length === 0 && (
                    <p className="rounded-2xl bg-[#f6f9ff] p-5 text-center font-bold text-[#61708a]">
                      No wallet transactions yet.
                    </p>
                  )}
                </div>
              </section>
            )}
          </div>
        </section>

        <section className="mt-6 rounded-[32px] bg-white p-6 shadow-xl">
          <h2 className="text-2xl font-black">Cash Requests</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {requests.slice(0, 8).map((request) => {
              const pending =
                request.kind === "CASH_OUT" && String(request.status || "").toUpperCase() === "PENDING";

              return (
                <article key={`${request.kind}-${request.id}`} className="rounded-2xl border border-[#edf2fa] p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-black uppercase text-[#0064e8]">
                        {request.kind === "CASH_IN" ? "Cash-In" : "Cash-Out"}
                      </p>
                      <h3 className="font-black">{request.payment_method || request.channel || "Wallet Request"}</h3>
                      <p className="text-sm font-bold text-[#61708a]">
                        {request.reference_no || request.account_number || "No reference"} • {dateTimeText(request.created_at)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-[#007cff]">{money(request.amount)}</p>
                      <span className={`mt-2 inline-block rounded-full border px-3 py-1 text-xs font-black ${statusPill(request.status)}`}>
                        {statusText(request.status)}
                      </span>
                    </div>
                  </div>

                  {pending && (
                    <button
                      onClick={() => cancelCashout(request.id)}
                      className="mt-3 rounded-full bg-red-50 px-4 py-2 text-sm font-black text-red-700 hover:bg-red-100"
                    >
                      Cancel & Refund
                    </button>
                  )}
                </article>
              );
            })}
            {requests.length === 0 && (
              <p className="rounded-2xl bg-[#f6f9ff] p-5 font-bold text-[#61708a]">No cash requests yet.</p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function Action({ icon, label, active, onClick }: { icon: string; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-[24px] p-4 text-center font-black transition ${
        active ? "bg-white text-[#007cff]" : "bg-white/15 text-white hover:bg-white/25"
      }`}
    >
      <span className="block text-3xl">{icon}</span>
      <span className="mt-2 block text-sm">{label}</span>
    </button>
  );
}

function Method({
  method,
  setMethod,
}: {
  method: PaymentMethod;
  setMethod: (v: PaymentMethod) => void;
}) {
  return (
    <div className="mt-5 grid grid-cols-3 gap-3">
      {(["GCASH", "MAYA", "BPI"] as const).map((item) => (
        <button
          key={item}
          onClick={() => setMethod(item)}
          className={`rounded-2xl border p-4 text-left font-black ${
            method === item
              ? "border-[#007cff] bg-[#eef5ff] text-[#0064e8]"
              : "border-[#edf2fa] bg-white text-[#52627a]"
          }`}
        >
          {PAYMENT_INFO[item].dot} {item}
        </button>
      ))}
    </div>
  );
}

function AmountButtons({ setAmount }: { setAmount: (value: number) => void }) {
  return (
    <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
      {presetAmounts.map((amount) => (
        <button
          key={amount}
          onClick={() => setAmount(amount)}
          className="rounded-full bg-[#eef5ff] px-4 py-3 text-sm font-black text-[#0064e8] hover:bg-blue-100"
        >
          {money(amount)}
        </button>
      ))}
    </div>
  );
}

function InputNumber({
  value,
  onChange,
  placeholder,
}: {
  value: number;
  onChange: (value: number) => void;
  placeholder: string;
}) {
  return (
    <input
      type="number"
      value={value || ""}
      onChange={(event) => onChange(Number(event.target.value))}
      placeholder={placeholder}
      className="mt-4 w-full rounded-2xl border border-[#edf2fa] p-4 font-bold outline-none focus:border-[#007cff]"
    />
  );
}

function InputText({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="mt-3 w-full rounded-2xl border border-[#edf2fa] p-4 font-bold outline-none focus:border-[#007cff]"
    />
  );
}