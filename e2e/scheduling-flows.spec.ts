/**
 * Scheduling + session notes + data collection (UI flows, serial).
 * Run: E2E_TARGET=test pnpm exec playwright test e2e/scheduling-flows.spec.ts --project=test-chromium
 */
import { test, expect } from "@playwright/test";
import { gotoApp, openMahaverseView } from "./helpers/navigation";
import { waitForApi } from "./helpers/api";
import {
  seedSchedulingFlow,
  tomorrowLocalWindow,
  type SchedulingFlowSeed,
} from "./helpers/scheduling-seed";
import {
  fillAddSessionForm,
  submitAddSessionForm,
} from "./helpers/scheduling-form";
import {
  gotoSchedulingCalendar,
  focusSchedulingTomorrow,
  openSessionNotesForClient,
  incrementFirstBehaviorCount,
  saveBehaviorsInDataCollection,
  fillClinicalNotesAndSave,
} from "./helpers/session-notes-ui";

test.describe.configure({ mode: "serial" });
test.setTimeout(180_000);

let seed: SchedulingFlowSeed;
/** Set by UI create-session test; used to find the session on the calendar. */
let uiQuickNote = "";

test.beforeAll(async () => {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;
  if (!email || !password) {
    throw new Error("Set E2E_EMAIL and E2E_PASSWORD in e2e/.env");
  }
  seed = await seedSchedulingFlow(email, password);
});

test.describe("Scheduling & session notes flows", () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
  });

  test("creates a session via Add Session form (POST add-session)", async ({
    page,
  }) => {
    const win = tomorrowLocalWindow(seed.ts);
    uiQuickNote = `E2E UI create ${seed.ts}`;

    await openMahaverseView(page, "scheduling");
    await expect(page.getByRole("heading", { name: "Appointments" })).toBeVisible();
    await waitForApi(page, "/add-session.php").catch(() => null);

    const addBtn = page.getByRole("button", { name: /add session/i });
    await expect(addBtn.first()).toBeVisible({ timeout: 20_000 });
    await addBtn.first().click();
    await fillAddSessionForm(page, {
      clientName: seed.clientName,
      providerName: new RegExp(seed.providerName.split(" ")[0], "i"),
      startLocal: win.startLocal,
      endLocal: win.endLocal,
      billingLabel: new RegExp(String(seed.billingLabel).slice(0, 5), "i"),
      locationMatch: new RegExp(
        seed.locationValue.slice(0, Math.min(12, seed.locationValue.length)),
        "i"
      ),
      quickNote: uiQuickNote,
    });
    await submitAddSessionForm(page);
  });

  test("calendar shows UI-created session (Notes control)", async ({ page }) => {
    expect(uiQuickNote).toBeTruthy();
    await gotoSchedulingCalendar(page);
    await focusSchedulingTomorrow(page);
    await expect(page.getByText(uiQuickNote, { exact: false })).toBeVisible({
      timeout: 45_000,
    });
    const notesControl = page
      .getByTitle("Session Notes")
      .or(page.getByRole("button", { name: "Notes", exact: true }));
    await expect(notesControl.first()).toBeVisible({ timeout: 15_000 });
  });

  test("opens Session Notes modal from scheduling", async ({ page }) => {
    const dialog = await openSessionNotesForClient(page, seed.clientName);
    await expect(dialog.getByRole("tab", { name: "Data Collection" })).toBeVisible();
    await expect(dialog.getByRole("tab", { name: "Session Notes" })).toBeVisible();
    await dialog.getByRole("button", { name: "CANCEL" }).click();
    await expect(dialog).toBeHidden();
  });

  test("data collection: increment behavior count and Save behaviors", async ({
    page,
  }) => {
    const dialog = await openSessionNotesForClient(page, seed.clientName);
    await incrementFirstBehaviorCount(page, dialog);
    await saveBehaviorsInDataCollection(page, dialog);
    await dialog.getByRole("button", { name: "CANCEL" }).click();
  });

  test("session notes: SOAP Notes subjective + SAVE", async ({ page }) => {
    const notesDialog = await openSessionNotesForClient(page, seed.clientName);
    const noteText = `E2E subjective ${seed.ts}`;
    await fillClinicalNotesAndSave(page, noteText, notesDialog);

    const reopened = await openSessionNotesForClient(page, seed.clientName);
    await reopened.getByRole("tab", { name: "Session Notes" }).click();
    await reopened.getByRole("tab", { name: "SOAP Notes" }).click();
    await expect(reopened.locator("#subjective")).toHaveValue(noteText);
    await reopened.getByRole("button", { name: "CANCEL" }).click();
  });
});
