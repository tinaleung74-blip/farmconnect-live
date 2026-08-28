import Link from "next/link";

export default function OfflinePage() {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 20, background: "linear-gradient(145deg, #f8f5e8, #e7f5eb)", color: "#123d2e", fontFamily: "Arial, sans-serif", boxSizing: "border-box" }}>
      <section style={{ width: "100%", maxWidth: 420, boxSizing: "border-box", borderRadius: 28, border: "1px solid #dbe8de", background: "#fff", padding: "32px 24px", textAlign: "center", boxShadow: "0 18px 45px rgba(18,61,46,.14)" }}>
        <img src="/farmconnect/pwa/icon-192.png" alt="FarmConnect" style={{ display: "block", width: 88, height: 88, margin: "0 auto", borderRadius: 24 }} />
        <p style={{ margin: "18px 0 0", color: "#24724d", fontSize: 11, fontWeight: 900, letterSpacing: ".14em", textTransform: "uppercase" }}>FarmConnect</p>
        <h1 style={{ margin: "8px 0 0", fontSize: 30, lineHeight: 1.15, fontWeight: 900 }}>You&apos;re offline</h1>
        <p style={{ margin: "14px 0 0", color: "#64736a", fontSize: 15, lineHeight: 1.65, fontWeight: 700 }}>Reconnect to load the latest rooster, care, payment, and payout records.</p>
        <p style={{ margin: "14px 0 0", padding: 12, borderRadius: 14, background: "#eef8f1", color: "#245b43", fontSize: 13, lineHeight: 1.5, fontWeight: 800 }}>Your last action is not marked complete until FarmConnect confirms it.</p>
        <Link href="/" style={{ display: "inline-flex", minHeight: 48, alignItems: "center", justifyContent: "center", marginTop: 22, borderRadius: 14, background: "#087153", padding: "0 24px", color: "#fff", fontSize: 15, fontWeight: 900, textDecoration: "none" }}>Try Again</Link>
      </section>
    </main>
  );
}
