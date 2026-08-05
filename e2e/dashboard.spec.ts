import { test, expect } from "@playwright/test";
import { randomUUID } from "crypto";
import { gotoApp } from "./helpers/navigation";
import { MahaverseApiClient, type ApiJson } from "./helpers/api-client";

const PASS = "E2eDashPass!99";

function pickActiveClients(clients: ApiJson[], n: number): string[] {
  const ids: string[] = [];
  for (const c of clients) {
    const archived = c.archived === true || c.archived === 1 || c.archived === "1";
    const inactive = c.is_active === false || c.is_active === 0 || c.is_active === "0";
    if (archived || inactive) continue;
    const id = String(c.client_id || c.id || "");
    if (!id) continue;
    ids.push(id);
    if (ids.length >= n) break;
  }
  return ids;
}

test.describe("Dashboard", () => {
  test("loads admin dashboard with live stats (Christober)", async ({ page }) => {
    await gotoApp(page);
    await page.getByRole("link", { name: "Dashboard" }).click();
    await expect(
      page.getByRole("heading", { name: "Admin Dashboard" })
    ).toBeVisible();
    await expect(page.getByText("Active Clients")).toBeVisible();
  });

  test("new BCBA test account sees only assigned clients on dashboard", async ({
    page,
    request,
  }) => {
    const email = process.env.E2E_EMAIL;
    const password = process.env.E2E_PASSWORD;
    test.skip(!email || !password, "Set E2E_EMAIL and E2E_PASSWORD");

    const admin = await MahaverseApiClient.login(request, email!, password!);

    const { data: clientsData } = await admin.expectOk("get-clients.php");
    const clients = (clientsData.clients as ApiJson[]) || [];
    const assigned = pickActiveClients(clients, 2);
    expect(assigned.length, "need 2 active clients to assign").toBe(2);

    const ts = String(Date.now());
    const staffEmail = `e2e.dash.bcba.${ts}@mahaverse-test.invalid`;
    const staffId = `ST${ts.slice(-10)}`;

    const { data: createdStaff } = await admin.expectOk("staff.php", "POST", {
      id: staffId,
      firstName: "E2E",
      lastName: `DashBcba${ts.slice(-6)}`,
      staffType: "BCBA",
      email: staffEmail,
      dateOfJoining: "2024-01-15",
      status: "Active",
      assignedClients: assigned,
      assignedStaff: [],
      certifications: [
        {
          certification_type: "BCBA",
          certification_number: `DB${ts.slice(-8)}`,
          issue_date: "2024-01-01",
          expiry_date: "2026-12-31",
        },
      ],
      availability: [],
      documents: [],
    });
    const resolvedStaffId = String(createdStaff.id || staffId);

    await admin.expectOk("update-users.php", "POST", {
      id: randomUUID(),
      email: staffEmail,
      PASSWORD: PASS,
      role: "bcba",
      first_name: "E2E",
      last_name: `DashBcba${ts.slice(-6)}`,
      is_active: 1,
    });

    const bcba = await MahaverseApiClient.login(request, staffEmail, PASS);
    const { data } = await bcba.expectOk("dashboard-stats.php");
    const dash = (data.data || data) as ApiJson;

    expect(String(dash.role || "").toLowerCase()).toBe("bcba");
    expect(dash.scope).toBe("self");
    expect(Number(dash.myClients)).toBe(2);
    expect(Number(dash.activeClients)).toBe(2);
    expect(Number(dash.activeStaff || 0)).toBe(0);
    expect(Array.isArray(dash.todaySessions)).toBe(true);
    // Staff id should resolve via matching email
    expect(String(dash.staff_id || "")).toBe(resolvedStaffId);

    // UI: inject BCBA session (aba_* keys used by Mahaverse shell)
    const loginRes = await request.post(
      `${process.env.E2E_API_BASE || "https://www.mahabehavioralhealth.com/mahaverse-backend-test"}/login.php`,
      { data: { email: staffEmail, password: PASS } }
    );
    const loginJson = await loginRes.json();
    expect(loginJson.token).toBeTruthy();

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.evaluate(
      ({ token, user, expires }) => {
        localStorage.clear();
        localStorage.setItem("aba_token", token);
        localStorage.setItem("aba_user", JSON.stringify(user));
        localStorage.setItem("aba_token_expiry", expires || "");
        localStorage.setItem("currentView", "dashboard");
      },
      {
        token: loginJson.token as string,
        user: loginJson.user,
        expires: loginJson.expires_at as string | undefined,
      }
    );
    await page.reload({ waitUntil: "domcontentloaded" });

    await expect(
      page.getByRole("heading", { name: "BCBA Dashboard" })
    ).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("My Clients")).toBeVisible();
    await expect(page.getByText("Assigned to you")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/^2$/).first()).toBeVisible({ timeout: 20_000 });
  });
});
