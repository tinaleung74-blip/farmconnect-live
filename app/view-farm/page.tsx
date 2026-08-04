import Link from "next/link";

const previews = [
  {
    icon: "/farmconnect/home/rooster-updates.png",
    title: "My Roosters",
    text: "View owned roosters, breed, care status, health notes, value estimate, and care logs.",
  },
  {
    icon: "/farmconnect/icons/farm-buy.png",
    title: "Farm Buy",
    text: "Browse chicks, feeds, vitamins, supplements, vaccines, and equipment with payment proof review.",
  },
  {
    icon: "/farmconnect/icons/farm-request.png",
    title: "Farm Requests",
    text: "Choose rooster, service, notes, proof preference, then wait for admin and caretaker workflow.",
  },
  {
    icon: "/farmconnect/home/secure-wallet.png",
    title: "Wallet",
    text: "Track available balance, locked savings, withdrawal records, payout account, and receipts.",
  },
  {
    icon: "/farmconnect/icons/farm-inbox.png",
    title: "Inbox",
    text: "Receive invoices, receipts, KYC notices, payment updates, care updates, and admin messages.",
  },
  {
    icon: "/farmconnect/icons/support.png",
    title: "Ka-Farm Support",
    text: "Ask simple questions first. Sensitive money, KYC, support, or fraud concerns escalate to admin.",
  },
];

export default function ViewFarmPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#0b3f31] text-[#14251f]">
      <div className="fixed inset-0 bg-[url('/farmconnect-hero-wallpaper.jpg')] bg-cover bg-center" />
      <div className="fixed inset-0 bg-[linear-gradient(135deg,rgba(4,48,37,.88),rgba(12,86,72,.68),rgba(255,211,79,.35))]" />

      <section className="relative z-10 mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-10">
        <nav className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-white/20 bg-white/92 p-3 shadow-xl backdrop-blur">
          <Link href="/" className="flex items-center gap-3">
            <img src="/farmconnect/home/farmconnect-brand-mark.png" alt="" className="h-12 w-12 rounded-2xl object-cover shadow-sm" />
            <span>
              <b className="block text-lg">FarmConnect</b>
              <small className="font-black text-[#667267]">Customer Preview</small>
            </span>
          </Link>
          <div className="flex flex-wrap gap-2">
            <Link href="/login" className="rounded-2xl bg-[#1f6b45] px-4 py-3 text-sm font-black text-white">Sign In</Link>
            <Link href="/customer/register" className="rounded-2xl bg-[#ffd84a] px-4 py-3 text-sm font-black">Create Account</Link>
          </div>
        </nav>

        <div className="mt-8 grid gap-6 lg:grid-cols-[420px_1fr]">
          <section className="rounded-[32px] border border-white/25 bg-white/94 p-6 shadow-2xl backdrop-blur md:p-8">
            <p className="text-xs font-black uppercase tracking-[.16em] text-[#1f6b45]">What customers can see</p>
            <h1 className="mt-3 text-4xl font-black leading-tight md:text-5xl">A clear view of your farm investment.</h1>
            <p className="mt-4 text-sm font-bold leading-7 text-[#667267]">This preview shows the customer app flow without opening private records. Real payments, roosters, KYC, wallet, and requests require login.</p>
            <div className="mt-6 rounded-3xl bg-[#edf7f2] p-4">
              <b className="text-[#1f6b45]">Customer journey</b>
              <div className="mt-3 grid gap-2 text-sm font-bold text-[#52635c]">
                <span>1. Create account</span>
                <span>2. Submit KYC when needed</span>
                <span>3. Buy rooster or supplies</span>
                <span>4. Send payment proof</span>
                <span>5. Admin approves</span>
                <span>6. Caretaker completes work</span>
                <span>7. Customer receives logs and receipts</span>
              </div>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {previews.map((item) => (
              <article key={item.title} className="rounded-[24px] border border-white/30 bg-white/94 p-5 shadow-xl backdrop-blur transition hover:-translate-y-1 hover:shadow-2xl">
                <img src={item.icon} alt="" className="h-16 w-16 rounded-2xl object-cover shadow-md" />
                <h2 className="mt-4 text-2xl font-black">{item.title}</h2>
                <p className="mt-2 text-sm font-bold leading-6 text-[#667267]">{item.text}</p>
              </article>
            ))}
          </section>
        </div>

        <section className="mt-6 rounded-[32px] border border-white/25 bg-[#102017]/82 p-5 text-white shadow-2xl backdrop-blur md:p-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div><b>Protected Money Flow</b><p className="mt-1 text-sm leading-6 text-white/75">External payment proof goes to admin review before inventory, rooster ownership, or service request is released.</p></div>
            <div><b>Evidence Log</b><p className="mt-1 text-sm leading-6 text-white/75">Receipts, invoices, chat, proof, and decisions are recorded so problems can be traced.</p></div>
            <div><b>Admin Controlled</b><p className="mt-1 text-sm leading-6 text-white/75">KYC approval, withdrawal release, caretaker registration, and risky actions stay under admin approval.</p></div>
          </div>
        </section>
      </section>
    </main>
  );
}
