import { test, expect } from "@playwright/test";
import { gotoApp, clickSidebar } from "./helpers/navigation";
import { addUserViaModal, buildE2EUser } from "./helpers/user-form";

test.describe("Users — full create flow", () => {
  test("creates a user via modal and API", async ({ page }) => {
    const ts = String(Date.now());
    const user = buildE2EUser(ts);

    await gotoApp(page);
    await clickSidebar(page, "Users");

    await page.getByRole("button", { name: "Add User" }).click();
    await addUserViaModal(page, user);

    await page
      .getByPlaceholder("Search all user fields...")
      .fill(user.email);
    await expect(page.getByText(user.email)).toBeVisible({ timeout: 15_000 });
  });
});
