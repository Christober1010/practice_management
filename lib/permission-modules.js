/**
 * Maps flat rbac_permissions rows into business modules for the admin UI.
 * Rows may be DB-shaped or paired `{ type: 'paired', keys, label, sort_order }` from nav-view-unify.
 */
import { rowPrimaryPermKey, rowPermKeys } from "@/lib/nav-view-unify";

/** @typedef {{ id?: number|string, perm_key: string, label?: string, sort_order?: number, perm_group?: string }} PermRow */

/**
 * @param {string} key
 * @returns {{ id: string, title: string, order: number }}
 */
export function inferMahaverseModule(key) {
  const k = (key || "").toLowerCase();
  if (!k) return { id: "other", title: "Other", order: 999 };

  if (k.includes("launchpad")) {
    return { id: "launchpad", title: "Launchpad", order: 24 };
  }
  if (k.includes("dashboard")) {
    return { id: "dashboard", title: "Dashboard", order: 10 };
  }
  if (k.includes("scheduling")) {
    return { id: "scheduling", title: "Scheduling", order: 20 };
  }
  if (k.includes("clients")) {
    return { id: "clients", title: "Clients", order: 30 };
  }
  if (k.includes("staff")) {
    return { id: "staff", title: "Staff", order: 40 };
  }
  if (k.includes("users")) {
    return { id: "users", title: "Users & access", order: 50 };
  }

  const parts = k.split(".");
  const a = parts[0];
  const b = parts[1] || "";

  const programViews = new Set(["domains", "programs", "targets", "prompts"]);
  if (a === "view" && programViews.has(b)) {
    return { id: "programs_data", title: "Programs & collection", order: 56 };
  }
  if (k.includes("master_data")) {
    return { id: "data_collection", title: "Data collection", order: 60 };
  }

  const refViews = new Set([
    "provider",
    "provider_service_code",
    "service_code",
    "diagnosis",
    "locations",
    "facility_types",
    "treatment_types",
    "document_types",
  ]);
  if (a === "view" && refViews.has(b)) {
    return { id: "reference_data", title: "Reference data", order: 70 };
  }
  if (k.includes("manage_data")) {
    return { id: "manage_data", title: "Manage data", order: 80 };
  }
  if (k.includes("reports")) {
    return { id: "reports", title: "Reports", order: 90 };
  }
  if (k.includes("billing")) {
    return { id: "billing", title: "Billing", order: 100 };
  }

  return { id: "other", title: "Other", order: 998 };
}

/**
 * @param {PermRow[]} rows
 * @param {'mahaverse'|'launchpad'} appScope
 * @returns {{ id: string, title: string, order: number, items: PermRow[] }[]}
 */
export function buildPermissionModules(rows, appScope = "mahaverse") {
  if (!rows?.length) return [];

  if (appScope === "launchpad") {
    const sorted = [...rows].sort(
      (a, b) =>
        (a.sort_order ?? 0) - (b.sort_order ?? 0) ||
        String(a.perm_key).localeCompare(String(b.perm_key))
    );
    return [{ id: "launchpad", title: "Launchpad", order: 0, items: sorted }];
  }

  /** @type {Map<string, { id: string, title: string, order: number, items: PermRow[] }>} */
  const buckets = new Map();
  for (const row of rows) {
    const m = inferMahaverseModule(rowPrimaryPermKey(row));
    if (!buckets.has(m.id)) {
      buckets.set(m.id, { id: m.id, title: m.title, order: m.order, items: [] });
    }
    buckets.get(m.id).items.push(row);
  }

  const modules = [...buckets.values()].sort((a, b) => a.order - b.order);
  for (const mod of modules) {
    mod.items.sort(
      (a, b) =>
        (a.sort_order ?? 0) - (b.sort_order ?? 0) ||
        String(rowPrimaryPermKey(a)).localeCompare(String(rowPrimaryPermKey(b)))
    );
  }
  return modules;
}

/**
 * Filter modules/items by search string (label, key, module title).
 * @param {{ id: string, title: string, order: number, items: PermRow[] }[]} modules
 * @param {string} query
 */
export function filterPermissionModules(modules, query) {
  const q = query.trim().toLowerCase();
  if (!q) return modules;

  return modules
    .map((mod) => {
      const titleMatch = mod.title.toLowerCase().includes(q);
      const items = mod.items.filter((row) => {
        if (titleMatch) return true;
        const keys = rowPermKeys(row).map((k) => k.toLowerCase());
        if (keys.some((k) => k.includes(q))) return true;
        const label = (
          row.type === "paired" ? row.label : row.label || ""
        ).toLowerCase();
        return label.includes(q);
      });
      return { ...mod, items };
    })
    .filter((mod) => mod.items.length > 0);
}

/**
 * @param {PermRow[]} allPermissions
 * @param {string} preset - 'full' | 'clear' | 'read_oriented'
 * @returns {Record<string, boolean>}
 */
export function buildPresetDraft(allPermissions, preset) {
  /** @type {Record<string, boolean>} */
  const next = {};
  const keys = (allPermissions || []).map((p) => p.perm_key);
  if (preset === "full") {
    for (const k of keys) next[k] = true;
    return next;
  }
  if (preset === "clear") {
    for (const k of keys) next[k] = false;
    return next;
  }
  if (preset === "read_oriented") {
    for (const k of keys) {
      if (k.endsWith(".write")) {
        next[k] = false;
      } else if (
        k.endsWith(".read") ||
        k.startsWith("nav.") ||
        k.startsWith("view.")
      ) {
        next[k] = true;
      } else {
        next[k] = false;
      }
    }
    return next;
  }
  return next;
}
