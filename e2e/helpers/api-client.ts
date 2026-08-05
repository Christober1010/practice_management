import { expect, type APIRequestContext } from "@playwright/test";
import { assertNoSchemaDrift, getApiErrorText } from "./schema-errors";

function resolveApiBase(): string {
  const base =
    process.env.E2E_API_BASE ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    (process.env.E2E_TARGET === "prod"
      ? "https://www.mahabehavioralhealth.com/mahaverse-backend-logics"
      : "https://www.mahabehavioralhealth.com/mahaverse-backend-test");
  return base.replace(/\/$/, "");
}

export function getApiBase() {
  return resolveApiBase();
}

export type ApiJson = Record<string, unknown>;

export class MahaverseApiClient {
  constructor(
    readonly request: APIRequestContext,
    readonly token: string
  ) {}

  private url(path: string) {
    return `${getApiBase()}/${path.replace(/^\//, "")}`;
  }

  private headers(extra?: Record<string, string>) {
    return {
      "Content-Type": "application/json",
      "X-Auth-Token": this.token,
      Authorization: `Bearer ${this.token}`,
      ...extra,
    };
  }

  get(path: string) {
    return this.request.get(this.url(path), { headers: this.headers() });
  }

  post(path: string, data?: unknown) {
    return this.request.post(this.url(path), {
      headers: this.headers(),
      data: data ?? {},
    });
  }

  put(path: string, data?: unknown) {
    return this.request.put(this.url(path), {
      headers: this.headers(),
      data: data ?? {},
    });
  }

  patch(path: string, data?: unknown) {
    return this.request.fetch(this.url(path), {
      method: "PATCH",
      headers: this.headers(),
      data: data ?? {},
    });
  }

  delete(path: string, data?: unknown) {
    return this.request.delete(this.url(path), {
      headers: this.headers(),
      data: data ?? {},
    });
  }

  async json<T extends ApiJson = ApiJson>(response: { json(): Promise<T> }) {
    return response.json();
  }

  async expectOk(
    path: string,
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" = "GET",
    body?: unknown
  ) {
    const res =
      method === "GET"
        ? await this.get(path)
        : method === "POST"
          ? await this.post(path, body)
          : method === "PUT"
            ? await this.put(path, body)
            : method === "PATCH"
              ? await this.patch(path, body)
              : await this.delete(path, body);
    const data = await this.json(res);
    assertNoSchemaDrift(data, path, res.status());
    expect(res.ok(), `${method} ${path} → ${res.status()} ${getApiErrorText(data)}`).toBeTruthy();
    if (Object.prototype.hasOwnProperty.call(data, "success")) {
      expect(data.success, `${path} success: ${getApiErrorText(data)}`).toBeTruthy();
    } else if (data.error) {
      expect(getApiErrorText(data), `${path} error`).toBe("");
    }
    return { res, data };
  }

  static async login(
    request: APIRequestContext,
    email: string,
    password: string
  ) {
    const res = await request.post(`${getApiBase()}/login.php`, {
      headers: { "Content-Type": "application/json" },
      data: { email, password },
    });
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data.token).toBeTruthy();
    return new MahaverseApiClient(request, data.token as string);
  }
}

export function uniqueId(prefix: string, ts: string) {
  return `${prefix}_${ts}`;
}

export function pickClientWithAuth(clients: ApiJson[]) {
  for (const c of clients) {
    const auths = (c.authorizations as ApiJson[]) || [];
    const activeAuth = auths.find(
      (a) => String(a.status ?? "Active").toLowerCase() === "active"
    );
    if (activeAuth) return c;
    if (auths.length > 0) return c;
    const ins = (c.insurances as ApiJson[]) || [];
    for (const row of ins) {
      if (row.billing_codes || row.auth_id) return c;
    }
  }
  return clients[0];
}

export function pickAuthorization(client: ApiJson): ApiJson | null {
  const auths = (client.authorizations as ApiJson[]) || [];
  if (auths.length) {
    const active = auths.find(
      (a) => String(a.status ?? "Active").toLowerCase() === "active"
    );
    return active || auths[0];
  }
  const ins = (client.insurances as ApiJson[]) || [];
  for (const row of ins) {
    const codes = row.billing_codes ?? row.billing_code;
    if (codes) {
      return {
        auth_id: row.auth_id ?? row.authorization_id,
        billing_code: Array.isArray(codes) ? codes[0] : codes,
      };
    }
  }
  return null;
}

/** Tomorrow, unique hour slot (8am–7pm) to avoid provider double-booking on re-runs. */
export function tomorrowSessionWindow(seed?: string) {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const n = seed ? parseInt(seed.slice(-4), 10) || 0 : Date.now();
  const hour = 8 + (n % 11);
  const minute = (Math.floor(n / 11) % 4) * 15;
  d.setHours(hour, minute, 0, 0);
  const start = new Date(d);
  d.setHours(hour + 1, minute, 0, 0);
  const end = new Date(d);
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  return {
    sessionDate: start.toISOString().slice(0, 10),
    startDateTime: start.toISOString(),
    endDateTime: end.toISOString(),
    startTZ: tz,
    endTZ: tz,
  };
}
