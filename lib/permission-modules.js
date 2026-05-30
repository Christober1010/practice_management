/**
 * Maps flat rbac_permissions rows into business modules for the admin UI.
 * Rows may be DB-shaped or paired `{ type: 'paired', keys, label, sort_order }` from nav-view-unify.
 */
import { rowPrimaryPermKey, rowPermKeys } from "@/lib/nav-view-unify";
import { rbacPermUsesTriState } from "@/lib/rbac-scope-ui";

/** @typedef {{ id?: number|string, perm_key: string, label?: string, sort_order?: number, perm_group?: string }} PermRow */

/** @param {{ perm_key?: string }[]|null|undefined} permissions */
export function mahaverseHasGranularClientPerms(permissions) {
  if (!permissions?.length) return false;
  return ["clients.create", "clients.update", "clients.archive"].every((k) =>
    permissions.some((p) => p && p.perm_key === k)
  );
}

/**
 * Legacy coarse `clients.write` duplicates granular create/update/archive (“Create / Edit”).
 * Omit it from the Role Access matrix whenever the granular keys exist in the catalog.
 *
 * @param {PermRow[]} rows
 */
export function filterClientsWriteForAdminMatrix(rows) {
  if (!rows?.length) return rows;
  if (!mahaverseHasGranularClientPerms(rows)) return rows;
  return rows.filter((r) => r && r.perm_key !== "clients.write");
}

/**
 * Role matrix list order: view → create → edit → delete → (other) → scoped (Self/All).
 * Paired nav+view rows stay first within the module.
 */
function adminUiActionOrderBucket(row) {
  if (row?.type === "paired") return -1;
  const pk = row?.perm_key;
  if (!pk || typeof pk !== "string") return 99;
  if (rbacPermUsesTriState(pk)) return 5;
  const k = pk.toLowerCase();
  if (k.startsWith("nav.") || k.startsWith("view.") || k.endsWith(".read")) return 0;
  if (k.endsWith(".create")) return 1;
  if (k.endsWith(".update") || k.endsWith(".write")) return 2;
  if (
    k.endsWith(".archive") ||
    k.endsWith(".delete") ||
    k.endsWith(".deactivate") ||
    k.includes(".delete")
  ) {
    return 3;
  }
  return 4;
}

/** Fine order inside the scoped (tri-state) bucket only. */
function scopedTriStateSubOrder(permKey) {
  const order = {
    "clients.view": 0,
    "clients.update": 1,
    "scheduling.session.view": 0,
    "scheduling.session.notes": 1,
    "scheduling.session.create": 2,
    "scheduling.session.update": 3,
    "scheduling.session.delete": 4,
  };
  return order[permKey] ?? 50;
}

function comparePermissionRowsForAdminUi(a, b) {
  const ba = adminUiActionOrderBucket(a);
  const bb = adminUiActionOrderBucket(b);
  if (ba !== bb) return ba - bb;
  if (ba === 5) {
    const pa = a?.perm_key ? scopedTriStateSubOrder(a.perm_key) : 0;
    const pb = b?.perm_key ? scopedTriStateSubOrder(b.perm_key) : 0;
    if (pa !== pb) return pa - pb;
  }
  const so = (a.sort_order ?? 0) - (b.sort_order ?? 0);
  if (so !== 0) return so;
  return String(rowPrimaryPermKey(a)).localeCompare(String(rowPrimaryPermKey(b)));
}

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

  if (b === "behavior_categories") {
    return { id: "manage_data", title: "Manage data", order: 80 };
  }

  const programViews = new Set(["domains", "programs", "targets", "prompts", "behaviors"]);
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
    mod.items.sort(comparePermissionRowsForAdminUi);
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
    for (const k of keys) {
      next[k] = rbacPermUsesTriState(k) ? "all" : true;
    }
    return next;
  }
  if (preset === "clear") {
    for (const k of keys) {
      next[k] = rbacPermUsesTriState(k) ? "off" : false;
    }
    return next;
  }
  if (preset === "read_oriented") {
    for (const k of keys) {
      if (rbacPermUsesTriState(k)) {
        if (k === "scheduling.session.view" || k === "scheduling.session.notes") {
          next[k] = "self";
        } else {
          next[k] = "off";
        }
        continue;
      }
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
