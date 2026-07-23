/**
 * Session Log smoke — UI always checked; API checked when session-log.php is deployed.
 * Run: E2E_TARGET=test pnpm exec playwright test e2e/session-log.spec.ts --project=test-chromium
 */
import { test, expect } from "@playwright/test";
import { MahaverseApiClient } from "./helpers/api-client";
import { gotoApp, openMahaverseView } from "./helpers/navigation";

test.describe("Session Log report", () => {
  test("UI opens Session Log tabs; API lists when deployed", async ({
    page,
    request,
  }) => {
    const email = process.env.E2E_EMAIL;
    const password = process.env.E2E_PASSWORD;
    test.skip(!email || !password, "Set E2E_EMAIL and E2E_PASSWORD");

    const api = await MahaverseApiClient.login(request, email!, password!);
    const dosTo = new Date().toISOString().slice(0, 10);
    const from = new Date();
    from.setDate(from.getDate() - 30);
    const dosFrom = from.toISOString().slice(0, 10);

    const res = await api.get(
      `session-log.php?dos_from=${dosFrom}&dos_to=${dosTo}`
    );
    if (res.status() !== 404) {
      const data = await api.json(res);
      expect(res.ok(), JSON.stringify(data)).toBeTruthy();
      expect(data.success).toBeTruthy();
      expect(Array.isArray(data.data)).toBeTruthy();
    }

    await gotoApp(page);
    await openMahaverseView(page, "reportsSessionLog");
    await expect(page.getByText("Session Log (Internal)")).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByRole("tab", { name: /Scheduled/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Rendered/i })).toBeVisible();
    await expect(
      page.getByRole("tab", { name: /Pending Payment/i })
    ).toBeVisible();
    await expect(
      page.getByRole("tab", { name: /Received Payment/i })
    ).toBeVisible();
  });
});
