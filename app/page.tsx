import Link from "next/link";

export default function HomePage() {
  return (
    <main style={page}>
      <section style={card}>
        <p style={eyebrow}>FarmConnect Live</p>
        <h1 style={title}>Choose Portal</h1>
        <p style={subtitle}>Customer, Caretaker, and Admin in one platform.</p>

        <div style={grid}>
          <Link href="/customer" style={button}>👤 Customer App</Link>
          <Link href="/caretaker" style={button}>🧑‍🌾 Caretaker App</Link>
          <Link href="/admin" style={button}>🛡️ Admin App</Link>
        </div>
      </section>
    </main>
  );
}

const page: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 24,
  background: "linear-gradient(135deg, #dcfce7, #fef9c3, #dbeafe)",
};

const card: React.CSSProperties = {
  width: "100%",
  maxWidth: 850,
  background: "white",
  borderRadius: 32,
  padding: 40,
  textAlign: "center",
  boxShadow: "0 24px 60px rgba(0,0,0,0.12)",
};

const eyebrow: React.CSSProperties = {
  fontWeight: 900,
  color: "#15803d",
};

const title: React.CSSProperties = {
  fontSize: 46,
  margin: "10px 0",
  color: "#123524",
};

const subtitle: React.CSSProperties = {
  color: "#5b7165",
  marginBottom: 28,
};

const grid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  gap: 16,
};

const button: React.CSSProperties = {
  background: "#123524",
  color: "white",
  padding: 24,
  borderRadius: 22,
  textDecoration: "none",
  fontWeight: 900,
  fontSize: 18,
};