import { expect, type Page } from "@playwright/test";
import { gotoApp, openMahaverseView } from "./navigation";
import { waitForApi } from "./api";

export async function gotoSchedulingCalendar(page: Page) {
  await gotoApp(page);
  const sessionsLoad = waitForApi(page, "/add-session.php").catch(() => null);
  await openMahaverseView(page, "scheduling");
  await expect(page.getByRole("heading", { name: "Appointments" })).toBeVisible({
    timeout: 30_000,
  });
  await sessionsLoad;
  await expect(page.getByText("Loading sessions")).toBeHidden({
    timeout: 60_000,
  }).catch(() => {});
}

/** Move calendar to tomorrow (UI-created sessions use tomorrow slots). */
export async function focusSchedulingTomorrow(page: Page) {
  await page.getByRole("button", { name: "Today" }).click().catch(() => {});
  await page.locator("button:has(.lucide-chevron-right)").click();
  const dayBtn = page.getByRole("button", { name: "Day", exact: true });
  if (await dayBtn.isVisible().catch(() => false)) {
    await dayBtn.click();
  } else {
    await page.getByRole("button", { name: "Week", exact: true }).click().catch(() => {});
  }
}

export async function openSessionNotesForClient(
  page: Page,
  clientName: string
) {
  await gotoSchedulingCalendar(page);
  await focusSchedulingTomorrow(page);

  const nameBit = clientName.split(/\s+/).filter(Boolean)[0] || clientName;
  await expect(page.getByText(nameBit, { exact: false }).first()).toBeVisible({
    timeout: 30_000,
  });

  const notesBtn = page
    .getByTitle("Session Notes")
    .or(page.getByRole("button", { name: "Notes", exact: true }))
    .first();
  await expect(notesBtn).toBeVisible({ timeout: 15_000 });
  const notesLoad = page.waitForResponse(
    (res) =>
      /session-notes\.php/.test(res.url()) &&
      res.request().method() === "GET" &&
      res.status() === 200,
    { timeout: 45_000 }
  );
  await notesBtn.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Session Notes")).toBeVisible({ timeout: 20_000 });
  await notesLoad;
  return dialog;
}

export async function saveSessionNotesFooter(page: Page, dialog = page.getByRole("dialog")) {
  const saveResponse = page.waitForResponse(
    (res) =>
      /session-notes\.php/.test(res.url()) &&
      res.request().method() === "POST" &&
      res.status() === 200,
    { timeout: 45_000 }
  );
  await dialog.getByRole("button", { name: "SAVE", exact: true }).click();
  const res = await saveResponse;
  const data = await res.json();
  expect(data.success, String(data.error || data.message || "")).toBeTruthy();
}

export async function incrementFirstBehaviorCount(
  page: Page,
  dialog = page.getByRole("dialog")
) {
  await dialog.getByRole("tab", { name: "Data Collection" }).click();
  await dialog.getByRole("button", { name: "Behaviors", exact: true }).click();
  const firstRow = dialog.locator("table tbody tr").first();
  await expect(firstRow).toBeVisible({ timeout: 20_000 });
  await firstRow.getByRole("button").last().click();
}

export async function saveBehaviorsInDataCollection(
  page: Page,
  dialog = page.getByRole("dialog")
) {
  const saveResponse = page.waitForResponse(
    (res) =>
      /session-notes\.php/.test(res.url()) &&
      res.request().method() === "POST" &&
      res.status() === 200,
    { timeout: 45_000 }
  );
  await dialog.getByRole("button", { name: /Save behaviors/i }).click();
  const res = await saveResponse;
  const data = await res.json();
  expect(data.success, String(data.error || data.message || "")).toBeTruthy();
}

export async function fillClinicalNotesAndSave(
  page: Page,
  noteText: string,
  dialog = page.getByRole("dialog")
) {
  await dialog.getByRole("tab", { name: "Session Notes" }).click();
  await dialog.getByRole("tab", { name: "SOAP Notes" }).click();
  await dialog.locator("#subjective").fill(noteText);
  await saveSessionNotesFooter(page, dialog);
}
