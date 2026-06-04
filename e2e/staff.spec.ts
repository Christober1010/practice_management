import { test, expect } from "@playwright/test";
import { gotoApp, clickSidebar } from "./helpers/navigation";
import { waitForApi } from "./helpers/api";

test.describe("Staff", () => {
  test("loads staff list from API", async ({ page }) => {
    const staffResponse = waitForApi(page, "/staff.php");

    await gotoApp(page);
    await clickSidebar(page, "Staff");

    await expect(
      page.getByRole("heading", { name: "Staff Management" })
    ).toBeVisible();

    const res = await staffResponse;
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(Array.isArray(json.staff_records)).toBe(true);
  });

  test("opens add staff modal", async ({ page }) => {
    await gotoApp(page);
    await clickSidebar(page, "Staff");

    await page.getByRole("button", { name: "Add Staff" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Add New Staff Member")).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel" }).click();
  });
});
