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
  ["Dashboard", "/customer/dashboard"],
  ["My Flock", "/customer/chicks"],
  ["Marketplace", "/customer/marketplace"],
  ["Wallet", "/customer/wallet"],
  ["Sell", "/customer/sell-chicken"],
  ["Support", "/customer/customer-service"],
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
      <main className="min-h-screen bg-[#07150f] p-6 text-white">
        <div className="mx-auto mt-24 max-w-lg rounded-[32px] border border-emerald-300/20 bg-white/10 p-8 text-center shadow-2xl">
          <h1 className="text-2xl font-black">Checking FarmConnect access...</h1>
          <p className="mt-2 text-emerald-100">Verifying membership, KYC, and account status.</p>
        </div>
      </main>
    );
  }

  if (!allowed && !isPublic) return null;

  return (
    <>
      {!isPublic && (
        <header className="sticky top-0 z-40 border-b border-emerald-900/10 bg-[#07150f]/90 px-4 py-3 text-white backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
            <Link href="/customer/dashboard" className="font-black tracking-tight text-emerald-100">
              🐔 FarmConnect Live
            </Link>
            <nav className="hidden items-center gap-2 md:flex">
              {nav.map(([label, href]) => (
                <Link key={href} href={href} className="rounded-full px-4 py-2 text-sm font-bold text-emerald-50 hover:bg-white/10">
                  {label}
                </Link>
              ))}
            </nav>
            <button onClick={signOut} className="rounded-full bg-white/10 px-4 py-2 text-sm font-black text-white hover:bg-white/20">
              Logout
            </button>
          </div>
        </header>
      )}
      {children}
      {!isPublic && (
        <nav className="fixed bottom-4 left-1/2 z-40 flex w-[calc(100%-24px)] max-w-xl -translate-x-1/2 justify-around rounded-full border border-white/15 bg-[#07150f]/95 p-2 text-xs font-black text-white shadow-2xl backdrop-blur-xl md:hidden">
          {nav.slice(0, 5).map(([label, href]) => (
            <Link key={href} href={href} className="rounded-full px-3 py-2 hover:bg-white/10">
              {label}
            </Link>
          ))}
        </nav>
      )}
    </>
  );
}
