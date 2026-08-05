import { expect, type Page } from "@playwright/test";
import path from "path";
import fs from "fs";
import { execSync } from "child_process";
import { gotoApp, clickSidebar } from "./navigation";
import { gotoSchedulingCalendar } from "./session-notes-ui";

const E2E_DEFAULT_YEAR = 2026;

export type ImportExcelRow = {
  clientFirst: string;
  clientLast: string;
  staffFirst: string;
  staffLast: string;
  authNumber: string;
  serviceCode: string;
  dosYmd: string;
  startHour: number;
  startMinute: number;
  durationMin: number;
  status?: string;
  notes: string;
  address: string;
};

export function buildImportExcelFixture(
  templatePath: string,
  outPath: string,
  rows: ImportExcelRow[]
) {
  const scriptPath = path.join(__dirname, "../scripts/build-import-xlsx.js");
  execSync(
    `node "${scriptPath}" "${templatePath}" "${outPath}" '${JSON.stringify(rows).replace(/'/g, "'\\''")}'`,
    { cwd: path.join(__dirname, "../.."), stdio: "pipe" }
  );
  expect(fs.existsSync(outPath)).toBeTruthy();
}

export async function importSessionsFromExcel(page: Page, excelPath: string) {
  await gotoApp(page);
  await clickSidebar(page, "Reports");
  await clickSidebar(page, "Session Log");
  await expect(page.getByRole("heading", { name: "Session Log" }).first()).toBeVisible({
    timeout: 20_000,
  });
  await page.getByRole("button", { name: /import session/i }).click();
  const dialog = page.getByRole("dialog").filter({ hasText: "Import Sessions" });
  await expect(dialog).toBeVisible({ timeout: 15_000 });

  const fileInput = dialog.locator('input[type="file"]');
  await fileInput.setInputFiles(excelPath);

  await expect(dialog.getByText(/columns match|data row/i).first()).toBeVisible({
    timeout: 20_000,
  });

  const validateRes = page.waitForResponse(
    (res) =>
      /import-sessions\.php/.test(res.url()) &&
      res.request().method() === "POST" &&
      res.status() === 200,
    { timeout: 60_000 }
  );
  await dialog.getByRole("button", { name: /validate rows/i }).click();
  const validateResponse = await validateRes;
  const validateData = await validateResponse.json();
  expect(validateData.success, JSON.stringify(validateData)).toBeTruthy();
  expect(validateData.readyCount, "validation ready count").toBeGreaterThan(0);

  const importRes = page.waitForResponse(
    (res) =>
      /import-sessions\.php/.test(res.url()) &&
      res.request().method() === "POST" &&
      res.status() === 200,
    { timeout: 90_000 }
  );
  await dialog.getByRole("button", { name: /import .* session/i }).click();
  const importResponse = await importRes;
  const importData = await importResponse.json();
  expect(importData.success, JSON.stringify(importData)).toBeTruthy();
  expect(importData.imported, JSON.stringify(importData)).toBeGreaterThan(0);

  await expect(dialog).toBeHidden({ timeout: 20_000 });
  return importData as {
    imported: number;
    session_ids: number[];
    rows: Array<{ line: number; session_id: number | null; ready: boolean }>;
  };
}

export async function openMonthDay(page: Page, day: number) {
  const dayCard = page
    .locator("main")
    .locator('[class*="cursor-pointer"][class*="min-h-"]')
    .filter({ has: page.getByText(String(day), { exact: true }) })
    .first();
  await dayCard.click();
  await expect(
    page.getByText(new RegExp(`Oct\\s+${day},\\s*2026`, "i")).first()
  ).toBeVisible({ timeout: 30_000 });
}

export async function goToCalendarMonth(
  page: Page,
  year: number,
  monthName: string
) {
  await gotoSchedulingCalendar(page);
  const monthBtn = page.getByRole("button", { name: "Month", exact: true });
  if (await monthBtn.isVisible().catch(() => false)) {
    await monthBtn.click();
  }
  for (let i = 0; i < 36; i++) {
    const heading = page.getByText(new RegExp(`${monthName}\\s+${year}`));
    if (await heading.isVisible().catch(() => false)) {
      await page
        .waitForResponse(
          (res) =>
            /add-session\.php/.test(res.url()) &&
            res.request().method() === "GET" &&
            res.status() === 200,
          { timeout: 60_000 }
        )
        .catch(() => null);
      await expect(page.getByText("Loading sessions")).toBeHidden({
        timeout: 60_000,
      }).catch(() => {});
      return;
    }
    const sessionsRefresh = page
      .waitForResponse(
        (res) =>
          /add-session\.php/.test(res.url()) &&
          res.request().method() === "GET" &&
          res.status() === 200,
        { timeout: 30_000 }
      )
      .catch(() => null);
    await page.locator("button:has(.lucide-chevron-right)").first().click();
    await sessionsRefresh;
  }
  throw new Error(`Could not navigate calendar to ${monthName} ${year}`);
}

export async function completeSessionViaEdit(
  page: Page,
  sessionMatch: RegExp,
  completionNote: string,
  opts?: { day?: number; year?: number; monthName?: string }
) {
  if (opts?.year != null && opts?.monthName) {
    await goToCalendarMonth(page, opts.year, opts.monthName);
  }

  const monthBtn = page.getByRole("button", { name: "Month", exact: true });
  if (await monthBtn.isVisible().catch(() => false)) {
    await monthBtn.click();
  }

  if (opts?.day != null) {
    await openMonthDay(page, opts.day);
  }

  const sessionCard = page.getByRole("button").filter({ hasText: sessionMatch }).first();
  await expect(sessionCard).toBeVisible({ timeout: 45_000 });
  await sessionCard.getByRole("button", { name: "Edit Session" }).click();

  const editDialog = page.getByRole("dialog");
  await expect(
    editDialog.getByRole("heading", { name: /^Edit Session$/i })
  ).toBeVisible({ timeout: 20_000 });
  await editDialog
    .getByPlaceholder("Add a quick note for this session...")
    .fill(completionNote);
  const renderedHours = editDialog.locator("#renderedHours");
  if (await renderedHours.isVisible().catch(() => false)) {
    await renderedHours.fill("1");
  }

  const saveResponse = page.waitForResponse(
    (res) =>
      /add-session\.php/.test(res.url()) &&
      res.request().method() === "PUT" &&
      res.status() === 200,
    { timeout: 45_000 }
  );
  await editDialog.getByRole("button", { name: "Update Session" }).click();
  const res = await saveResponse;
  const data = await res.json();
  expect(data.success, String(data.error || "")).toBeTruthy();
  await expect(editDialog).toBeHidden({ timeout: 20_000 });
}
