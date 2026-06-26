"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type BackendRole = "ADMIN" | "CARETAKER" | "CUSTOMER";

type Customer = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone?: string | null;
  account_status?: string | null;
  created_at?: string | null;
};

type RoleMap = Record<string, BackendRole>;

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [roleMap, setRoleMap] = useState<RoleMap>({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function loadCustomers() {
    setLoading(true);
    setMessage("");

    const { data: profileRows, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, email, phone, account_status, created_at")
      .order("created_at", { ascending: false });

    if (profileError) {
      setMessage(profileError.message);
      setLoading(false);
      return;
    }

    const profiles = (profileRows || []) as Customer[];
    const ids = profiles.map((p) => p.id).filter(Boolean);
    const emails = profiles.map((p) => p.email).filter(Boolean) as string[];

    const [adminResult, caretakerResult] = await Promise.all([
      supabase
        .from("admins")
        .select("admin_profile_id, email, status")
        .in("admin_profile_id", ids)
        .eq("status", "ACTIVE"),

      supabase
        .from("caretakers")
        .select("caretaker_profile_id, email, status")
        .or(
          [
            ids.length ? `caretaker_profile_id.in.(${ids.join(",")})` : "",
            emails.length ? `email.in.(${emails.join(",")})` : "",
          ]
            .filter(Boolean)
            .join(",")
        )
        .eq("status", "ACTIVE"),
    ]);

    const nextRoleMap: RoleMap = {};

    profiles.forEach((customer) => {
      nextRoleMap[customer.id] = "CUSTOMER";
    });

    (caretakerResult.data || []).forEach((caretaker: any) => {
      const matched = profiles.find(
        (customer) =>
          customer.id === caretaker.caretaker_profile_id ||
          customer.email === caretaker.email
      );

      if (matched) nextRoleMap[matched.id] = "CARETAKER";
    });

    (adminResult.data || []).forEach((admin: any) => {
      const matched = profiles.find(
        (customer) => customer.id === admin.admin_profile_id
      );

      if (matched) nextRoleMap[matched.id] = "ADMIN";
    });

    setCustomers(profiles);
    setRoleMap(nextRoleMap);
    setLoading(false);
  }

  async function makeCaretaker(customer: Customer) {
    if (!customer.email) return alert("Customer email is required.");

    const { error } = await supabase.from("caretakers").upsert(
      {
        caretaker_profile_id: customer.id,
        email: customer.email,
        full_name: customer.full_name || customer.email,
        status: "ACTIVE",
      },
      { onConflict: "caretaker_profile_id" }
    );

    if (error) return alert(error.message);

    alert(`${customer.full_name || customer.email} is now CARETAKER.`);
    await loadCustomers();
  }

  useEffect(() => {
    loadCustomers();
  }, []);

  const summary = useMemo(() => {
    return {
      total: customers.length,
      admins: Object.values(roleMap).filter((r) => r === "ADMIN").length,
      caretakers: Object.values(roleMap).filter((r) => r === "CARETAKER").length,
      customers: Object.values(roleMap).filter((r) => r === "CUSTOMER").length,
    };
  }, [customers, roleMap]);

  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-900">
      <div className="mx-auto max-w-7xl">
        <section className="mb-6 rounded-3xl bg-white p-6 shadow">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-green-700">
            FarmConnect Admin
          </p>
          <h1 className="mt-2 text-4xl font-black">Customers</h1>
          <p className="mt-2 font-bold text-slate-500">
            Customer records with backend role detection from admins and caretakers.
          </p>
        </section>

        {message && (
          <div className="mb-6 rounded-2xl bg-red-50 p-4 font-bold text-red-700">
            {message}
          </div>
        )}

        <section className="mb-6 grid gap-4 md:grid-cols-4">
          <Stat label="Total Profiles" value={summary.total} />
          <Stat label="Admins" value={summary.admins} />
          <Stat label="Caretakers" value={summary.caretakers} />
          <Stat label="Customers" value={summary.customers} />
        </section>

        <section className="rounded-3xl bg-white p-6 shadow">
          {loading ? (
            <p className="font-bold">Loading customers...</p>
          ) : customers.length === 0 ? (
            <p className="font-bold text-slate-500">No customers found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-slate-500">
                    <th className="p-3">Customer</th>
                    <th className="p-3">Email</th>
                    <th className="p-3">Role</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Created</th>
                    <th className="p-3">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {customers.map((customer) => (
                    <tr key={customer.id} className="border-b">
                      <td className="p-3 font-black">
                        {customer.full_name || "Unnamed Customer"}
                      </td>
                      <td className="p-3">{customer.email || "-"}</td>
                      <td className="p-3">
                        <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-black text-green-800">
                          {roleMap[customer.id] || "CUSTOMER"}
                        </span>
                      </td>
                      <td className="p-3">{customer.account_status || "PENDING"}</td>
                      <td className="p-3">
                        {customer.created_at
                          ? new Date(customer.created_at).toLocaleDateString("en-PH")
                          : "-"}
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-2">
                          <Link
                            href={`/admin/customers/${customer.id}`}
                            className="rounded-xl bg-slate-900 px-3 py-2 font-black text-white"
                          >
                            View
                          </Link>

                          {roleMap[customer.id] !== "ADMIN" &&
                            roleMap[customer.id] !== "CARETAKER" && (
                              <button
                                onClick={() => makeCaretaker(customer)}
                                className="rounded-xl bg-green-700 px-3 py-2 font-black text-white"
                              >
                                Make Caretaker
                              </button>
                            )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-3xl bg-white p-5 shadow">
      <p className="text-sm font-black text-slate-500">{label}</p>
      <h2 className="mt-2 text-3xl font-black">{value}</h2>
    </div>
  );
}