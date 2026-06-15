"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type MembershipPayment = {
  id: string;
  profile_id: string;
  amount: number | string | null;
  payment_method: string | null;
  reference_no: string | null;
  proof_url: string | null;
  status: string | null;
  admin_notes: string | null;
  created_at: string | null;
  approved_at: string | null;
};

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

const MEMBERSHIP_FEE = 999;

export default function AdminMembershipsPage() {
  const [payments, setPayments] = useState<MembershipPayment[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("ALL");

  useEffect(() => {
    loadMemberships();
  }, []);

  async function loadMemberships() {
    setLoading(true);

    const { data: paymentData, error: paymentError } = await supabase
      .from("membership_payments")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select(
        "id,full_name,email,phone,verification_status,membership_status,membership_expiry,account_status"
      );

    if (paymentError) {
      alert(`Membership payment load error: ${paymentError.message}`);
      setPayments([]);
    } else {
      setPayments((paymentData || []) as MembershipPayment[]);
    }

    if (profileError) {
      alert(`Profile load error: ${profileError.message}`);
      setProfiles([]);
    } else {
      setProfiles((profileData || []) as Profile[]);
    }

    setLoading(false);
  }

  function getProfile(profileId: string) {
    return profiles.find((profile) => profile.id === profileId) || null;
  }

  async function approvePayment(payment: MembershipPayment) {
    const currentStatus = clean(payment.status || "PENDING");

    if (currentStatus === "APPROVED") {
      alert("This membership payment is already approved.");
      return;
    }

    if (currentStatus === "REJECTED") {
      alert("Rejected membership payments cannot be approved again.");
      return;
    }

    const profile = getProfile(payment.profile_id);

    if (!profile) {
      alert("Customer profile not found.");
      return;
    }

    const amount = Number(payment.amount || MEMBERSHIP_FEE);
    const expiry = new Date();
    expiry.setFullYear(expiry.getFullYear() + 1);

    const nextAccountStatus =
      clean(profile.verification_status) === "APPROVED"
        ? "ACTIVE"
        : "PENDING_KYC";

    const ok = confirm(
      `Approve membership payment?\n\nCustomer: ${
        profile.full_name || profile.email || payment.profile_id
      }\nAmount: ${formatPeso(amount)}\nReference: ${
        payment.reference_no || payment.id
      }\n\nMembership will be active for 1 year.`
    );

    if (!ok) return;

    setProcessingId(payment.id);

    try {
      const { error: paymentError } = await supabase
        .from("membership_payments")
        .update({
          status: "APPROVED",
          admin_notes: "Membership payment approved by FarmConnect Admin.",
          approved_at: new Date().toISOString(),
        })
        .eq("id", payment.id);

      if (paymentError) throw paymentError;

      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          membership_plan: "ANNUAL INVESTOR MEMBERSHIP",
          membership_fee: amount,
          membership_status: "ACTIVE",
          membership_expiry: expiry.toISOString().slice(0, 10),
          account_status: nextAccountStatus,
        })
        .eq("id", payment.profile_id);

      if (profileError) throw profileError;

      await supabase.from("wallet_transactions").insert({
        profile_id: payment.profile_id,
        transaction_type: "MEMBERSHIP_PAYMENT_APPROVED",
        amount,
        reference_no: payment.reference_no || `FC-MEMBER-${payment.id}`,
        remarks: `Annual Investor Membership approved. Valid until ${expiry
          .toISOString()
          .slice(0, 10)}.`,
        status: "COMPLETED",
      });

      alert("Membership approved successfully.");
      await loadMemberships();
    } catch (err: any) {
      alert(err?.message || "Membership approval failed.");
    } finally {
      setProcessingId("");
    }
  }

  async function rejectPayment(payment: MembershipPayment) {
    const currentStatus = clean(payment.status || "PENDING");

    if (currentStatus === "REJECTED") {
      alert("This membership payment is already rejected.");
      return;
    }

    if (currentStatus === "APPROVED") {
      alert("Approved membership payment cannot be rejected.");
      return;
    }

    const ok = confirm("Reject this membership payment?");
    if (!ok) return;

    setProcessingId(payment.id);

    try {
      const { error: paymentError } = await supabase
        .from("membership_payments")
        .update({
          status: "REJECTED",
          admin_notes:
            "Membership payment rejected by FarmConnect Admin. Customer must submit a valid reference.",
        })
        .eq("id", payment.id);

      if (paymentError) throw paymentError;

      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          membership_status: "UNPAID",
          account_status: "PENDING_MEMBERSHIP",
        })
        .eq("id", payment.profile_id);

      if (profileError) throw profileError;

      await supabase.from("wallet_transactions").insert({
        profile_id: payment.profile_id,
        transaction_type: "MEMBERSHIP_PAYMENT_REJECTED",
        amount: 0,
        reference_no: payment.reference_no || `FC-MEMBER-REJECT-${payment.id}`,
        remarks:
          "Annual Investor Membership payment rejected. No membership activation applied.",
        status: "REJECTED",
      });

      alert("Membership payment rejected.");
      await loadMemberships();
    } catch (err: any) {
      alert(err?.message || "Membership rejection failed.");
    } finally {
      setProcessingId("");
    }
  }

  const summary = useMemo(() => {
    const pending = payments.filter((p) => clean(p.status) === "PENDING");
    const approved = payments.filter((p) => clean(p.status) === "APPROVED");
    const rejected = payments.filter((p) => clean(p.status) === "REJECTED");

    return {
      total: payments.length,
      pending: pending.length,
      approved: approved.length,
      rejected: rejected.length,
      pendingAmount: pending.reduce((sum, p) => sum + Number(p.amount || 0), 0),
      approvedAmount: approved.reduce(
        (sum, p) => sum + Number(p.amount || 0),
        0
      ),
    };
  }, [payments]);

  const filteredPayments = useMemo(() => {
    return payments.filter((payment) => {
      const profile = getProfile(payment.profile_id);
      const keyword = search.toLowerCase();

      const text = `
        ${payment.id}
        ${payment.profile_id}
        ${payment.payment_method || ""}
        ${payment.reference_no || ""}
        ${payment.status || ""}
        ${profile?.full_name || ""}
        ${profile?.email || ""}
        ${profile?.phone || ""}
      `.toLowerCase();

      const matchSearch = text.includes(keyword);
      const matchFilter = filter === "ALL" || clean(payment.status) === filter;

      return matchSearch && matchFilter;
    });
  }, [payments, profiles, search, filter]);

  function formatPeso(amount: number) {
    return Number(amount || 0).toLocaleString("en-PH", {
      style: "currency",
      currency: "PHP",
      maximumFractionDigits: 0,
    });
  }

  function statusClass(status: string | null | undefined) {
    const cleanStatus = clean(status || "PENDING");

    if (cleanStatus === "APPROVED") {
      return "bg-green-100 text-green-800";
    }

    if (cleanStatus === "REJECTED") {
      return "bg-red-100 text-red-800";
    }

    return "bg-yellow-100 text-yellow-800";
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-green-50 via-white to-yellow-50 p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="w-fit rounded-full bg-green-100 px-4 py-2 text-sm font-black text-green-700">
              FarmConnect Admin V26.6
            </p>
            <h1 className="mt-3 text-4xl font-black text-green-950">
              Membership Approval Center
            </h1>
            <p className="mt-2 max-w-3xl font-semibold text-slate-600">
              Verify Annual Investor Membership payments. Approval activates
              membership for one year and unlocks account access after KYC.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={loadMemberships}
              className="rounded-2xl bg-green-700 px-5 py-3 font-black text-white"
            >
              Refresh
            </button>

            <Link
              href="/admin/customers"
              className="rounded-2xl bg-white px-5 py-3 font-black text-green-700 shadow"
            >
              Customers
            </Link>

            <Link
              href="/admin"
              className="rounded-2xl bg-white px-5 py-3 font-black text-green-700 shadow"
            >
              Admin Dashboard
            </Link>
          </div>
        </div>

        <section className="mb-6 grid gap-4 md:grid-cols-3 lg:grid-cols-6">
          <div className="rounded-3xl border bg-white p-5 shadow">
            <p className="font-bold text-slate-500">Total Payments</p>
            <h2 className="mt-1 text-3xl font-black text-green-950">
              {summary.total}
            </h2>
          </div>

          <div className="rounded-3xl border bg-white p-5 shadow">
            <p className="font-bold text-slate-500">Pending</p>
            <h2 className="mt-1 text-3xl font-black text-yellow-600">
              {summary.pending}
            </h2>
          </div>

          <div className="rounded-3xl border bg-white p-5 shadow">
            <p className="font-bold text-slate-500">Approved</p>
            <h2 className="mt-1 text-3xl font-black text-green-700">
              {summary.approved}
            </h2>
          </div>

          <div className="rounded-3xl border bg-white p-5 shadow">
            <p className="font-bold text-slate-500">Rejected</p>
            <h2 className="mt-1 text-3xl font-black text-red-600">
              {summary.rejected}
            </h2>
          </div>

          <div className="rounded-3xl border bg-white p-5 shadow">
            <p className="font-bold text-slate-500">Pending Amount</p>
            <h2 className="mt-1 text-2xl font-black text-yellow-700">
              {formatPeso(summary.pendingAmount)}
            </h2>
          </div>

          <div className="rounded-3xl border bg-white p-5 shadow">
            <p className="font-bold text-slate-500">Approved Revenue</p>
            <h2 className="mt-1 text-2xl font-black text-green-700">
              {formatPeso(summary.approvedAmount)}
            </h2>
          </div>
        </section>

        <section className="mb-6 rounded-3xl border bg-white p-5 shadow">
          <div className="grid gap-4 md:grid-cols-[1fr_220px]">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search customer name, email, phone, reference, profile ID..."
              className="rounded-2xl border p-4 font-bold"
            />

            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="rounded-2xl border p-4 font-bold"
            >
              <option value="ALL">All Status</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>
        </section>

        <section className="rounded-3xl border bg-white p-6 shadow-xl">
          <h2 className="mb-4 text-2xl font-black text-green-950">
            Membership Payment Queue
          </h2>

          {loading ? (
            <div className="rounded-2xl bg-slate-50 p-8 text-center font-black">
              Loading membership payments...
            </div>
          ) : filteredPayments.length === 0 ? (
            <div className="rounded-2xl bg-slate-50 p-8 text-center">
              <h3 className="text-xl font-black">No membership payments found.</h3>
              <p className="mt-1 text-slate-500">
                Customer membership payments will appear here after submission.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-sm">
                <thead className="bg-green-50 text-green-900">
                  <tr>
                    <th className="p-3 text-left">Date</th>
                    <th className="p-3 text-left">Customer</th>
                    <th className="p-3 text-left">Profile ID</th>
                    <th className="p-3 text-left">Method</th>
                    <th className="p-3 text-left">Reference</th>
                    <th className="p-3 text-left">Amount</th>
                    <th className="p-3 text-left">KYC</th>
                    <th className="p-3 text-left">Account</th>
                    <th className="p-3 text-left">Payment Status</th>
                    <th className="p-3 text-left">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredPayments.map((payment) => {
                    const profile = getProfile(payment.profile_id);
                    const currentStatus = clean(payment.status || "PENDING");
                    const busy = processingId === payment.id;

                    return (
                      <tr key={payment.id} className="border-t">
                        <td className="p-3 font-bold">
                          {payment.created_at
                            ? new Date(payment.created_at).toLocaleString()
                            : "—"}
                        </td>

                        <td className="p-3">
                          <p className="font-black text-slate-900">
                            {profile?.full_name || "Unknown Customer"}
                          </p>
                          <p className="text-xs text-slate-500">
                            {profile?.email || "No email"}
                          </p>
                          <p className="text-xs text-slate-500">
                            {profile?.phone || "No phone"}
                          </p>
                        </td>

                        <td className="p-3">
                          <span className="font-mono text-xs">
                            {payment.profile_id}
                          </span>
                        </td>

                        <td className="p-3 font-bold">
                          {payment.payment_method || "GCash/Maya"}
                        </td>

                        <td className="p-3">
                          {payment.reference_no || payment.id}
                        </td>

                        <td className="p-3 font-black text-green-700">
                          {formatPeso(Number(payment.amount || 0))}
                        </td>

                        <td className="p-3">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-black ${statusClass(
                              profile?.verification_status || "PENDING"
                            )}`}
                          >
                            {profile?.verification_status || "PENDING"}
                          </span>
                        </td>

                        <td className="p-3">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-black ${statusClass(
                              profile?.account_status || "PENDING"
                            )}`}
                          >
                            {profile?.account_status || "PENDING"}
                          </span>
                        </td>

                        <td className="p-3">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-black ${statusClass(
                              currentStatus
                            )}`}
                          >
                            {currentStatus}
                          </span>
                        </td>

                        <td className="p-3">
                          {currentStatus === "PENDING" ? (
                            <div className="flex gap-2">
                              <button
                                onClick={() => approvePayment(payment)}
                                disabled={busy}
                                className="rounded-xl bg-green-700 px-4 py-2 font-black text-white disabled:bg-slate-400"
                              >
                                {busy ? "Processing..." : "Approve"}
                              </button>

                              <button
                                onClick={() => rejectPayment(payment)}
                                disabled={busy}
                                className="rounded-xl bg-red-600 px-4 py-2 font-black text-white disabled:bg-slate-400"
                              >
                                {busy ? "Processing..." : "Reject"}
                              </button>
                            </div>
                          ) : (
                            <span className="font-bold text-slate-400">
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

function clean(value?: string | null) {
  return String(value || "").toUpperCase();
}