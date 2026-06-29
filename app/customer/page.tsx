import Link from "next/link";

export default function CustomerPortalPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#315b36_0,#10251b_36%,#07150f_100%)] p-4 text-white md:p-8">
      <div className="mx-auto grid min-h-[calc(100vh-32px)] max-w-6xl items-center md:min-h-[calc(100vh-64px)]">
        <section className="overflow-hidden rounded-[44px] border border-emerald-300/20 bg-white/10 p-6 shadow-2xl backdrop-blur-xl md:p-10">
          <div className="grid gap-8 lg:grid-cols-[1fr_360px] lg:items-center">
            <div>
              <p className="w-fit rounded-full bg-amber-300 px-4 py-2 text-sm font-black text-emerald-950">
                FarmConnect Live V28
              </p>

              <h1 className="mt-5 max-w-3xl text-5xl font-black leading-tight md:text-7xl">
                Real customer app for flock, wallet, and marketplace.
              </h1>

              <p className="mt-5 max-w-2xl text-lg font-semibold text-emerald-50">
                Customer records load from Supabase Auth and production tables only.
                Empty states guide the customer to the next real action.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/customer/login" className="rounded-2xl bg-white px-6 py-4 font-black text-emerald-950 shadow-xl">
                  Login
                </Link>
                <Link href="/customer/register" className="rounded-2xl bg-amber-300 px-6 py-4 font-black text-emerald-950 shadow-xl">
                  Register
                </Link>
                <Link href="/customer/dashboard" className="rounded-2xl bg-emerald-700 px-6 py-4 font-black text-white shadow-xl">
                  Open Dashboard
                </Link>
              </div>
            </div>

            <aside className="rounded-[36px] border border-white/15 bg-[#07150f]/70 p-6 shadow-2xl">
              <div className="grid h-48 place-items-center rounded-[28px] bg-[radial-gradient(circle_at_50%_10%,rgba(250,204,21,.36),transparent_34%),linear-gradient(135deg,#14532d,#06130d)] text-7xl">
                🐓
              </div>

              <h2 className="mt-5 text-2xl font-black">App-first workflow</h2>
              <p className="mt-2 text-sm font-semibold text-emerald-50">
                Buy from Marketplace, monitor in My Flock, use Wallet actions,
                and sell one exact rooster using latest uploaded photos.
              </p>

              <div className="mt-5 grid gap-3">
                <Link href="/customer/marketplace" className="rounded-2xl border border-emerald-300/20 bg-white/10 px-4 py-3 font-black transition hover:bg-white/15">
                  Open Marketplace
                </Link>
                <Link href="/customer/chicks" className="rounded-2xl border border-emerald-300/20 bg-white/10 px-4 py-3 font-black transition hover:bg-white/15">
                  Open My Flock
                </Link>
                <Link href="/customer/wallet" className="rounded-2xl border border-emerald-300/20 bg-white/10 px-4 py-3 font-black transition hover:bg-white/15">
                  Open Wallet
                </Link>
              </div>
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}
