"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  Animal,
  dateText,
  farmBgClass,
  goldButtonClass,
  isChicken,
  money,
  normalizeAnimal,
  panelClass,
  resolveCustomerProfile,
  roosterStage,
  statusPill,
  statusText,
  type CustomerProfile,
} from "@/lib/customer-auth";

type Flock = {
  id: string;
  batch_no: string | null;
  breed: string | null;
  alive_count: number | null;
  created_at: string | null;
  status: string | null;
  health_status?: string | null;
  caretaker_name?: string | null;
};

type PriceSetting = {
  id: string;
  price_per_chicken: number | string | null;
  technical_fee_rate: number | string | null;
  status: string | null;
  updated_at: string | null;
};

type Photo = {
  id: string;
  animal_id: string | null;
  photo_url: string | null;
  caption: string | null;
  created_at: string | null;
  animals?: Animal | Animal[] | null;
};

type Weight = {
  id: string;
  animal_id: string | null;
  weight_kg: number | string | null;
  note: string | null;
  recorded_at: string | null;
};

type SellCard = {
  key: string;
  animalId: string | null;
  flockId: string;
  title: string;
  code: string;
  breed: string;
  stage: string;
  ageDays: number;
  health: string;
  latestWeight: number | string | null;
  latestWeightDate: string | null;
  latestPhotoUrl: string | null;
  latestPhotoDate: string | null;
  latestPhotoCaption: string | null;
  availableCount: number;
  source: "animal" | "flock";
};

function daysOld(value?: string | null) {
  if (!value) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86400000));
}

export default function SellChickenPage() {
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [flocks, setFlocks] = useState<Flock[]>([]);
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [weights, setWeights] = useState<Weight[]>([]);
  const [price, setPrice] = useState<PriceSetting | null>(null);
  const [requests, setRequests] = useState<any[]>([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setMessage("");

    const currentProfile = await resolveCustomerProfile();
    setProfile(currentProfile);

    if (!currentProfile) {
      setLoading(false);
      return;
    }

    const [flockRes, priceRes, requestRes] = await Promise.all([
      supabase
        .from("flocks")
        .select("id,batch_no,breed,alive_count,created_at,status,health_status,caretaker_name")
        .eq("profile_id", currentProfile.id)
        .in("status", ["ACTIVE", "AVAILABLE"])
        .order("created_at", { ascending: false }),
      supabase
        .from("sell_chicken_price_settings")
        .select("id,price_per_chicken,technical_fee_rate,status,updated_at")
        .eq("status", "ACTIVE")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("sell_chicken_requests")
        .select("*")
        .eq("profile_id", currentProfile.id)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    const flockRows = (flockRes.data || []) as Flock[];
    setFlocks(flockRows);
    setPrice((priceRes.data as PriceSetting) || null);
    setRequests(requestRes.data || []);

    const flockIds = flockRows.map((flock) => flock.id);

    await loadAnimalEvidence(currentProfile.id, flockIds);
    setLoading(false);
  }

  async function loadAnimalEvidence(profileId: string, flockIds: string[]) {
    let animalRows: Animal[] = [];

    const richAnimalQuery = supabase
      .from("animals")
      .select("id,code,name,type,breed,current_weight,health_status,image_url,created_at,flock_id,profile_id")
      .eq("profile_id", profileId)
      .order("created_at", { ascending: false });

    const richAnimalRes = await richAnimalQuery;

    if (!richAnimalRes.error) {
      animalRows = ((richAnimalRes.data || []) as Animal[]).filter(isChicken);
    } else {
      const fallbackAnimalRes = await supabase
        .from("animals")
        .select("id,code,name,type,breed,current_weight,health_status,image_url,created_at")
        .order("created_at", { ascending: false })
        .limit(80);

      animalRows = ((fallbackAnimalRes.data || []) as Animal[]).filter(isChicken);
    }

    if (animalRows.length === 0 && flockIds.length > 0) {
      setAnimals([]);
    } else {
      setAnimals(animalRows);
    }

    const animalIds = animalRows.map((animal) => animal.id);

    if (animalIds.length > 0) {
      const [photoRes, weightRes] = await Promise.all([
        supabase
          .from("animal_photos")
          .select("id,animal_id,photo_url,caption,created_at,animals(id,code,name,type,breed,current_weight,health_status,image_url)")
          .in("animal_id", animalIds)
          .order("created_at", { ascending: false })
          .limit(120),
        supabase
          .from("animal_weights")
          .select("id,animal_id,weight_kg,note,recorded_at")
          .in("animal_id", animalIds)
          .order("recorded_at", { ascending: false })
          .limit(120),
      ]);
      setPhotos((photoRes.data || []) as Photo[]);
      setWeights((weightRes.data || []) as Weight[]);
      return;
    }

    const [photoFallback, weightFallback] = await Promise.all([
      supabase
        .from("animal_photos")
        .select("id,animal_id,photo_url,caption,created_at,animals(id,code,name,type,breed,current_weight,health_status,image_url)")
        .order("created_at", { ascending: false })
        .limit(24),
      supabase
        .from("animal_weights")
        .select("id,animal_id,weight_kg,note,recorded_at")
        .order("recorded_at", { ascending: false })
        .limit(24),
    ]);

    setPhotos(((photoFallback.data || []) as Photo[]).filter((photo) => isChicken(normalizeAnimal(photo.animals || null))));
    setWeights((weightFallback.data || []) as Weight[]);
  }

  const sellCards = useMemo<SellCard[]>(() => {
    const photoByAnimal = new Map<string, Photo>();
    photos.forEach((photo) => {
      if (photo.animal_id && !photoByAnimal.has(photo.animal_id)) photoByAnimal.set(photo.animal_id, photo);
    });

    const weightByAnimal = new Map<string, Weight>();
    weights.forEach((weight) => {
      if (weight.animal_id && !weightByAnimal.has(weight.animal_id)) weightByAnimal.set(weight.animal_id, weight);
    });

    const activeFlocks = flocks.filter((flock) => Number(flock.alive_count || 0) > 0);
    const primaryFlock = activeFlocks[0];

    const animalCards = animals
      .filter(isChicken)
      .map((animal, index) => {
        const linkedFlock = flocks.find((flock) => flock.id === animal.flock_id) || primaryFlock;
        if (!linkedFlock) return null;

        const photo = photoByAnimal.get(animal.id);
        const weight = weightByAnimal.get(animal.id);
        const ageDays = daysOld(animal.created_at || linkedFlock.created_at);

        return {
          key: `animal-${animal.id}`,
          animalId: animal.id,
          flockId: linkedFlock.id,
          title: animal.name || `Rooster ${index + 1}`,
          code: animal.code || linkedFlock.batch_no || "No code",
          breed: animal.breed || linkedFlock.breed || "FarmConnect Rooster",
          stage: roosterStage(ageDays),
          ageDays,
          health: animal.health_status || linkedFlock.health_status || "Healthy",
          latestWeight: weight?.weight_kg ?? animal.current_weight ?? null,
          latestWeightDate: weight?.recorded_at || null,
          latestPhotoUrl: photo?.photo_url || animal.image_url || null,
          latestPhotoDate: photo?.created_at || null,
          latestPhotoCaption: photo?.caption || null,
          availableCount: Number(linkedFlock.alive_count || 0),
          source: "animal" as const,
        };
      })
      .filter(Boolean) as SellCard[];

    if (animalCards.length > 0) return animalCards;

    return activeFlocks.map((flock, index) => {
      const photo = photos[index] || photos[0];
      const weight = weights[index] || weights[0];
      const ageDays = daysOld(flock.created_at);

      return {
        key: `flock-${flock.id}`,
        animalId: null,
        flockId: flock.id,
        title: flock.batch_no || `Rooster Lot ${index + 1}`,
        code: flock.batch_no || "No code",
        breed: flock.breed || "FarmConnect Rooster",
        stage: roosterStage(ageDays),
        ageDays,
        health: flock.health_status || "Healthy",
        latestWeight: weight?.weight_kg || null,
        latestWeightDate: weight?.recorded_at || null,
        latestPhotoUrl: photo?.photo_url || null,
        latestPhotoDate: photo?.created_at || null,
        latestPhotoCaption: photo?.caption || null,
        availableCount: Number(flock.alive_count || 0),
        source: "flock" as const,
      };
    });
  }, [animals, flocks, photos, weights]);

  const selected = sellCards.find((card) => card.key === selectedKey) || sellCards[0] || null;
  const pricePerChicken = Number(price?.price_per_chicken || 0);
  const feeRate = Number(price?.technical_fee_rate || 0.02);
  const gross = pricePerChicken;
  const fee = gross * feeRate;
  const net = gross - fee;
  const canSell = !!profile && !!selected && !!price && pricePerChicken > 0 && selected.ageDays >= 30 && selected.availableCount > 0;

  async function submitSellRequest() {
    if (!profile || !selected) return setMessage("Select a rooster first.");
    if (!canSell) return setMessage("This rooster is not ready for selling yet.");

    const confirmSubmit = window.confirm(`Submit sell request for ${selected.title}? Quantity is fixed to 1 rooster.`);
    if (!confirmSubmit) return;

    setSubmitting(true);
    setMessage("");

    let submitError: any = null;

    if (selected.animalId) {
      const perRooster = await supabase.rpc("customer_submit_sell_rooster", {
        p_profile_id: profile.id,
        p_animal_id: selected.animalId,
      });

      submitError = perRooster.error;

      if (!submitError) {
        setSubmitting(false);
        setMessage("Sell request submitted for this rooster. Admin approval is required.");
        await loadData();
        return;
      }
    }

    const fallback = await supabase.rpc("customer_submit_sell_chicken", {
      p_profile_id: profile.id,
      p_flock_id: selected.flockId,
      p_quantity: 1,
    });

    setSubmitting(false);
    if (fallback.error) return setMessage(fallback.error.message || submitError?.message || "Sell request failed.");

    setMessage("Sell request submitted for 1 rooster. Admin approval is required.");
    await loadData();
  }

  async function cancelSellRequest(requestId: string) {
    if (!profile) return;
    const confirmCancel = window.confirm("Cancel this pending sell request and return the reserved rooster?");
    if (!confirmCancel) return;

    const { error } = await supabase.rpc("customer_cancel_sell_chicken", {
      p_request_id: requestId,
      p_profile_id: profile.id,
    });

    if (error) return setMessage(error.message);
    setMessage("Sell request cancelled. Reserved rooster returned.");
    await loadData();
  }

  return (
    <main className={`${farmBgClass} min-h-screen p-4 pb-28 md:p-8`}>
      <div className="mx-auto max-w-7xl">
        <section className="rounded-[42px] border border-white/15 bg-white/10 p-6 text-white shadow-2xl backdrop-blur-xl md:p-8">
          <p className="w-fit rounded-full bg-amber-300 px-4 py-2 text-sm font-black text-emerald-950">Premium Rooster Selling</p>
          <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_360px] lg:items-end">
            <div>
              <h1 className="text-4xl font-black leading-tight md:text-6xl">Sell one rooster at a time.</h1>
              <p className="mt-3 max-w-2xl text-emerald-50">
                Customer sees the latest uploaded photo as reference. Backend keeps profile, flock, and animal references hidden.
              </p>
            </div>
            <div className="rounded-[28px] bg-white/10 p-5 ring-1 ring-white/10">
              <p className="text-sm font-black uppercase tracking-[0.18em] text-amber-200">Live Admin Price</p>
              <h2 className="mt-1 text-4xl font-black">{price ? money(pricePerChicken) : "Not set"}</h2>
              <p className="mt-1 text-sm text-emerald-50">Quantity is always 1 rooster.</p>
            </div>
          </div>
        </section>

        {message && <div className="mt-5 rounded-2xl bg-white p-4 font-black text-emerald-800 shadow">{message}</div>}

        <section className="mt-6 grid gap-6 xl:grid-cols-[1fr_420px]">
          <div>
            <div className="mb-4 flex items-center justify-between gap-4 text-white">
              <h2 className="text-2xl font-black">Sellable rooster references</h2>
              <button onClick={loadData} className="rounded-full bg-white/15 px-4 py-2 text-sm font-black hover:bg-white/25">
                {loading ? "Refreshing..." : "Refresh"}
              </button>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              {sellCards.map((card) => {
                const selectedCard = selected?.key === card.key;
                const ready = card.ageDays >= 30;

                return (
                  <button
                    key={card.key}
                    onClick={() => setSelectedKey(card.key)}
                    className={`overflow-hidden rounded-[34px] bg-white text-left shadow-2xl transition hover:-translate-y-1 ${selectedCard ? "ring-4 ring-amber-300" : "ring-1 ring-white/20"}`}
                  >
                    <div className="relative h-72 bg-emerald-50">
                      {card.latestPhotoUrl ? (
                        <img src={card.latestPhotoUrl} alt={card.title} className="h-full w-full object-cover" />
                      ) : (
                        <div className="grid h-full place-items-center text-7xl">🐓</div>
                      )}
                      <div className="absolute left-4 top-4 rounded-full bg-emerald-950/85 px-4 py-2 text-xs font-black text-white backdrop-blur">
                        {card.stage}
                      </div>
                      <div className={`absolute right-4 top-4 rounded-full px-4 py-2 text-xs font-black ${ready ? "bg-amber-300 text-emerald-950" : "bg-white/90 text-slate-600"}`}>
                        {ready ? "READY" : "NOT READY"}
                      </div>
                    </div>
                    <div className="p-5">
                      <h3 className="text-2xl font-black text-emerald-950">{card.title}</h3>
                      <p className="mt-1 font-bold text-slate-500">{card.code} • {card.breed}</p>
                      <div className="mt-4 grid grid-cols-3 gap-3">
                        <div className="rounded-2xl bg-emerald-50 p-3">
                          <p className="text-xs font-black uppercase text-slate-500">Age</p>
                          <p className="font-black text-emerald-900">{card.ageDays}d</p>
                        </div>
                        <div className="rounded-2xl bg-blue-50 p-3">
                          <p className="text-xs font-black uppercase text-slate-500">Weight</p>
                          <p className="font-black text-blue-800">{card.latestWeight ? `${card.latestWeight}kg` : "—"}</p>
                        </div>
                        <div className="rounded-2xl bg-amber-50 p-3">
                          <p className="text-xs font-black uppercase text-slate-500">Price</p>
                          <p className="font-black text-amber-800">{money(pricePerChicken)}</p>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {sellCards.length === 0 && (
              <div className="rounded-[32px] bg-white p-10 text-center font-black text-slate-500 shadow-2xl">
                No sellable rooster reference found yet. Add a flock and caretaker photo updates first.
              </div>
            )}
          </div>

          <aside className={`${panelClass} sticky top-24 h-fit p-6`}>
            <h2 className="text-2xl font-black text-emerald-950">Selected Details</h2>

            {selected ? (
              <>
                <div className="mt-4 overflow-hidden rounded-[28px] bg-slate-100">
                  {selected.latestPhotoUrl ? (
                    <img src={selected.latestPhotoUrl} alt={selected.title} className="h-72 w-full object-cover" />
                  ) : (
                    <div className="grid h-72 place-items-center text-7xl">🐓</div>
                  )}
                </div>

                <div className="mt-5">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">Customer reference</p>
                  <h3 className="mt-1 text-3xl font-black text-emerald-950">{selected.title}</h3>
                  <p className="font-bold text-slate-500">{selected.code} • {selected.breed}</p>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <Info label="Stage" value={selected.stage} />
                  <Info label="Age" value={`${selected.ageDays} days`} />
                  <Info label="Health" value={selected.health} />
                  <Info label="Latest Weight" value={selected.latestWeight ? `${selected.latestWeight} kg` : "No record"} />
                  <Info label="Latest Photo" value={dateText(selected.latestPhotoDate)} />
                  <Info label="Available" value={`${selected.availableCount} rooster(s)`} />
                </div>

                <div className="mt-5 rounded-[24px] bg-emerald-50 p-5">
                  <div className="flex justify-between gap-3">
                    <span className="font-bold text-slate-500">Gross</span>
                    <b className="text-emerald-800">{money(gross)}</b>
                  </div>
                  <div className="mt-2 flex justify-between gap-3">
                    <span className="font-bold text-slate-500">FarmConnect fee</span>
                    <b className="text-red-600">{money(fee)}</b>
                  </div>
                  <div className="mt-2 flex justify-between gap-3 border-t pt-3">
                    <span className="font-black text-slate-700">Net after approval</span>
                    <b className="text-emerald-800">{money(net)}</b>
                  </div>
                </div>

                <button onClick={submitSellRequest} disabled={!canSell || submitting} className={`mt-5 w-full ${goldButtonClass}`}>
                  {submitting ? "Submitting..." : "Sell This Rooster"}
                </button>
                {!canSell && <p className="mt-3 rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-800">Needs active admin price, valid flock, and at least Young Tandang stage.</p>}
              </>
            ) : (
              <p className="mt-4 rounded-2xl bg-slate-50 p-5 font-bold text-slate-500">Select a rooster card to view details.</p>
            )}
          </aside>
        </section>

        <section className={`${panelClass} mt-6 p-6`}>
          <h2 className="text-2xl font-black text-emerald-950">Sell Request History</h2>
          <div className="mt-4 space-y-3">
            {requests.map((request) => {
              const pending = String(request.status || "").toUpperCase() === "PENDING_ADMIN_APPROVAL";
              return (
                <article key={request.id} className="rounded-2xl border border-slate-100 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h3 className="font-black text-slate-900">{request.batch_no || request.breed || "Rooster Sale"}</h3>
                      <p className="text-sm font-bold text-slate-500">Qty fixed: 1 • {dateText(request.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <b className="text-emerald-700">{money(request.total_amount)}</b>
                      <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusPill(request.status)}`}>{statusText(request.status)}</span>
                      {pending && (
                        <button onClick={() => cancelSellRequest(request.id)} className="rounded-full bg-red-50 px-4 py-2 text-sm font-black text-red-700 hover:bg-red-100">
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
            {requests.length === 0 && <p className="rounded-2xl bg-slate-50 p-5 font-bold text-slate-500">No sell requests yet.</p>}
          </div>
        </section>
      </div>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-xs font-black uppercase text-slate-500">{label}</p>
      <p className="mt-1 font-black text-emerald-950">{value}</p>
    </div>
  );
}
