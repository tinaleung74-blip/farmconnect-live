"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Customer = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  wallet_balance: number | null;

  id_type: string | null;
  id_number: string | null;
  id_front_url: string | null;
  selfie_url: string | null;
  verification_status: string | null;
  verification_notes: string | null;

  membership_plan: string | null;
  membership_fee: number | null;
  membership_status: string | null;
  membership_expiry: string | null;

  account_status: string | null;
};

export default function AdminCustomerDetailPage() {
  const params = useParams();
  const router = useRouter();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [rejectReason, setRejectReason] = useState("ID Photo Blurry");
  const [adminNote, setAdminNote] = useState("");

  useEffect(() => {
    loadCustomer();
  }, []);

  async function loadCustomer() {
    setLoading(true);

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", params.id)
      .single();

    if (!error && data) {
      setCustomer(data as Customer);
      setAdminNote(data.verification_notes || "");
    }

    setLoading(false);
  }

  async function approveKyc() {
    if (!customer) return;

    setSaving(true);

    await supabase
      .from("profiles")
      .update({
        verification_status: "APPROVED",
        verification_notes: "Your identity verification has been approved.",
        account_status: "VERIFIED",
      })
      .eq("id", customer.id);

    await loadCustomer();
    setSaving(false);
  }

  async function rejectKyc() {
    if (!customer) return;

    setSaving(true);

    const finalNote = adminNote.trim()
      ? `${rejectReason}: ${adminNote.trim()}`
      : rejectReason;

    await supabase
      .from("profiles")
      .update({
        verification_status: "REJECTED",
        verification_notes: finalNote,
        account_status: "REJECTED",
      })
      .eq("id", customer.id);

    await loadCustomer();
    setSaving(false);
  }

  async function resetPending() {
    if (!customer) return;

    setSaving(true);

    await supabase
      .from("profiles")
      .update({
        verification_status: "PENDING",
        verification_notes: "Your verification is under review.",
        account_status: "PENDING",
      })
      .eq("id", customer.id);

    await loadCustomer();
    setSaving(false);
  }

  if (loading) {
    return (
      <main style={page}>
        <h1>Loading customer...</h1>
      </main>
    );
  }

  if (!customer) {
    return (
      <main style={page}>
        <h1>Customer not found</h1>
        <button style={backButton} onClick={() => router.push("/admin/customers")}>
          Back to Customers
        </button>
      </main>
    );
  }

  return (
    <main style={page}>
      <div style={container}>
        <button style={backButton} onClick={() => router.push("/admin/customers")}>
          ← Back to Customers
        </button>

        <div style={header}>
          <div>
            <p style={eyebrow}>ADMIN CUSTOMER REVIEW</p>
            <h1 style={title}>{customer.full_name || "Unnamed Customer"}</h1>
            <p style={subtitle}>
              Review KYC documents, membership status, and account activation.
            </p>
          </div>

          <div style={statusPanel}>
            <Status label="KYC" value={customer.verification_status || "PENDING"} />
            <Status label="Membership" value={customer.membership_status || "UNPAID"} />
            <Status label="Account" value={customer.account_status || "PENDING"} />
          </div>
        </div>

        <div style={grid}>
          <section style={card}>
            <h2 style={sectionTitle}>Customer Information</h2>

            <Info label="Full Name" value={customer.full_name} />
            <Info label="Email" value={customer.email} />
            <Info label="Phone" value={customer.phone} />
            <Info
              label="Wallet Balance"
              value={`₱${Number(customer.wallet_balance || 0).toLocaleString()}`}
            />
          </section>

          <section style={card}>
            <h2 style={sectionTitle}>KYC Information</h2>

            <Info label="ID Type" value={customer.id_type} />
            <Info label="ID Number" value={customer.id_number} />
            <Info label="ID Photo Status" value={customer.id_front_url || "No upload"} />
            <Info label="Selfie Status" value={customer.selfie_url || "No selfie"} />
            <Info
              label="Verification Status"
              value={customer.verification_status || "PENDING"}
            />
            <Info label="Verification Notes" value={customer.verification_notes} />
          </section>

          <section style={card}>
            <h2 style={sectionTitle}>Membership Information</h2>

            <Info
              label="Membership Plan"
              value={customer.membership_plan || "ANNUAL INVESTOR MEMBERSHIP"}
            />
            <Info
              label="Annual Fee"
              value={`₱${Number(customer.membership_fee || 999).toLocaleString()}`}
            />
            <Info
              label="Membership Status"
              value={customer.membership_status || "UNPAID"}
            />
            <Info label="Membership Expiry" value={customer.membership_expiry || "-"} />
          </section>

          <section style={actionCard}>
            <h2 style={sectionTitle}>KYC Review Actions</h2>

            <div style={approvalBox}>
              <h3>Approve Customer KYC</h3>
              <p>
                This will mark the customer as verified. Membership remains unpaid
                until the ₱999 Annual Investor Membership payment is completed.
              </p>

              <button style={approveButton} onClick={approveKyc} disabled={saving}>
                ✅ Approve KYC
              </button>
            </div>

            <div style={rejectBox}>
              <h3>Reject Customer KYC</h3>

              <label style={label}>Rejection Reason</label>
              <select
                style={input}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              >
                <option>ID Photo Blurry</option>
                <option>Selfie Blurry</option>
                <option>Expired ID</option>
                <option>Information Mismatch</option>
                <option>Duplicate Account</option>
                <option>Incomplete Submission</option>
                <option>Other</option>
              </select>

              <label style={label}>Admin Notes</label>
              <textarea
                style={textarea}
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                placeholder="Example: Please upload a clearer ID photo."
              />

              <button style={rejectButton} onClick={rejectKyc} disabled={saving}>
                ❌ Reject KYC
              </button>
            </div>

            <button style={pendingButton} onClick={resetPending} disabled={saving}>
              🔄 Reset to Pending Review
            </button>
          </section>
        </div>
      </div>
    </main>
  );
}

function Info({ label, value }: { label: string; value: any }) {
  return (
    <div style={infoRow}>
      <span>{label}</span>
      <b>{value || "-"}</b>
    </div>
  );
}

function Status({ label, value }: { label: string; value: string }) {
  return (
    <div style={statusBox}>
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

const page: React.CSSProperties = {
  minHeight: "100vh",
  background: "linear-gradient(135deg, #f8fafc, #ecfdf5, #eff6ff)",
  padding: 24,
  color: "#0f172a",
};

const container: React.CSSProperties = {
  maxWidth: 1250,
  margin: "0 auto",
};

const backButton: React.CSSProperties = {
  border: "none",
  background: "#0f172a",
  color: "white",
  padding: "12px 16px",
  borderRadius: 14,
  cursor: "pointer",
  fontWeight: 900,
  marginBottom: 20,
};

const header: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 20,
  alignItems: "flex-start",
  marginBottom: 24,
};

const eyebrow: React.CSSProperties = {
  color: "#2563eb",
  fontWeight: 950,
  letterSpacing: 1,
  fontSize: 12,
};

const title: React.CSSProperties = {
  fontSize: 42,
  fontWeight: 950,
  margin: 0,
};

const subtitle: React.CSSProperties = {
  color: "#475569",
  fontSize: 16,
};

const statusPanel: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr",
  gap: 10,
  minWidth: 240,
};

const statusBox: React.CSSProperties = {
  background: "white",
  border: "1px solid #e2e8f0",
  borderRadius: 18,
  padding: 14,
  boxShadow: "0 15px 35px rgba(15,23,42,0.08)",
};

const grid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 20,
};

const card: React.CSSProperties = {
  background: "white",
  border: "1px solid #e2e8f0",
  borderRadius: 26,
  padding: 24,
  boxShadow: "0 25px 55px rgba(15,23,42,0.08)",
};

const actionCard: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #bfdbfe",
  borderRadius: 26,
  padding: 24,
  boxShadow: "0 25px 55px rgba(15,23,42,0.1)",
};

const sectionTitle: React.CSSProperties = {
  fontSize: 23,
  fontWeight: 950,
  marginTop: 0,
};

const infoRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  padding: "14px 0",
  borderBottom: "1px solid #e2e8f0",
  color: "#334155",
};

const approvalBox: React.CSSProperties = {
  background: "#f0fdf4",
  border: "1px solid #bbf7d0",
  borderRadius: 20,
  padding: 18,
  marginBottom: 18,
};

const rejectBox: React.CSSProperties = {
  background: "#fff7ed",
  border: "1px solid #fed7aa",
  borderRadius: 20,
  padding: 18,
  marginBottom: 18,
};

const label: React.CSSProperties = {
  display: "block",
  marginTop: 12,
  marginBottom: 7,
  fontWeight: 900,
  fontSize: 13,
};

const input: React.CSSProperties = {
  width: "100%",
  padding: 13,
  borderRadius: 14,
  border: "1px solid #cbd5e1",
};

const textarea: React.CSSProperties = {
  width: "100%",
  minHeight: 90,
  padding: 13,
  borderRadius: 14,
  border: "1px solid #cbd5e1",
  resize: "vertical",
};

const approveButton: React.CSSProperties = {
  width: "100%",
  padding: 15,
  borderRadius: 16,
  border: "none",
  background: "#16a34a",
  color: "white",
  fontWeight: 950,
  cursor: "pointer",
};

const rejectButton: React.CSSProperties = {
  width: "100%",
  marginTop: 15,
  padding: 15,
  borderRadius: 16,
  border: "none",
  background: "#dc2626",
  color: "white",
  fontWeight: 950,
  cursor: "pointer",
};

const pendingButton: React.CSSProperties = {
  width: "100%",
  padding: 15,
  borderRadius: 16,
  border: "none",
  background: "#f59e0b",
  color: "white",
  fontWeight: 950,
  cursor: "pointer",
};