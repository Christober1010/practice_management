import { expect, type Page } from "@playwright/test";

/** Drop Launchpad SSO keys so the shell stays on Mahaverse (admin) routes. */
export async function clearLaunchpadSessionKeys(page: Page) {
  await page.evaluate(() => {
    for (const key of ["auth_user", "auth_token", "auth_expires_at"]) {
      localStorage.removeItem(key);
    }
    localStorage.setItem("currentView", "dashboard");
  });
}

/** Switch app shell from Launchpad back to Mahaverse (sidebar logo menu). */
export async function ensureMahaverseApp(page: Page) {
  const adminHeading = page.getByRole("heading", { name: "Administrator" });
  if (await adminHeading.isVisible().catch(() => false)) {
    return;
  }

  if (page.url().includes("/launchpad")) {
    await page.goto("/", { waitUntil: "domcontentloaded" });
  }

  const launchpadShell = page.getByText("Welcome to Maha Launchpad");
  if (await launchpadShell.isVisible().catch(() => false)) {
    await page
      .getByRole("button")
      .filter({ hasText: "Maha Launchpad" })
      .first()
      .click();
    await page.getByRole("menuitem", { name: "Mahaverse" }).click();
    await page.waitForURL((url) => !url.pathname.includes("/launchpad"), {
      timeout: 20_000,
    });
  }

  if (!(await adminHeading.isVisible().catch(() => false))) {
    await page.goto("/", { waitUntil: "domcontentloaded" });
  }

  await expect(adminHeading).toBeVisible({ timeout: 30_000 });
}

/** Re-authenticate when storage state expired (common in long serial suites). */
export async function ensureLoggedIn(page: Page) {
  const loginEmail = page.getByRole("textbox", { name: "Email Address" });
  if (!(await loginEmail.isVisible().catch(() => false))) {
    return;
  }
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;
  if (!email || !password) {
    throw new Error("Set E2E_EMAIL and E2E_PASSWORD in e2e/.env");
  }
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Sign In Securely" }).click();
  await expect(page.getByRole("heading", { name: "Administrator" })).toBeVisible({
    timeout: 30_000,
  });
}

/** Land on the Mahaverse dashboard (not Launchpad). */
export async function gotoApp(page: Page) {
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const errorOverlay = page.getByRole("dialog", { name: /Runtime/i });
    if (await errorOverlay.isVisible().catch(() => false)) {
      await page.reload({ waitUntil: "domcontentloaded" });
    }
    await ensureLoggedIn(page);
    const adminHeading = page.getByRole("heading", { name: "Administrator" });
    if (await adminHeading.isVisible().catch(() => false)) {
      await ensureMahaverseApp(page);
      return;
    }
  }
  await ensureMahaverseApp(page);
}

export async function clickSidebar(page: Page, label: string) {
  await page.getByRole("link", { name: label, exact: true }).click();
}

/** Open a main Mahaverse view without relying on sidebar link hrefs. */
export async function openMahaverseView(page: Page, viewId: string) {
  await page.evaluate((view) => {
    localStorage.setItem("currentView", view);
    window.dispatchEvent(new CustomEvent("navigateToView", { detail: { view } }));
  }, viewId);
}

/** Expand a sidebar group, then pick a submenu item (rendered as a button). */
export async function openSubmenu(page: Page, groupLabel: string, itemLabel: string) {
  await clickSidebar(page, groupLabel);
  await page.getByRole("button", { name: itemLabel, exact: true }).click();
}
