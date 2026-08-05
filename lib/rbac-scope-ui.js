/**
 * Permissions that support spreadsheet-style self vs all in the admin matrix.
 */
export function rbacPermUsesTriState(permKey) {
  if (!permKey || typeof permKey !== "string") return false;
  if (permKey.startsWith("scheduling.session.")) return true;
  return (
    permKey === "clients.view" ||
    permKey === "clients.update" ||
    permKey === "view.reports_mileage"
  );
}

/** @param {unknown} v */
export function normalizeScopeValue(v) {
  if (v === "self" || v === "all") return v;
  if (v === true || v === "on") return "all";
  return "off";
}
