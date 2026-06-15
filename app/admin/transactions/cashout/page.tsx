"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type CashOutRequest = {
  id: string;
  profile_id?: string | null;
  customer_id?: string | null;
  amount?: number | string | null;
  payment_method?: string | null;
  channel?: string | null;
  method?: string | null;
  status?: string | null;
  bank_name?: string | null;
  account_name?: string | null;
  account_number?: string | null;
  gcash_number?: string | null;
  admin_notes?: string | null;
  created_at?: string | null;
  approved_at?: string | null;
};

const TECHNICAL_FEE_PERCENT = 0.02;

export default function AdminCashOutPage() {
  const [requests, setRequests] = useState<CashOutRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [processingId, setProcessingId] = useState("");

  useEffect(() => {
    loadCashouts();
  }, []);

  async function loadCashouts() {
    setLoading(true);

    const { data, error } = await supabase
      .from("cashout_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(150);

    if (error) {
      alert(`Cash-out load error: ${error.message}`);
      setRequests([]);
    } else {
      setRequests((data || []) as CashOutRequest[]);
    }

    setLoading(false);
  }

  async function updateRequestStatus(
    req: CashOutRequest,
    newStatus: string,
    notes: string
  ) {
    const currentStatus = status(req.status);

    if (["APPROVED", "RELEASED"].includes(currentStatus)) {
      alert("Approved or released requests cannot be changed.");
      return;
    }

    if (currentStatus === "REJECTED") {
      alert("Rejected requests cannot be changed.");
      return;
    }

    setProcessingId(req.id);

    try {
      const { error } = await supabase
        .from("cashout_requests")
        .update({
          status: newStatus,
          admin_notes: notes,
        })
        .eq("id", req.id);

      if (error) throw error;

      const profileId = req.profile_id || req.customer_id;

      if (profileId) {
        await supabase.from("wallet_transactions").insert({
          profile_id: profileId,
          transaction_type: `CASH_OUT_${newStatus}`,
          amount: 0,
          reference_no: `FC-CASHOUT-${newStatus}-${req.id}`,
          remarks: notes,
          status: newStatus,
        });
      }

      await loadCashouts();
    } catch (err: any) {
      alert(err?.message || "Update failed.");
    } finally {
      setProcessingId("");
    }
  }

  async function approveCashOut(req: CashOutRequest) {
    const reqStatus = status(req.status);

    if (reqStatus === "APPROVED" || reqStatus === "RELEASED") {
      alert("This cash-out is already approved/released.");
      return;
    }

    if (reqStatus === "REJECTED") {
      alert("Rejected cash-out cannot be approved.");
      return;
    }

    const profileId = req.profile_id || req.customer_id;
    const grossAmount = toNumber(req.amount);
    const feeAmount = grossAmount * TECHNICAL_FEE_PERCENT;
    const netAmount = grossAmount - feeAmount;

    if (!profileId) {
      alert("Missing profile_id/customer_id. Cannot deduct wallet.");
      return;
    }

    if (grossAmount <= 0) {
      alert("Invalid cash-out amount.");
      return;
    }

    const ok = confirm(
      `Approve cash-out after manual payout?\n\nRequested Gross: ${money(
        grossAmount
      )}\nFarmConnect Fee 2%: ${money(feeAmount)}\nCustomer Receives: ${money(
        netAmount
      )}\n\nThis will deduct ${money(grossAmount)} from customer wallet.`
    );

    if (!ok) return;

    setProcessingId(req.id);

    try {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id,wallet_balance")
        .eq("id", profileId)
        .maybeSingle();

      if (profileError) throw profileError;

      if (!profile) {
        throw new Error("Customer profile not found.");
      }

      const currentBalance = toNumber(profile.wallet_balance);

      if (currentBalance < grossAmount) {
        throw new Error(
          `Customer wallet balance is not enough. Current balance: ${money(
            currentBalance
          )}`
        );
      }

      const newBalance = currentBalance - grossAmount;
      const referenceBase = Date.now();

      const { error: walletUpdateError } = await supabase
        .from("profiles")
        .update({ wallet_balance: newBalance })
        .eq("id", profileId);

      if (walletUpdateError) throw walletUpdateError;

      const { error: txError } = await supabase
        .from("wallet_transactions")
        .insert([
          {
            profile_id: profileId,
            transaction_type: "CASH_OUT_APPROVED",
            amount: grossAmount * -1,
            reference_no: `FC-CASHOUT-${referenceBase}`,
            remarks: `Cash-out approved after manual payout. Gross deducted: ${money(
              grossAmount
            )}. Customer receives: ${money(netAmount)}.`,
            status: "COMPLETED",
          },
          {
            profile_id: profileId,
            transaction_type: "FARMCONNECT_CASHOUT_FEE",
            amount: feeAmount,
            reference_no: `FC-CASHOUT-FEE-${referenceBase}`,
            remarks: `2% FarmConnect technical fee from cash-out. Gross: ${money(
              grossAmount
            )}. Fee: ${money(feeAmount)}.`,
            status: "COMPLETED",
          },
        ]);

      if (txError) throw txError;

      const { error: requestError } = await supabase
        .from("cashout_requests")
        .update({
          status: "APPROVED",
          admin_notes: `Approved after manual payout. Gross ${money(
            grossAmount
          )}. Fee ${money(feeAmount)}. Customer receives ${money(netAmount)}.`,
          approved_at: new Date().toISOString(),
        })
        .eq("id", req.id);

      if (requestError) throw requestError;

      alert("Cash-out approved. Wallet deducted and 2% fee recorded.");
      await loadCashouts();
    } catch (err: any) {
      alert(err?.message || "Approval failed.");
    } finally {
      setProcessingId("");
    }
  }

  async function releaseCashOut(req: CashOutRequest) {
    const reqStatus = status(req.status);

    if (reqStatus !== "APPROVED") {
      alert("Only APPROVED cash-out requests can be marked RELEASED.");
      return;
    }

    setProcessingId(req.id);

    try {
      const { error } = await supabase
        .from("cashout_requests")
        .update({
          status: "RELEASED",
          admin_notes:
            "Cash-out marked as released. Manual payout already completed.",
        })
        .eq("id", req.id);

      if (error) throw error;

      const profileId = req.profile_id || req.customer_id;

      if (profileId) {
        await supabase.from("wallet_transactions").insert({
          profile_id: profileId,
          transaction_type: "CASH_OUT_RELEASED",
          amount: 0,
          reference_no: `FC-CASHOUT-RELEASED-${req.id}`,
          remarks: "Cash-out marked as released by admin.",
          status: "COMPLETED",
        });
      }

      alert("Cash-out marked as released.");
      await loadCashouts();
    } catch (err: any) {
      alert(err?.message || "Release failed.");
    } finally {
      setProcessingId("");
    }
  }

  async function rejectCashOut(req: CashOutRequest) {
    const reqStatus = status(req.status);

    if (reqStatus === "REJECTED") {
      alert("This cash-out is already rejected.");
      return;
    }

    if (reqStatus === "APPROVED" || reqStatus === "RELEASED") {
      alert("Approved or released cash-out cannot be rejected.");
      return;
    }

    const ok = confirm("Reject this cash-out request? Wallet will not be deducted.");
    if (!ok) return;

    setProcessingId(req.id);

    try {
      const { error } = await supabase
        .from("cashout_requests")
        .update({
          status: "REJECTED",
          admin_notes:
            "Rejected by admin. Customer wallet was not deducted.",
        })
        .eq("id", req.id);

      if (error) throw error;

      const profileId = req.profile_id || req.customer_id;

      if (profileId) {
        await supabase.from("wallet_transactions").insert({
          profile_id: profileId,
          transaction_type: "CASH_OUT_REJECTED",
          amount: 0,
          reference_no: `FC-CASHOUT-REJECTED-${req.id}`,
          remarks: "Cash-out rejected by admin. Wallet unchanged.",
          status: "REJECTED",
        });
      }

      alert("Cash-out request rejected.");
      await loadCashouts();
    } catch (err: any) {
      alert(err?.message || "Reject failed.");
    } finally {
      setProcessingId("");
    }
  }

  const summary = useMemo(() => {
    const totalAmount = requests.reduce((sum, r) => sum + toNumber(r.amount), 0);
    const pendingAmount = requests
      .filter((r) => status(r.status) === "PENDING")
      .reduce((sum, r) => sum + toNumber(r.amount), 0);
    const approvedAmount = requests
      .filter((r) => status(r.status) === "APPROVED")
      .reduce((sum, r) => sum + toNumber(r.amount), 0);
    const feeAmount = requests
      .filter((r) => ["APPROVED", "RELEASED"].includes(status(r.status)))
      .reduce((sum, r) => sum + toNumber(r.amount) * TECHNICAL_FEE_PERCENT, 0);

    return {
      total: requests.length,
      amount: totalAmount,
      pending: requests.filter((r) => status(r.status) === "PENDING").length,
      processing: requests.filter((r) => status(r.status) === "PROCESSING")
        .length,
      approved: requests.filter((r) => status(r.status) === "APPROVED").length,
      released: requests.filter((r) => status(r.status) === "RELEASED").length,
      rejected: requests.filter((r) => status(r.status) === "REJECTED").length,
      pendingAmount,
      approvedAmount,
      feeAmount,
    };
  }, [requests]);

  const filtered = requests.filter((r) => {
    const matchFilter = filter === "ALL" || status(r.status) === filter;

    const text = `
      ${r.id}
      ${r.profile_id || ""}
      ${r.customer_id || ""}
      ${r.payment_method || ""}
      ${r.channel || ""}
      ${r.method || ""}
      ${r.bank_name || ""}
      ${r.account_name || ""}
      ${r.account_number || ""}
      ${r.gcash_number || ""}
      ${r.status || ""}
      ${r.admin_notes || ""}
    `.toLowerCase();

    return matchFilter && text.includes(search.toLowerCase());
  });

  return (
    <main style={page}>
      <section style={hero}>
        <div>
          <p style={eyebrow}>FarmConnect Transactions</p>
          <h1 style={title}>Cash-Out Requests</h1>
          <p style={subtitle}>
            Review withdrawal requests. Admin sends payout manually first, then
            approves to deduct wallet and record the 2% FarmConnect fee.
          </p>
        </div>

        <button onClick={loadCashouts} style={refreshBtn}>
          Refresh
        </button>
      </section>

      <section style={statsGrid}>
        <Card label="Total Requests" value={summary.total} accent="#2563eb" />
        <MoneyCard
          label="Total Requested"
          value={summary.amount}
          accent="#dc2626"
        />
        <Card label="Pending" value={summary.pending} accent="#f59e0b" />
        <Card label="Processing" value={summary.processing} accent="#2563eb" />
        <Card label="Approved" value={summary.approved} accent="#15803d" />
        <Card label="Released" value={summary.released} accent="#0f766e" />
        <Card label="Rejected" value={summary.rejected} accent="#dc2626" />
        <MoneyCard
          label="Pending Amount"
          value={summary.pendingAmount}
          accent="#f59e0b"
        />
        <MoneyCard
          label="Approved Gross"
          value={summary.approvedAmount}
          accent="#15803d"
        />
        <MoneyCard
          label="FarmConnect 2% Fees"
          value={summary.feeAmount}
          accent="#7c2d12"
        />
      </section>

      <section style={controlCard}>
        <input
          style={searchInput}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search customer ID, account name, account number, GCash, Maya, status..."
        />

        <select
          style={selectInput}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="ALL">All Requests</option>
          <option value="PENDING">Pending</option>
          <option value="PROCESSING">Processing</option>
          <option value="APPROVED">Approved</option>
          <option value="RELEASED">Released</option>
          <option value="REJECTED">Rejected</option>
        </select>
      </section>

      <section style={card}>
        <div style={cardHeader}>
          <div>
            <h2 style={sectionTitle}>Withdrawal Release Queue</h2>
            <p style={sectionDesc}>
              Approve only after admin manually sends the net payout to
              customer GCash/Maya.
            </p>
          </div>
          <span style={pill}>{filtered.length} records</span>
        </div>

        {loading ? (
          <Empty text="Loading cash-out requests..." />
        ) : filtered.length === 0 ? (
          <Empty text="No cash-out requests found." />
        ) : (
          <div style={tableWrap}>
            <table style={table}>
              <thead>
                <tr>
                  <th style={th}>Date</th>
                  <th style={th}>Customer</th>
                  <th style={th}>Method</th>
                  <th style={th}>Destination</th>
                  <th style={th}>Gross</th>
                  <th style={th}>Fee 2%</th>
                  <th style={th}>Receives</th>
                  <th style={th}>Status</th>
                  <th style={th}>Notes</th>
                  <th style={th}>Action</th>
                </tr>
              </thead>

              <tbody>
                {filtered.map((r) => {
                  const gross = toNumber(r.amount);
                  const fee = gross * TECHNICAL_FEE_PERCENT;
                  const net = gross - fee;
                  const currentStatus = status(r.status);
                  const busy = processingId === r.id;

                  const canProcess = currentStatus === "PENDING";
                  const canApprove =
                    currentStatus === "PENDING" ||
                    currentStatus === "PROCESSING";
                  const canRelease = currentStatus === "APPROVED";
                  const canReject =
                    currentStatus === "PENDING" ||
                    currentStatus === "PROCESSING";

                  return (
                    <tr key={r.id} style={tr}>
                      <td style={td}>
                        {r.created_at
                          ? new Date(r.created_at).toLocaleString()
                          : "—"}
                      </td>

                      <td style={td}>
                        <span style={mono}>
                          {r.profile_id || r.customer_id || "—"}
                        </span>
                      </td>

                      <td style={td}>
                        {r.channel ||
                          r.payment_method ||
                          r.method ||
                          "GCash / Maya"}
                      </td>

                      <td style={td}>
                        <strong>{r.account_name || "Payout Account"}</strong>
                        <br />
                        <span style={muted}>
                          {r.account_number || r.gcash_number || "—"}
                        </span>
                      </td>

                      <td style={td}>
                        <strong>{money(gross)}</strong>
                      </td>

                      <td style={td}>
                        <strong style={{ color: "#dc2626" }}>
                          {money(fee)}
                        </strong>
                      </td>

                      <td style={td}>
                        <strong style={{ color: "#15803d" }}>
                          {money(net)}
                        </strong>
                      </td>

                      <td style={td}>
                        <span
                          style={{
                            ...badge,
                            background: statusBg(r.status),
                            color: statusColor(r.status),
                          }}
                        >
                          {currentStatus}
                        </span>
                      </td>

                      <td style={td}>{r.admin_notes || "—"}</td>

                      <td style={td}>
                        <div style={actions}>
                          {canProcess && (
                            <button
                              style={{
                                ...processBtn,
                                opacity: busy ? 0.6 : 1,
                                cursor: busy ? "not-allowed" : "pointer",
                              }}
                              disabled={busy}
                              onClick={() =>
                                updateRequestStatus(
                                  r,
                                  "PROCESSING",
                                  "Cash-out is being processed by admin. Manual payout pending/completing."
                                )
                              }
                            >
                              {busy ? "..." : "Process"}
                            </button>
                          )}

                          {canApprove && (
                            <button
                              style={{
                                ...approveBtn,
                                opacity: busy ? 0.6 : 1,
                                cursor: busy ? "not-allowed" : "pointer",
                              }}
                              disabled={busy}
                              onClick={() => approveCashOut(r)}
                            >
                              {busy ? "..." : "Approve"}
                            </button>
                          )}

                          {canRelease && (
                            <button
                              style={{
                                ...releaseBtn,
                                opacity: busy ? 0.6 : 1,
                                cursor: busy ? "not-allowed" : "pointer",
                              }}
                              disabled={busy}
                              onClick={() => releaseCashOut(r)}
                            >
                              {busy ? "..." : "Released"}
                            </button>
                          )}

                          {canReject && (
                            <button
                              style={{
                                ...rejectBtn,
                                opacity: busy ? 0.6 : 1,
                                cursor: busy ? "not-allowed" : "pointer",
                              }}
                              disabled={busy}
                              onClick={() => rejectCashOut(r)}
                            >
                              {busy ? "..." : "Reject"}
                            </button>
                          )}

                          {!canProcess && !canApprove && !canRelease && !canReject && (
                            <span style={doneText}>Completed</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

function Card({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div style={statCard}>
      <div style={{ ...statBar, background: accent }} />
      <p style={statLabel}>{label}</p>
      <h2 style={statValue}>{value}</h2>
    </div>
  );
}

function MoneyCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div style={statCard}>
      <div style={{ ...statBar, background: accent }} />
      <p style={statLabel}>{label}</p>
      <h2 style={statMoney}>{money(value)}</h2>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div style={emptyBox}>{text}</div>;
}

function toNumber(value: any) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function money(value: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(value || 0);
}

function status(value?: string | null) {
  return (value || "PENDING").toUpperCase();
}

function statusBg(value?: string | null) {
  const s = status(value);
  if (s === "APPROVED" || s === "RELEASED") return "#dcfce7";
  if (s === "REJECTED" || s === "FAILED") return "#fee2e2";
  if (s === "PROCESSING") return "#dbeafe";
  return "#fef3c7";
}

function statusColor(value?: string | null) {
  const s = status(value);
  if (s === "APPROVED" || s === "RELEASED") return "#166534";
  if (s === "REJECTED" || s === "FAILED") return "#991b1b";
  if (s === "PROCESSING") return "#1d4ed8";
  return "#92400e";
}

const page: React.CSSProperties = {
  minHeight: "100vh",
  padding: 28,
  background: "linear-gradient(135deg, #fff7ed 0%, #eff6ff 45%, #f8fafc 100%)",
  color: "#0f172a",
};

const hero: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 20,
  alignItems: "center",
  padding: 30,
  borderRadius: 30,
  background: "linear-gradient(135deg, #7f1d1d, #dc2626, #2563eb)",
  color: "white",
  boxShadow: "0 20px 45px rgba(15,23,42,.18)",
  marginBottom: 24,
};

const eyebrow: React.CSSProperties = {
  margin: 0,
  fontSize: 13,
  fontWeight: 900,
  letterSpacing: 1.5,
  textTransform: "uppercase",
  opacity: 0.88,
};

const title: React.CSSProperties = {
  margin: "8px 0",
  fontSize: 42,
  fontWeight: 950,
};

const subtitle: React.CSSProperties = {
  margin: 0,
  maxWidth: 760,
  fontSize: 15,
  lineHeight: 1.6,
  opacity: 0.92,
};

const refreshBtn: React.CSSProperties = {
  border: "none",
  borderRadius: 16,
  padding: "13px 18px",
  fontWeight: 950,
  color: "#7f1d1d",
  background: "white",
  cursor: "pointer",
};

const statsGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
  gap: 16,
  marginBottom: 18,
};

const statCard: React.CSSProperties = {
  padding: 21,
  borderRadius: 24,
  background: "rgba(255,255,255,.94)",
  border: "1px solid rgba(148,163,184,.28)",
  boxShadow: "0 15px 32px rgba(15,23,42,.08)",
};

const statBar: React.CSSProperties = {
  width: 50,
  height: 8,
  borderRadius: 999,
  marginBottom: 14,
};

const statLabel: React.CSSProperties = {
  margin: 0,
  color: "#64748b",
  fontSize: 13,
  fontWeight: 900,
};

const statValue: React.CSSProperties = {
  margin: "8px 0 0",
  fontSize: 34,
  fontWeight: 950,
};

const statMoney: React.CSSProperties = {
  margin: "8px 0 0",
  fontSize: 27,
  fontWeight: 950,
};

const controlCard: React.CSSProperties = {
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
  padding: 16,
  borderRadius: 22,
  background: "rgba(255,255,255,.86)",
  border: "1px solid rgba(148,163,184,.25)",
  marginBottom: 18,
};

const searchInput: React.CSSProperties = {
  flex: 1,
  minWidth: 260,
  padding: "14px 16px",
  borderRadius: 16,
  border: "1px solid #cbd5e1",
  outline: "none",
};

const selectInput: React.CSSProperties = {
  padding: "14px 16px",
  borderRadius: 16,
  border: "1px solid #cbd5e1",
  outline: "none",
  fontWeight: 900,
  background: "white",
};

const card: React.CSSProperties = {
  padding: 22,
  borderRadius: 26,
  background: "rgba(255,255,255,.94)",
  border: "1px solid rgba(148,163,184,.3)",
  boxShadow: "0 20px 45px rgba(15,23,42,.08)",
};

const cardHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 14,
  alignItems: "center",
  marginBottom: 16,
};

const sectionTitle: React.CSSProperties = {
  margin: 0,
  fontSize: 22,
  fontWeight: 950,
};

const sectionDesc: React.CSSProperties = {
  margin: "6px 0 0",
  color: "#64748b",
  fontSize: 14,
};

const pill: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 999,
  background: "#fee2e2",
  color: "#991b1b",
  fontWeight: 950,
  fontSize: 12,
};

const tableWrap: React.CSSProperties = { overflowX: "auto" };

const table: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: 1180,
};

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "14px 12px",
  fontSize: 12,
  color: "#475569",
  textTransform: "uppercase",
  letterSpacing: 0.8,
  borderBottom: "1px solid #e2e8f0",
};

const tr: React.CSSProperties = {
  borderBottom: "1px solid #f1f5f9",
};

const td: React.CSSProperties = {
  padding: "15px 12px",
  fontSize: 14,
  verticalAlign: "top",
};

const muted: React.CSSProperties = {
  color: "#64748b",
  fontSize: 12,
};

const badge: React.CSSProperties = {
  display: "inline-block",
  padding: "7px 10px",
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 950,
};

const actions: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const processBtn: React.CSSProperties = {
  border: "none",
  borderRadius: 12,
  padding: "9px 12px",
  background: "#2563eb",
  color: "white",
  fontWeight: 900,
};

const approveBtn: React.CSSProperties = {
  border: "none",
  borderRadius: 12,
  padding: "9px 12px",
  background: "#16a34a",
  color: "white",
  fontWeight: 900,
};

const releaseBtn: React.CSSProperties = {
  border: "none",
  borderRadius: 12,
  padding: "9px 12px",
  background: "#0f766e",
  color: "white",
  fontWeight: 900,
};

const rejectBtn: React.CSSProperties = {
  border: "none",
  borderRadius: 12,
  padding: "9px 12px",
  background: "#dc2626",
  color: "white",
  fontWeight: 900,
};

const emptyBox: React.CSSProperties = {
  padding: 30,
  borderRadius: 18,
  background: "#f8fafc",
  color: "#64748b",
  textAlign: "center",
  fontWeight: 850,
};

const mono: React.CSSProperties = {
  fontFamily:
    "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  fontSize: 12,
};

const doneText: React.CSSProperties = {
  color: "#64748b",
  fontWeight: 900,
};