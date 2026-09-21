import { getMahaverseAuthHeaders } from "./api-auth";

/** Base URL for Mahaverse APIs (no trailing slash). */
export function getMahaverseApiBaseUrl() {
  const base = process.env.NEXT_PUBLIC_BASE_URL || "";
  return base.replace(/\/$/, "");
}

/**
 * True when talking to the Spring Boot API (local java-backend).
 * Set NEXT_PUBLIC_API_MODE=java in .env.java, or point BASE_URL at :8080.
 */
export function isJavaApiMode() {
  const mode = String(process.env.NEXT_PUBLIC_API_MODE || "").toLowerCase();
  if (mode === "java" || mode === "rest") return true;
  if (mode === "php") return false;
  const base = getMahaverseApiBaseUrl();
  return /localhost:8080\b/i.test(base) || /127\.0\.0\.1:8080\b/i.test(base);
}

/**
 * Legacy PHP filename → planned REST path (no leading slash).
 * Used when older call sites still pass *.php names under Java mode.
 */
const PHP_TO_REST = {
  "login.php": "api/v1/auth/login",
  "logout.php": "api/v1/auth/logout",
  "me-permissions.php": "api/v1/me/permissions",
  "me_permissions.php": "api/v1/me/permissions",
  "get-clients.php": "api/v1/clients",
  "update-clients.php": "api/v1/clients",
  "add-clients.php": "api/v1/clients",
  "locations.php": "api/v1/lookups/locations",
  "providers.php": "api/v1/lookups/providers",
  "service-codes.php": "api/v1/lookups/service-codes",
  "diagnosis-codes.php": "api/v1/lookups/diagnosis-codes",
  "facility-types.php": "api/v1/lookups/facility-types",
  "treatment-types.php": "api/v1/lookups/treatment-types",
  "document-types.php": "api/v1/lookups/document-types",
  "provider-service-codes.php": "api/v1/lookups/provider-service-codes",
  "staff.php": "api/v1/staff",
};

/** REST → PHP for test/prod PHP backends when UI already uses /api/v1 paths. */
const REST_TO_PHP = Object.fromEntries(
  Object.entries(PHP_TO_REST).map(([php, rest]) => [rest, php])
);

/**
 * Normalize a relative API path for the active backend.
 * Prefers planned `/api/v1/...` names when talking to Java.
 */
export function resolveMahaverseApiPath(path) {
  if (!path) throw new Error("API path is required");
  if (/^https?:\/\//i.test(path)) return path;

  const raw = String(path);
  const qIndex = raw.indexOf("?");
  const pathname = (qIndex >= 0 ? raw.slice(0, qIndex) : raw).replace(/^\//, "");
  const query = qIndex >= 0 ? raw.slice(qIndex) : "";

  if (isJavaApiMode()) {
    if (pathname.startsWith("api/v1/")) {
      return pathname + query;
    }
    const mapped = PHP_TO_REST[pathname];
    if (mapped) return mapped + query;
    return pathname + query;
  }

  // PHP backends: allow /api/v1/* in UI code, rewrite to legacy filenames.
  if (pathname.startsWith("api/v1/")) {
    const mapped = REST_TO_PHP[pathname];
    if (mapped) return mapped + query;
  }
  return pathname + query;
}

function resolveMahaverseUrl(path) {
  if (/^https?:\/\//i.test(path)) return path;
  const base = getMahaverseApiBaseUrl();
  if (!base) throw new Error("NEXT_PUBLIC_BASE_URL is not configured");
  const relative = resolveMahaverseApiPath(path);
  return `${base}/${relative.replace(/^\//, "")}`;
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
 * Authenticated fetch to Mahaverse APIs (Java /api/v1 or legacy PHP).
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
