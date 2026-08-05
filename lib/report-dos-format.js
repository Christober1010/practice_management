/** Normalize report DOS to YYYY-MM-DD for comparisons and date inputs. */
export function reportDosKey(dos) {
  if (dos == null || dos === "") return "";
  const s = String(dos).trim();
  const iso = s.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso) && !Number.isNaN(Date.parse(iso))) return iso;
  const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (mdy) {
    const y = mdy[3];
    const mo = String(mdy[1]).padStart(2, "0");
    const d = String(mdy[2]).padStart(2, "0");
    return `${y}-${mo}-${d}`;
  }
  const t = Date.parse(s);
  if (Number.isNaN(t)) return "";
  const dt = new Date(t);
  const y = dt.getFullYear();
  const mo = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${mo}-${d}`;
}

/** Format date portion as MM/DD/YYYY. */
export function formatReportDosDate(dos) {
  const key = reportDosKey(dos);
  if (!key) return "";
  const [y, mo, d] = key.split("-");
  return `${mo}/${d}/${y}`;
}

function browserTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** Parse MySQL/ISO UTC datetime → Date. Time-only strings return null. */
function parseUtcDateTime(value) {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;
  // Wall-clock time only (e.g. "14:30" / "14:30:00") — not a UTC instant
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(s)) return null;

  let iso = s.includes("T") ? s : s.replace(" ", "T");
  // Date-only YYYY-MM-DD: leave as calendar date (no TZ shift for display)
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;

  if (!/[zZ]|[+-]\d{2}:?\d{2}$/.test(iso)) {
    iso += "Z";
  }
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatLocalDateParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value || "";
  return `${get("month")}/${get("day")}/${get("year")}`;
}

function formatLocalTime12h(date, timeZone) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

function formatReportTimeLegacy(aptStart) {
  if (!aptStart) return "";
  const s = String(aptStart).trim();
  if (!s) return "";
  if (/^\d{1,2}:\d{2}/.test(s)) return s.slice(0, 5);
  if (s.length >= 16) return s.slice(11, 16);
  if (s.length >= 8) return s.slice(0, 8);
  return s;
}

/**
 * Display DOS / optional appointment time (date always MM/DD/YYYY).
 * Full UTC datetimes (e.g. sessions.start_utc) are shown in the browser timezone —
 * same approach as Appointments / Mileage — so "14:30 UTC" becomes local "9:30 AM".
 * Time-only strings are left unchanged (legacy report imports).
 */
export function formatReportDos(dos, aptStart, timeZone = browserTimezone()) {
  if (!dos && !aptStart) return "—";

  const instant = parseUtcDateTime(aptStart);
  if (instant) {
    const d = formatLocalDateParts(instant, timeZone);
    const t = formatLocalTime12h(instant, timeZone);
    return d && t ? `${d} ${t}` : d || t || "—";
  }

  const d = formatReportDosDate(dos);
  const t = formatReportTimeLegacy(aptStart);
  if (d && t) return `${d} ${t}`;
  return d || t || "—";
}

/** True when row DOS falls within optional YYYY-MM-DD from/to (inclusive). */
export function reportDosInRange(dos, fromYmd, toYmd) {
  const key = reportDosKey(dos);
  if (!key) return false;
  const from = (fromYmd || "").trim();
  const to = (toYmd || "").trim();
  if (from && key < from) return false;
  if (to && key > to) return false;
  return true;
}
