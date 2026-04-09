/**
 * Pairs nav.* + view.* into one admin concept: "access this area" (menu + screen stay in sync in the UI).
 * DB and API still store two keys; toggles set both together.
 */
import { PERM } from "@/lib/rbac-permission-keys";

/** @typedef {{ id?: number|string, perm_key: string, label?: string, sort_order?: number }} PermRow */

export const NAV_VIEW_ACCESS_PAIRS = [
  { nav: PERM.NAV_DASHBOARD, view: PERM.VIEW_DASHBOARD, title: "Dashboard" },
  { nav: PERM.NAV_SCHEDULING, view: PERM.VIEW_SCHEDULING, title: "Scheduling" },
  { nav: PERM.NAV_CLIENTS, view: PERM.VIEW_CLIENTS, title: "Clients" },
  { nav: PERM.NAV_STAFF, view: PERM.VIEW_STAFF, title: "Staff" },
  { nav: PERM.NAV_USERS, view: PERM.VIEW_USERS, title: "Users" },
  { nav: PERM.NAV_MASTER_DATA, view: PERM.VIEW_MASTER_DATA, title: "Data collection hub" },
  { nav: PERM.NAV_MANAGE_DATA, view: PERM.VIEW_MANAGE_DATA, title: "Manage data hub" },
  { nav: PERM.NAV_REPORTS, view: PERM.VIEW_REPORTS, title: "Reports" },
  { nav: PERM.NAV_LAUNCHPAD, view: PERM.VIEW_LAUNCHPAD, title: "Launchpad" },
  { nav: PERM.NAV_BILLING, view: PERM.VIEW_BILLING, title: "Billing" },
];

/**
 * @param {PermRow[]} apiRows
 * @param {'mahaverse'|'launchpad'} appScope
 * @returns {(PermRow | { type: 'paired', id: string, keys: string[], label: string, sort_order: number })[]}
 */
export function unifyNavViewPairsForAdminUi(apiRows, appScope) {
  if (!apiRows?.length || appScope !== "mahaverse") {
    return apiRows || [];
  }

  const byKey = new Map(apiRows.map((r) => [r.perm_key, r]));
  const consumed = new Set();
  /** @type {ReturnType<typeof unifyNavViewPairsForAdminUi>} */
  const paired = [];

  for (const { nav, view, title } of NAV_VIEW_ACCESS_PAIRS) {
    const navRow = byKey.get(nav);
    const viewRow = byKey.get(view);
    if (navRow && viewRow) {
      consumed.add(nav);
      consumed.add(view);
      const sort_order = Math.min(navRow.sort_order ?? 0, viewRow.sort_order ?? 0);
      paired.push({
        type: "paired",
        id: `pair:${nav}`,
        keys: [nav, view],
        label: title,
        sort_order,
      });
    }
  }

  const rest = apiRows.filter((r) => !consumed.has(r.perm_key));

  return [...paired, ...rest].sort(
    (a, b) =>
      (a.sort_order ?? 0) - (b.sort_order ?? 0) ||
      String(a.type === "paired" ? a.keys[0] : a.perm_key).localeCompare(
        String(b.type === "paired" ? b.keys[0] : b.perm_key)
      )
  );
}

/**
 * @param {PermRow | { type: 'paired', keys: string[] }} row
 * @returns {string}
 */
export function rowPrimaryPermKey(row) {
  if (row && row.type === "paired") return row.keys[0];
  return row.perm_key;
}

/**
 * @param {PermRow | { type: 'paired', keys: string[] }} row
 * @returns {string[]}
 */
export function rowPermKeys(row) {
  if (row && row.type === "paired") return row.keys;
  return [row.perm_key];
}

/**
 * If either nav or view of a pair is granted, treat both as granted client-side
 * so menu, guards, and API-backed lists stay aligned.
 * @param {string[]|undefined|null} keys
 * @returns {string[]}
 */
export function normalizeNavViewKeys(keys) {
  if (!Array.isArray(keys) || keys.length === 0) return keys || [];
  const set = new Set(keys);
  for (const { nav, view } of NAV_VIEW_ACCESS_PAIRS) {
    if (set.has(view) || set.has(nav)) {
      set.add(nav);
      set.add(view);
    }
  }
  return [...set];
}
