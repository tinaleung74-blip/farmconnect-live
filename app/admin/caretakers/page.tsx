"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Caretaker = {
  id: string;
  full_name?: string;
  name?: string;
  email?: string;
  phone?: string;
  status?: string;
  created_at?: string;
};

export default function AdminCaretakersPage() {
  const [caretakers, setCaretakers] = useState<Caretaker[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCaretakers();
  }, []);

  async function loadCaretakers() {
    setLoading(true);

    const { data, error } = await supabase
      .from("caretakers")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setCaretakers(data);
    }

    setLoading(false);
  }

  return (
    <main style={page}>
      <div style={header}>
        <div>
          <p style={eyebrow}>FarmConnect Admin</p>
          <h1 style={title}>Caretakers</h1>
          <p style={subtitle}>
            Manage caretaker accounts, assigned farm operators, and flock handlers.
          </p>
        </div>

        <Link href="/admin" style={backButton}>
          Back to Dashboard
        </Link>
      </div>

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
                  <th style={th}>Action</th>
                </tr>
              </thead>
              <tbody>
                {caretakers.map((caretaker) => (
                  <tr key={caretaker.id}>
                    <td style={td}>
                      {caretaker.full_name || caretaker.name || "Unnamed"}
                    </td>
                    <td style={td}>{caretaker.email || "-"}</td>
                    <td style={td}>{caretaker.phone || "-"}</td>
                    <td style={td}>
                      <span style={badge}>
                        {caretaker.status || "ACTIVE"}
                      </span>
                    </td>
                    <td style={td}>
                      <Link
                        href={`/admin/caretakers/${caretaker.id}`}
                        style={viewButton}
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
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
};

const td: React.CSSProperties = {
  padding: 14,
  borderBottom: "1px solid #f1f5f9",
};

const badge: React.CSSProperties = {
  background: "#dcfce7",
  color: "#166534",
  padding: "6px 10px",
  borderRadius: 999,
  fontWeight: 800,
  fontSize: 12,
};

const viewButton: React.CSSProperties = {
  background: "#16a34a",
  color: "white",
  padding: "8px 12px",
  borderRadius: 10,
  textDecoration: "none",
  fontWeight: 800,
};