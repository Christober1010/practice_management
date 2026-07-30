/** Prefix for multiselect value when row has no client_id (match by normalized name). */
export const CLIENT_NAME_VALUE_PREFIX = "__name__:";
export const STAFF_NAME_VALUE_PREFIX = "__staff__:";

export function normalizeNameParts(first, last) {
  return `${first || ""} ${last || ""}`
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function clientOptionValueFromRow(row) {
  const id = row.client_id ? String(row.client_id).trim() : "";
  if (id) return id;
  const nk = normalizeNameParts(row.client_first_name, row.client_last_name);
  if (!nk) return null;
  return `${CLIENT_NAME_VALUE_PREFIX}${nk}`;
}

export function clientOptionLabelFromRow(row) {
  const name = `${row.client_first_name || ""} ${row.client_last_name || ""}`.trim();
  const id = row.client_id ? String(row.client_id).trim() : "";
  if (name) return name;
  if (id) return `Client ${id.length > 10 ? `${id.slice(0, 8)}…` : id}`;
  return "Unknown client";
}

export function clientFilterKey(row) {
  const cid = String(row.client_id ?? "").trim();
  if (cid) return cid;
  const nk = normalizeNameParts(row.client_first_name, row.client_last_name);
  return nk ? `${CLIENT_NAME_VALUE_PREFIX}${nk}` : null;
}

export function rowMatchesClients(row, selectedIds, referenceRows) {
  if (!selectedIds.length) return true;
  return selectedIds.some((sel) => {
    const rowKey = clientFilterKey(row);
    if (rowKey && rowKey === sel) return true;
    if (sel.startsWith(CLIENT_NAME_VALUE_PREFIX)) {
      const selName = sel.slice(CLIENT_NAME_VALUE_PREFIX.length);
      const rowName = normalizeNameParts(row.client_first_name, row.client_last_name);
      return rowName === selName;
    }
    const cid = String(row.client_id ?? "").trim();
    if (cid && cid === sel) return true;
    const ref = referenceRows.find((r) => String(r.client_id ?? "").trim() === sel);
    if (ref) {
      const refName = normalizeNameParts(ref.client_first_name, ref.client_last_name);
      const rowName = normalizeNameParts(row.client_first_name, row.client_last_name);
      if (refName && rowName && refName === rowName) return true;
    }
    return false;
  });
}

export function staffFilterKey(row) {
  const pid = String(row.provider_id ?? "").trim();
  if (pid) return pid;
  const nk = normalizeNameParts(row.staff_first_name, row.staff_last_name);
  if (nk) return `${STAFF_NAME_VALUE_PREFIX}${nk}`;
  const pn = String(row.provider_name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  return pn ? `${STAFF_NAME_VALUE_PREFIX}${pn}` : null;
}

export function staffOptionLabelFromRow(row) {
  const name = `${row.staff_first_name || ""} ${row.staff_last_name || ""}`.trim();
  const providerName = String(row.provider_name || "").trim();
  const id = row.provider_id ? String(row.provider_id).trim() : "";
  if (name) return name;
  if (providerName) return providerName;
  if (id) return `Staff ${id.length > 10 ? `${id.slice(0, 8)}…` : id}`;
  return "Unknown staff";
}

export function rowMatchesStaff(row, selectedIds, referenceRows) {
  if (!selectedIds.length) return true;
  return selectedIds.some((sel) => {
    const rowKey = staffFilterKey(row);
    if (rowKey && rowKey === sel) return true;
    if (sel.startsWith(STAFF_NAME_VALUE_PREFIX)) {
      const selName = sel.slice(STAFF_NAME_VALUE_PREFIX.length);
      const rowName = normalizeNameParts(row.staff_first_name, row.staff_last_name);
      if (rowName === selName) return true;
      const pn = String(row.provider_name || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");
      return pn === selName;
    }
    const pid = String(row.provider_id ?? "").trim();
    if (pid && pid === sel) return true;
    const ref = referenceRows.find((r) => String(r.provider_id ?? "").trim() === sel);
    if (ref) {
      const refName = normalizeNameParts(ref.staff_first_name, ref.staff_last_name);
      const rowName = normalizeNameParts(row.staff_first_name, row.staff_last_name);
      if (refName && rowName && refName === rowName) return true;
    }
    return false;
  });
}

export function uniquePersonOptionsFromRows(rows, { keyFn, labelFn }) {
  const byValue = new Map();
  for (const r of rows) {
    const v = keyFn(r);
    if (!v) continue;
    if (!byValue.has(v)) {
      byValue.set(v, { value: v, label: labelFn(r) });
    }
  }
  return Array.from(byValue.values()).sort((a, b) => a.label.localeCompare(b.label));
}
