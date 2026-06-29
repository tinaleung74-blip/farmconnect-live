"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  dateText,
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

export default function CustomerPhotoUpdatesPage() {
  const [photos, setPhotos] = useState<PhotoRow[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPhotos();
  }, []);

  async function loadPhotos() {
    setLoading(true);
    setMessage("");

    const profile = await resolveCustomerProfile();
    if (!profile) {
      setPhotos([]);
      setMessage("Login required to view photo updates.");
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
      .limit(120);

    if (error) setMessage(error.message);

    const chickenPhotos = ((data || []) as PhotoRow[]).filter((photo) =>
      isChicken(normalizeAnimal(photo.animals))
    );

    setPhotos(chickenPhotos);
    setLoading(false);
  }

  return (
    <main className={`${shellClass} p-4 pb-28 md:p-8`}>
      <div className="mx-auto max-w-7xl">
        <section className="rounded-[36px] border border-emerald-300/20 bg-white/10 p-7 text-white shadow-2xl shadow-black/20 backdrop-blur-xl">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="w-fit rounded-full bg-amber-300 px-4 py-2 text-sm font-black text-emerald-950">
                Photo Updates
              </p>
              <h1 className="mt-4 text-5xl font-black leading-tight">
                Rooster photo timeline.
              </h1>
              <p className="mt-2 max-w-3xl font-semibold text-emerald-50">
                Latest uploaded photo automatically becomes the main visual reference for My Flock and Sell Chicken.
              </p>
            </div>

            <button
              onClick={loadPhotos}
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
            Loading photo updates...
          </div>
        ) : photos.length === 0 ? (
          <EmptyState />
        ) : (
          <section className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {photos.map((photo, index) => {
              const animal = normalizeAnimal(photo.animals);

              return (
                <article
                  key={photo.id}
                  className={`overflow-hidden rounded-[32px] bg-white shadow-2xl ${
                    index === 0 ? "md:col-span-2 xl:col-span-2" : ""
                  }`}
                >
                  {photo.photo_url ? (
                    <img
                      src={photo.photo_url}
                      alt={photo.caption || animal?.name || "Rooster photo"}
                      className={`${index === 0 ? "h-96" : "h-64"} w-full object-cover`}
                    />
                  ) : (
                    <div className={`${index === 0 ? "h-96" : "h-64"} grid place-items-center bg-emerald-50 text-6xl`}>
                      🐓
                    </div>
                  )}

                  <div className="p-5">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
                      {index === 0 ? "Latest Photo" : "Photo Update"}
                    </p>
                    <h2 className="mt-1 text-2xl font-black text-emerald-950">
                      {animal?.name || animal?.code || "FarmConnect Rooster"}
                    </h2>
                    <p className="mt-1 text-sm font-bold text-slate-500">
                      {animal?.breed || animal?.type || "Rooster"} • {dateText(photo.created_at)}
                    </p>
                    <p className="mt-3 rounded-2xl bg-emerald-50 p-3 text-sm font-bold text-slate-700">
                      {photo.caption || "No caption provided."}
                    </p>
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

function EmptyState() {
  return (
    <div className="mt-6 rounded-[32px] bg-white p-10 text-center shadow-2xl">
      <div className="text-6xl">📸</div>
      <h2 className="mt-4 text-3xl font-black text-emerald-950">
        No rooster photos yet.
      </h2>
      <p className="mt-2 font-bold text-slate-500">
        Marketplace base photos will show first. Latest uploaded photos will override them automatically.
      </p>
      <Link
        href="/customer/marketplace"
        className="mt-5 inline-block rounded-2xl bg-emerald-700 px-6 py-4 font-black text-white"
      >
        Open Marketplace
      </Link>
    </div>
  );
}
