/** Local calendar date as YYYY-MM-DD (for date-only session comparisons). */
export function localYmd(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** True when sessionDate (YYYY-MM-DD) is after today in local time. */
export function isFutureSessionDateYmd(sessionDate) {
  if (!sessionDate) return false;
  return String(sessionDate).trim() > localYmd();
}

export const FUTURE_SESSION_COMPLETE_MESSAGE =
  "You can't complete session notes for a future date. Save a draft now and complete after the session day.";
