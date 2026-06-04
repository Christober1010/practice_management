import { test as setup, expect } from "@playwright/test";
import fs from "fs";
import path from "path";

const authFile =
  process.env.E2E_AUTH_STORAGE ||
  path.join(__dirname, ".auth", `user-${process.env.E2E_TARGET || "test"}.json`);

setup("authenticate", async ({ page }) => {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "Set E2E_EMAIL and E2E_PASSWORD in e2e/.env (see e2e/.env.example)"
    );
  }

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("textbox", { name: "Email Address" })
  ).toBeVisible();

  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Sign In Securely" }).click();

  await expect(page.getByRole("heading", { name: "Administrator" })).toBeVisible({
    timeout: 30_000,
  });

  const token = await page.evaluate(() => localStorage.getItem("aba_token"));
  expect(token).toBeTruthy();

  fs.mkdirSync(path.dirname(authFile), { recursive: true });
  await page.context().storageState({ path: authFile });
});
