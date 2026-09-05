/**
 * Office Ally SFTP claim submit guards (date-range + helpers).
 * Max inclusive DOS window is 14 calendar days (2 weeks).
 */

export const OFFICE_ALLY_SFTP_MAX_DAYS = 14;

/**
 * Inclusive calendar-day span between YYYY-MM-DD dates (UTC date parts).
 * @param {string} fromYmd
 * @param {string} toYmd
 * @returns {number} days inclusive, or 0 if invalid
 */
export function inclusiveCalendarDaySpan(fromYmd, toYmd) {
  const from = String(fromYmd || "").trim().slice(0, 10);
  const to = String(toYmd || "").trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return 0;
  }
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return 0;
  return Math.floor((b - a) / 86400000) + 1;
}

/**
 * @param {string} fromYmd
 * @param {string} toYmd
 * @returns {{ ok: boolean, days: number, message: string }}
 */
export function officeAllySftpDateRangeCheck(fromYmd, toYmd) {
  const days = inclusiveCalendarDaySpan(fromYmd, toYmd);
  if (days <= 0) {
    return {
      ok: false,
      days: 0,
      message: "Choose a valid DOS from/to range before submitting via SFTP.",
    };
  }
  if (days > OFFICE_ALLY_SFTP_MAX_DAYS) {
    return {
      ok: false,
      days,
      message: `Office Ally SFTP is limited to a ${OFFICE_ALLY_SFTP_MAX_DAYS}-day (2-week) DOS range. Your filter spans ${days} days — narrow the dates before submitting.`,
    };
  }
  return { ok: true, days, message: "" };
}

/**
 * Min/max DOS (YYYY-MM-DD) from session rows using start_utc.
 * @param {Array<{ start_utc?: string }>} sessions
 * @returns {{ from: string, to: string } | null}
 */
export function dosBoundsFromSessions(sessions) {
  let min = "";
  let max = "";
  for (const s of sessions || []) {
    const raw = String(s?.start_utc || "").trim();
    if (!raw) continue;
    const d = new Date(raw.includes("T") ? (raw.endsWith("Z") ? raw : `${raw}Z`) : `${raw.replace(" ", "T")}Z`);
    if (Number.isNaN(d.getTime())) continue;
    const ymd = d.toISOString().slice(0, 10);
    if (!min || ymd < min) min = ymd;
    if (!max || ymd > max) max = ymd;
  }
  if (!min || !max) return null;
  return { from: min, to: max };
}
