/**
 * UI smoke for Untitled-1 items that are visible in the app shell.
 * Depends on auth setup + local next (dev:test).
 */
import { test, expect } from "@playwright/test";
import { gotoApp, clickSidebar, openMahaverseView } from "./helpers/navigation";
import { waitForApi } from "./helpers/api";

test.describe("Untitled-1 UI smoke (test)", () => {
  test("Appointments: location filter uses Location master options", async ({
    page,
  }) => {
    const locWait = page.waitForResponse(
      (res) =>
        /locations\.php/.test(res.url()) &&
        res.request().method() === "GET" &&
        res.status() === 200,
      { timeout: 60_000 }
    );
    await gotoApp(page);
    await clickSidebar(page, "Appointments");
    await expect(
      page.getByRole("heading", { name: "Appointments" })
    ).toBeVisible({ timeout: 30_000 });
    const locRes = await locWait;
    const locJson = await locRes.json();
    const locRows =
      (Array.isArray(locJson?.data) && locJson.data) ||
      (Array.isArray(locJson?.locations) && locJson.locations) ||
      [];
    expect(locRows.length, "locations.php should return master rows").toBeGreaterThan(0);

    // First filter combobox = Location
    const locationTrigger = page.locator(".grid.grid-cols-1.sm\\:grid-cols-3 button").first();
    await expect(locationTrigger).toBeVisible();
    await expect
      .poll(async () => {
        await locationTrigger.click();
        const count = await page.getByRole("option").count();
        await page.keyboard.press("Escape").catch(() => {});
        return count;
      }, { timeout: 15_000 })
      .toBeGreaterThan(1);

    await locationTrigger.click();
    const texts = await page.getByRole("option").allTextContents();
    expect(texts.some((t) => t.trim() === "All")).toBeTruthy();
    expect(
      texts.some((t) => /Maha|E2E|Felix|Harrison|IL/i.test(t)),
      `expected a master location name in ${JSON.stringify(texts)}`
    ).toBeTruthy();
  });

  test("Staff: Personal tab has Location dropdown from locations", async ({
    page,
  }) => {
    await gotoApp(page);
    await openMahaverseView(page, "staff");
    await expect(page.getByRole("heading", { name: /Staff/i }).first()).toBeVisible({
      timeout: 30_000,
    });

    const addBtn = page.getByRole("button", { name: /Add Staff|Add New Staff/i }).first();
    await addBtn.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("tab", { name: /Personal/i }).click();
    await expect(dialog.getByText("Location", { exact: true })).toBeVisible();
    // Should be a select, not free-text "Primary location / office"
    await expect(
      dialog.getByText("Primary location / office")
    ).toHaveCount(0);
    await dialog.getByRole("button", { name: /Cancel|Close/i }).first().click();
  });
});
