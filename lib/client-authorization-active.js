/**
 * Whether a client_auth row may be used for new scheduling (billing code dropdown).
 * Active only — excludes Expired, Inactive, Denied, and past end_date.
 */

const BLOCKED_STATUSES = new Set(["expired", "inactive", "denied"]);

function todayYmdLocal() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function authStartDateYmd(auth) {
  const raw = auth?.start_date ?? auth?.startDate;
  if (raw == null || String(raw).trim() === "") return null;
  return String(raw).trim().slice(0, 10);
}

function authEndDateYmd(auth) {
  const raw = auth?.end_date ?? auth?.endDate;
  if (raw == null || String(raw).trim() === "") return null;
  return String(raw).trim().slice(0, 10);
}

/** Normalize session / auth calendar dates to YYYY-MM-DD. */
export function toAuthYmd(value) {
  if (value == null || String(value).trim() === "") return null;
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * True when session calendar date falls within the authorization window
 * (inclusive of start_date / end_date when present).
 */
export function authorizationCoversSessionDate(auth, sessionDate) {
  if (!auth) return false;
  const sessionYmd = toAuthYmd(sessionDate);
  if (!sessionYmd) return false;
  const startYmd = authStartDateYmd(auth);
  const endYmd = authEndDateYmd(auth);
  if (startYmd && sessionYmd < startYmd) return false;
  if (endYmd && sessionYmd > endYmd) return false;
  return true;
}

export function isActiveAuthorization(auth) {
  if (!auth) return false;

  const status = String(auth?.status ?? auth?.STATUS ?? "").trim().toLowerCase();
  if (BLOCKED_STATUSES.has(status)) return false;
  if (status !== "active") return false;

  const endYmd = authEndDateYmd(auth);
  if (endYmd && endYmd < todayYmdLocal()) return false;

  return true;
}
