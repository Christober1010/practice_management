import { test, expect } from "@playwright/test";
import { gotoApp, clickSidebar } from "./helpers/navigation";
import { waitForApi } from "./helpers/api";

test.describe("Reports", () => {
  test("loads reports list from API", async ({ page }) => {
    const reportsResponse = waitForApi(page, "/reports.php");

    await gotoApp(page);
    await clickSidebar(page, "Reports");

    await expect(page.getByRole("heading", { name: "Reports" })).toBeVisible();

    const res = await reportsResponse;
    const json = await res.json();
    expect(json.success).toBe(true);
  });
});
