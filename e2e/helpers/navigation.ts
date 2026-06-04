import { expect, type Page } from "@playwright/test";

/** Land on the authenticated app shell (dashboard). */
export async function gotoApp(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { name: "Administrator" })
  ).toBeVisible({ timeout: 30_000 });
}

export async function clickSidebar(page: Page, label: string) {
  await page.getByRole("link", { name: label, exact: true }).click();
}

/** Expand a sidebar group, then pick a submenu item (rendered as a button). */
export async function openSubmenu(page: Page, groupLabel: string, itemLabel: string) {
  await clickSidebar(page, groupLabel);
  await page.getByRole("button", { name: itemLabel, exact: true }).click();
}
