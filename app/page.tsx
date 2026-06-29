import Link from "next/link";

const portals = [
  {
    title: "Customer Portal",
    icon: "🐣",
    description:
      "Invest in poultry, monitor flock growth, wallet, marketplace, and harvest reports.",
    href: "/customer/login",
    button: "Open Customer Portal",
    color: "from-emerald-500 to-green-700",
  },
  {
    title: "Caretaker Portal",
    icon: "👨‍🌾",
    description:
      "Manage feeding logs, mortality reports, photo updates, weight updates, and farm operations.",
    href: "/caretaker/login",
    button: "Open Caretaker Portal",
    color: "from-amber-500 to-orange-600",
  },
  {
    title: "Admin Portal",
    icon: "🏢",
    description:
      "Manage customers, caretakers, treasury, risk, approvals, reports, and operations.",
    href: "/admin/login",
    button: "Open Admin Portal",
    color: "from-blue-500 to-blue-700",
  },
];

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-emerald-950 text-white">
      <img
        src="/images/farmconnect-hero-wallpaper.jpg"
        alt="FarmConnect background"
        className="absolute inset-0 h-full w-full object-cover object-center"
      />

      <div className="absolute inset-0 bg-black/35" />
      <div className="absolute inset-0 bg-gradient-to-b from-emerald-950/20 via-transparent to-emerald-950/70" />

      <section className="relative z-10 flex min-h-screen flex-col items-center px-5 py-8">
        <header className="mb-10 w-full max-w-7xl rounded-[28px] border border-white/25 bg-white/15 px-6 py-4 shadow-2xl backdrop-blur-xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Link href="/" className="text-2xl font-black text-white md:text-3xl">
              🌿 FarmConnect <span className="text-yellow-300">Live</span>
            </Link>

            <div className="flex items-center gap-3 text-sm font-black">
              <span className="rounded-full bg-emerald-500 px-4 py-2 text-white shadow-lg">
                ● System Online
              </span>

              <Link
                href="/customer/login"
                className="rounded-full bg-yellow-400 px-5 py-2 text-slate-950 shadow-lg transition hover:bg-yellow-300"
              >
                Login
              </Link>
            </div>
          </div>
        </header>

        <div className="text-center">
          <h1 className="text-5xl font-black tracking-tight text-white drop-shadow-2xl md:text-7xl">
            FarmConnect Live
          </h1>

          <p className="mt-4 text-xl font-black text-white md:text-2xl">
            Professional Livestock Investment Platform
          </p>

          <p className="mt-2 font-semibold text-white/90">
            Customer • Caretaker • Admin
          </p>
        </div>

        <div className="mt-12 grid w-full max-w-7xl grid-cols-1 gap-7 md:grid-cols-3">
          {portals.map((portal) => (
            <Link
              key={portal.title}
              href={portal.href}
              className="group rounded-[34px] border border-white/25 bg-white/15 p-7 text-center shadow-2xl backdrop-blur-xl transition duration-300 hover:-translate-y-2 hover:bg-white/25"
            >
              <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-white/25 text-5xl shadow-xl transition duration-300 group-hover:scale-110">
                {portal.icon}
              </div>

              <h2 className="mt-7 text-2xl font-black text-white">
                {portal.title}
              </h2>

              <p className="mx-auto mt-4 min-h-[88px] max-w-sm text-base font-semibold leading-relaxed text-white/90">
                {portal.description}
              </p>

              <div
                className={`mt-7 rounded-2xl bg-gradient-to-r ${portal.color} px-5 py-4 font-black text-white shadow-xl transition group-hover:shadow-2xl`}
              >
                {portal.button} →
              </div>
            </Link>
          ))}
        </div>

        <footer className="mt-10 rounded-full border border-white/25 bg-white/15 px-6 py-4 text-sm font-bold text-white/85 shadow-xl backdrop-blur-xl">
          © 2026 FarmConnect Live. All systems operational.
        </footer>
      </section>
    </main>
  );
}