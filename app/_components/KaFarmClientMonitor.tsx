"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase";

type KaFarmClientIncident = {
  id: string;
  title: string;
  category: string;
  severity: string;
  status: string;
  affected: string;
  appRole?: string;
  route?: string;
  message: string;
  evidence: string[];
  proposedFix: string;
  safeRecovery: string;
  createdAt: string;
  stackTrace?: string;
  httpStatus?: number;
  requestUrl?: string;
  synced?: boolean;
};

const STORAGE_KEY = "farmconnect_kafarm_incidents";
const MAX_INCIDENTS = 25;

function getPageContext() {
  if (typeof window === "undefined") return { route: "server", role: "unknown" };
  const path = window.location.pathname;
  const role = path.startsWith("/admin") ? "admin" : path.startsWith("/caretaker") ? "caretaker" : path.startsWith("/customer") ? "customer" : "public";
  return { route: `${path}${window.location.search}`, role };
}

function normalizeMessage(input: unknown) {
  if (input instanceof Error) return input.message;
  if (typeof input === "string") return input;
  try {
    return JSON.stringify(input);
  } catch {
    return String(input);
  }
}

function isDevOnlyNoiseIncident(partial: Partial<KaFarmClientIncident> & { title?: string; message?: string }) {
  const title = String(partial.title || "");
  const message = String(partial.message || "");
  const requestUrl = String(partial.requestUrl || "");
  const text = `${title} ${message} ${requestUrl}`.toLowerCase();
  const isLocalRscRequest = requestUrl.includes("localhost:3000") && requestUrl.includes("_rsc=");
  const isRscFallback = text.includes("failed to fetch rsc payload") && text.includes("falling back to browser navigation");
  const isOldMonitorCompileError =
    text.includes("kafarmclientmonitor.tsx") &&
    (text.includes("expected ';', '}' or <eof>") || text.includes("parsing ecmascript source code failed"));
  const isGenericDevFetch = title === "Network/API request blocked" && message === "Failed to fetch" && (!requestUrl || isLocalRscRequest);

  return isLocalRscRequest || isRscFallback || isOldMonitorCompileError || isGenericDevFetch;
}

function persistIncidentToDb(incident: KaFarmClientIncident) {
  const request = supabase.rpc("kafarm_record_incident", {
    p_incident_key: incident.id,
    p_title: incident.title,
    p_category: incident.category,
    p_severity: incident.severity,
    p_status: incident.status,
    p_app_role: incident.appRole || getPageContext().role,
    p_route: incident.route || getPageContext().route,
    p_affected: incident.affected,
    p_message: incident.message,
    p_evidence: incident.evidence,
    p_proposed_fix: incident.proposedFix,
    p_safe_recovery: incident.safeRecovery,
    p_metadata: { createdAt: incident.createdAt, source: "KaFarmClientMonitor" },
    p_stack_trace: incident.stackTrace || null,
    p_http_status: incident.httpStatus || null,
    p_request_url: incident.requestUrl || null,
  });

  Promise.resolve(request)
    .then(({ error }) => {
      if (error) return;
      if (typeof window === "undefined") return;
      try {
        const current = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]") as KaFarmClientIncident[];
        const next = current.map((item) => (item.id === incident.id ? { ...item, synced: true } : item));
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        window.dispatchEvent(new CustomEvent("kafarm-incident", { detail: { ...incident, synced: true } }));
      } catch {
        // Local sync marker is optional.
      }
    })
    .catch(() => {
      // Keep monitor silent. Admin still sees local incident in this browser.
    });
}

function saveIncident(partial: Partial<KaFarmClientIncident> & { title: string; message: string }) {
  if (typeof window === "undefined") return;
  if (isDevOnlyNoiseIncident(partial)) return;
  const context = getPageContext();
  const incident: KaFarmClientIncident = {
    id: `KF-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`,
    title: partial.title,
    category: partial.category || "Frontend",
    severity: partial.severity || "Medium",
    status: partial.status || "Checking",
    affected: partial.affected || `${context.role} -> ${context.route}`,
    appRole: context.role,
    route: context.route,
    message: partial.message,
    evidence: partial.evidence || ["route", "role", "browser error", "timestamp"],
    proposedFix: partial.proposedFix || "Gather evidence, prevent repeat action if needed, and prepare Buddy report before code/SQL fix.",
    safeRecovery: partial.safeRecovery || "Show friendly fallback, save current user flow if possible, and alert admin instead of crashing.",
    createdAt: new Date().toISOString(),
    stackTrace: partial.stackTrace,
    httpStatus: partial.httpStatus,
    requestUrl: partial.requestUrl,
    synced: false,
  };

  try {
    const current = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]") as KaFarmClientIncident[];
    const next = [incident, ...current].slice(0, MAX_INCIDENTS);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent("kafarm-incident", { detail: incident }));
    persistIncidentToDb(incident);
  } catch {
    // Keep the monitor silent so it never creates a second user-facing error.
  }
}

function isUsefulConsoleIssue(level: "error" | "warn", message: string) {
  const text = message.toLowerCase();
  if (!message.trim()) return false;
  if (text.includes("download the react devtools")) return false;
  if (text.includes("[hmr]") || text.includes("[fast refresh]")) return false;
  if (text.includes("kafarm_record_incident")) return false;
  if (level === "warn" && /metamask|objectmultiplex|contentscript|background-liveness|app-init-liveness|maxlistenersexceededwarning/.test(text)) return false;
  return /system error|runtime error|fatal error|stop error|post code error|post error|browser error|access denied|http\s*(400|401|403|404|409|422|429|500|502|503)|error|failed|failure|warning|duplicate|same key|unauthorized|forbidden|denied|rls|rpc|supabase|quota|storage|network|blocked|exception|invalid|missing|cannot|can't|not found|404|500|timeout/i.test(message);
}

function summarizeConsoleIssue(level: "error" | "warn", message: string) {
  const text = message.toLowerCase();
  if (text.includes("same key") || text.includes("encountered two children")) {
    return {
      title: "React duplicate key warning captured",
      category: "Frontend",
      severity: "Medium",
      status: "Checking",
      proposedFix: "Find the rendered list and make the React key unique using id plus index/source when duplicate labels are possible.",
      safeRecovery: "UI can continue, but admin should fix the key to prevent duplicated/omitted list rows.",
    };
  }
  if (text.includes("fatal error") || text.includes("runtime error") || text.includes("system error") || text.includes("stop error")) {
    return {
      title: "Runtime/system error captured",
      category: "Runtime",
      severity: text.includes("fatal") || text.includes("stop") ? "Critical" : "High",
      status: "Blocked",
      proposedFix: "Capture the route, stack trace, component file/line, and last user action before applying a controlled code fix.",
      safeRecovery: "Stop repeated actions, keep the user on a safe page, and show a friendly recovery message instead of raw system text.",
    };
  }
  if (text.includes("access denied") || text.includes("forbidden") || text.includes("permission denied")) {
    return {
      title: "Access denied issue captured",
      category: "Permission",
      severity: "High",
      status: "Needs Admin",
      proposedFix: "Check role guard, auth session, RLS policy, route permission, and whether the user is allowed to perform this action.",
      safeRecovery: "Do not expose private data. Redirect to the correct workspace or show an access review message.",
    };
  }
  if (text.includes("401") || text.includes("unauthorized") || text.includes("rls")) {
    return {
      title: "Permission/RLS console issue captured",
      category: "Database",
      severity: "High",
      status: "Needs Admin",
      proposedFix: "Check current auth session, role, RPC input, and RLS policy before retrying the action.",
      safeRecovery: "Prevent repeated submit and show a friendly review/pending message while admin checks permissions.",
    };
  }
  if (/\b404\b|not found/.test(text)) {
    return {
      title: "HTTP 404 / missing route captured",
      category: "Route",
      severity: "Medium",
      status: "Checking",
      proposedFix: "Check route path, Link href, dynamic route params, file location, and whether the deployed version contains this page.",
      safeRecovery: "Return the user to the nearest working page and keep the failed route in the incident report.",
    };
  }
  if (/post code error|post error|\bpost\b.*\b(400|401|403|404|409|422|429|500|502|503)\b|\b(400|409|422|429|502|503)\b/.test(text)) {
    return {
      title: "POST/API code error captured",
      category: "API",
      severity: /\b(500|502|503)\b/.test(text) ? "High" : "Medium",
      status: "Checking",
      proposedFix: "Check request payload, RPC/function name, validation rules, auth token, RLS policy, and duplicate-submit prevention.",
      safeRecovery: "Prevent repeated submit and show a pending/retry message while the admin checks the request.",
    };
  }
  if (text.includes("browser error")) {
    return {
      title: "Browser error captured",
      category: "Browser",
      severity: "Medium",
      status: "Checking",
      proposedFix: "Check browser console, extensions, blocked storage/camera/file permissions, and whether the issue reproduces in another browser.",
      safeRecovery: "Offer retry, reload, or alternate upload/manual path if browser permissions are blocking the user.",
    };
  }
  if (text.includes("quota") || text.includes("storage")) {
    return {
      title: "Storage/quota console issue captured",
      category: "Storage",
      severity: "High",
      status: "Blocked",
      proposedFix: "Move large receipt/proof data out of localStorage and store only compact metadata or storage URLs.",
      safeRecovery: "Keep form data visible and ask user/admin to retry after storage path is fixed.",
    };
  }
  return {
    title: level === "error" ? "Console error captured" : "Console warning captured",
    category: "Frontend",
    severity: level === "error" ? "High" : "Medium",
    status: "Checking",
    proposedFix: "Read the console message, find affected route/component, reproduce, then prepare Buddy report before code fix.",
    safeRecovery: "Do not block the whole app. Keep the user on the page and collect evidence.",
  };
}

function throttleIncident(key: string, ttlMs = 45000) {
  if (typeof window === "undefined") return false;
  try {
    const storageKey = `kafarm_throttle_${key}`;
    const last = Number(window.sessionStorage.getItem(storageKey) || 0);
    const now = Date.now();
    if (now - last < ttlMs) return false;
    window.sessionStorage.setItem(storageKey, String(now));
    return true;
  } catch {
    return true;
  }
}

function getElementLabel(element: Element) {
  const aria = element.getAttribute("aria-label") || element.getAttribute("title") || element.getAttribute("data-label");
  const text = (element.textContent || "").replace(/\s+/g, " ").trim();
  return (aria || text || element.id || element.className?.toString() || element.tagName).slice(0, 90);
}

function getElementPath(element: Element) {
  const parts: string[] = [];
  let current: Element | null = element;
  while (current && parts.length < 4 && current !== document.body) {
    const id = current.id ? `#${current.id}` : "";
    const className = typeof current.className === "string" && current.className.trim()
      ? `.${current.className.trim().split(/\s+/).slice(0, 2).join(".")}`
      : "";
    parts.unshift(`${current.tagName.toLowerCase()}${id}${className}`);
    current = current.parentElement;
  }
  return parts.join(" > ");
}

export function KaFarmClientMonitor() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      saveIncident({
        title: "Frontend error captured",
        category: "Frontend",
        severity: "High",
        status: "Blocked",
        message: `${event.message || "Unknown error"}${event.filename ? ` at ${event.filename}:${event.lineno || 0}` : ""}`,
        stackTrace: event.error?.stack,
        evidence: ["page route", "user role", "error message", "file/line if available", "timestamp"],
      });
    };

    const onUnhandled = (event: PromiseRejectionEvent) => {
      saveIncident({
        title: "Unhandled promise/API error captured",
        category: "API",
        severity: "High",
        status: "Blocked",
        message: normalizeMessage(event.reason),
        evidence: ["page route", "user role", "promise rejection", "API/RPC failure if visible", "timestamp"],
      });
    };

    const originalFetch = window.fetch.bind(window);
    const originalConsoleError = console.error.bind(console);
    const originalConsoleWarn = console.warn.bind(console);
    let mutationCount = 0;
    const mutationObserver = new MutationObserver(() => {
      mutationCount += 1;
    });

    const tracePerformance = () => {
      try {
        if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") return;
        const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
        if (!nav) return;
        const loadMs = Math.round(nav.loadEventEnd || nav.duration || performance.now());
        const domMs = Math.round(nav.domContentLoadedEventEnd || 0);
        const routeKey = `${getPageContext().route}_performance`;
        if (loadMs < 5000 && domMs < 3500) return;
        if (!throttleIncident(routeKey, 120000)) return;
        saveIncident({
          title: "Slow page performance detected",
          category: "Performance",
          severity: loadMs >= 8000 ? "High" : "Medium",
          status: "Checking",
          message: `Page timing is slow. Load: ${loadMs}ms. DOM ready: ${domMs}ms.`,
          evidence: ["route", "user role", "navigation timing", "load duration", "DOMContentLoaded duration"],
          proposedFix: "Check heavy images/backgrounds, client bundle size, slow API/RPC calls, and repeated renders on this route.",
          safeRecovery: "Keep buttons disabled only while truly loading and avoid duplicate submits during slow responses.",
        });
      } catch {
        // Performance tracing must never affect the app.
      }
    };

    const scanForBlockingOverlay = () => {
      try {
        const viewportArea = window.innerWidth * window.innerHeight;
        if (!viewportArea) return;
        const candidates = Array.from(document.body.querySelectorAll<HTMLElement>("*")).filter((element) => {
          const style = window.getComputedStyle(element);
          if (style.display === "none" || style.visibility === "hidden" || style.pointerEvents === "none") return false;
          if (!["fixed", "sticky", "absolute"].includes(style.position)) return false;
          const rect = element.getBoundingClientRect();
          if (rect.width < 120 || rect.height < 80) return false;
          const zIndex = Number.parseInt(style.zIndex || "0", 10);
          const coverage = (rect.width * rect.height) / viewportArea;
          const coversCenter =
            rect.left <= window.innerWidth / 2 &&
            rect.right >= window.innerWidth / 2 &&
            rect.top <= window.innerHeight / 2 &&
            rect.bottom >= window.innerHeight / 2;
          return zIndex >= 20 && (coverage > 0.45 || coversCenter);
        });

        const blocker = candidates.find((element) => {
          const text = (element.textContent || "").toLowerCase();
          if (text.includes("close") || text.includes("back") || text.includes("cancel")) return false;
          return true;
        });
        if (!blocker) return;
        const label = getElementLabel(blocker);
        const key = `${getPageContext().route}_${label}_overlay`;
        if (!throttleIncident(key, 90000)) return;
        const rect = blocker.getBoundingClientRect();
        saveIncident({
          title: "Possible blocking overlay detected",
          category: "UI",
          severity: "Medium",
          status: "Checking",
          message: `A high-layer element may be blocking interaction: ${label}. Size: ${Math.round(rect.width)}x${Math.round(rect.height)}.`,
          evidence: ["route", "user role", "overlay element path", "z-index/position", "viewport coverage"],
          proposedFix: "Check modal/backdrop/loading overlay pointer-events, z-index, close action, and whether it should disappear after the action.",
          safeRecovery: "Provide a visible close/back action and prevent the overlay from covering active forms unless admin/customer confirmation is required.",
        });
      } catch {
        // Overlay scan is advisory only.
      }
    };

    const runPageQualityScan = () => {
      window.setTimeout(tracePerformance, 900);
      window.setTimeout(scanForBlockingOverlay, 1300);
    };

    console.error = (...args) => {
      originalConsoleError(...args);
      const message = args.map(normalizeMessage).join(" ");
      if (!isUsefulConsoleIssue("error", message)) return;
      const summary = summarizeConsoleIssue("error", message);
      saveIncident({
        ...summary,
        message,
        evidence: ["console error", "page route", "user role", "timestamp"],
      });
    };

    console.warn = (...args) => {
      originalConsoleWarn(...args);
      const message = args.map(normalizeMessage).join(" ");
      if (!isUsefulConsoleIssue("warn", message)) return;
      const summary = summarizeConsoleIssue("warn", message);
      saveIncident({
        ...summary,
        message,
        evidence: ["console warning", "page route", "user role", "timestamp"],
      });
    };

    window.fetch = async (input, init) => {
      try {
        const response = await originalFetch(input, init);
        if (!response.ok) {
          const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
          const isMonitorRpc = url.includes("/rest/v1/rpc/kafarm_record_incident");
          const isExpectedLoginFailure = url.includes("/auth/v1/token") && response.status === 400;
          const isLocalRscRequest = url.includes("localhost:3000") && url.includes("_rsc=");
          if (isMonitorRpc || isExpectedLoginFailure || isLocalRscRequest) return response;
          saveIncident({
            title: "Failed API request captured",
            category: "API",
            severity: response.status >= 500 ? "High" : "Medium",
            status: response.status === 401 || response.status === 403 ? "Needs Admin" : "Checking",
            affected: `${getPageContext().role} -> ${getPageContext().route}`,
            message: `${response.status} ${response.statusText || "Request failed"} | ${url}`,
            httpStatus: response.status,
            requestUrl: url,
            evidence: ["route", "role", "request URL", "HTTP status", "timestamp"],
            proposedFix: "Check auth session, role permission, API/RPC input, and RLS if Supabase returned unauthorized.",
            safeRecovery: "Keep user on safe status page and prevent duplicate submit while admin checks the failed request.",
          });
        }
        return response;
      } catch (error) {
        const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        const isLocalRscRequest = url.includes("localhost:3000") && url.includes("_rsc=");
        if (url.includes("/rest/v1/rpc/kafarm_record_incident") || isLocalRscRequest) throw error;
        saveIncident({
          title: "Network/API request blocked",
          category: "API",
          severity: "High",
          status: "Blocked",
          message: normalizeMessage(error),
          requestUrl: url,
          evidence: ["route", "role", "network error", "timestamp"],
        });
        throw error;
      }
    };

    const onClickCapture = (event: MouseEvent) => {
      try {
        const clicked = (event.target as Element | null)?.closest<HTMLElement>("button, a, [role='button']");
        if (!clicked) return;
        if (clicked.closest("[data-kafarm-monitor-ignore='true']")) return;
        const label = getElementLabel(clicked);
        if (!label || /close|back|cancel/i.test(label)) return;
        const pageContext = getPageContext();
        if (pageContext.route.startsWith("/admin/kafarm")) return;
        const disabled =
          clicked.hasAttribute("disabled") ||
          clicked.getAttribute("aria-disabled") === "true" ||
          clicked.classList.contains("disabled");
        if (disabled) return;

        const beforeRoute = pageContext.route;
        const beforeMutation = mutationCount;
          const anchor = clicked instanceof HTMLAnchorElement ? clicked : clicked.closest("a");
          const href = anchor?.getAttribute("href") || clicked.getAttribute("data-href") || "";
          const elementPath = getElementPath(clicked);

        window.setTimeout(() => {
          const afterRoute = getPageContext().route;
          const routeChanged = beforeRoute !== afterRoute;
          const domChanged = mutationCount !== beforeMutation;
          const openedDialog = Boolean(document.querySelector("dialog[open], [role='dialog'], [data-state='open'], .modal, .popover"));
          const visibleAction = routeChanged || domChanged || openedDialog;
          const targetsCurrentRoute = href.startsWith("/") && new URL(href, window.location.origin).pathname === beforeRoute;

          if (href && href !== "#" && href.startsWith("/") && !targetsCurrentRoute && !routeChanged && !openedDialog) {
            const key = `${beforeRoute}_${label}_${href}_route`;
            if (!throttleIncident(key)) return;
            saveIncident({
              title: "Button/link route did not open",
              category: "Route",
              severity: "Medium",
              status: "Checking",
              message: `Clicked "${label}" with expected route "${href}", but the page stayed on "${beforeRoute}".`,
              evidence: ["clicked label", "expected href", "actual route", "element path", "timestamp"],
              proposedFix: "Check Link href, router push handler, preventDefault usage, auth guard, and whether the route exists.",
              safeRecovery: "Keep the user on the current page and show a friendly message if navigation is blocked.",
            });
            return;
          }

          if (!visibleAction && !href) {
            const key = `${beforeRoute}_${label}_no_action`;
            if (!throttleIncident(key)) return;
            saveIncident({
              title: "Button click produced no visible action",
              category: "UI",
              severity: "Medium",
              status: "Checking",
              message: `Clicked "${label}", but no route change, modal, or visible page update was detected.`,
              evidence: ["clicked label", "current route", "element path", "DOM mutation check", "timestamp"],
              proposedFix: "Check missing onClick handler, disabled state styling, form validation, modal state, or route wiring for this control.",
              safeRecovery: "Leave the current page stable and show a clear validation/retry message instead of silent failure.",
            });
          }
        }, 900);
      } catch {
        // Click monitoring should never block a real click.
      }
    };

    mutationObserver.observe(document.body, { attributes: true, childList: true, subtree: true });

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandled);
    window.addEventListener("load", runPageQualityScan);
    document.addEventListener("click", onClickCapture, true);
    runPageQualityScan();

    return () => {
      window.fetch = originalFetch;
      console.error = originalConsoleError;
      console.warn = originalConsoleWarn;
      mutationObserver.disconnect();
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandled);
      window.removeEventListener("load", runPageQualityScan);
      document.removeEventListener("click", onClickCapture, true);
    };
  }, []);

  return null;
}



