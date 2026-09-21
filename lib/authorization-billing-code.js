/**
 * Scheduling / session billing code display:
 *   {billing_codes} - {Auth#}-{Start dt}-{End dt}
 * Example: 97153 - A12345-01/15/2025-06/30/2025
 */

function formatAuthBillingDate(value) {
  if (value == null || String(value).trim() === "") return "…";
  const s = String(value).trim().slice(0, 10);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[2]}/${m[3]}/${m[1]}`;
  return s;
}

/** Auth#-Start dt-End dt (no billing_codes prefix). */
export function authorizationAuthDateSuffix(auth) {
  const authNum = String(auth?.authorization_number ?? "").trim() || "—";
  const start = formatAuthBillingDate(auth?.start_date);
  const end = formatAuthBillingDate(auth?.end_date);
  return `${authNum}-${start}-${end}`;
}

/**
 * Full label for dropdowns and sessions.auth_code.
 */
export function authorizationBillingCodeLabel(auth) {
  const billingCode = String(auth?.billing_codes ?? "").trim() || "—";
  return `${billingCode} - ${authorizationAuthDateSuffix(auth)}`;
}

/** Value sent/stored for API matching when only CPT codes matter (legacy). */
export function authorizationBillingCodesOnly(auth) {
  return String(auth?.billing_codes ?? "").trim();
}

/** Match stored session auth_code to a client_auth row (new or legacy format). */
export function authorizationBillingCodeMatches(auth, storedCode) {
  const code = String(storedCode ?? "").trim();
  if (!code || !auth) return false;
  if (authorizationBillingCodeLabel(auth) === code) return true;
  if (authorizationAuthDateSuffix(auth) === code) return true;
  const codesOnly = authorizationBillingCodesOnly(auth);
  if (codesOnly !== "" && codesOnly === code) return true;
  const authNum = String(auth?.authorization_number ?? "").trim();
  if (authNum !== "" && authNum === code) return true;
  return false;
}

/**
 * CPT codes where Box 31 supervising provider must be the same as the
 * rendering/session provider (BCBA delivers the service themselves).
 */
export const PROVIDER_AS_SUPERVISING_CPT_CODES = ["97151", "97155", "97156"];

/**
 * CPT codes where supervising provider defaults to the rendering staff
 * member's Assigned Supervisor (97153 RBT protocol treatment).
 */
export const STAFF_ASSIGNED_SUPERVISOR_CPT_CODES = ["97153"];

/** Pull 5-digit CPT/HCPCS codes from billing text (e.g. 97153NB, "97151 - A1-…"). */
export function extractProcedureCodesFromBillingText(raw) {
  const s = String(raw ?? "");
  if (!s.trim()) return [];
  const out = [];
  const seen = new Set();
  const re = /\b(\d{5})(?=[A-Za-z]|\b)/g;
  let m;
  while ((m = re.exec(s)) !== null) {
    if (!seen.has(m[1])) {
      seen.add(m[1]);
      out.push(m[1]);
    }
  }
  return out;
}

function billingTextIncludesAnyCpt(raw, codes) {
  const allowed = new Set(codes);
  return extractProcedureCodesFromBillingText(raw).some((c) => allowed.has(c));
}

function authorizationIncludesAnyCpt(auth, codes) {
  if (!auth) return false;
  if (billingTextIncludesAnyCpt(auth.billing_codes, codes)) return true;
  return billingTextIncludesAnyCpt(authorizationBillingCodeLabel(auth), codes);
}

/** True when billing text includes 97151, 97155, or 97156. */
export function billingTextRequiresProviderAsSupervising(raw) {
  return billingTextIncludesAnyCpt(raw, PROVIDER_AS_SUPERVISING_CPT_CODES);
}

/** True when a client_auth row requires provider = supervising provider. */
export function authorizationRequiresProviderAsSupervising(auth) {
  return authorizationIncludesAnyCpt(auth, PROVIDER_AS_SUPERVISING_CPT_CODES);
}

/** True when billing text includes 97153 (and not a provider-as-supervising CPT). */
export function billingTextRequiresStaffAssignedSupervisor(raw) {
  if (billingTextRequiresProviderAsSupervising(raw)) return false;
  return billingTextIncludesAnyCpt(raw, STAFF_ASSIGNED_SUPERVISOR_CPT_CODES);
}

/** True when a client_auth row should prefill the staff Assigned Supervisor. */
export function authorizationRequiresStaffAssignedSupervisor(auth) {
  if (authorizationRequiresProviderAsSupervising(auth)) return false;
  return authorizationIncludesAnyCpt(auth, STAFF_ASSIGNED_SUPERVISOR_CPT_CODES);
}
