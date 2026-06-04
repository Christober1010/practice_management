import { test, expect } from "@playwright/test";
import { gotoApp } from "./helpers/navigation";

test.describe("Dashboard", () => {
  test("loads admin dashboard", async ({ page }) => {
    await gotoApp(page);
    await page.getByRole("link", { name: "Dashboard" }).click();
    await expect(
      page.getByRole("heading", { name: "Admin Dashboard" })
    ).toBeVisible();
    await expect(page.getByText("Active Clients")).toBeVisible();
  });
});
