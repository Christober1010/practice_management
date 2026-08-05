/**
 * Session Log-Billing — same as Session Log, Misc hrs + Diff hidden on all tabs.
 */
import { test, expect } from "@playwright/test";
import { gotoApp, openMahaverseView, openSubmenu } from "./helpers/navigation";

test.describe("Session Log-Billing report", () => {
  test("opens billing clone without Misc hrs / Diff columns", async ({ page }) => {
    await gotoApp(page);

    // Prefer sidebar; fall back to direct view if menu not granted yet.
    const reportsLink = page.getByRole("link", { name: "Reports", exact: true });
    await reportsLink.click();
    const billingBtn = page.getByRole("button", {
      name: "Session Log-Billing",
      exact: true,
    });
    if (await billingBtn.isVisible().catch(() => false)) {
      await billingBtn.click();
    } else {
      await openMahaverseView(page, "reportsSessionLogBilling");
    }

    await expect(page.getByRole("heading", { name: "Session Log-Billing" })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByRole("tab", { name: /Rendered/i })).toBeVisible();
    await page.getByRole("tab", { name: /Rendered/i }).click();
    await expect(page.getByRole("columnheader", { name: /Misc hrs/i })).toHaveCount(0);
    await expect(page.getByRole("columnheader", { name: /^Diff/i })).toHaveCount(0);
    await expect(page.getByRole("columnheader", { name: /Rendered hrs/i })).toBeVisible();
  });

  test("direct view id works", async ({ page }) => {
    await gotoApp(page);
    await openMahaverseView(page, "reportsSessionLogBilling");
    await expect(page.getByRole("heading", { name: "Session Log-Billing" })).toBeVisible({
      timeout: 30_000,
    });
  });
});
