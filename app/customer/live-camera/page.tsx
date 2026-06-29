"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  dateTimeText,
  isChicken,
  normalizeAnimal,
  resolveCustomerProfile,
  shellClass,
  type Animal,
  type AnimalRelation,
} from "@/lib/customer-auth";

type PhotoRow = {
  id: string;
  animal_id: string | null;
  photo_url: string | null;
  caption: string | null;
  created_at: string | null;
  animals: AnimalRelation;
};

export default function CustomerLiveCameraPage() {
  const [photos, setPhotos] = useState<PhotoRow[]>([]);
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLivePhotos();
  }, []);

  async function loadLivePhotos() {
    setLoading(true);
    setMessage("");

    const profile = await resolveCustomerProfile();
    if (!profile) {
      setPhotos([]);
      setMessage("Login required to view live camera updates.");
      setLoading(false);
      return;
    }

    const animals = await loadCustomerAnimals(profile.id);
    const animalIds = animals.map((animal) => animal.id);

    if (animalIds.length === 0) {
      setPhotos([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("animal_photos")
      .select("id,animal_id,photo_url,caption,created_at,animals(id,code,name,type,breed,health_status,image_url)")
      .in("animal_id", animalIds)
      .order("created_at", { ascending: false })
      .limit(48);

    if (error) setMessage(error.message);

    const rows = ((data || []) as PhotoRow[]).filter((photo) =>
      isChicken(normalizeAnimal(photo.animals))
    );

    setPhotos(rows);
    setSelectedPhotoId(rows[0]?.id || null);
    setLoading(false);
  }

  const selectedPhoto = photos.find((photo) => photo.id === selectedPhotoId) || photos[0] || null;
  const selectedAnimal = selectedPhoto ? normalizeAnimal(selectedPhoto.animals) : null;

  return (
    <main className={`${shellClass} p-4 pb-28 md:p-8`}>
      <div className="mx-auto max-w-7xl">
        <section className="rounded-[36px] border border-emerald-300/20 bg-white/10 p-7 text-white shadow-2xl shadow-black/20 backdrop-blur-xl">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="w-fit rounded-full bg-red-500 px-4 py-2 text-sm font-black text-white">
                LIVE PHOTO FEED
              </p>
              <h1 className="mt-4 text-5xl font-black leading-tight">
                Latest rooster monitoring.
              </h1>
              <p className="mt-2 max-w-3xl font-semibold text-emerald-50">
                View-only camera style feed from customer-linked animal photo uploads.
              </p>
            </div>

            <button
              onClick={loadLivePhotos}
              className="rounded-full bg-white px-5 py-3 font-black text-emerald-950"
            >
              Refresh
            </button>
          </div>
        </section>

        {message && (
          <div className="mt-5 rounded-2xl border border-emerald-100 bg-white p-4 font-black text-emerald-800 shadow-xl">
            {message}
          </div>
        )}

        {loading ? (
          <div className="mt-6 rounded-[32px] bg-white p-8 text-center font-black text-emerald-800 shadow-2xl">
            Loading live camera feed...
          </div>
        ) : photos.length === 0 ? (
          <div className="mt-6 rounded-[32px] bg-white p-10 text-center shadow-2xl">
            <div className="text-6xl">📷</div>
            <h2 className="mt-4 text-3xl font-black text-emerald-950">
              No live photos yet.
            </h2>
            <p className="mt-2 font-bold text-slate-500">
              Marketplace base photo appears in My Flock first. New uploaded photos appear here.
            </p>
            <Link
              href="/customer/photo-updates"
              className="mt-5 inline-block rounded-2xl bg-emerald-700 px-6 py-4 font-black text-white"
            >
              Open Photo Updates
            </Link>
          </div>
        ) : (
          <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_390px]">
            <article className="overflow-hidden rounded-[36px] bg-black shadow-2xl shadow-black/40">
              {selectedPhoto?.photo_url ? (
                <img
                  src={selectedPhoto.photo_url}
                  alt={selectedPhoto.caption || selectedAnimal?.name || "Live rooster update"}
                  className="h-[420px] w-full object-cover md:h-[620px]"
                />
              ) : (
                <div className="grid h-[420px] place-items-center text-7xl text-white md:h-[620px]">
                  🐓
                </div>
              )}

              <div className="border-t border-white/10 bg-[#08150f] p-5 text-white">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-red-300">
                      Latest selected camera update
                    </p>
                    <h2 className="mt-1 text-2xl font-black">
                      {selectedAnimal?.name || selectedAnimal?.code || "FarmConnect Rooster"}
                    </h2>
                    <p className="mt-1 font-semibold text-emerald-100">
                      {selectedPhoto?.caption || "No caption"}
                    </p>
                  </div>
                  <p className="rounded-full bg-red-500 px-4 py-2 text-sm font-black">
                    {dateTimeText(selectedPhoto?.created_at)}
                  </p>
                </div>
              </div>
            </article>

            <aside className="rounded-[36px] bg-white p-5 shadow-2xl">
              <p className="text-sm font-black uppercase tracking-[0.18em] text-emerald-700">
                Camera Roll
              </p>
              <h2 className="mt-1 text-3xl font-black text-emerald-950">
                Recent updates
              </h2>

              <div className="mt-5 grid max-h-[640px] gap-3 overflow-y-auto pr-1">
                {photos.map((photo) => {
                  const animal = normalizeAnimal(photo.animals);
                  const active = photo.id === selectedPhoto?.id;

                  return (
                    <button
                      key={photo.id}
                      onClick={() => setSelectedPhotoId(photo.id)}
                      className={`rounded-3xl border p-3 text-left transition ${
                        active ? "border-emerald-700 bg-emerald-50" : "border-slate-100 bg-white hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex gap-3">
                        {photo.photo_url ? (
                          <img src={photo.photo_url} alt="Rooster" className="h-20 w-24 rounded-2xl object-cover" />
                        ) : (
                          <div className="grid h-20 w-24 place-items-center rounded-2xl bg-emerald-50 text-3xl">🐓</div>
                        )}
                        <div>
                          <h3 className="font-black text-emerald-950">
                            {animal?.name || animal?.code || "Rooster"}
                          </h3>
                          <p className="mt-1 text-xs font-bold text-slate-500">
                            {dateTimeText(photo.created_at)}
                          </p>
                          <p className="mt-1 line-clamp-2 text-xs font-semibold text-slate-500">
                            {photo.caption || "No caption"}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </aside>
          </section>
        )}
      </div>
    </main>
  );
}

async function loadCustomerAnimals(profileId: string) {
  const direct = await supabase
    .from("animals")
    .select("id,code,name,type,breed,health_status,image_url,profile_id,flock_id")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false });

  if (!direct.error) return ((direct.data || []) as Animal[]).filter(isChicken);

  const flocks = await supabase.from("flocks").select("id").eq("profile_id", profileId);
  const flockIds = (flocks.data || []).map((flock) => flock.id).filter(Boolean);
  if (flockIds.length === 0) return [];

  const byFlock = await supabase
    .from("animals")
    .select("id,code,name,type,breed,health_status,image_url,profile_id,flock_id")
    .in("flock_id", flockIds)
    .order("created_at", { ascending: false });

  return ((byFlock.data || []) as Animal[]).filter(isChicken);
}
