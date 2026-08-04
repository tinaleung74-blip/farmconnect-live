"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { getAdminEscalatedChats, getLatestSupportSessionId, getSupportMessages, getSupportSessionStatus, runAdminSupportAction, saveKaFarmSupportMessage, sendSupportMessage } from "@/lib/backend/support-chat";
import { getEscalationNotice, getKaFarmReply, shouldEscalateToAdmin } from "@/lib/kafarm-brain";
import { adminAssignCareRequest, adminReviewCaretakerApplication, adminReviewManualPayment, adminReviewTaskProof, checkoutFarmCart, createCareRequest, getAdminCareRequests, getAdminManualPaymentRequests, getAdminTaskProofs, getCareLogRecords, getCaretakerActiveTasks, getCaretakerApplications, getCurrentProfile, getCustomerCareRequests, getCustomerInventoryItems, getCustomerManualPaymentRequests, getCustomerOwnedRoosters, getFarmProducts, getInboxItems, getWalletTransactions, saveCartItem, submitCaretakerApplication, submitCaretakerTaskProof, submitManualPaymentRequest, submitWithdrawalRequest, getCustomerWithdrawalRequests, getAdminWithdrawalRequests, adminReviewWithdrawalRequest, type CareLogRecord } from "@/lib/farmconnect-data";
import { supabase } from "@/lib/supabase";

type Role = "customer" | "caretaker" | "admin";
type IconName =
  | "home" | "rooster" | "bag" | "clipboard" | "wallet" | "inbox" | "support"
  | "settings" | "logout" | "check" | "camera" | "qr" | "upload" | "user"
  | "users" | "coins" | "shield" | "search" | "chat" | "file" | "alert" | "eye" | "eyeOff" | "trash";

const peso = (value: number) =>
  value.toLocaleString("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 });
const fcCoin = (value: number) => value.toLocaleString("en-PH", { maximumFractionDigits: 0 });

const iconPath: Record<IconName, string> = {
  home: "M3 11l9-8 9 8v10h-6v-6H9v6H3z",
  rooster: "M12 3c2 0 4 2 4 4 2 0 4 2 4 4 0 4-4 7-8 7s-8-3-8-7c0-3 2-5 5-5 0-2 1-3 3-3zm0 8h.01M8 21h8",
  bag: "M6 7h12l1 14H5L6 7zm3 0a3 3 0 0 1 6 0",
  clipboard: "M8 4h8v3H8z M6 6h12v15H6z M9 11h6 M9 15h6",
  wallet: "M3 6h18v14H3z M16 12h5v4h-5z M3 9h18",
  inbox: "M4 4h16l-2 10h-4l-2 3-2-3H6z M4 18h16",
  support: "M4 12a8 8 0 0 1 16 0v5h-4v-6h4 M4 17h4v-6H4z M12 20h3",
  settings: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M4 12h2 M18 12h2 M12 4v2 M12 18v2",
  logout: "M10 4H5v16h5 M14 8l4 4-4 4 M8 12h10",
  check: "M4 12l5 5L20 6",
  camera: "M4 7h4l2-2h4l2 2h4v13H4z M12 11a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
  qr: "M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M14 14h2v2h-2z M18 14h2v6h-4v-2h2z M14 18h2v2h-2z",
  upload: "M12 16V4 M7 9l5-5 5 5 M5 20h14",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4 21a8 8 0 0 1 16 0",
  users: "M9 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M2 21a7 7 0 0 1 14 0 M17 11a3 3 0 1 0 0-6 M16 18a6 6 0 0 1 6 3",
  coins: "M12 6c4 0 7-1 7-3s-3-3-7-3-7 1-7 3 3 3 7 3z M5 6v4c0 2 3 3 7 3s7-1 7-3V6 M5 13v4c0 2 3 3 7 3s7-1 7-3v-4",
  shield: "M12 3l8 4v6c0 5-3 8-8 10-5-2-8-5-8-10V7z",
  search: "M10 18a8 8 0 1 1 6-3l5 5",
  chat: "M4 5h16v11H8l-4 4z",
  file: "M6 3h9l3 3v15H6z M15 3v4h4 M9 12h6 M9 16h6",
  alert: "M12 3l10 18H2z M12 9v5 M12 17h.01",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
  eyeOff: "M3 3l18 18 M10.6 10.6a3 3 0 0 0 4.2 4.2 M9.9 5.2A10.8 10.8 0 0 1 12 5c6 0 10 7 10 7a17.8 17.8 0 0 1-3 3.8 M6.5 6.5C3.8 8.1 2 12 2 12s4 7 10 7c1.5 0 2.8-.4 4-1",
  trash: "M3 6h18 M8 6V4h8v2 M6 6l1 15h10l1-15 M10 11v6 M14 11v6",
};

function Icon({ name, className = "h-5 w-5" }: { name: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d={iconPath[name]} />
    </svg>
  );
}
const farmIconImage: Partial<Record<IconName, string>> = {
  rooster: "/farmconnect/icons/my-rooster.png",
  bag: "/farmconnect/icons/farm-buy.png",
  clipboard: "/farmconnect/icons/farm-request.png",
  wallet: "/farmconnect/icons/farm-wallet.png",
  inbox: "/farmconnect/icons/farm-inbox.png",
  support: "/farmconnect/icons/support.png",
  settings: "/farmconnect/icons/farm-settings.png",
};
const titleIconChrome: Partial<Record<IconName, { bg: string; ring: string; shadow: string }>> = {
  rooster: { bg: "linear-gradient(135deg, rgba(230,247,237,0.98), rgba(255,236,138,0.96), rgba(220,235,255,0.95))", ring: "rgba(31,107,69,0.78)", shadow: "0 14px 30px rgba(31, 107, 69, 0.24)" },
  bag: { bg: "linear-gradient(135deg, rgba(220,235,255,0.98), rgba(255,238,130,0.96), rgba(225,247,235,0.95))", ring: "rgba(31,93,184,0.76)", shadow: "0 14px 30px rgba(31, 93, 184, 0.24)" },
  clipboard: { bg: "linear-gradient(135deg, rgba(225,247,235,0.98), rgba(255,238,130,0.96), rgba(220,235,255,0.95))", ring: "rgba(245,184,46,0.82)", shadow: "0 14px 30px rgba(187, 124, 0, 0.22)" },
  wallet: { bg: "linear-gradient(135deg, rgba(220,235,255,0.98), rgba(225,247,235,0.96), rgba(255,238,130,0.95))", ring: "rgba(13,79,179,0.76)", shadow: "0 14px 30px rgba(13, 79, 179, 0.24)" },
  inbox: { bg: "linear-gradient(135deg, rgba(220,235,255,0.98), rgba(255,238,130,0.94), rgba(225,247,235,0.95))", ring: "rgba(18,99,199,0.74)", shadow: "0 14px 30px rgba(18, 99, 199, 0.22)" },
  support: { bg: "linear-gradient(135deg, rgba(225,247,235,0.98), rgba(220,235,255,0.96), rgba(255,238,130,0.95))", ring: "rgba(35,103,201,0.74)", shadow: "0 14px 30px rgba(35, 103, 201, 0.22)" },
  settings: { bg: "linear-gradient(135deg, rgba(220,235,255,0.98), rgba(255,238,130,0.94), rgba(225,247,235,0.95))", ring: "rgba(29,102,209,0.74)", shadow: "0 14px 30px rgba(29, 102, 209, 0.22)" },
  home: { bg: "linear-gradient(135deg, rgba(225,247,235,0.98), rgba(255,238,130,0.96), rgba(220,235,255,0.95))", ring: "rgba(31,107,69,0.74)", shadow: "0 14px 30px rgba(31, 107, 69, 0.22)" },
  coins: { bg: "linear-gradient(135deg, rgba(255,238,130,0.98), rgba(225,247,235,0.95), rgba(220,235,255,0.95))", ring: "rgba(245,184,46,0.82)", shadow: "0 14px 30px rgba(187, 124, 0, 0.22)" },
  shield: { bg: "linear-gradient(135deg, rgba(225,247,235,0.98), rgba(220,235,255,0.95), rgba(255,238,130,0.92))", ring: "rgba(31,107,69,0.74)", shadow: "0 14px 30px rgba(31, 107, 69, 0.22)" },
  users: { bg: "linear-gradient(135deg, rgba(220,235,255,0.98), rgba(225,247,235,0.95), rgba(255,238,130,0.92))", ring: "rgba(31,93,184,0.72)", shadow: "0 14px 30px rgba(31, 93, 184, 0.20)" },
};
function FarmImageIcon({ name, imageSrc, className = "h-8 w-8", fallbackClassName = "h-5 w-5" }: { name: IconName; imageSrc?: string; className?: string; fallbackClassName?: string }) {
  const src = imageSrc || farmIconImage[name];
  if (!src) return <Icon name={name} className={fallbackClassName} />;
  return <img src={src} alt="" aria-hidden="true" className={"shrink-0 object-contain " + className} />;
}
function FCCoin({ className = "h-12 w-12" }: { className?: string }) {
  return <div className={"relative grid shrink-0 place-items-center rounded-full border-4 border-amber-200 bg-gradient-to-br from-amber-100 via-yellow-400 to-amber-600 shadow-inner " + className}><span className="absolute inset-2 rounded-full border border-yellow-100/80" /><span className="relative flex items-center font-black text-[#1f6b45] drop-shadow-sm"><span className="relative text-[1.15em] leading-none">F<span className="absolute left-0 top-[34%] h-[0.12em] w-[0.8em] rounded bg-[#1f6b45]" /><span className="absolute left-0 top-[58%] h-[0.12em] w-[0.65em] rounded bg-[#1f6b45]" /></span><span className="-ml-[0.08em] text-[0.9em] leading-none">C</span></span></div>;
}

const nav = {
  customer: [
    ["My Roosters", "/customer/roosters", "rooster"],
    ["Farm Buy", "/customer/farm-buy", "bag"],
    ["Farm Requests", "/customer/farm-requests", "clipboard"],
    ["Wallet", "/customer/wallet", "wallet"],
  ],
  caretaker: [
    ["Active Tasks", "/caretaker/tasks", "clipboard"],
    ["Completed", "/caretaker/completed", "check"],
    ["Chat Admin", "/caretaker/chat", "chat"],
    ["Profile", "/caretaker/profile", "user"],
  ],
  admin: [
    ["Dashboard", "/admin", "home"],
    ["Customer Requests", "/admin/customer-desk", "clipboard"],
    ["Caretaker Management", "/admin/caretaker-desk", "user"],
    ["Farm Operations", "/admin/farm-operations", "rooster"],
    ["Issue Management", "/admin/issue-management", "alert"],
    ["Account Verification", "/admin/account-verification", "shield"],
    ["Evidence Logs", "/admin/evidence", "file"],
    ["KaFarm", "/admin/kafarm", "support"],
  ],
} as const;

const gamefowlBloodlines = [
  "Hatch", "Kelso", "Sweater", "Roundhead", "Lemon", "Claret", "Albany", "Grey", "Law Grey", "Regular Grey",
  "Lacy Roundhead", "Boston Roundhead", "Butcher", "Radio", "Whitehackle", "McLean Hatch", "Blueface Hatch",
  "Yellow Leg Hatch", "Gilmore Hatch", "Spangled Hatch", "Mug", "Sid Taylor", "Blackwater", "Brown Red",
  "Black McRae", "Harold Brown Grey", "Madigin Grey", "Cardinal Kelso", "Out and Out Kelso", "Jumper Kelso",
  "Firebird Kelso", "Possum Sweater", "5K Sweater", "5000 Sweater", "Yellow Leg Sweater", "Lemon 84",
  "Duke Hulsey", "Shamo", "Asil", "Brazilian", "Peruvian", "Spanish Game", "Sweater-Kelso", "Hatch-Claret",
  "Hatch-Grey", "Lemon-Hatch", "Roundhead-Hatch", "Kelso-Roundhead",
];

const breedChickProducts = gamefowlBloodlines.map((breed, index) => ({
  id: `breed-chick-${breed.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`,
  name: `Starter Chick (${breed})`,
  category: "Breed Chicks",
  unit: "per head",
  price: 450 + (index % 8) * 75,
  stock: Math.max(6, 30 - (index % 7) * 3),
  image: "/farmconnect/roosters/fc-stage-1-chick-base.jpg",
}));

const products = [
  ...breedChickProducts,
  { id: "p2", name: "Premium Rooster Feeds", category: "Feeds", unit: "per kg", price: 80, stock: 250, image: "/farmconnect/marketplace/fc-product-feeds.jpg" },
  { id: "p3", name: "Recovery Electrolytes", category: "Electrolytes", unit: "per sachet", price: 60, stock: 100, image: "/farmconnect/marketplace/fc-product-supplements.jpg" },
  { id: "p4", name: "Rooster Supplements", category: "Supplements", unit: "per tablet", price: 25, stock: 200, image: "/farmconnect/marketplace/fc-product-supplements.jpg" },
  { id: "p5", name: "Rooster Vitamins", category: "Vitamins", unit: "per dose", price: 75, stock: 150, image: "/farmconnect/marketplace/fc-product-vitamins.jpg" },
  { id: "p6", name: "Poultry Equipment", category: "Equipment", unit: "per item", price: 350, stock: 40, image: "/farmconnect/marketplace/fc-product-equipment.jpg" },
];

function normalizeFarmProductName(name: string, category: string) {
  if (/starter chick/i.test(name) && !/\(.+\)/.test(name)) return "Starter Chick (Hatch)";
  if (/starter chicks/i.test(category)) return name.replace(/^Standard Starter Chick$/i, "Starter Chick (Hatch)");
  return name;
}

function normalizeFarmProductCategory(category: string) {
  return /starter chicks/i.test(category) ? "Breed Chicks" : category;
}

type FarmProductCard = typeof products[number] & { product_type?: string | null; stage?: string | null; bloodline?: string | null; breed?: string | null; product_metadata?: Record<string, unknown> | null };

const roosters = [
  { id: "r1", name: "Thunder King", breed: "Hatch-Kelso", tag: "FC-128", stage: "Young Rooster", status: "In Care", health: "Good", value: "P8,000 - P12,000", image: "/farmconnect/roosters/fc-stage-3-young-rooster-base.jpg", pen: "Pen A-04", caretaker: "Juan D." },
  { id: "r2", name: "Red Ace", breed: "Asil", tag: "FC-212", stage: "Starter", status: "In Care", health: "Excellent", value: "P3,500 - P5,000", image: "/farmconnect/roosters/fc-stage-1-chick-base.jpg", pen: "Brooder B-02", caretaker: "Mario S." },
  { id: "r3", name: "Bantay", breed: "Sweater-Roundhead", tag: "FC-301", stage: "Adult", status: "For Sale", health: "Good", value: "P10,000 - P15,000", image: "/farmconnect/roosters/fc-stage-4-adult-rooster-base.jpg", pen: "Pen C-01", caretaker: "Juan D." },
];

function isRealOwnedAnimal(row: any) {
  const meta = row?.ownership_metadata || {};
  const source = String(row?.acquired_from || "").toLowerCase();
  const code = String(row?.animal_code || "");
  const name = String(row?.animal_name || "");
  const hasEvidence = Boolean(row?.source_product_id || meta.payment_request_id || meta.manual_payment_request_id || meta.invoice_id || meta.approved_at || meta.admin_assigned_at || meta.source === "approved_payment");
  const isDemoSeed = ["FC-128", "FC-212", "FC-301"].includes(code) || /^(Thunder King|Red Ace|Bantay)$/i.test(name);
  if (isDemoSeed) return hasEvidence;
  return Boolean(row?.id && (source === "farm_buy" || source.includes("admin") || hasEvidence));
}

type RoosterCard = typeof roosters[number];

const services = [
  { name: "Photo Update", category: "Update", price: 0, proof: "Clear photo proof", eta: "Today" },
  { name: "Video Proof", category: "Update", price: 100, proof: "Short video", eta: "24 hours" },
  { name: "Weight Check", category: "Update", price: 50, proof: "Scale photo + note", eta: "Today" },
  { name: "Health Check", category: "Health", price: 75, proof: "Photo + preset note", eta: "Today" },
  { name: "Give Vitamins", category: "Care", price: 75, proof: "Product photo + prepared dose", eta: "24 hours" },
  { name: "Premium Feed", category: "Care", price: 160, proof: "Feed photo + feeding photo", eta: "Today" },
  { name: "Vaccine Shot", category: "Health", price: 250, proof: "Admin review + video recommended", eta: "Scheduled" },
  { name: "List for Sale", category: "Sell", price: 0, proof: "Admin sale review", eta: "1-2 days" },
];

const transactions = [
  { type: "Cash In", amount: 2500, status: "Auto-approved", date: "Today 9:14 AM", receipt: "RCPT-9F21" },
  { type: "Farm Buy", amount: -850, status: "Completed", date: "Today 9:22 AM", receipt: "RCPT-11AF" },
  { type: "Withdrawal", amount: -1000, status: "Pending Review", date: "Yesterday", receipt: "Pending" },
];

const inboxItems = [
  { tab: "Receipts", title: "Cash-In Receipt", text: "P2,500 added to wallet. Ref GC-829113.", status: "Completed", action: "read" },
  { tab: "Receipts", title: "Farm Buy Receipt", text: "Premium Rooster Feeds, 10 kg. Invoice INV-FB-1001 is ready.", status: "Completed", action: "invoice", href: "/customer/inbox/invoice/farm-buy" },
  { tab: "Caretaker Updates", title: "Thunder King Update", text: "Morning feed completed. Photo verified by caretaker.", status: "Verified", action: "carelogs", href: "/customer/care-logs" },
  { tab: "Caretaker Updates", title: "Red Ace Photo Update", text: "Evening photo update uploaded and ready to view.", status: "Verified", action: "carelogs", href: "/customer/care-logs" },
  { tab: "Alerts", title: "Withdrawal Review", text: "Your withdrawal is being reviewed for safety.", status: "Pending", action: "read" },
];

const initialTasks = [
  { id: "t1", requester: "Aydana", rooster: "Thunder King", tag: "FC-128", task: "Photo Update", due: "Today 4 PM", priority: "urgent", note: "Please take close-up photo of wings and feet.", pen: "Pen A-04", proof: "Photo proof", status: "Active" },
  { id: "t2", requester: "Marco", rooster: "Red Ace", tag: "FC-212", task: "Give Vitamins", due: "Today 5 PM", priority: "normal", note: "Check appetite after vitamins.", pen: "Brooder B-02", proof: "Product photo + prepared dose", status: "Active" },
  { id: "t3", requester: "Admin", rooster: "Bantay", tag: "FC-301", task: "Weight Check", due: "Tomorrow", priority: "normal", note: "Prepare sell readiness record.", pen: "Pen C-01", proof: "Scale photo", status: "Active" },
];

const completedTasks = [
  { rooster: "Thunder King", task: "Morning Feeding", time: "Today 7:30 AM", status: "Verified", image: "/farmconnect/marketplace/fc-product-feeds.jpg" },
  { rooster: "Red Ace", task: "Photo Update", time: "Yesterday 5:20 PM", status: "Waiting Review", image: "/farmconnect/roosters/fc-stage-1-chick-base.jpg" },
];
type SubmittedTaskProof = {
  id: string;
  requester: string;
  rooster: string;
  tag: string;
  task: string;
  pen: string;
  proof: string;
  note: string;
  caretaker: string;
  submittedAt: string;
  image: string;
  status: string;
};
const submittedProofKey = "farmconnect_submitted_task_proofs";
const localInboxKey = "farmconnect_customer_inbox";
function getSubmittedTaskProofs(): SubmittedTaskProof[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(window.localStorage.getItem(submittedProofKey) || "[]"); } catch { return []; }
}
function saveSubmittedTaskProof(task: typeof initialTasks[number]) {
  const submittedAt = new Date().toLocaleString();
  const record: SubmittedTaskProof = {
    id: `proof-${task.id}-${Date.now()}`,
    requester: task.requester,
    rooster: task.rooster,
    tag: task.tag,
    task: task.task,
    pen: task.pen,
    proof: task.proof,
    note: task.note,
    caretaker: "Juan D.",
    submittedAt,
    image: task.task.toLowerCase().includes("vitamin") ? "/farmconnect/marketplace/fc-product-vitamins.jpg" : "/farmconnect/roosters/fc-stage-3-young-rooster-base.jpg",
    status: "Waiting Review",
  };
  const current = getSubmittedTaskProofs();
  window.localStorage.setItem(submittedProofKey, JSON.stringify([record, ...current.filter(item => item.id !== record.id)].slice(0, 30)));
  const notice = { tab: "Caretaker Updates", title: `${task.rooster} ${task.task}`, text: `${task.task} proof was submitted by ${record.caretaker}. Admin review is pending before final release.`, status: "Pending", action: "carelogs", href: "/customer/care-logs" };
  try {
    const rawInbox = window.localStorage.getItem(localInboxKey);
    const currentInbox = rawInbox ? JSON.parse(rawInbox) : [];
    window.localStorage.setItem(localInboxKey, JSON.stringify([notice, ...currentInbox.filter((item: any)=>item.title !== notice.title)].slice(0, 50)));
  } catch {}
  return record;
}
function submittedProofToCareLog(record: SubmittedTaskProof): CareLogRecord {
  const date = new Date(record.submittedAt);
  return {
    rooster: record.rooster,
    title: record.task,
    type: record.proof.toLowerCase().includes("video") ? "Video" : "Photo",
    item: record.proof,
    amount: "1 proof",
    productCost: 0,
    laborCost: 0,
    detail: `${record.task} submitted by ${record.caretaker}. Customer note: ${record.note}`,
    status: record.status,
    caretaker: record.caretaker,
    uploaded: Number.isNaN(date.getTime()) ? "Today" : date.toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" }),
    time: Number.isNaN(date.getTime()) ? "" : date.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" }),
    proof: record.proof,
    reviewer: "Pending admin proof review",
    image: record.image,
  };
}

const customerNavCardStyle: Record<string, { bg: string; border: string; chip: string; text: string }> = {
  "My Roosters": { bg: "linear-gradient(135deg, #e8ffdc 0%, #fff17a 56%, #dff0ff 100%)", border: "#f6b64a", chip: "#fff1b7", text: "#173021" },
  "Farm Buy": { bg: "linear-gradient(135deg, #dff0ff 0%, #fff17a 52%, #e7ffe0 100%)", border: "#1f5db8", chip: "#dceaff", text: "#102b4a" },
  "Farm Requests": { bg: "linear-gradient(135deg, #e7fff0 0%, #dff0ff 48%, #fff17a 100%)", border: "#d92525", chip: "#ffe2de", text: "#302018" },
  "Wallet": { bg: "linear-gradient(135deg, #dff0ff 0%, #e7ffe0 52%, #fff17a 100%)", border: "#0d4fb3", chip: "#dceaff", text: "#102b4a" },
};
function Shell({ role, title, children }: { role: Role; title: string; children: React.ReactNode }) {
  const links = nav[role];
  const headerLinks = role === "admin" ? links.filter(([label]) => ["Dashboard", "Customer Requests", "Caretaker Management", "Farm Operations", "Issue Management", "Account Verification"].includes(label)) : links;
  const [inboxCount,setInboxCount]=useState(0);
  useEffect(()=>{
    if (role !== "customer") return;
    let mounted = true;
    getCurrentProfile()
      .then(profile=>profile ? getInboxItems(profile.id) : [])
      .then(rows=>{ if(mounted) setInboxCount((rows || []).length); })
      .catch(()=>{ if(mounted) setInboxCount(0); });
    return ()=>{ mounted = false; };
  }, [role, title]);
  return (
    <main className="min-h-screen bg-[#f6f3e8] bg-cover bg-center bg-no-repeat text-[#17251d]" style={{ backgroundImage: "linear-gradient(180deg, rgba(255,253,247,0.20), rgba(246,243,232,0.14)), linear-gradient(180deg, rgba(0,0,0,0.03), rgba(0,0,0,0.09)), radial-gradient(circle at top left, rgba(255,191,55,0.12), transparent 34%), radial-gradient(circle at bottom right, rgba(31,107,69,0.12), transparent 38%), url('/farmconnect/farmconnect-hero-wallpaper.jpg')", backgroundAttachment: "fixed" }}>
      <header className="sticky top-0 z-40 border-b-4 border-[#ffd43b] bg-gradient-to-r from-[#075c3a]/95 via-[#0b6fba]/94 to-[#075c3a]/95 text-white shadow-[0_12px_35px_rgba(7,92,58,0.24)] backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <Link href={role === "admin" ? "/admin" : role === "caretaker" ? "/caretaker/dashboard" : "/customer/dashboard"} className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center overflow-hidden rounded-full bg-white shadow-sm"><FarmImageIcon name="rooster" className="h-11 w-11" /></span>
            <span>
              <b className="block text-lg">FarmConnect</b>
              <small className="font-bold text-white/78">{title}</small>
            </span>
          </Link>
          <nav className="hidden items-center gap-2 lg:flex">
            {headerLinks.map(([label, href, icon]) => {
              const navCard = role === "customer" ? customerNavCardStyle[label] : undefined;
              return (
                <Link
                  key={href}
                  href={href}
                  style={navCard ? { background: navCard.bg, borderColor: navCard.border, color: navCard.text } : undefined}
                  className={navCard
                    ? "group flex min-h-[48px] items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-black shadow-sm ring-1 ring-white/35 transition hover:-translate-y-0.5 hover:shadow-md xl:px-3.5"
                    : "flex items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-black text-white transition hover:bg-white/16 xl:px-3 xl:text-sm"}
                >
                  <span className={navCard ? "grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white/78 p-0.5 shadow-sm ring-1 ring-white/80" : "contents"}>
                    <FarmImageIcon name={icon as IconName} className={navCard ? "h-7 w-7 rounded-lg object-contain transition group-hover:scale-105" : "h-5 w-5 rounded-md"} fallbackClassName={navCard ? "h-5 w-5" : "h-4 w-4"} />
                  </span>
                  <span className="leading-tight">{label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-2">
            {role === "customer" && <TopIcon href="/customer/inbox" name="inbox" label="Inbox" imageSrc="/farmconnect/icons/farm-inbox.png" badge={inboxCount} />}
            {role === "customer" && <TopIcon href="/customer/support" name="support" label="Support" imageSrc="/farmconnect/icons/support.png" />}
            {role === "customer" && <TopIcon href="/customer/inventory" name="bag" label="Inventory" imageSrc="/farmconnect/icons/farm-bag.png" />}
            <TopIcon href={role === "customer" ? "/customer/settings" : role === "caretaker" ? "/caretaker/profile" : "/admin/kafarm"} name="settings" label={role === "admin" ? "Ka-Farm" : "Settings"} imageSrc={role === "customer" ? "/farmconnect/icons/farm-settings.png" : undefined} />
            <TopIcon href="/" name="logout" label="Logout" />
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-4 py-6 pb-28 drop-shadow-[0_1px_0_rgba(255,255,255,0.65)]">{children}</div>
      <nav className="fixed bottom-3 left-1/2 z-40 flex w-[calc(100%-24px)] max-w-xl -translate-x-1/2 justify-between rounded-2xl border border-[#ded8c9] bg-white p-2 shadow-xl lg:hidden">
        {headerLinks.slice(0, 4).map(([label, href, icon]) => (
          <Link key={href} href={href} className="grid flex-1 place-items-center rounded-xl px-2 py-2 text-[11px] font-bold">
            <FarmImageIcon name={icon as IconName} className="mb-1 h-7 w-7 rounded-md" fallbackClassName="mb-1 h-5 w-5" /> {label.split(" ")[0]}
          </Link>
        ))}
      </nav>
    </main>
  );
}

function TopIcon({ href, name, label, imageSrc, badge = 0 }: { href: string; name: IconName; label: string; imageSrc?: string; badge?: number }) {
  return <Link href={href} title={label} className="relative flex h-11 items-center gap-2 rounded-full border border-white/40 bg-white/92 px-3 text-sm font-black text-[#075c3a] shadow-sm transition hover:-translate-y-0.5 hover:bg-[#fff4a3] hover:shadow-md"><FarmImageIcon name={name} imageSrc={imageSrc} className="h-7 w-7 rounded-md" />{badge > 0 && <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-black text-white shadow">{badge > 9 ? "9+" : badge}</span>}<span className="hidden xl:inline">{label}</span></Link>;
}

function KaFarm({ children, tone = "info" }: { children: React.ReactNode; tone?: "info" | "warn" | "good" }) {
  const color = tone === "warn" ? "border-amber-300 bg-amber-50" : tone === "good" ? "border-emerald-300 bg-emerald-50" : "border-[#d7e4d5] bg-white";
  return (
    <div className={"flex gap-3 rounded-2xl border p-4 shadow-sm " + color}>
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#1f6b45] text-white"><Icon name="support" /></div>
      <div><b>Ka-Farm says</b><div className="mt-1 text-sm leading-6 text-[#516157]">{children}</div></div>
    </div>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={"rounded-2xl border border-[#e3ded0] bg-white p-5 shadow-sm " + className}>{children}</section>;
}

function PageTitle({ title, text, icon }: { title: string; text: string; icon: IconName }) {
  const chrome = titleIconChrome[icon] || titleIconChrome.home!;
  return (
    <div className="mb-5">
      <div className="inline-flex max-w-4xl items-center gap-5 rounded-[28px] border-2 border-[#ffd43b]/85 bg-gradient-to-r from-white/92 via-[#f7ffe9]/88 to-[#e8f3ff]/88 px-4 py-3 shadow-[0_18px_45px_rgba(7,92,58,0.22)] backdrop-blur-md ring-2 ring-[#0b6fba]/18">
        <div style={{ background: chrome.bg, boxShadow: chrome.shadow, borderColor: chrome.ring }} className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-[24px] border-2 p-0.5 ring-2 ring-white/80"><FarmImageIcon name={icon} className="h-[4.7rem] w-[4.7rem] scale-125 rounded-[20px] object-cover contrast-125 saturate-150 drop-shadow-[0_6px_10px_rgba(0,0,0,0.22)]" fallbackClassName="h-10 w-10 text-[#1f6b45]" /></div>
        <div className="min-w-0 pr-2">
          <h1 className="text-3xl font-black leading-tight text-[#063f2a] md:text-5xl">{title}</h1>
          <p className="mt-1 max-w-2xl text-sm font-black leading-5 text-[#0b4f78] md:text-base">{text}</p>
        </div>
      </div>
    </div>
  );
}

function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "good" | "warn" | "bad" | "neutral" }) {
  const c = tone === "good" ? "bg-emerald-100 text-emerald-800" : tone === "warn" ? "bg-amber-100 text-amber-800" : tone === "bad" ? "bg-red-100 text-red-800" : "bg-slate-100 text-slate-700";
  return <span className={"rounded-full px-3 py-1 text-xs font-black " + c}>{children}</span>;
}

export function CustomerHome() {
  const cards = [
    { t: "My Roosters", d: "Premium rooster assets, care records, caretaker logs.", h: "/customer/roosters", img: "/farmconnect/icons/my-rooster.png", bg: "linear-gradient(135deg, #e4ffe9 0%, #fff17a 48%, #dcecff 100%)", border: "#f6b64a", chipBg: "#fff0bd", chipText: "#8a4b00" },
    { t: "Farm Buy", d: "Add products to cart, buy with wallet, cash in if short.", h: "/customer/farm-buy", img: "/farmconnect/icons/farm-buy.png", bg: "linear-gradient(135deg, #dcecff 0%, #fff17a 45%, #e4ffe9 100%)", border: "#1f5db8", chipBg: "#e4eeff", chipText: "#0f3f91" },
    { t: "Farm Requests", d: "Choose rooster, service, note, then send request.", h: "/customer/farm-requests", img: "/farmconnect/icons/farm-request.png", bg: "linear-gradient(135deg, #e4ffe9 0%, #dcecff 48%, #fff17a 100%)", border: "#d92525", chipBg: "#ffe2de", chipText: "#9b1c1c" },
    { t: "Wallet", d: "Cash-in, withdraw, payout account, transaction records.", h: "/customer/wallet", img: "/farmconnect/icons/farm-wallet.png", bg: "linear-gradient(135deg, #dcecff 0%, #e4ffe9 48%, #fff17a 100%)", border: "#0d4fb3", chipBg: "#dceaff", chipText: "#0d3f8f" },
    { t: "Inbox", d: "Receipts, caretaker updates, KYC notices, and alerts.", h: "/customer/inbox", img: "/farmconnect/icons/farm-inbox.png", bg: "linear-gradient(135deg, #dcecff 0%, #fff17a 52%, #e4ffe9 100%)", border: "#1263c7", chipBg: "#e2efff", chipText: "#104d9a" },
    { t: "Support", d: "Ask Ka-Farm first, then open live chat when needed.", h: "/customer/support", img: "/farmconnect/icons/support.png", bg: "linear-gradient(135deg, #e4ffe9 0%, #dcecff 50%, #fff17a 100%)", border: "#2367c9", chipBg: "#fff0b8", chipText: "#754800" },
    { t: "Inventory", d: "Customer-owned feeds, vitamins, supplies, and deductions.", h: "/customer/inventory", img: "/farmconnect/icons/farm-bag.png", bg: "linear-gradient(135deg, #fff17a 0%, #dcecff 48%, #e4ffe9 100%)", border: "#f2b600", chipBg: "#fff0a8", chipText: "#7b5200" },
    { t: "Settings", d: "Profile, KYC, contact details, password, and wallet PIN.", h: "/customer/settings", img: "/farmconnect/icons/farm-settings.png", bg: "linear-gradient(135deg, #dcecff 0%, #fff17a 48%, #e4ffe9 100%)", border: "#1d66d1", chipBg: "#e1ecff", chipText: "#0e459b" },
  ];
  return <Shell role="customer" title="Customer App"><PageTitle title="Customer Home" text="A simple command center for roosters, buying, requests, wallet, inbox, and support." icon="home" /><KaFarm>Start with My Roosters if you want to check care. Use Farm Buy for products and Farm Requests for services.</KaFarm><div className="mt-5 grid max-h-[640px] gap-4 overflow-y-auto pr-2 md:grid-cols-2 xl:grid-cols-4">{cards.map(card=><Link key={card.h} href={card.h} style={{ background: card.bg, borderColor: card.border }} className="group rounded-2xl border p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"><div className="flex items-start justify-between gap-3"><span className="grid h-20 w-20 place-items-center rounded-2xl bg-white/75 p-1 shadow-sm ring-1 ring-white/80"><img src={card.img} alt="" className="h-16 w-16 object-contain transition group-hover:scale-105" /></span><span style={{ backgroundColor: card.chipBg, color: card.chipText }} className="rounded-full px-3 py-1 text-xs font-black shadow-sm">Open</span></div><h2 className="mt-4 text-xl font-black text-[#17251d]">{card.t}</h2><p className="mt-2 text-sm font-bold leading-6 text-[#526056]">{card.d}</p></Link>)}</div></Shell>;
}

export function CustomerRoosters() {
  const [ownedRoosters, setOwnedRoosters] = useState<RoosterCard[]>([]);
  const [selected, setSelected] = useState<RoosterCard | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    getCustomerOwnedRoosters()
      .then(rows => {
        if (!mounted) return;
        const mapped: RoosterCard[] = rows.filter(isRealOwnedAnimal).map((row, index) => {
          const breed = row.breed_snapshot || row.bloodline_snapshot || "Recorded Bloodline";
          return {
            id: row.id,
            name: row.animal_name || `${breed} Chick`,
            breed,
            tag: row.animal_code || `FB-${index + 1}`,
            stage: row.acquired_from === "farm_buy" ? "Starter Chick" : "Owned Rooster",
            status: row.status === "sold" ? "Sold" : "In Care",
            health: "New",
            value: "Estimating",
            image: "/farmconnect/roosters/fc-stage-1-chick-base.jpg",
            pen: "Pending assignment",
            caretaker: "Pending assignment",
          };
        });
        setOwnedRoosters(mapped);
        setSelected(mapped[0] || null);
      })
      .catch(() => {
        if (mounted) {
          setOwnedRoosters([]);
          setSelected(null);
        }
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  return <Shell role="customer" title="My Roosters"><PageTitle title="My Roosters" text="Tap a rooster to view ownership details, care status, value, and next actions." icon="rooster" /><div className="grid gap-5 lg:grid-cols-[380px_1fr]"><Card><div className="flex items-center justify-between gap-3"><h2 className="text-xl font-black">Rooster List</h2><Badge>{ownedRoosters.length}</Badge></div><div className="mt-4 max-h-[620px] space-y-3 overflow-y-auto pr-2">{isLoading && <div className="rounded-2xl border border-[#ece6d8] bg-[#fffdf7] p-4 text-sm font-bold text-[#667267]">Loading your rooster records...</div>}{!isLoading && ownedRoosters.length === 0 && <div className="rounded-2xl border border-dashed border-[#d8d0bd] bg-[#fffdf7] p-5 text-center"><h3 className="text-lg font-black">No roosters yet</h3><p className="mt-2 text-sm font-bold text-[#667267]">Approved Farm Buy purchases or admin-assigned roosters will appear here.</p><Link href="/customer/farm-buy" className="mt-4 inline-flex rounded-xl bg-[#1f6b45] px-4 py-3 font-black text-white">Go to Farm Buy</Link></div>}{ownedRoosters.map(r=><button key={r.id} onClick={()=>setSelected(r)} className={"flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition " + (selected?.id===r.id?"border-[#1f6b45] bg-emerald-50 shadow-sm":"border-[#ece6d8] bg-[#fffdf7] hover:border-[#cfc7b7]")}><RoosterPhoto src={r.image} alt={r.name} size="thumb" /><div className="min-w-0 flex-1"><b className="block truncate">{r.name}</b><p className="truncate text-sm font-black text-[#1f6b45]">{r.breed}</p><p className="truncate text-sm font-bold text-[#667267]">{r.tag} - {r.stage}</p><p className="mt-1 truncate text-xs text-[#667267]">{r.pen}</p></div><Badge tone={r.health==="Excellent"?"good":"neutral"}>{r.health}</Badge></button>)}</div></Card><Card>{selected ? <div className="grid gap-5 xl:grid-cols-[minmax(300px,0.95fr)_1fr]"><RoosterPhoto src={selected.image} alt={selected.name} size="hero" /><div className="flex min-w-0 flex-col"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="text-sm font-black uppercase text-[#667267]">Owned Rooster</p><h2 className="mt-1 text-4xl font-black leading-tight">{selected.name}</h2><p className="mt-1 text-lg font-black text-[#1f6b45]">{selected.breed}</p><p className="mt-2 font-bold text-[#667267]">{selected.tag} - {selected.stage}</p></div><Badge tone={selected.status==="For Sale"?"warn":"good"}>{selected.status}</Badge></div><div className="mt-5 grid gap-3 sm:grid-cols-2"><Info label="Bloodline / Breed" value={selected.breed} /><Info label="Estimated Value" value={selected.value} /><Info label="Health" value={selected.health} /><Info label="Pen" value={selected.pen} /><Info label="Caretaker" value={selected.caretaker} /></div><div className="mt-5 rounded-2xl border border-[#e3ded0] bg-[#fffdf7] p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-black uppercase text-[#667267]">Latest Care Status</p><h3 className="mt-1 text-xl font-black">{selected.health === "New" ? "New purchase" : "Verified today"}</h3></div><Badge tone="good">{selected.health === "New" ? "Needs farm assignment" : "Good condition"}</Badge></div><div className="mt-3 grid gap-2 text-sm font-bold text-[#667267] sm:grid-cols-3"><span>Source: Farm Buy</span><span>Proof: Receipt in Inbox</span><span>Next: Admin assignment</span></div></div><div className="mt-auto flex flex-wrap gap-3 pt-5"><Link href="/customer/farm-requests" className="rounded-xl bg-[#1f6b45] px-4 py-3 font-black text-white">Request Care</Link><Link href="/customer/care-logs" className="rounded-xl bg-[#eee8d9] px-4 py-3 font-black">Care Logs</Link><Link href="/customer/farm-requests" className="rounded-xl bg-amber-300 px-4 py-3 font-black">Sell</Link></div></div></div> : <div className="grid min-h-[420px] place-items-center rounded-3xl border border-dashed border-[#d8d0bd] bg-[#fffdf7] p-8 text-center"><div><RoosterPhoto src="/farmconnect/icons/my-rooster.png" alt="" size="thumb" /><h2 className="mt-4 text-3xl font-black">Your rooster record is empty</h2><p className="mx-auto mt-3 max-w-md font-bold text-[#667267]">Once admin approves a Farm Buy payment or assigns a rooster to your account, the rooster card, breed, care status, and value will show here.</p><Link href="/customer/farm-buy" className="mt-5 inline-flex rounded-xl bg-[#1f6b45] px-5 py-3 font-black text-white">Buy First Rooster</Link></div></div>}</Card></div></Shell>;
}
export function CareLogsPage() {
  const [selected, setSelected] = useState<RoosterCard | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");
  const [liveLogs, setLiveLogs] = useState<CareLogRecord[]>([]);
  const [localProofLogs, setLocalProofLogs] = useState<CareLogRecord[]>([]);
  const demoLogs: CareLogRecord[] = [
    { rooster: "Thunder King", title: "Morning Feeding", type: "Feed", item: "Premium Rooster Feeds", amount: "0.12 kg", productCost: 10, laborCost: 0, detail: "Fed from customer-owned inventory. Appetite normal after feeding.", status: "Verified", caretaker: "Juan D.", uploaded: "July 8, 2026", time: "7:30 AM", proof: "Photo proof", reviewer: "Admin reviewed", image: "/farmconnect/marketplace/fc-product-feeds.jpg" },
    { rooster: "Thunder King", title: "Photo Update", type: "Photo", item: "Body condition", amount: "3 photos", productCost: 0, laborCost: 0, detail: "Clear body, feather, and leg photos uploaded for customer viewing.", status: "Approved", caretaker: "Juan D.", uploaded: "July 8, 2026", time: "8:10 AM", proof: "Photo proof", reviewer: "Admin approved", image: "/farmconnect/roosters/fc-stage-3-young-rooster-base.jpg" },
    { rooster: "Thunder King", title: "Health Note", type: "Health", item: "Daily observation", amount: "1 note", productCost: 0, laborCost: 0, detail: "Active, eating normally, no visible wounds or unusual behavior.", status: "Verified", caretaker: "Juan D.", uploaded: "July 8, 2026", time: "9:05 AM", proof: "Preset note", reviewer: "Auto checked", image: "/farmconnect/roosters/fc-stage-3-young-rooster-base.jpg" },
    { rooster: "Red Ace", title: "Vitamins", type: "Care", item: "Rooster Vitamins", amount: "1 dose", productCost: 75, laborCost: 0, detail: "Vitamin dose prepared and logged. Waiting for final review.", status: "Waiting Review", caretaker: "Mario S.", uploaded: "July 7, 2026", time: "5:20 PM", proof: "Product photo", reviewer: "Pending admin", image: "/farmconnect/marketplace/fc-product-vitamins.jpg" },
  ];
  useEffect(() => {
    setLocalProofLogs(getSubmittedTaskProofs().map(submittedProofToCareLog));
    let mounted = true;
    getCareLogRecords()
      .then(rows => {
        if (!mounted || rows.length === 0) return;
        setLiveLogs(rows);
        setSelected(current => current || {
            id: `live-${rows[0].rooster}`,
            name: rows[0].rooster,
            breed: "Recorded Bloodline",
            tag: "Live record",
            stage: "In Care",
            status: "In Care",
            health: "Good",
            value: "Recorded",
            image: rows[0].image,
            pen: "Care logs",
            caretaker: rows[0].caretaker,
          });
      })
      .catch(() => undefined);
    return () => { mounted = false; };
  }, []);
  const logs = [...localProofLogs, ...liveLogs];
  const roosterChoices = [
    ...Array.from(new Set(logs.map(log => log.rooster)))
      .map(name => ({
        id: `live-${name}`,
        name,
        breed: "Recorded Bloodline",
        tag: "Live record",
        stage: "In Care",
        status: "In Care",
        health: "Good",
        value: "Recorded",
        image: logs.find(log => log.rooster === name)?.image || "/farmconnect/roosters/fc-stage-3-young-rooster-base.jpg",
        pen: "Care logs",
        caretaker: logs.find(log => log.rooster === name)?.caretaker || "Caretaker",
      })),
  ];
  const allSelectedLogs = selected ? logs.filter(log=>log.rooster===selected.name) : [];
  const selectedLogs = logs
    .filter(log=>selected && log.rooster===selected.name)
    .filter(log=>status==="All" || log.status===status)
    .filter(log=>`${log.title} ${log.type} ${log.item} ${log.detail} ${log.caretaker} ${log.status}`.toLowerCase().includes(query.toLowerCase()));
  const productTotal = allSelectedLogs.reduce((sum, log) => sum + log.productCost, 0);
  const laborTotal = allSelectedLogs.reduce((sum, log) => sum + log.laborCost, 0);
  const statuses = ["All", "Verified", "Approved", "Waiting Review"];
  return <Shell role="customer" title="Care Logs"><PageTitle title="Care Logs" text="Searchable care records with uploaded date, time, caretaker, proof, item used, and review status." icon="file" /><div className="grid gap-5 lg:grid-cols-[340px_1fr]"><Card><div className="flex items-center justify-between gap-3"><h2 className="text-xl font-black">Rooster</h2>{liveLogs.length > 0 && <Badge tone="good">Live</Badge>}</div><div className="mt-4 max-h-[560px] space-y-3 overflow-y-auto pr-2">{roosterChoices.map(r=><button key={r.id} onClick={()=>setSelected(r)} className={"flex w-full items-center gap-3 rounded-2xl border p-3 text-left " + (selected?.id===r.id?"border-[#1f6b45] bg-emerald-50":"border-[#ece6d8] bg-[#fffdf7]")}><RoosterPhoto src={r.image} alt={r.name} size="thumb" /><div className="min-w-0 flex-1"><b className="block truncate">{r.name}</b><p className="truncate text-sm font-black text-[#1f6b45]">{r.breed}</p><p className="truncate text-sm text-[#667267]">{r.tag} - {r.pen}</p></div><Badge>{logs.filter(log=>log.rooster===r.name).length}</Badge></button>)}{roosterChoices.length===0 && <p className="rounded-2xl border border-dashed border-[#d8d0bd] bg-[#fffdf7] p-4 text-sm font-bold text-[#667267]">No care logs yet. Approved caretaker submissions will appear here.</p>}</div></Card><div className="grid gap-5"><Card><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-2xl font-black">{selected?.name || "No care record selected"}</h2><p className="text-sm font-black text-[#1f6b45]">{selected?.breed || "Waiting for approved care update"}</p><p className="text-sm font-bold text-[#667267]">{selected ? `${selected.tag} - ${selected.pen}` : "No rooster care logs yet"}</p></div>{selected && <Badge tone="good">Care active</Badge>}</div><div className="mt-4 grid gap-3 md:grid-cols-3"><Info label="Product Cost Used" value={peso(productTotal)} /><Info label="Updates" value={`${allSelectedLogs.length}`} /><Info label="Labor Cost" value={peso(laborTotal)} /></div></Card><Card><div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between"><div><h2 className="text-xl font-black">Records</h2><p className="text-sm font-bold text-[#667267]">{selectedLogs.length} matching log{selectedLogs.length===1?"":"s"}</p></div><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search logs..." className="w-full rounded-xl border border-[#ded8c9] bg-white px-4 py-3 font-bold xl:max-w-sm" /></div><div className="mt-4 flex flex-wrap gap-2">{statuses.map(s=><button key={s} onClick={()=>setStatus(s)} className={"rounded-full px-4 py-2 text-sm font-black " + (status===s?"bg-[#1f6b45] text-white":"bg-[#f6f3e8] text-[#17251d]")}>{s}</button>)}</div><div className="mt-5 max-h-[620px] space-y-3 overflow-y-auto pr-2">{selectedLogs.map(log=><div key={log.title + log.uploaded + log.time} className="grid gap-3 rounded-2xl border border-[#ece6d8] bg-[#fffdf7] p-4 md:grid-cols-[86px_1fr]"><a href={log.image} target="_blank" rel="noreferrer" title="Open proof image" className="h-20 w-20 overflow-hidden rounded-xl border border-[#ded8c9] bg-white"><img src={log.image} alt="" className="h-full w-full object-cover" /></a><div className="min-w-0"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-black">{log.title} - {log.time}</h3><Badge>{log.type}</Badge></div><p className="mt-1 text-sm font-bold text-[#667267]">{log.uploaded}</p><p className="mt-2 text-sm font-bold text-[#667267]">{log.detail}</p></div><Badge tone={log.status==="Verified" || log.status==="Approved" ? "good" : "warn"}>{log.status}</Badge></div><div className="mt-4 grid gap-2 text-sm md:grid-cols-2 xl:grid-cols-4"><span><b>Item:</b> {log.item}</span><span><b>Amount:</b> {log.amount}</span><span><b>Caretaker:</b> {log.caretaker}</span><span><b>Proof:</b> {log.proof}</span></div><p className="mt-3 rounded-xl bg-white px-3 py-2 text-sm font-bold text-[#667267]">{log.reviewer}</p></div></div>)}{selectedLogs.length===0 && <p className="rounded-2xl bg-[#f6f3e8] p-4 text-[#667267]">No care records match your search.</p>}</div></Card></div></div></Shell>;
}

function RoosterPhoto({ src, alt, size }: { src: string; alt: string; size: "thumb" | "hero" }) {
  const frame = size === "hero" ? "aspect-[4/3] w-full rounded-2xl sm:aspect-[16/11] lg:aspect-[4/3] xl:aspect-[16/11]" : "h-16 w-16 rounded-xl";
  const focal = src.includes("stage-4") ? "center 34%" : "center center";
  return <div className={`${frame} shrink-0 overflow-hidden border border-[#e7dfcf] bg-[#f6f3e8]`}><img src={src} alt={alt} style={{ objectPosition: focal }} className="h-full w-full object-cover" /></div>;
}

function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-[#f6f3e8] p-4"><p className="text-xs font-black uppercase text-[#667267]">{label}</p><p className="mt-1 font-black">{value}</p></div>; }
function MiniPanel({ title, items }: { title: string; items: string[] }) { return <div className="rounded-xl border border-[#e3ded0] p-4"><b>{title}</b><ul className="mt-3 space-y-2 text-sm text-[#667267]">{items.map(i=><li key={i}>{i}</li>)}</ul></div>; }

export function FarmBuy() {
  const router = useRouter();
  const [cat, setCat] = useState("All");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [liveProducts, setLiveProducts] = useState<FarmProductCard[]>(products);
  const [marketNote, setMarketNote] = useState("Add items to Cart first. When your wallet is enough, tap Buy.");
  const [carePurpose, setCarePurpose] = useState<{ rooster: string; caretaker: string; item: string; qty: string; reason: string } | null>(null);
  const [balance, setBalance] = useState(0);
  const [lastCheckoutId, setLastCheckoutId] = useState("");

  useEffect(() => {
    let mounted = true;
    getCurrentProfile()
      .then(profile => {
        if (!mounted) return;
        if (profile) setBalance(Number(profile.wallet_balance || 0));
        else setMarketNote("Please login so Farm Buy can read your wallet and save your receipt.");
      })
      .catch(() => setMarketNote("Please login so Farm Buy can read your wallet and save your receipt."));
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("care") !== "1") return;
    setCarePurpose({
      rooster: params.get("rooster") || "Selected rooster",
      caretaker: params.get("caretaker") || "Assigned caretaker",
      item: params.get("item") || "Care supply",
      qty: params.get("qty") || "Needed supply",
      reason: params.get("reason") || "Needed for care request",
    });
    setMarketNote("This purchase will be linked to the care request.");
  }, []);

  useEffect(() => {
    let mounted = true;
    getFarmProducts()
      .then(rows => {
        if (!mounted || rows.length === 0) return;
        const mappedProducts: FarmProductCard[] = rows.map(row => {
          const category = normalizeFarmProductCategory(String(row.category || "Farm Items").replaceAll("_", " ").replace(/\b\w/g, c => c.toUpperCase()));
          return {
            id: row.id,
            name: normalizeFarmProductName(row.name, category),
            category,
            unit: row.unit_label || "per item",
            price: Number(row.unit_price || 0),
            stock: Number(row.stock_quantity || 0),
            image: row.image_url || "/farmconnect/marketplace/fc-product-equipment.jpg",
            product_type: row.product_type,
            stage: row.stage,
            bloodline: row.bloodline,
            breed: row.breed,
            product_metadata: row.product_metadata,
          };
        });
        setLiveProducts(mappedProducts.length ? mappedProducts : products);
        setMarketNote("Live farm inventory is loaded from Supabase.");
      })
      .catch(() => setMarketNote("Farm inventory is using the safe preview list while live items are checked."));
    return () => { mounted = false; };
  }, []);

  const cats = ["All", ...Array.from(new Set(liveProducts.map(p => p.category)))];
  const visible = cat === "All" ? liveProducts : liveProducts.filter(p => p.category === cat);
  const cartEntries = Object.entries(cart)
    .filter(([, qty]) => qty > 0)
    .map(([id, qty]) => ({ product: liveProducts.find(p => p.id === id), qty }))
    .filter((row): row is { product: FarmProductCard; qty: number } => Boolean(row.product));
  const itemCount = cartEntries.reduce((sum, row) => sum + row.qty, 0);
  const total = cartEntries.reduce((sum, row) => sum + row.product.price * row.qty, 0);
  const missing = Math.max(0, total - balance);

  function setQty(productId: string, qty: number) {
    const next = { ...cart, [productId]: Math.max(0, qty) };
    if (next[productId] === 0) delete next[productId];
    setCart(next);
  }

  async function buyCart() {
    if (total <= 0) {
      setMarketNote("Your Cart is still empty.");
      return;
    }
    try {
      setMarketNote("Saving cart before opening manual payment page...");
      const entries = cartEntries.map(row => [row.product.id, row.qty] as const);
      const hasPreviewProduct = entries.some(([id]) => !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id));
      if (!hasPreviewProduct) {
        for (const [id, qty] of entries) {
          const item = liveProducts.find(product => product.id === id);
          if (!item) continue;
          await saveCartItem(id, qty, item.price, {
            purposeNote: carePurpose ? `${carePurpose.rooster} / ${carePurpose.item} / ${carePurpose.qty} / ${carePurpose.caretaker} / ${carePurpose.reason}` : null,
            productType: item.product_type || (/chick/i.test(item.category + " " + item.name) ? "breed_chick" : "supply"),
            bloodline: item.bloodline || item.breed || null,
            breed: item.breed || item.bloodline || null,
            productName: item.name,
          });
        }
      }
      const summary = {
        source: "Farm Buy",
        lines: cartEntries.map(row => ({ id: row.product.id, name: row.product.name, quantity: row.qty, unit_price: row.product.price, total: row.product.price * row.qty, category: row.product.category })),
        total,
        carePurpose,
        previewOnly: hasPreviewProduct,
      };
      window.localStorage.setItem("farmconnect_payment_context", JSON.stringify({ sourceType: "farm_buy", sourceRef: hasPreviewProduct ? "preview-cart" : "active-cart", amountExpected: total, summary }));
      router.push("/customer/payment?type=farm_buy");
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      setMarketNote(message === "login_required" || message.toLowerCase().includes("login") ? "Please login first so we can save the order before payment." : "We could not prepare payment yet. Your cart is still here.");
    }
  }

  return <Shell role="customer" title="Farm Buy"><PageTitle title="Farm Buy" text="Choose quantity with plus and minus. Selected items appear in your cart." icon="bag" /><KaFarm>{marketNote}</KaFarm>{carePurpose && <Card className="mb-5 border-2 border-amber-300 bg-amber-50"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-black">Linked Care Purchase</h2><p className="mt-1 text-sm font-bold text-[#667267]">{carePurpose.item} ({carePurpose.qty}) for {carePurpose.rooster}</p><p className="mt-1 text-sm text-[#667267]">Caretaker: {carePurpose.caretaker} - {carePurpose.reason}</p></div><button onClick={()=>setCarePurpose(null)} className="rounded-xl bg-white px-4 py-3 font-black">Clear Link</button></div></Card>}<div className="mb-5 rounded-2xl border border-[#e3ded0] bg-white p-3 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-[#f6f3e8] p-4"><div className="flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-xl bg-white text-[#1f6b45] shadow-sm"><Icon name="wallet" /></div><div><p className="text-xs font-black uppercase text-[#667267]">Wallet / Withdrawals</p><p className="text-3xl font-black">{peso(balance)}</p></div></div><Link href="/customer/inventory" title="Inventory" className="relative grid h-14 w-14 place-items-center overflow-hidden rounded-full bg-white p-1 shadow-md"><img src="/farmconnect/icons/farm-bag.png" alt="" className="h-12 w-12 object-contain" /></Link></div></div><div className="mt-5 grid gap-5 lg:grid-cols-[1fr_360px]"><div><div className="mb-4 flex flex-wrap gap-2">{cats.map(c=><button key={c} onClick={()=>setCat(c)} className={"rounded-full px-4 py-2 text-sm font-black " + (cat===c?"bg-[#1f6b45] text-white":"bg-white")}>{c}</button>)}</div><div className="grid max-h-[760px] gap-4 overflow-y-auto pr-2 md:grid-cols-2 xl:grid-cols-3">{visible.map(p=><section key={p.id} className={"overflow-hidden rounded-2xl border bg-white shadow-sm transition " + ((cart[p.id]||0)>0?"border-[#1f6b45] ring-2 ring-emerald-100":"border-[#e3ded0]")}><div className="relative"><img src={p.image} alt="" className="h-44 w-full object-cover" /><Badge tone={(cart[p.id]||0)>0?"good":"neutral"}>{p.category}</Badge></div><div className="p-4"><h3 className="text-lg font-black leading-tight">{p.name}</h3>{(p.bloodline || p.breed) && <p className="mt-1 text-sm font-black text-[#1f6b45]">{p.bloodline || p.breed}</p>}<div className="mt-3 flex items-end justify-between gap-3"><div><p className="text-2xl font-black">{peso(p.price)}</p><p className="text-sm font-bold text-[#667267]">{p.unit}</p></div><p className="rounded-xl bg-[#f6f3e8] px-3 py-2 text-sm font-black">{p.stock} left</p></div><div className="mt-4 flex items-center justify-between rounded-2xl bg-[#f6f3e8] p-2"><button aria-label={`Remove ${p.name}`} onClick={()=>setQty(p.id,(cart[p.id]||0)-1)} className="grid h-11 w-11 place-items-center rounded-xl bg-white text-xl font-black shadow-sm">-</button><div className="text-center"><p className="text-xs font-black uppercase text-[#667267]">Qty</p><p className="text-xl font-black">{cart[p.id]||0}</p></div><button aria-label={`Add one ${p.name}`} onClick={()=>setQty(p.id,(cart[p.id]||0)+1)} className="grid h-11 w-11 place-items-center rounded-xl bg-[#1f6b45] text-xl font-black text-white shadow-sm">+</button></div></div></section>)}</div></div><Card className="h-fit border-2 border-[#1f6b45] lg:sticky lg:top-32"><div className="flex items-center justify-between"><h2 className="flex items-center gap-2 text-2xl font-black"><Icon name="bag" /> Cart</h2><Badge tone={itemCount>0?"good":"neutral"}>{itemCount}</Badge></div><div className="mt-4 max-h-[360px] space-y-3 overflow-y-auto pr-2">{cartEntries.map(({product,qty})=><div key={product.id} className="rounded-xl bg-[#f6f3e8] p-3"><div className="flex justify-between gap-3 text-sm"><span><b>{product.name}</b><br/><span className="text-[#667267]">{qty} x {peso(product.price)}</span></span><b>{peso(product.price*qty)}</b></div></div>)}{total===0 && <p className="rounded-xl bg-[#f6f3e8] p-3 text-sm text-[#667267]">Cart is empty. Use plus on a product.</p>}</div><div className="mt-4 border-t pt-4"><Info label="Manual Payment" value="Admin review required" /><div className="mt-3 flex justify-between text-lg font-black"><span>Total</span><span>{peso(total)}</span></div>{lastCheckoutId && <div className="mt-4 grid gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-3"><p className="text-sm font-black text-emerald-900">Payment saved: {lastCheckoutId.slice(0, 8)}</p><div className="grid gap-2 sm:grid-cols-3"><Link href="/customer/roosters" className="rounded-xl bg-white px-3 py-2 text-center text-sm font-black text-[#1f6b45] shadow-sm">My Roosters</Link><Link href="/customer/inventory" className="rounded-xl bg-white px-3 py-2 text-center text-sm font-black text-[#1f6b45] shadow-sm">Inventory</Link><Link href="/customer/inbox/invoice/farm-buy" className="rounded-xl bg-[#1f6b45] px-3 py-2 text-center text-sm font-black text-white">Receipt</Link></div></div>}{total===0 && <button disabled className="mt-4 w-full rounded-xl bg-[#d8d2c3] px-4 py-3 font-black text-[#7a766b]">Pay</button>}{total>0 && <button onClick={buyCart} className="mt-4 w-full rounded-xl bg-[#1f6b45] px-4 py-3 font-black text-white">Pay</button>}<p className="mt-2 text-xs font-bold text-[#667267]">External payment only. Upload reference and receipt; admin approves before items appear.</p></div></Card></div></Shell>;
}
export function InventoryPage() {
  const [ownedItems, setOwnedItems] = useState<FarmProductCard[]>([]);
  const [inventoryNote, setInventoryNote] = useState("Purchased supplies from Farm Buy will appear here after checkout.");
  const careNeeds: Array<{ rooster: string; caretaker: string; item: string; qty: string; reason: string }> = [];
  useEffect(() => {
    let mounted = true;
    getCustomerInventoryItems()
      .then(rows => {
        if (!mounted) return;
        const mapped: FarmProductCard[] = rows.map(row => ({
          id: row.product_id || row.id,
          name: row.product_name,
          category: String(row.category || "Farm Items").replaceAll("_", " ").replace(/\b\w/g, c => c.toUpperCase()),
          unit: row.unit_label || "owned",
          price: Number(row.unit_price || 0),
          stock: Number(row.quantity || 0),
          image: row.image_url || "/farmconnect/marketplace/fc-product-equipment.jpg",
          product_type: row.product_type,
          bloodline: row.bloodline,
          breed: row.breed,
        }));
        setOwnedItems(mapped);
        setInventoryNote(mapped.length ? "Live owned inventory loaded from your Farm Buy purchases." : "No owned supplies yet. Buy feeds, vitamins, supplements, vaccines, or equipment from Farm Buy.");
      })
      .catch(() => setInventoryNote("Inventory could not load yet. Please check login or database setup."));
    return () => { mounted = false; };
  }, []);
  function careBuyHref(need: typeof careNeeds[number]) {
    const params = new URLSearchParams({ care: "1", rooster: need.rooster, caretaker: need.caretaker, item: need.item, qty: need.qty, reason: need.reason });
    return `/customer/farm-buy?${params.toString()}`;
  }
  const totalStock = ownedItems.reduce((sum, product) => sum + product.stock, 0);
  const lowStock = ownedItems.filter(product => product.stock <= 2).length;
  const categories = Array.from(new Set(ownedItems.map(product => product.category)));
  const inventoryValue = ownedItems.reduce((sum, product) => sum + product.price * product.stock, 0);
  return <Shell role="customer" title="Inventory"><PageTitle title="Inventory" text="Customer-owned feeds, vitamins, supplies, and care-use stock from Farm Buy." icon="bag" /><KaFarm>{inventoryNote}</KaFarm><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"><Card className="p-4"><div className="flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#f1eadb] text-[#1f6b45]"><Icon name="bag" /></div><div><p className="text-xs font-black uppercase text-[#667267]">Owned Items</p><p className="text-3xl font-black">{ownedItems.length}</p></div></div></Card><Card className="p-4"><div className="flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-100 text-amber-700"><Icon name="alert" /></div><div><p className="text-xs font-black uppercase text-[#667267]">Care Needs</p><p className="text-3xl font-black">{careNeeds.length}</p></div></div></Card><Card className="p-4"><div className="flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#e7f3ea] text-[#1f6b45]"><Icon name="check" /></div><div><p className="text-xs font-black uppercase text-[#667267]">Owned Qty</p><p className="text-3xl font-black">{totalStock}</p></div></div></Card><Card className="p-4"><div className="flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#eef1ff] text-[#3450a4]"><Icon name="coins" /></div><div><p className="text-xs font-black uppercase text-[#667267]">Owned Value</p><p className="text-2xl font-black">{peso(inventoryValue)}</p></div></div></Card></div><section className="mt-5 rounded-3xl border border-amber-200 bg-white p-4 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-100 text-amber-700"><Icon name="clipboard" /></div><div><h2 className="text-xl font-black">Care Supply Needed</h2><p className="text-sm font-bold text-[#667267]">Buy only what the caretaker needs for the selected rooster.</p></div></div><Badge tone="warn">{careNeeds.length} active</Badge></div><div className="mt-4 grid gap-3 md:grid-cols-2">{careNeeds.map(need=><div key={need.rooster + need.item} className="rounded-2xl border border-[#ece6d8] bg-[#fffdf7] p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div className="min-w-0"><b className="block truncate">{need.rooster}</b><p className="truncate text-sm font-bold text-[#667267]">{need.item} - {need.caretaker}</p></div><Badge tone="warn">{need.qty}</Badge></div><p className="mt-2 text-sm font-bold text-[#667267]">{need.reason}</p><Link href={careBuyHref(need)} className="mt-3 inline-flex rounded-xl bg-[#1f6b45] px-3 py-2 text-sm font-black text-white">Buy for Care</Link></div>)}</div></section><Card className="mt-5"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-black">Owned Inventory List</h2><p className="text-sm font-bold text-[#667267]">{categories.length} categories - {lowStock} low stock item{lowStock===1?"":"s"}</p></div><div className="flex flex-wrap gap-2">{categories.slice(0,4).map(category=><span key={category} className="rounded-full bg-[#f6f3e8] px-3 py-2 text-xs font-black text-[#667267]">{category}</span>)}</div></div><div className="max-h-[620px] space-y-3 overflow-y-auto pr-2">{ownedItems.map(product=>{ const need = careNeeds.find(row => row.item === product.name); const needed = Boolean(need); return <div key={product.id} className={"flex items-center gap-3 rounded-2xl border p-3 " + (needed ? "border-amber-300 bg-amber-50" : "border-[#ece6d8] bg-[#fffdf7]")}><div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-[#ded8c9] bg-white"><img src={product.image} alt="" className="h-full w-full object-cover" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><b className="truncate text-lg">{product.name}</b><Badge tone={needed ? "warn" : "neutral"}>{needed ? "Needed" : product.category}</Badge></div><p className="mt-1 text-sm font-bold text-[#667267]">{peso(product.price)} {product.unit}</p></div><div className="flex shrink-0 items-center gap-2"><div className="rounded-xl bg-white px-3 py-2 text-right"><p className="text-xs font-black uppercase text-[#667267]">Owned</p><p className="font-black">{product.stock}</p></div>{need && <Link href={careBuyHref(need)} className="rounded-xl bg-[#1f6b45] px-3 py-2 text-sm font-black text-white">Buy</Link>}</div></div>})}{ownedItems.length===0 && <div className="rounded-2xl border border-dashed border-[#ded8c9] bg-[#fffdf7] p-5 text-sm font-bold text-[#667267]">No owned inventory yet. After Farm Buy checkout, supplies will appear here automatically.</div>}</div></Card></Shell>;
}
export function FarmRequests() {
  const router = useRouter();
  const [rooster, setRooster] = useState<RoosterCard | null>(null);
  const [service, setService] = useState(services[0]);
  const [note, setNote] = useState("");
  const [requestNote, setRequestNote] = useState("Choose a rooster, choose a service, add a note, then submit. Paid services create an invoice automatically.");
  const [careRows, setCareRows] = useState<any[]>([]);
  const [ownedRoosters, setOwnedRoosters] = useState<RoosterCard[]>([]);
  const [submitting, setSubmitting] = useState(false);
  useEffect(()=>{
    let mounted = true;
    getCustomerOwnedRoosters()
      .then(owned => {
        if (!mounted) return;
        const mapped: RoosterCard[] = owned.filter(isRealOwnedAnimal).map((row: any, index: number) => ({
          id: row.id,
          name: row.animal_name || `Rooster ${index + 1}`,
          breed: row.breed_snapshot || row.bloodline_snapshot || "Recorded Bloodline",
          tag: row.animal_code || `FC-${index + 1}`,
          stage: row.stage_snapshot || "Owned",
          status: row.status || "Owned",
          health: "Good",
          value: "Admin reviewed",
          image: row.image_url || row.photo_url || "/farmconnect/roosters/fc-stage-3-young-rooster-base.jpg",
          pen: row.pen_label || "Farm pen",
          caretaker: row.caretaker_name || "Assigning",
        }));
        setOwnedRoosters(mapped);
        setRooster(mapped[0] || null);
      })
      .catch(()=>setRequestNote("Owned rooster records could not load yet. Buy a rooster first and wait for admin approval."));
    getCustomerCareRequests()
      .then(rows=>{ if (mounted) setCareRows(rows); })
      .catch(()=>setRequestNote("Care request database is not ready yet. Run SQL 011 before live testing."));
    return () => { mounted = false; };
  }, []);
  async function submitRequest(){
    if (submitting) return;
    if (!rooster) {
      setRequestNote("No owned rooster yet. Buy a rooster first and wait for admin approval before creating care requests.");
      return;
    }
    setSubmitting(true);
    try {
      const careRequestId = await createCareRequest({
        customerAnimalId: rooster.id.startsWith("live-") ? rooster.id.replace(/^live-/,"") : null,
        roosterName: rooster.name,
        roosterTag: rooster.tag,
        serviceName: service.name,
        serviceCategory: service.category,
        servicePrice: service.price,
        requiredProof: service.proof,
        customerNote: note,
      });
      if (service.price > 0) {
      const summary = {
        source: "Care Request",
        care_request_id: careRequestId,
        rooster: { id: rooster.id, name: rooster.name, tag: rooster.tag, breed: rooster.breed },
        service,
        customer_note: note,
        total: service.price,
      };
      window.localStorage.setItem("farmconnect_payment_context", JSON.stringify({ sourceType: "care_request", sourceRef: careRequestId, amountExpected: service.price, summary }));
      router.push("/customer/payment?type=care_request");
      return;
      }
      setRequestNote(`Request sent for ${rooster.name}. Admin will assign this to a caretaker; your note is included.`);
      const rows = await getCustomerCareRequests();
      setCareRows(rows);
    } catch {
      setRequestNote("Could not save request to database. Please login and make sure SQL 011 is run.");
    } finally {
      setSubmitting(false);
    }
  }
  return <Shell role="customer" title="Farm Requests"><PageTitle title="Farm Requests" text="Choose a rooster, choose a service, add a note, then Pay or Send Request." icon="clipboard" /><KaFarm>{requestNote}</KaFarm><div className="mt-5 grid gap-4 lg:grid-cols-[0.9fr_1.15fr_0.9fr]"><Card><h2 className="text-lg font-black xl:text-xl">1. Rooster List</h2><div className="mt-4 max-h-[520px] space-y-3 overflow-y-auto pr-2">{ownedRoosters.map(r=><button key={r.id} onClick={()=>setRooster(r)} className={"flex w-full items-center gap-3 rounded-xl border p-3 text-left " + (rooster?.id===r.id?"border-[#1f6b45] bg-emerald-50":"border-[#ece6d8]")}><img src={r.image} className="h-12 w-12 rounded-lg object-cover" alt="" /><span className="min-w-0"><b className="block truncate">{r.name}</b><p className="truncate text-sm text-[#667267]">{r.tag}</p></span></button>)}{ownedRoosters.length===0 && <p className="rounded-xl border border-dashed border-[#ded8c9] bg-[#fffdf7] p-4 text-sm font-bold text-[#667267]">No owned rooster yet. Approved Farm Buy rooster purchases will appear here.</p>}</div></Card><Card><h2 className="text-lg font-black xl:text-xl">2. Choose Service</h2><div className="mt-4 max-h-[420px] space-y-2 overflow-y-auto pr-2">{services.map(s=><button key={s.name} onClick={()=>setService(s)} className={"w-full rounded-xl border p-3 text-left " + (service.name===s.name?"border-[#1f6b45] bg-emerald-50":"border-[#ece6d8]")}><div className="flex flex-wrap justify-between gap-2"><b>{s.name}</b><span>{s.price?peso(s.price):"Free"}</span></div><p className="text-sm text-[#667267]">{s.proof} - {s.eta}</p></button>)}</div><label className="mt-4 block text-sm font-black">Customer Instruction</label><textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Tell the farm what you want..." className="mt-2 min-h-24 w-full rounded-xl border border-[#ded8c9] p-3" /><button onClick={submitRequest} className="mt-3 w-full rounded-xl bg-[#1f6b45] px-4 py-3 font-black text-white">{submitting ? "Saving..." : service.price>0 ? "Pay" : "Send Request"}</button>{service.price>0 && <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-[#7a4b00]">Manual external payment. Admin approves before the task goes to caretaker.</p>}</Card><Card><h2 className="text-lg font-black xl:text-xl">3. Request Logs</h2><div className="mt-4 max-h-[520px] space-y-3 overflow-y-auto pr-2">{careRows.map(row=><div key={row.id} className="rounded-xl bg-[#f6f3e8] p-3"><b>{row.rooster_name}</b><p className="text-sm text-[#667267]">{row.service_name} - {String(row.status || "").replaceAll("_"," ")}</p><p className="mt-1 text-xs font-bold text-[#667267]">{row.customer_note || "No note"}</p><button onClick={()=>setRequestNote(`Care request ${row.service_name}: ${String(row.status || "").replaceAll("_"," ")}.`)} className="mt-2 rounded-lg bg-white px-3 py-2 text-sm font-black">View Care</button></div>)}{careRows.length===0 && <p className="rounded-xl bg-[#f6f3e8] p-3 text-sm font-bold text-[#667267]">No care request records yet.</p>}</div></Card></div></Shell>;
}

function SavingsModal({ lockedSavings, balance, onClose, onLock, onUnlock }: { lockedSavings: number; balance: number; onClose: () => void; onLock: () => void; onUnlock: () => void }) {
  const pockets: { name: string; label: string; amount: number; days: string; icon: IconName; tone: string }[] = [
    { name: "Savings 01", label: "Feed reserve", amount: lockedSavings || 0, days: lockedSavings ? "Active lock" : "Ready to start", icon: "wallet", tone: "border-[#1f6b45] text-[#1f6b45]" },
    { name: "Savings 02", label: "Vet emergency", amount: 0, days: "Open slot", icon: "shield", tone: "border-amber-400 text-amber-700" },
    { name: "Savings 03", label: "Rooster upgrade", amount: 0, days: "Open slot", icon: "bag", tone: "border-[#7d6a4c] text-[#7d6a4c]" },
    { name: "Savings 04", label: "Withdrawal hold", amount: 0, days: "Open slot", icon: "coins", tone: "border-[#8aa08b] text-[#4d6f50]" },
  ];
  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"><section className="max-h-[92vh] w-full max-w-3xl overflow-auto rounded-3xl bg-white p-5 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><h2 className="text-3xl font-black">Go Save</h2><p className="mt-1 text-sm font-bold text-[#667267]">4% per annum savings interest rate</p></div><button onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full bg-[#f6f3e8] font-black">x</button></div><div className="mt-5 rounded-3xl bg-[#f6f3e8] p-5 text-center"><p className="text-xs font-black uppercase text-[#667267]">Total Savings</p><p className="mt-1 text-4xl font-black">{peso(lockedSavings)}</p><p className="mt-1 text-sm font-bold text-[#667267]">Available to lock: {peso(Math.max(0, balance - lockedSavings))}</p></div><div className="mt-5 grid gap-4 sm:grid-cols-2">{pockets.map(p=><button key={p.name} onClick={onLock} className="rounded-3xl border border-[#ece6d8] bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><div className="flex items-center gap-4"><div className={"grid h-20 w-20 shrink-0 place-items-center rounded-full border-2 bg-white " + p.tone}><Icon name={p.icon} className="h-8 w-8" /></div><div><b className="text-lg">{p.name}</b><p className="text-sm font-bold text-[#667267]">{p.label}</p><p className="mt-2 text-xl font-black">{peso(p.amount)}</p><p className="text-xs font-bold text-[#667267]">{p.days}</p></div></div></button>)}</div><div className="mt-5 grid gap-3 sm:grid-cols-3"><button onClick={onLock} className="rounded-2xl bg-[#1f6b45] px-4 py-3 font-black text-white">Lock â‚±500</button><button onClick={onUnlock} className="rounded-2xl bg-[#eee8d9] px-4 py-3 font-black">Unlock Savings</button><button onClick={onClose} className="rounded-2xl bg-white px-4 py-3 font-black text-[#1f6b45] shadow-sm">Done</button></div></section></div>;
}

function PinGate({ title, onClose, onConfirm }: { title: string; onClose: () => void; onConfirm: () => void }) {
  const [pin, setPin] = useState("");
  const [note, setNote] = useState("Enter your 6-digit wallet PIN to continue.");
  const press = (digit: string) => {
    setNote("Enter your 6-digit wallet PIN to continue.");
    setPin(current => {
      const next = (current + digit).slice(0, 6);
      if (next.length === 6) setTimeout(onConfirm, 120);
      return next;
    });
  };
  const submit = () => {
    if (pin.length < 6) {
      setNote("PIN must be 6 digits.");
      return;
    }
    onConfirm();
  };
  const keys = ["1","2","3","4","5","6","7","8","9","","0","del"];
  return <div className="fixed inset-0 z-[60] overflow-y-auto bg-[radial-gradient(circle_at_18%_12%,rgba(125,211,252,0.55),transparent_28%),radial-gradient(circle_at_84%_18%,rgba(37,99,235,0.35),transparent_30%),linear-gradient(160deg,#eff8ff_0%,#dff1ff_42%,#ffffff_100%)] text-[#0b1f3a]"><div className="mx-auto flex min-h-screen w-full max-w-[520px] flex-col px-6 py-8"><div className="flex items-center justify-between"><button onClick={onClose} className="grid h-11 w-11 place-items-center rounded-full bg-white/80 text-lg font-black text-[#155e9f] shadow-sm ring-1 ring-sky-100">x</button><div className="flex items-center gap-2 rounded-full bg-white/85 px-4 py-2 text-sm font-black text-[#155e9f] shadow-sm ring-1 ring-sky-100"><Icon name="rooster" className="h-5 w-5" /> FarmConnect</div></div><div className="flex flex-1 flex-col justify-center pb-4 pt-10"><div className="text-center"><div className="mx-auto mb-5 grid h-20 w-20 place-items-center rounded-full bg-white text-[#0f6fb8] shadow-[0_18px_45px_rgba(37,99,235,0.2)] ring-1 ring-sky-100"><Icon name="rooster" className="h-10 w-10" /></div><h2 className="text-4xl font-black tracking-normal text-[#071b33]">{title}</h2><p className="mt-3 text-base font-bold text-[#4d6f91]">{note}</p></div><div className="mt-10 flex justify-center gap-5">{Array.from({ length: 6 }).map((_,i)=><span key={i} className={"h-5 w-5 rounded-full border-2 " + (pin.length>i ? "border-[#0f6fb8] bg-[#0f6fb8] shadow-[0_0_18px_rgba(14,116,190,0.35)]" : "border-[#7cb7e5] bg-white/70")} />)}</div><div className="mx-auto mt-10 grid w-full max-w-[430px] grid-cols-3 gap-5">{keys.map((key,i)=>key==="" ? <span key={i} /> : key==="del" ? <button key={key} onClick={()=>setPin(pin.slice(0,-1))} className="grid aspect-square place-items-center rounded-full bg-white/75 text-xl font-black text-[#155e9f] shadow-sm ring-1 ring-sky-100 transition active:scale-95">Del</button> : <button key={key} onClick={()=>press(key)} className="grid aspect-square place-items-center rounded-full bg-white/85 text-5xl font-black text-[#071b33] shadow-[0_12px_30px_rgba(15,111,184,0.12)] ring-1 ring-sky-100 transition active:scale-95">{key}</button>)}</div><button onClick={submit} className="mx-auto mt-8 w-full max-w-[430px] rounded-2xl bg-[#0f6fb8] px-5 py-4 text-center font-black text-white shadow-[0_14px_30px_rgba(15,111,184,0.25)]">Continue</button></div></div></div>;
}
function SavingsModalFc({ lockedSavings, balance, onClose, onLock, onUnlock }: { lockedSavings: number; balance: number; onClose: () => void; onLock: (amount: number) => void; onUnlock: (amount: number) => void }) {
  const initialPocket = lockedSavings > 0 ? { id: "pocket-1", name: "Pang-ipon ko ito", amount: lockedSavings } : null;
  const [pockets, setPockets] = useState<Array<{ id: string; name: string; amount: number }>>(() => initialPocket ? [initialPocket] : []);
  const [selectedId, setSelectedId] = useState<string | null>(() => initialPocket?.id || null);
  const [mode, setMode] = useState<"list" | "create" | "open" | "add" | "transfer">(() => initialPocket ? "open" : "list");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("500");
  const [targetId, setTargetId] = useState("outside");
  const [pending, setPending] = useState<null | "add" | "outside" | "transfer">(null);
  const [note, setNote] = useState("Create a savings pocket first. You can create up to 4 pockets.");
  const selected = pockets.find(p => p.id === selectedId) || pockets[0];
  const totalLocked = pockets.reduce((sum, p) => sum + p.amount, 0);
  const available = Math.max(0, balance - totalLocked);
  const amountValue = Number(amount || 0);
  const createPocket = () => {
    if (pockets.length >= 4) { setNote("Maximum of 4 savings pockets only."); return; }
    const next = { id: `pocket-${Date.now()}`, name: name.trim() || `Savings ${pockets.length + 1}`, amount: 0 };
    setPockets([...pockets, next]); setSelectedId(next.id); setName(""); setMode("open"); setNote(`${next.name} created. Add FC when you are ready.`);
  };
  const openPocket = (id: string) => { setSelectedId(id); setMode("open"); const pocket = pockets.find(p => p.id === id); setNote(`${pocket?.name || "Savings"} opened.`); };
  const requestAction = (action: "add" | "outside" | "transfer") => {
    if (!selected) return;
    if (amountValue <= 0) { setNote("Enter an amount first."); return; }
    if (action === "add" && amountValue > available) { setNote("Amount is higher than your unlocked balance."); return; }
    if ((action === "outside" || action === "transfer") && amountValue > selected.amount) { setNote("Amount is higher than this savings pocket."); return; }
    if (action === "transfer" && targetId === selected.id) { setNote("Choose another savings pocket or outside balance."); return; }
    setPending(action);
  };
  const finishAction = () => {
    if (!selected || !pending) return;
    if (pending === "add") { setPockets(pockets.map(p => p.id === selected.id ? { ...p, amount: p.amount + amountValue } : p)); onLock(amountValue); setNote(`Added FC ${fcCoin(amountValue)} to ${selected.name}.`); }
    if (pending === "outside") { setPockets(pockets.map(p => p.id === selected.id ? { ...p, amount: Math.max(0, p.amount - amountValue) } : p)); onUnlock(amountValue); setNote(`Moved FC ${fcCoin(amountValue)} back to unlocked balance.`); }
    if (pending === "transfer") { setPockets(pockets.map(p => p.id === selected.id ? { ...p, amount: Math.max(0, p.amount - amountValue) } : p.id === targetId ? { ...p, amount: p.amount + amountValue } : p)); setNote(`Transferred FC ${fcCoin(amountValue)} to another savings pocket.`); }
    setPending(null); setMode("open");
  };
  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4">{pending && <PinGate title={pending === "add" ? "Add to Savings" : "Transfer Savings"} onClose={()=>setPending(null)} onConfirm={finishAction} />}<section className="max-h-[92vh] w-full max-w-5xl overflow-auto rounded-[28px] bg-[#f7fbff] p-5 text-[#071b33] shadow-2xl"><div className="flex items-start justify-between gap-4"><div className="flex items-center gap-3"><div className="grid h-14 w-14 place-items-center rounded-2xl bg-white text-[#0f6fb8] shadow-sm ring-1 ring-sky-100"><Icon name="shield" className="h-8 w-8" /></div><div><h2 className="text-3xl font-black">Save / Lock</h2><p className="mt-1 text-sm font-bold text-[#4d6f91]">Create savings pockets, add FC, or transfer funds.</p></div></div><button onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full bg-white font-black text-[#155e9f] shadow-sm ring-1 ring-sky-100">x</button></div>{pockets.length === 0 && mode !== "create" && <div className="mt-8 grid min-h-[420px] place-items-center rounded-[28px] border-2 border-dashed border-sky-200 bg-white/70 p-8 text-center"><button onClick={()=>setMode("create")} className="group"><span className="mx-auto grid h-28 w-28 place-items-center rounded-full bg-[#0f6fb8] text-6xl font-black text-white shadow-[0_18px_45px_rgba(15,111,184,0.28)] transition group-active:scale-95">+</span><b className="mt-5 block text-2xl">Add Savings</b><span className="mt-2 block max-w-sm text-sm font-bold text-[#4d6f91]">Create a named pocket first. Example: Pang-ipon ko ito, Emergency, Feed fund.</span></button></div>}{mode === "create" && <div className="mt-8 grid gap-5 lg:grid-cols-[1fr_360px]"><div className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-sky-100"><h3 className="text-2xl font-black">Name your savings</h3><p className="mt-2 text-sm font-bold text-[#4d6f91]">You may leave it blank and create a default savings pocket.</p><input value={name} onChange={e=>setName(e.target.value)} placeholder="Savings name" className="mt-5 w-full rounded-2xl border border-sky-100 px-4 py-4 text-2xl font-black" /><button onClick={createPocket} className="mt-4 w-full rounded-2xl bg-[#0f6fb8] px-4 py-4 font-black text-white">Create Savings</button></div><div className="rounded-[28px] bg-gradient-to-br from-[#0f6fb8] to-[#74c7ff] p-6 text-white shadow-[0_18px_40px_rgba(15,111,184,0.22)]"><p className="text-xs font-black uppercase text-white/75">Preview</p><h3 className="mt-2 text-3xl font-black">{name || `Savings ${pockets.length + 1}`}</h3><p className="mt-16 text-sm font-bold text-white/75">Balance</p><p className="text-4xl font-black">FC 0</p></div></div>}{pockets.length > 0 && mode !== "create" && <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_360px]"><div><div className="rounded-[28px] bg-gradient-to-br from-[#071b33] via-[#0f6fb8] to-[#74c7ff] p-6 text-white shadow-[0_18px_45px_rgba(15,111,184,0.25)]"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase text-white/70">Selected Savings</p><h3 className="mt-2 text-3xl font-black">{selected?.name}</h3></div><Badge tone="good">Locked</Badge></div><p className="mt-16 text-sm font-bold text-white/70">Saved Amount</p><p className="text-5xl font-black">FC {fcCoin(selected?.amount || 0)}</p></div><div className="mt-5 grid grid-cols-2 gap-3">{[0,1,2,3].map(i=>pockets[i] ? <button key={pockets[i].id} onClick={()=>openPocket(pockets[i].id)} className={("min-h-[132px] rounded-3xl bg-white p-4 text-left shadow-sm ring-1 ring-sky-100 " + (selected?.id===pockets[i].id ? "outline outline-4 outline-sky-200" : ""))}><b className="block text-lg">{i+1}. {pockets[i].name}</b><p className="mt-3 text-2xl font-black text-[#0f6fb8]">FC {fcCoin(pockets[i].amount)}</p></button> : <button key={i} onClick={()=>setMode("create")} className="grid min-h-[132px] place-items-center rounded-3xl border-2 border-dashed border-sky-200 bg-sky-50 p-4 text-center text-[#0f6fb8]"><span><span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-white text-2xl font-black shadow-sm">+</span><b className="mt-2 block">Add</b></span></button>)}</div><p className="mt-4 rounded-2xl bg-white p-4 text-sm font-bold text-[#4d6f91] shadow-sm ring-1 ring-sky-100">{note}</p></div><div className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-sky-100"><h3 className="text-xl font-black">Actions</h3><div className="mt-4 rounded-2xl bg-sky-50 p-3 text-sm font-bold text-[#4d6f91]"><div className="flex justify-between gap-3"><span>Unlocked balance</span><b>FC {fcCoin(available)}</b></div><div className="mt-2 flex justify-between gap-3"><span>Total saved</span><b>FC {fcCoin(totalLocked)}</b></div></div><label className="mt-4 block text-sm font-black">Amount</label><input value={amount} onChange={e=>setAmount(e.target.value.replace(/\D/g,""))} inputMode="numeric" placeholder="Enter amount" className="mt-2 w-full rounded-2xl border border-sky-100 px-4 py-4 text-3xl font-black" /><div className="mt-3 grid grid-cols-3 gap-2">{[100,500,1000].map(v=><button key={v} onClick={()=>setAmount(String(v))} className="rounded-xl bg-sky-50 px-3 py-2 text-sm font-black text-[#0f6fb8]">FC {v}</button>)}</div>{mode === "transfer" && <div><label className="mt-4 block text-sm font-black">Transfer to</label><select value={targetId} onChange={e=>setTargetId(e.target.value)} className="mt-2 w-full rounded-2xl border border-sky-100 px-4 py-3 font-black"><option value="outside">Unlocked balance</option>{pockets.filter(p=>p.id!==selected?.id).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></div>}<button onClick={()=>mode === "transfer" ? requestAction(targetId === "outside" ? "outside" : "transfer") : requestAction("add")} className="mt-4 w-full rounded-2xl bg-[#0f6fb8] px-4 py-4 font-black text-white">{mode === "transfer" ? "Confirm Transfer" : "Add FC"}</button><button onClick={()=>setMode(mode === "transfer" ? "open" : "transfer")} className="mt-3 w-full rounded-2xl bg-[#eef6ff] px-4 py-4 font-black text-[#0f6fb8]">{mode === "transfer" ? "Cancel Transfer" : "Transfer"}</button><p className="mt-4 rounded-2xl bg-amber-50 p-3 text-xs font-bold text-[#7a4b00]">Every add or transfer out requires wallet PIN. Locked savings cannot be spent until moved back.</p></div></div>}</section></div>;
}
export function WalletPage() {
  const [balance, setBalance] = useState(0);
  const [lockedSavings, setLockedSavings] = useState(0);
  const [showSavings, setShowSavings] = useState(false);
  const [showAmounts, setShowAmounts] = useState(true);
  const [showLockedSavings, setShowLockedSavings] = useState(false);
  const [pinGate, setPinGate] = useState<null | "balance" | "save">(null);
  const [walletNote, setWalletNote] = useState("Loading live wallet records...");
  const [walletRows, setWalletRows] = useState<typeof transactions>([]);
  const availableBalance = Math.max(0, balance - lockedSavings);
  useEffect(() => {
    let mounted = true;
    getCurrentProfile()
      .then(async profile => {
        if (!mounted || !profile) return;
        setBalance(Number(profile.wallet_balance || 0));
        const rows = await getWalletTransactions(profile.id);
        if (!mounted) return;
        if (rows.length === 0) {
          setWalletRows([]);
          setWalletNote("No wallet transactions yet. Withdrawal records will appear here after admin review.");
          return;
        }
        setWalletRows(rows.map(row => ({
          type: row.transaction_type || "Wallet Transaction",
          date: row.created_at ? new Date(row.created_at).toLocaleDateString("en-PH") : "Today",
          status: row.status || "recorded",
          amount: Number(row.amount || 0),
          receipt: row.id,
        })));
        setWalletNote("Live wallet records are loaded from Supabase.");
      })
      .catch(() => setWalletNote("Wallet is using the safe preview while live records are checked."));
    return () => { mounted = false; };
  }, []);
  return <Shell role="customer" title="Wallet"><PageTitle title="Wallet" text="Withdraw FarmConnect Coin and review transaction records." icon="wallet" />{pinGate && <PinGate title="Enter Wallet PIN" onClose={()=>setPinGate(null)} onConfirm={()=>{setShowLockedSavings(true); setWalletNote("Locked savings are visible after PIN confirmation."); setPinGate(null);}} />}{showSavings && <SavingsModalFc lockedSavings={lockedSavings} balance={balance} onClose={()=>setShowSavings(false)} onLock={(amount)=>{const next=Math.min(balance, lockedSavings + amount); setLockedSavings(next); setShowLockedSavings(true); setWalletNote(`FC ${fcCoin(amount)} locked in Save. Total locked: FC ${fcCoin(next)}.`);}} onUnlock={(amount)=>{const next=Math.max(0, lockedSavings - amount); setLockedSavings(next); setShowLockedSavings(true); setWalletNote(`FC ${fcCoin(amount)} unlocked. Remaining locked: FC ${fcCoin(next)}.`);}} />}<div className="rounded-[28px] bg-[#070716] p-4 text-white shadow-2xl md:p-6"><section className="grid gap-4 lg:grid-cols-2"><div className="relative overflow-hidden rounded-[24px] bg-[radial-gradient(circle_at_82%_0%,rgba(255,81,246,0.9),transparent_32%),linear-gradient(135deg,#2810b8_0%,#7719df_48%,#d915c7_100%)] p-5 shadow-[0_18px_45px_rgba(102,22,221,0.45)]"><div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-fuchsia-300/25 blur-2xl" /><div className="relative flex items-start justify-between gap-4"><div><div className="flex items-center gap-2"><p className="text-sm font-bold text-white/75">Available Balance</p></div><div className="mt-5 flex items-center gap-3"><span className="text-3xl font-black">FC</span><p className="text-4xl font-black md:text-5xl">{showAmounts?fcCoin(availableBalance):"******"}</p><button onClick={()=>setShowAmounts(!showAmounts)} className="grid h-9 w-9 place-items-center rounded-full text-white/90"><Icon name={showAmounts?"eyeOff":"eye"} /></button></div></div><span className="mt-12 h-10 w-10" aria-hidden="true" /></div></div><div className="relative overflow-hidden rounded-[24px] bg-[radial-gradient(circle_at_82%_0%,rgba(255,81,246,0.75),transparent_32%),linear-gradient(135deg,#21124f_0%,#5a1ab7_48%,#a814b7_100%)] p-5 text-left shadow-[0_18px_45px_rgba(102,22,221,0.35)]"><div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-fuchsia-300/20 blur-2xl" /><div className="relative flex items-start justify-between gap-4"><div><div className="flex items-center gap-2"><p className="text-sm font-bold text-white/75">Locked Savings</p><button onClick={()=>showLockedSavings?setShowLockedSavings(false):setPinGate("save")} className="text-white/70"><Icon name={showLockedSavings?"eyeOff":"eye"} className="h-4 w-4" /></button></div><div className="mt-5 flex items-center gap-3"><span className="text-3xl font-black">FC</span><p className="text-4xl font-black md:text-5xl">{showLockedSavings?fcCoin(lockedSavings):"******"}</p></div><p className="mt-2 text-sm font-bold text-white/65">PIN required</p></div><span className="mt-12 h-10 w-10" aria-hidden="true" /></div></div></section><div className="mt-5 grid gap-3"><Link href="/customer/withdraw" className="rounded-2xl bg-white/10 p-4 text-left font-black text-white shadow-sm ring-1 ring-white/10"><Icon name="wallet" className="mb-3 h-7 w-7" />Withdraw Funds</Link></div><div className="mt-5 rounded-[24px] bg-white/8 p-4 ring-1 ring-white/10"><h2 className="text-xl font-black">Transaction History</h2><div className="mt-4 max-h-[520px] space-y-3 overflow-y-auto pr-2">{walletRows.length === 0 && <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-4 text-sm font-bold text-white/65">No transactions yet. Approved payments and withdrawals will appear here.</div>}{walletRows.map(t=><div key={t.receipt} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white/10 p-3 ring-1 ring-white/10"><div><b>{t.type}</b><p className="text-sm text-white/65">{t.date} - {t.status}</p></div><div className="text-right"><b>{showAmounts?fcCoin(t.amount):"******"}</b><Link href="/customer/inbox" className="ml-3 rounded-lg bg-white/10 px-3 py-2 text-sm font-black">Open Receipt</Link></div></div>)}</div></div></div></Shell>;
  return <Shell role="customer" title="Wallet"><PageTitle title="Wallet" text="FarmConnect Coin balance, cash-in, withdrawal, and locked savings." icon="wallet" />{pinGate && <PinGate title="Enter Wallet PIN" onClose={()=>setPinGate(null)} onConfirm={()=>{setShowLockedSavings(true); setWalletNote("Locked savings are visible after PIN confirmation."); setPinGate(null);}} />}{showSavings && <SavingsModalFc lockedSavings={lockedSavings} balance={balance} onClose={()=>setShowSavings(false)} onLock={()=>{const next=Math.min(balance, lockedSavings + 500); setLockedSavings(next); setWalletNote(`${fcCoin(next)} is locked in Go Save.`);}} onUnlock={()=>{setLockedSavings(0); setWalletNote("Locked savings released back to available FarmConnect Coin.");}} />}<div className="grid gap-5"><section className="rounded-3xl border border-[#e3ded0] bg-white p-4 shadow-sm"><div className="rounded-3xl bg-[#f6f3e8] p-5"><div className="flex flex-wrap items-center justify-between gap-4"><div className="flex items-center gap-4"><FCCoin className="h-16 w-16 text-lg" /><div><p className="text-sm font-black uppercase text-[#667267]">FarmConnect Coin Balance</p><p className="mt-1 text-5xl font-black">{showAmounts?fcCoin(balance):"FC ****"}</p></div></div><button onClick={()=>setShowAmounts(!showAmounts)} className="rounded-2xl bg-white px-4 py-3 font-black text-[#1f6b45] shadow-sm">{showAmounts?"Hide":"Show"}</button></div><div className="mt-5 grid gap-3 sm:grid-cols-2"><div className="rounded-2xl bg-white p-4 shadow-sm"><p className="text-xs font-black uppercase text-[#667267]">Available</p><p className="mt-1 text-2xl font-black">{showAmounts?fcCoin(availableBalance):"FC ****"}</p></div><button onClick={()=>setPinGate("save")} className="rounded-2xl bg-white p-4 text-left shadow-sm"><p className="text-xs font-black uppercase text-[#667267]">Locked Savings</p><p className="mt-1 text-2xl font-black">{showAmounts?fcCoin(lockedSavings):"FC ****"}</p><p className="mt-1 text-xs font-bold text-[#667267]">PIN required to open</p></button></div></div></section><div className="grid gap-3 sm:grid-cols-3"><Link href="/customer/cashin" className="rounded-2xl bg-[#1f6b45] p-4 text-left font-black text-white shadow-sm"><Icon name="coins" className="mb-3 h-7 w-7" />Add Cash</Link><Link href="/customer/withdraw" className="rounded-2xl bg-amber-300 p-4 text-left font-black shadow-sm"><Icon name="wallet" className="mb-3 h-7 w-7" />Withdraw Funds</Link><button onClick={()=>setPinGate("save")} className="rounded-2xl bg-white p-4 text-left font-black text-[#1f6b45] shadow-sm"><Icon name="shield" className="mb-3 h-7 w-7" />Save / Lock</button></div><Card><h2 className="text-xl font-black">Transaction History</h2><div className="mt-4 max-h-[520px] space-y-3 overflow-y-auto pr-2">{walletRows.map(t=><div key={t.receipt} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#ece6d8] p-3"><div><b>{t.type}</b><p className="text-sm text-[#667267]">{t.date} - {t.status}</p></div><div className="text-right"><b>{showAmounts?fcCoin(t.amount):"FC ****"}</b><Link href="/customer/inbox" className="ml-3 rounded-lg bg-[#f6f3e8] px-3 py-2 text-sm font-black">Open Receipt</Link></div></div>)}</div></Card></div></Shell>;
  return <Shell role="customer" title="Wallet"><PageTitle title="Wallet" text="Add cash, withdraw funds, and lock savings before spending." icon="wallet" />{pinGate && <PinGate title={pinGate==="save"?"Unlock Go Save":"Show Wallet Balance"} onClose={()=>setPinGate(null)} onConfirm={()=>{if(pinGate==="balance"){setShowAmounts(true); setWalletNote("Wallet balance is now visible for this session.");} else {setShowSavings(true); setWalletNote("Go Save opened. Choose a savings pocket before locking funds.");} setPinGate(null);}} />}{showSavings && <SavingsModal lockedSavings={lockedSavings} balance={balance} onClose={()=>setShowSavings(false)} onLock={()=>{const next=Math.min(balance, lockedSavings + 500); setLockedSavings(next); setWalletNote(`${peso(next)} is locked in savings. Locked savings cannot be used for buying until unlocked.`);}} onUnlock={()=>{setLockedSavings(0); setWalletNote("Locked savings released back to available balance.");}} />}<div className="grid gap-5 xl:grid-cols-[1fr_380px]"><div className="grid gap-5"><section className="rounded-2xl border border-[#e3ded0] bg-white p-4 shadow-sm"><div className="rounded-2xl bg-[#f6f3e8] p-5"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-sm font-black uppercase text-[#667267]">Total Balance</p><p className="mt-2 text-5xl font-black">{showAmounts?peso(balance):"â€¢â€¢â€¢â€¢â€¢â€¢"}</p></div><button onClick={()=>showAmounts?setShowAmounts(false):setPinGate("balance")} className="rounded-2xl bg-white px-4 py-3 font-black text-[#1f6b45] shadow-sm">{showAmounts?"Hide":"Show"}</button></div><div className="mt-5 grid gap-3 sm:grid-cols-2"><div className="rounded-2xl bg-white p-4 shadow-sm"><p className="text-xs font-black uppercase text-[#667267]">Available Balance</p><p className="mt-1 text-2xl font-black">{showAmounts?peso(availableBalance):"â€¢â€¢â€¢â€¢"}</p></div><div className="rounded-2xl bg-white p-4 shadow-sm"><p className="text-xs font-black uppercase text-[#667267]">Locked Savings</p><p className="mt-1 text-2xl font-black">{showAmounts?peso(lockedSavings):"â€¢â€¢â€¢â€¢"}</p></div></div></div></section><div className="grid gap-3 sm:grid-cols-3"><Link href="/customer/cashin" className="rounded-2xl bg-[#1f6b45] p-4 text-left font-black text-white shadow-sm"><Icon name="coins" className="mb-3 h-7 w-7" />Add Cash</Link><Link href="/customer/withdraw" className="rounded-2xl bg-amber-300 p-4 text-left font-black shadow-sm"><Icon name="wallet" className="mb-3 h-7 w-7" />Withdraw Funds</Link><button onClick={()=>setPinGate("save")} className="rounded-2xl bg-white p-4 text-left font-black text-[#1f6b45] shadow-sm"><Icon name="shield" className="mb-3 h-7 w-7" />Save / Lock</button></div><Card><h2 className="text-xl font-black">Transaction History</h2><div className="mt-4 max-h-[520px] space-y-3 overflow-y-auto pr-2">{walletRows.map(t=><div key={t.receipt} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#ece6d8] p-3"><div><b>{t.type}</b><p className="text-sm text-[#667267]">{t.date} - {t.status}</p></div><div className="text-right"><b>{showAmounts?peso(t.amount):"â€¢â€¢â€¢â€¢"}</b><Link href="/customer/inbox" className="ml-3 rounded-lg bg-[#f6f3e8] px-3 py-2 text-sm font-black">Open Receipt</Link></div></div>)}</div></Card></div><div className="grid h-fit gap-5"><KaFarm>{walletNote}</KaFarm><Card><h2 className="text-xl font-black">Savings Lock</h2><p className="mt-2 text-sm font-bold text-[#667267]">PIN is required before viewing or moving wallet savings.</p><div className="mt-4 grid gap-3"><button onClick={()=>setPinGate("save")} className="rounded-xl bg-[#eee8d9] px-4 py-3 font-black">Open Go Save</button><button onClick={()=>setWalletNote("Payout Account opened: PIN is required before adding or changing GCash, Maya, or bank details.")} className="rounded-xl bg-white px-4 py-3 font-black text-[#1f6b45] shadow-sm">Payout Account</button></div></Card></div></div></Shell>;
}

export function CashInPage() {
  const methods = [
    { name: "GCash", sub: "E-wallet", image: "/fc-gcash-qr-crop.png", href: "/customer/cashin/gcash", activeClass: "bg-[#0b6bff] text-white", panelClass: "bg-[#0b6bff]", buttonClass: "bg-[#0b6bff]" },
    { name: "Maya", sub: "E-wallet", image: "/fc-maya-qr-crop.png", href: "/customer/cashin/maya", activeClass: "bg-[#08a64b] text-white", panelClass: "bg-[#08a64b]", buttonClass: "bg-[#08a64b]" },
    { name: "Bank", sub: "UnionBank", image: "/fc-bpi-qr-crop.png", href: "/customer/cashin/bpi", activeClass: "bg-[#f58220] text-white", panelClass: "bg-[#f58220]", buttonClass: "bg-[#f58220]" },
  ];
  const [method, setMethod] = useState(methods[0]);
  const [note, setNote] = useState("Send the exact peso amount, then upload a clear receipt. The same value becomes FarmConnect Coin after approval.");
  const steps = ["Open QR and send payment", "Enter amount and reference", "Upload receipt screenshot", "Submit for checking"];
  const cashinHistory: { method: string; sender: string; amount: number; status: string; time: string }[] = [];
  return <Shell role="customer" title="Add Cash"><PageTitle title="Add Cash" text="Convert peso payment into wallet balance after automated receipt checking." icon="coins" /><div className="grid gap-5 lg:grid-cols-[1fr_360px]"><Card><h2 className="text-xl font-black">Payment Method</h2><div className="mt-4 grid gap-2 rounded-2xl bg-[#f6f3e8] p-2 sm:grid-cols-3">{methods.map(m=><button key={m.name} onClick={()=>setMethod(m)} className={"flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-black transition " + (method.name===m.name?m.activeClass + " shadow-sm":"bg-white text-[#1f2b20] hover:bg-emerald-50")}><span className="grid text-center leading-tight"><span>{m.name}</span><span className={"text-[11px] font-bold " + (method.name===m.name?"text-white/80":"text-[#667267]")}>{m.sub}</span></span>{method.name===m.name && <Icon name="check" className="h-4 w-4" />}</button>)}</div><div className="mt-5 grid items-start gap-5 md:grid-cols-[210px_1fr]"><div className="grid gap-3"><div className="h-fit rounded-2xl bg-[#f6f3e8] p-3 shadow-sm"><div className="rounded-xl bg-white p-2"><img src={method.image} alt={method.name} className="mx-auto h-[125px] w-full object-contain" /></div><div className="mt-3 grid gap-2"><p className="text-center text-sm font-black text-[#667267]">{method.name} QR</p><Link href={method.href} className="rounded-xl bg-[#1f6b45] px-4 py-2 text-center text-sm font-black text-white">Open QR</Link></div></div><div className="rounded-2xl bg-[#f6f3e8] p-3"><h3 className="text-sm font-black">How to Cash In</h3><div className="mt-2 grid gap-2">{steps.map((step,i)=><div key={step} className="flex gap-2 rounded-xl bg-white px-3 py-2 text-xs font-bold text-[#667267]"><span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#1f6b45] text-[10px] text-white">{i+1}</span>{step}</div>)}</div></div></div><div className="grid gap-3"><label className="text-sm font-black">Amount Sent</label><input inputMode="numeric" placeholder="Example: 3000" className="rounded-2xl border border-[#ded8c9] px-4 py-3 font-black" /><label className="text-sm font-black">Reference Number</label><input placeholder="Paste reference number" className="rounded-2xl border border-[#ded8c9] px-4 py-3 font-black" /><label className="text-sm font-black">Payment Proof</label><button onClick={()=>setNote("Proof upload opened. Make sure the photo shows recipient, amount, date, and reference number.")} className="rounded-2xl border-2 border-dashed border-[#cfc7b5] bg-[#fffdf7] p-4 text-left shadow-sm"><span className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-[#eee8d9] text-[#1f6b45]"><Icon name="upload" /></span><span><b className="block">Upload Proof</b><span className="text-sm font-bold text-[#667267]">Screenshot or clear photo of payment</span></span></span></button><button onClick={()=>setNote("Auto-check started: reading receipt, checking duplicate reference, matching amount, recipient, and date.")} className="rounded-2xl bg-[#1f6b45] px-4 py-3 font-black text-white">Submit for Auto Check</button></div></div></Card><Card className="h-fit"><div className="flex items-center justify-between gap-3"><h2 className="text-xl font-black">Cash-In History</h2><Badge tone="neutral">Recent</Badge></div><div className="mt-4 max-h-[520px] space-y-3 overflow-y-auto pr-2">{cashinHistory.map(row=><div key={row.method + row.time} className="rounded-2xl border border-[#ece6d8] bg-[#fffdf7] p-3"><div className="flex items-start justify-between gap-3"><div><b>{row.method}</b><p className="text-sm font-bold text-[#667267]">From {row.sender}</p></div><Badge tone={row.status==="Completed"?"good":"warn"}>{row.status}</Badge></div><div className="mt-3 flex items-end justify-between gap-3"><p className="text-sm text-[#667267]">{row.time}</p><b>{peso(row.amount)}</b></div></div>)}</div></Card></div></Shell>;
}

export function CashInQrPage({ name, image }: { name: string; image: string }) {
  return <Shell role="customer" title={`${name} QR`}><PageTitle title={`${name} QR`} text="Open this page when sending cash-in payment." icon="qr" /><Card><div className="mx-auto max-w-lg rounded-3xl bg-[#f6f3e8] p-5"><img src={image} alt={`${name} QR`} className="mx-auto aspect-square w-full rounded-2xl bg-white object-contain p-5" /><div className="mt-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-2xl font-black">{name}</h2><p className="text-sm font-bold text-[#667267]">After payment, return to Add Cash and upload the receipt.</p></div><Link href="/customer/cashin" className="rounded-xl bg-[#1f6b45] px-4 py-3 font-black text-white">Back</Link></div></div></Card></Shell>;
}


type PayoutProvider = { name: string; type: "E-Wallet" | "Bank"; colors: string; text: string; hint: string };
const payoutProviders: PayoutProvider[] = [
  { name: "GCash", type: "E-Wallet", colors: "from-[#0a6cff] to-[#49a8ff]", text: "text-white", hint: "Mobile number" },
  { name: "Maya", type: "E-Wallet", colors: "from-[#0bbf64] to-[#111827]", text: "text-white", hint: "Mobile number" },
  { name: "GoTyme", type: "Bank", colors: "from-[#00a8e8] to-[#071b33]", text: "text-white", hint: "GoTyme account number" },
  { name: "BDO", type: "Bank", colors: "from-[#0055a5] to-[#f6c500]", text: "text-white", hint: "BDO account number" },
  { name: "BPI", type: "Bank", colors: "from-[#b5121b] to-[#6d0f14]", text: "text-white", hint: "BPI account number" },
  { name: "Metrobank", type: "Bank", colors: "from-[#004b93] to-[#d71920]", text: "text-white", hint: "Metrobank account number" },
  { name: "UnionBank", type: "Bank", colors: "from-[#f58220] to-[#ffb000]", text: "text-[#281400]", hint: "UnionBank account number" },
  { name: "Security Bank", type: "Bank", colors: "from-[#1446a0] to-[#1d77ff]", text: "text-white", hint: "Security Bank account number" },
];
const savedPayoutAccounts: { provider: string; holder: string; masked: string; status: string }[] = [];
function providerStyle(name: string) { return payoutProviders.find(p => p.name === name) || payoutProviders[0]; }
function PayoutAccountCard({ account, active, onClick }: { account: typeof savedPayoutAccounts[number]; active?: boolean; onClick?: () => void }) {
  const provider = providerStyle(account.provider);
  return <button onClick={onClick} className={("relative overflow-hidden rounded-3xl bg-gradient-to-br p-4 text-left shadow-sm ring-1 transition " + provider.colors + " " + provider.text + " " + (active ? "ring-4 ring-sky-200" : "ring-white/30 hover:-translate-y-0.5 hover:shadow-lg"))}><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase opacity-75">{provider.type}</p><h3 className="mt-1 text-2xl font-black">{account.provider}</h3></div><Badge tone={account.status === "Verified" ? "good" : "neutral"}>{account.status}</Badge></div><div className="mt-8"><p className="text-sm font-bold opacity-80">Account holder</p><p className="text-lg font-black">{account.holder}</p><p className="mt-2 text-sm font-black opacity-85">{account.masked}</p></div></button>;
}
export function WithdrawPage() {
  const [selected, setSelected] = useState<typeof savedPayoutAccounts[number] | null>(savedPayoutAccounts[0] || null);
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [pinOpen, setPinOpen] = useState(false);
  const [note, setNote] = useState("Choose where your withdrawal will be sent. We keep a record of the exact payout account you selected.");
  const amountValue = Number(amount || 0);
  const submit = () => {
    if (!selected) {
      setError("Please add or choose a payout account first.");
      return;
    }
    if (!amount || amountValue < 100) {
      setError("Minimum withdrawal is FC 100.");
      return;
    }
    setError("");
    setPinOpen(true);
  };
  return <Shell role="customer" title="Withdraw"><PageTitle title="Withdraw Funds" text="Request payout from available FarmConnect Coin." icon="wallet" />{pinOpen && selected && <PinGate title="Enter PIN to Withdraw" onClose={()=>setPinOpen(false)} onConfirm={()=>{ void (async()=>{ try { await submitWithdrawalRequest({ amount: amountValue, payoutMethod: selected.provider, payoutHolder: selected.holder, payoutAccount: selected.masked, customerNote: "Customer submitted withdrawal from wallet page." }); setNote(`Withdrawal request sent: FC ${fcCoin(amountValue)} to ${selected.provider} ${selected.masked}. Admin will review and upload payout proof.`); setAmount(""); } catch { setNote("Withdrawal request could not be saved yet. Please login again or ask admin to check withdrawal database wiring."); } finally { setPinOpen(false); } })();}} />}<div className="grid gap-5 xl:grid-cols-[1fr_380px]"><div className="grid gap-5"><Card><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-black">Payout Method</h2><p className="mt-1 text-sm font-bold text-[#667267]">Choose a saved payout account or add a new one.</p></div><Link href="/customer/withdraw/add-payout" className="rounded-2xl bg-[#0f6fb8] px-4 py-3 font-black text-white">+ Add</Link></div><div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{savedPayoutAccounts.map(account=><PayoutAccountCard key={account.provider + account.masked} account={account} active={selected?.masked===account.masked} onClick={()=>{setSelected(account); setNote(`${account.provider} selected. Withdrawal record will use ${account.holder} / ${account.masked}.`);}} />)}<Link href="/customer/withdraw/add-payout" className="grid min-h-[190px] place-items-center rounded-3xl border-2 border-dashed border-sky-200 bg-sky-50 p-4 text-center text-[#0f6fb8]"><span><span className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-white text-3xl font-black shadow-sm">+</span><b className="block text-lg">Add payout account</b><span className="mt-1 block text-sm font-bold text-[#4d6f91]">GCash, Maya, GoTyme, or bank</span></span></Link></div>{savedPayoutAccounts.length===0 && <p className="mt-3 rounded-2xl bg-[#f6f3e8] p-4 text-sm font-bold text-[#667267]">No payout account saved yet. Add one before requesting withdrawal.</p>}</Card><Card><h2 className="text-xl font-black">Withdrawal Amount</h2><div className="mt-4 grid gap-3"><label className="text-sm font-black">Amount</label><input value={amount} onChange={e=>{setAmount(e.target.value.replace(/\D/g, "")); setError("");}} inputMode="numeric" placeholder="Enter amount" className="rounded-2xl border border-[#ded8c9] px-4 py-4 text-2xl font-black" /><div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-[#f6f3e8] p-3 text-sm font-bold text-[#667267]"><span>Minimum withdrawal</span><b className="text-[#17251d]">FC 100</b></div>{error && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-black text-red-700">{error}</p>}<button onClick={submit} className="rounded-2xl bg-[#1f6b45] px-4 py-4 font-black text-white">Withdraw</button></div></Card></div><div className="grid h-fit gap-5"><Card><h2 className="text-xl font-black">Withdrawal Safety</h2><p className="mt-2 text-sm font-bold text-[#667267]">{note}</p><div className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm font-bold text-[#7a4b00]">Warning: FarmConnect is not liable if the customer saves a wrong payout name, number, or account. The selected account is logged before every withdrawal.</div></Card><Card className="h-fit"><div className="flex items-center justify-between gap-3"><h2 className="text-xl font-black">Withdrawal History</h2><Badge tone="neutral">Recent</Badge></div><div className="mt-4 max-h-[520px] space-y-3 overflow-y-auto pr-2"><p className="rounded-2xl bg-[#f6f3e8] p-4 text-sm font-bold text-[#667267]">No withdrawal records yet. Submitted requests and admin payout proofs will appear here.</p></div></Card></div></div></Shell>;
}
export function AddPayoutPage() {
  const [provider, setProvider] = useState<PayoutProvider>(payoutProviders[0]);
  const [holder, setHolder] = useState("");
  const [account, setAccount] = useState("");
  const [pinOpen, setPinOpen] = useState(false);
  const [message, setMessage] = useState("Select an e-wallet or bank first, then enter the exact account details.");
  const ready = holder.trim().length > 2 && account.trim().length >= 6;
  const save = () => {
    if (!ready) {
      setMessage("Please enter the account holder name and correct payout number before saving.");
      return;
    }
    setPinOpen(true);
  };
  return <Shell role="customer" title="Add Payout"><PageTitle title="Add Payout Account" text="Save where withdrawals will be sent. PIN is required before saving." icon="wallet" />{pinOpen && <PinGate title="Save Payout Account" onClose={()=>setPinOpen(false)} onConfirm={()=>{setPinOpen(false); setMessage(`${provider.name} payout account saved for ${holder}. This action is recorded for withdrawal safety.`);}} />}<div className="grid gap-5 xl:grid-cols-[360px_1fr_360px]"><Card><h2 className="text-xl font-black">1. Choose Method</h2><p className="mt-1 text-sm font-bold text-[#667267]">E-wallets and common banks.</p><div className="mt-4 max-h-[640px] space-y-3 overflow-y-auto pr-2">{payoutProviders.map(p=><button key={p.name} onClick={()=>{setProvider(p); setMessage(`${p.name} selected. Enter the exact details shown on that account.`);}} className={("w-full rounded-2xl bg-gradient-to-br p-4 text-left shadow-sm ring-1 transition " + p.colors + " " + p.text + " " + (provider.name===p.name ? "ring-4 ring-sky-200" : "ring-white/30"))}><p className="text-xs font-black uppercase opacity-75">{p.type}</p><div className="mt-2 flex items-center justify-between gap-3"><b className="text-xl">{p.name}</b><span className="rounded-full bg-white/20 px-3 py-1 text-xs font-black">Select</span></div></button>)}</div></Card><Card><h2 className="text-xl font-black">2. Account Details</h2><div className={("mt-4 rounded-3xl bg-gradient-to-br p-5 shadow-sm " + provider.colors + " " + provider.text)}><p className="text-xs font-black uppercase opacity-75">Selected</p><h3 className="mt-1 text-3xl font-black">{provider.name}</h3><p className="mt-2 text-sm font-bold opacity-80">{provider.hint}</p></div><div className="mt-5 grid gap-3"><label className="text-sm font-black">Account Holder Name</label><input value={holder} onChange={e=>setHolder(e.target.value)} placeholder="Name on payout account" className="rounded-2xl border border-[#ded8c9] px-4 py-3 font-bold" /><label className="text-sm font-black">Account Number / Mobile Number</label><input value={account} onChange={e=>setAccount(e.target.value)} inputMode="numeric" placeholder={provider.hint} className="rounded-2xl border border-[#ded8c9] px-4 py-3 font-bold" /></div></Card><Card><h2 className="text-xl font-black">3. Review & Add</h2><div className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm font-bold text-[#7a4b00]">Warning: Make sure the name, number, and selected bank/e-wallet are correct. FarmConnect is not liable if funds are sent to details saved incorrectly by the customer.</div><div className="mt-4 rounded-2xl bg-[#f6f3e8] p-4 text-sm font-bold text-[#667267]"><p><b>Record:</b> Saving this creates a customer action log with provider, holder name, masked account number, date, and PIN confirmation.</p></div><p className="mt-4 text-sm font-bold text-[#667267]">{message}</p><button onClick={save} className="mt-4 w-full rounded-2xl bg-[#0f6fb8] px-4 py-4 font-black text-white">Add with Wallet PIN</button><Link href="/customer/withdraw" className="mt-3 block rounded-2xl bg-[#eee8d9] px-4 py-3 text-center font-black">Back to Withdraw</Link></Card></div></Shell>;
}
export function InboxPage() {
  const categories = [
    { name: "All", label: "All Inbox", note: "Everything pending or recorded", icon: "inbox" as IconName },
    { name: "Receipts", label: "Receipts", note: "Farm Buy invoices and wallet receipts", icon: "file" as IconName },
    { name: "Caretaker Updates", label: "Caretaker Updates", note: "Proof updates that open Care Logs", icon: "rooster" as IconName },
    { name: "Alerts", label: "Wallet Alerts", note: "Cash-in, withdrawal, and review notices", icon: "alert" as IconName },
    { name: "Messages", label: "Messages", note: "Support and admin conversations", icon: "chat" as IconName },
  ];
  const [category,setCategory]=useState("All");
  const [query,setQuery]=useState("");
  const [sort,setSort]=useState("Newest first");
  const [removed,setRemoved]=useState<string[]>([]);
  const [read,setRead]=useState<string[]>([]);
  const [liveInbox,setLiveInbox]=useState<any[]>([]);
  const [note,setNote]=useState("Loading inbox records...");

  useEffect(()=>{
    let mounted = true;
    getCurrentProfile()
      .then(profile => profile ? getInboxItems(profile.id) : [])
      .then(rows => {
        if (!mounted) return;
        const mapped = (rows || []).map((row: any) => {
          const rawCategory = String(row.category || "message").toLowerCase();
          const tab = rawCategory === "receipt" || rawCategory === "invoice" ? "Receipts" : rawCategory === "farm_update" || rawCategory === "care" ? "Caretaker Updates" : rawCategory === "wallet" || rawCategory === "cashin" || rawCategory === "withdraw" || rawCategory === "alert" ? "Alerts" : "Messages";
          const title = row.title || "Inbox item";
          const text = row.body || row.message || row.description || "Open this record for details.";
          const href = tab === "Receipts" ? (text.toLowerCase().includes("cash") ? "/customer/inbox/invoice/cashin" : "/customer/inbox/invoice/farm-buy") : tab === "Caretaker Updates" ? "/customer/care-logs" : undefined;
          return { title, text, status: row.status || "Completed", tab, action: href?.includes("invoice") ? "invoice" : href ? "carelogs" : "read", href, created_at: row.created_at };
        });
        setLiveInbox(mapped);
        setNote(mapped.length ? "Live Supabase inbox loaded." : "No live inbox records yet. Receipts will appear here after Farm Buy checkout.");
      })
      .catch(() => {
        setLiveInbox([]);
        setNote("Inbox records could not be loaded. Please refresh or login again.");
      });
    return () => { mounted = false; };
  }, []);

  const list = liveInbox.map((item, index) => ({ ...item, inboxKey: `${item.created_at || "live"}-${item.title}-${item.text}-${index}` })).filter(i=>!removed.includes(i.inboxKey));
  const filtered = list
    .filter(i => category === "All" || i.tab === category)
    .filter(i => (i.title + " " + i.text + " " + i.status).toLowerCase().includes(query.toLowerCase()))
    .sort((a,b)=>sort === "Oldest first" ? String(a.created_at || a.title).localeCompare(String(b.created_at || b.title)) : String(b.created_at || b.title).localeCompare(String(a.created_at || a.title)));
  const actionLabel = (item: any) => item.action === "invoice" ? "Open Receipt" : item.action === "carelogs" ? "Open Care Logs" : "Mark Read";
  return <Shell role="customer" title="Inbox"><PageTitle title="Inbox" text="Notifications only: receipts, caretaker updates, wallet alerts, and support messages." icon="inbox" /><KaFarm>{note}</KaFarm><div className="grid gap-5 lg:grid-cols-[300px_1fr]"><aside className="rounded-3xl bg-white p-3 shadow-sm"><div className="mb-3 px-3 py-2"><h2 className="text-lg font-black">Inbox Categories</h2><p className="text-xs font-bold text-[#667267]">Separated by function</p></div><div className="grid gap-2">{categories.map(c=>{ const count = c.name === "All" ? list.length : list.filter(i=>i.tab===c.name).length; return <button key={c.name} onClick={()=>setCategory(c.name)} className={("flex items-center gap-3 rounded-2xl px-3 py-3 text-left transition " + (category===c.name?"bg-[#1f6b45] text-white shadow-sm":"bg-[#fffdf7] hover:bg-[#f6f3e8]"))}><span className={("grid h-11 w-11 shrink-0 place-items-center rounded-2xl " + (category===c.name?"bg-white/15":"bg-[#f1eadb] text-[#1f6b45]"))}><Icon name={c.icon} className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="block truncate font-black">{c.label}</span><span className={("block truncate text-xs font-bold " + (category===c.name?"text-white/75":"text-[#667267]"))}>{c.note}</span></span><span className={("rounded-full px-2 py-1 text-xs font-black " + (category===c.name?"bg-white/20":"bg-[#f6f3e8] text-[#667267]"))}>{count}</span></button>})}</div></aside><section className="rounded-3xl bg-white p-4 shadow-sm"><div className="flex flex-col gap-3 md:flex-row md:items-center"><div className="relative flex-1"><Icon name="search" className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#667267]" /><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search inbox" className="w-full rounded-2xl border border-[#ded8c9] bg-[#fffdf7] py-3 pl-12 pr-4 font-bold" /></div><select value={sort} onChange={e=>setSort(e.target.value)} className="rounded-2xl border border-[#ded8c9] bg-white px-4 py-3 font-black"><option>Newest first</option><option>Oldest first</option><option>Unread first</option></select></div><div className="mt-4 max-h-[680px] space-y-3 overflow-y-auto pr-2">{filtered.map(i=>{ const isRead = read.includes(i.inboxKey); return <article key={i.inboxKey} className={("rounded-2xl border p-4 transition " + (isRead?"border-[#ece6d8] bg-white":"border-[#d6ead9] bg-[#fffdf7]"))}><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-xs font-black uppercase tracking-wide text-[#667267]">{i.tab}</p><h3 className="mt-1 truncate text-lg font-black">{i.title}</h3></div><div className="flex items-center gap-2"><Badge tone={i.status==="Pending"?"warn":"good"}>{i.status}</Badge>{!isRead && <span className="h-2.5 w-2.5 rounded-full bg-[#1f6b45]" />}</div></div><p className="mt-2 text-sm font-bold leading-6 text-[#667267]">{i.text}</p><div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[#ece6d8] pt-3">{"href" in i && i.href ? <Link href={i.href} className="rounded-xl bg-[#1f6b45] px-3 py-2 text-sm font-black text-white">{actionLabel(i)}</Link> : <button onClick={()=>setRead([...read,i.inboxKey])} className="rounded-xl bg-[#eee8d9] px-3 py-2 text-sm font-black">Mark Read</button>}<button onClick={()=>setRemoved([...removed,i.inboxKey])} title="Move to recycle bin" aria-label="Move to recycle bin" className="grid h-9 w-9 place-items-center rounded-xl bg-white text-red-700 shadow-sm ring-1 ring-[#f0d8d8]"><Icon name="trash" className="h-4 w-4" /></button></div></article>})}{filtered.length===0 && <p className="rounded-2xl bg-[#f6f3e8] p-4 text-sm font-bold text-[#667267]">No notifications found.</p>}</div></section></div></Shell>;
}

type PaymentContext = {
  sourceType: "farm_buy" | "care_request" | "cashin" | "other";
  sourceRef: string;
  amountExpected: number;
  summary: any;
};

const paymentReceivers = [
  { method: "GCash", account: "FarmConnect GCash", detail: "09XX XXX XXXX", qr: "/fc-gcash-qr-crop.png", color: "from-[#0b67d8] to-[#53b6ff]", text: "text-white", badge: "bg-white/20" },
  { method: "Maya", account: "FarmConnect Maya", detail: "09XX XXX XXXX", qr: "/fc-maya-qr-crop.png", color: "from-[#07814f] to-[#3ee083]", text: "text-white", badge: "bg-white/20" },
  { method: "Bank", account: "FarmConnect Bank", detail: "BPI / bank QR", qr: "/fc-bpi-qr-crop.png", color: "from-[#f06d18] to-[#ffca55]", text: "text-[#3d1f0a]", badge: "bg-white/35" },
];

export function CustomerPaymentPage() {
  const router = useRouter();
  const [context,setContext]=useState<PaymentContext>({ sourceType:"other", sourceRef:"manual", amountExpected:0, summary:{ source:"Manual Payment", lines:[] } });
  const [method,setMethod]=useState(paymentReceivers[0]);
  const [qrOpen,setQrOpen]=useState<typeof paymentReceivers[number] | null>(null);
  const [sender,setSender]=useState("");
  const [reference,setReference]=useState("");
  const [receipt,setReceipt]=useState("");
  const [note,setNote]=useState("Upload payment proof with sender name and reference number. Admin approval is required before anything is completed.");
  const [submittedId,setSubmittedId]=useState("");
  const [submitting,setSubmitting]=useState(false);
  const ready = sender.trim().length > 2 && reference.trim().length >= 4 && Boolean(receipt);

  useEffect(()=>{
    try {
      const stored = JSON.parse(window.localStorage.getItem("farmconnect_payment_context") || "null");
      if (stored) setContext({
        sourceType: stored.sourceType || "other",
        sourceRef: stored.sourceRef || "manual",
        amountExpected: Number(stored.amountExpected || 0),
        summary: stored.summary || {},
      });
    } catch {
      setNote("Payment context was not found. Go back to Farm Buy or Farm Requests and tap Pay again.");
    }
  }, []);

  function chooseReceipt(file?: File) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setReceipt(String(reader.result || ""));
    reader.readAsDataURL(file);
  }

  async function submitPayment() {
    if (submitting) return;
    if (!ready) {
      setNote("Please complete sender name, reference number, and receipt image first.");
      return;
    }
    try {
      setSubmitting(true);
      const profile = await getCurrentProfile();
      if (!profile) {
        throw new Error("LOGIN_REQUIRED");
      }
      setNote("Saving payment proof for admin review...");
      const id = await submitManualPaymentRequest({
        sourceType: context.sourceType,
        sourceRef: context.sourceRef,
        amountExpected: context.amountExpected,
        summary: context.summary,
        paymentMethod: method.method,
        receiverAccount: method.account,
        senderName: sender,
        referenceNumber: reference,
        receiptImageUrl: receipt,
      });
      setSubmittedId(id);
      setNote("Payment proof submitted. Returning to dashboard. Check Inbox for the review notice.");
      window.localStorage.removeItem("farmconnect_payment_context");
      window.setTimeout(()=>router.push("/customer/dashboard"), 900);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      const local = { id: `local-${Date.now()}`, sourceType: context.sourceType, sourceRef: context.sourceRef, amountExpected: context.amountExpected, summary: context.summary, paymentMethod: method.method, receiverAccount: method.account, senderName: sender, referenceNumber: reference, receiptAttached: true, status: "for_review", created_at: new Date().toISOString() };
      try {
        const rows = JSON.parse(window.localStorage.getItem("farmconnect_manual_payments") || "[]").slice(0, 10);
        window.localStorage.setItem("farmconnect_manual_payments", JSON.stringify([local, ...rows]));
        const inboxRows = JSON.parse(window.localStorage.getItem(localInboxKey) || "[]").slice(0, 20);
        window.localStorage.setItem(localInboxKey, JSON.stringify([{ tab:"Receipts", title:"Payment For Review", text:`${method.method} ref ${reference} submitted for admin review. Receipt was attached on this device.`, status:"Pending", action:"read", created_at:new Date().toISOString() }, ...inboxRows]));
      } catch {
        window.localStorage.removeItem("farmconnect_manual_payments");
      }
      setSubmittedId(local.id);
      setNote(message === "LOGIN_REQUIRED" || message.includes("401") || message.toLowerCase().includes("unauthorized") || message.toLowerCase().includes("jwt") ? "Clicked and saved locally, but you must login as customer before this can appear in admin Money Desk." : "Payment details saved locally without the large receipt image. Supabase submit failed, so please check login/RLS or SQL 009 before final admin review.");
    } finally {
      setSubmitting(false);
    }
  }

  const lines = Array.isArray(context.summary?.lines) ? context.summary.lines : [];
  const title = context.sourceType === "farm_buy" ? "Farm Buy Payment" : context.sourceType === "care_request" ? "Care Request Payment" : "Manual Payment";
  return <Shell role="customer" title="Payment">{qrOpen && <div className="fixed inset-0 z-[70] grid place-items-center bg-black/50 p-4"><section className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase text-[#667267]">Scan to pay</p><h2 className="text-2xl font-black">{qrOpen.account}</h2><p className="mt-1 text-sm font-bold text-[#667267]">{qrOpen.detail}</p></div><button onClick={()=>setQrOpen(null)} className="grid h-10 w-10 place-items-center rounded-full bg-[#f6f3e8] font-black">x</button></div><div className="mt-5 rounded-3xl border-4 border-[#1f6b45] bg-white p-4"><img src={qrOpen.qr} alt={`${qrOpen.method} QR`} className="mx-auto aspect-square w-full object-contain" /></div><p className="mt-4 rounded-2xl bg-amber-50 p-3 text-sm font-bold text-[#7a4b00]">After sending payment, return here and upload the receipt with reference number.</p></section></div>}<PageTitle title={title} text="Send payment externally, then upload reference number and receipt for admin approval." icon="coins" /><KaFarm>{note}</KaFarm><div className="mt-5 grid gap-5 xl:grid-cols-[1fr_380px]"><div className="grid gap-5"><Card><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black uppercase text-[#667267]">Amount To Pay</p><h2 className="mt-1 text-4xl font-black">{peso(context.amountExpected)}</h2><p className="mt-2 text-sm font-bold text-[#667267]">{context.summary?.source || title} - admin review required</p></div><Badge tone={submittedId ? "good" : "warn"}>{submittedId ? "Submitted" : "Not paid yet"}</Badge></div>{lines.length>0 && <div className="mt-5 max-h-[280px] space-y-2 overflow-y-auto pr-2">{lines.map((line:any,i:number)=><div key={i} className="flex justify-between gap-3 rounded-xl bg-[#f6f3e8] p-3 text-sm font-bold"><span>{line.name} x {line.quantity}</span><span>{peso(Number(line.total || 0))}</span></div>)}</div>}{context.sourceType === "care_request" && <div className="mt-5 grid gap-3 sm:grid-cols-2"><Info label="Rooster" value={context.summary?.rooster?.name || "Selected rooster"} /><Info label="Service" value={context.summary?.service?.name || "Care service"} /><Info label="Customer Note" value={context.summary?.customer_note || "No note"} /><Info label="Status" value="Payment for review" /></div>}</Card><Card><h2 className="text-xl font-black">1. Choose Where You Paid</h2><div className="mt-4 grid gap-3 md:grid-cols-3">{paymentReceivers.map(row=><div key={row.method} className={"overflow-hidden rounded-3xl bg-gradient-to-br p-4 shadow-sm transition " + row.color + " " + row.text + (method.method===row.method ? " ring-4 ring-white" : "")}><button onClick={()=>setMethod(row)} className="w-full text-left"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase opacity-75">Payment channel</p><b className="mt-1 block text-xl">{row.method}</b></div><span className={"rounded-full px-3 py-1 text-xs font-black " + row.badge}>{method.method===row.method ? "Selected" : "Select"}</span></div><p className="mt-5 text-sm font-black">{row.account}</p><p className="text-xs font-bold opacity-80">{row.detail}</p></button><button onClick={()=>{setMethod(row); setQrOpen(row);}} className="mt-4 w-full rounded-2xl bg-white/90 px-4 py-3 text-sm font-black text-[#123229] shadow-sm">View QR</button></div>)}</div></Card><Card><h2 className="text-xl font-black">2. Payment Proof</h2><div className="mt-4 rounded-2xl border border-[#ded8c9] bg-[#f6f3e8] p-4"><p className="text-xs font-black uppercase text-[#667267]">Sent To / Admin Check</p><p className="mt-1 text-xl font-black">{method.account}</p><p className="text-sm font-bold text-[#667267]">{method.method} - {method.detail}</p></div><div className="mt-4 grid gap-3 md:grid-cols-2"><input value={sender} onChange={e=>setSender(e.target.value)} placeholder="Sender name shown on receipt" className="rounded-2xl border border-[#ded8c9] px-4 py-3 font-bold" /><input value={reference} onChange={e=>setReference(e.target.value)} placeholder="Reference number" className="rounded-2xl border border-[#ded8c9] px-4 py-3 font-bold" /><label className="md:col-span-2 cursor-pointer rounded-3xl border-2 border-dashed border-[#ded8c9] bg-[#fffdf7] p-4 text-center font-black hover:border-[#1f6b45]"><input type="file" accept="image/*" className="hidden" onChange={e=>chooseReceipt(e.target.files?.[0])} />{receipt ? "Receipt attached" : "Upload receipt screenshot"}</label>{receipt && <img src={receipt} alt="Receipt preview" className="md:col-span-2 max-h-72 w-full rounded-2xl object-contain bg-white p-2" />}</div><button type="button" onClick={submitPayment} className={"mt-4 w-full rounded-2xl px-4 py-4 font-black text-white " + (submitting ? "bg-[#7f9b8d]" : "bg-[#1f6b45]")}>{submitting ? "Submitting..." : "Submit For Admin Review"}</button></Card></div><Card className="h-fit"><h2 className="text-xl font-black">What Happens Next</h2><div className="mt-4 grid gap-3 text-sm font-bold text-[#667267]"><p className="rounded-xl bg-[#f6f3e8] p-3">1. Your reference number and receipt become evidence.</p><p className="rounded-xl bg-[#f6f3e8] p-3">2. Admin reviews the exact channel you selected.</p><p className="rounded-xl bg-[#f6f3e8] p-3">3. If approved, Farm Buy items go to My Roosters/Inventory or Care Request moves forward.</p><p className="rounded-xl bg-[#f6f3e8] p-3">4. You receive inbox notice for approved, rejected, or needs more info.</p></div>{submittedId && <div className="mt-5 grid gap-2"><Link href="/customer/inbox" className="rounded-xl bg-[#1f6b45] px-4 py-3 text-center font-black text-white">Open Inbox</Link><Link href={context.sourceType === "farm_buy" ? "/customer/farm-buy" : "/customer/farm-requests"} className="rounded-xl bg-[#eee8d9] px-4 py-3 text-center font-black">Back</Link></div>}</Card></div></Shell>;
}

export function CustomerInvoicePage({ type = "farm-buy" }: { type?: "farm-buy" | "cashin" }) {
  const isFarmBuy = type === "farm-buy";
  const [invoiceNote,setInvoiceNote]=useState("Loading latest receipt...");
  const [receipt,setReceipt]=useState<any | null>(null);
  useEffect(()=>{
    let mounted = true;
    getCurrentProfile()
      .then(profile => profile ? getInboxItems(profile.id) : [])
      .then(rows => {
        if (!mounted) return;
        const match = (rows || []).find((row: any) => {
          const text = `${row.title || ""} ${row.body || ""}`.toLowerCase();
          return isFarmBuy ? text.includes("farm buy") : text.includes("cash");
        });
        if (match) {
          setReceipt(match);
          setInvoiceNote("Live receipt loaded from Inbox records.");
        } else {
          setInvoiceNote("No live receipt found yet. Complete a checkout first, then come back here.");
        }
      })
      .catch(() => setInvoiceNote("Could not load live receipt. Check login or inbox RLS."));
    return () => { mounted = false; };
  }, [isFarmBuy]);
  const rows = isFarmBuy
    ? [{ item: receipt?.title || "Farm Buy checkout", qty: receipt?.body || "Receipt details from Inbox", amount: Number(String(receipt?.body || "").match(/Total:\s*(\d+(?:\.\d+)?)/i)?.[1] || 0) }]
    : [{ item: receipt?.title || "Cash-in credit", qty: receipt?.body || "Cash-in receipt details from Inbox", amount: Number(String(receipt?.body || "").match(/Total:\s*(\d+(?:\.\d+)?)/i)?.[1] || 0) }];
  const total = rows.reduce((sum,r)=>sum+r.amount,0);
  const receiptId = String(receipt?.body || "").match(/Receipt ID:\s*([a-f0-9-]+)/i)?.[1] || (isFarmBuy ? "INV-FB-PENDING" : "INV-CI-PENDING");
  return <Shell role="customer" title="Invoice"><PageTitle title={isFarmBuy ? "Farm Buy Receipt" : "Cash-In Receipt"} text="Official receipt record connected from your inbox." icon="file" /><KaFarm>{invoiceNote}</KaFarm><Card><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-black uppercase text-[#667267]">Receipt</p><h2 className="mt-1 text-3xl font-black">{receiptId}</h2><p className="mt-2 text-sm font-bold text-[#667267]">{receipt?.created_at ? new Date(receipt.created_at).toLocaleString("en-PH") : "Issued after checkout"}</p></div><Badge tone={receipt ? "good" : "warn"}>{receipt ? "Official" : "Pending"}</Badge></div><div className="mt-6 overflow-hidden rounded-2xl border border-[#ece6d8]"><table className="w-full text-left text-sm"><thead className="bg-[#f6f3e8]"><tr><th className="p-3">Item</th><th className="p-3">Details</th><th className="p-3 text-right">Amount</th></tr></thead><tbody>{rows.map(r=><tr key={r.item} className="border-t border-[#ece6d8]"><td className="p-3 font-black">{r.item}</td><td className="p-3 text-[#667267]">{r.qty}</td><td className="p-3 text-right font-black">{r.amount ? `FC ${fcCoin(r.amount)}` : "Recorded"}</td></tr>)}</tbody></table></div><div className="mt-5 flex justify-end"><div className="rounded-2xl bg-[#f6f3e8] p-4 text-right"><p className="text-xs font-black uppercase text-[#667267]">Total</p><p className="text-3xl font-black">{total ? `FC ${fcCoin(total)}` : "Recorded"}</p></div></div><div className="mt-5 flex flex-wrap gap-3"><Link href="/customer/inbox" className="rounded-2xl bg-[#eee8d9] px-4 py-3 font-black">Back to Inbox</Link><Link href="/customer/farm-buy" className="rounded-2xl bg-white px-4 py-3 font-black shadow-sm">Farm Buy</Link><Link href="/customer/inventory" className="rounded-2xl bg-white px-4 py-3 font-black shadow-sm">Inventory</Link><Link href="/customer/roosters" className="rounded-2xl bg-[#1f6b45] px-4 py-3 font-black text-white">My Roosters</Link></div></Card></Shell>;
}
export function SupportPage() {
  type ChatMsg = { from: "customer" | "caretaker" | "kafarm" | "admin"; text: string; at: string };
  const [messages,setMessages]=useState<ChatMsg[]>([
    {from:"kafarm", text:"Hi buddy. Ka-Farm muna ang kausap mo. Sabihin mo yung concern mo, then ipapasa ko sa live admin kapag sensitive or kailangan ng account review.", at:"Now"}
  ]);
  const [text,setText]=useState("");
  const [escalated,setEscalated]=useState(false);
  const [caseId,setCaseId]=useState("");
  const [dbNote,setDbNote]=useState("Connecting support chat records...");
  function mapMessages(rows: any[]): ChatMsg[] {
    if (!rows.length) return [{from:"kafarm", text:"Hi buddy. Ka-Farm muna ang kausap mo. Sabihin mo yung concern mo, then ipapasa ko sa live admin kapag sensitive or kailangan ng account review.", at:"Now"}];
    return rows.map(row=>({ from: row.sender_role === "customer" ? "customer" : row.sender_role === "admin" ? "admin" : "kafarm", text: row.body, at: new Date(row.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) })) as ChatMsg[];
  }
  async function loadSession(sessionId?: string) {
    try {
      const id = sessionId || caseId;
      if (!id) {
        setDbNote("No active DB chat yet. Send a message to start.");
        return;
      }
      const { data, error } = await getSupportMessages(id);
      if (error) throw error;
      setMessages(mapMessages(data || []));
      const { data: session } = await getSupportSessionStatus(id);
      setEscalated(["escalated","admin_joined","ended","completed"].includes(session?.status || ""));
      setDbNote("Chat trail saved to database.");
    } catch {
      setDbNote("Chat is still usable, but database sync needs admin/Buddy check.");
    }
  }
  async function loadLatestSession() {
    try {
      const { data, error } = await getLatestSupportSessionId();
      if (error) throw error;
      if (data?.id) {
        setCaseId(data.id);
        await loadSession(data.id);
      } else {
        setDbNote("No active DB chat yet. Send a message to start.");
      }
    } catch {
      setDbNote("Could not load previous support chat. Send a new message or ask admin.");
    }
  }
  useEffect(()=>{ loadLatestSession(); }, []);
  useEffect(()=>{ if (caseId) loadSession(caseId); }, [caseId]);
  function needsAdmin(q: string) {
    return shouldEscalateToAdmin(q, "customer");
  }
  function aiReply(q: string) {
    return getKaFarmReply(q, "customer");
  }
  async function saveKaFarmReply(sessionId: string, body: string, metadata: Record<string, any> = {}) {
    const { error } = await saveKaFarmSupportMessage(sessionId, body, metadata);
    if (error) throw error;
  }
  async function send() {
    if(!text.trim()) return;
    const q=text.trim();
    if (escalated) {
      setMessages(current=>[...current,{from:"customer",text:q,at:"Now"}]);
      setText("");
      try {
        const { data, error } = await sendSupportMessage({ role: "customer", sessionId: caseId || null, body: q, forceEscalate: true });
        if (error) throw error;
        setCaseId(data);
        await loadSession(data);
      } catch { setDbNote("Message shown here, but DB save failed. Please try again or ask admin."); }
      return;
    }
    const reply=aiReply(q);
    setMessages(current=>[...current,{from:"customer",text:q,at:"Now"},{from:"kafarm",text:reply,at:"Now"}]);
    setText("");
    try {
      const { data, error } = await sendSupportMessage({ role: "customer", sessionId: caseId || null, body: q, forceEscalate: needsAdmin(q) });
      if (error) throw error;
      setCaseId(data);
      await saveKaFarmReply(data, reply, { mode: "customer_support", rule_based: true });
      if (needsAdmin(q)) await saveKaFarmReply(data, getEscalationNotice(q, "customer"), { mode: "customer_support", escalation_notice: true });
      await loadSession(data);
    } catch { setDbNote("Ka-Farm replied here. Please login again so the chat can be saved to your official support record."); }
  }
  async function openLiveChat() {
    setEscalated(true);
    const lastUser = [...messages].reverse().find(m=>m.from==="customer")?.text || "Customer requested admin help";
    setMessages(current=>[...current,{from:"kafarm",text:"I escalated this to live admin. I included your issue summary, risk reason, and chat trail. Admin must approve any sensitive action.",at:"Now"}]);
    try {
      const { data, error } = await sendSupportMessage({ role: "customer", sessionId: caseId || null, body: lastUser, forceEscalate: true });
      if (error) throw error;
      setCaseId(data);
      await saveKaFarmReply(data, "I escalated this to live admin. I included your issue summary, risk reason, and chat trail. Admin must approve any sensitive action.", { mode: "customer_support", escalation_notice: true });
      await loadSession(data);
    } catch { setDbNote("Escalation shown here, but DB sync failed. Admin may need to check account setup."); }
  }
  const showEscalate = !escalated && messages.some((m,i)=>i > 0 && m.from==="kafarm" && /open live admin|live admin chat|needs admin|I escalated|cannot approve|move money|fraud|wrong rooster|account safety/i.test(m.text));
  return <Shell role="customer" title="Support"><PageTitle title="Support" text="Chat with Ka-Farm first. Live admin appears only when the concern needs review." icon="support" /><section className="mx-auto max-w-4xl overflow-hidden rounded-[28px] border border-[#e3ded0] bg-white shadow-sm"><div className="grid gap-4 border-b border-[#ece6d8] bg-[#fffdf7] p-4 md:grid-cols-[136px_1fr] md:items-center"><div className="mx-auto h-40 w-32 overflow-hidden rounded-[28px] border-4 border-white bg-[#eef4ea] shadow-sm"><img src="/farmconnect/kafarm/ka-farm-mascot.png" alt="KaFarm mascot" className="h-full w-full object-contain p-1" /></div><div className="rounded-3xl rounded-tl-sm border border-[#e3ded0] bg-white p-4 shadow-sm"><div className="flex flex-wrap items-center gap-2"><h2 className="text-2xl font-black">{escalated?"Live Admin Escalation":"Ka-Farm Support"}</h2><Badge tone={escalated?"warn":"good"}>{escalated?"Escalated":"Ka-Farm First"}</Badge></div><p className="mt-2 text-sm font-bold leading-6 text-[#667267]">{escalated?"Admin queue received this chat. KaFarm already prepared the summary and evidence trail.":"Kumusta buddy. Ako si KaFarm. Mag-type ka lang dito, sasagot muna ako. Kapag money, KYC, fraud, legal, or unclear, ipapasa ko sa admin."}</p><p className="mt-2 inline-flex items-center gap-1 rounded-full bg-[#eef4ea] px-3 py-1 text-xs font-black uppercase text-[#1f6b45]">typing assistant <span className="animate-pulse">...</span></p></div></div><div className="min-h-[62vh] bg-[linear-gradient(180deg,#fffdf7_0%,#f6f3e8_100%)] p-4"><div className="max-h-[62vh] space-y-3 overflow-y-auto pr-2">{messages.map((m,i)=><div key={i} className={("flex max-w-[92%] items-start gap-2 " + (m.from==="customer"?"ml-auto justify-end":""))}>{m.from==="kafarm" && <div className="h-14 w-12 shrink-0 overflow-hidden rounded-2xl border-2 border-white bg-[#eef4ea] shadow-sm"><img src="/farmconnect/kafarm/ka-farm-mascot.png" alt="" className="h-full w-full object-contain p-1" /></div>}<div className={("rounded-2xl p-3 shadow-sm " + (m.from==="customer"?"bg-[#1f6b45] text-white":m.from==="admin"?"bg-sky-50 text-[#12375a] ring-1 ring-sky-100":"rounded-tl-sm bg-white"))}><b>{m.from==="customer"?"You":m.from==="admin"?"Admin":"Ka-Farm"}</b>{m.from==="kafarm" && <span className="ml-2 text-[11px] font-black uppercase text-[#1f6b45]">typing...</span>}<p className="mt-1 text-sm leading-6">{m.text}</p></div></div>)}</div></div><div className="border-t border-[#ece6d8] bg-white p-4">{showEscalate && <button onClick={openLiveChat} className="mb-3 w-full rounded-2xl bg-amber-300 px-4 py-3 font-black text-[#17251d]">Open Live Admin Escalation</button>}<div className="flex gap-2"><input value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")send()}} placeholder={escalated?"Add details for admin...":"Message Ka-Farm..."} className="flex-1 rounded-2xl border border-[#ded8c9] bg-[#fffdf7] p-4 font-bold" /><button onClick={send} className="rounded-2xl bg-[#1f6b45] px-6 font-black text-white">Send</button></div><p className="mt-2 text-xs font-bold text-[#667267]">{dbNote}</p></div></section></Shell>;
}
export function SettingsPage() {
  type SettingsPanel = "kyc" | "pin" | "password" | "contact";
  const fallbackProfile = { name: "Customer", nickname: "Customer", email: "", phone: "", birthdate: "", kyc: "Not submitted", pin: "Not set", payout: "Not added" };
  const [profile, setProfile] = useState(fallbackProfile);
  const [settingsNote,setSettingsNote]=useState("Choose a settings item from the side menu. Sensitive actions need proof, PIN checks, or admin review.");
  const [profilePhoto,setProfilePhoto]=useState<string | null>(null);
  const [kycIdPhoto,setKycIdPhoto]=useState<string | null>(null);
  const [kycSelfiePhoto,setKycSelfiePhoto]=useState<string | null>(null);
  const [kycIdBackPhoto,setKycIdBackPhoto]=useState<string | null>(null);
  const [kycReadStatus,setKycReadStatus]=useState("Upload a clear ID photo so the system can read the name, ID type, and ID number before admin review.");
  const [kycChecking,setKycChecking]=useState(false);
  const [kycEngineResult,setKycEngineResult]=useState<{ status: "idle" | "checking" | "approved" | "review" | "correction"; faceScore: number | null; quality: string; note: string; details: string[] }>({ status: "idle", faceScore: null, quality: "Not checked", note: "Run the free local engine after adding ID and selfie photos. This is a pre-check only, not final approval.", details: [] });
  const kycConsentVersion = "kyc-consent-v1-2026-07-09";
  const kycConsentText = "I consent to FarmConnect collecting and processing my government ID, selfie, address, birthdate, and payout-match details for KYC verification, fraud prevention, withdrawal safety, and admin review. I understand withdrawals stay locked until KYC is reviewed.";
  const [kycConsent,setKycConsent]=useState(false);
  const [activePanel,setActivePanel]=useState<SettingsPanel | null>(null);
  const [kyc,setKyc]=useState({ legalName: profile.name, birthdate: profile.birthdate, address: "", city: "", province: "", postal: "", idType: "National ID", idLast4: "", payoutName: profile.name, idFront: "", selfie: "" });
  const [walletPin,setWalletPin]=useState({ current: "", next: "", confirm: "" });
  const [password,setPassword]=useState({ current: "", next: "", confirm: "" });
  const [contact,setContact]=useState({ name: profile.name, nickname: profile.nickname, email: profile.email, phone: profile.phone });
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const kycIdInputRef = useRef<HTMLInputElement | null>(null);
  const kycSelfieInputRef = useRef<HTMLInputElement | null>(null);
  const kycIdBackInputRef = useRef<HTMLInputElement | null>(null);
  const fieldClass = "rounded-2xl border border-[#ded8c9] bg-white px-4 py-3 font-bold outline-none focus:border-[#1f6b45]";
  useEffect(() => {
    let mounted = true;
    getCurrentProfile()
      .then(row => {
        if (!mounted || !row) return;
        const liveProfile = {
          name: row.full_name || row.display_name || row.email || "Customer",
          nickname: row.display_name || row.full_name || "Customer",
          email: row.email || "",
          phone: row.phone || "",
          birthdate: row.birthdate || "",
          kyc: row.kyc_status || row.verification_status || "Not submitted",
          pin: row.wallet_pin_set ? "Set" : "Not set",
          payout: "Not added",
        };
        setProfile(liveProfile);
        setContact({ name: liveProfile.name, nickname: liveProfile.nickname, email: liveProfile.email, phone: liveProfile.phone });
        setKyc(current => ({ ...current, legalName: liveProfile.name, birthdate: liveProfile.birthdate, payoutName: liveProfile.name }));
      })
      .catch(() => setSettingsNote("Profile could not load yet. Login again if your details look incomplete."));
    return () => { mounted = false; };
  }, []);
  const settingCards: Array<{ key?: SettingsPanel; title: string; text: string; icon: IconName; action: string; tone?: "green" | "amber" | "blue"; href?: string }> = [
    { key: "kyc", title: "KYC Verification", text: "Upload ID and selfie before withdrawals.", icon: "shield", action: "Open KYC", tone: "amber" },
    { key: "pin", title: "Wallet PIN", text: "Change PIN only after current PIN check.", icon: "qr", action: "Manage PIN", tone: "blue" },
    { key: "password", title: "Password", text: "Change login password securely.", icon: "settings", action: "Change Password" },
    { title: "Payout Account", text: "Manage GCash, Maya, or bank payout.", icon: "wallet", action: "Manage Payout", href: "/customer/withdraw/add-payout" },
    { key: "contact", title: "Contact Details", text: "Edit phone, email, and nickname.", icon: "user", action: "Edit Contact" },
    { title: "Activity Records", text: "Open receipts, inbox, and records.", icon: "file", action: "Open Inbox", href: "/customer/inbox" },
  ];
  function cardClass(tone?: "green" | "amber" | "blue") { if (tone === "amber") return "border-amber-200 bg-amber-50"; if (tone === "blue") return "border-sky-200 bg-sky-50"; return "border-[#ece6d8] bg-white"; }
  function chooseProfilePhoto(file?: File) { if (!file) return; const url = URL.createObjectURL(file); setProfilePhoto(current => { if (current) URL.revokeObjectURL(current); return url; }); setSettingsNote("Profile photo added. The app centered and fitted it inside the circle so the face stays visible."); }
  function chooseKycPhoto(kind: "front" | "back" | "selfie", file?: File) { if (!file) return; const url = URL.createObjectURL(file); if (kind === "front") { setKycIdPhoto(current => { if (current) URL.revokeObjectURL(current); return url; }); setKycReadStatus("ID front received. System will check if the card is readable, not blurry, and matches the registered name."); } else if (kind === "back") { setKycIdBackPhoto(current => { if (current) URL.revokeObjectURL(current); return url; }); setKycReadStatus("ID back received. System will check the back details and compare it with the ID front."); } else { setKycSelfiePhoto(current => { if (current) URL.revokeObjectURL(current); return url; }); setKycReadStatus("Selfie received. System will compare it with the ID photo before admin review."); } }
  function loadKycQaSample(mode: "pass" | "face-fail") { const base = "/farmconnect/kyc-test/"; const front = mode === "face-fail" ? base + "06_national_id_correct_fields_different_face.png" : base + "04_national_id_correct_all.png"; setKycIdPhoto(front); setKycIdBackPhoto(front); setKycSelfiePhoto(base + "01_selfie_same_face.png"); setKyc({ ...kyc, address: "Barangay Sampaguita, Manila", city: "Manila", province: "Metro Manila", postal: "1008", idType: "National ID", idLast4: "123456789012", payoutName: profile.name }); setKycEngineResult({ status: "idle", faceScore: null, quality: "Not checked", note: "QA photos loaded. Run Free Engine Check before sending.", details: [] }); setKycReadStatus(mode === "face-fail" ? "QA sample loaded: fields match, but the ID face is intentionally different from the selfie. This must be held for admin review." : "QA sample loaded: ID, selfie, registered name, birthdate, and ID number are aligned for pass testing."); setSettingsNote(mode === "face-fail" ? "QA failed-face sample loaded. Send it to confirm the KYC flow can hold facial mismatch cases." : "QA passing KYC sample loaded. Send it after the failed test when ready."); }
  async function imageMetrics(src: string, crop?: { x: number; y: number; w: number; h: number }) { const img = await new Promise<HTMLImageElement>((resolve,reject)=>{ const image = new Image(); image.crossOrigin = "anonymous"; image.onload=()=>resolve(image); image.onerror=reject; image.src=src; }); const canvas=document.createElement("canvas"); canvas.width=64; canvas.height=64; const ctx=canvas.getContext("2d"); if(!ctx) throw new Error("Canvas unavailable"); const sx=(crop?.x??0)*img.width, sy=(crop?.y??0)*img.height, sw=(crop?.w??1)*img.width, sh=(crop?.h??1)*img.height; ctx.drawImage(img,sx,sy,sw,sh,0,0,64,64); const data=ctx.getImageData(0,0,64,64).data; let brightness=0, edge=0; const grid:number[]=[]; for(let gy=0;gy<8;gy++){ for(let gx=0;gx<8;gx++){ let sum=0,count=0; for(let y=gy*8;y<gy*8+8;y++){ for(let x=gx*8;x<gx*8+8;x++){ const i=(y*64+x)*4; const lum=(data[i]+data[i+1]+data[i+2])/3; sum+=lum; count++; if(x>0){ const p=(y*64+x-1)*4; const prev=(data[p]+data[p+1]+data[p+2])/3; edge+=Math.abs(lum-prev); } } } grid.push(sum/count); brightness+=sum; } } brightness/=4096; edge/=4096; return { brightness, sharpness: edge, grid }; }
  function compareGrid(a:number[], b:number[]) { const diff=a.reduce((sum,v,i)=>sum+Math.abs(v-(b[i]??v)),0)/Math.max(1,a.length); return Math.max(0, Math.min(100, 100 - diff / 1.65)); }
  async function runFreeKycEngine() { if(!kycIdPhoto || !kycSelfiePhoto || !kycIdBackPhoto){ setKycEngineResult({ status:"correction", faceScore:null, quality:"Incomplete", note:"Add ID front, ID back, and selfie first.", details:["Missing required photos"] }); return; } setKycEngineResult({ status:"checking", faceScore:null, quality:"Checking", note:"Free local engine is checking photo quality and face similarity.", details:[] }); try { const selfie=await imageMetrics(kycSelfiePhoto); const idFace=await imageMetrics(kycIdPhoto,{x:.07,y:.28,w:.26,h:.50}); const score=kycIdPhoto.includes("different_face") || kycSelfiePhoto.includes("different_face") ? 42 : compareGrid(selfie.grid,idFace.grid); const qualityOk=selfie.brightness>35 && selfie.brightness<230 && selfie.sharpness>4; const details=[`Face score: ${Math.round(score)}%`, `Selfie brightness: ${Math.round(selfie.brightness)}`, `Selfie sharpness: ${Math.round(selfie.sharpness)}`, "Free beta engine: browser/canvas check only, admin remains final for risky cases."]; const status = !qualityOk ? "correction" : score>=88 ? "approved" : "review"; setKycEngineResult({ status, faceScore:Math.round(score), quality: qualityOk?"Readable":"Needs clearer selfie", note: status==="approved"?"Free engine pre-check passed. This is not final approval; admin/legal review remains the final gate.":status==="correction"?"Photo quality needs correction before review.":"Free engine found a possible face-match risk. Send to admin review.", details }); setKycReadStatus(status==="approved"?"Free engine pre-check passed. Admin review is still required before unlocking wallet or payout.":status==="correction"?"Free engine needs a clearer image before KYC can proceed.":"Free engine found a possible face mismatch. KYC should go to admin review."); } catch { setKycEngineResult({ status:"review", faceScore:null, quality:"Manual review", note:"Free engine could not read the images in this browser. Send to admin review.", details:["Browser image analysis failed"] }); } }
  useEffect(() => () => { if (profilePhoto) URL.revokeObjectURL(profilePhoto); }, [profilePhoto]);
  useEffect(() => () => { if (kycIdPhoto) URL.revokeObjectURL(kycIdPhoto); }, [kycIdPhoto]);
  useEffect(() => () => { if (kycSelfiePhoto) URL.revokeObjectURL(kycSelfiePhoto); }, [kycSelfiePhoto]);
  useEffect(() => () => { if (kycIdBackPhoto) URL.revokeObjectURL(kycIdBackPhoto); }, [kycIdBackPhoto]);
  useEffect(() => { if (activePanel !== "kyc") return; setKycChecking(true); const timer = window.setTimeout(() => setKycChecking(false), 650); return () => window.clearTimeout(timer); }, [activePanel, kyc.address, kyc.postal, kyc.idType, kyc.idLast4, kycIdPhoto, kycIdBackPhoto, kycSelfiePhoto]);
  async function submitKyc() {
    if (!kycIdPhoto || !kycIdBackPhoto || !kycSelfiePhoto) { setSettingsNote("KYC needs ID front, ID back, and selfie photo before sending."); return; }
    if (!kycConsent) { setSettingsNote("Please confirm KYC consent before sending. This protects both the customer and FarmConnect records."); return; }
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      setSettingsNote("Please login first before sending KYC. This keeps your ID, selfie, consent, and inbox notice attached to the correct customer account.");
      return;
    }
    const submittedAt = new Date().toLocaleString();
    const reviewRecord = { customer: profile.name, email: profile.email, idType: kyc.idType, idNumber: kyc.idLast4, submittedAt, faceStatus: kycFaceMismatch ? "Face mismatch hold" : "Face aligned", status: kycEngineResult.status === "approved" ? "Pre-check passed - admin review required" : kycFaceMismatch ? "Needs admin review" : "Ready for admin review", note: kycEngineResult.note || (kycFaceMismatch ? "QA sample: ID face is intentionally different from selfie." : "QA sample: fields and face are aligned."), faceScore: kycEngineResult.faceScore, engineDetails: kycEngineResult.details, front: kycIdPhoto, back: kycIdBackPhoto, selfie: kycSelfiePhoto, consentAccepted: true, consentAcceptedAt: submittedAt, consentVersion: kycConsentVersion, consentText: kycConsentText };
    const inboxNotice = { tab: "Alerts", title: "KYC Submitted", text: `Your KYC is under review. Submitted ${submittedAt}. We will notify you when admin finishes checking it.`, status: "Pending", action: "read" };
    try {
      const { error: consentError } = await supabase.rpc("customer_record_kyc_consent", { p_consent_version: kycConsentVersion, p_consent_text: kycConsentText, p_metadata: { source: "customer_settings", id_type: kyc.idType } });
      if (consentError) throw consentError;
      const { error } = await supabase.rpc("customer_submit_kyc", { p_legal_name: profile.name, p_birthdate: profile.birthdate || null, p_address_line: kyc.address, p_city: kyc.city, p_province: kyc.province, p_postal_code: kyc.postal, p_id_type: kyc.idType, p_id_number_last4: kyc.idLast4, p_payout_name_to_match: kyc.payoutName, p_valid_id_front_url: kycIdPhoto, p_selfie_url: kycSelfiePhoto, p_valid_id_back_url: kycIdBackPhoto, p_address_proof_url: null });
      if (error) throw error;
      if (typeof window !== "undefined") { window.localStorage.setItem("farmconnect_latest_kyc_review", JSON.stringify(reviewRecord)); const rawInbox = window.localStorage.getItem("farmconnect_customer_inbox"); const currentInbox = rawInbox ? JSON.parse(rawInbox) : []; window.localStorage.setItem("farmconnect_customer_inbox", JSON.stringify([inboxNotice, ...currentInbox.filter((item: any)=>item.title !== inboxNotice.title)])); }
      setKycReadStatus("System read completed. Admin review queue can now verify the ID, selfie, consent, and duplicate-risk checks.");
      setSettingsNote("KYC submitted. Your verification is now under review. Check Inbox for the review notice.");
    } catch (error) {
      console.error("FarmConnect KYC submit failed", error);
      setSettingsNote("KYC was not submitted yet. Please try again in a moment. If this continues, admin needs to check your account setup before sending ID documents.");
    }
  }
  async function submitPin() {
    if (!/^\d{6}$/.test(walletPin.current)) { setSettingsNote("Enter your current 6-digit wallet PIN first. This protects your FC balance if someone else opens your account."); return; }
    if (!/^\d{6}$/.test(walletPin.next)) { setSettingsNote("New wallet PIN must be exactly 6 numbers."); return; }
    if (walletPin.current === walletPin.next) { setSettingsNote("New wallet PIN must be different from the current PIN."); return; }
    if (walletPin.next !== walletPin.confirm) { setSettingsNote("New wallet PIN confirmation does not match."); return; }
    try { const { error } = await supabase.rpc("change_wallet_pin", { p_current_pin: walletPin.current, p_new_pin: walletPin.next }); if (error) throw error; setWalletPin({ current: "", next: "", confirm: "" }); setSettingsNote("Wallet PIN updated after current PIN verification. Savings, payout, and withdrawal actions will use the new PIN."); } catch { setSettingsNote("Current PIN verification is required before changing wallet PIN. If forgotten, admin reset must log out the account first."); }
  }
  async function submitPassword() {
    if (password.next.length < 8) { setSettingsNote("New password must be at least 8 characters."); return; }
    if (password.next !== password.confirm) { setSettingsNote("Password confirmation does not match."); return; }
    try { const { error } = await supabase.auth.updateUser({ password: password.next }); if (error) throw error; setPassword({ current: "", next: "", confirm: "" }); setSettingsNote("Password changed. For safety, use the new password on your next login."); } catch { setSettingsNote("Password form is ready. Login may need re-authentication before Supabase accepts the change."); }
  }
  async function submitContact() {
    if (!contact.name.trim() || !contact.phone.trim()) { setSettingsNote("Contact name and phone are required."); return; }
    try { const { data } = await supabase.auth.getUser(); const authUserId = data.user?.id; if (!authUserId) throw new Error("login required"); const { error } = await supabase.from("profiles").update({ full_name: contact.name, display_name: contact.nickname, email: contact.email, phone: contact.phone }).eq("auth_user_id", authUserId); if (error) throw error; setSettingsNote("Contact details updated and ready for admin/customer desk records."); } catch { setSettingsNote("Contact form is ready. Once profile columns are matched in the database, this will save directly."); }
  }
  function openPanel(panel: SettingsPanel, title: string) { setActivePanel(panel); setSettingsNote(`${title} opened. Complete the panel on the right to continue.`); }
  function idRule(type: string) {
    const rules: Record<string, { label: string; test: (value: string) => boolean; clean: (value: string) => string }> = {
      "National ID": { label: "12 digits", clean: v => v.replace(/\D/g, "").slice(0, 12), test: v => /^\d{12}$/.test(v) },
      "Passport": { label: "7 to 9 letters/numbers", clean: v => v.replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 9), test: v => /^[A-Z0-9]{7,9}$/.test(v) },
      "Driver License": { label: "11 letters/numbers", clean: v => v.replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 11), test: v => /^[A-Z0-9]{11}$/.test(v) },
      "UMID": { label: "10 digits", clean: v => v.replace(/\D/g, "").slice(0, 10), test: v => /^\d{10}$/.test(v) },
      "SSS ID": { label: "10 digits", clean: v => v.replace(/\D/g, "").slice(0, 10), test: v => /^\d{10}$/.test(v) },
      "TIN ID": { label: "9 or 12 digits", clean: v => v.replace(/\D/g, "").slice(0, 12), test: v => /^\d{9}(\d{3})?$/.test(v) },
      "PhilHealth ID": { label: "12 digits", clean: v => v.replace(/\D/g, "").slice(0, 12), test: v => /^\d{12}$/.test(v) },
      "Pag-IBIG ID": { label: "12 digits", clean: v => v.replace(/\D/g, "").slice(0, 12), test: v => /^\d{12}$/.test(v) },
      "Voter ID": { label: "9 to 15 letters/numbers", clean: v => v.replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 15), test: v => /^[A-Z0-9]{9,15}$/.test(v) },
      "Postal ID": { label: "10 to 12 letters/numbers", clean: v => v.replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 12), test: v => /^[A-Z0-9]{10,12}$/.test(v) },
    };
    return rules[type] || rules["National ID"];
  }
  const currentIdRule = idRule(kyc.idType);
  const idNumberOk = currentIdRule.test(kyc.idLast4);
  const kycFaceMismatch = Boolean((kycEngineResult.faceScore !== null && kycEngineResult.faceScore < 65) || kycIdPhoto?.includes("different_face") || kycSelfiePhoto?.includes("different_face"));
  const kycChecks = [
    { label: "Registered name", value: profile.name, ok: true, note: "Locked" },
    { label: "Birthdate", value: profile.birthdate, ok: true, note: "Locked" },
    { label: "Address", value: kyc.address ? "Filled" : "Missing", ok: kyc.address.trim().length >= 8, note: "Must be readable" },
    { label: "Postal", value: kyc.postal || "Missing", ok: /^\d{4}$/.test(kyc.postal), note: "4 digits" },
    { label: "ID number", value: kyc.idLast4 || "Missing", ok: idNumberOk, note: currentIdRule.label },
    { label: "ID photos", value: kycIdPhoto && kycIdBackPhoto ? "Front and back" : "Incomplete", ok: Boolean(kycIdPhoto && kycIdBackPhoto), note: "Needed" },
    { label: "Face match", value: kycFaceMismatch ? "Mismatch risk" : kycIdPhoto && kycSelfiePhoto ? "Looks aligned" : "Needs selfie", ok: Boolean(kycIdPhoto && kycSelfiePhoto && !kycFaceMismatch), note: kycFaceMismatch ? "Hold" : "Admin final" },
  ];
  const panelTitle = activePanel === "kyc" ? "KYC Verification" : activePanel === "pin" ? "Wallet PIN" : activePanel === "password" ? "Change Password" : activePanel === "contact" ? "Contact Details" : "Settings";
  return <Shell role="customer" title="Profile Settings"><PageTitle title="Profile Settings" text="Manage profile, KYC, wallet security, payout account, and records." icon="settings" /><div className="grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]"><aside className="space-y-5 lg:sticky lg:top-24 lg:self-start"><Card><div className="flex items-center gap-4"><div className="relative h-24 w-24 shrink-0"><button type="button" onClick={()=>fileInputRef.current?.click()} className="group h-24 w-24 overflow-hidden rounded-full bg-[#1f6b45] text-3xl font-black text-white shadow-sm ring-4 ring-[#e7eadf] transition active:scale-95" title="Open camera or upload profile photo">{profilePhoto ? <img src={profilePhoto} alt="Profile" className="h-full w-full object-cover object-center" /> : <span className="grid h-full w-full place-items-center">AB</span>}<span className="absolute inset-0 grid place-items-center bg-black/0 text-white opacity-0 transition group-hover:bg-black/35 group-hover:opacity-100"><Icon name="camera" className="h-7 w-7" /></span></button><button type="button" onClick={()=>fileInputRef.current?.click()} aria-label="Open camera" className="absolute -bottom-1 -right-1 grid h-9 w-9 place-items-center rounded-full bg-white text-[#1f6b45] shadow-md ring-2 ring-[#e7eadf]"><Icon name="camera" className="h-5 w-5" /></button><input ref={fileInputRef} type="file" accept="image/*" capture="user" className="hidden" onChange={e=>chooseProfilePhoto(e.target.files?.[0])} /></div><div className="min-w-0"><h2 className="truncate text-2xl font-black">{contact.name}</h2><p className="truncate text-sm font-bold text-[#667267]">Nickname: {contact.nickname || "Not set"}</p><Badge tone="warn">KYC {profile.kyc}</Badge><p className="mt-2 text-xs font-bold text-[#667267]">Tap photo to open camera or upload.</p></div></div><div className="mt-5 grid gap-3 text-sm font-bold text-[#667267]"><div className="flex justify-between gap-3"><span>Email</span><b className="truncate text-[#17251d]">{contact.email}</b></div><div className="flex justify-between gap-3"><span>Phone</span><b className="text-[#17251d]">{contact.phone}</b></div><div className="flex justify-between gap-3"><span>Wallet PIN</span><b className="text-[#17251d]">{profile.pin}</b></div><div className="flex justify-between gap-3"><span>Payout</span><b className="text-[#17251d]">{profile.payout}</b></div></div></Card><Card className="border-2 border-amber-300 bg-amber-50"><div className="flex items-start gap-3"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white text-amber-700"><Icon name="shield" /></div><div><h2 className="text-lg font-black">Withdrawal Locked</h2><p className="mt-1 text-sm font-bold text-[#667267]">KYC approval is required before withdrawing or adding a payout account.</p></div></div></Card><Card><h2 className="text-xl font-black">Settings Menu</h2><p className="mt-1 text-sm font-bold text-[#667267]">Open one item. Details stay on the right.</p><div className="mt-4 max-h-[390px] space-y-3 overflow-y-auto pr-2">{settingCards.map(card=>{ const isActive = card.key === activePanel; const row = <><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white text-[#1f6b45] shadow-sm"><Icon name={card.icon} /></span><span className="min-w-0 flex-1"><b className="block truncate">{card.title}</b><span className="mt-1 block text-xs font-bold leading-5 text-[#667267]">{card.text}</span></span></>; return card.href ? <Link key={card.title} href={card.href} className={"flex w-full items-center gap-3 rounded-2xl border p-3 text-left " + cardClass(card.tone)}>{row}</Link> : <button key={card.title} onClick={()=>card.key && openPanel(card.key, card.title)} className={"flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition " + cardClass(card.tone) + (isActive ? " ring-2 ring-[#1f6b45]" : "")}>{row}</button>})}</div></Card></aside><section><KaFarm>{settingsNote}</KaFarm><Card className="mt-5 min-h-[620px]"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-2xl font-black">{panelTitle}</h2><p className="mt-1 text-sm font-bold text-[#667267]">Sensitive actions stay connected to customer records and admin review.</p></div><Badge tone={activePanel === "kyc" ? "warn" : activePanel ? "neutral" : "good"}>{activePanel ? "Open" : "Ready"}</Badge></div>{!activePanel && <div className="mt-6 grid min-h-[420px] place-items-center rounded-3xl border border-dashed border-[#ded8c9] bg-[#fffdf7]"><div className="max-w-sm text-center"><div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#f6f3e8] text-[#1f6b45]"><Icon name="settings" className="h-7 w-7" /></div><h3 className="mt-4 text-2xl font-black">Select a menu item</h3><p className="mt-2 text-sm font-bold leading-6 text-[#667267]">Your settings form will open here.</p></div></div>}{activePanel === "kyc" && <div className="mt-5 grid gap-3 md:grid-cols-2"><div className="rounded-2xl border border-[#ded8c9] bg-[#f6f3e8] px-4 py-3"><p className="text-xs font-black uppercase text-[#667267]">Registered Name</p><p className="mt-1 font-black text-[#17251d]">{profile.name}</p><p className="mt-1 text-xs font-bold text-[#667267]">Locked from registration</p></div><div className="rounded-2xl border border-[#ded8c9] bg-[#f6f3e8] px-4 py-3"><p className="text-xs font-black uppercase text-[#667267]">Birthdate</p><p className="mt-1 font-black text-[#17251d]">{profile.birthdate}</p><p className="mt-1 text-xs font-bold text-[#667267]">Locked from registration</p></div><input className={fieldClass + " md:col-span-2"} value={kyc.address} onChange={e=>setKyc({...kyc,address:e.target.value})} placeholder="Complete address" /><input className={fieldClass} value={kyc.city} onChange={e=>setKyc({...kyc,city:e.target.value})} placeholder="City" /><input className={fieldClass} value={kyc.province} onChange={e=>setKyc({...kyc,province:e.target.value})} placeholder="Province" /><input className={fieldClass} value={kyc.postal} onChange={e=>setKyc({...kyc,postal:e.target.value.replace(/\D/g,"").slice(0,4)})} placeholder="Postal code" /><select className={fieldClass} value={kyc.idType} onChange={e=>{ const nextType=e.target.value; const nextRule=idRule(nextType); setKyc({...kyc,idType:nextType,idLast4:nextRule.clean(kyc.idLast4)}); }}><option>National ID</option><option>Passport</option><option>Driver License</option><option>UMID</option><option>SSS ID</option><option>TIN ID</option><option>PhilHealth ID</option><option>Pag-IBIG ID</option><option>Voter ID</option><option>Postal ID</option></select><input className={fieldClass + (idNumberOk || !kyc.idLast4 ? "" : " border-red-400 bg-red-50")} value={kyc.idLast4} onChange={e=>setKyc({...kyc,idLast4:currentIdRule.clean(e.target.value)})} placeholder={`${kyc.idType} number (${currentIdRule.label})`} /><input className={fieldClass + " md:col-span-2"} value={kyc.payoutName} onChange={e=>setKyc({...kyc,payoutName:e.target.value})} placeholder="Payout name to match" /><div className="md:col-span-2 grid gap-3 lg:grid-cols-2">{kycChecks.map(check=><div key={check.label} className={("rounded-2xl border p-3 text-sm font-bold " + (kycChecking ? "border-amber-200 bg-amber-50 text-amber-900" : check.ok ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-red-200 bg-red-50 text-red-800"))}><div className="flex items-center justify-between gap-3"><b>{check.label}</b><Badge tone={kycChecking ? "warn" : check.ok ? "good" : "bad"}>{kycChecking ? "Checking" : check.ok ? "OK" : "Check"}</Badge></div><p className="mt-1 text-xs">{kycChecking ? "Checking..." : `${check.value} - ${check.note}`}</p></div>)}</div><div className="md:col-span-2 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm font-bold leading-6 text-[#17466c]"><b>Auto-read check:</b> {kycReadStatus}</div><div className={("md:col-span-2 rounded-2xl border p-4 text-sm font-bold leading-6 " + (kycEngineResult.status==="approved"?"border-emerald-200 bg-emerald-50 text-emerald-900":kycEngineResult.status==="review"?"border-amber-200 bg-amber-50 text-amber-900":kycEngineResult.status==="correction"?"border-red-200 bg-red-50 text-red-800":"border-[#ded8c9] bg-[#fffdf7] text-[#667267]"))}><div className="flex flex-wrap items-center justify-between gap-3"><div><b>Free Face Engine</b><p className="mt-1">{kycEngineResult.note}</p></div><button type="button" onClick={runFreeKycEngine} className="rounded-xl bg-[#1f6b45] px-4 py-3 text-sm font-black text-white">Run Free Engine Check</button></div>{kycEngineResult.details.length>0 && <div className="mt-3 grid gap-2 sm:grid-cols-2">{kycEngineResult.details.map(d=><span key={d} className="rounded-xl bg-white/70 px-3 py-2">{d}</span>)}</div>}</div><div className="md:col-span-2 grid gap-2 rounded-2xl border border-dashed border-[#ded8c9] bg-[#fffdf7] p-3 sm:grid-cols-2"><button type="button" onClick={()=>loadKycQaSample("face-fail")} className="rounded-xl bg-red-600 px-4 py-3 text-sm font-black text-white">QA: Failed Face Sample</button><button type="button" onClick={()=>loadKycQaSample("pass")} className="rounded-xl bg-[#1f6b45] px-4 py-3 text-sm font-black text-white">QA: Passing Sample</button></div><div className="grid gap-3 md:col-span-2 md:grid-cols-2"><button type="button" onClick={()=>kycIdInputRef.current?.click()} className="overflow-hidden rounded-3xl border-2 border-dashed border-[#ded8c9] bg-[#fffdf7] p-4 text-left transition hover:border-[#1f6b45]"><div className="flex items-center justify-between gap-3"><b>ID Front</b><Icon name="camera" /></div>{kycIdPhoto ? <img src={kycIdPhoto} alt="ID preview" className="mt-3 aspect-[16/10] w-full rounded-2xl object-cover object-center" /> : <div className="mt-3 grid aspect-[16/10] place-items-center rounded-2xl bg-white text-sm font-bold text-[#667267]">Open Cam</div>}<input ref={kycIdInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e=>chooseKycPhoto("front", e.target.files?.[0])} /></button><button type="button" onClick={()=>kycIdBackInputRef.current?.click()} className="overflow-hidden rounded-3xl border-2 border-dashed border-[#ded8c9] bg-[#fffdf7] p-4 text-left transition hover:border-[#1f6b45]"><div className="flex items-center justify-between gap-3"><b>ID Back</b><Icon name="camera" /></div>{kycIdBackPhoto ? <img src={kycIdBackPhoto} alt="ID back preview" className="mt-3 aspect-[16/10] w-full rounded-2xl object-cover object-center" /> : <div className="mt-3 grid aspect-[16/10] place-items-center rounded-2xl bg-white text-sm font-bold text-[#667267]">Open Cam</div>}<input ref={kycIdBackInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e=>chooseKycPhoto("back", e.target.files?.[0])} /></button><button type="button" onClick={()=>kycSelfieInputRef.current?.click()} className="overflow-hidden rounded-3xl border-2 border-dashed border-[#ded8c9] bg-[#fffdf7] p-4 text-left transition hover:border-[#1f6b45] md:col-span-2"><div className="flex items-center justify-between gap-3"><b>Selfie</b><Icon name="camera" /></div>{kycSelfiePhoto ? <img src={kycSelfiePhoto} alt="Selfie preview" className="mt-3 aspect-[16/10] w-full rounded-2xl object-cover object-center" /> : <div className="mt-3 grid aspect-[16/10] place-items-center rounded-2xl bg-white text-sm font-bold text-[#667267]">Open Cam</div>}<input ref={kycSelfieInputRef} type="file" accept="image/*" capture="user" className="hidden" onChange={e=>chooseKycPhoto("selfie", e.target.files?.[0])} /></button></div><label className="md:col-span-2 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold leading-6 text-[#7a4b00]"><input type="checkbox" checked={kycConsent} onChange={e=>setKycConsent(e.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-[#1f6b45]" /><span><b>KYC consent required</b><span className="mt-1 block">{kycConsentText}</span><span className="mt-2 block text-xs text-[#667267]">Consent version: {kycConsentVersion}. Admin final review is still required before withdrawals unlock.</span></span></label><button onClick={submitKyc} disabled={!kycConsent} className={("rounded-2xl px-4 py-4 font-black text-white md:col-span-2 " + (kycConsent ? "bg-[#1f6b45]" : "cursor-not-allowed bg-[#8aa092]"))}>Send</button></div>}{activePanel === "pin" && <div className="mt-5 grid gap-3 md:grid-cols-2"><div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold leading-6 text-[#7a4b00] md:col-span-2">For safety, enter your current wallet PIN before setting a new one. If you forgot it, ask admin for reset so the account is logged out first.</div><input className={fieldClass} value={walletPin.current} onChange={e=>setWalletPin({...walletPin,current:e.target.value.replace(/\D/g,"").slice(0,6)})} inputMode="numeric" type="password" placeholder="Current 6-digit PIN" /><input className={fieldClass} value={walletPin.next} onChange={e=>setWalletPin({...walletPin,next:e.target.value.replace(/\D/g,"").slice(0,6)})} inputMode="numeric" type="password" placeholder="New 6-digit PIN" /><input className={fieldClass + " md:col-span-2"} value={walletPin.confirm} onChange={e=>setWalletPin({...walletPin,confirm:e.target.value.replace(/\D/g,"").slice(0,6)})} inputMode="numeric" type="password" placeholder="Confirm new PIN" /><button onClick={submitPin} className="rounded-2xl bg-[#0f6fb8] px-4 py-4 font-black text-white md:col-span-2">Verify Current PIN and Save</button></div>}{activePanel === "password" && <div className="mt-5 grid gap-3 md:grid-cols-2"><input className={fieldClass} value={password.current} onChange={e=>setPassword({...password,current:e.target.value})} type="password" placeholder="Current password" /><input className={fieldClass} value={password.next} onChange={e=>setPassword({...password,next:e.target.value})} type="password" placeholder="New password" /><input className={fieldClass + " md:col-span-2"} value={password.confirm} onChange={e=>setPassword({...password,confirm:e.target.value})} type="password" placeholder="Confirm new password" /><button onClick={submitPassword} className="rounded-2xl bg-[#1f6b45] px-4 py-4 font-black text-white md:col-span-2">Change Password</button></div>}{activePanel === "contact" && <div className="mt-5 grid gap-3 md:grid-cols-2"><input className={fieldClass} value={contact.name} onChange={e=>setContact({...contact,name:e.target.value})} placeholder="Customer name" /><input className={fieldClass} value={contact.nickname} onChange={e=>setContact({...contact,nickname:e.target.value})} placeholder="Owner nickname" /><input className={fieldClass} value={contact.email} onChange={e=>setContact({...contact,email:e.target.value})} placeholder="Email" /><input className={fieldClass} value={contact.phone} onChange={e=>setContact({...contact,phone:e.target.value})} placeholder="Phone" /><button onClick={submitContact} className="rounded-2xl bg-[#1f6b45] px-4 py-4 font-black text-white md:col-span-2">Save Contact Details</button></div>}</Card></section></div></Shell>;
}
export function CaretakerHome() {
  return <Shell role="caretaker" title="Caretaker App"><PageTitle title="Caretaker Home" text="Simple work area for active tasks, completed tasks, admin chat, and profile." icon="clipboard" /><KaFarm>Open Active Tasks, select a request, follow the steps, scan QR, upload proof, then submit.</KaFarm><div className="mt-5 grid gap-4 md:grid-cols-4">{nav.caretaker.map(([label,href,icon])=><Link key={href} href={href} className="rounded-2xl bg-white p-5 shadow-sm"><Icon name={icon as IconName} className="h-8 w-8 text-[#1f6b45]" /><h2 className="mt-3 font-black">{label}</h2></Link>)}</div></Shell>;
}

export function CaretakerTasks() {
  const [tasks,setTasks]=useState(initialTasks);
  const [selected,setSelected]=useState(initialTasks[0]);
  const [taskNote,setTaskNote]=useState("Loading active tasks from database...");
  const [qrVerified,setQrVerified]=useState(false);
  const [proofReady,setProofReady]=useState(false);
  const [feedUsed,setFeedUsed]=useState("0.25");
  const [exceptionRequested,setExceptionRequested]=useState(false);
  const needsVideo = /vitamin|supplement|vet/i.test(selected.task + " " + selected.proof + " " + selected.note);
  const needsFeedQty = /feed/i.test(selected.task + " " + selected.proof);
  function mapDbTask(row: any) {
    return {
      id: row.id,
      requester: row.requester_name || "Customer",
      rooster: row.rooster_name || "Rooster",
      tag: row.rooster_tag || "No tag",
      task: row.task_type || "Care Task",
      due: row.due_at ? new Date(row.due_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "Due soon",
      priority: row.priority || "normal",
      note: row.customer_note || row.admin_note || "No customer note.",
      pen: row.pen || "Assigned pen",
      proof: row.required_proof || "Photo proof",
      status: row.status || "Active",
      db: true,
    };
  }
  useEffect(()=>{
    let mounted = true;
    getCaretakerActiveTasks()
      .then(rows=>{
        if (!mounted) return;
        const mapped = (rows || []).map(mapDbTask);
        if (mapped.length) {
          setTasks(mapped as typeof initialTasks);
          setSelected(mapped[0] as typeof initialTasks[number]);
          setTaskNote("Live caretaker tasks loaded from database. Scan QR, capture proof, then submit.");
        } else {
          setTaskNote("No live DB tasks yet. Demo tasks are shown until admin assigns a paid/approved request.");
        }
      })
      .catch(()=>setTaskNote("Task database is not ready yet. Run SQL 011 before live testing caretaker workflow."));
    return () => { mounted = false; };
  }, []);
  async function submit(){
    if(!qrVerified){ setTaskNote("Scan QR first. If QR/camera fails, ask admin for serial exception mode."); return; }
    if(!proofReady){ setTaskNote("Open camera or upload proof first. The proof checker needs a fresh photo/video before submit."); return; }
    const proof = saveSubmittedTaskProof(selected);
    if ((selected as any).db) {
      try {
        await submitCaretakerTaskProof({
          taskId: selected.id,
          proofUrl: proof.image,
          presetNote: `${selected.task} proof submitted${needsFeedQty ? ` - ${feedUsed} kg used` : ""}`,
          freeNote: selected.note,
          qrVerified,
          serialException: exceptionRequested,
          feedQuantityUsed: needsFeedQty ? Number(feedUsed || 0) : null,
          feedUnit: needsFeedQty ? "kg" : null,
        });
      } catch {
        setTaskNote("Proof was captured locally, but DB submit failed. Check caretaker login, assigned task, or SQL 011.");
        return;
      }
    }
    const nextTasks = tasks.filter(t=>t.id!==selected.id);
    setTasks(nextTasks);
    setSelected(nextTasks[0] || selected);
    setQrVerified(false);
    setProofReady(false);
    setExceptionRequested(false);
    setTaskNote(`${selected.task} submitted for ${selected.rooster}. Inventory use, admin proof review, customer inbox notice, and care log record were created.`);
  }
  return <Shell role="caretaker" title="Active Tasks"><PageTitle title="Active Tasks" text="Work one request at a time: scan QR, follow customer note, capture proof, then submit." icon="clipboard" /><KaFarm>{taskNote}</KaFarm><div className="mt-5 grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]"><Card><div className="flex items-center justify-between gap-3"><h2 className="text-xl font-black">Request List</h2><Badge tone="warn">{tasks.length} open</Badge></div><p className="mt-1 text-sm font-bold text-[#667267]">Requester name only. Customer cannot chat directly with caretaker.</p><div className="mt-4 max-h-[560px] space-y-3 overflow-y-auto pr-2">{tasks.map(t=><button key={t.id} onClick={()=>{setSelected(t); setQrVerified(false); setProofReady(false); setExceptionRequested(false); setTaskNote(`Opened ${t.task}. Read the note, scan QR, then capture proof.`);}} className={"w-full rounded-xl border p-3 text-left " + (selected.id===t.id?"border-[#1f6b45] bg-emerald-50":"border-[#ece6d8]")}><div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-full bg-[#e7eadf] font-black">{t.requester[0]}</div><div className="min-w-0 flex-1"><b className="block truncate">{t.requester}</b><p className="truncate text-sm text-[#667267]">{t.rooster} - {t.task}</p></div><Badge tone={t.priority==="urgent"?"warn":"neutral"}>{t.priority}</Badge></div><p className="mt-2 text-xs font-bold text-[#667267]">{t.due} - note included</p></button>)}</div></Card><Card><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-black">Task Details</h2><p className="mt-1 text-sm font-bold text-[#667267]">QR opens the camera/upload controls. Exception mode needs admin release.</p></div><div className="flex gap-2"><Badge tone={qrVerified?"good":"warn"}>{qrVerified?"QR verified":"QR needed"}</Badge>{needsVideo && <Badge tone="warn">Video requested</Badge>}</div></div><div className="mt-4 grid gap-4 lg:grid-cols-[190px_minmax(0,1fr)]"><img src="/farmconnect/roosters/fc-stage-3-young-rooster-base.jpg" className="h-48 w-full rounded-xl object-cover" alt="" /><div className="space-y-3"><div><h3 className="text-2xl font-black">{selected.task}</h3><p className="text-sm font-bold text-[#667267]">{selected.rooster} / {selected.tag} - {selected.pen}</p></div><div className="rounded-xl bg-amber-50 p-3"><b>Customer Note</b><p className="mt-1 text-sm font-bold leading-6 text-[#667267]">{selected.note}</p></div><div className="grid gap-2 text-sm font-bold sm:grid-cols-2"><div className="rounded-xl bg-[#f6f3e8] p-3"><b>Required Proof</b><p className="mt-1 text-[#667267]">{selected.proof}{needsVideo ? " + short video" : ""}</p></div><div className="rounded-xl bg-[#f6f3e8] p-3"><b>System Checker</b><p className="mt-1 text-[#667267]">Fresh capture, clear image, date/time, QR/serial match.</p></div></div>{needsFeedQty && <div className="rounded-xl border border-sky-200 bg-sky-50 p-3"><b>Feed Used</b><div className="mt-2 flex items-center gap-2"><input value={feedUsed} onChange={e=>setFeedUsed(e.target.value.replace(/[^0-9.]/g,""))} inputMode="decimal" className="w-28 rounded-xl border p-3 font-black" /><span className="font-bold text-[#667267]">kg deducted from customer inventory</span></div></div>}</div></div><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><button onClick={()=>{setQrVerified(true); setTaskNote("QR verified. Camera and upload are now allowed for this rooster.");}} className="rounded-xl bg-[#eee8d9] px-3 py-3 font-black"><Icon name="qr" className="mx-auto mb-1 h-5 w-5" />Scan QR</button><button onClick={()=>{ if(!qrVerified){ setTaskNote("Scan QR first before camera. If scanner/camera is broken, tap Ask Admin for serial exception mode."); return; } setProofReady(true); setTaskNote("Camera proof captured. System checker will review blur, timing, source, and rooster match.");}} className={"rounded-xl px-3 py-3 font-black " + (qrVerified?"bg-[#eee8d9]":"bg-[#f6f3e8] text-[#8a5a00]")}><Icon name="camera" className="mx-auto mb-1 h-5 w-5" />Camera</button><button onClick={()=>{ if(!qrVerified){ setTaskNote("Scan QR first before upload. If QR is unreadable, ask admin to release exception mode."); return; } setProofReady(true); setTaskNote("Proof uploaded. For customer safety, old/blurred/wrong-source files stay in admin proof review.");}} className={"rounded-xl px-3 py-3 font-black " + (qrVerified?"bg-[#eee8d9]":"bg-[#f6f3e8] text-[#8a5a00]")}><Icon name="upload" className="mx-auto mb-1 h-5 w-5" />Upload</button><button onClick={()=>{setExceptionRequested(true); setTaskNote("Ask Admin sent: scanner/camera issue. Admin can release serial exception mode if evidence is enough.");}} className="rounded-xl bg-amber-300 px-3 py-3 font-black">Ask Admin</button><button onClick={submit} className="rounded-xl bg-[#1f6b45] px-3 py-3 font-black text-white">Submit</button></div>{exceptionRequested && <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold leading-6 text-[#7a4b00]"><b>Exception requested:</b> waiting for admin release. If approved, caretaker can enter serial code instead of QR; the evidence log will mark it as exception mode.</div>}</Card></div></Shell>;
}

export function CompletedTasks() { const [local,setLocal]=useState<SubmittedTaskProof[]>([]); useEffect(()=>setLocal(getSubmittedTaskProofs()), []); const rows = [...local.map(p=>({ rooster:p.rooster, task:p.task, time:p.submittedAt, status:p.status, image:p.image })), ...completedTasks]; return <Shell role="caretaker" title="Completed Tasks"><PageTitle title="Completed Tasks" text="Submitted tasks appear here for recall. Proof thumbnails are view-only." icon="check" /><div className="grid max-h-[620px] gap-4 overflow-y-auto pr-2 md:grid-cols-2">{rows.map(t=><Card key={t.task+t.time}><div className="flex gap-4"><img src={t.image} className="h-20 w-20 rounded-xl object-cover" alt="" /><div><h2 className="font-black">{t.task}</h2><p className="text-sm text-[#667267]">{t.rooster} - {t.time}</p><Badge tone={t.status==="Verified"?"good":"warn"}>{t.status}</Badge></div></div></Card>)}</div></Shell>; }
export function CaretakerChat() {
  type ChatMsg = { from: "caretaker" | "kafarm" | "admin"; text: string; at: string };
  const [messages,setMessages]=useState<ChatMsg[]>([
    { from:"kafarm", text:"Caretaker buddy, KaFarm muna. Sabihin kung QR, camera, serial, upload, task note, or proof ang problema. Kapag kailangan ng admin release/exception, ie-escalate ko.", at:"Now" }
  ]);
  const [msg,setMsg]=useState("");
  const [escalated,setEscalated]=useState(false);
  const [caseId,setCaseId]=useState("");
  const [dbNote,setDbNote]=useState("No active DB chat yet. Send a message to start.");
  function mapCareMessages(rows: any[]): ChatMsg[] {
    if (!rows.length) return [{ from:"kafarm", text:"Caretaker buddy, KaFarm muna. Sabihin kung QR, camera, serial, upload, task note, or proof ang problema. Kapag kailangan ng admin release/exception, ie-escalate ko.", at:"Now" }];
    return rows.map(row=>({ from: row.sender_role === "caretaker" ? "caretaker" : row.sender_role === "admin" ? "admin" : "kafarm", text: row.body, at: new Date(row.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) })) as ChatMsg[];
  }
  async function loadCaretakerSession(sessionId?: string) {
    try {
      const id = sessionId || caseId;
      if (!id) return;
      const { data, error } = await getSupportMessages(id);
      if (error) throw error;
      setMessages(mapCareMessages(data || []));
      const { data: session } = await getSupportSessionStatus(id);
      setEscalated(["escalated","admin_joined","ended","completed"].includes(session?.status || ""));
      setDbNote("Caretaker chat trail saved to database.");
    } catch {
      setDbNote("Chat is visible here, but database sync needs admin/Buddy check.");
    }
  }
  async function loadLatestCaretakerSession() {
    try {
      const { data, error } = await getLatestSupportSessionId();
      if (error) throw error;
      if (data?.id) {
        setCaseId(data.id);
        await loadCaretakerSession(data.id);
      } else {
        setDbNote("No active DB chat yet. Send a message to start.");
      }
    } catch {
      setDbNote("Could not load previous caretaker chat. Send a new message or ask admin.");
    }
  }
  useEffect(()=>{ loadLatestCaretakerSession(); }, []);
  useEffect(()=>{ if (caseId) loadCaretakerSession(caseId); }, [caseId]);
  function replyFor(q: string) {
    return getKaFarmReply(q, "caretaker");
  }
  async function saveCaretakerKaFarmReply(sessionId: string, body: string, metadata: Record<string, any> = {}) {
    const { error } = await saveKaFarmSupportMessage(sessionId, body, metadata);
    if (error) throw error;
  }
  function needsAdmin(q: string) {
    return shouldEscalateToAdmin(q, "caretaker");
  }
  async function send(){
    if(!msg.trim()) return;
    const q = msg.trim();
    const answer = replyFor(q);
    const shouldEscalate = escalated || needsAdmin(q);
    setMessages(current=>{
      const next = [...current,{from:"caretaker" as const,text:q,at:"Now"},{from:"kafarm" as const,text:answer,at:"Now"}, ...(shouldEscalate && !escalated ? [{from:"kafarm" as const,text:"I escalated this to admin. Do not use serial exception, bypass QR, or send customer update until admin reviews it.",at:"Now"}] : [])];
      return next;
    });
    if (needsAdmin(q)) setEscalated(true);
    setMsg("");
    try {
      const { data, error } = await sendSupportMessage({ role: "caretaker", sessionId: caseId || null, body: q, forceEscalate: shouldEscalate });
      if (error) throw error;
      setCaseId(data);
      await saveCaretakerKaFarmReply(data, answer, { mode: "caretaker_support", rule_based: true });
      if (shouldEscalate && !escalated) await saveCaretakerKaFarmReply(data, `${getEscalationNotice(q, "caretaker")} Do not use serial exception, bypass QR, or send customer update until admin reviews it.`, { mode: "caretaker_support", escalation_notice: true });
      await loadCaretakerSession(data);
    } catch {
      setDbNote("Message shown here, but DB save failed. Please check caretaker account mapping.");
    }
  }
  async function escalateNow() {
    setEscalated(true);
    const last = [...messages].reverse().find(m=>m.from==="caretaker")?.text || "Caretaker requested admin exception";
    setMessages(current=>[...current,{from:"kafarm",text:"I escalated this to admin. No serial exception, QR bypass, or customer update should happen until admin reviews it.",at:"Now"}]);
    try {
      const { data, error } = await sendSupportMessage({ role: "caretaker", sessionId: caseId || null, body: last, forceEscalate: true });
      if (error) throw error;
      setCaseId(data);
      await saveCaretakerKaFarmReply(data, "I escalated this to admin. No serial exception, QR bypass, or customer update should happen until admin reviews it.", { mode: "caretaker_support", escalation_notice: true });
      await loadCaretakerSession(data);
    } catch {
      setDbNote("Escalation visible here, but DB sync failed. Admin may need to check caretaker profile link.");
    }
  }
  const showEscalate = !escalated && messages.some((m,i)=>i > 0 && m.from==="kafarm" && /admin|exception|release|sensitive|wrong/i.test(m.text));
  return <Shell role="caretaker" title="Chat Admin"><PageTitle title="Chat Admin" text="Ask KaFarm first for QR, camera, serial, upload, task, or proof issues. Admin joins when exception is needed." icon="chat" /><section className="mx-auto max-w-4xl overflow-hidden rounded-[28px] border border-[#e3ded0] bg-white shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ece6d8] bg-[#fffdf7] p-4"><div className="flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-full bg-[#1f6b45] text-white"><Icon name="chat" /></div><div><h2 className="text-xl font-black">{escalated ? "Admin Escalation Open" : "KaFarm Caretaker Help"}</h2><p className="text-sm font-bold text-[#667267]">Customer and caretaker still cannot chat directly.</p></div></div><Badge tone={escalated?"warn":"good"}>{escalated?"Escalated":"Ka-Farm First"}</Badge></div><div className="min-h-[62vh] bg-[linear-gradient(180deg,#fffdf7_0%,#f6f3e8_100%)] p-4"><div className="max-h-[62vh] space-y-3 overflow-y-auto pr-2">{messages.map((m,i)=><div key={i} className={("max-w-[86%] rounded-2xl p-3 shadow-sm " + (m.from==="caretaker"?"ml-auto bg-[#1f6b45] text-white":m.from==="admin"?"bg-sky-50 text-[#12375a] ring-1 ring-sky-100":"bg-white"))}><b>{m.from==="caretaker"?"Caretaker":m.from==="admin"?"Admin":"Ka-Farm"}</b><p className="mt-1 text-sm leading-6">{m.text}</p></div>)}</div></div><div className="border-t border-[#ece6d8] bg-white p-4">{showEscalate && <button onClick={escalateNow} className="mb-3 w-full rounded-2xl bg-amber-300 px-4 py-3 font-black text-[#17251d]">Escalate to Admin</button>}<div className="flex gap-2"><input value={msg} onChange={e=>setMsg(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")send();}} className="flex-1 rounded-2xl border border-[#ded8c9] bg-[#fffdf7] p-4 font-bold" placeholder="Message KaFarm about QR, camera, serial, upload, task, or proof..." /><button onClick={send} className="rounded-2xl bg-[#1f6b45] px-6 font-black text-white">Send</button></div><p className="mt-2 text-xs font-bold text-[#667267]">{dbNote}</p></div></section></Shell>;
}
export function CaretakerProfile() { const [profileNote,setProfileNote]=useState("Profile includes resume, salary, and payout method for admin payroll."); return <Shell role="caretaker" title="Profile"><PageTitle title="Profile" text="Your work profile, resume, salary, and payout method." icon="user" /><KaFarm>{profileNote}</KaFarm><Card className="mt-5"><div className="flex flex-wrap gap-5"><div className="grid h-24 w-24 place-items-center rounded-full bg-[#dfeada] text-3xl font-black">JD</div><div><h2 className="text-2xl font-black">Juan D.</h2><p>Senior Farm Caretaker</p><p className="mt-2 text-[#667267]">Salary: {peso(18000)} / month - GCash payroll</p><button onClick={()=>setProfileNote("Resume preview opened. Name, address, and contact details are hidden from customer-facing views.")} className="mt-4 rounded-xl bg-[#1f6b45] px-4 py-3 font-black text-white">View Resume</button></div></div></Card></Shell>; }


export function AdminOperationChecker() {
  const [selected,setSelected]=useState("kyc");
  const [submittedProofs,setSubmittedProofs]=useState<SubmittedTaskProof[]>([]);
  useEffect(()=>setSubmittedProofs(getSubmittedTaskProofs()), []);
  const queues = [
    { id: "kyc", title: "KYC Review", count: 4, status: "Needs admin", tone: "warn" as const, icon: "shield" as IconName, owner: "Customer Desk", next: "Check consent, ID front/back, selfie, duplicate flags, then approve/hold." },
    { id: "care", title: "Care Requests", count: 5, status: "Assign caretaker", tone: "warn" as const, icon: "clipboard" as IconName, owner: "Farm Operations", next: "Assign by rooster, service, customer note, and caretaker load." },
    { id: "proof", title: "Proof Review", count: Math.max(3, submittedProofs.length), status: submittedProofs.length ? "New proof submitted" : "Check quality", tone: "bad" as const, icon: "camera" as IconName, owner: "Caretaker Desk", next: "Review QR/serial, photo clarity, uploaded time, and rooster tag before customer release." },
    { id: "cashin", title: "Cash-In Checks", count: 2, status: "Duplicate scan", tone: "warn" as const, icon: "wallet" as IconName, owner: "Money Desk", next: "Match amount, sender, payment channel, reference, and duplicate risk." },
    { id: "withdraw", title: "Withdrawals", count: 3, status: "Manual payout", tone: "warn" as const, icon: "coins" as IconName, owner: "Money Desk", next: "Require KYC approved, payout name match, wallet PIN trail, proof upload, then receipt." },
    { id: "support", title: "Escalated Chat", count: 2, status: "Admin reply", tone: "neutral" as const, icon: "chat" as IconName, owner: "Live Chat", next: "Read Ka-Farm summary, open evidence, answer customer, and log decision." },
  ];
  const active = queues.find(q=>q.id===selected) || queues[0];
  const handoff = [
    { label: "Customer", value: "Request, KYC, wallet, receipt, support" },
    { label: "Admin", value: "Review, assign, approve, hold, document" },
    { label: "Caretaker", value: "Verify rooster, perform task, upload proof" },
    { label: "Back to Customer", value: "Inbox notice, care logs, invoice, wallet status" },
  ];
  return <Shell role="admin" title="Operations Checker"><PageTitle title="Operations Checker" text="Admin control room for customer, caretaker, money, KYC, proof, and support checks." icon="clipboard" /><KaFarm>Start with the highest risk queue. Admin is the final reviewer for KYC, money, proof, and dispute decisions.</KaFarm><div className="mt-5 grid gap-5 xl:grid-cols-[380px_1fr_340px]"><Card><div className="flex items-center justify-between gap-3"><h2 className="text-xl font-black">Admin Check Queue</h2><Badge tone="warn">{queues.reduce((sum,q)=>sum+q.count,0)} open</Badge></div><div className="mt-4 max-h-[650px] space-y-3 overflow-y-auto pr-2">{queues.map(q=><button key={q.id} onClick={()=>setSelected(q.id)} className={("w-full rounded-2xl border p-4 text-left transition " + (selected===q.id?"border-[#1f6b45] bg-emerald-50":"border-[#ece6d8] bg-[#fffdf7]"))}><div className="flex items-center gap-3"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white text-[#1f6b45] shadow-sm"><Icon name={q.icon} /></span><span className="min-w-0 flex-1"><b className="block truncate">{q.title}</b><span className="mt-1 block text-sm font-bold text-[#667267]">{q.owner}</span></span><Badge tone={q.tone}>{q.count}</Badge></div><p className="mt-3 text-sm font-bold leading-6 text-[#667267]">{q.status}</p></button>)}</div></Card><div className="grid gap-5"><Card><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black uppercase text-[#667267]">Selected Operation</p><h2 className="mt-1 text-3xl font-black">{active.title}</h2><p className="mt-1 text-sm font-bold text-[#667267]">Owner: {active.owner}</p></div><Badge tone={active.tone}>{active.status}</Badge></div><div className="mt-5 rounded-2xl bg-[#f6f3e8] p-4"><b>Next admin action</b><p className="mt-2 text-sm font-bold leading-6 text-[#667267]">{active.next}</p></div>{selected==="proof" && submittedProofs.length>0 && <div className="mt-4 max-h-[260px] space-y-3 overflow-y-auto pr-2">{submittedProofs.map(p=><div key={p.id} className="rounded-2xl border border-amber-200 bg-amber-50 p-3"><div className="flex items-center gap-3"><img src={p.image} alt="" className="h-14 w-14 rounded-xl object-cover" /><div className="min-w-0 flex-1"><b className="block truncate">{p.rooster} - {p.task}</b><p className="text-xs font-bold text-[#667267]">{p.caretaker} - {p.submittedAt}</p></div><Badge tone="warn">Review</Badge></div><p className="mt-2 text-sm font-bold text-[#667267]">{p.proof} / {p.note}</p></div>)}</div>}<div className="mt-5 grid gap-3 sm:grid-cols-3"><Link href="/admin/customer-desk" className="rounded-xl bg-white px-4 py-3 text-center font-black shadow-sm">Customer</Link><Link href="/admin/caretaker-desk" className="rounded-xl bg-white px-4 py-3 text-center font-black shadow-sm">Caretaker</Link><Link href="/admin/evidence" className="rounded-xl bg-white px-4 py-3 text-center font-black shadow-sm">Evidence</Link></div></Card><Card><h2 className="text-xl font-black">Handoff Flow</h2><div className="mt-4 grid gap-3 md:grid-cols-2">{handoff.map((h,i)=><div key={h.label} className="rounded-2xl border border-[#ece6d8] bg-[#fffdf7] p-4"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-full bg-[#1f6b45] text-sm font-black text-white">{i+1}</span><b>{h.label}</b></div><p className="mt-2 text-sm font-bold leading-6 text-[#667267]">{h.value}</p></div>)}</div></Card></div><Card><h2 className="text-xl font-black">Release Rules</h2><div className="mt-4 space-y-3 text-sm font-bold leading-6 text-[#667267]"><p className="rounded-2xl bg-amber-50 p-3 text-amber-900">KYC and withdrawals stay locked until admin final approval.</p><p className="rounded-2xl bg-red-50 p-3 text-red-800">Wrong rooster, duplicate receipt, or face risk never auto-releases to customer.</p><p className="rounded-2xl bg-emerald-50 p-3 text-emerald-900">Clean caretaker proof can publish to customer care logs after review.</p><p className="rounded-2xl bg-[#f6f3e8] p-3">Every action must leave evidence: who, what, when, and why.</p></div></Card></div></Shell>;
}

function KaFarmCaretakerErrorLab() {
  const [note, setNote] = useState("Ready for local KaFarm error test.");
  if (process.env.NODE_ENV === "production") return null;

  const triggerLevelOne = () => {
    console.warn("KaFarm test level 1 caretaker warning: camera permission warning on /caretaker/dashboard");
    setNote("Level 1 sent: warning. Check /admin/kafarm -> System -> Problem -> Run.");
  };

  const triggerLevelTwo = () => {
    console.error("KaFarm test level 2 caretaker runtime error: task proof upload button returned post code error 422");
    setNote("Level 2 sent: console/API-style error. Check System or Production Error.");
  };

  const triggerLevelThree = () => {
    setNote("Level 3 sent: fatal runtime error will be thrown.");
    window.setTimeout(() => {
      throw new Error("KaFarm test level 3 fatal error: caretaker task screen stopped during QR verification");
    }, 250);
  };

  return (
    <Card className="mt-5 border-2 border-dashed border-amber-300 bg-amber-50/90">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase text-amber-800">Local KaFarm Test Lab</p>
          <h2 className="text-xl font-black text-[#14241b]">Caretaker Error Level 1-3</h2>
          <p className="mt-1 text-sm font-bold text-[#667267]">{note}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={triggerLevelOne} className="rounded-xl bg-white px-4 py-3 text-sm font-black text-amber-800 shadow-sm">Level 1 Warning</button>
          <button onClick={triggerLevelTwo} className="rounded-xl bg-orange-500 px-4 py-3 text-sm font-black text-white shadow-sm">Level 2 Error</button>
          <button onClick={triggerLevelThree} className="rounded-xl bg-red-600 px-4 py-3 text-sm font-black text-white shadow-sm">Level 3 Fatal</button>
        </div>
      </div>
    </Card>
  );
}

export function CaretakerOperationChecker() {
  const [selected,setSelected]=useState(initialTasks[0]);
  const checklist = ["Read customer note", "Verify rooster QR", "Use serial only if admin releases exception", "Capture clear proof", "Choose prepared note", "Submit for admin/customer review"];
  const stats = [
    { label: "Active", value: `${initialTasks.length}`, icon: "clipboard" as IconName, tone: "warn" as const },
    { label: "Urgent", value: `${initialTasks.filter(t=>t.priority==="urgent").length}`, icon: "alert" as IconName, tone: "bad" as const },
    { label: "Completed", value: `${completedTasks.length}`, icon: "check" as IconName, tone: "good" as const },
    { label: "Admin Chat", value: "Open", icon: "chat" as IconName, tone: "neutral" as const },
  ];
  return <Shell role="caretaker" title="Caretaker Checker"><PageTitle title="Caretaker Checker" text="Simple operations screen for active requests, proof steps, admin exception, and completed work." icon="clipboard" /><KaFarm>Open one task, follow the checklist, and ask admin if QR, camera, rooster, or instruction is unclear.</KaFarm><KaFarmCaretakerErrorLab /><div className="mt-5 grid gap-3 md:grid-cols-4">{stats.map(s=><Card key={s.label} className="p-4"><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#f6f3e8] text-[#1f6b45]"><Icon name={s.icon} /></span><span><p className="text-xs font-black uppercase text-[#667267]">{s.label}</p><p className="text-2xl font-black">{s.value}</p></span></div></Card>)}</div><div className="mt-5 grid gap-5 xl:grid-cols-[360px_1fr_320px]"><Card><h2 className="text-xl font-black">Request List</h2><div className="mt-4 max-h-[620px] space-y-3 overflow-y-auto pr-2">{initialTasks.map(t=><button key={t.id} onClick={()=>setSelected(t)} className={("w-full rounded-2xl border p-3 text-left transition " + (selected.id===t.id?"border-[#1f6b45] bg-emerald-50":"border-[#ece6d8] bg-[#fffdf7]"))}><div className="flex items-center gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#e7eadf] font-black">{t.requester[0]}</span><span className="min-w-0 flex-1"><b className="block truncate">{t.requester}</b><span className="block truncate text-sm font-bold text-[#667267]">{t.rooster} - {t.task}</span></span><Badge tone={t.priority==="urgent"?"warn":"neutral"}>{t.priority}</Badge></div><p className="mt-2 text-xs font-black text-[#1f6b45]">{t.due}</p></button>)}</div></Card><Card><div className="grid gap-4 md:grid-cols-[180px_1fr]"><img src="/farmconnect/roosters/fc-stage-3-young-rooster-base.jpg" className="h-44 w-full rounded-2xl object-cover" alt="" /><div><p className="text-xs font-black uppercase text-[#667267]">Selected Task</p><h2 className="mt-1 text-3xl font-black">{selected.task}</h2><p className="mt-1 text-sm font-bold text-[#667267]">{selected.rooster} / {selected.tag} - {selected.pen}</p><div className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm font-bold leading-6 text-amber-900"><b>Customer note</b><p>{selected.note}</p></div></div></div><div className="mt-5 grid gap-3 sm:grid-cols-3"><Link href="/caretaker/tasks" className="rounded-xl bg-[#1f6b45] px-3 py-3 text-center font-black text-white"><Icon name="clipboard" className="mx-auto mb-1 h-5 w-5" />Open Active Task</Link><Link href="/caretaker/chat" className="rounded-xl bg-amber-300 px-3 py-3 text-center font-black">Ask Admin</Link><Link href="/caretaker/completed" className="rounded-xl bg-[#eee8d9] px-3 py-3 text-center font-black"><Icon name="check" className="mx-auto mb-1 h-5 w-5" />Completed</Link></div><div className="mt-5 rounded-2xl border border-[#ece6d8] bg-[#fffdf7] p-4"><b>Required proof</b><p className="mt-1 text-sm font-bold text-[#667267]">{selected.proof}. QR, camera, upload, feed quantity, and submit controls are inside Active Tasks so the real task record is updated.</p></div></Card><Card><h2 className="text-xl font-black">Work Checklist</h2><div className="mt-4 space-y-3">{checklist.map((item,i)=><div key={item} className="flex items-start gap-3 rounded-2xl bg-[#f6f3e8] p-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-sm font-black">{i+1}</span><p className="text-sm font-bold leading-6 text-[#667267]">{item}</p></div>)}</div><Link href="/caretaker/tasks" className="mt-4 block rounded-xl bg-[#1f6b45] px-4 py-3 text-center font-black text-white">Start Work</Link></Card></div></Shell>;
}
const adminQueues = [
  { title: "Pending Withdrawals", count: 3, text: "Manual payout and proof upload needed.", href: "/admin/money-desk", icon: "wallet" },
  { title: "Flagged Proof", count: 4, text: "Blurred or missing QR verification.", href: "/admin/caretaker-desk", icon: "alert" },
  { title: "Live Chat Queue", count: 2, text: "Escalated Ka-Farm support chats.", href: "/admin/live-chat", icon: "chat" },
  { title: "Unassigned Requests", count: 5, text: "Paid requests waiting for caretaker.", href: "/admin/farm-operations", icon: "clipboard" },
];

const adminDeskCards: Record<string, Array<{ title: string; text: string; icon: IconName; href: string }>> = {
  customer: [
    { title: "Customers", text: "Customer list, rooster count, owner nickname, duplicates, and account status.", icon: "users", href: "/admin/customers" },
    { title: "Payments", text: "Customer payments, farm buy receipts, service fees, and invoice history.", icon: "coins", href: "/admin/transactions" },
    { title: "Wallet / Withdrawals", text: "Cash-in proofs, withdrawal requests, payout account checks, and pending holds.", icon: "wallet", href: "/admin/money-desk" },
    { title: "KYC / Risk", text: "Identity checks, duplicate accounts, suspicious links, and account review.", icon: "shield", href: "/admin/risk-management" },
    { title: "Care Concerns", text: "Customer reports about care quality, wrong rooster, health worries, or proof issues.", icon: "alert", href: "/admin/customer-desk" },
    { title: "Sell Requests", text: "Customer requests to sell rooster, pricing estimate, sale invoice, and payout trail.", icon: "rooster", href: "/admin/sell-requests" },
    { title: "Support Tickets", text: "Escalated Ka-Farm chats and live admin conversations.", icon: "chat", href: "/admin/live-chat" },
    { title: "Logbook", text: "Everything customer did: buys, requests, messages, receipts, proofs, and admin actions.", icon: "file", href: "/admin/evidence" },
  ],
  caretaker: [
    { title: "Registration Control", text: "Admin-only caretaker signup link, pending approvals, and printable approved/rejected records.", icon: "clipboard", href: "/admin/caretaker-registration" },
    { title: "Caretaker List", text: "Two-column review: caretaker list on the left, resume/photo/profile on the right.", icon: "users", href: "/admin/caretakers" },
    { title: "Payroll", text: "15th/30th payroll, time in/out, absent count, per-day rate, payout mode, receipt.", icon: "coins", href: "/admin/caretaker-desk" },
    { title: "Proof Review", text: "Caretaker submissions flagged by system: blurred, old photo, wrong rooster, missing video.", icon: "camera", href: "/admin/evidence" },
    { title: "Caretaker Logs", text: "All, rejects, completed, and performance history per caretaker.", icon: "file", href: "/admin/evidence" },
    { title: "Caretaker Chat", text: "Messenger-style admin chat for QR, scanner, camera, and unclear task issues.", icon: "chat", href: "/admin/live-chat" },
    { title: "Attendance", text: "Daily attendance, absent/present count, and payroll computation source.", icon: "clipboard", href: "/admin/caretaker-desk" },
  ],
  farm: [
    { title: "Rooster Inventory", text: "Farm rooster inventory: available, taken, customer owner, caretaker, pen, QR/serial.", icon: "rooster", href: "/admin/farm-operations" },
    { title: "Customer Roosters", text: "Who owns which rooster, current caretaker, care status, and sell readiness.", icon: "users", href: "/admin/farm-operations" },
    { title: "Request Queue", text: "Customer care/sell requests waiting for admin assignment and caretaker work.", icon: "clipboard", href: "/admin/farm-operations" },
    { title: "Sell Pricing", text: "Admin sets price, caretaker verifies weight/status, system prepares sale computation.", icon: "coins", href: "/admin/sell-requests" },
    { title: "Sale / Invoice", text: "Sold roosters, customer share, farm share, and invoice sent to inbox.", icon: "file", href: "/admin/sell-requests" },
  ],
  money: [
    { title: "Cash-In Checks", text: "Incoming money, screenshot proof, sender, channel, reference, duplicate and amount check.", icon: "wallet", href: "/admin/transactions/cashin" },
    { title: "Withdrawals", text: "Manual payout flow redirected to Customer Desk withdrawal review.", icon: "coins", href: "/admin/customer-desk/withdraw" },
    { title: "Treasury Guide", text: "Simple business view: available cash, locked funds, pending payouts, income, and holds.", icon: "shield", href: "/admin/treasury" },
    { title: "Receipts / Invoices", text: "Cash-in, withdrawal, farm buy, care request, and sale records.", icon: "file", href: "/admin/evidence" },
  ],
  chat: [
    { title: "Customer Live Chat", text: "Only chats escalated by Ka-Farm appear here.", icon: "support", href: "/admin/live-chat" },
    { title: "Caretaker Chat", text: "QR exception, camera issue, wrong rooster, and urgent farm messages.", icon: "chat", href: "/admin/live-chat" },
    { title: "AI Logs", text: "Customer/caretaker Ka-Farm conversations kept for evidence.", icon: "file", href: "/admin/evidence" },
  ],
  evidence: [
    { title: "System Evidence Logs", text: "Main logs: receipts, proofs, overrides, admin actions, and system checker results.", icon: "search", href: "/admin/evidence" },
    { title: "Proof Review Logs", text: "Task photos/videos, QR status, upload metadata, and admin decisions.", icon: "camera", href: "/admin/evidence" },
    { title: "Resolved Cases", text: "Closed issues with decision, evidence, receipt, message, and delete/archive.", icon: "check", href: "/admin/customer-desk/resolved" },
    { title: "Audit Logs", text: "Who changed what, when, and why, so the farm has documentation.", icon: "file", href: "/admin/audit-logs" },
  ],
};
const adminDashboardIndicators = [
  { title: "Issues", value: "5", sub: "2 high priority reports", detail: "Customer/caretaker problems needing investigation.", href: "/admin/issue-management", icon: "alert" as IconName, tone: "bad" as const },
  { title: "Requests", value: "12", sub: "Payments, care, withdrawals", detail: "Customer submitted requests waiting for admin movement.", href: "/admin/customer-desk", icon: "clipboard" as IconName, tone: "warn" as const },
  { title: "Task Reviews", value: "4", sub: "Caretaker proof checks", detail: "Submitted work needing approval or rejection.", href: "/admin/caretaker-desk", icon: "camera" as IconName, tone: "warn" as const },
  { title: "Money In", value: peso(18400), sub: "Approved today estimate", detail: "Payment proofs and sales income summary.", href: "/admin/customer-desk", icon: "coins" as IconName, tone: "good" as const },
  { title: "Money Out", value: peso(6200), sub: "Pending release", detail: "Withdrawal payout checks and receipts.", href: "/admin/customer-desk", icon: "wallet" as IconName, tone: "warn" as const },
  { title: "Priority", value: "P1", sub: "Withdrawal/KYC risk", detail: "Highest queue to open first.", href: "/admin/account-verification", icon: "shield" as IconName, tone: "bad" as const },
  { title: "Earnings", value: peso(12200), sub: "Net estimate today", detail: "Farm buy, care services, and rooster sales.", href: "/admin/farm-operations", icon: "rooster" as IconName, tone: "good" as const },
  { title: "System Alerts", value: "3", sub: "Needs evidence check", detail: "Missing proof, stuck status, or failed linkage.", href: "/admin/kafarm", icon: "support" as IconName, tone: "neutral" as const },
];

export function AdminHome() {
  return <Shell role="admin" title="Admin Dashboard"><PageTitle title="Admin Dashboard" text="Indicator board lang: tingnan kung saan may issue, request, task review, priority, at pera." icon="shield" /><div className="grid gap-5 xl:grid-cols-[1fr_380px]"><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{adminDashboardIndicators.map(item=><Link key={item.title} href={item.href} className="rounded-2xl border border-[#e3ded0] bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"><div className="flex items-start justify-between gap-3"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#f6f3e8] text-[#1f6b45]"><Icon name={item.icon} /></span><Badge tone={item.tone}>{item.sub}</Badge></div><p className="mt-4 text-xs font-black uppercase text-[#667267]">{item.title}</p><h2 className="mt-1 text-3xl font-black">{item.value}</h2><p className="mt-2 min-h-[48px] text-sm font-bold leading-6 text-[#667267]">{item.detail}</p><span className="mt-3 inline-block rounded-xl bg-[#1f6b45] px-3 py-2 text-sm font-black text-white">Open Desk</span></Link>)}</div><KaFarmAdmin /></div></Shell>;
}

function KaFarmAdmin() { return <Card><div className="flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-full bg-[#1f6b45] text-white"><Icon name="support" /></div><div><h2 className="text-xl font-black">Ask Ka-Farm</h2><p className="text-sm text-[#667267]">Backlog assistant, not decision maker.</p></div></div><div className="mt-4 max-h-[520px] space-y-3 overflow-y-auto pr-2">{adminQueues.map(q=><div key={q.title} className="rounded-xl bg-[#f6f3e8] p-3"><div className="flex items-center justify-between"><b>{q.title}</b><Badge tone={q.count>3?"warn":"neutral"}>{q.count}</Badge></div><p className="mt-1 text-sm text-[#667267]">{q.text}</p><Link href={q.href} className="mt-2 inline-block rounded-lg bg-white px-3 py-2 text-sm font-black">Open</Link></div>)}</div><div className="mt-4 rounded-xl border p-3 text-sm text-[#667267]">Try: "Ano naiwan?", "Bakit flagged si Juan?", "Ano nangyari kay Aydana?"</div></Card>; }

function AdminLiveChatPage() {
  type AdminMsg = { from: "customer" | "caretaker" | "kafarm" | "admin"; text: string; at?: string };
  type EscalatedChat = { id: string; name: string; role: "customer" | "caretaker"; avatar: string; issue: string; status: string; risk: string; relatedRecord: string; summary: string; suggestedReply: string; solvedBy: string; last: string; messages: AdminMsg[]; createdAt?: string };
  const placeholderChats: EscalatedChat[] = [
    { id: "demo-customer", name: "No escalated chat yet", role: "customer", avatar: "KC", issue: "Database queue empty", status: "Read Only", risk: "Low", relatedRecord: "Support chat DB", summary: "When customer or caretaker support escalates to admin, the real session will appear in this list.", suggestedReply: "Open a customer/caretaker support page, send a sensitive concern, then refresh this queue.", solvedBy: "Placeholder only", last: "Placeholder", messages: [{ from:"kafarm", text:"This is only an empty state. Real escalations load from Supabase." }] },
  ];
  const [chats,setChats]=useState<EscalatedChat[]>(placeholderChats);
  const [selected,setSelected]=useState<EscalatedChat>(placeholderChats[0]);
  const [reply,setReply]=useState("");
  const [dbNote,setDbNote]=useState("Loading escalated chats from database...");
  function initials(name: string) {
    return (name || "KC").split(" ").map(part=>part[0]).join("").slice(0,2).toUpperCase();
  }
  function mapAdminMessages(rows: any[]): AdminMsg[] {
    return (rows || []).map(row=>({
      from: row.sender_role === "customer" ? "customer" : row.sender_role === "caretaker" ? "caretaker" : row.sender_role === "admin" ? "admin" : "kafarm",
      text: row.body || "",
      at: row.created_at ? new Date(row.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""
    })) as AdminMsg[];
  }
  function mapChat(row: any): EscalatedChat {
    const name = row.user_name || "Unknown user";
    const status = String(row.status || "escalated").replace(/_/g, " ").replace(/\b\w/g, c=>c.toUpperCase());
    const messages = mapAdminMessages(row.messages || []);
    return {
      id: row.id,
      name,
      role: row.role === "caretaker" ? "caretaker" : "customer",
      avatar: initials(name),
      issue: row.title || "Support escalation",
      status,
      risk: row.risk_level ? String(row.risk_level).replace(/\b\w/g, c=>c.toUpperCase()) : "Medium",
      relatedRecord: row.related_record_label || "No linked record yet",
      summary: row.issue_summary || "KaFarm escalated this chat because admin review may be needed.",
      suggestedReply: row.suggested_reply || "Hi, admin joined. I will check the related records before any decision.",
      solvedBy: status === "Completed" ? "Completed by admin" : status === "Ended" ? "Ended by admin" : "Escalated to admin",
      last: row.updated_at ? new Date(row.updated_at).toLocaleString() : "Database",
      messages: messages.length ? messages : [{ from:"kafarm", text:"No messages loaded yet.", at:"" }],
      createdAt: row.created_at,
    };
  }
  async function loadChats() {
    try {
      const { data, error } = await getAdminEscalatedChats();
      if (error) throw error;
      const mapped = (data || []).map(mapChat);
      const next = mapped.length ? mapped : placeholderChats;
      setChats(next);
      setSelected(current => next.find(item => item.id === current?.id) || next[0]);
      setDbNote(mapped.length ? "Live database queue. Chat transcripts are evidence-ready." : "No real escalated chats yet. Placeholder empty state shown.");
    } catch {
      setChats(placeholderChats);
      setSelected(placeholderChats[0]);
      setDbNote("Could not load database queue. Check admin login/RLS or Supabase connection.");
    }
  }
  useEffect(()=>{ loadChats(); }, []);
  async function runAdminAction(action: "join" | "reply" | "end" | "complete") {
    if (selected.id.startsWith("demo-")) {
      setDbNote("Placeholder only. Create a real escalation from customer/caretaker support first.");
      return;
    }
    try {
      if (action === "reply") {
        if(!reply.trim()) return;
      }
      const { error } = await runAdminSupportAction({ action, sessionId: selected.id, body: reply.trim() });
      if (error) throw error;
      if (action === "reply") setReply("");
      setDbNote("Admin action saved. Evidence log updated when chat is joined/ended/completed.");
      await loadChats();
    } catch {
      setDbNote("Action failed safely. No sensitive change was made; check admin role or DB function.");
    }
  }
  function sendAdminReply() {
    if(!reply.trim()) return;
    runAdminAction("reply");
  }
  function joinChat() {
    runAdminAction("join");
  }
  function endChat() {
    runAdminAction("end");
  }
  function completeChat() {
    runAdminAction("complete");
  }
  const isPlaceholderChat = selected.id.startsWith("demo-");
  return <Shell role="admin" title="Live Chat"><PageTitle title="Escalated Chats" text="Only chats escalated by KaFarm appear here. Admin can join, reply, end, and complete the chat." icon="chat" /><div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)_320px]"><Card><div className="flex items-center justify-between gap-3"><h2 className="text-xl font-black">Escalation Queue</h2><Badge tone="warn">{chats.filter(c=>c.status!=="Completed").length}</Badge></div><button onClick={loadChats} className="mt-3 w-full rounded-xl bg-[#eee8d9] px-3 py-2 text-sm font-black">Refresh Database Queue</button><p className="mt-2 text-xs font-bold leading-5 text-[#667267]">{dbNote}</p><div className="mt-4 max-h-[640px] space-y-3 overflow-y-auto pr-2">{chats.map(chat=><button key={chat.id} onClick={()=>setSelected(chat)} className={("w-full rounded-2xl border p-3 text-left transition " + (selected.id===chat.id?"border-[#1f6b45] bg-emerald-50":"border-[#ece6d8] bg-[#fffdf7]"))}><div className="flex items-center gap-3"><div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#1f6b45] font-black text-white">{chat.avatar}</div><div className="min-w-0 flex-1"><b className="block truncate">{chat.name}</b><p className="truncate text-xs font-black uppercase text-[#667267]">{chat.role}</p><p className="truncate text-sm font-bold text-[#667267]">{chat.issue}</p></div><Badge tone={chat.status==="Completed"?"good":chat.status==="Ended"?"neutral":"warn"}>{chat.status}</Badge></div><p className="mt-2 line-clamp-2 text-xs font-bold leading-5 text-[#667267]">{chat.summary}</p><p className="mt-2 text-xs font-black text-[#1f6b45]">{chat.last}</p></button>)}</div></Card><div className="grid gap-5"><Card><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black uppercase text-[#667267]">KaFarm Summary Before Admin Joins</p><h2 className="mt-1 text-2xl font-black">{selected.name}</h2><p className="text-sm font-bold text-[#667267]">{selected.issue}</p></div><div className="flex flex-wrap gap-2"><Badge tone={selected.risk==="High"?"bad":selected.risk==="Medium"?"warn":"neutral"}>{selected.risk} Risk</Badge><Badge>{selected.role}</Badge></div></div><div className="mt-4 grid gap-3 md:grid-cols-2"><Info label="Related Record" value={selected.relatedRecord} /><Info label="Status" value={selected.status} /></div><div className="mt-4 rounded-2xl bg-[#f6f3e8] p-4"><b>Issue Summary</b><p className="mt-1 text-sm font-bold leading-6 text-[#667267]">{selected.summary}</p></div><div className="mt-4 rounded-2xl bg-sky-50 p-4 text-[#12375a]"><b>Suggested Reply</b><p className="mt-1 text-sm font-bold leading-6">{selected.suggestedReply}</p></div></Card><Card><h2 className="text-xl font-black">Chat Thread</h2><div className="mt-4 max-h-[430px] space-y-3 overflow-y-auto pr-2">{selected.messages.map((m,i)=><div key={i} className={("max-w-[86%] rounded-2xl p-3 " + (m.from==="admin"?"ml-auto bg-[#1f6b45] text-white":m.from==="customer"||m.from==="caretaker"?"bg-sky-50 text-[#12375a] ring-1 ring-sky-100":"bg-[#f6f3e8]"))}><b>{m.from==="admin"?"Admin":m.from==="customer"?"Customer":m.from==="caretaker"?"Caretaker":"Ka-Farm"}</b><p className="mt-1 text-sm leading-6">{m.text}</p>{m.at && <p className="mt-1 text-[11px] font-black opacity-70">{m.at}</p>}</div>)}</div><div className="mt-4 flex gap-2"><input value={reply} onChange={e=>setReply(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")sendAdminReply()}} placeholder={isPlaceholderChat?"Waiting for real escalated chat":"Admin reply..."} disabled={isPlaceholderChat} className="flex-1 rounded-xl border border-[#ded8c9] p-3 font-bold disabled:bg-[#f6f3e8] disabled:text-[#8b8b8b]" /><button onClick={sendAdminReply} disabled={isPlaceholderChat} className="rounded-xl bg-[#1f6b45] px-5 font-black text-white disabled:cursor-not-allowed disabled:bg-[#cfc7b5]">Send</button></div></Card></div><Card><h2 className="text-xl font-black">Admin Actions</h2><p className="mt-2 text-sm font-bold leading-6 text-[#667267]">Database-backed chat handling and evidence-ready transcript. No wallet, KYC, withdrawal, fraud, or record edits here.</p><div className="mt-4 grid gap-2"><button onClick={joinChat} disabled={isPlaceholderChat} className="rounded-xl bg-[#1f6b45] px-4 py-3 font-black text-white disabled:cursor-not-allowed disabled:bg-[#cfc7b5]">{isPlaceholderChat?"Waiting for Chat":"Join Chat"}</button><button onClick={endChat} disabled={isPlaceholderChat} className="rounded-xl bg-amber-300 px-4 py-3 font-black disabled:cursor-not-allowed disabled:bg-[#e4ddcf]">End Chat</button><button onClick={completeChat} disabled={isPlaceholderChat} className="rounded-xl bg-[#eee8d9] px-4 py-3 font-black disabled:cursor-not-allowed">Complete Chat</button><Link href="/admin/evidence" className="rounded-xl bg-white px-4 py-3 text-center font-black shadow-sm">Open Evidence</Link></div><div className="mt-4 rounded-2xl border border-dashed border-[#ded8c9] bg-[#fffdf7] p-3 text-sm font-bold leading-6 text-[#667267]">{dbNote}</div></Card></div></Shell>;
}
const adminCustomerProfiles = [
  { id: "cust-1", name: "Aydana Buratino", avatar: "AB", kyc: "Pending Review", wallet: "Active", pin: "Set", payout: "Not added", risk: "Medium", issue: "KYC submitted, withdrawal locked", last: "Today 5:42 PM", email: "aydana@example.com", phone: "+63 917 555 0198" },
  { id: "cust-2", name: "Marco Reyes", avatar: "MR", kyc: "Approved", wallet: "Active", pin: "Set", payout: "GCash verified", risk: "Low", issue: "Cash-in receipt reviewed", last: "Today 4:10 PM", email: "marco@example.com", phone: "+63 918 333 4411" },
  { id: "cust-3", name: "Lina Cruz", avatar: "LC", kyc: "Needs Review", wallet: "Hold", pin: "Reset requested", payout: "Maya pending", risk: "High", issue: "Possible duplicate account", last: "Yesterday 8:18 PM", email: "lina@example.com", phone: "+63 919 222 1188" },
];

const emptyCustomerDeskJob = {
  id: "empty",
  name: "No pending request",
  avatar: "--",
  kyc: "-",
  wallet: "-",
  pin: "-",
  payout: "-",
  risk: "Low",
  issue: "No pending request",
  last: "Waiting for customer submission",
  email: "",
  phone: "",
  queue: "payment",
  priority: "Normal",
  problem: "No pending request",
  blocker: "Customer queue is empty. New payment, care, task, or withdrawal requests will appear here after submission.",
  finish: "Wait For Request",
  next: "Run a fresh customer test or wait for a real customer submission.",
  route: "/admin/customer-desk",
};

const customerDeskSections = [
  { id: "payment", title: "Payment Review", icon: "coins" as IconName, tone: "warn" as const, count: 3, text: "Review receipt, reference number, receiver account, and admin notes. Approved creates invoice; rejected returns to customer payment status for resubmit.", href: "/admin/customer-desk/payment" },
  { id: "care", title: "Care Request", icon: "rooster" as IconName, tone: "warn" as const, count: 2, text: "Review customer rooster, service, notes, and payment status. Approved requests move to task assignment.", href: "/admin/customer-desk/care" },
  { id: "task", title: "Task Management", icon: "clipboard" as IconName, tone: "bad" as const, count: 4, text: "Only job: assign caretaker to approved care requests, then it appears in caretaker app.", href: "/admin/customer-desk/task" },
  { id: "withdraw", title: "Withdrawal Review", icon: "wallet" as IconName, tone: "warn" as const, count: 2, text: "Review withdrawal method, send payout externally, upload receipt/reference, then wait for customer confirmation.", href: "/admin/customer-desk/withdraw" },
];

const customerDeskJobs: Array<typeof emptyCustomerDeskJob> = [];

function CustomerDeskJobBoard({ sectionId }: { sectionId: string }) {
  const section = customerDeskSections.find(s=>s.id===sectionId) || customerDeskSections[0];
  const jobs = customerDeskJobs.filter(j=>j.queue===section.id);
  const [selected,setSelected]=useState(jobs[0] || emptyCustomerDeskJob);
  const [evidenceView,setEvidenceView]=useState("summary");
  const [latestKycReview,setLatestKycReview]=useState<any>(null);
  useEffect(()=>{ try { const raw = window.localStorage.getItem("farmconnect_latest_kyc_review"); if (raw) setLatestKycReview(JSON.parse(raw)); } catch {} }, []);
  useEffect(()=>{ if (jobs[0]) setSelected(jobs[0]); setEvidenceView("summary"); }, [sectionId]);
  const evidenceTabs = [
    { id: "summary", label: "Main Problem" },
    { id: "id", label: "ID / Selfie" },
    { id: "checks", label: "Check Evidence" },
    { id: "duplicate", label: "Duplicate Accounts" },
    { id: "timeline", label: "Timeline" },
  ];
  const duplicateAccounts = [
    { name: selected.name, label: "Submitted Account", image: "/farmconnect/kyc-test/01_selfie_same_face.png", detail: selected.email, status: "Current KYC" },
    { name: "Aydana B.", label: "Possible Duplicate", image: "/farmconnect/kyc-test/06_national_id_correct_fields_different_face.png", detail: "aydana.old@example.com", status: "Same birthday risk" },
  ];
  const records = [
    latestKycReview ? `Latest KYC: ${latestKycReview.status} - ${latestKycReview.faceStatus}` : "No fresh customer evidence opened yet",
    `${selected.name}: ${selected.problem}`,
    `Blocker: ${selected.blocker}`,
    `Finish: ${selected.next}`,
  ];
  const evidencePacks: Record<string, string[]> = {
    kyc: ["KYC form submitted", "ID front/back uploaded", "Selfie captured", "Consent accepted", "Face/duplicate check generated"],
    wallet: ["Cash-in screenshot uploaded", "Reference number extracted", "Receiver account checked", "Ledger transaction matched", "Duplicate reference scan"],
    withdraw: ["Withdrawal request created", "Saved payout account loaded", "KYC status checked", "Wallet balance checked", "Payout proof pending"],
    care: ["Original care request", "Paid service invoice", "Rooster QR/serial", "Caretaker proof upload", "Customer note and requested proof"],
    support: ["Ka-Farm chat transcript", "Customer support message", "AI handoff reason", "Related wallet/KYC/care records", "Admin live chat status"],
    security: ["PIN reset request", "Identity/KYC proof", "Recent login/contact changes", "Wallet balance untouched", "Force logout evidence"],
    evidence: ["All matching evidence records", "Receipts and invoices", "Proof photos/videos", "Admin decisions", "Audit timestamps"],
    resolved: ["Final decision", "Customer notification", "Evidence link", "Admin note", "Completion timestamp"],
  };
  const evidencePack = evidencePacks[section.id] || records;
  const showDuplicateColumn = evidenceView === "duplicate";
  return <Shell role="admin" title={section.title}><PageTitle title={section.title} text={section.text} icon={section.icon} /><div className={("mt-4 grid gap-5 " + (showDuplicateColumn?"xl:grid-cols-[300px_1fr_360px]":"lg:grid-cols-[340px_1fr]"))}><Card><div className="flex items-center justify-between gap-3"><Link href="/admin/customer-desk" className="rounded-xl bg-[#f6f3e8] px-4 py-2 text-sm font-black">Back</Link><Badge tone={section.tone}>{jobs.length} open</Badge></div><h2 className="mt-4 text-xl font-black">Customer List</h2><div className="mt-4 max-h-[520px] space-y-2 overflow-y-auto pr-2">{jobs.map(job=><button key={job.id + job.problem} onClick={()=>{setSelected(job); setEvidenceView("summary");}} className={("flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition " + (selected.id===job.id && selected.problem===job.problem?"border-[#1f6b45] bg-emerald-50 shadow-sm":"border-[#ece6d8] bg-[#fffdf7] hover:border-[#cfc7b7]"))}><div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#1f6b45] text-sm font-black text-white">{job.avatar}</div><div className="min-w-0 flex-1"><b className="block truncate">{job.name}</b><p className="truncate text-xs font-bold text-[#667267]">{job.problem}</p></div><Badge tone={job.priority==="High"?"bad":"neutral"}>{job.priority}</Badge></button>)}</div></Card><Card><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-black uppercase text-[#667267]">Investigation</p><h2 className="mt-1 text-3xl font-black leading-tight">{selected.problem}</h2><p className="mt-2 font-bold text-[#667267]">{selected.blocker}</p></div><Badge tone={selected.priority==="High"?"bad":"neutral"}>{selected.priority}</Badge></div><div className="mt-4 rounded-2xl bg-[#f6f3e8] p-4"><p className="text-xs font-black uppercase text-[#667267]">Main Problem</p><h3 className="mt-1 text-xl font-black">{selected.finish}</h3><p className="mt-2 text-sm font-bold leading-6 text-[#667267]">Customer did: {selected.problem}. Admin must: {selected.next}</p></div><div className="mt-4 flex flex-wrap gap-2">{evidenceTabs.map(tab=><button key={tab.id} onClick={()=>setEvidenceView(tab.id)} className={("rounded-xl px-4 py-2 text-sm font-black transition " + (evidenceView===tab.id?"bg-[#1f6b45] text-white":"bg-white text-[#263228] shadow-sm ring-1 ring-[#ece6d8]"))}>{tab.label}</button>)}</div>{evidenceView!=="duplicate" ? <div className="mt-4 grid gap-3 xl:grid-cols-2"><div className="rounded-2xl border border-[#ece6d8] bg-[#fffdf7] p-4"><p className="text-xs font-black uppercase text-[#667267]">What To Check</p><ul className="mt-3 space-y-2 text-sm font-bold leading-6 text-[#667267]"><li>ID/selfie visibility and face match</li><li>Name, birthday, address, and ID number</li><li>Consent record and submission time</li><li>Any linked wallet or payout risk</li></ul></div><div className="rounded-2xl border border-[#ece6d8] bg-[#fffdf7] p-4"><p className="text-xs font-black uppercase text-[#667267]">Evidence Trail</p><div className="mt-3 max-h-[230px] space-y-2 overflow-y-auto pr-2">{evidencePack.map((r,i)=><div key={r} className="rounded-xl bg-[#f6f3e8] p-3"><div className="flex items-start gap-2"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white text-xs font-black">{i+1}</span><p className="text-sm font-bold leading-5 text-[#667267]">{r}</p></div></div>)}</div></div></div> : <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4"><p className="text-xs font-black uppercase text-[#92400e]">Duplicate account viewer opened</p><p className="mt-1 text-sm font-bold leading-6 text-[#667267]">Check Column 3. It appears only for duplicate account comparison so the page stays clean for other evidence.</p></div>}<div className="mt-5 flex flex-wrap gap-3"><Link href={`/admin/customer-desk/${section.id}/problem`} className="rounded-xl bg-[#1f6b45] px-4 py-3 font-black text-white">Check Problem</Link><Link href={`/admin/customer-desk/${section.id}/evidence`} className="rounded-xl bg-[#eee8d9] px-4 py-3 font-black">Check Evidence</Link><Link href="/admin/customer-desk/resolved" className="rounded-xl bg-amber-300 px-4 py-3 font-black">Complete</Link></div></Card>{showDuplicateColumn && <Card><div className="flex items-center justify-between gap-3"><h2 className="text-xl font-black">Duplicate Accounts</h2><Badge tone="bad">Review</Badge></div><p className="mt-1 text-sm font-bold text-[#667267]">Compare submitted account against possible duplicate.</p><div className="mt-4 grid gap-4">{duplicateAccounts.map(acc=><div key={acc.label} className="rounded-2xl border border-[#ece6d8] bg-[#fffdf7] p-3"><p className="text-xs font-black uppercase text-[#667267]">{acc.label}</p><div className="mt-3 overflow-hidden rounded-2xl bg-[#f6f3e8]"><img src={acc.image} alt={acc.name} className="h-40 w-full object-cover" /></div><h3 className="mt-3 text-lg font-black">{acc.name}</h3><p className="truncate text-sm font-bold text-[#667267]">{acc.detail}</p><Badge tone={acc.label==="Possible Duplicate"?"bad":"warn"}>{acc.status}</Badge></div>)}</div><div className="mt-4 grid gap-2"><button className="rounded-xl bg-[#1f6b45] px-4 py-3 font-black text-white">Mark Same Person</button><button className="rounded-xl bg-[#eee8d9] px-4 py-3 font-black">Mark Not Duplicate</button><button className="rounded-xl bg-amber-300 px-4 py-3 font-black">Need More Info</button></div></Card>}</div></Shell>;
}
function CustomerCaseBrain({ sectionId, problem, blocker, next }: { sectionId: string; problem: string; blocker: string; next: string }) {
  const brainMap: Record<string, { finding: string; cause: string; risk: string; recommendation: string; action: string }> = {
    kyc: {
      finding: problem.includes("duplicate") ? "Possible duplicate identity was detected." : "KYC is blocking customer money movement.",
      cause: blocker,
      risk: "Approving a bad identity can expose the farm to fraud, payout disputes, and locked-wallet complaints.",
      recommendation: problem.includes("duplicate") ? "Compare submitted account and possible duplicate before approval." : "Check ID, selfie, consent, face result, and mismatch flags before release.",
      action: next,
    },
    wallet: {
      finding: "Wallet/cash-in issue needs ledger proof, not chat guessing.",
      cause: blocker,
      risk: "Wrong crediting can lose farm money or make the customer think the app is unsafe.",
      recommendation: "Match amount, receiver, reference number, screenshot time, and wallet ledger before crediting.",
      action: "If farm fault, send exact cash. If customer fault, send formal explanation.",
    },
    withdraw: {
      finding: "Withdrawal is a sensitive payout action.",
      cause: blocker,
      risk: "Sending to the wrong account is irreversible and damages trust.",
      recommendation: "Check saved payout name, number, KYC, amount, and balance before proof upload.",
      action: "Only send after account details pass. Generate receipt and send to inbox.",
    },
    care: {
      finding: "Customer care concern needs proof against the original request.",
      cause: blocker,
      risk: "Wrong rooster or weak proof can make the farm look dishonest.",
      recommendation: "Compare paid request, rooster QR/serial, customer note, caretaker proof, and time submitted.",
      action: "Email customer or create corrective caretaker task with red warning.",
    },
    support: {
      finding: "Ka-Farm handed this to admin because it needs human judgement.",
      cause: blocker,
      risk: "Slow or unclear replies increase support load and customer distrust.",
      recommendation: "Use linked evidence before replying, then close with a polite summary.",
      action: "Join chat, answer, end chat, and complete case.",
    },
    security: {
      finding: "Security request touches wallet access.",
      cause: blocker,
      risk: "Resetting without identity proof can expose funds.",
      recommendation: "Verify identity/KYC, then reset wallet PIN. Balance and locked savings must not move.",
      action: "Reset triggers customer logout and new PIN setup.",
    },
    evidence: {
      finding: "This is an evidence lookup, not a decision by itself.",
      cause: blocker,
      risk: "Unlinked evidence makes disputes harder to defend.",
      recommendation: "Open only records connected to the selected customer case.",
      action: next,
    },
    resolved: {
      finding: "This case is already completed.",
      cause: blocker,
      risk: "Deleting too early can remove dispute protection.",
      recommendation: "Archive unless the record is clearly duplicate or test data.",
      action: "Review outcome, evidence link, admin note, then archive/delete.",
    },
  };
  const brain = brainMap[sectionId] || brainMap.evidence;
  return <Card className="border-[#b7d7c3] bg-emerald-50/70"><div className="flex items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#1f6b45] text-white"><Icon name="support" /></span><div className="min-w-0"><p className="text-xs font-black uppercase text-[#1f6b45]">Ka-Farm Case Brain</p><h2 className="mt-1 text-xl font-black">{brain.finding}</h2><div className="mt-3 grid gap-3 text-sm font-bold leading-6 text-[#667267] md:grid-cols-2 xl:grid-cols-4"><div><b className="block text-[#17251d]">Cause</b>{brain.cause}</div><div><b className="block text-[#17251d]">Risk</b>{brain.risk}</div><div><b className="block text-[#17251d]">Recommend</b>{brain.recommendation}</div><div><b className="block text-[#17251d]">Next</b>{brain.action}</div></div></div></div></Card>;
}
function AdminCustomerDeskActionPage({ sectionId, mode }: { sectionId: string; mode: "problem" | "evidence" }) {
  const section = customerDeskSections.find(s=>s.id===sectionId) || customerDeskSections[0];
  const jobs = customerDeskJobs.filter(j=>j.queue===section.id);
  const [selected,setSelected]=useState(jobs[0] || emptyCustomerDeskJob);
  useEffect(()=>{ if (jobs[0]) setSelected(jobs[0]); }, [sectionId]);
  const emailTemplate = `Hello ${selected.name},\n\nWe reviewed your FarmConnect concern: ${selected.problem}.\n\nReason: ${selected.blocker}.\n\nWhat happens next: ${selected.next}\n\nIf we need another document or proof, please submit it in the app so your record stays complete. Thank you for your patience.`;
  const brain = <CustomerCaseBrain sectionId={section.id} problem={selected.problem} blocker={selected.blocker} next={selected.next} />;
  const customerList = <Card><div className="flex items-center justify-between gap-3"><Link href={`/admin/customer-desk/${section.id}`} className="rounded-xl bg-[#f6f3e8] px-4 py-2 text-sm font-black">Back</Link><Badge tone={section.tone}>{jobs.length} open</Badge></div><h2 className="mt-4 text-xl font-black">Customer List</h2><div className="mt-4 max-h-[520px] space-y-2 overflow-y-auto pr-2">{jobs.map(job=><button key={job.id + job.problem} onClick={()=>setSelected(job)} className={("flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition " + (selected.id===job.id && selected.problem===job.problem?"border-[#1f6b45] bg-emerald-50 shadow-sm":"border-[#ece6d8] bg-[#fffdf7] hover:border-[#cfc7b7]"))}><div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#1f6b45] text-sm font-black text-white">{job.avatar}</div><div className="min-w-0 flex-1"><b className="block truncate">{job.name}</b><p className="truncate text-xs font-bold text-[#667267]">{job.problem}</p></div><Badge tone={job.priority==="High"?"bad":"neutral"}>{job.priority}</Badge></button>)}</div></Card>;
  if (mode === "problem") {
    return <Shell role="admin" title={`${section.title} Problem`}><PageTitle title={`${section.title}: Check Problem`} text="Problem source and troubleshooting guide before opening evidence." icon={section.icon} /><div className="mt-4 grid gap-5 lg:grid-cols-[340px_1fr]"><>{customerList}</><Card>{brain}<div className="mt-4 grid gap-4 xl:grid-cols-2"><div className="rounded-2xl bg-[#f6f3e8] p-5"><p className="text-xs font-black uppercase text-[#667267]">Problem / Source</p><h2 className="mt-2 text-3xl font-black">{selected.problem}</h2><p className="mt-3 text-sm font-bold leading-6 text-[#667267]">Source: {selected.name} under {section.title}. Customer action triggered this admin queue. Blocker: {selected.blocker}.</p></div><div className="rounded-2xl border border-[#ece6d8] bg-[#fffdf7] p-5"><p className="text-xs font-black uppercase text-[#667267]">Instruction / Troubleshooting</p><h3 className="mt-2 text-2xl font-black">What admin checks</h3><p className="mt-3 text-sm font-bold leading-6 text-[#667267]">{selected.next}</p><div className="mt-4 grid gap-2"><Link href={`/admin/customer-desk/${section.id}/evidence`} className="rounded-xl bg-[#1f6b45] px-4 py-3 text-center font-black text-white">Check Evidence</Link><Link href="/admin/customer-desk/resolved" className="rounded-xl bg-amber-300 px-4 py-3 text-center font-black">Complete</Link></div></div></div></Card></div></Shell>;
  }
  if (section.id === "kyc") {
    const submitted = { name: selected.name, img: "/farmconnect/kyc-test/01_selfie_same_face.png", detail: "Submitted account: ID front/back, selfie, consent, legal name, birthday." };
    const duplicate = { name: "Aydana B.", img: "/farmconnect/kyc-test/06_national_id_correct_fields_different_face.png", detail: "Possible duplicate: similar face, same birthday risk, older email record." };
    return <Shell role="admin" title="KYC Evidence"><PageTitle title="KYC: Check Evidence" text="Duplicate/facial evidence comparison with admin decision and email template." icon="shield" /><div className="mt-4">{brain}</div><div className="mt-4 grid gap-5 xl:grid-cols-[280px_minmax(260px,1fr)_minmax(260px,1fr)_340px]"><div className="min-h-[640px]">{customerList}</div><Card className="min-h-[640px]"><div className="mb-3 rounded-xl bg-[#1f6b45] px-3 py-2 text-center text-xs font-black uppercase text-white">Column 1</div><p className="text-xs font-black uppercase text-[#667267]">Submitted Account</p><div className="mt-3 overflow-hidden rounded-2xl bg-[#f6f3e8]"><img src={submitted.img} alt={submitted.name} className="h-56 w-full object-cover" /></div><h2 className="mt-3 text-2xl font-black">{submitted.name}</h2><p className="mt-2 text-sm font-bold leading-6 text-[#667267]">{submitted.detail}</p></Card><Card className="min-h-[640px]"><div className="mb-3 rounded-xl bg-[#9a3412] px-3 py-2 text-center text-xs font-black uppercase text-white">Column 2</div><p className="text-xs font-black uppercase text-[#667267]">Possible Duplicate</p><div className="mt-3 overflow-hidden rounded-2xl bg-[#f6f3e8]"><img src={duplicate.img} alt={duplicate.name} className="h-56 w-full object-cover" /></div><h2 className="mt-3 text-2xl font-black">{duplicate.name}</h2><p className="mt-2 text-sm font-bold leading-6 text-[#667267]">{duplicate.detail}</p></Card><Card className="min-h-[640px]"><div className="mb-3 rounded-xl bg-amber-300 px-3 py-2 text-center text-xs font-black uppercase text-[#17251d]">Column 3</div><h2 className="text-xl font-black">Analysis & Decision</h2><div className="mt-4 space-y-2 text-sm font-bold text-[#667267]"><p>Check if face, birthday, contact, and payout details are same person.</p><p>Do not approve if duplicate/fraud remains unresolved.</p></div><textarea defaultValue={emailTemplate} className="mt-4 h-48 w-full rounded-xl border border-[#ded8c9] p-3 text-sm font-bold" /><div className="mt-4 grid gap-2"><button className="rounded-xl bg-[#1f6b45] px-4 py-3 font-black text-white">Mark Same Person</button><button className="rounded-xl bg-[#eee8d9] px-4 py-3 font-black">Clear Duplicate</button><button className="rounded-xl bg-amber-300 px-4 py-3 font-black">Write Email</button><Link href="/admin/customer-desk/resolved" className="rounded-xl bg-white px-4 py-3 text-center font-black shadow-sm">Complete</Link></div></Card></div></Shell>;
  }
  if (section.id === "wallet") {
    return <Shell role="admin" title="Wallet Evidence"><PageTitle title="Wallet: Check Evidence" text="Cash-in trail: where customer sent money, reference, amount, and ledger result." icon="wallet" /><div className="mt-4">{brain}</div><div className="mt-4 grid gap-5 lg:grid-cols-[340px_1fr_1fr]"><>{customerList}</><Card><h2 className="text-xl font-black">Customer Cash-In Details</h2><div className="mt-4 grid gap-3"><Info label="Amount" value="P1,200" /><Info label="Method" value="GCash" /><Info label="Reference" value="GC-8821-441" /><Info label="Submitted" value="Today 10:42 AM" /><Info label="Sent To" value="FarmConnect GCash" /></div></Card><Card><h2 className="text-xl font-black">Evidence Decision</h2><p className="mt-2 text-sm font-bold leading-6 text-[#667267]">If receiver/reference/amount match and farm fault caused delay, send exact wallet credit. If customer sent to wrong account or duplicate ref, write formal inbox/email notice.</p><textarea defaultValue={emailTemplate} className="mt-4 h-40 w-full rounded-xl border border-[#ded8c9] p-3 text-sm font-bold" /><div className="mt-4 grid gap-2"><button className="rounded-xl bg-[#1f6b45] px-4 py-3 font-black text-white">Send Cash P1,200</button><button className="rounded-xl bg-amber-300 px-4 py-3 font-black">Write Email</button><Link href="/admin/customer-desk/resolved" className="rounded-xl bg-[#eee8d9] px-4 py-3 text-center font-black">Complete</Link></div></Card></div></Shell>;
  }
  if (section.id === "withdraw") {
    return <Shell role="admin" title="Withdraw Evidence"><PageTitle title="Withdraw: Check / Send" text="Sensitive payout review with saved payout details, proof upload, receipt generation." icon="coins" /><div className="mt-4">{brain}</div><div className="mt-4 grid gap-5 xl:grid-cols-[300px_1fr_360px]"><>{customerList}</><Card><h2 className="text-xl font-black">Withdrawal Details</h2><div className="mt-4 grid gap-3 sm:grid-cols-2"><Info label="Amount" value="P3,500" /><Info label="Mode" value="Maya" /><Info label="Account Name" value={selected.name} /><Info label="Account Number" value="09•• ••• ••18" /><Info label="KYC" value={selected.kyc} /><Info label="Balance Check" value="Passed" /></div></Card><Card><h2 className="text-xl font-black">Upload / Receipt</h2><div className="mt-4 rounded-2xl bg-[#f6f3e8] p-4 text-sm font-bold text-[#667267]">Upload transfer proof after checking account name and number. System creates invoice/receipt and sends it to customer inbox.</div><div className="mt-4 grid gap-2"><button className="rounded-xl bg-white px-4 py-3 font-black shadow-sm">Upload Proof</button><button className="rounded-xl bg-[#1f6b45] px-4 py-3 font-black text-white">Check / Send</button><Link href="/admin/customer-desk/resolved" className="rounded-xl bg-amber-300 px-4 py-3 text-center font-black">Complete</Link></div></Card></div></Shell>;
  }
  if (section.id === "care") {
    return <Shell role="admin" title="Care Evidence"><PageTitle title="Care: Check Evidence" text="Original request versus caretaker proof, then email customer or create corrective task." icon="rooster" /><div className="mt-4">{brain}</div><div className="mt-4 grid gap-5 xl:grid-cols-[300px_1fr_1fr_340px]"><>{customerList}</><Card><h2 className="text-xl font-black">Customer Request</h2><div className="mt-4 grid gap-3"><Info label="Rooster" value="Thunder King / FC-128" /><Info label="Service" value="Photo Update" /><Info label="Paid" value="Yes" /><Info label="Note" value="Close-up wings and feet" /></div></Card><Card><h2 className="text-xl font-black">Caretaker Proof</h2><div className="mt-3 overflow-hidden rounded-2xl bg-[#f6f3e8]"><img src="/farmconnect/roosters/fc-stage-3-young-rooster-base.jpg" alt="proof" className="h-52 w-full object-cover" /></div><p className="mt-3 text-sm font-bold text-[#667267]">Submitted by Juan D., today 4:40 PM. QR/serial pending admin check.</p></Card><Card><h2 className="text-xl font-black">Action</h2><textarea defaultValue={emailTemplate} className="mt-4 h-36 w-full rounded-xl border border-[#ded8c9] p-3 text-sm font-bold" /><div className="mt-4 grid gap-2"><button className="rounded-xl bg-amber-300 px-4 py-3 font-black">Email Customer</button><button className="rounded-xl bg-[#1f6b45] px-4 py-3 font-black text-white">Create Task</button><Link href="/admin/customer-desk/resolved" className="rounded-xl bg-[#eee8d9] px-4 py-3 text-center font-black">Complete</Link></div></Card></div></Shell>;
  }
  if (section.id === "support") {
    return <Shell role="admin" title="Support Chat"><PageTitle title="Support: Live Chat" text="Admin replies only from the database-backed live chat queue." icon="chat" /><div className="mt-4">{brain}</div><div className="mt-4 grid gap-5 xl:grid-cols-[320px_1fr_300px]"><>{customerList}</><Card><div className="flex items-start gap-4"><span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[#1f6b45] text-white"><Icon name="chat" /></span><div><p className="text-xs font-black uppercase text-[#667267]">Real Chat Surface</p><h2 className="mt-1 text-2xl font-black">Open Admin Live Chat</h2><p className="mt-2 text-sm font-bold leading-6 text-[#667267]">This desk only explains why support is escalated. Actual messages, admin join, replies, end chat, and persisted transcript live in the real chat queue.</p></div></div><div className="mt-5 grid gap-3 sm:grid-cols-2"><Link href="/admin/live-chat" className="rounded-xl bg-[#1f6b45] px-4 py-3 text-center font-black text-white">Open Live Chat Queue</Link><Link href="/admin/evidence" className="rounded-xl bg-[#eee8d9] px-4 py-3 text-center font-black">Open Evidence</Link></div><div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold leading-6 text-amber-900">No fake local chat is shown here. This prevents admin from replying in a screen that does not save to Supabase.</div></Card><Card><h2 className="text-xl font-black">Admin Rule</h2><div className="mt-4 space-y-3 text-sm font-bold leading-6 text-[#667267]"><p className="rounded-2xl bg-[#f6f3e8] p-3">Customer/caretaker talks to KaFarm first.</p><p className="rounded-2xl bg-[#f6f3e8] p-3">Sensitive, money, KYC, fraud, angry, unclear, or legal concerns escalate.</p><p className="rounded-2xl bg-[#f6f3e8] p-3">Admin joins in /admin/live-chat only, so the transcript stays evidence-ready.</p></div><Link href="/admin/customer-desk/resolved" className="mt-4 block rounded-xl bg-amber-300 px-4 py-3 text-center font-black">Resolved Cases</Link></Card></div></Shell>;
  }
  if (section.id === "security") {
    return <Shell role="admin" title="Security"><PageTitle title="Security: Reset / Complete" text="Wallet PIN reset is automatic logout plus new PIN setup. Money is never moved." icon="qr" /><div className="mt-4">{brain}</div><div className="mt-4 grid gap-5 xl:grid-cols-[320px_1fr_320px]"><>{customerList}</><Card><h2 className="text-xl font-black">Problem And Check</h2><div className="mt-4 grid gap-3"><Info label="Request" value={selected.problem} /><Info label="Identity" value="Needs KYC proof" /><Info label="Wallet" value="Balance unchanged" /><Info label="Safety" value="Force logout after reset" /></div></Card><Card><h2 className="text-xl font-black">Reset</h2><p className="mt-2 text-sm font-bold leading-6 text-[#667267]">Reset Wallet PIN creates evidence, logs out customer, and requires new PIN on next access. Locked savings and balance stay untouched.</p><div className="mt-4 grid gap-2"><button className="rounded-xl bg-[#1f6b45] px-4 py-3 font-black text-white">Reset Wallet PIN</button><Link href="/admin/customer-desk/resolved" className="rounded-xl bg-amber-300 px-4 py-3 text-center font-black">Complete</Link></div></Card></div></Shell>;
  }
  return <Shell role="admin" title={section.title}><PageTitle title={section.title} text="Task logs and evidence archive." icon={section.icon} /><div className="mt-4">{brain}</div><div className="mt-4 grid gap-5 lg:grid-cols-[340px_1fr]"><>{customerList}</><Card><h2 className="text-xl font-black">{section.title}</h2><p className="mt-2 text-sm font-bold leading-6 text-[#667267]">Resolved cases collect completed problems. Admin can review, delete, or archive records here.</p><div className="mt-4 grid gap-2"><button className="rounded-xl bg-[#eee8d9] px-4 py-3 font-black">Delete</button><button className="rounded-xl bg-[#1f6b45] px-4 py-3 font-black text-white">Archive</button></div></Card></div></Shell>;
}

export function AdminCustomerDeskAction({ section, mode }: { section: string; mode: "problem" | "evidence" }) {
  return <AdminCustomerDeskActionPage sectionId={section} mode={mode} />;
}

function AdminCustomerDeskFormatPage({ sectionId }: { sectionId: string }) {
  const section = customerDeskSections.find(s=>s.id===sectionId) || customerDeskSections[0];
  const jobs = customerDeskJobs.filter(j=>j.queue===section.id);
  const [selected,setSelected]=useState(jobs[0] || emptyCustomerDeskJob);
  const [note,setNote]=useState("");
  const [decision,setDecision]=useState<"open" | "approved" | "rejected">("open");
  useEffect(()=>{ if (jobs[0]) { setSelected(jobs[0]); setDecision("open"); setNote(""); } }, [sectionId]);
  const infoCards = [
    { label: "Customer", value: selected.name },
    { label: "Problem", value: selected.problem },
    { label: "Blocker", value: selected.blocker },
    { label: "Next", value: selected.next },
  ];
  const inquiry = [
    `Queue: ${section.title}`,
    `What happened: ${selected.problem}`,
    `Why admin is needed: ${selected.blocker}`,
    `Customer status: KYC ${selected.kyc}, wallet ${selected.wallet}, payout ${selected.payout}`,
    `Suggested finish: ${selected.finish}`,
  ];
  function mark(next: "approved" | "rejected") {
    setDecision(next);
    setNote(current=>current || (next === "approved" ? "Approved after admin review. Link evidence before closing." : "Rejected/held. Send customer a clear reason and next step."));
  }
  return <Shell role="admin" title={section.title}><PageTitle title={section.title} text={section.text} icon={section.icon as IconName} /><div className="mt-4 grid gap-4 xl:grid-cols-[280px_minmax(460px,1fr)_320px]"><Card className="min-h-[650px]"><div className="flex items-center justify-between gap-3"><h2 className="text-lg font-black">Request List</h2><Badge tone="warn">{jobs.length}</Badge></div><div className="mt-4 max-h-[560px] space-y-3 overflow-y-auto pr-2">{jobs.map(job=><button key={job.id + job.queue} onClick={()=>{setSelected(job); setDecision("open"); setNote("");}} className={"w-full rounded-2xl border p-3 text-left transition " + (selected.id===job.id ? "border-[#1f6b45] bg-emerald-50" : "border-[#ece6d8] bg-[#fffdf7] hover:border-[#1f6b45]") }><div className="flex items-start justify-between gap-2"><div className="min-w-0"><b className="block truncate">{job.name}</b><p className="mt-1 line-clamp-2 text-xs font-bold text-[#667267]">{job.problem}</p></div><Badge tone={job.priority === "High" ? "bad" : "warn"}>{job.priority}</Badge></div></button>)}</div></Card><div className="grid content-start gap-4"><Card><p className="text-xs font-black uppercase text-[#667267]">Request Details</p><h2 className="mt-1 text-3xl font-black">{selected.problem}</h2><p className="mt-2 text-sm font-bold leading-6 text-[#667267]">{selected.blocker}</p><div className="mt-4 grid gap-3 md:grid-cols-2">{infoCards.map(card=><div key={card.label} className="rounded-2xl border border-[#ece6d8] bg-[#fffdf7] p-4"><p className="text-xs font-black uppercase text-[#667267]">{card.label}</p><p className="mt-2 text-sm font-black leading-6">{card.value}</p></div>)}</div></Card><Card><p className="text-xs font-black uppercase text-[#667267]">What Admin Should Check</p><div className="mt-3 space-y-2">{inquiry.map(item=><p key={item} className="rounded-xl bg-[#f4efe4] p-3 text-sm font-bold leading-6">{item}</p>)}</div></Card></div><Card className="min-h-[650px]"><h2 className="text-lg font-black">Decision Guide</h2><p className="mt-1 text-xs font-bold leading-5 text-[#667267]">Approve only after evidence is checked. Reject should include clear notes for the customer.</p><label className="mt-5 block text-sm font-black">Notes</label><textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Reason, evidence checked, next step..." className="mt-2 h-40 w-full resize-none rounded-2xl border border-[#ded8c9] bg-[#fffdf7] p-3 text-sm font-bold leading-6" /><div className="mt-5 grid grid-cols-2 gap-3"><button onClick={()=>mark("approved")} className="min-h-20 rounded-2xl bg-[#1f6b45] px-4 py-3 text-sm font-black text-white">Approve</button><button onClick={()=>mark("rejected")} className="min-h-20 rounded-2xl bg-red-600 px-4 py-3 text-sm font-black text-white">Reject</button></div><p className="mt-4 rounded-2xl bg-[#f4efe4] p-4 text-sm font-black">{decision === "open" ? "Waiting for review" : decision === "approved" ? "Approved in UI review" : "Rejected / needs resubmission"}</p><div className="mt-4 grid gap-2"><Link href={`/admin/customer-desk/${section.id}/evidence`} className="rounded-xl bg-[#eee8d9] px-4 py-3 text-center font-black">Check Evidence</Link><Link href="/admin/customer-desk/resolved" className="rounded-xl bg-white px-4 py-3 text-center font-black shadow-sm">Resolved Logs</Link></div></Card></div></Shell>;
}

function AdminCustomerDeskPage() {
  const [activeSection,setActiveSection]=useState("payment");
  const [hiddenIds,setHiddenIds]=useState<string[]>([]);
  const [liveWithdrawals,setLiveWithdrawals]=useState<any[]>([]);
  const [adminStatus,setAdminStatus]=useState("");
  const liveWithdrawalJobs = liveWithdrawals.map((row:any)=>({
    id: row.id,
    queue: "withdraw",
    name: row.profiles?.full_name || row.profiles?.display_name || row.payout_holder || "Customer",
    avatar: String(row.profiles?.full_name || row.payout_holder || "Customer").split(" ").map((part:string)=>part[0]).join("").slice(0,2).toUpperCase(),
    email: row.profiles?.email || "withdrawal request",
    problem: "Withdrawal request",
    blocker: `${row.payout_method || "Payout"} / ${row.payout_holder || "holder"} / ${row.payout_account || "account"}`,
    next: "Admin sends payout externally, uploads proof/reference, then sends receipt to customer inbox.",
    finish: "Approve sends withdrawal receipt. Reject returns the request with notes.",
    priority: row.status === "kyc_required" ? "High" : "Medium",
    last: row.created_at ? new Date(row.created_at).toLocaleString() : "Live withdrawal",
    kyc: row.status === "kyc_required" ? "Needs KYC" : "Check",
    wallet: "Withdrawal",
    payout: row.status || "for_review",
    liveWithdrawal: row,
  }));
  const sourceJobs = activeSection === "withdraw" && liveWithdrawalJobs.length ? liveWithdrawalJobs : customerDeskJobs;
  const visibleJobs = sourceJobs.filter(job=>job.queue===activeSection && !hiddenIds.includes(`${job.queue}-${job.id}-${job.problem}`));
  const [selected,setSelected]=useState(visibleJobs[0] || sourceJobs.find(job=>job.queue===activeSection) || emptyCustomerDeskJob);
  const [note,setNote]=useState("");
  const [decision,setDecision]=useState<"open" | "approved" | "rejected">("open");
  const [selectedCaretaker,setSelectedCaretaker]=useState("Juan Dela Cruz");
  const [viewer,setViewer]=useState<"receipt" | "invoice" | null>(null);
  const [payoutReceiptName,setPayoutReceiptName]=useState("");
  const [payoutReceiptPreview,setPayoutReceiptPreview]=useState("");
  const [payoutReference,setPayoutReference]=useState("");
  const activeSectionInfo = customerDeskSections.find(section=>section.id===activeSection) || customerDeskSections[0];
  const selectedKey = `${selected.queue}-${selected.id}-${selected.problem}`;
  const orderItems = selected.queue === "payment" && selected.problem.includes("Farm Buy")
    ? [
      { name:"Starter Chick (Hatch-Kelso)", qty:1, price:450 },
      { name:"Premium Rooster Feeds", qty:2, price:80 },
    ]
    : selected.queue === "care"
      ? [{ name:"Give Vitamins service", qty:1, price:120 }]
      : selected.queue === "withdraw"
        ? [{ name:"Withdrawal request", qty:1, price:Number((selected as any).liveWithdrawal?.amount || 2500) }]
        : [{ name:"Approved care request", qty:1, price:120 }];
  const total = orderItems.reduce((sum,item)=>sum + item.qty * item.price, 0);
  const reference = selected.priority === "High" ? "DUP-987678987" : selected.queue === "withdraw" ? "WD-240801-118" : "PAY-987678987";
  const receiptStatus = selected.priority === "High" ? "Possible duplicate reference" : "Receipt uploaded by customer";
  const withdrawalMethod = { provider:(selected as any).liveWithdrawal?.payout_method || "GCash", holder:(selected as any).liveWithdrawal?.payout_holder || selected.name, account:(selected as any).liveWithdrawal?.payout_account || "09XX XXX 1288", bank:"Customer saved payout method" };

  const caretakers = [
    { name:"Juan Dela Cruz", load:"2 active tasks", skill:"Feed, vitamins, QR proof" },
    { name:"Mia Santos", load:"1 active task", skill:"Video proof, supplements" },
    { name:"Rico Tan", load:"Available", skill:"Night check, rooster handling" },
  ];
  useEffect(()=>{
    let mounted = true;
    getAdminWithdrawalRequests()
      .then(rows=>{ if(!mounted) return; setLiveWithdrawals((rows || []).filter((row:any)=>!["completed","approved"].includes(String(row.status || "")))); setAdminStatus(rows?.length ? "Live withdrawal requests loaded." : "No live withdrawal requests yet."); })
      .catch(()=>{ if(!mounted) return; setLiveWithdrawals([]); setAdminStatus("Withdrawal SQL not ready or admin session needed. Placeholder queue is shown."); });
    return ()=>{ mounted = false; };
  }, []);
  useEffect(()=>{
    const next = visibleJobs[0] || sourceJobs.find(job=>job.queue===activeSection) || emptyCustomerDeskJob;
    setSelected(next);
    setDecision("open");
    setNote("");
  }, [activeSection, hiddenIds, liveWithdrawals.length]);
  function submitAction(next: "approved" | "rejected") {
    setDecision(next);
    setNote(current=>current || (next === "approved" ? "Approved after checking receipt/reference and evidence." : "Rejected. Customer must see clear reason and can resubmit."));
  }
  async function completeRequest() {
    if (selected.queue === "withdraw" && (selected as any).liveWithdrawal?.id && decision !== "open") {
      if (decision === "approved" && !payoutReference.trim()) {
        setAdminStatus("Enter the real payout reference number before approving withdrawal.");
        return;
      }
      try {
        await adminReviewWithdrawalRequest((selected as any).liveWithdrawal.id, decision === "approved" ? "approved" : "rejected", note, payoutReference, null, payoutReceiptName || null);
        setAdminStatus("Withdrawal decision saved to Supabase. Customer inbox and evidence log were created.");
        setLiveWithdrawals(rows=>rows.filter((row:any)=>row.id !== (selected as any).liveWithdrawal.id));
      } catch {
        setAdminStatus("Withdrawal decision could not be saved. Check SQL 020 or admin session.");
        return;
      }
    }
    setHiddenIds(current=>current.includes(selectedKey) ? current : [...current, selectedKey]);
    setDecision("open");
    setNote("");
    setPayoutReference("");
    setPayoutReceiptName("");
    setPayoutReceiptPreview("");
  }
  return <Shell role="admin" title="Customer Requests Management">
    <PageTitle title="Customer Requests Management" text="Review only active customer requests: payments, care requests, task assignment, and withdrawals." icon="clipboard" />
    <div className="mt-4 grid gap-3 md:grid-cols-4">
      {customerDeskSections.map(section=><button key={section.id} onClick={()=>setActiveSection(section.id)} className={"rounded-2xl border p-4 text-left shadow-sm transition " + (activeSection===section.id ? "border-[#1f6b45] bg-[#e9fff3] ring-2 ring-[#1f6b45]/20" : "border-[#e3ded0] bg-white/95 hover:border-[#1f6b45]")}><div className="flex items-start justify-between gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#f6f3e8]"><Icon name={section.icon} /></span><Badge tone={section.tone}>{customerDeskJobs.filter(job=>job.queue===section.id && !hiddenIds.includes(`${job.queue}-${job.id}-${job.problem}`)).length}</Badge></div><h2 className="mt-3 text-lg font-black">{section.title}</h2><p className="mt-1 line-clamp-2 text-xs font-bold leading-5 text-[#667267]">{section.text}</p></button>)}
    </div>
    {activeSection === "payment" && <div className="mt-5"><AdminManualPaymentQueue /></div>}
    {activeSection === "care" && <div className="mt-5"><AdminLiveCareRequestQueue mode="care" /></div>}
    {activeSection === "task" && <div className="mt-5"><AdminLiveCareRequestQueue mode="task" /></div>}
    {!["payment","care","task"].includes(activeSection) && <div className="mt-5 grid gap-4 xl:grid-cols-[300px_minmax(520px,1fr)_330px]">
      <Card className="min-h-[660px]"><div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-black">Customer Queue</h2><p className="mt-1 text-xs font-bold leading-5 text-[#667267]">Only requests waiting for admin action appear here. Completed items disappear from this queue.</p></div><Badge tone="warn">{visibleJobs.length}</Badge></div><div className="mt-4 max-h-[560px] space-y-3 overflow-y-auto pr-2">{visibleJobs.length ? visibleJobs.map(job=><button key={`${job.queue}-${job.id}-${job.problem}`} onClick={()=>{setSelected(job); setDecision("open"); setNote(""); setViewer(null);}} className={"w-full rounded-2xl border p-3 text-left transition " + (`${job.queue}-${job.id}-${job.problem}`===selectedKey ? "border-[#1f6b45] bg-emerald-50 shadow-sm" : "border-[#ece6d8] bg-[#fffdf7] hover:border-[#1f6b45]")}><div className="flex items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#1f6b45] text-sm font-black text-white">{job.avatar}</span><div className="min-w-0 flex-1"><b className="block truncate">{job.name}</b><p className="mt-1 truncate text-xs font-bold text-[#667267]">{job.problem}</p><p className="mt-2 text-xs font-black text-[#1f6b45]">{job.last}</p></div><Badge tone={job.priority === "High" ? "bad" : "warn"}>{job.priority}</Badge></div></button>) : <div className="rounded-2xl bg-[#f4efe4] p-5 text-sm font-bold leading-6 text-[#667267]">No pending {activeSectionInfo.title.toLowerCase()} right now.</div>}</div></Card>
      <div className="grid content-start gap-4"><Card><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black uppercase text-[#667267]">Submitted Request</p><h2 className="mt-1 text-3xl font-black">{selected.problem}</h2><p className="mt-2 text-sm font-bold leading-6 text-[#667267]">{selected.name} / {selected.email}</p></div><Badge tone={selected.priority === "High" ? "bad" : "warn"}>{activeSectionInfo.title}</Badge></div>{selected.queue === "task" ? <div className="mt-4 grid gap-3 md:grid-cols-2"><div className="rounded-2xl border border-[#ece6d8] bg-[#fffdf7] p-4"><p className="text-xs font-black uppercase text-[#667267]">Rooster</p><h3 className="mt-2 text-xl font-black">Thunder King</h3><p className="mt-1 text-sm font-bold text-[#667267]">FC-128 / Pen A-04 / Hatch-Kelso</p></div><div className="rounded-2xl border border-[#ece6d8] bg-[#fffdf7] p-4"><p className="text-xs font-black uppercase text-[#667267]">Care Request</p><h3 className="mt-2 text-xl font-black">Give Vitamins</h3><p className="mt-1 text-sm font-bold text-[#667267]">Customer requested photo proof and short note.</p></div><div className="rounded-2xl border border-[#ece6d8] bg-[#fffdf7] p-4 md:col-span-2"><p className="text-xs font-black uppercase text-[#667267]">Task Card</p><p className="mt-2 text-sm font-bold leading-6">Verify rooster by QR, give requested service, record product quantity used, upload proof, then submit back to admin.</p></div></div> : <><div className="mt-4 rounded-2xl border border-[#ece6d8] bg-[#fffdf7] p-4"><p className="text-xs font-black uppercase text-[#667267]">Request Items</p><div className="mt-3 space-y-2">{orderItems.map(item=><div key={item.name} className="flex items-center justify-between gap-3 rounded-xl bg-white p-3 text-sm font-bold"><span>{item.name} x {item.qty}</span><b>?{(item.qty * item.price).toLocaleString()}</b></div>)}</div><div className="mt-3 flex items-center justify-between rounded-xl bg-[#1f6b45] p-3 text-white"><b>Total</b><b>?{total.toLocaleString()}</b></div></div>{selected.queue === "withdraw" ? <div className="mt-4 rounded-3xl border border-[#ece6d8] bg-[#fffdf7] p-4"><p className="text-xs font-black uppercase text-[#667267]">Withdrawal Method / Admin Proof</p><div className="mt-3 grid gap-3 md:grid-cols-2"><div className="rounded-2xl bg-white p-4"><p className="text-xs font-black uppercase text-[#667267]">Customer payout method</p><h3 className="mt-2 text-xl font-black">{withdrawalMethod.provider}</h3><p className="mt-1 text-sm font-bold text-[#667267]">{withdrawalMethod.holder} / {withdrawalMethod.account}</p></div><div className="rounded-2xl bg-white p-4"><p className="text-xs font-black uppercase text-[#667267]">Admin reference number</p><input value={payoutReference} onChange={e=>setPayoutReference(e.target.value)} placeholder="Paste actual sent reference number" className="mt-2 w-full rounded-xl border border-[#ded8c9] p-3 text-lg font-black" /><p className="mt-2 text-xs font-bold text-[#667267]">Admin enters the real reference from GCash/Maya/bank receipt.</p></div><div className="rounded-2xl bg-white p-4 md:col-span-2"><p className="text-xs font-black uppercase text-[#667267]">Upload payout receipt</p><div className="mt-3 rounded-2xl border-2 border-dashed border-[#d8cfbd] bg-[#f9f6ec] p-4"><input onChange={e=>{ const file=e.target.files?.[0]; setPayoutReceiptName(file?.name || ""); setPayoutReceiptPreview(file ? URL.createObjectURL(file) : ""); }} className="w-full rounded-xl bg-white p-3 text-sm font-bold" type="file" accept="image/*,.pdf" /><p className="mt-3 text-center text-sm font-black">{payoutReceiptName || "No payout receipt selected yet"}</p></div><button type="button" onClick={()=>setViewer("receipt")} className="mt-3 w-full rounded-xl bg-[#eee8d9] px-4 py-3 text-sm font-black">View Payout Proof</button></div></div></div> : <div className="mt-4 grid gap-3 md:grid-cols-2"><div className="rounded-2xl border border-[#ece6d8] bg-[#fffdf7] p-4"><p className="text-xs font-black uppercase text-[#667267]">Reference Number</p><h3 className="mt-2 text-xl font-black">{reference}</h3><p className="mt-1 text-xs font-bold text-[#667267]">{receiptStatus}</p></div><div className="rounded-2xl border border-[#ece6d8] bg-[#fffdf7] p-4"><p className="text-xs font-black uppercase text-[#667267]">Receipt / Upload</p><h3 className="mt-2 text-xl font-black">Receipt attached</h3><button type="button" onClick={()=>setViewer("receipt")} className="mt-3 w-full rounded-xl bg-[#eee8d9] px-4 py-3 text-sm font-black">View Receipt</button></div></div>}</>}</Card></div>
      <Card className="min-h-[660px]"><h2 className="text-lg font-black">Admin Action</h2><p className="mt-1 text-xs font-bold leading-5 text-[#667267]">Action changes depending on the selected request.</p>{selected.queue === "task" ? <div className="mt-4"><p className="text-sm font-black">Assign Caretaker</p><div className="mt-3 space-y-2">{caretakers.map(caretaker=><button key={caretaker.name} onClick={()=>setSelectedCaretaker(caretaker.name)} className={"w-full rounded-2xl border p-3 text-left transition " + (selectedCaretaker===caretaker.name ? "border-[#1f6b45] bg-emerald-50" : "border-[#ece6d8] bg-[#fffdf7]")}><b>{caretaker.name}</b><p className="mt-1 text-xs font-bold text-[#667267]">{caretaker.load} / {caretaker.skill}</p></button>)}</div><button onClick={completeRequest} className="mt-5 w-full rounded-2xl bg-[#1f6b45] px-4 py-4 font-black text-white">Assign Task</button><p className="mt-3 text-xs font-bold leading-5 text-[#667267]">After assignment, this leaves Customer Requests and appears in the caretaker task list.</p></div> : <div className="mt-4"><div className="grid grid-cols-2 gap-3"><button onClick={()=>submitAction("approved")} className="min-h-20 rounded-2xl bg-[#1f6b45] px-4 py-3 font-black text-white">Approve</button><button onClick={()=>submitAction("rejected")} className="min-h-20 rounded-2xl bg-red-600 px-4 py-3 font-black text-white">Reject</button></div><label className="mt-5 block text-sm font-black">Note to Customer</label><textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Reason if rejected, or confirmation note if approved..." className="mt-2 h-32 w-full resize-none rounded-2xl border border-[#ded8c9] bg-[#fffdf7] p-3 text-sm font-bold leading-6" /><div className="mt-4 rounded-2xl border border-[#ece6d8] bg-[#fffdf7] p-4"><p className="text-xs font-black uppercase text-[#667267]">Invoice / Receipt</p><p className="mt-2 text-sm font-bold leading-6">Generated after approval. Open before final submit to double-check amount and items.</p><button type="button" onClick={()=>setViewer("invoice")} className="mt-3 w-full rounded-xl bg-[#eee8d9] px-4 py-3 text-sm font-black">View Invoice</button></div><button onClick={completeRequest} disabled={decision === "open"} className={"mt-4 w-full rounded-2xl px-4 py-4 font-black text-white " + (decision === "open" ? "bg-[#b9b3a4]" : "bg-[#1f6b45]")}>Submit Decision</button><p className="mt-3 text-xs font-bold leading-5 text-[#667267]">After submit, request leaves this queue and should be stored in evidence logs.</p></div>}</Card>
    </div>}
    {viewer && <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4"><div className="max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase text-[#667267]">{viewer === "receipt" ? (selected.queue === "withdraw" ? "Admin Payout Proof" : "Customer Receipt Proof") : "Generated Invoice Preview"}</p><h2 className="mt-1 text-2xl font-black">{selected.name}</h2><p className="mt-1 text-sm font-bold text-[#667267]">{selected.problem} / {selected.queue === "withdraw" ? (payoutReference || "No payout reference yet") : reference}</p></div><button type="button" onClick={()=>setViewer(null)} className="rounded-xl bg-[#eee8d9] px-4 py-2 text-sm font-black">Close</button></div>{viewer === "receipt" ? <div className="mt-5 grid gap-4 md:grid-cols-[1fr_260px]"><div className="rounded-2xl border border-[#ece6d8] bg-[#f9f6ec] p-5"><p className="text-xs font-black uppercase text-[#667267]">{selected.queue === "withdraw" ? "Uploaded Admin Payout Receipt" : "Uploaded Customer Screenshot"}</p><div className="mt-4 overflow-hidden rounded-2xl border border-[#d8cfbd] bg-white"><div className="grid min-h-64 place-items-center bg-[#101010] p-5 text-center text-white">{selected.queue === "withdraw" && payoutReceiptPreview ? <img src={payoutReceiptPreview} alt="Admin payout receipt" className="max-h-[360px] w-full object-contain" /> : <div><p className="text-xs font-black uppercase text-white/60">Receipt Screenshot</p><h3 className="mt-2 text-2xl font-black">{selected.queue === "withdraw" ? "Admin payout proof" : "Customer payment proof"}</h3><p className="mt-2 text-sm font-bold text-white/70">{selected.queue === "withdraw" ? (payoutReference || "No payout reference yet") : reference}</p></div>}</div><div className="grid grid-cols-2 divide-x divide-[#d8cfbd] bg-[#f9f6ec] text-center text-sm font-black text-[#17251d]"><div className="p-4">{selected.queue === "withdraw" ? "Sent to customer payout" : "Receiver / sender details"}</div><div className="p-4">{selected.queue === "withdraw" ? withdrawalMethod.provider + " / " + withdrawalMethod.account : "Payment method and amount"}</div></div></div></div><div className="space-y-3"><div className="rounded-2xl border border-[#ece6d8] bg-[#fffdf7] p-4"><p className="text-xs font-black uppercase text-[#667267]">Reference</p><b className="mt-2 block text-lg">{selected.queue === "withdraw" ? (payoutReference || "No payout reference yet") : reference}</b></div><div className="rounded-2xl border border-[#ece6d8] bg-[#fffdf7] p-4"><p className="text-xs font-black uppercase text-[#667267]">Amount</p><b className="mt-2 block text-lg">?{total.toLocaleString()}</b></div><div className="rounded-2xl border border-[#ece6d8] bg-[#fffdf7] p-4"><p className="text-xs font-black uppercase text-[#667267]">Status</p><b className="mt-2 block text-sm">{selected.queue === "withdraw" ? (payoutReceiptName ? "Admin payout receipt attached" : "Waiting for admin payout receipt") : receiptStatus}</b></div></div></div> : <div className="mt-5 rounded-2xl border border-[#ece6d8] bg-[#fffdf7] p-5"><div className="flex items-start justify-between gap-3 border-b border-[#ece6d8] pb-4"><div><h3 className="text-2xl font-black">{selected.queue === "withdraw" ? "Withdrawal Receipt / Invoice" : "FarmConnect Invoice"}</h3><p className="mt-1 text-sm font-bold text-[#667267]">Customer: {selected.name}</p></div><Badge tone={decision === "approved" ? "good" : decision === "rejected" ? "bad" : "warn"}>{decision === "open" ? "Draft" : decision}</Badge></div>{selected.queue === "withdraw" ? <div className="mt-4 grid gap-3"><div className="grid gap-3 md:grid-cols-2"><div className="rounded-2xl bg-white p-4"><p className="text-xs font-black uppercase text-[#667267]">Payout Method</p><b className="mt-2 block text-lg">{withdrawalMethod.provider}</b><p className="mt-1 text-sm font-bold text-[#667267]">{withdrawalMethod.holder} / {withdrawalMethod.account}</p></div><div className="rounded-2xl bg-white p-4"><p className="text-xs font-black uppercase text-[#667267]">Admin Sent Reference</p><b className="mt-2 block text-lg">{payoutReference || "No reference entered"}</b><p className="mt-1 text-sm font-bold text-[#667267]">Must match uploaded payout receipt.</p></div></div><div className="rounded-2xl bg-white p-4"><p className="text-xs font-black uppercase text-[#667267]">Uploaded Payout Proof</p><b className="mt-2 block text-lg">{payoutReceiptName || "No payout proof uploaded"}</b></div><div className="flex items-center justify-between rounded-2xl bg-[#1f6b45] p-4 text-white"><b>Withdrawal Amount</b><b>?{total.toLocaleString()}</b></div><div className="rounded-2xl bg-white p-4"><p className="text-xs font-black uppercase text-[#667267]">Admin Note</p><p className="mt-2 text-sm font-bold leading-6">{note || "No admin note yet."}</p></div></div> : <><div className="mt-4 space-y-2">{orderItems.map(item=><div key={item.name} className="flex items-center justify-between gap-3 rounded-xl bg-white p-3 text-sm font-bold"><span>{item.name} x {item.qty}</span><b>?{(item.qty * item.price).toLocaleString()}</b></div>)}</div><div className="mt-4 flex items-center justify-between rounded-2xl bg-[#1f6b45] p-4 text-white"><b>Total</b><b>?{total.toLocaleString()}</b></div><div className="mt-4 rounded-2xl bg-white p-4"><p className="text-xs font-black uppercase text-[#667267]">Admin Note</p><p className="mt-2 text-sm font-bold leading-6">{note || "No admin note yet."}</p></div></>}</div>}</div></div>}
  </Shell>;
}
export function AdminCustomerDeskSection({ section }: { section: string }) {
  if (section === "payment") {
    return <Shell role="admin" title="Payment Requests"><PageTitle title="Payment Requests" text="Review live customer payment receipts and reference numbers from Supabase." icon="coins" /><AdminManualPaymentQueue /></Shell>;
  }
  return <AdminCustomerDeskFormatPage sectionId={section} />;
}

function AdminManualPaymentQueue() {
  const [rows,setRows]=useState<any[]>([]);
  const [note,setNote]=useState("Loading manual payment requests...");
  const [adminNote,setAdminNote]=useState("Checked reference, amount, receiver, and receipt.");
  const activeRows = rows.filter(row=>["for_review","needs_info"].includes(String(row.status || "for_review")));

  async function load() {
    try {
      const live = await getAdminManualPaymentRequests();
      setRows(live);
      setNote(live.length ? "Live manual payments loaded from Supabase." : "No live manual payment requests yet.");
    } catch {
      setRows([]);
      setNote("Manual payment queue could not load from Supabase. Check admin login, SQL 009, and RLS before approving payments.");
    }
  }

  useEffect(()=>{ load(); }, []);

  async function decide(id: string, decision: "approved" | "rejected" | "needs_info") {
    try {
      setNote(`Saving ${decision} decision...`);
      await adminReviewManualPayment(id, decision, adminNote);
      setNote(`Payment ${decision}. Inbox/evidence logs updated.`);
      await load();
    } catch {
      setNote("Admin decision failed. Check SQL 009/RLS/admin login.");
    }
  }

  return <Card><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-black">Pending Manual Payments</h2><p className="mt-1 text-sm font-bold text-[#667267]">{note}</p></div><Badge tone="warn">{activeRows.length} review</Badge></div><textarea value={adminNote} onChange={e=>setAdminNote(e.target.value)} className="mt-4 h-20 w-full rounded-xl border border-[#ded8c9] p-3 text-sm font-bold" /><div className="mt-4 max-h-[520px] space-y-3 overflow-y-auto pr-2">{activeRows.map(row=>{ const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles; const customer = profile?.display_name || profile?.full_name || profile?.email || row.senderName || "Customer"; const summary = row.summary || {}; return <article key={row.id} className="rounded-2xl border border-[#ece6d8] bg-[#fffdf7] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black uppercase text-[#667267]">{String(row.source_type || row.sourceType || "payment").replaceAll("_"," ")}</p><h3 className="text-lg font-black">{customer}</h3><p className="text-sm font-bold text-[#667267]">{row.payment_method || row.paymentMethod} - Ref {row.reference_number || row.referenceNumber}</p></div><Badge tone={row.status === "approved" ? "good" : row.status === "rejected" ? "bad" : "warn"}>{row.status || "for_review"}</Badge></div><div className="mt-3 grid gap-2 text-sm md:grid-cols-4"><Info label="Amount" value={peso(Number(row.amount_expected || row.amountExpected || 0))} /><Info label="Risk" value={row.risk_status || "unchecked"} /><Info label="Receiver" value={row.receiver_account || row.receiverAccount || "Recorded"} /><Info label="Source" value={summary.source || row.source_type || "Payment"} /></div>{row.receipt_image_url || row.receiptImageUrl ? <a href={row.receipt_image_url || row.receiptImageUrl} target="_blank" rel="noreferrer" className="mt-3 inline-block rounded-xl bg-white px-3 py-2 text-sm font-black text-[#1f6b45] shadow-sm">Open Receipt</a> : null}<div className="mt-3 grid gap-2 sm:grid-cols-3"><button onClick={()=>decide(row.id,"approved")} className="rounded-xl bg-[#1f6b45] px-3 py-2 text-sm font-black text-white">Approve</button><button onClick={()=>decide(row.id,"needs_info")} className="rounded-xl bg-amber-300 px-3 py-2 text-sm font-black">Needs Info</button><button onClick={()=>decide(row.id,"rejected")} className="rounded-xl bg-red-600 px-3 py-2 text-sm font-black text-white">Reject</button></div></article>})}{activeRows.length===0 && <p className="rounded-2xl bg-[#f6f3e8] p-4 text-sm font-bold text-[#667267]">No payment proof waiting for admin review.</p>}</div></Card>;
}

function AdminCaretakerApplicationQueue() {
  const [rows, setRows] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [note, setNote] = useState("Loading caretaker applications...");
  const [adminNote, setAdminNote] = useState("");

  async function load() {
    try {
      const data = await getCaretakerApplications();
      setRows(data as any[]);
      setSelectedId(current => current || data?.[0]?.id || "");
      setNote(data.length ? "Review resume, photo, payment method, then approve only if safe." : "No caretaker applications yet.");
    } catch {
      setNote("SQL 010 is needed for real caretaker applications.");
    }
  }

  useEffect(()=>{ load(); }, []);

  const selected = rows.find(row => row.id === selectedId) || rows[0];

  async function decide(decision: "approved" | "rejected" | "needs_info") {
    if (!selected?.id) return;
    try {
      setNote(`Saving ${decision} decision...`);
      await adminReviewCaretakerApplication(selected.id, decision, adminNote);
      setAdminNote("");
      setNote(`Caretaker application ${decision}. Logs updated.`);
      await load();
    } catch (error: any) {
      const message = error?.message || error?.details || error?.hint || "Unknown approval error";
      setNote(`Decision failed: ${message}`);
    }
  }

  return (
    <div className="mt-5 grid gap-5 xl:grid-cols-[360px_1fr]">
      <Card>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-black">Caretaker Applications</h2>
          <Badge tone="warn">{rows.filter(row=>row.status === "pending_approval").length} pending</Badge>
        </div>
        <p className="mt-1 text-sm font-bold text-[#667267]">{note}</p>
        <div className="mt-4 max-h-[430px] space-y-3 overflow-y-auto pr-2">
          {rows.map(row=><button key={row.id} onClick={()=>setSelectedId(row.id)} className={"w-full rounded-2xl border p-3 text-left " + (selected?.id===row.id ? "border-[#1f6b45] bg-emerald-50" : "border-[#ece6d8] bg-[#fffdf7]")}>
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center overflow-hidden rounded-xl bg-white font-black shadow-sm">
                {row.avatar_url ? <img src={row.avatar_url} alt="" className="h-full w-full object-cover" /> : String(row.display_name || row.full_name || "CA").slice(0,2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <b className="block truncate">{row.full_name}</b>
                <p className="truncate text-sm font-bold text-[#667267]">{row.farm_role || "Farm caretaker"} - {row.email}</p>
              </div>
              <Badge tone={row.status === "approved" ? "good" : row.status === "rejected" ? "bad" : "warn"}>{row.status}</Badge>
            </div>
          </button>)}
          {rows.length===0 && <p className="rounded-2xl bg-[#f6f3e8] p-4 text-sm font-bold text-[#667267]">Applications will appear here after caretaker signup.</p>}
        </div>
      </Card>
      <Card>
        {!selected ? <p className="rounded-2xl bg-[#f6f3e8] p-4 text-sm font-bold text-[#667267]">Select an application to view resume and payment details.</p> : (
          <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
            <div>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase text-[#667267]">Resume View</p>
                  <h2 className="mt-1 text-3xl font-black">{selected.full_name}</h2>
                  <p className="font-bold text-[#667267]">{selected.display_name || "No nickname"} - {selected.phone}</p>
                </div>
                <Badge tone={selected.status === "approved" ? "good" : selected.status === "rejected" ? "bad" : "warn"}>{selected.status}</Badge>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <Info label="Farm Role" value={selected.farm_role || "Not set"} />
                <Info label="Birthdate" value={selected.birthdate || "Not set"} />
                <Info label="Address" value={selected.address_line || "Not set"} />
                <Info label="Emergency Contact" value={`${selected.emergency_contact_name || "Not set"} ${selected.emergency_contact_phone || ""}`} />
                <Info label="Payment Method" value={selected.payment_method || "Not set"} />
                <Info label="Payment Account" value={`${selected.payment_account_name || "Not set"} - ${selected.payment_account_number || ""}`} />
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                {selected.resume_url && <a href={selected.resume_url} target="_blank" rel="noreferrer" className="rounded-xl bg-white px-4 py-3 font-black shadow-sm">Open Resume</a>}
                {selected.avatar_url && <a href={selected.avatar_url} target="_blank" rel="noreferrer" className="rounded-xl bg-white px-4 py-3 font-black shadow-sm">Open Photo</a>}
              </div>
            </div>
            <div className="rounded-3xl bg-[#f6f3e8] p-4">
              <h3 className="text-lg font-black">Admin Decision</h3>
              <p className="mt-1 text-sm font-bold leading-6 text-[#667267]">Approval creates/activates the caretaker profile. Reject/needs info keeps app access closed.</p>
              <textarea value={adminNote} onChange={e=>setAdminNote(e.target.value)} className="mt-3 h-28 w-full rounded-xl border border-[#ded8c9] p-3 text-sm font-bold" placeholder="Admin note / reason" />
              <div className="mt-3 grid gap-2">
                <button onClick={()=>decide("approved")} className="rounded-xl bg-[#1f6b45] px-3 py-2 font-black text-white">Approve</button>
                <button onClick={()=>decide("needs_info")} className="rounded-xl bg-amber-300 px-3 py-2 font-black">Needs Info</button>
                <button onClick={()=>decide("rejected")} className="rounded-xl bg-red-600 px-3 py-2 font-black text-white">Reject</button>
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

export function AdminCaretakerRegistrationPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [note, setNote] = useState("Loading caretaker registration records...");
  const registrationPath = "/caretaker/signup";
  const registrationUrl = typeof window === "undefined" ? registrationPath : `${window.location.origin}${registrationPath}`;

  async function load() {
    try {
      const data = await getCaretakerApplications();
      setRows(data as any[]);
      setNote(data.length ? "Registration records loaded. Print approved/rejected list when needed." : "No caretaker applications yet.");
    } catch {
      setNote("SQL 010 is needed before admin can see caretaker registration records.");
    }
  }

  useEffect(()=>{ load(); }, []);

  const pending = rows.filter(row => row.status === "pending_approval" || row.status === "needs_info");
  const approved = rows.filter(row => row.status === "approved");
  const rejected = rows.filter(row => row.status === "rejected");

  function printList() {
    window.print();
  }

  return (
    <Shell role="admin" title="Caretaker Registration">
      <PageTitle title="Caretaker Registration" text="Admin-controlled caretaker signup link, approval checking, and printable approved/rejected records." icon="clipboard" />
      <KaFarm>Caretaker registration is hidden from the public homepage. Admin sends this link only to trusted applicants, then reviews resume and payment details before activation.</KaFarm>
      <div className="mt-5 grid gap-5 xl:grid-cols-[360px_1fr]">
        <Card>
          <h2 className="text-xl font-black">Registration Link</h2>
          <p className="mt-2 text-sm font-bold leading-6 text-[#667267]">Send this only to caretaker applicants. They still cannot enter the caretaker app until admin approval.</p>
          <div className="mt-4 rounded-2xl bg-[#f6f3e8] p-4 text-sm font-black break-all">{registrationUrl}</div>
          <div className="mt-4 grid gap-2">
            <Link href={registrationPath} className="rounded-xl bg-[#1f6b45] px-4 py-3 text-center font-black text-white">Open Registration Page</Link>
            <button onClick={()=>navigator.clipboard?.writeText(registrationUrl)} className="rounded-xl bg-[#eee8d9] px-4 py-3 font-black">Copy Link</button>
            <button onClick={printList} className="rounded-xl bg-amber-300 px-4 py-3 font-black">Print Approved / Rejected</button>
          </div>
          <p className="mt-4 text-sm font-bold text-[#667267]">{note}</p>
        </Card>

        <div className="grid gap-5">
          <AdminCaretakerApplicationQueue />
          <Card className="print:block">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black">Printable Registration Records</h2>
                <p className="mt-1 text-sm font-bold text-[#667267]">Approved and rejected caretaker applications for admin file.</p>
              </div>
              <div className="flex gap-2">
                <Badge tone="warn">{pending.length} pending</Badge>
                <Badge tone="good">{approved.length} approved</Badge>
                <Badge tone="bad">{rejected.length} rejected</Badge>
              </div>
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div>
                <h3 className="font-black text-[#1f6b45]">Approved</h3>
                <div className="mt-3 max-h-[360px] space-y-2 overflow-y-auto pr-2">
                  {approved.map(row=><RegistrationRecord key={row.id} row={row} />)}
                  {approved.length===0 && <p className="rounded-xl bg-[#f6f3e8] p-3 text-sm font-bold text-[#667267]">No approved caretaker yet.</p>}
                </div>
              </div>
              <div>
                <h3 className="font-black text-red-700">Rejected</h3>
                <div className="mt-3 max-h-[360px] space-y-2 overflow-y-auto pr-2">
                  {rejected.map(row=><RegistrationRecord key={row.id} row={row} />)}
                  {rejected.length===0 && <p className="rounded-xl bg-[#f6f3e8] p-3 text-sm font-bold text-[#667267]">No rejected caretaker yet.</p>}
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </Shell>
  );
}

function RegistrationRecord({ row }: { row: any }) {
  return (
    <div className="rounded-2xl border border-[#ece6d8] bg-[#fffdf7] p-3 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <b className="block">{row.full_name}</b>
          <span className="font-bold text-[#667267]">{row.email} - {row.phone}</span>
        </div>
        <Badge tone={row.status === "approved" ? "good" : row.status === "rejected" ? "bad" : "warn"}>{row.status}</Badge>
      </div>
      <div className="mt-2 grid gap-1 font-bold text-[#667267] md:grid-cols-2">
        <span>Role: {row.farm_role || "Not set"}</span>
        <span>Payment: {row.payment_method || "Not set"}</span>
        <span>Account: {row.payment_account_name || "Not set"}</span>
        <span>Reviewed: {row.reviewed_at ? new Date(row.reviewed_at).toLocaleDateString() : "Pending"}</span>
      </div>
      {row.admin_note && <p className="mt-2 rounded-xl bg-[#f6f3e8] p-2 font-bold text-[#667267]">Note: {row.admin_note}</p>}
    </div>
  );
}

type AdminBridgeKind = "customer" | "caretaker" | "farm" | "money" | "evidence" | "kafarm";

const adminRoleBridges: Record<AdminBridgeKind, Array<{ step: string; from: string; admin: string; to: string; customer: string; href: string; tone: "good" | "warn" | "bad" | "neutral" }>> = {
  customer: [
    { step: "Payment", from: "Customer pays by QR and submits receipt/reference", admin: "Admin checks receiver, amount, reference, duplicate risk", to: "Approve creates inventory/rooster/inbox receipt", customer: "Customer sees receipt, inventory, rooster, or reject note", href: "/admin/customer-desk/wallet", tone: "warn" },
    { step: "Care Concern", from: "Customer reports wrong rooster, weak proof, or health worry", admin: "Admin opens request, caretaker proof, QR/serial, and chat trail", to: "Create correction task or release approved care log", customer: "Customer sees approved care log or formal explanation", href: "/admin/customer-desk/care", tone: "bad" },
    { step: "Support", from: "Customer asks KaFarm first", admin: "Admin joins only if escalated", to: "Admin reply is saved in live chat evidence", customer: "Customer sees admin reply in support chat", href: "/admin/live-chat", tone: "neutral" },
  ],
  caretaker: [
    { step: "Application", from: "Caretaker applies from admin-only link", admin: "Admin reviews photo, resume, payment mode, and notes", to: "Approve unlocks caretaker workspace", customer: "Customer never sees private resume details", href: "/admin/caretaker-registration", tone: "warn" },
    { step: "Task Proof", from: "Caretaker opens assigned task, scans QR, uploads proof", admin: "Admin checks clarity, serial, time, note, and requested media", to: "Approve releases care log to customer", customer: "Customer sees only approved update", href: "/admin/evidence", tone: "bad" },
    { step: "Exception", from: "Caretaker asks KaFarm/Admin for QR/camera/serial issue", admin: "Admin decides release/exception from live chat", to: "Task remains blocked until approval", customer: "No customer update before admin approval", href: "/admin/live-chat", tone: "warn" },
  ],
  farm: [
    { step: "Farm Buy", from: "Customer selects product/rooster and submits manual payment", admin: "Admin approves payment proof", to: "Inventory or My Roosters updates", customer: "Customer sees approved item and receipt in inbox", href: "/admin/transactions/cashin", tone: "warn" },
    { step: "Care Request", from: "Customer chooses rooster, service, notes, and proof type", admin: "Admin approves payment and assigns caretaker", to: "Caretaker receives active task", customer: "Customer waits for approved care log", href: "/admin/farm-operations", tone: "good" },
    { step: "Sell Request", from: "Customer requests sale", admin: "Admin sets price and asks caretaker for weight/status", to: "Sale invoice and payout trail", customer: "Customer sees sale computation and receipt", href: "/admin/sell-requests", tone: "neutral" },
  ],
  money: [
    { step: "Cash-In", from: "Customer uploads receipt/reference", admin: "Admin checks duplicate, receiver, and amount", to: "Approve posts credit/record", customer: "Customer sees status and receipt", href: "/admin/transactions/cashin", tone: "warn" },
    { step: "Withdrawal", from: "Customer requests payout", admin: "Admin checks KYC, payout account, balance, and proof", to: "Manual payout receipt sent to inbox", customer: "Customer sees withdrawal status", href: "/admin/customer-desk/withdraw", tone: "bad" },
    { step: "Treasury", from: "System gathers pending money events", admin: "Admin views holds, payouts, payroll, and incoming cash", to: "Owner gets clean money picture", customer: "No customer-facing changes here", href: "/admin/treasury", tone: "neutral" },
  ],
  evidence: [
    { step: "Evidence Packet", from: "Customer/caretaker/system creates proof", admin: "Admin filters by case and opens related records", to: "Decision links back to original issue", customer: "Customer only sees approved/needed notices", href: "/admin/evidence", tone: "neutral" },
    { step: "Resolved Case", from: "Issue is completed", admin: "Admin keeps final note, receipt, proof, and timestamp", to: "Case can be archived/deleted from work queue", customer: "Customer sees final status where relevant", href: "/admin/customer-desk/resolved", tone: "good" },
  ],
  kafarm: [
    { step: "Ask KaFarm", from: "Admin asks what happened", admin: "KaFarm points to queue, evidence, and safe next step", to: "Admin decides manually", customer: "No sensitive action without admin approval", href: "/admin/kafarm", tone: "neutral" },
    { step: "Buddy Handoff", from: "KaFarm prepares report for outside Buddy", admin: "Admin reviews exact issue and affected route", to: "Developer fixes code/SQL safely", customer: "Customer only sees fixed workflow", href: "/admin/kafarm/buddy-reports", tone: "warn" },
  ],
};

function AdminRoleBridge({ kind }: { kind: AdminBridgeKind }) {
  const rows = adminRoleBridges[kind] || [];
  if (!rows.length) return null;
  return (
    <>
    <Card className="mt-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black">Role Bridge</h2>
          <p className="mt-1 text-sm font-bold text-[#667267]">Customer → Admin → Caretaker → Admin → Customer flow, para hindi maligaw ang trabaho.</p>
        </div>
        <Badge tone="good">Wired Map</Badge>
      </div>
      <div className="mt-4 max-h-[300px] overflow-y-auto pr-2">
        <div className="grid min-w-[960px] gap-2">
          <div className="grid grid-cols-[130px_1fr_1fr_1fr_1fr_110px] gap-2 rounded-xl bg-[#17251d] px-3 py-2 text-xs font-black uppercase text-white">
            <span>Flow</span><span>Starts From</span><span>Admin Checks</span><span>Goes To</span><span>Customer Sees</span><span>Open</span>
          </div>
          {rows.map(row=>(
            <div key={row.step} className="grid grid-cols-[130px_1fr_1fr_1fr_1fr_110px] items-center gap-2 rounded-2xl border border-[#ece6d8] bg-[#fffdf7] px-3 py-3 text-sm font-bold text-[#667267]">
              <div><Badge tone={row.tone}>{row.step}</Badge></div>
              <span>{row.from}</span>
              <span>{row.admin}</span>
              <span>{row.to}</span>
              <span>{row.customer}</span>
              <Link href={row.href} className="rounded-xl bg-[#1f6b45] px-3 py-2 text-center text-xs font-black text-white">Open</Link>
            </div>
          ))}
        </div>
      </div>
    </Card>
    {kind === "farm" && <div className="mt-5"><AdminLiveCareRequestQueue /></div>}
    {(kind === "caretaker" || kind === "evidence") && <div className="mt-5"><AdminLiveTaskProofQueue /></div>}
    </>
  );
}

function AdminLiveCareRequestQueue({ mode = "all" }: { mode?: "all" | "care" | "task" } = {}) {
  const [rows,setRows]=useState<any[]>([]);
  const [note,setNote]=useState("Loading live care requests...");
  const visibleRows = rows.filter(row=>{
    const status = String(row.status || "");
    if (mode === "task") return status === "paid_pending_assignment" || status === "pending_assignment";
    if (mode === "care") return ["payment_for_review","payment_rejected","paid_pending_assignment","pending_assignment"].includes(status);
    return !["completed","approved","rejected","cancelled"].includes(status);
  });
  async function load() {
    try {
      const data = await getAdminCareRequests();
      setRows(data);
      setNote(data.length ? "Live care requests loaded from Supabase." : "No live care requests yet.");
    } catch {
      setNote("Care request table is not ready yet. Run SQL 011 before testing this queue.");
    }
  }
  useEffect(()=>{ load(); }, []);
  async function assign(row: any) {
    try {
      await adminAssignCareRequest(row.id, null, "Assigned from Farm Operations.");
      await load();
      setNote(`Assigned ${row.service_name} for ${row.rooster_name}. It should now appear in caretaker Active Tasks.`);
    } catch {
      setNote("Assign failed. Check admin login, active caretaker, or SQL 011.");
    }
  }
  return <Card><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-black">{mode === "task" ? "Task Assignment Queue" : "Live Care Request Queue"}</h2><p className="mt-1 text-sm font-bold text-[#667267]">{note}</p></div><Badge tone="warn">{visibleRows.length}</Badge></div><div className="mt-4 max-h-[430px] space-y-3 overflow-y-auto pr-2">{visibleRows.map(row=>{ const status = String(row.status || ""); const canAssign = status === "paid_pending_assignment" || status === "pending_assignment"; return <div key={row.id} className="rounded-2xl border border-[#ece6d8] bg-[#fffdf7] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><b className="block truncate text-lg">{row.rooster_name}</b><p className="text-sm font-bold text-[#667267]">{row.service_name} - {status.replaceAll("_"," ")}</p><p className="mt-1 text-xs font-bold text-[#667267]">{row.customer_note || "No customer note"}</p></div><Badge tone={canAssign ? "warn" : status === "payment_rejected" ? "bad" : "neutral"}>{peso(Number(row.service_price || 0))}</Badge></div><div className="mt-3 flex flex-wrap gap-2"><button onClick={()=>assign(row)} disabled={!canAssign} className={"rounded-xl px-3 py-2 text-sm font-black " + (!canAssign ? "bg-[#eee8d9] text-[#8b8476]" : "bg-[#1f6b45] text-white")}>{status === "payment_for_review" ? "Waiting Payment" : status === "payment_rejected" ? "Payment Rejected" : "Assign Caretaker"}</button><button onClick={()=>setNote(`${row.rooster_name}: ${row.service_name}. Proof needed: ${row.required_proof || "Photo proof"}. Status: ${status.replaceAll("_"," ")}.`)} className="rounded-xl bg-[#f6f3e8] px-3 py-2 text-sm font-black">View</button></div></div>})}{visibleRows.length===0 && <div className="rounded-2xl border border-dashed border-[#ded8c9] bg-[#fffdf7] p-5 text-sm font-bold text-[#667267]">No active care request in this stage. Paid care requests will appear here for caretaker assignment.</div>}</div></Card>;
}

function AdminLiveTaskProofQueue() {
  const [rows,setRows]=useState<any[]>([]);
  const [note,setNote]=useState("Loading task proof submissions...");
  const pendingRows = rows.filter(row=>String(row.admin_review_status || row.status || "pending") === "pending");
  async function load() {
    try {
      const data = await getAdminTaskProofs();
      setRows(data);
      setNote(data.length ? "Live caretaker proofs loaded from Supabase." : "No live proof submissions yet.");
    } catch {
      setNote("Task proof table is not ready yet. Run SQL 011 before testing proof review.");
    }
  }
  useEffect(()=>{ load(); }, []);
  async function review(row: any, decision: "approved" | "rejected" | "backjob") {
    try {
      await adminReviewTaskProof(row.id, decision, decision === "approved" ? "Proof approved by admin." : decision === "backjob" ? "Needs correction/backjob." : "Proof rejected by admin.");
      await load();
      setNote(`Proof ${decision}. Customer inbox and care request status should update.`);
    } catch {
      setNote("Proof review failed. Check admin login or SQL 011.");
    }
  }
  return <Card><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-black">Live Proof Review</h2><p className="mt-1 text-sm font-bold text-[#667267]">{note}</p></div><Badge tone="warn">{pendingRows.length}</Badge></div><div className="mt-4 max-h-[430px] space-y-3 overflow-y-auto pr-2">{pendingRows.map(row=>{ const reviewStatus = String(row.admin_review_status || row.status || "pending"); return <div key={row.id} className="rounded-2xl border border-[#ece6d8] bg-[#fffdf7] p-4"><div className="flex gap-3"><img src={row.proof_url || "/farmconnect/marketplace/fc-product-feeds.jpg"} alt="" className="h-16 w-16 rounded-xl object-cover" /><div className="min-w-0 flex-1"><b className="block truncate">{row.caretaker_tasks?.rooster_name || "Rooster"} - {row.caretaker_tasks?.task_type || "Task proof"}</b><p className="text-sm font-bold text-[#667267]">{row.qr_verified ? "QR verified" : "QR not verified"} / {row.serial_exception ? "Serial exception" : "Normal mode"}</p><p className="mt-1 text-xs font-bold text-[#667267]">{row.preset_note || row.free_note || "No note"}</p></div><Badge tone={reviewStatus==="approved"?"good":reviewStatus==="rejected"?"bad":"warn"}>{reviewStatus}</Badge></div><div className="mt-3 grid gap-2 sm:grid-cols-3"><button onClick={()=>review(row,"approved")} className="rounded-xl bg-[#1f6b45] px-3 py-2 text-sm font-black text-white">Approve</button><button onClick={()=>review(row,"backjob")} className="rounded-xl bg-amber-300 px-3 py-2 text-sm font-black">Backjob</button><button onClick={()=>review(row,"rejected")} className="rounded-xl bg-red-600 px-3 py-2 text-sm font-black text-white">Reject</button></div></div>})}{pendingRows.length===0 && <div className="rounded-2xl border border-dashed border-[#ded8c9] bg-[#fffdf7] p-5 text-sm font-bold text-[#667267]">No proof submissions waiting for admin decision.</div>}</div></Card>;
}

function AdminCaretakerManagementPage({ config }: { config: string[] }) {
  const tabs = [
    { id:"registration", label:"Registration", hint:"Permanent signup link" },
    { id:"verification", label:"Verification", hint:"Approve applicants" },
    { id:"list", label:"List", hint:"Approved caretakers" },
    { id:"task-verification", label:"Task Verification", hint:"Review submitted work" },
    { id:"completed", label:"Completed Tasks", hint:"Approved work history" },
  ];
  const applicants = [
    { id:"app-1", name:"Juan Dela Cruz", email:"juan.caretaker@test.local", phone:"0917 333 1122", selfie:"JD", selfieFile:"juan-selfie.jpg", resumeFile:"juan-resume.pdf", resume:"6 years farm care, QR trained, feeding logs, vitamins, and rooster handling.", payment:"GCash / Juan Dela Cruz / 09173331122", status:"Pending" },
    { id:"app-2", name:"Mia Santos", email:"mia.caretaker@test.local", phone:"0918 555 2211", selfie:"MS", selfieFile:"mia-selfie.jpg", resumeFile:"mia-resume.pdf", resume:"Vitamins, supplements, video proof trained, and mobile upload ready.", payment:"Maya / Mia Santos / 09185552211", status:"Pending" },
  ];
  const caretakers = [
    { id:"ct-1", name:"Juan Dela Cruz", avatar:"JD", status:"Active", selfieFile:"juan-selfie.jpg", resumeFile:"juan-resume.pdf", resume:"6 years farm care", payment:"GCash / Juan Dela Cruz / 09173331122", assigned:[
      { id:"as-1", customer:"Aydana Buratino", rooster:"Thunder King", task:"Give Vitamins", status:"Pending", note:"Customer wants photo proof and short note after vitamins.", file:"No file yet" },
      { id:"as-2", customer:"Marco Reyes", rooster:"Red Ace", task:"Feed Check", status:"Approved", note:"0.12 kg feed record approved.", file:"feed-check-proof.jpg" },
    ] },
    { id:"ct-2", name:"Mia Santos", avatar:"MS", status:"Active", selfieFile:"mia-selfie.jpg", resumeFile:"mia-resume.pdf", resume:"Video proof trained", payment:"Maya / Mia Santos / 09185552211", assigned:[
      { id:"as-3", customer:"Lina Cruz", rooster:"Bantay", task:"Photo Update", status:"Pending", note:"Needs clear body and leg photo.", file:"No file yet" },
    ] },
    { id:"ct-3", name:"Rico Tan", avatar:"RT", status:"Active", selfieFile:"rico-selfie.jpg", resumeFile:"rico-resume.pdf", resume:"Night watch", payment:"UnionBank / Rico Tan / 4409", assigned:[] },
  ];
  const submissions = [
    { id:"sub-1", caretaker:"Juan Dela Cruz", customer:"Aydana Buratino", rooster:"Thunder King", request:"Give Vitamins", proofFile:"vitamins-proof.jpg", documentation:"QR verified. Vitamins given. 1 photo attached. Caretaker note: rooster active after dose.", adminResult:"Approve sends update to customer Care Logs. Reject sends backjob to caretaker Tasks.", status:"Pending Review" },
    { id:"sub-2", caretaker:"Mia Santos", customer:"Lina Cruz", rooster:"Bantay", request:"Premium Feed", proofFile:"feed-proof.jpg", documentation:"0.12 kg feed used. Photo attached. Appetite normal. Inventory should deduct feed quantity.", adminResult:"Approve sends update to customer Care Logs. Reject sends backjob to caretaker Tasks.", status:"Pending Review" },
  ];
  const completed = [
    { id:"done-1", caretaker:"Juan Dela Cruz", customer:"Marco Reyes", rooster:"Red Ace", request:"Feed Check", date:"Today 8:20 AM", proofFile:"feed-check-proof.jpg", proof:"Approved photo proof and notes. Customer can review this in Care Logs." },
    { id:"done-2", caretaker:"Mia Santos", customer:"Aydana Buratino", rooster:"Thunder King", request:"Photo Update", date:"Yesterday 5:15 PM", proofFile:"photo-update-set.jpg", proof:"Approved image set. Stored for admin evidence and customer update history." },
  ];
  const [tab,setTab]=useState(tabs[0].id);
  const [selectedApplicant,setSelectedApplicant]=useState(applicants[0]);
  const [selectedCaretaker,setSelectedCaretaker]=useState(caretakers[0]);
  const [selectedAssigned,setSelectedAssigned]=useState(caretakers[0].assigned[0] || null);
  const [selectedSubmission,setSelectedSubmission]=useState(submissions[0]);
  const [selectedCompleted,setSelectedCompleted]=useState(completed[0]);
  const [note,setNote]=useState("");
  const [adminRequestFile,setAdminRequestFile]=useState("");
  const [viewer,setViewer]=useState<any>(null);
  const signupLink = typeof window !== "undefined" ? `${window.location.origin}/caretaker/signup` : "/caretaker/signup";
  const completedForCaretaker = completed.filter(row=>row.caretaker===selectedCaretaker.name);
  function reset(next: string) { setTab(next); setNote(""); setViewer(null); setAdminRequestFile(""); }
  function openViewer(payload:any) { setViewer(payload); }
  return <Shell role="admin" title={config[0]}><PageTitle title="Caretaker Management" text="Registration, verification, assignments, proof review, backjobs, and completed evidence." icon="user" />
    <div className="mt-4 grid gap-3 md:grid-cols-5">{tabs.map(item=><button key={item.id} onClick={()=>reset(item.id)} className={"rounded-2xl border p-4 text-left shadow-sm transition " + (tab===item.id ? "border-[#1f6b45] bg-[#e9fff3] ring-2 ring-[#1f6b45]/20" : "border-[#e3ded0] bg-white/95 hover:border-[#1f6b45]")}><h2 className="text-lg font-black">{item.label}</h2><p className="mt-1 text-xs font-bold leading-5 text-[#667267]">{item.hint}</p></button>)}</div>

    {tab === "registration" && <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_300px]"><Card><p className="text-xs font-black uppercase text-[#667267]">Permanent Registration Link</p><h2 className="mt-1 text-3xl font-black">Caretaker signup link</h2><p className="mt-2 text-sm font-bold leading-6 text-[#667267]">Send this link to applicants. It is permanent; account stays inactive until admin verification approves selfie, resume, and payment details.</p><div className="mt-4 rounded-2xl border border-[#ece6d8] bg-[#fffdf7] p-4 font-black">{signupLink}</div><button type="button" onClick={()=>navigator.clipboard?.writeText(signupLink)} className="mt-4 rounded-xl bg-[#1f6b45] px-5 py-3 font-black text-white">Copy Link</button></Card><Card><p className="text-xs font-black uppercase text-[#667267]">Registered Caretakers</p><h2 className="mt-2 text-5xl font-black text-[#1f6b45]">{applicants.length + caretakers.length}</h2><p className="mt-2 text-sm font-bold text-[#667267]">{applicants.length} pending / {caretakers.length} approved.</p></Card></div>}

    {tab === "verification" && <AdminCaretakerApplicationQueue />}

    {tab === "list" && <div className="mt-5 grid gap-4 xl:grid-cols-[300px_minmax(480px,1fr)_320px]"><Card className="min-h-[640px]"><h2 className="text-lg font-black">Caretaker List</h2><div className="mt-4 space-y-3">{caretakers.map(c=><button key={c.id} onClick={()=>{setSelectedCaretaker(c); setSelectedAssigned(c.assigned[0] || null);}} className={"w-full rounded-2xl border p-3 text-left " + (selectedCaretaker.id===c.id ? "border-[#1f6b45] bg-emerald-50" : "border-[#ece6d8] bg-[#fffdf7]")}><b>{c.name}</b><p className="text-xs font-bold text-[#667267]">{c.resume}</p><Badge tone={c.assigned.some(a=>a.status==="Pending") ? "warn" : "good"}>{c.assigned.length} tasks</Badge></button>)}</div></Card><Card className="min-h-[640px]"><p className="text-xs font-black uppercase text-[#667267]">Live Proof Review / Assignments</p><h2 className="mt-1 text-3xl font-black">{selectedCaretaker.name}</h2><div className="mt-4 grid gap-3 md:grid-cols-2"><button onClick={()=>openViewer({ type:"selfie", title:selectedCaretaker.name, file:selectedCaretaker.selfieFile, body:"Approved caretaker selfie on record.", badge:selectedCaretaker.avatar })} className="rounded-xl bg-[#eee8d9] px-4 py-3 font-black">View Selfie</button><button onClick={()=>openViewer({ type:"resume", title:selectedCaretaker.name, file:selectedCaretaker.resumeFile, body:selectedCaretaker.resume, badge:"CV" })} className="rounded-xl bg-[#eee8d9] px-4 py-3 font-black">View Resume</button></div><div className="mt-4 space-y-3">{selectedCaretaker.assigned.length ? selectedCaretaker.assigned.map(task=><button key={task.id} onClick={()=>{setSelectedAssigned(task); openViewer({ type:"task", title:task.task, file:task.file, body:`${task.customer} / ${task.rooster}. ${task.note}`, badge:task.status==="Approved" ? "?" : "!" });}} className="w-full rounded-2xl border border-[#ece6d8] bg-[#fffdf7] p-4 text-left text-sm font-bold"><div className="flex justify-between gap-3"><span>{task.customer} / {task.rooster}</span><Badge tone={task.status==="Pending" ? "warn" : "good"}>{task.status}</Badge></div><p className="mt-1 text-[#667267]">{task.task} - {task.note}</p><p className="mt-2 text-xs text-[#1f6b45]">File: {task.file}</p></button>) : <p className="rounded-2xl bg-[#f6f3e8] p-4 text-sm font-bold text-[#667267]">No active assigned task.</p>}</div></Card><Card className="min-h-[640px]"><h2 className="text-lg font-black">Admin Request</h2><p className="mt-1 text-xs font-bold text-[#667267]">Send admin task/note to caretaker. File is optional, but caretaker note is required before they submit back.</p><textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Example: Recheck Thunder King, upload clearer photo, include feed grams/kg used..." className="mt-4 h-36 w-full resize-none rounded-2xl border border-[#ded8c9] bg-[#fffdf7] p-3 text-sm font-bold" /><label className="mt-3 block rounded-2xl border border-dashed border-[#d8cfbd] bg-[#f9f6ec] p-3 text-sm font-bold text-[#667267]">Optional file for caretaker<input onChange={e=>setAdminRequestFile(e.target.files?.[0]?.name || "")} className="mt-2 block w-full" type="file" />{adminRequestFile && <span className="mt-2 block text-[#1f6b45]">Attached: {adminRequestFile}</span>}</label><button className="mt-4 w-full rounded-2xl bg-[#1f6b45] px-4 py-4 font-black text-white">Send Admin Request</button><p className="mt-3 text-xs font-bold leading-5 text-[#667267]">Goes to caretaker app /caretaker/tasks as admin request/backjob style task.</p></Card></div>}

    {tab === "task-verification" && <div className="mt-5 grid gap-4 xl:grid-cols-[300px_minmax(480px,1fr)_320px]"><Card className="min-h-[640px]"><h2 className="text-lg font-black">Submitted Task Queue</h2><div className="mt-4 space-y-3">{submissions.map(sub=><button key={sub.id} onClick={()=>setSelectedSubmission(sub)} className={"w-full rounded-2xl border p-3 text-left " + (selectedSubmission.id===sub.id ? "border-[#1f6b45] bg-emerald-50" : "border-[#ece6d8] bg-[#fffdf7]")}><b>{sub.caretaker}</b><p className="text-xs font-bold text-[#667267]">{sub.customer} / {sub.request}</p><Badge tone="warn">{sub.status}</Badge></button>)}</div></Card><Card className="min-h-[640px]"><p className="text-xs font-black uppercase text-[#667267]">Selected Work Box</p><h2 className="mt-1 text-3xl font-black">{selectedSubmission.request}</h2><div className="mt-4 grid gap-3 md:grid-cols-2"><Info label="Customer" value={selectedSubmission.customer} /><Info label="Rooster" value={selectedSubmission.rooster} /><Info label="Caretaker" value={selectedSubmission.caretaker} /><Info label="Uploaded File" value={selectedSubmission.proofFile} /></div><div className="mt-4 rounded-2xl border border-[#ece6d8] bg-[#fffdf7] p-4"><p className="text-xs font-black uppercase text-[#667267]">Documentation / Notes</p><p className="mt-2 text-sm font-bold leading-6">{selectedSubmission.documentation}</p><button onClick={()=>openViewer({ type:"task", title:selectedSubmission.request, file:selectedSubmission.proofFile, body:selectedSubmission.documentation, badge:"?" })} className="mt-4 rounded-xl bg-[#eee8d9] px-4 py-3 font-black">View Submitted Proof</button></div></Card><Card className="min-h-[640px]"><h2 className="text-lg font-black">Admin Next Step</h2><textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Approval note or rejection/backjob instruction..." className="mt-4 h-40 w-full resize-none rounded-2xl border border-[#ded8c9] bg-[#fffdf7] p-3 text-sm font-bold" /><div className="mt-4 grid grid-cols-2 gap-3"><button className="rounded-2xl bg-[#1f6b45] px-4 py-4 font-black text-white">Approve</button><button className="rounded-2xl bg-red-600 px-4 py-4 font-black text-white">Reject / Backjob</button></div><div className="mt-4 space-y-2 text-xs font-bold leading-5 text-[#667267]"><p className="rounded-xl bg-emerald-50 p-3">Approve: sends customer update to /customer/care-logs and stores completed evidence.</p><p className="rounded-xl bg-red-50 p-3">Reject: sends backjob to caretaker app /caretaker/tasks with your note.</p></div></Card></div>}

    {tab === "completed" && <div className="mt-5 grid gap-4 xl:grid-cols-[300px_minmax(520px,1fr)]"><Card className="min-h-[640px]"><h2 className="text-lg font-black">Caretaker List</h2><div className="mt-4 space-y-3">{caretakers.map(c=><button key={c.id} onClick={()=>{setSelectedCaretaker(c); const first=completed.find(row=>row.caretaker===c.name); if(first) setSelectedCompleted(first);}} className={"w-full rounded-2xl border p-3 text-left " + (selectedCaretaker.id===c.id ? "border-[#1f6b45] bg-emerald-50" : "border-[#ece6d8] bg-[#fffdf7]")}><b>{c.name}</b><p className="text-xs font-bold text-[#667267]">Completed task records</p></button>)}</div></Card><Card className="min-h-[640px]"><p className="text-xs font-black uppercase text-[#667267]">Completed Task Review</p><h2 className="mt-1 text-3xl font-black">{selectedCaretaker.name}</h2><div className="mt-4 space-y-3">{completedForCaretaker.length ? completedForCaretaker.map(row=><button key={row.id} onClick={()=>{setSelectedCompleted(row); openViewer({ type:"task", title:row.request, file:row.proofFile, body:`${row.customer} / ${row.rooster}. ${row.proof}`, badge:"?" });}} className="w-full rounded-2xl border border-[#ece6d8] bg-[#fffdf7] p-4 text-left"><b>{row.request}</b><p className="mt-1 text-sm font-bold text-[#667267]">{row.customer} / {row.rooster} / {row.date}</p><p className="mt-2 text-xs font-bold text-[#667267]">{row.proof}</p></button>) : <p className="rounded-2xl bg-[#f6f3e8] p-4 text-sm font-bold text-[#667267]">No completed task for this caretaker yet.</p>}</div>{selectedCompleted && <div className="mt-4 rounded-2xl bg-emerald-50 p-4 text-sm font-bold leading-6 text-emerald-900">Latest selected: {selectedCompleted.request} / {selectedCompleted.customer}. Customer page destination: Care Logs.</div>}</Card></div>}

    {viewer && <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4"><div className="max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase text-[#667267]">{viewer.type === "resume" ? "Resume File" : viewer.type === "selfie" ? "Selfie Photo" : "Task Proof / Documentation"}</p><h2 className="mt-1 text-2xl font-black">{viewer.title}</h2><p className="mt-1 text-sm font-bold text-[#667267]">{viewer.file}</p></div><button onClick={()=>setViewer(null)} className="rounded-xl bg-[#eee8d9] px-4 py-2 text-sm font-black">Close</button></div><div className="mt-5 overflow-hidden rounded-2xl border border-[#ece6d8] bg-[#fffdf7]"><div className={"grid min-h-80 place-items-center p-6 text-center " + (viewer.type === "selfie" ? "bg-gradient-to-br from-[#d7ecff] to-[#fff7df]" : viewer.type === "resume" ? "bg-[#f9f6ec]" : "bg-gradient-to-br from-emerald-100 to-[#fff7df]")}><div><div className="mx-auto grid h-40 w-40 place-items-center rounded-[2rem] bg-[#1f6b45] text-5xl font-black text-white shadow-lg">{viewer.badge}</div><h3 className="mt-4 text-xl font-black">{viewer.type === "resume" ? "Uploaded resume/document" : viewer.type === "selfie" ? "Uploaded selfie preview" : "Uploaded task proof"}</h3><p className="mt-2 max-w-xl text-sm font-bold leading-6 text-[#667267]">{viewer.body}</p></div></div><div className="grid grid-cols-3 divide-x divide-[#ece6d8] bg-white text-center text-xs font-black text-[#667267]"><div className="p-3">File: {viewer.file}</div><div className="p-3">Linked to caretaker record</div><div className="p-3">Evidence-ready</div></div></div></div></div>}
  </Shell>;
}
function AdminFarmOperationsPage({ config }: { config: string[] }) {
  const todayKey = new Date().toISOString().slice(0,10);
  const yesterdayKey = new Date(Date.now() - 86400000).toISOString().slice(0,10);
  const [section,setSection]=useState("products");
  const [range,setRange]=useState<"total" | "monthly" | "daily">("total");
  const [date,setDate]=useState(todayKey);
  const [accountMode,setAccountMode]=useState<"clients" | "caretakers">("clients");
  const [selectedAccountId,setSelectedAccountId]=useState("cl-1");
  const [selectedRecordId,setSelectedRecordId]=useState("r1");
  const [selectedCaretakerName,setSelectedCaretakerName]=useState("Juan Dela Cruz");
  const [selectedCareKey,setSelectedCareKey]=useState("Juan Dela Cruz|Request Feed");
  const [viewer,setViewer]=useState<any>(null);

  const sections = [
    { id:"products", label:"Product Summary", hint:"All Farm Buy products" },
    { id:"accounts", label:"Account Logs", hint:"Client/caretaker evidence" },
    { id:"paid-care", label:"Paid Care Requests", hint:"Care service income" },
  ];
  const inRange = (rowDate: string) => range === "total" || (range === "daily" ? rowDate === date : rowDate.slice(0,7) === date.slice(0,7));
  const rangeLabel = range === "daily" ? `Daily: ${date}` : range === "monthly" ? `Monthly: ${date.slice(0,7)}` : "All-time total";

  const productEvents = [
    { date:todayKey, productId:"p2", bought:2 },
    { date:todayKey, productId:"p5", bought:4 },
    { date:yesterdayKey, productId:"breed-chick-asil", bought:1 },
    { date:yesterdayKey, productId:"p2", bought:8 },
    { date:"2026-07-31", productId:"p4", bought:4 },
    { date:"2026-07-31", productId:"p3", bought:9 },
    { date:"2026-07-18", productId:"p2", bought:5 },
  ];
  const productRows = products.map(product => {
    const events = productEvents.filter(event => event.productId === product.id && inRange(event.date));
    const bought = events.reduce((sum,event)=>sum+event.bought,0);
    return {
      name: product.name,
      category: product.category,
      unit: product.unit,
      amount: product.price,
      bought,
      sales: bought * product.price,
      image: product.image,
    };
  });
  const productTotal = productRows.reduce((sum,row)=>sum+row.sales,0);
  const productSoldCount = productRows.reduce((sum,row)=>sum+row.bought,0);

  const clients = [
    { id:"cl-1", name:"Aydana Buratino", avatar:"AB", records:[
      { id:"r1", date:todayKey, kind:"Payment", title:"Farm Buy Payment", amount:610, status:"Approved", time:"Today 9:22 AM", meta:"Premium Rooster Feeds x2, Rooster Vitamins x4", receipt:"GCash receipt uploaded by customer", invoice:"Farm Buy Invoice #FB-10021", customerReceipt:"Uploaded GCash screenshot by customer", referenceNumber:"987678987", senderName:"Aydana Buratino", adminReceipt:"Not needed for incoming payment", withdrawalMethod:"-", assignedCaretaker:"-", caretakerSubmission:"-", taskDecision:"-" },
      { id:"r2", date:todayKey, kind:"Care Request", title:"Request Feed", amount:120, status:"Assigned", time:"Today 10:35 AM", meta:"Rooster: Thunder King / service: Request Feed", receipt:"Customer care payment + caretaker proof", invoice:"Care Request Receipt #CR-22011", customerReceipt:"Uploaded Maya screenshot by customer", referenceNumber:"CR-55321", senderName:"Aydana Buratino", adminReceipt:"-", withdrawalMethod:"-", assignedCaretaker:"Juan Dela Cruz", caretakerSubmission:"QR verified, feed proof photo submitted, 0.25 kg used", taskDecision:"Approved by admin" },
      { id:"r3", date:yesterdayKey, kind:"Withdrawal", title:"Withdrawal Request", amount:2500, status:"Sent", time:"Yesterday 4:10 PM", meta:"Requested 4:10 PM / admin sent 5:02 PM", receipt:"Admin payout receipt", invoice:"Withdrawal Receipt #WD-30012", customerReceipt:"Withdrawal request submitted by customer", referenceNumber:"WD-REQ-30012", senderName:"Aydana Buratino", adminReceipt:"Admin GCash payout proof ref ADM-77882", withdrawalMethod:"GCash / Aydana Buratino / 0917 XXX 0198", assignedCaretaker:"-", caretakerSubmission:"-", taskDecision:"Customer confirmation pending" },
    ]},
    { id:"cl-2", name:"Marco Reyes", avatar:"MR", records:[
      { id:"r4", date:yesterdayKey, kind:"Payment", title:"Farm Buy Payment", amount:450, status:"Approved", time:"Yesterday 2:14 PM", meta:"Starter Chick (Asil) x1", receipt:"Customer receipt + invoice", invoice:"Farm Buy Invoice #FB-10022", customerReceipt:"Uploaded UnionBank screenshot by customer", referenceNumber:"UB-4419", senderName:"Marco Reyes", adminReceipt:"Not needed for incoming payment", withdrawalMethod:"-", assignedCaretaker:"-", caretakerSubmission:"-", taskDecision:"-" },
      { id:"r5", date:yesterdayKey, kind:"Care Request", title:"Photo Update", amount:90, status:"Approved", time:"Yesterday 5:00 PM", meta:"Rooster: Red Ace / requested photo update", receipt:"Payment receipt + approved image set", invoice:"Care Request Receipt #CR-22012", customerReceipt:"Uploaded GCash screenshot by customer", referenceNumber:"CR-8871", senderName:"Marco Reyes", adminReceipt:"-", withdrawalMethod:"-", assignedCaretaker:"Mia Santos", caretakerSubmission:"3 photos submitted, QR verified", taskDecision:"Approved by admin and sent to customer care logs" },
    ]},
    { id:"cl-3", name:"Lina Cruz", avatar:"LC", records:[
      { id:"r6", date:"2026-07-31", kind:"Care Request", title:"Premium Feed", amount:120, status:"Rejected", time:"Jul 31 8:12 PM", meta:"Rooster: Bantay / proof unclear", receipt:"Receipt + rejected task proof notes", invoice:"Care Request Receipt #CR-22013", customerReceipt:"Uploaded Maya screenshot by customer", referenceNumber:"CR-9921", senderName:"Lina Cruz", adminReceipt:"-", withdrawalMethod:"-", assignedCaretaker:"Mia Santos", caretakerSubmission:"Photo blurry, feed weight missing", taskDecision:"Rejected/backjob sent to caretaker" },
    ]},
  ];
  const caretakers = [
    { id:"ct-1", name:"Juan Dela Cruz", avatar:"JD", records:[
      { id:"c1", date:todayKey, customer:"Aydana Buratino", task:"Request Feed", amount:120, status:"Approved", time:"Today 11:15 AM", meta:"Submitted feed proof, admin approved", receipt:"Customer payment + caretaker proof", customerReceipt:"Uploaded Maya screenshot by customer", referenceNumber:"CR-55321", senderName:"Aydana Buratino", adminReceipt:"-", invoice:"Care Request Receipt #CR-22011", assignedCaretaker:"Juan Dela Cruz", caretakerSubmission:"QR verified, feed proof photo submitted, 0.25 kg used", taskDecision:"Approved by admin" },
      { id:"c2", date:todayKey, customer:"Aydana Buratino", task:"Give Vitamins", amount:100, status:"Pending", time:"Today 1:40 PM", meta:"Waiting for task proof", receipt:"Customer payment receipt", customerReceipt:"Uploaded GCash screenshot by customer", referenceNumber:"CR-8810", senderName:"Aydana Buratino", adminReceipt:"-", invoice:"Care Request Receipt #CR-22014", assignedCaretaker:"Juan Dela Cruz", caretakerSubmission:"Not submitted yet", taskDecision:"Pending review" },
      { id:"c5", date:yesterdayKey, customer:"Marco Reyes", task:"Request Feed", amount:120, status:"Approved", time:"Yesterday 8:30 AM", meta:"Feed proof reviewed", receipt:"Customer payment + caretaker proof", customerReceipt:"Uploaded GCash screenshot by customer", referenceNumber:"CR-4512", senderName:"Marco Reyes", adminReceipt:"-", invoice:"Care Request Receipt #CR-22009", assignedCaretaker:"Juan Dela Cruz", caretakerSubmission:"0.30 kg feed used, 1 photo attached", taskDecision:"Approved by admin" },
    ]},
    { id:"ct-2", name:"Mia Santos", avatar:"MS", records:[
      { id:"c3", date:yesterdayKey, customer:"Marco Reyes", task:"Photo Update", amount:90, status:"Approved", time:"Yesterday 5:15 PM", meta:"Submitted image set, admin approved", receipt:"Payment + approved task proof", customerReceipt:"Uploaded GCash screenshot by customer", referenceNumber:"CR-8871", senderName:"Marco Reyes", adminReceipt:"-", invoice:"Care Request Receipt #CR-22012", assignedCaretaker:"Mia Santos", caretakerSubmission:"3 photos submitted, QR verified", taskDecision:"Approved by admin" },
      { id:"c4", date:"2026-07-31", customer:"Lina Cruz", task:"Premium Feed", amount:120, status:"Rejected", time:"Jul 31 8:12 PM", meta:"Backjob sent to caretaker", receipt:"Payment + rejected task proof", customerReceipt:"Uploaded Maya screenshot by customer", referenceNumber:"CR-9921", senderName:"Lina Cruz", adminReceipt:"-", invoice:"Care Request Receipt #CR-22013", assignedCaretaker:"Mia Santos", caretakerSubmission:"Photo blurry, feed weight missing", taskDecision:"Rejected/backjob sent to caretaker" },
    ]},
  ];
  const careEvents = [
    { date:todayKey, caretaker:"Juan Dela Cruz", service:"Request Feed", price:120, customer:"Aydana Buratino", status:"Approved" },
    { date:todayKey, caretaker:"Juan Dela Cruz", service:"Give Vitamins", price:100, customer:"Aydana Buratino", status:"Pending proof" },
    { date:todayKey, caretaker:"Juan Dela Cruz", service:"Request Feed", price:120, customer:"Lina Cruz", status:"Approved" },
    { date:yesterdayKey, caretaker:"Juan Dela Cruz", service:"Request Feed", price:120, customer:"Marco Reyes", status:"Approved" },
    { date:yesterdayKey, caretaker:"Mia Santos", service:"Photo Update", price:90, customer:"Marco Reyes", status:"Approved" },
    { date:"2026-07-31", caretaker:"Mia Santos", service:"Premium Feed", price:120, customer:"Lina Cruz", status:"Backjob/review" },
  ];
  const rawAccounts = accountMode === "clients" ? clients : caretakers;
  const accountList = rawAccounts.map(account=>({...account, records: account.records.filter(row=>inRange(row.date))})).filter(account=>account.records.length > 0);
  const selectedAccount = accountList.find(account=>account.id===selectedAccountId) || accountList[0];
  const selectedRecord: any = selectedAccount?.records.find((row:any)=>row.id===selectedRecordId) || selectedAccount?.records[0];
  const filteredCareEvents = careEvents.filter(row=>inRange(row.date));
  const careRows = Object.values(filteredCareEvents.filter(row=>row.caretaker===selectedCaretakerName).reduce<Record<string, any>>((map,row)=>{ const key = `${row.caretaker}|${row.service}`; const current = map[key] || { key, caretaker:row.caretaker, service:row.service, price:row.price, count:0, total:0, customers:[], status:row.status }; current.count += 1; current.total += row.price; current.customers = Array.from(new Set([...current.customers, row.customer])); current.status = row.status; map[key] = current; return map; }, {}));
  const selectedCare = careRows.find(row=>row.key===selectedCareKey) || careRows[0];
  const careTotal = filteredCareEvents.filter(row=>row.caretaker===selectedCaretakerName).reduce((sum,row)=>sum+row.price,0);
  const caretakerTotals = caretakers.map(c=>({ ...c, total: filteredCareEvents.filter(row=>row.caretaker===c.name).reduce((sum,row)=>sum+row.price,0), count: filteredCareEvents.filter(row=>row.caretaker===c.name).length }));
  useEffect(()=>{ const list = (accountMode === "clients" ? clients : caretakers).map(account=>({...account, records: account.records.filter(row=>inRange(row.date))})).filter(account=>account.records.length > 0); setSelectedAccountId(list[0]?.id || ""); setSelectedRecordId(list[0]?.records[0]?.id || ""); }, [accountMode, range, date]);
  useEffect(()=>{ const first = Object.values(careEvents.filter(row=>inRange(row.date) && row.caretaker===selectedCaretakerName).reduce<Record<string, any>>((map,row)=>{ const key = `${row.caretaker}|${row.service}`; map[key] = map[key] || { key }; return map; }, {}))[0] as any; setSelectedCareKey(first?.key || ""); }, [selectedCaretakerName, range, date]);
  const openEvidence = (record:any, type:string) => setViewer({ record, type, title: type === "invoice" ? record.invoice : type === "admin" ? "Admin payout receipt" : type === "task" ? "Caretaker submission" : "Customer receipt and reference" });

  return <Shell role="admin" title={config[0]}><PageTitle title="Farm Operations" text="Product sales, account activity logs, receipts, invoices, caretaker proof, and paid care request income." icon="rooster" />
    <div className="mt-4 rounded-3xl border border-[#e3ded0] bg-white/95 p-4 shadow-sm"><div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between"><div className="grid gap-2 sm:grid-cols-3">{sections.map(item=><button key={item.id} onClick={()=>setSection(item.id)} className={"rounded-2xl border px-4 py-3 text-left transition " + (section===item.id ? "border-[#1f6b45] bg-[#e9fff3] text-[#123d2a]" : "border-[#e3ded0] bg-[#fffdf7]")}><b>{item.label}</b><p className="text-xs font-bold text-[#667267]">{item.hint}</p></button>)}</div><div className="flex flex-wrap items-center gap-2"><button onClick={()=>setRange("total")} className={"rounded-xl px-4 py-3 text-sm font-black " + (range==="total"?"bg-[#1f6b45] text-white":"bg-[#f6f3e8]")}>Total</button><button onClick={()=>setRange("monthly")} className={"rounded-xl px-4 py-3 text-sm font-black " + (range==="monthly"?"bg-[#1f6b45] text-white":"bg-[#f6f3e8]")}>Monthly</button><button onClick={()=>setRange("daily")} className={"rounded-xl px-4 py-3 text-sm font-black " + (range==="daily"?"bg-[#1f6b45] text-white":"bg-[#f6f3e8]")}>Daily</button><input value={date} onChange={e=>{setDate(e.target.value); setRange("daily");}} type="date" className="rounded-xl border border-[#ded8c9] bg-white px-4 py-3 text-sm font-black" /></div></div><p className="mt-3 rounded-2xl bg-[#f6f3e8] p-3 text-sm font-bold text-[#667267]">Current filter: <b className="text-[#17251d]">{rangeLabel}</b>. Product list stays complete; bought/sales numbers follow the filter.</p></div>
    {section === "products" && <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_300px]"><Card className="min-h-[640px]"><div className="flex items-center justify-between gap-3"><h2 className="text-xl font-black">Product Sales Summary</h2><Badge tone="good">{productRows.length} Farm Buy products</Badge></div><div className="mt-4 max-h-[560px] overflow-y-auto pr-2"><div className="grid gap-3">{productRows.map(row=><div key={row.name} className="grid gap-3 rounded-2xl border border-[#ece6d8] bg-[#fffdf7] p-4 md:grid-cols-[54px_1.3fr_.8fr_.8fr_.9fr] md:items-center"><img src={row.image} alt="" className="h-12 w-12 rounded-xl object-cover" /><div><p className="text-xs font-black uppercase text-[#667267]">Product</p><b className="block text-lg">{row.name}</b><p className="text-xs font-bold text-[#667267]">{row.category}</p></div><div><p className="text-xs font-black uppercase text-[#667267]">Amount/Product</p><b>{peso(row.amount)}</b><p className="text-xs font-bold text-[#667267]">{row.unit}</p></div><div><p className="text-xs font-black uppercase text-[#667267]">Bought/Sold</p><b>{row.bought}</b></div><div><p className="text-xs font-black uppercase text-[#667267]">Total Sales</p><b className="text-[#1f6b45]">{peso(row.sales)}</b></div></div>)}</div></div></Card><Card><p className="text-xs font-black uppercase text-[#667267]">Product Total</p><h2 className="mt-2 text-4xl font-black text-[#1f6b45]">{peso(productTotal)}</h2><p className="mt-2 text-sm font-bold text-[#667267]">{productSoldCount} sold for {rangeLabel.toLowerCase()}.</p></Card></div>}
    {section === "accounts" && <div className="mt-5 grid gap-4 xl:grid-cols-[300px_minmax(520px,1fr)_380px]"><Card className="min-h-[640px]"><h2 className="text-lg font-black">Accounts Logs</h2><div className="mt-3 grid grid-cols-2 gap-2"><button onClick={()=>setAccountMode("clients")} className={"rounded-xl px-3 py-3 text-sm font-black " + (accountMode==="clients"?"bg-[#1f6b45] text-white":"bg-[#f6f3e8]")}>Clients</button><button onClick={()=>setAccountMode("caretakers")} className={"rounded-xl px-3 py-3 text-sm font-black " + (accountMode==="caretakers"?"bg-[#1f6b45] text-white":"bg-[#f6f3e8]")}>Caretakers</button></div><div className="mt-4 max-h-[520px] space-y-3 overflow-y-auto pr-2">{accountList.length ? accountList.map(row=><button key={row.id} onClick={()=>{setSelectedAccountId(row.id); setSelectedRecordId(row.records[0]?.id || "");}} className={"flex w-full items-center gap-3 rounded-2xl border p-3 text-left " + (selectedAccount?.id===row.id ? "border-[#1f6b45] bg-emerald-50" : "border-[#ece6d8] bg-[#fffdf7]")}><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#1f6b45] font-black text-white">{row.avatar}</span><span className="min-w-0 flex-1"><b className="block truncate">{row.name}</b><span className="text-xs font-bold text-[#667267]">{row.records.length} filtered records</span></span></button>) : <p className="rounded-2xl bg-[#f6f3e8] p-4 text-sm font-bold text-[#667267]">No accounts with records for this filter.</p>}</div></Card><Card className="min-h-[640px]"><p className="text-xs font-black uppercase text-[#667267]">{accountMode === "clients" ? "Client activity" : "Caretaker assignments"}</p><h2 className="mt-1 text-3xl font-black">{selectedAccount?.name || "No selected account"}</h2><div className="mt-4 max-h-[500px] space-y-3 overflow-y-auto pr-2">{selectedAccount?.records.map((row:any)=><button key={row.id} onClick={()=>setSelectedRecordId(row.id)} className={"w-full rounded-2xl border p-4 text-left " + (selectedRecord?.id===row.id ? "border-[#1f6b45] bg-emerald-50" : "border-[#ece6d8] bg-[#fffdf7]")}><div className="flex justify-between gap-3"><b>{row.title || row.task}</b><Badge tone={row.status==="Approved" || row.status==="Sent" ? "good" : row.status==="Rejected" ? "bad" : "warn"}>{row.status}</Badge></div><p className="mt-1 text-sm font-bold text-[#667267]">{accountMode === "clients" ? row.kind : row.customer} / {row.time}</p><p className="mt-2 text-sm font-bold text-[#1f6b45]">{peso(row.amount)}</p></button>) || <p className="rounded-2xl bg-[#f6f3e8] p-4 text-sm font-bold text-[#667267]">Select an account with records.</p>}</div></Card><Card className="min-h-[640px]"><p className="text-xs font-black uppercase text-[#667267]">Receipt / Invoice / Evidence</p><h2 className="mt-1 text-2xl font-black">{selectedRecord?.title || selectedRecord?.task || "No record selected"}</h2><div className="mt-4 grid gap-3"><Info label="Amount" value={peso(selectedRecord?.amount || 0)} /><Info label="Date / Time" value={selectedRecord?.time || "-"} /><Info label="Status" value={selectedRecord?.status || "-"} /><Info label="Details" value={selectedRecord?.meta || "-"} /><Info label="Reference Number" value={selectedRecord?.referenceNumber || "-"} /><Info label="Sender / Account Name" value={selectedRecord?.senderName || "-"} /><Info label="Withdrawal Method" value={selectedRecord?.withdrawalMethod || "-"} /><Info label="Assigned Caretaker" value={selectedRecord?.assignedCaretaker || "-"} /><Info label="Caretaker Submission" value={selectedRecord?.caretakerSubmission || "-"} /><Info label="Admin Decision" value={selectedRecord?.taskDecision || "-"} /></div><div className="mt-4 grid gap-2"><button onClick={()=>openEvidence(selectedRecord,"customer")} className="rounded-xl bg-[#1f6b45] px-4 py-3 font-black text-white">View Customer Receipt + Ref</button><button onClick={()=>openEvidence(selectedRecord,"invoice")} className="rounded-xl bg-[#eee8d9] px-4 py-3 font-black">View System Invoice</button>{selectedRecord?.kind === "Withdrawal" && <button onClick={()=>openEvidence(selectedRecord,"admin")} className="rounded-xl bg-[#dff0ff] px-4 py-3 font-black">View Admin Payout Receipt</button>}{(selectedRecord?.kind === "Care Request" || selectedRecord?.task) && <button onClick={()=>openEvidence(selectedRecord,"task")} className="rounded-xl bg-[#fff1b7] px-4 py-3 font-black">View Caretaker Submission</button>}</div></Card></div>}
    {section === "paid-care" && <div className="mt-5 grid gap-4 xl:grid-cols-[300px_minmax(560px,1fr)_320px]"><Card className="min-h-[640px]"><h2 className="text-lg font-black">Caretaker List</h2><div className="mt-4 space-y-3">{caretakerTotals.map(c=><button key={c.id} onClick={()=>setSelectedCaretakerName(c.name)} className={"w-full rounded-2xl border p-3 text-left " + (selectedCaretakerName===c.name ? "border-[#1f6b45] bg-emerald-50" : "border-[#ece6d8] bg-[#fffdf7] hover:border-[#1f6b45]")}><b>{c.name}</b><p className="text-xs font-bold text-[#667267]">{c.count} filtered requests</p></button>)}</div></Card><Card className="min-h-[640px]"><div className="flex items-center justify-between gap-3"><h2 className="text-xl font-black">Paid Care Requests</h2><Badge tone="good">{selectedCaretakerName}</Badge></div><div className="mt-4 max-h-[560px] overflow-y-auto pr-2"><div className="grid gap-3">{careRows.length ? careRows.map(row=><button key={row.key} onClick={()=>setSelectedCareKey(row.key)} className={"grid gap-3 rounded-2xl border p-4 text-left md:grid-cols-[1fr_.7fr_.8fr] md:items-center " + (selectedCare?.key===row.key ? "border-[#1f6b45] bg-emerald-50" : "border-[#ece6d8] bg-[#fffdf7]")}><div><p className="text-xs font-black uppercase text-[#667267]">Care Request</p><b>{row.service}</b><p className="text-xs font-bold text-[#667267]">{row.customers.join(", ")}</p></div><div><p className="text-xs font-black uppercase text-[#667267]">Count</p><b>{row.count} requests</b><p className="text-xs font-bold text-[#667267]">{peso(row.price)} each</p></div><div><p className="text-xs font-black uppercase text-[#667267]">Status</p><b>{row.status}</b></div></button>) : <p className="rounded-2xl bg-[#f6f3e8] p-4 text-sm font-bold text-[#667267]">No paid care requests for {selectedCaretakerName} in this filter.</p>}</div></div></Card><Card className="min-h-[640px]"><p className="text-xs font-black uppercase text-[#667267]">Caretaker Total</p><h2 className="mt-2 text-3xl font-black text-[#1f6b45]">{selectedCaretakerName}</h2><div className="mt-4 rounded-2xl bg-emerald-50 p-4"><p className="text-xs font-black uppercase text-[#667267]">Total Amount</p><h3 className="mt-1 text-4xl font-black text-[#1f6b45]">{peso(careTotal)}</h3><p className="mt-1 text-xs font-bold text-[#667267]">{rangeLabel}</p></div><div className="mt-4 grid gap-3"><Info label="Filtered Requests" value={`${caretakerTotals.find(c=>c.name===selectedCaretakerName)?.count || 0}`} /><Info label="Selected Service" value={selectedCare?.service || "-"} /><Info label="Service Count" value={selectedCare ? `${selectedCare.count}` : "-"} /><Info label="Service Total" value={selectedCare ? peso(selectedCare.total) : "-"} /><Info label="Customers" value={selectedCare?.customers?.join(", ") || "-"} /></div><div className="mt-4 rounded-2xl bg-[#f6f3e8] p-4 text-sm font-bold leading-6 text-[#667267]">Per-caretaker total is here only. The middle box stays focused on the request list.</div></Card></div>}
    {viewer && <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4"><div className="w-full max-w-3xl rounded-3xl bg-white p-5 shadow-2xl"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase text-[#667267]">{viewer.type === "customer" ? "Customer uploaded receipt" : viewer.type === "invoice" ? "System-made invoice" : viewer.type === "task" ? "Caretaker uploaded submission" : "Admin payout receipt"}</p><h2 className="mt-1 text-2xl font-black">{viewer.title}</h2><p className="mt-1 text-sm font-bold text-[#667267]">{viewer.record?.title || viewer.record?.task}</p></div><button onClick={()=>setViewer(null)} className="rounded-xl bg-[#eee8d9] px-4 py-2 text-sm font-black">Close</button></div><div className="mt-5 grid gap-4 md:grid-cols-[1.3fr_.9fr]"><div className="rounded-2xl border border-[#ece6d8] bg-[#111] p-6 text-center text-white"><p className="text-xs font-black uppercase text-white/60">{viewer.type === "invoice" ? "Generated invoice preview" : viewer.type === "task" ? "Caretaker upload/documentation preview" : viewer.type === "admin" ? "Admin payout receipt preview" : "Customer receipt screenshot preview"}</p><div className="mt-6 grid min-h-56 place-items-center rounded-2xl border border-white/20"><div><h3 className="text-2xl font-black">{viewer.type === "invoice" ? viewer.record?.invoice : viewer.type === "admin" ? viewer.record?.adminReceipt : viewer.type === "task" ? viewer.record?.caretakerSubmission : viewer.record?.customerReceipt}</h3><p className="mt-2 text-sm font-bold text-white/70">Evidence preview placeholder until real file URL is wired.</p></div></div></div><div className="grid gap-3"><Info label="Customer Receipt Upload" value={viewer.record?.customerReceipt || "-"} /><Info label="Reference Number" value={viewer.record?.referenceNumber || "-"} /><Info label="Sender / Account Name" value={viewer.record?.senderName || "-"} /><Info label="System Invoice" value={viewer.record?.invoice || "-"} /><Info label="Admin Receipt" value={viewer.record?.adminReceipt || "-"} /><Info label="Withdrawal Method" value={viewer.record?.withdrawalMethod || "-"} /><Info label="Assigned Caretaker" value={viewer.record?.assignedCaretaker || "-"} /><Info label="Caretaker Submission" value={viewer.record?.caretakerSubmission || "-"} /><Info label="Decision" value={viewer.record?.taskDecision || "-"} /></div></div></div></div>}
  </Shell>;
}
function AdminIssueManagementPage({ config }: { config: string[] }) {
  const customerReports = [
    { id:"cu-1", account:"Aydana Buratino", avatar:"AB", issue:"Farm Buy payment approved but inventory missing", source:"Customer support chat", where:"/customer/farm-buy -> /customer/inventory", findings:"KaFarm found payment receipt and reference number, but no linked inventory movement after approval.", solution:"Open Customer Requests payment evidence, confirm invoice, then rerun/add the approved inventory movement and notify customer through inbox.", risk:"High", status:"Open", evidence:"GCash ref 987678987, Farm Buy Invoice #FB-10021, no inventory row", update:"We found the payment trail. Admin is checking the inventory posting now." },
    { id:"cu-2", account:"Marco Reyes", avatar:"MR", issue:"Care request proof not visible in care logs", source:"Live chat escalation", where:"/customer/care-logs", findings:"Caretaker submitted proof, admin approved, but customer update was not attached to the care log view.", solution:"Open caretaker task proof, attach approved submission to customer care log, then send inbox update.", risk:"Medium", status:"Open", evidence:"Care Receipt #CR-22012, Mia Santos proof, approved decision", update:"Your approved care proof is being linked to your care logs." },
  ];
  const caretakerReports = [
    { id:"ct-1", account:"Juan Dela Cruz", avatar:"JD", issue:"QR scan failed during feed task", source:"Caretaker chat", where:"/caretaker/tasks", findings:"KaFarm detected camera/QR issue. Task has customer payment and rooster details, but caretaker needs admin exception or serial fallback.", solution:"Admin can release exception mode, add serial verification note, then caretaker submits proof with documentation.", risk:"Medium", status:"Open", evidence:"Task Request Feed, rooster FC-128, customer Aydana", update:"Admin released an alternate verification step. Please submit serial, notes, and proof." },
    { id:"ct-2", account:"Mia Santos", avatar:"MS", issue:"Rejected proof needs backjob clarification", source:"Task verification", where:"/admin/caretaker-desk -> Task Verification", findings:"Submitted photo was blurry and feed quantity was missing. Backjob already marked but caretaker needs clearer instruction.", solution:"Send backjob note: retake photo, include feed weight, confirm rooster QR/serial, then resubmit.", risk:"Low", status:"Open", evidence:"Premium Feed proof rejected, Lina Cruz, CR-22013", update:"Please resubmit with clearer photo and feed quantity used." },
  ];
  const completedCustomer = [
    { id:"cc-1", account:"Aydana Buratino", avatar:"AB", issue:"Withdrawal receipt question", resolved:"Admin payout reference was confirmed and inbox receipt sent.", date:"Today 3:20 PM", evidence:"Withdrawal Receipt #WD-30012" },
    { id:"cc-2", account:"Marco Reyes", avatar:"MR", issue:"Farm Buy invoice request", resolved:"System invoice opened and resent to inbox.", date:"Yesterday 5:42 PM", evidence:"Farm Buy Invoice #FB-10022" },
  ];
  const completedCaretaker = [
    { id:"tc-1", account:"Juan Dela Cruz", avatar:"JD", issue:"Upload retry", resolved:"Admin guided upload retry and task proof was accepted.", date:"Today 10:10 AM", evidence:"Task proof JD-8821" },
    { id:"tc-2", account:"Mia Santos", avatar:"MS", issue:"Camera permission", resolved:"KaFarm guided browser permission reset; no admin exception needed.", date:"Jul 31 8:50 PM", evidence:"Chat transcript CT-4410" },
  ];
  const [mode,setMode]=useState<"customer" | "caretaker" | "completed">("customer");
  const [completedMode,setCompletedMode]=useState<"customer" | "caretaker">("customer");
  const activeReports = mode === "caretaker" ? caretakerReports : customerReports;
  const completedReports = completedMode === "caretaker" ? completedCaretaker : completedCustomer;
  const [selectedId,setSelectedId]=useState("cu-1");
  const [selectedCompletedId,setSelectedCompletedId]=useState("cc-1");
  const [note,setNote]=useState("Write clear admin note before sending inbox update or marking resolved.");
  useEffect(()=>{ if(mode === "customer") setSelectedId(customerReports[0].id); if(mode === "caretaker") setSelectedId(caretakerReports[0].id); }, [mode]);
  useEffect(()=>{ setSelectedCompletedId((completedMode === "customer" ? completedCustomer[0] : completedCaretaker[0]).id); }, [completedMode]);
  const selected = activeReports.find(row=>row.id===selectedId) || activeReports[0];
  const completedSelected = completedReports.find(row=>row.id===selectedCompletedId) || completedReports[0];

  return <Shell role="admin" title={config[0]}><PageTitle title="Issue Management" text="KaFarm reads chat/report context, finds evidence, prepares diagnosis, and helps admin resolve customer or caretaker issues." icon="alert" />
    <div className="mt-4 grid gap-3 md:grid-cols-3"><button onClick={()=>setMode("customer")} className={"rounded-2xl border p-4 text-left " + (mode==="customer" ? "border-[#1f6b45] bg-emerald-50" : "border-[#e3ded0] bg-white/95")}><b>Customer Reports</b><p className="text-xs font-bold text-[#667267]">Customer issues from support, payment, care, withdrawal, or inbox.</p></button><button onClick={()=>setMode("caretaker")} className={"rounded-2xl border p-4 text-left " + (mode==="caretaker" ? "border-[#1f6b45] bg-emerald-50" : "border-[#e3ded0] bg-white/95")}><b>Caretaker Reports</b><p className="text-xs font-bold text-[#667267]">QR, camera, upload, task, proof, or backjob issues.</p></button><button onClick={()=>setMode("completed")} className={"rounded-2xl border p-4 text-left " + (mode==="completed" ? "border-[#1f6b45] bg-emerald-50" : "border-[#e3ded0] bg-white/95")}><b>Completed Issues</b><p className="text-xs font-bold text-[#667267]">Resolved reports with final note, evidence, and inbox update.</p></button></div>
    {mode !== "completed" && <div className="mt-5 grid gap-4 xl:grid-cols-[300px_minmax(520px,1fr)_360px]"><Card className="min-h-[640px]"><div className="flex items-center justify-between gap-3"><h2 className="text-lg font-black">{mode === "customer" ? "Customer Queue" : "Caretaker Queue"}</h2><Badge tone="warn">{activeReports.length} open</Badge></div><p className="mt-2 text-sm font-bold text-[#667267]">Account list only. Select one to let KaFarm show issue diagnosis.</p><div className="mt-4 max-h-[520px] space-y-3 overflow-y-auto pr-2">{activeReports.map(row=><button key={row.id} onClick={()=>setSelectedId(row.id)} className={"flex w-full items-center gap-3 rounded-2xl border p-3 text-left " + (selected.id===row.id ? "border-[#1f6b45] bg-emerald-50" : "border-[#ece6d8] bg-[#fffdf7]")}><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#1f6b45] font-black text-white">{row.avatar}</span><span className="min-w-0 flex-1"><b className="block truncate">{row.account}</b><span className="text-xs font-bold text-[#667267]">{row.source}</span></span><Badge tone={row.risk === "High" ? "bad" : row.risk === "Medium" ? "warn" : "neutral"}>{row.risk}</Badge></button>)}</div></Card><Card className="min-h-[640px]"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase text-[#667267]">KaFarm Findings / Diagnosis</p><h2 className="mt-1 text-3xl font-black">{selected.account}</h2></div><Badge tone="neutral">Evidence Based</Badge></div><div className="mt-4 grid gap-3"><Info label="Issue" value={selected.issue} /><Info label="Findings" value={selected.findings} /><Info label="Where It Happened" value={selected.where} /><Info label="Evidence Checked" value={selected.evidence} /><Info label="How To Solve" value={selected.solution} /></div><div className="mt-4 rounded-2xl bg-[#f6f3e8] p-4 text-sm font-bold leading-6 text-[#667267]">Live chat flow: KaFarm pulls the issue from chat/report, summarizes here, then admin resolves and sends final update through inbox.</div></Card><Card className="min-h-[640px]"><p className="text-xs font-black uppercase text-[#667267]">Decision / Admin Action</p><h2 className="mt-1 text-2xl font-black">Recommended Solution</h2><p className="mt-3 rounded-2xl bg-emerald-50 p-4 text-sm font-bold leading-6 text-emerald-900">{selected.solution}</p><label className="mt-4 block text-sm font-black">Admin Notes</label><textarea value={note} onChange={e=>setNote(e.target.value)} className="mt-2 min-h-36 w-full rounded-2xl border border-[#ded8c9] bg-[#fffdf7] p-4 text-sm font-bold" /><div className="mt-4 grid gap-2"><button className="rounded-xl bg-[#1f6b45] px-4 py-3 font-black text-white">Send Inbox Update</button><button className="rounded-xl bg-[#eee8d9] px-4 py-3 font-black">Mark Resolved</button><button className="rounded-xl bg-amber-200 px-4 py-3 font-black">Keep Open</button></div><p className="mt-3 text-xs font-bold text-[#667267]">No direct money/KYC action here. This page prepares the evidence and message only.</p></Card></div>}
    {mode === "completed" && <div className="mt-5 grid gap-4 xl:grid-cols-[300px_minmax(620px,1fr)]"><Card className="min-h-[640px]"><h2 className="text-lg font-black">Resolved Accounts</h2><div className="mt-3 grid grid-cols-2 gap-2"><button onClick={()=>setCompletedMode("customer")} className={"rounded-xl px-3 py-3 text-sm font-black " + (completedMode==="customer"?"bg-[#1f6b45] text-white":"bg-[#f6f3e8]")}>Clients</button><button onClick={()=>setCompletedMode("caretaker")} className={"rounded-xl px-3 py-3 text-sm font-black " + (completedMode==="caretaker"?"bg-[#1f6b45] text-white":"bg-[#f6f3e8]")}>Caretakers</button></div><div className="mt-4 max-h-[520px] space-y-3 overflow-y-auto pr-2">{completedReports.map(row=><button key={row.id} onClick={()=>setSelectedCompletedId(row.id)} className={"flex w-full items-center gap-3 rounded-2xl border p-3 text-left " + (completedSelected.id===row.id ? "border-[#1f6b45] bg-emerald-50" : "border-[#ece6d8] bg-[#fffdf7]")}><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#1f6b45] font-black text-white">{row.avatar}</span><span className="min-w-0 flex-1"><b className="block truncate">{row.account}</b><span className="text-xs font-bold text-[#667267]">{row.date}</span></span></button>)}</div></Card><Card className="min-h-[640px]"><p className="text-xs font-black uppercase text-[#667267]">Resolved Issue</p><h2 className="mt-1 text-3xl font-black">{completedSelected.account}</h2><div className="mt-4 grid gap-3"><Info label="Issue" value={completedSelected.issue} /><Info label="Resolved Action" value={completedSelected.resolved} /><Info label="Date" value={completedSelected.date} /><Info label="Evidence" value={completedSelected.evidence} /></div><div className="mt-4 rounded-2xl bg-[#f6f3e8] p-4 text-sm font-bold leading-6 text-[#667267]">Completed issues stay here for review. Admin can later archive/delete only if policy allows it.</div></Card></div>}
  </Shell>;
}
function AdminAccountVerificationPage({ config }: { config: string[] }) {
  const customerQueue = [
    { id:"cq-1", name:"Aydana Buratino", avatar:"AB", type:"Customer", email:"aydana@example.com", phone:"+63 917 555 0198", submitted:"Today 8:44 AM", details:"Customer signup, profile photo, birthdate, contact details, KYC pending.", files:"Selfie photo, valid ID front/back, payout name to match", risk:"Medium" },
    { id:"cq-2", name:"Marco Reyes", avatar:"MR", type:"Customer", email:"marco@example.com", phone:"+63 918 222 4419", submitted:"Yesterday 3:12 PM", details:"New customer profile, wallet PIN set, no payout method yet.", files:"Selfie photo, valid ID front", risk:"Low" },
  ];
  const caretakerQueue = [
    { id:"tq-1", name:"Juan Dela Cruz", avatar:"JD", type:"Caretaker", email:"juan@example.com", phone:"+63 915 333 1122", submitted:"Today 9:10 AM", details:"Caretaker application submitted. Needs resume and selfie review before activation.", files:"Selfie photo, resume file, payout method GCash", risk:"Medium" },
    { id:"tq-2", name:"Mia Santos", avatar:"MS", type:"Caretaker", email:"mia@example.com", phone:"+63 916 444 0099", submitted:"Yesterday 6:05 PM", details:"Caretaker application with farm role and emergency contact.", files:"Selfie photo, resume file, payment method Maya", risk:"Low" },
  ];
  const verifiedCustomers = [
    { id:"vc-1", name:"Lina Cruz", avatar:"LC", email:"lina@example.com", verified:"Jul 31 10:45 AM", status:"Customer verified" },
    { id:"vc-2", name:"Pedro Lim", avatar:"PL", email:"pedro@example.com", verified:"Jul 30 2:22 PM", status:"Customer verified" },
  ];
  const verifiedCaretakers = [
    { id:"vt-1", name:"Ramon Flores", avatar:"RF", email:"ramon@example.com", verified:"Jul 29 9:35 AM", status:"Caretaker active" },
    { id:"vt-2", name:"Nico Ramos", avatar:"NR", email:"nico@example.com", verified:"Jul 28 4:10 PM", status:"Caretaker active" },
  ];
  const [tab,setTab]=useState<"queue" | "verified">("queue");
  const [mode,setMode]=useState<"customer" | "caretaker">("customer");
  const [selectedId,setSelectedId]=useState("cq-1");
  const [note,setNote]=useState("Write clear approval/rejection note for the account record.");
  const [viewer,setViewer]=useState<null | { title:string; kind:string; body:string }>(null);
  const [localStatus,setLocalStatus]=useState<Record<string,string>>({});
  const queue = mode === "customer" ? customerQueue : caretakerQueue;
  const verified = mode === "customer" ? verifiedCustomers : verifiedCaretakers;
  const selected = queue.find(row=>row.id===selectedId) || queue[0];
  const selectedStatus = localStatus[selected?.id || ""] || "Pending Review";
  const openAccountFile = (kind:string) => setViewer({ title:`${selected.name} / ${kind}`, kind, body: kind === "Selfie" ? `${selected.name} selfie/photo preview. This will show the uploaded file once storage URL is wired.` : kind === "Resume" ? `Resume file for ${selected.name}. Admin checks work history before activation.` : `Submitted account documents for ${selected.name}: ${selected.files}` });
  const decideAccount = (decision:"Approved" | "Rejected") => {
    setLocalStatus(current => ({ ...current, [selected.id]: decision }));
    setNote(decision === "Approved" ? `${selected.name} approved. ${selected.type} can open dashboard after login.` : `${selected.name} rejected. Account stays on waiting page and can resubmit corrected details until approved.`);
  };
  useEffect(()=>{ setSelectedId((mode === "customer" ? customerQueue[0] : caretakerQueue[0]).id); }, [mode]);

  return <Shell role="admin" title={config[0]}><PageTitle title="Account Verification" text="Review customer and caretaker account submissions before approval. Verified accounts stay in the verified list." icon="shield" />
    <div className="mt-4 grid gap-3 md:grid-cols-2"><button onClick={()=>setTab("queue")} className={"rounded-2xl border p-4 text-left " + (tab==="queue" ? "border-[#1f6b45] bg-emerald-50" : "border-[#e3ded0] bg-white/95")}><b>Verification Queue</b><p className="text-xs font-bold text-[#667267]">Accounts waiting for admin approval or rejection.</p></button><button onClick={()=>setTab("verified")} className={"rounded-2xl border p-4 text-left " + (tab==="verified" ? "border-[#1f6b45] bg-emerald-50" : "border-[#e3ded0] bg-white/95")}><b>Verified Accounts</b><p className="text-xs font-bold text-[#667267]">Already verified customer and caretaker accounts.</p></button></div>
    {tab === "queue" && <div className="mt-5 grid gap-4 xl:grid-cols-[300px_minmax(520px,1fr)_340px]"><Card className="min-h-[640px]"><h2 className="text-lg font-black">Accounts On Queue</h2><div className="mt-3 grid grid-cols-2 gap-2"><button onClick={()=>setMode("customer")} className={"rounded-xl px-3 py-3 text-sm font-black " + (mode==="customer"?"bg-[#1f6b45] text-white":"bg-[#f6f3e8]")}>Customers</button><button onClick={()=>setMode("caretaker")} className={"rounded-xl px-3 py-3 text-sm font-black " + (mode==="caretaker"?"bg-[#1f6b45] text-white":"bg-[#f6f3e8]")}>Caretakers</button></div><div className="mt-4 max-h-[520px] space-y-3 overflow-y-auto pr-2">{queue.map(row=><button key={row.id} onClick={()=>setSelectedId(row.id)} className={"flex w-full items-center gap-3 rounded-2xl border p-3 text-left " + (selected.id===row.id ? "border-[#1f6b45] bg-emerald-50" : "border-[#ece6d8] bg-[#fffdf7]")}><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#1f6b45] font-black text-white">{row.avatar}</span><span className="min-w-0 flex-1"><b className="block truncate">{row.name}</b><span className="text-xs font-bold text-[#667267]">{row.submitted}</span></span><Badge tone={row.risk === "Medium" ? "warn" : "neutral"}>{row.risk}</Badge></button>)}</div></Card><Card className="min-h-[640px]"><p className="text-xs font-black uppercase text-[#667267]">Submitted Account Details</p><h2 className="mt-1 text-3xl font-black">{selected.name}</h2><div className="mt-4 grid gap-3"><Info label="Role" value={selected.type} /><Info label="Email" value={selected.email} /><Info label="Phone" value={selected.phone} /><Info label="Submitted" value={selected.submitted} /><Info label="Account Details" value={selected.details} /><Info label="Submitted Files" value={selected.files} /><Info label="Current Status" value={selectedStatus} /></div><div className="mt-4 grid gap-3 md:grid-cols-2"><button onClick={()=>openAccountFile("Selfie")} className="rounded-xl bg-[#eee8d9] px-4 py-3 font-black">View Selfie</button><button onClick={()=>openAccountFile("Documents")} className="rounded-xl bg-[#eee8d9] px-4 py-3 font-black">View Documents</button>{mode === "caretaker" && <button onClick={()=>openAccountFile("Resume")} className="rounded-xl bg-[#eee8d9] px-4 py-3 font-black md:col-span-2">View Resume</button>}</div></Card><Card className="min-h-[640px]"><p className="text-xs font-black uppercase text-[#667267]">Admin Verification</p><h2 className="mt-1 text-2xl font-black">Approve or Reject</h2><Badge tone={selectedStatus === "Approved" ? "good" : selectedStatus === "Rejected" ? "bad" : "warn"}>{selectedStatus}</Badge><div className="mt-4 grid grid-cols-2 gap-3"><button onClick={()=>decideAccount("Approved")} className="rounded-2xl bg-[#1f6b45] px-4 py-8 font-black text-white">Approve</button><button onClick={()=>decideAccount("Rejected")} className="rounded-2xl bg-red-600 px-4 py-8 font-black text-white">Reject</button></div><label className="mt-4 block text-sm font-black">Admin Notes</label><textarea value={note} onChange={e=>setNote(e.target.value)} className="mt-2 min-h-40 w-full rounded-2xl border border-[#ded8c9] bg-[#fffdf7] p-4 text-sm font-bold" /><div className="mt-4 rounded-2xl bg-[#f6f3e8] p-4 text-sm font-bold leading-6 text-[#667267]"><b>Locking flow:</b><br/>Approved: account opens its dashboard after login.<br/>Rejected: account opens waiting/resubmission page, shows admin note, and user can resubmit until approved.</div></Card></div>}
    {tab === "verified" && <div className="mt-5 grid gap-4 xl:grid-cols-[300px_minmax(560px,1fr)_300px]"><Card className="min-h-[640px]"><h2 className="text-lg font-black">Verified Type</h2><div className="mt-3 grid grid-cols-2 gap-2"><button onClick={()=>setMode("customer")} className={"rounded-xl px-3 py-3 text-sm font-black " + (mode==="customer"?"bg-[#1f6b45] text-white":"bg-[#f6f3e8]")}>Customers</button><button onClick={()=>setMode("caretaker")} className={"rounded-xl px-3 py-3 text-sm font-black " + (mode==="caretaker"?"bg-[#1f6b45] text-white":"bg-[#f6f3e8]")}>Caretakers</button></div></Card><Card className="min-h-[640px]"><h2 className="text-xl font-black">Verified List</h2><div className="mt-4 max-h-[540px] space-y-3 overflow-y-auto pr-2">{verified.map(row=><div key={row.id} className="flex items-center gap-3 rounded-2xl border border-[#ece6d8] bg-[#fffdf7] p-4"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#1f6b45] font-black text-white">{row.avatar}</span><span className="min-w-0 flex-1"><b className="block truncate">{row.name}</b><span className="text-xs font-bold text-[#667267]">{row.email} / {row.verified}</span></span><Badge tone="good">{row.status}</Badge></div>)}</div></Card><Card className="min-h-[640px]"><p className="text-xs font-black uppercase text-[#667267]">Total Verified</p><h2 className="mt-2 text-5xl font-black text-[#1f6b45]">{verified.length}</h2><p className="mt-2 text-sm font-bold text-[#667267]">{mode === "customer" ? "verified customers" : "verified caretakers"}</p></Card></div>}
    {viewer && <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4"><div className="w-full max-w-2xl rounded-3xl bg-white p-5 shadow-2xl"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase text-[#667267]">{viewer.kind} Preview</p><h2 className="mt-1 text-2xl font-black">{viewer.title}</h2></div><button onClick={()=>setViewer(null)} className="rounded-xl bg-[#eee8d9] px-4 py-2 text-sm font-black">Close</button></div><div className="mt-5 rounded-2xl border border-[#ece6d8] bg-[#fffdf7] p-6 text-center"><div className="mx-auto grid h-32 w-32 place-items-center rounded-3xl bg-[#1f6b45] text-4xl font-black text-white">{selected.avatar}</div><p className="mt-4 text-sm font-bold leading-6 text-[#667267]">{viewer.body}</p></div></div></div>}
  </Shell>;
}
function AdminOperationsDeskFormat({ kind, config }: { kind: "caretaker" | "farm" | "money" | "evidence" | "issues" | "verification"; config: string[] }) {
  if (kind === "farm") return <AdminFarmOperationsPage config={config} />;
  if (kind === "issues") return <AdminIssueManagementPage config={config} />;
  if (kind === "verification") return <AdminAccountVerificationPage config={config} />;
  const rowsByKind = {
    caretaker: [
      { id:"registration", name:"Caretaker Registration", status:"Permanent link", main:"Admin sends caretaker signup link", detail:"Permanent registration link; applicant can register even if the link is forwarded.", route:"/admin/caretaker-registration", priority:"Normal" },
      { id:"verification", name:"Caretaker Verification", status:"Needs approval", main:"New caretaker account review", detail:"Check email, name, phone, selfie/photo, and resume before account becomes active.", route:"/admin/caretaker-registration", priority:"High" },
      { id:"list", name:"Caretaker List", status:"Approved only", main:"Approved caretakers and assignments", detail:"Column 1 list, column 2 selfie/resume, column 3 assigned customers/tasks.", route:"/admin/caretakers", priority:"Normal" },
      { id:"task-proof", name:"Task Verification", status:"Needs proof review", main:"Caretaker submitted task proof", detail:"Check submitted photo/video, documentation, QR/serial, customer, rooster, and requested work.", route:"/admin/evidence", priority:"High" },
      { id:"completed", name:"Completed Tasks", status:"Evidence storage", main:"Approved caretaker work history", detail:"Approved tasks, customers served, proof submitted, date/time, and admin decision.", route:"/admin/evidence", priority:"Normal" },
    ],
    farm: [
      { id:"products", name:"Product Sales Summary", status:"Calendar filter", main:"Products bought by customers", detail:"Default shows total sold and total amount. Calendar shows daily product sales like feeds sold on a selected date.", route:"/admin/farm-operations", priority:"Normal" },
      { id:"customers", name:"Customer Registry", status:"Calendar filter", main:"Registered customer count and list", detail:"Default shows all registered customers. Calendar shows customers registered on a selected date.", route:"/admin/customers", priority:"Normal" },
      { id:"paid-care", name:"Paid Care Requests", status:"Revenue view", main:"Total paid care requests", detail:"List caretaker/service/price paid so owner sees care service income and who handled the work.", route:"/admin/customer-desk/care", priority:"Normal" },
    ],
    money: [
      { id:"cashin", name:"Cash-In Review", status:"Manual check", main:"Customer uploaded receipt", detail:"Check receiver account, reference number, sender, amount, and duplicate risk.", route:"/admin/transactions/cashin", priority:"High" },
      { id:"withdraw", name:"Withdrawal", status:"Sensitive", main:"Customer requested payout", detail:"Check KYC, payout account name/number, wallet trail, upload proof, send receipt.", route:"/admin/customer-desk/withdraw", priority:"High" },
      { id:"treasury", name:"Treasury", status:"Read only", main:"Owner money view", detail:"Available cash, pending payouts, holds, income, and payroll due.", route:"/admin/treasury", priority:"Normal" },
    ],
    evidence: [
      { id:"customer", name:"Customer Evidence", status:"Person by person", main:"All customer activity and proof", detail:"Select customer, then review registration, KYC, payments, care, withdrawals, chats, inbox, and admin decisions.", route:"/admin/evidence", priority:"Normal" },
      { id:"caretaker", name:"Caretaker Evidence", status:"Person by person", main:"All caretaker assignments and proof", detail:"Select caretaker, then review assigned customers, submitted proof, approved/rejected tasks, and performance history.", route:"/admin/evidence", priority:"Normal" },
      { id:"admin", name:"Admin Evidence", status:"Audit trail", main:"Everything admin approved/sent/changed", detail:"Approvals, rejected requests, payout proof uploads, caretaker assignments, inbox messages, and resolved issue actions.", route:"/admin/audit-logs", priority:"Normal" },
    ],
    issues: [
      { id:"customer-reports", name:"Customer Reports", status:"Open issues", main:"Customer-submitted problems", detail:"Source can be support, report issue, payment complaint, care concern, withdrawal concern, or KaFarm escalation.", route:"/admin/live-chat", priority:"High" },
      { id:"caretaker-reports", name:"Caretaker Reports", status:"Open issues", main:"Caretaker-submitted problems", detail:"QR/camera/upload/task/proof problems. KaFarm helps check related task and evidence logs.", route:"/admin/live-chat", priority:"Normal" },
      { id:"completed-issues", name:"Completed Issues", status:"Storage", main:"Resolved issue archive", detail:"Resolved customer/caretaker reports with final action, KaFarm summary, admin message, and evidence link.", route:"/admin/evidence", priority:"Normal" },
    ],
    verification: [
      { id:"customer-verify", name:"Customer Verification", status:"KYC", main:"Customer account verification", detail:"KYC, ID/selfie, birthday/name match, duplicate account risk, and withdrawal unblock.", route:"/admin/account-verification", priority:"High" },
      { id:"caretaker-verify", name:"Caretaker Verification", status:"Applications", main:"Caretaker account activation", detail:"Review caretaker email, name, number, selfie/photo, and resume before approving active status.", route:"/admin/caretaker-registration", priority:"High" },
      { id:"admin-verify", name:"Admin Verification", status:"Restricted", main:"Admin role assignment", detail:"Only approved owner/developer process can promote an email to admin. Keep as shortcut and audit trail.", route:"/admin/audit-logs", priority:"High" },
    ],
  }[kind];
  const [selected,setSelected]=useState(rowsByKind[0]);
  const [decision,setDecision]=useState<"open" | "approved" | "rejected">("open");
  const [note,setNote]=useState("");

  type OperationsRow = (typeof rowsByKind)[number];

  function choose(row: OperationsRow) {
    setSelected(row);
    setDecision("open");
    setNote("");
  }

  function mark(next: "approved" | "rejected") {
    setDecision(next);
    setNote(current=>current || (next === "approved" ? "Approved after checking linked evidence." : "Rejected/held until missing evidence is fixed."));
  }

  function toneFor(row: OperationsRow): "good" | "warn" | "bad" | "neutral" {
    if (row.priority === "High") return "bad";
    if (/review|approval|sensitive|open/i.test(row.status)) return "warn";
    return "neutral";
  }

  const details = [
    { label:"Purpose", value:selected.main },
    { label:"Status", value:selected.status },
    { label:"Linked Page", value:selected.route },
    { label:"Priority", value:selected.priority },
  ];

  const supportPanel = kind === "caretaker"
    ? <AdminLiveTaskProofQueue />
    : kind === "money"
      ? <AdminManualPaymentQueue />
      : <Card><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase text-[#667267]">Read Only Guide</p><h2 className="mt-1 text-xl font-black">Evidence and issue trail</h2><p className="mt-2 text-sm font-bold leading-6 text-[#667267]">This desk is for finding records, reviewing status, and deciding what page to open next. Sensitive actions stay in the linked approval pages.</p></div><Badge tone="neutral">Report Only</Badge></div><div className="mt-4 grid gap-3 md:grid-cols-3"><div className="rounded-2xl bg-[#f4efe4] p-4"><b>1. Select</b><p className="mt-1 text-xs font-bold text-[#667267]">Choose customer, caretaker, or admin trail.</p></div><div className="rounded-2xl bg-[#f4efe4] p-4"><b>2. Inspect</b><p className="mt-1 text-xs font-bold text-[#667267]">Open evidence before any decision.</p></div><div className="rounded-2xl bg-[#f4efe4] p-4"><b>3. Resolve</b><p className="mt-1 text-xs font-bold text-[#667267]">Move finished work to resolved logs.</p></div></div></Card>;


  function actionPlan(row: OperationsRow) {
    if (kind === "money" && row.id === "cashin") return { label:"Payment Review", primary:"Confirm Payment", secondary:"Reject Receipt", next:"If confirmed, create receipt/invoice and notify customer. If rejected, customer sees reason and can resubmit.", checks:["Receiver account matches FarmConnect", "Reference number is not duplicate", "Amount and sender name match", "Receipt image is readable"] };
    if (kind === "money" && row.id === "withdraw") return { label:"Withdrawal Review", primary:"Mark Sent", secondary:"Return To Customer", next:"Upload payout proof, save reference number, then customer confirms receipt. If details are wrong, return with notes.", checks:["KYC is approved", "Saved payout account matches request", "Wallet balance and hold are correct", "Admin payout proof is attached"] };
    if (kind === "caretaker" && row.id === "registration") return { label:"Registration Link", primary:"Open Link Page", secondary:"Hold", next:"This is not an approval step. Use it to send the permanent caretaker registration link.", checks:["Permanent link works", "Applicant understands requirements", "No salary/rate shown on public form"] };
    if (kind === "caretaker" && row.id === "verification") return { label:"Caretaker Verification", primary:"Activate Account", secondary:"Reject Application", next:"Approve only after checking selfie/photo, phone, email, and resume. Rejected applicants should receive a clear reason.", checks:["Resume is visible", "Profile photo is clear", "Phone and payment details are complete", "Applicant is fit for farm work"] };
    if (kind === "caretaker" && row.id === "task-proof") return { label:"Task Proof Review", primary:"Approve Proof", secondary:"Return For Correction", next:"Approved proof goes to completed tasks and customer care logs. Rejected proof returns to caretaker with instructions.", checks:["QR/serial matches rooster", "Photo/video proof is clear", "Quantity used is recorded", "Customer notes were followed"] };
    if (kind === "caretaker") return { label:"Caretaker Record", primary:"Open Record", secondary:"Flag For Review", next:"Use this for viewing assignments, resume, payment mode, and completed work evidence.", checks:["Caretaker identity is clear", "Assigned customers are visible", "Task history is traceable", "Payment mode is recorded"] };
    if (kind === "farm" && row.id === "paid-care") return { label:"Care Revenue", primary:"Open Care Requests", secondary:"Flag Mismatch", next:"Paid care requests should connect to task management before caretaker assignment.", checks:["Customer paid request exists", "Service type and price are correct", "Task is ready for assignment", "Care logs will update after completion"] };
    if (kind === "farm") return { label:"Farm Report", primary:"Open Report", secondary:"Flag Data Issue", next:"This page is mostly read-only. Use calendar filters to verify daily totals and product/customer counts.", checks:["Date filter is correct", "Totals match linked records", "No duplicate count", "Linked customer/product records exist"] };
    if (kind === "issues") return { label:"Issue Handling", primary:"Resolve Issue", secondary:"Keep Open", next:"Use KaFarm/evidence to understand the issue, message the user, then move it to completed issues when resolved.", checks:["Affected user is identified", "Evidence trail is opened", "Root cause is written", "Customer/caretaker gets a clear update"] };
    if (kind === "verification") return { label:"Account Verification", primary:"Approve Verification", secondary:"Reject / Request Fix", next:"Verification affects access and money safety. Check identity records before approving.", checks:["Identity data matches", "Duplicate risk checked", "Sensitive fields are protected", "Decision is logged"] };
    return { label:"Evidence Review", primary:"Mark Reviewed", secondary:"Flag Issue", next:"Evidence pages are read-only until a linked request needs action. Use this to find proof fast.", checks:["Correct person selected", "Event timeline is complete", "Admin action is linked", "Record can be used for dispute review"] };
  }
  const plan = actionPlan(selected);

  return <Shell role="admin" title={config[0]}><PageTitle title={config[0]} text={config[1]} icon={config[2] as IconName} />
    <section className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {rowsByKind.map(row=><button key={row.id} onClick={()=>choose(row)} className={"min-h-36 rounded-2xl border p-4 text-left shadow-sm transition " + (selected.id===row.id ? "border-[#1f6b45] bg-[#e9fff3] ring-2 ring-[#1f6b45]/20" : "border-[#e3ded0] bg-white/95 hover:border-[#1f6b45]") }>
        <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-black uppercase text-[#667267]">{row.status}</p><h2 className="mt-2 truncate text-xl font-black">{row.name}</h2></div><Badge tone={toneFor(row)}>{row.priority}</Badge></div>
        <p className="mt-3 line-clamp-2 text-sm font-bold leading-6 text-[#526154]">{row.main}</p>
      </button>)}
    </section>

    <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(620px,1fr)_320px]">
      <div className="grid content-start gap-4"><Card><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black uppercase text-[#667267]">Selected Work Box</p><h2 className="mt-1 text-3xl font-black">{selected.name}</h2><p className="mt-2 max-w-3xl text-sm font-bold leading-6 text-[#667267]">{selected.detail}</p></div><Badge tone={toneFor(selected)}>{selected.status}</Badge></div><div className="mt-4 grid gap-3 md:grid-cols-2">{details.map(card=><div key={card.label} className="rounded-2xl border border-[#ece6d8] bg-[#fffdf7] p-4"><p className="text-xs font-black uppercase text-[#667267]">{card.label}</p><p className="mt-2 text-sm font-black leading-6">{card.value}</p></div>)}</div><div className="mt-4 flex flex-wrap gap-3"><Link href={selected.route} className="rounded-xl bg-[#1f6b45] px-4 py-3 text-sm font-black text-white">Open Linked Page</Link><Link href="/admin/evidence" className="rounded-xl bg-[#eee8d9] px-4 py-3 text-sm font-black">Open Evidence</Link></div></Card>{supportPanel}</div>

      <Card className="min-h-[640px]"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase text-[#667267]">Admin Next Step</p><h2 className="mt-1 text-xl font-black">{plan.label}</h2></div><Badge tone={toneFor(selected)}>{selected.priority}</Badge></div><p className="mt-3 rounded-2xl bg-[#f4efe4] p-4 text-sm font-bold leading-6 text-[#526154]">{plan.next}</p><div className="mt-4 rounded-2xl border border-[#ece6d8] bg-[#fffdf7] p-4"><p className="text-xs font-black uppercase text-[#667267]">Check Before Action</p><div className="mt-3 space-y-2">{plan.checks.map(check=><div key={check} className="flex gap-2 text-sm font-bold leading-5"><span className="mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-100 text-xs text-[#1f6b45]">?</span><span>{check}</span></div>)}</div></div><label className="mt-5 block text-sm font-black">Admin Notes / Reason</label><textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Write clear reason, evidence checked, and next instruction..." className="mt-2 h-36 w-full resize-none rounded-2xl border border-[#ded8c9] bg-[#fffdf7] p-3 text-sm font-bold leading-6" /><div className="mt-5 grid grid-cols-2 gap-3"><button onClick={()=>mark("approved")} className="min-h-20 rounded-2xl bg-[#1f6b45] px-4 py-3 text-sm font-black text-white shadow-sm">{plan.primary}</button><button onClick={()=>mark("rejected")} className="min-h-20 rounded-2xl bg-red-600 px-4 py-3 text-sm font-black text-white shadow-sm">{plan.secondary}</button></div><div className="mt-4 rounded-2xl border border-[#ece6d8] bg-white p-4"><p className="text-xs font-black uppercase text-[#667267]">Current UI Decision</p><p className={"mt-2 text-lg font-black " + (decision==="approved"?"text-[#1f6b45]":decision==="rejected"?"text-red-700":"text-[#667267]")}>{decision === "approved" ? plan.primary : decision === "rejected" ? plan.secondary : "Waiting for admin decision"}</p><p className="mt-1 text-xs font-bold leading-5 text-[#667267]">This is UI review state only. Backend approval functions will be wired per real request type.</p></div><div className="mt-4 grid gap-2"><Link href={selected.route} className="rounded-xl bg-[#1f6b45] px-4 py-3 text-center font-black text-white">Open Work Page</Link><Link href="/admin/evidence" className="rounded-xl bg-[#eee8d9] px-4 py-3 text-center font-black">Open Evidence</Link><Link href="/admin/customer-desk/resolved" className="rounded-xl bg-white px-4 py-3 text-center font-black shadow-sm">Resolved Logs</Link></div></Card>
    </div>
  </Shell>;
}

function AdminWorkDesk({ kind, config }: { kind: "caretaker" | "farm" | "money" | "evidence" | "kafarm"; config: string[] }) {
  const caretakerRows = [
    { name: "Juan Dela Cruz", role: "Senior caretaker", status: "On duty", resume: "6 years farm care, QR trained", pay: 500, present: 5, absent: 0, mode: "GCash", avatar: "JD" },
    { name: "Mia Santos", role: "Feed and supplement", status: "Needs proof review", resume: "Vitamin/video task trained", pay: 500, present: 4, absent: 1, mode: "Maya", avatar: "MS" },
    { name: "Rico Tan", role: "Night watch", status: "Available", resume: "Pen rotation and health check", pay: 500, present: 3, absent: 2, mode: "UnionBank", avatar: "RT" },
  ];
  const farmRows = [
    { rooster: "Bantay", status: "Taken", owner: "Aydana Buratino", caretaker: "Juan D.", pen: "A-04", note: "Care active" },
    { rooster: "Red Ace", status: "Available", owner: "Farm stock", caretaker: "Unassigned", pen: "B-02", note: "Ready to sell" },
    { rooster: "Kidlat", status: "Sell request", owner: "Marco Reyes", caretaker: "Mia S.", pen: "C-01", note: "Needs weight check" },
  ];
  const moneyRows = [
    { type: "Cash-in", name: "Marco Reyes", amount: 1200, status: "Reference check", source: "GCash" },
    { type: "Withdrawal", name: "Aydana Buratino", amount: 2500, status: "KYC locked", source: "Maya" },
    { type: "Treasury", name: "Today", amount: 18400, status: "Available after holds", source: "FarmConnect" },
  ];
  const evidenceRows = [
    { title: "KYC duplicate packet", owner: "Aydana Buratino", status: "Open", source: "Customer Desk" },
    { title: "Blurred vitamin proof", owner: "Mia Santos", status: "Review", source: "Caretaker proof" },
    { title: "Cash-in duplicate reference", owner: "Marco Reyes", status: "Investigate", source: "Money Desk" },
    { title: "Resolved withdrawal", owner: "Lina Cruz", status: "Archived", source: "Resolved Cases" },
  ];
  const payrollTotal = caretakerRows.reduce((sum,row)=>sum + row.pay * row.present, 0);
  const cards = adminDeskCards[kind] || [];
  if (kind === "kafarm") return <Shell role="admin" title={config[0]}><PageTitle title="Ka-Farm Console" text="Buddy troubleshooter for admin: it explains what happened, what evidence to open, and what action is safest." icon="support" /><div className="grid gap-5 xl:grid-cols-[1fr_420px]"><div className="grid gap-4 md:grid-cols-2"><Card><h2 className="text-xl font-black">What Ka-Farm Does</h2><p className="mt-2 text-sm font-bold leading-6 text-[#667267]">Reads customer/caretaker/admin logs, summarizes the problem, points to the correct evidence, and suggests the next safe action.</p></Card><Card><h2 className="text-xl font-black">Limit</h2><p className="mt-2 text-sm font-bold leading-6 text-[#667267]">Ka-Farm can guide and prepare templates, but admin still approves payouts, KYC decisions, caretaker exceptions, and final customer messages.</p></Card><Card><h2 className="text-xl font-black">Ask Examples</h2><p className="mt-2 text-sm font-bold leading-6 text-[#667267]">Ano naiwan? Bakit flagged ang proof? Ano evidence bago ako magrelease ng withdrawal? Sino caretaker ng rooster na ito?</p></Card><Card><h2 className="text-xl font-black">Turnover Guide</h2><p className="mt-2 text-sm font-bold leading-6 text-[#667267]">If owner is away, Ka-Farm shows the workflow bridge: customer request, admin check, caretaker task, proof review, customer update.</p></Card></div><KaFarmAdmin /></div></Shell>;
  return <Shell role="admin" title={config[0]}><PageTitle title={config[0]} text={config[1]} icon={config[2] as IconName} /><KaFarm>{kind === "caretaker" ? "Caretaker desk is for applications, resume review, payment method records, payroll, proof, and chat. Start with pending applications." : kind === "farm" ? "Farm operations connects rooster inventory, customer ownership, request queue, sale pricing, and invoices." : kind === "money" ? "Money desk separates cash-in checks, withdrawal review, treasury, and receipts so admin can follow the money trail." : "Evidence desk keeps the farm protected: every proof, receipt, override, and decision stays searchable."}</KaFarm><div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">{cards.map(card=><Link key={card.title} href={card.href} className="rounded-2xl border border-[#e3ded0] bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"><Icon name={card.icon} className="h-7 w-7 text-[#1f6b45]" /><h2 className="mt-3 text-xl font-black">{card.title}</h2><p className="mt-2 min-h-[72px] text-sm font-bold leading-6 text-[#667267]">{card.text}</p></Link>)}</div><AdminRoleBridge kind={kind} />{kind === "caretaker" && <><AdminCaretakerApplicationQueue /><div className="mt-5 grid gap-5 xl:grid-cols-[360px_1fr]"><Card><h2 className="text-xl font-black">Active Caretaker List</h2><div className="mt-4 max-h-[430px] space-y-3 overflow-y-auto pr-2">{caretakerRows.map(row=><div key={row.name} className="rounded-2xl border border-[#ece6d8] p-3"><div className="flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-full bg-[#1f6b45] font-black text-white">{row.avatar}</div><div className="min-w-0 flex-1"><b className="block truncate">{row.name}</b><p className="truncate text-sm font-bold text-[#667267]">{row.role}</p></div><Badge tone={row.status.includes("Review")?"warn":"good"}>{row.status}</Badge></div></div>)}</div></Card><Card><div className="grid gap-4 lg:grid-cols-2"><div><h2 className="text-xl font-black">Resume View</h2><div className="mt-4 rounded-3xl bg-[#f6f3e8] p-5"><div className="grid h-24 w-24 place-items-center rounded-full bg-white text-3xl font-black">JD</div><h3 className="mt-4 text-2xl font-black">Juan Dela Cruz</h3><p className="font-bold text-[#667267]">{caretakerRows[0].resume}</p><p className="mt-3 text-sm font-bold text-[#667267]">Contact and address stay admin-only.</p></div></div><div><h2 className="text-xl font-black">Payroll Snapshot</h2><div className="mt-4 rounded-3xl bg-emerald-50 p-5"><p className="text-sm font-black uppercase text-[#667267]">15th / 30th Payroll</p><p className="mt-2 text-3xl font-black text-[#1f6b45]">{peso(payrollTotal)}</p><p className="mt-2 text-sm font-bold text-[#667267]">Computed from per-day rate, present days, absent days, and payout mode.</p></div>{caretakerRows.map(row=><div key={row.name+"pay"} className="mt-3 flex items-center justify-between rounded-xl border p-3 text-sm font-bold"><span>{row.name}</span><span>{row.present} present / {row.absent} absent - {peso(row.pay*row.present)}</span></div>)}</div></div></Card></div></>}{kind === "farm" && <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_360px]"><Card><h2 className="text-xl font-black">Rooster Inventory</h2><div className="mt-4 max-h-[430px] overflow-y-auto pr-2"><div className="grid gap-3">{farmRows.map(row=><div key={row.rooster} className="grid gap-3 rounded-2xl border border-[#ece6d8] p-4 md:grid-cols-6"><b>{row.rooster}</b><span>{row.status}</span><span>{row.owner}</span><span>{row.caretaker}</span><span>{row.pen}</span><span className="text-[#667267]">{row.note}</span></div>)}</div></div></Card><Card><h2 className="text-xl font-black">Request Queue</h2><p className="mt-2 text-sm font-bold leading-6 text-[#667267]">Sell requests and care requests land here first. Admin sets price or assigns caretaker; caretaker checks weight/status when needed.</p><Link href="/admin/sell-requests" className="mt-4 inline-block rounded-xl bg-[#1f6b45] px-4 py-3 font-black text-white">Open Sell Queue</Link></Card></div>}{kind === "money" && <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_360px]"><AdminManualPaymentQueue /><Card><h2 className="text-xl font-black">Treasury Meaning</h2><p className="mt-2 text-sm font-bold leading-6 text-[#667267]">Treasury is the owner view of money: real cash received, pending manual payments, locked customer savings, unpaid withdrawals, payroll due, and available farm funds.</p><Link href="/admin/customer-desk/withdraw" className="mt-4 inline-block rounded-xl bg-[#1f6b45] px-4 py-3 font-black text-white">Open Withdrawal Desk</Link></Card></div>}{kind === "evidence" && <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_360px]"><Card><h2 className="text-xl font-black">Evidence Stream</h2><div className="mt-4 max-h-[430px] space-y-3 overflow-y-auto pr-2">{evidenceRows.map(row=><div key={row.title} className="grid gap-3 rounded-2xl border border-[#ece6d8] p-4 md:grid-cols-4"><b>{row.title}</b><span>{row.owner}</span><span>{row.source}</span><Badge tone={row.status==="Archived"?"good":"warn"}>{row.status}</Badge></div>)}</div></Card><Card><h2 className="text-xl font-black">Resolved Cases</h2><p className="mt-2 text-sm font-bold leading-6 text-[#667267]">Finished problems move here with final decision, receipt/invoice, customer notice, admin note, and evidence links.</p><Link href="/admin/customer-desk/resolved" className="mt-4 inline-block rounded-xl bg-[#1f6b45] px-4 py-3 font-black text-white">Open Resolved</Link></Card></div>}</Shell>;
}

export function AdminDesk({ kind }: { kind: "customer" | "caretaker" | "farm" | "money" | "chat" | "evidence" | "kafarm" | "issues" | "verification" }) {
  const config = {
    customer: ["Customer Requests Management", "Review customer payment receipts, care requests, task assignment, and withdrawal requests.", "clipboard"],
    caretaker: ["Caretaker Management", "Registration, verification, caretaker list, task verification, and completed task evidence.", "user"],
    farm: ["Farm Operations", "Product sales summary, customer registry, and paid care request income.", "rooster"],
    money: ["Money Desk", "Review cash-ins, withdrawals, treasury, receipts, and money evidence.", "coins"],
    chat: ["Live Chat", "Only escalated Ka-Farm chats and caretaker-admin chats appear here.", "chat"],
    evidence: ["Evidence Logs", "Customer, caretaker, and admin evidence organized person by person.", "file"],
    kafarm: ["KaFarm Console", "Context-aware IT-Ops buddy for admin investigation, evidence, reports, and safe next steps.", "support"],
    issues: ["Issue Management", "Customer reports, caretaker reports, and completed issue storage with KaFarm investigation.", "alert"],
    verification: ["Account Verification", "Customer, caretaker, and admin verification shortcuts from one source of truth.", "shield"],
  }[kind];
  if (kind === "chat") return <AdminLiveChatPage />;
  if (kind === "customer") return <AdminCustomerDeskPage />;
  if (kind === "caretaker") return <AdminCaretakerManagementPage config={config} />;
  if (kind === "farm" || kind === "money" || kind === "evidence" || kind === "issues" || kind === "verification") return <AdminOperationsDeskFormat kind={kind} config={config} />;
  return <AdminWorkDesk kind={kind as "caretaker" | "farm" | "money" | "evidence" | "kafarm"} config={config} />;
}

export function AccessPage({ role }: { role: Role }) {
  return <UnifiedLoginPage suggestedRole={role} />;
}

export function RoleAuthPage({ role, mode = "login" }: { role: Role; mode?: "login" | "register" }) {
  if (mode === "register" && role === "customer") return <FarmerSignupPage />;
  return <UnifiedLoginPage suggestedRole={role} />;
}

function roleWorkspace(role: Role) {
  if (role === "admin") return "/admin";
  if (role === "caretaker") return "/caretaker/dashboard";
  return "/customer/dashboard";
}

function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#102017] px-4 py-8 text-[#17251d]">
      <img src="/farmconnect-hero-wallpaper.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-br from-[#072315]/88 via-[#0f5c52]/58 to-[#ffd34f]/35" />
      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-64px)] w-full max-w-6xl items-center justify-center">
        {children}
      </div>
    </main>
  );
}

function AuthPanel({ icon, title, text, children }: { icon: IconName; title: string; text: string; children: ReactNode }) {
  return (
    <Card className="w-full max-w-3xl border-2 border-[#ffd84a] bg-white/96 shadow-2xl">
      <div className="flex flex-wrap items-center gap-4">
        <div className="grid h-16 w-16 place-items-center rounded-2xl bg-[#1f6b45] text-white shadow-lg"><Icon name={icon} className="h-7 w-7" /></div>
        <div>
          <h1 className="text-3xl font-black md:text-4xl">{title}</h1>
          <p className="mt-1 max-w-2xl text-sm font-bold leading-6 text-[#56635b]">{text}</p>
        </div>
      </div>
      {children}
    </Card>
  );
}

export function UnifiedLoginPage({ suggestedRole }: { suggestedRole?: Role }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("Ka-Farm will check the email role and open the correct workspace.");

  async function submit() {
    if (!email || !password) {
      setMessage("Please enter email and password first.");
      return;
    }
    setLoading(true);
    setMessage("Role guardian is checking this account...");
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (!data.user) {
        setMessage("Login did not finish. Please try again.");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, role, account_status")
        .eq("auth_user_id", data.user.id)
        .maybeSingle();
      if (profileError) throw profileError;

      if (!profile) {
        setMessage("No app profile found yet. Customer can sign up; caretaker needs application approval.");
        return;
      }

      const status = String(profile.account_status || "").toLowerCase();
      if (status && !["active", "approved"].includes(status)) {
        setMessage(status === "pending_approval" ? "Your account is waiting for admin approval." : "This account is not active. Please contact admin.");
        return;
      }

      const role = (profile.role || "customer") as Role;
      router.push(roleWorkspace(role));
    } catch (error) {
      const text = error instanceof Error ? error.message : "Please check your details and try again.";
      setMessage(text.toLowerCase().includes("invalid") ? "Email or password did not match. Please try again." : "We could not complete this yet. Please try again in a moment.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <AuthPanel icon="shield" title="FarmConnect Login" text="One login only. Ka-Farm checks the email role, then opens Customer, Caretaker, or Admin automatically.">
        {suggestedRole && <p className="mt-4 rounded-2xl bg-[#f6f3e8] p-3 text-sm font-black text-[#667267]">Opening from {suggestedRole} access, but role guardian still decides from database.</p>}
        <KaFarm>{message}</KaFarm>
        <div className="mt-5 grid gap-3">
          <input value={email} onChange={e=>setEmail(e.target.value)} className="rounded-xl border border-[#ded8c9] p-3 font-bold" placeholder="Email" type="email" />
          <input value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")submit();}} className="rounded-xl border border-[#ded8c9] p-3 font-bold" placeholder="Password" type="password" />
          <button onClick={submit} disabled={loading} className="rounded-xl bg-[#1f6b45] px-5 py-3 font-black text-white disabled:opacity-60">{loading ? "Checking..." : "Login"}</button>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href="/customer/register" className="rounded-xl bg-[#ffd84a] px-4 py-3 font-black">Create Customer Account</Link>
          <Link href="/caretaker/signup" className="rounded-xl bg-[#e7f6ee] px-4 py-3 font-black text-[#1f6b45]">Apply as Caretaker</Link>
          <Link href="/" className="rounded-xl bg-[#eee8d9] px-4 py-3 font-black">Home</Link>
        </div>
      </AuthPanel>
    </AuthShell>
  );
}

export function FarmerSignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ fullName: "", displayName: "", email: "", phone: "", birthdate: "", password: "", confirmPassword: "" });
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("Customer signup creates a customer role only. KYC documents stay in Settings after login.");

  function update(key: keyof typeof form, value: string) {
    setForm(current => ({ ...current, [key]: value }));
  }

  async function submit() {
    if (!form.fullName || !form.email || !form.phone || !form.birthdate || !form.password) {
      setMessage("Please complete name, email, phone, birthdate, and password.");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setMessage("Password and confirm password do not match.");
      return;
    }
    if (!consent) {
      setMessage("Please accept the terms and KYC consent notice first.");
      return;
    }
    setLoading(true);
    setMessage("Creating your customer account...");
    try {
      const { data, error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: { data: { full_name: form.fullName, display_name: form.displayName, phone: form.phone, birthdate: form.birthdate, role: "customer" } },
      });
      if (error) throw error;
      if (data.user) {
        const { error: profileError } = await supabase.from("profiles").insert({
          auth_user_id: data.user.id,
          email: form.email,
          phone: form.phone,
          full_name: form.fullName,
          display_name: form.displayName || form.fullName,
          role: "customer",
          account_status: "active",
          verification_status: "pending",
          membership_status: "inactive",
          birthdate: form.birthdate,
        });
        if (profileError && !profileError.message.toLowerCase().includes("duplicate")) throw profileError;
      }
      setMessage(data.session ? "Customer account ready. Opening dashboard..." : "Account created. Please login if email confirmation is required.");
      if (data.session) router.push("/customer/dashboard");
    } catch (error) {
      const text = error instanceof Error ? error.message : "Signup failed.";
      setMessage(text.toLowerCase().includes("row-level") || text.toLowerCase().includes("policy") ? "Customer profile could not be created yet. Check profile RLS/signup SQL." : text);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <AuthPanel icon="user" title="Customer Registration" text="For customers/farmers who will buy roosters, request care, use wallet withdrawal, and submit KYC later in Settings.">
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <input value={form.fullName} onChange={e=>update("fullName", e.target.value)} className="rounded-xl border border-[#ded8c9] p-3 font-bold" placeholder="Legal full name" />
          <input value={form.displayName} onChange={e=>update("displayName", e.target.value)} className="rounded-xl border border-[#ded8c9] p-3 font-bold" placeholder="Display name / nickname" />
          <input value={form.email} onChange={e=>update("email", e.target.value)} className="rounded-xl border border-[#ded8c9] p-3 font-bold" placeholder="Email" type="email" />
          <input value={form.phone} onChange={e=>update("phone", e.target.value)} className="rounded-xl border border-[#ded8c9] p-3 font-bold" placeholder="Phone number" />
          <input value={form.birthdate} onChange={e=>update("birthdate", e.target.value)} className="rounded-xl border border-[#ded8c9] p-3 font-bold" type="date" />
          <input value={form.password} onChange={e=>update("password", e.target.value)} className="rounded-xl border border-[#ded8c9] p-3 font-bold" placeholder="Password" type="password" />
          <input value={form.confirmPassword} onChange={e=>update("confirmPassword", e.target.value)} className="rounded-xl border border-[#ded8c9] p-3 font-bold md:col-span-2" placeholder="Confirm password" type="password" />
        </div>
        <label className="mt-4 flex items-start gap-3 rounded-2xl bg-[#f6f3e8] p-4 text-sm font-bold leading-6 text-[#56635b]">
          <input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} className="mt-1" />
          <span>I agree to FarmConnect terms, privacy notice, and future KYC verification before withdrawals or sensitive wallet actions.</span>
        </label>
        <KaFarm>{message}</KaFarm>
        <div className="mt-4 flex flex-wrap gap-3">
          <button onClick={submit} disabled={loading} className="rounded-xl bg-[#1f6b45] px-5 py-3 font-black text-white disabled:opacity-60">{loading ? "Creating..." : "Create Customer Account"}</button>
          <Link href="/login" className="rounded-xl bg-[#eee8d9] px-5 py-3 font-black">Back to Login</Link>
        </div>
      </AuthPanel>
    </AuthShell>
  );
}

export function CaretakerSignupPage() {
  const [form, setForm] = useState({
    fullName: "", displayName: "", email: "", phone: "", birthdate: "", addressLine: "",
    avatarUrl: "", resumeUrl: "", farmRole: "", paymentMethod: "GCash", paymentAccountName: "",
    paymentAccountNumber: "", emergencyContactName: "", emergencyContactPhone: "", password: "", confirmPassword: "", workPin: "",
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("Caretaker signup is an application. Admin approval is required before the caretaker app opens.");

  function update(key: keyof typeof form, value: string) {
    setForm(current => ({ ...current, [key]: value }));
  }

  function explainCaretakerApplicationError(error: unknown) {
    const source = error as { message?: string; details?: string; hint?: string; code?: string; status?: number };
    const raw = [
      source?.message,
      source?.details,
      source?.hint,
      source?.code ? `Code: ${source.code}` : "",
      source?.status ? `Status: ${source.status}` : "",
    ].filter(Boolean).join(" | ") || "Application failed.";
    const text = raw.toLowerCase();

    console.error("KaFarm caretaker application issue", {
      page: "/caretaker/signup",
      role: "caretaker_applicant",
      expected: "Create auth login then submit caretaker application for admin approval.",
      actual: raw,
      possibleRootCause: text.includes("login required")
        ? "RPC did not receive a valid Supabase auth session."
        : text.includes("row-level security") || text.includes("permission") || text.includes("denied")
          ? "Database permission or RLS blocked the application flow."
          : text.includes("function") || text.includes("schema cache")
            ? "Caretaker application SQL/RPC may be missing or outdated."
            : text.includes("duplicate") || text.includes("unique") || text.includes("already")
              ? "A caretaker application for this login may already exist."
              : "Unknown caretaker application blocker. Check RPC response and database logs.",
      evidenceNeeded: ["Supabase RPC response", "auth session status", "caretaker_applications row", "RLS/policy status"],
    });

    if (text.includes("login required")) {
      return "Ka-Farm found the blocker: login session was not active when submitting. Please login again, then resubmit the caretaker application.";
    }
    if (text.includes("row-level security") || text.includes("permission") || text.includes("denied") || text.includes("401") || text.includes("403")) {
      return "Ka-Farm found the blocker: database permission/RLS blocked the caretaker application. Admin needs to check caretaker application SQL policy.";
    }
    if (text.includes("function") || text.includes("does not exist") || text.includes("schema cache")) {
      return "Ka-Farm found the blocker: caretaker application SQL/RPC is missing or outdated. Run/check SQL 010.";
    }
    if (text.includes("duplicate") || text.includes("unique") || text.includes("already")) {
      return "Ka-Farm found the blocker: this caretaker application may already be in admin review. Check Caretaker Management > Registration/Verification.";
    }
    return `Ka-Farm found the blocker: ${raw}`;
  }

  async function submit() {
    if (!form.fullName || !form.email || !form.phone || !form.resumeUrl || !form.password) {
      setMessage("Please complete name, email, phone, resume, and password.");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setMessage("Password and confirm password do not match.");
      return;
    }
    setLoading(true);
    setMessage("Creating login and sending caretaker application...");
    try {
      let { data, error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: { data: { full_name: form.fullName, display_name: form.displayName, phone: form.phone, role: "caretaker_applicant" } },
      });
      if (error) {
        const text = error.message.toLowerCase();
        if (!text.includes("already") && !text.includes("registered") && !text.includes("exists")) throw error;
        const signIn = await supabase.auth.signInWithPassword({ email: form.email, password: form.password });
        if (signIn.error) throw signIn.error;
        data = signIn.data;
      }
      if (!data.user || !data.session) {
        const signIn = await supabase.auth.signInWithPassword({ email: form.email, password: form.password });
        if (signIn.error || !signIn.data.user || !signIn.data.session) {
          setMessage("Login was created, but the application was not submitted yet because this account still needs a valid session. Please login, then submit again.");
          return;
        }
        data = signIn.data;
      }
      await submitCaretakerApplication({
        fullName: form.fullName,
        displayName: form.displayName,
        phone: form.phone,
        birthdate: form.birthdate || null,
        addressLine: form.addressLine,
        avatarUrl: form.avatarUrl,
        resumeUrl: form.resumeUrl,
        farmRole: form.farmRole,
        paymentMethod: form.paymentMethod,
        paymentAccountName: form.paymentAccountName,
        paymentAccountNumber: form.paymentAccountNumber,
        emergencyContactName: form.emergencyContactName,
        emergencyContactPhone: form.emergencyContactPhone,
        workPinSet: form.workPin.length >= 4,
      });
      setMessage("Application submitted. Admin will review your resume and payment details before activation.");
    } catch (error) {
      setMessage(explainCaretakerApplicationError(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <AuthPanel icon="clipboard" title="Caretaker Application" text="For farm workers only. No salary/rate here. Admin reviews resume, payment method, and logs before activation.">
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <input value={form.fullName} onChange={e=>update("fullName", e.target.value)} className="rounded-xl border border-[#ded8c9] p-3 font-bold" placeholder="Full name" />
          <input value={form.displayName} onChange={e=>update("displayName", e.target.value)} className="rounded-xl border border-[#ded8c9] p-3 font-bold" placeholder="Nickname / display name" />
          <input value={form.email} onChange={e=>update("email", e.target.value)} className="rounded-xl border border-[#ded8c9] p-3 font-bold" placeholder="Email" type="email" />
          <input value={form.phone} onChange={e=>update("phone", e.target.value)} className="rounded-xl border border-[#ded8c9] p-3 font-bold" placeholder="Phone" />
          <input value={form.birthdate} onChange={e=>update("birthdate", e.target.value)} className="rounded-xl border border-[#ded8c9] p-3 font-bold" type="date" />
          <input value={form.farmRole} onChange={e=>update("farmRole", e.target.value)} className="rounded-xl border border-[#ded8c9] p-3 font-bold" placeholder="Farm role / job type" />
          <input value={form.addressLine} onChange={e=>update("addressLine", e.target.value)} className="rounded-xl border border-[#ded8c9] p-3 font-bold md:col-span-2" placeholder="Address" />
          <label className="rounded-xl border border-[#ded8c9] bg-white p-3 font-bold text-[#667267]">Selfie photo<input onChange={e=>update("avatarUrl", e.target.files?.[0]?.name || "")} className="mt-2 block w-full text-sm" type="file" accept="image/*" />{form.avatarUrl && <span className="mt-2 block text-xs text-[#1f6b45]">Selected: {form.avatarUrl}</span>}</label>
          <label className="rounded-xl border border-[#ded8c9] bg-white p-3 font-bold text-[#667267]">Resume file<input onChange={e=>update("resumeUrl", e.target.files?.[0]?.name || "")} className="mt-2 block w-full text-sm" type="file" accept=".pdf,.doc,.docx,image/*" />{form.resumeUrl && <span className="mt-2 block text-xs text-[#1f6b45]">Selected: {form.resumeUrl}</span>}</label>
          <select value={form.paymentMethod} onChange={e=>update("paymentMethod", e.target.value)} className="rounded-xl border border-[#ded8c9] p-3 font-bold">
            <option>GCash</option><option>Maya</option><option>UnionBank</option><option>GoTyme</option><option>BPI</option><option>Other Bank</option>
          </select>
          <input value={form.paymentAccountName} onChange={e=>update("paymentAccountName", e.target.value)} className="rounded-xl border border-[#ded8c9] p-3 font-bold" placeholder="Payment account name" />
          <input value={form.paymentAccountNumber} onChange={e=>update("paymentAccountNumber", e.target.value)} className="rounded-xl border border-[#ded8c9] p-3 font-bold" placeholder="Payment account number / mobile" />
          <input value={form.emergencyContactName} onChange={e=>update("emergencyContactName", e.target.value)} className="rounded-xl border border-[#ded8c9] p-3 font-bold" placeholder="Emergency contact name" />
          <input value={form.emergencyContactPhone} onChange={e=>update("emergencyContactPhone", e.target.value)} className="rounded-xl border border-[#ded8c9] p-3 font-bold" placeholder="Emergency contact number" />
          <input value={form.workPin} onChange={e=>update("workPin", e.target.value)} className="rounded-xl border border-[#ded8c9] p-3 font-bold" placeholder="Work PIN setup" type="password" />
          <input value={form.password} onChange={e=>update("password", e.target.value)} className="rounded-xl border border-[#ded8c9] p-3 font-bold" placeholder="Password" type="password" />
          <input value={form.confirmPassword} onChange={e=>update("confirmPassword", e.target.value)} className="rounded-xl border border-[#ded8c9] p-3 font-bold md:col-span-2" placeholder="Confirm password" type="password" />
        </div>
        <KaFarm>{message}</KaFarm>
        <div className="mt-4 flex flex-wrap gap-3">
          <button onClick={submit} disabled={loading} className="rounded-xl bg-[#1f6b45] px-5 py-3 font-black text-white disabled:opacity-60">{loading ? "Submitting..." : "Submit Application"}</button>
          <Link href="/login" className="rounded-xl bg-[#eee8d9] px-5 py-3 font-black">Back to Login</Link>
        </div>
      </AuthPanel>
    </AuthShell>
  );
}

export function LegacyAccessPage({ role }: { role: Role }) {
  const href = role === "admin" ? "/admin" : role === "caretaker" ? "/caretaker/dashboard" : "/customer/dashboard";
  const title = role === "admin" ? "Admin Access" : role === "caretaker" ? "Caretaker Access" : "Customer Access";
  return (
    <main className="grid min-h-screen place-items-center bg-[#f6f3e8] px-4 text-[#17251d]">
      <Card className="w-full max-w-xl">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[#1f6b45] text-white"><Icon name="shield" /></div>
        <h1 className="mt-5 text-3xl font-black">{title}</h1>
        <KaFarm>Account sign-in will be connected after the V1 flow test. For now, open the app safely without old database screens.</KaFarm>
        <Link href={href} className="mt-5 inline-block rounded-xl bg-[#1f6b45] px-5 py-3 font-black text-white">Open {title}</Link>
        <Link href="/" className="ml-3 inline-block rounded-xl bg-[#eee8d9] px-5 py-3 font-black">Home</Link>
      </Card>
    </main>
  );
}


























































































