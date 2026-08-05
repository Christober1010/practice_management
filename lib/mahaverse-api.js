import { getMahaverseAuthHeaders } from "./api-auth";

/** Base URL for Mahaverse PHP APIs (no trailing slash). */
export function getMahaverseApiBaseUrl() {
  const base = process.env.NEXT_PUBLIC_BASE_URL || "";
  return base.replace(/\/$/, "");
}

function resolveMahaverseUrl(path) {
  if (!path) throw new Error("API path is required");
  if (/^https?:\/\//i.test(path)) return path;
  const base = getMahaverseApiBaseUrl();
  if (!base) throw new Error("NEXT_PUBLIC_BASE_URL is not configured");
  return `${base}/${String(path).replace(/^\//, "")}`;
}

/** Clear Mahaverse session and return to the main login (not Launchpad). */
export function handleMahaverseUnauthorized() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("aba_token");
  localStorage.removeItem("aba_user");
  localStorage.removeItem("aba_token_expiry");
  const path = window.location.pathname || "";
  // Leave Launchpad alone — it uses auth_token, not aba_token.
  if (path.startsWith("/launchpad")) return;
  const loginPath = process.env.NEXT_PUBLIC_LOGIN_PATH || "/";
  if (path.includes("login") || path === loginPath) return;
  window.location.href = loginPath;
}

/**
 * Authenticated fetch to backend-test/backend PHP APIs.
 * Sends Bearer + X-Auth-Token; redirects to Mahaverse login on 401.
 */
export async function mahaverseFetch(path, options = {}) {
  const url = resolveMahaverseUrl(path);
  const headers = getMahaverseAuthHeaders(options.headers);
  const res = await fetch(url, {
    ...options,
    headers,
  });
  // Only logout when we actually sent a token (avoids racing empty-token 401s
  // into a Launchpad redirect loop after a fresh login).
  if (res.status === 401 && (headers.Authorization || headers["X-Auth-Token"])) {
    handleMahaverseUnauthorized();
  }
  return res;
}

export async function mahaverseJson(path, options = {}) {
  const res = await mahaverseFetch(path, options);
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export function mahaverseGet(path, options = {}) {
  return mahaverseFetch(path, { ...options, method: "GET" });
}

export function mahaversePost(path, body, options = {}) {
  const headers =
    body instanceof FormData
      ? options.headers
      : { "Content-Type": "application/json", ...options.headers };
  return mahaverseFetch(path, {
    ...options,
    method: "POST",
    headers,
    body: body instanceof FormData ? body : JSON.stringify(body ?? {}),
  });
}

export function mahaversePut(path, body, options = {}) {
  return mahaverseFetch(path, {
    ...options,
    method: "PUT",
    headers: { "Content-Type": "application/json", ...options.headers },
    body: JSON.stringify(body ?? {}),
  });
}

export function mahaverseDelete(path, options = {}) {
  return mahaverseFetch(path, { ...options, method: "DELETE" });
}
