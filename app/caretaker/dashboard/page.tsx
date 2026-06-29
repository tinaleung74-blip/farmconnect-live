"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type PaidAssignment = {
  id: string;
  profile_id: string;
  caretaker_id: string;
  caretaker_name: string;
  flock_id: string | null;
  duration_days: number;
  rate_per_chick: number;
  total_chicks: number;
  total_fee: number;
  status: string;
  payment_status: string;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
};

type CaretakerProfile = {
  id: string;
  caretaker_profile_id: string | null;
  email: string | null;
  full_name: string;
  status: string | null;
  level: string | null;
};

const navLinks = [
  { href: "/caretaker", label: "Dashboard" },
  { href: "/caretaker/tasks", label: "Tasks" },
  { href: "/caretaker/feeding", label: "Feeding" },
  { href: "/caretaker/photos", label: "Photos" },
  { href: "/caretaker/weight", label: "Weight" },
  { href: "/caretaker/mortality", label: "Mortality" },
  { href: "/caretaker/notes", label: "Notes" },
];

const quickActions = [
  { title: "Feeding", icon: "🌽", desc: "Submit daily feed log", href: "/caretaker/feeding", color: "from-yellow-400 to-orange-500" },
  { title: "Weight", icon: "⚖️", desc: "Upload latest weight", href: "/caretaker/weight", color: "from-sky-400 to-blue-600" },
  { title: "Photos", icon: "📸", desc: "Send farm photo update", href: "/caretaker/photos", color: "from-pink-400 to-rose-600" },
  { title: "Mortality", icon: "🐔", desc: "Report lost/dead chicken", href: "/caretaker/mortality", color: "from-orange-500 to-red-600" },
  { title: "Notes", icon: "📝", desc: "Send concern to admin", href: "/caretaker/notes", color: "from-violet-400 to-purple-600" },
];

export default function CaretakerDashboard() {
  const [loading, setLoading] = useState(true);
  const [assignments, setAssignments] = useState<PaidAssignment[]>([]);
  const [caretaker, setCaretaker] = useState<CaretakerProfile | null>(null);
  const [caretakerId, setCaretakerId] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const activeAssignmentCount = assignments.length;

  const totalChicks = useMemo(() => {
    return assignments.reduce((sum, item) => sum + Number(item.total_chicks || 0), 0);
  }, [assignments]);

  useEffect(() => {
    initializeDashboard();
  }, []);

  async function initializeDashboard() {
    setLoading(true);
    setErrorMessage("");

    const resolvedCaretaker = await resolveLoggedInCaretaker();

    if (!resolvedCaretaker) {
      setCaretakerId("");
      setCaretaker(null);
      setAssignments([]);
      setLoading(false);
      return;
    }

    setCaretaker(resolvedCaretaker);
    setCaretakerId(resolvedCaretaker.id);
    await loadPaidAssignments(resolvedCaretaker.id);
    setLoading(false);
  }

  async function resolveLoggedInCaretaker() {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    const authUser = authData?.user;

    if (authError || !authUser) {
      setErrorMessage("Please login again so FarmConnect can verify your caretaker account.");
      return null;
    }

    const selectFields = "id,caretaker_profile_id,email,full_name,status,level";

    const { data: profileMatch, error: profileError } = await supabase
      .from("caretakers")
      .select(selectFields)
      .eq("caretaker_profile_id", authUser.id)
      .maybeSingle();

    if (profileError) {
      setErrorMessage(`Caretaker profile lookup error: ${profileError.message}`);
      return null;
    }

    if (profileMatch) return profileMatch as CaretakerProfile;

    if (!authUser.email) {
      setErrorMessage("No caretaker profile found for this login. Please ask Admin to link your account.");
      return null;
    }

    const { data: emailMatch, error: emailError } = await supabase
      .from("caretakers")
      .select(selectFields)
      .eq("email", authUser.email)
      .maybeSingle();

    if (emailError) {
      setErrorMessage(`Caretaker email lookup error: ${emailError.message}`);
      return null;
    }

    if (!emailMatch) {
      setErrorMessage("No caretaker profile found for this login. Please ask Admin to link your caretaker profile.");
      return null;
    }

    return emailMatch as CaretakerProfile;
  }

  async function loadPaidAssignments(currentCaretakerId: string) {
    const { data, error } = await supabase
      .from("customer_caretaker_hires")
      .select(
        "id,profile_id,caretaker_id,caretaker_name,flock_id,duration_days,rate_per_chick,total_chicks,total_fee,status,payment_status,start_date,end_date,created_at",
      )
      .eq("caretaker_id", currentCaretakerId)
      .eq("status", "ACTIVE")
      .eq("payment_status", "PAID")
      .order("created_at", { ascending: false });

    if (error) {
      setAssignments([]);
      setErrorMessage(`Paid assignment load error: ${error.message}`);
      return;
    }

    setAssignments((data || []) as PaidAssignment[]);
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/caretaker/login";
  }

  function formatPeso(amount: number | null | undefined) {
    return Number(amount || 0).toLocaleString("en-PH", {
      style: "currency",
      currency: "PHP",
      maximumFractionDigits: 0,
    });
  }

  function formatDate(date: string | null) {
    if (!date) return "Pending";
    return new Date(date).toLocaleDateString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#fff8dc] text-slate-950">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-20"
        style={{ backgroundImage: "url('/farmconnect-hero-wallpaper.jpg.jpg')" }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-white/90 via-yellow-50/85 to-yellow-100/90" />

      <section className="relative z-10 mx-auto max-w-7xl px-4 py-5 pb-28 md:px-8">
        <header className="sticky top-4 z-30 rounded-[28px] border border-yellow-200 bg-white/80 px-5 py-4 shadow-2xl backdrop-blur-xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Link href="/caretaker" className="text-xl font-black text-slate-950">
              🌾 FarmConnect Caretaker
            </Link>

            <nav className="hidden flex-wrap items-center gap-2 lg:flex">
              {navLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-full px-4 py-2 text-sm font-black text-slate-950/85 transition hover:bg-yellow-100 hover:text-slate-950"
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            <button
              onClick={signOut}
              className="rounded-full bg-yellow-400 px-5 py-2 text-sm font-black text-slate-950 transition hover:bg-yellow-300"
            >
              Logout
            </button>
          </div>
        </header>

        <section className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_.8fr]">
          <div className="rounded-[36px] border border-yellow-200 bg-white/85 p-7 shadow-2xl backdrop-blur-xl md:p-10">
            <p className="w-fit rounded-full bg-yellow-400 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-slate-950">
              Live Farm Operations
            </p>

            <h1 className="mt-5 text-4xl font-black leading-tight md:text-6xl">
              Good day, {caretaker?.full_name || "Ka-Farm"} 👨‍🌾
            </h1>

            <p className="mt-4 max-w-2xl text-lg font-semibold leading-8 text-slate-950/80">
              Monitor your assigned poultry jobs, submit daily farm updates, and keep Admin informed with real-time field reports.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/caretaker/tasks" className="rounded-2xl bg-yellow-400 px-6 py-4 font-black text-slate-950 shadow-xl transition hover:bg-yellow-300">
                View Tasks
              </Link>
              <Link href="/caretaker/feeding" className="rounded-2xl bg-yellow-400 px-6 py-4 font-black text-slate-950 shadow-xl transition hover:bg-amber-200">
                Submit Feeding
              </Link>
              <button
                onClick={initializeDashboard}
                className="rounded-2xl border border-yellow-200 bg-white px-6 py-4 font-black text-slate-950 transition hover:bg-yellow-50"
              >
                Refresh
              </button>
            </div>
          </div>

          <aside className="rounded-[36px] border border-yellow-200 bg-white/80 p-7 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.2em] text-yellow-600">
                  Status
                </p>
                <h2 className="mt-2 text-3xl font-black">
                  {loading ? "Checking..." : activeAssignmentCount > 0 ? "Assigned" : "Standby"}
                </h2>
              </div>
              <div className="grid h-20 w-20 place-items-center rounded-3xl bg-yellow-100 text-5xl">
                🐔
              </div>
            </div>

            <div className="mt-6 rounded-3xl border border-white/10 bg-yellow-50 p-5">
              <p className="text-sm font-bold text-slate-500">Caretaker ID</p>
              <p className="mt-2 text-2xl font-black text-slate-950">
                {caretakerId ? caretakerId.slice(0, 8) : "Missing"}
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-950/60">
                Used for assignment matching.
              </p>
            </div>
          </aside>
        </section>

        {errorMessage && (
          <div className="mt-6 rounded-3xl border border-red-200 bg-red-50 p-5 text-center font-black text-red-700 backdrop-blur-xl">
            {errorMessage}
          </div>
        )}

        <section className="mt-6 grid gap-4 md:grid-cols-3">
          <StatCard label="Paid Assignments" value={loading ? "..." : activeAssignmentCount} note="ACTIVE + PAID only" icon="📋" />
          <StatCard label="Chicks Under Care" value={loading ? "..." : totalChicks} note="Customer-owned poultry assets" icon="🐣" />
          <StatCard label="Farm Status" value={activeAssignmentCount > 0 ? "Live" : "Ready"} note="Realtime caretaker operations" icon="🟢" />
        </section>

        <section className="mt-6 rounded-[36px] border border-yellow-200 bg-white/80 p-6 shadow-2xl backdrop-blur-xl">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.2em] text-yellow-600">
                Quick Actions
              </p>
              <h2 className="mt-2 text-3xl font-black">Daily Farm Updates</h2>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            {quickActions.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="group rounded-[28px] border border-white/10 bg-white p-5 shadow-xl transition hover:-translate-y-1 hover:bg-yellow-50"
              >
                <div className={`grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br ${action.color} text-4xl shadow-lg transition group-hover:scale-110`}>
                  {action.icon}
                </div>
                <h3 className="mt-4 text-xl font-black">{action.title}</h3>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-950/65">
                  {action.desc}
                </p>
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-6 rounded-[36px] border border-yellow-200 bg-white/80 p-6 shadow-2xl backdrop-blur-xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.2em] text-yellow-600">
                New Paid Assignments
              </p>
              <h2 className="mt-2 text-3xl font-black">Caretaker Job Notifications</h2>
              <p className="mt-2 font-semibold text-slate-950/70">
                Approved and paid customer hire requests appear here automatically.
              </p>
            </div>

            <button
              onClick={initializeDashboard}
              className="rounded-2xl bg-yellow-400 px-6 py-4 font-black text-slate-950 shadow-xl transition hover:bg-yellow-300"
            >
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="mt-6 rounded-3xl bg-white/10 p-6 text-center font-black text-slate-950/80">
              Loading paid assignments...
            </div>
          ) : assignments.length === 0 ? (
            <div className="mt-6 rounded-3xl border border-yellow-200 bg-white p-8 text-center">
              <div className="text-6xl">🌾</div>
              <h3 className="mt-4 text-2xl font-black">No active paid assignment yet</h3>
              <p className="mx-auto mt-2 max-w-2xl font-semibold leading-7 text-slate-950/65">
                Once Admin approves and marks a customer caretaker request as paid, the job will appear here.
              </p>
            </div>
          ) : (
            <div className="mt-6 grid gap-4">
              {assignments.map((assignment) => (
                <div
                  key={assignment.id}
                  className="rounded-[30px] border border-emerald-300/15 bg-yellow-50 p-5 shadow-xl"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.2em] text-yellow-600">
                        Paid Customer Assignment
                      </p>
                      <h3 className="mt-2 text-2xl font-black">
                        {assignment.total_chicks} Premium Chicks
                      </h3>
                    </div>

                    <span className="rounded-full bg-emerald-400 px-4 py-2 text-sm font-black text-slate-950">
                      PAID
                    </span>
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-4">
                    <Info label="Customer" value={assignment.profile_id.slice(0, 8)} />
                    <Info label="Duration" value={`${assignment.duration_days} days`} />
                    <Info label="Total Fee" value={formatPeso(assignment.total_fee)} />
                    <Info label="Start" value={formatDate(assignment.start_date)} />
                  </div>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <Link href="/caretaker/feeding" className="rounded-2xl bg-yellow-400 px-5 py-3 font-black text-slate-950">
                      Submit Feeding
                    </Link>
                    <Link href="/caretaker/photos" className="rounded-2xl bg-white/10 px-5 py-3 font-black text-slate-950">
                      Upload Photo
                    </Link>
                    <Link href="/caretaker/weight" className="rounded-2xl bg-white/10 px-5 py-3 font-black text-slate-950">
                      Add Weight
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </section>

      <nav className="fixed bottom-4 left-1/2 z-40 flex w-[calc(100%-24px)] max-w-xl -translate-x-1/2 justify-around rounded-full border border-yellow-200 bg-white/95 p-2 text-xs font-black text-slate-950 shadow-2xl backdrop-blur-xl lg:hidden">
        {navLinks.slice(0, 5).map((item) => (
          <Link key={item.href} href={item.href} className="rounded-full px-3 py-2 hover:bg-yellow-100">
            {item.label}
          </Link>
        ))}
      </nav>
    </main>
  );
}

function StatCard({ label, value, note, icon }: { label: string; value: string | number; note: string; icon: string }) {
  return (
    <div className="rounded-[30px] border border-yellow-200 bg-white/80 p-6 shadow-xl backdrop-blur-xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.12em] text-emerald-100/70">
            {label}
          </p>
          <h2 className="mt-3 text-4xl font-black text-slate-950">{value}</h2>
          <p className="mt-2 font-semibold text-slate-950/60">{note}</p>
        </div>
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white/10 text-3xl">
          {icon}
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-yellow-50 p-4">
      <p className="text-xs font-black uppercase tracking-[0.15em] text-slate-500">{label}</p>
      <p className="mt-2 font-black text-slate-950">{value}</p>
    </div>
  );
}