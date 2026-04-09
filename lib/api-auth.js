/**
 * Attach Bearer token from Mahaverse login (aba_token) for PHP APIs that enforce RBAC.
 */
export function getMahaverseAuthHeaders(extra = {}) {
  if (typeof window === "undefined") {
    return { ...extra };
  }
  const token = localStorage.getItem("aba_token");
  if (!token) {
    return { ...extra };
  }
  // X-Auth-Token: many PHP hosts strip Authorization; backend reads this in getTokenFromCustomHeaders().
  return {
    ...extra,
    Authorization: `Bearer ${token}`,
    "X-Auth-Token": token,
  };
}
