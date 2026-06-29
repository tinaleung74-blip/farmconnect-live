"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AdminCaretakerDetailPage() {
  const params = useParams();

  const [caretaker, setCaretaker] = useState<any>(null);
  const [feedingLogs, setFeedingLogs] = useState<any[]>([]);
  const [mortalityLogs, setMortalityLogs] = useState<any[]>([]);
  const [weightLogs, setWeightLogs] = useState<any[]>([]);
  const [photoLogs, setPhotoLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCaretakerProfile();
  }, []);

  async function loadCaretakerProfile() {
    const caretakerId = String(params.id);

    const { data: caretakerData } = await supabase
      .from("caretakers")
      .select("*")
      .eq("id", caretakerId)
      .single();

    const { data: feedingData } = await supabase
      .from("feeding_logs")
      .select("*")
      .eq("caretaker_id", caretakerId)
      .order("created_at", { ascending: false })
      .limit(6);

    const { data: mortalityData } = await supabase
      .from("mortality_logs")
      .select("*")
      .eq("caretaker_id", caretakerId)
      .order("created_at", { ascending: false })
      .limit(6);

    const { data: weightData } = await supabase
      .from("weight_logs")
      .select("*")
      .eq("caretaker_id", caretakerId)
      .order("created_at", { ascending: false })
      .limit(6);

    const { data: photoData } = await supabase
      .from("photo_logs")
      .select("*")
      .eq("caretaker_id", caretakerId)
      .order("created_at", { ascending: false })
      .limit(6);

    setCaretaker(caretakerData);
    setFeedingLogs(feedingData || []);
    setMortalityLogs(mortalityData || []);
    setWeightLogs(weightData || []);
    setPhotoLogs(photoData || []);
    setLoading(false);
  }

  if (loading) return <main style={page}>Loading caretaker profile...</main>;
  if (!caretaker) return <main style={page}>Caretaker not found.</main>;

  return (
    <main style={page}>
      <Link href="/admin/caretakers" style={back}>
        ← Back to Caretakers
      </Link>

      <section style={hero}>
        <div style={avatar}>👨‍🌾</div>

        <div>
          <p style={eyebrow}>Caretaker Profile</p>
          <h1 style={title}>
            {caretaker.full_name || caretaker.name || "Unnamed Caretaker"}
          </h1>
          <p style={subtitle}>
            Admin-controlled field worker profile. Caretaker reports only to Admin.
          </p>
        </div>

        <span style={status}>{caretaker.status || "ACTIVE"}</span>
      </section>

      <section style={statsGrid}>
        <div style={statCard}>
          <span>🌾</span>
          <p>Feeding Logs</p>
          <strong>{feedingLogs.length}</strong>
        </div>

        <div style={statCard}>
          <span>⚰️</span>
          <p>Mortality Logs</p>
          <strong>{mortalityLogs.length}</strong>
        </div>

        <div style={statCard}>
          <span>⚖️</span>
          <p>Weight Logs</p>
          <strong>{weightLogs.length}</strong>
        </div>

        <div style={statCard}>
          <span>📸</span>
          <p>Photo Logs</p>
          <strong>{photoLogs.length}</strong>
        </div>
      </section>

      <section style={twoGrid}>
        <div style={card}>
          <h2 style={cardTitle}>Caretaker Information</h2>
          <p>📞 Phone: {caretaker.phone || "No phone number"}</p>
          <p>📍 Location: {caretaker.location || "No location set"}</p>
          <p>🏡 Farm Area: {caretaker.farm_area || "Not assigned"}</p>
          <p>🐔 Assigned Flock: {caretaker.assigned_flock || "Not assigned"}</p>
          <p>🪪 Caretaker ID: {caretaker.id}</p>
        </div>

        <div style={card}>
          <h2 style={cardTitle}>Admin Relationship Rule</h2>

          <div style={ruleGreen}>
            <strong>Caretaker ↔ Admin only</strong>
            <p>
              All updates, reports, issues, and accountability records must be
              submitted to Admin only.
            </p>
          </div>

          <div style={ruleOrange}>
            <strong>No Customer ↔ Caretaker connection</strong>
            <p>
              Customer must not directly access caretaker contact details, private logs,
              or field operations.
            </p>
          </div>
        </div>
      </section>

      <section style={grid}>
        <LogPanel title="🌾 Feeding Logs" logs={feedingLogs} type="feeding" />
        <LogPanel title="⚰️ Mortality Logs" logs={mortalityLogs} type="mortality" />
        <LogPanel title="⚖️ Weight Logs" logs={weightLogs} type="weight" />
        <LogPanel title="📸 Photo Logs" logs={photoLogs} type="photo" />
      </section>
    </main>
  );
}

function LogPanel({
  title,
  logs,
  type,
}: {
  title: string;
  logs: any[];
  type: string;
}) {
  return (
    <div style={panel}>
      <h2 style={panelTitle}>{title}</h2>

      {logs.length === 0 ? (
        <p style={muted}>No records found.</p>
      ) : (
        <div style={list}>
          {logs.map((log) => (
            <div key={log.id} style={listItem}>
              <strong>
                {type === "feeding" && (log.feed_type || "Feeding Report")}
                {type === "mortality" && `${log.count || 0} mortality reported`}
                {type === "weight" && `${log.average_weight || log.weight || 0} kg`}
                {type === "photo" && (log.caption || "Photo Update")}
              </strong>

              <p>{log.notes || log.description || log.message || "No notes provided"}</p>

              <small>
                {log.created_at
                  ? new Date(log.created_at).toLocaleString()
                  : "No date"}
              </small>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const page: React.CSSProperties = {
  minHeight: "100vh",
  padding: 32,
  background:
    "radial-gradient(circle at top left, #fde68a, transparent 30%), radial-gradient(circle at top right, #bbf7d0, transparent 28%), linear-gradient(135deg, #fff7ed 0%, #f0fdf4 50%, #eff6ff 100%)",
  color: "#0f172a",
};

const back: React.CSSProperties = {
  display: "inline-block",
  marginBottom: 20,
  color: "#166534",
  fontWeight: 950,
  textDecoration: "none",
};

const hero: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: 22,
  background: "rgba(255,255,255,0.88)",
  borderRadius: 32,
  padding: 30,
  boxShadow: "0 24px 65px rgba(15,23,42,0.13)",
  marginBottom: 22,
};

const avatar: React.CSSProperties = {
  width: 86,
  height: 86,
  borderRadius: 28,
  background: "linear-gradient(135deg, #f59e0b, #f97316)",
  color: "white",
  display: "grid",
  placeItems: "center",
  fontSize: 42,
};

const eyebrow: React.CSSProperties = {
  margin: 0,
  color: "#b45309",
  fontWeight: 950,
  letterSpacing: 1,
  textTransform: "uppercase",
};

const title: React.CSSProperties = {
  margin: "8px 0",
  fontSize: 40,
  lineHeight: 1.05,
  fontWeight: 950,
  color: "#14532d",
};

const subtitle: React.CSSProperties = {
  margin: 0,
  color: "#64748b",
};

const status: React.CSSProperties = {
  marginLeft: "auto",
  background: "#dcfce7",
  color: "#166534",
  padding: "10px 16px",
  borderRadius: 999,
  fontWeight: 950,
};

const statsGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
  gap: 16,
  marginBottom: 22,
};

const statCard: React.CSSProperties = {
  padding: 20,
  borderRadius: 24,
  background: "rgba(255,255,255,0.9)",
  boxShadow: "0 16px 38px rgba(15,23,42,0.1)",
};

const twoGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  gap: 18,
  marginBottom: 22,
};

const card: React.CSSProperties = {
  background: "rgba(255,255,255,0.9)",
  borderRadius: 28,
  padding: 24,
  boxShadow: "0 18px 45px rgba(15,23,42,0.1)",
};

const cardTitle: React.CSSProperties = {
  marginTop: 0,
  color: "#14532d",
  fontWeight: 950,
};

const ruleGreen: React.CSSProperties = {
  padding: 16,
  borderRadius: 18,
  background: "#ecfdf5",
  border: "1px solid #bbf7d0",
  color: "#14532d",
  marginBottom: 12,
};

const ruleOrange: React.CSSProperties = {
  padding: 16,
  borderRadius: 18,
  background: "#fff7ed",
  border: "1px solid #fed7aa",
  color: "#9a3412",
};

const grid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  gap: 18,
};

const panel: React.CSSProperties = {
  background: "rgba(255,255,255,0.9)",
  borderRadius: 28,
  padding: 22,
  boxShadow: "0 18px 45px rgba(15,23,42,0.1)",
};

const panelTitle: React.CSSProperties = {
  marginTop: 0,
  color: "#14532d",
  fontWeight: 950,
};

const muted: React.CSSProperties = {
  color: "#64748b",
};

const list: React.CSSProperties = {
  display: "grid",
  gap: 12,
};

const listItem: React.CSSProperties = {
  padding: 16,
  borderRadius: 18,
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
};
