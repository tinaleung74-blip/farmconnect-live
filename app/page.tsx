"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ensureCustomerSignupProfile, isFreshSupabaseSignup } from "@/lib/customer-signup";
import { hasReservedSignupEmailDomain, reservedSignupEmailMessage, signupFailureMessage } from "@/lib/signup-validation";
import { supabase } from "@/lib/supabase";
import { InstallFarmConnectButton } from "./_components/FarmConnectPwa";

type Role = "customer" | "caretaker" | "admin";

function roleWorkspace(role: Role) {
  if (role === "admin") return "/admin";
  if (role === "caretaker") return "/caretaker/dashboard";
  return "/customer-v2/roosters";
}

export function FarmConnectAuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [signupForm, setSignupForm] = useState({ firstName: "", lastName: "", birthdate: "", phone: "", email: "", password: "", consent: false });
  const [message, setMessage] = useState("Ka-Farm checks your email role and opens the correct workspace.");
  const [signupError, setSignupError] = useState("");
  const [loading, setLoading] = useState(false);

  function syncSignupBirthdate(value: string) {
    setSignupForm(current => ({ ...current, birthdate: value }));
  }

  async function signIn() {
    if (!loginForm.email || !loginForm.password) {
      setMessage("Enter email and password first.");
      return;
    }
    setLoading(true);
    setMessage("Checking account role...");
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginForm.email,
        password: loginForm.password,
      });
      if (error) throw error;
      if (!data.user) throw new Error("Login did not finish.");

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, account_status")
        .eq("auth_user_id", data.user.id)
        .maybeSingle();
      if (profileError) throw profileError;
      if (!profile) throw new Error("No FarmConnect profile found for this account.");

      const status = String(profile.account_status || "").toLowerCase();
      if (status && !["active", "approved"].includes(status)) {
        setMessage(status === "pending_approval" ? "This account is waiting for admin approval." : "This account is not active. Please contact admin.");
        return;
      }

      router.push(roleWorkspace((profile.role || "customer") as Role));
    } catch (error) {
      const text = error instanceof Error ? error.message : "Login failed.";
      setMessage(text.toLowerCase().includes("invalid") ? "Email or password did not match." : text);
    } finally {
      setLoading(false);
    }
  }

  async function signUp() {
    const fullName = `${signupForm.firstName} ${signupForm.lastName}`.trim();
    const normalizedEmail = signupForm.email.trim().toLowerCase();
    if (!fullName || !signupForm.birthdate || !signupForm.phone || !signupForm.email || !signupForm.password) {
      const text = "Complete legal name, birthdate, phone, email, and password first.";
      setMessage(text);
      setSignupError(text);
      return;
    }
    if (!signupForm.consent) {
      const text = "Please accept the terms before creating the account.";
      setMessage(text);
      setSignupError(text);
      return;
    }
    if (hasReservedSignupEmailDomain(normalizedEmail)) {
      const text = reservedSignupEmailMessage;
      setMessage(text);
      setSignupError(text);
      return;
    }
    setLoading(true);
    setSignupError("");
    setMessage("Creating customer account...");
    try {
      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password: signupForm.password,
        options: { data: { full_name: fullName, birthdate: signupForm.birthdate, phone: signupForm.phone, role: "customer" } },
      });
      if (error) throw error;
      if (!isFreshSupabaseSignup(data.user)) throw new Error("An account already exists for this email. Sign in or reset the password instead.");
      if (!data.user) throw new Error("Account creation did not return a user record. Please try again.");
      if (data.session) {
        await ensureCustomerSignupProfile(data.user.id, {
          email: normalizedEmail,
          phone: signupForm.phone,
          fullName,
          displayName: fullName,
          birthdate: signupForm.birthdate,
        });
      }

      if (data.session) {
        router.push("/customer-v2/roosters");
      } else {
        setMode("login");
        setMessage("Account created. Please sign in to continue.");
      }
    } catch (error) {
      const text = signupFailureMessage(error);
      setMessage(text);
      setSignupError(text);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-[#075f48] p-0 text-[#14251f] min-[480px]:p-4 min-[820px]:p-7">
      <div className="fixed inset-0 bg-[url('/farmconnect-hero-wallpaper.jpg')] bg-cover bg-center" />
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_78%_18%,rgba(255,217,93,.52),transparent_26rem),linear-gradient(135deg,rgba(2,45,34,.50),rgba(3,52,40,.64))]" />
      <div className="pointer-events-none fixed -bottom-64 -left-64 h-[420px] w-[420px] rounded-full border-[55px] border-white/[.055]" />
      <div className="pointer-events-none fixed -right-44 -top-44 h-80 w-80 rounded-full border-[55px] border-white/[.055]" />

      <section className="relative z-10 grid min-h-screen w-full overflow-hidden bg-white/96 shadow-[0_28px_80px_rgba(5,48,36,.24)] backdrop-blur min-[480px]:min-h-[700px] min-[480px]:rounded-[32px] min-[480px]:border min-[480px]:border-white/35 min-[820px]:min-h-[680px] min-[820px]:max-w-[1080px] min-[820px]:grid-cols-[42%_58%]">
        <aside className="relative z-0 hidden flex-col justify-between overflow-hidden bg-[linear-gradient(180deg,rgba(2,48,36,.54)_0%,rgba(2,48,36,.74)_54%,rgba(2,39,30,.90)_100%),url('/farmconnect-hero-wallpaper.jpg')] bg-cover bg-center p-[42px] text-white min-[820px]:flex">
          <div className="pointer-events-none absolute -right-48 -top-44 h-[310px] w-[310px] rounded-full border-[52px] border-white/[.07]" />
          <div className="pointer-events-none absolute -bottom-40 -left-44 h-[260px] w-[260px] rounded-full border-[52px] border-white/[.07]" />

          <div className="relative flex items-center gap-[13px]">
            <div className="grid h-[58px] w-[58px] place-items-center rounded-[18px] border-[3px] border-white/45 bg-white text-[#075f48] shadow-[0_8px_20px_rgba(0,0,0,.18)]">
              <img src="/farmconnect/home/farmconnect-brand-mark.png" alt="" className="h-full w-full rounded-[15px] object-cover" />
            </div>
            <div>
              <strong className="block text-[21px] leading-tight">FarmConnect</strong>
              <small className="mt-1 block text-[11px] font-black text-[#d8f4e9]">Customer App</small>
            </div>
          </div>

          <div className="relative my-[55px]">
            <p className="m-0 text-[11px] font-black uppercase tracking-[.15em] text-[#ffe48c]">Your farm in one place</p>
            <h1 className="mt-3 max-w-[360px] text-[54px] font-black leading-[.98] tracking-[-.045em]">Grow, care, and earn together.</h1>
            <p className="mt-5 max-w-[340px] text-sm leading-[1.65] text-[#d8eee7]">Track your roosters, receive farm updates, manage supplies, and access your FarmConnect wallet securely.</p>
            <div className="mt-6 grid gap-[11px]">
              {[
                ["/farmconnect/home/rooster-updates.png", "Real-time rooster care updates"],
                ["/farmconnect/home/secure-wallet.png", "Secure wallet and withdrawal records"],
                ["/farmconnect/home/referral-rewards.png", "Referral rewards and farm supplies"],
              ].map(([src, label]) => (
                <div key={label} className="flex items-center gap-[11px] text-xs font-black text-[#eefbf6]">
                  <img src={src} alt="" className="h-9 w-9 rounded-[11px] object-cover shadow-[0_5px_13px_rgba(0,0,0,.13)]" />
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="relative flex items-center gap-2 text-[10px] font-black text-[#cce9df]">
            <span>🔒</span>
            <span>Your account is protected by FarmConnect security.</span>
          </div>
        </aside>

        <section className="relative min-w-0 overflow-hidden bg-[linear-gradient(145deg,#fff_0%,#f8fbf8_100%)]">
          <div className={"flex min-h-screen w-[200%] transition-transform duration-[620ms] ease-[cubic-bezier(.77,0,.18,1)] min-[480px]:min-h-[700px] min-[820px]:min-h-[680px] " + (mode === "signup" ? "-translate-x-1/2" : "translate-x-0")}>
            <section className={"flex w-1/2 min-w-0 items-start justify-center p-[25px_19px_34px] transition-opacity duration-300 min-[480px]:items-center min-[480px]:p-[30px_23px] min-[820px]:p-[42px_clamp(26px,5vw,64px)] " + (mode === "signup" ? "opacity-35" : "opacity-100")}>
              <form className="w-full max-w-[430px]">
                <MobileBrand />
                <p className="m-0 text-[11px] font-black uppercase tracking-[.12em] text-[#075f48]">Welcome back</p>
                <h2 className="mt-2 text-[34px] font-black leading-[1.05] tracking-[-.025em] text-[#063e30]">Sign in to your account</h2>
                <p className="mb-6 mt-2 text-[13px] leading-[1.5] text-[#6b7872]">{message}</p>

                <Field label="Email address"><input value={loginForm.email} onChange={e=>setLoginForm({...loginForm,email:e.target.value})} type="email" autoComplete="email" placeholder="name@example.com" className={inputClass} /></Field>
                <Field label="Password">
                  <div className="relative">
                    <input value={loginForm.password} onChange={e=>setLoginForm({...loginForm,password:e.target.value})} onKeyDown={e=>{if(e.key==="Enter")signIn();}} type={showLoginPassword ? "text" : "password"} autoComplete="current-password" placeholder="Enter your password" className={inputClass + " pr-[72px]"} />
                    <button type="button" onClick={() => setShowLoginPassword(value => !value)} className="absolute right-2 top-2 grid h-[35px] place-items-center rounded-[9px] bg-[#edf7f2] px-[9px] text-[10px] font-black text-[#075f48]">{showLoginPassword ? "Hide" : "Show"}</button>
                  </div>
                </Field>

                <div className="mt-[14px] flex items-center justify-between gap-3">
                  <label className="flex items-center gap-2 text-[11px] font-bold text-[#52635c]"><input type="checkbox" className="accent-[#075f48]" /> Remember me</label>
                  <Link href="/forgot-password" className="text-[11px] font-black text-[#0873a3]">Forgot password?</Link>
                </div>

                <button type="button" onClick={signIn} disabled={loading} className="mt-[21px] grid h-[52px] w-full place-items-center rounded-[14px] bg-[linear-gradient(105deg,#075f48,#078065)] font-black text-white shadow-[0_11px_25px_rgba(7,95,72,.20)] transition hover:-translate-y-px hover:shadow-[0_14px_28px_rgba(7,95,72,.26)] disabled:opacity-60">{loading ? "Checking..." : "Sign In"}</button>

                <p className="mt-5 text-center text-xs text-[#6b7872]">Don&apos;t have an account?
                  <button type="button" onClick={() => setMode("signup")} className="ml-1 bg-transparent p-0 font-black text-[#075f48]">Sign Up</button>
                </p>

                <Divider />
                <Link href="/view-farm" className="grid h-[47px] w-full place-items-center rounded-[13px] border border-[#dbe4de] bg-white text-xs font-black text-[#375048]">View Farm</Link>
                <BlankFooterSpace />
              </form>
            </section>

            <section className={"flex w-1/2 min-w-0 items-start justify-center p-[25px_19px_34px] transition-opacity duration-300 min-[480px]:items-center min-[480px]:p-[30px_23px] min-[820px]:p-[42px_clamp(26px,5vw,64px)] " + (mode === "signup" ? "opacity-100" : "opacity-35")}>
              <form className="w-full max-w-[430px]">
                <MobileBrand />
                <div className="mb-5 flex items-center gap-[7px]">
                  <span className="h-[5px] flex-1 rounded-full bg-[#075f48]" />
                  <span className="h-[5px] flex-1 rounded-full bg-[#075f48]" />
                  <span className="h-[5px] flex-1 rounded-full bg-[#dfe7e2]" />
                </div>
                <p className="m-0 text-[11px] font-black uppercase tracking-[.12em] text-[#075f48]">Create your account</p>
                <h2 className="mt-2 text-[34px] font-black leading-[1.05] tracking-[-.025em] text-[#063e30]">Join FarmConnect</h2>
                <p className="mb-6 mt-2 text-[13px] leading-[1.5] text-[#6b7872]">{message}</p>

                <div className="grid gap-0 min-[480px]:grid-cols-2 min-[480px]:gap-3">
                  <Field label="First name"><input value={signupForm.firstName} onChange={e=>setSignupForm(current=>({...current,firstName:e.target.value}))} placeholder="First name" className={inputClass} /></Field>
                  <Field label="Last name"><input value={signupForm.lastName} onChange={e=>setSignupForm(current=>({...current,lastName:e.target.value}))} placeholder="Last name" className={inputClass} /></Field>
                </div>
                <Field label="Birthdate"><input value={signupForm.birthdate} onChange={e=>syncSignupBirthdate(e.currentTarget.value)} onInput={e=>syncSignupBirthdate(e.currentTarget.value)} onBlur={e=>syncSignupBirthdate(e.currentTarget.value)} type="date" autoComplete="bday" className={inputClass} /></Field>
                <Field label="Mobile number"><input value={signupForm.phone} onChange={e=>setSignupForm(current=>({...current,phone:e.target.value}))} type="tel" autoComplete="tel" placeholder="09XX XXX XXXX" className={inputClass} /></Field>
                <Field label="Email address"><input value={signupForm.email} onChange={e=>{setSignupForm(current=>({...current,email:e.target.value}));setSignupError("");}} type="email" autoComplete="email" placeholder="name@domain.com" className={inputClass} /></Field>
                <Field label="Create password">
                  <div className="relative">
                    <input value={signupForm.password} onChange={e=>setSignupForm(current=>({...current,password:e.target.value}))} type={showSignupPassword ? "text" : "password"} autoComplete="new-password" placeholder="At least 8 characters" className={inputClass + " pr-[72px]"} />
                    <button type="button" onClick={() => setShowSignupPassword(value => !value)} className="absolute right-2 top-2 grid h-[35px] place-items-center rounded-[9px] bg-[#edf7f2] px-[9px] text-[10px] font-black text-[#075f48]">{showSignupPassword ? "Hide" : "Show"}</button>
                  </div>
                </Field>

                <label className="mt-[14px] flex items-start gap-2 text-[10px] leading-[1.45] text-[#63736c]">
                  <input checked={signupForm.consent} onChange={e=>setSignupForm(current=>({...current,consent:e.target.checked}))} type="checkbox" className="mt-0.5 accent-[#075f48]" />
                  <span>I agree to the <b className="text-[#075f48]">Terms of Use</b> and <b className="text-[#075f48]">Privacy Policy</b>.</span>
                </label>

                {signupError && <p role="alert" aria-live="assertive" className="mt-3 rounded-[12px] border border-[#efb7ad] bg-[#fff3f0] px-3 py-2 text-[11px] font-bold leading-[1.45] text-[#9d2d20]">{signupError}</p>}

                <button type="button" onClick={signUp} disabled={loading} className="mt-[21px] grid h-[52px] w-full place-items-center rounded-[14px] bg-[linear-gradient(105deg,#075f48,#078065)] font-black text-white shadow-[0_11px_25px_rgba(7,95,72,.20)] transition hover:-translate-y-px hover:shadow-[0_14px_28px_rgba(7,95,72,.26)] disabled:opacity-60">{loading ? "Creating..." : "Create Account"}</button>
                <p className="mt-5 text-center text-xs text-[#6b7872]">Already have an account?
                  <button type="button" onClick={() => setMode("login")} className="ml-1 bg-transparent p-0 font-black text-[#075f48]">Sign In</button>
                </p>
                <BlankFooterSpace />
              </form>
            </section>
          </div>
        </section>
      </section>
    </main>
  );
}

export default function PublicHomePage() {
  const benefits = [
    ["/farmconnect/roosters/fc-stage-1-chick-base.jpg", "Choose your rooster", "Pick the breed and care option that fits you."],
    ["/farmconnect/home/rooster-updates.png", "Follow its growth", "See its growth day, weight, health, and latest farm update."],
    ["/farmconnect/home/secure-wallet.png", "Stay in control", "Review care records, request a sale, and track your Wallet."],
  ];
  return (
    <main className="min-h-screen bg-[#f5f1e5] text-[#113d2d]">
      <header className="sticky top-0 z-40 border-b border-white/20 bg-[#075f48]/95 text-white shadow-lg backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-3">
            <img src="/farmconnect/home/farmconnect-brand-mark.png" alt="FarmConnect" className="h-11 w-11 rounded-2xl bg-white object-cover" />
            <div><b className="block text-lg leading-none">FarmConnect</b><small className="font-bold text-emerald-100">Your rooster, within reach</small></div>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/login" className="rounded-xl border border-white/40 px-4 py-2 text-sm font-black">Sign In</Link>
            <Link href="/signup" className="rounded-xl bg-[#ffd84a] px-4 py-2 text-sm font-black text-[#173d2e]">Get Started</Link>
          </div>
        </div>
      </header>

      <section className="relative isolate overflow-hidden bg-[#064d3b] text-white">
        <div className="absolute inset-0 -z-20 bg-[url('/farmconnect/farmconnect-hero-wallpaper.jpg')] bg-cover bg-center" />
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(3,48,36,.96),rgba(3,48,36,.76),rgba(3,48,36,.18))]" />
        <div className="mx-auto grid min-h-[670px] max-w-7xl items-center gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[1.05fr_.95fr]">
          <div>
            <p className="text-xs font-black uppercase tracking-[.18em] text-[#ffe37a]">Rooster ownership made easier</p>
            <h1 className="mt-4 max-w-3xl text-5xl font-black leading-[.94] tracking-[-.045em] sm:text-7xl">Your rooster, cared for every day—even when you’re away.</h1>
            <p className="mt-6 max-w-2xl text-base font-bold leading-7 text-emerald-50/90 sm:text-lg">Choose your rooster, follow its growth, receive clear care updates, and manage its journey from your phone.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/signup" className="rounded-2xl bg-[#ffd84a] px-6 py-4 font-black text-[#173d2e] shadow-xl">Get Your Rooster</Link>
              <a href="#care" className="rounded-2xl border border-white/40 bg-white/10 px-6 py-4 font-black backdrop-blur">See How Care Works</a>
              <InstallFarmConnectButton className="rounded-2xl border border-white/40 bg-white px-6 py-4 font-black text-[#07563f]" />
            </div>
          </div>
          <div className="mx-auto w-full max-w-lg rounded-[34px] border border-white/30 bg-white/95 p-4 text-[#163d2e] shadow-2xl sm:p-6">
            <img src="/farmconnect/roosters/fc-rooster-hero.jpg" alt="FarmConnect rooster" className="h-72 w-full rounded-[26px] object-cover" />
            <div className="mt-4 flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase text-[#748279]">Your rooster</p><h2 className="text-3xl font-black">Premium Rooster</h2><p className="mt-1 font-bold text-[#6a776e]">Growing healthy • Care updated today</p></div><span className="rounded-full bg-emerald-100 px-3 py-2 text-xs font-black text-emerald-800">In Care</span></div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center"><div className="rounded-xl bg-[#f4f1e7] p-3"><b className="block text-lg">Day 60</b><small className="font-bold">Growth</small></div><div className="rounded-xl bg-[#f4f1e7] p-3"><b className="block text-lg">Healthy</b><small className="font-bold">Condition</small></div><div className="rounded-xl bg-[#f4f1e7] p-3"><b className="block text-lg">Updated</b><small className="font-bold">Care Log</small></div></div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
        <p className="text-xs font-black uppercase tracking-[.16em] text-[#16704f]">Built around your rooster</p>
        <h2 className="mt-3 max-w-3xl text-4xl font-black tracking-[-.035em] sm:text-5xl">Stay part of its journey without being at the farm every day.</h2>
        <div className="mt-9 grid gap-5 md:grid-cols-3">{benefits.map(([src,title,text])=><article key={title} className="rounded-[28px] bg-white p-5 shadow-lg"><img src={src} alt="" className="h-48 w-full rounded-[22px] object-cover" /><h3 className="mt-5 text-2xl font-black">{title}</h3><p className="mt-2 font-bold leading-7 text-[#69766e]">{text}</p></article>)}</div>
      </section>

      <section id="care" className="bg-[#0a5d46] px-5 py-16 text-white sm:px-8">
        <div className="mx-auto max-w-7xl"><p className="text-xs font-black uppercase tracking-[.16em] text-[#ffe37a]">Care that fits you</p><h2 className="mt-3 text-4xl font-black sm:text-5xl">Choose when and how your rooster is cared for.</h2>
          <div className="mt-9 grid gap-5 md:grid-cols-2"><article className="rounded-[28px] bg-white/10 p-7 ring-1 ring-white/20"><p className="text-sm font-black text-[#ffe37a]">DAILY CARE</p><h3 className="mt-2 text-3xl font-black">Care when you need it</h3><p className="mt-3 font-bold leading-7 text-emerald-50">Request a scheduled care service and receive a clear record of what was done.</p></article><article className="rounded-[28px] bg-[#ffd84a] p-7 text-[#173d2e]"><p className="text-sm font-black">MONTHLY CARE</p><h3 className="mt-2 text-3xl font-black">Thirty days of organized care</h3><p className="mt-3 font-bold leading-7">Daily caretaker work continues while you follow the updates, evidence, weight, and health from your account.</p></article></div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-5 py-20 text-center sm:px-8"><p className="text-xs font-black uppercase tracking-[.16em] text-[#16704f]">Your rooster’s journey</p><h2 className="mt-3 text-4xl font-black sm:text-6xl">You own the rooster. FarmConnect helps you stay part of its journey.</h2><div className="mt-8 flex flex-wrap justify-center gap-3"><Link href="/signup" className="rounded-2xl bg-[#0a7654] px-7 py-4 font-black text-white">Start With a Rooster</Link><Link href="/login" className="rounded-2xl border border-[#aab9ae] bg-white px-7 py-4 font-black">Sign In</Link></div></section>

      <footer className="bg-[#063f31] px-5 py-8 text-white sm:px-8"><div className="mx-auto flex max-w-7xl flex-col justify-between gap-5 sm:flex-row sm:items-center"><div><b className="text-xl">FarmConnect</b><p className="mt-1 text-sm font-bold text-emerald-100">Rooster ownership, care, and trusted updates.</p></div><div className="flex flex-wrap gap-4 text-sm font-black"><Link href="/caretaker-careers">Work With Us</Link><Link href="/apply-caretaker">Apply as Caretaker</Link><Link href="/login">Sign In</Link></div></div></footer>
    </main>
  );
}

const inputClass = "h-[51px] w-full rounded-[13px] border border-[#dce5df] bg-white px-[14px] text-[13px] font-bold outline-none transition focus:border-[#1c9774] focus:shadow-[0_0_0_4px_rgba(28,151,116,.11)]";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="mt-[14px]"><label className="mb-[7px] block text-[11px] font-black text-[#34473f]">{label}</label>{children}</div>;
}

function MobileBrand() {
  return (
    <div className="mb-7 flex items-center gap-3 text-[#075f48] min-[820px]:hidden">
      <div className="grid h-[47px] w-[47px] place-items-center rounded-[18px] border border-[#dce5df] bg-white">
        <img src="/farmconnect/home/farmconnect-brand-mark.png" alt="" className="h-full w-full rounded-[15px] object-cover" />
      </div>
      <strong className="text-lg">FarmConnect</strong>
    </div>
  );
}

function Divider() {
  return <div className="my-[19px] flex items-center gap-[10px] text-[10px] font-black text-[#92a098] before:h-px before:flex-1 before:bg-[#e0e7e2] after:h-px after:flex-1 after:bg-[#e0e7e2]">OR</div>;
}

function BlankFooterSpace() {
  return <div className="mt-5 h-[92px]" aria-hidden="true" />;
}
