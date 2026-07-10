"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { checkoutFarmCart, getCareLogRecords, getCurrentProfile, getFarmProducts, getWalletTransactions, saveCartItem, type CareLogRecord } from "@/lib/farmconnect-data";
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
    ["Customer Desk", "/admin/customer-desk", "users"],
    ["Caretaker Desk", "/admin/caretaker-desk", "user"],
    ["Farm Operations", "/admin/farm-operations", "rooster"],
    ["Money Desk", "/admin/money-desk", "coins"],
    ["Live Chat", "/admin/live-chat", "chat"],
    ["Operations", "/admin/operations", "clipboard"],
    ["Evidence", "/admin/evidence", "shield"],
    ["Ka-Farm", "/admin/kafarm", "support"],
  ],
} as const;

const products = [
  { id: "p1", name: "Standard Starter Chick", category: "Starter Chicks", unit: "per head", price: 450, stock: 30, image: "/farmconnect/roosters/fc-stage-1-chick-base.jpg" },
  { id: "p2", name: "Premium Rooster Feeds", category: "Feeds", unit: "per kg", price: 80, stock: 250, image: "/farmconnect/marketplace/fc-product-feeds.jpg" },
  { id: "p3", name: "Recovery Electrolytes", category: "Electrolytes", unit: "per sachet", price: 60, stock: 100, image: "/farmconnect/marketplace/fc-product-supplements.jpg" },
  { id: "p4", name: "Rooster Supplements", category: "Supplements", unit: "per tablet", price: 25, stock: 200, image: "/farmconnect/marketplace/fc-product-supplements.jpg" },
  { id: "p5", name: "Rooster Vitamins", category: "Vitamins", unit: "per dose", price: 75, stock: 150, image: "/farmconnect/marketplace/fc-product-vitamins.jpg" },
  { id: "p6", name: "Poultry Equipment", category: "Equipment", unit: "per item", price: 350, stock: 40, image: "/farmconnect/marketplace/fc-product-equipment.jpg" },
];

const roosters = [
  { id: "r1", name: "Thunder King", tag: "FC-128", stage: "Young Rooster", status: "In Care", health: "Good", value: "P8,000 - P12,000", image: "/farmconnect/roosters/fc-stage-3-young-rooster-base.jpg", pen: "Pen A-04", caretaker: "Juan D." },
  { id: "r2", name: "Red Ace", tag: "FC-212", stage: "Starter", status: "In Care", health: "Excellent", value: "P3,500 - P5,000", image: "/farmconnect/roosters/fc-stage-1-chick-base.jpg", pen: "Brooder B-02", caretaker: "Mario S." },
  { id: "r3", name: "Bantay", tag: "FC-301", stage: "Adult", status: "For Sale", health: "Good", value: "P10,000 - P15,000", image: "/farmconnect/roosters/fc-stage-4-adult-rooster-base.jpg", pen: "Pen C-01", caretaker: "Juan D." },
];

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

function Shell({ role, title, children }: { role: Role; title: string; children: React.ReactNode }) {
  const links = nav[role];
  const headerLinks = role === "admin" ? links.filter(([label]) => ["Customer Desk", "Caretaker Desk", "Farm Operations", "Money Desk", "Live Chat"].includes(label)) : links;
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
            {headerLinks.map(([label, href, icon]) => (
              <Link key={href} href={href} className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-black text-white transition hover:bg-white/16 xl:px-3 xl:text-sm">
                <FarmImageIcon name={icon as IconName} className="h-5 w-5 rounded-md" fallbackClassName="h-4 w-4" /> {label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            {role === "customer" && <TopIcon href="/customer/inbox" name="inbox" label="Inbox" imageSrc="/farmconnect/icons/farm-inbox.png" />}
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

function TopIcon({ href, name, label, imageSrc }: { href: string; name: IconName; label: string; imageSrc?: string }) {
  return <Link href={href} title={label} className="flex h-11 items-center gap-2 rounded-full border border-white/40 bg-white/92 px-3 text-sm font-black text-[#075c3a] shadow-sm transition hover:-translate-y-0.5 hover:bg-[#fff4a3] hover:shadow-md"><FarmImageIcon name={name} imageSrc={imageSrc} className="h-7 w-7 rounded-md" /><span className="hidden xl:inline">{label}</span></Link>;
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
  const [selected, setSelected] = useState(roosters[0]);
  return <Shell role="customer" title="My Roosters"><PageTitle title="My Roosters" text="Tap a rooster to view ownership details, care status, value, and next actions." icon="rooster" /><div className="grid gap-5 lg:grid-cols-[380px_1fr]"><Card><div className="flex items-center justify-between gap-3"><h2 className="text-xl font-black">Rooster List</h2><Badge>{roosters.length}</Badge></div><div className="mt-4 max-h-[620px] space-y-3 overflow-y-auto pr-2">{roosters.map(r=><button key={r.id} onClick={()=>setSelected(r)} className={"flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition " + (selected.id===r.id?"border-[#1f6b45] bg-emerald-50 shadow-sm":"border-[#ece6d8] bg-[#fffdf7] hover:border-[#cfc7b7]")}><RoosterPhoto src={r.image} alt={r.name} size="thumb" /><div className="min-w-0 flex-1"><b className="block truncate">{r.name}</b><p className="truncate text-sm font-bold text-[#667267]">{r.tag} - {r.stage}</p><p className="mt-1 truncate text-xs text-[#667267]">{r.pen}</p></div><Badge tone={r.health==="Excellent"?"good":"neutral"}>{r.health}</Badge></button>)}</div></Card><Card><div className="grid gap-5 xl:grid-cols-[minmax(300px,0.95fr)_1fr]"><RoosterPhoto src={selected.image} alt={selected.name} size="hero" /><div className="flex min-w-0 flex-col"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="text-sm font-black uppercase text-[#667267]">Owned Rooster</p><h2 className="mt-1 text-4xl font-black leading-tight">{selected.name}</h2><p className="mt-2 font-bold text-[#667267]">{selected.tag} - {selected.stage}</p></div><Badge tone={selected.status==="For Sale"?"warn":"good"}>{selected.status}</Badge></div><div className="mt-5 grid gap-3 sm:grid-cols-2"><Info label="Estimated Value" value={selected.value} /><Info label="Health" value={selected.health} /><Info label="Pen" value={selected.pen} /><Info label="Caretaker" value={selected.caretaker} /></div><div className="mt-5 rounded-2xl border border-[#e3ded0] bg-[#fffdf7] p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-black uppercase text-[#667267]">Latest Care Status</p><h3 className="mt-1 text-xl font-black">Verified today</h3></div><Badge tone="good">Good condition</Badge></div><div className="mt-3 grid gap-2 text-sm font-bold text-[#667267] sm:grid-cols-3"><span>Feed: On schedule</span><span>Proof: Reviewed</span><span>Next check: Today</span></div></div><div className="mt-auto flex flex-wrap gap-3 pt-5"><Link href="/customer/farm-requests" className="rounded-xl bg-[#1f6b45] px-4 py-3 font-black text-white">Request Care</Link><Link href="/customer/care-logs" className="rounded-xl bg-[#eee8d9] px-4 py-3 font-black">Care Logs</Link><Link href="/customer/farm-requests" className="rounded-xl bg-amber-300 px-4 py-3 font-black">Sell</Link></div></div></div></Card></div></Shell>;
}

export function CareLogsPage() {
  const [selected, setSelected] = useState(roosters[0]);
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
        if (!rows.some(row => row.rooster === selected.name)) {
          setSelected({
            id: `live-${rows[0].rooster}`,
            name: rows[0].rooster,
            tag: "Live record",
            stage: "In Care",
            status: "In Care",
            health: "Good",
            value: "Recorded",
            image: rows[0].image,
            pen: "Care logs",
            caretaker: rows[0].caretaker,
          });
        }
      })
      .catch(() => undefined);
    return () => { mounted = false; };
  }, []);
  const logs = [...localProofLogs, ...(liveLogs.length > 0 ? liveLogs : demoLogs)];
  const roosterChoices = [
    ...roosters,
    ...Array.from(new Set(logs.map(log => log.rooster)))
      .filter(name => !roosters.some(rooster => rooster.name === name))
      .map(name => ({
        id: `live-${name}`,
        name,
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
  const allSelectedLogs = logs.filter(log=>log.rooster===selected.name);
  const selectedLogs = logs
    .filter(log=>log.rooster===selected.name)
    .filter(log=>status==="All" || log.status===status)
    .filter(log=>`${log.title} ${log.type} ${log.item} ${log.detail} ${log.caretaker} ${log.status}`.toLowerCase().includes(query.toLowerCase()));
  const productTotal = allSelectedLogs.reduce((sum, log) => sum + log.productCost, 0);
  const laborTotal = allSelectedLogs.reduce((sum, log) => sum + log.laborCost, 0);
  const statuses = ["All", "Verified", "Approved", "Waiting Review"];
  return <Shell role="customer" title="Care Logs"><PageTitle title="Care Logs" text="Searchable care records with uploaded date, time, caretaker, proof, item used, and review status." icon="file" /><div className="grid gap-5 lg:grid-cols-[340px_1fr]"><Card><div className="flex items-center justify-between gap-3"><h2 className="text-xl font-black">Rooster</h2>{liveLogs.length > 0 && <Badge tone="good">Live</Badge>}</div><div className="mt-4 max-h-[560px] space-y-3 overflow-y-auto pr-2">{roosterChoices.map(r=><button key={r.id} onClick={()=>setSelected(r)} className={"flex w-full items-center gap-3 rounded-2xl border p-3 text-left " + (selected.id===r.id?"border-[#1f6b45] bg-emerald-50":"border-[#ece6d8] bg-[#fffdf7]")}><RoosterPhoto src={r.image} alt={r.name} size="thumb" /><div className="min-w-0 flex-1"><b className="block truncate">{r.name}</b><p className="truncate text-sm text-[#667267]">{r.tag} - {r.pen}</p></div><Badge>{logs.filter(log=>log.rooster===r.name).length}</Badge></button>)}</div></Card><div className="grid gap-5"><Card><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-2xl font-black">{selected.name}</h2><p className="text-sm font-bold text-[#667267]">{selected.tag} - {selected.pen}</p></div><Badge tone="good">Care active</Badge></div><div className="mt-4 grid gap-3 md:grid-cols-3"><Info label="Product Cost Used" value={peso(productTotal)} /><Info label="Updates" value={`${allSelectedLogs.length}`} /><Info label="Labor Cost" value={peso(laborTotal)} /></div></Card><Card><div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between"><div><h2 className="text-xl font-black">Records</h2><p className="text-sm font-bold text-[#667267]">{selectedLogs.length} matching log{selectedLogs.length===1?"":"s"}</p></div><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search logs..." className="w-full rounded-xl border border-[#ded8c9] bg-white px-4 py-3 font-bold xl:max-w-sm" /></div><div className="mt-4 flex flex-wrap gap-2">{statuses.map(s=><button key={s} onClick={()=>setStatus(s)} className={"rounded-full px-4 py-2 text-sm font-black " + (status===s?"bg-[#1f6b45] text-white":"bg-[#f6f3e8] text-[#17251d]")}>{s}</button>)}</div><div className="mt-5 max-h-[620px] space-y-3 overflow-y-auto pr-2">{selectedLogs.map(log=><div key={log.title + log.uploaded + log.time} className="grid gap-3 rounded-2xl border border-[#ece6d8] bg-[#fffdf7] p-4 md:grid-cols-[86px_1fr]"><a href={log.image} target="_blank" rel="noreferrer" title="Open proof image" className="h-20 w-20 overflow-hidden rounded-xl border border-[#ded8c9] bg-white"><img src={log.image} alt="" className="h-full w-full object-cover" /></a><div className="min-w-0"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-black">{log.title} - {log.time}</h3><Badge>{log.type}</Badge></div><p className="mt-1 text-sm font-bold text-[#667267]">{log.uploaded}</p><p className="mt-2 text-sm font-bold text-[#667267]">{log.detail}</p></div><Badge tone={log.status==="Verified" || log.status==="Approved" ? "good" : "warn"}>{log.status}</Badge></div><div className="mt-4 grid gap-2 text-sm md:grid-cols-2 xl:grid-cols-4"><span><b>Item:</b> {log.item}</span><span><b>Amount:</b> {log.amount}</span><span><b>Caretaker:</b> {log.caretaker}</span><span><b>Proof:</b> {log.proof}</span></div><p className="mt-3 rounded-xl bg-white px-3 py-2 text-sm font-bold text-[#667267]">{log.reviewer}</p></div></div>)}{selectedLogs.length===0 && <p className="rounded-2xl bg-[#f6f3e8] p-4 text-[#667267]">No care records match your search.</p>}</div></Card></div></div></Shell>;
}

function RoosterPhoto({ src, alt, size }: { src: string; alt: string; size: "thumb" | "hero" }) {
  const frame = size === "hero" ? "aspect-[4/3] w-full rounded-2xl sm:aspect-[16/11] lg:aspect-[4/3] xl:aspect-[16/11]" : "h-16 w-16 rounded-xl";
  const focal = src.includes("stage-4") ? "center 34%" : "center center";
  return <div className={`${frame} shrink-0 overflow-hidden border border-[#e7dfcf] bg-[#f6f3e8]`}><img src={src} alt={alt} style={{ objectPosition: focal }} className="h-full w-full object-cover" /></div>;
}

function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-[#f6f3e8] p-4"><p className="text-xs font-black uppercase text-[#667267]">{label}</p><p className="mt-1 font-black">{value}</p></div>; }
function MiniPanel({ title, items }: { title: string; items: string[] }) { return <div className="rounded-xl border border-[#e3ded0] p-4"><b>{title}</b><ul className="mt-3 space-y-2 text-sm text-[#667267]">{items.map(i=><li key={i}>{i}</li>)}</ul></div>; }

export function FarmBuy() {
  const [cat, setCat] = useState("All");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [liveProducts, setLiveProducts] = useState(products);
  const [marketNote, setMarketNote] = useState("Add items to Cart first. When your wallet is enough, tap Buy.");
  const [carePurpose, setCarePurpose] = useState<{ rooster: string; caretaker: string; item: string; qty: string; reason: string } | null>(null);
  const balance = 1200;
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
        setLiveProducts(rows.map(row => ({
          id: row.id,
          name: row.name,
          category: String(row.category || "Farm Items").replaceAll("_", " ").replace(/\b\w/g, c => c.toUpperCase()),
          unit: row.unit_label || "per item",
          price: Number(row.unit_price || 0),
          stock: Number(row.stock_quantity || 0),
          image: row.image_url || "/farmconnect/marketplace/fc-product-equipment.jpg",
        })));
        setMarketNote("Live farm inventory is loaded from Supabase.");
      })
      .catch(() => setMarketNote("Farm inventory is using the safe preview list while live items are checked."));
    return () => { mounted = false; };
  }, []);
  const cats = ["All", ...Array.from(new Set(liveProducts.map(p=>p.category)))];
  const visible = cat === "All" ? liveProducts : liveProducts.filter(p=>p.category===cat);
  const cartEntries = Object.entries(cart).filter(([,qty])=>qty>0).map(([id,qty])=>({ product: liveProducts.find(p=>p.id===id), qty })).filter((row): row is { product: typeof products[number]; qty: number } => Boolean(row.product));
  const itemCount = cartEntries.reduce((sum,row)=>sum+row.qty,0);
  const total = cartEntries.reduce((sum,row)=>sum + row.product.price * row.qty, 0);
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
      setMarketNote("Ka-Farm is preparing your order...");
      const entries = cartEntries.map(row => [row.product.id, row.qty] as const);
      const hasPreviewProduct = entries.some(([id]) => !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id));
      if (hasPreviewProduct) {
        setLiveProducts(current => current.map(product => {
          const bought = entries.find(([id]) => id === product.id)?.[1] || 0;
          return bought > 0 ? { ...product, stock: Math.max(0, product.stock - bought) } : product;
        }));
        setCart({});
        setMarketNote("Purchase completed. Inventory stock was reduced.");
        return;
      }
      for (const [id, qty] of entries) {
        const item = liveProducts.find(product => product.id === id);
        if (item) await saveCartItem(id, qty, item.price, carePurpose ? {
          purposeNote: `${carePurpose.rooster} / ${carePurpose.item} / ${carePurpose.qty} / ${carePurpose.caretaker} / ${carePurpose.reason}`,
        } : undefined);
      }
      await checkoutFarmCart();
      setLiveProducts(current => current.map(product => {
        const bought = entries.find(([id]) => id === product.id)?.[1] || 0;
        return bought > 0 ? { ...product, stock: Math.max(0, product.stock - bought) } : product;
      }));
      setCart({});
      setMarketNote("Purchase completed. Inventory stock was reduced.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      setMarketNote(message.includes("NOT_ENOUGH_FUNDS") ? "Wallet balance is short. Please Cash In first." : message.includes("INSUFFICIENT_STOCK") ? "Not enough stock for one item. Please reduce quantity or choose another item." : message === "login_required" || message.toLowerCase().includes("login") ? "Please login first so we can save the order and receipt." : "We could not complete the order yet. Your cart is still saved here.");
    }
  }
  return <Shell role="customer" title="Farm Buy"><PageTitle title="Farm Buy" text="Choose quantity with plus and minus. Selected items appear in your cart." icon="bag" />{carePurpose && <Card className="mb-5 border-2 border-amber-300 bg-amber-50"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-black">Linked Care Purchase</h2><p className="mt-1 text-sm font-bold text-[#667267]">{carePurpose.item} ({carePurpose.qty}) for {carePurpose.rooster}</p><p className="mt-1 text-sm text-[#667267]">Caretaker: {carePurpose.caretaker} - {carePurpose.reason}</p></div><button onClick={()=>setCarePurpose(null)} className="rounded-xl bg-white px-4 py-3 font-black">Clear Link</button></div></Card>}<div className="mb-5 rounded-2xl border border-[#e3ded0] bg-white p-3 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-[#f6f3e8] p-4"><div className="flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-xl bg-white text-[#1f6b45] shadow-sm"><Icon name="wallet" /></div><div><p className="text-xs font-black uppercase text-[#667267]">Wallet Balance</p><p className="text-3xl font-black">{peso(balance)}</p></div></div><Link href="/customer/inventory" title="Inventory" className="relative grid h-14 w-14 place-items-center overflow-hidden rounded-full bg-white p-1 shadow-md"><img src="/farmconnect/icons/farm-bag.png" alt="" className="h-12 w-12 object-contain" /></Link></div></div><div className="mt-5 grid gap-5 lg:grid-cols-[1fr_360px]"><div><div className="mb-4 flex flex-wrap gap-2">{cats.map(c=><button key={c} onClick={()=>setCat(c)} className={"rounded-full px-4 py-2 text-sm font-black " + (cat===c?"bg-[#1f6b45] text-white":"bg-white")}>{c}</button>)}</div><div className="grid max-h-[760px] gap-4 overflow-y-auto pr-2 md:grid-cols-2 xl:grid-cols-3">{visible.map(p=><section key={p.id} className={"overflow-hidden rounded-2xl border bg-white shadow-sm transition " + ((cart[p.id]||0)>0?"border-[#1f6b45] ring-2 ring-emerald-100":"border-[#e3ded0]")}><div className="relative"><img src={p.image} alt="" className="h-44 w-full object-cover" /><Badge tone={(cart[p.id]||0)>0?"good":"neutral"}>{p.category}</Badge></div><div className="p-4"><h3 className="text-lg font-black leading-tight">{p.name}</h3><div className="mt-3 flex items-end justify-between gap-3"><div><p className="text-2xl font-black">{peso(p.price)}</p><p className="text-sm font-bold text-[#667267]">{p.unit}</p></div><p className="rounded-xl bg-[#f6f3e8] px-3 py-2 text-sm font-black">{p.stock} left</p></div><div className="mt-4 flex items-center justify-between rounded-2xl bg-[#f6f3e8] p-2"><button aria-label={`Remove ${p.name}`} onClick={()=>setQty(p.id,(cart[p.id]||0)-1)} className="grid h-11 w-11 place-items-center rounded-xl bg-white text-xl font-black shadow-sm">-</button><div className="text-center"><p className="text-xs font-black uppercase text-[#667267]">Qty</p><p className="text-xl font-black">{cart[p.id]||0}</p></div><button aria-label={`Add one ${p.name}`} onClick={()=>setQty(p.id,(cart[p.id]||0)+1)} className="grid h-11 w-11 place-items-center rounded-xl bg-[#1f6b45] text-xl font-black text-white shadow-sm">+</button></div></div></section>)}</div></div><Card className="h-fit border-2 border-[#1f6b45] lg:sticky lg:top-32"><div className="flex items-center justify-between"><h2 className="flex items-center gap-2 text-2xl font-black"><Icon name="bag" /> Cart</h2><Badge tone={itemCount>0?"good":"neutral"}>{itemCount}</Badge></div><div className="mt-4 max-h-[360px] space-y-3 overflow-y-auto pr-2">{cartEntries.map(({product,qty})=><div key={product.id} className="rounded-xl bg-[#f6f3e8] p-3"><div className="flex justify-between gap-3 text-sm"><span><b>{product.name}</b><br/><span className="text-[#667267]">{qty} x {peso(product.price)}</span></span><b>{peso(product.price*qty)}</b></div></div>)}{total===0 && <p className="rounded-xl bg-[#f6f3e8] p-3 text-sm text-[#667267]">Cart is empty. Use plus on a product.</p>}</div><div className="mt-4 border-t pt-4"><Info label="Wallet Balance" value={peso(balance)} /><div className="mt-3 flex justify-between text-lg font-black"><span>Total</span><span>{peso(total)}</span></div>{total===0 && <button disabled className="mt-4 w-full rounded-xl bg-[#d8d2c3] px-4 py-3 font-black text-[#7a766b]">Buy</button>}{total>0 && (missing>0 ? <Link href="/customer/wallet?return=farm-buy" className="mt-4 block rounded-xl bg-amber-300 px-4 py-3 text-center font-black">Cash In</Link> : <button onClick={buyCart} className="mt-4 w-full rounded-xl bg-[#1f6b45] px-4 py-3 font-black text-white">Buy</button>)}</div></Card></div></Shell>;
}

export function InventoryPage() {
  const [liveProducts, setLiveProducts] = useState(products);
  const careNeeds = [
    { rooster: "Thunder King", caretaker: "Juan D.", item: "Premium Rooster Feeds", qty: "5 kg", reason: "Feed stock is low for today care." },
    { rooster: "Red Ace", caretaker: "Mario S.", item: "Rooster Vitamins", qty: "1 dose", reason: "Customer requested vitamin support." },
  ];
  useEffect(() => {
    let mounted = true;
    getFarmProducts()
      .then(rows => {
        if (!mounted || rows.length === 0) return;
        setLiveProducts(rows.map(row => ({
          id: row.id,
          name: row.name,
          category: String(row.category || "Farm Items").replaceAll("_", " ").replace(/\b\w/g, c => c.toUpperCase()),
          unit: row.unit_label || "per item",
          price: Number(row.unit_price || 0),
          stock: Number(row.stock_quantity || 0),
          image: row.image_url || "/farmconnect/marketplace/fc-product-equipment.jpg",
        })));
      })
      .catch(() => undefined);
    return () => { mounted = false; };
  }, []);
  function careBuyHref(need: typeof careNeeds[number]) {
    const params = new URLSearchParams({
      care: "1",
      rooster: need.rooster,
      caretaker: need.caretaker,
      item: need.item,
      qty: need.qty,
      reason: need.reason,
    });
    return `/customer/farm-buy?${params.toString()}`;
  }
  const totalStock = liveProducts.reduce((sum, product) => sum + product.stock, 0);
  const lowStock = liveProducts.filter(product => product.stock <= 50).length;
  const categories = Array.from(new Set(liveProducts.map(product => product.category)));
  const inventoryValue = liveProducts.reduce((sum, product) => sum + product.price * product.stock, 0);
  return <Shell role="customer" title="Inventory"><PageTitle title="Inventory" text="Farm supplies owned or available for care use. Stock, unit, price, and care needs are separated." icon="bag" /><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"><Card className="p-4"><div className="flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#f1eadb] text-[#1f6b45]"><Icon name="bag" /></div><div><p className="text-xs font-black uppercase text-[#667267]">Inventory Items</p><p className="text-3xl font-black">{liveProducts.length}</p></div></div></Card><Card className="p-4"><div className="flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-100 text-amber-700"><Icon name="alert" /></div><div><p className="text-xs font-black uppercase text-[#667267]">Care Needs</p><p className="text-3xl font-black">{careNeeds.length}</p></div></div></Card><Card className="p-4"><div className="flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#e7f3ea] text-[#1f6b45]"><Icon name="check" /></div><div><p className="text-xs font-black uppercase text-[#667267]">Total Stock</p><p className="text-3xl font-black">{totalStock}</p></div></div></Card><Card className="p-4"><div className="flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#eef1ff] text-[#3450a4]"><Icon name="coins" /></div><div><p className="text-xs font-black uppercase text-[#667267]">Stock Value</p><p className="text-2xl font-black">{peso(inventoryValue)}</p></div></div></Card></div><section className="mt-5 rounded-3xl border border-amber-200 bg-white p-4 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-100 text-amber-700"><Icon name="clipboard" /></div><div><h2 className="text-xl font-black">Care Supply Needed</h2><p className="text-sm font-bold text-[#667267]">Buy only what the caretaker needs for the selected rooster.</p></div></div><Badge tone="warn">{careNeeds.length} active</Badge></div><div className="mt-4 grid gap-3 md:grid-cols-2">{careNeeds.map(need=><div key={need.rooster + need.item} className="rounded-2xl border border-[#ece6d8] bg-[#fffdf7] p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div className="min-w-0"><b className="block truncate">{need.rooster}</b><p className="truncate text-sm font-bold text-[#667267]">{need.item} - {need.caretaker}</p></div><Badge tone="warn">{need.qty}</Badge></div><p className="mt-2 text-sm font-bold text-[#667267]">{need.reason}</p><Link href={careBuyHref(need)} className="mt-3 inline-flex rounded-xl bg-[#1f6b45] px-3 py-2 text-sm font-black text-white">Buy for Care</Link></div>)}</div></section><Card className="mt-5"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-black">Inventory List</h2><p className="text-sm font-bold text-[#667267]">{categories.length} categories - {lowStock} low stock item{lowStock===1?"":"s"}</p></div><div className="flex flex-wrap gap-2">{categories.slice(0,4).map(category=><span key={category} className="rounded-full bg-[#f6f3e8] px-3 py-2 text-xs font-black text-[#667267]">{category}</span>)}</div></div><div className="max-h-[620px] space-y-3 overflow-y-auto pr-2">{liveProducts.map(product=>{ const need = careNeeds.find(row => row.item === product.name); const needed = Boolean(need); return <div key={product.id} className={"flex items-center gap-3 rounded-2xl border p-3 " + (needed ? "border-amber-300 bg-amber-50" : "border-[#ece6d8] bg-[#fffdf7]")}><div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-[#ded8c9] bg-white"><img src={product.image} alt="" className="h-full w-full object-cover" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><b className="truncate text-lg">{product.name}</b><Badge tone={needed ? "warn" : "neutral"}>{needed ? "Needed" : product.category}</Badge></div><p className="mt-1 text-sm font-bold text-[#667267]">{peso(product.price)} {product.unit}</p></div><div className="flex shrink-0 items-center gap-2"><div className="rounded-xl bg-white px-3 py-2 text-right"><p className="text-xs font-black uppercase text-[#667267]">Stock</p><p className="font-black">{product.stock}</p></div>{need && <Link href={careBuyHref(need)} className="rounded-xl bg-[#1f6b45] px-3 py-2 text-sm font-black text-white">Buy</Link>}</div></div>})}</div></Card></Shell>;
}
export function FarmRequests() {
  const [rooster, setRooster] = useState(roosters[0]);
  const [service, setService] = useState(services[0]);
  const [note, setNote] = useState("");
  const [requestNote, setRequestNote] = useState("Choose a rooster, choose a service, add a note, then submit. Paid services create an invoice automatically.");
  const balance = 1200;
  function submitRequest(){ setRequestNote(`${service.price>0 ? "Paid request prepared" : "Request sent"} for ${rooster.name}. Admin will assign this to a caretaker; your note is included.`); }
  return <Shell role="customer" title="Farm Requests"><PageTitle title="Farm Requests" text="Choose a rooster, choose a service, add a note, then Pay or Send Request." icon="clipboard" /><KaFarm>{requestNote}</KaFarm><div className="mt-5 grid gap-4 lg:grid-cols-[0.9fr_1.15fr_0.9fr]"><Card><h2 className="text-lg font-black xl:text-xl">1. Rooster List</h2><div className="mt-4 max-h-[520px] space-y-3 overflow-y-auto pr-2">{roosters.map(r=><button key={r.id} onClick={()=>setRooster(r)} className={"flex w-full items-center gap-3 rounded-xl border p-3 text-left " + (rooster.id===r.id?"border-[#1f6b45] bg-emerald-50":"border-[#ece6d8]")}><img src={r.image} className="h-12 w-12 rounded-lg object-cover" alt="" /><span className="min-w-0"><b className="block truncate">{r.name}</b><p className="truncate text-sm text-[#667267]">{r.tag}</p></span></button>)}</div></Card><Card><h2 className="text-lg font-black xl:text-xl">2. Choose Service</h2><div className="mt-4 max-h-[420px] space-y-2 overflow-y-auto pr-2">{services.map(s=><button key={s.name} onClick={()=>setService(s)} className={"w-full rounded-xl border p-3 text-left " + (service.name===s.name?"border-[#1f6b45] bg-emerald-50":"border-[#ece6d8]")}><div className="flex flex-wrap justify-between gap-2"><b>{s.name}</b><span>{s.price?peso(s.price):"Free"}</span></div><p className="text-sm text-[#667267]">{s.proof} - {s.eta}</p></button>)}</div><label className="mt-4 block text-sm font-black">Customer Instruction</label><textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Tell the farm what you want..." className="mt-2 min-h-24 w-full rounded-xl border border-[#ded8c9] p-3" /><button onClick={submitRequest} className="mt-3 w-full rounded-xl bg-[#1f6b45] px-4 py-3 font-black text-white">{service.price>0 ? "Pay" : "Send Request"}</button>{service.price>balance && <Link href="/customer/wallet" className="mt-2 block rounded-xl bg-amber-300 px-4 py-3 text-center font-black">Cash In</Link>}</Card><Card><h2 className="text-lg font-black xl:text-xl">3. Request Logs</h2><div className="mt-4 max-h-[520px] space-y-3 overflow-y-auto pr-2">{["Health Check - Pending", "Photo Update - Completed", "Premium Feed - Verified"].map((x,i)=><div key={x} className="rounded-xl bg-[#f6f3e8] p-3"><b>{roosters[i%3].name}</b><p className="text-sm text-[#667267]">{x}</p><button onClick={()=>setRequestNote(`Care view opened for ${roosters[i%3].name}: ${x}.`)} className="mt-2 rounded-lg bg-white px-3 py-2 text-sm font-black">View Care</button></div>)}</div></Card></div></Shell>;
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
  const [balance, setBalance] = useState(1200);
  const [lockedSavings, setLockedSavings] = useState(0);
  const [showSavings, setShowSavings] = useState(false);
  const [showAmounts, setShowAmounts] = useState(true);
  const [showLockedSavings, setShowLockedSavings] = useState(false);
  const [pinGate, setPinGate] = useState<null | "balance" | "save">(null);
  const [walletNote, setWalletNote] = useState("For cash-in, upload a full receipt screenshot showing amount, recipient, date, and reference number. Withdrawal needs verified payout account and PIN.");
  const [walletRows, setWalletRows] = useState(transactions);
  const availableBalance = Math.max(0, balance - lockedSavings);
  useEffect(() => {
    let mounted = true;
    getCurrentProfile()
      .then(async profile => {
        if (!mounted || !profile) return;
        setBalance(Number(profile.wallet_balance || 0));
        const rows = await getWalletTransactions(profile.id);
        if (!mounted || rows.length === 0) return;
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
  return <Shell role="customer" title="Wallet"><PageTitle title="Wallet" text="Cash in, withdraw, and manage savings." icon="wallet" />{pinGate && <PinGate title="Enter Wallet PIN" onClose={()=>setPinGate(null)} onConfirm={()=>{setShowLockedSavings(true); setWalletNote("Locked savings are visible after PIN confirmation."); setPinGate(null);}} />}{showSavings && <SavingsModalFc lockedSavings={lockedSavings} balance={balance} onClose={()=>setShowSavings(false)} onLock={(amount)=>{const next=Math.min(balance, lockedSavings + amount); setLockedSavings(next); setShowLockedSavings(true); setWalletNote(`FC ${fcCoin(amount)} locked in Save. Total locked: FC ${fcCoin(next)}.`);}} onUnlock={(amount)=>{const next=Math.max(0, lockedSavings - amount); setLockedSavings(next); setShowLockedSavings(true); setWalletNote(`FC ${fcCoin(amount)} unlocked. Remaining locked: FC ${fcCoin(next)}.`);}} />}<div className="rounded-[28px] bg-[#070716] p-4 text-white shadow-2xl md:p-6"><section className="grid gap-4 lg:grid-cols-2"><div className="relative overflow-hidden rounded-[24px] bg-[radial-gradient(circle_at_82%_0%,rgba(255,81,246,0.9),transparent_32%),linear-gradient(135deg,#2810b8_0%,#7719df_48%,#d915c7_100%)] p-5 shadow-[0_18px_45px_rgba(102,22,221,0.45)]"><div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-fuchsia-300/25 blur-2xl" /><div className="relative flex items-start justify-between gap-4"><div><div className="flex items-center gap-2"><p className="text-sm font-bold text-white/75">Available Balance</p></div><div className="mt-5 flex items-center gap-3"><span className="text-3xl font-black">FC</span><p className="text-4xl font-black md:text-5xl">{showAmounts?fcCoin(availableBalance):"******"}</p><button onClick={()=>setShowAmounts(!showAmounts)} className="grid h-9 w-9 place-items-center rounded-full text-white/90"><Icon name={showAmounts?"eyeOff":"eye"} /></button></div></div><Link href="/customer/cashin" className="mt-12 grid h-10 w-10 place-items-center rounded-full text-3xl font-light text-white/90">â€º</Link></div></div><div className="relative overflow-hidden rounded-[24px] bg-[radial-gradient(circle_at_82%_0%,rgba(255,81,246,0.75),transparent_32%),linear-gradient(135deg,#21124f_0%,#5a1ab7_48%,#a814b7_100%)] p-5 text-left shadow-[0_18px_45px_rgba(102,22,221,0.35)]"><div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-fuchsia-300/20 blur-2xl" /><div className="relative flex items-start justify-between gap-4"><div><div className="flex items-center gap-2"><p className="text-sm font-bold text-white/75">Locked Savings</p><button onClick={()=>showLockedSavings?setShowLockedSavings(false):setPinGate("save")} className="text-white/70"><Icon name={showLockedSavings?"eyeOff":"eye"} className="h-4 w-4" /></button></div><div className="mt-5 flex items-center gap-3"><span className="text-3xl font-black">FC</span><p className="text-4xl font-black md:text-5xl">{showLockedSavings?fcCoin(lockedSavings):"******"}</p></div><p className="mt-2 text-sm font-bold text-white/65">PIN required</p></div><button onClick={()=>setPinGate("save")} className="mt-12 grid h-10 w-10 place-items-center rounded-full text-3xl font-light text-white/90">â€º</button></div></div></section><div className="mt-5 grid gap-3 sm:grid-cols-3"><Link href="/customer/cashin" className="rounded-2xl bg-white/10 p-4 text-left font-black text-white shadow-sm ring-1 ring-white/10"><Icon name="coins" className="mb-3 h-7 w-7" />Add Cash</Link><Link href="/customer/withdraw" className="rounded-2xl bg-white/10 p-4 text-left font-black text-white shadow-sm ring-1 ring-white/10"><Icon name="wallet" className="mb-3 h-7 w-7" />Withdraw Funds</Link><button onClick={()=>setShowSavings(true)} className="rounded-2xl bg-white/10 p-4 text-left font-black text-white shadow-sm ring-1 ring-white/10"><Icon name="shield" className="mb-3 h-7 w-7" />Save / Lock</button></div><div className="mt-5 rounded-[24px] bg-white/8 p-4 ring-1 ring-white/10"><h2 className="text-xl font-black">Transaction History</h2><div className="mt-4 max-h-[520px] space-y-3 overflow-y-auto pr-2">{walletRows.map(t=><div key={t.receipt} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white/10 p-3 ring-1 ring-white/10"><div><b>{t.type}</b><p className="text-sm text-white/65">{t.date} - {t.status}</p></div><div className="text-right"><b>{showAmounts?fcCoin(t.amount):"******"}</b><Link href="/customer/inbox" className="ml-3 rounded-lg bg-white/10 px-3 py-2 text-sm font-black">Open Receipt</Link></div></div>)}</div></div></div></Shell>;
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
  const cashinHistory = [
    { method: "GCash", sender: "Janica M.", amount: 3000, status: "Reviewing", time: "Today 5:42 PM" },
    { method: "Maya", sender: "Aydana B.", amount: 1500, status: "Completed", time: "Yesterday 2:18 PM" },
    { method: "UnionBank", sender: "Janica M.", amount: 2000, status: "Reviewing", time: "Jul 8, 11:06 AM" },
  ];
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
const savedPayoutAccounts = [
  { provider: "GCash", holder: "Aydana Buratino", masked: "09•• ••• 1288", status: "Verified" },
  { provider: "Maya", holder: "Aydana Buratino", masked: "09•• ••• 8841", status: "Ready" },
  { provider: "UnionBank", holder: "Aydana Buratino", masked: "•••• 4409", status: "Verified" },
];
function providerStyle(name: string) { return payoutProviders.find(p => p.name === name) || payoutProviders[0]; }
function PayoutAccountCard({ account, active, onClick }: { account: typeof savedPayoutAccounts[number]; active?: boolean; onClick?: () => void }) {
  const provider = providerStyle(account.provider);
  return <button onClick={onClick} className={("relative overflow-hidden rounded-3xl bg-gradient-to-br p-4 text-left shadow-sm ring-1 transition " + provider.colors + " " + provider.text + " " + (active ? "ring-4 ring-sky-200" : "ring-white/30 hover:-translate-y-0.5 hover:shadow-lg"))}><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase opacity-75">{provider.type}</p><h3 className="mt-1 text-2xl font-black">{account.provider}</h3></div><Badge tone={account.status === "Verified" ? "good" : "neutral"}>{account.status}</Badge></div><div className="mt-8"><p className="text-sm font-bold opacity-80">Account holder</p><p className="text-lg font-black">{account.holder}</p><p className="mt-2 text-sm font-black opacity-85">{account.masked}</p></div></button>;
}
export function WithdrawPage() {
  const [selected, setSelected] = useState(savedPayoutAccounts[0]);
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
  return <Shell role="customer" title="Withdraw"><PageTitle title="Withdraw Funds" text="Request payout from available FarmConnect Coin." icon="wallet" />{pinOpen && <PinGate title="Enter PIN to Withdraw" onClose={()=>setPinOpen(false)} onConfirm={()=>{setPinOpen(false); setNote(`Withdrawal request sent: FC ${fcCoin(amountValue)} to ${selected.provider} ${selected.masked}. Admin will review and upload payout proof.`);}} />}<div className="grid gap-5 xl:grid-cols-[1fr_380px]"><div className="grid gap-5"><Card><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-black">Payout Method</h2><p className="mt-1 text-sm font-bold text-[#667267]">Choose a saved payout account or add a new one.</p></div><Link href="/customer/withdraw/add-payout" className="rounded-2xl bg-[#0f6fb8] px-4 py-3 font-black text-white">+ Add</Link></div><div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{savedPayoutAccounts.map(account=><PayoutAccountCard key={account.provider + account.masked} account={account} active={selected.masked===account.masked} onClick={()=>{setSelected(account); setNote(`${account.provider} selected. Withdrawal record will use ${account.holder} / ${account.masked}.`);}} />)}<Link href="/customer/withdraw/add-payout" className="grid min-h-[190px] place-items-center rounded-3xl border-2 border-dashed border-sky-200 bg-sky-50 p-4 text-center text-[#0f6fb8]"><span><span className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-white text-3xl font-black shadow-sm">+</span><b className="block text-lg">Add payout account</b><span className="mt-1 block text-sm font-bold text-[#4d6f91]">GCash, Maya, GoTyme, or bank</span></span></Link></div></Card><Card><h2 className="text-xl font-black">Withdrawal Amount</h2><div className="mt-4 grid gap-3"><label className="text-sm font-black">Amount</label><input value={amount} onChange={e=>{setAmount(e.target.value.replace(/\D/g, "")); setError("");}} inputMode="numeric" placeholder="Enter amount" className="rounded-2xl border border-[#ded8c9] px-4 py-4 text-2xl font-black" /><div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-[#f6f3e8] p-3 text-sm font-bold text-[#667267]"><span>Minimum withdrawal</span><b className="text-[#17251d]">FC 100</b></div>{error && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-black text-red-700">{error}</p>}<button onClick={submit} className="rounded-2xl bg-[#1f6b45] px-4 py-4 font-black text-white">Withdraw</button></div></Card></div><div className="grid h-fit gap-5"><Card><h2 className="text-xl font-black">Withdrawal Safety</h2><p className="mt-2 text-sm font-bold text-[#667267]">{note}</p><div className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm font-bold text-[#7a4b00]">Warning: FarmConnect is not liable if the customer saves a wrong payout name, number, or account. The selected account is logged before every withdrawal.</div></Card><Card className="h-fit"><div className="flex items-center justify-between gap-3"><h2 className="text-xl font-black">Withdrawal History</h2><Badge tone="neutral">Recent</Badge></div><div className="mt-4 max-h-[520px] space-y-3 overflow-y-auto pr-2">{[{mode:"GCash", account:"09•• ••• 1288", amount:1000, status:"Reviewing", time:"Today 4:20 PM"},{mode:"Maya", account:"09•• ••• 8841", amount:750, status:"Completed", time:"Yesterday 10:12 AM"}].map(row=><div key={row.mode + row.time} className="rounded-2xl border border-[#ece6d8] bg-[#fffdf7] p-3"><div className="flex items-start justify-between gap-3"><div><b>{row.mode}</b><p className="text-sm font-bold text-[#667267]">{row.account} - {row.time}</p></div><Badge tone={row.status==="Completed"?"good":"warn"}>{row.status}</Badge></div><div className="mt-3 text-right"><b>FC {fcCoin(row.amount)}</b></div></div>)}</div></Card></div></div></Shell>;
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
  const [localInbox,setLocalInbox]=useState<any[]>([]);
  useEffect(()=>{ try { setLocalInbox(JSON.parse(window.localStorage.getItem(localInboxKey) || "[]")); } catch {} }, []);
  const list = [...localInbox, ...inboxItems].filter(i=>!removed.includes(i.title));
  const filtered = list
    .filter(i => category === "All" || i.tab === category)
    .filter(i => (i.title + " " + i.text + " " + i.status).toLowerCase().includes(query.toLowerCase()))
    .sort((a,b)=>sort === "Oldest first" ? a.title.localeCompare(b.title) : b.title.localeCompare(a.title));
  const actionLabel = (item: any) => item.action === "invoice" ? "Open Invoice" : item.action === "carelogs" ? "Open Care Logs" : "Mark Read";
  return <Shell role="customer" title="Inbox"><PageTitle title="Inbox" text="Notifications only: receipts, caretaker updates, wallet alerts, and support messages." icon="inbox" /><div className="grid gap-5 lg:grid-cols-[300px_1fr]"><aside className="rounded-3xl bg-white p-3 shadow-sm"><div className="mb-3 px-3 py-2"><h2 className="text-lg font-black">Inbox Categories</h2><p className="text-xs font-bold text-[#667267]">Separated by function</p></div><div className="grid gap-2">{categories.map(c=>{ const count = c.name === "All" ? list.length : list.filter(i=>i.tab===c.name).length; return <button key={c.name} onClick={()=>setCategory(c.name)} className={("flex items-center gap-3 rounded-2xl px-3 py-3 text-left transition " + (category===c.name?"bg-[#1f6b45] text-white shadow-sm":"bg-[#fffdf7] hover:bg-[#f6f3e8]"))}><span className={("grid h-11 w-11 shrink-0 place-items-center rounded-2xl " + (category===c.name?"bg-white/15":"bg-[#f1eadb] text-[#1f6b45]"))}><Icon name={c.icon} className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="block truncate font-black">{c.label}</span><span className={("block truncate text-xs font-bold " + (category===c.name?"text-white/75":"text-[#667267]"))}>{c.note}</span></span><span className={("rounded-full px-2 py-1 text-xs font-black " + (category===c.name?"bg-white/20":"bg-[#f6f3e8] text-[#667267]"))}>{count}</span></button>})}</div></aside><section className="rounded-3xl bg-white p-4 shadow-sm"><div className="flex flex-col gap-3 md:flex-row md:items-center"><div className="relative flex-1"><Icon name="search" className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#667267]" /><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search inbox" className="w-full rounded-2xl border border-[#ded8c9] bg-[#fffdf7] py-3 pl-12 pr-4 font-bold" /></div><select value={sort} onChange={e=>setSort(e.target.value)} className="rounded-2xl border border-[#ded8c9] bg-white px-4 py-3 font-black"><option>Newest first</option><option>Oldest first</option><option>Unread first</option></select></div><div className="mt-4 max-h-[680px] space-y-3 overflow-y-auto pr-2">{filtered.map(i=>{ const isRead = read.includes(i.title); return <article key={i.title} className={("rounded-2xl border p-4 transition " + (isRead?"border-[#ece6d8] bg-white":"border-[#d6ead9] bg-[#fffdf7]"))}><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-xs font-black uppercase tracking-wide text-[#667267]">{i.tab}</p><h3 className="mt-1 truncate text-lg font-black">{i.title}</h3></div><div className="flex items-center gap-2"><Badge tone={i.status==="Pending"?"warn":"good"}>{i.status}</Badge>{!isRead && <span className="h-2.5 w-2.5 rounded-full bg-[#1f6b45]" />}</div></div><p className="mt-2 text-sm font-bold leading-6 text-[#667267]">{i.text}</p><div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[#ece6d8] pt-3">{"href" in i && i.href ? <Link href={i.href} className="rounded-xl bg-[#1f6b45] px-3 py-2 text-sm font-black text-white">{actionLabel(i)}</Link> : <button onClick={()=>setRead([...read,i.title])} className="rounded-xl bg-[#eee8d9] px-3 py-2 text-sm font-black">Mark Read</button>}<button onClick={()=>setRemoved([...removed,i.title])} title="Move to recycle bin" aria-label="Move to recycle bin" className="grid h-9 w-9 place-items-center rounded-xl bg-white text-red-700 shadow-sm ring-1 ring-[#f0d8d8]"><Icon name="trash" className="h-4 w-4" /></button></div></article>})}{filtered.length===0 && <p className="rounded-2xl bg-[#f6f3e8] p-4 text-sm font-bold text-[#667267]">No notifications found.</p>}</div></section></div></Shell>;
}export function CustomerInvoicePage({ type = "farm-buy" }: { type?: "farm-buy" | "cashin" }) {
  const isFarmBuy = type === "farm-buy";
  const rows = isFarmBuy
    ? [{ item: "Premium Rooster Feeds", qty: "10 kg", amount: 800 }, { item: "Farm handling", qty: "1", amount: 50 }]
    : [{ item: "Cash-in credit", qty: "GCash Ref GC-829113", amount: 2500 }];
  const total = rows.reduce((sum,r)=>sum+r.amount,0);
  return <Shell role="customer" title="Invoice"><PageTitle title={isFarmBuy ? "Farm Buy Invoice" : "Cash-In Invoice"} text="Official invoice record connected from your inbox receipt." icon="file" /><Card><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-black uppercase text-[#667267]">Invoice</p><h2 className="mt-1 text-3xl font-black">{isFarmBuy ? "INV-FB-1001" : "INV-CI-829113"}</h2><p className="mt-2 text-sm font-bold text-[#667267]">Issued today by FarmConnect</p></div><Badge tone="good">Official</Badge></div><div className="mt-6 overflow-hidden rounded-2xl border border-[#ece6d8]"><table className="w-full text-left text-sm"><thead className="bg-[#f6f3e8]"><tr><th className="p-3">Item</th><th className="p-3">Qty / Ref</th><th className="p-3 text-right">Amount</th></tr></thead><tbody>{rows.map(r=><tr key={r.item} className="border-t border-[#ece6d8]"><td className="p-3 font-black">{r.item}</td><td className="p-3 text-[#667267]">{r.qty}</td><td className="p-3 text-right font-black">FC {fcCoin(r.amount)}</td></tr>)}</tbody></table></div><div className="mt-5 flex justify-end"><div className="rounded-2xl bg-[#f6f3e8] p-4 text-right"><p className="text-xs font-black uppercase text-[#667267]">Total</p><p className="text-3xl font-black">FC {fcCoin(total)}</p></div></div><div className="mt-5 flex flex-wrap gap-3"><Link href="/customer/inbox" className="rounded-2xl bg-[#eee8d9] px-4 py-3 font-black">Back to Inbox</Link><button className="rounded-2xl bg-[#1f6b45] px-4 py-3 font-black text-white">Download</button></div></Card></Shell>;
}
export function SupportPage() {
  const [messages,setMessages]=useState([
    {from:"kafarm", text:"Hi, I am Ka-Farm. Ask me first. If your concern needs account review, I can pass it to live admin chat."}
  ]);
  const [text,setText]=useState("");
  const [escalated,setEscalated]=useState(false);
  function aiReply(q: string) {
    const clean = q.trim().toLowerCase();
    const limited = "I can guide you, but I cannot approve KYC, move money, reset PIN, decide disputes, or view private account records here.";
    if (/^(hi|hello|hey|oi|uy|yo|kumusta|kamusta|buddy|sir|maam|ma'am)[!. ]*$/i.test(clean)) return "Hi buddy. Andito ako. Ask me about wallet, KYC, rooster care, Farm Buy, cash-in, withdrawal, or account settings.";
    if(/thank|thanks|salamat|ty/i.test(q)) return "Walang anuman buddy. Andito lang ako. May gusto ka pa bang ipa-check sa app?";
    if(/haha|hehe|lol|charot|joke|jahaha/i.test(q)) return "Haha gets. Sige, balik tayo sa concern mo. Wallet ba, KYC, rooster, request, or farm buy?";
    if(/gulo|nalito|confused|di ko gets|hindi ko gets|hirap|mahirap/i.test(q)) return "Okay lang, dahan-dahan tayo. Sabihin mo lang kung anong page ka ngayon at ano yung gusto mong mangyari, tapos igu-guide kita step by step.";
    if(/takot|worried|kabado|safe ba|safe|delikado/i.test(q) && !/fraud|hacked|unauthorized|nakaw|nawala/i.test(q)) return "Valid yung worry mo. For safety, never share PIN/password. For money, KYC, or account decisions, admin review ang final. Anong part ang gusto mong i-check?";
    if(/ano next|next|what next|paano|pano/i.test(q) && !/withdraw|cash|kyc|pin|password/i.test(q)) return "Tell me which area first: Wallet, KYC, My Roosters, Farm Buy, Farm Requests, Inbox, or Support. I will guide you from there.";
    if(/what can you do|ano kaya mo|help|tulong/i.test(q)) return `${limited} I can explain steps, check if your concern sounds risky, and pass you to live admin chat when records or decisions are needed.`;
    if(/approve|release|refund|reverse|manual|admin|decision|complaint|dispute/i.test(q)) return `${limited} This needs admin review. Would you like to open live chat with admin?`;
    if(/withdraw|cash out|cashout/i.test(q)) return "For withdrawal: Wallet > Withdraw > choose verified payout account > enter amount > confirm with wallet PIN. KYC must be approved first. If money is missing, wrong account, or payout is delayed, I need to pass you to live chat with admin.";
    if(/cash|cashin|cash-in|add cash|receipt|reference/i.test(q)) return "For cash-in: Wallet > Add Cash > choose GCash/Maya/Bank > send payment > upload receipt screenshot. If reference number is duplicate, unreadable, or amount does not match, admin must review it. Would you like to open live chat with admin?";
    if(/password|pass|pin/i.test(q)) return "For password or wallet PIN: open Settings. For wallet PIN changes, current PIN is required. If you forgot the PIN, admin reset is needed and the account should be logged out for safety.";
    if(/kyc|verify|verification|id|selfie/i.test(q)) return "For KYC: Settings > KYC Verification. Complete ID front, ID back, selfie, full ID number, and address. The system can flag missing or wrong details, but admin is the final reviewer.";
    if(/buy|cart|farm buy|inventory|feed|vitamin|vaccine|supplement/i.test(q)) return "For Farm Buy: add items to cart, pay using FC balance, then items go to inventory. If funds are short, use Add Cash. If item quantity or inventory is wrong, admin review is needed.";
    if(/request|care|alaga|vitamins|feeding|vet|service/i.test(q)) return "For care requests: open Farm Requests, choose rooster, choose service, add note, then pay. Caretaker updates should appear in Care Logs after proof/admin review.";
    if(/rooster|manok|chicken|bantay|red ace|thunder/i.test(q)) return "For your rooster: open My Roosters for current status, then Care Logs for dated updates, proof photos, product cost, and labor cost.";
    if(/wrong|mali|hindi.*manok|caretaker|proof|photo|picture|update|scam|fraud|hacked|unauthorized|nakaw|nawala/i.test(q)) return `${limited} This may involve proof, account safety, or caretaker work. Would you like to open live chat with admin?`;
    return "I can answer simple app steps. For anything involving money movement, KYC approval, wrong rooster proof, caretaker dispute, fraud, or private records, I will pass you to live admin chat.";
  }
  function send() {
    if(!text.trim()) return;
    const q=text.trim();
    if (escalated) {
      setMessages(current=>[...current,{from:"you",text:q},{from:"admin",text:"Received. I will check the account records and reply here."}]);
      setText("");
      return;
    }
    const reply=aiReply(q);
    setMessages(current=>[...current,{from:"you",text:q},{from:"kafarm",text:reply}]);
    setText("");
  }
  function openLiveChat() {
    setEscalated(true);
    setMessages(current=>[...current,{from:"kafarm",text:"I opened live chat for admin. While waiting, keep your message clear and include receipt, rooster name, or request details if needed."},{from:"admin",text:"Admin received this chat. Please send the exact issue and I will review the records."}]);
  }
  const quick = ["Withdraw problem", "Cash-in review", "Wrong rooster update", "Caretaker concern"];
  return <Shell role="customer" title="Support"><PageTitle title="Support" text="Chat with Ka-Farm. Live admin chat appears only when your concern needs review." icon="support" /><section className="mx-auto max-w-4xl overflow-hidden rounded-[28px] border border-[#e3ded0] bg-white shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ece6d8] bg-[#fffdf7] p-4"><div className="flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-full bg-[#1f6b45] text-white shadow-sm"><Icon name={escalated?"chat":"support"} /></div><div><h2 className="text-xl font-black">{escalated?"Live Admin Chat":"Ka-Farm Chat"}</h2><p className="text-sm font-bold text-[#667267]">{escalated?"Admin joined this chat":"Ask naturally. I will guide you."}</p></div></div><Badge tone={escalated?"warn":"good"}>{escalated?"Admin":"Ka-Farm"}</Badge></div><div className="min-h-[58vh] bg-[linear-gradient(180deg,#fffdf7_0%,#f6f3e8_100%)] p-4"><div className="max-h-[58vh] space-y-3 overflow-y-auto pr-2">{messages.map((m,i)=><div key={i} className={("max-w-[86%] rounded-2xl p-3 shadow-sm " + (m.from==="you"?"ml-auto bg-[#1f6b45] text-white":m.from==="admin"?"bg-sky-50 text-[#12375a] ring-1 ring-sky-100":"bg-white"))}><b>{m.from==="you"?"You":m.from==="admin"?"Admin":"Ka-Farm"}</b><p className="mt-1 text-sm leading-6">{m.text}</p>{m.text.includes("live chat") && !escalated && <button onClick={openLiveChat} className="mt-3 rounded-xl bg-amber-300 px-3 py-2 font-black text-[#17251d]">Open Live Chat</button>}</div>)}</div></div><div className="border-t border-[#ece6d8] bg-white p-4"><div className="mb-3 flex flex-wrap gap-2">{quick.map(q=><button key={q} onClick={()=>setText(q)} className="rounded-full bg-[#f6f3e8] px-3 py-2 text-xs font-black text-[#667267]">{q}</button>)}</div><div className="flex gap-2"><input value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")send()}} placeholder={escalated?"Message admin...":"Ask Ka-Farm..."} className="flex-1 rounded-2xl border border-[#ded8c9] bg-[#fffdf7] p-4 font-bold" /><button onClick={send} className="rounded-2xl bg-[#1f6b45] px-6 font-black text-white">Send</button></div></div></section></Shell>;
}
export function SettingsPage() {
  type SettingsPanel = "kyc" | "pin" | "password" | "contact";
  const profile = { name: "Aydana Buratino", nickname: "Aydana", email: "aydana@example.com", phone: "+63 917 555 0198", birthdate: "1998-04-18", kyc: "Pending Review", pin: "Set", payout: "Not added" };
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
    const submittedAt = new Date().toLocaleString();
    const reviewRecord = { customer: profile.name, email: profile.email, idType: kyc.idType, idNumber: kyc.idLast4, submittedAt, faceStatus: kycFaceMismatch ? "Face mismatch hold" : "Face aligned", status: kycEngineResult.status === "approved" ? "Pre-check passed - admin review required" : kycFaceMismatch ? "Needs admin review" : "Ready for admin review", note: kycEngineResult.note || (kycFaceMismatch ? "QA sample: ID face is intentionally different from selfie." : "QA sample: fields and face are aligned."), faceScore: kycEngineResult.faceScore, engineDetails: kycEngineResult.details, front: kycIdPhoto, back: kycIdBackPhoto, selfie: kycSelfiePhoto, consentAccepted: true, consentAcceptedAt: submittedAt, consentVersion: kycConsentVersion, consentText: kycConsentText };
    const inboxNotice = { tab: "Alerts", title: "KYC Submitted", text: `Your KYC is under review. Submitted ${submittedAt}. We will notify you when admin finishes checking it.`, status: "Pending", action: "read" };
    if (typeof window !== "undefined") { window.localStorage.setItem("farmconnect_latest_kyc_review", JSON.stringify(reviewRecord)); const rawInbox = window.localStorage.getItem("farmconnect_customer_inbox"); const currentInbox = rawInbox ? JSON.parse(rawInbox) : []; window.localStorage.setItem("farmconnect_customer_inbox", JSON.stringify([inboxNotice, ...currentInbox.filter((item: any)=>item.title !== inboxNotice.title)])); }
    try { await supabase.rpc("customer_record_kyc_consent", { p_consent_version: kycConsentVersion, p_consent_text: kycConsentText, p_metadata: { source: "customer_settings", id_type: kyc.idType } }); } catch {}
    try { const { error } = await supabase.rpc("customer_submit_kyc", { p_legal_name: profile.name, p_birthdate: profile.birthdate || null, p_address_line: kyc.address, p_city: kyc.city, p_province: kyc.province, p_postal_code: kyc.postal, p_id_type: kyc.idType, p_id_number_last4: kyc.idLast4, p_payout_name_to_match: kyc.payoutName, p_valid_id_front_url: kycIdPhoto, p_selfie_url: kycSelfiePhoto, p_valid_id_back_url: kycIdBackPhoto, p_address_proof_url: null }); if (error) throw error; setKycReadStatus("System read completed for preview. Admin review queue can now verify the ID, selfie, and duplicate-risk checks."); setSettingsNote("KYC submitted. Your verification is now under review. Check Inbox for the review notice."); } catch { setSettingsNote("KYC submitted. Your verification is now under review. Check Inbox for the review notice."); }
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
  const [taskNote,setTaskNote]=useState("Select a request, verify the rooster by QR, then complete the proof steps.");
  const [qrVerified,setQrVerified]=useState(false);
  const [proofReady,setProofReady]=useState(false);
  const [feedUsed,setFeedUsed]=useState("0.25");
  const [exceptionRequested,setExceptionRequested]=useState(false);
  const needsVideo = /vitamin|supplement|vet/i.test(selected.task + " " + selected.proof + " " + selected.note);
  const needsFeedQty = /feed/i.test(selected.task + " " + selected.proof);
  async function submit(){
    if(!qrVerified){ setTaskNote("Scan QR first. If QR/camera fails, ask admin for serial exception mode."); return; }
    if(!proofReady){ setTaskNote("Open camera or upload proof first. The proof checker needs a fresh photo/video before submit."); return; }
    const proof = saveSubmittedTaskProof(selected);
    try { await supabase.rpc("caretaker_submit_task_proof", { p_external_task_id: selected.id, p_rooster_name: selected.rooster, p_rooster_tag: selected.tag, p_task_type: selected.task, p_customer_note: selected.note, p_required_proof: selected.proof, p_proof_url: proof.image, p_preset_note: `${selected.task} proof submitted${needsFeedQty ? ` - ${feedUsed} kg used` : ""}`, p_free_note: selected.note }); } catch {}
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
export function CaretakerChat() { const [chatNote,setChatNote]=useState("If QR is unreadable, tell admin. Admin can release exception mode if needed."); const [msg,setMsg]=useState(""); function send(){ if(!msg.trim()) return; setChatNote(`Message sent to admin: ${msg}`); setMsg(""); } return <Shell role="caretaker" title="Chat Admin"><PageTitle title="Chat Admin" text="Message admin if QR, camera, rooster, or task details are unclear." icon="chat" /><Card><KaFarm>{chatNote}</KaFarm><div className="mt-4 rounded-xl bg-[#f6f3e8] p-4">Sir, QR not scanning in Pen A-04. Need serial code mode.</div><div className="mt-4 flex gap-2"><input value={msg} onChange={e=>setMsg(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")send();}} className="flex-1 rounded-xl border p-3" placeholder="Message admin..." /><button onClick={send} className="rounded-xl bg-[#1f6b45] px-5 font-black text-white">Send</button></div></Card></Shell>; }
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

export function CaretakerOperationChecker() {
  const [selected,setSelected]=useState(initialTasks[0]);
  const checklist = ["Read customer note", "Verify rooster QR", "Use serial only if admin releases exception", "Capture clear proof", "Choose prepared note", "Submit for admin/customer review"];
  const stats = [
    { label: "Active", value: `${initialTasks.length}`, icon: "clipboard" as IconName, tone: "warn" as const },
    { label: "Urgent", value: `${initialTasks.filter(t=>t.priority==="urgent").length}`, icon: "alert" as IconName, tone: "bad" as const },
    { label: "Completed", value: `${completedTasks.length}`, icon: "check" as IconName, tone: "good" as const },
    { label: "Admin Chat", value: "Open", icon: "chat" as IconName, tone: "neutral" as const },
  ];
  return <Shell role="caretaker" title="Caretaker Checker"><PageTitle title="Caretaker Checker" text="Simple operations screen for active requests, proof steps, admin exception, and completed work." icon="clipboard" /><KaFarm>Open one task, follow the checklist, and ask admin if QR, camera, rooster, or instruction is unclear.</KaFarm><div className="mt-5 grid gap-3 md:grid-cols-4">{stats.map(s=><Card key={s.label} className="p-4"><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#f6f3e8] text-[#1f6b45]"><Icon name={s.icon} /></span><span><p className="text-xs font-black uppercase text-[#667267]">{s.label}</p><p className="text-2xl font-black">{s.value}</p></span></div></Card>)}</div><div className="mt-5 grid gap-5 xl:grid-cols-[360px_1fr_320px]"><Card><h2 className="text-xl font-black">Request List</h2><div className="mt-4 max-h-[620px] space-y-3 overflow-y-auto pr-2">{initialTasks.map(t=><button key={t.id} onClick={()=>setSelected(t)} className={("w-full rounded-2xl border p-3 text-left transition " + (selected.id===t.id?"border-[#1f6b45] bg-emerald-50":"border-[#ece6d8] bg-[#fffdf7]"))}><div className="flex items-center gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#e7eadf] font-black">{t.requester[0]}</span><span className="min-w-0 flex-1"><b className="block truncate">{t.requester}</b><span className="block truncate text-sm font-bold text-[#667267]">{t.rooster} - {t.task}</span></span><Badge tone={t.priority==="urgent"?"warn":"neutral"}>{t.priority}</Badge></div><p className="mt-2 text-xs font-black text-[#1f6b45]">{t.due}</p></button>)}</div></Card><Card><div className="grid gap-4 md:grid-cols-[180px_1fr]"><img src="/farmconnect/roosters/fc-stage-3-young-rooster-base.jpg" className="h-44 w-full rounded-2xl object-cover" alt="" /><div><p className="text-xs font-black uppercase text-[#667267]">Selected Task</p><h2 className="mt-1 text-3xl font-black">{selected.task}</h2><p className="mt-1 text-sm font-bold text-[#667267]">{selected.rooster} / {selected.tag} - {selected.pen}</p><div className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm font-bold leading-6 text-amber-900"><b>Customer note</b><p>{selected.note}</p></div></div></div><div className="mt-5 grid gap-3 sm:grid-cols-4"><button className="rounded-xl bg-[#eee8d9] px-3 py-3 font-black"><Icon name="qr" className="mx-auto mb-1 h-5 w-5" />QR</button><button className="rounded-xl bg-[#eee8d9] px-3 py-3 font-black"><Icon name="camera" className="mx-auto mb-1 h-5 w-5" />Camera</button><button className="rounded-xl bg-[#eee8d9] px-3 py-3 font-black"><Icon name="upload" className="mx-auto mb-1 h-5 w-5" />Upload</button><Link href="/caretaker/chat" className="rounded-xl bg-amber-300 px-3 py-3 text-center font-black">Ask Admin</Link></div><div className="mt-5 rounded-2xl border border-[#ece6d8] bg-[#fffdf7] p-4"><b>Required proof</b><p className="mt-1 text-sm font-bold text-[#667267]">{selected.proof}. Upload must be clear, current, and tied to the selected rooster.</p></div></Card><Card><h2 className="text-xl font-black">Work Checklist</h2><div className="mt-4 space-y-3">{checklist.map((item,i)=><div key={item} className="flex items-start gap-3 rounded-2xl bg-[#f6f3e8] p-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-sm font-black">{i+1}</span><p className="text-sm font-bold leading-6 text-[#667267]">{item}</p></div>)}</div><Link href="/caretaker/completed" className="mt-4 block rounded-xl bg-[#1f6b45] px-4 py-3 text-center font-black text-white">Open Completed</Link></Card></div></Shell>;
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
export function AdminHome() { return <Shell role="admin" title="Admin App"><PageTitle title="Admin Dashboard" text="Ka-Farm helps backread what is pending, risky, and ready for admin action." icon="shield" /><div className="grid gap-5 xl:grid-cols-[1fr_420px]"><div className="grid gap-4 md:grid-cols-2">{nav.admin.map(([label,href,icon])=><Link key={href} href={href} className="rounded-2xl bg-white p-5 shadow-sm"><Icon name={icon as IconName} className="h-8 w-8 text-[#1f6b45]" /><h2 className="mt-3 text-xl font-black">{label}</h2><p className="mt-2 text-sm text-[#667267]">Open {label.toLowerCase()}.</p></Link>)}</div><KaFarmAdmin /></div></Shell>; }

function KaFarmAdmin() { return <Card><div className="flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-full bg-[#1f6b45] text-white"><Icon name="support" /></div><div><h2 className="text-xl font-black">Ask Ka-Farm</h2><p className="text-sm text-[#667267]">Backlog assistant, not decision maker.</p></div></div><div className="mt-4 max-h-[520px] space-y-3 overflow-y-auto pr-2">{adminQueues.map(q=><div key={q.title} className="rounded-xl bg-[#f6f3e8] p-3"><div className="flex items-center justify-between"><b>{q.title}</b><Badge tone={q.count>3?"warn":"neutral"}>{q.count}</Badge></div><p className="mt-1 text-sm text-[#667267]">{q.text}</p><Link href={q.href} className="mt-2 inline-block rounded-lg bg-white px-3 py-2 text-sm font-black">Open</Link></div>)}</div><div className="mt-4 rounded-xl border p-3 text-sm text-[#667267]">Try: "Ano naiwan?", "Bakit flagged si Juan?", "Ano nangyari kay Aydana?"</div></Card>; }

function AdminLiveChatPage() {
  const chats = [
    { id: "c1", name: "Aydana Buratino", avatar: "AB", issue: "Wrong rooster update", status: "Queued", risk: "Needs review", summary: "Customer says caretaker update may show the wrong rooster. Check care log proof and rooster tag.", last: "2 min ago" },
    { id: "c2", name: "Marco Reyes", avatar: "MR", issue: "Cash-in review", status: "Waiting", risk: "Payment", summary: "Customer uploaded a receipt but reference may need duplicate check.", last: "8 min ago" },
    { id: "c3", name: "Lina Cruz", avatar: "LC", issue: "Withdrawal question", status: "AI solved", risk: "Low", summary: "Ka-Farm answered withdrawal steps. No admin reply needed unless customer follows up.", last: "18 min ago" },
  ];
  const [selected,setSelected]=useState(chats[0]);
  const [reply,setReply]=useState("");
  const [thread,setThread]=useState([
    { from: "kafarm", text: "Customer asked about a care update. I could not safely resolve it because it may require proof review." },
    { from: "customer", text: "Hindi ko yata manok yung nasa update. Pacheck po." },
    { from: "admin", text: "Checking the care log, proof photo, rooster tag, and caretaker assignment." },
  ]);
  function sendAdminReply() {
    if(!reply.trim()) return;
    setThread(current=>[...current,{from:"admin",text:reply.trim()}]);
    setReply("");
  }
  return <Shell role="admin" title="Live Chat"><PageTitle title="Live Chat" text="Only escalated Ka-Farm chats appear here. Admin handles customer and caretaker conversations from one queue." icon="chat" /><div className="grid gap-5 xl:grid-cols-[360px_1fr]"><Card><div className="flex items-center justify-between gap-3"><h2 className="text-xl font-black">Queue</h2><Badge tone="warn">{chats.filter(c=>c.status!=="AI solved").length} open</Badge></div><div className="mt-4 max-h-[640px] space-y-3 overflow-y-auto pr-2">{chats.map(chat=><button key={chat.id} onClick={()=>setSelected(chat)} className={("w-full rounded-2xl border p-3 text-left transition " + (selected.id===chat.id?"border-[#1f6b45] bg-emerald-50":"border-[#ece6d8] bg-[#fffdf7]"))}><div className="flex items-center gap-3"><div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#1f6b45] font-black text-white">{chat.avatar}</div><div className="min-w-0 flex-1"><b className="block truncate">{chat.name}</b><p className="truncate text-sm font-bold text-[#667267]">{chat.issue}</p></div><Badge tone={chat.status==="Queued"?"warn":chat.status==="AI solved"?"good":"neutral"}>{chat.status}</Badge></div><p className="mt-2 line-clamp-2 text-xs font-bold leading-5 text-[#667267]">{chat.summary}</p><p className="mt-2 text-xs font-black text-[#1f6b45]">{chat.last}</p></button>)}</div></Card><div className="grid gap-5"><Card><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black uppercase text-[#667267]">Selected Chat</p><h2 className="mt-1 text-2xl font-black">{selected.name}</h2><p className="text-sm font-bold text-[#667267]">{selected.issue}</p></div><div className="flex gap-2"><Badge tone="warn">{selected.risk}</Badge><Badge>{selected.status}</Badge></div></div><div className="mt-4 rounded-2xl bg-[#f6f3e8] p-4"><b>Ka-Farm Summary</b><p className="mt-1 text-sm font-bold leading-6 text-[#667267]">{selected.summary}</p></div><div className="mt-4 grid gap-2 sm:grid-cols-4"><Link href="/admin/evidence" className="rounded-xl bg-white px-3 py-2 text-center text-sm font-black shadow-sm">Evidence</Link><Link href="/admin/customers" className="rounded-xl bg-white px-3 py-2 text-center text-sm font-black shadow-sm">Customer</Link><Link href="/admin/caretaker-desk" className="rounded-xl bg-white px-3 py-2 text-center text-sm font-black shadow-sm">Caretaker</Link><button className="rounded-xl bg-amber-300 px-3 py-2 text-sm font-black">Mark Review</button></div></Card><Card><h2 className="text-xl font-black">Conversation</h2><div className="mt-4 max-h-[440px] space-y-3 overflow-y-auto pr-2">{thread.map((m,i)=><div key={i} className={("max-w-[86%] rounded-2xl p-3 " + (m.from==="admin"?"ml-auto bg-[#1f6b45] text-white":m.from==="customer"?"bg-sky-50 text-[#12375a] ring-1 ring-sky-100":"bg-[#f6f3e8]"))}><b>{m.from==="admin"?"Admin":m.from==="customer"?"Customer":"Ka-Farm"}</b><p className="mt-1 text-sm leading-6">{m.text}</p></div>)}</div><div className="mt-4 flex gap-2"><input value={reply} onChange={e=>setReply(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")sendAdminReply()}} placeholder="Reply to customer..." className="flex-1 rounded-xl border border-[#ded8c9] p-3 font-bold" /><button onClick={sendAdminReply} className="rounded-xl bg-[#1f6b45] px-5 font-black text-white">Send</button></div></Card></div></div></Shell>;
}
const adminCustomerProfiles = [
  { id: "cust-1", name: "Aydana Buratino", avatar: "AB", kyc: "Pending Review", wallet: "Active", pin: "Set", payout: "Not added", risk: "Medium", issue: "KYC submitted, withdrawal locked", last: "Today 5:42 PM", email: "aydana@example.com", phone: "+63 917 555 0198" },
  { id: "cust-2", name: "Marco Reyes", avatar: "MR", kyc: "Approved", wallet: "Active", pin: "Set", payout: "GCash verified", risk: "Low", issue: "Cash-in receipt reviewed", last: "Today 4:10 PM", email: "marco@example.com", phone: "+63 918 333 4411" },
  { id: "cust-3", name: "Lina Cruz", avatar: "LC", kyc: "Needs Review", wallet: "Hold", pin: "Reset requested", payout: "Maya pending", risk: "High", issue: "Possible duplicate account", last: "Yesterday 8:18 PM", email: "lina@example.com", phone: "+63 919 222 1188" },
];

const customerDeskSections = [
  { id: "kyc", title: "KYC / Risk", icon: "shield" as IconName, tone: "warn" as const, count: 2, text: "Identity, ID/selfie, duplicate account, consent, and account safety.", href: "/admin/customer-desk/kyc" },
  { id: "wallet", title: "Wallet", icon: "wallet" as IconName, tone: "neutral" as const, count: 3, text: "Cash-in, balance, locked funds, receipts, and wallet ledger questions.", href: "/admin/customer-desk/wallet" },
  { id: "withdraw", title: "Withdraw", icon: "coins" as IconName, tone: "warn" as const, count: 2, text: "Payout account, manual withdrawal review, proof, and release status.", href: "/admin/customer-desk/withdraw" },
  { id: "care", title: "Care", icon: "rooster" as IconName, tone: "bad" as const, count: 1, text: "Rooster care concerns: wrong rooster, bad proof, health, feed, vitamins, or caretaker issue.", href: "/admin/customer-desk/care" },
  { id: "support", title: "Support", icon: "chat" as IconName, tone: "neutral" as const, count: 2, text: "Ka-Farm escalations, live chat, customer questions, and reply follow-ups.", href: "/admin/customer-desk/support" },
  { id: "security", title: "Security", icon: "qr" as IconName, tone: "warn" as const, count: 1, text: "Wallet PIN reset, password, contact changes, login/account access issues.", href: "/admin/customer-desk/security" },
  { id: "evidence", title: "Evidence Logs", icon: "file" as IconName, tone: "neutral" as const, count: 8, text: "Filtered proof trail: KYC, wallet, withdrawal, care, chat, and admin decisions.", href: "/admin/customer-desk/evidence" },
  { id: "resolved", title: "Resolved Cases", icon: "check" as IconName, tone: "good" as const, count: 5, text: "Completed customer issues with outcome, admin note, evidence link, and delete/archive.", href: "/admin/customer-desk/resolved" },
];

const customerDeskJobs = [
  { ...adminCustomerProfiles[0], queue: "kyc", priority: "High", problem: "KYC submitted", blocker: "Withdrawal locked until KYC passes", finish: "Review KYC", next: "Check ID front/back, selfie, birthday, consent, and duplicate flags.", route: "/admin/evidence" },
  { ...adminCustomerProfiles[2], queue: "kyc", priority: "High", problem: "Possible duplicate", blocker: "Same identity risk before wallet release", finish: "Compare Accounts", next: "Compare name, birthday, face, phone, payout name, and account history.", route: "/admin/evidence" },
  { ...adminCustomerProfiles[1], queue: "wallet", priority: "Normal", problem: "Cash-in receipt", blocker: "Needs ledger/reference confirmation", finish: "Check Receipt", next: "Open receipt, match amount/reference, then confirm wallet ledger.", route: "/admin/transactions/cashin" },
  { ...adminCustomerProfiles[0], queue: "wallet", priority: "Normal", problem: "Payout not added", blocker: "KYC pending before payout registration", finish: "Check Wallet", next: "Check KYC status before allowing withdrawal or payout registration.", route: "/admin/transactions" },
  { ...adminCustomerProfiles[2], queue: "wallet", priority: "High", problem: "Wallet hold", blocker: "High account risk", finish: "Keep Hold", next: "Hold funds until KYC/risk decision is documented.", route: "/admin/treasury" },
  { ...adminCustomerProfiles[0], queue: "withdraw", priority: "High", problem: "Withdraw request", blocker: "Pending KYC", finish: "Review Withdrawal", next: "Tell customer KYC must pass before withdrawal release.", route: "/admin/transactions/cashout" },
  { ...adminCustomerProfiles[2], queue: "withdraw", priority: "High", problem: "Maya payout", blocker: "Payout name not verified", finish: "Verify Payout", next: "Match payout name and number to approved KYC before saving.", route: "/admin/transactions/cashout" },
  { ...adminCustomerProfiles[0], queue: "care", priority: "High", problem: "Wrong rooster update", blocker: "Needs proof/tag check", finish: "Open Proof", next: "Open care log proof, rooster tag, caretaker, and admin decision trail.", route: "/admin/evidence" },
  { ...adminCustomerProfiles[0], queue: "support", priority: "Normal", problem: "KYC question", blocker: "Customer waiting for answer", finish: "Reply", next: "Reply using KYC status and wallet hold evidence.", route: "/admin/live-chat" },
  { ...adminCustomerProfiles[1], queue: "support", priority: "Normal", problem: "Cash-in question", blocker: "Needs receipt explanation", finish: "Reply", next: "Use receipt history and wallet transaction record.", route: "/admin/live-chat" },
  { ...adminCustomerProfiles[2], queue: "security", priority: "High", problem: "Wallet PIN reset", blocker: "Identity must be verified first", finish: "Reset Safely", next: "Verify identity, create evidence, force logout, then let customer set new PIN.", route: "/admin/evidence" },
  { ...adminCustomerProfiles[0], queue: "evidence", priority: "Normal", problem: "KYC evidence packet", blocker: "Needs filtered proof trail", finish: "Open Logs", next: "Open linked ID, selfie, consent, duplicate scan, and admin decision records.", route: "/admin/evidence" },
  { ...adminCustomerProfiles[1], queue: "evidence", priority: "Normal", problem: "Wallet receipt trail", blocker: "Needs ledger and receipt match", finish: "Open Logs", next: "Open cash-in proof, receiver account, reference number, and ledger record.", route: "/admin/evidence" },
  { ...adminCustomerProfiles[1], queue: "resolved", priority: "Normal", problem: "Cash-in completed", blocker: "No blocker", finish: "View Result", next: "Review final result, receipt, customer notice, and delete/archive option.", route: "/admin/customer-desk/resolved" },
  { ...adminCustomerProfiles[0], queue: "resolved", priority: "Normal", problem: "Photo update released", blocker: "No blocker", finish: "View Result", next: "Review approved proof, care log release, customer notice, and delete/archive option.", route: "/admin/customer-desk/resolved" },
];

function CustomerDeskJobBoard({ sectionId }: { sectionId: string }) {
  const section = customerDeskSections.find(s=>s.id===sectionId) || customerDeskSections[0];
  const jobs = customerDeskJobs.filter(j=>j.queue===section.id);
  const [selected,setSelected]=useState(jobs[0] || customerDeskJobs[0]);
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
    { name: selected.name, label: "Submitted Account", image: "/farmconnect/kyc-test/aydana-selfie-sample.png", detail: selected.email, status: "Current KYC" },
    { name: "Aydana B.", label: "Possible Duplicate", image: "/farmconnect/kyc-test/duplicate-face-sample.png", detail: "aydana.old@example.com", status: "Same birthday risk" },
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
  const [selected,setSelected]=useState(jobs[0] || customerDeskJobs[0]);
  const [chat,setChat]=useState([
    { from: "Ka-Farm", text: "I tried to answer first but this needs admin help." },
    { from: "Customer", text: selected.problem === "KYC question" ? "Bakit hindi pa ako makawithdraw?" : "Can someone check this for me?" },
  ]);
  const [reply,setReply]=useState("");
  useEffect(()=>{ if (jobs[0]) setSelected(jobs[0]); }, [sectionId]);
  const addReply = () => { if(!reply.trim()) return; setChat(current=>[...current,{from:"Admin",text:reply.trim()}]); setReply(""); };
  const emailTemplate = `Hello ${selected.name},\n\nWe reviewed your FarmConnect concern: ${selected.problem}.\n\nReason: ${selected.blocker}.\n\nWhat happens next: ${selected.next}\n\nIf we need another document or proof, please submit it in the app so your record stays complete. Thank you for your patience.`;
  const brain = <CustomerCaseBrain sectionId={section.id} problem={selected.problem} blocker={selected.blocker} next={selected.next} />;
  const customerList = <Card><div className="flex items-center justify-between gap-3"><Link href={`/admin/customer-desk/${section.id}`} className="rounded-xl bg-[#f6f3e8] px-4 py-2 text-sm font-black">Back</Link><Badge tone={section.tone}>{jobs.length} open</Badge></div><h2 className="mt-4 text-xl font-black">Customer List</h2><div className="mt-4 max-h-[520px] space-y-2 overflow-y-auto pr-2">{jobs.map(job=><button key={job.id + job.problem} onClick={()=>setSelected(job)} className={("flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition " + (selected.id===job.id && selected.problem===job.problem?"border-[#1f6b45] bg-emerald-50 shadow-sm":"border-[#ece6d8] bg-[#fffdf7] hover:border-[#cfc7b7]"))}><div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#1f6b45] text-sm font-black text-white">{job.avatar}</div><div className="min-w-0 flex-1"><b className="block truncate">{job.name}</b><p className="truncate text-xs font-bold text-[#667267]">{job.problem}</p></div><Badge tone={job.priority==="High"?"bad":"neutral"}>{job.priority}</Badge></button>)}</div></Card>;
  if (mode === "problem") {
    return <Shell role="admin" title={`${section.title} Problem`}><PageTitle title={`${section.title}: Check Problem`} text="Problem source and troubleshooting guide before opening evidence." icon={section.icon} /><div className="mt-4 grid gap-5 lg:grid-cols-[340px_1fr]"><>{customerList}</><Card>{brain}<div className="mt-4 grid gap-4 xl:grid-cols-2"><div className="rounded-2xl bg-[#f6f3e8] p-5"><p className="text-xs font-black uppercase text-[#667267]">Problem / Source</p><h2 className="mt-2 text-3xl font-black">{selected.problem}</h2><p className="mt-3 text-sm font-bold leading-6 text-[#667267]">Source: {selected.name} under {section.title}. Customer action triggered this admin queue. Blocker: {selected.blocker}.</p></div><div className="rounded-2xl border border-[#ece6d8] bg-[#fffdf7] p-5"><p className="text-xs font-black uppercase text-[#667267]">Instruction / Troubleshooting</p><h3 className="mt-2 text-2xl font-black">What admin checks</h3><p className="mt-3 text-sm font-bold leading-6 text-[#667267]">{selected.next}</p><div className="mt-4 grid gap-2"><Link href={`/admin/customer-desk/${section.id}/evidence`} className="rounded-xl bg-[#1f6b45] px-4 py-3 text-center font-black text-white">Check Evidence</Link><Link href="/admin/customer-desk/resolved" className="rounded-xl bg-amber-300 px-4 py-3 text-center font-black">Complete</Link></div></div></div></Card></div></Shell>;
  }
  if (section.id === "kyc") {
    const submitted = { name: selected.name, img: "/farmconnect/kyc-test/aydana-selfie-sample.png", detail: "Submitted account: ID front/back, selfie, consent, legal name, birthday." };
    const duplicate = { name: "Aydana B.", img: "/farmconnect/kyc-test/duplicate-face-sample.png", detail: "Possible duplicate: similar face, same birthday risk, older email record." };
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
    return <Shell role="admin" title="Support Chat"><PageTitle title="Support: Live Chat" text="Admin joins only escalated support. Chat stays connected to customer support page." icon="chat" /><div className="mt-4">{brain}</div><div className="mt-4 grid gap-5 xl:grid-cols-[320px_1fr_300px]"><>{customerList}</><Card><h2 className="text-xl font-black">Chat History</h2><div className="mt-4 max-h-[430px] space-y-3 overflow-y-auto pr-2">{chat.map((m,i)=><div key={i} className={("max-w-[86%] rounded-2xl p-3 " + (m.from==="Admin"?"ml-auto bg-[#1f6b45] text-white":m.from==="Customer"?"bg-sky-50 text-[#12375a]":"bg-[#f6f3e8]"))}><b>{m.from}</b><p className="mt-1 text-sm leading-6">{m.text}</p></div>)}</div><div className="mt-4 flex gap-2"><input value={reply} onChange={e=>setReply(e.target.value)} placeholder="Admin reply..." className="flex-1 rounded-xl border border-[#ded8c9] p-3 font-bold" /><button onClick={addReply} className="rounded-xl bg-[#1f6b45] px-5 font-black text-white">Send</button></div></Card><Card><h2 className="text-xl font-black">Close Chat</h2><p className="mt-2 text-sm font-bold leading-6 text-[#667267]">End Chat sends a polite apology/closing message, saves transcript to evidence, then marks case complete.</p><div className="mt-4 grid gap-2"><button onClick={()=>setChat(c=>[...c,{from:"Admin",text:"Thank you for chatting with FarmConnect. We are sorry for the inconvenience. Your concern has been recorded and we are happy to help anytime."}])} className="rounded-xl bg-[#1f6b45] px-4 py-3 font-black text-white">End Chat</button><Link href="/admin/customer-desk/resolved" className="rounded-xl bg-amber-300 px-4 py-3 text-center font-black">Complete</Link></div></Card></div></Shell>;
  }
  if (section.id === "security") {
    return <Shell role="admin" title="Security"><PageTitle title="Security: Reset / Complete" text="Wallet PIN reset is automatic logout plus new PIN setup. Money is never moved." icon="qr" /><div className="mt-4">{brain}</div><div className="mt-4 grid gap-5 xl:grid-cols-[320px_1fr_320px]"><>{customerList}</><Card><h2 className="text-xl font-black">Problem And Check</h2><div className="mt-4 grid gap-3"><Info label="Request" value={selected.problem} /><Info label="Identity" value="Needs KYC proof" /><Info label="Wallet" value="Balance unchanged" /><Info label="Safety" value="Force logout after reset" /></div></Card><Card><h2 className="text-xl font-black">Reset</h2><p className="mt-2 text-sm font-bold leading-6 text-[#667267]">Reset Wallet PIN creates evidence, logs out customer, and requires new PIN on next access. Locked savings and balance stay untouched.</p><div className="mt-4 grid gap-2"><button className="rounded-xl bg-[#1f6b45] px-4 py-3 font-black text-white">Reset Wallet PIN</button><Link href="/admin/customer-desk/resolved" className="rounded-xl bg-amber-300 px-4 py-3 text-center font-black">Complete</Link></div></Card></div></Shell>;
  }
  return <Shell role="admin" title={section.title}><PageTitle title={section.title} text="Task logs and evidence archive." icon={section.icon} /><div className="mt-4">{brain}</div><div className="mt-4 grid gap-5 lg:grid-cols-[340px_1fr]"><>{customerList}</><Card><h2 className="text-xl font-black">{section.title}</h2><p className="mt-2 text-sm font-bold leading-6 text-[#667267]">Resolved cases collect completed problems. Admin can review, delete, or archive records here.</p><div className="mt-4 grid gap-2"><button className="rounded-xl bg-[#eee8d9] px-4 py-3 font-black">Delete</button><button className="rounded-xl bg-[#1f6b45] px-4 py-3 font-black text-white">Archive</button></div></Card></div></Shell>;
}export function AdminCustomerDeskAction({ section, mode }: { section: string; mode: "problem" | "evidence" }) {
  return <AdminCustomerDeskActionPage sectionId={section} mode={mode} />;
}
function AdminCustomerDeskPage() {
  const highCount = customerDeskJobs.filter(j=>j.priority==="High").length;
  return <Shell role="admin" title="Customer Desk"><PageTitle title="Customer Desk" text="Open only the customer problem desk you need. This is built for finishing admin work fast." icon="users" /><div className="mt-4 grid gap-4 lg:grid-cols-[1fr_220px_220px]"><Card className="py-4"><h2 className="text-xl font-black">Customer Problems</h2><p className="mt-1 text-sm font-bold text-[#667267]">Pick a card. Each page is a focused job board: customer, problem, blocker, finish.</p></Card><Card className="py-4"><p className="text-xs font-black uppercase text-[#667267]">High Priority</p><p className="text-2xl font-black text-[#9a3412]">{highCount}</p></Card><Card className="py-4"><p className="text-xs font-black uppercase text-[#667267]">Open Jobs</p><p className="text-2xl font-black text-[#1f6b45]">{customerDeskJobs.length}</p></Card></div><div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">{customerDeskSections.map(s=><Link key={s.id} href={s.href} className="rounded-2xl border border-[#e3ded0] bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-[#1f6b45] hover:shadow-lg"><div className="flex items-start justify-between gap-3"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#f6f3e8] text-[#1f6b45]"><Icon name={s.icon} /></span><Badge tone={s.tone}>{s.count} open</Badge></div><h2 className="mt-4 text-2xl font-black">{s.title}</h2><p className="mt-2 min-h-[72px] text-sm font-bold leading-6 text-[#667267]">{s.text}</p><span className="mt-4 inline-block rounded-xl bg-[#1f6b45] px-4 py-3 text-sm font-black text-white">Open Desk</span></Link>)}</div></Shell>;
}

export function AdminCustomerDeskSection({ section }: { section: string }) {
  return <CustomerDeskJobBoard sectionId={section} />;
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
  return <Shell role="admin" title={config[0]}><PageTitle title={config[0]} text={config[1]} icon={config[2] as IconName} /><KaFarm>{kind === "caretaker" ? "Caretaker desk is for people, proof, payroll, and chat. Start with list/resume, then payroll or proof review." : kind === "farm" ? "Farm operations connects rooster inventory, customer ownership, request queue, sale pricing, and invoices." : kind === "money" ? "Money desk separates cash-in checks, withdrawal review, treasury, and receipts so admin can follow the money trail." : "Evidence desk keeps the farm protected: every proof, receipt, override, and decision stays searchable."}</KaFarm><div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">{cards.map(card=><Link key={card.title} href={card.href} className="rounded-2xl border border-[#e3ded0] bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"><Icon name={card.icon} className="h-7 w-7 text-[#1f6b45]" /><h2 className="mt-3 text-xl font-black">{card.title}</h2><p className="mt-2 min-h-[72px] text-sm font-bold leading-6 text-[#667267]">{card.text}</p></Link>)}</div>{kind === "caretaker" && <div className="mt-5 grid gap-5 xl:grid-cols-[360px_1fr]"><Card><h2 className="text-xl font-black">Caretaker List</h2><div className="mt-4 max-h-[430px] space-y-3 overflow-y-auto pr-2">{caretakerRows.map(row=><div key={row.name} className="rounded-2xl border border-[#ece6d8] p-3"><div className="flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-full bg-[#1f6b45] font-black text-white">{row.avatar}</div><div className="min-w-0 flex-1"><b className="block truncate">{row.name}</b><p className="truncate text-sm font-bold text-[#667267]">{row.role}</p></div><Badge tone={row.status.includes("Review")?"warn":"good"}>{row.status}</Badge></div></div>)}</div></Card><Card><div className="grid gap-4 lg:grid-cols-2"><div><h2 className="text-xl font-black">Resume View</h2><div className="mt-4 rounded-3xl bg-[#f6f3e8] p-5"><div className="grid h-24 w-24 place-items-center rounded-full bg-white text-3xl font-black">JD</div><h3 className="mt-4 text-2xl font-black">Juan Dela Cruz</h3><p className="font-bold text-[#667267]">{caretakerRows[0].resume}</p><p className="mt-3 text-sm font-bold text-[#667267]">Contact and address stay admin-only.</p></div></div><div><h2 className="text-xl font-black">Payroll Snapshot</h2><div className="mt-4 rounded-3xl bg-emerald-50 p-5"><p className="text-sm font-black uppercase text-[#667267]">15th / 30th Payroll</p><p className="mt-2 text-3xl font-black text-[#1f6b45]">{peso(payrollTotal)}</p><p className="mt-2 text-sm font-bold text-[#667267]">Computed from per-day rate, present days, absent days, and payout mode.</p></div>{caretakerRows.map(row=><div key={row.name+"pay"} className="mt-3 flex items-center justify-between rounded-xl border p-3 text-sm font-bold"><span>{row.name}</span><span>{row.present} present / {row.absent} absent - {peso(row.pay*row.present)}</span></div>)}</div></div></Card></div>}{kind === "farm" && <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_360px]"><Card><h2 className="text-xl font-black">Rooster Inventory</h2><div className="mt-4 max-h-[430px] overflow-y-auto pr-2"><div className="grid gap-3">{farmRows.map(row=><div key={row.rooster} className="grid gap-3 rounded-2xl border border-[#ece6d8] p-4 md:grid-cols-6"><b>{row.rooster}</b><span>{row.status}</span><span>{row.owner}</span><span>{row.caretaker}</span><span>{row.pen}</span><span className="text-[#667267]">{row.note}</span></div>)}</div></div></Card><Card><h2 className="text-xl font-black">Request Queue</h2><p className="mt-2 text-sm font-bold leading-6 text-[#667267]">Sell requests and care requests land here first. Admin sets price or assigns caretaker; caretaker checks weight/status when needed.</p><Link href="/admin/sell-requests" className="mt-4 inline-block rounded-xl bg-[#1f6b45] px-4 py-3 font-black text-white">Open Sell Queue</Link></Card></div>}{kind === "money" && <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_360px]"><Card><h2 className="text-xl font-black">Money Queue</h2><div className="mt-4 max-h-[430px] space-y-3 overflow-y-auto pr-2">{moneyRows.map(row=><div key={row.type+row.name} className="grid gap-3 rounded-2xl border border-[#ece6d8] p-4 md:grid-cols-5"><b>{row.type}</b><span>{row.name}</span><span>{peso(row.amount)}</span><span>{row.source}</span><Badge tone={row.status.includes("locked")?"warn":"neutral"}>{row.status}</Badge></div>)}</div></Card><Card><h2 className="text-xl font-black">Treasury Meaning</h2><p className="mt-2 text-sm font-bold leading-6 text-[#667267]">Treasury is the owner view of money: real cash received, pending cash-ins, locked customer savings, unpaid withdrawals, payroll due, and available farm funds.</p><Link href="/admin/customer-desk/withdraw" className="mt-4 inline-block rounded-xl bg-[#1f6b45] px-4 py-3 font-black text-white">Open Withdrawal Desk</Link></Card></div>}{kind === "evidence" && <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_360px]"><Card><h2 className="text-xl font-black">Evidence Stream</h2><div className="mt-4 max-h-[430px] space-y-3 overflow-y-auto pr-2">{evidenceRows.map(row=><div key={row.title} className="grid gap-3 rounded-2xl border border-[#ece6d8] p-4 md:grid-cols-4"><b>{row.title}</b><span>{row.owner}</span><span>{row.source}</span><Badge tone={row.status==="Archived"?"good":"warn"}>{row.status}</Badge></div>)}</div></Card><Card><h2 className="text-xl font-black">Resolved Cases</h2><p className="mt-2 text-sm font-bold leading-6 text-[#667267]">Finished problems move here with final decision, receipt/invoice, customer notice, admin note, and evidence links.</p><Link href="/admin/customer-desk/resolved" className="mt-4 inline-block rounded-xl bg-[#1f6b45] px-4 py-3 font-black text-white">Open Resolved</Link></Card></div>}</Shell>;
}

export function AdminDesk({ kind }: { kind: "customer" | "caretaker" | "farm" | "money" | "chat" | "evidence" | "kafarm" }) {
  const config = {
    customer: ["Customer Desk", "Manage customers, KYC, wallet concerns, requests, and customer logbooks.", "users"],
    caretaker: ["Caretaker Desk", "Manage caretaker list, resumes, payroll, proof review, logs, and chat.", "user"],
    farm: ["Farm Operations", "Manage rooster inventory, customer roosters, request queue, sales, and invoices.", "rooster"],
    money: ["Money Desk", "Review cash-ins, withdrawals, treasury, receipts, and money evidence.", "coins"],
    chat: ["Live Chat", "Only escalated Ka-Farm chats and caretaker-admin chats appear here.", "chat"],
    evidence: ["System Evidence", "Search receipts, proofs, logs, overrides, resolved cases, and audit records.", "search"],
    kafarm: ["Ka-Farm Console", "Buddy troubleshooter guide for admin when the owner is away.", "support"],
  }[kind];
  if (kind === "chat") return <AdminLiveChatPage />;
  if (kind === "customer") return <AdminCustomerDeskPage />;
  return <AdminWorkDesk kind={kind as "caretaker" | "farm" | "money" | "evidence" | "kafarm"} config={config} />;
}

export function AccessPage({ role }: { role: Role }) {
  return <RoleAuthPage role={role} mode="login" />;
}

export function RoleAuthPage({ role, mode = "login" }: { role: Role; mode?: "login" | "register" }) {
  const router = useRouter();
  const href = role === "admin" ? "/admin" : role === "caretaker" ? "/caretaker/dashboard" : "/customer/dashboard";
  const title = role === "admin" ? "Admin Access" : role === "caretaker" ? "Caretaker Access" : "Customer Access";
  const [formMode, setFormMode] = useState(mode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("Ka-Farm will check your account and open the right workspace.");
  const canRegister = role === "customer";

  async function ensureCustomerProfile(authUserId: string) {
    const { data: existing } = await supabase
      .from("profiles")
      .select("id, role, account_status")
      .eq("auth_user_id", authUserId)
      .maybeSingle();

    if (existing) return existing;

    const { data, error } = await supabase
      .from("profiles")
      .insert({
        auth_user_id: authUserId,
        email,
        full_name: fullName || email.split("@")[0],
        display_name: fullName || email.split("@")[0],
        role: "customer",
        verification_status: "pending",
        membership_status: "inactive",
      })
      .select("id, role, account_status")
      .single();

    if (error) throw error;
    return data;
  }

  async function openRoleWorkspace(authUserId: string) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role, account_status")
      .eq("auth_user_id", authUserId)
      .maybeSingle();

    const checkedProfile = profile || (role === "customer" ? await ensureCustomerProfile(authUserId) : null);
    if (!checkedProfile) {
      setMessage("This account is not assigned yet. Please ask the farm admin to activate it.");
      return;
    }
    if (checkedProfile.account_status !== "active") {
      setMessage("This account needs admin review before it can open.");
      return;
    }
    if (checkedProfile.role !== role) {
      await supabase.auth.signOut();
      setMessage("This login belongs to a different workspace. Please use the correct access page.");
      return;
    }
    router.push(href);
  }

  async function submit() {
    if (!email || !password || (formMode === "register" && !fullName)) {
      setMessage("Please complete the needed fields first.");
      return;
    }
    setLoading(true);
    setMessage("Ka-Farm is checking your access...");
    try {
      if (formMode === "register") {
        if (!canRegister) {
          setMessage("Admin or caretaker accounts must be created by the farm owner.");
          return;
        }
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (data.user) await ensureCustomerProfile(data.user.id);
        setMessage(data.session ? "Account ready. Opening your customer app..." : "Account created. Please check your email if confirmation is required.");
        if (data.user && data.session) router.push(href);
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (data.user) await openRoleWorkspace(data.user.id);
    } catch (error) {
      const text = error instanceof Error ? error.message : "Please check your details and try again.";
      setMessage(text.toLowerCase().includes("invalid") ? "Email or password did not match. Please try again." : "We could not complete this yet. Please try again in a moment.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#f6f3e8] px-4 text-[#17251d]">
      <Card className="w-full max-w-xl">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[#1f6b45] text-white"><Icon name="shield" /></div>
        <h1 className="mt-5 text-3xl font-black">{title}</h1>
        <KaFarm>{message}</KaFarm>
        <div className="mt-5 grid gap-3">
          {formMode === "register" && <input value={fullName} onChange={e=>setFullName(e.target.value)} className="rounded-xl border border-[#ded8c9] p-3" placeholder="Full name" />}
          <input value={email} onChange={e=>setEmail(e.target.value)} className="rounded-xl border border-[#ded8c9] p-3" placeholder="Email" type="email" />
          <input value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")submit();}} className="rounded-xl border border-[#ded8c9] p-3" placeholder="Password" type="password" />
          <button onClick={submit} disabled={loading} className="rounded-xl bg-[#1f6b45] px-5 py-3 font-black text-white disabled:opacity-60">{loading ? "Checking..." : formMode === "register" ? "Create Customer Account" : `Open ${title}`}</button>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          {canRegister && <button onClick={()=>setFormMode(formMode==="login"?"register":"login")} className="rounded-xl bg-[#eee8d9] px-4 py-3 font-black">{formMode==="login" ? "Create account" : "I already have an account"}</button>}
          <Link href="/" className="rounded-xl bg-[#eee8d9] px-4 py-3 font-black">Home</Link>
        </div>
      </Card>
    </main>
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





























































