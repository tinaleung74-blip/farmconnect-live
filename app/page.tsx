import Link from "next/link";

const paths = [
  { title: "Customer App", href: "/customer/dashboard", text: "Roosters, Farm Buy, requests, wallet, inbox, and Ka-Farm support." },
  { title: "Caretaker App", href: "/caretaker/dashboard", text: "Active tasks, customer notes, QR proof, completed tasks, and admin chat." },
  { title: "Admin App", href: "/admin", text: "Customer desk, caretaker desk, money desk, live chat, evidence, and Ka-Farm console." },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#f6f3e8] text-[#17251d]">
      <section className="relative min-h-[86vh] overflow-hidden">
        <img src="/farmconnect/roosters/fc-rooster-hero.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#102017]/90 via-[#102017]/68 to-[#102017]/20" />
        <div className="relative z-10 mx-auto flex min-h-[86vh] max-w-7xl items-center px-5 py-16">
          <div className="max-w-3xl text-white">
            <div className="mb-5 inline-flex items-center rounded-full bg-white/15 px-4 py-2 text-sm font-black backdrop-blur">Ka-Farm guided farm operations</div>
            <h1 className="text-5xl font-black leading-tight md:text-7xl">FarmConnect</h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-white/86">A managed rooster care, wallet, request, and operations app for customers, caretakers, and farm admin.</p>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {paths.map((item) => (
                <Link key={item.href} href={item.href} className="rounded-2xl border border-white/20 bg-white/92 p-5 text-[#17251d] shadow-xl transition hover:-translate-y-1 hover:bg-white">
                  <h2 className="text-xl font-black">{item.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-[#5f6a62]">{item.text}</p>
                  <span className="mt-4 inline-block rounded-xl bg-[#1f6b45] px-4 py-2 text-sm font-black text-white">Open</span>
                </Link>
              ))}
            </div>
            <div className="mt-8 rounded-2xl border border-white/20 bg-white/12 p-4 backdrop-blur">
              <b>Ka-Farm says</b>
              <p className="mt-1 text-sm leading-6 text-white/82">I guide pages, explain what is pending, and help route issues. Admin still approves money, exceptions, disputes, and risky actions.</p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
