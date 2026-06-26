"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type PoultryCategory = "ALL" | "FEEDS" | "VITAMINS" | "VACCINES" | "SUPPLEMENTS";

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type Wallet = {
  id: string;
  profile_id: string;
  balance: number | null;
};

type MarketplaceProduct = {
  id: string;
  product_key?: string | null;
  name: string | null;
  price: number | null;
  note?: string | null;
  stock_status?: string | null;
  image_url?: string | null;
  icon?: string | null;
  category: string | null;
  unit?: string | null;
  status?: string | null;
  created_at?: string | null;
  stock?: number | null;
  available_stock?: number | null;
  stock_qty?: number | null;
  quantity?: number | null;
};

const CATEGORIES: PoultryCategory[] = [
  "ALL",
  "FEEDS",
  "VITAMINS",
  "VACCINES",
  "SUPPLEMENTS",
];

function peso(value: number) {
  return `₱${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function normalize(value: string | null | undefined) {
  return String(value || "").trim().toUpperCase();
}

function normalizeCategory(value: string | null | undefined): PoultryCategory {
  const raw = normalize(value);

  if (raw.includes("FEED")) return "FEEDS";
  if (raw.includes("VITAMIN")) return "VITAMINS";
  if (raw.includes("VACCINE")) return "VACCINES";
  if (raw.includes("SUPPLEMENT")) return "SUPPLEMENTS";

  if (
    raw === "FEEDS" ||
    raw === "VITAMINS" ||
    raw === "VACCINES" ||
    raw === "SUPPLEMENTS"
  ) {
    return raw as PoultryCategory;
  }

  return "ALL";
}

function getAvailableStock(product: MarketplaceProduct) {
  const numericStock =
    product.available_stock ??
    product.stock_qty ??
    product.stock ??
    product.quantity ??
    null;

  if (numericStock === null || numericStock === undefined) {
    return null;
  }

  return Number(numericStock || 0);
}

function isUnavailable(product: MarketplaceProduct) {
  const stockStatus = normalize(product.stock_status || "AVAILABLE");
  const stock = getAvailableStock(product);

  if (stock !== null && stock <= 0) return true;

  return (
    stockStatus === "OUT_OF_STOCK" ||
    stockStatus === "OUT OF STOCK" ||
    stockStatus === "UNAVAILABLE" ||
    stockStatus === "SOLD_OUT" ||
    stockStatus === "SOLD OUT"
  );
}

function productIcon(product: MarketplaceProduct) {
  const category = normalizeCategory(product.category);

  if (product.icon) return product.icon;
  if (category === "FEEDS") return "🌾";
  if (category === "VITAMINS") return "💊";
  if (category === "VACCINES") return "💉";
  if (category === "SUPPLEMENTS") return "🧪";

  return "🐔";
}

export default function MarketplacePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [products, setProducts] = useState<MarketplaceProduct[]>([]);
  const [activeCategory, setActiveCategory] = useState<PoultryCategory>("ALL");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [purchaseProcessingId, setPurchaseProcessingId] = useState<string | null>(
    null
  );

  async function resolveCustomerProfile() {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) throw authError;
    if (!user) throw new Error("Customer session not found.");

    const email = user.email?.trim().toLowerCase() || "";

    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .or(`id.eq.${user.id},email.eq.${email}`)
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error("Customer profile not found.");

    setProfile(data);
    return data as Profile;
  }

  async function loadMarketplace() {
    setLoading(true);
    setMessage("");

    try {
      const currentProfile = await resolveCustomerProfile();

      const [{ data: walletRows }, { data: productRows, error: productError }] =
        await Promise.all([
          supabase
            .from("wallets")
            .select("id, profile_id, balance, created_at")
            .eq("profile_id", currentProfile.id)
            .order("created_at", { ascending: false })
            .limit(1),

          supabase
            .from("marketplace_products")
            .select("*")
            .eq("status", "ACTIVE")
            .order("created_at", { ascending: false }),
        ]);

      if (productError) throw productError;

      setWallet((walletRows?.[0] as Wallet) || null);
      setProducts((productRows || []) as MarketplaceProduct[]);
    } catch (error: any) {
      setMessage(error?.message || "Unable to load marketplace.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMarketplace();
  }, []);

  const poultryProducts = useMemo(() => {
    return products.filter((product) => {
      const category = normalizeCategory(product.category);
      return ["FEEDS", "VITAMINS", "VACCINES", "SUPPLEMENTS"].includes(category);
    });
  }, [products]);

  const filteredProducts = useMemo(() => {
    if (activeCategory === "ALL") return poultryProducts;

    return poultryProducts.filter(
      (product) => normalizeCategory(product.category) === activeCategory
    );
  }, [poultryProducts, activeCategory]);

  const counts = useMemo(() => {
    return {
      ALL: poultryProducts.length,
      FEEDS: poultryProducts.filter(
        (product) => normalizeCategory(product.category) === "FEEDS"
      ).length,
      VITAMINS: poultryProducts.filter(
        (product) => normalizeCategory(product.category) === "VITAMINS"
      ).length,
      VACCINES: poultryProducts.filter(
        (product) => normalizeCategory(product.category) === "VACCINES"
      ).length,
      SUPPLEMENTS: poultryProducts.filter(
        (product) => normalizeCategory(product.category) === "SUPPLEMENTS"
      ).length,
    };
  }, [poultryProducts]);

  async function purchaseProduct(product: MarketplaceProduct) {
    if (!profile) return setMessage("Profile not found.");
    if (!wallet) return setMessage("Wallet not found.");
    if (purchaseProcessingId) return;

    const price = Number(product.price || 0);

    if (price <= 0) return setMessage("Invalid product price.");
    if (Number(wallet.balance || 0) < price) {
      return setMessage("Insufficient wallet balance.");
    }
    if (isUnavailable(product)) {
      return setMessage("Product stock is unavailable.");
    }

    setPurchaseProcessingId(product.id);
    setMessage("");

    try {
      const { error } = await supabase.rpc("purchase_marketplace_item", {
        p_profile_id: profile.id,
        p_product_id: product.id,
        p_quantity: 1,
      });

      if (error) throw error;

      setMessage(
        `${product.name || "Product"} purchased successfully. Wallet, flock inventory, customer inventory, and admin transactions are synced by production RPC.`
      );

      await loadMarketplace();
    } catch (error: any) {
      setMessage(error?.message || "Purchase failed.");
    } finally {
      setPurchaseProcessingId(null);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-green-50 via-white to-yellow-50 p-6 text-gray-900">
      <div className="mx-auto max-w-7xl">
        <section className="mb-6 flex flex-col justify-between gap-4 rounded-3xl border bg-white p-6 shadow md:flex-row md:items-center">
          <div>
            <Link
              href="/customer/dashboard"
              className="mb-3 inline-block text-sm font-black text-green-700"
            >
              ← Back to Dashboard
            </Link>

            <p className="text-xs font-black uppercase tracking-[0.18em] text-green-700">
              FarmConnect Marketplace
            </p>

            <h1 className="mt-2 text-4xl font-black text-green-950">
              Poultry Supplies Marketplace
            </h1>

            <p className="mt-2 max-w-3xl font-bold text-gray-600">
              Buy feeds, vitamins, vaccines, and supplements using the production
              marketplace RPC. Wallet deduction, wallet transaction, flock
              inventory, and admin transaction sync are handled by Supabase.
            </p>
          </div>

          <div className="rounded-3xl bg-green-900 p-6 text-white shadow">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-green-200">
              Wallet Balance
            </p>
            <strong className="mt-2 block text-3xl">
              {peso(Number(wallet?.balance || 0))}
            </strong>
            <small className="text-green-100">
              {profile?.full_name || profile?.email || "Customer Account"}
            </small>
          </div>
        </section>

        {message && (
          <div className="mb-6 rounded-2xl border border-green-200 bg-green-50 p-4 font-bold text-green-800">
            {message}
          </div>
        )}

        <section className="mb-6 grid gap-3 rounded-3xl border bg-white p-3 shadow md:grid-cols-5">
          {CATEGORIES.map((category) => (
            <button
              key={category}
              onClick={() => setActiveCategory(category)}
              className={`rounded-2xl p-4 text-left font-black transition ${
                activeCategory === category
                  ? "bg-green-900 text-white"
                  : "bg-green-50 text-green-900 hover:bg-green-100"
              }`}
            >
              <span className="block text-lg">
                {category === "ALL" && "🐔"}
                {category === "FEEDS" && "🌾"}
                {category === "VITAMINS" && "💊"}
                {category === "VACCINES" && "💉"}
                {category === "SUPPLEMENTS" && "🧪"}
              </span>
              <span>{category === "ALL" ? "All Products" : category}</span>
              <small className="block opacity-70">
                {counts[category]} item(s)
              </small>
            </button>
          ))}
        </section>

        {loading ? (
          <div className="rounded-3xl border bg-white p-8 text-center font-black shadow">
            Loading marketplace...
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="rounded-3xl border bg-white p-8 text-center shadow">
            <h2 className="text-2xl font-black">No poultry products found.</h2>
            <p className="mt-2 font-bold text-gray-500">
              Add active marketplace_products under FEEDS, VITAMINS, VACCINES,
              or SUPPLEMENTS.
            </p>
          </div>
        ) : (
          <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {filteredProducts.map((product) => {
              const stock = getAvailableStock(product);
              const unavailable = isUnavailable(product);
              const processing = purchaseProcessingId === product.id;

              return (
                <article
                  key={product.id}
                  className="overflow-hidden rounded-3xl border bg-white shadow transition hover:-translate-y-1 hover:shadow-xl"
                >
                  <div className="relative h-44 bg-green-50">
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.name || "Marketplace product"}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-6xl">
                        {productIcon(product)}
                      </div>
                    )}

                    <span
                      className={`absolute right-4 top-4 rounded-full px-3 py-1 text-xs font-black ${
                        unavailable
                          ? "bg-red-100 text-red-700"
                          : "bg-green-100 text-green-800"
                      }`}
                    >
                      {unavailable ? "UNAVAILABLE" : "AVAILABLE"}
                    </span>
                  </div>

                  <div className="p-5">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-black text-green-800">
                        {normalizeCategory(product.category)}
                      </span>

                      <span className="text-sm font-black text-gray-500">
                        {product.unit || "Unit"}
                      </span>
                    </div>

                    <h2 className="text-2xl font-black text-green-950">
                      {product.name || "Marketplace Product"}
                    </h2>

                    <p className="mt-2 min-h-12 text-sm font-bold text-gray-600">
                      {product.note || "Poultry production supply item."}
                    </p>

                    <div className="mt-5 grid grid-cols-2 gap-3">
                      <div className="rounded-2xl bg-yellow-50 p-4">
                        <p className="text-xs font-black uppercase text-gray-500">
                          Price
                        </p>
                        <strong className="text-xl text-green-800">
                          {peso(Number(product.price || 0))}
                        </strong>
                      </div>

                      <div className="rounded-2xl bg-blue-50 p-4">
                        <p className="text-xs font-black uppercase text-gray-500">
                          Available Stock
                        </p>
                        <strong className="text-xl text-blue-800">
                          {stock === null ? product.stock_status || "Available" : stock}
                        </strong>
                      </div>
                    </div>

                    <button
                      onClick={() => purchaseProduct(product)}
                      disabled={unavailable || processing}
                      className="mt-5 w-full rounded-2xl bg-green-700 p-4 font-black text-white transition hover:bg-green-800 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-600"
                    >
                      {processing
                        ? "Processing..."
                        : unavailable
                          ? "Out of Stock"
                          : `Buy Now • ${peso(Number(product.price || 0))}`}
                    </button>
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}