import Link from "next/link";

const customers = [
  { id: "1", name: "Juan Dela Cruz", phone: "0917 111 2222", wallet: "₱50,000", investment: "₱120,000", flocks: 3, status: "ACTIVE" },
  { id: "2", name: "Maria Santos", phone: "0918 333 4444", wallet: "₱25,500", investment: "₱80,000", flocks: 2, status: "ACTIVE" },
  { id: "3", name: "Pedro Reyes", phone: "0919 555 6666", wallet: "₱10,000", investment: "₱45,000", flocks: 1, status: "UNDER REVIEW" },
];

export default function CustomersPage() {
  return (
    <main style={page}>
      <Header title="Customer Management" subtitle="View investors, wallets, flocks, transactions, and harvest earnings." />

      <div style={table}>
        {customers.map((c) => (
          <Link href={`/admin/customers/${c.id}`} key={c.id} style={row}>
            <div>
              <strong>{c.name}</strong>
              <p>{c.phone}</p>
            </div>
            <div>{c.wallet}</div>
            <div>{c.investment}</div>
            <div>{c.flocks} flocks</div>
            <span style={c.status === "ACTIVE" ? active : review}>{c.status}</span>
          </Link>
        ))}
      </div>
    </main>
  );
}

function Header({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div style={header}>
      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      <Link href="/admin" style={back}>← Back</Link>
    </div>
  );
}

const page: React.CSSProperties = { minHeight: "100vh", padding: 28, background: "linear-gradient(135deg,#ecfccb,#fef3c7,#dbeafe)", fontFamily: "Arial" };
const header: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", background: "white", padding: 26, borderRadius: 24, marginBottom: 22 };
const back: React.CSSProperties = { textDecoration: "none", background: "#14532d", color: "white", padding: "12px 16px", borderRadius: 14, fontWeight: 900 };
const table: React.CSSProperties = { display: "grid", gap: 14 };
const row: React.CSSProperties = { display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr auto", gap: 16, alignItems: "center", textDecoration: "none", color: "#0f172a", background: "rgba(255,255,255,0.92)", padding: 20, borderRadius: 20, boxShadow: "0 12px 30px rgba(15,23,42,0.08)" };
const active: React.CSSProperties = { background: "#dcfce7", color: "#166534", padding: "8px 10px", borderRadius: 999, fontWeight: 900, fontSize: 12 };
const review: React.CSSProperties = { background: "#fef3c7", color: "#92400e", padding: "8px 10px", borderRadius: 999, fontWeight: 900, fontSize: 12 };