"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  Animal,
  dateText,
  daysOld,
  farmBgClass,
  isChicken,
  money,
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
  caretaker_id?: string | null;
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

function survivalRate(flock: Flock) {
  const total = Number(flock.total_chicks || 0);
  if (total <= 0) return 0;
  return Math.round((Number(flock.alive_count || 0) / total) * 100);
}

function daysUntil(value?: string | null) {
  if (!value) return null;
  return Math.ceil((new Date(value).getTime() - Date.now()) / 86400000);
}

export default function MyFlockPage() {
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [flocks, setFlocks] = useState<Flock[]>([]);
  const [hires, setHires] = useState<Hire[]>([]);
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [weights, setWeights] = useState<Weight[]>([]);
  const [selectedFlockId, setSelectedFlockId] = useState<string | null>(null);
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
      setFlocks([]);
      setHires([]);
      setAnimals([]);
      setPhotos([]);
      setWeights([]);
      setLoading(false);
      return;
    }

    const [flockRes, hireRes] = await Promise.all([
      supabase
        .from("flocks")
        .select("id,batch_no,breed,total_chicks,alive_count,mortality_count,expected_harvest_date,status,health_status,caretaker_name,created_at")
        .eq("profile_id", currentProfile.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("customer_caretaker_hires")
        .select("id,caretaker_name,caretaker_id,flock_id,status,payment_status,total_fee,created_at")
        .eq("profile_id", currentProfile.id)
        .order("created_at", { ascending: false }),
    ]);

    if (flockRes.error) setMessage(flockRes.error.message);

    const flockRows = (flockRes.data || []) as Flock[];
    const hireRows = (hireRes.data || []) as Hire[];
    setFlocks(flockRows);
    setHires(hireRows);

    if (!selectedFlockId && flockRows[0]) setSelectedFlockId(flockRows[0].id);

    await loadAnimalsAndEvidence(currentProfile.id, flockRows.map((flock) => flock.id));
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
        .limit(200),
      supabase
        .from("animal_weights")
        .select("id,animal_id,weight_kg,note,recorded_at")
        .in("animal_id", animalIds)
        .order("recorded_at", { ascending: false })
        .limit(200),
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

  const stats = useMemo(() => {
    const alive = flocks.reduce((sum, flock) => sum + Number(flock.alive_count || 0), 0);
    const activeCaretakers = hires.filter((hire) => String(hire.status || "").toUpperCase() === "ACTIVE").length;
    const pendingHires = hires.filter((hire) => String(hire.status || "").toUpperCase().includes("PENDING")).length;
    const nearHarvest = flocks.filter((flock) => {
      const left = daysUntil(flock.expected_harvest_date);
      return left !== null && left <= 7;
    }).length;

    return { alive, activeCaretakers, pendingHires, nearHarvest };
  }, [flocks, hires]);

  const selectedFlock = flocks.find((flock) => flock.id === selectedFlockId) || flocks[0] || null;
  const selectedAnimals = selectedFlock ? animals.filter((animal) => animal.flock_id === selectedFlock.id) : [];
  const selectedPhotos = selectedAnimals.flatMap((animal) => {
    const photo = photoByAnimal.get(animal.id);
    return photo ? [photo] : [];
  });
  const selectedWeights = selectedAnimals.flatMap((animal) => {
    const weight = weightByAnimal.get(animal.id);
    return weight ? [weight] : [];
  });

  function getFlockAnimals(flockId: string) {
    return animals.filter((animal) => animal.flock_id === flockId);
  }

  function getActiveHire(flockId: string) {
    return hires.find(
      (hire) =>
        hire.flock_id === flockId &&
        String(hire.status || "").toUpperCase() === "ACTIVE" &&
        String(hire.payment_status || "").toUpperCase() === "PAID"
    );
  }

  function getLatestPhotoForFlock(flock: Flock) {
    const related = getFlockAnimals(flock.id);

    // Uploaded caretaker/customer evidence always wins.
    for (const animal of related) {
      const photo = photoByAnimal.get(animal.id);
      if (photo) return photo;
    }

    // If there is no uploaded photo yet, use the original Marketplace product image
    // saved on animals.image_url by the V28 marketplace base-photo RPC patch.
    const baseAnimal = related.find((animal) => animal.image_url);
    if (baseAnimal?.image_url) {
      return {
        id: `base-${baseAnimal.id}`,
        animal_id: baseAnimal.id,
        photo_url: baseAnimal.image_url,
        caption: "Marketplace base photo",
        created_at: baseAnimal.created_at || flock.created_at,
      };
    }

    return null;
  }

  function getBaseImageForFlock(flock: Flock) {
    const latestPhoto = getLatestPhotoForFlock(flock);
    return latestPhoto?.photo_url || null;
  }

  function getLatestWeightForFlock(flock: Flock) {
    const related = getFlockAnimals(flock.id);
    for (const animal of related) {
      const weight = weightByAnimal.get(animal.id);
      if (weight) return weight;
    }
    return null;
  }

  return (
    <main className={`${farmBgClass} min-h-screen p-4 pb-28 md:p-8`}>
      <div className="mx-auto max-w-7xl">
        <section className="overflow-hidden rounded-[42px] border border-white/15 bg-white/10 p-6 text-white shadow-2xl backdrop-blur-xl md:p-8">
          <div className="grid gap-6 lg:grid-cols-[1.2fr_.8fr] lg:items-end">
            <div>
              <p className="w-fit rounded-full bg-amber-300 px-4 py-2 text-sm font-black text-emerald-950">My Flock Command Center</p>
              <h1 className="mt-5 text-4xl font-black leading-tight md:text-6xl">Your rooster portfolio, care team, and sell-ready status.</h1>
              <p className="mt-3 max-w-3xl text-emerald-50">
                Each flock card uses customer-linked rooster evidence only: latest photo, latest weight, active caretaker, and next action.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <button onClick={load} className="rounded-2xl bg-white/15 px-5 py-3 font-black text-white hover:bg-white/25">
                  {loading ? "Refreshing..." : "Refresh Flock"}
                </button>
                <Link href="/customer/marketplace" className="rounded-2xl bg-amber-300 px-5 py-3 font-black text-emerald-950 hover:bg-amber-200">
                  Marketplace
                </Link>
                <Link href="/customer/caretakers" className="rounded-2xl bg-white px-5 py-3 font-black text-emerald-950 hover:bg-emerald-50">
                  Hire Caretaker
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Stat label="Alive" value={stats.alive.toLocaleString()} />
              <Stat label="Active Care" value={stats.activeCaretakers.toLocaleString()} />
              <Stat label="Pending Hire" value={stats.pendingHires.toLocaleString()} />
              <Stat label="Near Harvest" value={stats.nearHarvest.toLocaleString()} />
            </div>
          </div>
        </section>

        {message && <div className="mt-5 rounded-2xl bg-white p-4 font-black text-emerald-800 shadow">{message}</div>}

        <section className="mt-6 grid gap-6 xl:grid-cols-[1fr_420px]">
          <div>
            <div className="mb-4 flex items-center justify-between text-white">
              <h2 className="text-2xl font-black">Flock cards</h2>
              <p className="text-sm font-bold text-emerald-100">{flocks.length} active record(s)</p>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              {flocks.map((flock) => {
                const age = daysOld(flock.created_at);
                const activeHire = getActiveHire(flock.id);
                const latestPhoto = getLatestPhotoForFlock(flock);
                const baseImageUrl = getBaseImageForFlock(flock);
                const latestWeight = getLatestWeightForFlock(flock);
                const linkedAnimals = getFlockAnimals(flock.id);
                const selected = selectedFlock?.id === flock.id;
                const survival = survivalRate(flock);
                const harvestLeft = daysUntil(flock.expected_harvest_date);

                return (
                  <article key={flock.id} className={`overflow-hidden rounded-[36px] bg-white shadow-2xl transition hover:-translate-y-1 ${selected ? "ring-4 ring-amber-300" : "ring-1 ring-white/20"}`}>
                    <button onClick={() => setSelectedFlockId(flock.id)} className="block w-full text-left">
                      <div className="relative h-72 bg-emerald-50">
                        {baseImageUrl ? (
                          <img src={baseImageUrl} alt={latestPhoto?.caption || flock.batch_no || "Flock photo"} className="h-full w-full object-cover" />
                        ) : (
                          <div className="grid h-full place-items-center bg-gradient-to-br from-emerald-100 to-amber-50 text-8xl">🐓</div>
                        )}
                        <span className="absolute left-4 top-4 rounded-full bg-emerald-950/85 px-4 py-2 text-xs font-black text-white backdrop-blur">{roosterStage(age)}</span>
                        <span className={`absolute right-4 top-4 rounded-full border px-4 py-2 text-xs font-black ${statusPill(flock.status)}`}>{statusText(flock.status)}</span>
                      </div>

                      <div className="p-6">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="text-3xl font-black text-emerald-950">{flock.batch_no || "FarmConnect Flock"}</h3>
                            <p className="mt-1 font-bold text-slate-500">{flock.breed || "FarmConnect Rooster"} • Day {age}</p>
                          </div>
                          <div className="rounded-2xl bg-amber-50 px-4 py-3 text-center">
                            <p className="text-xs font-black uppercase text-slate-500">Survival</p>
                            <p className="text-xl font-black text-amber-800">{survival}%</p>
                          </div>
                        </div>

                        <div className="mt-5 grid grid-cols-3 gap-3">
                          <Mini label="Alive" value={`${Number(flock.alive_count || 0)}`} />
                          <Mini label="Weight" value={latestWeight ? `${latestWeight.weight_kg}kg` : "—"} />
                          <Mini label="Harvest" value={harvestLeft === null ? "—" : `${harvestLeft}d`} />
                        </div>

                        <div className="mt-5 rounded-2xl bg-slate-50 p-4">
                          <p className="text-sm font-black uppercase tracking-wide text-slate-500">Assigned Caretaker</p>
                          <p className="mt-1 text-lg font-black text-emerald-950">{activeHire?.caretaker_name || flock.caretaker_name || "No active caretaker yet"}</p>
                          <p className="mt-1 text-xs font-bold text-slate-500">{linkedAnimals.length} linked rooster record(s) • Photo source: {latestPhoto ? `Latest upload ${dateText(latestPhoto.created_at)}` : baseImageUrl ? "Marketplace base photo" : "No photo yet"}</p>
                        </div>
                      </div>
                    </button>

                    <div className="grid grid-cols-3 gap-3 px-6 pb-6">
                      <Link href="/customer/caretakers" className="rounded-2xl bg-emerald-700 p-4 text-center text-sm font-black text-white hover:bg-emerald-800">
                        Caretaker
                      </Link>
                      <Link href="/customer/live-camera" className="rounded-2xl bg-slate-100 p-4 text-center text-sm font-black text-slate-800 hover:bg-slate-200">
                        Updates
                      </Link>
                      <Link href="/customer/sell-chicken" className="rounded-2xl bg-amber-300 p-4 text-center text-sm font-black text-emerald-950 hover:bg-amber-200">
                        Sell
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>

            {!loading && flocks.length === 0 && (
              <div className="rounded-[32px] bg-white p-10 text-center font-black text-slate-500 shadow-2xl">
                No flock yet. Buy chicken-related products from Marketplace or wait for Admin to create your flock record.
              </div>
            )}
          </div>

          <aside className={`${panelClass} sticky top-24 h-fit p-6`}>
            <h2 className="text-2xl font-black text-emerald-950">Selected Flock Details</h2>

            {selectedFlock ? (
              <>
                <div className="mt-4 rounded-[28px] bg-emerald-50 p-5">
                  <p className="text-sm font-black uppercase text-slate-500">Batch</p>
                  <h3 className="text-3xl font-black text-emerald-950">{selectedFlock.batch_no || "FarmConnect Flock"}</h3>
                  <p className="mt-1 font-bold text-slate-500">{selectedFlock.breed || "FarmConnect Rooster"}</p>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <Mini label="Total" value={`${Number(selectedFlock.total_chicks || 0)}`} />
                  <Mini label="Alive" value={`${Number(selectedFlock.alive_count || 0)}`} />
                  <Mini label="Mortality" value={`${Number(selectedFlock.mortality_count || 0)}`} />
                  <Mini label="Health" value={selectedFlock.health_status || "Healthy"} />
                </div>

                <div className="mt-5 rounded-[28px] bg-slate-50 p-5">
                  <h3 className="text-xl font-black text-slate-900">Latest Evidence</h3>
                  <div className="mt-4 space-y-3">
                    {selectedPhotos.slice(0, 3).map((photo) => (
                      <div key={photo.id} className="flex gap-3 rounded-2xl bg-white p-3 shadow-sm">
                        {photo.photo_url ? <img src={photo.photo_url} alt={photo.caption || "Photo"} className="h-16 w-16 rounded-xl object-cover" /> : <div className="grid h-16 w-16 place-items-center rounded-xl bg-slate-100">🐓</div>}
                        <div>
                          <p className="font-black text-slate-900">{photo.caption || "Caretaker photo update"}</p>
                          <p className="text-sm font-bold text-slate-500">{dateText(photo.created_at)}</p>
                        </div>
                      </div>
                    ))}
                    {selectedWeights.slice(0, 3).map((weight) => (
                      <div key={weight.id} className="rounded-2xl bg-white p-4 shadow-sm">
                        <p className="font-black text-slate-900">{weight.weight_kg} kg</p>
                        <p className="text-sm font-bold text-slate-500">{weight.note || "Weight update"} • {dateText(weight.recorded_at)}</p>
                      </div>
                    ))}
                    {selectedPhotos.length === 0 && selectedWeights.length === 0 && (
                      <p className="rounded-2xl bg-white p-4 font-bold text-slate-500">No linked caretaker photo/weight evidence yet.</p>
                    )}
                  </div>
                </div>

                <div className="mt-5 grid gap-3">
                  <Link href="/customer/sell-chicken" className="rounded-2xl bg-amber-300 p-4 text-center font-black text-emerald-950 hover:bg-amber-200">
                    Open Sell Chicken
                  </Link>
                  <Link href="/customer/caretakers" className="rounded-2xl bg-emerald-700 p-4 text-center font-black text-white hover:bg-emerald-800">
                    Manage Caretaker
                  </Link>
                </div>
              </>
            ) : (
              <p className="mt-4 rounded-2xl bg-slate-50 p-5 font-bold text-slate-500">Select a flock card to view details.</p>
            )}
          </aside>
        </section>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[24px] bg-white/10 p-5 ring-1 ring-white/10 backdrop-blur">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-200">{label}</p>
      <p className="mt-2 text-3xl font-black text-white">{value}</p>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-black text-emerald-950">{value}</p>
    </div>
  );
}
