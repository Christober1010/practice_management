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

export function normalizeAssignedClientIds(entity) {
  if (Array.isArray(entity?.client_ids)) {
    return [
      ...new Set(
        entity.client_ids.map((id) => String(id || "").trim()).filter(Boolean)
      ),
    ];
  }
  const one = String(entity?.client_id ?? "").trim();
  return one ? [one] : [];
}

/** Pending client from client-profile navigation into Configure data. */
export function pendingMasterDataClientIds(clients) {
  try {
    const raw = localStorage.getItem("pendingClientForMasterData");
    if (!raw) return [];
    const clientInfo = JSON.parse(raw);
    const found = (clients || []).find(
      (c) =>
        String(c.id) === String(clientInfo.id) ||
        String(c.client_id) === String(clientInfo.id) ||
        c.name === clientInfo.name
    );
    if (found) {
      const id = resolveClientRecordId(found);
      return id ? [id] : [];
    }
    if (clientInfo.id) return [String(clientInfo.id)];
  } catch (err) {
    console.error("Error parsing pending client info:", err);
  }
  return [];
}

export function assignedClientSaveTargets(entity) {
  const ids = normalizeAssignedClientIds(entity);
  return ids.length > 0 ? ids : [null];
}

export function uniqueMasterDataId(prefix, index = 0) {
  return `${prefix}_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 8)}`;
}
