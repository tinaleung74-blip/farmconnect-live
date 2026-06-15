"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Product = {
  id: string;
  name: string;
  category: "CHICKS" | "FEEDS" | "VITAMINS" | "VACCINES" | "SUPPLEMENTS";
  icon: string;
  price: number;
  stock: number;
  details: string;
  usage: string;
};

type CartItem = Product & {
  quantity: number;
};

const products: Product[] = [
  {
    id: "broiler-chick-day1",
    name: "Broiler Chick - Day 1",
    category: "CHICKS",
    icon: "🐣",
    price: 120,
    stock: 5000,
    details: "Day-old broiler chick for fast meat production.",
    usage: "Place inside brooder house with heat, clean water, and starter feed.",
  },
  {
    id: "broiler-chick-day7",
    name: "Broiler Chick - Day 7",
    category: "CHICKS",
    icon: "🐥",
    price: 150,
    stock: 2500,
    details: "Stronger chick with early-stage growth monitoring.",
    usage: "Continue starter feed and daily water monitoring.",
  },
  {
    id: "starter-feed",
    name: "Starter Feed Bag",
    category: "FEEDS",
    icon: "🌾",
    price: 350,
    stock: 300,
    details: "Feed for chicks from Day 1 to Day 14.",
    usage: "Use daily during brooding stage.",
  },
  {
    id: "grower-feed",
    name: "Grower Feed Bag",
    category: "FEEDS",
    icon: "🌽",
    price: 420,
    stock: 250,
    details: "Feed for growing chickens after starter stage.",
    usage: "Use from Day 15 until harvest stage.",
  },
  {
    id: "vitamin-a",
    name: "Vitamin A Booster",
    category: "VITAMINS",
    icon: "💊",
    price: 100,
    stock: 200,
    details: "Supports immunity, eyes, and growth performance.",
    usage: "Mix with drinking water based on caretaker recommendation.",
  },
  {
    id: "multivitamins",
    name: "Multivitamins",
    category: "VITAMINS",
    icon: "🧪",
    price: 180,
    stock: 180,
    details: "Daily vitamin support for healthier flock growth.",
    usage: "Use during stress, weather changes, or growth monitoring.",
  },
  {
    id: "nd-vaccine",
    name: "ND Vaccine",
    category: "VACCINES",
    icon: "💉",
    price: 250,
    stock: 100,
    details: "Vaccine support for poultry disease protection.",
    usage: "Use only with caretaker or veterinary guidance.",
  },
  {
    id: "electrolytes",
    name: "Electrolytes",
    category: "SUPPLEMENTS",
    icon: "🧴",
    price: 90,
    stock: 160,
    details: "Hydration support for chicks during heat and stress.",
    usage: "Mix with water during hot weather or after transport.",
  },
];

const categories = [
  "ALL",
  "CHICKS",
  "FEEDS",
  "VITAMINS",
  "VACCINES",
  "SUPPLEMENTS",
];

const quickQty = [1, 5, 10, 25, 50, 100];

export default function MarketplacePage() {
  const [activeCategory, setActiveCategory] = useState("ALL");
  const [walletBalance, setWalletBalance] = useState(0);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedQty, setSelectedQty] = useState<Record<string, number>>({});
  const [checkingOut, setCheckingOut] = useState(false);

  async function loadWallet() {
    const user = localStorage.getItem("farmconnect_user");
    if (!user) return;

    const profile = JSON.parse(user);

    const { data } = await supabase
      .from("profiles")
      .select("wallet_balance")
      .eq("id", profile.id)
      .maybeSingle();

    setWalletBalance(Number(data?.wallet_balance || 0));
  }

  useEffect(() => {
    loadWallet();
  }, []);

  const filteredProducts =
    activeCategory === "ALL"
      ? products
      : products.filter((p) => p.category === activeCategory);

  const cartTotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }, [cart]);

  const cartCount = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  }, [cart]);

  function getQty(productId: string) {
    return selectedQty[productId] || 1;
  }

  function setQty(productId: string, qty: number) {
    if (qty < 1) qty = 1;
    setSelectedQty((prev) => ({ ...prev, [productId]: qty }));
  }

  function addToCart(product: Product) {
    const quantity = getQty(product.id);

    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);

      if (existing) {
        return prev.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }

      return [...prev, { ...product, quantity }];
    });
  }

  function removeFromCart(productId: string) {
    setCart((prev) => prev.filter((item) => item.id !== productId));
  }

  async function getActiveFlockId(profileId: string) {
    const { data } = await supabase
      .from("flocks")
      .select("id")
      .eq("profile_id", profileId)
      .eq("status", "ACTIVE")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return data?.id || null;
  }

  function getInventoryUnit(category: Product["category"]) {
    if (category === "FEEDS") return "bag";
    if (category === "VITAMINS") return "bottle";
    if (category === "VACCINES") return "dose";
    if (category === "SUPPLEMENTS") return "pack";
    return "item";
  }

  function getLowStockLevel(category: Product["category"]) {
    if (category === "FEEDS") return 5;
    if (category === "VITAMINS") return 2;
    if (category === "VACCINES") return 2;
    if (category === "SUPPLEMENTS") return 3;
    return 1;
  }

  async function syncMarketplaceItemToInventory(
    profileId: string,
    flockId: string | null,
    item: CartItem
  ) {
    const unit = getInventoryUnit(item.category);
    const lowStockLevel = getLowStockLevel(item.category);

    let query = supabase
      .from("flock_inventory")
      .select("id, starting_qty, remaining_qty")
      .eq("profile_id", profileId)
      .eq("item_name", item.name)
      .eq("category", item.category);

    if (flockId) {
      query = query.eq("flock_id", flockId);
    } else {
      query = query.is("flock_id", null);
    }

    const { data: existing } = await query.maybeSingle();

    if (existing) {
      await supabase
        .from("flock_inventory")
        .update({
          starting_qty: Number(existing.starting_qty || 0) + item.quantity,
          remaining_qty: Number(existing.remaining_qty || 0) + item.quantity,
          status: "AVAILABLE",
        })
        .eq("id", existing.id);

      return;
    }

    await supabase.from("flock_inventory").insert({
      profile_id: profileId,
      flock_id: flockId,
      item_name: item.name,
      category: item.category,
      unit,
      starting_qty: item.quantity,
      remaining_qty: item.quantity,
      low_stock_level: lowStockLevel,
      status: "AVAILABLE",
    });
  }

  async function checkout() {
    const user = localStorage.getItem("farmconnect_user");

    if (!user) {
      alert("Please login first");
      return;
    }

    if (cart.length === 0) {
      alert("Cart is empty");
      return;
    }

    if (walletBalance < cartTotal) {
      alert("Insufficient wallet balance");
      return;
    }

    const profile = JSON.parse(user);

    setCheckingOut(true);

    try {
      const newBalance = walletBalance - cartTotal;

      const { error: walletError } = await supabase
        .from("profiles")
        .update({ wallet_balance: newBalance })
        .eq("id", profile.id);

      if (walletError) {
        alert(walletError.message);
        return;
      }

      let targetFlockId = await getActiveFlockId(profile.id);

      for (const item of cart) {
        if (item.category === "CHICKS") {
          const batchNo =
            "FC-" + Math.floor(100000 + Math.random() * 900000);

          const harvestDate = new Date();
          harvestDate.setDate(harvestDate.getDate() + 45);

          const { data: newFlock } = await supabase
            .from("flocks")
            .insert({
              profile_id: profile.id,
              batch_no: batchNo,
              breed: item.name,
              total_chicks: item.quantity,
              alive_count: item.quantity,
              mortality_count: 0,
              expected_harvest_date: harvestDate
                .toISOString()
                .split("T")[0],
              status: "ACTIVE",
              source: "MARKETPLACE",
              growth_stage: "Brooding",
              health_status: "Healthy",
              timeline_label: `${item.quantity} chicks purchased from marketplace`,
            })
            .select("id")
            .single();

          if (newFlock?.id) {
            targetFlockId = newFlock.id;
          }
        } else {
          await syncMarketplaceItemToInventory(profile.id, targetFlockId, item);
        }

        await supabase.from("wallet_transactions").insert({
          profile_id: profile.id,
          transaction_type: "PURCHASE",
          amount: item.price * item.quantity * -1,
          reference_no: "FC-MKT-" + Date.now(),
          remarks: `${item.name} x${item.quantity}`,
          status: "COMPLETED",
        });
      }

      setWalletBalance(newBalance);
      setCart([]);

      alert("Checkout successful! Chicks added to My Flock. Supplies synced to Inventory.");
    } catch (err) {
      console.error(err);
      alert("Checkout failed");
    } finally {
      setCheckingOut(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f3fbf5] p-6 md:p-10">
      <div className="max-w-7xl mx-auto">
        <section className="rounded-[32px] bg-gradient-to-r from-green-800 via-green-600 to-emerald-500 text-white p-8 mb-8 shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
            <div>
              <p className="bg-white/20 w-fit px-4 py-2 rounded-full text-sm font-bold mb-4">
                🛒 FarmConnect Marketplace
              </p>

              <h1 className="text-4xl md:text-5xl font-black">
                Poultry Shop
              </h1>

              <p className="mt-3 text-green-50 max-w-2xl">
                Buy chicks, feeds, vitamins, vaccines, and supplements in one checkout.
              </p>
            </div>

            <div className="bg-white/15 rounded-3xl p-5 min-w-[260px]">
              <p className="text-green-50">Wallet Balance</p>
              <h2 className="text-3xl font-black">
                ₱{walletBalance.toLocaleString()}
              </h2>
              <p className="text-sm text-green-50 mt-1">
                Cart Items: {cartCount}
              </p>
            </div>
          </div>
        </section>

        <section className="flex gap-3 overflow-x-auto mb-6">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-5 py-3 rounded-full font-black whitespace-nowrap ${
                activeCategory === cat
                  ? "bg-green-700 text-white"
                  : "bg-white text-green-700 border border-green-100"
              }`}
            >
              {cat === "ALL" ? "All Products" : cat}
            </button>
          ))}
        </section>

        <section className="grid lg:grid-cols-[1fr_360px] gap-6">
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filteredProducts.map((product) => {
              const qty = getQty(product.id);

              return (
                <div
                  key={product.id}
                  className="bg-white rounded-3xl p-6 shadow border border-green-100"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="text-5xl">{product.icon}</div>

                    <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-black">
                      {product.category}
                    </span>
                  </div>

                  <h2 className="text-2xl font-black text-gray-900">
                    {product.name}
                  </h2>

                  <p className="text-gray-500 mt-2 min-h-[48px]">
                    {product.details}
                  </p>

                  <div className="mt-4 bg-green-50 rounded-2xl p-4">
                    <p className="text-sm text-gray-500">Usage Guide</p>
                    <p className="font-semibold text-gray-800">
                      {product.usage}
                    </p>
                  </div>

                  <div className="mt-4 flex justify-between">
                    <div>
                      <p className="text-gray-500">Price</p>
                      <h3 className="text-2xl font-black text-green-700">
                        ₱{product.price}
                      </h3>
                    </div>

                    <div className="text-right">
                      <p className="text-gray-500">Stock</p>
                      <h3 className="font-black">{product.stock}</h3>
                    </div>
                  </div>

                  <div className="mt-5">
                    <p className="font-bold mb-2">Quantity</p>

                    <div className="flex flex-wrap gap-2 mb-3">
                      {quickQty.map((q) => (
                        <button
                          key={q}
                          onClick={() => setQty(product.id, q)}
                          className={`px-3 py-2 rounded-xl font-black ${
                            qty === q
                              ? "bg-green-600 text-white"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {q}x
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setQty(product.id, qty - 1)}
                        className="w-10 h-10 rounded-xl bg-gray-100 font-black"
                      >
                        -
                      </button>

                      <input
                        type="number"
                        value={qty}
                        onChange={(e) =>
                          setQty(product.id, Number(e.target.value))
                        }
                        className="w-full border rounded-xl p-3 text-center font-black"
                      />

                      <button
                        onClick={() => setQty(product.id, qty + 1)}
                        className="w-10 h-10 rounded-xl bg-gray-100 font-black"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={() => addToCart(product)}
                    className="mt-5 w-full bg-green-600 hover:bg-green-700 text-white p-4 rounded-2xl font-black"
                  >
                    Add To Cart
                  </button>
                </div>
              );
            })}
          </div>

          <aside className="bg-white rounded-3xl p-6 shadow border border-green-100 h-fit sticky top-6">
            <h2 className="text-2xl font-black mb-4">
              🛒 Cart
            </h2>

            {cart.length === 0 && (
              <p className="text-gray-500">
                Your cart is empty.
              </p>
            )}

            <div className="grid gap-3">
              {cart.map((item) => (
                <div
                  key={item.id}
                  className="border border-green-100 rounded-2xl p-4"
                >
                  <div className="flex justify-between gap-3">
                    <div>
                      <p className="font-black">
                        {item.icon} {item.name}
                      </p>
                      <p className="text-gray-500">
                        ₱{item.price} x {item.quantity}
                      </p>
                    </div>

                    <button
                      onClick={() => removeFromCart(item.id)}
                      className="text-red-600 font-black"
                    >
                      X
                    </button>
                  </div>

                  <p className="text-right font-black text-green-700 mt-2">
                    ₱{(item.price * item.quantity).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>

            <div className="border-t mt-5 pt-5">
              <div className="flex justify-between font-black text-lg">
                <span>Total</span>
                <span>₱{cartTotal.toLocaleString()}</span>
              </div>

              <button
                onClick={checkout}
                disabled={checkingOut || cart.length === 0}
                className="mt-5 w-full bg-green-700 disabled:bg-gray-400 text-white p-4 rounded-2xl font-black"
              >
                {checkingOut ? "Checking out..." : "Checkout"}
              </button>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}