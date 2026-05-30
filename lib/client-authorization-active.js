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

function authEndDateYmd(auth) {
  const raw = auth?.end_date ?? auth?.endDate;
  if (raw == null || String(raw).trim() === "") return null;
  return String(raw).trim().slice(0, 10);
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
