import { test, expect } from "@playwright/test";
import { gotoApp, openSubmenu } from "./helpers/navigation";
import { waitForApi } from "./helpers/api";

test.describe("Configure data (master)", () => {
  test("loads domains from get-all API", async ({ page }) => {
    const dataResponse = waitForApi(page, "/get-all.php");

    await gotoApp(page);
    await openSubmenu(page, "Configure data", "Domains");

    await expect(page.getByRole("heading", { name: "Domains" })).toBeVisible();

    const res = await dataResponse;
    const json = await res.json();
    expect(json.success).toBe(true);
  });

  test("loads behaviors library from API", async ({ page }) => {
    const behaviorsResponse = waitForApi(page, "/behaviors.php");

    await gotoApp(page);
    await openSubmenu(page, "Configure data", "Behaviors");

    await expect(page.getByRole("heading", { name: "Behaviors" })).toBeVisible();

    const res = await behaviorsResponse;
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data).toBeTruthy();
  });
});
