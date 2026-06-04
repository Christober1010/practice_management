import { test, expect } from "@playwright/test";
import { gotoApp, clickSidebar } from "./helpers/navigation";

test.describe("Data collection — session notes UI", () => {
  test("opens session notes from scheduling when sessions exist", async ({
    page,
  }) => {
    await gotoApp(page);
    await clickSidebar(page, "Scheduling");

    await expect(
      page.getByRole("heading", { name: "Scheduling" })
    ).toBeVisible();

    const notesBtn = page.getByRole("button", { name: "Notes" }).first();
    const hasNotes = await notesBtn.isVisible().catch(() => false);
    if (!hasNotes) {
      test.skip(true, "No sessions with Notes button on calendar — schedule one in test DB");
      return;
    }

    const notesLoad = page.waitForResponse(
      (res) =>
        /session-notes\.php/.test(res.url()) &&
        res.request().method() === "GET" &&
        res.status() === 200,
      { timeout: 45_000 }
    );

    await notesBtn.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 20_000 });

    await notesLoad;

    await expect(
      dialog.getByText(/Session Notes|Data Collection|Overview/i).first()
    ).toBeVisible();

    await dialog.getByRole("button", { name: "CANCEL" }).click();
  });
});
