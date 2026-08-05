/**
 * Authenticated API flow tests — exercises backend-test endpoints in dependency order.
 * Complements UI specs; uses E2E_EMAIL / E2E_PASSWORD from e2e/.env.
 */
import { randomUUID } from "crypto";
import { test, expect, request as playwrightRequest } from "@playwright/test";
import type { APIRequestContext } from "@playwright/test";
import {
  MahaverseApiClient,
  uniqueId,
  pickClientWithAuth,
  pickAuthorization,
  tomorrowSessionWindow,
  type ApiJson,
} from "./helpers/api-client";
import { assertNoSchemaDrift, getApiErrorText } from "./helpers/schema-errors";

test.describe.configure({ mode: "serial" });
test.setTimeout(120_000);

const ctx: {
  ts: string;
  api?: MahaverseApiClient;
  clientId?: string;
  newClientId?: string;
  staffId?: string;
  userEmail?: string;
  sessionId?: string;
  catId?: string;
  masterBehId?: string;
  clientBehId?: string;
  domainId?: string;
  programId?: string;
  targetId?: string;
  facilityTypeId?: string;
  serviceCodeId?: string;
  locationId?: string;
  providerId?: string;
  sessionDate?: string;
  sessionCreated?: boolean;
} = {};

let apiRequest: APIRequestContext;

test.beforeAll(async () => {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;
  if (!email || !password) {
    throw new Error("Set E2E_EMAIL and E2E_PASSWORD in e2e/.env");
  }
  ctx.ts = String(Date.now());
  apiRequest = await playwrightRequest.newContext();
  ctx.api = await MahaverseApiClient.login(apiRequest, email, password);
});

test.afterAll(async () => {
  await apiRequest?.dispose();
});

test("me-permissions + rbac-matrix", async () => {
  const api = ctx.api!;
  await api.expectOk("me-permissions.php");
  await api.expectOk("rbac-matrix.php");
});

test("dashboard-stats + get-all", async () => {
  const api = ctx.api!;
  const { data } = await api.expectOk("dashboard-stats.php");
  const dash = (data.data || data) as ApiJson;
  // Scoped payload (after dashboard-stats.php deploy)
  expect(dash).toHaveProperty("activeClients");
  expect(dash).toHaveProperty("sessionsToday");
  if ("myClients" in dash) {
    expect(typeof dash.myClients).toBe("number");
    expect(["all", "self"]).toContain(dash.scope);
    expect(Array.isArray(dash.todaySessions)).toBe(true);
  }
  await api.expectOk("get-all.php");
});

test("get-clients + pick client", async () => {
  const api = ctx.api!;
  const { data } = await api.expectOk("get-clients.php");
  const clients = (data.clients as ApiJson[]) || [];
  expect(clients.length).toBeGreaterThan(0);
  const picked = pickClientWithAuth(clients);
  ctx.clientId = String(picked.client_id || picked.id);
  expect(ctx.clientId).toBeTruthy();
});

test("update-clients POST (create E2E client)", async () => {
  const api = ctx.api!;
  ctx.newClientId = randomUUID();
  const body = {
    client_id: ctx.newClientId,
    client_uuid: ctx.newClientId,
    first_name: `E2EApi${ctx.ts}`,
    last_name: `Client${ctx.ts}`,
    date_of_birth: "2014-03-20",
    client_status: "New",
    phone: "5555550199",
    email: `e2e.api.${ctx.ts}@mahaverse-test.invalid`,
    archived: 0,
    is_active: true,
    insurances: [],
    authorizations: [],
    addresses: [],
    documents: [],
  };
  const { data: createData } = await api.expectOk(
    "update-clients.php",
    "POST",
    body
  );
  expect(createData.success).toBe(true);
  const { data } = await api.expectOk("get-clients.php");
  const found = ((data.clients as ApiJson[]) || []).some(
    (c) => String(c.client_id) === ctx.newClientId
  );
  expect(found).toBe(true);
});

test("get-users + update-users POST (create E2E user)", async () => {
  const api = ctx.api!;
  await api.expectOk("get-users.php");
  ctx.userEmail = `e2e.user.${ctx.ts}@mahaverse-test.invalid`;
  const body = {
    id: `00000000-0000-4000-8000-${ctx.ts.slice(-12).padStart(12, "0")}`,
    email: ctx.userEmail,
    PASSWORD: "E2eTestPass!99",
    role: "rbt",
    first_name: "E2E",
    last_name: `User${ctx.ts}`,
    is_active: 1,
  };
  await api.expectOk("update-users.php", "POST", body);
});

test("staff GET + POST (create E2E staff)", async () => {
  const api = ctx.api!;
  await api.expectOk("staff.php");
  ctx.staffId = uniqueId("ST_E2E", ctx.ts);
  const body = {
    id: ctx.staffId,
    firstName: "E2E",
    lastName: `Staff${ctx.ts}`,
    staffType: "RBT",
    email: `e2e.staff.${ctx.ts}@mahaverse-test.invalid`,
    dateOfJoining: "2024-01-15",
    status: "Active",
    certifications: [
      {
        certification_type: "RBT",
        certification_number: `CERT${ctx.ts}`,
        issue_date: "2024-01-01",
        expiry_date: "2026-12-31",
      },
    ],
    availability: [],
    documents: [],
  };
  const { data } = await api.expectOk("staff.php", "POST", body);
  expect(data.id || ctx.staffId).toBeTruthy();
});

test("master data reads: behaviors, programs, diagnosis, document-types, treatment-types, facility-types, service-codes, providers", async () => {
  const api = ctx.api!;
  await api.expectOk("behaviors.php");
  await api.expectOk("programs.php");
  await api.expectOk("diagnosis-codes.php");
  await api.expectOk("document-types.php?showArchived=false&showInactive=false");
  await api.expectOk("treatment-types.php?showArchived=false&showInactive=false");
  await api.expectOk("facility-types.php?showArchived=false&showInactive=false");
  await api.expectOk("service-codes.php");
  await api.expectOk("providers.php?showArchived=false");
});

test("behaviors POST (category + master behavior)", async () => {
  const api = ctx.api!;
  ctx.catId = uniqueId("bcat_e2e", ctx.ts);
  ctx.masterBehId = uniqueId("mb_e2e", ctx.ts);
  await api.expectOk("behaviors.php", "POST", {
    categories: [
      {
        id: ctx.catId,
        name: `E2E Cat ${ctx.ts}`,
        description: "Playwright API flow",
        status: "Active",
        archived: 0,
      },
    ],
    behaviors: [
      {
        id: ctx.masterBehId,
        category_id: ctx.catId,
        name: `E2E Beh ${ctx.ts}`,
        goal_name: "Reduce",
        function: "Escape",
        definition: "E2E definition",
        recording_type: "Frequency",
        is_active: 1,
        status: "Active",
        archived: 0,
      },
    ],
  });
});

test("client-behaviors POST + GET", async () => {
  const api = ctx.api!;
  const clientId = ctx.clientId!;
  ctx.clientBehId = uniqueId("cb_e2e", ctx.ts);
  await api.expectOk("client-behaviors.php", "POST", {
    client_id: clientId,
    behaviors: [
      {
        id: ctx.clientBehId,
        master_behavior_id: ctx.masterBehId,
        category_id: ctx.catId,
        name: `E2E Client Beh ${ctx.ts}`,
        goal_name: "Reduce",
        function: "Attention",
        definition: "Client E2E",
        recording_type: "Frequency",
        is_active: 1,
        status: "Active",
        archived: 0,
      },
    ],
  });
  const { data } = await api.expectOk(
    `client-behaviors.php?client_id=${encodeURIComponent(clientId)}`
  );
  const rows = ((data.data as ApiJson)?.behaviors as ApiJson[]) || [];
  expect(rows.some((b) => b.id === ctx.clientBehId)).toBe(true);
});

test("programs POST (domain + program + target)", async () => {
  const api = ctx.api!;
  ctx.domainId = uniqueId("dom_e2e", ctx.ts);
  ctx.programId = uniqueId("prg_e2e", ctx.ts);
  ctx.targetId = uniqueId("tgt_e2e", ctx.ts);
  await api.expectOk("programs.php", "POST", {
    domains: [
      {
        id: ctx.domainId,
        moduleId: "skill-acquisition",
        name: `E2E Domain ${ctx.ts}`,
        description: "API E2E",
        status: "Active",
        archived: 0,
      },
    ],
    programs: [
      {
        id: ctx.programId,
        domainId: ctx.domainId,
        name: `E2E Program ${ctx.ts}`,
        description: "",
        status: "Active",
        archived: 0,
      },
    ],
    activities: [
      {
        id: ctx.targetId,
        programId: ctx.programId,
        name: `E2E Target ${ctx.ts}`,
        goalDescription: "Goal",
        trials: 5,
        activityType: "Discrete Trial",
        instructions: "E2E instructions",
        status: "Active",
        archived: 0,
      },
    ],
  });
});

test("facility-types + service-codes + providers POST", async () => {
  const api = ctx.api!;
  const posCode = String(900 + (parseInt(ctx.ts, 10) % 99));
  await api.expectOk("facility-types.php", "POST", {
    pos_code: posCode,
    facility_name: `E2E Facility ${ctx.ts}`,
    description: "E2E",
    active: 1,
  });

  const code = `E2E${ctx.ts.slice(-6)}`;
  const { data: scData } = await api.expectOk("service-codes.php", "POST", {
    code,
    code_description: `E2E service ${ctx.ts}`,
  });
  ctx.serviceCodeId = String(scData.code_id || code);

  await api.expectOk("providers.php", "POST", {
    provider_name: `E2E Provider ${ctx.ts}`,
    provider_code: `PRV${ctx.ts.slice(-6)}`,
    status: "Active",
  });
});

test("locations POST + GET", async () => {
  const api = ctx.api!;
  const body = {
    tax_id_professional: "12-3456789",
    office_phone_number: "5555550100",
    location_name: `E2E Loc ${ctx.ts}`,
    facility_type: "Office",
    facility_npi_number: "1234567890",
    facility_name: `E2E Facility ${ctx.ts}`,
    facility_address: "100 Test St",
    facility_country: "USA",
    facility_city: "Chicago",
    facility_state: "IL",
    facility_zip_code: "60601",
    taxonomy_code: "103K00000X",
  };
  const { data } = await api.expectOk("locations.php", "POST", body);
  ctx.locationId = String(data.id || "");
  await api.expectOk("locations.php?showArchived=false");
});

test("reports GET + payer-payment-entries GET", async () => {
  const api = ctx.api!;
  await api.expectOk("reports.php?archived=0");
  await api.expectOk(
    "reports.php?archived=0&context=schedule_tracker"
  );
  await api.expectOk("payer-payment-entries.php");
});

test("client-modules GET", async () => {
  const api = ctx.api!;
  const { data } = await api.expectOk(
    `client-modules.php?client_id=${encodeURIComponent(ctx.clientId!)}`
  );
  expect(data.success).toBe(true);
});

test("add-session GET + POST (schedule session)", async () => {
  const api = ctx.api!;
  await api.expectOk("add-session.php");

  const { data: clientsData } = await api.expectOk("get-clients.php");
  const clients = (clientsData.clients as ApiJson[]) || [];
  const client =
    clients.find((c) => String(c.client_id || c.id) === ctx.clientId) ||
    pickClientWithAuth(clients);
  const clientId = String(client.client_id || client.id);
  ctx.clientId = clientId;
  const auth = pickAuthorization(client);
  const { data: staffData } = await api.expectOk("staff.php");
  const staffRows = (staffData.staff_records as ApiJson[]) || [];
  expect(staffRows.length).toBeGreaterThan(0);
  const provider =
    staffRows.find((s) => String(s.id) === ctx.staffId) ||
    staffRows[staffRows.length - 1];
  const win = tomorrowSessionWindow(ctx.ts);
  ctx.sessionDate = win.sessionDate;

  const authPk =
    auth?.auth_id ?? auth?.id ?? client.insurances?.[0]?.auth_id ?? null;
  const authCode =
    auth?.billing_code ??
    auth?.auth_code ??
    (Array.isArray(auth?.billing_codes)
      ? auth.billing_codes[0]
      : auth?.billing_codes) ??
    "97153";

  const payload: ApiJson = {
    clientId,
    clientName: `${client.first_name || ""} ${client.last_name || ""}`.trim(),
    provider: String(provider.id),
    providerName: String(provider.fullName || provider.full_name || "Provider"),
    startDateTime: win.startDateTime,
    endDateTime: win.endDateTime,
    startTZ: win.startTZ,
    endTZ: win.endTZ,
    authCode: String(authCode),
    authId: authPk != null ? Number(authPk) : null,
    placeOfService: "Clinic",
    locationAddress: "100 E2E Test St, Chicago, IL 60601",
    quickNote: `E2E session ${ctx.ts}`,
    status: "Scheduled",
    recurring: { frequency: "No", days: [], ends: { type: "Never", date: null, occurrences: null } },
    scheduled_hours: 1,
    rendered_hours: 0,
  };

  if (payload.authId == null || Number.isNaN(payload.authId as number)) {
    test.skip(true, "No billing authorization on test client — add auth in test DB");
  }

  const res = await api.post("add-session.php", payload);
  const data = await api.json(res);
  assertNoSchemaDrift(data, "add-session.php", res.status());
  if (!res.ok()) {
    const err = getApiErrorText(data);
    expect(res.ok(), `POST add-session.php → ${res.status()} ${err}`).toBeTruthy();
  }
  expect(data.success, String(data.error || "")).toBeTruthy();
  ctx.sessionId = String(data.session_id || "");
  ctx.sessionCreated = true;
  expect(ctx.sessionId).toBeTruthy();
});

test("session-notes POST + GET (behavior reduction + skill)", async () => {
  const api = ctx.api!;
  if (!ctx.sessionCreated) {
    test.skip(true, "Skipped — add-session did not run (see prior skip)");
  }
  const clientId = ctx.clientId!;
  const sessionDate = ctx.sessionDate || "2026-06-15";

  await api.expectOk("session-notes.php", "POST", {
    client_id: clientId,
    session_date: sessionDate,
    session_notes: {
      soapDate: sessionDate,
      behaviorReductionData: [
        {
          id: ctx.clientBehId,
          behaviorName: `E2E Client Beh ${ctx.ts}`,
          recordingType: "Frequency",
          dataToday: 2,
          durationSeconds: 0,
          rateCount: 0,
          intervalMarks: [],
          savedAt: new Date().toISOString(),
        },
      ],
      skillAcquisitionData: ctx.targetId
        ? [
            {
              id: `skill_${ctx.ts}`,
              programId: ctx.programId,
              programName: `E2E Program ${ctx.ts}`,
              targetId: ctx.targetId,
              targetName: `E2E Target ${ctx.ts}`,
              value: "4/5 trials correct",
              savedAt: new Date().toISOString(),
            },
          ]
        : [],
      abcData: [],
    },
  });

  const { data } = await api.expectOk(
    `session-notes.php?client_id=${encodeURIComponent(clientId)}&session_date=${encodeURIComponent(sessionDate)}`
  );
  const notes = ((data.data as ApiJson)?.session_notes as ApiJson) || {};
  const br = (notes.behaviorReductionData as ApiJson[]) || [];
  expect(br.length).toBeGreaterThan(0);
});

test("session-notes trial POST (skill acquisition)", async () => {
  const api = ctx.api!;
  if (!ctx.sessionCreated) {
    test.skip(true, "Skipped — add-session did not run (see prior skip)");
  }
  const clientId = ctx.clientId!;
  const sessionDate = ctx.sessionDate || "2026-06-15";

  const { data: modulesData } = await api.expectOk(
    `client-modules.php?client_id=${encodeURIComponent(clientId)}`
  );
  const activities =
    ((modulesData.data as ApiJson)?.activities as ApiJson[]) || [];
  if (!activities.length) {
    test.skip(true, "Client has no targets/activities — assign programs in test DB");
    return;
  }
  const targetId = String(activities[0].id);

  await api.expectOk("session-notes.php", "POST", {
    client_id: clientId,
    target_id: targetId,
    session_date: sessionDate,
    trial_outcome: "Correct",
    notes: `E2E trial ${ctx.ts}`,
  });
  const { data } = await api.expectOk(
    `session-notes.php?client_id=${encodeURIComponent(clientId)}&target_id=${encodeURIComponent(targetId)}&session_date=${encodeURIComponent(sessionDate)}`
  );
  const trials = (data.data as ApiJson[]) || [];
  expect(trials.length).toBeGreaterThan(0);
});

test("provider-service-codes GET", async () => {
  const api = ctx.api!;
  await api.expectOk("provider-service-codes.php");
});
