/**
 * Map CMS-1500 / Office Ally claim warnings to in-app screens + focus targets.
 * Links use ?view=&session_id=&client_id=&location_id=&tab=&focus=&service_code=
 * so a new tab can open the right record and field.
 */

const FOCUS_STORAGE_KEY = "claimWarningFocus";

/**
 * @typedef {object} ClaimWarningContext
 * @property {string|number} [sessionId]
 * @property {string} [clientId]
 * @property {string} [locationId]
 * @property {string} [serviceCode]
 */

/**
 * @typedef {object} ClaimWarningLink
 * @property {string} view
 * @property {string} href
 * @property {string} fixLabel
 * @property {string} [focus]
 * @property {string} [tab]
 */

/**
 * @typedef {object} ClaimWarningFocus
 * @property {string} view
 * @property {string} [sessionId]
 * @property {string} [clientId]
 * @property {string} [locationId]
 * @property {string} [serviceCode]
 * @property {string} [focus]
 * @property {string} [tab]
 */

function firstServiceCode(raw) {
  const s = String(raw || "").trim();
  if (!s) return "";
  const m = s.match(/\b(\d{5})\b/);
  return m ? m[1] : s.split(/[\s,/|-]+/)[0] || "";
}

/**
 * @param {string} warningText
 * @param {ClaimWarningContext} [context]
 * @returns {ClaimWarningLink | null}
 */
export function claimWarningDeepLink(warningText, context = {}) {
  const raw = String(warningText || "").trim();
  if (!raw) return null;
  const t = raw.toLowerCase();

  /** @type {{ view: string, fixLabel: string, focus?: string, tab?: string } | null} */
  let match = null;

  if (
    t.includes("line charge") ||
    t.includes("box 24f") ||
    t.includes("rate mapping") ||
    t.includes("service code rate")
  ) {
    match = {
      view: "providerServiceCode",
      fixLabel: "Open provider service rates",
      focus: "rates",
    };
  } else if (t.includes("supervising") || t.includes("box 31")) {
    match = {
      view: "scheduling",
      fixLabel: "Edit session — supervising BCBA",
      focus: "supervising",
    };
  } else if (
    t.includes("rendering provider") ||
    t.includes("staff table")
  ) {
    match = { view: "staff", fixLabel: "Open staff", focus: "staff" };
  } else if (t.includes("billing npi") || t.includes("box 33")) {
    match = {
      view: "locations",
      fixLabel: "Edit location — billing NPI",
      focus: "billing_npi",
      tab: "billing",
    };
  } else if (t.includes("facility npi") || t.includes("box 32")) {
    match = {
      view: "locations",
      fixLabel: "Edit location — facility NPI",
      focus: "facility_npi",
      tab: "facility",
    };
  } else if (t.includes("tax id") || t.includes("box 25")) {
    match = {
      view: "locations",
      fixLabel: "Edit location — tax ID",
      focus: "tax_id",
      tab: "general",
    };
  } else if (
    t.includes("prior auth") ||
    t.includes("box 23") ||
    t.includes("authorization_number") ||
    t.includes("client_auth")
  ) {
    match = {
      view: "clients",
      fixLabel: "Edit client — authorization",
      focus: "authorization",
      tab: "authorization",
    };
  } else if (
    t.includes("insurance_id") ||
    t.includes("box 1a") ||
    t.includes("diagnosis") ||
    t.includes("insurance row") ||
    t.includes("insurance provider") ||
    t.includes("could not resolve insurance")
  ) {
    match = {
      view: "clients",
      fixLabel: "Edit client — insurance",
      focus: "insurance",
      tab: "insurance",
    };
  } else if (
    t.includes("place_of_service") ||
    t.includes("scheduled/rendered hours") ||
    t.includes("rendered_hours")
  ) {
    match = {
      view: "scheduling",
      fixLabel: "Edit session",
      focus: t.includes("place_of_service") ? "pos" : "hours",
    };
  } else if (
    t.includes("manage providers") ||
    t.includes("provider master") ||
    t.includes("missing address in manage providers")
  ) {
    match = {
      view: "provider",
      fixLabel: "Open insurance providers",
      focus: "provider",
    };
  }

  if (!match) return null;

  const params = new URLSearchParams({ view: match.view });
  if (match.focus) params.set("focus", match.focus);
  if (match.tab) params.set("tab", match.tab);

  const sessionFromText = raw.match(/Session\s+#?(\d+)/i)?.[1];
  const sessionId = String(context.sessionId || sessionFromText || "").trim();
  const clientId = String(context.clientId || "").trim();
  const locationId = String(context.locationId || "").trim();
  const serviceCode = firstServiceCode(context.serviceCode);

  if (sessionId) params.set("session_id", sessionId);
  if (clientId) params.set("client_id", clientId);
  if (locationId) params.set("location_id", locationId);
  if (serviceCode) params.set("service_code", serviceCode);

  return {
    view: match.view,
    href: `/?${params.toString()}`,
    fixLabel: match.fixLabel,
    focus: match.focus,
    tab: match.tab,
  };
}

/**
 * @param {URLSearchParams | string} [search]
 * @returns {ClaimWarningFocus | null}
 */
export function parseClaimWarningFocusFromSearch(search) {
  const params =
    typeof search === "string"
      ? new URLSearchParams(search.startsWith("?") ? search.slice(1) : search)
      : search instanceof URLSearchParams
        ? search
        : new URLSearchParams(
            typeof window !== "undefined" ? window.location.search : ""
          );

  const view = String(params.get("view") || "").trim();
  if (!view) return null;

  /** @type {ClaimWarningFocus} */
  const focus = { view };
  const sessionId = String(params.get("session_id") || "").trim();
  const clientId = String(params.get("client_id") || "").trim();
  const locationId = String(params.get("location_id") || "").trim();
  const serviceCode = String(params.get("service_code") || "").trim();
  const focusKey = String(params.get("focus") || "").trim();
  const tab = String(params.get("tab") || "").trim();
  if (sessionId) focus.sessionId = sessionId;
  if (clientId) focus.clientId = clientId;
  if (locationId) focus.locationId = locationId;
  if (serviceCode) focus.serviceCode = serviceCode;
  if (focusKey) focus.focus = focusKey;
  if (tab) focus.tab = tab;
  return focus;
}

/** @param {ClaimWarningFocus | null | undefined} focus */
export function storeClaimWarningFocus(focus) {
  if (typeof window === "undefined" || !focus?.view) return;
  try {
    sessionStorage.setItem(FOCUS_STORAGE_KEY, JSON.stringify(focus));
  } catch {
    /* ignore */
  }
}

/**
 * Read pending focus without clearing (wait until target screen has data).
 * @param {string} [forView]
 * @returns {ClaimWarningFocus | null}
 */
export function peekClaimWarningFocus(forView) {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(FOCUS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.view) return null;
    if (forView && parsed.view !== forView) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearClaimWarningFocus() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(FOCUS_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Read and clear pending focus for a view (or any view if omitted).
 * Prefer peek + clear after the target UI opens successfully.
 * @param {string} [forView]
 * @returns {ClaimWarningFocus | null}
 */
export function consumeClaimWarningFocus(forView) {
  const parsed = peekClaimWarningFocus(forView);
  if (!parsed) return null;
  clearClaimWarningFocus();
  return parsed;
}

/** Highlight a field briefly after deep-link open. */
export function highlightClaimFocusElement(elementId) {
  if (typeof document === "undefined" || !elementId) return;
  const el = document.getElementById(elementId);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.classList.add("ring-2", "ring-teal-500", "ring-offset-2");
  if (typeof el.focus === "function") {
    try {
      el.focus({ preventScroll: true });
    } catch {
      el.focus();
    }
  }
  window.setTimeout(() => {
    el.classList.remove("ring-2", "ring-teal-500", "ring-offset-2");
  }, 3500);
}
