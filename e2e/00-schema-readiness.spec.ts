/**
 * Fast migration / schema probes — runs before api-endpoints (file order).
 * Fails (never skips) on Unknown column / missing table so prod cannot look "green" while broken.
 */
import { randomUUID } from "crypto";
import { test, expect, request as playwrightRequest } from "@playwright/test";
import type { APIRequestContext } from "@playwright/test";
import {
  MahaverseApiClient,
  pickClientWithAuth,
  pickAuthorization,
  tomorrowSessionWindow,
  type ApiJson,
} from "./helpers/api-client";
import { assertNoSchemaDrift, getApiErrorText } from "./helpers/schema-errors";

test.describe.configure({ mode: "serial" });
test.setTimeout(90_000);

const target = () => process.env.E2E_TARGET || "test";

let apiRequest: APIRequestContext;
let api: MahaverseApiClient;
const ts = String(Date.now());

test.beforeAll(async () => {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;
  if (!email || !password) {
    throw new Error("Set E2E_EMAIL and E2E_PASSWORD in e2e/.env");
  }
  apiRequest = await playwrightRequest.newContext();
  api = await MahaverseApiClient.login(apiRequest, email, password);
});

test.afterAll(async () => {
  await apiRequest?.dispose();
});

async function probeGet(path: string, label: string) {
  const res = await api.get(path);
  const data = await api.json(res);
  assertNoSchemaDrift(data, label, res.status());
  expect(res.ok(), `${label} GET ${path} → ${res.status()} ${getApiErrorText(data)}`).toBeTruthy();
}

async function probePost(path: string, body: ApiJson, label: string) {
  const res = await api.post(path, body);
  const data = await api.json(res);
  assertNoSchemaDrift(data, label, res.status());
  return { res, data };
}

test("auth + RBAC tables (login, me-permissions, rbac-matrix)", async () => {
  await probeGet("me-permissions.php", "RBAC (#2–3)");
  await probeGet("rbac-matrix.php", "RBAC matrix");
});

test("clients is_active column (update-clients POST)", async () => {
  const id = randomUUID();
  const { res, data } = await probePost(
    "update-clients.php",
    {
      client_id: id,
      client_uuid: id,
      first_name: `Schema${ts}`,
      last_name: "Probe",
      date_of_birth: "2015-01-01",
      client_status: "New",
      archived: 0,
      is_active: true,
      insurances: [],
      authorizations: [],
      addresses: [],
      documents: [],
    },
    "clients.is_active (#4 prod status varchar uses client_status)"
  );
  expect(res.ok(), getApiErrorText(data)).toBeTruthy();
  expect(data.success, getApiErrorText(data)).toBeTruthy();
});

test("behavior reduction tables (behaviors GET)", async () => {
  await probeGet("behaviors.php", "behavior tables (#11–12)");
});

test("domains module_id (programs GET)", async () => {
  await probeGet("programs.php", "domains.module_id (#10)");
});

test("schedule tracker + payer payments (reports, payer-payment-entries)", async () => {
  await probeGet("reports.php?archived=0&context=schedule_tracker", "schedule tracker (#8)");
  await probeGet("payer-payment-entries.php", "payer payments (#8)");
});

test("sessions columns: recurring_id, auth_id, authorized_hours (add-session POST)", async () => {
  const { data: clientsData } = await api.expectOk("get-clients.php");
  const clients = (clientsData.clients as ApiJson[]) || [];
  expect(clients.length, "need at least one client").toBeGreaterThan(0);
  const client = pickClientWithAuth(clients);
  const auth = pickAuthorization(client);
  const authPk =
    auth?.auth_id ?? auth?.id ?? (client.insurances as ApiJson[])?.[0]?.auth_id ?? null;

  if (authPk == null || Number.isNaN(Number(authPk))) {
    expect.fail(
      `Cannot probe sessions schema on ${target()}: no client with billing authorization. ` +
        "Add an active authorization in this DB (data gap, not a migration skip)."
    );
  }

  const { data: staffData } = await api.expectOk("staff.php");
  const staff = ((staffData.staff_records as ApiJson[]) || [])[0];
  expect(staff, "need at least one staff/provider").toBeTruthy();

  const win = tomorrowSessionWindow(ts);
  const { res, data } = await probePost(
    "add-session.php",
    {
      clientId: String(client.client_id || client.id),
      clientName: "Schema Probe",
      provider: String(staff.id),
      providerName: String(staff.fullName || staff.full_name || "Provider"),
      startDateTime: win.startDateTime,
      endDateTime: win.endDateTime,
      startTZ: win.startTZ,
      endTZ: win.endTZ,
      authCode: String(auth?.billing_code ?? auth?.auth_code ?? "97153"),
      authId: Number(authPk),
      placeOfService: "Clinic",
      locationAddress: "1 Schema Probe St",
      quickNote: `schema-readiness ${ts}`,
      status: "Scheduled",
      recurring: {
        frequency: "No",
        days: [],
        ends: { type: "Never", date: null, occurrences: null },
      },
      scheduled_hours: 1,
      rendered_hours: 0,
    },
    "sessions recurring_id / auth_id / hours (#6–7)"
  );

  if (!res.ok() || !data.success) {
    const err = getApiErrorText(data);
    if (/double-booked|conflict|overlap/i.test(err)) {
      test.info().annotations.push({
        type: "note",
        description: `add-session conflict (retry OK): ${err}`,
      });
      return;
    }
    expect(res.ok(), `add-session → ${res.status()} ${err}`).toBeTruthy();
    expect(data.success, err).toBeTruthy();
  }
  expect(String(data.session_id || "")).toBeTruthy();
});

test("session_notes table (session-notes POST minimal)", async () => {
  const clientId = "00000000-0000-4000-8000-000000000001";
  const sessionDate = "2099-01-01";
  const { res, data } = await probePost(
    "session-notes.php",
    {
      client_id: clientId,
      session_date: sessionDate,
      session_notes: { soapDate: sessionDate, behaviorReductionData: [], skillAcquisitionData: [] },
    },
    "session_notes table (create-session-notes-table)"
  );
  if (!res.ok()) {
    const err = getApiErrorText(data);
    if (/client|not found|invalid/i.test(err) && !/Unknown column|doesn't exist/i.test(err)) {
      test.info().annotations.push({
        type: "note",
        description: `session-notes accepted schema path; business rule: ${err}`,
      });
      return;
    }
  }
  expect(res.ok(), getApiErrorText(data)).toBeTruthy();
});
