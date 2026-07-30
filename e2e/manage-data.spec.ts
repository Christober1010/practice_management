import { test, expect } from "@playwright/test";
import { gotoApp, openSubmenu } from "./helpers/navigation";
import { waitForApi } from "./helpers/api";

test.describe("Manage Data", () => {
  test("loads behavior categories", async ({ page }) => {
    const behaviorsResponse = waitForApi(page, "/behaviors.php");

    await gotoApp(page);
    await openSubmenu(page, "Manage Data", "Behavior Categories");

    await expect(
      page.getByRole("heading", { name: "Behavior Categories" })
    ).toBeVisible();

    const res = await behaviorsResponse;
    const json = await res.json();
    expect(json.success).toBe(true);
  });

  // Nav item hidden — payer payments are on Session Log / Schedule Tracker.
  test.skip("loads payer payments", async ({ page }) => {
    const paymentsResponse = waitForApi(page, "/reports.php");

    await gotoApp(page);
    await openSubmenu(page, "Manage Data", "Payer Payments");

    await expect(
      page.getByRole("heading", { name: "Payer Payments" })
    ).toBeVisible();

    const res = await paymentsResponse;
    const json = await res.json();
    expect(json.success).toBe(true);
  });
});
