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

type FlockOption = {
  id: string;
  batch_no: string;
  breed: string;
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
  const [flocks, setFlocks] = useState<FlockOption[]>([]);
  const [selectedFlockId, setSelectedFlockId] = useState("");

  function getProfile() {
    const user = localStorage.getItem("farmconnect_user");
    if (!user) return null;
    return JSON.parse(user);
  }

  async function loadWallet() {
    const profile = getProfile();
    if (!profile) return;

    const { data } = await supabase
      .from("profiles")
      .select("wallet_balance")
      .eq("id", profile.id)
      .maybeSingle();

    setWalletBalance(Number(data?.wallet_balance || 0));
  }

  async function loadFlocks() {
    const profile = getProfile();
    if (!profile) return;

    const { data } = await supabase
      .from("flocks")
      .select("id,batch_no,breed")
      .eq("profile_id", profile.id)
      .eq("status", "ACTIVE")
      .order("created_at", { ascending: false });

    setFlocks(data || []);

    if (data && data.length > 0) {
      setSelectedFlockId(data[0].id);
    }
  }

  useEffect(() => {
    loadWallet();
    loadFlocks();
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

  const hasSupplies = cart.some((item) => item.category !== "CHICKS");

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
    flockId: string,
    item: CartItem
  ) {
    const unit = getInventoryUnit(item.category);
    const lowStockLevel = getLowStockLevel(item.category);

    const { data: existing, error: findError } = await supabase
      .from("flock_inventory")
      .select("id, starting_qty, remaining_qty")
      .eq("profile_id", profileId)
      .eq("flock_id", flockId)
      .eq("item_name", item.name)
      .eq("category", item.category)
      .maybeSingle();

    if (findError) {
      throw findError;
    }

    if (existing) {
      const { error: updateError } = await supabase
        .from("flock_inventory")
        .update({
          starting_qty: Number(existing.starting_qty || 0) + item.quantity,
          remaining_qty: Number(existing.remaining_qty || 0) + item.quantity,
          status: "AVAILABLE",
        })
        .eq("id", existing.id);

      if (updateError) {
        throw updateError;
      }

      return;
    }

    const { error: insertError } = await supabase.from("flock_inventory").insert({
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

    if (insertError) {
      throw insertError;
    }
  }

  async function createFlockFromChicks(profileId: string, item: CartItem) {
    const batchNo = "FC-" + Math.floor(100000 + Math.random() * 900000);

    const harvestDate = new Date();
    harvestDate.setDate(harvestDate.getDate() + 45);

    const { data, error } = await supabase
      .from("flocks")
      .insert({
        profile_id: profileId,
        batch_no: batchNo,
        breed: item.name,
        total_chicks: item.quantity,
        alive_count: item.quantity,
        mortality_count: 0,
        expected_harvest_date: harvestDate.toISOString().split("T")[0],
        status: "ACTIVE",
        caretaker_name: null,
      })
      .select("id,batch_no,breed")
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  async function checkout() {
    const profile = getProfile();

    if (!profile) {
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

    if (hasSupplies && !selectedFlockId) {
      alert("Please create or buy chicks first before buying feeds, vitamins, vaccines, or supplements.");
      return;
    }

    setCheckingOut(true);

    try {
      const newBalance = walletBalance - cartTotal;

      const { error: walletError } = await supabase
        .from("profiles")
        .update({ wallet_balance: newBalance })
        .eq("id", profile.id);

      if (walletError) {
        throw walletError;
      }

      let targetFlockId = selectedFlockId;

      for (const item of cart) {
        if (item.category === "CHICKS") {
          const newFlock = await createFlockFromChicks(profile.id, item);

          if (newFlock?.id) {
            targetFlockId = newFlock.id;
          }
        } else {
          if (!targetFlockId) {
            throw new Error("No active flock selected for inventory sync.");
          }

          await syncMarketplaceItemToInventory(profile.id, targetFlockId, item);
        }

        const { error: txError } = await supabase
          .from("wallet_transactions")
          .insert({
            profile_id: profile.id,
            transaction_type: "PURCHASE",
            amount: item.price * item.quantity * -1,
            reference_no:
              "FC-MKT-" +
              Date.now() +
              "-" +
              Math.floor(Math.random() * 1000),
            remarks: `${item.name} x${item.quantity}`,
            status: "COMPLETED",
          });

        if (txError) {
          throw txError;
        }
      }

      setWalletBalance(newBalance);
      setCart([]);
      await loadFlocks();

      alert("Checkout successful! Supplies synced to selected flock inventory.");
    } catch (err: any) {
      console.error("CHECKOUT ERROR:", err);
      alert(err?.message || "Checkout failed");
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

              <h1 className="text-4xl md:text-5xl font-black">Poultry Shop</h1>

              <p className="mt-3 text-green-50 max-w-2xl">
                Buy chicks, feeds, vitamins, vaccines, and supplements. Supplies
                will sync directly to the selected flock inventory.
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

        <section className="bg-white rounded-3xl p-5 shadow border border-green-100 mb-6">
          <h2 className="text-xl font-black text-green-900 mb-2">
            🎯 Select Flock For Supplies
          </h2>

          <p className="text-gray-500 text-sm mb-3">
            Feeds, vitamins, vaccines, and supplements will be added to this flock.
            Chicks will create a new flock automatically.
          </p>

          <select
            value={selectedFlockId}
            onChange={(e) => setSelectedFlockId(e.target.value)}
            className="w-full border rounded-2xl p-4 font-bold"
          >
            <option value="">No active flock selected</option>
            {flocks.map((flock) => (
              <option key={flock.id} value={flock.id}>
                {flock.batch_no} - {flock.breed}
              </option>
            ))}
          </select>
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
            <h2 className="text-2xl font-black mb-4">🛒 Cart</h2>

            {cart.length === 0 && (
              <p className="text-gray-500">Your cart is empty.</p>
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