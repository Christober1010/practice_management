import { expect, type Page } from "@playwright/test";

export async function addBehaviorCategoryViaUi(page: Page, name: string) {
  await page.getByRole("button", { name: "Add Category" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Add Behavior Category")).toBeVisible();
  await dialog.locator("#category-name").fill(name);
  await dialog.locator("#category-description").fill("Playwright E2E category");

  const saveResponse = page.waitForResponse(
    (res) =>
      /behaviors\.php/.test(res.url()) &&
      res.request().method() === "POST" &&
      res.status() === 200,
    { timeout: 30_000 }
  );
  await dialog.getByRole("button", { name: "Add Category", exact: true }).click();
  const res = await saveResponse;
  const json = await res.json();
  expect(json.success).toBe(true);
  await expect(page.getByText(name)).toBeVisible({ timeout: 15_000 });
}
