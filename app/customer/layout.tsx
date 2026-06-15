"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const RESTRICTED_PATHS = [
  "/customer/chicks",
  "/customer/wallet",
  "/customer/marketplace",
  "/customer/caretakers",
  "/customer/sell-chicken",
  "/customer/inventory",
  "/customer/weight-updates",
  "/customer/photo-updates",
  "/customer/live-camera",
];

const PUBLIC_PATHS = [
  "/customer/login",
  "/customer/register",
  "/customer/membership",
  "/customer/customer-service",
  "/customer/settings",
  "/customer/notifications",
  "/customer/dashboard",
];

export default function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    checkAccess();
  }, [pathname]);

  function getProfileId() {
    if (typeof window === "undefined") return "";

    const rawUser = localStorage.getItem("farmconnect_user");

    const directId =
      localStorage.getItem("farmconnect_profile_id") ||
      localStorage.getItem("profile_id") ||
      localStorage.getItem("customer_id") ||
      "";

    if (directId) return directId;

    if (rawUser) {
      try {
        const parsed = JSON.parse(rawUser);
        return parsed?.id || parsed?.profile_id || parsed?.customer_id || "";
      } catch {
        return "";
      }
    }

    return "";
  }

  function isRestrictedPath(path: string) {
    return RESTRICTED_PATHS.some((restrictedPath) =>
      path.startsWith(restrictedPath)
    );
  }

  function isPublicPath(path: string) {
    return PUBLIC_PATHS.some((publicPath) => path.startsWith(publicPath));
  }

  async function checkAccess() {
    setChecking(true);

    if (!isRestrictedPath(pathname)) {
      setAllowed(true);
      setChecking(false);
      return;
    }

    const profileId = getProfileId();

    if (!profileId) {
      setAllowed(false);
      setChecking(false);
      router.replace("/customer/login");
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select(
        "id,full_name,email,phone,wallet_balance,verification_status,membership_status,membership_expiry,account_status"
      )
      .eq("id", profileId)
      .maybeSingle();

    if (error || !data) {
      localStorage.removeItem("farmconnect_user");
      localStorage.removeItem("farmconnect_profile_id");
      localStorage.removeItem("profile_id");
      localStorage.removeItem("customer_id");

      setAllowed(false);
      setChecking(false);
      router.replace("/customer/login");
      return;
    }

    localStorage.setItem("farmconnect_user", JSON.stringify(data));
    localStorage.setItem("farmconnect_profile_id", data.id);
    localStorage.setItem("profile_id", data.id);
    localStorage.setItem("customer_id", data.id);

    const membershipActive =
      String(data.membership_status || "").toUpperCase() === "ACTIVE";

    const kycApproved =
      String(data.verification_status || "").toUpperCase() === "APPROVED";

    const accountActive =
      String(data.account_status || "").toUpperCase() === "ACTIVE";

    if (!membershipActive || !kycApproved || !accountActive) {
      setAllowed(false);
      setChecking(false);
      router.replace("/customer/membership");
      return;
    }

    setAllowed(true);
    setChecking(false);
  }

  if (checking && isRestrictedPath(pathname)) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-green-50 via-white to-yellow-50 p-6">
        <div className="mx-auto mt-20 max-w-xl rounded-3xl bg-white p-8 text-center shadow-xl">
          <h1 className="text-2xl font-black text-green-900">
            Checking FarmConnect access...
          </h1>
          <p className="mt-2 font-semibold text-slate-500">
            Verifying membership, KYC, and account status.
          </p>
        </div>
      </main>
    );
  }

  if (!allowed && isRestrictedPath(pathname)) {
    return null;
  }

  return <>{children}</>;
}