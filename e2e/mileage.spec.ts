/**
 * Mileage report UI — list-first claims, capture flow, admin status.
 * Run against local Next on :3000 with test backend:
 *   PLAYWRIGHT_SKIP_WEBSERVER=1 E2E_TARGET=test pnpm exec playwright test e2e/mileage.spec.ts --project=test-chromium
 */
import { test, expect } from "@playwright/test";
import { MahaverseApiClient } from "./helpers/api-client";
import { gotoApp, openMahaverseView, openSubmenu } from "./helpers/navigation";

function localTodayYmd() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

test.describe("Mileage report UI", () => {
  test("lists claims, opens detail, opens New claim capture", async ({
    page,
    request,
  }) => {
    const email = process.env.E2E_EMAIL;
    const password = process.env.E2E_PASSWORD;
    test.skip(!email || !password, "Set E2E_EMAIL and E2E_PASSWORD");

    // API: admin sees claims + all scope
    const api = await MahaverseApiClient.login(request, email!, password!);
    const claimsRes = await api.get("mileage.php?action=claims");
    const claimsJson = await api.json(claimsRes);
    expect(claimsRes.ok(), JSON.stringify(claimsJson)).toBeTruthy();
    expect(claimsJson.success).toBeTruthy();
    expect(Array.isArray(claimsJson.claims)).toBeTruthy();
    expect(claimsJson.access?.scope || claimsJson.access?.can_manage_all).toBeTruthy();
    if (claimsJson.access) {
      expect(claimsJson.access.can_manage_all).toBe(true);
      expect(claimsJson.access.scope).toBe("all");
    }

    await gotoApp(page);

    // Sidebar: Reports → Mileage
    await openSubmenu(page, "Reports", "Mileage");
    await expect(page.getByRole("heading", { name: "Mileage Reimbursement" })).toBeVisible({
      timeout: 30_000,
    });

    // List-first UI
    await expect(page.getByText(/Mileage claims \(/)).toBeVisible();
    await expect(page.getByRole("button", { name: /New claim/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Refresh/i })).toBeVisible();

    // Status filter present
    await expect(page.getByRole("combobox").first()).toBeVisible();

    // Table headers
    await expect(page.getByRole("columnheader", { name: "Provider" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Status", exact: true })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Payment status" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Cost" })).toBeVisible();

    const claimCount = (claimsJson.claims || []).length;
    if (claimCount > 0) {
      // Open first claim detail via eye button
      const claimsWait = page.waitForResponse(
        (r) =>
          r.url().includes("mileage.php") &&
          r.url().includes("action=claim") &&
          r.request().method() === "GET"
      );
      await page.locator("table tbody tr").first().getByRole("button").first().click();
      const detailRes = await claimsWait;
      expect(detailRes.ok()).toBeTruthy();

      await expect(page.getByText(/Claim #/)).toBeVisible({ timeout: 15_000 });
      await expect(page.getByRole("button", { name: /Back to claims/i })).toBeVisible();

      // Admin status + payment actions
      await expect(page.getByRole("button", { name: /Mark approved/i })).toBeVisible();
      await expect(page.getByRole("button", { name: /Mark void/i })).toBeVisible();
      await expect(page.getByRole("button", { name: /^Paid$/i })).toBeVisible();
      await expect(page.getByRole("button", { name: /Pending Payment/i })).toBeVisible();
      await expect(page.getByLabel(/Pay date/i)).toBeVisible();
      await expect(page.getByLabel(/Check #/i)).toBeVisible();

      await page.getByRole("button", { name: /Back to claims/i }).click();
      await expect(page.getByText(/Mileage claims \(/)).toBeVisible();
    }

    // New claim capture
    await page.getByRole("button", { name: /New claim/i }).click();
    await expect(page.getByText("New mileage claim")).toBeVisible();
    await expect(page.getByRole("button", { name: /Load sessions for day/i })).toBeVisible();
    await expect(
      page.getByText(/Indirect sessions and sessions marked Exclude = Yes are omitted/i)
    ).toBeVisible();

    const dateInput = page.locator("#mileage-session-date");
    await expect(dateInput).toBeVisible();
    await expect(dateInput).toHaveValue(localTodayYmd());

    // Load Christober multi-stop day (seeded earlier)
    const providersWait = page.waitForResponse(
      (r) =>
        r.url().includes("mileage.php") &&
        r.url().includes("action=providers") &&
        r.url().includes("2026-08-15") &&
        r.request().method() === "GET",
      { timeout: 30_000 }
    );
    await dateInput.fill("2026-08-15");
    const providersRes = await providersWait;
    const providersJson = await providersRes.json();
    expect(providersJson.success).toBeTruthy();
    expect((providersJson.providers || []).length).toBeGreaterThan(0);

    // Provider select should show Christober for that date when sessions exist
    const providerCombo = page.getByRole("combobox").last();
    await expect(providerCombo).toBeVisible();

    const dayWait = page.waitForResponse(
      (r) =>
        r.url().includes("mileage.php") &&
        r.url().includes("action=day") &&
        r.request().method() === "GET",
      { timeout: 60_000 }
    );
    await page.getByRole("button", { name: /Load sessions for day/i }).click();
    const dayRes = await dayWait;
    const dayJson = await dayRes.json();
    expect(dayRes.ok(), JSON.stringify(dayJson)).toBeTruthy();
    expect(dayJson.success).toBeTruthy();

    const clientStops = (dayJson.stops || []).filter(
      (s: { is_home?: boolean }) => !s.is_home
    );
    // Seeded multi-stop days can vary; still assert Indirect/exclude filter never returns banned rows.
    const banned = (dayJson.stops || []).filter((s: Record<string, unknown>) => {
      const st = String(s.service_type || "").toLowerCase();
      const ex = String(s.exclude_session || "").toLowerCase();
      return st === "indirect" || ["yes", "y", "1", "true"].includes(ex);
    });
    expect(banned.length, "Indirect / Exclude=Yes sessions must be omitted").toBe(0);

    if (clientStops.length >= 1) {
      await expect(page.getByText("Sessions that day")).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText("Travel legs")).toBeVisible();
      await expect(page.getByText("Submit claim")).toBeVisible();
    }

    await page.getByRole("button", { name: /Back to claims/i }).click();
    await expect(page.getByText(/Mileage claims \(/)).toBeVisible();
  });

  test("approve sets Pending Payment; Paid requires pay date and check #", async ({
    page,
    request,
  }) => {
    const email = process.env.E2E_EMAIL;
    const password = process.env.E2E_PASSWORD;
    test.skip(!email || !password, "Set E2E_EMAIL and E2E_PASSWORD");

    const api = await MahaverseApiClient.login(request, email!, password!);
    const { data: claimsData } = await api.expectOk("mileage.php?action=claims");
    const claims = (claimsData.claims as Array<{ id: number }>) || [];
    test.skip(claims.length === 0, "Need at least one mileage claim");

    const claimId = claims[0].id;

    // Reset via API so UI starts from submitted/pending
    await api.expectOk("mileage.php", "PATCH", {
      action: "status",
      id: claimId,
      status: "submitted",
    });
    await api.expectOk("mileage.php", "PATCH", {
      action: "payment_status",
      id: claimId,
      payment_status: "pending_payment",
    });

    await gotoApp(page);
    await openSubmenu(page, "Reports", "Mileage");
    await expect(page.getByRole("heading", { name: "Mileage Reimbursement" })).toBeVisible({
      timeout: 30_000,
    });

    await page.locator("table tbody tr").first().getByRole("button").first().click();
    await expect(page.getByText(new RegExp(`Claim #${claimId}`))).toBeVisible({
      timeout: 15_000,
    });

    // Approve → Pending Payment
    const approveWait = page.waitForResponse(
      (r) =>
        r.url().includes("mileage.php") &&
        r.request().method() === "PATCH" &&
        r.ok()
    );
    await page.getByRole("button", { name: /Mark approved/i }).click();
    const approveRes = await approveWait;
    const approveJson = await approveRes.json();
    expect(approveJson.success).toBeTruthy();
    expect(String(approveJson.claim?.payment_status)).toBe("pending_payment");
    await expect(page.getByRole("button", { name: /Pending Payment/i })).toBeDisabled();

    // Paid without check # blocked in UI
    await page.getByLabel(/Pay date/i).fill("2026-08-05");
    await page.getByLabel(/Check #/i).fill("");
    await page.getByRole("button", { name: /^Paid$/i }).click();
    await expect(page.getByText(/Check # is required/i)).toBeVisible({ timeout: 10_000 });

    // Paid with both fields
    await page.getByLabel(/Check #/i).fill("UI-CHK-42");
    const paidWait = page.waitForResponse(
      (r) =>
        r.url().includes("mileage.php") &&
        r.request().method() === "PATCH" &&
        r.ok()
    );
    await page.getByRole("button", { name: /^Paid$/i }).click();
    const paidRes = await paidWait;
    const paidJson = await paidRes.json();
    expect(paidJson.success).toBeTruthy();
    expect(String(paidJson.claim?.payment_status)).toBe("paid");
    expect(String(paidJson.claim?.pay_date)).toBe("2026-08-05");
    expect(String(paidJson.claim?.check_number)).toBe("UI-CHK-42");
    await expect(page.getByRole("button", { name: /^Paid$/i })).toBeDisabled();
  });

  test("can open Mileage via direct view id", async ({ page }) => {
    await gotoApp(page);
    await openMahaverseView(page, "reportsMileage");
    await expect(page.getByRole("heading", { name: "Mileage Reimbursement" })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText(/Mileage claims \(/)).toBeVisible();
  });

  test("org rate lives under Manage Data → Mileage Rate", async ({ page }) => {
    await gotoApp(page);
    await openSubmenu(page, "Manage Data", "Mileage Rate");
    await expect(page.getByRole("heading", { name: "Mileage Rate" })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByRole("button", { name: /Save rate/i })).toBeVisible();
    await expect(page.getByLabel(/USD per mile/i)).toBeVisible();
  });
});
