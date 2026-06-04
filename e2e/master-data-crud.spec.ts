import { test } from "@playwright/test";
import { gotoApp, openSubmenu } from "./helpers/navigation";
import { addBehaviorCategoryViaUi } from "./helpers/master-data-form";

test.describe("Master data — UI CRUD", () => {
  test("adds a behavior category", async ({ page }) => {
    const name = `E2E UI Cat ${Date.now()}`;
    await gotoApp(page);
    await openSubmenu(page, "Manage Data", "Behavior Categories");
    await addBehaviorCategoryViaUi(page, name);
  });
});
