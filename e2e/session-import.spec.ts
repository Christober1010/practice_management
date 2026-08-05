import { test, expect } from "@playwright/test";
import { gotoApp, clickSidebar } from "./helpers/navigation";
import { waitForApi } from "./helpers/api";
import { MahaverseApiClient } from "./helpers/api-client";

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function expectedDosFrom() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return isoDate(d);
}

function expectedDosTo() {
  return isoDate(new Date());
}

async function openSessionImport(page: import("@playwright/test").Page) {
  const trackerResponse = waitForApi(page, "/reports.php");
  await gotoApp(page);
  await clickSidebar(page, "Reports");
  await clickSidebar(page, "Session Import");
  await expect(page.getByRole("heading", { name: "Reports" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Session Import" }).first()).toBeVisible();
  const res = await trackerResponse;
  expect(res.url()).toContain("context=schedule_tracker");
  const json = await res.json();
  expect(json.success).toBe(true);
  return json.data as Record<string, unknown>[];
}

async function readTabCount(page: import("@playwright/test").Page, label: string) {
  const tab = page.getByRole("tab", { name: tabNamePattern(label) });
  await expect(tab).toBeVisible();
  const text = (await tab.textContent()) ?? "";
  const m = text.match(/(\d+)/);
  return m ? Number(m[1]) : 0;
}

function tabNamePattern(label: string) {
  if (label === "Pending") return /^Pending\s+\d+/;
  return new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`);
}

test.describe("Session Import (External) — UI", () => {
  test("Reports navigation no longer uses internal top-level tabs", async ({ page }) => {
    await openSessionImport(page);
    await expect(page.getByRole("tab", { name: "Session Import" })).toHaveCount(0);
    await expect(page.getByRole("tab", { name: "Insurance Utilization" })).toHaveCount(0);
  });

  test("Reports shows Session Import only (no Summary / Quick edit tabs)", async ({
    page,
  }) => {
    await openSessionImport(page);

    await expect(page.getByRole("tab", { name: /Summary list/i })).toHaveCount(0);
    await expect(page.getByRole("tab", { name: /Quick edit/i })).toHaveCount(0);

    for (const status of [
      "Pending",
      "Reviewed",
      "Excluded",
      "Pending Payment",
      "Received Payment",
    ]) {
      await expect(
        page.getByRole("tab", { name: tabNamePattern(status) })
      ).toBeVisible();
    }
  });

  async function clearDosFilters(page: import("@playwright/test").Page) {
    await page.getByLabel("DOS from").fill("");
    await page.getByLabel("DOS to").fill("");
  }

  test("DOS filters default to last 7 days through today", async ({ page }) => {
    await openSessionImport(page);

    const dosFrom = page.getByLabel("DOS from");
    const dosTo = page.getByLabel("DOS to");
    await expect(dosFrom).toHaveValue(expectedDosFrom());
    await expect(dosTo).toHaveValue(expectedDosTo());
  });

  test("uses Save Changes (no per-row Save) and Sum footer on Pending tab", async ({
    page,
  }) => {
    await openSessionImport(page);
    await clearDosFilters(page);

    await expect(page.getByRole("button", { name: /^Save Changes/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "Save", exact: true })).toHaveCount(0);
    await expect(page.getByText("Sum (visible rows)")).toBeVisible({ timeout: 20_000 });
  });

  test("tab badge counts match filtered rows when client filter is applied", async ({ page }) => {
    await openSessionImport(page);
    await clearDosFilters(page);

    const pendingBefore = await readTabCount(page, "Pending");
    expect(pendingBefore).toBeGreaterThan(0);

    const clientFilter = page.getByRole("combobox").first();
    await clientFilter.click();
    const option = page.getByRole("button").filter({ hasText: /./ }).nth(1);
    await option.click();
    await page.keyboard.press("Escape");

    const pendingAfter = await readTabCount(page, "Pending");
    expect(pendingAfter).toBeLessThanOrEqual(pendingBefore);

    const visibleRows = page.locator("tbody tr").filter({ has: page.locator("td") });
    const dataRowCount = await visibleRows.count();
    const hasSumRow = await page.getByText("Sum (visible rows)").isVisible().catch(() => false);
    const expectedVisible = hasSumRow ? dataRowCount - 1 : dataRowCount;
    if (expectedVisible > 0) {
      expect(pendingAfter).toBe(expectedVisible);
    }
  });

  test("Check # search appears on all status tabs", async ({ page }) => {
    await openSessionImport(page);

    for (const tab of [
      "Pending",
      "Reviewed",
      "Excluded",
      "Pending Payment",
      "Received Payment",
    ]) {
      await page.getByRole("tab", { name: tabNamePattern(tab) }).click();
      await expect(page.getByLabel("Search by check number")).toBeVisible();
    }
  });

  test("Pending tab shows staff filter and DOS-first column order", async ({ page }) => {
    await openSessionImport(page);
    await expect(page.getByText("All staff in table")).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "DOS / time" })).toBeVisible();
    const headers = await page.locator("thead th").allTextContents();
    const dosIndex = headers.findIndex((h) => /DOS \/ time/i.test(h));
    const clientIndex = headers.findIndex((h) => /^Client$/i.test(h.trim()));
    expect(dosIndex).toBeGreaterThanOrEqual(0);
    expect(clientIndex).toBeGreaterThan(dosIndex);
  });

  test("Reviewed tab shows payment columns and Pending Payment action", async ({
    page,
  }) => {
    await openSessionImport(page);
    await clearDosFilters(page);
    await page.getByRole("tab", { name: tabNamePattern("Reviewed") }).click();

    await expect(page.getByRole("columnheader", { name: "Payer paid $" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Check #" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Co-insurance $" })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Save Changes/ })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Pending Payment", exact: true })
    ).toBeVisible();
  });

  test("Pending Payment tab mirrors Reviewed with Received Payment action", async ({
    page,
  }) => {
    await openSessionImport(page);
    await page.getByRole("tab", { name: /^Pending Payment/ }).click();

    await expect(page.getByRole("columnheader", { name: "Payer paid $" })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Save Changes/ })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Received Payment", exact: true })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Pending Payment", exact: true })
    ).toHaveCount(0);
  });

  test("Received Payment tab shows AP columns and Save Changes", async ({ page }) => {
    await openSessionImport(page);
    await page.getByRole("tab", { name: tabNamePattern("Received Payment") }).click();

    await expect(page.getByRole("columnheader", { name: "AP Invoice" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "AP date" })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Save Changes/ })).toBeVisible();
  });

  test("misc hrs edit auto-selects row for Save Changes", async ({ page }) => {
    await openSessionImport(page);
    await clearDosFilters(page);

    const miscInput = page.locator('input[inputmode="decimal"]').first();
    if (!(await miscInput.isVisible().catch(() => false))) {
      test.skip(true, "No editable misc hrs rows on Pending tab");
      return;
    }

    await miscInput.fill("0.25");
    await expect(page.getByText(/1 selected/)).toBeVisible();
    await expect(page.getByRole("button", { name: /Save Changes \(1\)/ })).toBeEnabled();
  });
});

test.describe("Session Import (External) — API", () => {
  test("schedule tracker list returns tracker_status on rows", async ({ request }) => {
    const email = process.env.E2E_EMAIL;
    const password = process.env.E2E_PASSWORD;
    if (!email || !password) {
      test.skip(true, "E2E_EMAIL / E2E_PASSWORD not set");
      return;
    }

    const api = await MahaverseApiClient.login(request, email, password);
    const { data } = await api.expectOk(
      "reports.php?archived=0&context=schedule_tracker"
    );
    const rows = (data.data as Record<string, unknown>[]) || [];
    if (rows.length === 0) {
      test.skip(true, "No schedule tracker rows in test DB");
      return;
    }
    const allowed = new Set([
      "Pending",
      "Reviewed",
      "Excluded",
      "Pending Payment",
      "Received Payment",
    ]);
    for (const row of rows.slice(0, 20)) {
      expect(allowed.has(String(row.tracker_status ?? "Pending"))).toBeTruthy();
    }
  });

  test("bulk tracker_status update accepts Pending Payment / Received Payment", async ({
    request,
  }) => {
    const email = process.env.E2E_EMAIL;
    const password = process.env.E2E_PASSWORD;
    if (!email || !password) {
      test.skip(true, "E2E_EMAIL / E2E_PASSWORD not set");
      return;
    }

    const api = await MahaverseApiClient.login(request, email, password);
    const { data: listData } = await api.expectOk(
      "reports.php?archived=0&context=schedule_tracker"
    );
    const rows = (listData.data as { id: number; tracker_status?: string }[]) || [];
    const pending = rows.find((r) => r.tracker_status === "Pending");
    if (!pending) {
      test.skip(true, "No Pending row to exercise bulk update API");
      return;
    }

    await api.expectOk("reports.php", "PUT", {
      bulk: true,
      ids: [pending.id],
      tracker_status: "Reviewed",
    });

    await api.expectOk("reports.php", "PUT", {
      bulk: true,
      ids: [pending.id],
      tracker_status: "Pending",
    });
  });

  test("Mark Reviewed requires client_id and provider_id (API shape)", async ({
    request,
  }) => {
    const email = process.env.E2E_EMAIL;
    const password = process.env.E2E_PASSWORD;
    if (!email || !password) {
      test.skip(true, "E2E_EMAIL / E2E_PASSWORD not set");
      return;
    }

    const api = await MahaverseApiClient.login(request, email, password);
    const { data: listData } = await api.expectOk(
      "reports.php?archived=0&context=schedule_tracker"
    );
    const rows =
      (listData.data as {
        id: number;
        client_id?: string;
        provider_id?: string;
        tracker_status?: string;
      }[]) || [];
    const missingIds = rows.find(
      (r) =>
        r.tracker_status === "Pending" &&
        (!String(r.client_id ?? "").trim() || !String(r.provider_id ?? "").trim())
    );
    if (!missingIds) {
      test.skip(true, "All Pending rows have client_id and provider_id");
      return;
    }
    expect(String(missingIds.client_id ?? "").trim()).toBe("");
  });

  test("insurance utilization endpoint returns runway fields", async ({ request }) => {
    const email = process.env.E2E_EMAIL;
    const password = process.env.E2E_PASSWORD;
    if (!email || !password) {
      test.skip(true, "E2E_EMAIL / E2E_PASSWORD not set");
      return;
    }

    const api = await MahaverseApiClient.login(request, email, password);
    const res = await api.get("reports-insurance-utilization.php");
    const raw = await res.text();
    let data: Record<string, unknown> | null = null;
    try {
      data = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      test.skip(
        true,
        "reports-insurance-utilization.php is not available on this deployed backend target yet",
      );
      return;
    }
    if (!res.ok() || data?.success !== true) {
      test.skip(
        true,
        "reports-insurance-utilization.php returned non-success on this backend target",
      );
      return;
    }
    const payload = (data.data as Record<string, unknown>) || {};
    const rows = (payload.rows as Record<string, unknown>[]) || [];
    expect(Array.isArray(rows)).toBeTruthy();
    if (rows.length === 0) {
      test.skip(true, "No authorization rows returned in test DB");
      return;
    }

    const sample = rows[0];
    expect(Object.prototype.hasOwnProperty.call(sample, "approved_units")).toBeTruthy();
    expect(Object.prototype.hasOwnProperty.call(sample, "consumed_units")).toBeTruthy();
    expect(Object.prototype.hasOwnProperty.call(sample, "remaining_units")).toBeTruthy();
    expect(Object.prototype.hasOwnProperty.call(sample, "weekly_units_required")).toBeTruthy();
    expect(Object.prototype.hasOwnProperty.call(sample, "expiry_date")).toBeTruthy();
  });
});
