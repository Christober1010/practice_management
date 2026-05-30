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

/** Clear session and redirect to login on 401. */
export function handleMahaverseUnauthorized() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("aba_token");
  localStorage.removeItem("aba_user");
  const loginPath =
    process.env.NEXT_PUBLIC_LOGIN_PATH || "/launchpad/login";
  if (!window.location.pathname.includes("login")) {
    window.location.href = loginPath;
  }
}

/**
 * Authenticated fetch to backend-test/backend PHP APIs.
 * Sends Bearer + X-Auth-Token; redirects to login on 401.
 */
export async function mahaverseFetch(path, options = {}) {
  const url = resolveMahaverseUrl(path);
  const res = await fetch(url, {
    ...options,
    headers: getMahaverseAuthHeaders(options.headers),
  });
  if (res.status === 401) {
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
