import { test, expect } from "@playwright/test";
import { gotoApp, clickSidebar } from "./helpers/navigation";
import { waitForApi } from "./helpers/api";

test.describe("Reports", () => {
  test("loads Session Import (External) from API", async ({ page }) => {
    const reportsResponse = waitForApi(page, "/reports.php");

    await gotoApp(page);
    await clickSidebar(page, "Reports");

    await expect(page.getByRole("heading", { name: "Reports" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Session Import" }).first()).toBeVisible();

    const res = await reportsResponse;
    expect(res.url()).toContain("context=schedule_tracker");
    const json = await res.json();
    expect(json.success).toBe(true);
  });
});
