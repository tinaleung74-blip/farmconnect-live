// app/customer/layout.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { isActiveCustomer, resolveCustomerProfile } from "@/lib/customer-auth";

const PUBLIC_PATHS = [
  "/customer/login",
  "/customer/register",
  "/customer/membership",
  "/customer/customer-service",
];

const nav = [
  ["🏠", "Dashboard", "/customer/dashboard"],
  ["🐓", "My Flock", "/customer/chicks"],
  ["📦", "Inventory", "/customer/inventory"],
  ["🛒", "Marketplace", "/customer/marketplace"],
  ["💳", "Wallet", "/customer/wallet"],
  ["🏷️", "Sell", "/customer/sell-chicken"],
  ["🎧", "Support", "/customer/customer-service"],
];

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  const isPublic = useMemo(
    () => PUBLIC_PATHS.some((path) => pathname.startsWith(path)) || pathname === "/customer",
    [pathname],
  );

  useEffect(() => {
    let mounted = true;

    async function checkAccess() {
      setChecking(true);

      if (isPublic) {
        if (mounted) {
          setAllowed(true);
          setChecking(false);
        }
        return;
      }

      const profile = await resolveCustomerProfile();
      if (!mounted) return;

      if (!profile) {
        setAllowed(false);
        setChecking(false);
        router.replace("/customer/login");
        return;
      }

      if (!isActiveCustomer(profile)) {
        setAllowed(false);
        setChecking(false);
        router.replace("/customer/membership");
        return;
      }

      setAllowed(true);
      setChecking(false);
    }

    checkAccess();

    return () => {
      mounted = false;
    };
  }, [isPublic, pathname, router]);

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/customer/login");
  }

  if (checking && !isPublic) {
    return (
      <main className="min-h-screen bg-[#03140b] p-6 text-white">
        <div className="mx-auto mt-24 max-w-lg rounded-[34px] border border-white/10 bg-white/10 p-8 text-center shadow-2xl backdrop-blur-xl">
          <h1 className="text-2xl font-black">Checking FarmConnect access...</h1>
          <p className="mt-2 text-emerald-100">Verifying your customer account.</p>
        </div>
      </main>
    );
  }

  if (!allowed && !isPublic) return null;

  return (
    <div className="min-h-screen bg-[#03140b]">
      {!isPublic && (
        <header className="sticky top-0 z-50 border-b border-white/10 bg-[#03140b]/85 px-4 py-3 text-white backdrop-blur-2xl">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
            <Link href="/customer/dashboard" className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-500/20 text-2xl">
                🐔
              </span>
              <div>
                <p className="font-black leading-none">FarmConnect Live</p>
                <p className="mt-1 text-xs font-bold text-white/50">Customer App</p>
              </div>
            </Link>

            <nav className="hidden items-center gap-1 lg:flex">
              {nav.map(([icon, label, href]) => {
                const active = pathname === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`rounded-full px-4 py-2 text-sm font-black transition ${
                      active
                        ? "bg-amber-300 text-emerald-950"
                        : "text-white/70 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    {icon} {label}
                  </Link>
                );
              })}
            </nav>

            <button
              onClick={signOut}
              className="rounded-full border border-white/10 bg-white/10 px-5 py-3 text-sm font-black text-white hover:bg-white/20"
            >
              Logout
            </button>
          </div>
        </header>
      )}

      {children}

      {!isPublic && (
        <nav className="fixed bottom-4 left-1/2 z-50 flex w-[calc(100%-24px)] max-w-2xl -translate-x-1/2 justify-between rounded-full border border-white/15 bg-[#03140b]/95 p-2 text-xs font-black text-white shadow-2xl backdrop-blur-2xl lg:hidden">
          {nav.slice(0, 5).map(([icon, label, href]) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-1 flex-col items-center rounded-full px-2 py-2 ${
                  active ? "bg-amber-300 text-emerald-950" : "text-white/75"
                }`}
              >
                <span>{icon}</span>
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}