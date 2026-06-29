import Link from "next/link";

const portalLinks = [
  {
    href: "/caretaker/dashboard",
    icon: "🏠",
    title: "Dashboard",
    desc: "View active paid assignments and daily update shortcuts.",
  },
  {
    href: "/caretaker/tasks",
    icon: "🧑‍🌾",
    title: "Tasks",
    desc: "Read-only list of assigned chicken care jobs.",
  },
  {
    href: "/caretaker/feeding",
    icon: "🌽",
    title: "Feeding Logs",
    desc: "Submit feeding proof and review recent feeding history.",
  },
  {
    href: "/caretaker/photos",
    icon: "📸",
    title: "Photo Logs",
    desc: "Upload chicken monitoring photos with optional captions.",
  },
  {
    href: "/caretaker/weight",
    icon: "⚖️",
    title: "Weight Logs",
    desc: "Record latest chicken weight updates.",
  },
  {
    href: "/caretaker/mortality",
    icon: "☠️",
    title: "Mortality Logs",
    desc: "Report mortality updates from assigned chicken jobs.",
  },
  {
    href: "/caretaker/notes",
    icon: "📝",
    title: "Notes",
    desc: "Send caretaker concerns to admin records.",
  },
];

export default function CaretakerPortalPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#fef3c7,transparent_34%),linear-gradient(135deg,#fefce8,#ecfccb_46%,#dbeafe)] px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <section className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-2xl shadow-yellow-900/10 backdrop-blur sm:p-8 lg:p-10">
          <div className="grid gap-8 lg:grid-cols-[1.25fr_0.75fr] lg:items-center">
            <div>
              <p className="mb-3 inline-flex rounded-full bg-yellow-100 px-4 py-2 text-sm font-black uppercase tracking-[0.18em] text-yellow-700">
                FarmConnect Live
              </p>

              <h1 className="text-4xl font-black tracking-tight text-yellow-700 sm:text-5xl lg:text-6xl">
                Caretaker Portal
              </h1>

              <p className="mt-4 max-w-2xl text-base font-semibold leading-7 text-slate-600 sm:text-lg">
                Mobile-friendly workspace for chicken care operations, daily
                proofs, task review, monitoring updates, and admin concerns.
              </p>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Link
                  href="/caretaker/login"
                  className="inline-flex items-center justify-center rounded-2xl bg-yellow-600 px-6 py-4 text-base font-black text-white shadow-lg shadow-yellow-700/20 transition hover:-translate-y-0.5 hover:bg-yellow-700"
                >
                  Caretaker Login
                </Link>

                <Link
                  href="/caretaker/dashboard"
                  className="inline-flex items-center justify-center rounded-2xl border border-yellow-200 bg-white px-6 py-4 text-base font-black text-yellow-700 transition hover:-translate-y-0.5 hover:bg-yellow-50"
                >
                  Open Dashboard
                </Link>
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-yellow-100 bg-gradient-to-br from-yellow-50 to-white p-6 shadow-inner">
              <p className="text-sm font-black uppercase tracking-[0.18em] text-yellow-700">
                Chicken-only flow
              </p>
              <h2 className="mt-3 text-2xl font-black text-slate-900">
                Faster daily updates
              </h2>
              <p className="mt-3 leading-7 text-slate-600">
                Use the shortcuts below to move between tasks, feeding, photos,
                weight, mortality, and notes without losing context.
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {portalLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group rounded-[1.5rem] border border-white/70 bg-white/90 p-5 shadow-xl shadow-slate-900/5 transition hover:-translate-y-1 hover:shadow-2xl hover:shadow-yellow-900/10"
            >
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-yellow-100 text-3xl transition group-hover:scale-105">
                {item.icon}
              </div>
              <h2 className="text-xl font-black text-slate-900">{item.title}</h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
                {item.desc}
              </p>
            </Link>
          ))}
        </section>
      </div>
    </main>
  );
}
