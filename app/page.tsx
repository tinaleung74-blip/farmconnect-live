import Link from "next/link";

const portals = [
  {
    title: "Customer Portal",
    icon: "🐣",
    description: "Invest in livestock, monitor flock growth, harvest reports and earnings.",
    email: "customer@demo.com",
    color: "from-emerald-500 to-green-700",
    href: "/login?role=customer",
  },
  {
    title: "Caretaker Portal",
    icon: "👨‍🌾",
    description: "Feeding logs, mortality reports, weight updates and farm operations.",
    email: "caretaker@demo.com",
    color: "from-amber-500 to-orange-600",
    href: "/login?role=caretaker",
  },
  {
    title: "Admin Portal",
    icon: "🏢",
    description: "Executive dashboard, treasury, risk management and reports.",
    email: "admin@demo.com",
    color: "from-blue-500 to-blue-700",
    href: "/login?role=admin",
  },
];

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-emerald-950">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: "url('/farmconnect-hero-wallpaper.jpg')",
        }}
      />

      <div className="absolute inset-0 bg-gradient-to-b from-white/80 via-white/45 to-white/90" />
      <div className="absolute inset-x-0 bottom-0 h-80 bg-gradient-to-t from-white via-white/85 to-transparent" />

      <section className="relative z-10 flex min-h-screen flex-col items-center px-6 py-10">
        <header className="mb-10 w-full max-w-7xl rounded-3xl border border-white/60 bg-white/75 px-6 py-4 shadow-xl backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <div className="text-2xl font-black text-emerald-800">
              🌿 FarmConnect <span className="text-green-600">Live</span>
            </div>

            <div className="hidden items-center gap-5 text-sm font-semibold text-slate-700 md:flex">
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700">
                ● System Online
              </span>
              <Link href="/support">Support</Link>
              <Link href="/login" className="rounded-full bg-emerald-700 px-5 py-2 text-white">
                Login
              </Link>
            </div>
          </div>
        </header>

        <div className="text-center">
          <h1 className="text-5xl font-black tracking-tight text-emerald-900 drop-shadow-sm md:text-7xl">
            FarmConnect Live
          </h1>
          <p className="mt-4 text-xl font-semibold text-slate-700">
            Professional Livestock Investment Platform
          </p>
          <p className="mt-2 text-slate-600">Customer • Caretaker • Admin</p>
        </div>

        <div className="mt-12 grid w-full max-w-7xl grid-cols-1 gap-7 md:grid-cols-3">
          {portals.map((portal) => (
            <Link
              key={portal.title}
              href={portal.href}
              className="group rounded-[2rem] border border-white/70 bg-white/82 p-7 shadow-2xl backdrop-blur-xl transition hover:-translate-y-2 hover:bg-white/95"
            >
              <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-white text-5xl shadow-lg transition group-hover:scale-110">
                {portal.icon}
              </div>

              <h2 className="mt-6 text-center text-2xl font-black text-slate-950">
                {portal.title}
              </h2>

              <p className="mt-4 min-h-[72px] text-center leading-relaxed text-slate-700">
                {portal.description}
              </p>

              <div className="mt-5 rounded-2xl border border-white/70 bg-white/70 p-4 text-sm shadow-inner">
                <p className="font-bold text-slate-900">🔐 Demo Credentials</p>
                <p className="mt-2">Email: {portal.email}</p>
                <p>Password: 123456</p>
              </div>

              <div
                className={`mt-6 rounded-2xl bg-gradient-to-r ${portal.color} px-5 py-4 text-center font-bold text-white shadow-lg transition group-hover:shadow-2xl`}
              >
                Open {portal.title} →
              </div>
            </Link>
          ))}
        </div>

        <footer className="relative z-10 mt-10 rounded-3xl border border-white/70 bg-white/75 px-6 py-4 text-center text-sm text-slate-600 shadow-xl backdrop-blur-xl">
          © 2026 FarmConnect Live. All systems operational.
        </footer>
      </section>
    </main>
  );
}