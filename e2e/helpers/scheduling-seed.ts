import { expect, request as playwrightRequest } from "@playwright/test";
import type { APIRequestContext } from "@playwright/test";
import {
  MahaverseApiClient,
  pickAuthorization,
  pickClientWithAuth,
  tomorrowSessionWindow,
  uniqueId,
  type ApiJson,
} from "./api-client";

export type SchedulingFlowSeed = {
  ts: string;
  clientId: string;
  clientName: string;
  clientFirst: string;
  clientLast: string;
  providerId: string;
  providerName: string;
  staffFirst: string;
  staffLast: string;
  authId: number;
  authNumber: string;
  serviceCode: string;
  billingLabel: string;
  locationValue: string;
  sessionDate: string;
  quickNote: string;
  sessionId: string;
  clientBehId: string;
};

function clientDisplayName(c: ApiJson): string {
  return `${c.first_name || ""} ${c.last_name || ""}`.trim();
}

function formatClientAddress(addr: ApiJson): string {
  return [
    addr.address_line_1,
    addr.address_line_2,
    addr.city,
    addr.state,
    addr.zipcode,
    addr.country,
  ]
    .filter(Boolean)
    .map(String)
    .join(", ");
}

function clientLocationAddress(c: ApiJson): string {
  const addrs = (c.addresses as ApiJson[]) || [];
  for (const addr of addrs) {
    const formatted = formatClientAddress(addr);
    if (formatted) return formatted;
  }
  return "100 E2E Test St, Chicago, IL 60601";
}

function pickClientWithAuthForScheduling(clients: ApiJson[]): ApiJson {
  for (const c of clients) {
    const auths = (c.authorizations as ApiJson[]) || [];
    const hasAuth =
      auths.length > 0 ||
      ((c.insurances as ApiJson[]) || []).some(
        (i) => i.billing_codes || i.auth_id
      );
    if (hasAuth) return c;
  }
  return pickClientWithAuth(clients);
}

/** Today + pseudo-random hour/minute from seed (spread provider bookings). */
export function todaySessionWindow(seed: string) {
  const d = new Date();
  const n = parseInt(seed.replace(/\D/g, "").slice(-8), 10) || Date.now();
  const hour = 7 + (n % 12);
  const minute = (Math.floor(n / 12) % 4) * 15;
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
    startLocal: toDatetimeLocal(start),
    endLocal: toDatetimeLocal(end),
  };
}

function toDatetimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function tomorrowLocalWindow(seed: string) {
  const win = tomorrowSessionWindow(seed);
  const start = new Date(win.startDateTime);
  const end = new Date(win.endDateTime);
  return { ...win, startLocal: toDatetimeLocal(start), endLocal: toDatetimeLocal(end) };
}

/**
 * API setup for scheduling + session notes UI flows: client with auth/address,
 * client behavior, and a scheduled session tagged with a unique quick note.
 */
export async function seedSchedulingFlow(
  email: string,
  password: string
): Promise<SchedulingFlowSeed> {
  const ts = String(Date.now());
  const apiRequest: APIRequestContext = await playwrightRequest.newContext();
  try {
    const api = await MahaverseApiClient.login(apiRequest, email, password);

    const { data: clientsData } = await api.expectOk("get-clients.php");
    const clients = (clientsData.clients as ApiJson[]) || [];
    const client = pickClientWithAuthForScheduling(clients);

    const clientId = String(client.client_id || client.id);
    const clientFirst = String(client.first_name || "").trim();
    const clientLast = String(client.last_name || "").trim();
    const mid = String(client.middle_name || "").trim();
    const clientName = mid
      ? `${clientFirst} ${mid} ${clientLast}`.trim()
      : clientDisplayName(client);
    const auth = pickAuthorization(client);
    const authPk = Number(auth?.auth_id ?? auth?.id ?? NaN);
    if (!Number.isFinite(authPk)) {
      throw new Error("E2E seed: selected client has no authorization PK");
    }
    const authNumber = String(
      auth?.authorization_number || auth?.auth_number || authPk
    );
    const serviceCode = String(
      auth?.billing_code ??
        (Array.isArray(auth?.billing_codes)
          ? auth?.billing_codes[0]
          : auth?.billing_codes) ??
        "97153"
    );

    const locationValue = clientLocationAddress(client);

    const billingLabel = serviceCode;

    const { data: staffData } = await api.expectOk("staff.php");
    const staffRows = ((staffData.staff_records as ApiJson[]) || []).filter(
      (s) => String(s.status) === "Active" && String(s.archived) !== "1"
    );
    if (!staffRows.length) throw new Error("E2E seed: no active staff");
    const provider =
      staffRows[parseInt(ts, 10) % staffRows.length] ?? staffRows[0];
    const providerId = String(provider.id);
    const providerName = String(provider.fullName || provider.full_name || "Provider");
    const nameParts = providerName.trim().split(/\s+/);
    const staffFirst = String(provider.firstName || provider.first_name || nameParts[0] || "E2E").trim();
    const staffLast = String(
      provider.lastName || provider.last_name || nameParts.slice(1).join(" ") || "Staff"
    ).trim();

    const catId = uniqueId("bcat_flow", ts);
    const masterBehId = uniqueId("mb_flow", ts);
    const clientBehId = uniqueId("cb_flow", ts);

    await api.expectOk("behaviors.php", "POST", {
      categories: [
        {
          id: catId,
          name: `E2E Flow Cat ${ts}`,
          description: "Playwright scheduling flow",
          status: "Active",
          archived: 0,
        },
      ],
      behaviors: [
        {
          id: masterBehId,
          category_id: catId,
          name: `E2E Flow Beh ${ts}`,
          goal_name: "Reduce",
          function: "Escape",
          definition: "E2E flow behavior",
          recording_type: "Frequency",
          is_active: 1,
          status: "Active",
          archived: 0,
        },
      ],
    });

    await api.expectOk("client-behaviors.php", "POST", {
      client_id: clientId,
      behaviors: [
        {
          id: clientBehId,
          master_behavior_id: masterBehId,
          category_id: catId,
          name: `E2E Flow Client Beh ${ts}`,
          goal_name: "Reduce",
          function: "Escape",
          definition: "Flow",
          recording_type: "Frequency",
          is_active: 1,
          status: "Active",
          archived: 0,
        },
      ],
    });

    const quickNote = `E2E scheduling flow ${ts}`;

    let sessionData: ApiJson = {};
    let sessionDate = new Date().toISOString().slice(0, 10);
    let lastErr = "";
    for (let attempt = 0; attempt < 6; attempt++) {
      const slot = todaySessionWindow(`${ts}_${attempt}`);
      const res = await api.post("add-session.php", {
        clientId,
        clientName,
        provider: providerId,
        providerName,
        startDateTime: slot.startDateTime,
        endDateTime: slot.endDateTime,
        startTZ: slot.startTZ,
        endTZ: slot.endTZ,
        authCode: billingLabel,
        authId: authPk,
        placeOfService: "Clinic",
        locationAddress: locationValue,
        quickNote,
        status: "Scheduled",
        recurring: {
          frequency: "No",
          days: [],
          ends: { type: "Never", date: null, occurrences: null },
        },
        scheduled_hours: 1,
        rendered_hours: 0,
      });
      sessionData = await api.json(res);
      if (res.ok() && sessionData.success) {
        sessionDate = slot.sessionDate;
        break;
      }
      lastErr = String(sessionData.error || sessionData.message || res.status());
      if (!/booked|double|conflict|409/i.test(lastErr)) {
        expect(res.ok(), lastErr).toBeTruthy();
      }
    }
    expect(sessionData.success, lastErr || "add-session seed failed").toBeTruthy();

    return {
      ts,
      clientId,
      clientName,
      clientFirst,
      clientLast,
      providerId,
      providerName,
      staffFirst,
      staffLast,
      authId: authPk,
      authNumber,
      serviceCode,
      billingLabel,
      locationValue,
      sessionDate,
      quickNote,
      sessionId: String(sessionData.session_id || ""),
      clientBehId,
    };
  } finally {
    await apiRequest.dispose();
  }
}
