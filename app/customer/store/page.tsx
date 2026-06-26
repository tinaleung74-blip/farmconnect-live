"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
};

type Product = {
  id: string;
  name: string | null;
  product_name?: string | null;
  title?: string | null;
  category: string | null;
  price: number | null;
  stock: number | null;
  available_stock?: number | null;
  image_url: string | null;
  status: string | null;
};

const allowedCategories = ["FEEDS", "VITAMINS", "VACCINES", "SUPPLEMENTS"];

export default function StorePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadStore();
  }, []);

  async function loadStore() {
    setLoading(true);
    setMessage("");

    const resolvedProfile = await resolveProfile();
    setProfile(resolvedProfile);

    await loadProducts();
    setLoading(false);
  }

  async function resolveProfile() {
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData.user) {
      setMessage("Please login before buying chicken supplies.");
      return null;
    }

    const authUser = authData.user;

    const { data: profileById } = await supabase
      .from("profiles")
      .select("id, email, full_name")
      .eq("id", authUser.id)
      .maybeSingle();

    if (profileById) return profileById as Profile;

    const { data: profileByEmail } = await supabase
      .from("profiles")
      .select("id, email, full_name")
      .eq("email", authUser.email)
      .maybeSingle();

    if (profileByEmail) return profileByEmail as Profile;

    setMessage("Customer profile not found. Buying is disabled.");
    return null;
  }

  async function loadProducts() {
    const { data, error } = await supabase
      .from("marketplace_products")
      .select("*")
      .in("category", allowedCategories)
      .eq("status", "ACTIVE")
      .order("created_at", { ascending: false });

    if (error) {
      setProducts([]);
      setMessage(`Store load error: ${error.message}`);
      return;
    }

    setProducts((data || []) as Product[]);
  }

  async function buyProduct(product: Product) {
    if (!profile) {
      setMessage("Please login with a valid customer profile before buying.");
      return;
    }

    setBuyingId(product.id);
    setMessage("");

    const primary = await supabase.rpc("purchase_marketplace_item", {
      p_profile_id: profile.id,
      p_product_id: product.id,
    });

    if (primary.error) {
      const errorText = String(primary.error.message || "").toLowerCase();

      const shouldRetryWithoutProfile =
        errorText.includes("unexpected") ||
        errorText.includes("parameter") ||
        errorText.includes("function") ||
        errorText.includes("schema cache") ||
        errorText.includes("could not find");

      if (!shouldRetryWithoutProfile) {
        setMessage(`Purchase error: ${primary.error.message}`);
        setBuyingId(null);
        return;
      }

      const fallback = await supabase.rpc("purchase_marketplace_item", {
        p_product_id: product.id,
      });

      if (fallback.error) {
        setMessage(`Purchase error: ${fallback.error.message}`);
        setBuyingId(null);
        return;
      }
    }

    setMessage("✅ Purchase successful. Wallet and inventory records synced.");
    await loadProducts();
    setBuyingId(null);
  }

  const stats = useMemo(() => {
    return {
      total: products.length,
      feeds: products.filter((p) => normalizeCategory(p.category) === "FEEDS")
        .length,
      health: products.filter((p) =>
        ["VITAMINS", "VACCINES", "SUPPLEMENTS"].includes(
          normalizeCategory(p.category)
        )
      ).length,
    };
  }, [products]);

  const buyingDisabled = !profile;

  return (
    <main className="min-h-screen bg-[#f3fbf5] p-6 md:p-10">
      <div className="max-w-7xl mx-auto">
        <section className="rounded-[32px] bg-gradient-to-r from-green-800 via-green-600 to-emerald-500 text-white p-8 mb-8 shadow-xl">
          <p className="bg-white/20 w-fit px-4 py-2 rounded-full text-sm font-bold mb-4">
            🐔 FarmConnect Poultry Store
          </p>

          <h1 className="text-4xl md:text-5xl font-black">
            Chicken Supplies Store
          </h1>

          <p className="mt-3 text-green-50 max-w-2xl">
            Buy chicken feeds, vitamins, vaccines, and supplements from active
            marketplace products. Purchases use the audited production purchase
            RPC only.
          </p>

          {profile && (
            <p className="mt-3 text-sm text-green-50">
              Customer: {profile.full_name || profile.email || "Profile"}
            </p>
          )}
        </section>

        {message && (
          <div className="bg-white rounded-3xl p-5 mb-6 shadow border border-green-100 font-bold text-green-700">
            {message}
          </div>
        )}

        <section className="grid md:grid-cols-3 gap-5 mb-8">
          <Summary label="Chicken Supplies" value={stats.total} />
          <Summary label="Chicken Feeds" value={stats.feeds} />
          <Summary label="Health Supplies" value={stats.health} />
        </section>

        {loading ? (
          <div className="bg-white rounded-3xl p-8 shadow border border-green-100 text-center font-black text-green-700">
            Loading store products...
          </div>
        ) : products.length === 0 ? (
          <div className="bg-white rounded-3xl p-10 shadow border border-green-100 text-center">
            <div className="text-6xl mb-4">🛒</div>
            <h2 className="text-2xl font-black text-gray-900">
              No active chicken supplies available
            </h2>
            <p className="text-gray-500 mt-2">
              Active feeds, vitamins, vaccines, and supplements will appear here.
            </p>
          </div>
        ) : (
          <section className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
            {products.map((product) => {
              const stock = Number(
                product.available_stock ?? product.stock ?? 0
              );
              const outOfStock = stock <= 0;
              const category = normalizeCategory(product.category);

              return (
                <article
                  key={product.id}
                  className="bg-white rounded-3xl overflow-hidden shadow border border-green-100"
                >
                  <div className="h-56 bg-green-50">
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={productName(product)}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full grid place-items-center text-6xl">
                        {icon(category)}
                      </div>
                    )}
                  </div>

                  <div className="p-6">
                    <div className="flex justify-between items-start gap-3 mb-3">
                      <span className="px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs font-black">
                        {label(category)}
                      </span>

                      <span
                        className={`px-3 py-1 rounded-full text-xs font-black ${
                          outOfStock
                            ? "bg-red-100 text-red-700"
                            : "bg-emerald-100 text-emerald-700"
                        }`}
                      >
                        {outOfStock ? "OUT OF STOCK" : "ACTIVE"}
                      </span>
                    </div>

                    <h2 className="text-2xl font-black text-gray-900">
                      {productName(product)}
                    </h2>

                    <p className="text-gray-500 font-bold mt-1">
                      Available Stock: {stock.toLocaleString()}
                    </p>

                    <p className="text-3xl font-black text-green-700 mt-5">
                      {money(product.price)}
                    </p>

                    <button
                      disabled={
                        outOfStock || buyingId === product.id || buyingDisabled
                      }
                      onClick={() => buyProduct(product)}
                      className={`mt-5 w-full p-4 rounded-2xl font-black ${
                        outOfStock || buyingDisabled
                          ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                          : "bg-green-700 text-white"
                      }`}
                    >
                      {outOfStock
                        ? "OUT OF STOCK"
                        : buyingDisabled
                        ? "LOGIN REQUIRED"
                        : buyingId === product.id
                        ? "Processing..."
                        : "Buy"}
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

function Summary({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white rounded-3xl p-6 shadow border border-green-100">
      <p className="text-gray-500 font-semibold">{label}</p>
      <h2 className="text-4xl font-black text-green-700 mt-2">{value}</h2>
    </div>
  );
}

function productName(product: Product) {
  return product.product_name || product.name || product.title || "Chicken Supply";
}

function normalizeCategory(value?: string | null) {
  const text = String(value || "").toUpperCase();

  if (text.includes("FEED")) return "FEEDS";
  if (text.includes("VITAMIN")) return "VITAMINS";
  if (text.includes("VACCINE")) return "VACCINES";
  if (text.includes("SUPPLEMENT")) return "SUPPLEMENTS";

  return "SUPPLEMENTS";
}

function label(category: string) {
  if (category === "FEEDS") return "Chicken Feeds";
  if (category === "VITAMINS") return "Chicken Vitamins";
  if (category === "VACCINES") return "Chicken Vaccines";
  if (category === "SUPPLEMENTS") return "Chicken Supplements";
  return "Chicken Supplies";
}

function icon(category: string) {
  if (category === "FEEDS") return "🌾";
  if (category === "VITAMINS") return "💊";
  if (category === "VACCINES") return "💉";
  if (category === "SUPPLEMENTS") return "🧴";
  return "📦";
}

function money(value: any) {
  const amount = Number(value || 0);

  return amount.toLocaleString("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  });
}