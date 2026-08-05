"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type GatewayMode = "read" | "write" | "migration";

const starterSql = `select
  'profiles' as object_name,
  to_regclass('public.profiles') is not null as exists
union all
select
  'manual_payment_requests',
  to_regclass('public.manual_payment_requests') is not null
union all
select
  'farm_care_requests',
  to_regclass('public.farm_care_requests') is not null;`;

function formatResult(value: unknown) {
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}

function gatewayErrorMessage(payload: { error?: string; hint?: string }, status: number) {
  if (payload.error === "INVALID_GATEWAY_TOKEN") {
    return "Blocked: gateway token mismatch. Paste the active token or restart the deployed environment after env changes.";
  }
  if (payload.error === "MISSING_ADMIN_SESSION") {
    return "Blocked: login as active admin first.";
  }
  if (payload.error === "ADMIN_ACTIVE_PROFILE_REQUIRED") {
    return "Blocked: this login is not an active admin profile.";
  }
  return `Blocked: ${payload.error || status}${payload.hint ? ` - ${payload.hint}` : ""}`;
}

export default function KaFarmSqlGatewayPage() {
  const [sql, setSql] = useState(starterSql);
  const [mode, setMode] = useState<GatewayMode>("read");
  const [gatewayToken, setGatewayToken] = useState("");
  const [confirmDanger, setConfirmDanger] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");
  const [status, setStatus] = useState("Paste SQL, choose mode, then run. Dev-only tool.");

  const looksDangerous = useMemo(
    () => /\b(drop\s+table|truncate|delete\s+from|update\s+auth\.|alter\s+role)\b/i.test(sql),
    [sql]
  );

  async function runSql() {
    setBusy(true);
    setStatus("Checking admin session and running through KaFarm gateway...");
    setResult("");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        setStatus("Blocked: login as active admin first.");
        return;
      }

      const response = await fetch("/api/kafarm/sql-gateway", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${accessToken}`,
          "x-kafarm-gateway-token": gatewayToken.trim(),
        },
        body: JSON.stringify({ sql, mode, confirmDanger }),
      });

      const payload = await response.json();
      setResult(formatResult(payload));
      setStatus(response.ok ? "Done. Output returned from FarmConnect Supabase." : gatewayErrorMessage(payload, response.status));
    } catch (error) {
      setStatus("Gateway request failed before reaching Supabase.");
      setResult(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function copyOutput() {
    await navigator.clipboard?.writeText(result || status);
    setStatus("Copied output.");
  }

  return (
    <main className="min-h-screen bg-[#f6f3e8] px-4 py-6 text-[#17251d]">
      <section className="mx-auto max-w-7xl">
        <div className="rounded-3xl border border-amber-300 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase text-amber-700">Temporary Dev Tool</p>
              <h1 className="mt-1 text-3xl font-black">KaFarm SQL Gateway</h1>
              <p className="mt-2 max-w-3xl text-sm font-bold leading-6 text-[#667267]">
                FarmConnect-only gateway. Server-side service role only. Disable or delete before real production users.
              </p>
            </div>
            <Link href="/admin/kafarm" className="rounded-2xl bg-[#1f6b45] px-4 py-3 text-sm font-black text-white">
              Back to KaFarm
            </Link>
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(560px,1fr)_360px]">
            <div className="rounded-3xl border border-[#e3ded0] bg-[#fffdf7] p-4">
              <div className="flex flex-wrap items-center gap-2">
                {(["read", "write", "migration"] as GatewayMode[]).map(item => (
                  <button
                    key={item}
                    onClick={() => setMode(item)}
                    className={"rounded-xl px-4 py-2 text-sm font-black " + (mode === item ? "bg-[#1f6b45] text-white" : "bg-[#eee8d9]")}
                  >
                    {item === "read" ? "Read Only" : item === "write" ? "Write SQL" : "Migration"}
                  </button>
                ))}
              </div>

              <label className="mt-4 block text-sm font-black">SQL</label>
              <textarea
                value={sql}
                onChange={event => setSql(event.target.value)}
                spellCheck={false}
                className="mt-2 min-h-[460px] w-full rounded-2xl border border-[#ded8c9] bg-white p-4 font-mono text-sm leading-6 outline-none focus:border-[#1f6b45]"
              />
            </div>

            <aside className="grid content-start gap-4">
              <div className="rounded-3xl border border-[#e3ded0] bg-white p-4">
                <p className="text-xs font-black uppercase text-[#667267]">Gateway Token</p>
                <input
                  value={gatewayToken}
                  onChange={event => setGatewayToken(event.target.value)}
                  type="password"
                  placeholder="Paste KAFARM_SQL_GATEWAY_TOKEN"
                  className="mt-2 w-full rounded-2xl border border-[#ded8c9] px-4 py-3 text-sm font-bold"
                />
                <p className="mt-2 text-xs font-bold leading-5 text-[#667267]">
                  This is not your Supabase key. It is only the extra gateway password from `.env.local`.
                </p>
              </div>

              <div className="rounded-3xl border border-[#e3ded0] bg-white p-4">
                <p className="text-xs font-black uppercase text-[#667267]">Safety</p>
                <label className={"mt-3 flex gap-3 rounded-2xl p-3 text-sm font-bold " + (looksDangerous ? "bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-900")}>
                  <input
                    checked={confirmDanger}
                    onChange={event => setConfirmDanger(event.target.checked)}
                    type="checkbox"
                    className="mt-1"
                  />
                  Confirm dangerous SQL if intentionally needed.
                </label>
                <p className="mt-3 text-xs font-bold leading-5 text-[#667267]">
                  Read mode blocks writes. Destructive SQL is blocked unless confirmed and accepted by the server route.
                </p>
              </div>

              <button
                onClick={runSql}
                disabled={busy}
                className={"rounded-2xl px-5 py-4 text-sm font-black text-white shadow-sm " + (busy ? "bg-[#7f9b8d]" : "bg-[#1f6b45]")}
              >
                {busy ? "Running..." : "Run SQL"}
              </button>

              <button onClick={copyOutput} className="rounded-2xl bg-[#eee8d9] px-5 py-4 text-sm font-black">
                Copy Output
              </button>
            </aside>
          </div>
        </div>

        <div className="mt-5 rounded-3xl border border-[#e3ded0] bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase text-[#667267]">Status</p>
              <h2 className="mt-1 text-xl font-black">{status}</h2>
            </div>
            <span className="rounded-full bg-amber-100 px-3 py-2 text-xs font-black text-amber-800">DEV ONLY</span>
          </div>
          <pre className="mt-4 max-h-[520px] overflow-auto rounded-2xl bg-[#111] p-4 text-xs leading-6 text-emerald-100">
            {result || "Output will appear here."}
          </pre>
        </div>
      </section>
    </main>
  );
}
