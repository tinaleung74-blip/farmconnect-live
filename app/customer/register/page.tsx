"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const MEMBERSHIP_FEE = 999;
const KYC_BUCKET = "farmconnect-customer-kyc";
const ID_OPTIONS = ["National ID", "Driver License", "Passport", "UMID", "Voter ID"];

export default function CustomerRegisterPage() {
  const router = useRouter();
  const idFileRef = useRef<HTMLInputElement>(null);
  const idCameraRef = useRef<HTMLInputElement>(null);
  const selfieCameraRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [idType, setIdType] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [idFile, setIdFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [idFileName, setIdFileName] = useState("");
  const [selfieFileName, setSelfieFileName] = useState("");
  const [agreeMembership, setAgreeMembership] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  function handleIdFile(file: File | undefined) {
    if (!file) return;
    setIdFile(file);
    setIdFileName(file.name || "valid-id-photo");
  }

  function handleSelfieFile(file: File | undefined) {
    if (!file) return;
    setSelfieFile(file);
    setSelfieFileName(file.name || "selfie-photo");
  }

  async function uploadKycFile(file: File, profileId: string, kind: "valid-id" | "selfie") {
    const rawExt = file.name.split(".").pop() || "jpg";
    const ext = rawExt.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() || "jpg";
    const path = `${profileId}/${kind}-${Date.now()}.${ext}`;

    const { data, error } = await supabase.storage
      .from(KYC_BUCKET)
      .upload(path, file, {
        cacheControl: "3600",
        upsert: true,
        contentType: file.type || "image/jpeg",
      });

    if (error) {
      throw new Error(`${kind === "valid-id" ? "Valid ID" : "Selfie"} upload failed: ${error.message}`);
    }

    return `${KYC_BUCKET}/${data.path}`;
  }

  async function handleRegister() {
    setMessage("");

    const cleanName = fullName.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = phone.trim();
    const cleanPassword = password.trim();
    const cleanIdType = idType.trim();
    const cleanIdNumber = idNumber.trim();

    if (!cleanName || !cleanEmail || !cleanPhone || !cleanPassword) {
      setMessage("Please complete your name, email, phone number, and password.");
      return;
    }

    if (cleanPassword.length < 6) {
      setMessage("Password must be at least 6 characters.");
      return;
    }

    if (!cleanIdType || !cleanIdNumber) {
      setMessage("Please complete your valid ID type and ID number.");
      return;
    }

    if (!idFile) {
      setMessage("Please upload or capture your valid ID photo.");
      return;
    }

    if (!selfieFile) {
      setMessage("Please capture your selfie verification.");
      return;
    }

    if (!agreeMembership) {
      setMessage("Please agree to the Annual Investor Membership program.");
      return;
    }

    setLoading(true);

    try {
      const { data: existing } = await supabase
        .from("profiles")
        .select("id,email,phone")
        .or(`email.eq.${cleanEmail},phone.eq.${cleanPhone}`)
        .maybeSingle();

      if (existing) {
        setMessage("Email or phone number is already registered. Please login instead.");
        setLoading(false);
        return;
      }

      const { data: authResult, error: signUpError } = await supabase.auth.signUp({
        email: cleanEmail,
        password: cleanPassword,
      });

      if (signUpError) {
        setMessage(signUpError.message);
        setLoading(false);
        return;
      }

      const authId = authResult.user?.id;

      if (!authId) {
        setMessage("Registration session was not created. Please check Supabase Auth email confirmation settings.");
        setLoading(false);
        return;
      }

      const uploadedIdFrontUrl = await uploadKycFile(idFile, authId, "valid-id");
      const uploadedSelfieUrl = await uploadKycFile(selfieFile, authId, "selfie");

      const profilePayload: Record<string, string | number | null> = {
        id: authId,
        full_name: cleanName,
        email: cleanEmail,
        phone: cleanPhone,
        wallet_balance: 0,
        id_type: cleanIdType,
        id_number: cleanIdNumber,
        id_front_url: uploadedIdFrontUrl,
        selfie_url: uploadedSelfieUrl,
        verification_status: "PENDING",
        membership_plan: "ANNUAL INVESTOR MEMBERSHIP",
        membership_fee: MEMBERSHIP_FEE,
        membership_status: "UNPAID",
        account_status: "PENDING_MEMBERSHIP",
      };

      const { error: profileError } = await supabase.from("profiles").upsert(profilePayload);

      if (profileError) {
        setMessage(profileError.message);
        setLoading(false);
        return;
      }

      router.replace("/customer/membership");
    } catch (error) {
      console.error(error);
      setMessage("Registration failed. Please try again.");
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#315b36_0,#10251b_36%,#07150f_100%)] p-5 text-white md:p-8">
      <div className="mx-auto max-w-7xl py-4 md:py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link href="/customer/login" className="rounded-full border border-emerald-200/30 bg-white/10 px-5 py-3 text-sm font-black text-emerald-50 backdrop-blur transition hover:bg-white/15">
            ← Back to Login
          </Link>
          <Link href="/customer" className="rounded-full bg-amber-300 px-5 py-3 text-sm font-black text-emerald-950 transition hover:bg-amber-200">
            FarmConnect Customer
          </Link>
        </div>

        <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <aside className="rounded-[38px] border border-emerald-300/20 bg-white/10 p-6 shadow-2xl shadow-black/25 backdrop-blur-xl md:p-8">
            <p className="w-fit rounded-full bg-amber-300 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-emerald-950">
              Secure Onboarding
            </p>
            <h1 className="mt-5 text-4xl font-black leading-tight md:text-6xl">
              Join FarmConnect Live
            </h1>
            <p className="mt-4 max-w-xl text-base font-semibold leading-7 text-emerald-50/90">
              Create your customer account, submit ID verification, and accept the Annual Investor Membership before accessing the production modules.
            </p>

            <div className="mt-8 grid gap-4">
              <Step number="1" title="Account Details" note="Name, email, phone, and Supabase Auth password." />
              <Step number="2" title="KYC Verification" note="Valid ID and selfie capture for admin review." />
              <Step number="3" title="Annual Membership" note="₱999 yearly access, approved by FarmConnect Admin." />
            </div>

            <div className="mt-8 rounded-[30px] border border-amber-300/25 bg-emerald-950/80 p-6 text-white">
              <h2 className="text-2xl font-black">🛡️ Access Rule</h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-emerald-50/85">
                Restricted modules open only after login, approved KYC, active account status, and active membership.
              </p>
              <div className="mt-4 rounded-2xl bg-amber-300 px-4 py-3 text-sm font-black text-emerald-950">
                PENDING VERIFICATION • MEMBERSHIP UNPAID
              </div>
            </div>
          </aside>

          <section className="rounded-[38px] bg-white p-5 text-slate-950 shadow-2xl shadow-black/25 md:p-8">
            <div className="flex flex-col justify-between gap-3 border-b border-slate-100 pb-5 md:flex-row md:items-start">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.2em] text-emerald-700">Customer Registration</p>
                <h2 className="mt-2 text-3xl font-black text-slate-950 md:text-4xl">Account + KYC</h2>
              </div>
              <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-800">
                Supabase Auth
              </div>
            </div>

            {message && <div className="mt-5 rounded-3xl border border-red-100 bg-red-50 p-4 font-bold text-red-700">{message}</div>}

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <Field label="Full Name" value={fullName} onChange={setFullName} placeholder="Enter your full name" />
              <Field label="Phone Number" value={phone} onChange={setPhone} placeholder="Enter your mobile number" />
              <Field label="Email Address" value={email} onChange={setEmail} placeholder="Enter your email address" type="email" />
              <Field label="Password" value={password} onChange={setPassword} placeholder="Create password" type="password" />
            </div>

            <div className="my-7 h-px bg-slate-100" />

            <div>
              <p className="text-sm font-black uppercase tracking-[0.2em] text-emerald-700">ID Verification</p>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label>
                  <span className="text-sm font-black text-slate-600">Valid ID Type</span>
                  <select value={idType} onChange={(event) => setIdType(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white p-4 font-bold outline-none transition focus:border-emerald-500">
                    <option value="">Select valid ID</option>
                    {ID_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
                <Field label="ID Number" value={idNumber} onChange={setIdNumber} placeholder="Enter ID number" />
              </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <div className="rounded-[30px] border-2 border-dashed border-emerald-200 bg-emerald-50 p-5">
                <h3 className="text-xl font-black text-emerald-950">📄 Valid ID Photo</h3>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">Upload or capture your government-issued ID for admin review.</p>
                <input ref={idFileRef} type="file" accept="image/*" className="hidden" onChange={(event) => handleIdFile(event.target.files?.[0])} />
                <input ref={idCameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(event) => handleIdFile(event.target.files?.[0])} />
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <button type="button" onClick={() => idFileRef.current?.click()} className="rounded-2xl bg-emerald-700 px-4 py-3 font-black text-white transition hover:bg-emerald-800">Upload Photo</button>
                  <button type="button" onClick={() => idCameraRef.current?.click()} className="rounded-2xl bg-slate-950 px-4 py-3 font-black text-white transition hover:bg-black">Open Camera</button>
                </div>
                {idFile && <p className="mt-4 rounded-2xl bg-white p-3 text-sm font-black text-emerald-700">✓ ID ready for upload {idFileName ? `• ${idFileName}` : ""}</p>}
              </div>

              <div className="rounded-[30px] border-2 border-dashed border-amber-200 bg-amber-50 p-5">
                <h3 className="text-xl font-black text-amber-950">🤳 Selfie Verification</h3>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">Capture a live selfie so admin can match your identity with your ID.</p>
                <input ref={selfieCameraRef} type="file" accept="image/*" capture="user" className="hidden" onChange={(event) => handleSelfieFile(event.target.files?.[0])} />
                <button type="button" onClick={() => selfieCameraRef.current?.click()} className="mt-4 w-full rounded-2xl bg-amber-300 px-4 py-3 font-black text-emerald-950 transition hover:bg-amber-200">Open Selfie Camera</button>
                {selfieFile && <p className="mt-4 rounded-2xl bg-white p-3 text-sm font-black text-emerald-700">✓ Selfie ready for upload {selfieFileName ? `• ${selfieFileName}` : ""}</p>}
              </div>
            </div>

            <div className="my-7 h-px bg-slate-100" />

            <div className="rounded-[30px] border border-amber-100 bg-gradient-to-br from-amber-50 to-emerald-50 p-5">
              <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                <div>
                  <h3 className="text-2xl font-black text-emerald-950">🌾 Annual Investor Membership</h3>
                  <p className="mt-1 font-semibold text-slate-600">Required for full FarmConnect Live access after admin approval.</p>
                </div>
                <div className="rounded-3xl bg-slate-950 px-5 py-4 text-center text-white">
                  <strong className="block text-3xl">₱999</strong>
                  <span className="text-xs font-bold text-slate-300">per year</span>
                </div>
              </div>

              <div className="mt-5 grid gap-2 text-sm font-black text-emerald-800 md:grid-cols-2">
                <span>✓ Customer dashboard</span>
                <span>✓ Flock monitoring</span>
                <span>✓ Wallet access</span>
                <span>✓ Sell rooster requests</span>
                <span>✓ Caretaker updates</span>
                <span>✓ Marketplace purchases</span>
              </div>

              <label className="mt-5 flex gap-3 rounded-2xl bg-white p-4 text-sm font-bold text-slate-700">
                <input type="checkbox" checked={agreeMembership} onChange={(event) => setAgreeMembership(event.target.checked)} />
                <span>I agree to the Annual Investor Membership Fee of <b>₱999 per year</b>.</span>
              </label>
            </div>

            <button onClick={handleRegister} disabled={loading} className="mt-6 w-full rounded-2xl bg-emerald-700 p-4 text-lg font-black text-white shadow-lg shadow-emerald-900/20 transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-400">
              {loading ? "Submitting Verification..." : "Submit Registration"}
            </button>

            <button type="button" onClick={() => router.push("/customer/login")} className="mt-3 w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 font-black text-slate-800 transition hover:bg-slate-100">
              Already registered? Login
            </button>
          </section>
        </section>
      </div>
    </main>
  );
}

function Step({ number, title, note }: { number: string; title: string; note: string }) {
  return (
    <div className="flex gap-4 rounded-[28px] border border-white/10 bg-white/10 p-5 backdrop-blur">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-300 text-lg font-black text-emerald-950">{number}</div>
      <div>
        <h3 className="text-lg font-black text-white">{title}</h3>
        <p className="mt-1 text-sm font-semibold leading-6 text-emerald-50/80">{note}</p>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; type?: string }) {
  return (
    <label>
      <span className="text-sm font-black text-slate-600">{label}</span>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-2 w-full rounded-2xl border border-slate-200 p-4 font-bold outline-none transition focus:border-emerald-500" />
    </label>
  );
}
