"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

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
  approved_at: string | null;
  animal_id: string | null;
  latest_photo_id: string | null;
  latest_weight_id: string | null;
  farmconnect_fee: number | string | null;
  customer_net_amount: number | string | null;
};
type Animal = { id: string; code: string | null; name: string | null; breed: string | null; current_weight: number | string | null; health_status: string | null; image_url: string | null; status: string | null };
type Photo = { id: string; photo_url: string | null; caption: string | null; created_at: string | null };
type Weight = { id: string; weight_kg: number | string | null; note: string | null; recorded_at: string | null };

const FEE_RATE = 0.02;

function money(value: any) {
  return Number(value || 0).toLocaleString("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 2 });
}
function dateText(value?: string | null) {
  if (!value) return "No date";
  return new Date(value).toLocaleString("en-PH");
}
function statusText(value?: string | null) {
  return String(value || "PENDING").replaceAll("_", " ").toUpperCase();
}

export default function AdminSellRequestsPage() {
  const [requests, setRequests] = useState<SellRequest[]>([]);
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [weights, setWeights] = useState<Weight[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [offerPrice, setOfferPrice] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    setMessage("");
    const { data, error } = await supabase
      .from("sell_chicken_requests")
      .select("id,profile_id,flock_id,batch_no,breed,chicken_stage,quantity,price_per_chicken,total_amount,status,admin_notes,created_at,approved_at,animal_id,latest_photo_id,latest_weight_id,farmconnect_fee,customer_net_amount")
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(error.message);
      setRequests([]);
      setLoading(false);
      return;
    }

    const rows = (data || []) as SellRequest[];
    setRequests(rows);
    const animalIds = rows.map((row) => row.animal_id).filter(Boolean) as string[];
    const photoIds = rows.map((row) => row.latest_photo_id).filter(Boolean) as string[];
    const weightIds = rows.map((row) => row.latest_weight_id).filter(Boolean) as string[];

    const [animalRes, photoRes, weightRes] = await Promise.all([
      animalIds.length ? supabase.from("animals").select("id,code,name,breed,current_weight,health_status,image_url,status").in("id", animalIds) : Promise.resolve({ data: [] as any[] }),
      photoIds.length ? supabase.from("animal_photos").select("id,photo_url,caption,created_at").in("id", photoIds) : Promise.resolve({ data: [] as any[] }),
      weightIds.length ? supabase.from("animal_weights").select("id,weight_kg,note,recorded_at").in("id", weightIds) : Promise.resolve({ data: [] as any[] }),
    ]);

    setAnimals((animalRes.data || []) as Animal[]);
    setPhotos((photoRes.data || []) as Photo[]);
    setWeights((weightRes.data || []) as Weight[]);
    if (!selectedId && rows[0]) setSelectedId(rows[0].id);
    setLoading(false);
  }

  const selected = requests.find((row) => row.id === selectedId) || requests[0] || null;
  const animal = selected?.animal_id ? animals.find((row) => row.id === selected.animal_id) || null : null;
  const photo = selected?.latest_photo_id ? photos.find((row) => row.id === selected.latest_photo_id) || null : null;
  const weight = selected?.latest_weight_id ? weights.find((row) => row.id === selected.latest_weight_id) || null : null;
  const image = photo?.photo_url || animal?.image_url || "/farmconnect/roosters/fc-stage-4-adult-rooster-base.jpg";

  const counts = useMemo(() => {
    return {
      total: requests.length,
      pending: requests.filter((x) => String(x.status || "").toUpperCase() === "PENDING_ADMIN_APPROVAL").length,
      offered: requests.filter((x) => ["OFFER_SENT", "APPROVED"].includes(String(x.status || "").toUpperCase())).length,
      rejected: requests.filter((x) => String(x.status || "").toUpperCase() === "REJECTED").length,
    };
  }, [requests]);

  async function sendOffer() {
    if (!selected) return;
    const gross = Number(offerPrice);
    if (!Number.isFinite(gross) || gross <= 0) return setMessage("Enter valid final offer price.");
    const fee = gross * FEE_RATE;
    const net = gross - fee;
    const ok = window.confirm(`Send final offer ${money(gross)} to customer?`);
    if (!ok) return;

    setProcessing(true);
    setMessage("");
    const { error } = await supabase
      .from("sell_chicken_requests")
      .update({
        price_per_chicken: gross,
        total_amount: gross,
        farmconnect_fee: fee,
        customer_net_amount: net,
        status: "OFFER_SENT",
        admin_notes: adminNotes || `Admin valuation sent. Gross ${money(gross)}, fee ${money(fee)}, net ${money(net)}.`,
        approved_at: new Date().toISOString(),
      })
      .eq("id", selected.id);

    if (error) {
      setProcessing(false);
      setMessage(error.message);
      return;
    }

    await supabase.from("notifications").insert({
      customer_id: selected.profile_id,
      title: "Rooster final offer sent",
      message: `Admin valued ${animal?.name || selected.batch_no || "your rooster"} at ${money(gross)}. Net after FarmConnect fee: ${money(net)}.`,
      is_read: false,
      created_at: new Date().toISOString(),
    });

    setProcessing(false);
    setOfferPrice("");
    setAdminNotes("");
    setMessage("Final offer sent to customer notification center.");
    await loadData();
  }

  async function rejectRequest() {
    if (!selected) return;
    const ok = window.confirm("Reject this sell request?");
    if (!ok) return;
    setProcessing(true);
    const { error } = await supabase
      .from("sell_chicken_requests")
      .update({ status: "REJECTED", admin_notes: adminNotes || "Rejected by admin after evaluation." })
      .eq("id", selected.id);
    if (error) {
      setProcessing(false);
      return setMessage(error.message);
    }
    if (selected.animal_id) await supabase.from("animals").update({ status: "ACTIVE" }).eq("id", selected.animal_id);
    await supabase.from("notifications").insert({ customer_id: selected.profile_id, title: "Sell request rejected", message: "Admin rejected your rooster sell request after evaluation.", is_read: false, created_at: new Date().toISOString() });
    setProcessing(false);
    setMessage("Request rejected and rooster returned to active status.");
    await loadData();
  }

  return (
    <main className="min-h-screen bg-[#fff7ed] p-4 pb-28 text-[#18181b] md:p-8">
      <div className="mx-auto max-w-7xl">
        <section className="rounded-[34px] bg-gradient-to-br from-[#7f0000] via-[#c40000] to-[#facc15] p-6 text-white shadow-2xl md:p-8">
          <Link href="/admin" className="mb-5 inline-flex rounded-full bg-white/15 px-4 py-2 font-black text-white">← Back Admin</Link>
          <p className="w-fit rounded-full bg-[#facc15] px-4 py-2 text-sm font-black text-[#7f0000]">Sell Approval Queue</p>
          <h1 className="mt-4 text-4xl font-black md:text-6xl">Admin rooster valuation.</h1>
          <p className="mt-3 max-w-3xl font-semibold text-white/85">Review one rooster at a time, check latest caretaker photo and weight, then send final offer price to the customer.</p>
          <button onClick={loadData} className="mt-5 rounded-2xl bg-white px-5 py-3 font-black text-[#b40000]">{loading ? "Refreshing..." : "Refresh Requests"}</button>
        </section>

        {message && <div className="mt-5 rounded-2xl bg-white p-4 font-black text-[#b40000] shadow">{message}</div>}

        <section className="mt-5 grid gap-4 md:grid-cols-4">
          <Stat label="Total" value={counts.total} />
          <Stat label="Pending" value={counts.pending} />
          <Stat label="Offered" value={counts.offered} />
          <Stat label="Rejected" value={counts.rejected} />
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[1fr_430px]">
          <div className="rounded-[30px] bg-white p-5 shadow-xl">
            <h2 className="text-2xl font-black">Requests</h2>
            <div className="mt-4 space-y-3">
              {requests.map((request) => (
                <button key={request.id} onClick={() => setSelectedId(request.id)} className={`w-full rounded-2xl border p-4 text-left transition ${selected?.id === request.id ? "border-[#facc15] bg-orange-50" : "border-orange-100 bg-white"}`}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase text-[#b40000]">{request.chicken_stage || "Rooster"}</p>
                      <h3 className="font-black">{request.batch_no || request.id.slice(0, 8)}</h3>
                      <p className="text-sm font-bold text-zinc-500">Qty 1 • {dateText(request.created_at)}</p>
                    </div>
                    <div className="text-right">
                      <b className="text-[#b40000]">{Number(request.total_amount || 0) > 0 ? money(request.total_amount) : "No offer"}</b>
                      <p className="mt-1 rounded-full bg-yellow-100 px-3 py-1 text-xs font-black text-yellow-800">{statusText(request.status)}</p>
                    </div>
                  </div>
                </button>
              ))}
              {!loading && requests.length === 0 && <p className="rounded-2xl bg-orange-50 p-8 text-center font-black text-zinc-500">No sell requests yet.</p>}
            </div>
          </div>

          <aside className="sticky top-24 h-fit rounded-[30px] bg-white p-5 shadow-2xl">
            <h2 className="text-2xl font-black">Valuation Panel</h2>
            {selected ? (
              <>
                <div className="mt-4 overflow-hidden rounded-[24px] bg-orange-50">
                  <img src={image} alt="Rooster evidence" className="h-64 w-full object-cover" />
                </div>
                <p className="mt-4 text-xs font-black uppercase tracking-[0.16em] text-[#b40000]">Evidence</p>
                <h3 className="mt-1 text-3xl font-black">{animal?.name || selected.batch_no || "Rooster"}</h3>
                <p className="font-bold text-zinc-500">{animal?.code || selected.batch_no || "No code"} • {animal?.breed || selected.breed || "Premium Rooster"}</p>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <Info label="Health" value={animal?.health_status || "No record"} />
                  <Info label="Weight" value={weight?.weight_kg ? `${weight.weight_kg} kg` : animal?.current_weight ? `${animal.current_weight} kg` : "No record"} />
                  <Info label="Photo Date" value={dateText(photo?.created_at)} />
                  <Info label="Status" value={statusText(selected.status)} />
                </div>
                <div className="mt-5 rounded-[24px] bg-orange-50 p-5">
                  <label className="text-xs font-black uppercase text-[#b40000]">Final Offer Price</label>
                  <input value={offerPrice} onChange={(e) => setOfferPrice(e.target.value)} type="number" min="1" step="0.01" placeholder="Example: 5200" className="mt-2 w-full rounded-2xl border border-orange-200 px-4 py-3 text-2xl font-black outline-none focus:border-[#b40000]" />
                  <p className="mt-2 text-sm font-bold text-zinc-600">FarmConnect fee 2%: {money(Number(offerPrice || 0) * FEE_RATE)}</p>
                  <p className="text-sm font-black text-[#b40000]">Customer net: {money(Number(offerPrice || 0) * (1 - FEE_RATE))}</p>
                </div>
                <textarea value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} placeholder="Admin valuation notes..." className="mt-3 h-28 w-full rounded-2xl border border-orange-200 p-4 font-bold outline-none focus:border-[#b40000]" />
                <button onClick={sendOffer} disabled={processing} className="mt-3 w-full rounded-2xl bg-[#b40000] px-5 py-4 font-black text-white disabled:bg-zinc-300">{processing ? "Processing..." : "Send Final Offer"}</button>
                <button onClick={rejectRequest} disabled={processing} className="mt-3 w-full rounded-2xl bg-zinc-900 px-5 py-4 font-black text-white disabled:bg-zinc-300">Reject Request</button>
              </>
            ) : <p className="mt-4 rounded-2xl bg-orange-50 p-5 font-bold text-zinc-500">Select a request.</p>}
          </aside>
        </section>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div className="rounded-[24px] bg-white p-5 shadow"><p className="text-sm font-black uppercase text-zinc-500">{label}</p><h2 className="mt-2 text-3xl font-black text-[#b40000]">{value}</h2></div>;
}
function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl bg-orange-50 p-4"><p className="text-xs font-black uppercase text-zinc-500">{label}</p><p className="mt-1 font-black">{value}</p></div>;
}
