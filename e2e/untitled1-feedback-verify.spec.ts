/**
 * UI verification for Untitled-1 feedback list (admin + optional biller).
 *
 * Run (dev:test already on :3000):
 *   PLAYWRIGHT_SKIP_WEBSERVER=1 E2E_TARGET=test \
 *     pnpm exec playwright test e2e/untitled1-feedback-verify.spec.ts --project=test-chromium
 *
 * Optional biller login (archive + claims):
 *   E2E_BILLER_EMAIL=... E2E_BILLER_PASSWORD=...
 */
import { test, expect, type Page } from "@playwright/test";
import {
  gotoApp,
  openMahaverseView,
  clickSidebar,
  clearLaunchpadSessionKeys,
} from "./helpers/navigation";
import { MahaverseApiClient } from "./helpers/api-client";

async function selectRoleBiller(page: Page) {
  // Product = first combobox, Role = second in the sticky toolbar
  const roleCombo = page.getByRole("combobox").nth(1);
  await roleCombo.click();
  await page
    .locator('[role="listbox"] [role="option"]')
    .filter({ hasText: /^biller$/i })
    .first()
    .click({ timeout: 15_000 });
  await expect(roleCombo).toContainText(/biller/i);
}

async function loginAs(
  page: Page,
  email: string,
  password: string,
  expectHeading: RegExp | string
) {
  await page.context().clearCookies();
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      /* ignore */
    }
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#email")).toBeVisible({ timeout: 30_000 });
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Sign In Securely" }).click();
  await expect(page.getByRole("heading", { name: expectHeading })).toBeVisible({
    timeout: 30_000,
  });
  await clearLaunchpadSessionKeys(page);
}

test.describe("Untitled-1 feedback UI verify", () => {
  // Independent tests so one failure does not skip document / other checks
  test.describe.configure({ mode: "parallel" });

  test("1–3 Session Log: Client/Staff/Service code/Payer dropdown filters", async ({
    page,
  }) => {
    const logWait = page.waitForResponse(
      (r) =>
        r.url().includes("session-log.php") &&
        r.request().method() === "GET" &&
        r.status() < 500,
      { timeout: 60_000 }
    );

    await gotoApp(page);
    await openMahaverseView(page, "reportsSessionLog");
    await expect(page.getByText(/Session Log/i).first()).toBeVisible({
      timeout: 30_000,
    });

    const logRes = await logWait;
    expect(logRes.status(), "session-log.php should be reachable").toBeLessThan(
      400
    );

    // Labels present
    await expect(page.getByText("Client", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Staff", { exact: true }).first()).toBeVisible();
    await expect(
      page.getByText("Service code", { exact: true }).first()
    ).toBeVisible();
    await expect(page.getByText("Payer", { exact: true }).first()).toBeVisible();

    // Must be combobox dropdowns (not free-text Search client…)
    await expect(
      page.getByPlaceholder("Search client…")
    ).toHaveCount(0);
    await expect(
      page.getByPlaceholder("Search staff…")
    ).toHaveCount(0);

    const clientCombo = page.getByRole("combobox").filter({
      hasText: /All clients|No clients|selected/i,
    });
    const staffCombo = page.getByRole("combobox").filter({
      hasText: /All staff|No staff|selected/i,
    });
    const codeCombo = page.getByRole("combobox").filter({
      hasText: /All service codes|No codes|selected/i,
    });
    const payerCombo = page.getByRole("combobox").filter({
      hasText: /All payers|No payers|selected/i,
    });

    await expect(clientCombo.first()).toBeVisible();
    await expect(staffCombo.first()).toBeVisible();
    await expect(codeCombo.first()).toBeVisible();
    await expect(payerCombo.first()).toBeVisible();

    // Open Client dropdown — searchable list UI
    await clientCombo.first().click();
    await expect(
      page.getByPlaceholder("Search clients…")
    ).toBeVisible();
    await page.keyboard.press("Escape");

    await staffCombo.first().click();
    await expect(page.getByPlaceholder("Search staff…")).toBeVisible();
    await page.keyboard.press("Escape");

    await codeCombo.first().click();
    await expect(page.getByPlaceholder("Search codes…")).toBeVisible();
    await page.keyboard.press("Escape");

    await payerCombo.first().click();
    await expect(page.getByPlaceholder("Search payers…")).toBeVisible();
    await page.keyboard.press("Escape");

    // Import Session still present on this page
    await expect(
      page.getByRole("button", { name: /Import Session/i })
    ).toBeVisible();
  });

  test("6 Manage Data: Payer Payments nav item is hidden", async ({ page }) => {
    await gotoApp(page);
    await clickSidebar(page, "Manage Data");
    await expect(
      page.getByRole("button", { name: "Payer Payments", exact: true })
    ).toHaveCount(0);
    // Sanity: another manage-data item still shows
    await expect(
      page.getByRole("button", { name: "Manage Providers", exact: true })
    ).toBeVisible();
  });

  test("7 Role Access: Biller reports show individually + Archive client row", async ({
    page,
    request,
  }) => {
    const email = process.env.E2E_EMAIL!;
    const password = process.env.E2E_PASSWORD!;
    const api = await MahaverseApiClient.login(request, email, password);
    const matrixRes = await api.get("rbac-matrix.php?scope=mahaverse");
    const matrix = await api.json(matrixRes);
    expect(matrixRes.ok(), JSON.stringify(matrix)).toBeTruthy();

    const keys = (matrix.permissions || []).map((p: { perm_key: string }) => p.perm_key);
    const hasReportGranular =
      keys.includes("view.reports_session_log") &&
      keys.includes("view.reports_session_import") &&
      keys.includes("view.reports_insurance_utilization");

    await gotoApp(page);
    await openMahaverseView(page, "roleAccess");
    await expect(
      page.getByRole("heading", { name: /Role permissions/i })
    ).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Loading permissions…")).toHaveCount(0, {
      timeout: 60_000,
    });

    await selectRoleBiller(page);

    // Use search to surface report + archive rows reliably
    const search = page.getByRole("textbox", { name: /Search permissions/i });
    await search.fill("Archive");
    await expect(
      page.getByRole("switch", { name: /Archive client/i })
    ).toBeVisible({ timeout: 15_000 });

    await search.fill("Session Log");
    await expect(
      page.getByRole("switch", { name: "Session Log", exact: true })
    ).toBeVisible({ timeout: 15_000 });

    await search.fill("Session Import");
    await expect(
      page.getByRole("switch", { name: "Session Import", exact: true })
    ).toBeVisible();

    await search.fill("Insurance Utilization");
    await expect(
      page.getByRole("switch", { name: "Insurance Utilization", exact: true })
    ).toBeVisible();
  });

  test("5 Client Document View shows Loading… before download fallback", async ({
    page,
  }) => {
    await gotoApp(page);
    await openMahaverseView(page, "clients");
    await expect(
      page.getByRole("heading", { name: /Client Management|Clients/i }).first()
    ).toBeVisible({ timeout: 30_000 });

    // Prefer a client known to have an uploads PDF on test (falls back to first row)
    const search = page.getByPlaceholder(/Search all client fields/i);
    if (await search.isVisible().catch(() => false)) {
      await search.fill("testttttttttttttt");
      await expect(page.getByText(/testttttttttttttt/i).first()).toBeVisible({
        timeout: 15_000,
      });
    }

    const openClientEditor = async (row) => {
      const editBtn = row
        .getByRole("button", { name: /Edit|Open/i })
        .or(row.locator('button[title*="Edit" i]'))
        .first();
      if (await editBtn.isVisible().catch(() => false)) {
        await editBtn.click();
        return true;
      }
      const more = row.getByRole("button").last();
      await more.click();
      const editItem = page.getByRole("menuitem", { name: /Edit/i });
      if (await editItem.isVisible().catch(() => false)) {
        await editItem.click();
        return true;
      }
      return false;
    };

    const row = page.locator("table tbody tr").first();
    test.skip(!(await row.isVisible().catch(() => false)), "No clients in table");
    test.skip(!(await openClientEditor(row)), "Could not open client editor");

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    const docsTab = dialog.getByRole("tab", { name: /Documents/i });
    test.skip(!(await docsTab.isVisible().catch(() => false)), "No Documents tab");
    await docsTab.click();

    const viewBtn = dialog.getByRole("button", { name: /^View$/i }).first();
    test.skip(
      !(await viewBtn.isVisible().catch(() => false)),
      "No document View button for this client"
    );

    await viewBtn.click();

    const loading = page.getByText(/Loading document/i);
    const downloadMsg = page.getByText(/Please download to view/i);

    const loadingAppeared = await loading
      .waitFor({ state: "visible", timeout: 5_000 })
      .then(() => true)
      .catch(() => false);

    if (loadingAppeared) {
      await expect(downloadMsg).toHaveCount(0);
      await expect(loading).toBeHidden({ timeout: 90_000 });
    } else {
      await expect(
        page
          .locator("text=Loading document…")
          .or(page.getByText(/Unable to display|cannot be previewed|Download File/i))
          .first()
      ).toBeVisible({ timeout: 10_000 });
    }

    await page.keyboard.press("Escape").catch(() => {});
    await dialog.getByRole("button", { name: /Cancel|Close/i }).first().click().catch(() => {});
  });
});

test.describe("Untitled-1 biller UI verify", () => {
  test("4 Archive inactive for Biller → Archive action not available in UI", async ({
    browser,
    request,
  }) => {
    const billerEmail = process.env.E2E_BILLER_EMAIL;
    const billerPassword = process.env.E2E_BILLER_PASSWORD;
    test.skip(
      !billerEmail || !billerPassword,
      "Set E2E_BILLER_EMAIL and E2E_BILLER_PASSWORD to verify Biller UI"
    );

    const adminEmail = process.env.E2E_EMAIL!;
    const adminPassword = process.env.E2E_PASSWORD!;
    const api = await MahaverseApiClient.login(request, adminEmail, adminPassword);
    const matrixRes = await api.get("rbac-matrix.php?scope=mahaverse");
    const matrix = await api.json(matrixRes);
    const billerKeys: string[] = matrix.grants?.biller || [];
    test.skip(
      billerKeys.includes("clients.archive"),
      "Biller currently has clients.archive granted — turn it off in Role Access to verify"
    );

    const context = await browser.newContext({
      baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000",
    });
    const page = await context.newPage();
    try {
      await loginAs(page, billerEmail!, billerPassword!, /Biller/i);
      await openMahaverseView(page, "clients");
      await expect(
        page.getByRole("heading", { name: /Client Management|Clients/i }).first()
      ).toBeVisible({ timeout: 30_000 });

      const firstRow = page.locator("table tbody tr").first();
      await expect(firstRow).toBeVisible();
      await firstRow.getByRole("button").last().click();
      await expect(
        page.getByRole("menuitem", { name: /Archive Client|Restore Client/i })
      ).toHaveCount(0);
    } finally {
      await context.close();
    }
  });

  test("8 Billing Claims: Biller session load via billing.read", async ({
    browser,
  }) => {
    const billerEmail = process.env.E2E_BILLER_EMAIL;
    const billerPassword = process.env.E2E_BILLER_PASSWORD;
    test.skip(
      !billerEmail || !billerPassword,
      "Set E2E_BILLER_EMAIL and E2E_BILLER_PASSWORD to verify Biller Claims"
    );

    const context = await browser.newContext({
      baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000",
    });
    const page = await context.newPage();
    try {
      await loginAs(page, billerEmail!, billerPassword!, /Biller/i);
      await openMahaverseView(page, "claims");
      await expect(page.getByRole("heading", { name: /Claims/i })).toBeVisible({
        timeout: 30_000,
      });

      const sessionRespPromise = page.waitForResponse(
        (r) =>
          r.url().includes("add-session.php") &&
          r.request().method() === "GET",
        { timeout: 60_000 }
      );

      await page.getByRole("button", { name: /Refresh data/i }).click();
      const res = await sessionRespPromise;
      const status = res.status();
      const body = await res.json().catch(() => ({}));

      if (status === 403) {
        const errText =
          (body && (body.message || body.error)) || "Permission denied";
        throw new Error(
          `Claims session GET returned 403 (${errText}). GET must allow billing.read.`
        );
      }

      expect(status).toBe(200);
      expect(Array.isArray(body)).toBeTruthy();
      await expect(page.getByText(/Permission denied/i)).toHaveCount(0);
      await expect(page.getByText(/Failed to load sessions/i)).toHaveCount(0);
    } finally {
      await context.close();
    }
  });
});
