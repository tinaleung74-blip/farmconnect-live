"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  Animal,
  dateText,
  daysOld,
  isChicken,
  money,
  resolveCustomerProfile,
  statusPill,
  statusText,
  type CustomerProfile,
} from "@/lib/customer-auth";

const HERO_IMAGE = "/farmconnect/roosters/fc-rooster-hero.jpg";

type Flock = {
  id: string;
  batch_no: string | null;
  breed: string | null;
  total_chicks: number | null;
  alive_count: number | null;
  mortality_count?: number | null;
  expected_harvest_date?: string | null;
  status: string | null;
  health_status?: string | null;
  caretaker_name?: string | null;
  created_at: string | null;
};

type Hire = {
  id: string;
  caretaker_name: string | null;
  flock_id: string | null;
  status: string | null;
  payment_status: string | null;
  total_fee?: number | string | null;
  created_at?: string | null;
};

type Photo = {
  id: string;
  animal_id: string | null;
  photo_url: string | null;
  caption: string | null;
  created_at: string | null;
};

type Weight = {
  id: string;
  animal_id: string | null;
  weight_kg: number | string | null;
  note: string | null;
  recorded_at: string | null;
};

type RoosterCard = {
  id: string;
  flock: Flock | null;
  animal: Animal | null;
  title: string;
  breed: string;
  ageDays: number;
  stage: string;
  health: string;
  imageUrl: string;
  isBaseImage: boolean;
  latestPhoto: Photo | null;
  latestWeight: Weight | null;
  caretaker: Hire | null;
};

export default function MyFlockPage() {
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [flocks, setFlocks] = useState<Flock[]>([]);
  const [hires, setHires] = useState<Hire[]>([]);
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [weights, setWeights] = useState<Weight[]>([]);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("NEWEST");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setMessage("");

    const currentProfile = await resolveCustomerProfile();
    setProfile(currentProfile);

    if (!currentProfile) {
      setMessage("Login required.");
      setLoading(false);
      return;
    }

    const [profileRes, flockRes, hireRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", currentProfile.id).maybeSingle(),
      supabase
        .from("flocks")
        .select("id,batch_no,breed,total_chicks,alive_count,mortality_count,expected_harvest_date,status,health_status,caretaker_name,created_at")
        .eq("profile_id", currentProfile.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("customer_caretaker_hires")
        .select("id,caretaker_name,flock_id,status,payment_status,total_fee,created_at")
        .eq("profile_id", currentProfile.id)
        .order("created_at", { ascending: false }),
    ]);

    if (profileRes.data) setProfile(profileRes.data as CustomerProfile);
    if (flockRes.error) setMessage(flockRes.error.message);

    const flockRows = (flockRes.data || []) as Flock[];
    setFlocks(flockRows);
    setHires((hireRes.data || []) as Hire[]);

    await loadAnimalsAndEvidence(currentProfile.id, flockRows.map((row) => row.id));
    setLoading(false);
  }

  async function loadAnimalsAndEvidence(profileId: string, flockIds: string[]) {
    let animalRows: Animal[] = [];

    const byProfile = await supabase
      .from("animals")
      .select("id,code,name,type,breed,current_weight,health_status,image_url,created_at,flock_id,profile_id")
      .eq("profile_id", profileId)
      .order("created_at", { ascending: false });

    if (!byProfile.error) {
      animalRows = ((byProfile.data || []) as Animal[]).filter(isChicken);
    } else if (flockIds.length > 0) {
      const byFlock = await supabase
        .from("animals")
        .select("id,code,name,type,breed,current_weight,health_status,image_url,created_at,flock_id")
        .in("flock_id", flockIds)
        .order("created_at", { ascending: false });

      if (!byFlock.error) animalRows = ((byFlock.data || []) as Animal[]).filter(isChicken);
    }

    setAnimals(animalRows);

    const animalIds = animalRows.map((animal) => animal.id);
    if (animalIds.length === 0) {
      setPhotos([]);
      setWeights([]);
      return;
    }

    const [photoRes, weightRes] = await Promise.all([
      supabase
        .from("animal_photos")
        .select("id,animal_id,photo_url,caption,created_at")
        .in("animal_id", animalIds)
        .order("created_at", { ascending: false })
        .limit(300),
      supabase
        .from("animal_weights")
        .select("id,animal_id,weight_kg,note,recorded_at")
        .in("animal_id", animalIds)
        .order("recorded_at", { ascending: false })
        .limit(300),
    ]);

    setPhotos((photoRes.data || []) as Photo[]);
    setWeights((weightRes.data || []) as Weight[]);
  }

  const photoByAnimal = useMemo(() => {
    const map = new Map<string, Photo>();
    photos.forEach((photo) => {
      if (photo.animal_id && !map.has(photo.animal_id)) map.set(photo.animal_id, photo);
    });
    return map;
  }, [photos]);

  const weightByAnimal = useMemo(() => {
    const map = new Map<string, Weight>();
    weights.forEach((weight) => {
      if (weight.animal_id && !map.has(weight.animal_id)) map.set(weight.animal_id, weight);
    });
    return map;
  }, [weights]);

  function getFlock(flockId?: string | null) {
    return flocks.find((flock) => flock.id === flockId) || null;
  }

  function getCaretaker(flockId?: string | null) {
    if (!flockId) return null;
    return (
      hires.find(
        (hire) =>
          hire.flock_id === flockId &&
          ["ACTIVE", "APPROVED", "ASSIGNED", "PENDING_ADMIN_APPROVAL"].includes(
            String(hire.status || "").toUpperCase(),
          ),
      ) || null
    );
  }

  function getStage(age: number) {
    if (age <= 14) return "Chick";
    if (age <= 28) return "Grower";
    if (age <= 60) return "Young Rooster";
    return "Adult Rooster";
  }

  function getBaseImage(age: number) {
    if (age <= 14) return "/farmconnect/roosters/fc-stage-1-chick-base.jpg";
    if (age <= 28) return "/farmconnect/roosters/fc-stage-2-grower-base.jpg";
    if (age <= 60) return "/farmconnect/roosters/fc-stage-3-young-rooster-base.jpg";
    return "/farmconnect/roosters/fc-stage-4-adult-rooster-base.jpg";
  }

  const roosterCards = useMemo<RoosterCard[]>(() => {
    const directAnimalCards = animals.map((animal, index) => {
      const flock = getFlock(animal.flock_id);
      const ageDays = daysOld(animal.created_at || flock?.created_at);
      const latestPhoto = photoByAnimal.get(animal.id) || null;
      const latestWeight = weightByAnimal.get(animal.id) || null;
      const baseImage = getBaseImage(ageDays);
      const imageUrl = latestPhoto?.photo_url || animal.image_url || baseImage;

      return {
        id: animal.id,
        flock,
        animal,
        title: animal.name || animal.code || flock?.batch_no || `Rooster ${index + 1}`,
        breed: animal.breed || flock?.breed || "Premium Rooster",
        ageDays,
        stage: getStage(ageDays),
        health: animal.health_status || flock?.health_status || "Healthy",
        imageUrl,
        isBaseImage: !latestPhoto?.photo_url && !animal.image_url,
        latestPhoto,
        latestWeight,
        caretaker: getCaretaker(animal.flock_id),
      };
    });

    if (directAnimalCards.length > 0) return directAnimalCards;

    return flocks.map((flock, index) => {
      const ageDays = daysOld(flock.created_at);
      return {
        id: flock.id,
        flock,
        animal: null,
        title: flock.batch_no || `Rooster ${index + 1}`,
        breed: flock.breed || "Premium Rooster",
        ageDays,
        stage: getStage(ageDays),
        health: flock.health_status || "Healthy",
        imageUrl: getBaseImage(ageDays),
        isBaseImage: true,
        latestPhoto: null,
        latestWeight: null,
        caretaker: getCaretaker(flock.id),
      };
    });
  }, [animals, flocks, photoByAnimal, weightByAnimal, hires]);

  const filtered = useMemo(() => {
    let rows = roosterCards.filter((card) => {
      const haystack = `${card.title} ${card.breed} ${card.stage} ${card.health} ${card.caretaker?.caretaker_name || ""}`.toLowerCase();
      return haystack.includes(search.toLowerCase()) && (stageFilter === "ALL" || card.stage === stageFilter);
    });

    if (sortBy === "OLDEST") rows = [...rows].sort((a, b) => a.ageDays - b.ageDays);
    if (sortBy === "AGE_DESC") rows = [...rows].sort((a, b) => b.ageDays - a.ageDays);
    if (sortBy === "WEIGHT_DESC") {
      rows = [...rows].sort((a, b) => Number(b.latestWeight?.weight_kg || 0) - Number(a.latestWeight?.weight_kg || 0));
    }

    return rows;
  }, [roosterCards, search, stageFilter, sortBy]);

  const stats = useMemo(() => {
    const total = roosterCards.length;
    const healthy = roosterCards.filter((card) => String(card.health).toUpperCase().includes("HEALTH")).length;
    const atRisk = roosterCards.filter((card) => !String(card.health).toUpperCase().includes("HEALTH")).length;
    const totalWeight = roosterCards.reduce((sum, card) => sum + Number(card.latestWeight?.weight_kg || card.animal?.current_weight || 0), 0);
    const activeCare = roosterCards.filter((card) => card.caretaker).length;

    return { total, healthy, atRisk, totalWeight, activeCare };
  }, [roosterCards]);

  return (
    <main className="min-h-screen bg-[#fbfaf8] p-4 pb-28 text-[#151515] md:p-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-4xl font-black tracking-tight md:text-6xl">My Flock</h1>
            <p className="mt-1 text-base font-semibold text-neutral-500">
              Monitor each rooster investment, caretaker care, and growth updates.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/customer/notifications" className="relative grid h-14 w-14 place-items-center rounded-full bg-white text-2xl shadow-lg">
              🔔
              {stats.atRisk > 0 && (
                <span className="absolute -right-1 -top-1 grid h-6 w-6 place-items-center rounded-full bg-[#d71920] text-xs font-black text-white">
                  {stats.atRisk}
                </span>
              )}
            </Link>

            <Link href="/customer/marketplace" className="rounded-full bg-[#d71920] px-5 py-4 text-sm font-black text-white shadow-xl hover:bg-[#b9151b]">
              + Add New Chick
            </Link>
          </div>
        </header>

        {message && <div className="mt-5 rounded-[24px] border border-red-100 bg-white p-4 font-black text-[#d71920] shadow">{message}</div>}

        <section className="mt-6 overflow-hidden rounded-[34px] bg-white shadow-xl">
          <div className="relative min-h-[315px] bg-black">
            <img src={HERO_IMAGE} alt="FarmConnect rooster hero" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/35 to-black/10" />

            <div className="relative z-10 grid min-h-[315px] gap-6 p-7 text-white md:grid-cols-[1fr_360px] md:p-10">
              <div>
                <p className="font-black text-[#ff3b3b]">Welcome back, {profile?.full_name?.split(" ")[0] || "Customer"}!</p>
                <h2 className="mt-4 max-w-xl text-4xl font-black leading-tight md:text-6xl">
                  Rooster Farm, <span className="text-[#ff3b3b]">Real Updates.</span>
                </h2>
                <p className="mt-5 max-w-md text-lg font-semibold leading-8 text-white/85">
                  Track every rooster from base stage photo to caretaker-uploaded progress evidence.
                </p>

                <div className="mt-7 flex flex-wrap gap-3">
                  <Link href="/customer/sell-chicken" className="rounded-2xl bg-[#d71920] px-6 py-4 font-black text-white shadow-lg">
                    Sell Chicken
                  </Link>
                  <Link href="/customer/photo-updates" className="rounded-2xl bg-white px-6 py-4 font-black text-[#d71920] shadow-lg">
                    View Updates
                  </Link>
                  <Link href="/customer/caretakers" className="rounded-2xl border border-white/25 bg-white/10 px-6 py-4 font-black text-white backdrop-blur-xl">
                    Request Care
                  </Link>
                </div>
              </div>

              <aside className="rounded-[28px] border border-white/15 bg-black/35 p-5 backdrop-blur-xl">
                <p className="text-sm font-black uppercase tracking-[0.18em] text-red-200">Farm Care Overview</p>
                <HeroRow label="Active Roosters" value={stats.total.toLocaleString()} />
                <HeroRow label="With Caretaker" value={stats.activeCare.toLocaleString()} />
                <HeroRow label="At Risk" value={stats.atRisk.toLocaleString()} />
                <HeroRow label="Wallet" value={money(profile?.wallet_balance)} />
              </aside>
            </div>
          </div>
        </section>

        <section className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Summary icon="🐓" label="Total Roosters" value={stats.total.toLocaleString()} note="One card per rooster" />
          <Summary icon="❤️" label="Healthy" value={stats.healthy.toLocaleString()} note={`${stats.total ? Math.round((stats.healthy / stats.total) * 100) : 0}% healthy`} />
          <Summary icon="⚠️" label="At Risk" value={stats.atRisk.toLocaleString()} note="Needs attention" danger />
          <Summary icon="⚖️" label="Total Weight" value={`${stats.totalWeight.toFixed(2)} kg`} note="Latest records" />
          <Summary icon="👨‍🌾" label="Caretaker Care" value={stats.activeCare.toLocaleString()} note="Assigned records" />
        </section>

        <section className="mt-5 grid gap-3 lg:grid-cols-[1fr_.35fr_.35fr_.35fr]">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by rooster name, breed, stage, or caretaker..."
            className="rounded-2xl border border-neutral-200 bg-white px-5 py-4 font-bold outline-none focus:border-[#d71920]"
          />

          <select value={stageFilter} onChange={(event) => setStageFilter(event.target.value)} className="rounded-2xl border border-neutral-200 bg-white px-4 py-4 font-bold outline-none focus:border-[#d71920]">
            <option value="ALL">All Stage</option>
            <option value="Chick">Chick</option>
            <option value="Grower">Grower</option>
            <option value="Young Rooster">Young Rooster</option>
            <option value="Adult Rooster">Adult Rooster</option>
          </select>

          <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} className="rounded-2xl border border-neutral-200 bg-white px-4 py-4 font-bold outline-none focus:border-[#d71920]">
            <option value="NEWEST">Newest First</option>
            <option value="OLDEST">Youngest First</option>
            <option value="AGE_DESC">Oldest Stage</option>
            <option value="WEIGHT_DESC">Highest Weight</option>
          </select>

          <button onClick={load} className="rounded-2xl bg-[#151515] px-5 py-4 font-black text-white shadow-lg">
            {loading ? "Loading..." : "Refresh"}
          </button>
        </section>

        <section className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {filtered.map((card) => (
            <article key={card.id} className="overflow-hidden rounded-[28px] bg-white shadow-xl ring-1 ring-neutral-100 transition hover:-translate-y-1">
              <div className="relative h-56 bg-[#fff0f0]">
                <img src={card.imageUrl} alt={card.title} className="h-full w-full object-cover" />
                <span className="absolute left-4 top-4 rounded-full bg-[#d71920] px-3 py-1 text-xs font-black text-white">
                  Day {card.ageDays}
                </span>
                <span className="absolute right-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-black text-[#d71920] shadow">
                  {card.stage}
                </span>
                {card.isBaseImage && (
                  <span className="absolute bottom-3 right-3 rounded-full bg-black/70 px-3 py-1 text-xs font-black text-white backdrop-blur">
                    Base photo
                  </span>
                )}
              </div>

              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-black">{card.title}</h2>
                    <p className="mt-1 text-sm font-bold text-neutral-500">{card.breed}</p>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusPill(card.health)}`}>
                    {statusText(card.health)}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-3 overflow-hidden rounded-2xl border border-neutral-100 bg-[#fbfaf8]">
                  <Mini label="Age" value={`${card.ageDays}d`} />
                  <Mini label="Weight" value={card.latestWeight ? `${card.latestWeight.weight_kg}kg` : "—"} />
                  <Mini label="Stage" value={card.stage.replace(" Rooster", "")} />
                </div>

                <div className="mt-4 rounded-2xl bg-[#fff7f7] p-4">
                  <p className="text-xs font-black uppercase tracking-wide text-[#d71920]">Caretaker Care</p>
                  <h3 className="mt-1 font-black">{card.caretaker?.caretaker_name || card.flock?.caretaker_name || "No caretaker assigned"}</h3>
                  <p className="mt-1 text-xs font-bold text-neutral-500">
                    Status: {card.caretaker ? statusText(card.caretaker.status) : "Not assigned"} • Payment: {card.caretaker ? statusText(card.caretaker.payment_status) : "—"}
                  </p>
                  {card.caretaker?.total_fee && (
                    <p className="mt-1 text-xs font-bold text-neutral-500">
                      Fee: {money(card.caretaker.total_fee)} • Platform fee handled in Caretaker page
                    </p>
                  )}
                </div>

                {card.isBaseImage && (
                  <p className="mt-3 rounded-2xl bg-amber-50 p-3 text-xs font-bold text-amber-800">
                    Base photo only. This will be replaced by actual caretaker uploaded photo.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-4 gap-2 px-5 pb-5">
                <Link href="/customer/live-camera" className="rounded-xl bg-neutral-100 py-3 text-center text-xs font-black text-neutral-700">Details</Link>
                <Link href="/customer/photo-updates" className="rounded-xl bg-neutral-100 py-3 text-center text-xs font-black text-neutral-700">Photos</Link>
                <Link href="/customer/weight-updates" className="rounded-xl bg-neutral-100 py-3 text-center text-xs font-black text-neutral-700">Weight</Link>
                <Link href="/customer/caretakers" className="rounded-xl bg-[#d71920] py-3 text-center text-xs font-black text-white">Care</Link>
              </div>

              <div className="grid grid-cols-2 gap-2 px-5 pb-5">
                <Link href="/customer/sell-chicken" className="rounded-xl bg-[#151515] py-3 text-center text-xs font-black text-white">Sell</Link>
                <Link href="/customer/notifications" className="rounded-xl border border-red-100 bg-white py-3 text-center text-xs font-black text-[#d71920]">Timeline</Link>
              </div>
            </article>
          ))}

          <Link href="/customer/marketplace" className="grid min-h-[500px] place-items-center rounded-[28px] border-2 border-dashed border-[#d71920]/25 bg-[#fff7f7] p-8 text-center shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
            <div>
              <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-white text-4xl text-[#d71920] shadow-lg">+</div>
              <h2 className="mt-5 text-2xl font-black text-[#d71920]">Add New Chick</h2>
              <p className="mt-2 font-semibold text-neutral-500">Buy from Marketplace. Admin/caretaker updates will replace base photos.</p>
            </div>
          </Link>
        </section>

        {!loading && filtered.length === 0 && (
          <div className="mt-6 rounded-[32px] bg-white p-10 text-center shadow-xl">
            <div className="text-6xl">🐓</div>
            <h2 className="mt-4 text-3xl font-black">No rooster record found.</h2>
            <p className="mt-2 font-bold text-neutral-500">Buy a chick from Marketplace or try another search.</p>
          </div>
        )}

        <section className="mt-6 grid gap-5 lg:grid-cols-[1fr_1fr]">
          <div className="rounded-[28px] bg-white p-6 shadow-xl">
            <h2 className="text-2xl font-black">Assigned Caretaker</h2>
            <p className="mt-2 font-semibold text-neutral-500">Caretaker info is shown here, but payment/request logic stays in the Caretaker page.</p>
            <Link href="/customer/caretakers" className="mt-5 inline-block rounded-2xl bg-[#d71920] px-6 py-4 font-black text-white">
              Open Caretaker Care
            </Link>
          </div>

          <div className="rounded-[28px] bg-white p-6 shadow-xl">
            <h2 className="text-2xl font-black">Manual Care Request</h2>
            <p className="mt-2 font-semibold text-neutral-500">Request photo update, weight check, health check, feeding, or vaccination from caretaker flow.</p>
            <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3">
              {["Photo", "Weight", "Health", "Feeding", "Vaccine", "Other"].map((item) => (
                <Link key={item} href="/customer/caretakers" className="rounded-2xl bg-[#fff7f7] p-4 text-center font-black text-[#d71920]">
                  {item}
                </Link>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function HeroRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-4 flex items-center justify-between border-b border-white/10 pb-3 last:border-b-0">
      <span className="font-bold text-white/70">{label}</span>
      <b>{value}</b>
    </div>
  );
}

function Summary({ icon, label, value, note, danger }: { icon: string; label: string; value: string; note: string; danger?: boolean }) {
  return (
    <div className="rounded-[28px] bg-white p-5 shadow-xl">
      <div className="flex items-center gap-4">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[#fff0f0] text-3xl">{icon}</div>
        <div>
          <p className="text-sm font-bold text-neutral-500">{label}</p>
          <h3 className={`mt-1 text-3xl font-black ${danger ? "text-[#d71920]" : "text-[#151515]"}`}>{value}</h3>
          <p className={danger ? "text-sm font-bold text-[#d71920]" : "text-sm font-bold text-neutral-500"}>{note}</p>
        </div>
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-r border-neutral-100 p-3 text-center last:border-r-0">
      <p className="text-sm font-black text-[#151515]">{value}</p>
      <p className="text-[11px] font-bold text-neutral-500">{label}</p>
    </div>
  );
}