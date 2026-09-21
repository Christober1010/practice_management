/** Active, non-archived clients for assignment dropdowns. */
export function isClientActive(client) {
  if (!client) return false;
  const active =
    client.is_active !== false &&
    client.is_active !== 0 &&
    client.is_active !== "0";
  const archived =
    client.archived === true ||
    client.archived === 1 ||
    client.archived === "1";
  return active && !archived;
}

/** Display label used for alphabetical client option lists. */
export function clientDisplayName(client) {
  if (!client || typeof client !== "object") return "";
  const fromParts = [client.first_name, client.middle_name, client.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  if (fromParts) return fromParts;
  return String(
    client.name || client.NAME || client.client_name || ""
  ).trim();
}

/** Stable alphabetical sort by display name (case-insensitive). */
export function sortClientsByName(clients) {
  if (!Array.isArray(clients)) return [];
  return [...clients].sort((a, b) =>
    clientDisplayName(a).localeCompare(clientDisplayName(b), undefined, {
      sensitivity: "base",
      numeric: true,
    })
  );
}
