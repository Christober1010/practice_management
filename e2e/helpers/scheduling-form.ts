import { expect, type Locator, type Page } from "@playwright/test";

/** Radix Select tied to a visible field label inside a container (e.g. dialog). */
export async function selectLabeledCombobox(
  scope: Page | Locator,
  label: string,
  option: string | RegExp
) {
  const field = scope
    .locator("div.space-y-1")
    .filter({ has: scope.getByText(label, { exact: false }) })
    .first();
  await field.getByRole("combobox").click();
  await scope.page().getByRole("option", { name: option }).click();
}

export type AddSessionFormOptions = {
  clientName: string | RegExp;
  providerName: string | RegExp;
  startLocal: string;
  endLocal: string;
  billingLabel?: string | RegExp;
  locationMatch?: string | RegExp;
  quickNote?: string;
};

export async function fillAddSessionForm(page: Page, opts: AddSessionFormOptions) {
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Add New Session")).toBeVisible();

  await selectLabeledCombobox(dialog, "Client *", opts.clientName);
  await selectLabeledCombobox(dialog, "Provider *", opts.providerName);

  await dialog.locator("#startDateTime").fill(opts.startLocal);
  await dialog.locator("#endDateTime").fill(opts.endLocal);

  if (opts.billingLabel) {
    await selectLabeledCombobox(dialog, "Billing Code *", opts.billingLabel);
  }
  if (opts.locationMatch) {
    await selectLabeledCombobox(dialog, "Location Address *", opts.locationMatch);
  }
  if (opts.quickNote) {
    await dialog
      .getByPlaceholder("Add a quick note for this session...")
      .fill(opts.quickNote);
  }
}

export async function submitAddSessionForm(page: Page) {
  const dialog = page.getByRole("dialog");
  const saveResponse = page.waitForResponse(
    (res) =>
      /add-session\.php/.test(res.url()) &&
      res.request().method() === "POST" &&
      res.status() === 200,
    { timeout: 45_000 }
  );
  await dialog.getByRole("button", { name: "Add Session", exact: true }).click();
  const res = await saveResponse;
  const data = await res.json();
  expect(data.success, String(data.error || data.message || "")).toBeTruthy();
  await expect(dialog).toBeHidden({ timeout: 20_000 });
  return data;
}
