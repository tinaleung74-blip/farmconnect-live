import Link from "next/link";

export default function ForgotPasswordPage() {
  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-[#075f48] px-4 py-8 text-[#14251f]">
      <div className="fixed inset-0 bg-[url('/farmconnect-hero-wallpaper.jpg')] bg-cover bg-center" />
      <div className="fixed inset-0 bg-[linear-gradient(135deg,rgba(2,45,34,.72),rgba(3,52,40,.76))]" />
      <section className="relative z-10 w-full max-w-xl rounded-[32px] border border-white/35 bg-white/96 p-8 shadow-[0_28px_80px_rgba(5,48,36,.24)]">
        <img src="/farmconnect/home/farmconnect-brand-mark.png" alt="" className="h-16 w-16 rounded-2xl object-cover shadow-sm" />
        <p className="mt-6 text-xs font-black uppercase tracking-[.14em] text-[#075f48]">FarmConnect Security</p>
        <h1 className="mt-2 text-4xl font-black text-[#063e30]">Forgot Password</h1>
        <p className="mt-3 text-sm font-bold leading-7 text-[#667267]">Password recovery page placeholder. We will connect reset email / admin-assisted recovery here next.</p>
        <Link href="/" className="mt-6 inline-block rounded-2xl bg-[#1f6b45] px-5 py-3 font-black text-white">Back to Login</Link>
      </section>
    </main>
  );
}
