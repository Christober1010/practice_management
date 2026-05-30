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
