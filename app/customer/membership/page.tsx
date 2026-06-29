"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  dateText,
  money,
  resolveCustomerProfile,
  shellClass,
  statusPill,
  type CustomerProfile,
} from "@/lib/customer-auth";

type PaymentSettings = {
  gcash_number: string | null;
  maya_number: string | null;
  gcash_name: string | null;
  maya_name: string | null;
};

type MembershipPayment = {
  id: string;
  amount: number | string | null;
  payment_method: string | null;
  reference_no: string | null;
  status: string | null;
  admin_notes: string | null;
  created_at: string | null;
  approved_at?: string | null;
};

const MEMBERSHIP_FEE = 999;

export default function CustomerMembershipPage() {
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [settings, setSettings] = useState<PaymentSettings | null>(null);
  const [payments, setPayments] = useState<MembershipPayment[]>([]);
  const [paymentMethod, setPaymentMethod] = useState("GCASH");
  const [referenceNo, setReferenceNo] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadMembership();
  }, []);

  async function loadMembership() {
    setLoading(true);
    setMessage("");

    const resolvedProfile = await resolveCustomerProfile();
    setProfile(resolvedProfile);

    const paymentSettingsRequest = supabase
      .from("payment_settings")
      .select("gcash_number,maya_number,gcash_name,maya_name")
      .limit(1)
      .maybeSingle();

    if (!resolvedProfile) {
      const { data: paymentSettings } = await paymentSettingsRequest;
      setSettings((paymentSettings as PaymentSettings) || null);
      setPayments([]);
      setLoading(false);
      return;
    }

    const [settingsRes, paymentsRes] = await Promise.all([
      paymentSettingsRequest,
      supabase
        .from("membership_payments")
        .select("id,amount,payment_method,reference_no,status,admin_notes,created_at,approved_at")
        .eq("profile_id", resolvedProfile.id)
        .order("created_at", { ascending: false })
        .limit(30),
    ]);

    if (settingsRes.error) setMessage(settingsRes.error.message);
    if (paymentsRes.error) setMessage(paymentsRes.error.message);

    setSettings((settingsRes.data as PaymentSettings) || null);
    setPayments((paymentsRes.data || []) as MembershipPayment[]);
    setLoading(false);
  }

  async function submitMembershipPayment() {
    if (!profile) {
      setMessage("Please login before submitting membership payment.");
      return;
    }

    if (!referenceNo.trim()) {
      setMessage("Enter your GCash/Maya payment reference number.");
      return;
    }

    setSubmitting(true);
    setMessage("");

    const { error } = await supabase.rpc("customer_submit_membership_payment", {
      p_profile_id: profile.id,
      p_amount: MEMBERSHIP_FEE,
      p_payment_method: paymentMethod,
      p_reference_no: referenceNo.trim(),
    });

    if (error) {
      setMessage(error.message);
      setSubmitting(false);
      return;
    }

    setMessage("Membership payment submitted. Waiting for admin approval.");
    setReferenceNo("");
    await loadMembership();
    setSubmitting(false);
  }

  const activeNumber = useMemo(() => {
    if (paymentMethod === "MAYA") return settings?.maya_number || "No Maya number set";
    return settings?.gcash_number || "No GCash number set";
  }, [paymentMethod, settings]);

  const activeName = useMemo(() => {
    if (paymentMethod === "MAYA") return settings?.maya_name || "FarmConnect";
    return settings?.gcash_name || "FarmConnect";
  }, [paymentMethod, settings]);

  const hasPendingPayment = payments.some(
    (payment) => String(payment.status || "").toUpperCase() === "PENDING"
  );

  return (
    <main className={`${shellClass} p-4 pb-28 md:p-8`}>
      <div className="mx-auto max-w-6xl">
        <section className="rounded-[36px] border border-emerald-300/20 bg-white/10 p-7 text-white shadow-2xl shadow-black/20 backdrop-blur-xl">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="w-fit rounded-full bg-amber-300 px-4 py-2 text-sm font-black text-emerald-950">
                FarmConnect Membership
              </p>
              <h1 className="mt-4 text-5xl font-black leading-tight">
                Annual investor access.
              </h1>
              <p className="mt-2 max-w-3xl font-semibold text-emerald-50">
                Submit payment reference through the production RPC. Admin verifies payment before activation.
              </p>
            </div>

            <Link
              href="/customer/dashboard"
              className="rounded-full bg-white px-5 py-3 text-center font-black text-emerald-950"
            >
              Dashboard
            </Link>
          </div>
        </section>

        {message && (
          <div className="mt-5 rounded-2xl border border-emerald-100 bg-white p-4 font-black text-emerald-800 shadow-xl">
            {message}
          </div>
        )}

        {loading ? (
          <div className="mt-6 rounded-[32px] bg-white p-8 text-center font-black text-emerald-800 shadow-2xl">
            Loading membership center...
          </div>
        ) : (
          <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_410px]">
            <div className="space-y-6">
              <article className="rounded-[32px] bg-white p-6 shadow-2xl">
                <p className="text-sm font-black uppercase tracking-[0.18em] text-emerald-700">
                  Current Account
                </p>
                <h2 className="mt-1 text-3xl font-black text-emerald-950">
                  {profile?.full_name || profile?.email || "Customer"}
                </h2>

                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  <Status label="Membership" value={profile?.membership_status || "UNPAID"} />
                  <Status label="KYC" value={profile?.verification_status || "PENDING"} />
                  <Status label="Account" value={profile?.account_status || "PENDING"} />
                </div>
              </article>

              <article className="rounded-[32px] bg-white p-6 shadow-2xl">
                <div className="rounded-[28px] bg-gradient-to-br from-emerald-900 to-emerald-700 p-6 text-white">
                  <p className="font-bold text-emerald-100">Annual Fee</p>
                  <h2 className="mt-2 text-5xl font-black">{money(MEMBERSHIP_FEE)}</h2>
                  <p className="mt-2 font-semibold text-emerald-100">
                    Valid for one year after admin approval.
                  </p>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <button
                    onClick={() => setPaymentMethod("GCASH")}
                    className={`rounded-3xl border p-5 text-left ${
                      paymentMethod === "GCASH" ? "border-emerald-700 bg-emerald-50" : "border-slate-200 bg-white"
                    }`}
                  >
                    <p className="font-black text-emerald-950">GCash</p>
                    <p className="mt-1 text-2xl font-black text-emerald-700">
                      {settings?.gcash_number || "Not set"}
                    </p>
                    <p className="text-sm font-bold text-slate-500">
                      {settings?.gcash_name || "FarmConnect"}
                    </p>
                  </button>

                  <button
                    onClick={() => setPaymentMethod("MAYA")}
                    className={`rounded-3xl border p-5 text-left ${
                      paymentMethod === "MAYA" ? "border-emerald-700 bg-emerald-50" : "border-slate-200 bg-white"
                    }`}
                  >
                    <p className="font-black text-emerald-950">Maya</p>
                    <p className="mt-1 text-2xl font-black text-emerald-700">
                      {settings?.maya_number || "Not set"}
                    </p>
                    <p className="text-sm font-bold text-slate-500">
                      {settings?.maya_name || "FarmConnect"}
                    </p>
                  </button>
                </div>

                <div className="mt-5 rounded-3xl bg-amber-50 p-5">
                  <p className="font-black text-amber-900">Payment Instructions</p>
                  <p className="mt-2 text-sm font-bold leading-6 text-slate-700">
                    Send exactly {money(MEMBERSHIP_FEE)} to {activeName} using {paymentMethod} number {activeNumber}.
                    After payment, enter your reference number below.
                  </p>
                </div>

                <input
                  value={referenceNo}
                  onChange={(event) => setReferenceNo(event.target.value)}
                  placeholder={`${paymentMethod} reference number`}
                  className="mt-5 w-full rounded-2xl border border-slate-200 p-4 font-bold outline-none focus:border-emerald-600"
                />

                <button
                  onClick={submitMembershipPayment}
                  disabled={submitting || !profile || hasPendingPayment}
                  className="mt-4 w-full rounded-2xl bg-emerald-700 p-4 font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
                >
                  {hasPendingPayment
                    ? "Pending Payment Exists"
                    : submitting
                      ? "Submitting..."
                      : "Submit Membership Payment"}
                </button>
              </article>
            </div>

            <aside className="rounded-[32px] bg-white p-6 shadow-2xl">
              <p className="text-sm font-black uppercase tracking-[0.18em] text-emerald-700">
                Payment History
              </p>
              <h2 className="mt-1 text-3xl font-black text-emerald-950">
                Admin review timeline
              </h2>

              {payments.length === 0 ? (
                <div className="mt-6 rounded-3xl bg-slate-50 p-6 text-center font-bold text-slate-500">
                  No membership payment submitted yet.
                </div>
              ) : (
                <div className="mt-5 space-y-3">
                  {payments.map((payment) => (
                    <article key={payment.id} className="rounded-3xl border border-slate-100 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-black text-emerald-950">
                            {payment.payment_method || "Payment"}
                          </h3>
                          <p className="text-sm font-bold text-slate-500">
                            {payment.reference_no || "No reference"} • {dateText(payment.created_at)}
                          </p>
                        </div>
                        <p className="font-black text-emerald-700">{money(payment.amount)}</p>
                      </div>
                      <span className={`mt-3 inline-block rounded-full border px-3 py-1 text-xs font-black ${statusPill(payment.status)}`}>
                        {payment.status || "PENDING"}
                      </span>
                      {payment.admin_notes && (
                        <p className="mt-3 rounded-2xl bg-slate-50 p-3 text-sm font-bold text-slate-600">
                          {payment.admin_notes}
                        </p>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </aside>
          </section>
        )}
      </div>
    </main>
  );
}

function Status({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl bg-emerald-50 p-4">
      <p className="text-sm font-bold text-slate-500">{label}</p>
      <span className={`mt-2 inline-block rounded-full border px-3 py-1 text-xs font-black ${statusPill(value)}`}>
        {value}
      </span>
    </div>
  );
}
