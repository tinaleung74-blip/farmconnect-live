"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Caretaker = {
  id: string;
  caretaker_profile_id?: string | null;
  full_name?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  status?: string | null;
  assigned_flock_id?: string | null;
  created_at?: string | null;
};

type Hire = {
  id: string;
  profile_id?: string | null;
  caretaker_id?: string | null;
  caretaker_name?: string | null;
  flock_id?: string | null;
  status?: string | null;
  payment_status?: string | null;
  created_at?: string | null;
};

type Profile = {
  id: string;
  full_name?: string | null;
  email?: string | null;
};

type Flock = {
  id: string;
  batch_no?: string | null;
  batch_name?: string | null;
  breed?: string | null;
  status?: string | null;
};

type CaretakerRow = Caretaker & {
  latestHire?: Hire | null;
  assignedCustomer?: Profile | null;
  assignedFlock?: Flock | null;
};

export default function AdminCaretakersPage() {
  const [caretakers, setCaretakers] = useState<CaretakerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadCaretakers();
  }, []);

  async function loadCaretakers() {
    setLoading(true);
    setMessage("");

    const { data: caretakerRows, error: caretakerError } = await supabase
      .from("caretakers")
      .select("*")
      .order("created_at", { ascending: false });

    if (caretakerError) {
      setMessage(caretakerError.message);
      setLoading(false);
      return;
    }

    const caretakersData = (caretakerRows || []) as Caretaker[];
    const caretakerIds = caretakersData.map((c) => c.id).filter(Boolean);

    const { data: hireRows, error: hireError } = await supabase
      .from("customer_caretaker_hires")
      .select("*")
      .in("caretaker_id", caretakerIds)
      .order("created_at", { ascending: false });

    if (hireError) {
      setMessage(hireError.message);
      setLoading(false);
      return;
    }

    const hires = (hireRows || []) as Hire[];
    const profileIds = Array.from(
      new Set(hires.map((h) => h.profile_id).filter(Boolean) as string[])
    );
    const flockIds = Array.from(
      new Set(hires.map((h) => h.flock_id).filter(Boolean) as string[])
    );

    const [profileResult, flockResult] = await Promise.all([
      profileIds.length
        ? supabase.from("profiles").select("id, full_name, email").in("id", profileIds)
        : Promise.resolve({ data: [], error: null }),

      flockIds.length
        ? supabase.from("flocks").select("id, batch_no, batch_name, breed, status").in("id", flockIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (profileResult.error) {
      setMessage(profileResult.error.message);
      setLoading(false);
      return;
    }

    if (flockResult.error) {
      setMessage(flockResult.error.message);
      setLoading(false);
      return;
    }

    const profiles = (profileResult.data || []) as Profile[];
    const flocks = (flockResult.data || []) as Flock[];

    const merged: CaretakerRow[] = caretakersData.map((caretaker) => {
      const caretakerHires = hires.filter((hire) => hire.caretaker_id === caretaker.id);

      const activeHire =
        caretakerHires.find(
          (hire) =>
            normalizeStatus(hire.status) === "ACTIVE" ||
            normalizeStatus(hire.status) === "ASSIGNED" ||
            normalizeStatus(hire.status) === "APPROVED"
        ) || caretakerHires[0] || null;

      return {
        ...caretaker,
        latestHire: activeHire,
        assignedCustomer:
          profiles.find((profile) => profile.id === activeHire?.profile_id) || null,
        assignedFlock:
          flocks.find(
            (flock) =>
              flock.id === activeHire?.flock_id ||
              flock.id === caretaker.assigned_flock_id
          ) || null,
      };
    });

    setCaretakers(merged);
    setLoading(false);
  }

  const summary = useMemo(() => {
    const total = caretakers.length;
    const active = caretakers.filter((c) => normalizeStatus(c.status) === "ACTIVE").length;
    const assigned = caretakers.filter((c) => getAssignmentStatus(c) === "ASSIGNED").length;
    const available = caretakers.filter((c) => getAssignmentStatus(c) === "AVAILABLE").length;

    return { total, active, assigned, available };
  }, [caretakers]);

  return (
    <main style={page}>
      <div style={header}>
        <div>
          <p style={eyebrow}>FarmConnect Admin</p>
          <h1 style={title}>Caretakers</h1>
          <p style={subtitle}>
            Live caretaker status, customer hires, assigned flocks, and production assignment sync.
          </p>
        </div>

        <Link href="/admin" style={backButton}>
          Back to Dashboard
        </Link>
      </div>

      {message && <div style={messageBox}>{message}</div>}

      <section style={summaryGrid}>
        <Stat label="Total Caretakers" value={summary.total} />
        <Stat label="Active Caretakers" value={summary.active} />
        <Stat label="Assigned Caretakers" value={summary.assigned} />
        <Stat label="Available Caretakers" value={summary.available} />
      </section>

      <section style={card}>
        <h2 style={sectionTitle}>Caretaker List</h2>

        {loading ? (
          <p>Loading caretakers...</p>
        ) : caretakers.length === 0 ? (
          <p>No caretakers found.</p>
        ) : (
          <div style={tableWrap}>
            <table style={table}>
              <thead>
                <tr>
                  <th style={th}>Name</th>
                  <th style={th}>Email</th>
                  <th style={th}>Phone</th>
                  <th style={th}>Status</th>
                  <th style={th}>Assigned Customer</th>
                  <th style={th}>Assigned Flock</th>
                  <th style={th}>Hire Status</th>
                  <th style={th}>Payment Status</th>
                  <th style={th}>Assignment Status</th>
                  <th style={th}>Actions</th>
                </tr>
              </thead>

              <tbody>
                {caretakers.map((caretaker) => {
                  const assignmentStatus = getAssignmentStatus(caretaker);

                  return (
                    <tr key={caretaker.id}>
                      <td style={td}>{caretaker.full_name || caretaker.name || "Unnamed"}</td>
                      <td style={td}>{caretaker.email || "-"}</td>
                      <td style={td}>{caretaker.phone || "-"}</td>
                      <td style={td}>
                        <span style={badge(normalizeStatus(caretaker.status || "INACTIVE"))}>
                          {normalizeStatus(caretaker.status || "INACTIVE")}
                        </span>
                      </td>
                      <td style={td}>
                        {caretaker.assignedCustomer?.full_name ||
                          caretaker.assignedCustomer?.email ||
                          "-"}
                      </td>
                      <td style={td}>
                        {caretaker.assignedFlock?.batch_no ||
                          caretaker.assignedFlock?.batch_name ||
                          caretaker.latestHire?.flock_id ||
                          caretaker.assigned_flock_id ||
                          "-"}
                      </td>
                      <td style={td}>
                        <span style={badge(normalizeStatus(caretaker.latestHire?.status || "INACTIVE"))}>
                          {normalizeStatus(caretaker.latestHire?.status || "INACTIVE")}
                        </span>
                      </td>
                      <td style={td}>
                        <span style={badge(normalizeStatus(caretaker.latestHire?.payment_status || "UNPAID"))}>
                          {normalizeStatus(caretaker.latestHire?.payment_status || "UNPAID")}
                        </span>
                      </td>
                      <td style={td}>
                        <span style={badge(assignmentStatus)}>{assignmentStatus}</span>
                      </td>
                      <td style={td}>
                        <div style={actionLinks}>
                          <Link href={`/admin/caretakers/${caretaker.id}`} style={viewButton}>
                            View
                          </Link>
                          <Link href="/admin/caretaker-hires" style={historyButton}>
                            Hire History
                          </Link>
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

function normalizeStatus(value?: string | null) {
  return String(value || "INACTIVE").trim().toUpperCase();
}

function getAssignmentStatus(caretaker: CaretakerRow) {
  const caretakerStatus = normalizeStatus(caretaker.status);
  const hireStatus = normalizeStatus(caretaker.latestHire?.status);
  const paymentStatus = normalizeStatus(caretaker.latestHire?.payment_status);
  const hasFlock = !!(caretaker.latestHire?.flock_id || caretaker.assigned_flock_id);

  if (caretakerStatus !== "ACTIVE") return "INACTIVE";
  if (hasFlock && ["ACTIVE", "ASSIGNED", "APPROVED"].includes(hireStatus)) return "ASSIGNED";
  if (paymentStatus === "PAID" && ["ACTIVE", "ASSIGNED", "APPROVED"].includes(hireStatus)) return "ASSIGNED";

  return "AVAILABLE";
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div style={statCard}>
      <p style={statLabel}>{label}</p>
      <h2 style={statValue}>{value}</h2>
    </div>
  );
}

function badge(value: string): React.CSSProperties {
  if (["ACTIVE", "ASSIGNED", "PAID", "APPROVED", "AVAILABLE"].includes(value)) {
    return {
      background: "#dcfce7",
      color: "#166534",
      padding: "6px 10px",
      borderRadius: 999,
      fontWeight: 900,
      fontSize: 12,
      whiteSpace: "nowrap",
    };
  }

  if (["INACTIVE", "REJECTED", "FAILED", "CANCELLED", "UNPAID"].includes(value)) {
    return {
      background: "#fee2e2",
      color: "#991b1b",
      padding: "6px 10px",
      borderRadius: 999,
      fontWeight: 900,
      fontSize: 12,
      whiteSpace: "nowrap",
    };
  }

  return {
    background: "#fef3c7",
    color: "#92400e",
    padding: "6px 10px",
    borderRadius: 999,
    fontWeight: 900,
    fontSize: 12,
    whiteSpace: "nowrap",
  };
}

const page: React.CSSProperties = {
  minHeight: "100vh",
  padding: 32,
  background: "linear-gradient(135deg, #ecfdf5, #fefce8)",
  color: "#123524",
};

const header: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 20,
  alignItems: "center",
  marginBottom: 24,
};

const eyebrow: React.CSSProperties = {
  margin: 0,
  fontSize: 13,
  fontWeight: 800,
  color: "#15803d",
  textTransform: "uppercase",
  letterSpacing: 1,
};

const title: React.CSSProperties = {
  margin: "8px 0",
  fontSize: 38,
  fontWeight: 900,
};

const subtitle: React.CSSProperties = {
  margin: 0,
  color: "#52665a",
};

const backButton: React.CSSProperties = {
  background: "#123524",
  color: "white",
  padding: "12px 18px",
  borderRadius: 14,
  textDecoration: "none",
  fontWeight: 800,
};

const messageBox: React.CSSProperties = {
  background: "#fee2e2",
  color: "#991b1b",
  padding: 16,
  borderRadius: 16,
  fontWeight: 900,
  marginBottom: 18,
};

const summaryGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 16,
  marginBottom: 20,
};

const statCard: React.CSSProperties = {
  background: "white",
  borderRadius: 22,
  padding: 20,
  boxShadow: "0 18px 38px rgba(0,0,0,0.08)",
};

const statLabel: React.CSSProperties = {
  margin: 0,
  color: "#52665a",
  fontWeight: 900,
  fontSize: 13,
};

const statValue: React.CSSProperties = {
  margin: "8px 0 0",
  fontSize: 34,
  fontWeight: 950,
  color: "#166534",
};

const card: React.CSSProperties = {
  background: "white",
  borderRadius: 24,
  padding: 24,
  boxShadow: "0 18px 38px rgba(0,0,0,0.08)",
};

const sectionTitle: React.CSSProperties = {
  marginTop: 0,
};

const tableWrap: React.CSSProperties = {
  overflowX: "auto",
};

const table: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
};

const th: React.CSSProperties = {
  textAlign: "left",
  padding: 14,
  borderBottom: "1px solid #e5e7eb",
  color: "#166534",
  whiteSpace: "nowrap",
};

const td: React.CSSProperties = {
  padding: 14,
  borderBottom: "1px solid #f1f5f9",
  verticalAlign: "top",
};

const actionLinks: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const viewButton: React.CSSProperties = {
  background: "#16a34a",
  color: "white",
  padding: "8px 12px",
  borderRadius: 10,
  textDecoration: "none",
  fontWeight: 800,
  whiteSpace: "nowrap",
};

const historyButton: React.CSSProperties = {
  background: "#0f172a",
  color: "white",
  padding: "8px 12px",
  borderRadius: 10,
  textDecoration: "none",
  fontWeight: 800,
  whiteSpace: "nowrap",
};