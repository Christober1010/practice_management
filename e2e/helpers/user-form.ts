import { expect, type Page } from "@playwright/test";

export function buildE2EUser(ts: string) {
  return {
    email: `e2e.ui.user.${ts}@mahaverse-test.invalid`,
    password: "E2eUiPass!99",
    firstName: "E2EUi",
    lastName: `User${ts}`,
    role: "rbt",
  };
}

export async function addUserViaModal(
  page: Page,
  user: ReturnType<typeof buildE2EUser>
) {
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Add New User")).toBeVisible();

  await dialog.locator('input[name="email"]').fill(user.email);
  await dialog.locator('input[name="PASSWORD"]').fill(user.password);
  await dialog.getByRole("combobox").click();
  await page.getByRole("option", { name: /^RBT$/i }).click();
  await dialog.locator('input[name="first_name"]').fill(user.firstName);
  await dialog.locator('input[name="last_name"]').fill(user.lastName);

  const saveResponse = page.waitForResponse(
    (res) =>
      /update-users\.php/.test(res.url()) &&
      res.request().method() === "POST" &&
      res.status() === 200,
    { timeout: 45_000 }
  );

  await dialog.getByRole("button", { name: "Add User", exact: true }).click();
  const res = await saveResponse;
  const json = await res.json();
  expect(json.success).toBe(true);
  await expect(dialog).toBeHidden({ timeout: 15_000 });
}
