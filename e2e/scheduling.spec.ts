import { test, expect } from "@playwright/test";
import { gotoApp, clickSidebar } from "./helpers/navigation";
import { waitForApi } from "./helpers/api";

test.describe("Scheduling", () => {
  test("loads calendar and sessions API", async ({ page }) => {
    const sessionsResponse = waitForApi(page, "/add-session.php", {
      method: "GET",
    });

    await gotoApp(page);
    await clickSidebar(page, "Scheduling");

    await expect(
      page.getByRole("heading", { name: "Scheduling" })
    ).toBeVisible();

    const res = await sessionsResponse;
    expect(res.ok()).toBeTruthy();
  });

  test("opens add session modal", async ({ page }) => {
    await gotoApp(page);
    await clickSidebar(page, "Scheduling");

    await page.getByRole("button", { name: "Add Session" }).first().click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Add New Session")).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();
  });
});
