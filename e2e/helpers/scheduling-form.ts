import { expect, type Locator, type Page } from "@playwright/test";

/** Radix Select tied to a visible field label inside a container (e.g. dialog). */
export async function selectLabeledCombobox(
  scope: Page | Locator,
  label: string,
  option: string | RegExp,
  opts?: { allowFirstEnabled?: boolean }
) {
  const page = "page" in scope ? scope.page() : scope;
  const labelEl = scope.getByText(label, { exact: false }).first();
  await expect(labelEl).toBeVisible({ timeout: 30_000 });
  const field = labelEl.locator("xpath=..");
  const combo = field.getByRole("combobox").first();
  await combo.click();
  const listbox = page.getByRole("listbox").last();
  await expect(listbox).toBeVisible({ timeout: 15_000 });
  const enabled = listbox.getByRole("option").filter({
    hasNotText: /select client|no billing|no address|not available/i,
  });
  const optionLocator =
    option instanceof RegExp
      ? enabled.filter({ hasText: option })
      : enabled.filter({
          hasText: new RegExp(
            `^\\s*${option.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`
          ),
        });
  if ((await optionLocator.count()) === 0 && opts?.allowFirstEnabled) {
    await expect(enabled.first()).toBeVisible({ timeout: 20_000 });
    await enabled.first().click();
    return;
  }
  await expect(optionLocator.first()).toBeVisible({ timeout: 20_000 });
  await optionLocator.first().click();
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
  await page
    .waitForResponse(
      (r) => /get-clients\.php/.test(r.url()) && r.status() === 200,
      { timeout: 60_000 }
    )
    .catch(() => null);

  await selectLabeledCombobox(dialog, "Client *", opts.clientName);
  const billingField = dialog
    .getByText("Billing Code *", { exact: false })
    .locator("xpath=..");
  const billingCombo = billingField.getByRole("combobox").first();
  await expect(billingCombo).not.toHaveText(/Select client first/i, {
    timeout: 45_000,
  });

  await selectLabeledCombobox(dialog, "Provider *", opts.providerName);

  await dialog.locator("#startDateTime").fill(opts.startLocal);
  await dialog.locator("#endDateTime").fill(opts.endLocal);

  if (opts.billingLabel) {
    await selectLabeledCombobox(dialog, "Billing Code *", opts.billingLabel, {
      allowFirstEnabled: true,
    });
  }
  if (opts.locationMatch) {
    await selectLabeledCombobox(dialog, "Location Address *", opts.locationMatch, {
      allowFirstEnabled: true,
    });
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
      res.request().method() === "POST",
    { timeout: 90_000 }
  );
  await dialog.getByRole("button", { name: "Add Session", exact: true }).click();
  const res = await saveResponse;
  const data = await res.json().catch(() => ({}));
  expect(
    res.ok() && data.success,
    String(data.error || data.message || `HTTP ${res.status()}`)
  ).toBeTruthy();
  await expect(dialog).toBeHidden({ timeout: 20_000 });
  return data;
}
