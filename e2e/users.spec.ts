import { test, expect } from "@playwright/test";
import { gotoApp, clickSidebar } from "./helpers/navigation";
import { waitForApi } from "./helpers/api";

test.describe("Users", () => {
  test("loads user management from API", async ({ page }) => {
    const usersResponse = waitForApi(page, "/get-users.php");

    await gotoApp(page);
    await clickSidebar(page, "Users");

    await expect(
      page.getByRole("heading", { name: "User Management" })
    ).toBeVisible();

    const res = await usersResponse;
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(Array.isArray(json.users)).toBe(true);
  });

  test("opens add user modal", async ({ page }) => {
    await gotoApp(page);
    await clickSidebar(page, "Users");

    await page.getByRole("button", { name: "Add User" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Add New User")).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel" }).click();
  });
});
