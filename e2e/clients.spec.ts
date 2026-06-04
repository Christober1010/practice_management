import { test, expect } from "@playwright/test";
import { gotoApp, clickSidebar } from "./helpers/navigation";
import { waitForApi } from "./helpers/api";
import { addClientViaModal, buildE2EClient } from "./helpers/client-form";

test.describe("Clients", () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
    await clickSidebar(page, "Clients");
    await expect(
      page.getByRole("heading", { name: "Client Management" })
    ).toBeVisible();
  });

  test("loads client list with authenticated API", async ({ page }) => {
    const clientsResponse = waitForApi(page, "/get-clients.php");
    await clickSidebar(page, "Dashboard");
    await clickSidebar(page, "Clients");

    const res = await clientsResponse;
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(Array.isArray(json.clients)).toBe(true);
    expect(json.clients.length).toBeGreaterThan(0);

    await expect(page.getByText(/Active Clients \(\d+\)/)).toBeVisible();
  });

  test("adds a new client via modal", async ({ page }) => {
    const client = buildE2EClient();

    await page.getByRole("button", { name: "Add Client" }).click();

    await addClientViaModal(page, client);

    const row = page.locator("table tbody tr").filter({
      hasText: client.lastName,
    });
    await expect(row.first()).toBeVisible({ timeout: 20_000 });

    await page
      .getByPlaceholder("Search all client fields...")
      .fill(client.email);
    await expect(row.first()).toBeVisible();
  });

  test("opens edit client modal from row action", async ({ page }) => {
    await page.getByPlaceholder("Search all client fields...").fill("");

    const firstRow = page.locator("table tbody tr").first();
    await expect(firstRow).toBeVisible();

    await firstRow.getByTitle("Edit").click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Edit Client")).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();
  });
});
