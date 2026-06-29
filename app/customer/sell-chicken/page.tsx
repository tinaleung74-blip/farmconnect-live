"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Profile = { id: string; email: string | null; full_name: string | null };
type Animal = {
  id: string;
  code: string | null;
  type: string | null;
  breed: string | null;
  name: string | null;
  current_weight: number | string | null;
  health_status: string | null;
  price: number | string | null;
  status: string | null;
  image_url: string | null;
  created_at: string | null;
  profile_id: string | null;
  flock_id: string | null;
};
type Flock = {
  id: string;
  batch_no: string | null;
  breed: string | null;
  alive_count: number | null;
  created_at: string | null;
  purchase_date: string | null;
  status: string | null;
  growth_stage: string | null;
  health_status: string | null;
  caretaker_name: string | null;
};
type Photo = { id: string; animal_id: string; photo_url: string | null; caption: string | null; created_at: string | null };
type Weight = { id: string; animal_id: string; weight_kg: number | string | null; note: string | null; recorded_at: string | null };
type SellRequest = {
  id: string;
  profile_id: string;
  flock_id: string | null;
  batch_no: string | null;
  breed: string | null;
  chicken_stage: string | null;
  quantity: number | null;
  price_per_chicken: number | string | null;
  total_amount: number | string | null;
  status: string | null;
  admin_notes: string | null;
  created_at: string | null;
  animal_id: string | null;
  farmconnect_fee: number | string | null;
  customer_net_amount: number | string | null;
};
type Card = {
  key: string;
  animal: Animal;
  flock: Flock | null;
  latestPhoto: Photo | null;
  latestWeight: Weight | null;
  ageDays: number;
  stage: string;
  ready: boolean;
  displayImage: string;
  imageLabel: "Latest Photo" | "Animal Photo" | "Base Photo";
};

const BASE_IMAGES = {
  chick: "/farmconnect/roosters/fc-stage-1-chick-base.jpg",
  grower: "/farmconnect/roosters/fc-stage-2-grower-base.jpg",
  young: "/farmconnect/roosters/fc-stage-3-young-rooster-base.jpg",
  adult: "/farmconnect/roosters/fc-stage-4-adult-rooster-base.jpg",
};

function daysOld(value?: string | null) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return 0;
  return Math.max(0, Math.floor((Date.now() - time) / 86400000));
}

function stageForAge(days: number) {
  if (days <= 14) return "Chick";
  if (days <= 30) return "Developing";
  if (days <= 59) return "Conditioning";
  return "Ready for Sell";
}

function baseImageForAge(days: number) {
  if (days <= 14) return BASE_IMAGES.chick;
  if (days <= 30) return BASE_IMAGES.grower;
  if (days <= 59) return BASE_IMAGES.young;
  return BASE_IMAGES.adult;
}

function isRooster(animal: Animal) {
  const type = String(animal.type || "").toLowerCase();
  const breed = String(animal.breed || "").toLowerCase();
  return type.includes("rooster") || type.includes("chicken") || type.includes("chick") || breed.includes("rooster");
}

function money(value: any) {
  return Number(value || 0).toLocaleString("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 2 });
}

function dateText(value?: string | null) {
  if (!value) return "No date";
  return new Date(value).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

function statusText(value?: string | null) {
  return String(value || "PENDING").replaceAll("_", " ").toUpperCase();
}

export default function SellChickenPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [flocks, setFlocks] = useState<Flock[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [weights, setWeights] = useState<Weight[]>([]);
  const [requests, setRequests] = useState<SellRequest[]>([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [stageFilter, setStageFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadPage();
  }, []);

  async function resolveProfile() {
    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;
    if (!user) return null;

    const { data } = await supabase
      .from("profiles")
      .select("id,email,full_name")
      .or(`id.eq.${user.id},email.eq.${user.email}`)
      .limit(1)
      .maybeSingle();

    return (data as Profile) || null;
  }

  async function loadPage() {
    setLoading(true);
    setMessage("");
    const currentProfile = await resolveProfile();
    setProfile(currentProfile);
    if (!currentProfile) {
      setLoading(false);
      return;
    }

    const [animalRes, flockRes, requestRes] = await Promise.all([
      supabase
        .from("animals")
        .select("id,code,type,breed,name,current_weight,health_status,price,status,image_url,created_at,profile_id,flock_id")
        .eq("profile_id", currentProfile.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("flocks")
        .select("id,batch_no,breed,alive_count,created_at,purchase_date,status,growth_stage,health_status,caretaker_name")
        .eq("profile_id", currentProfile.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("sell_chicken_requests")
        .select("id,profile_id,flock_id,batch_no,breed,chicken_stage,quantity,price_per_chicken,total_amount,status,admin_notes,created_at,animal_id,farmconnect_fee,customer_net_amount")
        .eq("profile_id", currentProfile.id)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    const animalRows = ((animalRes.data || []) as Animal[]).filter(isRooster);
    setAnimals(animalRows);
    setFlocks((flockRes.data || []) as Flock[]);
    setRequests((requestRes.data || []) as SellRequest[]);

    const animalIds = animalRows.map((item) => item.id);
    if (animalIds.length > 0) {
      const [photoRes, weightRes] = await Promise.all([
        supabase
          .from("animal_photos")
          .select("id,animal_id,photo_url,caption,created_at")
          .in("animal_id", animalIds)
          .order("created_at", { ascending: false }),
        supabase
          .from("animal_weights")
          .select("id,animal_id,weight_kg,note,recorded_at")
          .in("animal_id", animalIds)
          .order("recorded_at", { ascending: false }),
      ]);
      setPhotos((photoRes.data || []) as Photo[]);
      setWeights((weightRes.data || []) as Weight[]);
    } else {
      setPhotos([]);
      setWeights([]);
    }

    setLoading(false);
  }

  const cards = useMemo<Card[]>(() => {
    const flockById = new Map(flocks.map((flock) => [flock.id, flock]));
    const photoByAnimal = new Map<string, Photo>();
    photos.forEach((photo) => {
      if (!photoByAnimal.has(photo.animal_id)) photoByAnimal.set(photo.animal_id, photo);
    });
    const weightByAnimal = new Map<string, Weight>();
    weights.forEach((weight) => {
      if (!weightByAnimal.has(weight.animal_id)) weightByAnimal.set(weight.animal_id, weight);
    });

    return animals.map((animal) => {
      const flock = animal.flock_id ? flockById.get(animal.flock_id) || null : null;
      const latestPhoto = photoByAnimal.get(animal.id) || null;
      const latestWeight = weightByAnimal.get(animal.id) || null;
      const ageDays = daysOld(animal.created_at || flock?.purchase_date || flock?.created_at);
      const stage = stageForAge(ageDays);
      const displayImage = latestPhoto?.photo_url || animal.image_url || baseImageForAge(ageDays);
      const imageLabel = latestPhoto?.photo_url ? "Latest Photo" : animal.image_url ? "Animal Photo" : "Base Photo";

      return {
        key: animal.id,
        animal,
        flock,
        latestPhoto,
        latestWeight,
        ageDays,
        stage,
        ready: ageDays >= 60 && String(animal.status || "").toUpperCase() !== "PENDING_SELL",
        displayImage,
        imageLabel,
      };
    });
  }, [animals, flocks, photos, weights]);

  const filteredCards = useMemo(() => {
    return cards.filter((card) => {
      const text = `${card.animal.name || ""} ${card.animal.code || ""} ${card.animal.breed || ""} ${card.flock?.caretaker_name || ""}`.toLowerCase();
      const matchesSearch = text.includes(search.toLowerCase());
      const matchesStage = stageFilter === "ALL" || card.stage === stageFilter;
      return matchesSearch && matchesStage;
    });
  }, [cards, search, stageFilter]);

  const selected = cards.find((card) => card.key === selectedKey) || filteredCards[0] || cards[0] || null;

  const stats = useMemo(() => {
    return {
      total: cards.length,
      ready: cards.filter((card) => card.ready).length,
      growing: cards.filter((card) => !card.ready).length,
      latest: cards.filter((card) => card.imageLabel === "Latest Photo").length,
    };
  }, [cards]);

  async function submitSellRequest(card: Card | null) {
    if (!profile || !card) return setMessage("Select a rooster first.");
    if (!card.ready) return setMessage("This rooster is not ready for sell yet. Wait until Day 60+.");
    if (!card.animal.flock_id) return setMessage("This rooster has no linked flock record.");

    const ok = window.confirm(`Submit ${card.animal.name || "this rooster"} for admin valuation?`);
    if (!ok) return;

    setSubmitting(true);
    setMessage("");

    const latestPhotoId = card.latestPhoto?.id || null;
    const latestWeightId = card.latestWeight?.id || null;
    const batchNo = card.flock?.batch_no || card.animal.code || "ROOSTER";
    const breed = card.animal.breed || card.flock?.breed || "Premium Rooster";

    const { error: insertError } = await supabase.from("sell_chicken_requests").insert({
      profile_id: profile.id,
      flock_id: card.animal.flock_id,
      batch_no: batchNo,
      breed,
      chicken_stage: card.stage,
      quantity: 1,
      price_per_chicken: 0,
      total_amount: 0,
      status: "PENDING_ADMIN_APPROVAL",
      admin_notes: "Customer submitted ready rooster for admin valuation. Final price will be set by admin per rooster.",
      created_at: new Date().toISOString(),
      animal_id: card.animal.id,
      latest_photo_id: latestPhotoId,
      latest_weight_id: latestWeightId,
      farmconnect_fee: 0,
      customer_net_amount: 0,
    });

    if (insertError) {
      setSubmitting(false);
      setMessage(insertError.message);
      return;
    }

    await supabase.from("animals").update({ status: "PENDING_SELL" }).eq("id", card.animal.id).eq("profile_id", profile.id);
    await supabase.from("notifications").insert({
      customer_id: profile.id,
      title: "Sell request submitted",
      message: `${card.animal.name || "Your rooster"} is now waiting for admin valuation.`,
      is_read: false,
      created_at: new Date().toISOString(),
    });

    setSubmitting(false);
    setMessage("Sell request submitted. Admin will evaluate this rooster and send the final offer.");
    await loadPage();
  }

  async function cancelRequest(request: SellRequest) {
    if (!profile) return;
    const ok = window.confirm("Cancel this pending sell request?");
    if (!ok) return;

    const { error } = await supabase
      .from("sell_chicken_requests")
      .update({ status: "CANCELLED", admin_notes: "Cancelled by customer." })
      .eq("id", request.id)
      .eq("profile_id", profile.id);

    if (error) return setMessage(error.message);
    if (request.animal_id) await supabase.from("animals").update({ status: "ACTIVE" }).eq("id", request.animal_id).eq("profile_id", profile.id);
    setMessage("Sell request cancelled.");
    await loadPage();
  }

  return (
    <main className="min-h-screen bg-[#fff7ed] p-4 pb-28 text-[#18181b] md:p-8">
      <div className="mx-auto max-w-7xl">
        <section className="overflow-hidden rounded-[34px] bg-[#7f0000] text-white shadow-2xl">
          <div className="grid gap-5 bg-gradient-to-br from-[#9f0000] via-[#c40000] to-[#fbbf24] p-6 md:p-8 lg:grid-cols-[1fr_380px]">
            <div>
              <Link href="/customer/chicks" className="mb-5 inline-flex rounded-full bg-white/15 px-4 py-2 font-black text-white hover:bg-white/25">← Back to My Flock</Link>
              <p className="w-fit rounded-full bg-[#facc15] px-4 py-2 text-sm font-black text-[#7f0000]">Rooster Readiness Center</p>
              <h1 className="mt-4 max-w-3xl text-4xl font-black leading-tight md:text-6xl">Sell only when your rooster is ready.</h1>
              <p className="mt-3 max-w-2xl font-semibold leading-7 text-white/85">Base stage photos show first. Once the caretaker uploads a real photo, the latest uploaded photo automatically becomes the selling reference.</p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link href="/customer/photo-updates" className="rounded-2xl bg-white px-5 py-3 font-black text-[#b40000]">Photo Updates</Link>
                <Link href="/customer/weight-updates" className="rounded-2xl bg-[#facc15] px-5 py-3 font-black text-[#2a1600]">Weight Updates</Link>
                <Link href="/customer/caretakers" className="rounded-2xl bg-black/25 px-5 py-3 font-black text-white ring-1 ring-white/20">Request Care</Link>
              </div>
            </div>
            <div className="rounded-[28px] bg-black/25 p-5 ring-1 ring-white/15 backdrop-blur">
              <h2 className="text-2xl font-black">Stage Flow</h2>
              <div className="mt-4 space-y-3 text-sm font-bold text-white/90">
                <p>🐥 Day 1–14: Chick</p>
                <p>🐤 Day 15–30: Developing</p>
                <p>🐓 Day 31–59: Conditioning</p>
                <p>🏁 Day 60+: Ready for Sell</p>
                <p className="rounded-2xl bg-white/10 p-3">Admin sets the final offer per rooster after valuation.</p>
              </div>
            </div>
          </div>
        </section>

        {message && <div className="mt-5 rounded-2xl bg-white p-4 font-black text-[#b40000] shadow">{message}</div>}

        <section className="mt-5 grid gap-4 md:grid-cols-4">
          <Stat label="Roosters" value={stats.total} icon="🐓" />
          <Stat label="Ready" value={stats.ready} icon="🏁" />
          <Stat label="Growing" value={stats.growing} icon="🌱" />
          <Stat label="Latest Photos" value={stats.latest} icon="📸" />
        </section>

        <section className="mt-5 flex flex-col gap-3 rounded-[28px] bg-white p-4 shadow md:flex-row">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search rooster, code, breed, caretaker..." className="min-w-0 flex-1 rounded-2xl border border-orange-100 px-4 py-3 font-bold outline-none focus:border-[#c40000]" />
          <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value)} className="rounded-2xl border border-orange-100 px-4 py-3 font-black outline-none focus:border-[#c40000]">
            <option value="ALL">All Stages</option>
            <option value="Chick">Chick</option>
            <option value="Developing">Developing</option>
            <option value="Conditioning">Conditioning</option>
            <option value="Ready for Sell">Ready for Sell</option>
          </select>
          <button onClick={loadPage} className="rounded-2xl bg-[#2a1100] px-5 py-3 font-black text-white">{loading ? "Refreshing..." : "Refresh"}</button>
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[1fr_420px]">
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredCards.map((card) => (
              <article key={card.key} className={`overflow-hidden rounded-[28px] bg-white shadow-xl ring-1 ${selected?.key === card.key ? "ring-[#facc15]" : "ring-orange-100"}`}>
                <button onClick={() => setSelectedKey(card.key)} className="block w-full text-left">
                  <div className="relative h-56 bg-orange-50">
                    <img src={card.displayImage} alt={card.animal.name || "Rooster"} className="h-full w-full object-cover" />
                    <span className={`absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-black ${card.ready ? "bg-[#b40000] text-white" : "bg-white text-[#b40000]"}`}>{card.ready ? "READY TO SELL" : card.stage}</span>
                    <span className="absolute right-3 top-3 rounded-full bg-white px-3 py-1 text-xs font-black text-[#b40000] shadow">{card.imageLabel}</span>
                    <span className="absolute bottom-3 right-3 rounded-full bg-[#facc15] px-3 py-1 text-xs font-black text-[#2a1100]">Day {card.ageDays}</span>
                  </div>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-xl font-black">{card.animal.name || "Unnamed Rooster"}</h3>
                        <p className="font-black text-[#b40000]">{card.animal.code || "No code"}</p>
                      </div>
                      <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-black text-green-700">{card.animal.health_status || card.flock?.health_status || "Healthy"}</span>
                    </div>
                    <p className="mt-2 text-sm font-bold text-zinc-500">{card.animal.breed || card.flock?.breed || "Premium Rooster"}</p>
                    <div className="mt-4 grid grid-cols-3 gap-2">
                      <Mini label="Age" value={`${card.ageDays}d`} />
                      <Mini label="Weight" value={card.latestWeight?.weight_kg ? `${card.latestWeight.weight_kg}kg` : card.animal.current_weight ? `${card.animal.current_weight}kg` : "—"} />
                      <Mini label="Care" value={card.flock?.caretaker_name ? "Yes" : "—"} />
                    </div>
                    <p className="mt-4 rounded-2xl bg-orange-50 p-3 text-xs font-bold text-[#7f0000]">{card.ready ? "Ready for sell request. Admin will evaluate and send final offer." : "Growing stage. Sell button unlocks at Day 60+."}</p>
                  </div>
                </button>
              </article>
            ))}
            {!loading && filteredCards.length === 0 && <div className="rounded-[28px] bg-white p-10 text-center font-black text-zinc-500 shadow-xl md:col-span-2 xl:col-span-3">No rooster records found.</div>}
          </div>

          <aside className="sticky top-24 h-fit rounded-[30px] bg-white p-5 shadow-2xl">
            <h2 className="text-2xl font-black">Selected Rooster</h2>
            {selected ? (
              <>
                <div className="relative mt-4 overflow-hidden rounded-[24px] bg-orange-50">
                  <img src={selected.displayImage} alt={selected.animal.name || "Selected rooster"} className="h-64 w-full object-cover" />
                  <span className="absolute right-3 top-3 rounded-full bg-white px-3 py-1 text-xs font-black text-[#b40000] shadow">{selected.imageLabel}</span>
                </div>
                <p className="mt-5 text-xs font-black uppercase tracking-[0.16em] text-[#b40000]">Sell Readiness</p>
                <h3 className="mt-1 text-3xl font-black">{selected.animal.name || "Unnamed Rooster"}</h3>
                <p className="font-bold text-zinc-500">{selected.animal.code || "No code"} • {selected.animal.breed || selected.flock?.breed || "Premium Rooster"}</p>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <Info label="Stage" value={selected.stage} />
                  <Info label="Age" value={`${selected.ageDays} days`} />
                  <Info label="Health" value={selected.animal.health_status || selected.flock?.health_status || "Healthy"} />
                  <Info label="Latest Weight" value={selected.latestWeight?.weight_kg ? `${selected.latestWeight.weight_kg} kg` : selected.animal.current_weight ? `${selected.animal.current_weight} kg` : "No record"} />
                  <Info label="Latest Photo" value={dateText(selected.latestPhoto?.created_at)} />
                  <Info label="Caretaker" value={selected.flock?.caretaker_name || "Not assigned"} />
                </div>
                <div className="mt-5 rounded-[24px] bg-orange-50 p-5">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-[#b40000]">Ready for admin evaluation</p>
                  <p className="mt-2 text-sm font-bold text-zinc-600">Submit a sell request. Admin reviews this specific rooster, checks latest photo/weight, then sets final offer price.</p>
                </div>
                <button onClick={() => submitSellRequest(selected)} disabled={!selected.ready || submitting} className="mt-5 w-full rounded-2xl bg-[#b40000] px-5 py-4 font-black text-white shadow-lg disabled:bg-zinc-300">
                  {submitting ? "Submitting..." : selected.ready ? "Submit Sell Request" : "Not Ready Yet"}
                </button>
                <Link href="/customer/photo-updates" className="mt-3 block rounded-2xl bg-[#facc15] px-5 py-4 text-center font-black text-[#2a1100]">View Photo Updates</Link>
              </>
            ) : (
              <p className="mt-4 rounded-2xl bg-orange-50 p-5 font-bold text-zinc-500">Select a rooster card.</p>
            )}
          </aside>
        </section>

        <section className="mt-6 rounded-[30px] bg-white p-5 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#b40000]">Sell Request History</p>
              <h2 className="text-2xl font-black">Admin evaluation queue</h2>
            </div>
            <p className="text-sm font-bold text-zinc-500">Final price is set per rooster and sent by Admin.</p>
          </div>
          <div className="mt-4 space-y-3">
            {requests.map((request) => {
              const pending = String(request.status || "").toUpperCase() === "PENDING_ADMIN_APPROVAL";
              return (
                <article key={request.id} className="rounded-2xl border border-orange-200 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="font-black">{request.batch_no || "Rooster request"}</h3>
                      <p className="text-sm font-bold text-zinc-500">Qty fixed: 1 • {dateText(request.created_at)}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <b className="text-[#b40000]">{Number(request.total_amount || 0) > 0 ? money(request.total_amount) : "Admin valuation"}</b>
                      <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-black text-yellow-800">{statusText(request.status)}</span>
                      {pending && <button onClick={() => cancelRequest(request)} className="rounded-full bg-red-50 px-4 py-2 text-xs font-black text-[#b40000]">Cancel</button>}
                    </div>
                  </div>
                </article>
              );
            })}
            {requests.length === 0 && <p className="rounded-2xl bg-orange-50 p-5 font-bold text-zinc-500">No sell requests yet.</p>}
          </div>
        </section>
      </div>
    </main>
  );
}

function Stat({ label, value, icon }: { label: string; value: number; icon: string }) {
  return <div className="rounded-[24px] bg-white p-5 shadow"><p className="text-2xl">{icon}</p><p className="mt-2 text-sm font-black uppercase text-zinc-500">{label}</p><h2 className="text-3xl font-black text-[#b40000]">{value}</h2></div>;
}
function Mini({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl bg-orange-50 p-3"><p className="text-[10px] font-black uppercase text-zinc-500">{label}</p><p className="font-black">{value}</p></div>;
}
function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl bg-orange-50 p-4"><p className="text-xs font-black uppercase text-zinc-500">{label}</p><p className="mt-1 font-black">{value}</p></div>;
}
