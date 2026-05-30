import {
  formatDateFromUTC,
  formatTime12hFromUTC,
} from "@/lib/time-utils";

function formatConflictWindow(startUtc, endUtc) {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const date = formatDateFromUTC(startUtc, tz);
  const start = formatTime12hFromUTC(startUtc, tz);
  const end = formatTime12hFromUTC(endUtc, tz);
  if (date && start && end) {
    return `${date}, ${start} – ${end}`;
  }
  if (startUtc && endUtc) {
    return `${startUtc} – ${endUtc}`;
  }
  return "the selected time";
}

/**
 * User-facing message for scheduling save failures (e.g. provider double-booked).
 */
export function schedulingSaveErrorMessage(data) {
  if (!data) return "Failed to save session.";

  if (data.code === "provider_double_booked") {
    const c = data.conflict;
    const provider =
      c?.provider_name?.trim() || data.error?.split(" is already")?.[0] || "This provider";
    const client = c?.client_name?.trim() || "another client";
    const window = formatConflictWindow(c?.start_utc, c?.end_utc);
    return `${provider} is already booked with ${client} (${window}). Choose a different time or provider.`;
  }

  return (
    data.error ||
    data.message ||
    "Failed to save session."
  );
}
