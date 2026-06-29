"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { money, resolveCustomerProfile, type CustomerProfile } from "@/lib/customer-auth";

type Product = {
  id: string;
  name: string | null;
  category: string | null;
  description?: string | null;
  price: number | string | null;
  stock: number | string | null;
  image_url: string | null;
  status: string | null;
  usage_guide?: string | null;
  created_at?: string | null;
};

const FALLBACK = {
  CHICKEN: "/farmconnect/roosters/fc-stage-1-chick-base.jpg",
  FEEDS: "/farmconnect/marketplace/fc-product-feeds.jpg",
  VITAMINS: "/farmconnect/marketplace/fc-product-vitamins.jpg",
  VACCINES: "/farmconnect/marketplace/fc-product-vaccines.jpg",
  SUPPLEMENTS: "/farmconnect/marketplace/fc-product-supplements.jpg",
  EQUIPMENT: "/farmconnect/marketplace/fc-product-equipment.jpg",
  DEFAULT: "/farmconnect/roosters/fc-stage-1-chick-base.jpg",
};

const TABS = ["ALL", "CHICKEN", "FEEDS", "VITAMINS", "VACCINES", "SUPPLEMENTS", "EQUIPMENT"];

export default function MarketplacePage() {
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [activeTab, setActiveTab] = useState("ALL");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMarketplace();
  }, []);

  async function loadMarketplace() {
    setLoading(true);
    setMessage("");

    const currentProfile = await resolveCustomerProfile();
    setProfile(currentProfile);

    const { data, error } = await supabase
      .from("marketplace_products")
      .select("id,name,category,description,price,stock,image_url,usage_guide,status,created_at")
      .order("created_at", { ascending: false });

    if (error) setMessage(error.message);

    const rows = ((data || []) as Product[]).filter(
      (item) => String(item.status || "").toUpperCase() === "ACTIVE",
    );

    setProducts(rows);
    setLoading(false);
  }

  async function buy(product: Product) {
    if (!profile) return setMessage("Login required before buying.");
    if (Number(product.stock || 0) <= 0) return setMessage("This product is out of stock.");

    const ok = window.confirm(`Buy ${product.name || "this product"}? ${syncLabel(product.category)}`);
    if (!ok) return;

    setBuyingId(product.id);
    setMessage("");

    const { error } = await supabase.rpc("purchase_marketplace_item", {
      p_profile_id: profile.id,
      p_product_id: product.id,
      p_quantity: 1,
    });

    setBuyingId(null);

    if (error) return setMessage(error.message);

    setMessage(`${product.name || "Product"} purchased. ${syncLabel(product.category)}`);
    await loadMarketplace();
  }

  const filtered = useMemo(() => {
    return products.filter((product) => {
      const category = normalizeCategory(product.category);
      const text = `${product.name || ""} ${product.category || ""} ${product.description || ""} ${product.usage_guide || ""}`.toLowerCase();

      return (activeTab === "ALL" || category === activeTab) && text.includes(search.toLowerCase());
    });
  }, [products, activeTab, search]);

  const featured = filtered[0] || products[0] || null;
  const chickenCount = products.filter((p) => normalizeCategory(p.category) === "CHICKEN").length;
  const inventoryCount = products.filter((p) => normalizeCategory(p.category) !== "CHICKEN").length;
  const lowStock = products.filter((p) => Number(p.stock || 0) > 0 && Number(p.stock || 0) <= 5).length;

  return (
    <main className="min-h-screen bg-[#fbfaf8] p-4 pb-28 text-[#171717] md:p-8">
      <div className="mx-auto max-w-7xl">
        <section className="grid gap-5 xl:grid-cols-[1fr_430px]">
          <div className="rounded-[36px] bg-white p-6 shadow-xl md:p-8">
            <p className="w-fit rounded-full bg-[#fff0f0] px-4 py-2 text-sm font-black text-[#d71920]">
              FarmConnect Marketplace
            </p>

            <h1 className="mt-5 text-4xl font-black leading-tight md:text-6xl">
              Buy rooster chicks and farm supplies.
            </h1>

            <p className="mt-3 max-w-3xl font-semibold leading-7 text-neutral-500">
              Chicken products sync to My Flock. Feeds, vitamins, vaccines, supplements,
              and equipment sync to Inventory. Wallet deduction runs through the existing RPC.
            </p>

            <div className="mt-6 grid gap-3 md:grid-cols-4">
              <Stat label="Products" value={products.length} />
              <Stat label="Chicks" value={chickenCount} />
              <Stat label="Inventory Items" value={inventoryCount} />
              <Stat label="Wallet" value={money(profile?.wallet_balance)} />
            </div>

            <div className="mt-6 flex flex-col gap-3 md:flex-row">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search chicks, feeds, vaccines..."
                className="rounded-2xl border border-neutral-200 px-5 py-4 font-bold outline-none focus:border-[#d71920] md:w-96"
              />

              <Link href="/customer/inventory" className="rounded-2xl bg-[#171717] px-5 py-4 text-center font-black text-white">
                Inventory
              </Link>

              <Link href="/customer/chicks" className="rounded-2xl bg-[#fff0f0] px-5 py-4 text-center font-black text-[#d71920]">
                My Flock
              </Link>

              <button onClick={loadMarketplace} className="rounded-2xl bg-[#d71920] px-5 py-4 font-black text-white">
                {loading ? "Loading..." : "Refresh"}
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-[36px] bg-white shadow-xl">
            <div className="relative h-full min-h-[380px]">
              <img
                src={productImage(featured)}
                alt={featured?.name || "Featured product"}
                onError={(e) => {
                  e.currentTarget.src = FALLBACK.DEFAULT;
                }}
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />

              <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                <p className="w-fit rounded-full bg-[#d71920] px-4 py-2 text-xs font-black">
                  Featured
                </p>
                <h2 className="mt-4 text-3xl font-black">
                  {featured?.name || "No active product yet"}
                </h2>
                <p className="mt-2 text-sm font-semibold text-white/80">
                  {featured ? syncLabel(featured.category) : "Add active marketplace products in Admin."}
                </p>

                {featured && (
                  <div className="mt-5 flex items-center justify-between gap-3">
                    <b className="text-4xl">{money(featured.price)}</b>
                    <button
                      onClick={() => buy(featured)}
                      disabled={buyingId === featured.id || Number(featured.stock || 0) <= 0}
                      className="rounded-2xl bg-white px-5 py-4 font-black text-[#d71920] disabled:bg-neutral-300 disabled:text-neutral-500"
                    >
                      {buyingId === featured.id ? "Buying..." : "Buy Featured"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {message && (
          <div className="mt-5 rounded-2xl bg-white p-4 font-black text-[#d71920] shadow">
            {message}
          </div>
        )}

        <section className="mt-5 flex gap-3 overflow-x-auto pb-2">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`shrink-0 rounded-full px-5 py-3 font-black shadow transition ${
                activeTab === tab
                  ? "bg-[#d71920] text-white"
                  : "bg-white text-neutral-700 hover:bg-[#fff0f0]"
              }`}
            >
              {tab === "ALL" ? "All Products" : tab}
            </button>
          ))}
        </section>

        <section className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((product) => {
            const category = normalizeCategory(product.category);
            const stock = Number(product.stock || 0);
            const outOfStock = stock <= 0;
            const buying = buyingId === product.id;

            return (
              <article
                key={product.id}
                className="overflow-hidden rounded-[30px] bg-white shadow-xl ring-1 ring-neutral-100 transition hover:-translate-y-1"
              >
                <div className="relative h-64 bg-[#fff0f0]">
                  <img
                    src={productImage(product)}
                    alt={product.name || "Marketplace product"}
                    onError={(e) => {
                      e.currentTarget.src = FALLBACK.DEFAULT;
                    }}
                    className="h-full w-full object-cover"
                  />

                  <span className="absolute left-4 top-4 rounded-full bg-white/95 px-3 py-1 text-xs font-black text-[#d71920] shadow">
                    {category}
                  </span>

                  <span className={`absolute right-4 top-4 rounded-full px-3 py-1 text-xs font-black shadow ${
                    outOfStock ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                  }`}>
                    {outOfStock ? "OUT OF STOCK" : "AVAILABLE"}
                  </span>
                </div>

                <div className="p-6">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-[#d71920]">
                    {category === "CHICKEN" ? "Creates My Flock Record" : "Adds To Inventory"}
                  </p>

                  <h2 className="mt-2 text-2xl font-black">{product.name || "Marketplace Product"}</h2>

                  <p className="mt-2 min-h-14 text-sm font-semibold leading-6 text-neutral-500">
                    {product.description || product.usage_guide || "No product description yet."}
                  </p>

                  <div className="mt-4 rounded-2xl bg-[#fff7f7] p-4">
                    <p className="text-xs font-black uppercase text-[#d71920]">Sync Result</p>
                    <p className="mt-1 text-sm font-bold text-neutral-600">{syncLabel(product.category)}</p>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-[#fbfaf8] p-4">
                      <p className="text-xs font-black uppercase text-neutral-500">Price</p>
                      <p className="text-2xl font-black">{money(product.price)}</p>
                    </div>
                    <div className="rounded-2xl bg-[#fbfaf8] p-4">
                      <p className="text-xs font-black uppercase text-neutral-500">Stock</p>
                      <p className="text-2xl font-black text-[#d71920]">{stock}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => buy(product)}
                    disabled={outOfStock || buying}
                    className="mt-5 w-full rounded-2xl bg-[#d71920] px-5 py-4 font-black text-white shadow-lg disabled:cursor-not-allowed disabled:bg-neutral-300"
                  >
                    {outOfStock ? "Out of Stock" : buying ? "Buying..." : "Buy Now"}
                  </button>
                </div>
              </article>
            );
          })}
        </section>

        {!loading && filtered.length === 0 && (
          <div className="mt-6 rounded-[32px] bg-white p-10 text-center shadow-xl">
            <div className="text-6xl">🛒</div>
            <h2 className="mt-4 text-3xl font-black">No active products yet.</h2>
            <p className="mt-2 font-bold text-neutral-500">
              Add ACTIVE rows in marketplace_products.
            </p>
          </div>
        )}

        <section className="mt-6 rounded-[30px] bg-white p-6 shadow-xl">
          <h2 className="text-2xl font-black">Sync Rules</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <Rule title="Chicken" text="Purchase should create one chick/rooster investment visible in My Flock." />
            <Rule title="Supplies" text="Feeds, vitamins, vaccines, supplements, and equipment should add to Inventory." />
            <Rule title="Caretaker" text="Care requests and platform fee stay inside the Caretaker flow." />
          </div>
        </section>
      </div>
    </main>
  );
}

function normalizeCategory(value?: string | null) {
  const text = String(value || "DEFAULT").toUpperCase();
  if (text.includes("CHICK") || text.includes("ROOSTER") || text.includes("CHICKEN")) return "CHICKEN";
  if (text.includes("FEED")) return "FEEDS";
  if (text.includes("VITAMIN")) return "VITAMINS";
  if (text.includes("VACCINE")) return "VACCINES";
  if (text.includes("SUPPLEMENT")) return "SUPPLEMENTS";
  if (text.includes("EQUIPMENT")) return "EQUIPMENT";
  return text || "DEFAULT";
}

function productImage(product?: Product | null) {
  if (product?.image_url) return product.image_url;
  return FALLBACK[normalizeCategory(product?.category) as keyof typeof FALLBACK] || FALLBACK.DEFAULT;
}

function syncLabel(category?: string | null) {
  return normalizeCategory(category) === "CHICKEN"
    ? "After purchase, this should appear in My Flock as one chick/rooster investment."
    : "After purchase, this should add stock to Inventory for caretaker/farm use.";
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-[24px] bg-[#fbfaf8] p-5">
      <p className="text-sm font-black uppercase tracking-[0.14em] text-neutral-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-[#d71920]">{value}</p>
    </div>
  );
}

function Rule({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-[24px] bg-[#fbfaf8] p-5">
      <h3 className="font-black text-[#d71920]">{title}</h3>
      <p className="mt-2 text-sm font-semibold leading-6 text-neutral-500">{text}</p>
    </div>
  );
}