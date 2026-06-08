export default function HarvestPage() {
  return (
    <main style={{ background: "#f6faf6", minHeight: "100vh", padding: 24 }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <h1 style={{ fontSize: 34, marginBottom: 8 }}>Harvest & Earnings 🌿</h1>
        <p style={{ color: "#4b5563", marginBottom: 24 }}>
          Dashboard › Harvest & Earnings
        </p>

        <section
          style={{
            background: "linear-gradient(135deg,#ecfdf5,#fff7ed)",
            border: "1px solid #d1fae5",
            borderRadius: 24,
            padding: 32,
            marginBottom: 24,
          }}
        >
          <h2 style={{ fontSize: 30, color: "#166534", marginBottom: 8 }}>
            Malapit na ang ani! 🐔
          </h2>
          <p style={{ fontSize: 18, maxWidth: 520 }}>
            Patuloy na lumalaki ang iyong mga manok. Alagaan natin sila para sa
            mas mataas na kita!
          </p>
        </section>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 16,
            marginBottom: 24,
          }}
        >
          {[
            ["Total Chicks", "100", "100% alive"],
            ["Average Weight", "1.80 kg", "+0.25kg vs last week"],
            ["Projected Revenue", "₱45,000", "Based on current market"],
            ["Est. Earnings", "₱12,500", "After expenses"],
          ].map(([title, value, note]) => (
            <div
              key={title}
              style={{
                background: "white",
                borderRadius: 20,
                padding: 24,
                border: "1px solid #e5e7eb",
                boxShadow: "0 10px 25px rgba(0,0,0,0.06)",
              }}
            >
              <p style={{ color: "#6b7280", marginBottom: 8 }}>{title}</p>
              <h3 style={{ fontSize: 30, marginBottom: 12 }}>{value}</h3>
              <p style={{ color: "#15803d", fontWeight: 700 }}>{note}</p>
            </div>
          ))}
        </section>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: 20,
          }}
        >
          <div
            style={{
              background: "white",
              borderRadius: 20,
              padding: 24,
              border: "1px solid #e5e7eb",
            }}
          >
            <h2>Harvest Summary</h2>

            {[
              ["Total Chicks", "100 heads"],
              ["Average Weight", "1.80 kg"],
              ["Total Live Weight", "180 kg"],
              ["Market Price / kg", "₱250"],
              ["Projected Revenue", "₱45,000"],
              ["Estimated Expenses", "-₱32,500"],
            ].map(([label, value]) => (
              <div
                key={label}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  borderBottom: "1px solid #e5e7eb",
                  padding: "12px 0",
                }}
              >
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}

            <div
              style={{
                marginTop: 20,
                background: "#dcfce7",
                color: "#166534",
                borderRadius: 16,
                padding: 18,
                display: "flex",
                justifyContent: "space-between",
                fontSize: 22,
                fontWeight: 800,
              }}
            >
              <span>Estimated Earnings</span>
              <span>₱12,500</span>
            </div>
          </div>

          <div
            style={{
              background: "white",
              borderRadius: 20,
              padding: 24,
              border: "1px solid #e5e7eb",
            }}
          >
            <h2>Earnings Breakdown</h2>

            <div
              style={{
                margin: "24px auto",
                width: 180,
                height: 180,
                borderRadius: "50%",
                background:
                  "conic-gradient(#16a34a 0 28%, #ef4444 28% 100%)",
                display: "grid",
                placeItems: "center",
              }}
            >
              <div
                style={{
                  width: 120,
                  height: 120,
                  borderRadius: "50%",
                  background: "white",
                  display: "grid",
                  placeItems: "center",
                  textAlign: "center",
                  fontWeight: 800,
                }}
              >
                27.8%
                <br />
                Margin
              </div>
            </div>

            <p>🟢 Projected Revenue: ₱45,000</p>
            <p>🔴 Total Expenses: ₱32,500</p>
            <p>🟢 Estimated Earnings: ₱12,500</p>
          </div>
        </section>

        <section
          style={{
            marginTop: 24,
            background: "#ecfdf5",
            border: "1px solid #bbf7d0",
            borderRadius: 20,
            padding: 24,
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h2>Handa ka na bang mag-harvest?</h2>
            <p>Kapag ready na ang iyong mga manok, i-schedule ang harvest.</p>
          </div>

          <button
            style={{
              background: "#15803d",
              color: "white",
              border: 0,
              borderRadius: 12,
              padding: "14px 24px",
              fontWeight: 800,
              fontSize: 16,
            }}
          >
            Schedule Harvest
          </button>
        </section>
      </div>
    </main>
  );
}