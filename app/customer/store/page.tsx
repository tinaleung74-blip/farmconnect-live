"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  categoryIcon,
  farmBgClass,
  goldButtonClass,
  money,
  panelClass,
  primaryButtonClass,
  resolveCustomerProfile,
  statusPill,
  type CustomerProfile,
} from "@/lib/customer-auth";

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

const categories = ["ALL", "FEEDS", "VITAMINS", "VACCINES", "SUPPLEMENTS", "EQUIPMENT", "CHICKEN"];

export default function StorePage() {
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [category, setCategory] = useState("ALL");
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
    setProfile(await resolveCustomerProfile());

    const { data, error } = await supabase
      .from("marketplace_products")
      .select("id,name,category,description,price,stock,image_url,usage_guide,status,created_at")
      .eq("status", "ACTIVE")
      .order("created_at", { ascending: false });

    if (error) setMessage(error.message);
    setProducts((data || []) as Product[]);
    setLoading(false);
  }

  async function buy(product: Product) {
    if (!profile) return setMessage("Login required before buying.");
    if (Number(product.stock || 0) <= 0) return setMessage("This product is out of stock.");

    setBuyingId(product.id);
    setMessage("");

    const { error } = await supabase.rpc("purchase_marketplace_item", {
      p_profile_id: profile.id,
      p_product_id: product.id,
      p_quantity: 1,
    });

    setBuyingId(null);
    if (error) return setMessage(error.message);

    setMessage(`${product.name || "Product"} purchased. Wallet, inventory, and product stock are synced.`);
    await loadMarketplace();
  }

  const filtered = useMemo(() => {
    return products.filter((product) => {
      const productCategory = String(product.category || "").toUpperCase();
      const haystack = `${product.name || ""} ${product.description || ""} ${product.usage_guide || ""}`.toLowerCase();
      return (category === "ALL" || productCategory.includes(category)) && haystack.includes(search.toLowerCase());
    });
  }, [products, category, search]);

  const featured = filtered[0] || products[0] || null;
  const lowStock = products.filter((product) => Number(product.stock || 0) > 0 && Number(product.stock || 0) <= 5).length;

  return (
    <main className={`${farmBgClass} min-h-screen p-4 pb-28 md:p-8`}>
      <div className="mx-auto max-w-7xl">
        <section className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
          <div className="rounded-[42px] border border-white/15 bg-white/10 p-6 text-white shadow-2xl backdrop-blur-xl md:p-8">
            <p className="w-fit rounded-full bg-amber-300 px-4 py-2 text-sm font-black text-emerald-950">FarmConnect Store</p>
            <h1 className="mt-5 text-4xl font-black leading-tight md:text-6xl">Quick customer store.</h1>
            <p className="mt-3 max-w-2xl text-emerald-50">
              Feeds, vitamins, vaccines, supplements, and equipment. Every purchase runs through the production marketplace RPC.
            </p>

            <div className="mt-6 flex flex-col gap-3 md:flex-row">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search marketplace products"
                className="rounded-full bg-white px-5 py-4 font-bold text-slate-900 outline-none md:w-96"
              />
              <Link href="/customer/inventory" className="rounded-full bg-white px-5 py-4 text-center font-black text-emerald-950">
                View Inventory
              </Link>
              <button onClick={loadMarketplace} className="rounded-full bg-white/15 px-5 py-4 font-black text-white hover:bg-white/25">
                {loading ? "Loading..." : "Refresh"}
              </button>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-3">
              <Stat label="Active Products" value={products.length} />
              <Stat label="Low Stock" value={lowStock} />
              <Stat label="Wallet" value={money(profile?.wallet_balance)} />
            </div>
          </div>

          <div className="overflow-hidden rounded-[42px] border border-amber-300/20 bg-white shadow-2xl">
            <div className="relative h-80 bg-emerald-50">
              {featured?.image_url ? (
                <img src={featured.image_url} alt={featured.name || "Featured product"} className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full place-items-center bg-gradient-to-br from-amber-100 to-emerald-100 text-8xl">
                  {categoryIcon(featured?.category)}
                </div>
              )}
              <div className="absolute left-5 top-5 rounded-full bg-emerald-950/85 px-4 py-2 text-xs font-black text-white backdrop-blur">
                Featured
              </div>
            </div>
            <div className="p-6">
              <p className="text-sm font-black uppercase tracking-[0.18em] text-emerald-700">Recommended Supply</p>
              <h2 className="mt-2 text-3xl font-black text-emerald-950">{featured?.name || "Add products in Admin"}</h2>
              <p className="mt-2 font-bold text-slate-500">{featured?.description || featured?.usage_guide || "Active marketplace products will show here."}</p>
              <div className="mt-5 flex items-center justify-between gap-4">
                <b className="text-3xl text-emerald-700">{money(featured?.price)}</b>
                {featured && <button onClick={() => buy(featured)} disabled={buyingId === featured.id || Number(featured.stock || 0) <= 0} className={goldButtonClass}>Buy Featured</button>}
              </div>
            </div>
          </div>
        </section>

        {message && <div className="mt-5 rounded-2xl bg-white p-4 font-black text-emerald-800 shadow">{message}</div>}

        <div className="mt-5 flex gap-3 overflow-x-auto pb-2">
          {categories.map((item) => (
            <button
              key={item}
              onClick={() => setCategory(item)}
              className={`rounded-full px-5 py-3 font-black transition ${category === item ? "bg-amber-300 text-emerald-950" : "bg-white text-emerald-800 hover:bg-emerald-50"}`}
            >
              {item === "ALL" ? "All Products" : item}
            </button>
          ))}
        </div>

        <section className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((product) => {
            const stock = Number(product.stock || 0);
            const outOfStock = stock <= 0;
            const buying = buyingId === product.id;

            return (
              <article key={product.id} className={`${panelClass} overflow-hidden`}>
                <div className="relative h-64 bg-emerald-50">
                  {product.image_url ? (
                    <img src={product.image_url} alt={product.name || "Marketplace product"} className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full place-items-center bg-gradient-to-br from-emerald-50 to-amber-50 text-7xl">
                      {categoryIcon(product.category)}
                    </div>
                  )}
                  <span className={`absolute right-4 top-4 rounded-full border px-3 py-1 text-xs font-black ${outOfStock ? "bg-red-100 text-red-700 border-red-200" : statusPill(product.status)}`}>
                    {outOfStock ? "OUT OF STOCK" : "AVAILABLE"}
                  </span>
                </div>

                <div className="p-6">
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800">{product.category || "SUPPLY"}</span>
                  <h2 className="mt-3 text-2xl font-black text-emerald-950">{product.name || "Farm Supply"}</h2>
                  <p className="mt-2 min-h-14 text-sm font-semibold text-slate-500">{product.description || product.usage_guide || "FarmConnect product."}</p>

                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-emerald-50 p-4">
                      <p className="text-xs font-black uppercase text-slate-500">Price</p>
                      <p className="text-2xl font-black text-emerald-800">{money(product.price)}</p>
                    </div>
                    <div className="rounded-2xl bg-amber-50 p-4">
                      <p className="text-xs font-black uppercase text-slate-500">Stock</p>
                      <p className="text-2xl font-black text-amber-800">{stock}</p>
                    </div>
                  </div>

                  <button onClick={() => buy(product)} disabled={outOfStock || buying} className={`mt-5 w-full ${primaryButtonClass}`}>
                    {outOfStock ? "Out of Stock" : buying ? "Buying..." : "Buy Now"}
                  </button>
                </div>
              </article>
            );
          })}
        </section>

        {filtered.length === 0 && (
          <div className="mt-6 rounded-[32px] bg-white p-10 text-center font-black text-slate-500 shadow-2xl">
            No products found for this search/category.
          </div>
        )}
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-[24px] bg-white/10 p-5 ring-1 ring-white/10">
      <p className="text-sm font-black uppercase tracking-[0.14em] text-emerald-100">{label}</p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
    </div>
  );
}
