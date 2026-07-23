/**
 * E2E: manual Add Session vs Excel import — create, complete, billing parity.
 * Run: E2E_TARGET=test pnpm exec playwright test e2e/scheduling-manual-vs-import.spec.ts --project=test-chromium
 */
import { test, expect, request as playwrightRequest } from "@playwright/test";
import path from "path";
import fs from "fs";
import { openMahaverseView, gotoApp } from "./helpers/navigation";
import { waitForApi } from "./helpers/api";
import {
  fillAddSessionForm,
  submitAddSessionForm,
} from "./helpers/scheduling-form";
import {
  seedSchedulingFlow,
  type SchedulingFlowSeed,
} from "./helpers/scheduling-seed";
import {
  buildImportExcelFixture,
  importSessionsFromExcel,
  goToCalendarMonth,
  completeSessionViaEdit,
  openMonthDay,
} from "./helpers/scheduling-import-ui";
import {
  fetchSessionById,
  normalizeBillingSnapshot,
  diffBillingSnapshots,
  assertReadyToBill,
  billingKeysPopulated,
} from "./helpers/session-billing-compare";
import {
  fillClinicalNotesAndSave,
} from "./helpers/session-notes-ui";
import { MahaverseApiClient } from "./helpers/api-client";

test.describe.configure({ mode: "serial" });
test.setTimeout(300_000);

let seed: SchedulingFlowSeed;
let apiToken = "";
let manualSessionId = "";
let importSessionIds: string[] = [];
let excelPath = "";

let manualSlot = { hour: 8, minute: 0 };
let import1Slot = { hour: 9, minute: 0 };
let import2Slot = { hour: 10, minute: 0 };

const E2E_MONTH = "October";
const E2E_YEAR = 2026;
const completionNote = (label: string) => `E2E ${label} ${seed?.ts ?? ""} rendered`;

function sessionTimePattern(hour: number, minute: number): RegExp {
  const h12 = hour % 12 || 12;
  const ampm = hour >= 12 ? "PM" : "AM";
  const min =
    minute === 0
      ? `${h12}:00\\s*${ampm}`
      : `${h12}:${String(minute).padStart(2, "0")}\\s*${ampm}`;
  return new RegExp(min, "i");
}

function toDatetimeLocal(ymd: string, hour: number, minute: number) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const [y, m, d] = ymd.split("-");
  return `${y}-${pad(Number(m))}-${pad(Number(d))}T${pad(hour)}:${pad(minute)}`;
}

function slotFromSeed(baseHour: number, offset = 0) {
  const n = parseInt(String(seed?.ts || Date.now()).slice(-6), 10) || Date.now();
  const hour = baseHour + ((n + offset) % 6);
  const minute = ((Math.floor(n / 6) + offset) % 4) * 15;
  return { hour, minute };
}

function manualSessionTimes() {
  const { hour, minute } = manualSlot;
  return {
    startLocal: toDatetimeLocal("2026-10-15", hour, minute),
    endLocal: toDatetimeLocal("2026-10-15", hour + 1, minute),
  };
}

test.beforeAll(async () => {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;
  if (!email || !password) {
    throw new Error("Set E2E_EMAIL and E2E_PASSWORD in e2e/.env");
  }
  seed = await seedSchedulingFlow(email, password);

  const apiRequest = await playwrightRequest.newContext();
  try {
    const api = await MahaverseApiClient.login(apiRequest, email, password);
    apiToken = api.token;
  } finally {
    await apiRequest.dispose();
  }

  const template = path.join(
    process.cwd(),
    "docs/CL_PA_RPT (52).xlsx"
  );
  excelPath = path.join(
    process.cwd(),
    `e2e/fixtures/e2e-import-${seed.ts}.xlsx`
  );
  fs.mkdirSync(path.dirname(excelPath), { recursive: true });

  manualSlot = slotFromSeed(8, 0);
  import1Slot = slotFromSeed(9, 1);
  import2Slot = slotFromSeed(10, 2);

  buildImportExcelFixture(template, excelPath, [
    {
      clientFirst: seed.clientFirst,
      clientLast: seed.clientLast,
      staffFirst: seed.staffFirst,
      staffLast: seed.staffLast,
      authNumber: seed.authNumber,
      serviceCode: seed.serviceCode,
      dosYmd: "2026-10-16",
      startHour: import1Slot.hour,
      startMinute: import1Slot.minute,
      durationMin: 60,
      notes: "",
      address: seed.locationValue,
    },
    {
      clientFirst: seed.clientFirst,
      clientLast: seed.clientLast,
      staffFirst: seed.staffFirst,
      staffLast: seed.staffLast,
      authNumber: seed.authNumber,
      serviceCode: seed.serviceCode,
      dosYmd: "2026-10-17",
      startHour: import2Slot.hour,
      startMinute: import2Slot.minute,
      durationMin: 60,
      notes: "",
      address: seed.locationValue,
    },
  ]);
});

test.describe("Scheduling manual vs import (UI E2E)", () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
  });

  test("1 — manual Add Session via UI", async ({ page }) => {
    await openMahaverseView(page, "clients");
    await waitForApi(page, "/get-clients.php").catch(() => null);
    await openMahaverseView(page, "scheduling");
    await expect(page.getByRole("heading", { name: "Appointments" })).toBeVisible();
    await waitForApi(page, "/add-session.php").catch(() => null);
    await waitForApi(page, "/get-clients.php").catch(() => null);

    await page.getByRole("button", { name: /add session/i }).first().click();
    const times = manualSessionTimes();
    await fillAddSessionForm(page, {
      clientName: seed.clientName,
      providerName: new RegExp(seed.providerName.split(/\s+/)[0], "i"),
      startLocal: times.startLocal,
      endLocal: times.endLocal,
      billingLabel: new RegExp(
        String(seed.serviceCode || seed.billingLabel).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        "i"
      ),
      locationMatch: new RegExp(
        seed.locationValue.split(",")[0].slice(0, Math.min(10, seed.locationValue.length)),
        "i"
      ),
    });
    const data = await submitAddSessionForm(page);
    manualSessionId = String(data.session_id || "");
    expect(manualSessionId).toBeTruthy();
  });

  test("2 — import 2 sessions via Excel UI", async ({ page }) => {
    const data = await importSessionsFromExcel(page, excelPath);
    importSessionIds = (data.session_ids || []).map(String);
    expect(importSessionIds.length).toBe(2);
  });

  test("3 — calendar shows all 3 sessions in October", async ({ page }) => {
    await goToCalendarMonth(page, E2E_YEAR, E2E_MONTH);
    const cases: Array<[number, RegExp]> = [
      [15, sessionTimePattern(manualSlot.hour, manualSlot.minute)],
      [16, sessionTimePattern(import1Slot.hour, import1Slot.minute)],
      [17, sessionTimePattern(import2Slot.hour, import2Slot.minute)],
    ];
    for (const [day, timePattern] of cases) {
      await openMonthDay(page, day);
      await expect(
        page.getByRole("button").filter({ hasText: timePattern }).first()
      ).toBeVisible({ timeout: 45_000 });
      await page.getByRole("button", { name: "Month", exact: true }).click();
      await expect(
        page.getByText(new RegExp(`${E2E_MONTH}\\s+${E2E_YEAR}`))
      ).toBeVisible({ timeout: 15_000 });
    }
  });

  test("4 — complete all sessions via UI edit (Rendered)", async ({ page }) => {
    await completeSessionViaEdit(
      page,
      sessionTimePattern(manualSlot.hour, manualSlot.minute),
      completionNote("manual"),
      { day: 15, year: E2E_YEAR, monthName: E2E_MONTH }
    );
    await completeSessionViaEdit(
      page,
      sessionTimePattern(import1Slot.hour, import1Slot.minute),
      completionNote("import1"),
      { day: 16, year: E2E_YEAR, monthName: E2E_MONTH }
    );
    await completeSessionViaEdit(
      page,
      sessionTimePattern(import2Slot.hour, import2Slot.minute),
      completionNote("import2"),
      { day: 17, year: E2E_YEAR, monthName: E2E_MONTH }
    );
  });

  test("5 — session notes saved for manual session", async ({ page }) => {
    await goToCalendarMonth(page, E2E_YEAR, E2E_MONTH);
    await openMonthDay(page, 15);

    const sessionBlock = page
      .getByRole("button")
      .filter({ hasText: sessionTimePattern(manualSlot.hour, manualSlot.minute) })
      .first();
    const notesLoad = page.waitForResponse(
      (res) =>
        /session-notes\.php/.test(res.url()) &&
        res.request().method() === "GET" &&
        res.status() === 200,
      { timeout: 45_000 }
    );
    await sessionBlock.getByTitle("Session Notes").click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Session Notes")).toBeVisible({ timeout: 20_000 });
    await notesLoad;
    await fillClinicalNotesAndSave(
      page,
      `E2E billing notes manual ${seed.ts}`,
      dialog
    );
  });

  test("6 — billing parity: manual vs import (API diff)", async ({ request }) => {
    expect(manualSessionId).toBeTruthy();
    expect(importSessionIds.length).toBe(2);

    const manualRow = await fetchSessionById(request, apiToken, manualSessionId);
    const import1 = await fetchSessionById(request, apiToken, importSessionIds[0]);
    const import2 = await fetchSessionById(request, apiToken, importSessionIds[1]);

    assertReadyToBill(manualRow, "manual session");
    assertReadyToBill(import1, "import session 1");
    assertReadyToBill(import2, "import session 2");

    const manualSnap = normalizeBillingSnapshot(manualRow);
    const importSnap1 = normalizeBillingSnapshot(import1);
    const importSnap2 = normalizeBillingSnapshot(import2);

    console.log("\n=== Manual session billing snapshot ===");
    console.log(JSON.stringify(manualSnap, null, 2));
    console.log("Populated keys:", billingKeysPopulated(manualSnap).join(", "));

    const diff1 = diffBillingSnapshots(manualSnap, importSnap1);
    const diff2 = diffBillingSnapshots(manualSnap, importSnap2);

    console.log("\n=== Import row 1 vs manual ===");
    console.log("Missing on import:", diff1.missingOnImport.join(", ") || "(none)");
    console.log("Value diffs:", JSON.stringify(diff1.valueDiffs, null, 2));

    console.log("\n=== Import row 2 vs manual ===");
    console.log("Missing on import:", diff2.missingOnImport.join(", ") || "(none)");
    console.log("Value diffs:", JSON.stringify(diff2.valueDiffs, null, 2));

    // Core billing fields must match between manual and import paths
    for (const key of [
      "auth_id",
      "place_of_service",
      "unit_rate",
      "line_charge",
      "claim_id",
      "claim_status",
    ] as const) {
      if (manualSnap[key] !== "" && manualSnap[key] != null) {
        expect(
          importSnap1[key],
          `import1 missing ${key} present on manual`
        ).toBeTruthy();
        expect(
          importSnap2[key],
          `import2 missing ${key} present on manual`
        ).toBeTruthy();
      }
    }

    // Expected differences: times, hours, notes/status text, auth_code label format
    const allowedDiffKeys = new Set([
      "start_utc",
      "end_utc",
      "scheduled_hours",
      "rendered_hours",
      "auth_code",
      "location_address",
    ]);
    const unexpected1 = diff1.valueDiffs.filter((d) => !allowedDiffKeys.has(d.key));
    const unexpected2 = diff2.valueDiffs.filter((d) => !allowedDiffKeys.has(d.key));

    expect(
      diff1.missingOnImport.filter((k) => !allowedDiffKeys.has(k)),
      "import1 missing fields vs manual"
    ).toEqual([]);
    expect(
      diff2.missingOnImport.filter((k) => !allowedDiffKeys.has(k)),
      "import2 missing fields vs manual"
    ).toEqual([]);
    expect(unexpected1, "import1 unexpected value diffs").toEqual([]);
    expect(unexpected2, "import2 unexpected value diffs").toEqual([]);
  });
});
