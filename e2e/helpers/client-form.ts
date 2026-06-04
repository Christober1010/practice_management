import { expect, type Page } from "@playwright/test";

export type E2EClientPayload = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
};

export function buildE2EClient(): E2EClientPayload {
  const stamp = Date.now();
  return {
    firstName: `E2EFirst${stamp}`,
    lastName: `E2ELast${stamp}`,
    email: `e2e.client.${stamp}@mahaverse-test.invalid`,
    phone: "5555550100",
    dateOfBirth: "2015-06-15",
  };
}

/** Fill required Personal + Contact tabs and submit Add Client. */
export async function addClientViaModal(page: Page, client: E2EClientPayload) {
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Add New Client")).toBeVisible();

  await dialog.locator("#first_name").fill(client.firstName);
  await dialog.locator("#last_name").fill(client.lastName);
  await dialog.locator("#date_of_birth").fill(client.dateOfBirth);

  await dialog.getByRole("button", { name: "Next", exact: true }).click();
  await expect(dialog.getByText("Contact Information")).toBeVisible();

  await dialog.locator("#phone").fill(client.phone);
  await dialog.locator("#email").fill(client.email);

  const saveResponse = page.waitForResponse(
    (res) =>
      /update-clients\.php/.test(res.url()) &&
      res.request().method() === "POST" &&
      res.status() === 200,
    { timeout: 45_000 }
  );
  const listRefresh = page.waitForResponse(
    (res) =>
      /get-clients\.php/.test(res.url()) &&
      res.request().method() === "GET" &&
      res.status() === 200,
    { timeout: 45_000 }
  );

  await dialog.getByRole("button", { name: "Add Client", exact: true }).click();

  const res = await saveResponse;
  const json = await res.json();
  expect(json.success).toBe(true);

  await expect(dialog).toBeHidden({ timeout: 15_000 });
  await expect(page.getByText("Client added successfully!")).toBeVisible();
  await listRefresh;
}
