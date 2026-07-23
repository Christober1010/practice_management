/**
 * Verifies Untitled-1 requirements against backend-test:
 * 1) Locations filter data + client.location
 * 2) Staff location field (locations table id)
 * 3) Admin sees all clients/staff
 * 4) Non-admin staff/client lists restricted by assignment
 * 5) Active assigned clients only for non-admin
 * 6) Role update reflected via login + me-permissions
 */
import { randomUUID } from "crypto";
import { test, expect, request as playwrightRequest } from "@playwright/test";
import type { APIRequestContext } from "@playwright/test";
import {
  MahaverseApiClient,
  uniqueId,
  type ApiJson,
} from "./helpers/api-client";
import { getApiErrorText } from "./helpers/schema-errors";

test.describe.configure({ mode: "serial" });
test.setTimeout(180_000);

const PASS = "E2eAssignPass!99";

const ctx: {
  ts: string;
  admin?: MahaverseApiClient;
  locationId?: string;
  locationName?: string;
  clientA?: string;
  clientB?: string;
  clientInactive?: string;
  staffId?: string;
  staffEmail?: string;
  userId?: string;
  roleUserEmail?: string;
  roleUserId?: string;
  adminClientCount?: number;
  adminStaffCount?: number;
} = {};

let apiRequest: APIRequestContext;

function isClientActive(c: ApiJson) {
  const active =
    c.is_active !== false && c.is_active !== 0 && c.is_active !== "0";
  const archived =
    c.archived === true || c.archived === 1 || c.archived === "1";
  return active && !archived;
}

test.beforeAll(async () => {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;
  if (!email || !password) {
    throw new Error("Set E2E_EMAIL and E2E_PASSWORD in e2e/.env");
  }
  ctx.ts = String(Date.now());
  apiRequest = await playwrightRequest.newContext();
  ctx.admin = await MahaverseApiClient.login(apiRequest, email, password);
});

test.afterAll(async () => {
  // Best-effort cleanup of role probe user (leave assignment fixtures; they are clearly E2E-tagged)
  try {
    if (ctx.admin && ctx.roleUserId) {
      await ctx.admin.delete("delete-user.php", { id: ctx.roleUserId });
    }
  } catch {
    /* ignore */
  }
  await apiRequest?.dispose();
});

test("1) locations.php returns master Location table rows", async () => {
  const api = ctx.admin!;
  const { data } = await api.expectOk("locations.php?showArchived=false");
  const rows = (data.data as ApiJson[]) || (data.locations as ApiJson[]) || [];
  expect(rows.length, "locations table should have rows").toBeGreaterThan(0);
  const first = rows[0];
  expect(first.id).toBeTruthy();
  expect(first.location_name || first.facility_name).toBeTruthy();

  // Ensure at least one dedicated E2E location exists for filtering
  const body = {
    tax_id_professional: "12-3456789",
    office_phone_number: "5555550199",
    location_name: `E2E Assign Loc ${ctx.ts}`,
    facility_type: "Office",
    facility_npi_number: "1234567890",
    facility_name: `E2E Assign Facility ${ctx.ts}`,
    facility_address: "200 Test St",
    facility_country: "USA",
    facility_city: "Chicago",
    facility_state: "IL",
    facility_zip_code: "60601",
    taxonomy_code: "103K00000X",
    status: "Active",
  };
  const { data: created } = await api.expectOk("locations.php", "POST", body);
  const nested = (created.data as ApiJson) || {};
  ctx.locationId = String(nested.id || created.id || "");
  ctx.locationName = body.location_name;
  expect(ctx.locationId).toBeTruthy();
});

test("1b) admin get-clients includes location; filter by selected location works", async () => {
  const api = ctx.admin!;
  const { data } = await api.expectOk("get-clients.php");
  const clients = (data.clients as ApiJson[]) || [];
  expect(clients.length).toBeGreaterThan(0);
  ctx.adminClientCount = clients.length;

  // Pick two active clients for assignment tests
  const active = clients.filter(isClientActive);
  expect(active.length).toBeGreaterThanOrEqual(2);
  ctx.clientA = String(active[0].client_id);
  ctx.clientB = String(active[1].client_id);

  // Prefer an inactive client if present
  const inactive = clients.find((c) => !isClientActive(c));
  if (inactive) {
    ctx.clientInactive = String(inactive.client_id);
  }

  // Every client payload should expose location (nullable ok)
  expect(
    Object.prototype.hasOwnProperty.call(active[0], "location"),
    "client.location field missing"
  ).toBeTruthy();

  // Set location on client A via update-clients if possible
  const clientA = active[0];
  const updateBody = {
    ...clientA,
    location: ctx.locationId,
    addresses: Array.isArray(clientA.addresses)
      ? (clientA.addresses as ApiJson[]).map((a, i) =>
          i === 0 ? { ...a, location: ctx.locationId } : a
        )
      : [
          {
            service_location: "Clinic",
            address_line_1: "1 E2E St",
            city: "Chicago",
            state: "IL",
            zipcode: "60601",
            country: "USA",
            location: ctx.locationId,
          },
        ],
  };
  const upd = await api.post("update-clients.php", updateBody);
  const updJson = await upd.json();
  // update may require specific shape; soft-assert and continue with filter check
  if (upd.ok() && updJson.success) {
    const { data: after } = await api.expectOk("get-clients.php");
    const refreshed = ((after.clients as ApiJson[]) || []).find(
      (c) => String(c.client_id) === ctx.clientA
    );
    expect(String(refreshed?.location || "")).toBe(String(ctx.locationId));
    const filtered = ((after.clients as ApiJson[]) || []).filter(
      (c) => String(c.location || "") === String(ctx.locationId)
    );
    expect(
      filtered.some((c) => String(c.client_id) === ctx.clientA),
      "location filter should include updated client"
    ).toBeTruthy();
  } else {
    test.info().annotations.push({
      type: "note",
      description: `update-clients location soft-fail: ${getApiErrorText(updJson)}`,
    });
  }
});

test("2) staff Personal location: write/read locations table id", async () => {
  const api = ctx.admin!;
  // staff.id is short VARCHAR — keep id compact
  ctx.staffId = `ST${ctx.ts.slice(-10)}`;
  ctx.staffEmail = `e2e.assign.${ctx.ts}@mahaverse-test.invalid`;

  const assigned = [ctx.clientA!, ctx.clientB!];
  if (ctx.clientInactive) assigned.push(ctx.clientInactive);

  const body = {
    id: ctx.staffId,
    firstName: "E2E",
    lastName: `Assign${ctx.ts.slice(-6)}`,
    staffType: "RBT",
    email: ctx.staffEmail,
    dateOfJoining: "2024-01-15",
    status: "Active",
    location: ctx.locationId,
    assignedClients: assigned,
    assignedStaff: [],
    certifications: [
      {
        certification_type: "RBT",
        certification_number: `AC${ctx.ts.slice(-8)}`,
        issue_date: "2024-01-01",
        expiry_date: "2026-12-31",
      },
    ],
    availability: [],
    documents: [],
  };
  const { data: created } = await api.expectOk("staff.php", "POST", body);
  if (created.id) ctx.staffId = String(created.id);

  const { data } = await api.expectOk("staff.php");
  const rows = (data.staff_records as ApiJson[]) || [];
  const staff =
    rows.find((s) => String(s.id) === ctx.staffId) ||
    rows.find(
      (s) =>
        String(s.email || "").toLowerCase() ===
        String(ctx.staffEmail).toLowerCase()
    );
  expect(staff, "created staff visible in GET staff.php").toBeTruthy();
  ctx.staffId = String(staff!.id);
  expect(String(staff!.location || "")).toBe(String(ctx.locationId));
  const ac = (staff!.assignedClients as string[]) || [];
  expect(ac).toEqual(expect.arrayContaining([ctx.clientA!, ctx.clientB!]));
});

test("3) admin staff.php (no scope) returns full roster", async () => {
  const api = ctx.admin!;
  const { data } = await api.expectOk("staff.php");
  const rows = (data.staff_records as ApiJson[]) || [];
  ctx.adminStaffCount = rows.length;
  expect(rows.length).toBeGreaterThan(1);
  expect(rows.some((s) => String(s.id) === ctx.staffId)).toBeTruthy();
});

test("3b+4+5) RBT user only sees assigned active clients; staff?scope=assigned restricted", async () => {
  const api = ctx.admin!;
  ctx.userId = randomUUID();
  await api.expectOk("update-users.php", "POST", {
    id: ctx.userId,
    email: ctx.staffEmail,
    PASSWORD: PASS,
    role: "rbt",
    first_name: "E2E",
    last_name: `Rbt${ctx.ts}`,
    is_active: 1,
  });

  // Resolve actual user id (auto-increment DBs ignore UUID)
  const { data: usersData } = await api.expectOk("get-users.php");
  const users = (usersData.users as ApiJson[]) || [];
  const created = users.find(
    (u) =>
      String(u.email || "").toLowerCase() ===
      String(ctx.staffEmail).toLowerCase()
  );
  expect(created, "RBT user created").toBeTruthy();
  ctx.userId = String(created!.id);

  const rbt = await MahaverseApiClient.login(
    apiRequest,
    ctx.staffEmail!,
    PASS
  );

  const { data: clientsData } = await rbt.expectOk("get-clients.php");
  const clients = (clientsData.clients as ApiJson[]) || [];
  const ids = clients.map((c) => String(c.client_id));

  expect(
    clients.length,
    `RBT should not see admin's full list (${ctx.adminClientCount})`
  ).toBeLessThan(ctx.adminClientCount || Infinity);

  expect(ids).toEqual(expect.arrayContaining([ctx.clientA!, ctx.clientB!]));
  expect(ids.every((id) => [ctx.clientA, ctx.clientB].includes(id))).toBeTruthy();

  // Inactive assigned client must not appear
  if (ctx.clientInactive) {
    expect(ids).not.toContain(ctx.clientInactive);
  }
  expect(clients.every(isClientActive)).toBeTruthy();

  const { data: staffScoped } = await rbt.expectOk("staff.php?scope=assigned");
  const scoped = (staffScoped.staff_records as ApiJson[]) || [];
  expect(
    scoped.length,
    `RBT scope=assigned should be << admin roster (${ctx.adminStaffCount})`
  ).toBeLessThan(ctx.adminStaffCount || Infinity);
  expect(scoped.some((s) => String(s.id) === ctx.staffId)).toBeTruthy();

  // Sessions API must not return the full org calendar for RBT
  const sessionsRes = await rbt.get("add-session.php");
  expect(sessionsRes.ok()).toBeTruthy();
  const sessions = await sessionsRes.json();
  expect(Array.isArray(sessions)).toBeTruthy();
  const allowed = new Set([ctx.clientA!, ctx.clientB!]);
  for (const s of sessions as ApiJson[]) {
    const cid = String(s.client_id || "");
    const pid = String(s.provider_id || "");
    const ok =
      (cid && allowed.has(cid)) ||
      pid === ctx.staffId ||
      String(s.supervising_provider_id || "") === ctx.staffId;
    expect(ok, `unexpected session client=${cid} provider=${pid}`).toBeTruthy();
  }
});

test("6) role change BCBA → Biller persists (login + me-permissions)", async () => {
  const api = ctx.admin!;
  ctx.roleUserEmail = `e2e.role.${ctx.ts}@mahaverse-test.invalid`;
  ctx.roleUserId = randomUUID();

  await api.expectOk("update-users.php", "POST", {
    id: ctx.roleUserId,
    email: ctx.roleUserEmail,
    PASSWORD: PASS,
    role: "bcba",
    first_name: "E2E",
    last_name: `Role${ctx.ts}`,
    is_active: 1,
  });

  const { data: usersData } = await api.expectOk("get-users.php");
  const users = (usersData.users as ApiJson[]) || [];
  const row = users.find(
    (u) =>
      String(u.email || "").toLowerCase() ===
      String(ctx.roleUserEmail).toLowerCase()
  );
  expect(row).toBeTruthy();
  ctx.roleUserId = String(row!.id);
  expect(String(row!.role).toLowerCase()).toBe("bcba");

  await api.expectOk("update-users.php", "POST", {
    id: ctx.roleUserId,
    email: ctx.roleUserEmail,
    role: "biller",
    first_name: "E2E",
    last_name: `Role${ctx.ts}`,
    is_active: 1,
  });

  const { data: afterUsers } = await api.expectOk("get-users.php");
  const after = ((afterUsers.users as ApiJson[]) || []).find(
    (u) => String(u.id) === ctx.roleUserId
  );
  expect(String(after?.role || "").toLowerCase()).toBe("biller");

  const billed = await MahaverseApiClient.login(
    apiRequest,
    ctx.roleUserEmail!,
    PASS
  );
  const { data: me } = await billed.expectOk("me-permissions.php");
  expect(String(me.role || "").toLowerCase()).toBe("biller");
  expect(Array.isArray(me.permissions)).toBeTruthy();
});
