/** Resolve stable client id from a client record (Redux / API). */
export function resolveClientRecordId(client) {
  if (!client) return "";
  return String(client.client_id ?? client.id ?? "").trim();
}

/** client_id on domain, program, target, etc. */
export function resolveEntityClientId(entity) {
  return String(entity?.client_id ?? "").trim();
}

export function entityIsGeneric(entity) {
  return !resolveEntityClientId(entity);
}

export function entityMatchesClient(entity, clientId) {
  if (!clientId) return false;
  return resolveEntityClientId(entity) === clientId;
}

export function isArchivedEntity(entity) {
  return entity?.archived === true || entity?.archived === 1;
}

/**
 * Filter master-data rows for Add Domain/Program/Target modals.
 * @param {object[]} items
 * @param {{ clientId: string, isGeneric: boolean, keepId?: string }} scope
 */
export function filterMasterDataForClientScope(items, { clientId, isGeneric, keepId }) {
  return (items || []).filter((item) => {
    if (item?.id == null || String(item.id).trim() === "") return false;
    if (isArchivedEntity(item) && String(item.id) !== String(keepId ?? "")) {
      return false;
    }
    if (isGeneric) return entityIsGeneric(item);
    return entityMatchesClient(item, clientId);
  });
}

export function findClientByValue(clients, value) {
  if (!value || value === "generic") return null;
  return (
    (clients || []).find(
      (c) =>
        String(c.id) === String(value) || String(c.client_id) === String(value)
    ) || null
  );
}

/** Client statuses that count as active ("Active Treatment" in the status list; legacy "Active"). */
const ACTIVE_CLIENT_STATUSES = new Set(["active", "active treatment"]);

/** "Assign to Client" options: Active clients only, plus the current selection so edits keep it. */
export function activeClientsForAssign(clients, selectedValue) {
  return (clients || []).filter((c) => {
    const status = String(c?.client_status ?? "").trim().toLowerCase();
    if (ACTIVE_CLIENT_STATUSES.has(status)) return true;
    if (!selectedValue || selectedValue === "generic") return false;
    return (
      String(c?.id) === String(selectedValue) ||
      String(resolveClientRecordId(c)) === String(selectedValue)
    );
  });
}
