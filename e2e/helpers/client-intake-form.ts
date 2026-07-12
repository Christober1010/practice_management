import { expect, type Page } from "@playwright/test";

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function field(page: Page, label: string) {
  return page.locator("div.space-y-2").filter({ hasText: label }).locator("input, textarea").first();
}

export async function drawSignatureOnCanvas(page: Page, index = 0) {
  const canvas = page.locator("canvas").nth(index);
  await canvas.scrollIntoViewIfNeeded();
  await expect(canvas).toBeVisible({ timeout: 15_000 });

  const box = await canvas.boundingBox();
  if (!box) throw new Error(`Signature canvas ${index} has no bounding box`);

  const y = box.y + box.height * 0.55;
  await page.mouse.move(box.x + 24, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 24, y, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(500);
}

export async function fillMinimalClientIntake(page: Page, childName: string) {
  await field(page, "Legal name of child").fill(childName);
  await field(page, "Child's DOB").fill("2018-06-15");
  await field(page, "Name of person completing this form").fill("E2E Test Parent");
  await field(page, "Telephone (cell)").fill("555-010-9999");
  await field(page, "Child's home address").fill("123 Playwright Lane, Test City, GA 30000");
  await field(page, "Goals for therapy").fill("Improve communication and daily living skills.");
  await field(page, "Diagnosis, including age at diagnosis").fill(
    "Autism Spectrum Disorder, diagnosed age 3"
  );

  for (const label of [
    "Informed Consent for Treatment",
    "Authorization to Release Information",
    "Assignment of Benefits",
    "Authorization for Additional Fees",
    "Authorization for Treatment",
  ]) {
    await page.getByText(label, { exact: true }).click();
  }

  await page.getByText("I understand and agree to the caregiver guidelines.").click();

  await drawSignatureOnCanvas(page, 0);
  await field(page, "Parent/guardian signature date").fill(todayIsoDate());
}

export async function navigateToClientIntake(page: Page) {
  const nav = page.getByRole("button", { name: "Client Intake" });
  await expect(nav).toBeVisible({ timeout: 20_000 });
  await nav.click();
  await expect(page.getByText("Client Intake Packet")).toBeVisible({ timeout: 20_000 });
}
