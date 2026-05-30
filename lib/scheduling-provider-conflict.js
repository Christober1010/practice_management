function toUtcMs(value) {
  if (!value) return Number.NaN;
  let iso = String(value).trim();
  if (!iso.includes("T")) {
    iso = iso.replace(" ", "T");
  }
  if (!iso.endsWith("Z")) {
    iso += "Z";
  }
  return Date.parse(iso);
}

export function scheduleWindowsOverlap(startA, endA, startB, endB) {
  const a0 = toUtcMs(startA);
  const a1 = toUtcMs(endA);
  const b0 = toUtcMs(startB);
  const b1 = toUtcMs(endB);
  if (![a0, a1, b0, b1].every(Number.isFinite)) return false;
  return a0 < b1 && b0 < a1;
}

function isActiveSession(session) {
  const st = String(session?.status ?? session?.STATUS ?? "").toLowerCase();
  return st !== "cancelled";
}

/**
 * Client-side overlap check against sessions already loaded on the calendar.
 */
export function findLocalProviderScheduleConflict({
  providerId,
  startUtc,
  endUtc,
  sessions = [],
  excludeSessionId = null,
}) {
  const pid = String(providerId ?? "").trim();
  if (!pid || !startUtc || !endUtc) return null;

  for (const s of sessions) {
    if (!isActiveSession(s)) continue;
    if (String(s.providerId ?? s.provider_id ?? "") !== pid) continue;
    const sid = s.sessionId ?? s.session_id;
    if (
      excludeSessionId != null &&
      String(sid) === String(excludeSessionId)
    ) {
      continue;
    }
    const sStart = s.startDateTime ?? s.start_utc;
    const sEnd = s.endDateTime ?? s.end_utc;
    if (!scheduleWindowsOverlap(startUtc, endUtc, sStart, sEnd)) continue;
    return {
      session_id: sid,
      client_name: s.clientName || s.client_name || "another client",
      provider_name: s.provider_name || s.providerName || "",
      start_utc: sStart,
      end_utc: sEnd,
    };
  }
  return null;
}
