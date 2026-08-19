"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { QRCodeSVG } from "qrcode.react";
import { getAdminEscalatedChats, getLatestSupportSessionId, getSupportMessages, getSupportSessionStatus, runAdminSupportAction, saveKaFarmSupportMessage, sendSupportMessage } from "@/lib/backend/support-chat";
import { getEscalationNotice, getKaFarmReply, shouldEscalateToAdmin } from "@/lib/kafarm-brain";
import { activateAdminCarePlan, adminAssignCareRequest, adminReviewCaretakerApplication, adminReviewManualPayment, adminReviewMissionProof, adminReviewRoosterSale, adminReviewTaskProof, assignAdminCarePlan, cancelCustomerCarePlan, confirmRoosterSale, confirmWithdrawalResult, controlAdminCarePlan, createCareRequest, createPrivateEvidenceUrl, generateTodayCarePlanMissions, getActiveCaretakersForAssignment, getAdminCarePlans, getAdminCareRequests, getAdminCaretakerDirectory, getAdminCaretakerTasks, getAdminCustomerInventory, getAdminManualPaymentRequests, getAdminRoosterSaleRequests, getAdminTaskProofs, getAdminWithdrawalDisputes, getAvailableFarmFeedProducts, getCareLogRecords, getCaretakerActiveTasks, getCaretakerApplications, getCaretakerTaskInventory, getCurrentCaretakerProfile, getCurrentCustomerKycSubmission, getCurrentProfile, getCustomerCarePlans, getCustomerCareRequests, getCustomerInventoryItems, getCustomerManualPaymentRequests, getCustomerOwnedRoosters, getCustomerPayoutMethods, getCustomerRoosterCareOverviews, getCustomerRoosterSaleRequest, getFarmProducts, getInboxItems, getWalletTransactions, markInboxItemRead, prepareAdminCarePlanQuote, recordAdminCarePlanRefund, reportWithdrawalProblem, requestCustomerCarePlan, requestRoosterSalePrice, resolveWithdrawalDispute, saveCartItem, saveCustomerPayoutMethod, submitCaretakerApplication, submitCaretakerManualMissionProof, submitCaretakerMissionProof, submitCaretakerRoosterSaleTask, submitCaretakerTaskProof, submitManualPaymentRequest, submitWithdrawalRequest, getCustomerWithdrawalRequests, getAdminWithdrawalRequests, adminReviewWithdrawalRequest, uploadPrivateEvidenceFile, type CareLogRecord, type CareTaskInventoryItem, type CustomerRoosterCareOverview } from "@/lib/farmconnect-data";
import { ensureCustomerSignupProfile, isFreshSupabaseSignup } from "@/lib/customer-signup";
import { adminReviewManualMissionProof } from "@/lib/farmconnect-data";
import { prepareCustomerCarePlanPayment } from "@/lib/farmconnect-data";
import { hasReservedSignupEmailDomain, reservedSignupEmailMessage, signupFailureMessage } from "@/lib/signup-validation";
import { supabase } from "@/lib/supabase";

type Role = "customer" | "caretaker" | "admin";
type IconName = "home" | "rooster" | "bag" | "clipboard" | "wallet" | "inbox" | "support" | "settings" | "logout" | "check" | "camera" | "qr" | "upload" | "download" | "user" | "users" | "coins" | "shield" | "search" | "chat" | "file" | "alert" | "eye" | "eyeOff" | "trash";

const peso = (value: number) =>
  value.toLocaleString("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  });
const fcCoin = (value: number) => value.toLocaleString("en-PH", { maximumFractionDigits: 0 });

function readableAppError(error: unknown) {
  const friendlyMessages: Record<string, string> = {
    KYC_REQUIRED: "KYC approval is required before withdrawal.",
    MINIMUM_WITHDRAWAL_100: "Minimum withdrawal is FC 100.",
    INSUFFICIENT_WALLET_BALANCE: "The withdrawal amount is higher than the available wallet balance.",
    PAYOUT_DETAILS_REQUIRED: "Complete the payout method, account holder, and account number.",
    WALLET_PIN_REQUIRED: "Enter your 6-digit Wallet PIN.",
    WALLET_PIN_NOT_SET: "Set your Wallet PIN in Settings before requesting a withdrawal.",
    WALLET_PIN_INVALID: "Wallet PIN is incorrect.",
    WALLET_PIN_LOCKED: "Wallet PIN is temporarily locked after repeated failed attempts. Try again later.",
    WITHDRAWAL_NOT_WAITING_FOR_CORRECTION: "This withdrawal is no longer waiting for corrected payout details. Refresh the page.",
    WITHDRAWAL_HOLD_NOT_ACTIVE: "This withdrawal no longer has an active wallet hold. Admin must investigate before it can continue.",
    CARE_PLAN_CUSTOMER_FEED_BALANCE_INSUFFICIENT: "Inventory does not have enough eligible feed for the rooster’s complete age-based 30-day requirement. Buy feed in Farm Buy, wait for approval, then try again.",
    CARE_PLAN_CUSTOMER_FEED_CONVERSION_REQUIRED: "The selected feed has no verified kilogram conversion. Ask Admin to correct the feed unit before requesting a Care Plan.",
    MISSION_CATALOG_FEED_QUANTITY_INCOMPLETE: "The care standard is missing an exact feed quantity for one or more covered days. Care Plan payment is safely blocked until Admin corrects the mission catalog.",
    CARE_PLAN_CATALOG_WINDOW_EXHAUSTED: "This rooster no longer has a complete 30-day window inside the current 180-day care program. Ask Admin for the next approved mature-rooster program.",
    LOGIN_REQUIRED: "Login again before continuing.",
  };
  const raw = error instanceof Error ? error.message : error && typeof error === "object" ? [(error as { message?: unknown }).message, (error as { details?: unknown }).details, (error as { hint?: unknown }).hint, (error as { code?: unknown }).code].filter((item) => typeof item === "string" && item.trim()).join(" | ") : typeof error === "string" ? error : "";
  const knownCode = Object.keys(friendlyMessages).find((code) => raw.includes(code));
  if (knownCode) return friendlyMessages[knownCode];
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const value = error as {
      message?: unknown;
      details?: unknown;
      hint?: unknown;
      code?: unknown;
    };
    return [value.message, value.details, value.hint, value.code].filter((item) => typeof item === "string" && item.trim()).join(" | ");
  }
  return typeof error === "string" ? error : "";
}

function rawAppError(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const value = error as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown };
    return [value.message, value.details, value.hint, value.code].filter((item) => typeof item === "string" && item.trim()).join(" | ");
  }
  return typeof error === "string" ? error : "";
}

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
  download: "M12 4v12 M7 11l5 5 5-5 M5 20h14",
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
  rooster: {
    bg: "linear-gradient(135deg, rgba(230,247,237,0.98), rgba(255,236,138,0.96), rgba(220,235,255,0.95))",
    ring: "rgba(31,107,69,0.78)",
    shadow: "0 14px 30px rgba(31, 107, 69, 0.24)",
  },
  bag: {
    bg: "linear-gradient(135deg, rgba(220,235,255,0.98), rgba(255,238,130,0.96), rgba(225,247,235,0.95))",
    ring: "rgba(31,93,184,0.76)",
    shadow: "0 14px 30px rgba(31, 93, 184, 0.24)",
  },
  clipboard: {
    bg: "linear-gradient(135deg, rgba(225,247,235,0.98), rgba(255,238,130,0.96), rgba(220,235,255,0.95))",
    ring: "rgba(245,184,46,0.82)",
    shadow: "0 14px 30px rgba(187, 124, 0, 0.22)",
  },
  wallet: {
    bg: "linear-gradient(135deg, rgba(220,235,255,0.98), rgba(225,247,235,0.96), rgba(255,238,130,0.95))",
    ring: "rgba(13,79,179,0.76)",
    shadow: "0 14px 30px rgba(13, 79, 179, 0.24)",
  },
  inbox: {
    bg: "linear-gradient(135deg, rgba(220,235,255,0.98), rgba(255,238,130,0.94), rgba(225,247,235,0.95))",
    ring: "rgba(18,99,199,0.74)",
    shadow: "0 14px 30px rgba(18, 99, 199, 0.22)",
  },
  support: {
    bg: "linear-gradient(135deg, rgba(225,247,235,0.98), rgba(220,235,255,0.96), rgba(255,238,130,0.95))",
    ring: "rgba(35,103,201,0.74)",
    shadow: "0 14px 30px rgba(35, 103, 201, 0.22)",
  },
  settings: {
    bg: "linear-gradient(135deg, rgba(220,235,255,0.98), rgba(255,238,130,0.94), rgba(225,247,235,0.95))",
    ring: "rgba(29,102,209,0.74)",
    shadow: "0 14px 30px rgba(29, 102, 209, 0.22)",
  },
  home: {
    bg: "linear-gradient(135deg, rgba(225,247,235,0.98), rgba(255,238,130,0.96), rgba(220,235,255,0.95))",
    ring: "rgba(31,107,69,0.74)",
    shadow: "0 14px 30px rgba(31, 107, 69, 0.22)",
  },
  coins: {
    bg: "linear-gradient(135deg, rgba(255,238,130,0.98), rgba(225,247,235,0.95), rgba(220,235,255,0.95))",
    ring: "rgba(245,184,46,0.82)",
    shadow: "0 14px 30px rgba(187, 124, 0, 0.22)",
  },
  shield: {
    bg: "linear-gradient(135deg, rgba(225,247,235,0.98), rgba(220,235,255,0.95), rgba(255,238,130,0.92))",
    ring: "rgba(31,107,69,0.74)",
    shadow: "0 14px 30px rgba(31, 107, 69, 0.22)",
  },
  users: {
    bg: "linear-gradient(135deg, rgba(220,235,255,0.98), rgba(225,247,235,0.95), rgba(255,238,130,0.92))",
    ring: "rgba(31,93,184,0.72)",
    shadow: "0 14px 30px rgba(31, 93, 184, 0.20)",
  },
};
function FarmImageIcon({ name, imageSrc, className = "h-8 w-8", fallbackClassName = "h-5 w-5" }: { name: IconName; imageSrc?: string; className?: string; fallbackClassName?: string }) {
  const src = imageSrc || farmIconImage[name];
  if (!src) return <Icon name={name} className={fallbackClassName} />;
  return <img src={src} alt="" aria-hidden="true" className={"shrink-0 object-contain " + className} />;
}
function FCCoin({ className = "h-12 w-12" }: { className?: string }) {
  return (
    <div className={"relative grid shrink-0 place-items-center rounded-full border-4 border-amber-200 bg-gradient-to-br from-amber-100 via-yellow-400 to-amber-600 shadow-inner " + className}>
      <span className="absolute inset-2 rounded-full border border-yellow-100/80" />
      <span className="relative flex items-center font-black text-[#1f6b45] drop-shadow-sm">
        <span className="relative text-[1.15em] leading-none">
          F
          <span className="absolute left-0 top-[34%] h-[0.12em] w-[0.8em] rounded bg-[#1f6b45]" />
          <span className="absolute left-0 top-[58%] h-[0.12em] w-[0.65em] rounded bg-[#1f6b45]" />
        </span>
        <span className="-ml-[0.08em] text-[0.9em] leading-none">C</span>
      </span>
    </div>
  );
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
    ["Customer Requests", "/admin/customer-requests", "clipboard"],
    ["Caretaker Management", "/admin/caretaker-management", "user"],
    ["Farm Operations", "/admin/farm-operations", "rooster"],
    ["Issue Management", "/admin/issue-management", "alert"],
    ["Account Verification", "/admin/account-verification", "shield"],
    ["Evidence Logs", "/admin/evidence", "file"],
    ["KaFarm", "/admin/kafarm", "support"],
  ],
} as const;

const gamefowlBloodlines = ["Hatch", "Kelso", "Sweater", "Roundhead", "Lemon", "Claret", "Albany", "Grey", "Lacy Roundhead", "Radio", "Whitehackle", "Yellow Leg Hatch"];

const gamefowlBloodlineKeys = new Set(gamefowlBloodlines.map((bloodline) => bloodline.toLowerCase()));

const breedChickProducts = gamefowlBloodlines.map((breed, index) => ({
  id: `breed-chick-${breed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}`,
  name: `Starter Chick (${breed})`,
  category: "Breed Chicks",
  unit: "per head",
  price: 450 + (index % 8) * 75,
  stock: Math.max(6, 30 - (index % 7) * 3),
  image: "/farmconnect/roosters/fc-stage-1-chick-base.jpg",
}));

const products = [
  ...breedChickProducts,
  {
    id: "p2",
    name: "Premium Rooster Feeds",
    category: "Feeds",
    unit: "per kg",
    price: 80,
    stock: 250,
    image: "/farmconnect/marketplace/fc-product-feeds.jpg",
  },
  {
    id: "p3",
    name: "Recovery Electrolytes",
    category: "Electrolytes",
    unit: "per sachet",
    price: 60,
    stock: 100,
    image: "/farmconnect/marketplace/fc-product-supplements.jpg",
  },
  {
    id: "p4",
    name: "Rooster Supplements",
    category: "Supplements",
    unit: "per tablet",
    price: 25,
    stock: 200,
    image: "/farmconnect/marketplace/fc-product-supplements.jpg",
  },
  {
    id: "p5",
    name: "Rooster Vitamins",
    category: "Vitamins",
    unit: "per dose",
    price: 75,
    stock: 150,
    image: "/farmconnect/marketplace/fc-product-vitamins.jpg",
  },
  {
    id: "p6",
    name: "Poultry Equipment",
    category: "Equipment",
    unit: "per item",
    price: 350,
    stock: 40,
    image: "/farmconnect/marketplace/fc-product-equipment.jpg",
  },
];

function normalizeFarmProductName(name: string, category: string) {
  if (/starter chick/i.test(name) && !/\(.+\)/.test(name)) return "Starter Chick (Hatch)";
  if (/starter chicks/i.test(category)) return name.replace(/^Standard Starter Chick$/i, "Starter Chick (Hatch)");
  return name;
}

function normalizeFarmProductCategory(category: string) {
  return /starter chicks/i.test(category) ? "Breed Chicks" : category;
}

type FarmProductCard = (typeof products)[number] & {
  product_type?: string | null;
  stage?: string | null;
  bloodline?: string | null;
  breed?: string | null;
  product_metadata?: Record<string, unknown> | null;
};

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

type RoosterCard = {
  id: string;
  name: string;
  breed: string;
  tag: string;
  stage: string;
  status: string;
  health: string;
  value: string;
  image: string;
  pen: string;
  caretaker: string;
  saleStatus?: string;
  approvedSalePrice?: number | null;
  ownershipMetadata?: Record<string, unknown>;
  careOverview?: CustomerRoosterCareOverview | null;
};

function carePlanBox(overview?: CustomerRoosterCareOverview | null) {
  if (!overview) return { title: "Premium guide", detail: "Mission loading" };
  if (overview.planStatus === "active") return { title: "Paid · Active", detail: `Day ${overview.planDay || 1} of ${overview.durationDays || 30}` };
  if (overview.planStatus === "paused") return { title: "Paid · Paused", detail: `Day ${overview.planDay || 1} of ${overview.durationDays || 30}` };
  if (["paid_pending_setup", "ready"].includes(String(overview.planStatus))) return { title: "Paid · Preparing", detail: `${overview.durationDays || 30}-day automation` };
  if (["draft", "payment_for_review", "payment_submitted"].includes(String(overview.planStatus))) return { title: "Plan requested", detail: String(overview.planStatus).replaceAll("_", " ") };
  return { title: `Today · Day ${overview.catalogDay}`, detail: overview.missionTitle };
}

const services = [
  {
    name: "Care Plan (30 Days)",
    category: "Care Plan",
    price: 5000,
    proof: "₱5,000 total · ₱166.67 average/day · customer-owned age-based feed required",
    eta: "Payment approval, then one caretaker assignment",
  },
  {
    name: "Today's Standard Care",
    category: "Care",
    price: 160,
    proof: "Daily procedure + safety checklist + care proof",
    eta: "Today",
  },
  {
    name: "Photo Update",
    category: "Update",
    price: 0,
    proof: "Clear photo proof",
    eta: "Today",
  },
  {
    name: "Video Proof",
    category: "Update",
    price: 100,
    proof: "Short video",
    eta: "24 hours",
  },
  {
    name: "Weight Check",
    category: "Update",
    price: 50,
    proof: "Scale photo + note",
    eta: "Today",
  },
  {
    name: "Health Check",
    category: "Health",
    price: 75,
    proof: "Photo + preset note",
    eta: "Today",
  },
  {
    name: "Give Vitamins",
    category: "Care",
    price: 75,
    proof: "Product photo + prepared dose",
    eta: "24 hours",
  },
  {
    name: "Premium Feed",
    category: "Care",
    price: 160,
    proof: "Feed photo + feeding photo",
    eta: "Today",
  },
  {
    name: "Vaccine Shot",
    category: "Health",
    price: 250,
    proof: "Admin review + video recommended",
    eta: "Scheduled",
  },
  {
    name: "List for Sale",
    category: "Sell",
    price: 0,
    proof: "Admin sale review",
    eta: "1-2 days",
  },
];

type WalletTransactionRow = {
  type: string;
  amount: number;
  status: string;
  date: string;
  receipt: string;
};

type CaretakerTaskView = {
  id: string;
  requester: string;
  rooster: string;
  tag: string;
  task: string;
  due: string;
  priority: string;
  note: string;
  pen: string;
  proof: string;
  status: string;
  ownerReference: string;
  workflowType: string;
  qrScanRequired: boolean;
  qrPayload: string;
  taskMetadata: Record<string, unknown>;
  db: true;
};

function mapCaretakerTaskRow(row: any): CaretakerTaskView {
  return {
    id: row.id,
    requester: row.requester_name || row.owner_name || row.customer_name || "Customer",
    rooster: row.rooster_name || "Rooster",
    tag: row.rooster_tag || "No tag",
    task: row.task_type || "Care Task",
    due: row.due_at
      ? new Date(row.due_at).toLocaleString([], {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "No deadline",
    priority: row.priority || "normal",
    note: row.customer_note || row.admin_note || "No instruction was attached.",
    pen: row.pen || "Pen not specified",
    proof: row.required_proof || "Photo and work note",
    status: row.status || "active",
    ownerReference: row.profile_id ? `Account ${String(row.profile_id).slice(0, 8).toUpperCase()}` : "Customer account",
    workflowType: row.workflow_type || "standard_care",
    qrScanRequired: row.qr_scan_required !== false,
    qrPayload: row.qr_payload || "",
    taskMetadata: row.task_metadata || {},
    db: true,
  };
}

const completedTasks: Array<{
  rooster: string;
  task: string;
  time: string;
  status: string;
  image: string;
}> = [];
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
  try {
    return JSON.parse(window.localStorage.getItem(submittedProofKey) || "[]");
  } catch {
    return [];
  }
}
function saveSubmittedTaskProof(task: CaretakerTaskView) {
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
  window.localStorage.setItem(submittedProofKey, JSON.stringify([record, ...current.filter((item) => item.id !== record.id)].slice(0, 30)));
  const notice = {
    tab: "Caretaker Updates",
    title: `${task.rooster} ${task.task}`,
    text: `${task.task} proof was submitted by ${record.caretaker}. Admin review is pending before final release.`,
    status: "Pending",
    action: "carelogs",
    href: "/customer/care-logs",
  };
  try {
    const rawInbox = window.localStorage.getItem(localInboxKey);
    const currentInbox = rawInbox ? JSON.parse(rawInbox) : [];
    window.localStorage.setItem(localInboxKey, JSON.stringify([notice, ...currentInbox.filter((item: any) => item.title !== notice.title)].slice(0, 50)));
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
    uploaded: Number.isNaN(date.getTime())
      ? "Today"
      : date.toLocaleDateString("en-PH", {
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
    time: Number.isNaN(date.getTime())
      ? ""
      : date.toLocaleTimeString("en-PH", {
          hour: "numeric",
          minute: "2-digit",
        }),
    proof: record.proof,
    reviewer: "Pending admin proof review",
    image: record.image,
  };
}

const customerNavCardStyle: Record<string, { bg: string; border: string; chip: string; text: string }> = {
  "My Roosters": {
    bg: "linear-gradient(135deg, #e8ffdc 0%, #fff17a 56%, #dff0ff 100%)",
    border: "#f6b64a",
    chip: "#fff1b7",
    text: "#173021",
  },
  "Farm Buy": {
    bg: "linear-gradient(135deg, #dff0ff 0%, #fff17a 52%, #e7ffe0 100%)",
    border: "#1f5db8",
    chip: "#dceaff",
    text: "#102b4a",
  },
  "Farm Requests": {
    bg: "linear-gradient(135deg, #e7fff0 0%, #dff0ff 48%, #fff17a 100%)",
    border: "#d92525",
    chip: "#ffe2de",
    text: "#302018",
  },
  Wallet: {
    bg: "linear-gradient(135deg, #dff0ff 0%, #e7ffe0 52%, #fff17a 100%)",
    border: "#0d4fb3",
    chip: "#dceaff",
    text: "#102b4a",
  },
};
function Shell({ role, title, children }: { role: Role; title: string; children: React.ReactNode }) {
  const router = useRouter();
  const links = nav[role];
  const headerLinks = role === "admin" ? links.filter(([label]) => ["Dashboard", "Customer Requests", "Caretaker Management", "Farm Operations", "Issue Management", "Account Verification"].includes(label)) : links;
  const customerPhoneLinks = [
    ["Home", "/customer/dashboard", "home"],
    ["Roosters", "/customer/roosters", "rooster"],
    ["Farm Buy", "/customer/farm-buy", "bag"],
    ["Requests", "/customer/farm-requests", "clipboard"],
  ] as const;
  const customerMoreLinks = [
    ["Wallet", "/customer/wallet", "wallet"],
    ["Inbox", "/customer/inbox", "inbox"],
    ["Support", "/customer/support", "support"],
    ["Inventory", "/customer/inventory", "bag"],
    ["Settings", "/customer/settings", "settings"],
  ] as const;
  const customerTabletLinks = [
    ["Dashboard", "/customer/dashboard", "home"],
    ["My Roosters", "/customer/roosters", "rooster"],
    ["Farm Buy", "/customer/farm-buy", "bag"],
    ["Requests", "/customer/farm-requests", "clipboard"],
    ["Wallet", "/customer/wallet", "wallet"],
    ["Inbox", "/customer/inbox", "inbox"],
  ] as const;
  const [inboxCount, setInboxCount] = useState(0);
  const [accessReady, setAccessReady] = useState(false);
  const [customerMoreOpen, setCustomerMoreOpen] = useState(false);
  useEffect(() => {
    if (!customerMoreOpen) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setCustomerMoreOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [customerMoreOpen]);
  const logoutCustomer = async () => {
    setCustomerMoreOpen(false);
    await supabase.auth.signOut().catch(() => undefined);
    router.replace("/");
  };
  useEffect(() => {
    let mounted = true;
    getCurrentProfile()
      .then((profile) => {
        if (!mounted) return;
        const allowed = String(profile?.role || "").toLowerCase() === role && String(profile?.account_status || "").toLowerCase() === "active";
        if (allowed) setAccessReady(true);
        else router.replace("/");
      })
      .catch(() => {
        if (mounted) router.replace("/");
      });
    return () => {
      mounted = false;
    };
  }, [role, router]);
  useEffect(() => {
    if (role !== "customer") return;
    let mounted = true;
    const refreshInboxCount = () =>
      getCurrentProfile()
        .then((profile) => (profile ? getInboxItems(profile.id) : []))
        .then((rows) => {
          if (mounted) setInboxCount((rows || []).filter((row: any) => !row.is_read).length);
        })
        .catch(() => {
          if (mounted) setInboxCount(0);
        });
    void refreshInboxCount();
    const interval = window.setInterval(refreshInboxCount, 10000);
    const refreshOnFocus = () => void refreshInboxCount();
    window.addEventListener("focus", refreshOnFocus);
    window.addEventListener("farmconnect:inbox-changed", refreshOnFocus);
    return () => {
      mounted = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshOnFocus);
      window.removeEventListener("farmconnect:inbox-changed", refreshOnFocus);
    };
  }, [role, title]);
  if (!accessReady)
    return (
      <main className="grid min-h-screen place-items-center bg-[#f6f3e8]">
        <div className="rounded-2xl bg-white p-6 text-center shadow-sm">
          <p className="text-sm font-black uppercase text-[#1f6b45]">Checking account access</p>
          <p className="mt-2 text-sm font-bold text-[#667267]">Ka-Farm is verifying your active {role} session.</p>
        </div>
      </main>
    );
  return (
    <main
      className="min-h-screen overflow-x-clip bg-[#f6f3e8] bg-cover bg-center bg-no-repeat text-[#17251d]"
      style={{
        backgroundImage: "linear-gradient(180deg, rgba(255,253,247,0.20), rgba(246,243,232,0.14)), linear-gradient(180deg, rgba(0,0,0,0.03), rgba(0,0,0,0.09)), radial-gradient(circle at top left, rgba(255,191,55,0.12), transparent 34%), radial-gradient(circle at bottom right, rgba(31,107,69,0.12), transparent 38%), url('/farmconnect/farmconnect-hero-wallpaper.jpg')",
      }}
    >
      <header className="sticky top-0 z-40 border-b-4 border-[#ffd43b] bg-gradient-to-r from-[#075c3a]/95 via-[#0b6fba]/94 to-[#075c3a]/95 text-white shadow-[0_12px_35px_rgba(7,92,58,0.24)] backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3">
          <Link href={role === "admin" ? "/admin" : role === "caretaker" ? "/caretaker/dashboard" : "/customer/dashboard"} className="flex min-w-0 items-center gap-2 sm:gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-white shadow-sm sm:h-12 sm:w-12">
              <FarmImageIcon name="rooster" className="h-9 w-9 sm:h-11 sm:w-11" />
            </span>
            <span className="min-w-0">
              <b className="block truncate text-sm sm:text-lg">FarmConnect</b>
              <small className="block max-w-32 truncate text-[10px] font-bold text-white/78 sm:max-w-48 sm:text-xs">{title}</small>
            </span>
          </Link>
          <nav className="fc-desktop-header-nav hidden items-center gap-2 lg:flex">
            {headerLinks.map(([label, href, icon]) => {
              const navCard = role === "customer" ? customerNavCardStyle[label] : undefined;
              return (
                <Link
                  key={href}
                  href={href}
                  style={
                    navCard
                      ? {
                          background: navCard.bg,
                          borderColor: navCard.border,
                          color: navCard.text,
                        }
                      : undefined
                  }
                  className={navCard ? "group flex min-h-[48px] items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-black shadow-sm ring-1 ring-white/35 transition hover:-translate-y-0.5 hover:shadow-md xl:px-3.5" : "flex items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-black text-white transition hover:bg-white/16 xl:px-3 xl:text-sm"}
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
            {role === "customer" && (
              <span className="hidden sm:contents">
                <TopIcon href="/customer/support" name="support" label="Support" imageSrc="/farmconnect/icons/support.png" />
              </span>
            )}
            {role === "customer" && (
              <span className="hidden md:contents">
                <TopIcon href="/customer/inventory" name="bag" label="Inventory" imageSrc="/farmconnect/icons/farm-bag.png" />
              </span>
            )}
            <span className="hidden sm:contents">
              <TopIcon href={role === "customer" ? "/customer/settings" : role === "caretaker" ? "/caretaker/profile" : "/admin/kafarm"} name="settings" label={role === "admin" ? "Ka-Farm" : "Settings"} imageSrc={role === "customer" ? "/farmconnect/icons/farm-settings.png" : undefined} />
            </span>
            {role === "customer" && (
              <span className="sm:hidden">
                <TopIcon href="/customer/settings" name="settings" label="Profile" imageSrc="/farmconnect/icons/farm-settings.png" />
              </span>
            )}
            <span className={role === "customer" ? "hidden sm:contents" : "contents"}>
              <TopIcon href="/" name="logout" label="Logout" />
            </span>
          </div>
        </div>
      </header>
      {role === "customer" && (
        <nav aria-label="Customer tablet navigation" className="fc-customer-tablet-nav sticky top-[72px] z-30 mx-auto hidden max-w-5xl items-center justify-center gap-2 border-b border-[#d7e2d5] bg-white/94 px-3 py-2 shadow-md backdrop-blur">
          {customerTabletLinks.map(([label, href, icon]) => (
            <Link key={href} href={href} className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-[#dbe6d7] bg-[#fbfbf6] px-3 py-2 text-center text-xs font-black text-[#174d36] transition hover:border-[#1f6b45] hover:bg-emerald-50">
              <FarmImageIcon name={icon as IconName} className="h-7 w-7 rounded-md" fallbackClassName="h-5 w-5" />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
      )}
      <div className={`fc-shell-content mx-auto max-w-7xl px-3 py-4 drop-shadow-[0_1px_0_rgba(255,255,255,0.65)] sm:px-4 sm:py-6 ${role === "customer" ? "pb-40 sm:pb-6 lg:pb-28" : "pb-28"}`}>{children}</div>
      {role === "customer" ? (
        <nav aria-label="Customer phone navigation" className="fc-customer-mobile-nav fixed bottom-2 left-1/2 z-40 flex w-[calc(100%-16px)] max-w-md -translate-x-1/2 gap-1 rounded-2xl border border-[#ded8c9] bg-white/96 p-2 shadow-xl backdrop-blur sm:hidden">
          {customerPhoneLinks.map(([label, href, icon]) => (
            <Link key={href} href={href} className="grid min-w-0 flex-1 place-items-center rounded-xl px-1 py-2 text-center text-[10px] font-black text-[#174d36]">
              <FarmImageIcon name={icon as IconName} className="mb-1 h-7 w-7 rounded-md" fallbackClassName="mb-1 h-5 w-5" />
              <span className="truncate">{label}</span>
            </Link>
          ))}
          <button type="button" aria-expanded={customerMoreOpen} aria-controls="customer-more-tools" onClick={() => setCustomerMoreOpen(true)} className="grid min-w-0 flex-1 place-items-center rounded-xl px-1 py-2 text-center text-[10px] font-black text-[#174d36]">
            <span className="mb-1 grid h-7 w-7 place-items-center rounded-md bg-[#eef5ec] text-base leading-none" aria-hidden="true">
              •••
            </span>
            <span className="truncate">More</span>
          </button>
        </nav>
      ) : (
        <nav aria-label={`${role} mobile navigation`} className="fc-scroll-row fixed bottom-2 left-1/2 z-40 flex w-[calc(100%-16px)] max-w-3xl -translate-x-1/2 snap-x gap-1 overflow-x-auto rounded-2xl border border-[#ded8c9] bg-white/96 p-2 shadow-xl backdrop-blur lg:hidden">
          {headerLinks.map(([label, href, icon]) => (
            <Link key={href} href={href} aria-label={label} title={label} className="grid min-w-[76px] flex-1 snap-start place-items-center rounded-xl px-2 py-2 text-center text-[10px] font-bold sm:min-w-[92px] sm:text-[11px]">
              <FarmImageIcon name={icon as IconName} className="mb-1 h-7 w-7 rounded-md" fallbackClassName="mb-1 h-5 w-5" /> <span aria-hidden="true">{label.split(" ")[0]}</span>
            </Link>
          ))}
        </nav>
      )}
      {role === "customer" && customerMoreOpen && (
        <div className="fixed inset-0 z-[70] sm:hidden">
          <button type="button" aria-label="Close menu" onClick={() => setCustomerMoreOpen(false)} className="absolute inset-0 h-full w-full bg-[#082d20]/55 backdrop-blur-[2px]" />
          <aside id="customer-more-tools" aria-label="More pages" className="absolute inset-x-2 bottom-2 rounded-[26px] border border-[#d7e0d4] bg-[#fffdf8] p-4 pb-3 text-[#174d36] shadow-[0_22px_60px_rgba(6,45,31,0.34)]">
            <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-[#cad2c8]" />
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#278354]">FarmConnect</p>
                <h2 className="mt-1 text-xl font-black">More tools</h2>
              </div>
              <button type="button" aria-label="Close menu" onClick={() => setCustomerMoreOpen(false)} className="grid h-9 w-9 place-items-center rounded-full bg-[#edf2e9] text-xl font-medium text-[#174d36]">
                ×
              </button>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {customerMoreLinks.map(([label, href, icon]) => (
                <Link key={href} href={href} onClick={() => setCustomerMoreOpen(false)} className="relative grid min-h-[84px] place-items-center rounded-2xl border border-[#dde5da] bg-white px-2 py-3 text-center shadow-sm">
                  <FarmImageIcon name={icon as IconName} className="h-10 w-10 rounded-xl object-contain" fallbackClassName="h-6 w-6" />
                  {label === "Inbox" && inboxCount > 0 && <span className="absolute right-2 top-2 grid min-h-5 min-w-5 place-items-center rounded-full bg-red-600 px-1 text-[9px] font-black text-white">{inboxCount > 9 ? "9+" : inboxCount}</span>}
                  <span className="mt-1 text-[11px] font-black">{label}</span>
                </Link>
              ))}
            </div>
            <button type="button" onClick={logoutCustomer} className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 text-sm font-black text-red-700">
              <Icon name="logout" className="h-4 w-4" /> Logout safely
            </button>
          </aside>
        </div>
      )}
    </main>
  );
}

function TopIcon({ href, name, label, imageSrc, badge = 0 }: { href: string; name: IconName; label: string; imageSrc?: string; badge?: number }) {
  return (
    <Link href={href} title={label} aria-label={label} className="relative flex h-10 items-center gap-2 rounded-full border border-white/40 bg-white/92 px-2.5 text-sm font-black text-[#075c3a] shadow-sm transition hover:-translate-y-0.5 hover:bg-[#fff4a3] hover:shadow-md sm:h-11 sm:px-3">
      <FarmImageIcon name={name} imageSrc={imageSrc} className="h-6 w-6 rounded-md sm:h-7 sm:w-7" />
      {badge > 0 && <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-black text-white shadow">{badge > 9 ? "9+" : badge}</span>}
      <span className="hidden xl:inline">{label}</span>
    </Link>
  );
}

function KaFarm({ children, tone = "info" }: { children: React.ReactNode; tone?: "info" | "warn" | "good" }) {
  const color = tone === "warn" ? "border-amber-300 bg-amber-50" : tone === "good" ? "border-emerald-300 bg-emerald-50" : "border-[#d7e4d5] bg-white";
  return (
    <div className={"flex gap-3 rounded-2xl border p-3 shadow-sm sm:p-4 " + color}>
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#1f6b45] text-white sm:h-11 sm:w-11">
        <Icon name="support" />
      </div>
      <div>
        <b>Ka-Farm says</b>
        <div className="mt-1 text-sm leading-6 text-[#516157]">{children}</div>
      </div>
    </div>
  );
}

function Card({ children, className = "", id }: { children: React.ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={"min-w-0 rounded-2xl border border-[#e3ded0] bg-white p-4 shadow-sm sm:p-5 " + className}>
      {children}
    </section>
  );
}

function PageTitle({ title, text, icon }: { title: string; text: string; icon: IconName }) {
  const chrome = titleIconChrome[icon] || titleIconChrome.home!;
  return (
    <div className="mb-5">
      <div className="flex w-full max-w-4xl items-center gap-3 rounded-2xl border-2 border-[#ffd43b]/85 bg-gradient-to-r from-white/92 via-[#f7ffe9]/88 to-[#e8f3ff]/88 px-3 py-3 shadow-[0_18px_45px_rgba(7,92,58,0.22)] backdrop-blur-md ring-2 ring-[#0b6fba]/18 sm:gap-5 sm:rounded-[28px] sm:px-4">
        <div
          style={{
            background: chrome.bg,
            boxShadow: chrome.shadow,
            borderColor: chrome.ring,
          }}
          className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl border-2 p-0.5 ring-2 ring-white/80 sm:h-20 sm:w-20 sm:rounded-[24px]"
        >
          <FarmImageIcon name={icon} className="h-12 w-12 scale-110 rounded-xl object-cover contrast-125 saturate-150 drop-shadow-[0_6px_10px_rgba(0,0,0,0.22)] sm:h-[4.7rem] sm:w-[4.7rem] sm:scale-125 sm:rounded-[20px]" fallbackClassName="h-8 w-8 text-[#1f6b45] sm:h-10 sm:w-10" />
        </div>
        <div className="min-w-0 pr-2">
          <h1 className="break-words text-2xl font-black leading-tight text-[#063f2a] sm:text-3xl md:text-5xl">{title}</h1>
          <p className="mt-1 max-w-2xl text-xs font-black leading-4 text-[#0b4f78] sm:text-sm sm:leading-5 md:text-base">{text}</p>
        </div>
      </div>
    </div>
  );
}

function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "good" | "warn" | "bad" | "neutral" }) {
  const c = tone === "good" ? "bg-emerald-100 text-emerald-800" : tone === "warn" ? "bg-amber-100 text-amber-800" : tone === "bad" ? "bg-red-100 text-red-800" : "bg-slate-100 text-slate-700";
  return <span className={"rounded-full px-3 py-1 text-xs font-black " + c}>{children}</span>;
}

type CustomerDashboardProfile = {
  display_name?: string | null;
  full_name?: string | null;
  wallet_balance?: number | string | null;
  kyc_status?: string | null;
  verification_status?: string | null;
};
type CustomerDashboardAnimal = {
  id: string;
  animal_name?: string | null;
  animal_code?: string | null;
  status?: string | null;
  acquired_from?: string | null;
  acquired_at?: string | null;
  source_product_id?: string | null;
  source_product_name?: string | null;
  breed_snapshot?: string | null;
  bloodline_snapshot?: string | null;
  sale_status?: string | null;
  approved_sale_price?: number | string | null;
  ownership_metadata?: Record<string, unknown> | null;
};
type CustomerDashboardRequest = {
  id?: string;
  status?: string | null;
  review_status?: string | null;
  amount?: number | string | null;
  amount_expected?: number | string | null;
  created_at?: string | null;
};
type CustomerDashboardTransaction = CustomerDashboardRequest & {
  title?: string | null;
  transaction_type?: string | null;
  type?: string | null;
  amount_value?: number | string | null;
};
type CustomerDashboardInbox = {
  id: string;
  created_at?: string | null;
  title?: string | null;
  subject?: string | null;
  message?: string | null;
  body?: string | null;
  description?: string | null;
};
type CustomerDashboardState = {
  loadedAt: number;
  profile: CustomerDashboardProfile | null;
  roosters: CustomerDashboardAnimal[];
  inventory: Record<string, unknown>[];
  careRequests: CustomerDashboardRequest[];
  payments: CustomerDashboardRequest[];
  transactions: CustomerDashboardTransaction[];
  inbox: CustomerDashboardInbox[];
  careLogs: CareLogRecord[];
  careOverviews: CustomerRoosterCareOverview[];
};
type CustomerDashboardIconName = "bird" | "feather" | "shopping-cart" | "triangle-alert" | "camera" | "wallet-cards" | "clipboard-list" | "image" | "activity" | "bell";
const customerDashboardIconPath: Record<CustomerDashboardIconName, string> = {
  bird: "/farmconnect/dashboard-icons/bird.svg",
  feather: "/farmconnect/dashboard-icons/feather.svg",
  "shopping-cart": "/farmconnect/dashboard-icons/shopping-cart.svg",
  "triangle-alert": "/farmconnect/dashboard-icons/triangle-alert.svg",
  camera: "/farmconnect/dashboard-icons/camera.svg",
  "wallet-cards": "/farmconnect/dashboard-icons/wallet-cards.svg",
  "clipboard-list": "/farmconnect/dashboard-icons/clipboard-list.svg",
  image: "/farmconnect/dashboard-icons/image.svg",
  activity: "/farmconnect/dashboard-icons/activity.svg",
  bell: "/farmconnect/dashboard-icons/bell.svg",
};
function CustomerDashboardIcon({ name, className = "h-5 w-5" }: { name: CustomerDashboardIconName; className?: string }) {
  const mask = `url(${customerDashboardIconPath[name]})`;
  return (
    <span
      aria-hidden="true"
      className={`inline-block shrink-0 bg-current ${className}`}
      style={{
        WebkitMaskImage: mask,
        maskImage: mask,
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
        WebkitMaskSize: "contain",
        maskSize: "contain",
      }}
    />
  );
}

export function CustomerHome() {
  const [greeting, setGreeting] = useState("Welcome back");
  const [loadNote, setLoadNote] = useState("Checking live farm records");
  const [dashboard, setDashboard] = useState<CustomerDashboardState>({
    loadedAt: 0,
    profile: null,
    roosters: [],
    inventory: [],
    careRequests: [],
    payments: [],
    transactions: [],
    inbox: [],
    careLogs: [],
    careOverviews: [],
  });

  useEffect(() => {
    let mounted = true;
    const loadDashboard = async () => {
      const hour = new Date().getHours();
      setGreeting(hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening");
      setLoadNote("Checking live farm records");
      try {
        const profile = await getCurrentProfile();
        if (!profile || !mounted) return;
        const results = await Promise.allSettled([getCustomerOwnedRoosters(), getCustomerInventoryItems(), getCustomerCareRequests(), getCustomerManualPaymentRequests(), getWalletTransactions(profile.id), getInboxItems(profile.id), getCareLogRecords(), getCustomerRoosterCareOverviews()]);
        if (!mounted) return;
        const rows = <T,>(index: number) => (results[index].status === "fulfilled" ? (results[index].value as T[]) : []);
        setDashboard({
          loadedAt: Date.now(),
          profile: profile as CustomerDashboardProfile,
          roosters: rows<CustomerDashboardAnimal>(0),
          inventory: rows<Record<string, unknown>>(1),
          careRequests: rows<CustomerDashboardRequest>(2),
          payments: rows<CustomerDashboardRequest>(3),
          transactions: rows<CustomerDashboardTransaction>(4),
          inbox: rows<CustomerDashboardInbox>(5),
          careLogs: rows<CareLogRecord>(6),
          careOverviews: rows<CustomerRoosterCareOverview>(7),
        });
        const failed = results.filter((result) => result.status === "rejected").length;
        setLoadNote(failed ? `${failed} record source${failed === 1 ? "" : "s"} need refresh` : "Live records updated");
      } catch {
        if (mounted) setLoadNote("Live records could not refresh");
      }
    };
    void loadDashboard();
    const onFocus = () => void loadDashboard();
    window.addEventListener("focus", onFocus);
    return () => {
      mounted = false;
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  const profile = dashboard.profile || {};
  const ownedRoosters = (dashboard.roosters || []).filter(isRealOwnedAnimal);
  const featured = ownedRoosters[0] || null;
  const featureMeta = (featured?.ownership_metadata || {}) as Record<string, string | number | null | undefined>;
  const careLogs = dashboard.careLogs || [];
  const careRequests = dashboard.careRequests || [];
  const careOverviews = dashboard.careOverviews || [];
  const payments = dashboard.payments || [];
  const transactions = dashboard.transactions || [];
  const inbox = dashboard.inbox || [];
  const normalizedStatus = (row: CustomerDashboardRequest) => String(row.status || row.review_status || "").toLowerCase();
  const pendingStatuses = ["pending", "open", "for_review", "needs_review", "needs_info", "awaiting_payment", "submitted"];
  const approvedStatuses = ["approved", "paid", "assigned", "active", "in_progress"];
  const completedStatuses = ["completed", "released", "fulfilled", "done"];
  const allRequests = [...careRequests, ...payments];
  const requestCount = (statuses: string[]) => allRequests.filter((row) => statuses.includes(normalizedStatus(row))).length;
  const paidCarePlans = careOverviews.filter((overview) => overview.paid).length;
  const selfGuidedRoosters = careOverviews.filter((overview) => !overview.paid).length;
  const availableBalance = Number(profile.wallet_balance || 0);
  const approvedEarnings = transactions.reduce((sum: number, row) => {
    const status = normalizedStatus(row);
    const amount = Number(row.amount || row.amount_value || 0);
    return amount > 0 && (!status || completedStatuses.concat("approved").includes(status)) ? sum + amount : sum;
  }, 0);
  const pendingFunds = payments.filter((row) => pendingStatuses.includes(normalizedStatus(row))).reduce((sum: number, row) => sum + Number(row.amount_expected || row.amount || 0), 0);
  const kycReady = ["approved", "verified"].includes(String(profile.kyc_status || profile.verification_status || "").toLowerCase());
  const displayName = profile.display_name || profile.full_name || "Customer";
  const acquiredAt = featured?.acquired_at ? new Date(featured.acquired_at) : null;
  const ageDays = acquiredAt && dashboard.loadedAt && !Number.isNaN(acquiredAt.getTime()) ? Math.max(0, Math.floor((dashboard.loadedAt - acquiredAt.getTime()) / 86400000)) : null;
  const featureLogs = featured ? careLogs.filter((log) => log.rooster === featured.animal_name) : [];
  const featuredPhoto = String(featureMeta.image_url || featureLogs.find((log) => /^https?:\/\//i.test(log.image))?.image || (featured ? "/farmconnect/roosters/fc-stage-1-chick-base.jpg" : ""));
  const growthDay = featured ? Math.min(180, Math.max(1, ageDays ?? 1)) : 0;
  const growthProgress = featured ? Number(((growthDay / 180) * 100).toFixed(2)) : 0;
  const insightOverview = careOverviews.find((overview) => !overview.paid) || careOverviews[0] || null;
  const insightRooster = insightOverview ? ownedRoosters.find((row) => row.id === insightOverview.customerAnimalId) : null;
  const insightText = insightOverview
    ? `${insightRooster?.animal_name || "Your rooster"}: Day ${insightOverview.catalogDay} — ${insightOverview.missionTitle}. ${insightOverview.paid ? "Its assigned caretaker handles today's automatic mission." : "Open Farm Requests if you want the farm to perform today's care."}`
    : ownedRoosters.length
      ? "Today's premium care mission is still loading."
      : "Your first approved rooster will unlock a daily KaFarm care mission.";
  const recentActivity = [
    ...inbox.map((row) => ({
      id: `inbox-${row.id}`,
      at: row.created_at,
      title: row.title || row.subject || "Inbox update",
      text: row.message || row.body || row.description || "Open Inbox to review this update.",
      href: "/customer/inbox",
    })),
    ...transactions.map((row) => ({
      id: `wallet-${row.id}`,
      at: row.created_at,
      title: row.title || String(row.transaction_type || row.type || "Wallet activity").replaceAll("_", " "),
      text: `${Number(row.amount || 0) >= 0 ? "+" : ""}${peso(Number(row.amount || 0))}`,
      href: "/customer/wallet",
    })),
  ]
    .sort((a, b) => new Date(b.at || 0).getTime() - new Date(a.at || 0).getTime())
    .slice(0, 3);
  const panel = "rounded-xl border border-amber-300/55 bg-[#0b2f24]/90 text-white shadow-[0_12px_28px_rgba(0,0,0,0.24)] backdrop-blur-md";
  const linkButton = "flex min-h-10 items-center justify-between rounded-lg border border-amber-300/70 px-4 py-2 text-sm font-black text-amber-200 transition hover:bg-amber-300/15";

  return (
    <Shell role="customer" title="Customer App">
      <section className="fc-customer-phone-dashboard mx-auto hidden max-w-md space-y-3">
        <div className="rounded-[24px] border border-amber-300/60 bg-[#0c4934]/95 p-4 text-white shadow-xl backdrop-blur">
          <div className="flex items-center justify-between gap-2 text-[10px] font-black">
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-950/35 px-3 py-2">
              <span className="h-2 w-2 rounded-full bg-emerald-300" />
              {loadNote}
            </span>
            <span className="text-white/70">{dashboard.loadedAt ? `Updated ${new Date(dashboard.loadedAt).toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" })}` : "Waiting"}</span>
          </div>
          <p className="mt-4 text-xs font-black text-amber-200">{greeting},</p>
          <h1 className="mt-1 text-3xl font-black leading-tight">{displayName}</h1>
          <p className="mt-1 text-xs font-bold text-white/70">Here&apos;s how your farm is doing today.</p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {[
            ["bird", "Total Roosters", ownedRoosters.length, "Owned assets"],
            ["activity", "Today's Missions", careOverviews.length, "One per rooster"],
            ["clipboard-list", "Paid Care Plans", paidCarePlans, "Caretaker automated"],
            ["bell", "Self-Guided", selfGuidedRoosters, "KaFarm daily guide"],
          ].map(([icon, label, value, note]) => (
            <div key={String(label)} className="min-h-[96px] rounded-[20px] border border-white/80 bg-white/94 p-3 text-[#163c2d] shadow-lg backdrop-blur">
              <div className="flex items-start gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-50 text-[#197044]">
                  <CustomerDashboardIcon name={icon as CustomerDashboardIconName} className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-[9px] font-black uppercase text-[#63746a]">{label}</p>
                  <b className="block text-2xl leading-none">{value}</b>
                  <small className="mt-2 block text-[10px] font-bold text-[#708078]">{note}</small>
                </div>
              </div>
            </div>
          ))}
        </div>

        <section className="overflow-hidden rounded-[24px] border border-white/80 bg-white/96 p-4 text-[#163c2d] shadow-xl backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase text-[#25724d]">Featured Rooster</p>
              <h2 className="mt-1 text-2xl font-black">{featured?.animal_name || "No rooster yet"}</h2>
            </div>
            {featured && <span className="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black text-[#197044]">Growing</span>}
          </div>
          {featured ? (
            <>
              <div className="relative mt-3 overflow-hidden rounded-[20px]">
                <img src={featuredPhoto} alt={featured.animal_name || "Featured rooster"} className="h-48 w-full object-cover" />
                <span className="absolute bottom-3 left-3 rounded-full bg-[#14613f] px-3 py-2 text-[10px] font-black text-white">Ownership verified</span>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[9px] font-black uppercase text-[#708078]">FarmConnect ID</p>
                  <b className="text-sm text-[#167048]">{featured.animal_code || "Tag pending"}</b>
                </div>
                <span className="rounded-full bg-[#f5f2e8] px-3 py-2 text-[10px] font-black">{String(featureMeta.stage || "Starter Chick")}</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {[
                  ["Age", ageDays == null ? "Not recorded" : `${ageDays} days owned`],
                  ["Weight", featureMeta.weight || featureMeta.latest_weight || "Not recorded"],
                  ["Breed", featured.breed_snapshot || featured.bloodline_snapshot || "Recorded breed"],
                  ["Caretaker", featureMeta.caretaker_name || "Not assigned"],
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded-2xl bg-[#f6f5ee] p-3">
                    <p className="text-[9px] font-black uppercase text-[#708078]">{label}</p>
                    <b className="mt-1 block text-xs">{String(value)}</b>
                  </div>
                ))}
              </div>
              <div className="mt-3">
                <div className="flex justify-between text-[10px] font-black">
                  <span>180-Day Growth Progress</span>
                  <span>Day {growthDay} of 180 · {growthProgress}%</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#dfe8e1]">
                  <div className="h-full rounded-full bg-[#1d7650]" style={{ width: `${growthProgress}%` }} />
                </div>
              </div>
              <Link href="/customer/roosters" className="mt-4 flex min-h-11 items-center justify-between rounded-xl bg-[#145f3e] px-4 text-sm font-black text-white">
                View My Roosters <span>&gt;</span>
              </Link>
            </>
          ) : (
            <div className="mt-3 rounded-2xl bg-[#f6f5ee] p-6 text-center">
              <p className="text-sm font-bold text-[#708078]">Approved rooster purchases will appear here.</p>
              <Link href="/customer/farm-buy" className="mt-4 inline-flex rounded-xl bg-[#145f3e] px-4 py-3 text-sm font-black text-white">
                Open Farm Buy
              </Link>
            </div>
          )}
        </section>

        <div className="grid gap-3">
          <section className="rounded-[22px] bg-white/96 p-4 text-[#163c2d] shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase text-[#708078]">Farm Wallet</p>
                <h2 className="mt-1 text-3xl font-black">{peso(availableBalance)}</h2>
              </div>
              <CustomerDashboardIcon name="wallet-cards" className="h-8 w-8 text-[#197044]" />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-bold">
              <span className="rounded-xl bg-[#f6f5ee] p-3">
                Approved
                <br />
                <b>{peso(approvedEarnings)}</b>
              </span>
              <span className="rounded-xl bg-[#f6f5ee] p-3">
                Pending
                <br />
                <b>{peso(pendingFunds)}</b>
              </span>
            </div>
            <Link href="/customer/wallet" className="mt-3 flex items-center justify-between text-sm font-black text-[#197044]">
              View Wallet <span>&gt;</span>
            </Link>
          </section>
          <section className="rounded-[22px] bg-white/96 p-4 text-[#163c2d] shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase text-[#708078]">Requests</p>
                <h2 className="mt-1 text-xl font-black">{requestCount(pendingStatuses)} pending</h2>
              </div>
              <CustomerDashboardIcon name="clipboard-list" className="h-8 w-8 text-[#197044]" />
            </div>
            <div className="mt-3 flex gap-2 text-xs font-bold">
              <span className="flex-1 rounded-xl bg-[#f6f5ee] p-3">
                Approved
                <br />
                <b>{requestCount(approvedStatuses)}</b>
              </span>
              <span className="flex-1 rounded-xl bg-[#f6f5ee] p-3">
                Completed
                <br />
                <b>{requestCount(completedStatuses)}</b>
              </span>
            </div>
            <Link href="/customer/farm-requests" className="mt-3 flex items-center justify-between text-sm font-black text-[#197044]">
              View Requests <span>&gt;</span>
            </Link>
          </section>
          <section className="rounded-[22px] bg-white/96 p-4 text-[#163c2d] shadow-lg">
            <p className="text-[10px] font-black uppercase text-[#25724d]">Farm Timeline</p>
            <h2 className="mt-1 text-xl font-black">Growth Updates</h2>
            <div className="mt-3 space-y-2">
              {careLogs.slice(0, 3).map((log, index) => (
                <Link key={`${log.title}-phone-${index}`} href="/customer/care-logs" className="flex items-center gap-3 rounded-xl bg-[#f6f5ee] p-3">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-emerald-50 text-[#197044]">
                    <CustomerDashboardIcon name={log.type === "Photo" ? "image" : "activity"} className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <b className="block truncate text-sm">{log.title}</b>
                    <small className="block truncate text-[#708078]">
                      {log.rooster} - {log.uploaded}
                    </small>
                  </span>
                </Link>
              ))}
              {careLogs.length === 0 && <p className="rounded-xl bg-[#f6f5ee] p-4 text-xs font-bold text-[#708078]">Verified farm updates will appear here.</p>}
            </div>
          </section>
          <section className="flex items-center gap-3 rounded-[22px] bg-white/96 p-4 text-[#163c2d] shadow-lg">
            <img src="/farmconnect/icons/my-rooster.png" alt="KaFarm" className="h-12 w-12 rounded-xl bg-white object-contain" />
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase text-[#25724d]">KaFarm Insight</p>
              <p className="mt-1 text-xs font-bold text-[#708078]">{insightText}</p>
            </div>
          </section>
          <section className="rounded-[22px] bg-white/96 p-4 text-[#163c2d] shadow-lg">
            <div className="flex items-center gap-2">
              <CustomerDashboardIcon name="bell" className="h-5 w-5 text-[#197044]" />
              <h2 className="text-xl font-black">Latest Activity</h2>
            </div>
            <div className="mt-3 space-y-2">
              {recentActivity.map((activity) => (
                <Link key={`${activity.id}-phone`} href={activity.href} className="block rounded-xl bg-[#f6f5ee] p-3">
                  <b className="block truncate text-sm capitalize">{activity.title}</b>
                  <span className="mt-1 block truncate text-xs font-bold text-[#708078]">{activity.text}</span>
                </Link>
              ))}
              {recentActivity.length === 0 && <p className="rounded-xl bg-[#f6f5ee] p-4 text-xs font-bold text-[#708078]">Payments, orders, and caretaker updates will appear here.</p>}
            </div>
          </section>
          <section className="rounded-[22px] bg-white/96 p-4 text-[#163c2d] shadow-lg">
            <h2 className="text-xl font-black">Other Roosters</h2>
            <div className="fc-scroll-row mt-3 flex gap-2 overflow-x-auto pb-1">
              {ownedRoosters.slice(1).map((row) => {
                const photo = String(row.ownership_metadata?.image_url || careLogs.find((log) => log.rooster === row.animal_name && /^https?:\/\//i.test(log.image))?.image || "");
                return (
                  <Link key={`${row.id}-phone`} href="/customer/roosters" className="flex min-w-44 items-center gap-3 rounded-xl bg-[#f6f5ee] p-3">
                    {photo ? (
                      <img src={photo} alt="" className="h-12 w-12 rounded-lg object-cover" />
                    ) : (
                      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg border border-dashed border-[#aebbb1] text-[#708078]">
                        <CustomerDashboardIcon name="camera" />
                      </span>
                    )}
                    <span className="min-w-0">
                      <b className="block truncate text-sm">{row.animal_name || "Owned rooster"}</b>
                      <small className="block truncate text-[#708078]">{row.animal_code || "Tag pending"}</small>
                    </span>
                  </Link>
                );
              })}
              {ownedRoosters.length < 2 && <p className="rounded-xl bg-[#f6f5ee] p-4 text-xs font-bold text-[#708078]">No other roosters yet.</p>}
            </div>
          </section>
        </div>
      </section>

      <section className="fc-customer-dashboard fc-customer-dashboard-desktop mx-auto max-w-6xl space-y-3">
        <div className={`${panel} flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between`}>
          <div>
            <h1 className="text-2xl font-black leading-tight sm:text-3xl lg:text-4xl">
              {greeting}, {displayName}
            </h1>
            <p className="mt-1 text-sm font-bold text-white/75">Here&apos;s how your farm is doing today.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-white/75">
            <span className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-black/15 px-3 py-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              {loadNote}
            </span>
            <span>{dashboard.loadedAt ? `Updated ${new Date(dashboard.loadedAt).toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" })}` : "Waiting for records"}</span>
          </div>
        </div>

        <div className="fc-customer-summary-grid grid grid-cols-2 gap-2 lg:grid-cols-4">
          {[
            ["bird", "Total Roosters", ownedRoosters.length],
            ["activity", "Today's Missions", careOverviews.length],
            ["clipboard-list", "Paid Care Plans", paidCarePlans],
            ["bell", "Self-Guided", selfGuidedRoosters],
          ].map(([icon, label, value]) => (
            <div key={String(label)} className={`${panel} flex min-h-20 items-center gap-3 p-3 sm:p-4`}>
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-amber-300/40 text-amber-200">
                <CustomerDashboardIcon name={icon as CustomerDashboardIconName} />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-bold text-white/70 sm:text-sm">{label}</p>
                <b className="mt-1 block text-xl">{value}</b>
              </div>
            </div>
          ))}
        </div>

        <div className="fc-customer-dashboard-body grid gap-3 lg:grid-cols-[minmax(0,1.65fr)_minmax(280px,1fr)]">
          <div className="space-y-3">
            <section className={`${panel} p-4`}>
              <h2 className="text-lg font-black">Featured Rooster</h2>
              {featured ? (
                <div className="mt-3 grid gap-4 sm:grid-cols-[165px_1fr]">
                  {featuredPhoto ? (
                    <img src={featuredPhoto} alt={featured.animal_name || "Featured rooster"} className="h-44 w-full rounded-xl border border-white/25 object-cover sm:h-[165px]" />
                  ) : (
                    <div className="grid h-44 w-full place-items-center rounded-xl border border-dashed border-white/30 bg-black/10 text-center text-white/55 sm:h-[165px]">
                      <span>
                        <CustomerDashboardIcon name="camera" className="mx-auto h-10 w-10" />
                        <small className="mt-2 block font-bold">Latest verified photo</small>
                      </span>
                    </div>
                  )}
                  <div className="min-w-0">
                    <h3 className="truncate text-2xl font-black">{featured.animal_name || "Owned Rooster"}</h3>
                    <p className="mt-1 text-sm font-bold text-amber-200">{featured.animal_code || "Tag pending"}</p>
                    <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                      <span>
                        <b className="text-white/60">Age</b>
                        <strong className="mt-1 block">{ageDays == null ? "Not recorded" : `${ageDays} days owned`}</strong>
                      </span>
                      <span>
                        <b className="text-white/60">Weight</b>
                        <strong className="mt-1 block">{featureMeta.weight || featureMeta.latest_weight || "Not recorded"}</strong>
                      </span>
                      <span>
                        <b className="text-white/60">Breed</b>
                        <strong className="mt-1 block">{featured.breed_snapshot || featured.bloodline_snapshot || "Recorded breed"}</strong>
                      </span>
                      <span>
                        <b className="text-white/60">Caretaker</b>
                        <strong className="mt-1 block">{featureMeta.caretaker_name || "Not assigned"}</strong>
                      </span>
                      <span>
                        <b className="text-white/60">Health</b>
                        <strong className="mt-1 block">{featureMeta.health || "Awaiting update"}</strong>
                      </span>
                    </div>
                    <div className="mt-4">
                      <div className="flex justify-between text-xs font-bold text-white/70">
                        <span>180-Day Growth Progress</span>
                        <span>Day {growthDay} of 180 · {growthProgress}%</span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/15">
                        <div className="h-full rounded-full bg-amber-300" style={{ width: `${growthProgress}%` }} />
                      </div>
                    </div>
                    <Link href="/customer/roosters" className={`${linkButton} mt-4 ml-auto max-w-44`}>
                      View Roosters <span>›</span>
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="mt-3 grid min-h-44 place-items-center rounded-xl border border-dashed border-white/25 bg-black/10 p-6 text-center">
                  <div>
                    <CustomerDashboardIcon name="camera" className="mx-auto h-10 w-10 text-white/45" />
                    <h3 className="mt-3 text-lg font-black">No rooster selected</h3>
                    <p className="mt-1 text-sm text-white/65">Approved rooster purchases will appear here.</p>
                    <Link href="/customer/farm-buy" className="mt-4 inline-flex rounded-lg bg-amber-300 px-4 py-2 text-sm font-black text-[#173126]">
                      Open Farm Buy
                    </Link>
                  </div>
                </div>
              )}
            </section>

            <section className={`${panel} p-4`}>
              <h2 className="text-lg font-black">Growth Updates</h2>
              <div className="mt-3 space-y-2">
                {careLogs.slice(0, 4).map((log, index) => (
                  <Link key={`${log.title}-${log.uploaded}-${index}`} href="/customer/care-logs" className="flex items-start gap-3 rounded-lg bg-white/7 p-3 transition hover:bg-white/12">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-amber-300/35 text-amber-200">
                      <CustomerDashboardIcon name={log.type === "Photo" ? "image" : "activity"} className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <b className="block truncate">{log.title}</b>
                      <span className="mt-1 block text-xs text-white/65">
                        {log.rooster} · {log.uploaded} {log.time}
                      </span>
                    </span>
                  </Link>
                ))}
                {careLogs.length === 0 && <div className="grid min-h-32 place-items-center rounded-xl border border-dashed border-white/20 text-center text-sm font-bold text-white/60">Verified feeding, health, weight, and photo updates will appear here.</div>}
              </div>
            </section>

            <section className={`${panel} p-4`}>
              <h2 className="text-lg font-black">Other Roosters</h2>
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                {ownedRoosters.slice(1).map((row) => {
                  const photo = String(row.ownership_metadata?.image_url || careLogs.find((log) => log.rooster === row.animal_name && /^https?:\/\//i.test(log.image))?.image || "");
                  return (
                    <Link key={row.id} href="/customer/roosters" className="flex min-w-48 items-center gap-3 rounded-lg border border-white/15 bg-white/7 p-3">
                      {photo ? (
                        <img src={photo} alt="" className="h-12 w-12 rounded-lg object-cover" />
                      ) : (
                        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg border border-dashed border-white/25 text-white/45">
                          <CustomerDashboardIcon name="camera" />
                        </span>
                      )}
                      <span className="min-w-0">
                        <b className="block truncate">{row.animal_name || "Owned rooster"}</b>
                        <small className="block truncate text-white/60">{row.animal_code || "Tag pending"}</small>
                      </span>
                    </Link>
                  );
                })}
                {ownedRoosters.length < 2 && <p className="text-sm font-bold text-white/60">No other roosters yet.</p>}
              </div>
            </section>
          </div>

          <aside className="space-y-3">
            <section className={`${panel} p-4`}>
              <div className="flex items-center gap-2 text-amber-200">
                <CustomerDashboardIcon name="wallet-cards" />
                <h2 className="text-xl font-black text-white">Farm Wallet</h2>
              </div>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-white/70">Available Balance</span>
                  <b>{peso(availableBalance)}</b>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-white/70">Approved Earnings</span>
                  <b>{peso(approvedEarnings)}</b>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-white/70">Pending Funds</span>
                  <b>{peso(pendingFunds)}</b>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-white/70">Withdrawal Eligibility</span>
                  <b>{kycReady ? "Eligible" : "KYC required"}</b>
                </div>
              </div>
              <Link href="/customer/wallet" className={`${linkButton} mt-4`}>
                View Wallet <span>›</span>
              </Link>
            </section>

            <section className={`${panel} p-4`}>
              <div className="flex items-center gap-2 text-amber-200">
                <CustomerDashboardIcon name="clipboard-list" />
                <h2 className="text-xl font-black text-white">Requests</h2>
              </div>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-white/70">Pending</span>
                  <b>{requestCount(pendingStatuses)}</b>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/70">Approved</span>
                  <b>{requestCount(approvedStatuses)}</b>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/70">Completed</span>
                  <b>{requestCount(completedStatuses)}</b>
                </div>
              </div>
              <Link href="/customer/farm-requests" className={`${linkButton} mt-4`}>
                View Requests <span>›</span>
              </Link>
            </section>

            <section className={`${panel} flex items-center gap-3 p-4`}>
              <img src="/farmconnect/icons/my-rooster.png" alt="KaFarm" className="h-12 w-12 rounded-xl bg-white object-contain" />
              <div className="min-w-0">
                <h2 className="text-lg font-black">KaFarm Insight</h2>
                <p className="mt-1 text-sm text-white/65">{insightText}</p>
              </div>
            </section>

            <section className={`${panel} p-4`}>
              <div className="flex items-center gap-2 text-amber-200">
                <CustomerDashboardIcon name="bell" />
                <h2 className="text-xl font-black text-white">Latest Activity</h2>
              </div>
              <div className="mt-3 space-y-2">
                {recentActivity.map((activity) => (
                  <Link key={activity.id} href={activity.href} className="block rounded-lg bg-white/7 p-3 hover:bg-white/12">
                    <b className="block truncate text-sm capitalize">{activity.title}</b>
                    <span className="mt-1 block truncate text-xs text-white/60">{activity.text}</span>
                  </Link>
                ))}
                {recentActivity.length === 0 && <p className="rounded-lg border border-dashed border-white/20 p-4 text-sm font-bold text-white/60">Payments, orders, and caretaker updates will appear here.</p>}
              </div>
            </section>
          </aside>
        </div>
      </section>
    </Shell>
  );
}

export function CustomerRoostersResponsive() {
  const [phone, setPhone] = useState(false);
  const [rows, setRows] = useState<RoosterCard[]>([]);
  const [selected, setSelected] = useState<RoosterCard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const update = () => setPhone(document.documentElement.dataset.farmconnectDevice === "phone" || innerWidth < 640);
    update();
    addEventListener("resize", update);
    return () => removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([getCustomerOwnedRoosters(), getCustomerRoosterCareOverviews()])
      .then(([items, careOverviews]) => {
        if (!active) return;
        const careByAnimal = new Map(careOverviews.map((overview) => [overview.customerAnimalId, overview]));
        const mapped = items.filter(isRealOwnedAnimal).map((row, index) => {
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
            saleStatus: row.sale_status || "not_listed",
            approvedSalePrice: row.approved_sale_price == null ? null : Number(row.approved_sale_price),
            ownershipMetadata: row.ownership_metadata || {},
            careOverview: careByAnimal.get(row.id) || null,
          } as RoosterCard;
        });
        setRows(mapped);
        setSelected(mapped[0] || null);
      })
      .catch(() => {
        if (active) {
          setRows([]);
          setSelected(null);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (!phone) return <CustomerRoosters />;
  const setup = rows.filter((row) => row.caretaker === "Pending assignment").length;

  return (
    <Shell role="customer" title="My Roosters">
      <section className="mx-auto max-w-md space-y-3 pb-2">
        <div className="rounded-[24px] border border-white/80 bg-white/96 p-4 shadow-xl">
          <div className="flex items-center gap-3">
            <img src="/farmconnect/icons/my-rooster.png" alt="" className="h-16 w-16 rounded-2xl object-contain" />
            <div>
              <p className="text-[10px] font-black uppercase text-[#24724d]">Your Premium Farm Assets</p>
              <h1 className="mt-1 text-3xl font-black leading-none text-[#17382b]">My Roosters</h1>
              <p className="mt-2 text-xs font-bold leading-5 text-[#65746b]">Follow every rooster from ownership to active farm care.</p>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 divide-x divide-[#d9d8cf] rounded-[20px] border border-white/80 bg-white/95 py-4 text-center shadow-lg">
          {[
            ["Owned Assets", rows.length],
            ["In Setup", setup],
            ["Care Alerts", 0],
          ].map(([label, value]) => (
            <div key={String(label)}>
              <p className="text-[8px] font-black uppercase text-[#6c776f]">{label}</p>
              <b className="mt-1 block text-xl text-[#166844]">{value}</b>
            </div>
          ))}
        </div>
        <div>
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[10px] font-black uppercase text-amber-200">Your Collection</p>
              <h2 className="mt-1 text-lg font-black text-white">Select a rooster</h2>
            </div>
            <span className="text-[10px] font-black text-white/70">Swipe -&gt;</span>
          </div>
          <div className="fc-scroll-row mt-2 flex snap-x gap-2 overflow-x-auto pb-2">
            {rows.map((row) => (
              <button key={row.id} onClick={() => setSelected(row)} className={`flex min-w-[255px] snap-start items-center gap-3 rounded-[18px] border p-2 text-left shadow-lg ${selected?.id === row.id ? "border-amber-300 bg-emerald-50" : "border-white/80 bg-white/95"}`}>
                <img src={row.image} alt="" className="h-16 w-20 rounded-xl object-cover" />
                <span className="min-w-0 flex-1">
                  <small className="block text-[8px] font-black uppercase text-[#25724d]">Owned Rooster</small>
                  <b className="block truncate text-sm text-[#17382b]">{row.name}</b>
                  <span className="block truncate text-[10px] font-bold text-[#708078]">{row.tag}</span>
                </span>
                <span className="grid h-7 w-7 place-items-center rounded-full bg-emerald-50 text-xs font-black text-[#197044]">{selected?.id === row.id ? "OK" : ">"}</span>
              </button>
            ))}
          </div>
        </div>
        {loading && <div className="rounded-[22px] bg-white/95 p-6 text-center text-sm font-black shadow-lg">Loading your rooster records...</div>}
        {!loading && !selected && (
          <div className="rounded-[22px] bg-white/95 p-6 text-center shadow-lg">
            <h2 className="text-xl font-black">No roosters yet</h2>
            <Link href="/customer/farm-buy" className="mt-4 inline-flex rounded-xl bg-[#145f3e] px-4 py-3 text-sm font-black text-white">
              Open Farm Buy
            </Link>
          </div>
        )}
        {selected && (
          <section className="rounded-[24px] border border-white/80 bg-white/96 p-3 text-[#17382b] shadow-xl">
            <div className="relative overflow-hidden rounded-[20px]">
              <img src={selected.image} alt={selected.name} className="h-64 w-full object-cover" />
              <div className="absolute inset-x-0 top-0 flex justify-between p-3">
                <span className="rounded-full bg-[#145f3e] px-3 py-2 text-[9px] font-black text-white">Ownership verified</span>
                <span className="rounded-full bg-[#145f3e] px-3 py-2 text-[9px] font-black text-white">{selected.status}</span>
              </div>
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4 pt-16 text-white">
                <span className="rounded-full bg-amber-300 px-3 py-1 text-[9px] font-black uppercase text-[#17382b]">{selected.stage}</span>
                <h2 className="mt-3 text-3xl font-black">{selected.name}</h2>
                <p className="mt-1 text-xs font-bold text-white/75">{selected.tag}</p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {[
                ["Verified", "Ownership"],
                ["Protected", "Farm record"],
                ["Monitored", "Care status"],
              ].map(([title, caption]) => (
                <div key={title} className="rounded-xl bg-[#f5f5ef] p-2 text-center">
                  <b className="block text-[9px] text-[#166844]">{title}</b>
                  <small className="text-[8px] text-[#708078]">{caption}</small>
                </div>
              ))}
            </div>
            <div className="mt-3 rounded-2xl border border-[#dfe5dc] bg-[#f8f8f2] p-3">
              <div className="flex justify-between">
                <div>
                  <p className="text-[9px] font-black uppercase text-[#25724d]">Farm Setup Journey</p>
                  <b className="mt-1 block text-sm">Waiting for farm assignment</b>
                </div>
                <b className="text-sm text-[#166844]">42%</b>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#dce5dd]">
                <div className="h-full w-[42%] rounded-full bg-[#1c704b]" />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-1 text-center text-[9px] font-bold">
                <span className="rounded-lg bg-emerald-50 p-2">
                  OK
                  <br />
                  Purchased
                </span>
                <span className="rounded-lg bg-amber-50 p-2">
                  2<br />
                  Assignment
                </span>
                <span className="rounded-lg bg-[#eef3f8] p-2">
                  3<br />
                  Farm care
                </span>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Info label="Health" value="New & Healthy" />
              <Info label="Est. Value" value={selected.value} />
              <Info label="Bloodline" value={selected.breed} />
              <Info label="Pen" value={selected.pen} />
              <Info label="Caretaker" value={selected.caretaker} />
              <Info label="Care Plan" value={`${carePlanBox(selected.careOverview).title} · ${carePlanBox(selected.careOverview).detail}`} />
            </div>
            <div className="mt-3 rounded-2xl bg-[#f5f5ef] p-3">
              <p className="text-[9px] font-black uppercase text-[#25724d]">Latest Care Update</p>
              <b className="mt-1 block text-sm">New purchase recorded</b>
              <p className="mt-1 text-[10px] font-bold leading-5 text-[#708078]">Your receipt is verified. Admin farm assignment is the next step.</p>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <Link href="/customer/farm-requests" className="rounded-xl bg-[#145f3e] px-2 py-3 text-center text-[10px] font-black text-white">
                Request Care
              </Link>
              <Link href="/customer/care-logs" className="rounded-xl bg-[#f0ecdf] px-2 py-3 text-center text-[10px] font-black">
                Care Logs
              </Link>
              <Link href={`/customer/sell-rooster?id=${selected.id}`} className="rounded-xl bg-amber-300 px-2 py-3 text-center text-[10px] font-black">
                Sell
              </Link>
            </div>
          </section>
        )}
      </section>
    </Shell>
  );
}

export function CustomerRoosters() {
  const [ownedRoosters, setOwnedRoosters] = useState<RoosterCard[]>([]);
  const [selected, setSelected] = useState<RoosterCard | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    Promise.all([getCustomerOwnedRoosters(), getCustomerRoosterCareOverviews()])
      .then(([rows, careOverviews]) => {
        if (!mounted) return;
        const careByAnimal = new Map(careOverviews.map((overview) => [overview.customerAnimalId, overview]));
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
            saleStatus: row.sale_status || "not_listed",
            approvedSalePrice: row.approved_sale_price == null ? null : Number(row.approved_sale_price),
            ownershipMetadata: row.ownership_metadata || {},
            careOverview: careByAnimal.get(row.id) || null,
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
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <Shell role="customer" title="My Roosters">
      <PageTitle title="My Roosters" text="Tap a rooster to view ownership details, care status, value, and next actions." icon="rooster" />
      <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
        <Card>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-black">Rooster List</h2>
            <Badge>{ownedRoosters.length}</Badge>
          </div>
          <div className="mt-4 max-h-[620px] space-y-3 overflow-y-auto pr-2">
            {isLoading && <div className="rounded-2xl border border-[#ece6d8] bg-[#fffdf7] p-4 text-sm font-bold text-[#667267]">Loading your rooster records...</div>}
            {!isLoading && ownedRoosters.length === 0 && (
              <div className="rounded-2xl border border-dashed border-[#d8d0bd] bg-[#fffdf7] p-5 text-center">
                <h3 className="text-lg font-black">No roosters yet</h3>
                <p className="mt-2 text-sm font-bold text-[#667267]">Approved Farm Buy purchases or admin-assigned roosters will appear here.</p>
                <Link href="/customer/farm-buy" className="mt-4 inline-flex rounded-xl bg-[#1f6b45] px-4 py-3 font-black text-white">
                  Go to Farm Buy
                </Link>
              </div>
            )}
            {ownedRoosters.map((r) => (
              <button key={r.id} onClick={() => setSelected(r)} className={"flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition " + (selected?.id === r.id ? "border-[#1f6b45] bg-emerald-50 shadow-sm" : "border-[#ece6d8] bg-[#fffdf7] hover:border-[#cfc7b7]")}>
                <RoosterPhoto src={r.image} alt={r.name} size="thumb" />
                <div className="min-w-0 flex-1">
                  <b className="block truncate">{r.name}</b>
                  <p className="truncate text-sm font-black text-[#1f6b45]">{r.breed}</p>
                  <p className="truncate text-sm font-bold text-[#667267]">
                    {r.tag} - {r.stage}
                  </p>
                  <p className="mt-1 truncate text-xs text-[#667267]">{r.pen}</p>
                </div>
                <Badge tone={r.health === "Excellent" ? "good" : "neutral"}>{r.health}</Badge>
              </button>
            ))}
          </div>
        </Card>
        <Card>
          {selected ? (
            <div className="grid gap-5 xl:grid-cols-[minmax(300px,0.95fr)_1fr]">
              <RoosterPhoto src={selected.image} alt={selected.name} size="hero" />
              <div className="flex min-w-0 flex-col">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-black uppercase text-[#667267]">Owned Rooster</p>
                    <h2 className="mt-1 text-4xl font-black leading-tight">{selected.name}</h2>
                    <p className="mt-1 text-lg font-black text-[#1f6b45]">{selected.breed}</p>
                    <p className="mt-2 font-bold text-[#667267]">
                      {selected.tag} - {selected.stage}
                    </p>
                  </div>
                  <Badge tone={selected.status === "For Sale" ? "warn" : "good"}>{selected.status}</Badge>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <Info label="Bloodline / Breed" value={selected.breed} />
                  <Info label="Estimated Value" value={selected.value} />
                  <Info label="Health" value={selected.health} />
                  <Info label="Pen" value={selected.pen} />
                  <Info label="Caretaker" value={selected.caretaker} />
                  <Info label="Care Plan" value={`${carePlanBox(selected.careOverview).title} · ${carePlanBox(selected.careOverview).detail}`} />
                </div>
                <div className="mt-5 rounded-2xl border border-[#e3ded0] bg-[#fffdf7] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase text-[#667267]">Latest Care Status</p>
                      <h3 className="mt-1 text-xl font-black">{selected.health === "New" ? "New purchase" : "Verified today"}</h3>
                    </div>
                    <Badge tone="good">{selected.health === "New" ? "Needs farm assignment" : "Good condition"}</Badge>
                  </div>
                  <div className="mt-3 grid gap-2 text-sm font-bold text-[#667267] sm:grid-cols-3">
                    <span>Source: Farm Buy</span>
                    <span>Proof: Receipt in Inbox</span>
                    <span>Next: Admin assignment</span>
                  </div>
                </div>
                <div className="mt-auto flex flex-wrap gap-3 pt-5">
                  <Link href="/customer/farm-requests" className="rounded-xl bg-[#1f6b45] px-4 py-3 font-black text-white">
                    Request Care
                  </Link>
                  <Link href="/customer/care-logs" className="rounded-xl bg-[#eee8d9] px-4 py-3 font-black">
                    Care Logs
                  </Link>
                  <Link href={`/customer/sell-rooster?id=${selected.id}`} className="rounded-xl bg-amber-300 px-4 py-3 font-black">
                    Sell
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid min-h-[420px] place-items-center rounded-3xl border border-dashed border-[#d8d0bd] bg-[#fffdf7] p-8 text-center">
              <div>
                <RoosterPhoto src="/farmconnect/icons/my-rooster.png" alt="" size="thumb" />
                <h2 className="mt-4 text-3xl font-black">Your rooster record is empty</h2>
                <p className="mx-auto mt-3 max-w-md font-bold text-[#667267]">Once admin approves a Farm Buy payment or assigns a rooster to your account, the rooster card, breed, care status, and value will show here.</p>
                <Link href="/customer/farm-buy" className="mt-5 inline-flex rounded-xl bg-[#1f6b45] px-5 py-3 font-black text-white">
                  Buy First Rooster
                </Link>
              </div>
            </div>
          )}
        </Card>
      </div>
    </Shell>
  );
}

export function CustomerSellRooster() {
  const search = useSearchParams();
  const router = useRouter();
  const [animal, setAnimal] = useState<any>(null);
  const [sale, setSale] = useState<any>(null);
  const [note, setNote] = useState("");
  const [statusNote, setStatusNote] = useState("Loading rooster sale record...");
  const [busy, setBusy] = useState(false);
  const [renderedAt] = useState(() => Date.now());
  const animalId = search.get("id") || "";

  async function load() {
    try {
      const rows = await getCustomerOwnedRoosters();
      const selectedAnimal = rows.find((row: any) => row.id === animalId) || rows[0] || null;
      setAnimal(selectedAnimal);
      if (!selectedAnimal) {
        setSale(null);
        setStatusNote("No owned rooster was found for this sale request.");
        return;
      }
      const activeSale = await getCustomerRoosterSaleRequest(selectedAnimal.id);
      setSale(activeSale);
      const statusMessages: Record<string, string> = {
        price_requested: "Price inspection requested. Waiting for admin to assign a caretaker.",
        price_assigned: "A caretaker is checking the rooster price.",
        price_submitted: "Caretaker price proof submitted. Waiting for admin verification.",
        price_backjob: "Admin returned the price inspection to the caretaker for correction.",
        price_ready: "The approved price is ready. Review it below, then press Sell to send the final request.",
        sale_requested: "Sell request received. It is now waiting in the admin Sell Requests queue.",
        sale_rejected: "Admin returned the sell request. Review the note and submit again when ready.",
        release_pending_assignment: "Sale approved. Waiting for admin to assign the final caretaker release task.",
        release_assigned: "Final release task assigned to a caretaker.",
        release_submitted: "Caretaker submitted final release confirmation. Waiting for admin approval.",
        release_backjob: "Final release confirmation was returned to the caretaker for correction.",
      };
      setStatusNote(activeSale ? statusMessages[String(activeSale.status || "")] || "The price inspection and sale release are tracked step by step." : "Request a caretaker price inspection first. The final Sell button unlocks only after admin approval.");
    } catch (error) {
      setStatusNote(`Sale record could not load: ${readableAppError(error) || "Check login and SQL 040."}`);
    }
  }

  useEffect(() => {
    void load();
  }, [animalId]);

  async function requestPrice() {
    if (!animal || busy) return;
    setBusy(true);
    try {
      await requestRoosterSalePrice(animal.id, note);
      setStatusNote("Price inspection requested. Admin must assign the special task to a caretaker.");
      await load();
    } catch (error) {
      setStatusNote(`Price request failed: ${readableAppError(error) || "Check SQL 040 and customer ownership."}`);
    } finally {
      setBusy(false);
    }
  }

  async function confirmSaleRequest() {
    if (!sale || busy) return;
    setBusy(true);
    try {
      await confirmRoosterSale(sale.id, note);
      setStatusNote("Sale request sent to admin. The approved price is locked while admin reviews the release.");
      await load();
    } catch (error) {
      setStatusNote(`Sell request failed: ${readableAppError(error) || "Check SQL 040 and approved price."}`);
    } finally {
      setBusy(false);
    }
  }

  const meta = animal?.ownership_metadata || {};
  const breed = animal?.breed_snapshot || animal?.bloodline_snapshot || "Recorded breed";
  const acquired = animal?.acquired_at ? new Date(animal.acquired_at) : null;
  const age = acquired && !Number.isNaN(acquired.getTime()) ? `${Math.max(0, Math.floor((renderedAt - acquired.getTime()) / 86400000))} days in your account` : String(meta.age || "Not recorded");
  const weight = String(meta.weight || meta.latest_weight || "Pending caretaker inspection");
  const approvedPrice = Number(sale?.approved_sale_price || animal?.approved_sale_price || 0);
  const currentStatus = String(sale?.status || "not_requested");
  const canConfirm = ["price_ready", "sale_rejected"].includes(currentStatus) && approvedPrice > 0;
  const waiting = sale && !canConfirm;
  const buttonLabel = !sale ? "Request Price Inspection" : canConfirm ? `Sell for ${peso(approvedPrice)}` : currentStatus === "completed" ? "Sale Completed" : "Waiting for Farm Review";

  return (
    <Shell role="customer" title="Sell Rooster">
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={() => router.push("/customer/roosters")} className="rounded-xl bg-white px-4 py-3 font-black shadow-sm">
          Back
        </button>
        <Badge tone={canConfirm ? "good" : waiting ? "warn" : "neutral"}>{currentStatus.replaceAll("_", " ")}</Badge>
      </div>
      <div className="mx-auto mt-5 grid max-w-5xl gap-5 lg:grid-cols-[minmax(320px,0.9fr)_1.1fr]">
        <Card className="overflow-hidden p-0">
          <div className="bg-[#eef2ea] p-5">
            <img src="/farmconnect/roosters/fc-stage-4-adult-rooster-base.jpg" alt={animal?.animal_name || "Owned rooster"} className="aspect-square w-full rounded-2xl bg-white object-cover" />
          </div>
          <div className="border-t border-[#ded8c9] p-5">
            <p className="text-xs font-black uppercase text-[#667267]">Owned Rooster</p>
            <h1 className="mt-1 text-3xl font-black">{animal?.animal_name || "Select a rooster"}</h1>
            <p className="mt-1 font-black text-[#1f6b45]">{animal?.animal_code || "No serial"}</p>
          </div>
        </Card>
        <Card>
          <h2 className="text-2xl font-black">Sale Details</h2>
          <p className="mt-1 text-sm font-bold text-[#667267]">The approved price comes from caretaker inspection and admin verification.</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Info label="Name" value={animal?.animal_name || "Not recorded"} />
            <Info label="Breed" value={breed} />
            <Info label="Weight" value={weight} />
            <Info label="Age" value={age} />
            <Info label="Serial ID" value={animal?.animal_code || "Not tagged"} />
            <Info label="Approved Price" value={approvedPrice > 0 ? peso(approvedPrice) : "Waiting for inspection"} />
          </div>
          <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional note for caretaker/admin..." className="mt-5 h-28 w-full resize-none rounded-2xl border border-[#ded8c9] bg-[#fffdf7] p-4 text-sm font-bold" />
          <div className="mt-4 rounded-2xl bg-[#f4efe4] p-4 text-sm font-bold leading-6 text-[#667267]">{statusNote}</div>
          <button type="button" disabled={!animal || busy || Boolean(sale && !canConfirm)} onClick={() => (canConfirm ? void confirmSaleRequest() : void requestPrice())} className="mt-5 w-full rounded-2xl bg-amber-300 px-5 py-4 text-lg font-black disabled:cursor-not-allowed disabled:bg-[#c9c3b6]">
            {busy ? "Saving..." : buttonLabel}
          </button>
          {canConfirm && <p className="mt-3 text-center text-xs font-bold text-[#667267]">After confirmation, admin creates the final caretaker release task. Wallet credit happens only after final proof approval.</p>}
        </Card>
      </div>
    </Shell>
  );
}
export function CareLogsPage() {
  const [selected, setSelected] = useState<RoosterCard | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");
  const [liveLogs, setLiveLogs] = useState<CareLogRecord[]>([]);
  const [localProofLogs, setLocalProofLogs] = useState<CareLogRecord[]>([]);
  useEffect(() => {
    setLocalProofLogs(getSubmittedTaskProofs().map(submittedProofToCareLog));
    let mounted = true;
    getCareLogRecords()
      .then((rows) => {
        if (!mounted || rows.length === 0) return;
        setLiveLogs(rows);
        setSelected(
          (current) =>
            current || {
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
            },
        );
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, []);
  const logs = [...localProofLogs, ...liveLogs];
  const roosterChoices = [
    ...Array.from(new Set(logs.map((log) => log.rooster))).map((name) => ({
      id: `live-${name}`,
      name,
      breed: "Recorded Bloodline",
      tag: "Live record",
      stage: "In Care",
      status: "In Care",
      health: "Good",
      value: "Recorded",
      image: logs.find((log) => log.rooster === name)?.image || "/farmconnect/roosters/fc-stage-3-young-rooster-base.jpg",
      pen: "Care logs",
      caretaker: logs.find((log) => log.rooster === name)?.caretaker || "Caretaker",
    })),
  ];
  const allSelectedLogs = selected ? logs.filter((log) => log.rooster === selected.name) : [];
  const selectedLogs = logs
    .filter((log) => selected && log.rooster === selected.name)
    .filter((log) => status === "All" || log.status === status)
    .filter((log) => `${log.title} ${log.type} ${log.item} ${log.detail} ${log.caretaker} ${log.status}`.toLowerCase().includes(query.toLowerCase()));
  const productTotal = allSelectedLogs.reduce((sum, log) => sum + log.productCost, 0);
  const laborTotal = allSelectedLogs.reduce((sum, log) => sum + log.laborCost, 0);
  const statuses = ["All", "Verified", "Approved", "Waiting Review"];
  return (
    <Shell role="customer" title="Care Logs">
      <PageTitle title="Care Logs" text="Searchable care records with uploaded date, time, caretaker, proof, item used, and review status." icon="file" />
      <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
        <Card>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-black">Rooster</h2>
            {liveLogs.length > 0 && <Badge tone="good">Live</Badge>}
          </div>
          <div className="mt-4 max-h-[560px] space-y-3 overflow-y-auto pr-2">
            {roosterChoices.map((r) => (
              <button key={r.id} onClick={() => setSelected(r)} className={"flex w-full items-center gap-3 rounded-2xl border p-3 text-left " + (selected?.id === r.id ? "border-[#1f6b45] bg-emerald-50" : "border-[#ece6d8] bg-[#fffdf7]")}>
                <RoosterPhoto src={r.image} alt={r.name} size="thumb" />
                <div className="min-w-0 flex-1">
                  <b className="block truncate">{r.name}</b>
                  <p className="truncate text-sm font-black text-[#1f6b45]">{r.breed}</p>
                  <p className="truncate text-sm text-[#667267]">
                    {r.tag} - {r.pen}
                  </p>
                </div>
                <Badge>{logs.filter((log) => log.rooster === r.name).length}</Badge>
              </button>
            ))}
            {roosterChoices.length === 0 && <p className="rounded-2xl border border-dashed border-[#d8d0bd] bg-[#fffdf7] p-4 text-sm font-bold text-[#667267]">No care logs yet. Approved caretaker submissions will appear here.</p>}
          </div>
        </Card>
        <div className="grid gap-5">
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-black">{selected?.name || "No care record selected"}</h2>
                <p className="text-sm font-black text-[#1f6b45]">{selected?.breed || "Waiting for approved care update"}</p>
                <p className="text-sm font-bold text-[#667267]">{selected ? `${selected.tag} - ${selected.pen}` : "No rooster care logs yet"}</p>
              </div>
              {selected && <Badge tone="good">Care active</Badge>}
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <Info label="Product Cost Used" value={peso(productTotal)} />
              <Info label="Updates" value={`${allSelectedLogs.length}`} />
              <Info label="Labor Cost" value={peso(laborTotal)} />
            </div>
          </Card>
          <Card>
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <h2 className="text-xl font-black">Records</h2>
                <p className="text-sm font-bold text-[#667267]">
                  {selectedLogs.length} matching log
                  {selectedLogs.length === 1 ? "" : "s"}
                </p>
              </div>
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search logs..." className="w-full rounded-xl border border-[#ded8c9] bg-white px-4 py-3 font-bold xl:max-w-sm" />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {statuses.map((s) => (
                <button key={s} onClick={() => setStatus(s)} className={"rounded-full px-4 py-2 text-sm font-black " + (status === s ? "bg-[#1f6b45] text-white" : "bg-[#f6f3e8] text-[#17251d]")}>
                  {s}
                </button>
              ))}
            </div>
            <div className="mt-5 max-h-[620px] space-y-3 overflow-y-auto pr-2">
              {selectedLogs.map((log) => (
                <div key={log.title + log.uploaded + log.time} className="grid gap-3 rounded-2xl border border-[#ece6d8] bg-[#fffdf7] p-4 md:grid-cols-[86px_1fr]">
                  {log.type === "Video" ? (
                    <video src={log.image} controls playsInline className="h-20 w-20 rounded-xl border border-[#ded8c9] bg-black object-contain">
                      Your browser cannot play this care video.
                    </video>
                  ) : (
                    <a href={log.image} target="_blank" rel="noreferrer" title="Open proof image" className="h-20 w-20 overflow-hidden rounded-xl border border-[#ded8c9] bg-white">
                      <img src={log.image} alt="" className="h-full w-full object-cover" />
                    </a>
                  )}
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-black">
                            {log.title} - {log.time}
                          </h3>
                          <Badge>{log.type}</Badge>
                        </div>
                        <p className="mt-1 text-sm font-bold text-[#667267]">{log.uploaded}</p>
                        <p className="mt-2 text-sm font-bold text-[#667267]">{log.detail}</p>
                      </div>
                      <Badge tone={log.status === "Verified" || log.status === "Approved" ? "good" : "warn"}>{log.status}</Badge>
                    </div>
                    <div className="mt-4 grid gap-2 text-sm md:grid-cols-2 xl:grid-cols-4">
                      <span>
                        <b>Item:</b> {log.item}
                      </span>
                      <span>
                        <b>Amount:</b> {log.amount}
                      </span>
                      <span>
                        <b>Caretaker:</b> {log.caretaker}
                      </span>
                      <span>
                        <b>Proof:</b> {log.proof}
                      </span>
                    </div>
                    <p className="mt-3 rounded-xl bg-white px-3 py-2 text-sm font-bold text-[#667267]">{log.reviewer}</p>
                  </div>
                </div>
              ))}
              {selectedLogs.length === 0 && <p className="rounded-2xl bg-[#f6f3e8] p-4 text-[#667267]">No care records match your search.</p>}
            </div>
          </Card>
        </div>
      </div>
    </Shell>
  );
}

function RoosterPhoto({ src, alt, size }: { src: string; alt: string; size: "thumb" | "hero" }) {
  const frame = size === "hero" ? "aspect-[4/3] w-full rounded-2xl sm:aspect-[16/11] lg:aspect-[4/3] xl:aspect-[16/11]" : "h-16 w-16 rounded-xl";
  const focal = src.includes("stage-4") ? "center 34%" : "center center";
  return (
    <div className={`${frame} shrink-0 overflow-hidden border border-[#e7dfcf] bg-[#f6f3e8]`}>
      <img src={src} alt={alt} style={{ objectPosition: focal }} className="h-full w-full object-cover" />
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[#f6f3e8] p-4">
      <p className="text-xs font-black uppercase text-[#667267]">{label}</p>
      <p className="mt-1 font-black">{value}</p>
    </div>
  );
}
export function FarmBuy() {
  const router = useRouter();
  const [cat, setCat] = useState("All");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [liveProducts, setLiveProducts] = useState<FarmProductCard[]>(products);
  const [marketNote, setMarketNote] = useState("Add items to Cart first. When your wallet is enough, tap Buy.");
  const [carePurpose, setCarePurpose] = useState<{
    rooster: string;
    caretaker: string;
    item: string;
    qty: string;
    reason: string;
  } | null>(null);
  const [balance, setBalance] = useState(0);

  useEffect(() => {
    let mounted = true;
    getCurrentProfile()
      .then((profile) => {
        if (!mounted) return;
        if (profile) setBalance(Number(profile.wallet_balance || 0));
        else setMarketNote("Please login so Farm Buy can read your wallet and save your receipt.");
      })
      .catch(() => setMarketNote("Please login so Farm Buy can read your wallet and save your receipt."));
    return () => {
      mounted = false;
    };
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
      .then((rows) => {
        if (!mounted || rows.length === 0) return;
        const visibleBloodlines = new Set<string>();
        const filteredRows = rows.filter((row) => {
          const category = normalizeFarmProductCategory(
            String(row.category || "Farm Items")
              .replaceAll("_", " ")
              .replace(/\b\w/g, (c) => c.toUpperCase()),
          );
          if (category !== "Breed Chicks" && row.product_type !== "breed_chick") return true;
          const nameBloodline = String(row.name || "").match(/\(([^)]+)\)/)?.[1];
          const bloodline = String(row.bloodline || row.breed || nameBloodline || "")
            .trim()
            .toLowerCase();
          if (!gamefowlBloodlineKeys.has(bloodline) || visibleBloodlines.has(bloodline)) return false;
          visibleBloodlines.add(bloodline);
          return true;
        });
        const mappedProducts: FarmProductCard[] = filteredRows.map((row) => {
          const category = normalizeFarmProductCategory(
            String(row.category || "Farm Items")
              .replaceAll("_", " ")
              .replace(/\b\w/g, (c) => c.toUpperCase()),
          );
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
    return () => {
      mounted = false;
    };
  }, []);

  const cats = ["All", ...Array.from(new Set(liveProducts.map((p) => p.category)))];
  const visible = cat === "All" ? liveProducts : liveProducts.filter((p) => p.category === cat);
  const cartEntries = Object.entries(cart)
    .filter(([, qty]) => qty > 0)
    .map(([id, qty]) => ({
      product: liveProducts.find((p) => p.id === id),
      qty,
    }))
    .filter((row): row is { product: FarmProductCard; qty: number } => Boolean(row.product));
  const itemCount = cartEntries.reduce((sum, row) => sum + row.qty, 0);
  const total = cartEntries.reduce((sum, row) => sum + row.product.price * row.qty, 0);

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
      const entries = cartEntries.map((row) => [row.product.id, row.qty] as const);
      const hasPreviewProduct = entries.some(([id]) => !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id));
      if (!hasPreviewProduct) {
        for (const [id, qty] of entries) {
          const item = liveProducts.find((product) => product.id === id);
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
        lines: cartEntries.map((row) => ({
          id: row.product.id,
          name: row.product.name,
          quantity: row.qty,
          unit_price: row.product.price,
          total: row.product.price * row.qty,
          category: row.product.category,
        })),
        total,
        carePurpose,
        previewOnly: hasPreviewProduct,
      };
      window.localStorage.setItem(
        "farmconnect_payment_context",
        JSON.stringify({
          sourceType: "farm_buy",
          sourceRef: hasPreviewProduct ? "preview-cart" : "active-cart",
          amountExpected: total,
          summary,
        }),
      );
      router.push("/customer/payment?type=farm_buy");
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      setMarketNote(message === "login_required" || message.toLowerCase().includes("login") ? "Please login first so we can save the order before payment." : "We could not prepare payment yet. Your cart is still here.");
    }
  }

  return (
    <Shell role="customer" title="Farm Buy">
      <PageTitle title="Farm Buy" text="Choose quantity with plus and minus. Selected items appear in your cart." icon="bag" />
      <KaFarm>{marketNote}</KaFarm>
      {carePurpose && (
        <Card className="mb-5 border-2 border-amber-300 bg-amber-50">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black">Linked Care Purchase</h2>
              <p className="mt-1 text-sm font-bold text-[#667267]">
                {carePurpose.item} ({carePurpose.qty}) for {carePurpose.rooster}
              </p>
              <p className="mt-1 text-sm text-[#667267]">
                Caretaker: {carePurpose.caretaker} - {carePurpose.reason}
              </p>
            </div>
            <button onClick={() => setCarePurpose(null)} className="rounded-xl bg-white px-4 py-3 font-black">
              Clear Link
            </button>
          </div>
        </Card>
      )}
      <div className="fc-farmbuy-layout mt-5 grid min-w-0 max-w-full gap-5 overflow-hidden lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="fc-farmbuy-products min-w-0 max-w-full">
          <div className="fc-scroll-row mb-4 flex gap-2 overflow-x-auto pb-1 sm:flex-wrap">
            {cats.map((c) => (
              <button key={c} onClick={() => setCat(c)} className={"shrink-0 rounded-full px-4 py-2 text-sm font-black " + (cat === c ? "bg-[#1f6b45] text-white" : "bg-white")}>
                {c}
              </button>
            ))}
          </div>
          <div className="fc-farmbuy-product-grid grid gap-3 md:max-h-[760px] md:grid-cols-2 md:overflow-y-auto md:pr-2 xl:grid-cols-3">
            {visible.map((p) => (
              <section key={p.id} className={"fc-farmbuy-product-card overflow-hidden rounded-2xl border bg-white shadow-sm transition " + ((cart[p.id] || 0) > 0 ? "border-[#1f6b45] ring-2 ring-emerald-100" : "border-[#e3ded0]")}>
                <div className="fc-farmbuy-product-media relative">
                  <img src={p.image} alt="" className="fc-farmbuy-product-image h-44 w-full object-cover" />
                  <Badge tone={(cart[p.id] || 0) > 0 ? "good" : "neutral"}>{p.category}</Badge>
                </div>
                <div className="fc-farmbuy-product-body p-4">
                  <h3 className="text-base font-black leading-tight sm:text-lg">{p.name}</h3>
                  {(p.bloodline || p.breed) && <p className="mt-1 text-sm font-black text-[#1f6b45]">{p.bloodline || p.breed}</p>}
                  <div className="mt-3 flex items-end justify-between gap-3">
                    <div>
                      <p className="text-2xl font-black">{peso(p.price)}</p>
                      <p className="text-sm font-bold text-[#667267]">{p.unit}</p>
                    </div>
                    <p className="rounded-xl bg-[#f6f3e8] px-3 py-2 text-sm font-black">{p.stock} left</p>
                  </div>
                  <div className="fc-farmbuy-product-qty mt-3 flex items-center justify-between rounded-2xl bg-[#f6f3e8] p-2 sm:mt-4">
                    <button aria-label={`Remove ${p.name}`} onClick={() => setQty(p.id, (cart[p.id] || 0) - 1)} className="grid h-11 w-11 place-items-center rounded-xl bg-white text-xl font-black shadow-sm">
                      -
                    </button>
                    <div className="text-center">
                      <p className="text-xs font-black uppercase text-[#667267]">Qty</p>
                      <p className="text-xl font-black">{cart[p.id] || 0}</p>
                    </div>
                    <button aria-label={`Add one ${p.name}`} onClick={() => setQty(p.id, (cart[p.id] || 0) + 1)} className="grid h-11 w-11 place-items-center rounded-xl bg-[#1f6b45] text-xl font-black text-white shadow-sm">
                      +
                    </button>
                  </div>
                </div>
              </section>
            ))}
          </div>
        </div>
        <Card id="farm-buy-cart" className="h-fit scroll-mt-24 border-2 border-[#1f6b45] lg:sticky lg:top-32">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-2xl font-black">
              <Icon name="bag" /> Cart
            </h2>
            <Badge tone={itemCount > 0 ? "good" : "neutral"}>{itemCount}</Badge>
          </div>
          <div className="mt-4 max-h-[360px] space-y-3 overflow-y-auto pr-2">
            {cartEntries.map(({ product, qty }) => (
              <div key={product.id} className="rounded-xl bg-[#f6f3e8] p-3">
                <div className="flex justify-between gap-3 text-sm">
                  <span>
                    <b>{product.name}</b>
                    <br />
                    <span className="text-[#667267]">
                      {qty} x {peso(product.price)}
                    </span>
                  </span>
                  <b>{peso(product.price * qty)}</b>
                </div>
              </div>
            ))}
            {total === 0 && <p className="rounded-xl bg-[#f6f3e8] p-3 text-sm text-[#667267]">Cart is empty. Use plus on a product.</p>}
          </div>
          <div className="mt-4 border-t pt-4">
            <Info label="Manual Payment" value="Admin review required" />
            <div className="mt-3 flex justify-between text-lg font-black">
              <span>Total</span>
              <span>{peso(total)}</span>
            </div>
            {total === 0 && (
              <button disabled className="mt-4 w-full rounded-xl bg-[#d8d2c3] px-4 py-3 font-black text-[#7a766b]">
                Pay
              </button>
            )}
            {total > 0 && (
              <button onClick={buyCart} className="mt-4 w-full rounded-xl bg-[#1f6b45] px-4 py-3 font-black text-white">
                Pay
              </button>
            )}
            <p className="mt-2 text-xs font-bold text-[#667267]">External payment only. Upload reference and receipt; admin approves before items appear.</p>
          </div>
        </Card>
      </div>
    </Shell>
  );
}
export function InventoryPage() {
  const [ownedItems, setOwnedItems] = useState<FarmProductCard[]>([]);
  const [inventoryNote, setInventoryNote] = useState("Purchased supplies from Farm Buy will appear here after checkout.");
  const careNeeds: Array<{
    rooster: string;
    caretaker: string;
    item: string;
    qty: string;
    reason: string;
  }> = [];
  useEffect(() => {
    let mounted = true;
    getCustomerInventoryItems()
      .then((rows) => {
        if (!mounted) return;
        const mapped: FarmProductCard[] = rows.map((row) => ({
          id: row.product_id || row.id,
          name: row.product_name,
          category: String(row.category || "Farm Items")
            .replaceAll("_", " ")
            .replace(/\b\w/g, (c) => c.toUpperCase()),
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
    return () => {
      mounted = false;
    };
  }, []);
  function careBuyHref(need: (typeof careNeeds)[number]) {
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
  const totalStock = ownedItems.reduce((sum, product) => sum + product.stock, 0);
  const lowStock = ownedItems.filter((product) => product.stock <= 2).length;
  const categories = Array.from(new Set(ownedItems.map((product) => product.category)));
  const inventoryValue = ownedItems.reduce((sum, product) => sum + product.price * product.stock, 0);
  return (
    <Shell role="customer" title="Inventory">
      <PageTitle title="Inventory" text="Customer-owned feeds, vitamins, supplies, and care-use stock from Farm Buy." icon="bag" />
      <KaFarm>{inventoryNote}</KaFarm>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#f1eadb] text-[#1f6b45]">
              <Icon name="bag" />
            </div>
            <div>
              <p className="text-xs font-black uppercase text-[#667267]">Owned Items</p>
              <p className="text-3xl font-black">{ownedItems.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-100 text-amber-700">
              <Icon name="alert" />
            </div>
            <div>
              <p className="text-xs font-black uppercase text-[#667267]">Care Needs</p>
              <p className="text-3xl font-black">{careNeeds.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#e7f3ea] text-[#1f6b45]">
              <Icon name="check" />
            </div>
            <div>
              <p className="text-xs font-black uppercase text-[#667267]">Owned Qty</p>
              <p className="text-3xl font-black">{totalStock}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#eef1ff] text-[#3450a4]">
              <Icon name="coins" />
            </div>
            <div>
              <p className="text-xs font-black uppercase text-[#667267]">Owned Value</p>
              <p className="text-2xl font-black">{peso(inventoryValue)}</p>
            </div>
          </div>
        </Card>
      </div>
      <section className="mt-5 rounded-3xl border border-amber-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-100 text-amber-700">
              <Icon name="clipboard" />
            </div>
            <div>
              <h2 className="text-xl font-black">Care Supply Needed</h2>
              <p className="text-sm font-bold text-[#667267]">Buy only what the caretaker needs for the selected rooster.</p>
            </div>
          </div>
          <Badge tone="warn">{careNeeds.length} active</Badge>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {careNeeds.map((need) => (
            <div key={need.rooster + need.item} className="rounded-2xl border border-[#ece6d8] bg-[#fffdf7] p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <b className="block truncate">{need.rooster}</b>
                  <p className="truncate text-sm font-bold text-[#667267]">
                    {need.item} - {need.caretaker}
                  </p>
                </div>
                <Badge tone="warn">{need.qty}</Badge>
              </div>
              <p className="mt-2 text-sm font-bold text-[#667267]">{need.reason}</p>
              <Link href={careBuyHref(need)} className="mt-3 inline-flex rounded-xl bg-[#1f6b45] px-3 py-2 text-sm font-black text-white">
                Buy for Care
              </Link>
            </div>
          ))}
        </div>
      </section>
      <Card className="mt-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black">Owned Inventory List</h2>
            <p className="text-sm font-bold text-[#667267]">
              {categories.length} categories - {lowStock} low stock item
              {lowStock === 1 ? "" : "s"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.slice(0, 4).map((category) => (
              <span key={category} className="rounded-full bg-[#f6f3e8] px-3 py-2 text-xs font-black text-[#667267]">
                {category}
              </span>
            ))}
          </div>
        </div>
        <div className="max-h-[620px] space-y-3 overflow-y-auto pr-2">
          {ownedItems.map((product) => {
            const need = careNeeds.find((row) => row.item === product.name);
            const needed = Boolean(need);
            return (
              <div key={product.id} className={"flex items-center gap-3 rounded-2xl border p-3 " + (needed ? "border-amber-300 bg-amber-50" : "border-[#ece6d8] bg-[#fffdf7]")}>
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-[#ded8c9] bg-white">
                  <img src={product.image} alt="" className="h-full w-full object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <b className="truncate text-lg">{product.name}</b>
                    <Badge tone={needed ? "warn" : "neutral"}>{needed ? "Needed" : product.category}</Badge>
                  </div>
                  <p className="mt-1 text-sm font-bold text-[#667267]">
                    {peso(product.price)} {product.unit}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <div className="rounded-xl bg-white px-3 py-2 text-right">
                    <p className="text-xs font-black uppercase text-[#667267]">Owned</p>
                    <p className="font-black">{product.stock}</p>
                  </div>
                  {need && (
                    <Link href={careBuyHref(need)} className="rounded-xl bg-[#1f6b45] px-3 py-2 text-sm font-black text-white">
                      Buy
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
          {ownedItems.length === 0 && <div className="rounded-2xl border border-dashed border-[#ded8c9] bg-[#fffdf7] p-5 text-sm font-bold text-[#667267]">No owned inventory yet. After Farm Buy checkout, supplies will appear here automatically.</div>}
        </div>
      </Card>
    </Shell>
  );
}
export function FarmRequests() {
  const router = useRouter();
  const [rooster, setRooster] = useState<RoosterCard | null>(null);
  const [service, setService] = useState(services[0]);
  const [note, setNote] = useState("");
  const [requestNote, setRequestNote] = useState("Choose a rooster, choose a service, add a note, then submit. Paid services create an invoice automatically.");
  const [careRows, setCareRows] = useState<any[]>([]);
  const [carePlans, setCarePlans] = useState<any[]>([]);
  const [careOverviews, setCareOverviews] = useState<CustomerRoosterCareOverview[]>([]);
  const [ownedRoosters, setOwnedRoosters] = useState<RoosterCard[]>([]);
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => {
    let mounted = true;
    getCustomerOwnedRoosters()
      .then((owned) => {
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
      .catch(() => setRequestNote("Owned rooster records could not load yet. Buy a rooster first and wait for admin approval."));
    Promise.all([getCustomerCareRequests(), getCustomerCarePlans(), getCustomerRoosterCareOverviews()])
      .then(([rows, plans, overviews]) => {
        if (mounted) {
          setCareRows(rows);
          setCarePlans(plans);
          setCareOverviews(overviews);
        }
      })
      .catch(() => setRequestNote("Care request database is not ready yet. Run SQL 011 before live testing."));
    return () => {
      mounted = false;
    };
  }, []);
  async function submitRequest() {
    if (submitting) return;
    if (!rooster) {
      setRequestNote("No owned rooster yet. Buy a rooster first and wait for admin approval before creating care requests.");
      return;
    }
    setSubmitting(true);
    try {
      const overview = careOverviews.find((row) => row.customerAnimalId === rooster.id);
      if (service.name === "Care Plan (30 Days)") {
        const carePlanId = await requestCustomerCarePlan(rooster.id, 30, overview?.catalogDay || 1);
        const prepared = await prepareCustomerCarePlanPayment(carePlanId);
        window.localStorage.setItem(
          "farmconnect_payment_context",
          JSON.stringify({
            sourceType: "care_plan",
            sourceRef: carePlanId,
            amountExpected: 5000,
            summary: {
              source: "30-Day Care Plan",
              care_plan_id: carePlanId,
              rooster: { id: rooster.id, name: rooster.name, tag: rooster.tag, breed: rooster.breed },
              duration_days: 30,
              requested_start_day: Number(prepared.requested_start_day || overview?.catalogDay || 1),
              feed_required_kg: Number(prepared.feed_required_kg || 0),
              average_daily_feed_kg: Number(prepared.average_daily_feed_kg || 0),
              feed_inventory_item_id: prepared.feed_inventory_item_id,
              feed_product_name: prepared.feed_product_name,
              daily_service_rate: Number(prepared.daily_service_rate || 0),
              package_total: 5000,
              customer_note: note,
            },
          }),
        );
        const [plans, overviews] = await Promise.all([getCustomerCarePlans(), getCustomerRoosterCareOverviews()]);
        setCarePlans(plans);
        setCareOverviews(overviews);
        setRequestNote(`30-day Care Plan prepared for ${rooster.name}: ${Number(prepared.feed_required_kg || 0).toFixed(3)} kg total (${Number(prepared.average_daily_feed_kg || 0).toFixed(3)} kg/day average) of ${prepared.feed_product_name || "customer-owned feed"} reserved. Service total is ₱5,000 (₱166.67 average/day).`);
        router.push("/customer/payment?type=care_plan");
        return;
      }
      if (overview?.paid) {
        setRequestNote(`${rooster.name} already has paid Care Plan automation. Its daily mission goes directly to the assigned caretaker; a duplicate manual care request was not created.`);
        return;
      }
      const careRequestId = await createCareRequest({
        customerAnimalId: rooster.id,
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
          rooster: {
            id: rooster.id,
            name: rooster.name,
            tag: rooster.tag,
            breed: rooster.breed,
          },
          service,
          customer_note: note,
          total: service.price,
        };
        window.localStorage.setItem(
          "farmconnect_payment_context",
          JSON.stringify({
            sourceType: "care_request",
            sourceRef: careRequestId,
            amountExpected: service.price,
            summary,
          }),
        );
        router.push("/customer/payment?type=care_request");
        return;
      }
      setRequestNote(`Request sent for ${rooster.name}. Admin will assign this to a caretaker; your note is included.`);
      const rows = await getCustomerCareRequests();
      setCareRows(rows);
    } catch (error) {
      const rawMessage = rawAppError(error);
      const message = readableAppError(error);
      setRequestNote(/CARE_PLAN_CUSTOMER_FEED_BALANCE_INSUFFICIENT/i.test(rawMessage) ? `Care Plan blocked before payment: customer Inventory does not have enough eligible feed. ${rawMessage.replace(/^.*CARE_PLAN_CUSTOMER_FEED_BALANCE_INSUFFICIENT[|:]?/i, "").replaceAll("|", " · ")}` : /CARE_INVENTORY_ITEM_REQUIRED/i.test(rawMessage) ? "This care request needs customer-owned supplies that are not in Inventory yet. Buy the required item in Farm Buy, then try again." : /CARE_INVENTORY_INSUFFICIENT/i.test(rawMessage) ? `Inventory is not enough for this mission. ${rawMessage.replace(/^.*CARE_INVENTORY_INSUFFICIENT[:|]?/i, "").replaceAll("|", " · ")}` : /PAID_CARE_PLAN_ALREADY_AUTOMATES_ROOSTER/i.test(rawMessage) ? "This rooster already has paid Care Plan automation, so a duplicate manual request is not allowed." : `Request failed: ${message || "Check login and Care Plan SQL."}`);
    } finally {
      setSubmitting(false);
    }
  }
  async function continueCarePlanPayment(plan: any) {
    if (submitting) return;
    try {
      setSubmitting(true);
      const prepared = await prepareCustomerCarePlanPayment(plan.id);
      const animal = Array.isArray(plan.customer_animals) ? plan.customer_animals[0] : plan.customer_animals;
      window.localStorage.setItem(
        "farmconnect_payment_context",
        JSON.stringify({
          sourceType: "care_plan",
          sourceRef: plan.id,
          amountExpected: 5000,
          summary: {
            source: "30-Day Care Plan",
            care_plan_id: plan.id,
            rooster: { id: plan.customer_animal_id, name: animal?.animal_name || rooster?.name || "Selected rooster", tag: animal?.animal_code || rooster?.tag || "" },
            duration_days: Number(plan.duration_days || 30),
            requested_start_day: Number(plan.requested_start_day || 1),
            feed_required_kg: Number(prepared.feed_required_kg || plan.feed_required_kg || 0),
            average_daily_feed_kg: Number(prepared.average_daily_feed_kg || 0),
            feed_inventory_item_id: prepared.feed_inventory_item_id || plan.feed_inventory_item_id,
            feed_product_name: prepared.feed_product_name,
            daily_service_rate: Number(prepared.daily_service_rate || 0),
            package_total: 5000,
          },
        }),
      );
      router.push("/customer/payment?type=care_plan");
    } catch (error) {
      setRequestNote(`Care Plan payment could not continue: ${readableAppError(error)}`);
    } finally {
      setSubmitting(false);
    }
  }
  return (
    <Shell role="customer" title="Farm Requests">
      <PageTitle title="Farm Requests" text="Choose a rooster, choose a service, add a note, then Pay or Send Request." icon="clipboard" />
      <KaFarm>{requestNote}</KaFarm>
      <div className="mt-5 grid gap-4 lg:grid-cols-[0.9fr_1.15fr_0.9fr]">
        <Card>
          <h2 className="text-lg font-black xl:text-xl">1. Rooster List</h2>
          <div className="mt-4 max-h-[520px] space-y-3 overflow-y-auto pr-2">
            {ownedRoosters.map((r) => (
              <button key={r.id} onClick={() => setRooster(r)} className={"flex w-full items-center gap-3 rounded-xl border p-3 text-left " + (rooster?.id === r.id ? "border-[#1f6b45] bg-emerald-50" : "border-[#ece6d8]")}>
                <img src={r.image} className="h-12 w-12 rounded-lg object-cover" alt="" />
                <span className="min-w-0">
                  <b className="block truncate">{r.name}</b>
                  <p className="truncate text-sm text-[#667267]">{r.tag}</p>
                </span>
              </button>
            ))}
            {ownedRoosters.length === 0 && <p className="rounded-xl border border-dashed border-[#ded8c9] bg-[#fffdf7] p-4 text-sm font-bold text-[#667267]">No owned rooster yet. Approved Farm Buy rooster purchases will appear here.</p>}
          </div>
        </Card>
        <Card>
          <h2 className="text-lg font-black xl:text-xl">2. Choose Service</h2>
          <div className="mt-4 max-h-[420px] space-y-2 overflow-y-auto pr-2">
            {services.map((s) => (
              <button key={s.name} onClick={() => setService(s)} className={"w-full rounded-xl border p-3 text-left " + (service.name === s.name ? "border-[#1f6b45] bg-emerald-50" : "border-[#ece6d8]")}>
                <div className="flex flex-wrap justify-between gap-2">
                  <b>{s.name}</b>
                  <span>{s.price ? peso(s.price) : "Free"}</span>
                </div>
                <p className="text-sm text-[#667267]">
                  {s.proof} - {s.eta}
                </p>
              </button>
            ))}
          </div>
          <label className="mt-4 block text-sm font-black">Customer Instruction</label>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Tell the farm what you want..." className="mt-2 min-h-24 w-full rounded-xl border border-[#ded8c9] p-3" />
          <button onClick={submitRequest} className="mt-3 w-full rounded-xl bg-[#1f6b45] px-4 py-3 font-black text-white">
            {submitting ? "Saving..." : service.name === "Care Plan (30 Days)" ? "Pay ₱5,000 Care Plan" : service.price > 0 ? "Pay" : "Send Request"}
          </button>
          {service.name === "Care Plan (30 Days)" ? <p className="mt-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-900">The server computes the rooster’s exact 30-day feed requirement from its ownership date and the 180-day program. Enough customer-owned feed must be available and is reserved before the ₱5,000 payment.</p> : service.price > 0 && <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-[#7a4b00]">Inventory is checked and reserved before payment. Admin approves before the task goes to caretaker.</p>}
        </Card>
        <Card>
          <h2 className="text-lg font-black xl:text-xl">3. Request Logs</h2>
          <div className="mt-4 max-h-[520px] space-y-3 overflow-y-auto pr-2">
            {careRows.map((row) => (
              <div key={row.id} className="rounded-xl bg-[#f6f3e8] p-3">
                <b>{row.rooster_name}</b>
                <p className="text-sm text-[#667267]">
                  {row.service_name} - {String(row.status || "").replaceAll("_", " ")}
                </p>
                <p className="mt-1 text-xs font-bold text-[#667267]">{row.customer_note || "No note"}</p>
                <button onClick={() => setRequestNote(`Care request ${row.service_name}: ${String(row.status || "").replaceAll("_", " ")}.`)} className="mt-2 rounded-lg bg-white px-3 py-2 text-sm font-black">
                  View Care
                </button>
              </div>
            ))}
            {carePlans.map((plan) => (
              <div key={`plan-${plan.id}`} className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                <b>Care Plan · {plan.duration_days} days</b>
                <p className="text-sm font-bold text-[#667267]">{String(plan.status || "draft").replaceAll("_", " ")}</p>
                {["draft", "payment_for_review", "payment_submitted"].includes(String(plan.status || "")) ? (
                  <button type="button" onClick={() => void continueCarePlanPayment(plan)} className="mt-2 rounded-lg bg-white px-3 py-2 text-sm font-black">
                    Continue ₱5,000 Payment
                  </button>
                ) : (
                  <button type="button" onClick={() => setRequestNote(`Care Plan status: ${String(plan.status || "").replaceAll("_", " ")}.`)} className="mt-2 rounded-lg bg-white px-3 py-2 text-sm font-black">
                    View Status
                  </button>
                )}
              </div>
            ))}
            {careRows.length === 0 && carePlans.length === 0 && <p className="rounded-xl bg-[#f6f3e8] p-3 text-sm font-bold text-[#667267]">No care request records yet.</p>}
          </div>
        </Card>
      </div>
    </Shell>
  );
}

export function CustomerCarePlansPage() {
  const router = useRouter();
  const [animals, setAnimals] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [animalId, setAnimalId] = useState("");
  const [note, setNote] = useState("The 30-day service is ₱5,000 (₱166.67 average/day). FarmConnect derives the program day and reserves enough customer-owned feed before payment.");
  const [saving, setSaving] = useState(false);
  async function load() {
    const [owned, carePlans] = await Promise.all([getCustomerOwnedRoosters(), getCustomerCarePlans()]);
    setAnimals(owned);
    setPlans(carePlans);
    setAnimalId((current) => current || owned[0]?.id || "");
  }
  useEffect(() => {
    load().catch((error) => setNote(`Care Plans could not load: ${readableAppError(error)}`));
  }, []);
  async function requestPlan() {
    if (!animalId || saving) return;
    try {
      setSaving(true);
      await requestCustomerCarePlan(animalId, 30, 1);
      await load();
      setNote("Care Plan feed balance reserved. Review the fixed ₱5,000 payment, then wait for Admin approval and Task Management assignment.");
    } catch (error) {
      setNote(`Request failed: ${readableAppError(error)}`);
    } finally {
      setSaving(false);
    }
  }
  function pay(plan: any) {
    const total = Number(plan.package_total || 0);
    if (plan.status !== "payment_for_review" || total <= 0) {
      setNote("This plan does not have a payable locked quote yet.");
      return;
    }
    window.localStorage.setItem(
      "farmconnect_payment_context",
      JSON.stringify({
        sourceType: "care_plan",
        sourceRef: plan.id,
        amountExpected: total,
        summary: {
          source: "Care Plan",
          care_plan_id: plan.id,
          duration_days: plan.duration_days,
          feed_required_kg: plan.feed_required_kg,
          total,
        },
      }),
    );
    router.push("/customer/payment?type=care_plan");
  }
  async function cancel(plan: any) {
    if (saving) return;
    const reason = window.prompt("Why are you cancelling this unpaid Care Plan request?");
    if (reason === null) return;
    try {
      setSaving(true);
      await cancelCustomerCarePlan(plan.id, reason || "Cancelled before payment");
      await load();
      setNote("Unpaid Care Plan request cancelled. No refund was needed.");
    } catch (error) {
      setNote(`Cancellation failed: ${readableAppError(error)}`);
    } finally {
      setSaving(false);
    }
  }
  return (
    <Shell role="customer" title="Care Plans">
      <PageTitle title="Care Plans" text="Paid daily rooster care that continues even when you do not open the app." icon="clipboard" />
      <KaFarm>{note}</KaFarm>
      <div className="mt-5 grid gap-5 lg:grid-cols-[380px_1fr]">
        <Card>
          <h2 className="text-xl font-black">Request Verified Package</h2>
          <p className="mt-2 text-sm font-bold leading-6 text-[#667267]">Fixed 30-day service: ₱5,000. The server reads the rooster ownership date, totals the matching 180-day feed standard, and reserves enough eligible customer inventory before payment.</p>
          <label className="mt-4 block text-sm font-black">
            Rooster
            <select value={animalId} onChange={(event) => setAnimalId(event.target.value)} className="mt-2 w-full rounded-xl border p-3">
              {animals.map((animal) => (
                <option key={animal.id} value={animal.id}>
                  {animal.animal_name} — {animal.animal_code}
                </option>
              ))}
            </select>
          </label>
          <div className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm font-black text-emerald-950">
            30 days · ₱5,000 total · ₱166.67 average/day
            <span className="mt-1 block text-xs text-[#667267]">Program day is computed from the official ownership date. It cannot be lowered manually.</span>
          </div>
          <button disabled={!animalId || saving} onClick={requestPlan} className="mt-5 w-full rounded-xl bg-[#1f6b45] px-4 py-3 font-black text-white disabled:opacity-50">
            {saving ? "Requesting..." : "Request Care Plan"}
          </button>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black">Your Plans</h2>
            <Badge>{plans.length}</Badge>
          </div>
          <div className="mt-4 space-y-3">
            {plans.map((plan) => {
              const animal = Array.isArray(plan.customer_animals) ? plan.customer_animals[0] : plan.customer_animals;
              return (
                <div key={plan.id} className="rounded-2xl border border-[#ece6d8] bg-[#fffdf7] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-black">{animal?.animal_name || "Rooster Care Plan"}</h3>
                      <p className="text-sm font-bold text-[#667267]">
                        {plan.duration_days} days · starts at mission Day {plan.start_day_number}
                      </p>
                    </div>
                    <Badge tone={plan.status === "active" ? "good" : plan.status === "payment_for_review" ? "warn" : "neutral"}>{String(plan.status).replaceAll("_", " ")}</Badge>
                  </div>
                  {plan.quoted_at && (
                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                      <Info label="Customer Feed Reserved" value={`${Number(plan.feed_required_kg || 0).toFixed(3)} kg`} />
                      <Info label="Labor + Service" value={peso(Number(plan.labor_price || 0) + Number(plan.service_fee || 0))} />
                      <Info label="Locked Total" value={peso(Number(plan.package_total || 0))} />
                    </div>
                  )}
                  <p className="mt-3 text-sm font-bold text-[#667267]">{plan.quote_note || "Waiting for admin package verification."}</p>
                  {plan.quote_expires_at && plan.status === "payment_for_review" && (
                    <p className="mt-2 text-xs font-bold text-[#667267]">
                      Pay before {new Date(plan.quote_expires_at).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}. The server will reject an expired quote and require a fresh customer inventory balance check.
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {plan.status === "payment_for_review" && Number(plan.package_total || 0) > 0 && (
                      <button onClick={() => pay(plan)} className="rounded-xl bg-[#1f6b45] px-5 py-3 font-black text-white">
                        Review and Pay {peso(Number(plan.package_total || 0))}
                      </button>
                    )}
                    {["draft", "payment_for_review"].includes(plan.status) && (
                      <button disabled={saving} onClick={() => void cancel(plan)} className="rounded-xl bg-red-50 px-5 py-3 font-black text-red-800 disabled:opacity-50">
                        Cancel Unpaid Request
                      </button>
                    )}
                  </div>
                  {plan.refund_status === "pending" && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm font-black text-amber-950">Refund pending: {peso(Number(plan.refund_due_amount || 0))}</p>}
                </div>
              );
            })}
            {!plans.length && <p className="rounded-2xl bg-[#f6f3e8] p-5 text-sm font-bold text-[#667267]">No Care Plan request yet.</p>}
          </div>
        </Card>
      </div>
    </Shell>
  );
}

export function AdminCarePlansPage() {
  const [plans, setPlans] = useState<any[]>([]);
  const [caretakers, setCaretakers] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [farmFeeds, setFarmFeeds] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [caretakerId, setCaretakerId] = useState("");
  const [itemId, setItemId] = useState("");
  const [farmFeedId, setFarmFeedId] = useState("");
  const [kgPerUnit, setKgPerUnit] = useState("1");
  const [broodingFeedGrams, setBroodingFeedGrams] = useState("");
  const [labor, setLabor] = useState("");
  const [fee, setFee] = useState("");
  const [quoteNote, setQuoteNote] = useState("");
  const [startDate, setStartDate] = useState("");
  const [actionNote, setActionNote] = useState("");
  const [refundReference, setRefundReference] = useState("");
  const [note, setNote] = useState("Loading Care Plan requests...");
  const [saving, setSaving] = useState(false);
  const selected = plans.find((plan) => plan.id === selectedId) || plans[0] || null;
  const selectedStatus = String(selected?.status || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  async function load() {
    const [rows, workers, feedProducts] = await Promise.all([getAdminCarePlans(), getActiveCaretakersForAssignment(), getAvailableFarmFeedProducts()]);
    setPlans(rows);
    setCaretakers(workers);
    setFarmFeeds(feedProducts);
    setFarmFeedId((current) => current || feedProducts[0]?.id || "");
    setSelectedId((current) => (rows.some((row: any) => row.id === current) ? current : rows[0]?.id || ""));
  }
  useEffect(() => {
    load().catch((error) => setNote(`Admin Care Plans could not load: ${readableAppError(error)}`));
  }, []);
  useEffect(() => {
    if (!selected?.profile_id) {
      setInventory([]);
      return;
    }
    getAdminCustomerInventory(selected.profile_id)
      .then((items) => {
        setInventory(items);
        setItemId((current) => (items.some((item: any) => item.id === current) ? current : items[0]?.id || ""));
      })
      .catch((error) => setNote(`Customer inventory could not load: ${readableAppError(error)}`));
  }, [selected?.id, selected?.profile_id]);
  useEffect(() => {
    setCaretakerId(selected?.assigned_caretaker_id || "");
  }, [selected?.id, selected?.assigned_caretaker_id]);
  async function prepare() {
    if (!selected || !caretakerId || !itemId || saving) return;
    try {
      setSaving(true);
      const result = await prepareAdminCarePlanQuote({
        carePlanId: selected.id,
        caretakerId,
        feedInventoryItemId: itemId || null,
        feedProductId: itemId ? null : farmFeedId || null,
        kgPerInventoryUnit: Number(kgPerUnit),
        unquantifiedDayFeedGrams: Number(broodingFeedGrams),
        laborPrice: Number(labor),
        serviceFee: Number(fee),
        quoteNote,
      });
      await load();
      setNote(`Locked package prepared: ${Number(result.feed_required_kg || 0).toFixed(3)} kg feed, total ${peso(Number(result.package_total || 0))}.`);
    } catch (error) {
      setNote(`Quote failed: ${readableAppError(error)}`);
    } finally {
      setSaving(false);
    }
  }
  async function activate() {
    if (!selected || !startDate || saving) return;
    try {
      setSaving(true);
      await activateAdminCarePlan(selected.id, startDate);
      await load();
      setNote("Care Plan activated. Server-side daily mission generation is now eligible from the start date.");
    } catch (error) {
      setNote(`Activation failed: ${readableAppError(error)}`);
    } finally {
      setSaving(false);
    }
  }
  async function runAction(action: "pause" | "resume" | "reassign" | "cancel") {
    if (!selected || saving) return;
    if (!actionNote.trim()) {
      setNote("Add an operations note before a pause, resume, reassignment, or cancellation.");
      return;
    }
    try {
      setSaving(true);
      const result = await controlAdminCarePlan({
        carePlanId: selected.id,
        action,
        note: actionNote,
        newCaretakerId: action === "reassign" ? caretakerId : null,
      });
      await load();
      setNote(`Care Plan ${action} recorded.${Number(result.refund_due_amount || 0) > 0 ? ` Refund due: ${peso(Number(result.refund_due_amount))}.` : ""}`);
    } catch (error) {
      setNote(`Care Plan action failed: ${readableAppError(error)}`);
    } finally {
      setSaving(false);
    }
  }
  async function recordRefund() {
    if (!selected || !refundReference.trim() || saving) return;
    try {
      setSaving(true);
      await recordAdminCarePlanRefund(selected.id, refundReference, actionNote);
      await load();
      setNote("External refund evidence recorded and customer notified.");
    } catch (error) {
      setNote(`Refund record failed: ${readableAppError(error)}`);
    } finally {
      setSaving(false);
    }
  }
  async function runScheduler() {
    if (saving) return;
    try {
      setSaving(true);
      const result = await generateTodayCarePlanMissions();
      await load();
      setNote(`Daily mission generator completed for ${result.run_date || "today"}: ${Number(result.created || 0)} new task(s).`);
    } catch (error) {
      setNote(`Mission generation failed: ${readableAppError(error)}`);
    } finally {
      setSaving(false);
    }
  }
  const animal = selected ? (Array.isArray(selected.customer_animals) ? selected.customer_animals[0] : selected.customer_animals) : null;
  const profile = selected ? (Array.isArray(selected.customer) ? selected.customer[0] : selected.customer) : null;
  return (
    <Shell role="admin" title="Care Plans">
      <PageTitle title="Care Plan Operations" text="Verify package food, lock the quote, then activate only after payment approval." icon="clipboard" />
      <KaFarm>{note}</KaFarm>
      <div className="mt-5 grid gap-4 xl:grid-cols-[280px_1fr_340px]">
        <Card>
          <h2 className="text-xl font-black">Plan Queue</h2>
          <div className="mt-4 space-y-2">
            {plans.map((plan) => (
              <button key={plan.id} onClick={() => setSelectedId(plan.id)} className={"w-full rounded-xl border p-3 text-left " + (selected?.id === plan.id ? "border-[#1f6b45] bg-emerald-50" : "border-[#ece6d8]")}>
                <b>{plan.customer_animals?.animal_name || "Rooster"}</b>
                <p className="text-xs font-bold text-[#667267]">
                  {plan.duration_days} days · {String(plan.status).replaceAll("_", " ")}
                </p>
              </button>
            ))}
          </div>
        </Card>
        <Card>
          {selected ? (
            <>
              <div className="flex justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase text-[#667267]">Verified Package Builder</p>
                  <h2 className="text-3xl font-black">{animal?.animal_name || "Rooster"}</h2>
                  <p className="text-sm font-bold text-[#667267]">{profile?.display_name || profile?.full_name || profile?.email || "Customer"}</p>
                </div>
                <Badge>{String(selected.status).replaceAll("_", " ")}</Badge>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Info label="Duration" value={`${selected.duration_days} days`} />
                <Info label="Requested Start Day" value={`Day ${selected.requested_start_day}`} />
                <Info label="Catalog Range" value={`Day ${selected.requested_start_day}-${selected.requested_start_day + selected.duration_days - 1}`} />
                <Info label="Current Total" value={peso(Number(selected.package_total || 0))} />
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-black">
                  Assigned Caretaker
                  <select value={caretakerId} onChange={(event) => setCaretakerId(event.target.value)} className="mt-2 w-full rounded-xl border p-3">
                    <option value="">Select caretaker</option>
                    {caretakers.map((worker) => (
                      <option key={worker.id} value={worker.id}>
                        {worker.display_name || worker.full_name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm font-black">
                  Customer Feed Inventory
                  <select value={itemId} onChange={(event) => setItemId(event.target.value)} className="mt-2 w-full rounded-xl border p-3">
                    <option value="">Buy missing feed from FarmConnect stock</option>
                    {inventory.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.product_name} · {Number(item.quantity).toFixed(3)} {item.unit_label}
                      </option>
                    ))}
                  </select>
                </label>
                {!itemId && (
                  <label className="text-sm font-black">
                    Farm Feed Product
                    <select value={farmFeedId} onChange={(event) => setFarmFeedId(event.target.value)} className="mt-2 w-full rounded-xl border p-3">
                      <option value="">Select available farm feed</option>
                      {farmFeeds.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name} · {Number(product.stock_quantity).toFixed(3)} {product.unit_label} available · {peso(Number(product.unit_price || 0))}
                        </option>
                      ))}
                    </select>
                    <span className="mt-1 block text-xs text-[#667267]">Use this when the customer has no feed, or when a different verified farm feed is required.</span>
                  </label>
                )}
                <label className="text-sm font-black">
                  Kilograms Per Inventory Unit
                  <input value={kgPerUnit} onChange={(event) => setKgPerUnit(event.target.value.replace(/[^0-9.]/g, ""))} className="mt-2 w-full rounded-xl border p-3" />
                  <span className="mt-1 block text-xs text-[#667267]">Use 1 for per kg, or 25 for one 25 kg bag. The server sums the daily catalog automatically.</span>
                </label>
                <label className="text-sm font-black">
                  Caretaker Labor
                  <input value={labor} onChange={(event) => setLabor(event.target.value.replace(/[^0-9.]/g, ""))} className="mt-2 w-full rounded-xl border p-3" />
                </label>
                <label className="text-sm font-black">
                  Feed Per Unquantified Brooding Day (grams)
                  <input value={broodingFeedGrams} onChange={(event) => setBroodingFeedGrams(event.target.value.replace(/[^0-9.]/g, ""))} placeholder="Needed if catalog says observe intake" className="mt-2 w-full rounded-xl border p-3" />
                  <span className="mt-1 block text-xs text-[#667267]">Used only on early days without a fixed gram range; saved in the audit event.</span>
                </label>
                <label className="text-sm font-black">
                  Service Fee
                  <input value={fee} onChange={(event) => setFee(event.target.value.replace(/[^0-9.]/g, ""))} className="mt-2 w-full rounded-xl border p-3" />
                </label>
              </div>
              <textarea value={quoteNote} onChange={(event) => setQuoteNote(event.target.value)} placeholder="Explain included food, labor, supplies, and any veterinarian-controlled exclusions." className="mt-3 min-h-24 w-full rounded-xl border p-3" />
              <button disabled={saving || (selectedStatus !== "draft" && selectedStatus !== "payment_for_review") || !caretakerId || (!itemId && !farmFeedId) || Number(kgPerUnit) <= 0} onClick={prepare} className="mt-3 w-full rounded-xl bg-[#1f6b45] p-3 font-black text-white disabled:opacity-50">
                Prepare Locked Quote
              </button>
            </>
          ) : (
            <p>No Care Plan selected.</p>
          )}
        </Card>
        <Card>
          <h2 className="text-xl font-black">Activation Gate</h2>
          <p className="mt-2 text-sm font-bold leading-6 text-[#667267]">Only an approved payment can activate. Start date must be tomorrow or later in Asia/Manila.</p>
          <input
            type="date"
            value={startDate}
            onInput={(event) => setStartDate((event.target as HTMLInputElement).value)}
            onChange={(event) => setStartDate(event.target.value)}
            className="mt-4 w-full rounded-xl border p-3"
          />
          <button disabled={!selected || selectedStatus !== "paid_pending_setup" || !startDate || saving} onClick={activate} className="mt-3 w-full rounded-xl bg-[#1f6b45] p-3 font-black text-white disabled:opacity-50">
            Activate Paid Plan
          </button>
          <div className="mt-4 rounded-xl bg-amber-50 p-3 text-xs font-bold leading-5 text-amber-950">Customer inactivity never stops an active paid plan. Missed missions become overdue; they are not silently completed or charged twice.</div>
          <button disabled={saving} onClick={() => void runScheduler()} className="mt-3 w-full rounded-xl bg-[#eee8d9] p-3 font-black disabled:opacity-50">
            Run Today&apos;s Mission Generator
          </button>
          <textarea value={actionNote} onChange={(event) => setActionNote(event.target.value)} placeholder="Required operations note for pause, resume, reassignment, or cancellation" className="mt-4 min-h-20 w-full rounded-xl border p-3" />
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button disabled={!selected || selectedStatus !== "active" || saving} onClick={() => void runAction("pause")} className="rounded-xl bg-amber-50 p-3 text-sm font-black text-amber-900 disabled:opacity-40">
              Pause
            </button>
            <button disabled={!selected || selectedStatus !== "paused" || saving} onClick={() => void runAction("resume")} className="rounded-xl bg-emerald-50 p-3 text-sm font-black text-emerald-900 disabled:opacity-40">
              Resume
            </button>
            <button disabled={!selected || !caretakerId || saving} onClick={() => void runAction("reassign")} className="rounded-xl bg-sky-50 p-3 text-sm font-black text-sky-900 disabled:opacity-40">
              Reassign
            </button>
            <button disabled={!selected || ["completed", "cancelled", "expired"].includes(selectedStatus) || saving} onClick={() => void runAction("cancel")} className="rounded-xl bg-red-50 p-3 text-sm font-black text-red-900 disabled:opacity-40">
              Cancel
            </button>
          </div>
          {selected?.refund_status === "pending" && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
              <p className="text-sm font-black text-amber-950">External refund due: {peso(Number(selected.refund_due_amount || 0))}</p>
              <input value={refundReference} onChange={(event) => setRefundReference(event.target.value)} placeholder="Refund reference" className="mt-2 w-full rounded-xl border p-3" />
              <button disabled={!refundReference.trim() || saving} onClick={() => void recordRefund()} className="mt-2 w-full rounded-xl bg-amber-700 p-3 text-sm font-black text-white disabled:opacity-40">
                Record Completed Refund
              </button>
            </div>
          )}
        </Card>
      </div>
      <div className="mt-5">
        <AdminManualPaymentQueue sourceType="care_plan" />
      </div>
    </Shell>
  );
}

function PinGate({ title, onClose, onConfirm }: { title: string; onClose: () => void; onConfirm: (pin: string) => void }) {
  const [pin, setPin] = useState("");
  const [note, setNote] = useState("Enter your 6-digit wallet PIN to continue.");
  const press = (digit: string) => {
    setNote("Enter your 6-digit wallet PIN to continue.");
    setPin((current) => {
      const next = (current + digit).slice(0, 6);
      return next;
    });
  };
  const submit = () => {
    if (pin.length < 6) {
      setNote("PIN must be 6 digits.");
      return;
    }
    onConfirm(pin);
  };
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"];
  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-[radial-gradient(circle_at_18%_12%,rgba(125,211,252,0.55),transparent_28%),radial-gradient(circle_at_84%_18%,rgba(37,99,235,0.35),transparent_30%),linear-gradient(160deg,#eff8ff_0%,#dff1ff_42%,#ffffff_100%)] text-[#0b1f3a]">
      <div className="mx-auto flex min-h-screen w-full max-w-[520px] flex-col px-6 py-8">
        <div className="flex items-center justify-between">
          <button onClick={onClose} className="grid h-11 w-11 place-items-center rounded-full bg-white/80 text-lg font-black text-[#155e9f] shadow-sm ring-1 ring-sky-100">
            x
          </button>
          <div className="flex items-center gap-2 rounded-full bg-white/85 px-4 py-2 text-sm font-black text-[#155e9f] shadow-sm ring-1 ring-sky-100">
            <Icon name="rooster" className="h-5 w-5" /> FarmConnect
          </div>
        </div>
        <div className="flex flex-1 flex-col justify-center pb-4 pt-10">
          <div className="text-center">
            <div className="mx-auto mb-5 grid h-20 w-20 place-items-center rounded-full bg-white text-[#0f6fb8] shadow-[0_18px_45px_rgba(37,99,235,0.2)] ring-1 ring-sky-100">
              <Icon name="rooster" className="h-10 w-10" />
            </div>
            <h2 className="text-4xl font-black tracking-normal text-[#071b33]">{title}</h2>
            <p className="mt-3 text-base font-bold text-[#4d6f91]">{note}</p>
          </div>
          <div className="mt-10 flex justify-center gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <span key={i} className={"h-5 w-5 rounded-full border-2 " + (pin.length > i ? "border-[#0f6fb8] bg-[#0f6fb8] shadow-[0_0_18px_rgba(14,116,190,0.35)]" : "border-[#7cb7e5] bg-white/70")} />
            ))}
          </div>
          <div className="mx-auto mt-10 grid w-full max-w-[430px] grid-cols-3 gap-5">
            {keys.map((key, i) =>
              key === "" ? (
                <span key={i} />
              ) : key === "del" ? (
                <button key={key} onClick={() => setPin(pin.slice(0, -1))} className="grid aspect-square place-items-center rounded-full bg-white/75 text-xl font-black text-[#155e9f] shadow-sm ring-1 ring-sky-100 transition active:scale-95">
                  Del
                </button>
              ) : (
                <button key={key} onClick={() => press(key)} className="grid aspect-square place-items-center rounded-full bg-white/85 text-5xl font-black text-[#071b33] shadow-[0_12px_30px_rgba(15,111,184,0.12)] ring-1 ring-sky-100 transition active:scale-95">
                  {key}
                </button>
              ),
            )}
          </div>
          <button onClick={submit} className="mx-auto mt-8 w-full max-w-[430px] rounded-2xl bg-[#0f6fb8] px-5 py-4 text-center font-black text-white shadow-[0_14px_30px_rgba(15,111,184,0.25)]">
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
function SavingsModalFc({ lockedSavings, balance, onClose, onLock, onUnlock }: { lockedSavings: number; balance: number; onClose: () => void; onLock: (amount: number) => void; onUnlock: (amount: number) => void }) {
  const initialPocket = lockedSavings > 0 ? { id: "pocket-1", name: "Pang-ipon ko ito", amount: lockedSavings } : null;
  const [pockets, setPockets] = useState<Array<{ id: string; name: string; amount: number }>>(() => (initialPocket ? [initialPocket] : []));
  const [selectedId, setSelectedId] = useState<string | null>(() => initialPocket?.id || null);
  const [mode, setMode] = useState<"list" | "create" | "open" | "add" | "transfer">(() => (initialPocket ? "open" : "list"));
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("500");
  const [targetId, setTargetId] = useState("outside");
  const [pending, setPending] = useState<null | "add" | "outside" | "transfer">(null);
  const [note, setNote] = useState("Create a savings pocket first. You can create up to 4 pockets.");
  const selected = pockets.find((p) => p.id === selectedId) || pockets[0];
  const totalLocked = pockets.reduce((sum, p) => sum + p.amount, 0);
  const available = Math.max(0, balance - totalLocked);
  const amountValue = Number(amount || 0);
  const createPocket = () => {
    if (pockets.length >= 4) {
      setNote("Maximum of 4 savings pockets only.");
      return;
    }
    const next = {
      id: `pocket-${Date.now()}`,
      name: name.trim() || `Savings ${pockets.length + 1}`,
      amount: 0,
    };
    setPockets([...pockets, next]);
    setSelectedId(next.id);
    setName("");
    setMode("open");
    setNote(`${next.name} created. Add FC when you are ready.`);
  };
  const openPocket = (id: string) => {
    setSelectedId(id);
    setMode("open");
    const pocket = pockets.find((p) => p.id === id);
    setNote(`${pocket?.name || "Savings"} opened.`);
  };
  const requestAction = (action: "add" | "outside" | "transfer") => {
    if (!selected) return;
    if (amountValue <= 0) {
      setNote("Enter an amount first.");
      return;
    }
    if (action === "add" && amountValue > available) {
      setNote("Amount is higher than your unlocked balance.");
      return;
    }
    if ((action === "outside" || action === "transfer") && amountValue > selected.amount) {
      setNote("Amount is higher than this savings pocket.");
      return;
    }
    if (action === "transfer" && targetId === selected.id) {
      setNote("Choose another savings pocket or outside balance.");
      return;
    }
    setPending(action);
  };
  const finishAction = () => {
    if (!selected || !pending) return;
    if (pending === "add") {
      setPockets(pockets.map((p) => (p.id === selected.id ? { ...p, amount: p.amount + amountValue } : p)));
      onLock(amountValue);
      setNote(`Added FC ${fcCoin(amountValue)} to ${selected.name}.`);
    }
    if (pending === "outside") {
      setPockets(pockets.map((p) => (p.id === selected.id ? { ...p, amount: Math.max(0, p.amount - amountValue) } : p)));
      onUnlock(amountValue);
      setNote(`Moved FC ${fcCoin(amountValue)} back to unlocked balance.`);
    }
    if (pending === "transfer") {
      setPockets(pockets.map((p) => (p.id === selected.id ? { ...p, amount: Math.max(0, p.amount - amountValue) } : p.id === targetId ? { ...p, amount: p.amount + amountValue } : p)));
      setNote(`Transferred FC ${fcCoin(amountValue)} to another savings pocket.`);
    }
    setPending(null);
    setMode("open");
  };
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4">
      {pending && <PinGate title={pending === "add" ? "Add to Savings" : "Transfer Savings"} onClose={() => setPending(null)} onConfirm={finishAction} />}
      <section className="max-h-[92vh] w-full max-w-5xl overflow-auto rounded-[28px] bg-[#f7fbff] p-5 text-[#071b33] shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white text-[#0f6fb8] shadow-sm ring-1 ring-sky-100">
              <Icon name="shield" className="h-8 w-8" />
            </div>
            <div>
              <h2 className="text-3xl font-black">Save / Lock</h2>
              <p className="mt-1 text-sm font-bold text-[#4d6f91]">Create savings pockets, add FC, or transfer funds.</p>
            </div>
          </div>
          <button onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full bg-white font-black text-[#155e9f] shadow-sm ring-1 ring-sky-100">
            x
          </button>
        </div>
        {pockets.length === 0 && mode !== "create" && (
          <div className="mt-8 grid min-h-[420px] place-items-center rounded-[28px] border-2 border-dashed border-sky-200 bg-white/70 p-8 text-center">
            <button onClick={() => setMode("create")} className="group">
              <span className="mx-auto grid h-28 w-28 place-items-center rounded-full bg-[#0f6fb8] text-6xl font-black text-white shadow-[0_18px_45px_rgba(15,111,184,0.28)] transition group-active:scale-95">+</span>
              <b className="mt-5 block text-2xl">Add Savings</b>
              <span className="mt-2 block max-w-sm text-sm font-bold text-[#4d6f91]">Create a named pocket first. Example: Pang-ipon ko ito, Emergency, Feed fund.</span>
            </button>
          </div>
        )}
        {mode === "create" && (
          <div className="mt-8 grid gap-5 lg:grid-cols-[1fr_360px]">
            <div className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-sky-100">
              <h3 className="text-2xl font-black">Name your savings</h3>
              <p className="mt-2 text-sm font-bold text-[#4d6f91]">You may leave it blank and create a default savings pocket.</p>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Savings name" className="mt-5 w-full rounded-2xl border border-sky-100 px-4 py-4 text-2xl font-black" />
              <button onClick={createPocket} className="mt-4 w-full rounded-2xl bg-[#0f6fb8] px-4 py-4 font-black text-white">
                Create Savings
              </button>
            </div>
            <div className="rounded-[28px] bg-gradient-to-br from-[#0f6fb8] to-[#74c7ff] p-6 text-white shadow-[0_18px_40px_rgba(15,111,184,0.22)]">
              <p className="text-xs font-black uppercase text-white/75">Preview</p>
              <h3 className="mt-2 text-3xl font-black">{name || `Savings ${pockets.length + 1}`}</h3>
              <p className="mt-16 text-sm font-bold text-white/75">Balance</p>
              <p className="text-4xl font-black">FC 0</p>
            </div>
          </div>
        )}
        {pockets.length > 0 && mode !== "create" && (
          <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_360px]">
            <div>
              <div className="rounded-[28px] bg-gradient-to-br from-[#071b33] via-[#0f6fb8] to-[#74c7ff] p-6 text-white shadow-[0_18px_45px_rgba(15,111,184,0.25)]">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-black uppercase text-white/70">Selected Savings</p>
                    <h3 className="mt-2 text-3xl font-black">{selected?.name}</h3>
                  </div>
                  <Badge tone="good">Locked</Badge>
                </div>
                <p className="mt-16 text-sm font-bold text-white/70">Saved Amount</p>
                <p className="text-5xl font-black">FC {fcCoin(selected?.amount || 0)}</p>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                {[0, 1, 2, 3].map((i) =>
                  pockets[i] ? (
                    <button key={pockets[i].id} onClick={() => openPocket(pockets[i].id)} className={"min-h-[132px] rounded-3xl bg-white p-4 text-left shadow-sm ring-1 ring-sky-100 " + (selected?.id === pockets[i].id ? "outline outline-4 outline-sky-200" : "")}>
                      <b className="block text-lg">
                        {i + 1}. {pockets[i].name}
                      </b>
                      <p className="mt-3 text-2xl font-black text-[#0f6fb8]">FC {fcCoin(pockets[i].amount)}</p>
                    </button>
                  ) : (
                    <button key={i} onClick={() => setMode("create")} className="grid min-h-[132px] place-items-center rounded-3xl border-2 border-dashed border-sky-200 bg-sky-50 p-4 text-center text-[#0f6fb8]">
                      <span>
                        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-white text-2xl font-black shadow-sm">+</span>
                        <b className="mt-2 block">Add</b>
                      </span>
                    </button>
                  ),
                )}
              </div>
              <p className="mt-4 rounded-2xl bg-white p-4 text-sm font-bold text-[#4d6f91] shadow-sm ring-1 ring-sky-100">{note}</p>
            </div>
            <div className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-sky-100">
              <h3 className="text-xl font-black">Actions</h3>
              <div className="mt-4 rounded-2xl bg-sky-50 p-3 text-sm font-bold text-[#4d6f91]">
                <div className="flex justify-between gap-3">
                  <span>Unlocked balance</span>
                  <b>FC {fcCoin(available)}</b>
                </div>
                <div className="mt-2 flex justify-between gap-3">
                  <span>Total saved</span>
                  <b>FC {fcCoin(totalLocked)}</b>
                </div>
              </div>
              <label className="mt-4 block text-sm font-black">Amount</label>
              <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="Enter amount" className="mt-2 w-full rounded-2xl border border-sky-100 px-4 py-4 text-3xl font-black" />
              <div className="mt-3 grid grid-cols-3 gap-2">
                {[100, 500, 1000].map((v) => (
                  <button key={v} onClick={() => setAmount(String(v))} className="rounded-xl bg-sky-50 px-3 py-2 text-sm font-black text-[#0f6fb8]">
                    FC {v}
                  </button>
                ))}
              </div>
              {mode === "transfer" && (
                <div>
                  <label className="mt-4 block text-sm font-black">Transfer to</label>
                  <select value={targetId} onChange={(e) => setTargetId(e.target.value)} className="mt-2 w-full rounded-2xl border border-sky-100 px-4 py-3 font-black">
                    <option value="outside">Unlocked balance</option>
                    {pockets
                      .filter((p) => p.id !== selected?.id)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                  </select>
                </div>
              )}
              <button onClick={() => (mode === "transfer" ? requestAction(targetId === "outside" ? "outside" : "transfer") : requestAction("add"))} className="mt-4 w-full rounded-2xl bg-[#0f6fb8] px-4 py-4 font-black text-white">
                {mode === "transfer" ? "Confirm Transfer" : "Add FC"}
              </button>
              <button onClick={() => setMode(mode === "transfer" ? "open" : "transfer")} className="mt-3 w-full rounded-2xl bg-[#eef6ff] px-4 py-4 font-black text-[#0f6fb8]">
                {mode === "transfer" ? "Cancel Transfer" : "Transfer"}
              </button>
              <p className="mt-4 rounded-2xl bg-amber-50 p-3 text-xs font-bold text-[#7a4b00]">Every add or transfer out requires wallet PIN. Locked savings cannot be spent until moved back.</p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
export function WalletPage() {
  const [balance, setBalance] = useState(0);
  const [lockedSavings, setLockedSavings] = useState(0);
  const [showSavings, setShowSavings] = useState(false);
  const [showAmounts, setShowAmounts] = useState(true);
  const [showLockedSavings, setShowLockedSavings] = useState(false);
  const [pinGate, setPinGate] = useState<null | "balance" | "save">(null);
  const [walletNote, setWalletNote] = useState("Loading live wallet records...");
  const [walletRows, setWalletRows] = useState<WalletTransactionRow[]>([]);
  const availableBalance = Math.max(0, balance - lockedSavings);
  useEffect(() => {
    let mounted = true;
    getCurrentProfile()
      .then(async (profile) => {
        if (!mounted || !profile) return;
        setBalance(Number(profile.wallet_balance || 0));
        const rows = await getWalletTransactions(profile.id);
        if (!mounted) return;
        if (rows.length === 0) {
          setWalletRows([]);
          setWalletNote("No wallet transactions yet. Withdrawal records will appear here after admin review.");
          return;
        }
        setWalletRows(
          rows.map((row) => ({
            type: row.transaction_type || "Wallet Transaction",
            date: row.created_at ? new Date(row.created_at).toLocaleDateString("en-PH") : "Today",
            status: row.status || "recorded",
            amount: Number(row.amount || 0),
            receipt: row.id,
          })),
        );
        setWalletNote("Live wallet records are loaded from Supabase.");
      })
      .catch(() => setWalletNote("Wallet is using the safe preview while live records are checked."));
    return () => {
      mounted = false;
    };
  }, []);
  return (
    <Shell role="customer" title="Wallet">
      <PageTitle title="Wallet" text="Withdraw FarmConnect Coin and review transaction records." icon="wallet" />
      {pinGate && (
        <PinGate
          title="Enter Wallet PIN"
          onClose={() => setPinGate(null)}
          onConfirm={() => {
            setShowLockedSavings(true);
            setWalletNote("Locked savings are visible after PIN confirmation.");
            setPinGate(null);
          }}
        />
      )}
      {showSavings && (
        <SavingsModalFc
          lockedSavings={lockedSavings}
          balance={balance}
          onClose={() => setShowSavings(false)}
          onLock={(amount) => {
            const next = Math.min(balance, lockedSavings + amount);
            setLockedSavings(next);
            setShowLockedSavings(true);
            setWalletNote(`FC ${fcCoin(amount)} locked in Save. Total locked: FC ${fcCoin(next)}.`);
          }}
          onUnlock={(amount) => {
            const next = Math.max(0, lockedSavings - amount);
            setLockedSavings(next);
            setShowLockedSavings(true);
            setWalletNote(`FC ${fcCoin(amount)} unlocked. Remaining locked: FC ${fcCoin(next)}.`);
          }}
        />
      )}
      <section className="mx-auto max-w-md space-y-3 sm:hidden">
        <section className="rounded-[24px] border border-white/80 bg-white/96 p-4 text-[#163c2d] shadow-xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase text-[#708078]">Available Balance</p>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-sm font-black text-[#197044]">FC</span>
                <b className="text-4xl">{showAmounts ? fcCoin(availableBalance) : "******"}</b>
              </div>
            </div>
            <button type="button" onClick={() => setShowAmounts(!showAmounts)} className="grid h-10 w-10 place-items-center rounded-full bg-emerald-50 text-[#197044]" aria-label={showAmounts ? "Hide balance" : "Show balance"}>
              <Icon name={showAmounts ? "eyeOff" : "eye"} />
            </button>
          </div>
          <div className="mt-4 h-2 rounded-full bg-[#dfe8e1]">
            <div className="h-full w-2/3 rounded-full bg-[#1d7650]" />
          </div>
        </section>
        <section className="rounded-[22px] border border-white/80 bg-white/96 p-4 text-[#163c2d] shadow-lg">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase text-[#708078]">Locked Savings</p>
              <b className="mt-1 block text-2xl">{showLockedSavings ? `FC ${fcCoin(lockedSavings)}` : "FC ******"}</b>
              <small className="font-bold text-[#708078]">Wallet PIN required</small>
            </div>
            <button type="button" onClick={() => (showLockedSavings ? setShowLockedSavings(false) : setPinGate("save"))} className="grid h-10 w-10 place-items-center rounded-full bg-[#f5f2e8] text-[#197044]">
              <Icon name={showLockedSavings ? "eyeOff" : "eye"} />
            </button>
          </div>
        </section>
        <Link href="/customer/withdraw" className="flex min-h-16 items-center justify-between rounded-[20px] bg-[#14613f] px-4 text-white shadow-lg">
          <span className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/15">
              <Icon name="wallet" />
            </span>
            <span>
              <b className="block">Withdraw Funds</b>
              <small className="text-white/70">Review method and request payout</small>
            </span>
          </span>
          <span>&gt;</span>
        </Link>
        <section className="rounded-[22px] border border-white/80 bg-white/96 p-4 text-[#163c2d] shadow-lg">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black">Transaction History</h2>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black text-[#197044]">Live</span>
          </div>
          <div className="mt-3 space-y-2">
            {walletRows.length === 0 && <p className="rounded-xl bg-[#f6f5ee] p-4 text-xs font-bold text-[#708078]">No transactions yet. Approved payments and withdrawals will appear here.</p>}
            {walletRows.map((t) => (
              <div key={`${t.receipt}-phone`} className="rounded-xl bg-[#f6f5ee] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <b className="block truncate text-sm">{t.type}</b>
                    <small className="block text-[#708078]">
                      {t.date} - {t.status}
                    </small>
                  </div>
                  <b className="shrink-0 text-sm">{showAmounts ? `FC ${fcCoin(t.amount)}` : "******"}</b>
                </div>
                <Link href="/customer/inbox" className="mt-2 inline-flex text-xs font-black text-[#197044]">
                  Open receipt &gt;
                </Link>
              </div>
            ))}
          </div>
        </section>
        <KaFarm>{walletNote}</KaFarm>
      </section>
      <div className="hidden rounded-[28px] bg-[#070716] p-4 text-white shadow-2xl sm:block md:p-6">
        <section className="grid gap-4 lg:grid-cols-2">
          <div className="relative overflow-hidden rounded-[24px] bg-[radial-gradient(circle_at_82%_0%,rgba(255,81,246,0.9),transparent_32%),linear-gradient(135deg,#2810b8_0%,#7719df_48%,#d915c7_100%)] p-5 shadow-[0_18px_45px_rgba(102,22,221,0.45)]">
            <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-fuchsia-300/25 blur-2xl" />
            <div className="relative flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-white/75">Available Balance</p>
                </div>
                <div className="mt-5 flex items-center gap-3">
                  <span className="text-3xl font-black">FC</span>
                  <p className="text-4xl font-black md:text-5xl">{showAmounts ? fcCoin(availableBalance) : "******"}</p>
                  <button onClick={() => setShowAmounts(!showAmounts)} className="grid h-9 w-9 place-items-center rounded-full text-white/90">
                    <Icon name={showAmounts ? "eyeOff" : "eye"} />
                  </button>
                </div>
              </div>
              <span className="mt-12 h-10 w-10" aria-hidden="true" />
            </div>
          </div>
          <div className="relative overflow-hidden rounded-[24px] bg-[radial-gradient(circle_at_82%_0%,rgba(255,81,246,0.75),transparent_32%),linear-gradient(135deg,#21124f_0%,#5a1ab7_48%,#a814b7_100%)] p-5 text-left shadow-[0_18px_45px_rgba(102,22,221,0.35)]">
            <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-fuchsia-300/20 blur-2xl" />
            <div className="relative flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-white/75">Locked Savings</p>
                  <button onClick={() => (showLockedSavings ? setShowLockedSavings(false) : setPinGate("save"))} className="text-white/70">
                    <Icon name={showLockedSavings ? "eyeOff" : "eye"} className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-5 flex items-center gap-3">
                  <span className="text-3xl font-black">FC</span>
                  <p className="text-4xl font-black md:text-5xl">{showLockedSavings ? fcCoin(lockedSavings) : "******"}</p>
                </div>
                <p className="mt-2 text-sm font-bold text-white/65">PIN required</p>
              </div>
              <span className="mt-12 h-10 w-10" aria-hidden="true" />
            </div>
          </div>
        </section>
        <div className="mt-5 grid gap-3">
          <Link href="/customer/withdraw" className="rounded-2xl bg-white/10 p-4 text-left font-black text-white shadow-sm ring-1 ring-white/10">
            <Icon name="wallet" className="mb-3 h-7 w-7" />
            Withdraw Funds
          </Link>
        </div>
        <div className="mt-5 rounded-[24px] bg-white/8 p-4 ring-1 ring-white/10">
          <h2 className="text-xl font-black">Transaction History</h2>
          <div className="mt-4 max-h-[520px] space-y-3 overflow-y-auto pr-2">
            {walletRows.length === 0 && <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-4 text-sm font-bold text-white/65">No transactions yet. Approved payments and withdrawals will appear here.</div>}
            {walletRows.map((t) => (
              <div key={t.receipt} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white/10 p-3 ring-1 ring-white/10">
                <div>
                  <b>{t.type}</b>
                  <p className="text-sm text-white/65">
                    {t.date} - {t.status}
                  </p>
                </div>
                <div className="text-right">
                  <b>{showAmounts ? fcCoin(t.amount) : "******"}</b>
                  <Link href="/customer/inbox" className="ml-3 rounded-lg bg-white/10 px-3 py-2 text-sm font-black">
                    Open Receipt
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Shell>
  );
}

export function CashInPage() {
  const methods = [
    {
      name: "GCash",
      sub: "E-wallet",
      image: "/fc-gcash-qr-crop.png",
      href: "/customer/cashin/gcash",
      activeClass: "bg-[#0b6bff] text-white",
      panelClass: "bg-[#0b6bff]",
      buttonClass: "bg-[#0b6bff]",
    },
    {
      name: "Maya",
      sub: "E-wallet",
      image: "/fc-maya-qr-crop.png",
      href: "/customer/cashin/maya",
      activeClass: "bg-[#08a64b] text-white",
      panelClass: "bg-[#08a64b]",
      buttonClass: "bg-[#08a64b]",
    },
    {
      name: "Bank",
      sub: "UnionBank",
      image: "/fc-bpi-qr-crop.png",
      href: "/customer/cashin/bpi",
      activeClass: "bg-[#f58220] text-white",
      panelClass: "bg-[#f58220]",
      buttonClass: "bg-[#f58220]",
    },
  ];
  const [method, setMethod] = useState(methods[0]);
  const [note, setNote] = useState("Send the exact peso amount, then upload a clear receipt. The same value becomes FarmConnect Coin after approval.");
  const steps = ["Open QR and send payment", "Enter amount and reference", "Upload receipt screenshot", "Submit for checking"];
  const cashinHistory: {
    method: string;
    sender: string;
    amount: number;
    status: string;
    time: string;
  }[] = [];
  return (
    <Shell role="customer" title="Add Cash">
      <PageTitle title="Add Cash" text="Convert peso payment into wallet balance after automated receipt checking." icon="coins" />
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <Card>
          <h2 className="text-xl font-black">Payment Method</h2>
          <div className="mt-4 grid gap-2 rounded-2xl bg-[#f6f3e8] p-2 sm:grid-cols-3">
            {methods.map((m) => (
              <button key={m.name} onClick={() => setMethod(m)} className={"flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-black transition " + (method.name === m.name ? m.activeClass + " shadow-sm" : "bg-white text-[#1f2b20] hover:bg-emerald-50")}>
                <span className="grid text-center leading-tight">
                  <span>{m.name}</span>
                  <span className={"text-[11px] font-bold " + (method.name === m.name ? "text-white/80" : "text-[#667267]")}>{m.sub}</span>
                </span>
                {method.name === m.name && <Icon name="check" className="h-4 w-4" />}
              </button>
            ))}
          </div>
          <div className="mt-5 grid items-start gap-5 md:grid-cols-[210px_1fr]">
            <div className="grid gap-3">
              <div className="h-fit rounded-2xl bg-[#f6f3e8] p-3 shadow-sm">
                <div className="rounded-xl bg-white p-2">
                  <img src={method.image} alt={method.name} className="mx-auto h-[125px] w-full object-contain" />
                </div>
                <div className="mt-3 grid gap-2">
                  <p className="text-center text-sm font-black text-[#667267]">{method.name} QR</p>
                  <Link href={method.href} className="rounded-xl bg-[#1f6b45] px-4 py-2 text-center text-sm font-black text-white">
                    Open QR
                  </Link>
                </div>
              </div>
              <div className="rounded-2xl bg-[#f6f3e8] p-3">
                <h3 className="text-sm font-black">How to Cash In</h3>
                <div className="mt-2 grid gap-2">
                  {steps.map((step, i) => (
                    <div key={step} className="flex gap-2 rounded-xl bg-white px-3 py-2 text-xs font-bold text-[#667267]">
                      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#1f6b45] text-[10px] text-white">{i + 1}</span>
                      {step}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="grid gap-3">
              <label className="text-sm font-black">Amount Sent</label>
              <input inputMode="numeric" placeholder="Example: 3000" className="rounded-2xl border border-[#ded8c9] px-4 py-3 font-black" />
              <label className="text-sm font-black">Reference Number</label>
              <input placeholder="Paste reference number" className="rounded-2xl border border-[#ded8c9] px-4 py-3 font-black" />
              <label className="text-sm font-black">Payment Proof</label>
              <button onClick={() => setNote("Proof upload opened. Make sure the photo shows recipient, amount, date, and reference number.")} className="rounded-2xl border-2 border-dashed border-[#cfc7b5] bg-[#fffdf7] p-4 text-left shadow-sm">
                <span className="flex items-center gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#eee8d9] text-[#1f6b45]">
                    <Icon name="upload" />
                  </span>
                  <span>
                    <b className="block">Upload Proof</b>
                    <span className="text-sm font-bold text-[#667267]">Screenshot or clear photo of payment</span>
                  </span>
                </span>
              </button>
              <button onClick={() => setNote("Auto-check started: reading receipt, checking duplicate reference, matching amount, recipient, and date.")} className="rounded-2xl bg-[#1f6b45] px-4 py-3 font-black text-white">
                Submit for Auto Check
              </button>
            </div>
          </div>
        </Card>
        <Card className="h-fit">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-black">Cash-In History</h2>
            <Badge tone="neutral">Recent</Badge>
          </div>
          <div className="mt-4 max-h-[520px] space-y-3 overflow-y-auto pr-2">
            {cashinHistory.map((row) => (
              <div key={row.method + row.time} className="rounded-2xl border border-[#ece6d8] bg-[#fffdf7] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <b>{row.method}</b>
                    <p className="text-sm font-bold text-[#667267]">From {row.sender}</p>
                  </div>
                  <Badge tone={row.status === "Completed" ? "good" : "warn"}>{row.status}</Badge>
                </div>
                <div className="mt-3 flex items-end justify-between gap-3">
                  <p className="text-sm text-[#667267]">{row.time}</p>
                  <b>{peso(row.amount)}</b>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </Shell>
  );
}

export function CashInQrPage({ name, image }: { name: string; image: string }) {
  return (
    <Shell role="customer" title={`${name} QR`}>
      <PageTitle title={`${name} QR`} text="Open this page when sending cash-in payment." icon="qr" />
      <Card>
        <div className="mx-auto max-w-lg rounded-3xl bg-[#f6f3e8] p-5">
          <img src={image} alt={`${name} QR`} className="mx-auto aspect-square w-full rounded-2xl bg-white object-contain p-5" />
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-black">{name}</h2>
              <p className="text-sm font-bold text-[#667267]">After payment, return to Add Cash and upload the receipt.</p>
            </div>
            <Link href="/customer/cashin" className="rounded-xl bg-[#1f6b45] px-4 py-3 font-black text-white">
              Back
            </Link>
          </div>
        </div>
      </Card>
    </Shell>
  );
}

type PayoutProvider = {
  name: string;
  type: "E-Wallet" | "Bank";
  colors: string;
  text: string;
  hint: string;
};
const payoutProviders: PayoutProvider[] = [
  {
    name: "GCash",
    type: "E-Wallet",
    colors: "from-[#0a6cff] to-[#49a8ff]",
    text: "text-white",
    hint: "Mobile number",
  },
  {
    name: "Maya",
    type: "E-Wallet",
    colors: "from-[#0bbf64] to-[#111827]",
    text: "text-white",
    hint: "Mobile number",
  },
  {
    name: "GoTyme",
    type: "Bank",
    colors: "from-[#00a8e8] to-[#071b33]",
    text: "text-white",
    hint: "GoTyme account number",
  },
  {
    name: "BDO",
    type: "Bank",
    colors: "from-[#0055a5] to-[#f6c500]",
    text: "text-white",
    hint: "BDO account number",
  },
  {
    name: "BPI",
    type: "Bank",
    colors: "from-[#b5121b] to-[#6d0f14]",
    text: "text-white",
    hint: "BPI account number",
  },
  {
    name: "Metrobank",
    type: "Bank",
    colors: "from-[#004b93] to-[#d71920]",
    text: "text-white",
    hint: "Metrobank account number",
  },
  {
    name: "UnionBank",
    type: "Bank",
    colors: "from-[#f58220] to-[#ffb000]",
    text: "text-[#281400]",
    hint: "UnionBank account number",
  },
  {
    name: "Security Bank",
    type: "Bank",
    colors: "from-[#1446a0] to-[#1d77ff]",
    text: "text-white",
    hint: "Security Bank account number",
  },
];
type LivePayoutAccount = {
  id: string;
  provider: string;
  account_holder: string;
  account_number: string;
  status: string;
  is_default: boolean;
};

export function WithdrawPageV2() {
  const [accounts, setAccounts] = useState<LivePayoutAccount[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [amount, setAmount] = useState("");
  const [pinOpen, setPinOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState("Loading your payout methods and withdrawal history...");
  const [problemId, setProblemId] = useState("");
  const [problemNote, setProblemNote] = useState("");
  const [withdrawalAccess, setWithdrawalAccess] = useState({
    kycReady: false,
    available: 0,
  });
  const withdrawalAttemptKey = useRef("");
  const selected = accounts.find((row) => row.id === selectedId) || accounts[0] || null;
  const amountValue = Number(amount || 0);

  async function loadWithdrawalData() {
    try {
      setLoading(true);
      const [profile, methodRows, requestRows] = await Promise.all([getCurrentProfile(), getCustomerPayoutMethods(), getCustomerWithdrawalRequests()]);
      const kycStatus = String(profile?.kyc_status || profile?.verification_status || "").toLowerCase();
      const access = {
        kycReady: ["approved", "verified", "passed"].includes(kycStatus),
        available: Number(profile?.wallet_balance || 0),
      };
      setWithdrawalAccess(access);
      setAccounts(methodRows as LivePayoutAccount[]);
      setRequests(requestRows);
      setSelectedId((current) => ((methodRows as LivePayoutAccount[]).some((row) => row.id === current) ? current : (methodRows as LivePayoutAccount[])[0]?.id || ""));
      setNote(!access.kycReady ? "Withdrawal is locked until your KYC is approved. Open Settings and complete verification first." : methodRows.length ? `Choose a payout method and amount. Available balance: FC ${fcCoin(access.available)}.` : "Add a payout method before requesting a withdrawal.");
    } catch (error) {
      setNote(`Withdrawal records could not load: ${error instanceof Error ? error.message : "Check login and SQL 040."}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadWithdrawalData();
  }, []);

  async function sendWithdrawal(walletPin: string) {
    if (!selected) {
      setNote("Add or select a payout method first.");
      return;
    }
    if (!withdrawalAccess.kycReady) {
      setNote("Withdrawal is locked until your KYC is approved.");
      return;
    }
    if (amountValue < 100) {
      setNote("Minimum withdrawal is FC 100.");
      return;
    }
    if (amountValue > withdrawalAccess.available) {
      setNote(`Available wallet balance is only FC ${fcCoin(withdrawalAccess.available)}.`);
      return;
    }
    try {
      setSaving(true);
      if (!withdrawalAttemptKey.current) {
        withdrawalAttemptKey.current = `withdrawal-${crypto.randomUUID()}`;
      }
      const result = await submitWithdrawalRequest({
        amount: amountValue,
        payoutMethod: selected.provider,
        payoutHolder: selected.account_holder,
        payoutAccount: selected.account_number,
        customerNote: "Customer submitted withdrawal from wallet page.",
        idempotencyKey: withdrawalAttemptKey.current,
        walletPin,
      });
      withdrawalAttemptKey.current = "";
      setAmount("");
      setNote(result.duplicate ? "This withdrawal was already received. No second wallet hold was created." : `Withdrawal sent for admin review. FC ${fcCoin(amountValue)} is now held, not available for another request.`);
      await loadWithdrawalData();
    } catch (error) {
      setNote(`Withdrawal failed: ${readableAppError(error) || "Check wallet balance, KYC, Wallet PIN, and SQL 056."}`);
    } finally {
      setSaving(false);
      setPinOpen(false);
    }
  }

  async function openPayoutProof(row: any) {
    try {
      const url = await createPrivateEvidenceUrl("withdrawal-proofs", row.admin_receipt_url);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      setNote(`Payout proof could not open: ${error instanceof Error ? error.message : "File is missing."}`);
    }
  }

  async function answerConfirmation(row: any, received: boolean) {
    if (!received && problemNote.trim().length < 5) {
      setNote("Write what is wrong with the payout before reporting it.");
      return;
    }
    try {
      setSaving(true);
      if (received) await confirmWithdrawalResult(row.id, true, "Customer confirmed payout received.");
      else await reportWithdrawalProblem(row.id, problemNote.trim());
      setProblemId("");
      setProblemNote("");
      setNote(received ? "Payout confirmed. The withdrawal is complete and remains in your wallet logs." : "Your report is locked for manual Admin investigation. No second payout can be sent until the existing evidence is reviewed.");
      await loadWithdrawalData();
    } catch (error) {
      setNote(`Confirmation failed: ${error instanceof Error ? error.message : "Check SQL 040 and login."}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Shell role="customer" title="Withdraw">
      <PageTitle title="Withdraw Funds" text="Choose payout details, request an amount, then confirm the admin payout proof." icon="wallet" />
      {pinOpen && selected && <PinGate title="Confirm Withdrawal Request" onClose={() => setPinOpen(false)} onConfirm={(pin) => void sendWithdrawal(pin)} />}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="grid gap-5">
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black">Payout Method</h2>
                <p className="mt-1 text-sm font-bold text-[#667267]">The selected method is copied into the admin request and permanent evidence log.</p>
              </div>
              <Link href="/customer/withdraw/add-payout" className="rounded-xl bg-[#0f6fb8] px-4 py-3 font-black text-white">
                Add Method
              </Link>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {accounts.map((row, index) => (
                <button key={`${row.id}-${row.provider}-${row.account_number}-${index}`} type="button" onClick={() => setSelectedId(row.id)} className={"rounded-2xl border p-4 text-left transition " + (selected?.id === row.id ? "border-[#1f6b45] bg-emerald-50 ring-2 ring-emerald-100" : "border-[#e3ded0] bg-[#fffdf7]")}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase text-[#667267]">{row.provider}</p>
                      <h3 className="mt-1 text-lg font-black">{row.account_holder}</h3>
                      <p className="mt-2 text-sm font-bold text-[#667267]">{row.account_number}</p>
                    </div>
                    {row.is_default && <Badge tone="good">Default</Badge>}
                  </div>
                </button>
              ))}
              {!loading && !accounts.length && <div className="rounded-2xl border-2 border-dashed border-[#d8cfbd] bg-[#f9f6ec] p-5 text-sm font-bold text-[#667267]">No payout method yet. Add GCash, Maya, or bank details first.</div>}
            </div>
          </Card>
          <Card>
            <h2 className="text-xl font-black">Withdrawal Amount</h2>
            {!withdrawalAccess.kycReady && (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold leading-6 text-amber-900">
                KYC approval is required before withdrawal. Complete verification in{" "}
                <Link href="/customer/settings" className="font-black underline">
                  Settings
                </Link>
                .
              </div>
            )}
            <div className="mt-4 grid gap-3 md:grid-cols-[1fr_220px]">
              <input value={amount} onChange={(event) => setAmount(event.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="Minimum FC 100" className="rounded-2xl border border-[#ded8c9] px-4 py-4 text-2xl font-black" />
              <button type="button" disabled={!selected || !withdrawalAccess.kycReady || amountValue < 100 || amountValue > withdrawalAccess.available || saving} onClick={() => setPinOpen(true)} className="rounded-2xl bg-[#1f6b45] px-4 py-4 font-black text-white disabled:bg-[#b9b3a4]">
                Request Withdrawal
              </button>
            </div>
            <p className="mt-3 text-sm font-bold text-[#667267]">The amount is deducted from available balance and placed on hold immediately. A rejected request is refunded automatically.</p>
          </Card>
        </div>
        <Card className="h-fit">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-black">Withdrawal History</h2>
            <Badge tone="neutral">{requests.length}</Badge>
          </div>
          <p className="mt-2 rounded-xl bg-[#f4efe4] p-3 text-sm font-bold leading-6 text-[#667267]">{note}</p>
          <p className="mt-2 text-xs font-bold text-[#667267]">After admin sends proof: confirm payout or report incorrect payout.</p>
          <div className="mt-4 max-h-[650px] space-y-3 overflow-y-auto pr-2">
            {requests.map((row, index) => (
              <article key={`${row.id}-${row.status}-${row.created_at || "no-date"}-${index}`} className="rounded-2xl border border-[#ece6d8] bg-[#fffdf7] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <b className="text-lg">{peso(Number(row.amount || 0))}</b>
                    <p className="mt-1 text-sm font-bold text-[#667267]">
                      {row.payout_method} / {row.payout_account}
                    </p>
                  </div>
                  <Badge tone={row.status === "completed" ? "good" : row.status === "rejected" ? "bad" : "warn"}>{String(row.status || "pending").replaceAll("_", " ")}</Badge>
                </div>
                {row.admin_reference_number && (
                  <div className="mt-3 grid gap-2 rounded-xl bg-[#f4efe4] p-3 text-sm font-bold">
                    <span>Reference: {row.admin_reference_number}</span>
                    <span>Receipt: {row.admin_receipt_file_name || "Attached by admin"}</span>
                    <button type="button" onClick={() => void openPayoutProof(row)} className="rounded-lg bg-white px-3 py-2 text-left font-black text-[#1f6b45]">
                      View Uploaded Receipt
                    </button>
                  </div>
                )}
                {row.admin_note && <p className="mt-3 text-sm font-bold leading-6 text-[#667267]">Admin note: {row.admin_note}</p>}
                {["under_investigation", "needs_info"].includes(String(row.status || "")) && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm font-black text-amber-900">Waiting for Admin investigation. The original payout evidence is locked and no resubmit or second payout is allowed.</p>}
                {row.status === "sent_for_customer_confirmation" && (
                  <div className="mt-3 grid gap-2">
                    <button type="button" disabled={saving} onClick={() => void answerConfirmation(row, true)} className="rounded-xl bg-[#1f6b45] px-4 py-3 font-black text-white">
                      I Received the Payout
                    </button>
                    {problemId === row.id ? (
                      <>
                        <textarea value={problemNote} onChange={(event) => setProblemNote(event.target.value)} placeholder="Explain the wrong amount, method, account, reference, or missing payout." className="h-24 resize-none rounded-xl border border-[#ded8c9] p-3 text-sm font-bold" />
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setProblemId("");
                              setProblemNote("");
                            }}
                            className="rounded-xl bg-[#eee8d9] px-3 py-2 font-black"
                          >
                            Cancel
                          </button>
                          <button type="button" disabled={saving} onClick={() => void answerConfirmation(row, false)} className="rounded-xl bg-red-600 px-3 py-2 font-black text-white">
                            Send Problem
                          </button>
                        </div>
                      </>
                    ) : (
                      <button type="button" onClick={() => setProblemId(row.id)} className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 font-black text-red-700">
                        Report a Problem
                      </button>
                    )}
                  </div>
                )}
              </article>
            ))}
            {!loading && !requests.length && <div className="rounded-2xl bg-[#f4efe4] p-5 text-sm font-bold text-[#667267]">No withdrawal records yet.</div>}
          </div>
        </Card>
      </div>
    </Shell>
  );
}

export function AddPayoutPageV2() {
  const [provider, setProvider] = useState<PayoutProvider>(payoutProviders[0]);
  const [holder, setHolder] = useState("");
  const [account, setAccount] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("Choose a method and enter the exact account details.");
  const ready = holder.trim().length > 2 && account.trim().length >= 6;

  async function save() {
    try {
      setSaving(true);
      await saveCustomerPayoutMethod({
        provider: provider.name,
        accountHolder: holder.trim(),
        accountNumber: account.trim(),
        isDefault: true,
      });
      setMessage(`${provider.name} saved. Return to Withdraw and select this account.`);
    } catch (error) {
      setMessage(`Payout method could not be saved: ${error instanceof Error ? error.message : "Check SQL 040 and login."}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Shell role="customer" title="Add Payout">
      <PageTitle title="Add Payout Method" text="Save the exact e-wallet or bank details used for withdrawal." icon="wallet" />
      <div className="grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)_340px]">
        <Card>
          <h2 className="text-xl font-black">Method</h2>
          <div className="mt-4 max-h-[560px] space-y-2 overflow-y-auto pr-2">
            {payoutProviders.map((row) => (
              <button key={row.name} type="button" onClick={() => setProvider(row)} className={"w-full rounded-xl border p-3 text-left font-black " + (provider.name === row.name ? "border-[#1f6b45] bg-emerald-50" : "border-[#e3ded0] bg-white")}>
                {row.name}
                <span className="block text-xs text-[#667267]">{row.type}</span>
              </button>
            ))}
          </div>
        </Card>
        <Card>
          <h2 className="text-xl font-black">Account Details</h2>
          <div className="mt-4 grid gap-3">
            <Info label="Selected Method" value={provider.name} />
            <label className="text-sm font-black">
              Account Holder
              <input value={holder} onChange={(event) => setHolder(event.target.value)} placeholder="Exact name on account" className="mt-2 w-full rounded-xl border border-[#ded8c9] p-3 font-bold" />
            </label>
            <label className="text-sm font-black">
              Account / Mobile Number
              <input value={account} onChange={(event) => setAccount(event.target.value)} inputMode="numeric" placeholder={provider.hint} className="mt-2 w-full rounded-xl border border-[#ded8c9] p-3 font-bold" />
            </label>
          </div>
        </Card>
        <Card className="h-fit">
          <h2 className="text-xl font-black">Review</h2>
          <p className="mt-2 text-sm font-bold leading-6 text-[#667267]">Admin will send money only to these exact details. You may save a payout method before KYC; KYC approval is required only when you request a withdrawal.</p>
          <p className="mt-4 rounded-xl bg-[#f4efe4] p-3 text-sm font-bold">{message}</p>
          <button type="button" disabled={!ready || saving} onClick={() => void save()} className="mt-4 w-full rounded-xl bg-[#1f6b45] px-4 py-4 font-black text-white disabled:bg-[#b9b3a4]">
            {saving ? "Saving..." : "Save Method"}
          </button>
          <Link href="/customer/withdraw" className="mt-3 block rounded-xl bg-[#eee8d9] px-4 py-3 text-center font-black">
            Back to Withdraw
          </Link>
        </Card>
      </div>
    </Shell>
  );
}
export function InboxPage() {
  const router = useRouter();
  const categories = [
    {
      name: "All",
      label: "All Inbox",
      note: "Everything pending or recorded",
      icon: "inbox" as IconName,
    },
    {
      name: "Receipts",
      label: "Receipts",
      note: "Farm Buy invoices and wallet receipts",
      icon: "file" as IconName,
    },
    {
      name: "Caretaker Updates",
      label: "Caretaker Updates",
      note: "Proof updates that open Care Logs",
      icon: "rooster" as IconName,
    },
    {
      name: "Alerts",
      label: "Wallet Alerts",
      note: "Cash-in, withdrawal, and review notices",
      icon: "alert" as IconName,
    },
    {
      name: "Messages",
      label: "Messages",
      note: "Support and admin conversations",
      icon: "chat" as IconName,
    },
  ];
  const [category, setCategory] = useState("All");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("Newest first");
  const [removed, setRemoved] = useState<string[]>([]);
  const [read, setRead] = useState<string[]>([]);
  const [liveInbox, setLiveInbox] = useState<any[]>([]);
  const [note, setNote] = useState("Loading inbox records...");

  useEffect(() => {
    let mounted = true;
    const refreshInbox = () =>
      getCurrentProfile()
        .then((profile) => (profile ? getInboxItems(profile.id) : []))
        .then((rows) => {
          if (!mounted) return;
          const mapped = (rows || []).map((row: any) => {
            const rawCategory = String(row.category || "message").toLowerCase();
            const title = row.title || "Inbox item";
            const text = row.body || row.message || row.description || "Open this record for details.";
            const searchable = `${title} ${text}`.toLowerCase();
            const isPaymentRecord = rawCategory === "receipt" || rawCategory === "invoice" || /payment|receipt|invoice|amount:|reference:/.test(searchable);
            const isWithdrawalRecord = rawCategory === "withdraw" || searchable.includes("withdrawal");
            const isCarePayment = isPaymentRecord && (searchable.includes("care request") || searchable.includes("source: care_request"));
            const isCashPayment = isPaymentRecord && /cash[ -]?in/.test(searchable);
            const tab = isWithdrawalRecord ? "Alerts" : isPaymentRecord ? "Receipts" : rawCategory === "farm_update" || rawCategory === "care" ? "Caretaker Updates" : rawCategory === "wallet" || rawCategory === "cashin" || rawCategory === "alert" ? "Alerts" : "Messages";
            const reference = text.match(/Reference:\s*([^\.]+)/i)?.[1]?.trim();
            const paymentRequestId = text.match(/Payment Request:\s*([a-f0-9-]+)/i)?.[1]?.trim();
            const invoicePath = isCarePayment ? "/customer/inbox/invoice/care-request" : isCashPayment ? "/customer/inbox/invoice/cashin" : "/customer/inbox/invoice/farm-buy";
            const invoiceQuery = paymentRequestId ? `?payment=${encodeURIComponent(paymentRequestId)}` : reference ? `?reference=${encodeURIComponent(reference)}` : "";
            const href = isWithdrawalRecord ? "/customer/withdraw" : tab === "Receipts" ? `${invoicePath}${invoiceQuery}` : tab === "Caretaker Updates" ? "/customer/care-logs" : undefined;
            const status = searchable.includes("for admin review") || searchable.includes("waiting for admin") ? "Pending" : searchable.includes("rejected") ? "Rejected" : searchable.includes("needs more info") || searchable.includes("needs correction") || searchable.includes("problem was sent back") ? "Needs Info" : searchable.includes("completed") || searchable.includes("complete and remains") ? "Completed" : searchable.includes("approved") ? "Approved" : searchable.includes("submitted") || searchable.includes("recorded") ? "Recorded" : String(row.status || "Recorded").replaceAll("_", " ");
            return {
              id: row.id,
              title,
              text,
              status,
              tab,
              action: isWithdrawalRecord ? "withdrawal" : href?.includes("invoice") ? "invoice" : href ? "carelogs" : "read",
              href,
              created_at: row.created_at,
              is_read: Boolean(row.is_read),
            };
          });
          setLiveInbox(mapped);
          setRead(mapped.filter((row: any) => row.is_read).map((row: any) => String(row.id)));
          setNote(mapped.length ? "Live Supabase inbox loaded." : "No live inbox records yet. Receipts will appear here after Farm Buy checkout.");
        })
        .catch(() => {
          setLiveInbox([]);
          setNote("Inbox records could not be loaded. Please refresh or login again.");
        });
    void refreshInbox();
    const interval = window.setInterval(refreshInbox, 10000);
    const refreshOnFocus = () => void refreshInbox();
    window.addEventListener("focus", refreshOnFocus);
    return () => {
      mounted = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshOnFocus);
    };
  }, []);

  const list = liveInbox
    .map((item, index) => ({
      ...item,
      inboxKey: String(item.id || `${item.created_at || "live"}-${item.title}-${index}`),
    }))
    .filter((i) => !removed.includes(i.inboxKey));
  const filtered = list
    .filter((i) => category === "All" || i.tab === category)
    .filter((i) => (i.title + " " + i.text + " " + i.status).toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => (sort === "Unread first" ? Number(read.includes(a.inboxKey)) - Number(read.includes(b.inboxKey)) : sort === "Oldest first" ? String(a.created_at || a.title).localeCompare(String(b.created_at || b.title)) : String(b.created_at || b.title).localeCompare(String(a.created_at || a.title))));
  const actionLabel = (item: any) => (item.action === "withdrawal" ? "Open Withdrawal" : item.action === "invoice" ? "Open Receipt" : item.action === "carelogs" ? "Open Care Logs" : "Mark Read");
  async function markItemRead(item: any) {
    if (!read.includes(item.inboxKey)) {
      try {
        await markInboxItemRead(item.id);
        setRead((current) => (current.includes(item.inboxKey) ? current : [...current, item.inboxKey]));
        window.dispatchEvent(new Event("farmconnect:inbox-changed"));
      } catch (error) {
        setNote(`Could not mark notification as read: ${readableAppError(error) || "Please refresh and try again."}`);
        return false;
      }
    }
    return true;
  }
  async function openOrMarkRead(item: any) {
    const marked = await markItemRead(item);
    if (!marked) return;
    if (item.href) router.push(item.href);
  }
  async function markAllRead() {
    const unread = list.filter((item) => !read.includes(item.inboxKey));
    if (!unread.length) {
      setNote("All Inbox notifications are already read.");
      return;
    }
    setNote(`Marking ${unread.length} notification${unread.length === 1 ? "" : "s"} as read...`);
    const results = await Promise.all(unread.map((item) => markItemRead(item)));
    setNote(results.every(Boolean) ? "All Inbox notifications are now read." : "Some notifications could not be marked as read. Please retry.");
  }
  return (
    <Shell role="customer" title="Inbox">
      <PageTitle title="Inbox" text="Notifications only: receipts, caretaker updates, wallet alerts, and support messages." icon="inbox" />
      <KaFarm>{note}</KaFarm>
      <section className="min-w-0 overflow-hidden rounded-3xl bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black">Inbox Categories</h2>
            <p className="text-xs font-bold text-[#667267]">Swipe or scroll sideways to view every category.</p>
          </div>
          <button type="button" onClick={() => void markAllRead()} disabled={!list.some((item) => !read.includes(item.inboxKey))} className="shrink-0 rounded-xl bg-[#1f6b45] px-4 py-2.5 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-[#b9b3a4]">
            Mark All as Read
          </button>
        </div>
        <div className="mt-3 flex max-w-full gap-2 overflow-x-auto pb-2">
          {categories.map((c) => {
            const count = c.name === "All" ? list.filter((i) => !read.includes(i.inboxKey)).length : list.filter((i) => i.tab === c.name && !read.includes(i.inboxKey)).length;
            return (
              <button key={c.name} onClick={() => setCategory(c.name)} className={"flex min-w-[190px] shrink-0 items-center gap-3 rounded-2xl px-3 py-3 text-left transition sm:min-w-[215px] " + (category === c.name ? "bg-[#1f6b45] text-white shadow-sm" : "bg-[#fffdf7] ring-1 ring-[#ece6d8] hover:bg-[#f6f3e8]")}>
                <span className={"grid h-11 w-11 shrink-0 place-items-center rounded-2xl " + (category === c.name ? "bg-white/15" : "bg-[#f1eadb] text-[#1f6b45]")}>
                  <Icon name={c.icon} className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-black">{c.label}</span>
                  <span className={"block truncate text-xs font-bold " + (category === c.name ? "text-white/75" : "text-[#667267]")}>{c.note}</span>
                </span>
                {count > 0 && <span className={"shrink-0 rounded-full px-2 py-1 text-xs font-black " + (category === c.name ? "bg-white/20" : "bg-[#f6f3e8] text-[#667267]")}>{count}</span>}
              </button>
            );
          })}
        </div>
      </section>
      <section className="mt-5 min-w-0 rounded-3xl bg-white p-4 shadow-sm">
        <div className="grid min-w-0 gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
          <div className="relative min-w-0">
            <Icon name="search" className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#667267]" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search inbox" className="w-full min-w-0 rounded-2xl border border-[#ded8c9] bg-[#fffdf7] py-3 pl-12 pr-4 font-bold" />
          </div>
          <select value={sort} onChange={(e) => setSort(e.target.value)} className="w-full rounded-2xl border border-[#ded8c9] bg-white px-4 py-3 font-black">
            <option>Newest first</option>
            <option>Oldest first</option>
            <option>Unread first</option>
          </select>
        </div>
        <div className="mt-4 max-h-[680px] space-y-3 overflow-y-auto pr-1 sm:pr-2">
          {filtered.map((i) => {
            const isRead = read.includes(i.inboxKey);
            return (
              <article key={i.inboxKey} className={"rounded-2xl border p-4 transition " + (isRead ? "border-[#ece6d8] bg-white" : "border-[#d6ead9] bg-[#fffdf7]")}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-black uppercase tracking-wide text-[#667267]">{i.tab}</p>
                    <h3 className="mt-1 break-words text-lg font-black">{i.title}</h3>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge tone={i.status === "Pending" || i.status === "Needs Info" ? "warn" : i.status === "Rejected" ? "bad" : "good"}>{i.status}</Badge>
                    {!isRead && <span className="h-2.5 w-2.5 rounded-full bg-[#1f6b45]" />}
                  </div>
                </div>
                <p className="mt-2 break-words text-sm font-bold leading-6 text-[#667267]">{i.text}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[#ece6d8] pt-3">
                  {i.href && (
                    <button type="button" onClick={() => void openOrMarkRead(i)} className="rounded-xl bg-[#1f6b45] px-3 py-2 text-sm font-black text-white">
                      {actionLabel(i)}
                    </button>
                  )}
                  {!isRead && (
                    <button type="button" onClick={() => void markItemRead(i)} className="rounded-xl bg-[#eee8d9] px-3 py-2 text-sm font-black">
                      Mark as Read
                    </button>
                  )}
                  {isRead && <span className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-black text-emerald-800">Read</span>}
                  <button onClick={() => setRemoved([...removed, i.inboxKey])} title="Move to recycle bin" aria-label="Move to recycle bin" className="grid h-9 w-9 place-items-center rounded-xl bg-white text-red-700 shadow-sm ring-1 ring-[#f0d8d8]">
                    <Icon name="trash" className="h-4 w-4" />
                  </button>
                </div>
              </article>
            );
          })}
          {filtered.length === 0 && <p className="rounded-2xl bg-[#f6f3e8] p-4 text-sm font-bold text-[#667267]">No notifications found.</p>}
        </div>
      </section>
    </Shell>
  );
}

type PaymentContext = {
  sourceType: "farm_buy" | "care_request" | "care_plan" | "cashin" | "other";
  sourceRef: string;
  amountExpected: number;
  summary: any;
};

const paymentReceivers = [
  {
    method: "GCash",
    account: "FarmConnect GCash",
    detail: "09XX XXX XXXX",
    qr: "/fc-gcash-qr-crop.png",
    color: "from-[#0b67d8] to-[#53b6ff]",
    text: "text-white",
    badge: "bg-white/20",
  },
  {
    method: "Maya",
    account: "FarmConnect Maya",
    detail: "09XX XXX XXXX",
    qr: "/fc-maya-qr-crop.png",
    color: "from-[#07814f] to-[#3ee083]",
    text: "text-white",
    badge: "bg-white/20",
  },
  {
    method: "Bank",
    account: "FarmConnect Bank",
    detail: "BPI / bank QR",
    qr: "/fc-bpi-qr-crop.png",
    color: "from-[#f06d18] to-[#ffca55]",
    text: "text-[#3d1f0a]",
    badge: "bg-white/35",
  },
];

export function CustomerPaymentPage() {
  const router = useRouter();
  const paymentOperationKey = useRef("");
  const [context, setContext] = useState<PaymentContext>({
    sourceType: "other",
    sourceRef: "manual",
    amountExpected: 0,
    summary: { source: "Manual Payment", lines: [] },
  });
  const [method, setMethod] = useState(paymentReceivers[0]);
  const [qrOpen, setQrOpen] = useState<(typeof paymentReceivers)[number] | null>(null);
  const [sender, setSender] = useState("");
  const [reference, setReference] = useState("");
  const [receipt, setReceipt] = useState("");
  const [note, setNote] = useState("Upload payment proof with sender name and reference number. Admin approval is required before anything is completed.");
  const [submittedId, setSubmittedId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const ready = sender.trim().length > 2 && reference.trim().length >= 4 && Boolean(receipt);

  useEffect(() => {
    try {
      const stored = JSON.parse(window.localStorage.getItem("farmconnect_payment_context") || "null");
      if (stored)
        setContext({
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
      if (!paymentOperationKey.current) {
        paymentOperationKey.current = globalThis.crypto?.randomUUID?.() || `payment-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      }
      const result = await submitManualPaymentRequest({
        sourceType: context.sourceType,
        sourceRef: context.sourceRef,
        amountExpected: context.amountExpected,
        summary: context.summary,
        paymentMethod: method.method,
        receiverAccount: method.account,
        senderName: sender,
        referenceNumber: reference,
        receiptImageUrl: receipt,
        idempotencyKey: paymentOperationKey.current,
      });
      setSubmittedId(result.id);
      setNote(result.duplicate ? "This payment was already received. Returning to dashboard without creating a duplicate request." : "Payment proof submitted. Returning to dashboard. Check Inbox for the review notice.");
      window.localStorage.removeItem("farmconnect_payment_context");
      window.setTimeout(() => router.push("/customer/dashboard"), 900);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      setSubmittedId("");
      const normalizedMessage = message.toLowerCase();
      setNote(normalizedMessage.includes("failed to fetch") || normalizedMessage.includes("network") ? "Connection was interrupted. Nothing was submitted to admin. Check your connection, then tap Submit again." : message === "LOGIN_REQUIRED" || message.includes("401") || normalizedMessage.includes("unauthorized") || normalizedMessage.includes("jwt") ? "Payment was not submitted. Please login as customer first, then submit again." : "Payment was not submitted to admin. Check the error, then submit again after DB/RLS is fixed.");
    } finally {
      setSubmitting(false);
    }
  }

  const lines = Array.isArray(context.summary?.lines) ? context.summary.lines : [];
  const title = context.sourceType === "farm_buy" ? "Farm Buy Payment" : context.sourceType === "care_request" ? "Care Request Payment" : context.sourceType === "care_plan" ? "Care Plan Payment" : "Manual Payment";
  return (
    <Shell role="customer" title="Payment">
      {qrOpen && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-black/50 p-4">
          <section className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase text-[#667267]">Scan to pay</p>
                <h2 className="text-2xl font-black">{qrOpen.account}</h2>
                <p className="mt-1 text-sm font-bold text-[#667267]">{qrOpen.detail}</p>
              </div>
              <button onClick={() => setQrOpen(null)} className="grid h-10 w-10 place-items-center rounded-full bg-[#f6f3e8] font-black">
                x
              </button>
            </div>
            <div className="mt-5 rounded-3xl border-4 border-[#1f6b45] bg-white p-4">
              <img src={qrOpen.qr} alt={`${qrOpen.method} QR`} className="mx-auto aspect-square w-full object-contain" />
            </div>
            <p className="mt-4 rounded-2xl bg-amber-50 p-3 text-sm font-bold text-[#7a4b00]">After sending payment, return here and upload the receipt with reference number.</p>
          </section>
        </div>
      )}
      <PageTitle title={title} text="Send payment externally, then upload reference number and receipt for admin approval." icon="coins" />
      <KaFarm>{note}</KaFarm>
      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_380px]">
        <div className="grid gap-5">
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase text-[#667267]">Amount To Pay</p>
                <h2 className="mt-1 text-4xl font-black">{peso(context.amountExpected)}</h2>
                <p className="mt-2 text-sm font-bold text-[#667267]">{context.summary?.source || title} - admin review required</p>
              </div>
              <Badge tone={submittedId ? "good" : "warn"}>{submittedId ? "Submitted" : "Not paid yet"}</Badge>
            </div>
            {lines.length > 0 && (
              <div className="mt-5 max-h-[280px] space-y-2 overflow-y-auto pr-2">
                {lines.map((line: any, i: number) => (
                  <div key={i} className="flex justify-between gap-3 rounded-xl bg-[#f6f3e8] p-3 text-sm font-bold">
                    <span>
                      {line.name} x {line.quantity}
                    </span>
                    <span>{peso(Number(line.total || 0))}</span>
                  </div>
                ))}
              </div>
            )}
            {context.sourceType === "care_request" && (
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <Info label="Rooster" value={context.summary?.rooster?.name || "Selected rooster"} />
                <Info label="Service" value={context.summary?.service?.name || "Care service"} />
                <Info label="Customer Note" value={context.summary?.customer_note || "No note"} />
                <Info label="Status" value="Payment for review" />
              </div>
            )}
            {context.sourceType === "care_plan" && (
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <Info label="Package" value={`${Number(context.summary?.duration_days || 0)}-day Care Plan`} />
                <Info label="Customer Feed Reserved" value={`${Number(context.summary?.feed_required_kg || 0).toFixed(3)} kg`} />
                <Info label="Average Feed / Day" value={`${Number(context.summary?.average_daily_feed_kg || 0).toFixed(3)} kg`} />
                <Info label="Average Service / Day" value="₱166.67" />
                <Info label="Coverage" value="Daily caretaker missions" />
                <Info label="Status" value="Payment for review" />
              </div>
            )}
          </Card>
          <Card>
            <h2 className="text-xl font-black">1. Choose Where You Paid</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {paymentReceivers.map((row) => (
                <div key={row.method} className={"overflow-hidden rounded-3xl bg-gradient-to-br p-4 shadow-sm transition " + row.color + " " + row.text + (method.method === row.method ? " ring-4 ring-white" : "")}>
                  <button onClick={() => setMethod(row)} className="w-full text-left">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-black uppercase opacity-75">Payment channel</p>
                        <b className="mt-1 block text-xl">{row.method}</b>
                      </div>
                      <span className={"rounded-full px-3 py-1 text-xs font-black " + row.badge}>{method.method === row.method ? "Selected" : "Select"}</span>
                    </div>
                    <p className="mt-5 text-sm font-black">{row.account}</p>
                    <p className="text-xs font-bold opacity-80">{row.detail}</p>
                  </button>
                  <button
                    onClick={() => {
                      setMethod(row);
                      setQrOpen(row);
                    }}
                    className="mt-4 w-full rounded-2xl bg-white/90 px-4 py-3 text-sm font-black text-[#123229] shadow-sm"
                  >
                    View QR
                  </button>
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <h2 className="text-xl font-black">2. Payment Proof</h2>
            <div className="mt-4 rounded-2xl border border-[#ded8c9] bg-[#f6f3e8] p-4">
              <p className="text-xs font-black uppercase text-[#667267]">Sent To / Admin Check</p>
              <p className="mt-1 text-xl font-black">{method.account}</p>
              <p className="text-sm font-bold text-[#667267]">
                {method.method} - {method.detail}
              </p>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <input value={sender} onChange={(e) => setSender(e.target.value)} placeholder="Sender name shown on receipt" className="rounded-2xl border border-[#ded8c9] px-4 py-3 font-bold" />
              <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Reference number" className="rounded-2xl border border-[#ded8c9] px-4 py-3 font-bold" />
              <label className="md:col-span-2 cursor-pointer rounded-3xl border-2 border-dashed border-[#ded8c9] bg-[#fffdf7] p-4 text-center font-black hover:border-[#1f6b45]">
                <input type="file" accept="image/*" className="hidden" onChange={(e) => chooseReceipt(e.target.files?.[0])} />
                {receipt ? "Receipt attached" : "Upload receipt screenshot"}
              </label>
              {receipt && <img src={receipt} alt="Receipt preview" className="md:col-span-2 max-h-72 w-full rounded-2xl object-contain bg-white p-2" />}
            </div>
            <button type="button" onClick={submitPayment} className={"mt-4 w-full rounded-2xl px-4 py-4 font-black text-white " + (submitting ? "bg-[#7f9b8d]" : "bg-[#1f6b45]")}>
              {submitting ? "Submitting..." : "Submit For Admin Review"}
            </button>
          </Card>
        </div>
        <Card className="h-fit">
          <h2 className="text-xl font-black">What Happens Next</h2>
          <div className="mt-4 grid gap-3 text-sm font-bold text-[#667267]">
            <p className="rounded-xl bg-[#f6f3e8] p-3">1. Your reference number and receipt become evidence.</p>
            <p className="rounded-xl bg-[#f6f3e8] p-3">2. Admin reviews the exact channel you selected.</p>
            <p className="rounded-xl bg-[#f6f3e8] p-3">3. Approval moves this purchase or care workflow to its next guarded step.</p>
            <p className="rounded-xl bg-[#f6f3e8] p-3">4. You receive inbox notice for approved, rejected, or needs more info.</p>
          </div>
          {submittedId && (
            <div className="mt-5 grid gap-2">
              <Link href="/customer/inbox" className="rounded-xl bg-[#1f6b45] px-4 py-3 text-center font-black text-white">
                Open Inbox
              </Link>
              <Link href={context.sourceType === "farm_buy" ? "/customer/farm-buy" : "/customer/farm-requests"} className="rounded-xl bg-[#eee8d9] px-4 py-3 text-center font-black">
                Back
              </Link>
            </div>
          )}
        </Card>
      </div>
    </Shell>
  );
}

export function CustomerInvoicePage({ type = "farm-buy" }: { type?: "farm-buy" | "cashin" | "care-request" }) {
  const isFarmBuy = type === "farm-buy";
  const isCareRequest = type === "care-request";
  const [requestedPaymentId, setRequestedPaymentId] = useState("");
  const [requestedReference, setRequestedReference] = useState("");
  const correctionOperationKey = useRef("");
  const [invoiceNote, setInvoiceNote] = useState("Loading latest payment record...");
  const [receipt, setReceipt] = useState<any | null>(null);
  const [payment, setPayment] = useState<any | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [correctionMethod, setCorrectionMethod] = useState(paymentReceivers[0]);
  const [correctionSender, setCorrectionSender] = useState("");
  const [correctionReference, setCorrectionReference] = useState("");
  const [correctionReceipt, setCorrectionReceipt] = useState("");
  const [customerExplanation, setCustomerExplanation] = useState("");
  const [resubmitting, setResubmitting] = useState(false);
  const [resubmittedId, setResubmittedId] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setRequestedPaymentId(params.get("payment") || "");
    setRequestedReference(params.get("reference") || "");
  }, []);

  useEffect(() => {
    let mounted = true;
    getCurrentProfile()
      .then(async (profile) => {
        if (!profile) return { inbox: [], payments: [] };
        const [inbox, payments] = await Promise.all([getInboxItems(profile.id), getCustomerManualPaymentRequests()]);
        return { inbox, payments };
      })
      .then(({ inbox, payments }) => {
        if (!mounted) return;
        const sourceType = isCareRequest ? "care_request" : isFarmBuy ? "farm_buy" : "cashin";
        const sourcePayments = (payments || []).filter((row: any) => String(row.source_type || "").toLowerCase() === sourceType);
        const latestPayment = sourcePayments.find((row: any) => requestedPaymentId && row.id === requestedPaymentId) || sourcePayments.find((row: any) => requestedReference && String(row.reference_number || "") === requestedReference) || sourcePayments[0] || null;
        const latestReceipt =
          (inbox || []).find((row: any) => {
            const text = `${row.title || ""} ${row.body || ""}`.toLowerCase();
            return isCareRequest ? text.includes("care request") : isFarmBuy ? text.includes("farm buy") : text.includes("cash");
          }) || null;
        setPayment(latestPayment);
        setReceipt(latestReceipt);
        setCorrectionSender(latestPayment?.sender_name || "");
        setCorrectionMethod(paymentReceivers.find((row) => row.method === latestPayment?.payment_method) || paymentReceivers[0]);
        setInvoiceNote(latestPayment ? "Live payment details and receipt proof loaded." : "No submitted payment record found yet.");
      })
      .catch((error) => setInvoiceNote(`Could not load receipt: ${readableAppError(error) || "Check login or Inbox RLS."}`));
    return () => {
      mounted = false;
    };
  }, [isCareRequest, isFarmBuy, requestedPaymentId, requestedReference]);

  function chooseCorrectionReceipt(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 10 * 1024 * 1024) {
      setInvoiceNote("Use a JPG, PNG, or WebP receipt image up to 10 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setCorrectionReceipt(String(reader.result || ""));
    reader.readAsDataURL(file);
  }

  async function resubmitCorrection() {
    if (!payment || resubmitting) return;
    if (customerExplanation.trim().length < 5 || correctionSender.trim().length < 3 || correctionReference.trim().length < 4 || !correctionReceipt) {
      setInvoiceNote("Complete your explanation, sender name, corrected reference number, and new receipt before resubmitting.");
      return;
    }
    try {
      setResubmitting(true);
      setInvoiceNote("Sending your corrected payment evidence back to admin...");
      if (!correctionOperationKey.current) correctionOperationKey.current = globalThis.crypto?.randomUUID?.() || `payment-correction-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const previousSummary = payment.summary && typeof payment.summary === "object" ? payment.summary : {};
      const result = await submitManualPaymentRequest({
        sourceType: payment.source_type,
        sourceRef: payment.source_ref,
        amountExpected: Number(payment.amount_expected || 0),
        summary: {
          ...previousSummary,
          previous_payment_request_id: payment.id,
          previous_reference_number: payment.reference_number,
          customer_resubmission_note: customerExplanation.trim(),
          correction_submitted_at: new Date().toISOString(),
        },
        paymentMethod: correctionMethod.method,
        receiverAccount: correctionMethod.account,
        senderName: correctionSender.trim(),
        referenceNumber: correctionReference.trim(),
        receiptImageUrl: correctionReceipt,
        idempotencyKey: correctionOperationKey.current,
      });
      setResubmittedId(result.id);
      setInvoiceNote(result.duplicate ? "This correction was already submitted. No duplicate request was created." : "Correction submitted. Admin can now compare your explanation and new evidence with the rejected payment.");
    } catch (error) {
      setInvoiceNote(`Correction was not submitted: ${readableAppError(error) || "Check your connection and try again."}`);
    } finally {
      setResubmitting(false);
    }
  }

  const amount = Number(payment?.amount_expected || String(receipt?.body || "").match(/(?:Total|Amount):\\s*(\\d+(?:\\.\\d+)?)/i)?.[1] || 0);
  const reference = payment?.reference_number || String(receipt?.body || "").match(/Reference:\\s*([^\\.]+)/i)?.[1] || "Not recorded";
  const receiptId = String(receipt?.body || "").match(/Receipt ID:\\s*([a-f0-9-]+)/i)?.[1] || (payment?.id ? `PAY-${String(payment.id).slice(0, 8).toUpperCase()}` : isFarmBuy ? "INV-FB-PENDING" : "INV-CI-PENDING");
  const status = String(payment?.status || (receipt ? "recorded" : "pending")).replaceAll("_", " ");
  const method = payment?.payment_method || "Not recorded";
  const receiver = payment?.receiver_account || "Not recorded";
  const sender = payment?.sender_name || "Not recorded";
  const receiptUrl = payment?.receipt_image_url || "";
  const adminReason = payment?.admin_note || "No admin reason recorded.";
  const canCorrect = status === "rejected" || status === "needs info" || status === "needs_info";

  const receiptTitle = isCareRequest ? "Care Request Receipt" : isFarmBuy ? "Farm Buy Receipt" : "Cash-In Receipt";
  return (
    <Shell role="customer" title="Invoice">
      {viewerOpen && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-black/60 p-4">
          <section className="w-full max-w-3xl rounded-3xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase text-[#667267]">Uploaded Payment Proof</p>
                <h2 className="mt-1 text-2xl font-black">{reference}</h2>
              </div>
              <button type="button" onClick={() => setViewerOpen(false)} className="rounded-xl bg-[#eee8d9] px-4 py-2 font-black">
                Close
              </button>
            </div>
            <div className="mt-4 grid min-h-80 place-items-center overflow-hidden rounded-2xl bg-[#111] p-4">{receiptUrl ? <img src={receiptUrl} alt="Uploaded payment receipt" className="max-h-[65vh] w-full object-contain" /> : <p className="font-black text-white">No receipt photo attached</p>}</div>
          </section>
        </div>
      )}
      <PageTitle title={receiptTitle} text="Payment details, reference, and uploaded proof connected to your request." icon="file" />
      <KaFarm>{invoiceNote}</KaFarm>
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-black uppercase text-[#667267]">Payment Record</p>
            <h2 className="mt-1 text-3xl font-black">{receiptId}</h2>
            <p className="mt-2 text-sm font-bold text-[#667267]">{payment?.created_at ? new Date(payment.created_at).toLocaleString("en-PH") : receipt?.created_at ? new Date(receipt.created_at).toLocaleString("en-PH") : "Waiting for submission"}</p>
          </div>
          <Badge tone={status === "approved" ? "good" : status === "rejected" ? "bad" : "warn"}>{status}</Badge>
        </div>
        <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <section className="rounded-2xl border border-[#ece6d8] bg-[#fffdf7] p-5">
            <p className="text-xs font-black uppercase text-[#667267]">Payment Submitted</p>
            <h3 className="mt-2 text-2xl font-black">Reference: {reference}</h3>
            <p className="mt-3 text-sm font-bold leading-6 text-[#667267]">{receipt?.body || "The payment proof is waiting for admin review."}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Info label="Method Used" value={method} />
              <Info label="Receiver / Account" value={receiver} />
              <Info label="Sender Name" value={sender} />
              <Info label="Request Status" value={status} />
            </div>
          </section>
          <section className="rounded-2xl border border-[#ece6d8] bg-white p-5">
            <p className="text-xs font-black uppercase text-[#667267]">Receipt / Upload</p>
            <div className="mt-3 grid min-h-44 place-items-center overflow-hidden rounded-2xl bg-[#f6f3e8]">{receiptUrl ? <img src={receiptUrl} alt="Receipt preview" className="max-h-56 w-full object-contain" /> : <p className="px-4 text-center text-sm font-bold text-[#667267]">No uploaded photo available.</p>}</div>
            <button type="button" disabled={!receiptUrl} onClick={() => setViewerOpen(true)} className="mt-3 w-full rounded-xl bg-[#1f6b45] px-4 py-3 font-black text-white disabled:cursor-not-allowed disabled:bg-[#b9b3a4]">
              View Uploaded Receipt
            </button>
          </section>
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-[#1f6b45] p-5 text-white">
          <div>
            <p className="text-xs font-black uppercase text-white/75">Amount Paid</p>
            <p className="mt-1 text-sm font-bold">Recorded from submitted payment request</p>
          </div>
          <p className="text-4xl font-black">{peso(amount)}</p>
        </div>
        {canCorrect && (
          <section className="mt-5 rounded-3xl border-2 border-red-200 bg-red-50 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase text-red-700">Admin Decision</p>
                <h3 className="mt-1 text-2xl font-black">Correct and Resubmit Payment</h3>
              </div>
              <Badge tone="bad">{status}</Badge>
            </div>
            <div className="mt-4 rounded-2xl bg-white p-4">
              <p className="text-xs font-black uppercase text-[#667267]">Why Admin Returned It</p>
              <p className="mt-2 whitespace-pre-wrap text-sm font-bold leading-6">{adminReason}</p>
            </div>
            {resubmittedId ? (
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                <h4 className="text-lg font-black text-emerald-900">Correction sent to Admin</h4>
                <p className="mt-2 text-sm font-bold text-emerald-800">New request: {resubmittedId}. Check Inbox for the next decision.</p>
              </div>
            ) : (
              <>
                <label className="mt-4 block text-sm font-black">
                  Your Explanation
                  <textarea value={customerExplanation} onChange={(event) => setCustomerExplanation(event.target.value)} placeholder="Explain what you corrected or why the original payment is valid..." className="mt-2 min-h-28 w-full rounded-2xl border border-red-200 bg-white p-4 text-sm font-bold" />
                </label>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  {paymentReceivers.map((row) => (
                    <button key={row.method} type="button" onClick={() => setCorrectionMethod(row)} className={"rounded-2xl border p-4 text-left " + (correctionMethod.method === row.method ? "border-[#1f6b45] bg-emerald-50" : "border-[#ded8c9] bg-white")}>
                      <b>{row.method}</b>
                      <p className="mt-1 text-xs font-bold text-[#667267]">{row.account}</p>
                    </button>
                  ))}
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <input value={correctionSender} onChange={(event) => setCorrectionSender(event.target.value)} placeholder="Sender name on new receipt" className="rounded-2xl border border-[#ded8c9] bg-white px-4 py-3 font-bold" />
                  <input value={correctionReference} onChange={(event) => setCorrectionReference(event.target.value)} placeholder="Corrected reference number" className="rounded-2xl border border-[#ded8c9] bg-white px-4 py-3 font-bold" />
                  <label className="cursor-pointer rounded-2xl border-2 border-dashed border-[#ded8c9] bg-white p-4 text-center font-black md:col-span-2">
                    <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => chooseCorrectionReceipt(event.target.files?.[0])} />
                    {correctionReceipt ? "New receipt attached" : "Upload corrected receipt"}
                  </label>
                  {correctionReceipt && <img src={correctionReceipt} alt="Corrected receipt preview" className="max-h-72 w-full rounded-2xl bg-white object-contain p-2 md:col-span-2" />}
                </div>
                <button type="button" data-kafarm-feedback-target="payment-correction-status" disabled={resubmitting} onClick={() => void resubmitCorrection()} className="mt-4 w-full rounded-2xl bg-[#1f6b45] px-4 py-4 font-black text-white disabled:opacity-60">
                  {resubmitting ? "Sending Correction..." : "Resubmit to Admin"}
                </button>
                <p id="payment-correction-status" className="mt-3 text-sm font-bold text-[#667267]">
                  A new review record will be created; the rejected record remains in the audit trail.
                </p>
              </>
            )}
          </section>
        )}
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/customer/inbox" className="rounded-2xl bg-[#eee8d9] px-4 py-3 font-black">
            Back to Inbox
          </Link>
          <Link href="/customer/farm-buy" className="rounded-2xl bg-white px-4 py-3 font-black shadow-sm">
            Farm Buy
          </Link>
          <Link href="/customer/inventory" className="rounded-2xl bg-white px-4 py-3 font-black shadow-sm">
            Inventory
          </Link>
          <Link href="/customer/roosters" className="rounded-2xl bg-[#1f6b45] px-4 py-3 font-black text-white">
            My Roosters
          </Link>
        </div>
      </Card>
    </Shell>
  );
}
export function SupportPage() {
  type ChatMsg = {
    from: "customer" | "caretaker" | "kafarm" | "admin";
    text: string;
    at: string;
  };
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      from: "kafarm",
      text: "Hi buddy. Ka-Farm muna ang kausap mo. Sabihin mo yung concern mo, then ipapasa ko sa live admin kapag sensitive or kailangan ng account review.",
      at: "Now",
    },
  ]);
  const [text, setText] = useState("");
  const [escalated, setEscalated] = useState(false);
  const [caseId, setCaseId] = useState("");
  const [dbNote, setDbNote] = useState("Connecting support chat records...");
  function mapMessages(rows: any[]): ChatMsg[] {
    if (!rows.length)
      return [
        {
          from: "kafarm",
          text: "Hi buddy. Ka-Farm muna ang kausap mo. Sabihin mo yung concern mo, then ipapasa ko sa live admin kapag sensitive or kailangan ng account review.",
          at: "Now",
        },
      ];
    return rows.map((row) => ({
      from: row.sender_role === "customer" ? "customer" : row.sender_role === "admin" ? "admin" : "kafarm",
      text: row.body,
      at: new Date(row.created_at).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    })) as ChatMsg[];
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
      setEscalated(["escalated", "admin_joined", "ended", "completed"].includes(session?.status || ""));
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
  useEffect(() => {
    loadLatestSession();
  }, []);
  useEffect(() => {
    if (caseId) loadSession(caseId);
  }, [caseId]);
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
    if (!text.trim()) return;
    const q = text.trim();
    if (escalated) {
      setMessages((current) => [...current, { from: "customer", text: q, at: "Now" }]);
      setText("");
      try {
        const { data, error } = await sendSupportMessage({
          role: "customer",
          sessionId: caseId || null,
          body: q,
          forceEscalate: true,
        });
        if (error) throw error;
        setCaseId(data);
        await loadSession(data);
      } catch {
        setDbNote("Message shown here, but DB save failed. Please try again or ask admin.");
      }
      return;
    }
    const reply = aiReply(q);
    setMessages((current) => [...current, { from: "customer", text: q, at: "Now" }, { from: "kafarm", text: reply, at: "Now" }]);
    setText("");
    try {
      const { data, error } = await sendSupportMessage({
        role: "customer",
        sessionId: caseId || null,
        body: q,
        forceEscalate: needsAdmin(q),
      });
      if (error) throw error;
      setCaseId(data);
      await saveKaFarmReply(data, reply, {
        mode: "customer_support",
        rule_based: true,
      });
      if (needsAdmin(q))
        await saveKaFarmReply(data, getEscalationNotice(q, "customer"), {
          mode: "customer_support",
          escalation_notice: true,
        });
      await loadSession(data);
    } catch {
      setDbNote("Ka-Farm replied here. Please login again so the chat can be saved to your official support record.");
    }
  }
  async function openLiveChat() {
    setEscalated(true);
    const lastUser = [...messages].reverse().find((m) => m.from === "customer")?.text || "Customer requested admin help";
    setMessages((current) => [
      ...current,
      {
        from: "kafarm",
        text: "I escalated this to live admin. I included your issue summary, risk reason, and chat trail. Admin must approve any sensitive action.",
        at: "Now",
      },
    ]);
    try {
      const { data, error } = await sendSupportMessage({
        role: "customer",
        sessionId: caseId || null,
        body: lastUser,
        forceEscalate: true,
      });
      if (error) throw error;
      setCaseId(data);
      await saveKaFarmReply(data, "I escalated this to live admin. I included your issue summary, risk reason, and chat trail. Admin must approve any sensitive action.", { mode: "customer_support", escalation_notice: true });
      await loadSession(data);
    } catch {
      setDbNote("Escalation shown here, but DB sync failed. Admin may need to check account setup.");
    }
  }
  const showEscalate = !escalated && messages.some((m, i) => i > 0 && m.from === "kafarm" && /open live admin|live admin chat|needs admin|I escalated|cannot approve|move money|fraud|wrong rooster|account safety/i.test(m.text));
  return (
    <Shell role="customer" title="Support">
      <PageTitle title="Support" text="Chat with Ka-Farm first. Live admin appears only when the concern needs review." icon="support" />
      <section className="mx-auto max-w-4xl overflow-hidden rounded-[28px] border border-[#e3ded0] bg-white shadow-sm">
        <div className="grid gap-4 border-b border-[#ece6d8] bg-[#fffdf7] p-4 md:grid-cols-[136px_1fr] md:items-center">
          <div className="mx-auto h-40 w-32 overflow-hidden rounded-[28px] border-4 border-white bg-[#eef4ea] shadow-sm">
            <img src="/farmconnect/kafarm/ka-farm-mascot.png" alt="KaFarm mascot" className="h-full w-full object-contain p-1" />
          </div>
          <div className="rounded-3xl rounded-tl-sm border border-[#e3ded0] bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-black">{escalated ? "Live Admin Escalation" : "Ka-Farm Support"}</h2>
              <Badge tone={escalated ? "warn" : "good"}>{escalated ? "Escalated" : "Ka-Farm First"}</Badge>
            </div>
            <p className="mt-2 text-sm font-bold leading-6 text-[#667267]">{escalated ? "Admin queue received this chat. KaFarm already prepared the summary and evidence trail." : "Kumusta buddy. Ako si KaFarm. Mag-type ka lang dito, sasagot muna ako. Kapag money, KYC, fraud, legal, or unclear, ipapasa ko sa admin."}</p>
            <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-[#eef4ea] px-3 py-1 text-xs font-black uppercase text-[#1f6b45]">
              typing assistant <span className="animate-pulse">...</span>
            </p>
          </div>
        </div>
        <div className="min-h-[62vh] bg-[linear-gradient(180deg,#fffdf7_0%,#f6f3e8_100%)] p-4">
          <div className="max-h-[62vh] space-y-3 overflow-y-auto pr-2">
            {messages.map((m, i) => (
              <div key={i} className={"flex max-w-[92%] items-start gap-2 " + (m.from === "customer" ? "ml-auto justify-end" : "")}>
                {m.from === "kafarm" && (
                  <div className="h-14 w-12 shrink-0 overflow-hidden rounded-2xl border-2 border-white bg-[#eef4ea] shadow-sm">
                    <img src="/farmconnect/kafarm/ka-farm-mascot.png" alt="" className="h-full w-full object-contain p-1" />
                  </div>
                )}
                <div className={"rounded-2xl p-3 shadow-sm " + (m.from === "customer" ? "bg-[#1f6b45] text-white" : m.from === "admin" ? "bg-sky-50 text-[#12375a] ring-1 ring-sky-100" : "rounded-tl-sm bg-white")}>
                  <b>{m.from === "customer" ? "You" : m.from === "admin" ? "Admin" : "Ka-Farm"}</b>
                  {m.from === "kafarm" && <span className="ml-2 text-[11px] font-black uppercase text-[#1f6b45]">typing...</span>}
                  <p className="mt-1 text-sm leading-6">{m.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="border-t border-[#ece6d8] bg-white p-4">
          {showEscalate && (
            <button onClick={openLiveChat} className="mb-3 w-full rounded-2xl bg-amber-300 px-4 py-3 font-black text-[#17251d]">
              Open Live Admin Escalation
            </button>
          )}
          <div className="flex gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") send();
              }}
              placeholder={escalated ? "Add details for admin..." : "Message Ka-Farm..."}
              className="flex-1 rounded-2xl border border-[#ded8c9] bg-[#fffdf7] p-4 font-bold"
            />
            <button onClick={send} className="rounded-2xl bg-[#1f6b45] px-6 font-black text-white">
              Send
            </button>
          </div>
          <p className="mt-2 text-xs font-bold text-[#667267]">{dbNote}</p>
        </div>
      </section>
    </Shell>
  );
}
export function SettingsPage() {
  type SettingsPanel = "kyc" | "pin" | "password" | "contact";
  type KycFlowState = "loading" | "not_submitted" | "pending" | "rejected" | "approved" | "error";
  const fallbackProfile = {
    name: "Customer",
    nickname: "Customer",
    email: "",
    phone: "",
    birthdate: "",
    kyc: "Not submitted",
    pin: "Not set",
    payout: "Not added",
  };
  const [profile, setProfile] = useState(fallbackProfile);
  const [settingsNote, setSettingsNote] = useState("Choose a settings item from the side menu. Sensitive actions need proof, PIN checks, or admin review.");
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [kycIdPhoto, setKycIdPhoto] = useState<string | null>(null);
  const [kycSelfiePhoto, setKycSelfiePhoto] = useState<string | null>(null);
  const [kycIdBackPhoto, setKycIdBackPhoto] = useState<string | null>(null);
  const [kycIdFile, setKycIdFile] = useState<File | null>(null);
  const [kycIdBackFile, setKycIdBackFile] = useState<File | null>(null);
  const [kycSelfieFile, setKycSelfieFile] = useState<File | null>(null);
  const [kycSubmitting, setKycSubmitting] = useState(false);
  const [kycFlow, setKycFlow] = useState<{
    state: KycFlowState;
    note: string | null;
    submittedAt: string | null;
  }>({ state: "loading", note: null, submittedAt: null });
  const [kycReadStatus, setKycReadStatus] = useState("Upload a clear ID photo so the system can read the name, ID type, and ID number before admin review.");
  const [kycChecking, setKycChecking] = useState(false);
  const kycConsentVersion = "kyc-consent-v1-2026-07-09";
  const kycConsentText = "I consent to FarmConnect collecting and processing my government ID, selfie, address, birthdate, and payout-match details for KYC verification, fraud prevention, withdrawal safety, and admin review. I understand withdrawals stay locked until KYC is reviewed.";
  const [kycConsent, setKycConsent] = useState(false);
  const [activePanel, setActivePanel] = useState<SettingsPanel | null>(null);
  const [kyc, setKyc] = useState({
    legalName: profile.name,
    birthdate: profile.birthdate,
    address: "",
    city: "",
    province: "",
    postal: "",
    idType: "National ID",
    idLast4: "",
    payoutName: profile.name,
    idFront: "",
    selfie: "",
  });
  const [walletPin, setWalletPin] = useState({
    current: "",
    next: "",
    confirm: "",
  });
  const [password, setPassword] = useState({
    current: "",
    next: "",
    confirm: "",
  });
  const [contact, setContact] = useState({
    name: profile.name,
    nickname: profile.nickname,
    email: profile.email,
    phone: profile.phone,
  });
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const kycIdInputRef = useRef<HTMLInputElement | null>(null);
  const kycSelfieInputRef = useRef<HTMLInputElement | null>(null);
  const kycIdBackInputRef = useRef<HTMLInputElement | null>(null);
  const fieldClass = "rounded-2xl border border-[#ded8c9] bg-white px-4 py-3 font-bold outline-none focus:border-[#1f6b45]";
  useEffect(() => {
    let mounted = true;
    getCurrentProfile()
      .then(async (row) => {
        if (!mounted || !row) return;
        const payoutMethods = await getCustomerPayoutMethods();
        if (!mounted) return;
        const liveProfile = {
          name: row.full_name || row.display_name || row.email || "Customer",
          nickname: row.display_name || row.full_name || "Customer",
          email: row.email || "",
          phone: row.phone || "",
          birthdate: row.birthdate || "",
          kyc: row.kyc_status || row.verification_status || "Not submitted",
          pin: row.wallet_pin_set ? "Set" : "Not set",
          payout: payoutMethods.length ? "Added" : "Not added",
        };
        setProfile(liveProfile);
        setContact({
          name: liveProfile.name,
          nickname: liveProfile.nickname,
          email: liveProfile.email,
          phone: liveProfile.phone,
        });
        setKyc((current) => ({
          ...current,
          legalName: liveProfile.name,
          birthdate: liveProfile.birthdate,
          payoutName: liveProfile.name,
        }));
      })
      .catch(() => setSettingsNote("Profile could not load yet. Login again if your details look incomplete."));
    return () => {
      mounted = false;
    };
  }, []);
  useEffect(() => {
    let mounted = true;
    const refreshKycFlow = () =>
      getCurrentCustomerKycSubmission()
        .then((submission) => {
          if (!mounted) return;
          if (!submission) {
            setKycFlow({
              state: "not_submitted",
              note: null,
              submittedAt: null,
            });
            return;
          }
          const status = submission.status.replaceAll(" ", "_");
          const state: KycFlowState = ["approved", "verified", "accepted"].includes(status) ? "approved" : ["rejected", "declined", "denied", "needs_info"].includes(status) ? "rejected" : "pending";
          setKycFlow({
            state,
            note: submission.adminNote,
            submittedAt: submission.submittedAt,
          });
        })
        .catch(() => {
          if (mounted)
            setKycFlow({
              state: "error",
              note: "KYC status could not be checked. Login again before sending another submission.",
              submittedAt: null,
            });
        });
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void refreshKycFlow();
    };
    void refreshKycFlow();
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      mounted = false;
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, []);
  const settingCards: Array<{
    key?: SettingsPanel;
    title: string;
    text: string;
    icon: IconName;
    action: string;
    tone?: "green" | "amber" | "blue";
    href?: string;
  }> = [
    {
      key: kycFlow.state === "approved" ? undefined : "kyc",
      title: "KYC Verification",
      text: kycFlow.state === "approved" ? "Approved and locked." : kycFlow.state === "pending" ? "Submitted and under admin review." : kycFlow.state === "rejected" ? "Rejected. Open to review the reason and resubmit." : "Upload ID and selfie before withdrawals.",
      icon: "shield",
      action: kycFlow.state === "approved" ? "Verified" : "Open KYC",
      tone: "amber",
    },
    {
      key: "pin",
      title: "Wallet PIN",
      text: "Change PIN only after current PIN check.",
      icon: "qr",
      action: "Manage PIN",
      tone: "blue",
    },
    {
      key: "password",
      title: "Password",
      text: "Change login password securely.",
      icon: "settings",
      action: "Change Password",
    },
    {
      title: "Payout Account",
      text: "Manage GCash, Maya, or bank payout.",
      icon: "wallet",
      action: "Manage Payout",
      href: "/customer/withdraw/add-payout",
    },
    {
      key: "contact",
      title: "Contact Details",
      text: "Edit phone, email, and nickname.",
      icon: "user",
      action: "Edit Contact",
    },
    {
      title: "Activity Records",
      text: "Open receipts, inbox, and records.",
      icon: "file",
      action: "Open Inbox",
      href: "/customer/inbox",
    },
  ];
  function cardClass(tone?: "green" | "amber" | "blue") {
    if (tone === "amber") return `${kycFlow.state === "approved" ? "pointer-events-none cursor-not-allowed opacity-65 " : ""}border-amber-200 bg-amber-50`;
    if (tone === "blue") return "border-sky-200 bg-sky-50";
    return "border-[#ece6d8] bg-white";
  }
  function chooseProfilePhoto(file?: File) {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setProfilePhoto((current) => {
      if (current) URL.revokeObjectURL(current);
      return url;
    });
    setSettingsNote("Profile photo added. The app centered and fitted it inside the circle so the face stays visible.");
  }
  function chooseKycPhoto(kind: "front" | "back" | "selfie", file?: File) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setSettingsNote("Use a JPG, PNG, or WebP image for KYC evidence.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setSettingsNote("Each KYC image must be 10 MB or smaller.");
      return;
    }
    const url = URL.createObjectURL(file);
    if (kind === "front") {
      setKycIdFile(file);
      setKycIdPhoto((current) => {
        if (current) URL.revokeObjectURL(current);
        return url;
      });
      setKycReadStatus("ID front received. It will be stored privately before admin review.");
    } else if (kind === "back") {
      setKycIdBackFile(file);
      setKycIdBackPhoto((current) => {
        if (current) URL.revokeObjectURL(current);
        return url;
      });
      setKycReadStatus("ID back received. It will be stored privately before admin review.");
    } else {
      setKycSelfieFile(file);
      setKycSelfiePhoto((current) => {
        if (current) URL.revokeObjectURL(current);
        return url;
      });
      setKycReadStatus("Selfie received. It will be stored privately for manual admin review.");
    }
  }
  useEffect(
    () => () => {
      if (profilePhoto) URL.revokeObjectURL(profilePhoto);
    },
    [profilePhoto],
  );
  useEffect(
    () => () => {
      if (kycIdPhoto) URL.revokeObjectURL(kycIdPhoto);
    },
    [kycIdPhoto],
  );
  useEffect(
    () => () => {
      if (kycSelfiePhoto) URL.revokeObjectURL(kycSelfiePhoto);
    },
    [kycSelfiePhoto],
  );
  useEffect(
    () => () => {
      if (kycIdBackPhoto) URL.revokeObjectURL(kycIdBackPhoto);
    },
    [kycIdBackPhoto],
  );
  useEffect(() => {
    if (activePanel !== "kyc") return;
    setKycChecking(true);
    const timer = window.setTimeout(() => setKycChecking(false), 650);
    return () => window.clearTimeout(timer);
  }, [activePanel, kyc.address, kyc.postal, kyc.idType, kyc.idLast4, kycIdPhoto, kycIdBackPhoto, kycSelfiePhoto]);
  async function submitKyc() {
    if (!kycIdFile || !kycIdBackFile || !kycSelfieFile) {
      setSettingsNote("KYC needs a new ID front, ID back, and selfie photo before sending.");
      return;
    }
    if (!kycConsent) {
      setSettingsNote("Please confirm KYC consent before sending. This protects both the customer and FarmConnect records.");
      return;
    }
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      setSettingsNote("Please login first before sending KYC. This keeps your ID, selfie, consent, and inbox notice attached to the correct customer account.");
      return;
    }
    const submittedAt = new Date().toLocaleString();
    const inboxNotice = {
      tab: "Alerts",
      title: "KYC Submitted",
      text: `Your KYC is under review. Submitted ${submittedAt}. We will notify you when admin finishes checking it.`,
      status: "Pending",
      action: "read",
    };
    try {
      setKycSubmitting(true);
      setSettingsNote("Uploading ID and selfie securely before submitting KYC...");
      const submissionFolder = `submissions/${Date.now()}`;
      const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"];
      const [frontPath, backPath, selfiePath] = await Promise.all([
        uploadPrivateEvidenceFile({
          bucket: "farmconnect-customer-kyc",
          folder: submissionFolder,
          kind: "valid-id-front",
          file: kycIdFile,
          maxBytes: 10 * 1024 * 1024,
          allowedMimeTypes,
        }),
        uploadPrivateEvidenceFile({
          bucket: "farmconnect-customer-kyc",
          folder: submissionFolder,
          kind: "valid-id-back",
          file: kycIdBackFile,
          maxBytes: 10 * 1024 * 1024,
          allowedMimeTypes,
        }),
        uploadPrivateEvidenceFile({
          bucket: "farmconnect-customer-kyc",
          folder: submissionFolder,
          kind: "selfie",
          file: kycSelfieFile,
          maxBytes: 10 * 1024 * 1024,
          allowedMimeTypes,
        }),
      ]);
      const { error: consentError } = await supabase.rpc("customer_record_kyc_consent", {
        p_consent_version: kycConsentVersion,
        p_consent_text: kycConsentText,
        p_metadata: { source: "customer_settings", id_type: kyc.idType },
      });
      if (consentError) throw consentError;
      const { error } = await supabase.rpc("customer_submit_kyc", {
        p_legal_name: profile.name,
        p_birthdate: profile.birthdate || null,
        p_address_line: kyc.address,
        p_city: kyc.city,
        p_province: kyc.province,
        p_postal_code: kyc.postal,
        p_id_type: kyc.idType,
        p_id_number_last4: kyc.idLast4,
        p_payout_name_to_match: kyc.payoutName,
        p_valid_id_front_url: frontPath,
        p_selfie_url: selfiePath,
        p_valid_id_back_url: backPath,
        p_address_proof_url: null,
      });
      if (error) throw error;
      const reviewRecord = {
        customer: profile.name,
        email: profile.email,
        idType: kyc.idType,
        idNumber: kyc.idLast4,
        submittedAt,
        faceStatus: "Manual admin review",
        status: "Ready for admin review",
        note: "Automated face checking is disabled. Admin must verify the ID and selfie before approval.",
        faceScore: null,
        engineDetails: ["Manual identity review required"],
        front: frontPath,
        back: backPath,
        selfie: selfiePath,
        consentAccepted: true,
        consentAcceptedAt: submittedAt,
        consentVersion: kycConsentVersion,
        consentText: kycConsentText,
      };
      if (typeof window !== "undefined") {
        window.localStorage.setItem("farmconnect_latest_kyc_review", JSON.stringify(reviewRecord));
        const rawInbox = window.localStorage.getItem("farmconnect_customer_inbox");
        const currentInbox = rawInbox ? JSON.parse(rawInbox) : [];
        window.localStorage.setItem("farmconnect_customer_inbox", JSON.stringify([inboxNotice, ...currentInbox.filter((item: any) => item.title !== inboxNotice.title)]));
      }
      setKycFlow({
        state: "pending",
        note: null,
        submittedAt: new Date().toISOString(),
      });
      setActivePanel(null);
      setKycReadStatus("System read completed. Admin review queue can now verify the ID, selfie, consent, and duplicate-risk checks.");
      setSettingsNote("KYC submitted. Your verification is now under review. Check Inbox for the review notice.");
    } catch (error) {
      console.error("FarmConnect KYC submit failed", error);
      const reason = readableAppError(error);
      setSettingsNote(`KYC was not submitted. ${reason || "Please try again or ask admin to check private KYC storage access."}`);
    } finally {
      setKycSubmitting(false);
    }
  }
  async function submitPin() {
    const hasCurrentPin = profile.pin === "Set";
    if (hasCurrentPin && !/^\d{6}$/.test(walletPin.current)) {
      setSettingsNote("Enter your current 6-digit Wallet PIN first. This protects your FC balance if someone else opens your account.");
      return;
    }
    if (!/^\d{6}$/.test(walletPin.next)) {
      setSettingsNote("New wallet PIN must be exactly 6 numbers.");
      return;
    }
    if (hasCurrentPin && walletPin.current === walletPin.next) {
      setSettingsNote("New Wallet PIN must be different from the current PIN.");
      return;
    }
    if (walletPin.next !== walletPin.confirm) {
      setSettingsNote("New wallet PIN confirmation does not match.");
      return;
    }
    try {
      const { data, error } = await supabase.rpc("change_wallet_pin", {
        p_current_pin: hasCurrentPin ? walletPin.current : null,
        p_new_pin: walletPin.next,
      });
      if (error) throw error;
      if (data !== true) {
        setSettingsNote("Current Wallet PIN is incorrect. Try again, or ask Admin for a secure reset if you forgot it.");
        return;
      }
      setWalletPin({ current: "", next: "", confirm: "" });
      setProfile((current) => ({ ...current, pin: "Set" }));
      setSettingsNote("Wallet PIN saved. Future withdrawal requests will verify this PIN securely on the server.");
    } catch (error) {
      setSettingsNote(readableAppError(error) || "Current Wallet PIN verification is required. If forgotten, Admin reset must log out the account first.");
    }
  }
  async function submitPassword() {
    if (password.next.length < 8) {
      setSettingsNote("New password must be at least 8 characters.");
      return;
    }
    if (password.next !== password.confirm) {
      setSettingsNote("Password confirmation does not match.");
      return;
    }
    try {
      const { error } = await supabase.auth.updateUser({
        password: password.next,
      });
      if (error) throw error;
      setPassword({ current: "", next: "", confirm: "" });
      setSettingsNote("Password changed. For safety, use the new password on your next login.");
    } catch {
      setSettingsNote("Password form is ready. Login may need re-authentication before Supabase accepts the change.");
    }
  }
  async function submitContact() {
    if (!contact.name.trim() || !contact.phone.trim()) {
      setSettingsNote("Contact name and phone are required.");
      return;
    }
    try {
      const { data } = await supabase.auth.getUser();
      const authUserId = data.user?.id;
      if (!authUserId) throw new Error("login required");
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: contact.name,
          display_name: contact.nickname,
          email: contact.email,
          phone: contact.phone,
        })
        .eq("auth_user_id", authUserId);
      if (error) throw error;
      setSettingsNote("Contact details updated and ready for Customer Requests records.");
    } catch {
      setSettingsNote("Contact form is ready. Once profile columns are matched in the database, this will save directly.");
    }
  }
  function openPanel(panel: SettingsPanel, title: string) {
    if (panel === "kyc" && kycFlow.state === "pending") {
      setActivePanel(null);
      setSettingsNote(`Your KYC is in review.${kycFlow.submittedAt ? ` Submitted ${new Date(kycFlow.submittedAt).toLocaleString()}.` : ""}`);
      return;
    }
    if (panel === "kyc" && kycFlow.state === "error") {
      setActivePanel(null);
      setSettingsNote(kycFlow.note || "KYC status could not be checked. Login again before submitting.");
      return;
    }
    if (panel === "kyc" && kycFlow.state === "rejected") {
      setActivePanel(panel);
      setSettingsNote(`KYC rejected for resubmission. Admin reason: ${kycFlow.note || "Correct the submitted details and upload new evidence."}`);
      return;
    }
    setActivePanel(panel);
    setSettingsNote(`${title} opened. Complete the panel on the right to continue.`);
  }
  function idRule(type: string) {
    const rules: Record<
      string,
      {
        label: string;
        test: (value: string) => boolean;
        clean: (value: string) => string;
      }
    > = {
      "National ID": {
        label: "12 digits",
        clean: (v) => v.replace(/\D/g, "").slice(0, 12),
        test: (v) => /^\d{12}$/.test(v),
      },
      Passport: {
        label: "7 to 9 letters/numbers",
        clean: (v) =>
          v
            .replace(/[^a-z0-9]/gi, "")
            .toUpperCase()
            .slice(0, 9),
        test: (v) => /^[A-Z0-9]{7,9}$/.test(v),
      },
      "Driver License": {
        label: "11 letters/numbers",
        clean: (v) =>
          v
            .replace(/[^a-z0-9]/gi, "")
            .toUpperCase()
            .slice(0, 11),
        test: (v) => /^[A-Z0-9]{11}$/.test(v),
      },
      UMID: {
        label: "10 digits",
        clean: (v) => v.replace(/\D/g, "").slice(0, 10),
        test: (v) => /^\d{10}$/.test(v),
      },
      "SSS ID": {
        label: "10 digits",
        clean: (v) => v.replace(/\D/g, "").slice(0, 10),
        test: (v) => /^\d{10}$/.test(v),
      },
      "TIN ID": {
        label: "9 or 12 digits",
        clean: (v) => v.replace(/\D/g, "").slice(0, 12),
        test: (v) => /^\d{9}(\d{3})?$/.test(v),
      },
      "PhilHealth ID": {
        label: "12 digits",
        clean: (v) => v.replace(/\D/g, "").slice(0, 12),
        test: (v) => /^\d{12}$/.test(v),
      },
      "Pag-IBIG ID": {
        label: "12 digits",
        clean: (v) => v.replace(/\D/g, "").slice(0, 12),
        test: (v) => /^\d{12}$/.test(v),
      },
      "Voter ID": {
        label: "9 to 15 letters/numbers",
        clean: (v) =>
          v
            .replace(/[^a-z0-9]/gi, "")
            .toUpperCase()
            .slice(0, 15),
        test: (v) => /^[A-Z0-9]{9,15}$/.test(v),
      },
      "Postal ID": {
        label: "10 to 12 letters/numbers",
        clean: (v) =>
          v
            .replace(/[^a-z0-9]/gi, "")
            .toUpperCase()
            .slice(0, 12),
        test: (v) => /^[A-Z0-9]{10,12}$/.test(v),
      },
    };
    return rules[type] || rules["National ID"];
  }
  const currentIdRule = idRule(kyc.idType);
  const idNumberOk = currentIdRule.test(kyc.idLast4);
  const kycChecks = [
    { label: "Registered name", value: profile.name, ok: true, note: "Locked" },
    { label: "Birthdate", value: profile.birthdate, ok: true, note: "Locked" },
    {
      label: "Address",
      value: kyc.address ? "Filled" : "Missing",
      ok: kyc.address.trim().length >= 8,
      note: "Must be readable",
    },
    {
      label: "Postal",
      value: kyc.postal || "Missing",
      ok: /^\d{4}$/.test(kyc.postal),
      note: "4 digits",
    },
    {
      label: "ID number",
      value: kyc.idLast4 || "Missing",
      ok: idNumberOk,
      note: currentIdRule.label,
    },
    {
      label: "ID photos",
      value: kycIdPhoto && kycIdBackPhoto ? "Front and back" : "Incomplete",
      ok: Boolean(kycIdPhoto && kycIdBackPhoto),
      note: "Needed",
    },
    {
      label: "Selfie evidence",
      value: kycSelfiePhoto ? "Attached" : "Needs selfie",
      ok: Boolean(kycSelfiePhoto),
      note: "Admin final",
    },
  ];
  const panelTitle = activePanel === "kyc" ? "KYC Verification" : activePanel === "pin" ? "Wallet PIN" : activePanel === "password" ? "Change Password" : activePanel === "contact" ? "Contact Details" : "Settings";
  return (
    <Shell role="customer" title="Profile Settings">
      <PageTitle title="Profile Settings" text="Manage profile, KYC, wallet security, payout account, and records." icon="settings" />
      <div className="grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          <Card>
            <div className="flex items-center gap-4">
              <div className="relative h-24 w-24 shrink-0">
                <button type="button" onClick={() => fileInputRef.current?.click()} className="group h-24 w-24 overflow-hidden rounded-full bg-[#1f6b45] text-3xl font-black text-white shadow-sm ring-4 ring-[#e7eadf] transition active:scale-95" title="Open camera or upload profile photo">
                  {profilePhoto ? <img src={profilePhoto} alt="Profile" className="h-full w-full object-cover object-center" /> : <span className="grid h-full w-full place-items-center">AB</span>}
                  <span className="absolute inset-0 grid place-items-center bg-black/0 text-white opacity-0 transition group-hover:bg-black/35 group-hover:opacity-100">
                    <Icon name="camera" className="h-7 w-7" />
                  </span>
                </button>
                <button type="button" onClick={() => fileInputRef.current?.click()} aria-label="Open camera" className="absolute -bottom-1 -right-1 grid h-9 w-9 place-items-center rounded-full bg-white text-[#1f6b45] shadow-md ring-2 ring-[#e7eadf]">
                  <Icon name="camera" className="h-5 w-5" />
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" capture="user" className="hidden" onChange={(e) => chooseProfilePhoto(e.target.files?.[0])} />
              </div>
              <div className="min-w-0">
                <h2 className="truncate text-2xl font-black">{contact.name}</h2>
                <p className="truncate text-sm font-bold text-[#667267]">Nickname: {contact.nickname || "Not set"}</p>
                <Badge tone="warn">KYC {profile.kyc}</Badge>
                <p className="mt-2 text-xs font-bold text-[#667267]">Tap photo to open camera or upload.</p>
              </div>
            </div>
            <div className="mt-5 grid gap-3 text-sm font-bold text-[#667267]">
              <div className="flex justify-between gap-3">
                <span>Email</span>
                <b className="truncate text-[#17251d]">{contact.email}</b>
              </div>
              <div className="flex justify-between gap-3">
                <span>Phone</span>
                <b className="text-[#17251d]">{contact.phone}</b>
              </div>
              <div className="flex justify-between gap-3">
                <span>Wallet PIN</span>
                <b className="text-[#17251d]">{profile.pin}</b>
              </div>
              <div className="flex justify-between gap-3">
                <span>Payout</span>
                <b className="text-[#17251d]">{profile.payout}</b>
              </div>
            </div>
          </Card>
          <Card className="border-2 border-amber-300 bg-amber-50">
            <div className="flex items-start gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white text-amber-700">
                <Icon name="shield" />
              </div>
              <div>
                <h2 className="text-lg font-black">Withdrawal Locked</h2>
                <p className="mt-1 text-sm font-bold text-[#667267]">KYC approval is required before requesting a withdrawal. You may add or update a payout account before KYC approval.</p>
              </div>
            </div>
          </Card>
          <Card>
            <h2 className="text-xl font-black">Settings Menu</h2>
            <p className="mt-1 text-sm font-bold text-[#667267]">Open one item. Details stay on the right.</p>
            <div className="mt-4 max-h-[390px] space-y-3 overflow-y-auto pr-2">
              {settingCards.map((card) => {
                const isActive = card.key === activePanel;
                const row = (
                  <>
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white text-[#1f6b45] shadow-sm">
                      <Icon name={card.icon} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <b className="block truncate">{card.title}</b>
                      <span className="mt-1 block text-xs font-bold leading-5 text-[#667267]">{card.text}</span>
                    </span>
                  </>
                );
                return card.href ? (
                  <Link key={card.title} href={card.href} className={"flex w-full items-center gap-3 rounded-2xl border p-3 text-left " + cardClass(card.tone)}>
                    {row}
                  </Link>
                ) : (
                  <button key={card.title} onClick={() => card.key && openPanel(card.key, card.title)} className={"flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition " + cardClass(card.tone) + (isActive ? " ring-2 ring-[#1f6b45]" : "")}>
                    {row}
                  </button>
                );
              })}
            </div>
          </Card>
        </aside>
        <section>
          <KaFarm>{settingsNote}</KaFarm>
          <Card className="mt-5 min-h-[620px]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-black">{panelTitle}</h2>
                <p className="mt-1 text-sm font-bold text-[#667267]">Sensitive actions stay connected to customer records and admin review.</p>
              </div>
              <Badge tone={activePanel === "kyc" ? "warn" : activePanel ? "neutral" : "good"}>{activePanel ? "Open" : "Ready"}</Badge>
            </div>
            {!activePanel && (
              <div className="mt-6 grid min-h-[420px] place-items-center rounded-3xl border border-dashed border-[#ded8c9] bg-[#fffdf7]">
                <div className="max-w-sm text-center">
                  <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#f6f3e8] text-[#1f6b45]">
                    <Icon name="settings" className="h-7 w-7" />
                  </div>
                  <h3 className="mt-4 text-2xl font-black">Select a menu item</h3>
                  <p className="mt-2 text-sm font-bold leading-6 text-[#667267]">Your settings form will open here.</p>
                </div>
              </div>
            )}
            {activePanel === "kyc" && (
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-[#ded8c9] bg-[#f6f3e8] px-4 py-3">
                  <p className="text-xs font-black uppercase text-[#667267]">Registered Name</p>
                  <p className="mt-1 font-black text-[#17251d]">{profile.name}</p>
                  <p className="mt-1 text-xs font-bold text-[#667267]">Locked from registration</p>
                </div>
                <div className="rounded-2xl border border-[#ded8c9] bg-[#f6f3e8] px-4 py-3">
                  <p className="text-xs font-black uppercase text-[#667267]">Birthdate</p>
                  <p className="mt-1 font-black text-[#17251d]">{profile.birthdate}</p>
                  <p className="mt-1 text-xs font-bold text-[#667267]">Locked from registration</p>
                </div>
                <input className={fieldClass + " md:col-span-2"} value={kyc.address} onChange={(e) => setKyc({ ...kyc, address: e.target.value })} placeholder="Complete address" />
                <input className={fieldClass} value={kyc.city} onChange={(e) => setKyc({ ...kyc, city: e.target.value })} placeholder="City" />
                <input className={fieldClass} value={kyc.province} onChange={(e) => setKyc({ ...kyc, province: e.target.value })} placeholder="Province" />
                <input
                  className={fieldClass}
                  value={kyc.postal}
                  onChange={(e) =>
                    setKyc({
                      ...kyc,
                      postal: e.target.value.replace(/\D/g, "").slice(0, 4),
                    })
                  }
                  placeholder="Postal code"
                />
                <select
                  className={fieldClass}
                  value={kyc.idType}
                  onChange={(e) => {
                    const nextType = e.target.value;
                    const nextRule = idRule(nextType);
                    setKyc({
                      ...kyc,
                      idType: nextType,
                      idLast4: nextRule.clean(kyc.idLast4),
                    });
                  }}
                >
                  <option>National ID</option>
                  <option>Passport</option>
                  <option>Driver License</option>
                  <option>UMID</option>
                  <option>SSS ID</option>
                  <option>TIN ID</option>
                  <option>PhilHealth ID</option>
                  <option>Pag-IBIG ID</option>
                  <option>Voter ID</option>
                  <option>Postal ID</option>
                </select>
                <input
                  className={fieldClass + (idNumberOk || !kyc.idLast4 ? "" : " border-red-400 bg-red-50")}
                  value={kyc.idLast4}
                  onChange={(e) =>
                    setKyc({
                      ...kyc,
                      idLast4: currentIdRule.clean(e.target.value),
                    })
                  }
                  placeholder={`${kyc.idType} number (${currentIdRule.label})`}
                />
                <input className={fieldClass + " md:col-span-2"} value={kyc.payoutName} onChange={(e) => setKyc({ ...kyc, payoutName: e.target.value })} placeholder="Payout name to match" />
                <div className="md:col-span-2 grid gap-3 lg:grid-cols-2">
                  {kycChecks.map((check) => (
                    <div key={check.label} className={"rounded-2xl border p-3 text-sm font-bold " + (kycChecking ? "border-amber-200 bg-amber-50 text-amber-900" : check.ok ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-red-200 bg-red-50 text-red-800")}>
                      <div className="flex items-center justify-between gap-3">
                        <b>{check.label}</b>
                        <Badge tone={kycChecking ? "warn" : check.ok ? "good" : "bad"}>{kycChecking ? "Checking" : check.ok ? "OK" : "Check"}</Badge>
                      </div>
                      <p className="mt-1 text-xs">{kycChecking ? "Checking..." : `${check.value} - ${check.note}`}</p>
                    </div>
                  ))}
                </div>
                <div className="md:col-span-2 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm font-bold leading-6 text-[#17466c]">
                  <b>Manual review preparation:</b> {kycReadStatus}
                </div>
                <div className="md:col-span-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold leading-6 text-amber-900">
                  <b>Manual identity check</b>
                  <p className="mt-1">Automated face checking is disabled. FarmConnect admin will compare the submitted ID, selfie, account details, and consent before making the final decision.</p>
                </div>
                <div className="grid gap-3 md:col-span-2 md:grid-cols-2">
                  <button type="button" onClick={() => kycIdInputRef.current?.click()} className="overflow-hidden rounded-3xl border-2 border-dashed border-[#ded8c9] bg-[#fffdf7] p-4 text-left transition hover:border-[#1f6b45]">
                    <div className="flex items-center justify-between gap-3">
                      <b>ID Front</b>
                      <Icon name="camera" />
                    </div>
                    {kycIdPhoto ? <img src={kycIdPhoto} alt="ID preview" className="mt-3 aspect-[16/10] w-full rounded-2xl object-cover object-center" /> : <div className="mt-3 grid aspect-[16/10] place-items-center rounded-2xl bg-white text-sm font-bold text-[#667267]">Open Cam</div>}
                    <input ref={kycIdInputRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden" onChange={(e) => chooseKycPhoto("front", e.target.files?.[0])} />
                  </button>
                  <button type="button" onClick={() => kycIdBackInputRef.current?.click()} className="overflow-hidden rounded-3xl border-2 border-dashed border-[#ded8c9] bg-[#fffdf7] p-4 text-left transition hover:border-[#1f6b45]">
                    <div className="flex items-center justify-between gap-3">
                      <b>ID Back</b>
                      <Icon name="camera" />
                    </div>
                    {kycIdBackPhoto ? <img src={kycIdBackPhoto} alt="ID back preview" className="mt-3 aspect-[16/10] w-full rounded-2xl object-cover object-center" /> : <div className="mt-3 grid aspect-[16/10] place-items-center rounded-2xl bg-white text-sm font-bold text-[#667267]">Open Cam</div>}
                    <input ref={kycIdBackInputRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden" onChange={(e) => chooseKycPhoto("back", e.target.files?.[0])} />
                  </button>
                  <button type="button" onClick={() => kycSelfieInputRef.current?.click()} className="overflow-hidden rounded-3xl border-2 border-dashed border-[#ded8c9] bg-[#fffdf7] p-4 text-left transition hover:border-[#1f6b45] md:col-span-2">
                    <div className="flex items-center justify-between gap-3">
                      <b>Selfie</b>
                      <Icon name="camera" />
                    </div>
                    {kycSelfiePhoto ? <img src={kycSelfiePhoto} alt="Selfie preview" className="mt-3 aspect-[16/10] w-full rounded-2xl object-cover object-center" /> : <div className="mt-3 grid aspect-[16/10] place-items-center rounded-2xl bg-white text-sm font-bold text-[#667267]">Open Cam</div>}
                    <input ref={kycSelfieInputRef} type="file" accept="image/jpeg,image/png,image/webp" capture="user" className="hidden" onChange={(e) => chooseKycPhoto("selfie", e.target.files?.[0])} />
                  </button>
                </div>
                <label className="md:col-span-2 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold leading-6 text-[#7a4b00]">
                  <input type="checkbox" checked={kycConsent} onChange={(e) => setKycConsent(e.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-[#1f6b45]" />
                  <span>
                    <b>KYC consent required</b>
                    <span className="mt-1 block">{kycConsentText}</span>
                    <span className="mt-2 block text-xs text-[#667267]">Consent version: {kycConsentVersion}. Admin final review is still required before withdrawals unlock.</span>
                  </span>
                </label>
                <button onClick={submitKyc} disabled={!kycConsent || kycSubmitting} className={"rounded-2xl px-4 py-4 font-black text-white md:col-span-2 " + (kycConsent && !kycSubmitting ? "bg-[#1f6b45]" : "cursor-not-allowed bg-[#8aa092]")}>
                  {kycSubmitting ? "Uploading securely..." : "Send"}
                </button>
              </div>
            )}
            {activePanel === "pin" && (
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold leading-6 text-[#7a4b00] md:col-span-2">{profile.pin === "Set" ? "For safety, enter your current Wallet PIN before setting a new one. If you forgot it, ask Admin for a secure reset." : "Create your first 6-digit Wallet PIN. No current PIN is required for first-time setup."}</div>
                {profile.pin === "Set" && (
                  <input
                    className={fieldClass}
                    value={walletPin.current}
                    onChange={(e) =>
                      setWalletPin({
                        ...walletPin,
                        current: e.target.value.replace(/\D/g, "").slice(0, 6),
                      })
                    }
                    inputMode="numeric"
                    type="password"
                    placeholder="Current 6-digit PIN"
                  />
                )}
                <input
                  className={fieldClass}
                  value={walletPin.next}
                  onChange={(e) =>
                    setWalletPin({
                      ...walletPin,
                      next: e.target.value.replace(/\D/g, "").slice(0, 6),
                    })
                  }
                  inputMode="numeric"
                  type="password"
                  placeholder="New 6-digit PIN"
                />
                <input
                  className={fieldClass + " md:col-span-2"}
                  value={walletPin.confirm}
                  onChange={(e) =>
                    setWalletPin({
                      ...walletPin,
                      confirm: e.target.value.replace(/\D/g, "").slice(0, 6),
                    })
                  }
                  inputMode="numeric"
                  type="password"
                  placeholder="Confirm new PIN"
                />
                <button onClick={submitPin} className="rounded-2xl bg-[#0f6fb8] px-4 py-4 font-black text-white md:col-span-2">
                  {profile.pin === "Set" ? "Verify Current PIN and Save" : "Set Wallet PIN"}
                </button>
              </div>
            )}
            {activePanel === "password" && (
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <input className={fieldClass} value={password.current} onChange={(e) => setPassword({ ...password, current: e.target.value })} type="password" placeholder="Current password" />
                <input className={fieldClass} value={password.next} onChange={(e) => setPassword({ ...password, next: e.target.value })} type="password" placeholder="New password" />
                <input className={fieldClass + " md:col-span-2"} value={password.confirm} onChange={(e) => setPassword({ ...password, confirm: e.target.value })} type="password" placeholder="Confirm new password" />
                <button onClick={submitPassword} className="rounded-2xl bg-[#1f6b45] px-4 py-4 font-black text-white md:col-span-2">
                  Change Password
                </button>
              </div>
            )}
            {activePanel === "contact" && (
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <input className={fieldClass} value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} placeholder="Customer name" />
                <input className={fieldClass} value={contact.nickname} onChange={(e) => setContact({ ...contact, nickname: e.target.value })} placeholder="Owner nickname" />
                <input className={fieldClass} value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} placeholder="Email" />
                <input className={fieldClass} value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} placeholder="Phone" />
                <button onClick={submitContact} className="rounded-2xl bg-[#1f6b45] px-4 py-4 font-black text-white md:col-span-2">
                  Save Contact Details
                </button>
              </div>
            )}
          </Card>
        </section>
      </div>
    </Shell>
  );
}
export function CaretakerHome() {
  return (
    <Shell role="caretaker" title="Caretaker App">
      <PageTitle title="Caretaker Home" text="Simple work area for active tasks, completed tasks, admin chat, and profile." icon="clipboard" />
      <KaFarm>Open Active Tasks, select a request, follow the steps, scan QR, upload proof, then submit.</KaFarm>
      <div className="mt-5 grid gap-4 md:grid-cols-4">
        {nav.caretaker.map(([label, href, icon]) => (
          <Link key={href} href={href} className="rounded-2xl bg-white p-5 shadow-sm">
            <Icon name={icon as IconName} className="h-8 w-8 text-[#1f6b45]" />
            <h2 className="mt-3 font-black">{label}</h2>
          </Link>
        ))}
      </div>
    </Shell>
  );
}

export function CaretakerTasks() {
  const [tasks, setTasks] = useState<CaretakerTaskView[]>([]);
  const [selected, setSelected] = useState<CaretakerTaskView | null>(null);
  const [taskNote, setTaskNote] = useState("Loading active tasks from database...");
  const [documentation, setDocumentation] = useState("");
  const [proofFiles, setProofFiles] = useState<File[]>([]);
  const [qrValue, setQrValue] = useState("");
  const [qrSkipped, setQrSkipped] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraOpening, setCameraOpening] = useState(false);
  const [cameraMessage, setCameraMessage] = useState("Camera is ready to open. You can also enter the QR manually or skip verification.");
  const [phase, setPhase] = useState<"work" | "scan" | "confirm" | "sending">("work");
  const [feedUsed, setFeedUsed] = useState("");
  const [actualRemainingFeed, setActualRemainingFeed] = useState("");
  const [saleAmount, setSaleAmount] = useState("");
  const [healthStatus, setHealthStatus] = useState<"pass" | "watch" | "isolate_and_escalate">("pass");
  const [submitAttempt, setSubmitAttempt] = useState(0);
  const [missionInventory, setMissionInventory] = useState<CareTaskInventoryItem[]>([]);
  const [inventoryItemId, setInventoryItemId] = useState("");
  const proofInputRef = useRef<HTMLInputElement>(null);
  const qrTagRef = useRef<HTMLDivElement>(null);
  const qrVideoRef = useRef<HTMLVideoElement>(null);
  const qrStreamRef = useRef<MediaStream | null>(null);
  const qrTimerRef = useRef<number | null>(null);
  const qrControlsRef = useRef<{ stop: () => void } | null>(null);
  const previews = useMemo(() => proofFiles.map((file) => ({ file, url: URL.createObjectURL(file) })), [proofFiles]);
  const needsFeedQty = selected ? /feed/i.test(selected.task + " " + selected.proof) : false;
  const needsVideoProof = selected ? /video/i.test(selected.task + " " + selected.proof) : false;
  const isSalePriceTask = selected?.workflowType === "sale_price_inspection";
  const isSaleReleaseTask = selected?.workflowType === "sale_release_confirmation";
  const isPaidMissionTask = selected?.workflowType === "care_plan_daily_mission";
  const isManualMissionTask = selected?.workflowType === "manual_standard_mission";
  const isMissionTask = isPaidMissionTask || isManualMissionTask;
  const selectedMissionInventory = missionInventory.find((item) => item.id === inventoryItemId);
  const reservedFeedKg = Number(selectedMissionInventory?.reserved_kg || (Number(selectedMissionInventory?.reserved_inventory_units || 0) * Number(selectedMissionInventory?.kg_per_inventory_unit || 0)));
  const expectedRemainingFeedKg = Math.max(0, reservedFeedKg - Number(feedUsed || 0));
  const hasInventoryDiscrepancy = Boolean(actualRemainingFeed) && Math.abs(Number(actualRemainingFeed) - expectedRemainingFeedKg) > 0.001;
  const missionList = (key: string) => (Array.isArray(selected?.taskMetadata?.[key]) ? (selected?.taskMetadata?.[key] as unknown[]).map(String) : []);
  const missionSchedule = Array.isArray(selected?.taskMetadata?.time_schedule)
    ? (selected.taskMetadata.time_schedule as Array<{
        time?: string;
        action?: string;
      }>)
    : [];

  useEffect(() => () => previews.forEach((item) => URL.revokeObjectURL(item.url)), [previews]);
  useEffect(
    () => () => {
      if (qrTimerRef.current) window.clearInterval(qrTimerRef.current);
      qrStreamRef.current?.getTracks().forEach((track) => track.stop());
    },
    [],
  );
  useEffect(() => {
    let mounted = true;
    getCaretakerActiveTasks()
      .then((rows) => {
        if (!mounted) return;
        const mapped = (rows || []).map(mapCaretakerTaskRow);
        setTasks(mapped);
        if (mapped[0]) resetDraft(mapped[0]);
        else setSelected(null);
        setTaskNote(mapped.length ? "Choose a task, write the documentation, and attach clear photos. QR verification opens only after Submit Work." : "No assigned task yet. New approved requests appear here after admin assignment.");
      })
      .catch(() => setTaskNote("Active tasks could not be loaded. Check caretaker login and task database access."));
    return () => {
      mounted = false;
    };
  }, []);

  function resetDraft(task: CaretakerTaskView) {
    setSelected(task);
    setDocumentation("");
    setProofFiles([]);
    setQrValue("");
    setQrSkipped(false);
    setSaleAmount("");
    setHealthStatus("pass");
    setMissionInventory([]);
    setInventoryItemId("");
    setFeedUsed("");
    setActualRemainingFeed("");
    setCameraOpening(false);
    setCameraMessage("Camera is ready to open. You can also enter the QR manually or skip verification.");
    setPhase("work");
    setTaskNote(task.workflowType === "sale_release_confirmation" ? `Opened ${task.task}. Read the sale instruction and submit your acknowledgement. No photo or QR is required.` : `Opened ${task.task}. Complete the documentation and photos before QR verification.`);
  }

  useEffect(() => {
    if (!selected || !["care_plan_daily_mission", "manual_standard_mission"].includes(selected.workflowType)) return;
    let active = true;
    getCaretakerTaskInventory(selected.id)
      .then((items) => {
        if (!active) return;
        setMissionInventory(items);
        const feedItem = items.find((item) => /feed/i.test(`${item.product_name} ${item.category || ""} ${item.product_type || ""}`)) || items[0];
        setInventoryItemId((current) => current || feedItem?.id || "");
      })
      .catch((error) => {
        if (active) setTaskNote(`Mission inventory could not load: ${readableAppError(error)}`);
      });
    return () => {
      active = false;
    };
  }, [selected?.id, selected?.workflowType]);

  function addProofFiles(files?: FileList | null) {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm", "video/quicktime"];
    const accepted = Array.from(files || []).filter((file) => allowedTypes.includes(file.type) && file.size <= (file.type.startsWith("video/") ? 50 : 10) * 1024 * 1024);
    setProofFiles((current) => [...current, ...accepted].slice(0, 5));
    setTaskNote(accepted.length ? `${accepted.length} evidence file(s) attached. Finish the documentation, then submit for verification.` : "Use JPG, PNG, WebP up to 10 MB or MP4, WebM, MOV video up to 50 MB.");
  }

  function getQrSvgMarkup() {
    const svg = qrTagRef.current?.querySelector("svg");
    if (!svg) return null;
    const clone = svg.cloneNode(true) as SVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("width", "1200");
    clone.setAttribute("height", "1200");
    return new XMLSerializer().serializeToString(clone);
  }

  function downloadQrTag() {
    if (!selected?.qrPayload) {
      setTaskNote("QR identity is missing. Ask admin before printing a tag.");
      return;
    }
    const markup = getQrSvgMarkup();
    if (!markup) {
      setTaskNote("QR image is not ready yet. Wait a moment, then try Download QR again.");
      return;
    }
    const svgUrl = URL.createObjectURL(new Blob([markup], { type: "image/svg+xml;charset=utf-8" }));
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 1400;
      canvas.height = 1400;
      const context = canvas.getContext("2d");
      if (!context) {
        URL.revokeObjectURL(svgUrl);
        setTaskNote("This device could not prepare the QR download. Use Print Tag instead.");
        return;
      }
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 100, 100, 1200, 1200);
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(svgUrl);
        if (!blob) {
          setTaskNote("QR download could not be created. Use Print Tag instead.");
          return;
        }
        const downloadUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        const safeName =
          selected.rooster
            .replace(/[^a-z0-9]+/gi, "-")
            .replace(/^-|-$/g, "")
            .toLowerCase() || "rooster";
        link.href = downloadUrl;
        link.download = `farmconnect-${safeName}-qr.png`;
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
        setTaskNote("QR downloaded. Open it on any device or print it at 30 x 30 mm minimum.");
      }, "image/png");
    };
    image.onerror = () => {
      URL.revokeObjectURL(svgUrl);
      setTaskNote("QR download could not be prepared. Use Print Tag instead.");
    };
    image.src = svgUrl;
  }

  function printQrTag() {
    if (!selected?.qrPayload) {
      setTaskNote("QR identity is missing. Ask admin before printing a tag.");
      return;
    }
    const markup = getQrSvgMarkup();
    if (!markup) {
      setTaskNote("QR image is not ready yet. Wait a moment, then try Print Tag again.");
      return;
    }
    const printWindow = window.open("", "_blank", "width=720,height=760");
    if (!printWindow) {
      setTaskNote("Print window was blocked. Allow pop-ups for FarmConnect, then try again.");
      return;
    }
    const safeRooster = selected.rooster.replace(/[<>&"']/g, "");
    const safeTag = selected.tag.replace(/[<>&"']/g, "");
    printWindow.document.write(`<!doctype html><html><head><title>FarmConnect QR Tag</title><style>@page{size:45mm 45mm;margin:0}*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif}.tag{width:45mm;height:45mm;padding:2.5mm;display:flex;flex-direction:column;align-items:center;justify-content:center;border:0.4mm solid #111;text-align:center;overflow:hidden}.qr svg{display:block;width:30mm;height:30mm}.name{margin-top:1mm;font-size:9pt;font-weight:800;line-height:1}.serial{margin-top:1mm;max-width:39mm;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:6pt;font-weight:700}.hint{display:none}@media screen{body{min-height:100vh;display:grid;place-items:center;background:#eef3ed}.tag{background:white;box-shadow:0 8px 30px #0002}.hint{display:block;position:fixed;bottom:20px;font-size:12px;color:#345}}</style></head><body><div class="tag"><div class="qr">${markup}</div><div class="name">${safeRooster}</div><div class="serial">${safeTag}</div></div><p class="hint">Print at Actual Size / 100%. Tag size: 45 x 45 mm.</p><script>window.addEventListener('load',()=>setTimeout(()=>window.print(),250));<\/script></body></html>`);
    printWindow.document.close();
    setTaskNote("Print tag opened. Choose Actual Size or 100%; do not use Fit to Page.");
  }

  function openQrVerification() {
    if (!selected) return;
    if (documentation.trim().length < 5) {
      setTaskNote("Write a clear work documentation before submitting.");
      return;
    }
    if (isSalePriceTask && Number(saleAmount) <= 0) {
      setTaskNote("Enter the inspected rooster price before submitting.");
      return;
    }
    if (!proofFiles.length && !isSaleReleaseTask) {
      setTaskNote("Attach at least one clear work photo before submitting.");
      return;
    }
    if (needsFeedQty && Number(feedUsed) <= 0) {
      setTaskNote("Enter the actual feed quantity used before submitting.");
      return;
    }
    if (isMissionTask && healthStatus === "pass" && (!feedUsed || !inventoryItemId || Number(feedUsed) <= 0)) {
      setTaskNote("A PASS mission must record the reserved feed and actual positive kilograms used.");
      return;
    }
    if (isMissionTask && !actualRemainingFeed) {
      setTaskNote("Enter the actual remaining feed so Admin can compare it with the expected balance.");
      return;
    }
    const reservedLimit = selectedMissionInventory?.usage_unit === "kg" ? Number(selectedMissionInventory?.reserved_kg || 0) : Number(selectedMissionInventory?.reserved_inventory_units || 0);
    if (isMissionTask && feedUsed && Number(feedUsed) > reservedLimit) {
      setTaskNote("The entered quantity exceeds the inventory reserved for this care task.");
      return;
    }
    if (isSaleReleaseTask || selected.workflowType === "qr_tagging" || !selected.qrScanRequired) {
      setQrSkipped(false);
      setTaskNote("QR tagging proof is ready. Sending documentation and photos to Admin Task Verification...");
      void sendToAdmin(true);
      return;
    }
    setQrValue("");
    setPhase("scan");
    setTaskNote("Work proof is ready. Scan the rooster QR to verify the correct rooster.");
  }

  function stopQrCamera() {
    qrControlsRef.current?.stop();
    qrControlsRef.current = null;
    if (qrTimerRef.current) window.clearInterval(qrTimerRef.current);
    qrTimerRef.current = null;
    qrStreamRef.current?.getTracks().forEach((track) => track.stop());
    qrStreamRef.current = null;
    if (qrVideoRef.current) qrVideoRef.current.srcObject = null;
    setCameraActive(false);
  }

  function verifyQrValue(value: string) {
    if (!selected) return;
    const scanned = value.trim().replace(/\s+/g, "").toLowerCase();
    const expected = (selected.qrPayload || selected.tag).trim().replace(/\s+/g, "").toLowerCase();
    if (!expected || expected === "notag") {
      setTaskNote("This task has no rooster tag. Ask admin to correct the assignment before sending proof.");
      return;
    }
    if (scanned !== expected) {
      setTaskNote("QR does not match this task. Check the rooster and scan again.");
      return;
    }
    stopQrCamera();
    setQrSkipped(false);
    setPhase("confirm");
    setTaskNote("QR matched. Review the rooster, owner, and requested task before sending.");
  }

  async function startQrCamera() {
    type DetectorResult = { rawValue?: string };
    type Detector = {
      detect(source: CanvasImageSource): Promise<DetectorResult[]>;
    };
    type DetectorConstructor = new (options: { formats: string[] }) => Detector;
    setCameraOpening(true);
    setCameraMessage("Opening camera. Allow camera access when the browser asks.");
    const DetectorClass = (window as unknown as { BarcodeDetector?: DetectorConstructor }).BarcodeDetector;
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraOpening(false);
      setCameraMessage("Camera access is unavailable in this browser. Enter the QR below or use Skip QR.");
      setTaskNote("Camera access is unavailable. Use the QR input below or Skip QR so admin can review the exception.");
      return;
    }
    try {
      stopQrCamera();
      if (!DetectorClass) {
        const { BrowserQRCodeReader } = await import("@zxing/browser");
        const reader = new BrowserQRCodeReader();
        if (!qrVideoRef.current) throw new Error("QR_VIDEO_NOT_READY");
        const controls = await reader.decodeFromConstraints({ video: { facingMode: { ideal: "environment" } }, audio: false }, qrVideoRef.current, (result) => {
          const value = result?.getText();
          if (value) {
            setQrValue(value);
            verifyQrValue(value);
          }
        });
        qrControlsRef.current = controls;
        setCameraOpening(false);
        setCameraActive(true);
        setTaskNote("Camera scanner is active using the compatible QR reader.");
        setCameraMessage("Camera is active. Point it steadily at the rooster QR.");
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      qrStreamRef.current = stream;
      if (qrVideoRef.current) {
        qrVideoRef.current.srcObject = stream;
        await qrVideoRef.current.play();
      }
      const detector = new DetectorClass({ formats: ["qr_code"] });
      setCameraOpening(false);
      setCameraActive(true);
      qrTimerRef.current = window.setInterval(async () => {
        if (!qrVideoRef.current || qrVideoRef.current.readyState < 2) return;
        try {
          const result = await detector.detect(qrVideoRef.current);
          const value = result[0]?.rawValue;
          if (value) {
            setQrValue(value);
            verifyQrValue(value);
          }
        } catch {}
      }, 500);
      setTaskNote("Camera scanner is active. Point it at the rooster QR.");
      setCameraMessage("Camera is active. Point it steadily at the rooster QR.");
    } catch (error) {
      stopQrCamera();
      setCameraOpening(false);
      const denied = error instanceof DOMException && error.name === "NotAllowedError";
      const message = denied ? "Camera permission was denied. Allow camera access in browser settings, enter the QR below, or use Skip QR." : "Camera could not open on this device. Enter the QR below or use Skip QR.";
      setCameraMessage(message);
      setTaskNote(message);
    }
  }

  async function sendToAdmin(allowFromWork = false) {
    if (!selected || (phase !== "confirm" && !allowFromWork)) return;
    setPhase("sending");
    setTaskNote("Uploading proof and sending it to Admin Task Verification...");
    try {
      const proofUrls: string[] = [];
      for (let index = 0; index < proofFiles.length; index += 1) {
        const isVideo = proofFiles[index].type.startsWith("video/");
        proofUrls.push(
          await uploadPrivateEvidenceFile({
            bucket: "caretaker-task-proofs",
            folder: `tasks/${selected.id}`,
            kind: `proof-${index + 1}-${Date.now()}`,
            file: proofFiles[index],
            maxBytes: isVideo ? 50 * 1024 * 1024 : 10 * 1024 * 1024,
            allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm", "video/quicktime"],
            upsert: false,
          }),
        );
      }
      if (isSalePriceTask || isSaleReleaseTask) {
        await submitCaretakerRoosterSaleTask({
          taskId: selected.id,
          declaredAmount: isSalePriceTask ? Number(saleAmount) : null,
          proofUrls,
          freeNote: documentation.trim(),
          qrVerified: isSaleReleaseTask ? false : !qrSkipped,
          serialException: isSaleReleaseTask ? false : qrSkipped,
        });
      } else if (isMissionTask) {
        const checklistResults = {
            operations: missionList("operations_checklist").map((label) => ({
              label,
              checked: true,
            })),
            housing: missionList("housing_checklist").map((label) => ({
              label,
              checked: true,
            })),
            supplements: missionList("supplement_checklist").map((label) => ({
              label,
              checked: true,
            })),
            vaccines: missionList("vaccine_checklist").map((label) => ({
              label,
              checked: true,
            })),
            health: missionList("health_checklist").map((label) => ({
              label,
              checked: true,
            })),
          };
        const inventoryReconciliationNote = `Feed inventory: ${Number(feedUsed).toFixed(3)} kg used; ${Number(actualRemainingFeed).toFixed(3)} kg actual remaining; ${expectedRemainingFeedKg.toFixed(3)} kg expected remaining; ${hasInventoryDiscrepancy ? "INVENTORY DISCREPANCY - ADMIN REVIEW REQUIRED" : "balance matched"}.`;
        const missionBase = {
          taskId: selected.id,
          proofUrls,
          freeNote: `${documentation.trim()}\n\n${inventoryReconciliationNote}`,
          qrVerified: !qrSkipped,
          serialException: qrSkipped,
          healthStatus,
          checklistResults,
        };
        if (isPaidMissionTask) {
          await submitCaretakerMissionProof({
            ...missionBase,
            inventoryUsage: feedUsed && inventoryItemId ? [{ inventory_item_id: inventoryItemId, quantity: Number(feedUsed), unit: "kg" }] : [],
          });
        } else {
          await submitCaretakerManualMissionProof({
            ...missionBase,
            inventoryUsage: feedUsed && inventoryItemId ? [{ inventory_item_id: inventoryItemId, quantity: Number(feedUsed), unit: "kg" }] : [],
          });
        }
      } else {
        await submitCaretakerTaskProof({
          taskId: selected.id,
          proofUrl: proofUrls[0],
          proofUrls,
          presetNote: `${selected.task} completed${needsFeedQty ? ` - ${feedUsed} kg used` : ""}`,
          freeNote: documentation.trim(),
          qrVerified: !qrSkipped,
          serialException: qrSkipped,
          feedQuantityUsed: needsFeedQty ? Number(feedUsed) : null,
          feedUnit: needsFeedQty ? "kg" : null,
        });
      }
      const nextTasks = tasks.filter((task) => task.id !== selected.id);
      setTasks(nextTasks);
      setSelected(nextTasks[0] || null);
      setDocumentation("");
      setProofFiles([]);
      setQrValue("");
      setQrSkipped(false);
      setSaleAmount("");
      setPhase("work");
      setTaskNote(`${selected.task} was sent to Admin Task Verification. It will return here as a backjob if admin rejects it for correction.`);
    } catch (error) {
      setPhase("confirm");
      const message = readableAppError(error);
      setTaskNote(/bucket not found/i.test(message) ? "Send blocked: caretaker task-proof storage is not installed. Apply database SQL 033, then send again. Your draft is still here." : /null value in column ["']task_id["']|TASK_PROOF_TASK_ID/i.test(message) ? "Send blocked: task proof IDs are not synchronized. Apply SQL 037, reload the task, then send again. Your draft is still here." : /TASK_NOT_ASSIGNED_TO_(CARETAKER|CURRENT_CARETAKER)/i.test(message) ? "Send blocked: this task is linked to a different legacy caretaker record. Apply SQL 036, reload the task, then send again. Your draft is still here." : `Send failed: ${message || "Check task-proof storage, caretaker assignment, and SQL 033."}`);
    }
  }

  return (
    <Shell role="caretaker" title="Active Tasks">
      <PageTitle title="Active Tasks" text="Document the work, attach photos, then verify the rooster QR before sending." icon="clipboard" />
      <div id="caretaker-task-status" role="status" aria-live="polite">
        <KaFarm>{taskNote}</KaFarm>
        <span className="sr-only">Submit validation attempt {submitAttempt}</span>
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
        <Card>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-black">Task Queue</h2>
            <Badge tone={tasks.length ? "warn" : "neutral"}>{tasks.length} active</Badge>
          </div>
          <div className="mt-4 max-h-[650px] space-y-3 overflow-y-auto pr-2">
            {tasks.map((task) => (
              <button key={task.id} onClick={() => resetDraft(task)} className={"w-full rounded-xl border p-3 text-left " + (selected?.id === task.id ? "border-[#1f6b45] bg-emerald-50" : "border-[#ece6d8] bg-[#fffdf7]")}>
                <b className="block text-base">{task.task}</b>
                <p className="mt-1 truncate text-sm font-bold text-[#667267]">
                  {task.rooster} / {task.tag}
                </p>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-[#667267]">{task.due}</span>
                  <Badge tone={task.status === "backjob" ? "bad" : task.priority === "urgent" ? "warn" : "neutral"}>{task.status === "backjob" ? "Backjob" : task.priority}</Badge>
                </div>
              </button>
            ))}
            {!tasks.length && (
              <div className="rounded-2xl border border-dashed border-[#ded8c9] bg-[#fffdf7] p-6 text-center">
                <b>No active task</b>
                <p className="mt-2 text-sm font-bold text-[#667267]">Assigned and returned backjob tasks appear here.</p>
              </div>
            )}
          </div>
        </Card>
        <Card>
          {!selected ? (
            <div className="grid min-h-[520px] place-items-center text-center">
              <div>
                <h2 className="text-2xl font-black">Waiting for assignment</h2>
                <p className="mt-2 text-sm font-bold text-[#667267]">Admin-assigned customer requests will appear in the task queue.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase text-[#667267]">Task Details</p>
                  <h2 className="mt-1 text-3xl font-black">{selected.task}</h2>
                  <p className="mt-1 text-sm font-bold text-[#667267]">
                    {selected.rooster} / {selected.tag} / {selected.pen}
                  </p>
                </div>
                <Badge tone={phase === "confirm" ? "good" : phase === "scan" ? "warn" : "neutral"}>{phase === "work" ? "Documentation" : phase === "scan" ? "QR Verification" : phase === "sending" ? "Sending" : "Ready to Send"}</Badge>
              </div>

              {phase === "work" && (
                <div className="mt-5 space-y-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl bg-amber-50 p-4">
                      <b>Customer Instruction</b>
                      <p className="mt-1 text-sm font-bold leading-6 text-[#667267]">{selected.note}</p>
                    </div>
                    <div className="rounded-2xl bg-[#f6f3e8] p-4">
                      <b>Required Proof</b>
                      <p className="mt-1 text-sm font-bold text-[#667267]">{selected.proof}</p>
                    </div>
                  </div>
                  {isMissionTask && (
                    <div className="space-y-4 rounded-3xl border-2 border-emerald-300 bg-emerald-50/70 p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-black uppercase text-[#1f6b45]">{isPaidMissionTask ? "Automatic Paid Care Plan" : "Manual Premium Care Request"}</p>
                          <h3 className="mt-1 text-2xl font-black">{String(selected.taskMetadata.primary_mission || selected.task)}</h3>
                          <p className="mt-1 text-sm font-bold text-[#667267]">{String(selected.taskMetadata.life_stage || "Recorded life stage")}</p>
                        </div>
                        <Badge tone="good">{isPaidMissionTask ? "Automatic" : "Manual"} · Day {String(selected.taskMetadata.catalog_day || selected.task.match(/Day (\d+)/)?.[1] || "-")}</Badge>
                      </div>
                      <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm font-bold leading-6 text-sky-950">
                        <b>Professional judgment rule:</b> This procedure is the farm standard and working guide. Inspect the actual rooster and site first. Never follow a step blindly; if the condition is unsafe, stop that step, protect the rooster, document what you found, and report it to Admin.
                      </div>
                      <div className="grid gap-3 lg:grid-cols-2">
                        <div className="rounded-2xl bg-white p-4">
                          <b>Today&apos;s Schedule</b>
                          <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
                            {missionSchedule.map((item, index) => (
                              <div key={`${item.time}-${index}`} className="grid grid-cols-[92px_1fr] gap-2 text-sm">
                                <span className="font-black text-[#1f6b45]">{item.time || "Step"}</span>
                                <span className="font-bold text-[#667267]">{item.action}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="rounded-2xl bg-white p-4">
                          <b>Needed Today</b>
                          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm font-bold text-[#667267]">
                            {missionList("needed_today").map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                      {Array.isArray(selected.taskMetadata.package_items) && selected.taskMetadata.package_items.length > 0 && (
                        <div className="rounded-2xl border-2 border-[#1f6b45] bg-white p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <b>Complete 30-Day Package Readiness</b>
                            <Badge tone="warn">Day 1 gate</Badge>
                          </div>
                          <p className="mt-2 text-xs font-bold leading-5 text-[#667267]">Count and inspect every item before normal care. Missing, damaged, expired, or unsafe supplies must be stopped and reported—not marked ready.</p>
                          <div className="mt-3 grid gap-2 md:grid-cols-2">
                            {selected.taskMetadata.package_items.map((item: any, index: number) => (
                              <div key={`${String(item.item_kind || "item")}-${index}`} className="rounded-xl bg-[#f6f3e8] p-3 text-sm">
                                <b>{String(item.item_name || "Package item")}</b>
                                <p className="mt-1 font-black text-[#1f6b45]">{Number(item.required_quantity || 0).toFixed(3)} {String(item.unit || "unit")}</p>
                                <p className="mt-1 text-xs font-bold leading-5 text-[#667267]">{String(item.use_rule || "")}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4">
                        <b>Emergency Stop Rule</b>
                        <p className="mt-2 text-sm font-bold leading-6 text-amber-950">{String(selected.taskMetadata.emergency_stop_rule || "Stop normal work and contact admin for any serious health concern.")}</p>
                      </div>
                      <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm font-bold leading-6 text-sky-950">
                        Read these procedures before working. Submitting the completed work confirms that you followed every applicable instruction and recorded any exception in Work Documentation.
                      </div>
                      <div className="grid gap-4 lg:grid-cols-2">
                        {[
                          ["Daily Operations", "operations_checklist"],
                          ["Health Observation Guide", "health_checklist"],
                          ["Housing", "housing_checklist"],
                          ["Supplements", "supplement_checklist"],
                          ["Vaccines / Authority", "vaccine_checklist"],
                        ].map(([title, key]) => (
                          <section key={String(key)} className="rounded-2xl bg-white p-4">
                            <h4 className="font-black">{String(title)}</h4>
                            <ol className="mt-3 max-h-72 list-decimal space-y-2 overflow-y-auto pl-5">
                              {missionList(String(key)).map((item) => (
                                <li key={item} className="rounded-xl bg-[#f6f3e8] p-3 text-xs font-bold leading-5">{item}</li>
                              ))}
                            </ol>
                          </section>
                        ))}
                      </div>
                      <label className="block rounded-2xl bg-white p-4">
                        <span className="font-black">Health Result</span>
                        <select value={healthStatus} onChange={(event) => setHealthStatus(event.target.value as typeof healthStatus)} className="mt-2 w-full rounded-xl border p-3 font-black">
                          <option value="pass">PASS</option>
                          <option value="watch">WATCH — keep mission open</option>
                          <option value="isolate_and_escalate">ISOLATE AND ESCALATE</option>
                        </select>
                      </label>
                      <div className="rounded-2xl bg-white p-4">
                        <b>Completion Gate</b>
                        <p className="mt-2 text-sm font-bold leading-6 text-[#667267]">{String(selected.taskMetadata.completion_gate || "All required work, health status, and evidence must be recorded.")}</p>
                      </div>
                    </div>
                  )}
                  {selected.workflowType === "qr_tagging" && (
                    <div className="grid gap-4 rounded-3xl border-2 border-[#0f6fb8] bg-sky-50 p-5 md:grid-cols-[180px_1fr]">
                      <div ref={qrTagRef} className="grid place-items-center rounded-2xl bg-white p-4">
                        {selected.qrPayload ? <QRCodeSVG value={selected.qrPayload} size={148} level="H" marginSize={2} title={`QR for ${selected.rooster}`} /> : <span className="text-center text-sm font-black text-red-700">QR identity missing</span>}
                      </div>
                      <div>
                        <p className="text-xs font-black uppercase text-[#0f6fb8]">System-Generated QR Tagging Task</p>
                        <h3 className="mt-1 text-2xl font-black">Attach this QR to {selected.rooster}</h3>
                        <p className="mt-2 text-sm font-bold leading-6 text-[#667267]">Download the QR to a phone/laptop or print the prepared 45 x 45 mm tag. Use waterproof material and attach it to a safe leg band or holder, never directly to skin or feathers.</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button type="button" onClick={downloadQrTag} disabled={!selected.qrPayload} className="rounded-xl bg-[#0f6fb8] px-4 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50">
                            <Icon name="download" className="mr-2 inline h-5 w-5" />
                            Download QR
                          </button>
                          <button type="button" onClick={printQrTag} disabled={!selected.qrPayload} className="rounded-xl bg-amber-300 px-4 py-3 text-sm font-black disabled:cursor-not-allowed disabled:opacity-50">
                            Print Tag
                          </button>
                        </div>
                        <p className="mt-3 text-xs font-bold leading-5 text-[#667267]">Print at Actual Size / 100%. QR itself is 30 x 30 mm for reliable phone scanning.</p>
                        <p className="mt-3 break-all rounded-xl bg-white p-3 text-xs font-black">{selected.qrPayload || "Missing QR payload - ask admin before work."}</p>
                      </div>
                    </div>
                  )}
                  {isSalePriceTask && (
                    <label className="block max-w-sm rounded-2xl border border-amber-200 bg-amber-50 p-4">
                      <span className="text-sm font-black">Inspected Rooster Price</span>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-xl font-black">PHP</span>
                        <input value={saleAmount} onChange={(event) => setSaleAmount(event.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" placeholder="0" className="min-w-0 flex-1 rounded-xl border border-amber-300 bg-white p-3 text-lg font-black" />
                      </div>
                      <p className="mt-2 text-xs font-bold text-[#667267]">Enter the actual inspected amount. Admin will verify this before the customer can sell.</p>
                    </label>
                  )}
                  {isSaleReleaseTask && (
                    <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm font-bold leading-6 text-sky-900">
                      <b>Final sale acknowledgement:</b> Confirm in your documentation that you read the approved sale instruction and the rooster is ready for release. No photo or QR scan is required.
                    </div>
                  )}
                  <label className="block">
                    <span className="text-sm font-black">Work Documentation</span>
                    <textarea value={documentation} onChange={(event) => setDocumentation(event.target.value)} className="mt-2 min-h-32 w-full rounded-2xl border border-[#ded8c9] p-4 text-sm font-bold" placeholder={isSaleReleaseTask ? "Write your acknowledgement and final sale release note..." : "Write what was done, what was observed, and any quantity used..."} />
                  </label>
                  {(needsFeedQty || isMissionTask) && (
                    <div className="grid max-w-2xl gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 sm:grid-cols-2">
                      <label className="block">
                        <span className="text-sm font-black">Feed Used</span>
                        <div className="mt-2 flex items-center gap-2">
                          <input value={feedUsed} onChange={(event) => setFeedUsed(event.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" placeholder="0.000" className="min-w-0 flex-1 rounded-xl border p-3 font-black" />
                          <span className="font-bold">kg</span>
                        </div>
                      </label>
                      {isMissionTask && (
                        <label className="block">
                          <span className="text-sm font-black">Actual Remaining Feed</span>
                          <div className="mt-2 flex items-center gap-2">
                            <input value={actualRemainingFeed} onChange={(event) => setActualRemainingFeed(event.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" placeholder="0.000" className="min-w-0 flex-1 rounded-xl border p-3 font-black" />
                            <span className="font-bold">kg</span>
                          </div>
                        </label>
                      )}
                      {isMissionTask && (
                        <div className={"sm:col-span-2 rounded-xl p-3 text-xs font-bold leading-5 " + (hasInventoryDiscrepancy ? "bg-amber-100 text-amber-950" : "bg-white text-[#667267]")}>
                          Expected remaining: <b>{expectedRemainingFeedKg.toFixed(3)} kg</b> from {reservedFeedKg.toFixed(3)} kg reserved. {hasInventoryDiscrepancy ? "Inventory discrepancy will be flagged for Admin review." : "FarmConnect deducts Feed Used once, only after Admin approves the proof."}
                        </div>
                      )}
                    </div>
                  )}
                  {!isSaleReleaseTask && (
                    <div>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <b>Work Evidence</b>
                          <p className="text-sm font-bold text-[#667267]">{needsVideoProof ? "Attach the requested video; clear photos may be added too." : "Attach 1-5 clear photos or the requested video. QR opens after Submit Work."}</p>
                        </div>
                        <button type="button" onClick={() => proofInputRef.current?.click()} className="rounded-xl bg-[#eee8d9] px-4 py-3 font-black">
                          <Icon name="upload" className="mr-2 inline h-5 w-5" />
                          Add Evidence
                        </button>
                      </div>
                      <input ref={proofInputRef} type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime" multiple className="hidden" onChange={(event) => addProofFiles(event.target.files)} />
                      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                        {previews.map(({ file, url }, index) => (
                          <div key={`${file.name}-${index}`} className="relative overflow-hidden rounded-xl border bg-white">
                            {file.type.startsWith("video/") ? <video src={url} controls playsInline className="aspect-square w-full bg-black object-contain" /> : <img src={url} alt={`Proof ${index + 1}`} className="aspect-square w-full object-cover" />}
                            <button type="button" onClick={() => setProofFiles((files) => files.filter((_, itemIndex) => itemIndex !== index))} className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-full bg-red-600 text-xs font-black text-white" aria-label={`Remove ${file.name}`}>
                              x
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-3">
                    <button type="button" data-kafarm-feedback-target="caretaker-task-status" onClick={() => { setSubmitAttempt((current) => current + 1); openQrVerification(); }} className="rounded-xl bg-[#1f6b45] px-6 py-3 font-black text-white">
                      {isSaleReleaseTask || selected.workflowType === "qr_tagging" ? "Submit to Admin" : "Submit Work"}
                    </button>
                    <Link href="/caretaker/chat" className="rounded-xl bg-amber-300 px-6 py-3 font-black">
                      Ask Admin
                    </Link>
                  </div>
                </div>
              )}

              {phase === "scan" && (
                <div className="mt-5 rounded-3xl border-2 border-[#1f6b45] bg-emerald-50 p-5">
                  <div className="flex items-center gap-3">
                    <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-[#1f6b45]">
                      <Icon name="qr" />
                    </span>
                    <div>
                      <h3 className="text-xl font-black">Verify Rooster QR</h3>
                      <p className="text-sm font-bold text-[#667267]">Scan the QR attached to the rooster. Details appear only after a match.</p>
                    </div>
                  </div>
                  <video ref={qrVideoRef} muted playsInline className={"mt-5 aspect-video w-full rounded-2xl bg-[#17251d] object-cover " + (cameraActive ? "block" : "hidden")} />
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      disabled={cameraOpening}
                      onClick={() => {
                        if (cameraActive) {
                          stopQrCamera();
                          setCameraMessage("Camera stopped. You can open it again, enter the QR, or skip verification.");
                        } else {
                          void startQrCamera();
                        }
                      }}
                      className="rounded-xl bg-[#0f6fb8] px-5 py-3 font-black text-white disabled:cursor-wait disabled:opacity-60"
                    >
                      <Icon name="camera" className="mr-2 inline h-5 w-5" />
                      {cameraOpening ? "Opening Camera..." : cameraActive ? "Stop Camera" : "Open QR Camera"}
                    </button>
                    <span role="status" aria-live="polite" className="max-w-xl text-sm font-bold text-[#355f4a]">
                      {cameraMessage}
                    </span>
                  </div>
                  <div className="my-4 flex items-center gap-3 text-xs font-black uppercase text-[#667267]">
                    <span className="h-px flex-1 bg-emerald-200" />
                    <span>Manual QR fallback</span>
                    <span className="h-px flex-1 bg-emerald-200" />
                  </div>
                  <input
                    value={qrValue}
                    onChange={(event) => setQrValue(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") verifyQrValue(qrValue);
                    }}
                    className="w-full rounded-2xl border border-emerald-300 bg-white p-4 font-black"
                    placeholder="Scan or enter rooster QR"
                  />
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button type="button" onClick={() => verifyQrValue(qrValue)} className="rounded-xl bg-[#1f6b45] px-5 py-3 font-black text-white">
                      Verify QR
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        stopQrCamera();
                        setQrSkipped(true);
                        setQrValue("");
                        setPhase("confirm");
                        setTaskNote("QR was skipped. Admin will see this submission as not QR verified.");
                      }}
                      className="rounded-xl bg-amber-300 px-5 py-3 font-black"
                    >
                      Skip QR
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        stopQrCamera();
                        setQrSkipped(false);
                        setPhase("work");
                        setQrValue("");
                        setTaskNote("QR verification cancelled. Your documentation and photos are still here.");
                      }}
                      className="rounded-xl bg-white px-5 py-3 font-black"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {(phase === "confirm" || phase === "sending") && (
                <div className="mt-5">
                  <div className={"rounded-3xl border-2 p-5 " + (qrSkipped ? "border-amber-300 bg-amber-50" : "border-emerald-300 bg-emerald-50")}>
                    <div className="flex items-center gap-3">
                      <span className={"grid h-12 w-12 place-items-center rounded-2xl text-white " + (qrSkipped ? "bg-amber-500" : "bg-[#1f6b45]")}>
                        <Icon name={qrSkipped ? "alert" : "check"} />
                      </span>
                      <div>
                        <h3 className="text-xl font-black">{qrSkipped ? "QR Verification Skipped" : "QR Matched"}</h3>
                        <p className="text-sm font-bold text-[#667267]">{qrSkipped ? "Confirm the task details. Admin will review this as an exception." : "Confirm these details before sending."}</p>
                      </div>
                    </div>
                    <div className="mt-5 grid gap-3 md:grid-cols-3">
                      <div className="rounded-2xl bg-white p-4">
                        <p className="text-xs font-black uppercase text-[#667267]">Rooster Name</p>
                        <b className="mt-1 block text-lg">{selected.rooster}</b>
                        <span className="text-sm font-bold text-[#667267]">{selected.tag}</span>
                      </div>
                      <div className="rounded-2xl bg-white p-4">
                        <p className="text-xs font-black uppercase text-[#667267]">Owner Account</p>
                        <b className="mt-1 block text-lg">{selected.requester}</b>
                        <span className="text-sm font-bold text-[#667267]">{selected.ownerReference}</span>
                      </div>
                      <div className="rounded-2xl bg-white p-4">
                        <p className="text-xs font-black uppercase text-[#667267]">Task Requested</p>
                        <b className="mt-1 block text-lg">{selected.task}</b>
                        <span className="text-sm font-bold text-[#667267]">{documentation}</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex gap-3">
                    <button type="button" disabled={phase === "sending"} onClick={() => void sendToAdmin()} className="rounded-xl bg-[#1f6b45] px-6 py-3 font-black text-white disabled:opacity-60">
                      {phase === "sending" ? "Sending..." : "Send to Admin"}
                    </button>
                    <button
                      type="button"
                      disabled={phase === "sending"}
                      onClick={() => {
                        setQrSkipped(false);
                        setPhase("work");
                        setQrValue("");
                        setTaskNote("Send cancelled. The task remains active and your draft is unchanged.");
                      }}
                      className="rounded-xl bg-[#eee8d9] px-6 py-3 font-black disabled:opacity-60"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </Card>
      </div>
    </Shell>
  );
}

export function CompletedTasks() {
  const [local, setLocal] = useState<SubmittedTaskProof[]>([]);
  useEffect(() => setLocal(getSubmittedTaskProofs()), []);
  const rows = [
    ...local.map((p) => ({
      rooster: p.rooster,
      task: p.task,
      time: p.submittedAt,
      status: p.status,
      image: p.image,
    })),
    ...completedTasks,
  ];
  return (
    <Shell role="caretaker" title="Completed Tasks">
      <PageTitle title="Completed Tasks" text="Submitted tasks appear here for recall. Proof thumbnails are view-only." icon="check" />
      <div className="grid max-h-[620px] gap-4 overflow-y-auto pr-2 md:grid-cols-2">
        {rows.map((t) => (
          <Card key={t.task + t.time}>
            <div className="flex gap-4">
              <img src={t.image} className="h-20 w-20 rounded-xl object-cover" alt="" />
              <div>
                <h2 className="font-black">{t.task}</h2>
                <p className="text-sm text-[#667267]">
                  {t.rooster} - {t.time}
                </p>
                <Badge tone={t.status === "Verified" ? "good" : "warn"}>{t.status}</Badge>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </Shell>
  );
}
export function CaretakerChat() {
  type ChatMsg = {
    from: "caretaker" | "kafarm" | "admin";
    text: string;
    at: string;
  };
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      from: "kafarm",
      text: "Caretaker buddy, KaFarm muna. Sabihin kung QR, camera, serial, upload, task note, or proof ang problema. Kapag kailangan ng admin release/exception, ie-escalate ko.",
      at: "Now",
    },
  ]);
  const [msg, setMsg] = useState("");
  const [escalated, setEscalated] = useState(false);
  const [caseId, setCaseId] = useState("");
  const [dbNote, setDbNote] = useState("No active DB chat yet. Send a message to start.");
  function mapCareMessages(rows: any[]): ChatMsg[] {
    if (!rows.length)
      return [
        {
          from: "kafarm",
          text: "Caretaker buddy, KaFarm muna. Sabihin kung QR, camera, serial, upload, task note, or proof ang problema. Kapag kailangan ng admin release/exception, ie-escalate ko.",
          at: "Now",
        },
      ];
    return rows.map((row) => ({
      from: row.sender_role === "caretaker" ? "caretaker" : row.sender_role === "admin" ? "admin" : "kafarm",
      text: row.body,
      at: new Date(row.created_at).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    })) as ChatMsg[];
  }
  async function loadCaretakerSession(sessionId?: string) {
    try {
      const id = sessionId || caseId;
      if (!id) return;
      const { data, error } = await getSupportMessages(id);
      if (error) throw error;
      setMessages(mapCareMessages(data || []));
      const { data: session } = await getSupportSessionStatus(id);
      setEscalated(["escalated", "admin_joined", "ended", "completed"].includes(session?.status || ""));
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
  useEffect(() => {
    loadLatestCaretakerSession();
  }, []);
  useEffect(() => {
    if (caseId) loadCaretakerSession(caseId);
  }, [caseId]);
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
  async function send() {
    if (!msg.trim()) return;
    const q = msg.trim();
    const answer = replyFor(q);
    const shouldEscalate = escalated || needsAdmin(q);
    setMessages((current) => {
      const next = [
        ...current,
        { from: "caretaker" as const, text: q, at: "Now" },
        { from: "kafarm" as const, text: answer, at: "Now" },
        ...(shouldEscalate && !escalated
          ? [
              {
                from: "kafarm" as const,
                text: "I escalated this to admin. Do not use serial exception, bypass QR, or send customer update until admin reviews it.",
                at: "Now",
              },
            ]
          : []),
      ];
      return next;
    });
    if (needsAdmin(q)) setEscalated(true);
    setMsg("");
    try {
      const { data, error } = await sendSupportMessage({
        role: "caretaker",
        sessionId: caseId || null,
        body: q,
        forceEscalate: shouldEscalate,
      });
      if (error) throw error;
      setCaseId(data);
      await saveCaretakerKaFarmReply(data, answer, {
        mode: "caretaker_support",
        rule_based: true,
      });
      if (shouldEscalate && !escalated) await saveCaretakerKaFarmReply(data, `${getEscalationNotice(q, "caretaker")} Do not use serial exception, bypass QR, or send customer update until admin reviews it.`, { mode: "caretaker_support", escalation_notice: true });
      await loadCaretakerSession(data);
    } catch {
      setDbNote("Message shown here, but DB save failed. Please check caretaker account mapping.");
    }
  }
  async function escalateNow() {
    setEscalated(true);
    const last = [...messages].reverse().find((m) => m.from === "caretaker")?.text || "Caretaker requested admin exception";
    setMessages((current) => [
      ...current,
      {
        from: "kafarm",
        text: "I escalated this to admin. No serial exception, QR bypass, or customer update should happen until admin reviews it.",
        at: "Now",
      },
    ]);
    try {
      const { data, error } = await sendSupportMessage({
        role: "caretaker",
        sessionId: caseId || null,
        body: last,
        forceEscalate: true,
      });
      if (error) throw error;
      setCaseId(data);
      await saveCaretakerKaFarmReply(data, "I escalated this to admin. No serial exception, QR bypass, or customer update should happen until admin reviews it.", { mode: "caretaker_support", escalation_notice: true });
      await loadCaretakerSession(data);
    } catch {
      setDbNote("Escalation visible here, but DB sync failed. Admin may need to check caretaker profile link.");
    }
  }
  const showEscalate = !escalated && messages.some((m, i) => i > 0 && m.from === "kafarm" && /admin|exception|release|sensitive|wrong/i.test(m.text));
  return (
    <Shell role="caretaker" title="Chat Admin">
      <PageTitle title="Chat Admin" text="Ask KaFarm first for QR, camera, serial, upload, task, or proof issues. Admin joins when exception is needed." icon="chat" />
      <section className="mx-auto max-w-4xl overflow-hidden rounded-[28px] border border-[#e3ded0] bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ece6d8] bg-[#fffdf7] p-4">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-[#1f6b45] text-white">
              <Icon name="chat" />
            </div>
            <div>
              <h2 className="text-xl font-black">{escalated ? "Admin Escalation Open" : "KaFarm Caretaker Help"}</h2>
              <p className="text-sm font-bold text-[#667267]">Customer and caretaker still cannot chat directly.</p>
            </div>
          </div>
          <Badge tone={escalated ? "warn" : "good"}>{escalated ? "Escalated" : "Ka-Farm First"}</Badge>
        </div>
        <div className="min-h-[62vh] bg-[linear-gradient(180deg,#fffdf7_0%,#f6f3e8_100%)] p-4">
          <div className="max-h-[62vh] space-y-3 overflow-y-auto pr-2">
            {messages.map((m, i) => (
              <div key={i} className={"max-w-[86%] rounded-2xl p-3 shadow-sm " + (m.from === "caretaker" ? "ml-auto bg-[#1f6b45] text-white" : m.from === "admin" ? "bg-sky-50 text-[#12375a] ring-1 ring-sky-100" : "bg-white")}>
                <b>{m.from === "caretaker" ? "Caretaker" : m.from === "admin" ? "Admin" : "Ka-Farm"}</b>
                <p className="mt-1 text-sm leading-6">{m.text}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="border-t border-[#ece6d8] bg-white p-4">
          {showEscalate && (
            <button onClick={escalateNow} className="mb-3 w-full rounded-2xl bg-amber-300 px-4 py-3 font-black text-[#17251d]">
              Escalate to Admin
            </button>
          )}
          <div className="flex gap-2">
            <input
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") send();
              }}
              className="flex-1 rounded-2xl border border-[#ded8c9] bg-[#fffdf7] p-4 font-bold"
              placeholder="Message KaFarm about QR, camera, serial, upload, task, or proof..."
            />
            <button onClick={send} className="rounded-2xl bg-[#1f6b45] px-6 font-black text-white">
              Send
            </button>
          </div>
          <p className="mt-2 text-xs font-bold text-[#667267]">{dbNote}</p>
        </div>
      </section>
    </Shell>
  );
}
export function CaretakerProfile() {
  const [caretaker, setCaretaker] = useState<any>(null);
  const [profileNote, setProfileNote] = useState("Loading your verified caretaker profile...");

  useEffect(() => {
    let mounted = true;
    getCurrentCaretakerProfile()
      .then((row) => {
        if (!mounted) return;
        setCaretaker(row);
        setProfileNote(row ? "Your name, role, contact details, and resume are loaded from your approved caretaker account." : "No approved caretaker profile is linked to this login yet.");
      })
      .catch((error) => mounted && setProfileNote(`Profile could not be loaded: ${readableAppError(error) || "Check caretaker login and profile link."}`));
    return () => {
      mounted = false;
    };
  }, []);

  const name = caretaker?.display_name || caretaker?.full_name || caretaker?.profile?.display_name || caretaker?.profile?.full_name || "Caretaker";
  const role = caretaker?.farm_role || "Farm Caretaker";
  const initials =
    String(name)
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part: string) => part[0])
      .join("")
      .toUpperCase() || "FC";
  return (
    <Shell role="caretaker" title="Profile">
      <PageTitle title="Profile" text="Your verified caretaker identity, farm role, contact details, and resume." icon="user" />
      <KaFarm>{profileNote}</KaFarm>
      <Card className="mt-5">
        <div className="flex flex-wrap items-start gap-5">
          {caretaker?.avatar_url ? <img src={caretaker.avatar_url} alt={`${name} profile`} className="h-24 w-24 rounded-full object-cover ring-4 ring-[#dfeada]" /> : <div className="grid h-24 w-24 place-items-center rounded-full bg-[#dfeada] text-3xl font-black">{initials}</div>}
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-black">{name}</h2>
            <p className="mt-1 font-black text-[#1f6b45]">{role}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Info label="Account Status" value={String(caretaker?.status || caretaker?.profile?.account_status || "Pending").replaceAll("_", " ")} />
              <Info label="Email" value={caretaker?.email || caretaker?.profile?.email || "Not recorded"} />
              <Info label="Phone" value={caretaker?.phone || caretaker?.profile?.phone || "Not recorded"} />
              <Info label="Resume Review" value={String(caretaker?.resume_review_status || "Not reviewed").replaceAll("_", " ")} />
            </div>
            {caretaker?.resume_url && (
              <a href={caretaker.resume_url} target="_blank" rel="noreferrer" onClick={() => setProfileNote("Resume opened in a secure viewer.")} className="mt-4 inline-block rounded-xl bg-[#1f6b45] px-4 py-3 font-black text-white">
                View Resume
              </a>
            )}
          </div>
        </div>
      </Card>
    </Shell>
  );
}

export function CaretakerOperationChecker() {
  const [tasks, setTasks] = useState<CaretakerTaskView[]>([]);
  const [selected, setSelected] = useState<CaretakerTaskView | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const checklist = ["Read customer note", "Verify rooster QR", "Use serial only if admin releases exception", "Capture clear proof", "Choose prepared note", "Submit for admin/customer review"];
  useEffect(() => {
    let mounted = true;
    getCaretakerActiveTasks()
      .then((rows) => {
        if (!mounted) return;
        const mapped = (rows || []).map(mapCaretakerTaskRow);
        setTasks(mapped);
        setSelected(mapped[0] || null);
        setLoadState("ready");
      })
      .catch(() => {
        if (mounted) setLoadState("error");
      });
    return () => {
      mounted = false;
    };
  }, []);
  const stats = [
    {
      label: "Active",
      value: loadState === "loading" ? "..." : `${tasks.length}`,
      icon: "clipboard" as IconName,
    },
    {
      label: "Urgent",
      value: loadState === "loading" ? "..." : `${tasks.filter((t) => t.priority === "urgent").length}`,
      icon: "alert" as IconName,
    },
    { label: "Completed", value: "View", icon: "check" as IconName },
    {
      label: "Admin Chat",
      value: "Open",
      icon: "chat" as IconName,
      tone: "neutral" as const,
    },
  ];
  return (
    <Shell role="caretaker" title="Caretaker Dashboard">
      <PageTitle title="Caretaker Dashboard" text="Assigned work, proof requirements, and admin support in one screen." icon="clipboard" />
      <KaFarm>{loadState === "loading" ? "Checking your assigned tasks..." : loadState === "error" ? "I could not load your task queue. Check your login or ask admin before retrying." : tasks.length ? "Select a task, read the instruction, then open it to start proof work." : "No task is assigned to you right now."}</KaFarm>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="p-4">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#f6f3e8] text-[#1f6b45]">
                <Icon name={s.icon} />
              </span>
              <span>
                <p className="text-xs font-black uppercase text-[#667267]">{s.label}</p>
                <p className="text-xl font-black">{s.value}</p>
              </span>
            </div>
          </Card>
        ))}
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)_300px]">
        <Card>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-black">Task Queue</h2>
            <Badge tone={tasks.length ? "warn" : "neutral"}>{tasks.length}</Badge>
          </div>
          <div className="mt-4 max-h-[520px] space-y-3 overflow-y-auto pr-2">
            {tasks.map((t) => (
              <button key={t.id} onClick={() => setSelected(t)} className={"w-full rounded-xl border p-3 text-left transition " + (selected?.id === t.id ? "border-[#1f6b45] bg-emerald-50" : "border-[#ece6d8] bg-[#fffdf7]")}>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <b className="block truncate">{t.requester}</b>
                    <p className="truncate text-sm font-bold text-[#667267]">
                      {t.rooster} - {t.task}
                    </p>
                  </div>
                  <Badge tone={t.priority === "urgent" ? "warn" : "neutral"}>{t.priority}</Badge>
                </div>
                <p className="mt-2 text-xs font-black text-[#1f6b45]">{t.due}</p>
              </button>
            ))}
            {loadState === "ready" && tasks.length === 0 && (
              <div className="rounded-2xl border border-dashed border-[#ded8c9] bg-[#fffdf7] p-6 text-center">
                <b>No assigned task</b>
                <p className="mt-2 text-sm font-bold leading-6 text-[#667267]">Admin-assigned requests will appear here automatically.</p>
              </div>
            )}
            {loadState === "error" && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800">Task queue unavailable. Open Admin Chat for help.</div>}
          </div>
        </Card>
        <Card>
          {selected ? (
            <>
              <p className="text-xs font-black uppercase text-[#667267]">Selected Task</p>
              <div className="mt-3 grid gap-4 md:grid-cols-[160px_1fr]">
                <img src="/farmconnect/roosters/fc-stage-3-young-rooster-base.jpg" className="h-40 w-full rounded-xl object-cover" alt="Selected rooster" />
                <div>
                  <h2 className="text-2xl font-black">{selected.task}</h2>
                  <p className="mt-1 text-sm font-bold text-[#667267]">
                    {selected.rooster} / {selected.tag} - {selected.pen}
                  </p>
                  <div className="mt-4 rounded-xl bg-amber-50 p-4">
                    <b>Instruction</b>
                    <p className="mt-1 text-sm font-bold leading-6 text-[#667267]">{selected.note}</p>
                  </div>
                </div>
              </div>
              <div className="mt-4 rounded-xl bg-[#f6f3e8] p-4">
                <b>Required proof</b>
                <p className="mt-1 text-sm font-bold text-[#667267]">{selected.proof}</p>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <Link href="/caretaker/tasks" className="rounded-xl bg-[#1f6b45] px-4 py-3 text-center font-black text-white">
                  Open Task
                </Link>
                <Link href="/caretaker/chat" className="rounded-xl bg-amber-300 px-4 py-3 text-center font-black">
                  Ask Admin
                </Link>
              </div>
            </>
          ) : (
            <div className="grid min-h-[390px] place-items-center rounded-2xl border border-dashed border-[#ded8c9] bg-[#fffdf7] p-8 text-center">
              <div>
                <Icon name="clipboard" className="mx-auto h-9 w-9 text-[#1f6b45]" />
                <h2 className="mt-3 text-2xl font-black">Waiting for work</h2>
                <p className="mt-2 max-w-sm text-sm font-bold leading-6 text-[#667267]">Once admin assigns an approved customer request, its exact instruction and proof requirement will appear here.</p>
              </div>
            </div>
          )}
        </Card>
        <Card>
          <h2 className="text-xl font-black">Work Steps</h2>
          <div className="mt-4 space-y-2">
            {checklist.map((item, i) => (
              <div key={item} className="flex items-start gap-3 rounded-xl bg-[#f6f3e8] p-3">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white text-xs font-black">{i + 1}</span>
                <p className="text-sm font-bold leading-5 text-[#667267]">{item}</p>
              </div>
            ))}
          </div>
          <Link href={selected ? "/caretaker/tasks" : "/caretaker/chat"} className="mt-4 block rounded-xl bg-[#1f6b45] px-4 py-3 text-center font-black text-white">
            {selected ? "Start Selected Task" : "Contact Admin"}
          </Link>
        </Card>
      </div>
    </Shell>
  );
}
const adminQueues = [
  {
    title: "Pending Withdrawals",
    count: 3,
    text: "Manual payout and proof upload needed.",
    href: "/admin/customer-requests/withdraw",
    icon: "wallet",
  },
  {
    title: "Flagged Proof",
    count: 4,
    text: "Blurred or missing QR verification.",
    href: "/admin/caretaker-management",
    icon: "alert",
  },
  {
    title: "Live Chat Queue",
    count: 2,
    text: "Escalated Ka-Farm support chats.",
    href: "/admin/live-chat",
    icon: "chat",
  },
  {
    title: "Unassigned Requests",
    count: 5,
    text: "Paid requests waiting for caretaker.",
    href: "/admin/farm-operations",
    icon: "clipboard",
  },
];

const adminDashboardIndicators = [
  {
    title: "Issues",
    value: "5",
    sub: "2 high priority reports",
    detail: "Customer/caretaker problems needing investigation.",
    href: "/admin/issue-management",
    icon: "alert" as IconName,
    tone: "bad" as const,
  },
  {
    title: "Requests",
    value: "12",
    sub: "Payments, care, withdrawals",
    detail: "Customer submitted requests waiting for admin movement.",
    href: "/admin/customer-requests",
    icon: "clipboard" as IconName,
    tone: "warn" as const,
  },
  {
    title: "Task Reviews",
    value: "4",
    sub: "Caretaker proof checks",
    detail: "Submitted work needing approval or rejection.",
    href: "/admin/caretaker-management",
    icon: "camera" as IconName,
    tone: "warn" as const,
  },
  {
    title: "Money In",
    value: peso(18400),
    sub: "Approved today estimate",
    detail: "Payment proofs and sales income summary.",
    href: "/admin/customer-requests",
    icon: "coins" as IconName,
    tone: "good" as const,
  },
  {
    title: "Money Out",
    value: peso(6200),
    sub: "Pending release",
    detail: "Withdrawal payout checks and receipts.",
    href: "/admin/customer-requests",
    icon: "wallet" as IconName,
    tone: "warn" as const,
  },
  {
    title: "Priority",
    value: "P1",
    sub: "Withdrawal/KYC risk",
    detail: "Highest queue to open first.",
    href: "/admin/account-verification",
    icon: "shield" as IconName,
    tone: "bad" as const,
  },
  {
    title: "Earnings",
    value: peso(12200),
    sub: "Net estimate today",
    detail: "Farm buy, care services, and rooster sales.",
    href: "/admin/farm-operations",
    icon: "rooster" as IconName,
    tone: "good" as const,
  },
  {
    title: "System Alerts",
    value: "3",
    sub: "Needs evidence check",
    detail: "Missing proof, stuck status, or failed linkage.",
    href: "/admin/kafarm",
    icon: "support" as IconName,
    tone: "neutral" as const,
  },
];

export function AdminHome() {
  return (
    <Shell role="admin" title="Admin Dashboard">
      <PageTitle title="Admin Dashboard" text="Indicator board lang: tingnan kung saan may issue, request, task review, priority, at pera." icon="shield" />
      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {adminDashboardIndicators.map((item) => (
            <Link key={item.title} href={item.href} className="rounded-2xl border border-[#e3ded0] bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
              <div className="flex items-start justify-between gap-3">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#f6f3e8] text-[#1f6b45]">
                  <Icon name={item.icon} />
                </span>
                <Badge tone={item.tone}>{item.sub}</Badge>
              </div>
              <p className="mt-4 text-xs font-black uppercase text-[#667267]">{item.title}</p>
              <h2 className="mt-1 text-3xl font-black">{item.value}</h2>
              <p className="mt-2 min-h-[48px] text-sm font-bold leading-6 text-[#667267]">{item.detail}</p>
              <span className="mt-3 inline-block rounded-xl bg-[#1f6b45] px-3 py-2 text-sm font-black text-white">Open Desk</span>
            </Link>
          ))}
        </div>
        <KaFarmAdmin />
      </div>
    </Shell>
  );
}

function KaFarmAdmin() {
  return (
    <Card>
      <div className="flex items-center gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-[#1f6b45] text-white">
          <Icon name="support" />
        </div>
        <div>
          <h2 className="text-xl font-black">Ask Ka-Farm</h2>
          <p className="text-sm text-[#667267]">Backlog assistant, not decision maker.</p>
        </div>
      </div>
      <div className="mt-4 max-h-[520px] space-y-3 overflow-y-auto pr-2">
        {adminQueues.map((q) => (
          <div key={q.title} className="rounded-xl bg-[#f6f3e8] p-3">
            <div className="flex items-center justify-between">
              <b>{q.title}</b>
              <Badge tone={q.count > 3 ? "warn" : "neutral"}>{q.count}</Badge>
            </div>
            <p className="mt-1 text-sm text-[#667267]">{q.text}</p>
            <Link href={q.href} className="mt-2 inline-block rounded-lg bg-white px-3 py-2 text-sm font-black">
              Open
            </Link>
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-xl border p-3 text-sm text-[#667267]">Try: "Ano naiwan?", "Bakit flagged si Juan?", "Ano nangyari kay Aydana?"</div>
    </Card>
  );
}

function AdminLiveChatPage() {
  type AdminMsg = {
    from: "customer" | "caretaker" | "kafarm" | "admin";
    text: string;
    at?: string;
  };
  type EscalatedChat = {
    id: string;
    name: string;
    role: "customer" | "caretaker";
    avatar: string;
    issue: string;
    status: string;
    risk: string;
    relatedRecord: string;
    summary: string;
    suggestedReply: string;
    solvedBy: string;
    last: string;
    messages: AdminMsg[];
    createdAt?: string;
  };
  const placeholderChats: EscalatedChat[] = [
    {
      id: "demo-customer",
      name: "No escalated chat yet",
      role: "customer",
      avatar: "KC",
      issue: "Database queue empty",
      status: "Read Only",
      risk: "Low",
      relatedRecord: "Support chat DB",
      summary: "When customer or caretaker support escalates to admin, the real session will appear in this list.",
      suggestedReply: "Open a customer/caretaker support page, send a sensitive concern, then refresh this queue.",
      solvedBy: "Placeholder only",
      last: "Placeholder",
      messages: [
        {
          from: "kafarm",
          text: "This is only an empty state. Real escalations load from Supabase.",
        },
      ],
    },
  ];
  const [chats, setChats] = useState<EscalatedChat[]>(placeholderChats);
  const [selected, setSelected] = useState<EscalatedChat>(placeholderChats[0]);
  const [reply, setReply] = useState("");
  const [dbNote, setDbNote] = useState("Loading escalated chats from database...");
  function initials(name: string) {
    return (name || "KC")
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }
  function mapAdminMessages(rows: any[]): AdminMsg[] {
    return (rows || []).map((row) => ({
      from: row.sender_role === "customer" ? "customer" : row.sender_role === "caretaker" ? "caretaker" : row.sender_role === "admin" ? "admin" : "kafarm",
      text: row.body || "",
      at: row.created_at
        ? new Date(row.created_at).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })
        : "",
    })) as AdminMsg[];
  }
  function mapChat(row: any): EscalatedChat {
    const name = row.user_name || "Unknown user";
    const status = String(row.status || "escalated")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
    const messages = mapAdminMessages(row.messages || []);
    return {
      id: row.id,
      name,
      role: row.role === "caretaker" ? "caretaker" : "customer",
      avatar: initials(name),
      issue: row.title || "Support escalation",
      status,
      risk: row.risk_level ? String(row.risk_level).replace(/\b\w/g, (c) => c.toUpperCase()) : "Medium",
      relatedRecord: row.related_record_label || "No linked record yet",
      summary: row.issue_summary || "KaFarm escalated this chat because admin review may be needed.",
      suggestedReply: row.suggested_reply || "Hi, admin joined. I will check the related records before any decision.",
      solvedBy: status === "Completed" ? "Completed by admin" : status === "Ended" ? "Ended by admin" : "Escalated to admin",
      last: row.updated_at ? new Date(row.updated_at).toLocaleString() : "Database",
      messages: messages.length ? messages : [{ from: "kafarm", text: "No messages loaded yet.", at: "" }],
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
      setSelected((current) => next.find((item) => item.id === current?.id) || next[0]);
      setDbNote(mapped.length ? "Live database queue. Chat transcripts are evidence-ready." : "No real escalated chats yet. Placeholder empty state shown.");
    } catch {
      setChats(placeholderChats);
      setSelected(placeholderChats[0]);
      setDbNote("Could not load database queue. Check admin login/RLS or Supabase connection.");
    }
  }
  useEffect(() => {
    loadChats();
  }, []);
  async function runAdminAction(action: "join" | "reply" | "end" | "complete") {
    if (selected.id.startsWith("demo-")) {
      setDbNote("Placeholder only. Create a real escalation from customer/caretaker support first.");
      return;
    }
    try {
      if (action === "reply") {
        if (!reply.trim()) return;
      }
      const { error } = await runAdminSupportAction({
        action,
        sessionId: selected.id,
        body: reply.trim(),
      });
      if (error) throw error;
      if (action === "reply") setReply("");
      setDbNote("Admin action saved. Evidence log updated when chat is joined/ended/completed.");
      await loadChats();
    } catch {
      setDbNote("Action failed safely. No sensitive change was made; check admin role or DB function.");
    }
  }
  function sendAdminReply() {
    if (!reply.trim()) return;
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
  return (
    <Shell role="admin" title="Live Chat">
      <PageTitle title="Escalated Chats" text="Only chats escalated by KaFarm appear here. Admin can join, reply, end, and complete the chat." icon="chat" />
      <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)_320px]">
        <Card>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-black">Escalation Queue</h2>
            <Badge tone="warn">{chats.filter((c) => c.status !== "Completed").length}</Badge>
          </div>
          <button onClick={loadChats} className="mt-3 w-full rounded-xl bg-[#eee8d9] px-3 py-2 text-sm font-black">
            Refresh Database Queue
          </button>
          <p className="mt-2 text-xs font-bold leading-5 text-[#667267]">{dbNote}</p>
          <div className="mt-4 max-h-[640px] space-y-3 overflow-y-auto pr-2">
            {chats.map((chat) => (
              <button key={chat.id} onClick={() => setSelected(chat)} className={"w-full rounded-2xl border p-3 text-left transition " + (selected.id === chat.id ? "border-[#1f6b45] bg-emerald-50" : "border-[#ece6d8] bg-[#fffdf7]")}>
                <div className="flex items-center gap-3">
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#1f6b45] font-black text-white">{chat.avatar}</div>
                  <div className="min-w-0 flex-1">
                    <b className="block truncate">{chat.name}</b>
                    <p className="truncate text-xs font-black uppercase text-[#667267]">{chat.role}</p>
                    <p className="truncate text-sm font-bold text-[#667267]">{chat.issue}</p>
                  </div>
                  <Badge tone={chat.status === "Completed" ? "good" : chat.status === "Ended" ? "neutral" : "warn"}>{chat.status}</Badge>
                </div>
                <p className="mt-2 line-clamp-2 text-xs font-bold leading-5 text-[#667267]">{chat.summary}</p>
                <p className="mt-2 text-xs font-black text-[#1f6b45]">{chat.last}</p>
              </button>
            ))}
          </div>
        </Card>
        <div className="grid gap-5">
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase text-[#667267]">KaFarm Summary Before Admin Joins</p>
                <h2 className="mt-1 text-2xl font-black">{selected.name}</h2>
                <p className="text-sm font-bold text-[#667267]">{selected.issue}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge tone={selected.risk === "High" ? "bad" : selected.risk === "Medium" ? "warn" : "neutral"}>{selected.risk} Risk</Badge>
                <Badge>{selected.role}</Badge>
              </div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <Info label="Related Record" value={selected.relatedRecord} />
              <Info label="Status" value={selected.status} />
            </div>
            <div className="mt-4 rounded-2xl bg-[#f6f3e8] p-4">
              <b>Issue Summary</b>
              <p className="mt-1 text-sm font-bold leading-6 text-[#667267]">{selected.summary}</p>
            </div>
            <div className="mt-4 rounded-2xl bg-sky-50 p-4 text-[#12375a]">
              <b>Suggested Reply</b>
              <p className="mt-1 text-sm font-bold leading-6">{selected.suggestedReply}</p>
            </div>
          </Card>
          <Card>
            <h2 className="text-xl font-black">Chat Thread</h2>
            <div className="mt-4 max-h-[430px] space-y-3 overflow-y-auto pr-2">
              {selected.messages.map((m, i) => (
                <div key={i} className={"max-w-[86%] rounded-2xl p-3 " + (m.from === "admin" ? "ml-auto bg-[#1f6b45] text-white" : m.from === "customer" || m.from === "caretaker" ? "bg-sky-50 text-[#12375a] ring-1 ring-sky-100" : "bg-[#f6f3e8]")}>
                  <b>{m.from === "admin" ? "Admin" : m.from === "customer" ? "Customer" : m.from === "caretaker" ? "Caretaker" : "Ka-Farm"}</b>
                  <p className="mt-1 text-sm leading-6">{m.text}</p>
                  {m.at && <p className="mt-1 text-[11px] font-black opacity-70">{m.at}</p>}
                </div>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <input
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") sendAdminReply();
                }}
                placeholder={isPlaceholderChat ? "Waiting for real escalated chat" : "Admin reply..."}
                disabled={isPlaceholderChat}
                className="flex-1 rounded-xl border border-[#ded8c9] p-3 font-bold disabled:bg-[#f6f3e8] disabled:text-[#8b8b8b]"
              />
              <button onClick={sendAdminReply} disabled={isPlaceholderChat} className="rounded-xl bg-[#1f6b45] px-5 font-black text-white disabled:cursor-not-allowed disabled:bg-[#cfc7b5]">
                Send
              </button>
            </div>
          </Card>
        </div>
        <Card>
          <h2 className="text-xl font-black">Admin Actions</h2>
          <p className="mt-2 text-sm font-bold leading-6 text-[#667267]">Database-backed chat handling and evidence-ready transcript. No wallet, KYC, withdrawal, fraud, or record edits here.</p>
          <div className="mt-4 grid gap-2">
            <button onClick={joinChat} disabled={isPlaceholderChat} className="rounded-xl bg-[#1f6b45] px-4 py-3 font-black text-white disabled:cursor-not-allowed disabled:bg-[#cfc7b5]">
              {isPlaceholderChat ? "Waiting for Chat" : "Join Chat"}
            </button>
            <button onClick={endChat} disabled={isPlaceholderChat} className="rounded-xl bg-amber-300 px-4 py-3 font-black disabled:cursor-not-allowed disabled:bg-[#e4ddcf]">
              End Chat
            </button>
            <button onClick={completeChat} disabled={isPlaceholderChat} className="rounded-xl bg-[#eee8d9] px-4 py-3 font-black disabled:cursor-not-allowed">
              Complete Chat
            </button>
            <Link href="/admin/evidence" className="rounded-xl bg-white px-4 py-3 text-center font-black shadow-sm">
              Open Evidence
            </Link>
          </div>
          <div className="mt-4 rounded-2xl border border-dashed border-[#ded8c9] bg-[#fffdf7] p-3 text-sm font-bold leading-6 text-[#667267]">{dbNote}</div>
        </Card>
      </div>
    </Shell>
  );
}
const emptyCustomerRequestJob = {
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
  route: "/admin/customer-requests",
};

const customerDeskSections = [
  {
    id: "payment",
    title: "Payment Review",
    icon: "coins" as IconName,
    tone: "warn" as const,
    count: 3,
    text: "Review receipt, reference number, receiver account, and admin notes. Approved creates invoice; rejected returns to customer payment status for resubmit.",
    href: "/admin/customer-requests/payment",
  },
  {
    id: "care",
    title: "Care Request",
    icon: "rooster" as IconName,
    tone: "warn" as const,
    count: 2,
    text: "Review customer care and paid Care Plan requests. Approved items move to Task Management for one caretaker assignment.",
    href: "/admin/customer-requests/care",
  },
  {
    id: "sell",
    title: "Sell Request",
    icon: "coins" as IconName,
    tone: "warn" as const,
    count: 0,
    text: "Review the customer-confirmed rooster price, then approve final caretaker release or reject with a clear note.",
    href: "/admin/customer-requests/sell",
  },
  {
    id: "task",
    title: "Task Management",
    icon: "clipboard" as IconName,
    tone: "bad" as const,
    count: 4,
    text: "Only job: assign caretaker to approved care requests, then it appears in caretaker app.",
    href: "/admin/customer-requests/task",
  },
  {
    id: "withdraw",
    title: "Withdrawal Review",
    icon: "wallet" as IconName,
    tone: "warn" as const,
    count: 2,
    text: "Review withdrawal method, send payout externally, upload receipt/reference, then wait for customer confirmation.",
    href: "/admin/customer-requests/withdraw",
  },
];

const customerRequestJobs: Array<typeof emptyCustomerRequestJob> = [];

function AdminCustomerRequestsPage() {
  const [activeSection, setActiveSection] = useState("payment");
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const [liveWithdrawals, setLiveWithdrawals] = useState<any[]>([]);
  const [liveSellCount, setLiveSellCount] = useState(0);
  const [adminStatus, setAdminStatus] = useState("");
  const liveWithdrawalJobs = liveWithdrawals.map((row: any) => ({
    id: row.id,
    queue: "withdraw",
    name: row.profiles?.full_name || row.profiles?.display_name || row.payout_holder || "Customer",
    avatar: String(row.profiles?.full_name || row.payout_holder || "Customer")
      .split(" ")
      .map((part: string) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase(),
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
  const sourceJobs = activeSection === "withdraw" && liveWithdrawalJobs.length ? liveWithdrawalJobs : customerRequestJobs;
  const visibleJobs = sourceJobs.filter((job) => job.queue === activeSection && !hiddenIds.includes(`${job.queue}-${job.id}-${job.problem}`));
  const [selected, setSelected] = useState(visibleJobs[0] || sourceJobs.find((job) => job.queue === activeSection) || emptyCustomerRequestJob);
  const [note, setNote] = useState("");
  const [decision, setDecision] = useState<"open" | "approved" | "rejected">("open");
  const [selectedCaretaker, setSelectedCaretaker] = useState("Juan Dela Cruz");
  const [viewer, setViewer] = useState<"receipt" | "invoice" | null>(null);
  const [payoutReceiptName, setPayoutReceiptName] = useState("");
  const [payoutReceiptPreview, setPayoutReceiptPreview] = useState("");
  const [payoutReference, setPayoutReference] = useState("");
  const activeSectionInfo = customerDeskSections.find((section) => section.id === activeSection) || customerDeskSections[0];
  const selectedKey = `${selected.queue}-${selected.id}-${selected.problem}`;
  const orderItems =
    selected.queue === "payment" && selected.problem.includes("Farm Buy")
      ? [
          { name: "Starter Chick (Hatch-Kelso)", qty: 1, price: 450 },
          { name: "Premium Rooster Feeds", qty: 2, price: 80 },
        ]
      : selected.queue === "care"
        ? [{ name: "Give Vitamins service", qty: 1, price: 120 }]
        : selected.queue === "withdraw"
          ? [
              {
                name: "Withdrawal request",
                qty: 1,
                price: Number((selected as any).liveWithdrawal?.amount || 2500),
              },
            ]
          : [{ name: "Approved care request", qty: 1, price: 120 }];
  const total = orderItems.reduce((sum, item) => sum + item.qty * item.price, 0);
  const reference = selected.priority === "High" ? "DUP-987678987" : selected.queue === "withdraw" ? "WD-240801-118" : "PAY-987678987";
  const receiptStatus = selected.priority === "High" ? "Possible duplicate reference" : "Receipt uploaded by customer";
  const withdrawalMethod = {
    provider: (selected as any).liveWithdrawal?.payout_method || "GCash",
    holder: (selected as any).liveWithdrawal?.payout_holder || selected.name,
    account: (selected as any).liveWithdrawal?.payout_account || "09XX XXX 1288",
    bank: "Customer saved payout method",
  };

  const caretakers = [
    {
      name: "Juan Dela Cruz",
      load: "2 active tasks",
      skill: "Feed, vitamins, QR proof",
    },
    {
      name: "Mia Santos",
      load: "1 active task",
      skill: "Video proof, supplements",
    },
    {
      name: "Rico Tan",
      load: "Available",
      skill: "Night check, rooster handling",
    },
  ];
  useEffect(() => {
    let mounted = true;
    getAdminWithdrawalRequests()
      .then((rows) => {
        if (!mounted) return;
        setLiveWithdrawals((rows || []).filter((row: any) => !["completed", "approved"].includes(String(row.status || ""))));
        setAdminStatus(rows?.length ? "Live withdrawal requests loaded." : "No live withdrawal requests yet.");
      })
      .catch(() => {
        if (!mounted) return;
        setLiveWithdrawals([]);
        setAdminStatus("Withdrawal SQL not ready or admin session needed. Placeholder queue is shown.");
      });
    getAdminRoosterSaleRequests()
      .then((rows) => {
        if (mounted) setLiveSellCount((rows || []).filter((row: any) => row.status === "sale_requested").length);
      })
      .catch(() => {
        if (mounted) setLiveSellCount(0);
      });
    return () => {
      mounted = false;
    };
  }, []);
  useEffect(() => {
    const next = visibleJobs[0] || sourceJobs.find((job) => job.queue === activeSection) || emptyCustomerRequestJob;
    setSelected(next);
    setDecision("open");
    setNote("");
  }, [activeSection, hiddenIds, liveWithdrawals.length]);
  function submitAction(next: "approved" | "rejected") {
    setDecision(next);
    setNote((current) => current || (next === "approved" ? "Approved after checking receipt/reference and evidence." : "Rejected. Customer must see clear reason and can resubmit."));
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
        setLiveWithdrawals((rows) => rows.filter((row: any) => row.id !== (selected as any).liveWithdrawal.id));
      } catch {
        setAdminStatus("Withdrawal decision could not be saved. Check SQL 020 or admin session.");
        return;
      }
    }
    setHiddenIds((current) => (current.includes(selectedKey) ? current : [...current, selectedKey]));
    setDecision("open");
    setNote("");
    setPayoutReference("");
    setPayoutReceiptName("");
    setPayoutReceiptPreview("");
  }
  return (
    <Shell role="admin" title="Customer Requests Management">
      <PageTitle title="Customer Requests Management" text="Review only active customer requests: payments, care requests, sell requests, task assignment, and withdrawals." icon="clipboard" />
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {customerDeskSections.map((section) => (
          <button key={section.id} onClick={() => setActiveSection(section.id)} className={"rounded-2xl border p-4 text-left shadow-sm transition " + (activeSection === section.id ? "border-[#1f6b45] bg-[#e9fff3] ring-2 ring-[#1f6b45]/20" : "border-[#e3ded0] bg-white/95 hover:border-[#1f6b45]")}>
            <div className="flex items-start justify-between gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#f6f3e8]">
                <Icon name={section.icon} />
              </span>
              <Badge tone={section.tone}>
                {section.id === "sell"
                  ? liveSellCount
                  : customerRequestJobs.filter((job) => job.queue === section.id && !hiddenIds.includes(`${job.queue}-${job.id}-${job.problem}`)).length}
              </Badge>
            </div>
            <h2 className="mt-3 text-lg font-black">{section.title}</h2>
            <p className="mt-1 line-clamp-2 text-xs font-bold leading-5 text-[#667267]">{section.text}</p>
          </button>
        ))}
      </div>
      {activeSection === "payment" && (
        <div className="mt-5">
          <AdminManualPaymentQueue sourceType="farm_buy" />
        </div>
      )}
      {activeSection === "care" && (
        <div className="mt-5">
          <AdminManualPaymentQueue sourceType="care" />
        </div>
      )}
      {activeSection === "sell" && (
        <div className="mt-5">
          <AdminRoosterSaleQueue />
        </div>
      )}
      {activeSection === "task" && (
        <div className="mt-5">
          <AdminLiveCareRequestQueue mode="task" />
        </div>
      )}
      {activeSection === "withdraw" && (
        <div className="mt-5">
          <AdminWithdrawalReviewQueue />
        </div>
      )}
      {!["payment", "care", "sell", "task", "withdraw"].includes(activeSection) && (
        <div className="mt-5 grid gap-4 xl:grid-cols-[300px_minmax(520px,1fr)_330px]">
          <Card className="min-h-[660px]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-black">Customer Queue</h2>
                <p className="mt-1 text-xs font-bold leading-5 text-[#667267]">Only requests waiting for admin action appear here. Completed items disappear from this queue.</p>
              </div>
              <Badge tone="warn">{visibleJobs.length}</Badge>
            </div>
            <div className="mt-4 max-h-[560px] space-y-3 overflow-y-auto pr-2">
              {visibleJobs.length ? (
                visibleJobs.map((job) => (
                  <button
                    key={`${job.queue}-${job.id}-${job.problem}`}
                    onClick={() => {
                      setSelected(job);
                      setDecision("open");
                      setNote("");
                      setViewer(null);
                    }}
                    className={"w-full rounded-2xl border p-3 text-left transition " + (`${job.queue}-${job.id}-${job.problem}` === selectedKey ? "border-[#1f6b45] bg-emerald-50 shadow-sm" : "border-[#ece6d8] bg-[#fffdf7] hover:border-[#1f6b45]")}
                  >
                    <div className="flex items-start gap-3">
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#1f6b45] text-sm font-black text-white">{job.avatar}</span>
                      <div className="min-w-0 flex-1">
                        <b className="block truncate">{job.name}</b>
                        <p className="mt-1 truncate text-xs font-bold text-[#667267]">{job.problem}</p>
                        <p className="mt-2 text-xs font-black text-[#1f6b45]">{job.last}</p>
                      </div>
                      <Badge tone={job.priority === "High" ? "bad" : "warn"}>{job.priority}</Badge>
                    </div>
                  </button>
                ))
              ) : (
                <div className="rounded-2xl bg-[#f4efe4] p-5 text-sm font-bold leading-6 text-[#667267]">No pending {activeSectionInfo.title.toLowerCase()} right now.</div>
              )}
            </div>
          </Card>
          <div className="grid content-start gap-4">
            <Card>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase text-[#667267]">Submitted Request</p>
                  <h2 className="mt-1 text-3xl font-black">{selected.problem}</h2>
                  <p className="mt-2 text-sm font-bold leading-6 text-[#667267]">
                    {selected.name} / {selected.email}
                  </p>
                </div>
                <Badge tone={selected.priority === "High" ? "bad" : "warn"}>{activeSectionInfo.title}</Badge>
              </div>
              {selected.queue === "task" ? (
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-[#ece6d8] bg-[#fffdf7] p-4">
                    <p className="text-xs font-black uppercase text-[#667267]">Rooster</p>
                    <h3 className="mt-2 text-xl font-black">Thunder King</h3>
                    <p className="mt-1 text-sm font-bold text-[#667267]">FC-128 / Pen A-04 / Hatch-Kelso</p>
                  </div>
                  <div className="rounded-2xl border border-[#ece6d8] bg-[#fffdf7] p-4">
                    <p className="text-xs font-black uppercase text-[#667267]">Care Request</p>
                    <h3 className="mt-2 text-xl font-black">Give Vitamins</h3>
                    <p className="mt-1 text-sm font-bold text-[#667267]">Customer requested photo proof and short note.</p>
                  </div>
                  <div className="rounded-2xl border border-[#ece6d8] bg-[#fffdf7] p-4 md:col-span-2">
                    <p className="text-xs font-black uppercase text-[#667267]">Task Card</p>
                    <p className="mt-2 text-sm font-bold leading-6">Verify rooster by QR, give requested service, record product quantity used, upload proof, then submit back to admin.</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="mt-4 rounded-2xl border border-[#ece6d8] bg-[#fffdf7] p-4">
                    <p className="text-xs font-black uppercase text-[#667267]">Request Items</p>
                    <div className="mt-3 space-y-2">
                      {orderItems.map((item) => (
                        <div key={item.name} className="flex items-center justify-between gap-3 rounded-xl bg-white p-3 text-sm font-bold">
                          <span>
                            {item.name} x {item.qty}
                          </span>
                          <b>?{(item.qty * item.price).toLocaleString()}</b>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 flex items-center justify-between rounded-xl bg-[#1f6b45] p-3 text-white">
                      <b>Total</b>
                      <b>?{total.toLocaleString()}</b>
                    </div>
                  </div>
                  {selected.queue === "withdraw" ? (
                    <div className="mt-4 rounded-3xl border border-[#ece6d8] bg-[#fffdf7] p-4">
                      <p className="text-xs font-black uppercase text-[#667267]">Withdrawal Method / Admin Proof</p>
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <div className="rounded-2xl bg-white p-4">
                          <p className="text-xs font-black uppercase text-[#667267]">Customer payout method</p>
                          <h3 className="mt-2 text-xl font-black">{withdrawalMethod.provider}</h3>
                          <p className="mt-1 text-sm font-bold text-[#667267]">
                            {withdrawalMethod.holder} / {withdrawalMethod.account}
                          </p>
                        </div>
                        <div className="rounded-2xl bg-white p-4">
                          <p className="text-xs font-black uppercase text-[#667267]">Admin reference number</p>
                          <input value={payoutReference} onChange={(e) => setPayoutReference(e.target.value)} placeholder="Paste actual sent reference number" className="mt-2 w-full rounded-xl border border-[#ded8c9] p-3 text-lg font-black" />
                          <p className="mt-2 text-xs font-bold text-[#667267]">Admin enters the real reference from GCash/Maya/bank receipt.</p>
                        </div>
                        <div className="rounded-2xl bg-white p-4 md:col-span-2">
                          <p className="text-xs font-black uppercase text-[#667267]">Upload payout receipt</p>
                          <div className="mt-3 rounded-2xl border-2 border-dashed border-[#d8cfbd] bg-[#f9f6ec] p-4">
                            <input
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                setPayoutReceiptName(file?.name || "");
                                setPayoutReceiptPreview(file ? URL.createObjectURL(file) : "");
                              }}
                              className="w-full rounded-xl bg-white p-3 text-sm font-bold"
                              type="file"
                              accept="image/*,.pdf"
                            />
                            <p className="mt-3 text-center text-sm font-black">{payoutReceiptName || "No payout receipt selected yet"}</p>
                          </div>
                          <button type="button" onClick={() => setViewer("receipt")} className="mt-3 w-full rounded-xl bg-[#eee8d9] px-4 py-3 text-sm font-black">
                            View Payout Proof
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <div className="rounded-2xl border border-[#ece6d8] bg-[#fffdf7] p-4">
                        <p className="text-xs font-black uppercase text-[#667267]">Reference Number</p>
                        <h3 className="mt-2 text-xl font-black">{reference}</h3>
                        <p className="mt-1 text-xs font-bold text-[#667267]">{receiptStatus}</p>
                      </div>
                      <div className="rounded-2xl border border-[#ece6d8] bg-[#fffdf7] p-4">
                        <p className="text-xs font-black uppercase text-[#667267]">Receipt / Upload</p>
                        <h3 className="mt-2 text-xl font-black">Receipt attached</h3>
                        <button type="button" onClick={() => setViewer("receipt")} className="mt-3 w-full rounded-xl bg-[#eee8d9] px-4 py-3 text-sm font-black">
                          View Receipt
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </Card>
          </div>
          <Card className="min-h-[660px]">
            <h2 className="text-lg font-black">Admin Action</h2>
            <p className="mt-1 text-xs font-bold leading-5 text-[#667267]">Action changes depending on the selected request.</p>
            {selected.queue === "task" ? (
              <div className="mt-4">
                <p className="text-sm font-black">Assign Caretaker</p>
                <div className="mt-3 space-y-2">
                  {caretakers.map((caretaker) => (
                    <button key={caretaker.name} onClick={() => setSelectedCaretaker(caretaker.name)} className={"w-full rounded-2xl border p-3 text-left transition " + (selectedCaretaker === caretaker.name ? "border-[#1f6b45] bg-emerald-50" : "border-[#ece6d8] bg-[#fffdf7]")}>
                      <b>{caretaker.name}</b>
                      <p className="mt-1 text-xs font-bold text-[#667267]">
                        {caretaker.load} / {caretaker.skill}
                      </p>
                    </button>
                  ))}
                </div>
                <button onClick={completeRequest} className="mt-5 w-full rounded-2xl bg-[#1f6b45] px-4 py-4 font-black text-white">
                  Assign Task
                </button>
                <p className="mt-3 text-xs font-bold leading-5 text-[#667267]">After assignment, this leaves Customer Requests and appears in the caretaker task list.</p>
              </div>
            ) : (
              <div className="mt-4">
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => submitAction("approved")} className="min-h-20 rounded-2xl bg-[#1f6b45] px-4 py-3 font-black text-white">
                    Approve
                  </button>
                  <button onClick={() => submitAction("rejected")} className="min-h-20 rounded-2xl bg-red-600 px-4 py-3 font-black text-white">
                    Reject
                  </button>
                </div>
                <label className="mt-5 block text-sm font-black">Note to Customer</label>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason if rejected, or confirmation note if approved..." className="mt-2 h-32 w-full resize-none rounded-2xl border border-[#ded8c9] bg-[#fffdf7] p-3 text-sm font-bold leading-6" />
                <div className="mt-4 rounded-2xl border border-[#ece6d8] bg-[#fffdf7] p-4">
                  <p className="text-xs font-black uppercase text-[#667267]">Invoice / Receipt</p>
                  <p className="mt-2 text-sm font-bold leading-6">Generated after approval. Open before final submit to double-check amount and items.</p>
                  <button type="button" onClick={() => setViewer("invoice")} className="mt-3 w-full rounded-xl bg-[#eee8d9] px-4 py-3 text-sm font-black">
                    View Invoice
                  </button>
                </div>
                <button onClick={completeRequest} disabled={decision === "open"} className={"mt-4 w-full rounded-2xl px-4 py-4 font-black text-white " + (decision === "open" ? "bg-[#b9b3a4]" : "bg-[#1f6b45]")}>
                  Submit Decision
                </button>
                <p className="mt-3 text-xs font-bold leading-5 text-[#667267]">After submit, request leaves this queue and should be stored in evidence logs.</p>
              </div>
            )}
          </Card>
        </div>
      )}
      {viewer && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4">
          <div className="max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase text-[#667267]">{viewer === "receipt" ? (selected.queue === "withdraw" ? "Admin Payout Proof" : "Customer Receipt Proof") : "Generated Invoice Preview"}</p>
                <h2 className="mt-1 text-2xl font-black">{selected.name}</h2>
                <p className="mt-1 text-sm font-bold text-[#667267]">
                  {selected.problem} / {selected.queue === "withdraw" ? payoutReference || "No payout reference yet" : reference}
                </p>
              </div>
              <button type="button" onClick={() => setViewer(null)} className="rounded-xl bg-[#eee8d9] px-4 py-2 text-sm font-black">
                Close
              </button>
            </div>
            {viewer === "receipt" ? (
              <div className="mt-5 grid gap-4 md:grid-cols-[1fr_260px]">
                <div className="rounded-2xl border border-[#ece6d8] bg-[#f9f6ec] p-5">
                  <p className="text-xs font-black uppercase text-[#667267]">{selected.queue === "withdraw" ? "Uploaded Admin Payout Receipt" : "Uploaded Customer Screenshot"}</p>
                  <div className="mt-4 overflow-hidden rounded-2xl border border-[#d8cfbd] bg-white">
                    <div className="grid min-h-64 place-items-center bg-[#101010] p-5 text-center text-white">
                      {selected.queue === "withdraw" && payoutReceiptPreview ? (
                        <img src={payoutReceiptPreview} alt="Admin payout receipt" className="max-h-[360px] w-full object-contain" />
                      ) : (
                        <div>
                          <p className="text-xs font-black uppercase text-white/60">Receipt Screenshot</p>
                          <h3 className="mt-2 text-2xl font-black">{selected.queue === "withdraw" ? "Admin payout proof" : "Customer payment proof"}</h3>
                          <p className="mt-2 text-sm font-bold text-white/70">{selected.queue === "withdraw" ? payoutReference || "No payout reference yet" : reference}</p>
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-2 divide-x divide-[#d8cfbd] bg-[#f9f6ec] text-center text-sm font-black text-[#17251d]">
                      <div className="p-4">{selected.queue === "withdraw" ? "Sent to customer payout" : "Receiver / sender details"}</div>
                      <div className="p-4">{selected.queue === "withdraw" ? withdrawalMethod.provider + " / " + withdrawalMethod.account : "Payment method and amount"}</div>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="rounded-2xl border border-[#ece6d8] bg-[#fffdf7] p-4">
                    <p className="text-xs font-black uppercase text-[#667267]">Reference</p>
                    <b className="mt-2 block text-lg">{selected.queue === "withdraw" ? payoutReference || "No payout reference yet" : reference}</b>
                  </div>
                  <div className="rounded-2xl border border-[#ece6d8] bg-[#fffdf7] p-4">
                    <p className="text-xs font-black uppercase text-[#667267]">Amount</p>
                    <b className="mt-2 block text-lg">?{total.toLocaleString()}</b>
                  </div>
                  <div className="rounded-2xl border border-[#ece6d8] bg-[#fffdf7] p-4">
                    <p className="text-xs font-black uppercase text-[#667267]">Status</p>
                    <b className="mt-2 block text-sm">{selected.queue === "withdraw" ? (payoutReceiptName ? "Admin payout receipt attached" : "Waiting for admin payout receipt") : receiptStatus}</b>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-[#ece6d8] bg-[#fffdf7] p-5">
                <div className="flex items-start justify-between gap-3 border-b border-[#ece6d8] pb-4">
                  <div>
                    <h3 className="text-2xl font-black">{selected.queue === "withdraw" ? "Withdrawal Receipt / Invoice" : "FarmConnect Invoice"}</h3>
                    <p className="mt-1 text-sm font-bold text-[#667267]">Customer: {selected.name}</p>
                  </div>
                  <Badge tone={decision === "approved" ? "good" : decision === "rejected" ? "bad" : "warn"}>{decision === "open" ? "Draft" : decision}</Badge>
                </div>
                {selected.queue === "withdraw" ? (
                  <div className="mt-4 grid gap-3">
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-2xl bg-white p-4">
                        <p className="text-xs font-black uppercase text-[#667267]">Payout Method</p>
                        <b className="mt-2 block text-lg">{withdrawalMethod.provider}</b>
                        <p className="mt-1 text-sm font-bold text-[#667267]">
                          {withdrawalMethod.holder} / {withdrawalMethod.account}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-white p-4">
                        <p className="text-xs font-black uppercase text-[#667267]">Admin Sent Reference</p>
                        <b className="mt-2 block text-lg">{payoutReference || "No reference entered"}</b>
                        <p className="mt-1 text-sm font-bold text-[#667267]">Must match uploaded payout receipt.</p>
                      </div>
                    </div>
                    <div className="rounded-2xl bg-white p-4">
                      <p className="text-xs font-black uppercase text-[#667267]">Uploaded Payout Proof</p>
                      <b className="mt-2 block text-lg">{payoutReceiptName || "No payout proof uploaded"}</b>
                    </div>
                    <div className="flex items-center justify-between rounded-2xl bg-[#1f6b45] p-4 text-white">
                      <b>Withdrawal Amount</b>
                      <b>?{total.toLocaleString()}</b>
                    </div>
                    <div className="rounded-2xl bg-white p-4">
                      <p className="text-xs font-black uppercase text-[#667267]">Admin Note</p>
                      <p className="mt-2 text-sm font-bold leading-6">{note || "No admin note yet."}</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="mt-4 space-y-2">
                      {orderItems.map((item) => (
                        <div key={item.name} className="flex items-center justify-between gap-3 rounded-xl bg-white p-3 text-sm font-bold">
                          <span>
                            {item.name} x {item.qty}
                          </span>
                          <b>?{(item.qty * item.price).toLocaleString()}</b>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 flex items-center justify-between rounded-2xl bg-[#1f6b45] p-4 text-white">
                      <b>Total</b>
                      <b>?{total.toLocaleString()}</b>
                    </div>
                    <div className="mt-4 rounded-2xl bg-white p-4">
                      <p className="text-xs font-black uppercase text-[#667267]">Admin Note</p>
                      <p className="mt-2 text-sm font-bold leading-6">{note || "No admin note yet."}</p>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </Shell>
  );
}
export function AdminCustomerRequestsSection({ section }: { section: string }) {
  if (section === "payment") {
    return (
      <Shell role="admin" title="Payment Requests">
        <PageTitle title="Payment Requests" text="Review Farm Buy payment receipts and reference numbers from Supabase." icon="coins" />
        <AdminManualPaymentQueue sourceType="farm_buy" />
      </Shell>
    );
  }
  if (section === "care") {
    return (
      <Shell role="admin" title="Care Request">
        <PageTitle title="Customer Care Queue" text="Review every submitted customer care payment in one queue. Approved requests move to Task Management." icon="rooster" />
        <AdminManualPaymentQueue sourceType="care" />
      </Shell>
    );
  }
  if (section === "task") {
    return (
      <Shell role="admin" title="Task Management">
        <PageTitle title="Task Management" text="Assign a specific active caretaker to paid and approved care requests." icon="clipboard" />
        <AdminLiveCareRequestQueue mode="task" />
      </Shell>
    );
  }
  if (section === "withdraw") {
    return (
      <Shell role="admin" title="Withdrawal Review">
        <PageTitle title="Withdrawal Review" text="Review the customer's payout method, attach the real payout proof and reference, then submit the decision." icon="wallet" />
        <AdminWithdrawalReviewQueue />
      </Shell>
    );
  }
  if (section === "sell") {
    return (
      <Shell role="admin" title="Sell Requests">
        <PageTitle title="Sell Requests" text="Approve or reject customer-confirmed rooster sales. Approved requests move to final caretaker release." icon="coins" />
        <AdminRoosterSaleQueue />
      </Shell>
    );
  }
  return <AdminCustomerRequestsPage />;
}

function AdminRoosterSaleQueue() {
  const [rows, setRows] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [adminNote, setAdminNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState("Loading customer sell requests...");
  const pending = rows.filter((row) => row.status === "sale_requested");
  const selected = pending.find((row) => row.id === selectedId) || pending[0] || null;
  async function load() {
    try {
      const data = await getAdminRoosterSaleRequests();
      setRows(data);
      const first = data.find((row: any) => row.status === "sale_requested");
      setSelectedId((current) => (data.some((row: any) => row.id === current && row.status === "sale_requested") ? current : first?.id || ""));
      setNote(first ? "Review the approved inspection price and customer sale confirmation." : "No customer sell request waiting for admin.");
    } catch (error) {
      setRows([]);
      setNote(`Sell queue blocked: ${readableAppError(error) || "Apply SQL 040 and check admin login."}`);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function decide(decision: "approved" | "rejected") {
    if (!selected || saving) return;
    if (adminNote.trim().length < 5) {
      setNote("Write a clear admin note before approving or rejecting.");
      return;
    }
    setSaving(true);
    try {
      await adminReviewRoosterSale(selected.id, decision, adminNote.trim());
      setAdminNote("");
      await load();
      setNote(decision === "approved" ? "Sale approved. It is now waiting in Task Management for final caretaker release assignment." : "Sale rejected. Customer received your note and may submit again.");
    } catch (error) {
      setNote(`Sell decision failed: ${readableAppError(error)}`);
    } finally {
      setSaving(false);
    }
  }
  const animal = selected?.customer_animals;
  const customer = selected?.profiles;
  return (
    <div className="grid gap-4 xl:grid-cols-[280px_minmax(460px,1fr)_320px]">
      <Card className="min-h-[620px]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-black">Customer Queue</h2>
            <p className="mt-1 text-xs font-bold leading-5 text-[#667267]">Only customer-confirmed sales appear here.</p>
          </div>
          <Badge tone="warn">{pending.length}</Badge>
        </div>
        <div className="mt-4 max-h-[520px] space-y-3 overflow-y-auto pr-2">
          {pending.map((row) => (
            <button
              key={row.id}
              onClick={() => {
                setSelectedId(row.id);
                setAdminNote("");
              }}
              className={"w-full rounded-2xl border p-3 text-left " + (selected?.id === row.id ? "border-[#1f6b45] bg-emerald-50" : "border-[#ece6d8] bg-[#fffdf7]")}
            >
              <b className="block truncate">{row.profiles?.display_name || row.profiles?.full_name || "Customer"}</b>
              <p className="mt-1 truncate text-xs font-bold text-[#667267]">
                {row.customer_animals?.animal_name || "Rooster"} / {row.customer_animals?.animal_code || "No serial"}
              </p>
              <p className="mt-2 text-sm font-black text-[#1f6b45]">{peso(Number(row.approved_sale_price || 0))}</p>
            </button>
          ))}
          {!pending.length && <div className="rounded-2xl bg-[#f4efe4] p-5 text-sm font-bold text-[#667267]">No pending rooster sale.</div>}
        </div>
      </Card>
      <Card className="min-h-[620px]">
        {selected ? (
          <>
            <p className="text-xs font-black uppercase text-[#667267]">Submitted Sell Request</p>
            <h2 className="mt-1 text-3xl font-black">{animal?.animal_name || "Owned Rooster"}</h2>
            <p className="mt-1 text-sm font-bold text-[#667267]">Customer: {customer?.display_name || customer?.full_name || customer?.email || "Customer"}</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Info label="Serial ID" value={animal?.animal_code || "Not recorded"} />
              <Info label="Breed" value={animal?.breed_snapshot || animal?.bloodline_snapshot || "Recorded breed"} />
              <Info label="Caretaker Price" value={peso(Number(selected.caretaker_quoted_price || 0))} />
              <Info label="Admin-Approved Price" value={peso(Number(selected.approved_sale_price || 0))} />
            </div>
            <div className="mt-4 rounded-2xl bg-[#fffdf7] p-4">
              <p className="text-xs font-black uppercase text-[#667267]">Customer Note</p>
              <p className="mt-2 text-sm font-bold leading-6">{selected.customer_note || "Customer confirmed the approved price."}</p>
            </div>
            <div className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm font-bold leading-6 text-amber-900">Approval does not credit the wallet yet. It creates a final caretaker release task. Wallet credit happens only after that proof is approved in Task Verification.</div>
          </>
        ) : (
          <div className="grid min-h-[500px] place-items-center text-center">
            <div>
              <h2 className="text-2xl font-black">No sell request selected</h2>
              <p className="mt-2 text-sm font-bold text-[#667267]">A customer-confirmed sale will appear here.</p>
            </div>
          </div>
        )}
      </Card>
      <Card className="min-h-[620px]">
        <h2 className="text-lg font-black">Admin Action</h2>
        <p className="mt-1 text-xs font-bold text-[#667267]">Write the reason or release instruction.</p>
        <textarea value={adminNote} onChange={(event) => setAdminNote(event.target.value)} disabled={!selected || saving} placeholder="Required admin note..." className="mt-4 h-48 w-full resize-none rounded-2xl border border-[#ded8c9] bg-[#fffdf7] p-3 text-sm font-bold disabled:opacity-50" />
        <button onClick={() => void decide("approved")} disabled={!selected || saving} className="mt-4 w-full rounded-2xl bg-[#1f6b45] px-4 py-4 font-black text-white disabled:bg-[#b9b3a4]">
          Approve for Final Release
        </button>
        <button onClick={() => void decide("rejected")} disabled={!selected || saving} className="mt-3 w-full rounded-2xl bg-red-600 px-4 py-4 font-black text-white disabled:bg-[#b9b3a4]">
          Reject with Note
        </button>
        <p className="mt-4 rounded-xl bg-[#f4efe4] p-3 text-xs font-bold leading-5 text-[#667267]">{note}</p>
      </Card>
    </div>
  );
}

function AdminManualPaymentQueue({ sourceType }: { sourceType?: "farm_buy" | "care_request" | "care_plan" | "care" } = {}) {
  const [rows, setRows] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [note, setNote] = useState("Loading manual payment requests...");
  const [adminNote, setAdminNote] = useState("");
  const [decision, setDecision] = useState<"approved" | "rejected" | null>(null);
  const [viewer, setViewer] = useState<"receipt" | "invoice" | null>(null);
  const [saving, setSaving] = useState(false);
  const activeRows = rows.filter((row) => {
    const active = ["for_review", "needs_info"].includes(String(row.status || "for_review"));
    const rowSource = String(row.source_type || row.sourceType || "").toLowerCase();
    const sourceMatches = !sourceType || (sourceType === "care" ? ["care_request", "care_plan"].includes(rowSource) : rowSource === sourceType);
    return active && sourceMatches;
  });
  const selected = activeRows.find((row) => row.id === selectedId) || activeRows[0] || null;

  async function load() {
    try {
      const live = await getAdminManualPaymentRequests();
      setRows(live);
      const filtered = live.filter((row: any) => {
        const rowSource = String(row.source_type || "").toLowerCase();
        return ["for_review", "needs_info"].includes(String(row.status || "for_review")) && (!sourceType || (sourceType === "care" ? ["care_request", "care_plan"].includes(rowSource) : rowSource === sourceType));
      });
      setSelectedId((current) => (filtered.some((row: any) => row.id === current) ? current : filtered[0]?.id || ""));
      setNote(filtered.length ? "Select one customer request and review every detail before deciding." : "No payment request waiting for admin review.");
    } catch {
      setRows([]);
      setNote("Manual payment queue could not load from Supabase. Check admin login, SQL 009, and RLS before approving payments.");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function submitDecision() {
    if (!selected || !decision || saving) return;
    if (decision === "rejected" && adminNote.trim().length < 5) {
      setNote("Write a clear rejection reason so the customer knows what to correct and resubmit.");
      return;
    }
    try {
      setSaving(true);
      setNote(`Saving ${decision} decision...`);
      const result = await adminReviewManualPayment(selected.id, decision, adminNote || "Payment proof checked and approved by admin.");
      setNote(result.duplicate ? `This request was already ${result.status}. No duplicate action was created.` : decision === "approved" ? "Payment approved. Invoice, inbox, evidence, and linked request records were updated." : "Payment rejected. The customer received your reason and may resubmit corrected proof.");
      setDecision(null);
      setAdminNote("");
      setViewer(null);
      await load();
    } catch (error) {
      setNote(`Admin decision failed: ${readableAppError(error) || "Check SQL 009/025, RLS, and the active admin profile."}`);
    } finally {
      setSaving(false);
    }
  }

  const queueTitle = sourceType === "care" ? "Customer Care Queue" : sourceType === "care_request" ? "Care Request Payment Review" : sourceType === "care_plan" ? "Care Plan Payment Review" : sourceType === "farm_buy" ? "Farm Buy Payment Review" : "Pending Manual Payments";
  const profile = selected ? (Array.isArray(selected.profiles) ? selected.profiles[0] : selected.profiles) : null;
  const customer = profile?.display_name || profile?.full_name || profile?.email || selected?.sender_name || "Customer";
  const summary = selected?.summary || {};
  const selectedSource = String(selected?.source_type || selected?.sourceType || "").toLowerCase();
  const summaryItems = selected ? (Array.isArray(summary.lines) ? summary.lines : Array.isArray(summary.items) ? summary.items : Array.isArray(summary.cartItems) ? summary.cartItems : Array.isArray(summary.products) ? summary.products : []) : [];
  const rooster = summary.rooster?.name || summary.rooster_name || selected?.rooster_name || "Recorded rooster";
  const service = summary.service?.name || summary.service_name || selected?.service_name || "Care request";
  const receiptUrl = selected?.receipt_image_url || selected?.receiptImageUrl || "";
  const customerCorrection = String(summary.customer_resubmission_note || "").trim();
  const previousReference = String(summary.previous_reference_number || "").trim();
  const selectRequest = (id: string) => {
    setSelectedId(id);
    setDecision(null);
    setAdminNote("");
    setViewer(null);
  };
  return (
    <>
      <div className="grid gap-4 xl:grid-cols-[280px_minmax(480px,1fr)_320px]">
        <Card className="min-h-[620px]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-black">Customer Queue</h2>
              <p className="mt-1 text-xs font-bold leading-5 text-[#667267]">Pending requests only. Submitted decisions disappear from this queue.</p>
            </div>
            <Badge tone="warn">{activeRows.length}</Badge>
          </div>
          <button type="button" data-kafarm-monitor-ignore="true" onClick={() => void load()} disabled={saving} className="mt-3 w-full rounded-xl bg-[#eee8d9] px-3 py-2 text-sm font-black disabled:opacity-50">
            Refresh Requests
          </button>
          <div className="mt-4 max-h-[510px] space-y-3 overflow-y-auto pr-2">
            {activeRows.map((row) => {
              const rowProfile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
              const rowCustomer = rowProfile?.display_name || rowProfile?.full_name || rowProfile?.email || row.sender_name || "Customer";
              const rowSource = String(row.source_type || row.sourceType || "").toLowerCase();
              return (
                <button key={row.id} type="button" onClick={() => selectRequest(row.id)} className={"w-full rounded-2xl border p-3 text-left transition " + (selected?.id === row.id ? "border-[#1f6b45] bg-emerald-50 shadow-sm" : "border-[#ece6d8] bg-[#fffdf7] hover:border-[#1f6b45]")}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <b className="block truncate">{rowCustomer}</b>
                      <p className="mt-1 truncate text-xs font-bold text-[#667267]">
                        {row.payment_method} / Ref {row.reference_number}
                      </p>
                      <p className="mt-2 text-xs font-black text-[#1f6b45]">{row.created_at ? new Date(row.created_at).toLocaleString() : "For review"}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {sourceType === "care" && <Badge tone="good">{rowSource === "care_plan" ? "30-Day Care Plan" : "Today's Standard Care"}</Badge>}
                      <Badge tone={row.risk_status === "clear" ? "good" : "warn"}>{row.risk_status || "check"}</Badge>
                    </div>
                  </div>
                </button>
              );
            })}
            {!activeRows.length && <div className="rounded-2xl bg-[#f4efe4] p-5 text-sm font-bold leading-6 text-[#667267]">No pending {sourceType === "care" ? "customer care" : sourceType === "care_request" ? "care-request" : sourceType === "care_plan" ? "Care Plan" : "Farm Buy"} payment right now.</div>}
          </div>
        </Card>
        <Card className="min-h-[620px]">
          {selected ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase text-[#667267]">Submitted Request</p>
                  <h2 className="mt-1 text-3xl font-black">{customer}</h2>
                  <p className="mt-1 text-sm font-bold text-[#667267]">{profile?.email || selected.sender_name || "Customer payment"}</p>
                </div>
                <Badge tone="warn">{queueTitle}</Badge>
              </div>
              {selectedSource === "care_request" ? (
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <Info label="Rooster" value={rooster} />
                  <Info label="Requested Service" value={service} />
                  <Info label="Customer Note" value={summary.customer_note || "No customer note"} />
                  <Info label="Payment Status" value={String(selected.status || "for_review").replaceAll("_", " ")} />
                </div>
              ) : selectedSource === "care_plan" ? (
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <Info label="Package" value={`${Number(summary.duration_days || 0)}-day Care Plan`} />
                  <Info label="Feed Included" value={`${Number(summary.feed_required_kg || 0).toFixed(3)} kg`} />
                  <Info label="Plan Reference" value={selected.source_ref} />
                  <Info label="Payment Status" value={String(selected.status || "for_review").replaceAll("_", " ")} />
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-[#ece6d8] bg-[#fffdf7] p-4">
                  <p className="text-xs font-black uppercase text-[#667267]">Farm Buy Items</p>
                  <div className="mt-3 space-y-2">
                    {summaryItems.length ? (
                      summaryItems.map((item: any, index: number) => {
                        const name = item.name || item.product?.name || item.product_name || `Item ${index + 1}`;
                        const qty = Number(item.qty || item.quantity || 1);
                        const price = Number(item.price || item.unit_price || 0);
                        return (
                          <div key={`${name}-${index}`} className="flex items-center justify-between gap-3 rounded-xl bg-white p-3 text-sm font-bold">
                            <span>
                              {name} x {qty}
                            </span>
                            <b>{peso(price * qty)}</b>
                          </div>
                        );
                      })
                    ) : (
                      <p className="rounded-xl bg-white p-3 text-sm font-bold text-[#667267]">Order summary is linked to this payment record.</p>
                    )}
                  </div>
                </div>
              )}
              {customerCorrection && (
                <div className="mt-4 rounded-2xl border-2 border-sky-200 bg-sky-50 p-4">
                  <p className="text-xs font-black uppercase text-sky-700">Customer Correction / Explanation</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm font-bold leading-6 text-sky-950">{customerCorrection}</p>
                  {previousReference && <p className="mt-3 text-xs font-bold text-[#667267]">Previous rejected reference: {previousReference}</p>}
                </div>
              )}
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-[#ece6d8] bg-[#fffdf7] p-4">
                  <p className="text-xs font-black uppercase text-[#667267]">Payment Details</p>
                  <Info label="Method" value={selected.payment_method || "Not recorded"} />
                  <div className="mt-2">
                    <Info label="Receiver" value={selected.receiver_account || "Not recorded"} />
                  </div>
                  <div className="mt-2">
                    <Info label="Sender" value={selected.sender_name || "Not recorded"} />
                  </div>
                </div>
                <div className="rounded-2xl border border-[#ece6d8] bg-[#fffdf7] p-4">
                  <p className="text-xs font-black uppercase text-[#667267]">Evidence</p>
                  <Info label="Reference Number" value={selected.reference_number || "Missing"} />
                  <button type="button" disabled={!receiptUrl} onClick={() => setViewer("receipt")} className="mt-3 w-full rounded-xl bg-[#eee8d9] px-4 py-3 text-sm font-black disabled:cursor-not-allowed disabled:opacity-50">
                    View Receipt
                  </button>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between rounded-2xl bg-[#1f6b45] p-4 text-white">
                <b>Total Amount</b>
                <b className="text-xl">{peso(Number(selected.amount_expected || 0))}</b>
              </div>
            </>
          ) : (
            <div className="grid min-h-[500px] place-items-center text-center">
              <div>
                <h2 className="text-2xl font-black">No pending request</h2>
                <p className="mt-2 text-sm font-bold text-[#667267]">A submitted customer payment will appear here.</p>
              </div>
            </div>
          )}
        </Card>
        <Card className="min-h-[620px]">
          <h2 className="text-lg font-black">Admin Action</h2>
          <p className="mt-1 text-xs font-bold leading-5 text-[#667267]">Choose a decision, write a clear note, review the invoice, then submit.</p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <button type="button" data-kafarm-monitor-ignore="true" disabled={!selected} onClick={() => setDecision("approved")} className={"min-h-20 rounded-2xl px-4 py-3 font-black text-white disabled:opacity-40 " + (decision === "approved" ? "bg-[#145a38] ring-4 ring-emerald-200" : "bg-[#1f6b45]")}>
              Approve
            </button>
            <button type="button" data-kafarm-monitor-ignore="true" disabled={!selected} onClick={() => setDecision("rejected")} className={"min-h-20 rounded-2xl px-4 py-3 font-black text-white disabled:opacity-40 " + (decision === "rejected" ? "bg-red-700 ring-4 ring-red-200" : "bg-red-600")}>
              Reject
            </button>
          </div>
          <label className="mt-5 block text-sm font-black">
            Note to Customer
            <textarea value={adminNote} onChange={(event) => setAdminNote(event.target.value)} placeholder="Reason if rejected, or confirmation note if approved..." className="mt-2 h-32 w-full resize-none rounded-2xl border border-[#ded8c9] bg-[#fffdf7] p-3 text-sm font-bold leading-6" />
          </label>
          <div className="mt-4 rounded-2xl border border-[#ece6d8] bg-[#fffdf7] p-4">
            <p className="text-xs font-black uppercase text-[#667267]">Invoice / Decision Preview</p>
            <p className="mt-2 text-sm font-bold leading-6">Double-check customer, items/service, amount, reference, and decision before submitting.</p>
            <button type="button" disabled={!selected || !decision} onClick={() => setViewer("invoice")} className="mt-3 w-full rounded-xl bg-[#eee8d9] px-4 py-3 text-sm font-black disabled:cursor-not-allowed disabled:opacity-50">
              View Invoice
            </button>
          </div>
          <button type="button" data-kafarm-feedback-target="manual-payment-decision-status" disabled={!selected || !decision || saving} onClick={submitDecision} className="mt-4 w-full rounded-2xl bg-[#1f6b45] px-4 py-4 font-black text-white disabled:cursor-not-allowed disabled:bg-[#b9b3a4]">
            {saving ? "Saving..." : "Submit Decision"}
          </button>
          <p id="manual-payment-decision-status" className="mt-3 rounded-xl bg-[#f4efe4] p-3 text-xs font-bold leading-5 text-[#667267]">
            {note}
          </p>
        </Card>
      </div>
      {viewer && selected && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
          <div className="max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase text-[#667267]">{viewer === "receipt" ? "Customer Receipt" : "Invoice / Decision Preview"}</p>
                <h2 className="mt-1 text-2xl font-black">{customer}</h2>
              </div>
              <button type="button" onClick={() => setViewer(null)} className="rounded-xl bg-[#eee8d9] px-4 py-2 font-black">
                Close
              </button>
            </div>
            {viewer === "receipt" ? (
              <div className="mt-5">
                <div className="grid min-h-80 place-items-center overflow-hidden rounded-2xl bg-[#111] p-4">{receiptUrl ? <img src={receiptUrl} alt="Customer payment receipt" className="max-h-[560px] w-full object-contain" /> : <p className="font-black text-white">No receipt attached</p>}</div>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <Info label="Reference" value={selected.reference_number || "Missing"} />
                  <Info label="Payment Method" value={selected.payment_method || "Missing"} />
                  <Info label="Amount" value={peso(Number(selected.amount_expected || 0))} />
                </div>
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-[#ece6d8] bg-[#fffdf7] p-5">
                <div className="flex items-start justify-between gap-3 border-b border-[#ece6d8] pb-4">
                  <div>
                    <h3 className="text-2xl font-black">FarmConnect {sourceType === "care_request" ? "Care Payment" : sourceType === "care_plan" ? "Care Plan" : "Farm Buy"} Invoice</h3>
                    <p className="mt-1 text-sm font-bold text-[#667267]">Reference: {selected.reference_number}</p>
                  </div>
                  <Badge tone={decision === "approved" ? "good" : "bad"}>{decision}</Badge>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <Info label="Customer" value={customer} />
                  <Info label="Amount" value={peso(Number(selected.amount_expected || 0))} />
                  <Info label="Method / Receiver" value={`${selected.payment_method || ""} / ${selected.receiver_account || ""}`} />
                  <Info label="Admin Note" value={adminNote || "No note"} />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
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
      setSelectedId((current) => current || data?.[0]?.id || "");
      setNote(data.length ? "Review resume, photo, payment method, then approve only if safe." : "No caretaker applications yet.");
    } catch {
      setNote("SQL 010 is needed for real caretaker applications.");
    }
  }

  useEffect(() => {
    load();
  }, []);

  const selected = rows.find((row) => row.id === selectedId) || rows[0];

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
          <Badge tone="warn">{rows.filter((row) => row.status === "pending_approval").length} pending</Badge>
        </div>
        <p className="mt-1 text-sm font-bold text-[#667267]">{note}</p>
        <div className="mt-4 max-h-[430px] space-y-3 overflow-y-auto pr-2">
          {rows.map((row) => (
            <button key={row.id} onClick={() => setSelectedId(row.id)} className={"w-full rounded-2xl border p-3 text-left " + (selected?.id === row.id ? "border-[#1f6b45] bg-emerald-50" : "border-[#ece6d8] bg-[#fffdf7]")}>
              <div className="flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center overflow-hidden rounded-xl bg-white font-black shadow-sm">
                  {row.avatar_url ? (
                    <img src={row.avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    String(row.display_name || row.full_name || "CA")
                      .slice(0, 2)
                      .toUpperCase()
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <b className="block truncate">{row.full_name}</b>
                  <p className="truncate text-sm font-bold text-[#667267]">
                    {row.farm_role || "Farm caretaker"} - {row.email}
                  </p>
                </div>
                <Badge tone={row.status === "approved" ? "good" : row.status === "rejected" ? "bad" : "warn"}>{row.status}</Badge>
              </div>
            </button>
          ))}
          {rows.length === 0 && <p className="rounded-2xl bg-[#f6f3e8] p-4 text-sm font-bold text-[#667267]">Applications will appear here after caretaker signup.</p>}
        </div>
      </Card>
      <Card>
        {!selected ? (
          <p className="rounded-2xl bg-[#f6f3e8] p-4 text-sm font-bold text-[#667267]">Select an application to view resume and payment details.</p>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
            <div>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase text-[#667267]">Resume View</p>
                  <h2 className="mt-1 text-3xl font-black">{selected.full_name}</h2>
                  <p className="font-bold text-[#667267]">
                    {selected.display_name || "No nickname"} - {selected.phone}
                  </p>
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
                {selected.resume_url && (
                  <a href={selected.resume_url} target="_blank" rel="noreferrer" className="rounded-xl bg-white px-4 py-3 font-black shadow-sm">
                    Open Resume
                  </a>
                )}
                {selected.avatar_url && (
                  <a href={selected.avatar_url} target="_blank" rel="noreferrer" className="rounded-xl bg-white px-4 py-3 font-black shadow-sm">
                    Open Photo
                  </a>
                )}
              </div>
            </div>
            <div className="rounded-3xl bg-[#f6f3e8] p-4">
              <h3 className="text-lg font-black">Admin Decision</h3>
              <p className="mt-1 text-sm font-bold leading-6 text-[#667267]">Approval creates/activates the caretaker profile. Reject/needs info keeps app access closed.</p>
              <textarea value={adminNote} onChange={(e) => setAdminNote(e.target.value)} className="mt-3 h-28 w-full rounded-xl border border-[#ded8c9] p-3 text-sm font-bold" placeholder="Admin note / reason" />
              <div className="mt-3 grid gap-2">
                <button onClick={() => decide("approved")} className="rounded-xl bg-[#1f6b45] px-3 py-2 font-black text-white">
                  Approve
                </button>
                <button onClick={() => decide("needs_info")} className="rounded-xl bg-amber-300 px-3 py-2 font-black">
                  Needs Info
                </button>
                <button onClick={() => decide("rejected")} className="rounded-xl bg-red-600 px-3 py-2 font-black text-white">
                  Reject
                </button>
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
  const copyRegistrationUrl = () => navigator.clipboard?.writeText(new URL(registrationPath, window.location.origin).href);

  async function load() {
    try {
      const data = await getCaretakerApplications();
      setRows(data as any[]);
      setNote(data.length ? "Registration records loaded. Print approved/rejected list when needed." : "No caretaker applications yet.");
    } catch {
      setNote("SQL 010 is needed before admin can see caretaker registration records.");
    }
  }

  useEffect(() => {
    load();
  }, []);

  const pending = rows.filter((row) => row.status === "pending_approval" || row.status === "needs_info");
  const approved = rows.filter((row) => row.status === "approved");
  const rejected = rows.filter((row) => row.status === "rejected");

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
          <div className="mt-4 rounded-2xl bg-[#f6f3e8] p-4 text-sm font-black break-all">{registrationPath}</div>
          <div className="mt-4 grid gap-2">
            <Link href={registrationPath} className="rounded-xl bg-[#1f6b45] px-4 py-3 text-center font-black text-white">
              Open Registration Page
            </Link>
            <button onClick={copyRegistrationUrl} className="rounded-xl bg-[#eee8d9] px-4 py-3 font-black">
              Copy Link
            </button>
            <button onClick={printList} className="rounded-xl bg-amber-300 px-4 py-3 font-black">
              Print Approved / Rejected
            </button>
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
                  {approved.map((row) => (
                    <RegistrationRecord key={row.id} row={row} />
                  ))}
                  {approved.length === 0 && <p className="rounded-xl bg-[#f6f3e8] p-3 text-sm font-bold text-[#667267]">No approved caretaker yet.</p>}
                </div>
              </div>
              <div>
                <h3 className="font-black text-red-700">Rejected</h3>
                <div className="mt-3 max-h-[360px] space-y-2 overflow-y-auto pr-2">
                  {rejected.map((row) => (
                    <RegistrationRecord key={row.id} row={row} />
                  ))}
                  {rejected.length === 0 && <p className="rounded-xl bg-[#f6f3e8] p-3 text-sm font-bold text-[#667267]">No rejected caretaker yet.</p>}
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
          <span className="font-bold text-[#667267]">
            {row.email} - {row.phone}
          </span>
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

const adminRoleBridges: Record<
  AdminBridgeKind,
  Array<{
    step: string;
    from: string;
    admin: string;
    to: string;
    customer: string;
    href: string;
    tone: "good" | "warn" | "bad" | "neutral";
  }>
> = {
  customer: [
    {
      step: "Payment",
      from: "Customer pays by QR and submits receipt/reference",
      admin: "Admin checks receiver, amount, reference, duplicate risk",
      to: "Approve creates inventory/rooster/inbox receipt",
      customer: "Customer sees receipt, inventory, rooster, or reject note",
      href: "/admin/customer-requests/wallet",
      tone: "warn",
    },
    {
      step: "Care Concern",
      from: "Customer reports wrong rooster, weak proof, or health worry",
      admin: "Admin opens request, caretaker proof, QR/serial, and chat trail",
      to: "Create correction task or release approved care log",
      customer: "Customer sees approved care log or formal explanation",
      href: "/admin/customer-requests/care",
      tone: "bad",
    },
    {
      step: "Support",
      from: "Customer asks KaFarm first",
      admin: "Admin joins only if escalated",
      to: "Admin reply is saved in live chat evidence",
      customer: "Customer sees admin reply in support chat",
      href: "/admin/live-chat",
      tone: "neutral",
    },
  ],
  caretaker: [
    {
      step: "Application",
      from: "Caretaker applies from admin-only link",
      admin: "Admin reviews photo, resume, payment mode, and notes",
      to: "Approve unlocks caretaker workspace",
      customer: "Customer never sees private resume details",
      href: "/admin/caretaker-registration",
      tone: "warn",
    },
    {
      step: "Task Proof",
      from: "Caretaker opens assigned task, scans QR, uploads proof",
      admin: "Admin checks clarity, serial, time, note, and requested media",
      to: "Approve releases care log to customer",
      customer: "Customer sees only approved update",
      href: "/admin/evidence",
      tone: "bad",
    },
    {
      step: "Exception",
      from: "Caretaker asks KaFarm/Admin for QR/camera/serial issue",
      admin: "Admin decides release/exception from live chat",
      to: "Task remains blocked until approval",
      customer: "No customer update before admin approval",
      href: "/admin/live-chat",
      tone: "warn",
    },
  ],
  farm: [
    {
      step: "Farm Buy",
      from: "Customer selects product/rooster and submits manual payment",
      admin: "Admin approves payment proof",
      to: "Inventory or My Roosters updates",
      customer: "Customer sees approved item and receipt in inbox",
      href: "/admin/transactions/cashin",
      tone: "warn",
    },
    {
      step: "Care Request",
      from: "Customer chooses rooster, service, notes, and proof type",
      admin: "Admin approves payment and assigns caretaker",
      to: "Caretaker receives active task",
      customer: "Customer waits for approved care log",
      href: "/admin/farm-operations",
      tone: "good",
    },
    {
      step: "Sell Request",
      from: "Customer requests sale",
      admin: "Admin sets price and asks caretaker for weight/status",
      to: "Sale invoice and payout trail",
      customer: "Customer sees sale computation and receipt",
      href: "/admin/sell-requests",
      tone: "neutral",
    },
  ],
  money: [
    {
      step: "Cash-In",
      from: "Customer uploads receipt/reference",
      admin: "Admin checks duplicate, receiver, and amount",
      to: "Approve posts credit/record",
      customer: "Customer sees status and receipt",
      href: "/admin/transactions/cashin",
      tone: "warn",
    },
    {
      step: "Withdrawal",
      from: "Customer requests payout",
      admin: "Admin checks KYC, payout account, balance, and proof",
      to: "Manual payout receipt sent to inbox",
      customer: "Customer sees withdrawal status",
      href: "/admin/customer-requests/withdraw",
      tone: "bad",
    },
    {
      step: "Treasury",
      from: "System gathers pending money events",
      admin: "Admin views holds, payouts, payroll, and incoming cash",
      to: "Owner gets clean money picture",
      customer: "No customer-facing changes here",
      href: "/admin/treasury",
      tone: "neutral",
    },
  ],
  evidence: [
    {
      step: "Evidence Packet",
      from: "Customer/caretaker/system creates proof",
      admin: "Admin filters by case and opens related records",
      to: "Decision links back to original issue",
      customer: "Customer only sees approved/needed notices",
      href: "/admin/evidence",
      tone: "neutral",
    },
    {
      step: "Resolved Case",
      from: "Issue is completed",
      admin: "Admin keeps final note, receipt, proof, and timestamp",
      to: "Case can be archived/deleted from work queue",
      customer: "Customer sees final status where relevant",
      href: "/admin/customer-requests/resolved",
      tone: "good",
    },
  ],
  kafarm: [
    {
      step: "Ask KaFarm",
      from: "Admin asks what happened",
      admin: "KaFarm points to queue, evidence, and safe next step",
      to: "Admin decides manually",
      customer: "No sensitive action without admin approval",
      href: "/admin/kafarm",
      tone: "neutral",
    },
    {
      step: "Buddy Handoff",
      from: "KaFarm prepares report for outside Buddy",
      admin: "Admin reviews exact issue and affected route",
      to: "Developer fixes code/SQL safely",
      customer: "Customer only sees fixed workflow",
      href: "/admin/kafarm/buddy-reports",
      tone: "warn",
    },
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
            <p className="mt-1 text-sm font-bold text-[#667267]">Customer â†’ Admin â†’ Caretaker â†’ Admin â†’ Customer flow, para hindi maligaw ang trabaho.</p>
          </div>
          <Badge tone="good">Wired Map</Badge>
        </div>
        <div className="mt-4 max-h-[300px] overflow-y-auto pr-2">
          <div className="grid min-w-[960px] gap-2">
            <div className="grid grid-cols-[130px_1fr_1fr_1fr_1fr_110px] gap-2 rounded-xl bg-[#17251d] px-3 py-2 text-xs font-black uppercase text-white">
              <span>Flow</span>
              <span>Starts From</span>
              <span>Admin Checks</span>
              <span>Goes To</span>
              <span>Customer Sees</span>
              <span>Open</span>
            </div>
            {rows.map((row) => (
              <div key={row.step} className="grid grid-cols-[130px_1fr_1fr_1fr_1fr_110px] items-center gap-2 rounded-2xl border border-[#ece6d8] bg-[#fffdf7] px-3 py-3 text-sm font-bold text-[#667267]">
                <div>
                  <Badge tone={row.tone}>{row.step}</Badge>
                </div>
                <span>{row.from}</span>
                <span>{row.admin}</span>
                <span>{row.to}</span>
                <span>{row.customer}</span>
                <Link href={row.href} className="rounded-xl bg-[#1f6b45] px-3 py-2 text-center text-xs font-black text-white">
                  Open
                </Link>
              </div>
            ))}
          </div>
        </div>
      </Card>
      {kind === "farm" && (
        <div className="mt-5">
          <AdminLiveCareRequestQueue />
        </div>
      )}
      {(kind === "caretaker" || kind === "evidence") && (
        <div className="mt-5">
          <AdminLiveTaskProofQueue />
        </div>
      )}
    </>
  );
}

function AdminWithdrawalReviewQueue() {
  const [rows, setRows] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [decision, setDecision] = useState<"approved" | "rejected" | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [reference, setReference] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState("");
  const [viewer, setViewer] = useState<"proof" | "invoice" | null>(null);
  const [statusNote, setStatusNote] = useState("Loading withdrawal requests...");
  const [saving, setSaving] = useState(false);
  const activeRows = rows.filter((row) => ["for_review", "needs_info", "kyc_required"].includes(String(row.status || "for_review")));
  const selected = activeRows.find((row) => row.id === selectedId) || activeRows[0] || null;
  const profile = selected ? (Array.isArray(selected.profiles) ? selected.profiles[0] : selected.profiles) : null;
  const customer = profile?.display_name || profile?.full_name || profile?.email || selected?.payout_holder || "Customer";

  async function load() {
    try {
      const data = await getAdminWithdrawalRequests();
      setRows(data);
      const active = data.filter((row: any) => ["for_review", "needs_info", "kyc_required"].includes(String(row.status || "for_review")));
      setSelectedId((current) => (active.some((row: any) => row.id === current) ? current : active[0]?.id || ""));
      setStatusNote(active.length ? "Select one withdrawal and verify the saved payout account before sending money." : "No withdrawal request waiting for admin review.");
    } catch (error) {
      setRows([]);
      setStatusNote(`Withdrawal queue could not load: ${error instanceof Error ? error.message : "Check admin login, SQL 020, and RLS."}`);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  useEffect(
    () => () => {
      if (receiptPreview) URL.revokeObjectURL(receiptPreview);
    },
    [receiptPreview],
  );

  function selectRequest(id: string) {
    setSelectedId(id);
    setDecision(null);
    setAdminNote("");
    setReference("");
    setReceiptFile(null);
    setReceiptPreview("");
    setViewer(null);
  }
  function chooseFile(file?: File) {
    if (receiptPreview) URL.revokeObjectURL(receiptPreview);
    setReceiptFile(file || null);
    setReceiptPreview(file ? URL.createObjectURL(file) : "");
  }
  async function submitDecision() {
    if (!selected || !decision || saving) return;
    if (String(selected.status) === "kyc_required" && decision === "approved") {
      setStatusNote("Cannot approve yet: customer KYC must be approved before payout release.");
      return;
    }
    if (decision === "rejected" && adminNote.trim().length < 5) {
      setStatusNote("Write a clear rejection reason for the customer.");
      return;
    }
    if (decision === "approved" && (!reference.trim() || !receiptFile)) {
      setStatusNote("Approval needs the real payout reference and uploaded payout receipt.");
      return;
    }
    try {
      setSaving(true);
      setStatusNote(`Saving ${decision} withdrawal decision...`);
      let storedPath: string | null = null;
      if (decision === "approved" && receiptFile) {
        storedPath = await uploadPrivateEvidenceFile({
          bucket: "withdrawal-proofs",
          folder: selected.id,
          kind: "admin-payout",
          file: receiptFile,
          maxBytes: 10 * 1024 * 1024,
          allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
        });
      }
      await adminReviewWithdrawalRequest(selected.id, decision, adminNote || "Payout details and proof checked by admin.", decision === "approved" ? reference : null, storedPath, receiptFile?.name || null);
      setStatusNote(decision === "approved" ? "Payout proof saved. Customer inbox now asks for confirmation." : "Withdrawal rejected and held funds returned to the customer.");
      setDecision(null);
      setAdminNote("");
      setReference("");
      setReceiptFile(null);
      setReceiptPreview("");
      setViewer(null);
      await load();
    } catch (error) {
      setStatusNote(`Withdrawal decision failed: ${error instanceof Error ? error.message : "Check SQL 020/034, storage policy, RLS, and admin login."}`);
    } finally {
      setSaving(false);
    }
  }
  return (
    <>
      <div className="grid gap-4 xl:grid-cols-[280px_minmax(480px,1fr)_320px]">
        <Card className="min-h-[620px]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-black">Customer Queue</h2>
              <p className="mt-1 text-xs font-bold leading-5 text-[#667267]">Only withdrawals waiting for admin action appear here.</p>
            </div>
            <Badge tone="warn">{activeRows.length}</Badge>
          </div>
          <div className="mt-4 max-h-[510px] space-y-3 overflow-y-auto pr-2">
            {activeRows.map((row) => {
              const p = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
              const name = p?.display_name || p?.full_name || p?.email || row.payout_holder || "Customer";
              return (
                <button key={row.id} type="button" onClick={() => selectRequest(row.id)} className={"w-full rounded-2xl border p-3 text-left transition " + (selected?.id === row.id ? "border-[#1f6b45] bg-emerald-50 shadow-sm" : "border-[#ece6d8] bg-[#fffdf7] hover:border-[#1f6b45]")}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <b className="block truncate">{name}</b>
                      <p className="mt-1 truncate text-xs font-bold text-[#667267]">
                        {row.payout_method} / {peso(Number(row.amount || 0))}
                      </p>
                      <p className="mt-2 text-xs font-black text-[#1f6b45]">{row.created_at ? new Date(row.created_at).toLocaleString() : "For review"}</p>
                    </div>
                    <Badge tone={row.status === "kyc_required" ? "bad" : "warn"}>{String(row.status || "review").replaceAll("_", " ")}</Badge>
                  </div>
                </button>
              );
            })}
            {!activeRows.length && <div className="rounded-2xl bg-[#f4efe4] p-5 text-sm font-bold text-[#667267]">No pending withdrawal review.</div>}
          </div>
        </Card>
        <Card className="min-h-[620px]">
          {selected ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase text-[#667267]">Submitted Withdrawal</p>
                  <h2 className="mt-1 text-3xl font-black">{customer}</h2>
                  <p className="mt-1 text-sm font-bold text-[#667267]">{profile?.email || "Customer payout request"}</p>
                </div>
                <Badge tone={selected.status === "kyc_required" ? "bad" : "warn"}>{String(selected.status || "for_review").replaceAll("_", " ")}</Badge>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <Info label="Amount" value={peso(Number(selected.amount || 0))} />
                <Info label="Withdrawal Method" value={selected.payout_method || "Not recorded"} />
                <Info label="Account Holder" value={selected.payout_holder || "Not recorded"} />
                <Info label="Account / Mobile" value={selected.payout_account || "Not recorded"} />
              </div>
              <div className="mt-4 rounded-2xl border border-[#ece6d8] bg-[#fffdf7] p-4">
                <p className="text-xs font-black uppercase text-[#667267]">Customer Note</p>
                <p className="mt-2 text-sm font-bold leading-6">{selected.customer_note || "No customer note."}</p>
              </div>
              <div className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm font-bold leading-6 text-amber-900">Send only to the exact saved method, holder, and account shown above. A KYC-required request cannot be approved.</div>
            </>
          ) : (
            <div className="grid min-h-[500px] place-items-center text-center">
              <div>
                <h2 className="text-2xl font-black">No pending request</h2>
                <p className="mt-2 text-sm font-bold text-[#667267]">A submitted withdrawal will appear here.</p>
              </div>
            </div>
          )}
        </Card>
        <Card className="min-h-[620px]">
          <h2 className="text-lg font-black">Admin Action</h2>
          <p className="mt-1 text-xs font-bold leading-5 text-[#667267]">Send payout externally first. Attach its real receipt and reference before approval.</p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <button type="button" disabled={!selected} onClick={() => setDecision("approved")} className={"min-h-20 rounded-2xl px-4 py-3 font-black text-white disabled:opacity-40 " + (decision === "approved" ? "bg-[#145a38] ring-4 ring-emerald-200" : "bg-[#1f6b45]")}>
              Approve
            </button>
            <button type="button" disabled={!selected} onClick={() => setDecision("rejected")} className={"min-h-20 rounded-2xl px-4 py-3 font-black text-white disabled:opacity-40 " + (decision === "rejected" ? "bg-red-700 ring-4 ring-red-200" : "bg-red-600")}>
              Reject
            </button>
          </div>
          {decision === "approved" && (
            <div className="mt-4 grid gap-3">
              <label className="text-sm font-black">
                Admin Payout Reference
                <input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Reference from GCash, Maya, or bank" className="mt-2 w-full rounded-xl border border-[#ded8c9] bg-[#fffdf7] p-3 font-black" />
              </label>
              <label className="rounded-2xl border-2 border-dashed border-[#d8cfbd] bg-[#f9f6ec] p-3 text-sm font-black">
                Upload Payout Receipt
                <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(event) => chooseFile(event.target.files?.[0])} className="mt-2 block w-full text-xs" />
                <span className="mt-2 block text-xs text-[#667267]">{receiptFile?.name || "No file selected"}</span>
              </label>
              <button type="button" disabled={!receiptFile} onClick={() => setViewer("proof")} className="rounded-xl bg-[#eee8d9] px-4 py-3 text-sm font-black disabled:opacity-50">
                View Payout Proof
              </button>
            </div>
          )}
          <label className="mt-4 block text-sm font-black">
            Note to Customer
            <textarea value={adminNote} onChange={(event) => setAdminNote(event.target.value)} placeholder="Reason if rejected, or payout confirmation note..." className="mt-2 h-28 w-full resize-none rounded-2xl border border-[#ded8c9] bg-[#fffdf7] p-3 text-sm font-bold" />
          </label>
          <button type="button" disabled={!selected || !decision} onClick={() => setViewer("invoice")} className="mt-4 w-full rounded-xl bg-[#eee8d9] px-4 py-3 text-sm font-black disabled:opacity-50">
            View Invoice
          </button>
          <button type="button" disabled={!selected || !decision || saving} onClick={submitDecision} className="mt-3 w-full rounded-2xl bg-[#1f6b45] px-4 py-4 font-black text-white disabled:bg-[#b9b3a4]">
            {saving ? "Saving..." : "Submit Decision"}
          </button>
          <p className="mt-3 rounded-xl bg-[#f4efe4] p-3 text-xs font-bold leading-5 text-[#667267]">{statusNote}</p>
        </Card>
      </div>
      {viewer && selected && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
          <div className="max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase text-[#667267]">{viewer === "proof" ? "Admin Payout Proof" : "Withdrawal Invoice Preview"}</p>
                <h2 className="mt-1 text-2xl font-black">{customer}</h2>
              </div>
              <button type="button" onClick={() => setViewer(null)} className="rounded-xl bg-[#eee8d9] px-4 py-2 font-black">
                Close
              </button>
            </div>
            {viewer === "proof" ? (
              <div className="mt-5 grid min-h-80 place-items-center overflow-hidden rounded-2xl bg-[#111] p-4">
                {receiptPreview && receiptFile?.type.startsWith("image/") ? (
                  <img src={receiptPreview} alt="Admin payout receipt" className="max-h-[560px] w-full object-contain" />
                ) : (
                  <div className="text-center text-white">
                    <Icon name="file" className="mx-auto h-12 w-12" />
                    <p className="mt-3 font-black">{receiptFile?.name || "No payout receipt selected"}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-[#ece6d8] bg-[#fffdf7] p-5">
                <h3 className="text-2xl font-black">FarmConnect Withdrawal Invoice</h3>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <Info label="Customer" value={customer} />
                  <Info label="Amount" value={peso(Number(selected.amount || 0))} />
                  <Info label="Payout Method" value={`${selected.payout_method} / ${selected.payout_holder}`} />
                  <Info label="Payout Account" value={selected.payout_account || "Missing"} />
                  <Info label="Admin Reference" value={reference || "Required before approval"} />
                  <Info label="Decision" value={decision || "Not selected"} />
                  <Info label="Receipt File" value={receiptFile?.name || "Required before approval"} />
                  <Info label="Admin Note" value={adminNote || "No note"} />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function AdminLiveCareRequestQueue({ mode = "all" }: { mode?: "all" | "task" } = {}) {
  const [rows, setRows] = useState<any[]>([]);
  const [carePlans, setCarePlans] = useState<any[]>([]);
  const [caretakers, setCaretakers] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [selectedCaretakerId, setSelectedCaretakerId] = useState("");
  const [note, setNote] = useState("Loading live care requests...");
  const [assigning, setAssigning] = useState(false);
  const visibleRequests = rows.filter((row) => {
    const status = String(row.status || "");
    if (mode === "task") return status === "paid_pending_assignment" || status === "pending_assignment";
    return !["completed", "approved", "rejected", "cancelled"].includes(status);
  });
  const assignablePlans = mode === "task"
    ? carePlans.filter((plan) => String(plan.status || "") === "paid_pending_setup" || (String(plan.status || "") === "ready" && !plan.assigned_caretaker_id)).map((plan) => {
        const animal = Array.isArray(plan.customer_animals) ? plan.customer_animals[0] : plan.customer_animals;
        const customer = Array.isArray(plan.customer) ? plan.customer[0] : plan.customer;
        return {
          ...plan,
          queue_type: "care_plan",
          customer_name: customer?.display_name || customer?.full_name || customer?.email || "Customer",
          rooster_name: animal?.animal_name || "Customer rooster",
          rooster_serial: animal?.animal_code || "Verify in caretaker app",
          service_name: `${Number(plan.duration_days || 30)}-Day Care Plan`,
          service_price: Number(plan.package_total || 0),
          required_proof: "Daily mission checklist, health status, actual inventory usage, and time-stamped evidence.",
          customer_note: "Paid automatic Care Plan. Assign one caretaker once; the Mission Engine creates each daily task.",
        };
      })
    : [];
  const visibleRows = [...visibleRequests, ...assignablePlans];
  const selected = visibleRows.find((row) => row.id === selectedId) || visibleRows[0] || null;
  async function load() {
    try {
      const [data, planRows, activeCaretakers] = await Promise.all([getAdminCareRequests(), getAdminCarePlans(), getActiveCaretakersForAssignment()]);
      setRows(data);
      setCarePlans(planRows);
      setCaretakers(activeCaretakers);
      const nextRequests = data.filter((row: any) => (mode === "task" ? ["paid_pending_assignment", "pending_assignment"].includes(String(row.status || "")) : !["completed", "approved", "rejected", "cancelled"].includes(String(row.status || ""))));
      const nextPlans = mode === "task" ? planRows.filter((plan: any) => String(plan.status || "") === "paid_pending_setup" || (String(plan.status || "") === "ready" && !plan.assigned_caretaker_id)).map((plan: any) => ({ ...plan, queue_type: "care_plan" })) : [];
      const nextVisible = [...nextRequests, ...nextPlans];
      setSelectedId((current) => (nextVisible.some((row: any) => row.id === current) ? current : nextVisible[0]?.id || ""));
      setNote(nextVisible.length ? "Approved and paid Care Requests are ready for one-time caretaker assignment." : "No approved Care Request is waiting for assignment.");
    } catch {
      setRows([]);
      setCarePlans([]);
      setCaretakers([]);
      setNote("Task assignment queue could not load. Check admin login, active caretakers, and SQL 011.");
    }
  }
  useEffect(() => {
    load();
  }, []);
  async function assign() {
    if (!selected || !selectedCaretakerId) {
      setNote("Select one active caretaker before assigning this task.");
      return;
    }
    try {
      setAssigning(true);
      if (selected.queue_type === "care_plan") {
        await assignAdminCarePlan(selected.id, selectedCaretakerId, "Assigned once from Task Management. Daily missions continue automatically.");
      } else {
        await adminAssignCareRequest(selected.id, selectedCaretakerId, "Assigned from Customer Requests Task Management.");
      }
      await load();
      setSelectedCaretakerId("");
      setNote(selected.queue_type === "care_plan" ? `Assigned ${selected.service_name} for ${selected.rooster_name}. Today's task was created; the next daily tasks are automatic.` : `Assigned ${selected.service_name} for ${selected.rooster_name}. It now appears in the caretaker's Active Tasks.`);
    } catch (error) {
      setNote(`Assign failed: ${readableAppError(error) || "Check admin login, active caretaker, or assignment SQL."}`);
    } finally {
      setAssigning(false);
    }
  }
  return (
    <div className="grid gap-4 xl:grid-cols-[280px_minmax(480px,1fr)_320px]">
      <Card className="min-h-[620px]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-black">Customer Queue</h2>
            <p className="mt-1 text-xs font-bold leading-5 text-[#667267]">Approved one-time requests and paid Care Plans waiting for one assignment.</p>
          </div>
          <Badge tone="warn">{visibleRows.length}</Badge>
        </div>
        <div className="mt-4 max-h-[510px] space-y-3 overflow-y-auto pr-2">
          {visibleRows.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => {
                setSelectedId(row.id);
                setSelectedCaretakerId("");
              }}
              className={"w-full rounded-2xl border p-3 text-left transition " + (selected?.id === row.id ? "border-[#1f6b45] bg-emerald-50 shadow-sm" : "border-[#ece6d8] bg-[#fffdf7] hover:border-[#1f6b45]")}
            >
              <b className="block truncate">{row.customer_name || row.customer_email || "Customer"}</b>
              <p className="mt-1 truncate text-xs font-bold text-[#667267]">
                {row.rooster_name} / {row.service_name}
              </p>
              <p className="mt-2 text-xs font-black text-[#1f6b45]">{row.created_at ? new Date(row.created_at).toLocaleString() : "Ready to assign"}</p>
            </button>
          ))}
          {!visibleRows.length && <div className="rounded-2xl bg-[#f4efe4] p-5 text-sm font-bold text-[#667267]">No approved Care Request waiting for caretaker assignment.</div>}
        </div>
      </Card>
      <Card className="min-h-[620px]">
        {selected ? (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase text-[#667267]">Approved Task Card</p>
                <h2 className="mt-1 text-3xl font-black">{selected.service_name || "Care Task"}</h2>
                <p className="mt-1 text-sm font-bold text-[#667267]">Customer: {selected.customer_name || selected.customer_email || "Customer"}</p>
              </div>
              <Badge tone="warn">{String(selected.status || "pending assignment").replaceAll("_", " ")}</Badge>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <Info label="Rooster Name" value={selected.rooster_name || "Not recorded"} />
              <Info label="QR / Serial" value={selected.rooster_serial || selected.animal_serial || "Verify in caretaker app"} />
              <Info label="Service" value={selected.service_name || "Care request"} />
              <Info label="Paid Amount" value={peso(Number(selected.service_price || 0))} />
              {selected.queue_type === "care_plan" && <Info label="Automation" value="One assignment · daily tasks automatic" />}
            </div>
            <div className="mt-4 rounded-2xl border border-[#ece6d8] bg-[#fffdf7] p-4">
              <p className="text-xs font-black uppercase text-[#667267]">Customer Instruction</p>
              <p className="mt-2 text-sm font-bold leading-6">{selected.customer_note || "No extra instruction."}</p>
            </div>
            <div className="mt-4 rounded-2xl bg-[#f6f3e8] p-4 text-sm font-bold leading-6 text-[#667267]">
              <b className="text-[#17251d]">Required proof:</b> {selected.required_proof || "Documentation, photo upload, and rooster verification before sending to admin."}
            </div>
          </>
        ) : (
          <div className="grid min-h-[500px] place-items-center text-center">
            <div>
              <h2 className="text-2xl font-black">No task to assign</h2>
              <p className="mt-2 text-sm font-bold text-[#667267]">Approved care payments will create task cards here.</p>
            </div>
          </div>
        )}
      </Card>
      <Card className="min-h-[620px]">
        <h2 className="text-lg font-black">Assign Caretaker</h2>
        <p className="mt-1 text-xs font-bold leading-5 text-[#667267]">Choose one active caretaker once. Paid Care Plans generate each daily task automatically after assignment.</p>
        <div className="mt-4 max-h-[430px] space-y-2 overflow-y-auto pr-2">
          {caretakers.map((caretaker) => (
            <button key={caretaker.id} type="button" disabled={!selected} onClick={() => setSelectedCaretakerId(caretaker.id)} className={"w-full rounded-2xl border p-3 text-left transition disabled:opacity-40 " + (selectedCaretakerId === caretaker.id ? "border-[#1f6b45] bg-emerald-50" : "border-[#ece6d8] bg-[#fffdf7]")}>
              <b>{caretaker.display_name || caretaker.full_name || "Caretaker"}</b>
              <p className="mt-1 text-xs font-bold text-[#667267]">{caretaker.farm_role || "Active caretaker"}</p>
            </button>
          ))}
          {selected && caretakers.length === 0 && <div className="rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-900">No active caretaker available. Approve a caretaker account first.</div>}
        </div>
        <button type="button" data-kafarm-feedback-target="care-assignment-status" onClick={assign} disabled={!selected || !selectedCaretakerId || assigning} className="mt-5 w-full rounded-2xl bg-[#1f6b45] px-4 py-4 font-black text-white disabled:bg-[#b9b3a4]">
          {assigning ? "Assigning..." : "Assign Task"}
        </button>
        <p id="care-assignment-status" role="status" aria-live="polite" className="mt-3 rounded-xl bg-[#f4efe4] p-3 text-xs font-bold leading-5 text-[#667267]">
          {note}
        </p>
      </Card>
    </div>
  );
}

function AdminLiveTaskProofQueue() {
  const [rows, setRows] = useState<any[]>([]);
  const [proofUrls, setProofUrls] = useState<Record<string, string>>({});
  const [selectedId, setSelectedId] = useState("");
  const [adminNote, setAdminNote] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [note, setNote] = useState("Loading task proof submissions...");
  const pendingRows = rows.filter((row) => String(row.admin_review_status || row.status || "pending") === "pending");
  const selected = pendingRows.find((row) => row.id === selectedId) || pendingRows[0] || null;
  async function load() {
    try {
      const data = await getAdminTaskProofs();
      setRows(data);
      const signedEntries = await Promise.all(
        data.map(async (row) => {
          const stored = row.proof_file_urls?.[0] || row.proof_url;
          if (!stored) return [row.id, ""] as const;
          try {
            return [row.id, await createPrivateEvidenceUrl("caretaker-task-proofs", stored)] as const;
          } catch {
            return [row.id, ""] as const;
          }
        }),
      );
      setProofUrls(Object.fromEntries(signedEntries));
      const nextPending = data.find((row) => String(row.admin_review_status || row.status || "pending") === "pending");
      setSelectedId((current) => (data.some((row) => row.id === current) ? current : nextPending?.id || ""));
      setNote(data.length ? "Live caretaker proofs loaded from Supabase." : "No live proof submissions yet.");
    } catch (error) {
      const message = readableAppError(error);
      console.error("KaFarm admin task proof queue issue", {
        page: "/admin/caretaker-management",
        expected: "Load submitted caretaker task proofs for admin review.",
        actual: message,
      });
      setNote(`Task proof queue blocked: ${message}`);
    }
  }
  useEffect(() => {
    load();
  }, []);
  async function review(row: any, decision: "approved" | "rejected" | "backjob") {
    if (decision !== "approved" && !adminNote.trim()) {
      setNote("Write a clear correction note before returning this task to the caretaker.");
      return;
    }
    setReviewing(true);
    try {
      if (row.caretaker_tasks?.workflow_type === "care_plan_daily_mission") {
        await adminReviewMissionProof(row.id, decision, adminNote.trim() || "Daily mission evidence and inventory usage verified by admin.");
      } else if (row.caretaker_tasks?.workflow_type === "manual_standard_mission") {
        await adminReviewManualMissionProof(row.id, decision, adminNote.trim() || "Manual premium mission evidence and inventory usage verified by admin.");
      } else {
        await adminReviewTaskProof(row.id, decision, adminNote.trim() || "Proof approved by admin.");
      }
      setAdminNote("");
      await load();
      setNote(`Proof ${decision}. Customer inbox and care request status should update.`);
    } catch (error) {
      setNote(`Proof review failed: ${readableAppError(error)}`);
    } finally {
      setReviewing(false);
    }
  }
  const task = selected?.caretaker_tasks;
  const proofUrl = selected ? proofUrls[selected.id] : "";
  const isVideoEvidence = String(selected?.proof_type || "").toLowerCase() === "video" || /\.(mp4|webm|mov)(?:\?|$)/i.test(proofUrl);
  const isQrTagging = task?.workflow_type === "qr_tagging";
  const isSalePriceProof = task?.workflow_type === "sale_price_inspection";
  const isSaleReleaseProof = task?.workflow_type === "sale_release_confirmation";

  return (
    <div className="grid gap-4 xl:grid-cols-[280px_minmax(460px,1fr)_300px]">
      <Card className="min-h-[620px]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-black">Task Queue</h2>
            <p className="mt-1 text-xs font-bold leading-5 text-[#667267]">Submitted proofs waiting for review.</p>
          </div>
          <Badge tone="warn">{pendingRows.length}</Badge>
        </div>
        <div className="mt-4 max-h-[510px] space-y-3 overflow-y-auto pr-2">
          {pendingRows.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => {
                setSelectedId(row.id);
                setAdminNote("");
              }}
              className={"w-full rounded-2xl border p-3 text-left transition " + (selected?.id === row.id ? "border-[#1f6b45] bg-emerald-50 shadow-sm" : "border-[#ece6d8] bg-[#fffdf7] hover:border-[#1f6b45]")}
            >
              <b className="block truncate">{row.caretaker_tasks?.task_type || "Submitted Task"}</b>
              <p className="mt-1 truncate text-xs font-bold text-[#667267]">{row.caretaker_tasks?.rooster_name || "Rooster"}</p>
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="truncate text-xs font-black text-[#1f6b45]">{row.caretakers?.display_name || row.caretakers?.full_name || "Caretaker"}</span>
                <Badge tone={String(row.caretaker_tasks?.workflow_type || "").startsWith("sale_") ? "bad" : "warn"}>{row.caretaker_tasks?.workflow_type === "sale_price_inspection" ? "Sale Price" : row.caretaker_tasks?.workflow_type === "sale_release_confirmation" ? "Final Sale" : "Pending"}</Badge>
              </div>
            </button>
          ))}
          {!pendingRows.length && <div className="rounded-2xl bg-[#f4efe4] p-5 text-sm font-bold text-[#667267]">No submitted task waiting for admin review.</div>}
        </div>
      </Card>

      <Card className="min-h-[620px]">
        {selected ? (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase text-[#667267]">Selected Submission</p>
                <h2 className="mt-1 text-3xl font-black">{task?.task_type || "Task Proof"}</h2>
                <p className="mt-1 text-sm font-bold text-[#667267]">
                  {task?.rooster_name || "Rooster"} {task?.rooster_tag ? `/ ${task.rooster_tag}` : ""}
                </p>
              </div>
              <Badge tone="warn">Needs Review</Badge>
            </div>
            <div className="mt-4 overflow-hidden rounded-2xl border border-[#e3ded0] bg-[#f6f3e8]">
              {proofUrl ? (
                isVideoEvidence ? (
                  <video src={proofUrl} controls playsInline className="h-[300px] w-full bg-black object-contain">
                    Your browser cannot play this proof video.
                  </video>
                ) : (
                  <a href={proofUrl} target="_blank" rel="noreferrer" title="Open full submitted proof">
                    <img src={proofUrl} alt="Caretaker submitted proof" className="h-[300px] w-full bg-white object-contain" />
                  </a>
                )
              ) : (
                <div className="grid h-[300px] place-items-center text-sm font-black text-[#667267]">No uploaded evidence</div>
              )}
              <div className="flex items-center justify-between gap-3 border-t border-[#e3ded0] bg-white p-3">
                <span className="text-xs font-black text-[#667267]">Uploaded caretaker evidence</span>
                {proofUrl && (
                  <a href={proofUrl} target="_blank" rel="noreferrer" className="rounded-xl bg-[#eee8d9] px-4 py-2 text-xs font-black">
                    Open Full Evidence
                  </a>
                )}
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Info label="Caretaker" value={selected.caretakers?.display_name || selected.caretakers?.full_name || "Caretaker"} />
              <Info label="Submitted" value={selected.created_at ? new Date(selected.created_at).toLocaleString() : "Recorded"} />
              <Info label="Verification" value={isSaleReleaseProof ? "No QR required" : isQrTagging ? "New QR attached" : selected.qr_verified ? "QR verified" : selected.serial_exception ? "Serial exception" : "Not verified"} />
              <Info label="Proof Status" value={selected.proof_check_status || "Needs review"} />
              {isSalePriceProof && <Info label="Caretaker Price" value={peso(Number(selected.declared_amount || 0))} />}
              <Info label="Workflow" value={isSalePriceProof ? "Special Sale Price Inspection" : isSaleReleaseProof ? "Special Final Sale Release" : "Standard Care Task"} />
            </div>
            <div className="mt-4 rounded-2xl border border-[#ece6d8] bg-[#fffdf7] p-4">
              <p className="text-xs font-black uppercase text-[#667267]">Caretaker Documentation</p>
              <p className="mt-2 whitespace-pre-wrap text-sm font-bold leading-6">{selected.free_note || selected.preset_note || "No documentation submitted."}</p>
            </div>
            {["care_plan_daily_mission", "manual_standard_mission"].includes(String(task?.workflow_type || "")) && (
              <div className="mt-4 space-y-3 rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase text-[#1f6b45]">{task?.workflow_type === "care_plan_daily_mission" ? "Automatic Paid Care Plan Review" : "Manual Premium Care Review"}</p>
                    <h3 className="text-xl font-black">{String(task.task_metadata?.primary_mission || task.task_type)}</h3>
                  </div>
                  <Badge tone={selected.health_status === "pass" ? "good" : "bad"}>{String(selected.health_status || "missing").replaceAll("_", " ")}</Badge>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Info label="Operations Completed" value={`${Array.isArray(selected.checklist_results?.operations) ? selected.checklist_results.operations.filter((item: any) => item.checked).length : 0} / ${Array.isArray(task.task_metadata?.operations_checklist) ? task.task_metadata.operations_checklist.length : 0}`} />
                  <Info label="Health Checks Passed" value={`${Array.isArray(selected.checklist_results?.health) ? selected.checklist_results.health.filter((item: any) => item.checked).length : 0} / ${Array.isArray(task.task_metadata?.health_checklist) ? task.task_metadata.health_checklist.length : 0}`} />
                  <Info label="Housing Checks" value={`${Array.isArray(selected.checklist_results?.housing) ? selected.checklist_results.housing.filter((item: any) => item.checked).length : 0} / ${Array.isArray(task.task_metadata?.housing_checklist) ? task.task_metadata.housing_checklist.length : 0}`} />
                  <Info label="Supplement Checks" value={`${Array.isArray(selected.checklist_results?.supplements) ? selected.checklist_results.supplements.filter((item: any) => item.checked).length : 0} / ${Array.isArray(task.task_metadata?.supplement_checklist) ? task.task_metadata.supplement_checklist.length : 0}`} />
                  <Info label="Vaccine / Authority Checks" value={`${Array.isArray(selected.checklist_results?.vaccines) ? selected.checklist_results.vaccines.filter((item: any) => item.checked).length : 0} / ${Array.isArray(task.task_metadata?.vaccine_checklist) ? task.task_metadata.vaccine_checklist.length : 0}`} />
                </div>
                <div className="rounded-xl bg-white p-3">
                  <p className="text-xs font-black uppercase text-[#667267]">Inventory Usage Requested</p>
                  {Array.isArray(selected.inventory_usage) && selected.inventory_usage.length ? (
                    <div className="mt-2 space-y-1">
                      {selected.inventory_usage.map((usage: any, index: number) => (
                        <p key={`${usage.inventory_item_id}-${index}`} className="text-sm font-black">
                          {Number(usage.quantity).toFixed(3)} {usage.unit} — item {String(usage.inventory_item_id).slice(0, 8).toUpperCase()}
                        </p>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm font-bold text-[#667267]">No inventory deduction requested.</p>
                  )}
                </div>
                <p className="rounded-xl bg-amber-50 p-3 text-xs font-bold leading-5 text-amber-950">Approval is atomic: it completes this mission and deducts each exact inventory amount once. WATCH or ISOLATE AND ESCALATE cannot be approved as completed.</p>
              </div>
            )}
          </>
        ) : (
          <div className="grid min-h-[500px] place-items-center text-center">
            <div>
              <h2 className="text-2xl font-black">No proof selected</h2>
              <p className="mt-2 text-sm font-bold text-[#667267]">A submitted caretaker task will appear here.</p>
            </div>
          </div>
        )}
      </Card>

      <Card className="min-h-[620px]">
        <h2 className="text-lg font-black">Admin Decision</h2>
        <p className="mt-1 text-xs font-bold leading-5 text-[#667267]">{isSalePriceProof ? "Approve only after checking the photo, QR and entered price." : isSaleReleaseProof ? "Approve only after confirming the caretaker acknowledged final physical release." : "Review the photo and documentation first."}</p>
        <textarea value={adminNote} onChange={(event) => setAdminNote(event.target.value)} disabled={!selected || reviewing} placeholder="Approval note or clear correction instruction..." className="mt-4 h-44 w-full resize-none rounded-2xl border border-[#ded8c9] bg-[#fffdf7] p-3 text-sm font-bold disabled:opacity-50" />
        <button type="button" onClick={() => selected && review(selected, "approved")} disabled={!selected || reviewing || (["care_plan_daily_mission", "manual_standard_mission"].includes(String(task?.workflow_type || "")) && selected.health_status !== "pass")} className="mt-4 w-full rounded-2xl bg-[#1f6b45] px-4 py-4 font-black text-white disabled:bg-[#b9b3a4]">
          {reviewing ? "Saving..." : "Approve Task"}
        </button>
        <button type="button" onClick={() => selected && review(selected, "backjob")} disabled={!selected || reviewing} className="mt-3 w-full rounded-2xl bg-red-600 px-4 py-4 font-black text-white disabled:bg-[#b9b3a4]">
          Reject / Send Backjob
        </button>
        <div className="mt-4 space-y-3 text-xs font-bold leading-5">
          <p className="rounded-xl bg-emerald-50 p-3 text-emerald-900">
            <b>Approve:</b> completes the task, stores evidence, and releases the customer update.
          </p>
          <p className="rounded-xl bg-red-50 p-3 text-red-900">
            <b>Backjob:</b> returns the task to the caretaker Active Tasks with your required correction.
          </p>
        </div>
        <p className="mt-4 rounded-xl bg-[#f4efe4] p-3 text-xs font-bold leading-5 text-[#667267]">{note}</p>
      </Card>
    </div>
  );
}

function AdminCaretakerManagementPage({ config }: { config: string[] }) {
  const tabs = [
    {
      id: "registration",
      label: "Registration",
      hint: "Permanent signup link",
    },
    { id: "list", label: "List", hint: "Approved caretakers" },
    {
      id: "task-verification",
      label: "Task Verification",
      hint: "Review submitted work",
    },
    {
      id: "completed",
      label: "Completed Tasks",
      hint: "Approved work history",
    },
  ];
  const emptyCaretaker = {
    id: "",
    name: "No caretaker selected",
    avatar: "-",
    status: "",
    selfieFile: "",
    resumeFile: "",
    resume: "",
    payment: "",
    assigned: [] as any[],
  };
  const [applicants, setApplicants] = useState<any[]>([]);
  const [caretakers, setCaretakers] = useState<any[]>([]);
  const [completed, setCompleted] = useState<any[]>([]);
  const [loadNote, setLoadNote] = useState("Loading registered caretakers and task history...");
  const [tab, setTab] = useState(tabs[0].id);
  const [selectedCaretaker, setSelectedCaretaker] = useState<any>(emptyCaretaker);
  const [, setSelectedAssigned] = useState<any>(null);
  const [selectedCompleted, setSelectedCompleted] = useState<any>(null);
  const [note, setNote] = useState("");
  const [adminRequestFile, setAdminRequestFile] = useState("");
  const [viewer, setViewer] = useState<any>(null);
  const signupLink = "/caretaker/signup";
  const copySignupLink = async () => {
    try {
      await navigator.clipboard.writeText(new URL(signupLink, window.location.origin).href);
      setLoadNote("Permanent caretaker registration link copied.");
    } catch {
      setLoadNote("Copy failed. Open the registration page and copy its address from the browser.");
    }
  };
  const completedForCaretaker = completed.filter((row) => row.caretaker === selectedCaretaker.name);
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [applicationRows, directoryRows, taskRows, proofRows] = await Promise.all([getCaretakerApplications(), getAdminCaretakerDirectory(), getAdminCaretakerTasks(), getAdminTaskProofs()]);
        if (!active) return;
        const proofByTask = new Map<string, any>();
        proofRows.forEach((proof: any) => proofByTask.set(proof.caretaker_task_id || proof.task_id, proof));
        const liveCaretakers = directoryRows.map((row: any) => {
          const name = row.display_name || row.full_name || row.email || "Unnamed caretaker";
          const assigned = taskRows
            .filter((task: any) => task.caretaker_id === row.id)
            .map((task: any) => {
              const proof = proofByTask.get(task.id);
              return {
                id: task.id,
                customer: task.profiles?.display_name || task.profiles?.full_name || task.profiles?.email || "Customer",
                rooster: task.rooster_name || task.rooster_tag || "Rooster",
                task: task.task_type || "Care task",
                status: task.status || proof?.admin_review_status || "active",
                note: task.admin_note || task.customer_note || proof?.free_note || proof?.preset_note || "No note",
                file: (proof?.proof_urls || [proof?.proof_url]).filter(Boolean)[0] || "No file yet",
              };
            });
          return {
            id: row.id,
            email: row.email,
            name,
            avatar: name
              .split(/\s+/)
              .map((part: string) => part[0])
              .join("")
              .slice(0, 2)
              .toUpperCase(),
            status: row.status || "active",
            selfieFile: row.avatar_url || "No selfie file",
            resumeFile: row.resume_url || "No resume file",
            resume: row.resume_summary || row.farm_role || "Approved caretaker",
            payment: [row.payment_mode || row.payout_method, row.payment_account_name, row.payment_account_number].filter(Boolean).join(" / ") || "No payout method",
            assigned,
          };
        });
        applicationRows
          .filter((application: any) => application.status === "approved")
          .forEach((application: any) => {
            const alreadyListed = liveCaretakers.some((caretaker: any) => caretaker.id === application.created_caretaker_id || (application.email && caretaker.email === application.email));
            if (alreadyListed) return;
            const name = application.display_name || application.full_name || application.email || "Approved caretaker";
            liveCaretakers.push({
              id: application.created_caretaker_id || `application-${application.id}`,
              email: application.email,
              name,
              avatar: name
                .split(/\s+/)
                .map((part: string) => part[0])
                .join("")
                .slice(0, 2)
                .toUpperCase(),
              status: "approved",
              selfieFile: application.avatar_url || "No selfie file",
              resumeFile: application.resume_url || "No resume file",
              resume: application.farm_role || "Approved caretaker application",
              payment: [application.payment_method, application.payment_account_name, application.payment_account_number].filter(Boolean).join(" / ") || "No payout method",
              assigned: taskRows
                .filter((task: any) => task.caretaker_id === application.created_caretaker_id)
                .map((task: any) => ({
                  id: task.id,
                  customer: task.profiles?.display_name || task.profiles?.full_name || task.profiles?.email || "Customer",
                  rooster: task.rooster_name || task.rooster_tag || "Rooster",
                  task: task.task_type || "Care task",
                  status: task.status || "active",
                  note: task.admin_note || task.customer_note || "No note",
                  file: "No file yet",
                })),
            });
          });
        const completedRows = proofRows
          .filter((proof: any) => proof.admin_review_status === "approved")
          .map((proof: any) => {
            const task = proof.caretaker_tasks || {};
            const caretaker = proof.caretakers || {};
            const customer = proof.profiles || {};
            return {
              id: proof.id,
              caretaker: caretaker.display_name || caretaker.full_name || "Unknown caretaker",
              customer: customer.display_name || customer.full_name || customer.email || "Customer",
              rooster: task.rooster_name || task.rooster_tag || "Rooster",
              request: task.task_type || proof.proof_type || "Completed task",
              date: new Date(proof.reviewed_at || task.reviewed_at || proof.created_at).toLocaleString("en-PH"),
              proofFile: (proof.proof_urls || [proof.proof_url]).filter(Boolean)[0] || "No file attached",
              proof: proof.admin_note || proof.free_note || proof.preset_note || "Approved task proof and documentation.",
            };
          });
        setApplicants(applicationRows);
        setCaretakers(liveCaretakers);
        setCompleted(completedRows);
        setSelectedCaretaker(liveCaretakers[0] || emptyCaretaker);
        setSelectedCompleted(completedRows[0] || null);
        setLoadNote(`${applicationRows.length} registered application(s), ${liveCaretakers.length} approved caretaker(s), ${completedRows.length} completed task(s).`);
      } catch (error: any) {
        if (!active) return;
        setLoadNote(`Live caretaker records failed to load: ${error?.message || "Unknown error"}`);
      }
    })();
    return () => {
      active = false;
    };
  }, []);
  function reset(next: string) {
    setTab(next);
    setNote("");
    setViewer(null);
    setAdminRequestFile("");
  }
  function openViewer(payload: any) {
    setViewer(payload);
  }
  return (
    <Shell role="admin" title={config[0]}>
      <PageTitle title="Caretaker Management" text="Registration link, approved caretaker list, task proof review, backjobs, and completed evidence. Account approval is handled in Account Verification." icon="user" />
      <KaFarm>{loadNote}</KaFarm>
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {tabs.map((item) => (
          <button key={item.id} data-kafarm-monitor-ignore="true" onClick={() => reset(item.id)} className={"rounded-2xl border p-4 text-left shadow-sm transition " + (tab === item.id ? "border-[#1f6b45] bg-[#e9fff3] ring-2 ring-[#1f6b45]/20" : "border-[#e3ded0] bg-white/95 hover:border-[#1f6b45]")}>
            <h2 className="text-lg font-black">{item.label}</h2>
            <p className="mt-1 text-xs font-bold leading-5 text-[#667267]">{item.hint}</p>
          </button>
        ))}
      </div>

      {tab === "registration" && (
        <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_340px]">
          <Card>
            <p className="text-xs font-black uppercase text-[#667267]">Permanent Registration Link</p>
            <h2 className="mt-1 text-3xl font-black">Caretaker signup link</h2>
            <p className="mt-2 text-sm font-bold leading-6 text-[#667267]">Send this link to applicants. It is permanent; account stays inactive until Account Verification approves selfie, resume, and payment details.</p>
            <div className="mt-4 rounded-2xl border border-[#ece6d8] bg-[#fffdf7] p-4 font-black">{signupLink}</div>
            <button type="button" onClick={copySignupLink} className="mt-4 rounded-xl bg-[#1f6b45] px-5 py-3 font-black text-white">
              Copy Link
            </button>
            <h3 className="mt-6 text-lg font-black">Registered Applications</h3>
            <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-2">
              {applicants.length ? (
                applicants.map((application: any) => (
                  <div key={application.id} className="rounded-2xl border border-[#ece6d8] bg-[#fffdf7] p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <b className="block truncate">{application.display_name || application.full_name || application.email}</b>
                        <p className="truncate text-xs font-bold text-[#667267]">{application.email}</p>
                      </div>
                      <Badge tone={application.status === "approved" ? "good" : application.status === "rejected" ? "bad" : "warn"}>{application.status}</Badge>
                    </div>
                  </div>
                ))
              ) : (
                <p className="rounded-2xl bg-[#f6f3e8] p-4 text-sm font-bold text-[#667267]">No caretaker application found.</p>
              )}
            </div>
          </Card>
          <Card>
            <p className="text-xs font-black uppercase text-[#667267]">Registered Caretakers</p>
            <h2 className="mt-2 text-5xl font-black text-[#1f6b45]">{applicants.length}</h2>
            <p className="mt-2 text-sm font-bold text-[#667267]">
              {applicants.filter((row: any) => row.status === "pending_approval" || row.status === "needs_info").length} waiting / {caretakers.length} approved caretaker records.
            </p>
            <Link href="/admin/account-verification" className="mt-5 block rounded-xl bg-[#1f6b45] px-4 py-3 text-center font-black text-white">
              Open Account Verification
            </Link>
          </Card>
        </div>
      )}

      {tab === "list" && (
        <div className="mt-5 grid gap-4 xl:grid-cols-[300px_minmax(480px,1fr)_320px]">
          <Card className="min-h-[640px]">
            <h2 className="text-lg font-black">Caretaker List</h2>
            <div className="mt-4 space-y-3">
              {caretakers.map((c: any) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setSelectedCaretaker(c);
                    setSelectedAssigned(c.assigned[0] || null);
                  }}
                  className={"w-full rounded-2xl border p-3 text-left " + (selectedCaretaker.id === c.id ? "border-[#1f6b45] bg-emerald-50" : "border-[#ece6d8] bg-[#fffdf7]")}
                >
                  <b>{c.name}</b>
                  <p className="text-xs font-bold text-[#667267]">{c.resume}</p>
                  <Badge tone={c.assigned.some((a: any) => a.status === "Pending") ? "warn" : "good"}>{c.assigned.length} tasks</Badge>
                </button>
              ))}
              {caretakers.length === 0 && <p className="rounded-2xl bg-[#f6f3e8] p-4 text-sm font-bold text-[#667267]">No approved caretaker record found.</p>}
            </div>
          </Card>
          <Card className="min-h-[640px]">
            <p className="text-xs font-black uppercase text-[#667267]">Live Proof Review / Assignments</p>
            <h2 className="mt-1 text-3xl font-black">{selectedCaretaker.name}</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <button
                onClick={() =>
                  openViewer({
                    type: "selfie",
                    title: selectedCaretaker.name,
                    file: selectedCaretaker.selfieFile,
                    body: "Approved caretaker selfie on record.",
                    badge: selectedCaretaker.avatar,
                  })
                }
                className="rounded-xl bg-[#eee8d9] px-4 py-3 font-black"
              >
                View Selfie
              </button>
              <button
                onClick={() =>
                  openViewer({
                    type: "resume",
                    title: selectedCaretaker.name,
                    file: selectedCaretaker.resumeFile,
                    body: selectedCaretaker.resume,
                    badge: "CV",
                  })
                }
                className="rounded-xl bg-[#eee8d9] px-4 py-3 font-black"
              >
                View Resume
              </button>
            </div>
            <div className="mt-4 space-y-3">
              {selectedCaretaker.assigned.length ? (
                selectedCaretaker.assigned.map((task: any) => (
                  <button
                    key={task.id}
                    onClick={() => {
                      setSelectedAssigned(task);
                      openViewer({
                        type: "task",
                        title: task.task,
                        file: task.file,
                        body: `${task.customer} / ${task.rooster}. ${task.note}`,
                        badge: task.status === "Approved" ? "?" : "!",
                      });
                    }}
                    className="w-full rounded-2xl border border-[#ece6d8] bg-[#fffdf7] p-4 text-left text-sm font-bold"
                  >
                    <div className="flex justify-between gap-3">
                      <span>
                        {task.customer} / {task.rooster}
                      </span>
                      <Badge tone={task.status === "Pending" ? "warn" : "good"}>{task.status}</Badge>
                    </div>
                    <p className="mt-1 text-[#667267]">
                      {task.task} - {task.note}
                    </p>
                    <p className="mt-2 text-xs text-[#1f6b45]">File: {task.file}</p>
                  </button>
                ))
              ) : (
                <p className="rounded-2xl bg-[#f6f3e8] p-4 text-sm font-bold text-[#667267]">No active assigned task.</p>
              )}
            </div>
          </Card>
          <Card className="min-h-[640px]">
            <h2 className="text-lg font-black">Admin Request</h2>
            <p className="mt-1 text-xs font-bold text-[#667267]">Send admin task/note to caretaker. File is optional, but caretaker note is required before they submit back.</p>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Example: Recheck Thunder King, upload clearer photo, include feed grams/kg used..." className="mt-4 h-36 w-full resize-none rounded-2xl border border-[#ded8c9] bg-[#fffdf7] p-3 text-sm font-bold" />
            <label className="mt-3 block rounded-2xl border border-dashed border-[#d8cfbd] bg-[#f9f6ec] p-3 text-sm font-bold text-[#667267]">
              Optional file for caretaker
              <input onChange={(e) => setAdminRequestFile(e.target.files?.[0]?.name || "")} className="mt-2 block w-full" type="file" />
              {adminRequestFile && <span className="mt-2 block text-[#1f6b45]">Attached: {adminRequestFile}</span>}
            </label>
            <button className="mt-4 w-full rounded-2xl bg-[#1f6b45] px-4 py-4 font-black text-white">Send Admin Request</button>
            <p className="mt-3 text-xs font-bold leading-5 text-[#667267]">Goes to caretaker app /caretaker/tasks as admin request/backjob style task.</p>
          </Card>
        </div>
      )}

      {tab === "task-verification" && (
        <div className="mt-5">
          <AdminLiveTaskProofQueue />
        </div>
      )}

      {tab === "completed" && (
        <div className="mt-5 grid gap-4 xl:grid-cols-[300px_minmax(520px,1fr)]">
          <Card className="min-h-[640px]">
            <h2 className="text-lg font-black">Caretaker List</h2>
            <div className="mt-4 space-y-3">
              {caretakers.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setSelectedCaretaker(c);
                    const first = completed.find((row) => row.caretaker === c.name);
                    if (first) setSelectedCompleted(first);
                  }}
                  className={"w-full rounded-2xl border p-3 text-left " + (selectedCaretaker.id === c.id ? "border-[#1f6b45] bg-emerald-50" : "border-[#ece6d8] bg-[#fffdf7]")}
                >
                  <b>{c.name}</b>
                  <p className="text-xs font-bold text-[#667267]">Completed task records</p>
                </button>
              ))}
            </div>
          </Card>
          <Card className="min-h-[640px]">
            <p className="text-xs font-black uppercase text-[#667267]">Completed Task Review</p>
            <h2 className="mt-1 text-3xl font-black">{selectedCaretaker.name}</h2>
            <div className="mt-4 space-y-3">
              {completedForCaretaker.length ? (
                completedForCaretaker.map((row) => (
                  <button
                    key={row.id}
                    onClick={() => {
                      setSelectedCompleted(row);
                      openViewer({
                        type: "task",
                        title: row.request,
                        file: row.proofFile,
                        body: `${row.customer} / ${row.rooster}. ${row.proof}`,
                        badge: "?",
                      });
                    }}
                    className="w-full rounded-2xl border border-[#ece6d8] bg-[#fffdf7] p-4 text-left"
                  >
                    <b>{row.request}</b>
                    <p className="mt-1 text-sm font-bold text-[#667267]">
                      {row.customer} / {row.rooster} / {row.date}
                    </p>
                    <p className="mt-2 text-xs font-bold text-[#667267]">{row.proof}</p>
                  </button>
                ))
              ) : (
                <p className="rounded-2xl bg-[#f6f3e8] p-4 text-sm font-bold text-[#667267]">No completed task for this caretaker yet.</p>
              )}
            </div>
            {selectedCompleted && (
              <div className="mt-4 rounded-2xl bg-emerald-50 p-4 text-sm font-bold leading-6 text-emerald-900">
                Latest selected: {selectedCompleted.request} / {selectedCompleted.customer}. Customer page destination: Care Logs.
              </div>
            )}
          </Card>
        </div>
      )}

      {viewer && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4">
          <div className="max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase text-[#667267]">{viewer.type === "resume" ? "Resume File" : viewer.type === "selfie" ? "Selfie Photo" : "Task Proof / Documentation"}</p>
                <h2 className="mt-1 text-2xl font-black">{viewer.title}</h2>
                <p className="mt-1 text-sm font-bold text-[#667267]">{viewer.file}</p>
              </div>
              <button onClick={() => setViewer(null)} className="rounded-xl bg-[#eee8d9] px-4 py-2 text-sm font-black">
                Close
              </button>
            </div>
            <div className="mt-5 overflow-hidden rounded-2xl border border-[#ece6d8] bg-[#fffdf7]">
              <div className={"grid min-h-80 place-items-center p-6 text-center " + (viewer.type === "selfie" ? "bg-gradient-to-br from-[#d7ecff] to-[#fff7df]" : viewer.type === "resume" ? "bg-[#f9f6ec]" : "bg-gradient-to-br from-emerald-100 to-[#fff7df]")}>
                <div>
                  <div className="mx-auto grid h-40 w-40 place-items-center rounded-[2rem] bg-[#1f6b45] text-5xl font-black text-white shadow-lg">{viewer.badge}</div>
                  <h3 className="mt-4 text-xl font-black">{viewer.type === "resume" ? "Uploaded resume/document" : viewer.type === "selfie" ? "Uploaded selfie preview" : "Uploaded task proof"}</h3>
                  <p className="mt-2 max-w-xl text-sm font-bold leading-6 text-[#667267]">{viewer.body}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 divide-x divide-[#ece6d8] bg-white text-center text-xs font-black text-[#667267]">
                <div className="p-3">File: {viewer.file}</div>
                <div className="p-3">Linked to caretaker record</div>
                <div className="p-3">Evidence-ready</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}
function AdminFarmOperationsPage({ config }: { config: string[] }) {
  const [calendarKeys] = useState(() => {
    const now = new Date();
    return {
      today: now.toISOString().slice(0, 10),
      yesterday: new Date(now.getTime() - 86400000).toISOString().slice(0, 10),
    };
  });
  const todayKey = calendarKeys.today;
  const yesterdayKey = calendarKeys.yesterday;
  const [section, setSection] = useState("products");
  const [range, setRange] = useState<"total" | "monthly" | "daily">("total");
  const [date, setDate] = useState(todayKey);
  const [accountMode, setAccountMode] = useState<"clients" | "caretakers">("clients");
  const [selectedAccountId, setSelectedAccountId] = useState("cl-1");
  const [selectedRecordId, setSelectedRecordId] = useState("r1");
  const [selectedCaretakerName, setSelectedCaretakerName] = useState("Juan Dela Cruz");
  const [selectedCareKey, setSelectedCareKey] = useState("Juan Dela Cruz|Request Feed");
  const [viewer, setViewer] = useState<any>(null);

  const sections = [
    { id: "products", label: "Product Summary", hint: "All Farm Buy products" },
    {
      id: "accounts",
      label: "Account Logs",
      hint: "Client/caretaker evidence",
    },
    {
      id: "paid-care",
      label: "Paid Care Requests",
      hint: "Care service income",
    },
  ];
  const inRange = (rowDate: string) => range === "total" || (range === "daily" ? rowDate === date : rowDate.slice(0, 7) === date.slice(0, 7));
  const rangeLabel = range === "daily" ? `Daily: ${date}` : range === "monthly" ? `Monthly: ${date.slice(0, 7)}` : "All-time total";

  const productEvents = [
    { date: todayKey, productId: "p2", bought: 2 },
    { date: todayKey, productId: "p5", bought: 4 },
    { date: yesterdayKey, productId: "breed-chick-asil", bought: 1 },
    { date: yesterdayKey, productId: "p2", bought: 8 },
    { date: "2026-07-31", productId: "p4", bought: 4 },
    { date: "2026-07-31", productId: "p3", bought: 9 },
    { date: "2026-07-18", productId: "p2", bought: 5 },
  ];
  const productRows = products.map((product) => {
    const events = productEvents.filter((event) => event.productId === product.id && inRange(event.date));
    const bought = events.reduce((sum, event) => sum + event.bought, 0);
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
  const productTotal = productRows.reduce((sum, row) => sum + row.sales, 0);
  const productSoldCount = productRows.reduce((sum, row) => sum + row.bought, 0);

  const clients = [
    {
      id: "cl-1",
      name: "Aydana Buratino",
      avatar: "AB",
      records: [
        {
          id: "r1",
          date: todayKey,
          kind: "Payment",
          title: "Farm Buy Payment",
          amount: 610,
          status: "Approved",
          time: "Today 9:22 AM",
          meta: "Premium Rooster Feeds x2, Rooster Vitamins x4",
          receipt: "GCash receipt uploaded by customer",
          invoice: "Farm Buy Invoice #FB-10021",
          customerReceipt: "Uploaded GCash screenshot by customer",
          referenceNumber: "987678987",
          senderName: "Aydana Buratino",
          adminReceipt: "Not needed for incoming payment",
          withdrawalMethod: "-",
          assignedCaretaker: "-",
          caretakerSubmission: "-",
          taskDecision: "-",
        },
        {
          id: "r2",
          date: todayKey,
          kind: "Care Request",
          title: "Request Feed",
          amount: 120,
          status: "Assigned",
          time: "Today 10:35 AM",
          meta: "Rooster: Thunder King / service: Request Feed",
          receipt: "Customer care payment + caretaker proof",
          invoice: "Care Request Receipt #CR-22011",
          customerReceipt: "Uploaded Maya screenshot by customer",
          referenceNumber: "CR-55321",
          senderName: "Aydana Buratino",
          adminReceipt: "-",
          withdrawalMethod: "-",
          assignedCaretaker: "Juan Dela Cruz",
          caretakerSubmission: "QR verified, feed proof photo submitted, 0.25 kg used",
          taskDecision: "Approved by admin",
        },
        {
          id: "r3",
          date: yesterdayKey,
          kind: "Withdrawal",
          title: "Withdrawal Request",
          amount: 2500,
          status: "Sent",
          time: "Yesterday 4:10 PM",
          meta: "Requested 4:10 PM / admin sent 5:02 PM",
          receipt: "Admin payout receipt",
          invoice: "Withdrawal Receipt #WD-30012",
          customerReceipt: "Withdrawal request submitted by customer",
          referenceNumber: "WD-REQ-30012",
          senderName: "Aydana Buratino",
          adminReceipt: "Admin GCash payout proof ref ADM-77882",
          withdrawalMethod: "GCash / Aydana Buratino / 0917 XXX 0198",
          assignedCaretaker: "-",
          caretakerSubmission: "-",
          taskDecision: "Customer confirmation pending",
        },
      ],
    },
    {
      id: "cl-2",
      name: "Marco Reyes",
      avatar: "MR",
      records: [
        {
          id: "r4",
          date: yesterdayKey,
          kind: "Payment",
          title: "Farm Buy Payment",
          amount: 450,
          status: "Approved",
          time: "Yesterday 2:14 PM",
          meta: "Starter Chick (Asil) x1",
          receipt: "Customer receipt + invoice",
          invoice: "Farm Buy Invoice #FB-10022",
          customerReceipt: "Uploaded UnionBank screenshot by customer",
          referenceNumber: "UB-4419",
          senderName: "Marco Reyes",
          adminReceipt: "Not needed for incoming payment",
          withdrawalMethod: "-",
          assignedCaretaker: "-",
          caretakerSubmission: "-",
          taskDecision: "-",
        },
        {
          id: "r5",
          date: yesterdayKey,
          kind: "Care Request",
          title: "Photo Update",
          amount: 90,
          status: "Approved",
          time: "Yesterday 5:00 PM",
          meta: "Rooster: Red Ace / requested photo update",
          receipt: "Payment receipt + approved image set",
          invoice: "Care Request Receipt #CR-22012",
          customerReceipt: "Uploaded GCash screenshot by customer",
          referenceNumber: "CR-8871",
          senderName: "Marco Reyes",
          adminReceipt: "-",
          withdrawalMethod: "-",
          assignedCaretaker: "Mia Santos",
          caretakerSubmission: "3 photos submitted, QR verified",
          taskDecision: "Approved by admin and sent to customer care logs",
        },
      ],
    },
    {
      id: "cl-3",
      name: "Lina Cruz",
      avatar: "LC",
      records: [
        {
          id: "r6",
          date: "2026-07-31",
          kind: "Care Request",
          title: "Premium Feed",
          amount: 120,
          status: "Rejected",
          time: "Jul 31 8:12 PM",
          meta: "Rooster: Bantay / proof unclear",
          receipt: "Receipt + rejected task proof notes",
          invoice: "Care Request Receipt #CR-22013",
          customerReceipt: "Uploaded Maya screenshot by customer",
          referenceNumber: "CR-9921",
          senderName: "Lina Cruz",
          adminReceipt: "-",
          withdrawalMethod: "-",
          assignedCaretaker: "Mia Santos",
          caretakerSubmission: "Photo blurry, feed weight missing",
          taskDecision: "Rejected/backjob sent to caretaker",
        },
      ],
    },
  ];
  const caretakers = [
    {
      id: "ct-1",
      name: "Juan Dela Cruz",
      avatar: "JD",
      records: [
        {
          id: "c1",
          date: todayKey,
          customer: "Aydana Buratino",
          task: "Request Feed",
          amount: 120,
          status: "Approved",
          time: "Today 11:15 AM",
          meta: "Submitted feed proof, admin approved",
          receipt: "Customer payment + caretaker proof",
          customerReceipt: "Uploaded Maya screenshot by customer",
          referenceNumber: "CR-55321",
          senderName: "Aydana Buratino",
          adminReceipt: "-",
          invoice: "Care Request Receipt #CR-22011",
          assignedCaretaker: "Juan Dela Cruz",
          caretakerSubmission: "QR verified, feed proof photo submitted, 0.25 kg used",
          taskDecision: "Approved by admin",
        },
        {
          id: "c2",
          date: todayKey,
          customer: "Aydana Buratino",
          task: "Give Vitamins",
          amount: 100,
          status: "Pending",
          time: "Today 1:40 PM",
          meta: "Waiting for task proof",
          receipt: "Customer payment receipt",
          customerReceipt: "Uploaded GCash screenshot by customer",
          referenceNumber: "CR-8810",
          senderName: "Aydana Buratino",
          adminReceipt: "-",
          invoice: "Care Request Receipt #CR-22014",
          assignedCaretaker: "Juan Dela Cruz",
          caretakerSubmission: "Not submitted yet",
          taskDecision: "Pending review",
        },
        {
          id: "c5",
          date: yesterdayKey,
          customer: "Marco Reyes",
          task: "Request Feed",
          amount: 120,
          status: "Approved",
          time: "Yesterday 8:30 AM",
          meta: "Feed proof reviewed",
          receipt: "Customer payment + caretaker proof",
          customerReceipt: "Uploaded GCash screenshot by customer",
          referenceNumber: "CR-4512",
          senderName: "Marco Reyes",
          adminReceipt: "-",
          invoice: "Care Request Receipt #CR-22009",
          assignedCaretaker: "Juan Dela Cruz",
          caretakerSubmission: "0.30 kg feed used, 1 photo attached",
          taskDecision: "Approved by admin",
        },
      ],
    },
    {
      id: "ct-2",
      name: "Mia Santos",
      avatar: "MS",
      records: [
        {
          id: "c3",
          date: yesterdayKey,
          customer: "Marco Reyes",
          task: "Photo Update",
          amount: 90,
          status: "Approved",
          time: "Yesterday 5:15 PM",
          meta: "Submitted image set, admin approved",
          receipt: "Payment + approved task proof",
          customerReceipt: "Uploaded GCash screenshot by customer",
          referenceNumber: "CR-8871",
          senderName: "Marco Reyes",
          adminReceipt: "-",
          invoice: "Care Request Receipt #CR-22012",
          assignedCaretaker: "Mia Santos",
          caretakerSubmission: "3 photos submitted, QR verified",
          taskDecision: "Approved by admin",
        },
        {
          id: "c4",
          date: "2026-07-31",
          customer: "Lina Cruz",
          task: "Premium Feed",
          amount: 120,
          status: "Rejected",
          time: "Jul 31 8:12 PM",
          meta: "Backjob sent to caretaker",
          receipt: "Payment + rejected task proof",
          customerReceipt: "Uploaded Maya screenshot by customer",
          referenceNumber: "CR-9921",
          senderName: "Lina Cruz",
          adminReceipt: "-",
          invoice: "Care Request Receipt #CR-22013",
          assignedCaretaker: "Mia Santos",
          caretakerSubmission: "Photo blurry, feed weight missing",
          taskDecision: "Rejected/backjob sent to caretaker",
        },
      ],
    },
  ];
  const careEvents = [
    {
      date: todayKey,
      caretaker: "Juan Dela Cruz",
      service: "Request Feed",
      price: 120,
      customer: "Aydana Buratino",
      status: "Approved",
    },
    {
      date: todayKey,
      caretaker: "Juan Dela Cruz",
      service: "Give Vitamins",
      price: 100,
      customer: "Aydana Buratino",
      status: "Pending proof",
    },
    {
      date: todayKey,
      caretaker: "Juan Dela Cruz",
      service: "Request Feed",
      price: 120,
      customer: "Lina Cruz",
      status: "Approved",
    },
    {
      date: yesterdayKey,
      caretaker: "Juan Dela Cruz",
      service: "Request Feed",
      price: 120,
      customer: "Marco Reyes",
      status: "Approved",
    },
    {
      date: yesterdayKey,
      caretaker: "Mia Santos",
      service: "Photo Update",
      price: 90,
      customer: "Marco Reyes",
      status: "Approved",
    },
    {
      date: "2026-07-31",
      caretaker: "Mia Santos",
      service: "Premium Feed",
      price: 120,
      customer: "Lina Cruz",
      status: "Backjob/review",
    },
  ];
  const rawAccounts = accountMode === "clients" ? clients : caretakers;
  const accountList = rawAccounts
    .map((account) => ({
      ...account,
      records: account.records.filter((row) => inRange(row.date)),
    }))
    .filter((account) => account.records.length > 0);
  const selectedAccount = accountList.find((account) => account.id === selectedAccountId) || accountList[0];
  const selectedRecord: any = selectedAccount?.records.find((row: any) => row.id === selectedRecordId) || selectedAccount?.records[0];
  const filteredCareEvents = careEvents.filter((row) => inRange(row.date));
  const careRows = Object.values(
    filteredCareEvents
      .filter((row) => row.caretaker === selectedCaretakerName)
      .reduce<Record<string, any>>((map, row) => {
        const key = `${row.caretaker}|${row.service}`;
        const current = map[key] || {
          key,
          caretaker: row.caretaker,
          service: row.service,
          price: row.price,
          count: 0,
          total: 0,
          customers: [],
          status: row.status,
        };
        current.count += 1;
        current.total += row.price;
        current.customers = Array.from(new Set([...current.customers, row.customer]));
        current.status = row.status;
        map[key] = current;
        return map;
      }, {}),
  );
  const selectedCare = careRows.find((row) => row.key === selectedCareKey) || careRows[0];
  const careTotal = filteredCareEvents.filter((row) => row.caretaker === selectedCaretakerName).reduce((sum, row) => sum + row.price, 0);
  const caretakerTotals = caretakers.map((c) => ({
    ...c,
    total: filteredCareEvents.filter((row) => row.caretaker === c.name).reduce((sum, row) => sum + row.price, 0),
    count: filteredCareEvents.filter((row) => row.caretaker === c.name).length,
  }));
  useEffect(() => {
    const list = (accountMode === "clients" ? clients : caretakers)
      .map((account) => ({
        ...account,
        records: account.records.filter((row) => inRange(row.date)),
      }))
      .filter((account) => account.records.length > 0);
    setSelectedAccountId(list[0]?.id || "");
    setSelectedRecordId(list[0]?.records[0]?.id || "");
  }, [accountMode, range, date]);
  useEffect(() => {
    const first = Object.values(
      careEvents
        .filter((row) => inRange(row.date) && row.caretaker === selectedCaretakerName)
        .reduce<Record<string, any>>((map, row) => {
          const key = `${row.caretaker}|${row.service}`;
          map[key] = map[key] || { key };
          return map;
        }, {}),
    )[0] as any;
    setSelectedCareKey(first?.key || "");
  }, [selectedCaretakerName, range, date]);
  const openEvidence = (record: any, type: string) =>
    setViewer({
      record,
      type,
      title: type === "invoice" ? record.invoice : type === "admin" ? "Admin payout receipt" : type === "task" ? "Caretaker submission" : "Customer receipt and reference",
    });

  return (
    <Shell role="admin" title={config[0]}>
      <PageTitle title="Farm Operations" text="Product sales, account activity logs, receipts, invoices, caretaker proof, and paid care request income." icon="rooster" />
      <div className="mt-4 rounded-3xl border border-[#e3ded0] bg-white/95 p-4 shadow-sm">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="grid gap-2 sm:grid-cols-3">
            {sections.map((item) => (
              <button key={item.id} onClick={() => setSection(item.id)} className={"rounded-2xl border px-4 py-3 text-left transition " + (section === item.id ? "border-[#1f6b45] bg-[#e9fff3] text-[#123d2a]" : "border-[#e3ded0] bg-[#fffdf7]")}>
                <b>{item.label}</b>
                <p className="text-xs font-bold text-[#667267]">{item.hint}</p>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setRange("total")} className={"rounded-xl px-4 py-3 text-sm font-black " + (range === "total" ? "bg-[#1f6b45] text-white" : "bg-[#f6f3e8]")}>
              Total
            </button>
            <button onClick={() => setRange("monthly")} className={"rounded-xl px-4 py-3 text-sm font-black " + (range === "monthly" ? "bg-[#1f6b45] text-white" : "bg-[#f6f3e8]")}>
              Monthly
            </button>
            <button onClick={() => setRange("daily")} className={"rounded-xl px-4 py-3 text-sm font-black " + (range === "daily" ? "bg-[#1f6b45] text-white" : "bg-[#f6f3e8]")}>
              Daily
            </button>
            <input
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setRange("daily");
              }}
              type="date"
              className="rounded-xl border border-[#ded8c9] bg-white px-4 py-3 text-sm font-black"
            />
          </div>
        </div>
        <p className="mt-3 rounded-2xl bg-[#f6f3e8] p-3 text-sm font-bold text-[#667267]">
          Current filter: <b className="text-[#17251d]">{rangeLabel}</b>. Product list stays complete; bought/sales numbers follow the filter.
        </p>
      </div>
      {section === "products" && (
        <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_300px]">
          <Card className="min-h-[640px]">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-black">Product Sales Summary</h2>
              <Badge tone="good">{productRows.length} Farm Buy products</Badge>
            </div>
            <div className="mt-4 max-h-[560px] overflow-y-auto pr-2">
              <div className="grid gap-3">
                {productRows.map((row) => (
                  <div key={row.name} className="grid gap-3 rounded-2xl border border-[#ece6d8] bg-[#fffdf7] p-4 md:grid-cols-[54px_1.3fr_.8fr_.8fr_.9fr] md:items-center">
                    <img src={row.image} alt="" className="h-12 w-12 rounded-xl object-cover" />
                    <div>
                      <p className="text-xs font-black uppercase text-[#667267]">Product</p>
                      <b className="block text-lg">{row.name}</b>
                      <p className="text-xs font-bold text-[#667267]">{row.category}</p>
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase text-[#667267]">Amount/Product</p>
                      <b>{peso(row.amount)}</b>
                      <p className="text-xs font-bold text-[#667267]">{row.unit}</p>
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase text-[#667267]">Bought/Sold</p>
                      <b>{row.bought}</b>
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase text-[#667267]">Total Sales</p>
                      <b className="text-[#1f6b45]">{peso(row.sales)}</b>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
          <Card>
            <p className="text-xs font-black uppercase text-[#667267]">Product Total</p>
            <h2 className="mt-2 text-4xl font-black text-[#1f6b45]">{peso(productTotal)}</h2>
            <p className="mt-2 text-sm font-bold text-[#667267]">
              {productSoldCount} sold for {rangeLabel.toLowerCase()}.
            </p>
          </Card>
        </div>
      )}
      {section === "accounts" && (
        <div className="mt-5 grid gap-4 xl:grid-cols-[300px_minmax(520px,1fr)_380px]">
          <Card className="min-h-[640px]">
            <h2 className="text-lg font-black">Accounts Logs</h2>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button onClick={() => setAccountMode("clients")} className={"rounded-xl px-3 py-3 text-sm font-black " + (accountMode === "clients" ? "bg-[#1f6b45] text-white" : "bg-[#f6f3e8]")}>
                Clients
              </button>
              <button onClick={() => setAccountMode("caretakers")} className={"rounded-xl px-3 py-3 text-sm font-black " + (accountMode === "caretakers" ? "bg-[#1f6b45] text-white" : "bg-[#f6f3e8]")}>
                Caretakers
              </button>
            </div>
            <div className="mt-4 max-h-[520px] space-y-3 overflow-y-auto pr-2">
              {accountList.length ? (
                accountList.map((row) => (
                  <button
                    key={row.id}
                    onClick={() => {
                      setSelectedAccountId(row.id);
                      setSelectedRecordId(row.records[0]?.id || "");
                    }}
                    className={"flex w-full items-center gap-3 rounded-2xl border p-3 text-left " + (selectedAccount?.id === row.id ? "border-[#1f6b45] bg-emerald-50" : "border-[#ece6d8] bg-[#fffdf7]")}
                  >
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#1f6b45] font-black text-white">{row.avatar}</span>
                    <span className="min-w-0 flex-1">
                      <b className="block truncate">{row.name}</b>
                      <span className="text-xs font-bold text-[#667267]">{row.records.length} filtered records</span>
                    </span>
                  </button>
                ))
              ) : (
                <p className="rounded-2xl bg-[#f6f3e8] p-4 text-sm font-bold text-[#667267]">No accounts with records for this filter.</p>
              )}
            </div>
          </Card>
          <Card className="min-h-[640px]">
            <p className="text-xs font-black uppercase text-[#667267]">{accountMode === "clients" ? "Client activity" : "Caretaker assignments"}</p>
            <h2 className="mt-1 text-3xl font-black">{selectedAccount?.name || "No selected account"}</h2>
            <div className="mt-4 max-h-[500px] space-y-3 overflow-y-auto pr-2">
              {selectedAccount?.records.map((row: any) => (
                <button key={row.id} onClick={() => setSelectedRecordId(row.id)} className={"w-full rounded-2xl border p-4 text-left " + (selectedRecord?.id === row.id ? "border-[#1f6b45] bg-emerald-50" : "border-[#ece6d8] bg-[#fffdf7]")}>
                  <div className="flex justify-between gap-3">
                    <b>{row.title || row.task}</b>
                    <Badge tone={row.status === "Approved" || row.status === "Sent" ? "good" : row.status === "Rejected" ? "bad" : "warn"}>{row.status}</Badge>
                  </div>
                  <p className="mt-1 text-sm font-bold text-[#667267]">
                    {accountMode === "clients" ? row.kind : row.customer} / {row.time}
                  </p>
                  <p className="mt-2 text-sm font-bold text-[#1f6b45]">{peso(row.amount)}</p>
                </button>
              )) || <p className="rounded-2xl bg-[#f6f3e8] p-4 text-sm font-bold text-[#667267]">Select an account with records.</p>}
            </div>
          </Card>
          <Card className="min-h-[640px]">
            <p className="text-xs font-black uppercase text-[#667267]">Receipt / Invoice / Evidence</p>
            <h2 className="mt-1 text-2xl font-black">{selectedRecord?.title || selectedRecord?.task || "No record selected"}</h2>
            <div className="mt-4 grid gap-3">
              <Info label="Amount" value={peso(selectedRecord?.amount || 0)} />
              <Info label="Date / Time" value={selectedRecord?.time || "-"} />
              <Info label="Status" value={selectedRecord?.status || "-"} />
              <Info label="Details" value={selectedRecord?.meta || "-"} />
              <Info label="Reference Number" value={selectedRecord?.referenceNumber || "-"} />
              <Info label="Sender / Account Name" value={selectedRecord?.senderName || "-"} />
              <Info label="Withdrawal Method" value={selectedRecord?.withdrawalMethod || "-"} />
              <Info label="Assigned Caretaker" value={selectedRecord?.assignedCaretaker || "-"} />
              <Info label="Caretaker Submission" value={selectedRecord?.caretakerSubmission || "-"} />
              <Info label="Admin Decision" value={selectedRecord?.taskDecision || "-"} />
            </div>
            <div className="mt-4 grid gap-2">
              <button onClick={() => openEvidence(selectedRecord, "customer")} className="rounded-xl bg-[#1f6b45] px-4 py-3 font-black text-white">
                View Customer Receipt + Ref
              </button>
              <button onClick={() => openEvidence(selectedRecord, "invoice")} className="rounded-xl bg-[#eee8d9] px-4 py-3 font-black">
                View System Invoice
              </button>
              {selectedRecord?.kind === "Withdrawal" && (
                <button onClick={() => openEvidence(selectedRecord, "admin")} className="rounded-xl bg-[#dff0ff] px-4 py-3 font-black">
                  View Admin Payout Receipt
                </button>
              )}
              {(selectedRecord?.kind === "Care Request" || selectedRecord?.task) && (
                <button onClick={() => openEvidence(selectedRecord, "task")} className="rounded-xl bg-[#fff1b7] px-4 py-3 font-black">
                  View Caretaker Submission
                </button>
              )}
            </div>
          </Card>
        </div>
      )}
      {section === "paid-care" && (
        <div className="mt-5 grid gap-4 xl:grid-cols-[300px_minmax(560px,1fr)_320px]">
          <Card className="min-h-[640px]">
            <h2 className="text-lg font-black">Caretaker List</h2>
            <div className="mt-4 space-y-3">
              {caretakerTotals.map((c) => (
                <button key={c.id} onClick={() => setSelectedCaretakerName(c.name)} className={"w-full rounded-2xl border p-3 text-left " + (selectedCaretakerName === c.name ? "border-[#1f6b45] bg-emerald-50" : "border-[#ece6d8] bg-[#fffdf7] hover:border-[#1f6b45]")}>
                  <b>{c.name}</b>
                  <p className="text-xs font-bold text-[#667267]">{c.count} filtered requests</p>
                </button>
              ))}
            </div>
          </Card>
          <Card className="min-h-[640px]">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-black">Paid Care Requests</h2>
              <Badge tone="good">{selectedCaretakerName}</Badge>
            </div>
            <div className="mt-4 max-h-[560px] overflow-y-auto pr-2">
              <div className="grid gap-3">
                {careRows.length ? (
                  careRows.map((row) => (
                    <button key={row.key} onClick={() => setSelectedCareKey(row.key)} className={"grid gap-3 rounded-2xl border p-4 text-left md:grid-cols-[1fr_.7fr_.8fr] md:items-center " + (selectedCare?.key === row.key ? "border-[#1f6b45] bg-emerald-50" : "border-[#ece6d8] bg-[#fffdf7]")}>
                      <div>
                        <p className="text-xs font-black uppercase text-[#667267]">Care Request</p>
                        <b>{row.service}</b>
                        <p className="text-xs font-bold text-[#667267]">{row.customers.join(", ")}</p>
                      </div>
                      <div>
                        <p className="text-xs font-black uppercase text-[#667267]">Count</p>
                        <b>{row.count} requests</b>
                        <p className="text-xs font-bold text-[#667267]">{peso(row.price)} each</p>
                      </div>
                      <div>
                        <p className="text-xs font-black uppercase text-[#667267]">Status</p>
                        <b>{row.status}</b>
                      </div>
                    </button>
                  ))
                ) : (
                  <p className="rounded-2xl bg-[#f6f3e8] p-4 text-sm font-bold text-[#667267]">No paid care requests for {selectedCaretakerName} in this filter.</p>
                )}
              </div>
            </div>
          </Card>
          <Card className="min-h-[640px]">
            <p className="text-xs font-black uppercase text-[#667267]">Caretaker Total</p>
            <h2 className="mt-2 text-3xl font-black text-[#1f6b45]">{selectedCaretakerName}</h2>
            <div className="mt-4 rounded-2xl bg-emerald-50 p-4">
              <p className="text-xs font-black uppercase text-[#667267]">Total Amount</p>
              <h3 className="mt-1 text-4xl font-black text-[#1f6b45]">{peso(careTotal)}</h3>
              <p className="mt-1 text-xs font-bold text-[#667267]">{rangeLabel}</p>
            </div>
            <div className="mt-4 grid gap-3">
              <Info label="Filtered Requests" value={`${caretakerTotals.find((c) => c.name === selectedCaretakerName)?.count || 0}`} />
              <Info label="Selected Service" value={selectedCare?.service || "-"} />
              <Info label="Service Count" value={selectedCare ? `${selectedCare.count}` : "-"} />
              <Info label="Service Total" value={selectedCare ? peso(selectedCare.total) : "-"} />
              <Info label="Customers" value={selectedCare?.customers?.join(", ") || "-"} />
            </div>
            <div className="mt-4 rounded-2xl bg-[#f6f3e8] p-4 text-sm font-bold leading-6 text-[#667267]">Per-caretaker total is here only. The middle box stays focused on the request list.</div>
          </Card>
        </div>
      )}
      {viewer && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4">
          <div className="w-full max-w-3xl rounded-3xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase text-[#667267]">{viewer.type === "customer" ? "Customer uploaded receipt" : viewer.type === "invoice" ? "System-made invoice" : viewer.type === "task" ? "Caretaker uploaded submission" : "Admin payout receipt"}</p>
                <h2 className="mt-1 text-2xl font-black">{viewer.title}</h2>
                <p className="mt-1 text-sm font-bold text-[#667267]">{viewer.record?.title || viewer.record?.task}</p>
              </div>
              <button onClick={() => setViewer(null)} className="rounded-xl bg-[#eee8d9] px-4 py-2 text-sm font-black">
                Close
              </button>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-[1.3fr_.9fr]">
              <div className="rounded-2xl border border-[#ece6d8] bg-[#111] p-6 text-center text-white">
                <p className="text-xs font-black uppercase text-white/60">{viewer.type === "invoice" ? "Generated invoice preview" : viewer.type === "task" ? "Caretaker upload/documentation preview" : viewer.type === "admin" ? "Admin payout receipt preview" : "Customer receipt screenshot preview"}</p>
                <div className="mt-6 grid min-h-56 place-items-center rounded-2xl border border-white/20">
                  <div>
                    <h3 className="text-2xl font-black">{viewer.type === "invoice" ? viewer.record?.invoice : viewer.type === "admin" ? viewer.record?.adminReceipt : viewer.type === "task" ? viewer.record?.caretakerSubmission : viewer.record?.customerReceipt}</h3>
                    <p className="mt-2 text-sm font-bold text-white/70">Evidence preview placeholder until real file URL is wired.</p>
                  </div>
                </div>
              </div>
              <div className="grid gap-3">
                <Info label="Customer Receipt Upload" value={viewer.record?.customerReceipt || "-"} />
                <Info label="Reference Number" value={viewer.record?.referenceNumber || "-"} />
                <Info label="Sender / Account Name" value={viewer.record?.senderName || "-"} />
                <Info label="System Invoice" value={viewer.record?.invoice || "-"} />
                <Info label="Admin Receipt" value={viewer.record?.adminReceipt || "-"} />
                <Info label="Withdrawal Method" value={viewer.record?.withdrawalMethod || "-"} />
                <Info label="Assigned Caretaker" value={viewer.record?.assignedCaretaker || "-"} />
                <Info label="Caretaker Submission" value={viewer.record?.caretakerSubmission || "-"} />
                <Info label="Decision" value={viewer.record?.taskDecision || "-"} />
              </div>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}
function AdminIssueManagementPage({ config }: { config: string[] }) {
  const [mode, setMode] = useState<"customer" | "caretaker" | "completed">("customer");
  const [rows, setRows] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [resolution, setResolution] = useState<"farm_corrected_payout" | "customer_fault_explained" | null>(null);
  const [resolutionNote, setResolutionNote] = useState("");
  const [reference, setReference] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("Loading withdrawal investigations...");
  const visibleRows = rows.filter((row) => (mode === "completed" ? row.status === "resolved" : mode === "customer" ? row.status !== "resolved" : false));
  const selected = visibleRows.find((row) => row.id === selectedId) || visibleRows[0] || null;
  const request = selected?.withdrawal_requests || null;
  const profile = request ? (Array.isArray(request.profiles) ? request.profiles[0] : request.profiles) : null;

  async function loadIssues() {
    try {
      const data = await getAdminWithdrawalDisputes();
      setRows(data);
      setSelectedId((current) => (data.some((row: any) => row.id === current) ? current : data[0]?.id || ""));
      setMessage(data.length ? "Select a report and manually compare the customer request with the existing Admin payout evidence." : "No withdrawal dispute is waiting for investigation.");
    } catch (error) {
      setRows([]);
      setMessage(`Issue queue could not load: ${readableAppError(error) || "Check migration 073 and Admin login."}`);
    }
  }

  useEffect(() => {
    void loadIssues();
  }, []);

  async function openReceipt(path?: string | null) {
    if (!path) return setMessage("No payout receipt was recorded for this withdrawal.");
    try {
      const url = await createPrivateEvidenceUrl("withdrawal-proofs", path);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      setMessage(`Payout receipt could not open: ${readableAppError(error) || "Check the private file path."}`);
    }
  }

  async function submitResolution() {
    if (!selected || !resolution || saving) return;
    if (resolutionNote.trim().length < 10) return setMessage("Write a clear manual investigation note with at least 10 characters.");
    if (resolution === "farm_corrected_payout" && (!reference.trim() || !receiptFile)) return setMessage("Corrected payout needs its new external reference and receipt screenshot.");
    try {
      setSaving(true);
      let storedPath: string | null = null;
      if (resolution === "farm_corrected_payout" && receiptFile) {
        storedPath = await uploadPrivateEvidenceFile({
          bucket: "withdrawal-proofs",
          folder: `${selected.withdrawal_request_id}/dispute-${selected.id}`,
          kind: "corrected-payout",
          file: receiptFile,
          maxBytes: 10 * 1024 * 1024,
          allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
        });
      }
      await resolveWithdrawalDispute({
        disputeId: selected.id,
        resolutionType: resolution,
        resolutionNote: resolutionNote.trim(),
        correctedReference: resolution === "farm_corrected_payout" ? reference.trim() : null,
        correctedReceiptUrl: storedPath,
        correctedReceiptFileName: receiptFile?.name || null,
      });
      setMessage(resolution === "farm_corrected_payout" ? "Corrected external payout evidence saved. Customer must review and confirm the new payout." : "Existing request, reference, and payout receipt were preserved with the Admin explanation. Case resolved without a second payout.");
      setResolution(null);
      setResolutionNote("");
      setReference("");
      setReceiptFile(null);
      await loadIssues();
    } catch (error) {
      setMessage(`Resolution failed: ${readableAppError(error) || "Check the case state, evidence, and migration 073."}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Shell role="admin" title={config[0]}>
      <PageTitle title="Issue Management" text="Manually investigate reported withdrawal payouts using the original customer request, Admin reference, and existing receipt." icon="alert" />
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <button onClick={() => setMode("customer")} className={"rounded-2xl border p-4 text-left " + (mode === "customer" ? "border-[#1f6b45] bg-emerald-50" : "border-[#e3ded0] bg-white/95")}>
          <b>Customer Reports</b>
          <p className="text-xs font-bold text-[#667267]">Customer issues from support, payment, care, withdrawal, or inbox.</p>
        </button>
        <button onClick={() => setMode("caretaker")} className={"rounded-2xl border p-4 text-left " + (mode === "caretaker" ? "border-[#1f6b45] bg-emerald-50" : "border-[#e3ded0] bg-white/95")}>
          <b>Caretaker Reports</b>
          <p className="text-xs font-bold text-[#667267]">QR, camera, upload, task, proof, or backjob issues.</p>
        </button>
        <button onClick={() => setMode("completed")} className={"rounded-2xl border p-4 text-left " + (mode === "completed" ? "border-[#1f6b45] bg-emerald-50" : "border-[#e3ded0] bg-white/95")}>
          <b>Completed Issues</b>
          <p className="text-xs font-bold text-[#667267]">Resolved reports with final note, evidence, and inbox update.</p>
        </button>
      </div>
      {mode === "caretaker" ? (
        <Card className="mt-5 grid min-h-[420px] place-items-center text-center"><div><h2 className="text-2xl font-black">No caretaker dispute workflow</h2><p className="mt-2 text-sm font-bold text-[#667267]">This scoped investigation queue currently handles customer withdrawal payout reports only.</p></div></Card>
      ) : (
        <div className="mt-5 grid gap-4 xl:grid-cols-[300px_minmax(500px,1fr)_360px]">
          <Card className="min-h-[620px]">
            <div className="flex items-center justify-between"><h2 className="text-lg font-black">{mode === "completed" ? "Resolved Cases" : "Investigation Queue"}</h2><Badge tone={visibleRows.length ? "warn" : "good"}>{visibleRows.length}</Badge></div>
            <div className="mt-4 space-y-3">
              {visibleRows.map((row) => {
                const req = row.withdrawal_requests;
                const p = req ? (Array.isArray(req.profiles) ? req.profiles[0] : req.profiles) : null;
                return <button key={row.id} onClick={() => { setSelectedId(row.id); setResolution(null); }} className={"w-full rounded-2xl border p-3 text-left " + (selected?.id === row.id ? "border-[#1f6b45] bg-emerald-50" : "border-[#ece6d8] bg-[#fffdf7]")}><b className="block truncate">{p?.display_name || p?.full_name || p?.email || row.original_payout_holder}</b><p className="mt-1 text-xs font-bold text-[#667267]">{peso(Number(row.original_amount || 0))} / {row.original_payout_method}</p><p className="mt-2 text-xs font-black text-amber-700">{String(row.status).replaceAll("_", " ")}</p></button>;
              })}
              {!visibleRows.length && <p className="rounded-2xl bg-[#f6f3e8] p-4 text-sm font-bold text-[#667267]">No case in this queue.</p>}
            </div>
          </Card>
          <Card className="min-h-[620px]">
            {selected ? <>
              <p className="text-xs font-black uppercase text-[#667267]">Manual Withdrawal Investigation</p>
              <h2 className="mt-1 text-2xl font-black">{profile?.display_name || profile?.full_name || profile?.email || selected.original_payout_holder}</h2>
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4"><p className="text-xs font-black uppercase text-amber-800">Customer Report</p><p className="mt-2 text-sm font-bold leading-6">{selected.customer_report}</p></div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <Info label="Customer Payout Method" value={selected.original_payout_method} />
                <Info label="Withdrawal Amount" value={peso(Number(selected.original_amount || 0))} />
                <Info label="Customer Account Holder" value={selected.original_payout_holder} />
                <Info label="Customer Payout Account" value={selected.original_payout_account} />
                <Info label="Admin Payout Reference" value={selected.original_admin_reference || "Not recorded"} />
                <Info label="Admin Payout Receipt" value={selected.original_admin_receipt_file_name || "Not recorded"} />
              </div>
              <button onClick={() => void openReceipt(selected.original_admin_receipt_url)} className="mt-4 w-full rounded-xl bg-[#0f6fb8] px-4 py-3 font-black text-white">Open Existing Admin Payout Receipt</button>
              {selected.resolution_note && <div className="mt-4 rounded-2xl bg-emerald-50 p-4"><p className="text-xs font-black uppercase text-emerald-800">Final Investigation Note</p><p className="mt-2 text-sm font-bold">{selected.resolution_note}</p></div>}
            </> : <div className="grid min-h-[520px] place-items-center text-center"><div><h2 className="text-2xl font-black">No report selected</h2><p className="mt-2 text-sm font-bold text-[#667267]">Customer payout disputes will appear here automatically.</p></div></div>}
          </Card>
          <Card className="min-h-[620px]">
            <h2 className="text-lg font-black">Manual Resolution</h2>
            <p className="mt-2 text-xs font-bold leading-5 text-[#667267]">Check the customer payout method and amount against the existing Admin reference and receipt. FarmConnect does not verify external e-wallet or bank transfers automatically.</p>
            {selected?.status === "under_investigation" ? <>
              <button onClick={() => setResolution("farm_corrected_payout")} className={"mt-5 w-full rounded-2xl px-4 py-4 font-black text-white " + (resolution === "farm_corrected_payout" ? "bg-red-700 ring-4 ring-red-200" : "bg-red-600")}>Farm Fault — Correct Payout</button>
              <button onClick={() => setResolution("customer_fault_explained")} className={"mt-3 w-full rounded-2xl px-4 py-4 font-black text-white " + (resolution === "customer_fault_explained" ? "bg-[#145a38] ring-4 ring-emerald-200" : "bg-[#1f6b45]")}>Customer Detail Fault — Send Explanation</button>
              {resolution === "farm_corrected_payout" && <div className="mt-4 grid gap-3"><input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="New corrected payout reference" className="rounded-xl border border-[#ded8c9] p-3 font-black" /><label className="rounded-xl border-2 border-dashed border-[#d8cfbd] p-3 text-sm font-black">New corrected payout receipt<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(event) => setReceiptFile(event.target.files?.[0] || null)} className="mt-2 block w-full text-xs" /></label></div>}
              <textarea value={resolutionNote} onChange={(event) => setResolutionNote(event.target.value)} placeholder="Write the manual investigation finding and why this resolution is correct..." className="mt-4 h-32 w-full resize-none rounded-2xl border border-[#ded8c9] p-3 text-sm font-bold" />
              <button disabled={!resolution || saving} onClick={() => void submitResolution()} className="mt-3 w-full rounded-2xl bg-[#111827] px-4 py-4 font-black text-white disabled:bg-[#b9b3a4]">{saving ? "Saving Resolution..." : "Confirm Manual Resolution"}</button>
            </> : <p className="mt-5 rounded-2xl bg-[#f6f3e8] p-4 text-sm font-bold text-[#667267]">This case is no longer open for a new resolution.</p>}
            <p className="mt-4 rounded-xl bg-[#f4efe4] p-3 text-xs font-bold leading-5 text-[#667267]">{message}</p>
          </Card>
        </div>
      )}
    </Shell>
  );
}
function AdminAccountVerificationPage({ config }: { config: string[] }) {
  const customerQueue = [
    {
      id: "cq-1",
      name: "Aydana Buratino",
      avatar: "AB",
      type: "Customer",
      email: "aydana@example.com",
      phone: "+63 917 555 0198",
      submitted: "Today 8:44 AM",
      details: "Customer signup, profile photo, birthdate, contact details, KYC pending.",
      files: "Selfie photo, valid ID front/back, payout name to match",
      risk: "Medium",
    },
    {
      id: "cq-2",
      name: "Marco Reyes",
      avatar: "MR",
      type: "Customer",
      email: "marco@example.com",
      phone: "+63 918 222 4419",
      submitted: "Yesterday 3:12 PM",
      details: "New customer profile, wallet PIN set, no payout method yet.",
      files: "Selfie photo, valid ID front",
      risk: "Low",
    },
  ];
  const caretakerQueue = [
    {
      id: "tq-1",
      name: "Juan Dela Cruz",
      avatar: "JD",
      type: "Caretaker",
      email: "juan@example.com",
      phone: "+63 915 333 1122",
      submitted: "Today 9:10 AM",
      details: "Caretaker application submitted. Needs resume and selfie review before activation.",
      files: "Selfie photo, resume file, payout method GCash",
      risk: "Medium",
    },
    {
      id: "tq-2",
      name: "Mia Santos",
      avatar: "MS",
      type: "Caretaker",
      email: "mia@example.com",
      phone: "+63 916 444 0099",
      submitted: "Yesterday 6:05 PM",
      details: "Caretaker application with farm role and emergency contact.",
      files: "Selfie photo, resume file, payment method Maya",
      risk: "Low",
    },
  ];
  const verifiedCustomers = [
    {
      id: "vc-1",
      name: "Lina Cruz",
      avatar: "LC",
      email: "lina@example.com",
      verified: "Jul 31 10:45 AM",
      status: "Customer verified",
    },
    {
      id: "vc-2",
      name: "Pedro Lim",
      avatar: "PL",
      email: "pedro@example.com",
      verified: "Jul 30 2:22 PM",
      status: "Customer verified",
    },
  ];
  const verifiedCaretakers = [
    {
      id: "vt-1",
      name: "Ramon Flores",
      avatar: "RF",
      email: "ramon@example.com",
      verified: "Jul 29 9:35 AM",
      status: "Caretaker active",
    },
    {
      id: "vt-2",
      name: "Nico Ramos",
      avatar: "NR",
      email: "nico@example.com",
      verified: "Jul 28 4:10 PM",
      status: "Caretaker active",
    },
  ];
  const [tab, setTab] = useState<"queue" | "verified">("queue");
  const [mode, setMode] = useState<"customer" | "caretaker">("customer");
  const [selectedId, setSelectedId] = useState("cq-1");
  const [note, setNote] = useState("Write clear approval/rejection note for the account record.");
  const [viewer, setViewer] = useState<null | {
    title: string;
    kind: string;
    body: string;
  }>(null);
  const [localStatus, setLocalStatus] = useState<Record<string, string>>({});
  const queue = mode === "customer" ? customerQueue : caretakerQueue;
  const verified = mode === "customer" ? verifiedCustomers : verifiedCaretakers;
  const selected = queue.find((row) => row.id === selectedId) || queue[0];
  const selectedStatus = localStatus[selected?.id || ""] || "Pending Review";
  const openAccountFile = (kind: string) =>
    setViewer({
      title: `${selected.name} / ${kind}`,
      kind,
      body: kind === "Selfie" ? `${selected.name} selfie/photo preview. This will show the uploaded file once storage URL is wired.` : kind === "Resume" ? `Resume file for ${selected.name}. Admin checks work history before activation.` : `Submitted account documents for ${selected.name}: ${selected.files}`,
    });
  const decideAccount = (decision: "Approved" | "Rejected") => {
    setLocalStatus((current) => ({ ...current, [selected.id]: decision }));
    setNote(decision === "Approved" ? `${selected.name} approved. ${selected.type} can open dashboard after login.` : `${selected.name} rejected. Account stays on waiting page and can resubmit corrected details until approved.`);
  };
  useEffect(() => {
    setSelectedId((mode === "customer" ? customerQueue[0] : caretakerQueue[0]).id);
  }, [mode]);

  return (
    <Shell role="admin" title={config[0]}>
      <PageTitle title="Account Verification" text="Review customer and caretaker account submissions before approval. Verified accounts stay in the verified list." icon="shield" />
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <button onClick={() => setTab("queue")} className={"rounded-2xl border p-4 text-left " + (tab === "queue" ? "border-[#1f6b45] bg-emerald-50" : "border-[#e3ded0] bg-white/95")}>
          <b>Verification Queue</b>
          <p className="text-xs font-bold text-[#667267]">Accounts waiting for admin approval or rejection.</p>
        </button>
        <button onClick={() => setTab("verified")} className={"rounded-2xl border p-4 text-left " + (tab === "verified" ? "border-[#1f6b45] bg-emerald-50" : "border-[#e3ded0] bg-white/95")}>
          <b>Verified Accounts</b>
          <p className="text-xs font-bold text-[#667267]">Already verified customer and caretaker accounts.</p>
        </button>
      </div>
      {tab === "queue" && (
        <div className="mt-5 grid gap-4 xl:grid-cols-[300px_minmax(520px,1fr)_340px]">
          <Card className="min-h-[640px]">
            <h2 className="text-lg font-black">Accounts On Queue</h2>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button onClick={() => setMode("customer")} className={"rounded-xl px-3 py-3 text-sm font-black " + (mode === "customer" ? "bg-[#1f6b45] text-white" : "bg-[#f6f3e8]")}>
                Customers
              </button>
              <button onClick={() => setMode("caretaker")} className={"rounded-xl px-3 py-3 text-sm font-black " + (mode === "caretaker" ? "bg-[#1f6b45] text-white" : "bg-[#f6f3e8]")}>
                Caretakers
              </button>
            </div>
            <div className="mt-4 max-h-[520px] space-y-3 overflow-y-auto pr-2">
              {queue.map((row) => (
                <button key={row.id} onClick={() => setSelectedId(row.id)} className={"flex w-full items-center gap-3 rounded-2xl border p-3 text-left " + (selected.id === row.id ? "border-[#1f6b45] bg-emerald-50" : "border-[#ece6d8] bg-[#fffdf7]")}>
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#1f6b45] font-black text-white">{row.avatar}</span>
                  <span className="min-w-0 flex-1">
                    <b className="block truncate">{row.name}</b>
                    <span className="text-xs font-bold text-[#667267]">{row.submitted}</span>
                  </span>
                  <Badge tone={row.risk === "Medium" ? "warn" : "neutral"}>{row.risk}</Badge>
                </button>
              ))}
            </div>
          </Card>
          <Card className="min-h-[640px]">
            <p className="text-xs font-black uppercase text-[#667267]">Submitted Account Details</p>
            <h2 className="mt-1 text-3xl font-black">{selected.name}</h2>
            <div className="mt-4 grid gap-3">
              <Info label="Role" value={selected.type} />
              <Info label="Email" value={selected.email} />
              <Info label="Phone" value={selected.phone} />
              <Info label="Submitted" value={selected.submitted} />
              <Info label="Account Details" value={selected.details} />
              <Info label="Submitted Files" value={selected.files} />
              <Info label="Current Status" value={selectedStatus} />
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <button onClick={() => openAccountFile("Selfie")} className="rounded-xl bg-[#eee8d9] px-4 py-3 font-black">
                View Selfie
              </button>
              <button onClick={() => openAccountFile("Documents")} className="rounded-xl bg-[#eee8d9] px-4 py-3 font-black">
                View Documents
              </button>
              {mode === "caretaker" && (
                <button onClick={() => openAccountFile("Resume")} className="rounded-xl bg-[#eee8d9] px-4 py-3 font-black md:col-span-2">
                  View Resume
                </button>
              )}
            </div>
          </Card>
          <Card className="min-h-[640px]">
            <p className="text-xs font-black uppercase text-[#667267]">Admin Verification</p>
            <h2 className="mt-1 text-2xl font-black">Approve or Reject</h2>
            <Badge tone={selectedStatus === "Approved" ? "good" : selectedStatus === "Rejected" ? "bad" : "warn"}>{selectedStatus}</Badge>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button onClick={() => decideAccount("Approved")} className="rounded-2xl bg-[#1f6b45] px-4 py-8 font-black text-white">
                Approve
              </button>
              <button onClick={() => decideAccount("Rejected")} className="rounded-2xl bg-red-600 px-4 py-8 font-black text-white">
                Reject
              </button>
            </div>
            <label className="mt-4 block text-sm font-black">Admin Notes</label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} className="mt-2 min-h-40 w-full rounded-2xl border border-[#ded8c9] bg-[#fffdf7] p-4 text-sm font-bold" />
            <div className="mt-4 rounded-2xl bg-[#f6f3e8] p-4 text-sm font-bold leading-6 text-[#667267]">
              <b>Locking flow:</b>
              <br />
              Approved: account opens its dashboard after login.
              <br />
              Rejected: account opens waiting/resubmission page, shows admin note, and user can resubmit until approved.
            </div>
          </Card>
        </div>
      )}
      {tab === "verified" && (
        <div className="mt-5 grid gap-4 xl:grid-cols-[300px_minmax(560px,1fr)_300px]">
          <Card className="min-h-[640px]">
            <h2 className="text-lg font-black">Verified Type</h2>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button onClick={() => setMode("customer")} className={"rounded-xl px-3 py-3 text-sm font-black " + (mode === "customer" ? "bg-[#1f6b45] text-white" : "bg-[#f6f3e8]")}>
                Customers
              </button>
              <button onClick={() => setMode("caretaker")} className={"rounded-xl px-3 py-3 text-sm font-black " + (mode === "caretaker" ? "bg-[#1f6b45] text-white" : "bg-[#f6f3e8]")}>
                Caretakers
              </button>
            </div>
          </Card>
          <Card className="min-h-[640px]">
            <h2 className="text-xl font-black">Verified List</h2>
            <div className="mt-4 max-h-[540px] space-y-3 overflow-y-auto pr-2">
              {verified.map((row) => (
                <div key={row.id} className="flex items-center gap-3 rounded-2xl border border-[#ece6d8] bg-[#fffdf7] p-4">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#1f6b45] font-black text-white">{row.avatar}</span>
                  <span className="min-w-0 flex-1">
                    <b className="block truncate">{row.name}</b>
                    <span className="text-xs font-bold text-[#667267]">
                      {row.email} / {row.verified}
                    </span>
                  </span>
                  <Badge tone="good">{row.status}</Badge>
                </div>
              ))}
            </div>
          </Card>
          <Card className="min-h-[640px]">
            <p className="text-xs font-black uppercase text-[#667267]">Total Verified</p>
            <h2 className="mt-2 text-5xl font-black text-[#1f6b45]">{verified.length}</h2>
            <p className="mt-2 text-sm font-bold text-[#667267]">{mode === "customer" ? "verified customers" : "verified caretakers"}</p>
          </Card>
        </div>
      )}
      {viewer && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase text-[#667267]">{viewer.kind} Preview</p>
                <h2 className="mt-1 text-2xl font-black">{viewer.title}</h2>
              </div>
              <button onClick={() => setViewer(null)} className="rounded-xl bg-[#eee8d9] px-4 py-2 text-sm font-black">
                Close
              </button>
            </div>
            <div className="mt-5 rounded-2xl border border-[#ece6d8] bg-[#fffdf7] p-6 text-center">
              <div className="mx-auto grid h-32 w-32 place-items-center rounded-3xl bg-[#1f6b45] text-4xl font-black text-white">{selected.avatar}</div>
              <p className="mt-4 text-sm font-bold leading-6 text-[#667267]">{viewer.body}</p>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}
function AdminOperationsDeskFormat({ kind, config }: { kind: "caretaker" | "farm" | "money" | "evidence" | "issues" | "verification"; config: string[] }) {
  const rowsByKind = {
    caretaker: [
      {
        id: "registration",
        name: "Caretaker Registration",
        status: "Permanent link",
        main: "Admin sends caretaker signup link",
        detail: "Permanent registration link; applicant can register even if the link is forwarded.",
        route: "/admin/caretaker-registration",
        priority: "Normal",
      },
      {
        id: "verification",
        name: "Caretaker Verification",
        status: "Needs approval",
        main: "New caretaker account review",
        detail: "Check email, name, phone, selfie/photo, and resume before account becomes active.",
        route: "/admin/account-verification",
        priority: "High",
      },
      {
        id: "list",
        name: "Caretaker List",
        status: "Approved only",
        main: "Approved caretakers and assignments",
        detail: "Column 1 list, column 2 selfie/resume, column 3 assigned customers/tasks.",
        route: "/admin/caretakers",
        priority: "Normal",
      },
      {
        id: "task-proof",
        name: "Task Verification",
        status: "Needs proof review",
        main: "Caretaker submitted task proof",
        detail: "Check submitted photo/video, documentation, QR/serial, customer, rooster, and requested work.",
        route: "/admin/evidence",
        priority: "High",
      },
      {
        id: "completed",
        name: "Completed Tasks",
        status: "Evidence storage",
        main: "Approved caretaker work history",
        detail: "Approved tasks, customers served, proof submitted, date/time, and admin decision.",
        route: "/admin/evidence",
        priority: "Normal",
      },
    ],
    farm: [
      {
        id: "products",
        name: "Product Sales Summary",
        status: "Calendar filter",
        main: "Products bought by customers",
        detail: "Default shows total sold and total amount. Calendar shows daily product sales like feeds sold on a selected date.",
        route: "/admin/farm-operations",
        priority: "Normal",
      },
      {
        id: "customers",
        name: "Customer Registry",
        status: "Calendar filter",
        main: "Registered customer count and list",
        detail: "Default shows all registered customers. Calendar shows customers registered on a selected date.",
        route: "/admin/customers",
        priority: "Normal",
      },
      {
        id: "paid-care",
        name: "Paid Care Requests",
        status: "Revenue view",
        main: "Total paid care requests",
        detail: "List caretaker/service/price paid so owner sees care service income and who handled the work.",
        route: "/admin/customer-requests/care",
        priority: "Normal",
      },
    ],
    money: [
      {
        id: "cashin",
        name: "Cash-In Review",
        status: "Manual check",
        main: "Customer uploaded receipt",
        detail: "Check receiver account, reference number, sender, amount, and duplicate risk.",
        route: "/admin/transactions/cashin",
        priority: "High",
      },
      {
        id: "withdraw",
        name: "Withdrawal",
        status: "Sensitive",
        main: "Customer requested payout",
        detail: "Check KYC, payout account name/number, wallet trail, upload proof, send receipt.",
        route: "/admin/customer-requests/withdraw",
        priority: "High",
      },
      {
        id: "treasury",
        name: "Treasury",
        status: "Read only",
        main: "Owner money view",
        detail: "Available cash, pending payouts, holds, income, and payroll due.",
        route: "/admin/treasury",
        priority: "Normal",
      },
    ],
    evidence: [
      {
        id: "customer",
        name: "Customer Evidence",
        status: "Person by person",
        main: "All customer activity and proof",
        detail: "Select customer, then review registration, KYC, payments, care, withdrawals, chats, inbox, and admin decisions.",
        route: "/admin/evidence",
        priority: "Normal",
      },
      {
        id: "caretaker",
        name: "Caretaker Evidence",
        status: "Person by person",
        main: "All caretaker assignments and proof",
        detail: "Select caretaker, then review assigned customers, submitted proof, approved/rejected tasks, and performance history.",
        route: "/admin/evidence",
        priority: "Normal",
      },
      {
        id: "admin",
        name: "Admin Evidence",
        status: "Audit trail",
        main: "Everything admin approved/sent/changed",
        detail: "Approvals, rejected requests, payout proof uploads, caretaker assignments, inbox messages, and resolved issue actions.",
        route: "/admin/audit-logs",
        priority: "Normal",
      },
    ],
    issues: [
      {
        id: "customer-reports",
        name: "Customer Reports",
        status: "Open issues",
        main: "Customer-submitted problems",
        detail: "Source can be support, report issue, payment complaint, care concern, withdrawal concern, or KaFarm escalation.",
        route: "/admin/live-chat",
        priority: "High",
      },
      {
        id: "caretaker-reports",
        name: "Caretaker Reports",
        status: "Open issues",
        main: "Caretaker-submitted problems",
        detail: "QR/camera/upload/task/proof problems. KaFarm helps check related task and evidence logs.",
        route: "/admin/live-chat",
        priority: "Normal",
      },
      {
        id: "completed-issues",
        name: "Completed Issues",
        status: "Storage",
        main: "Resolved issue archive",
        detail: "Resolved customer/caretaker reports with final action, KaFarm summary, admin message, and evidence link.",
        route: "/admin/evidence",
        priority: "Normal",
      },
    ],
    verification: [
      {
        id: "customer-verify",
        name: "Customer Verification",
        status: "KYC",
        main: "Customer account verification",
        detail: "KYC, ID/selfie, birthday/name match, duplicate account risk, and withdrawal unblock.",
        route: "/admin/account-verification",
        priority: "High",
      },
      {
        id: "caretaker-verify",
        name: "Caretaker Verification",
        status: "Applications",
        main: "Caretaker account activation",
        detail: "Review caretaker email, name, number, selfie/photo, and resume before approving active status.",
        route: "/admin/caretaker-registration",
        priority: "High",
      },
      {
        id: "admin-verify",
        name: "Admin Verification",
        status: "Restricted",
        main: "Admin role assignment",
        detail: "Only approved owner/developer process can promote an email to admin. Keep as shortcut and audit trail.",
        route: "/admin/audit-logs",
        priority: "High",
      },
    ],
  }[kind];
  const [selected, setSelected] = useState(rowsByKind[0]);
  const [decision, setDecision] = useState<"open" | "approved" | "rejected">("open");
  const [note, setNote] = useState("");

  if (kind === "farm") return <AdminFarmOperationsPage config={config} />;
  if (kind === "issues") return <AdminIssueManagementPage config={config} />;
  if (kind === "verification") return <AdminAccountVerificationPage config={config} />;

  type OperationsRow = (typeof rowsByKind)[number];

  function choose(row: OperationsRow) {
    setSelected(row);
    setDecision("open");
    setNote("");
  }

  function mark(next: "approved" | "rejected") {
    setDecision(next);
    setNote((current) => current || (next === "approved" ? "Approved after checking linked evidence." : "Rejected/held until missing evidence is fixed."));
  }

  function toneFor(row: OperationsRow): "good" | "warn" | "bad" | "neutral" {
    if (row.priority === "High") return "bad";
    if (/review|approval|sensitive|open/i.test(row.status)) return "warn";
    return "neutral";
  }

  const details = [
    { label: "Purpose", value: selected.main },
    { label: "Status", value: selected.status },
    { label: "Linked Page", value: selected.route },
    { label: "Priority", value: selected.priority },
  ];

  const supportPanel =
    kind === "caretaker" ? (
      <AdminLiveTaskProofQueue />
    ) : kind === "money" ? (
      <AdminManualPaymentQueue />
    ) : (
      <Card>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase text-[#667267]">Read Only Guide</p>
            <h2 className="mt-1 text-xl font-black">Evidence and issue trail</h2>
            <p className="mt-2 text-sm font-bold leading-6 text-[#667267]">This page is for finding records, reviewing status, and deciding what page to open next. Sensitive actions stay in the linked approval pages.</p>
          </div>
          <Badge tone="neutral">Report Only</Badge>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl bg-[#f4efe4] p-4">
            <b>1. Select</b>
            <p className="mt-1 text-xs font-bold text-[#667267]">Choose customer, caretaker, or admin trail.</p>
          </div>
          <div className="rounded-2xl bg-[#f4efe4] p-4">
            <b>2. Inspect</b>
            <p className="mt-1 text-xs font-bold text-[#667267]">Open evidence before any decision.</p>
          </div>
          <div className="rounded-2xl bg-[#f4efe4] p-4">
            <b>3. Resolve</b>
            <p className="mt-1 text-xs font-bold text-[#667267]">Move finished work to resolved logs.</p>
          </div>
        </div>
      </Card>
    );

  function actionPlan(row: OperationsRow) {
    if (kind === "money" && row.id === "cashin")
      return {
        label: "Payment Review",
        primary: "Confirm Payment",
        secondary: "Reject Receipt",
        next: "If confirmed, create receipt/invoice and notify customer. If rejected, customer sees reason and can resubmit.",
        checks: ["Receiver account matches FarmConnect", "Reference number is not duplicate", "Amount and sender name match", "Receipt image is readable"],
      };
    if (kind === "money" && row.id === "withdraw")
      return {
        label: "Withdrawal Review",
        primary: "Mark Sent",
        secondary: "Return To Customer",
        next: "Upload payout proof, save reference number, then customer confirms receipt. If details are wrong, return with notes.",
        checks: ["KYC is approved", "Saved payout account matches request", "Wallet balance and hold are correct", "Admin payout proof is attached"],
      };
    if (kind === "caretaker" && row.id === "registration")
      return {
        label: "Registration Link",
        primary: "Open Link Page",
        secondary: "Hold",
        next: "This is not an approval step. Use it to send the permanent caretaker registration link.",
        checks: ["Permanent link works", "Applicant understands requirements", "No salary/rate shown on public form"],
      };
    if (kind === "caretaker" && row.id === "verification")
      return {
        label: "Caretaker Verification",
        primary: "Activate Account",
        secondary: "Reject Application",
        next: "Approve only after checking selfie/photo, phone, email, and resume. Rejected applicants should receive a clear reason.",
        checks: ["Resume is visible", "Profile photo is clear", "Phone and payment details are complete", "Applicant is fit for farm work"],
      };
    if (kind === "caretaker" && row.id === "task-proof")
      return {
        label: "Task Proof Review",
        primary: "Approve Proof",
        secondary: "Return For Correction",
        next: "Approved proof goes to completed tasks and customer care logs. Rejected proof returns to caretaker with instructions.",
        checks: ["QR/serial matches rooster", "Photo/video proof is clear", "Quantity used is recorded", "Customer notes were followed"],
      };
    if (kind === "caretaker")
      return {
        label: "Caretaker Record",
        primary: "Open Record",
        secondary: "Flag For Review",
        next: "Use this for viewing assignments, resume, payment mode, and completed work evidence.",
        checks: ["Caretaker identity is clear", "Assigned customers are visible", "Task history is traceable", "Payment mode is recorded"],
      };
    if (kind === "farm" && row.id === "paid-care")
      return {
        label: "Care Revenue",
        primary: "Open Care Requests",
        secondary: "Flag Mismatch",
        next: "Paid care requests should connect to task management before caretaker assignment.",
        checks: ["Customer paid request exists", "Service type and price are correct", "Task is ready for assignment", "Care logs will update after completion"],
      };
    if (kind === "farm")
      return {
        label: "Farm Report",
        primary: "Open Report",
        secondary: "Flag Data Issue",
        next: "This page is mostly read-only. Use calendar filters to verify daily totals and product/customer counts.",
        checks: ["Date filter is correct", "Totals match linked records", "No duplicate count", "Linked customer/product records exist"],
      };
    if (kind === "issues")
      return {
        label: "Issue Handling",
        primary: "Resolve Issue",
        secondary: "Keep Open",
        next: "Use KaFarm/evidence to understand the issue, message the user, then move it to completed issues when resolved.",
        checks: ["Affected user is identified", "Evidence trail is opened", "Root cause is written", "Customer/caretaker gets a clear update"],
      };
    if (kind === "verification")
      return {
        label: "Account Verification",
        primary: "Approve Verification",
        secondary: "Reject / Request Fix",
        next: "Verification affects access and money safety. Check identity records before approving.",
        checks: ["Identity data matches", "Duplicate risk checked", "Sensitive fields are protected", "Decision is logged"],
      };
    return {
      label: "Evidence Review",
      primary: "Mark Reviewed",
      secondary: "Flag Issue",
      next: "Evidence pages are read-only until a linked request needs action. Use this to find proof fast.",
      checks: ["Correct person selected", "Event timeline is complete", "Admin action is linked", "Record can be used for dispute review"],
    };
  }
  const plan = actionPlan(selected);

  return (
    <Shell role="admin" title={config[0]}>
      <PageTitle title={config[0]} text={config[1]} icon={config[2] as IconName} />
      <section className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {rowsByKind.map((row) => (
          <button key={row.id} onClick={() => choose(row)} className={"min-h-36 rounded-2xl border p-4 text-left shadow-sm transition " + (selected.id === row.id ? "border-[#1f6b45] bg-[#e9fff3] ring-2 ring-[#1f6b45]/20" : "border-[#e3ded0] bg-white/95 hover:border-[#1f6b45]")}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase text-[#667267]">{row.status}</p>
                <h2 className="mt-2 truncate text-xl font-black">{row.name}</h2>
              </div>
              <Badge tone={toneFor(row)}>{row.priority}</Badge>
            </div>
            <p className="mt-3 line-clamp-2 text-sm font-bold leading-6 text-[#526154]">{row.main}</p>
          </button>
        ))}
      </section>

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(620px,1fr)_320px]">
        <div className="grid content-start gap-4">
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase text-[#667267]">Selected Work Box</p>
                <h2 className="mt-1 text-3xl font-black">{selected.name}</h2>
                <p className="mt-2 max-w-3xl text-sm font-bold leading-6 text-[#667267]">{selected.detail}</p>
              </div>
              <Badge tone={toneFor(selected)}>{selected.status}</Badge>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {details.map((card) => (
                <div key={card.label} className="rounded-2xl border border-[#ece6d8] bg-[#fffdf7] p-4">
                  <p className="text-xs font-black uppercase text-[#667267]">{card.label}</p>
                  <p className="mt-2 text-sm font-black leading-6">{card.value}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href={selected.route} className="rounded-xl bg-[#1f6b45] px-4 py-3 text-sm font-black text-white">
                Open Linked Page
              </Link>
              <Link href="/admin/evidence" className="rounded-xl bg-[#eee8d9] px-4 py-3 text-sm font-black">
                Open Evidence
              </Link>
            </div>
          </Card>
          {supportPanel}
        </div>

        <Card className="min-h-[640px]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase text-[#667267]">Admin Next Step</p>
              <h2 className="mt-1 text-xl font-black">{plan.label}</h2>
            </div>
            <Badge tone={toneFor(selected)}>{selected.priority}</Badge>
          </div>
          <p className="mt-3 rounded-2xl bg-[#f4efe4] p-4 text-sm font-bold leading-6 text-[#526154]">{plan.next}</p>
          <div className="mt-4 rounded-2xl border border-[#ece6d8] bg-[#fffdf7] p-4">
            <p className="text-xs font-black uppercase text-[#667267]">Check Before Action</p>
            <div className="mt-3 space-y-2">
              {plan.checks.map((check) => (
                <div key={check} className="flex gap-2 text-sm font-bold leading-5">
                  <span className="mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-100 text-xs text-[#1f6b45]">?</span>
                  <span>{check}</span>
                </div>
              ))}
            </div>
          </div>
          <label className="mt-5 block text-sm font-black">Admin Notes / Reason</label>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Write clear reason, evidence checked, and next instruction..." className="mt-2 h-36 w-full resize-none rounded-2xl border border-[#ded8c9] bg-[#fffdf7] p-3 text-sm font-bold leading-6" />
          <div className="mt-5 grid grid-cols-2 gap-3">
            <button onClick={() => mark("approved")} className="min-h-20 rounded-2xl bg-[#1f6b45] px-4 py-3 text-sm font-black text-white shadow-sm">
              {plan.primary}
            </button>
            <button onClick={() => mark("rejected")} className="min-h-20 rounded-2xl bg-red-600 px-4 py-3 text-sm font-black text-white shadow-sm">
              {plan.secondary}
            </button>
          </div>
          <div className="mt-4 rounded-2xl border border-[#ece6d8] bg-white p-4">
            <p className="text-xs font-black uppercase text-[#667267]">Current UI Decision</p>
            <p className={"mt-2 text-lg font-black " + (decision === "approved" ? "text-[#1f6b45]" : decision === "rejected" ? "text-red-700" : "text-[#667267]")}>{decision === "approved" ? plan.primary : decision === "rejected" ? plan.secondary : "Waiting for admin decision"}</p>
            <p className="mt-1 text-xs font-bold leading-5 text-[#667267]">This is UI review state only. Backend approval functions will be wired per real request type.</p>
          </div>
          <div className="mt-4 grid gap-2">
            <Link href={selected.route} className="rounded-xl bg-[#1f6b45] px-4 py-3 text-center font-black text-white">
              Open Work Page
            </Link>
            <Link href="/admin/evidence" className="rounded-xl bg-[#eee8d9] px-4 py-3 text-center font-black">
              Open Evidence
            </Link>
            <Link href="/admin/customer-requests/resolved" className="rounded-xl bg-white px-4 py-3 text-center font-black shadow-sm">
              Resolved Logs
            </Link>
          </div>
        </Card>
      </div>
    </Shell>
  );
}

export function AdminWorkspace({ kind }: { kind: "customer" | "caretaker" | "farm" | "chat" | "evidence" | "issues" | "verification" }) {
  const config = {
    customer: ["Customer Requests Management", "Review customer payment receipts, care requests, task assignment, and withdrawal requests.", "clipboard"],
    caretaker: ["Caretaker Management", "Registration link, caretaker list, task verification, and completed task evidence.", "user"],
    farm: ["Farm Operations", "Product sales summary, customer registry, and paid care request income.", "rooster"],
    chat: ["Live Chat", "Only escalated Ka-Farm chats and caretaker-admin chats appear here.", "chat"],
    evidence: ["Evidence Logs", "Customer, caretaker, and admin evidence organized person by person.", "file"],
    issues: ["Issue Management", "Customer reports, caretaker reports, and completed issue storage with KaFarm investigation.", "alert"],
    verification: ["Account Verification", "Customer, caretaker, and admin verification shortcuts from one source of truth.", "shield"],
  }[kind];
  if (kind === "chat") return <AdminLiveChatPage />;
  if (kind === "customer") return <AdminCustomerRequestsPage />;
  if (kind === "caretaker") return <AdminCaretakerManagementPage config={config} />;
  return <AdminOperationsDeskFormat kind={kind} config={config} />;
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
      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-64px)] w-full max-w-6xl items-center justify-center">{children}</div>
    </main>
  );
}

function AuthPanel({ icon, title, text, children }: { icon: IconName; title: string; text: string; children: ReactNode }) {
  return (
    <Card className="w-full max-w-3xl border-2 border-[#ffd84a] bg-white/96 shadow-2xl">
      <div className="flex flex-wrap items-center gap-4">
        <div className="grid h-16 w-16 place-items-center rounded-2xl bg-[#1f6b45] text-white shadow-lg">
          <Icon name={icon} className="h-7 w-7" />
        </div>
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
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      if (!data.user) {
        setMessage("Login did not finish. Please try again.");
        return;
      }

      const { data: profile, error: profileError } = await supabase.from("profiles").select("id, role, account_status").eq("auth_user_id", data.user.id).maybeSingle();
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
          <input value={email} onChange={(e) => setEmail(e.target.value)} className="rounded-xl border border-[#ded8c9] p-3 font-bold" placeholder="Email" type="email" />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
            className="rounded-xl border border-[#ded8c9] p-3 font-bold"
            placeholder="Password"
            type="password"
          />
          <button onClick={submit} disabled={loading} className="rounded-xl bg-[#1f6b45] px-5 py-3 font-black text-white disabled:opacity-60">
            {loading ? "Checking..." : "Login"}
          </button>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href="/customer/register" className="rounded-xl bg-[#ffd84a] px-4 py-3 font-black">
            Create Customer Account
          </Link>
          <Link href="/caretaker/signup" className="rounded-xl bg-[#e7f6ee] px-4 py-3 font-black text-[#1f6b45]">
            Apply as Caretaker
          </Link>
          <Link href="/" className="rounded-xl bg-[#eee8d9] px-4 py-3 font-black">
            Home
          </Link>
        </div>
      </AuthPanel>
    </AuthShell>
  );
}

export function FarmerSignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    fullName: "",
    displayName: "",
    email: "",
    phone: "",
    birthdate: "",
    password: "",
    confirmPassword: "",
  });
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("Customer signup creates a customer role only. KYC documents stay in Settings after login.");

  function update(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
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
    const normalizedEmail = form.email.trim().toLowerCase();
    if (hasReservedSignupEmailDomain(normalizedEmail)) {
      setMessage(reservedSignupEmailMessage);
      return;
    }
    setLoading(true);
    setMessage("Creating your customer account...");
    try {
      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password: form.password,
        options: {
          data: {
            full_name: form.fullName,
            display_name: form.displayName,
            phone: form.phone,
            birthdate: form.birthdate,
            role: "customer",
          },
        },
      });
      if (error) throw error;
      if (!isFreshSupabaseSignup(data.user)) throw new Error("An account already exists for this email. Sign in or reset the password instead.");
      if (!data.user) throw new Error("Account creation did not return a user record. Please try again.");
      if (data.session)
        await ensureCustomerSignupProfile(data.user.id, {
          email: normalizedEmail,
          phone: form.phone,
          fullName: form.fullName,
          displayName: form.displayName || form.fullName,
          birthdate: form.birthdate,
        });
      setMessage(data.session ? "Customer account ready. Opening dashboard..." : "Account created. Please login if email confirmation is required.");
      if (data.session) router.push("/customer/dashboard");
    } catch (error) {
      const text = signupFailureMessage(error);
      setMessage(text.toLowerCase().includes("row-level") || text.toLowerCase().includes("policy") ? "Customer profile could not be created yet. Check profile RLS/signup SQL." : text);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <AuthPanel icon="user" title="Customer Registration" text="For customers/farmers who will buy roosters, request care, use wallet withdrawal, and submit KYC later in Settings.">
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <input value={form.fullName} onChange={(e) => update("fullName", e.target.value)} className="rounded-xl border border-[#ded8c9] p-3 font-bold" placeholder="Legal full name" />
          <input value={form.displayName} onChange={(e) => update("displayName", e.target.value)} className="rounded-xl border border-[#ded8c9] p-3 font-bold" placeholder="Display name / nickname" />
          <input value={form.email} onChange={(e) => update("email", e.target.value)} className="rounded-xl border border-[#ded8c9] p-3 font-bold" placeholder="Email" type="email" />
          <input value={form.phone} onChange={(e) => update("phone", e.target.value)} className="rounded-xl border border-[#ded8c9] p-3 font-bold" placeholder="Phone number" />
          <input value={form.birthdate} onChange={(e) => update("birthdate", e.target.value)} className="rounded-xl border border-[#ded8c9] p-3 font-bold" type="date" />
          <input value={form.password} onChange={(e) => update("password", e.target.value)} className="rounded-xl border border-[#ded8c9] p-3 font-bold" placeholder="Password" type="password" />
          <input value={form.confirmPassword} onChange={(e) => update("confirmPassword", e.target.value)} className="rounded-xl border border-[#ded8c9] p-3 font-bold md:col-span-2" placeholder="Confirm password" type="password" />
        </div>
        <label className="mt-4 flex items-start gap-3 rounded-2xl bg-[#f6f3e8] p-4 text-sm font-bold leading-6 text-[#56635b]">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1" />
          <span>I agree to FarmConnect terms, privacy notice, and future KYC verification before withdrawals or sensitive wallet actions.</span>
        </label>
        <KaFarm>{message}</KaFarm>
        <div className="mt-4 flex flex-wrap gap-3">
          <button onClick={submit} disabled={loading} className="rounded-xl bg-[#1f6b45] px-5 py-3 font-black text-white disabled:opacity-60">
            {loading ? "Creating..." : "Create Customer Account"}
          </button>
          <Link href="/login" className="rounded-xl bg-[#eee8d9] px-5 py-3 font-black">
            Back to Login
          </Link>
        </div>
      </AuthPanel>
    </AuthShell>
  );
}

export function CaretakerSignupPage() {
  const [form, setForm] = useState({
    fullName: "",
    displayName: "",
    email: "",
    phone: "",
    birthdate: "",
    addressLine: "",
    avatarUrl: "",
    resumeUrl: "",
    farmRole: "",
    paymentMethod: "GCash",
    paymentAccountName: "",
    paymentAccountNumber: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    password: "",
    confirmPassword: "",
    workPin: "",
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("Caretaker signup is an application. Admin approval is required before the caretaker app opens.");

  function update(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function explainCaretakerApplicationError(error: unknown) {
    const source = error as {
      message?: string;
      details?: string;
      hint?: string;
      code?: string;
      status?: number;
    };
    const raw = [source?.message, source?.details, source?.hint, source?.code ? `Code: ${source.code}` : "", source?.status ? `Status: ${source.status}` : ""].filter(Boolean).join(" | ") || "Application failed.";
    const text = raw.toLowerCase();

    console.error("KaFarm caretaker application issue", {
      page: "/caretaker/signup",
      role: "caretaker_applicant",
      expected: "Create auth login then submit caretaker application for admin approval.",
      actual: raw,
      possibleRootCause: text.includes("login required") ? "RPC did not receive a valid Supabase auth session." : text.includes("row-level security") || text.includes("permission") || text.includes("denied") ? "Database permission or RLS blocked the application flow." : text.includes("function") || text.includes("schema cache") ? "Caretaker application SQL/RPC may be missing or outdated." : text.includes("duplicate") || text.includes("unique") || text.includes("already") ? "A caretaker application for this login may already exist." : "Unknown caretaker application blocker. Check RPC response and database logs.",
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
        options: {
          data: {
            full_name: form.fullName,
            display_name: form.displayName,
            phone: form.phone,
            role: "caretaker_applicant",
          },
        },
      });
      if (error) {
        const text = error.message.toLowerCase();
        if (!text.includes("already") && !text.includes("registered") && !text.includes("exists")) throw error;
        const signIn = await supabase.auth.signInWithPassword({
          email: form.email,
          password: form.password,
        });
        if (signIn.error) throw signIn.error;
        data = signIn.data;
      }
      if (!data.user || !data.session) {
        const signIn = await supabase.auth.signInWithPassword({
          email: form.email,
          password: form.password,
        });
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
          <input value={form.fullName} onChange={(e) => update("fullName", e.target.value)} className="rounded-xl border border-[#ded8c9] p-3 font-bold" placeholder="Full name" />
          <input value={form.displayName} onChange={(e) => update("displayName", e.target.value)} className="rounded-xl border border-[#ded8c9] p-3 font-bold" placeholder="Nickname / display name" />
          <input value={form.email} onChange={(e) => update("email", e.target.value)} className="rounded-xl border border-[#ded8c9] p-3 font-bold" placeholder="Email" type="email" />
          <input value={form.phone} onChange={(e) => update("phone", e.target.value)} className="rounded-xl border border-[#ded8c9] p-3 font-bold" placeholder="Phone" />
          <input value={form.birthdate} onChange={(e) => update("birthdate", e.target.value)} className="rounded-xl border border-[#ded8c9] p-3 font-bold" type="date" />
          <input value={form.farmRole} onChange={(e) => update("farmRole", e.target.value)} className="rounded-xl border border-[#ded8c9] p-3 font-bold" placeholder="Farm role / job type" />
          <input value={form.addressLine} onChange={(e) => update("addressLine", e.target.value)} className="rounded-xl border border-[#ded8c9] p-3 font-bold md:col-span-2" placeholder="Address" />
          <label className="rounded-xl border border-[#ded8c9] bg-white p-3 font-bold text-[#667267]">
            Selfie photo
            <input onChange={(e) => update("avatarUrl", e.target.files?.[0]?.name || "")} className="mt-2 block w-full text-sm" type="file" accept="image/*" />
            {form.avatarUrl && <span className="mt-2 block text-xs text-[#1f6b45]">Selected: {form.avatarUrl}</span>}
          </label>
          <label className="rounded-xl border border-[#ded8c9] bg-white p-3 font-bold text-[#667267]">
            Resume file
            <input onChange={(e) => update("resumeUrl", e.target.files?.[0]?.name || "")} className="mt-2 block w-full text-sm" type="file" accept=".pdf,.doc,.docx,image/*" />
            {form.resumeUrl && <span className="mt-2 block text-xs text-[#1f6b45]">Selected: {form.resumeUrl}</span>}
          </label>
          <select value={form.paymentMethod} onChange={(e) => update("paymentMethod", e.target.value)} className="rounded-xl border border-[#ded8c9] p-3 font-bold">
            <option>GCash</option>
            <option>Maya</option>
            <option>UnionBank</option>
            <option>GoTyme</option>
            <option>BPI</option>
            <option>Other Bank</option>
          </select>
          <input value={form.paymentAccountName} onChange={(e) => update("paymentAccountName", e.target.value)} className="rounded-xl border border-[#ded8c9] p-3 font-bold" placeholder="Payment account name" />
          <input value={form.paymentAccountNumber} onChange={(e) => update("paymentAccountNumber", e.target.value)} className="rounded-xl border border-[#ded8c9] p-3 font-bold" placeholder="Payment account number / mobile" />
          <input value={form.emergencyContactName} onChange={(e) => update("emergencyContactName", e.target.value)} className="rounded-xl border border-[#ded8c9] p-3 font-bold" placeholder="Emergency contact name" />
          <input value={form.emergencyContactPhone} onChange={(e) => update("emergencyContactPhone", e.target.value)} className="rounded-xl border border-[#ded8c9] p-3 font-bold" placeholder="Emergency contact number" />
          <input value={form.workPin} onChange={(e) => update("workPin", e.target.value)} className="rounded-xl border border-[#ded8c9] p-3 font-bold" placeholder="Work PIN setup" type="password" />
          <input value={form.password} onChange={(e) => update("password", e.target.value)} className="rounded-xl border border-[#ded8c9] p-3 font-bold" placeholder="Password" type="password" />
          <input value={form.confirmPassword} onChange={(e) => update("confirmPassword", e.target.value)} className="rounded-xl border border-[#ded8c9] p-3 font-bold md:col-span-2" placeholder="Confirm password" type="password" />
        </div>
        <KaFarm>{message}</KaFarm>
        <div className="mt-4 flex flex-wrap gap-3">
          <button onClick={submit} disabled={loading} className="rounded-xl bg-[#1f6b45] px-5 py-3 font-black text-white disabled:opacity-60">
            {loading ? "Submitting..." : "Submit Application"}
          </button>
          <Link href="/login" className="rounded-xl bg-[#eee8d9] px-5 py-3 font-black">
            Back to Login
          </Link>
        </div>
      </AuthPanel>
    </AuthShell>
  );
}
