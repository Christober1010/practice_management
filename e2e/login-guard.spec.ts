import { test, expect } from "@playwright/test";

test.describe("Login guard", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("shows login when not authenticated", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("textbox", { name: "Email Address" })
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign In Securely" })).toBeVisible();
  });
});
