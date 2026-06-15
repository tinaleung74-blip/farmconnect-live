"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  verification_status: string | null;
  membership_status: string | null;
  membership_expiry: string | null;
  account_status: string | null;
};

type PaymentSettings = {
  id: string;
  gcash_number: string | null;
  maya_number: string | null;
  gcash_name: string | null;
  maya_name: string | null;
};

type MembershipPayment = {
  id: string;
  profile_id: string;
  amount: number;
  payment_method: string | null;
  reference_no: string | null;
  status: string;
  admin_notes: string | null;
  created_at: string;
  approved_at: string | null;
};

const MEMBERSHIP_FEE = 999;

export default function CustomerMembershipPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [paymentSettings, setPaymentSettings] =
    useState<PaymentSettings | null>(null);
  const [payments, setPayments] = useState<MembershipPayment[]>([]);
  const [paymentMethod, setPaymentMethod] = useState("GCASH");
  const [referenceNo, setReferenceNo] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  function getProfileId() {
    if (typeof window === "undefined") return "";

    const directId =
      localStorage.getItem("farmconnect_profile_id") ||
      localStorage.getItem("profile_id") ||
      localStorage.getItem("customer_id") ||
      "";

    const rawUser = localStorage.getItem("farmconnect_user");

    if (directId) return directId;

    if (rawUser) {
      try {
        const parsed = JSON.parse(rawUser);
        return parsed?.id || parsed?.profile_id || parsed?.customer_id || "";
      } catch {
        return "";
      }
    }

    return "";
  }

  async function loadMembership() {
    setLoading(true);

    const profileId = getProfileId();

    if (!profileId) {
      setLoading(false);
      return;
    }

    const { data: profileData } = await supabase
      .from("profiles")
      .select(
        "id,full_name,email,phone,verification_status,membership_status,membership_expiry,account_status"
      )
      .eq("id", profileId)
      .maybeSingle();

    const { data: settingsData } = await supabase
      .from("payment_settings")
      .select("*")
      .limit(1)
      .maybeSingle();

    const { data: paymentData } = await supabase
      .from("membership_payments")
      .select("*")
      .eq("profile_id", profileId)
      .order("created_at", { ascending: false })
      .limit(20);

    setProfile((profileData || null) as Profile | null);
    setPaymentSettings((settingsData || null) as PaymentSettings | null);
    setPayments((paymentData || []) as MembershipPayment[]);

    setLoading(false);
  }

  useEffect(() => {
    loadMembership();
  }, []);

  async function submitMembershipPayment() {
    if (!profile) {
      alert("Please login first.");
      return;
    }

    if (!referenceNo.trim()) {
      alert("Please enter your GCash/Maya reference number.");
      return;
    }

    const pendingPayment = payments.find(
      (payment) => (payment.status || "").toUpperCase() === "PENDING"
    );

    if (pendingPayment) {
      alert("You already have a pending membership payment for admin review.");
      return;
    }

    setSubmitting(true);

    const { error } = await supabase.from("membership_payments").insert({
      profile_id: profile.id,
      amount: MEMBERSHIP_FEE,
      payment_method: paymentMethod,
      reference_no: referenceNo.trim(),
      status: "PENDING",
    });

    if (error) {
      alert(error.message);
      setSubmitting(false);
      return;
    }

    await supabase.from("wallet_transactions").insert({
      profile_id: profile.id,
      transaction_type: "MEMBERSHIP_PAYMENT_SUBMITTED",
      amount: MEMBERSHIP_FEE,
      reference_no: referenceNo.trim(),
      remarks: `Annual Investor Membership payment submitted via ${paymentMethod}. Waiting for admin approval.`,
      status: "PENDING",
    });

    alert("Membership payment submitted. Waiting for admin approval.");
    setReferenceNo("");
    await loadMembership();
    setSubmitting(false);
  }

  function formatPeso(amount: number) {
    return Number(amount || 0).toLocaleString("en-PH", {
      style: "currency",
      currency: "PHP",
      maximumFractionDigits: 0,
    });
  }

  function statusColor(status: string | null | undefined) {
    const cleanStatus = (status || "PENDING").toUpperCase();

    if (cleanStatus === "ACTIVE" || cleanStatus === "APPROVED") {
      return "bg-green-100 text-green-800";
    }

    if (cleanStatus === "REJECTED" || cleanStatus === "EXPIRED") {
      return "bg-red-100 text-red-800";
    }

    return "bg-yellow-100 text-yellow-800";
  }

  const gcashNumber = paymentSettings?.gcash_number || "09288985979";
  const mayaNumber = paymentSettings?.maya_number || "09498387452";
  const gcashName = paymentSettings?.gcash_name || "FarmConnect";
  const mayaName = paymentSettings?.maya_name || "FarmConnect";

  const selectedNumber = paymentMethod === "GCASH" ? gcashNumber : mayaNumber;
  const selectedName = paymentMethod === "GCASH" ? gcashName : mayaName;

  const qrValue = `${paymentMethod} PAYMENT\nAccount Name: ${selectedName}\nNumber: ${selectedNumber}\nAmount: ${MEMBERSHIP_FEE}\nPurpose: FarmConnect Annual Investor Membership`;

  return (
    <main className="min-h-screen bg-gradient-to-br from-green-50 via-white to-yellow-50 p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="w-fit rounded-full bg-green-100 px-4 py-2 text-sm font-black text-green-700">
              🌾 FarmConnect Membership
            </p>
            <h1 className="mt-3 text-4xl font-black text-green-950">
              Annual Investor Membership
            </h1>
            <p className="mt-2 max-w-3xl font-semibold text-slate-600">
              Pay your annual membership fee to unlock full FarmConnect access.
              Admin will verify your GCash/Maya payment before activation.
            </p>
          </div>

          <Link
            href="/customer/dashboard"
            className="rounded-2xl bg-green-700 px-5 py-3 text-center font-black text-white"
          >
            Back to Dashboard
          </Link>
        </div>

        {loading ? (
          <div className="rounded-3xl bg-white p-8 text-center font-black shadow">
            Loading membership center...
          </div>
        ) : (
          <>
            <section className="mb-6 grid gap-4 md:grid-cols-4">
              <div className="rounded-3xl border bg-white p-5 shadow">
                <p className="font-bold text-slate-500">Customer</p>
                <h2 className="mt-1 text-xl font-black text-green-950">
                  {profile?.full_name || "FarmConnect Customer"}
                </h2>
              </div>

              <div className="rounded-3xl border bg-white p-5 shadow">
                <p className="font-bold text-slate-500">Membership Status</p>
                <span
                  className={`mt-2 inline-block rounded-full px-4 py-2 text-sm font-black ${statusColor(
                    profile?.membership_status
                  )}`}
                >
                  {profile?.membership_status || "UNPAID"}
                </span>
              </div>

              <div className="rounded-3xl border bg-white p-5 shadow">
                <p className="font-bold text-slate-500">KYC Status</p>
                <span
                  className={`mt-2 inline-block rounded-full px-4 py-2 text-sm font-black ${statusColor(
                    profile?.verification_status
                  )}`}
                >
                  {profile?.verification_status || "PENDING"}
                </span>
              </div>

              <div className="rounded-3xl border bg-white p-5 shadow">
                <p className="font-bold text-slate-500">Account Status</p>
                <span
                  className={`mt-2 inline-block rounded-full px-4 py-2 text-sm font-black ${statusColor(
                    profile?.account_status
                  )}`}
                >
                  {profile?.account_status || "PENDING_MEMBERSHIP"}
                </span>
              </div>
            </section>

            <section className="grid gap-6 lg:grid-cols-[1fr_420px]">
              <div className="rounded-3xl border bg-white p-6 shadow-xl">
                <h2 className="text-2xl font-black text-green-950">
                  Membership Payment
                </h2>

                <div className="mt-4 rounded-3xl bg-green-50 p-5">
                  <p className="font-bold text-slate-500">Annual Fee</p>
                  <h3 className="text-4xl font-black text-green-800">
                    {formatPeso(MEMBERSHIP_FEE)}
                  </h3>
                  <p className="mt-2 text-sm font-semibold text-slate-600">
                    Valid for 1 year after admin approval.
                  </p>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <div className="rounded-3xl bg-slate-50 p-5">
                    <p className="font-black text-slate-700">GCash</p>
                    <p className="mt-1 text-2xl font-black text-green-800">
                      {gcashNumber}
                    </p>
                    <p className="text-sm text-slate-500">
                      Account Name: {gcashName}
                    </p>
                  </div>

                  <div className="rounded-3xl bg-slate-50 p-5">
                    <p className="font-black text-slate-700">Maya</p>
                    <p className="mt-1 text-2xl font-black text-green-800">
                      {mayaNumber}
                    </p>
                    <p className="text-sm text-slate-500">
                      Account Name: {mayaName}
                    </p>
                  </div>
                </div>

                <div className="mt-5 rounded-3xl bg-yellow-50 p-5">
                  <p className="font-black text-yellow-900">
                    Payment Instructions
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-700">
                    Send exactly {formatPeso(MEMBERSHIP_FEE)} using GCash or
                    Maya. After payment, enter the reference number below.
                    Admin will verify the receipt manually.
                  </p>
                </div>

                <div className="mt-5 grid gap-4">
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="rounded-2xl border p-4 font-bold"
                  >
                    <option value="GCASH">GCash</option>
                    <option value="MAYA">Maya</option>
                  </select>

                  <input
                    value={referenceNo}
                    onChange={(e) => setReferenceNo(e.target.value)}
                    placeholder="Enter GCash/Maya reference number"
                    className="rounded-2xl border p-4 font-bold"
                  />

                  <button
                    onClick={submitMembershipPayment}
                    disabled={submitting}
                    className="rounded-2xl bg-green-700 p-4 font-black text-white disabled:bg-slate-400"
                  >
                    {submitting
                      ? "Submitting..."
                      : "Submit Membership Payment"}
                  </button>
                </div>
              </div>

              <aside className="rounded-3xl border bg-white p-6 shadow-xl">
                <h2 className="text-2xl font-black text-green-950">
                  Payment QR
                </h2>

                <div className="mt-5 flex justify-center rounded-3xl bg-slate-50 p-6">
                  <QRCodeCanvas value={qrValue} size={230} />
                </div>

                <div className="mt-5 rounded-3xl bg-green-50 p-5">
                  <p className="font-bold text-slate-500">Selected Method</p>
                  <h3 className="mt-1 text-2xl font-black text-green-800">
                    {paymentMethod}
                  </h3>
                  <p className="mt-2 font-bold text-slate-700">
                    {selectedNumber}
                  </p>
                  <p className="text-sm text-slate-500">{selectedName}</p>
                </div>
              </aside>

              <div className="rounded-3xl border bg-white p-6 shadow-xl lg:col-span-2">
                <h2 className="mb-4 text-2xl font-black text-green-950">
                  Membership Payment History
                </h2>

                {payments.length === 0 ? (
                  <p className="text-slate-500">
                    No membership payment submitted yet.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-green-50 text-green-900">
                        <tr>
                          <th className="p-3 text-left">Date</th>
                          <th className="p-3 text-left">Method</th>
                          <th className="p-3 text-left">Reference</th>
                          <th className="p-3 text-left">Amount</th>
                          <th className="p-3 text-left">Status</th>
                          <th className="p-3 text-left">Admin Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payments.map((payment) => (
                          <tr key={payment.id} className="border-t">
                            <td className="p-3 font-bold">
                              {new Date(payment.created_at).toLocaleString()}
                            </td>
                            <td className="p-3">{payment.payment_method}</td>
                            <td className="p-3">{payment.reference_no}</td>
                            <td className="p-3">
                              {formatPeso(Number(payment.amount || 0))}
                            </td>
                            <td className="p-3">
                              <span
                                className={`rounded-full px-3 py-1 text-xs font-black ${statusColor(
                                  payment.status
                                )}`}
                              >
                                {payment.status}
                              </span>
                            </td>
                            <td className="p-3">
                              {payment.admin_notes || "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}