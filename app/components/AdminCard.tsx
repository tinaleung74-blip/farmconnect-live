type Props = {
  icon: string;
  title: string;
  value: string;
  note?: string;
};

export default function AdminCard({ icon, title, value, note }: Props) {
  return (
    <div style={card}>
      <div style={iconStyle}>{icon}</div>
      <p style={titleStyle}>{title}</p>
      <h2 style={valueStyle}>{value}</h2>
      {note && <p style={noteStyle}>{note}</p>}
    </div>
  );
}

const card: React.CSSProperties = {
  background: "rgba(255,255,255,0.92)",
  border: "1px solid rgba(15,23,42,0.08)",
  borderRadius: 24,
  padding: 22,
  boxShadow: "0 18px 40px rgba(15,23,42,0.08)",
};

const iconStyle: React.CSSProperties = { fontSize: 36 };

const titleStyle: React.CSSProperties = {
  marginTop: 12,
  marginBottom: 4,
  color: "#64748b",
  fontWeight: 800,
  fontSize: 14,
};

const valueStyle: React.CSSProperties = {
  margin: 0,
  color: "#0f172a",
  fontSize: 30,
  fontWeight: 900,
};

const noteStyle: React.CSSProperties = {
  marginTop: 8,
  color: "#64748b",
  fontSize: 13,
};