/** Fired so the shell refetches `me-permissions.php` and updates localStorage. */
export const MAHAVERSE_PERMISSIONS_REFRESH_EVENT = "mahaverse:permissions-refresh";

export function notifyMahaversePermissionsRefresh() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(MAHAVERSE_PERMISSIONS_REFRESH_EVENT));
  }
}
