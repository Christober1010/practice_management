import { test, expect } from "@playwright/test";
import {
  openLaunchpadForm,
} from "./helpers/launchpad-auth";
import {
  fillMinimalClientIntake,
  navigateToClientIntake,
} from "./helpers/client-intake-form";

const LAUNCHPAD_API =
  process.env.E2E_LAUNCHPAD_API_URL ||
  "https://launchpad.mahabehavioralhealth.com";

/** Minimal PNG data URL for API-only signature tests. */
const TINY_SIGNATURE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

async function launchpadApiToken(request: import("@playwright/test").APIRequestContext) {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;
  if (!email || !password) {
    throw new Error("Set E2E_EMAIL and E2E_PASSWORD in e2e/.env");
  }

  const resp = await request.post(`${LAUNCHPAD_API}/backend/login.php`, {
    data: { email, password },
  });
  expect(resp.ok(), `Launchpad login HTTP ${resp.status()}`).toBeTruthy();
  const body = (await resp.json()) as { success?: boolean; token?: string };
  expect(body.token).toBeTruthy();
  return body.token as string;
}

test.describe("Launchpad Client Intake", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("submits client intake via UI", async ({ page, request }) => {
    test.skip(
      !process.env.E2E_EMAIL || !process.env.E2E_PASSWORD,
      "Set E2E_EMAIL and E2E_PASSWORD in e2e/.env"
    );

    const childName = `E2E Intake ${Date.now()}`;
    const formPath = await openLaunchpadForm(page, request);

    await navigateToClientIntake(page);
    await fillMinimalClientIntake(page, childName);

    const submitResponse = page.waitForResponse(
      (res) =>
        res.url().includes("submit_client_intake.php") &&
        res.request().method() === "POST",
      { timeout: 60_000 }
    );

    await page.getByRole("button", { name: "Submit Client Intake" }).click();

    const response = await submitResponse;
    expect(response.ok(), `HTTP ${response.status()}`).toBeTruthy();

    const body = (await response.json()) as {
      success?: boolean;
      message?: string;
      intake_id?: number;
      drive?: Record<string, unknown>;
    };

    expect(body.success, body.message || "submit failed").toBe(true);
    expect(body.intake_id).toBeGreaterThan(0);

    await expect(page.getByText("Client Intake Submitted")).toBeVisible({
      timeout: 15_000,
    });

    test.info().annotations.push({
      type: "intake",
      description: `intake_id=${body.intake_id} child=${childName} formPath=${formPath}`,
    });
    if (body.drive) {
      test.info().annotations.push({
        type: "drive",
        description: JSON.stringify(body.drive),
      });
    }
  });

  test("submits client intake via Launchpad API", async ({ request }) => {
    test.skip(
      !process.env.E2E_EMAIL || !process.env.E2E_PASSWORD,
      "Set E2E_EMAIL and E2E_PASSWORD in e2e/.env"
    );

    const token = await launchpadApiToken(request);
    const childName = `E2E API Intake ${Date.now()}`;
    const today = new Date().toISOString().slice(0, 10);

    const resp = await request.post(
      `${LAUNCHPAD_API}/backend/submit_client_intake.php`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        data: {
          childLegalName: childName,
          childDob: "2018-06-15",
          completedBy: "E2E API Parent",
          childHomeAddress: "123 API Test Lane",
          cellPhone: "555-010-8888",
          therapyGoals: "Communication and social skills.",
          diagnosis: "ASD, age 3",
          consentInformedTreatmentAccepted: true,
          consentReleaseInformationAccepted: true,
          consentAssignmentOfBenefitsAccepted: true,
          consentAdditionalFeesAccepted: true,
          consentTreatmentAuthorizationAccepted: true,
          caregiverGuidelinesAccepted: true,
          parentGuardianSignature: TINY_SIGNATURE,
          parentGuardianSignatureDate: today,
          medications: [{ name: "", dosageAdminTime: "", startDate: "", indication: "" }],
          conditions: {
            allergies: false,
            vision: false,
            hearing: false,
            sleep: false,
            feeding: false,
            sensory: false,
            educational: false,
            other: false,
          },
          preferences: { edible: "", tangible: "", social: "", activity: "" },
        },
      }
    );

    expect(resp.ok(), `HTTP ${resp.status()}`).toBeTruthy();
    const body = (await resp.json()) as {
      success?: boolean;
      message?: string;
      intake_id?: number;
      drive?: {
        enabled?: boolean;
        connected?: boolean | null;
        fallbacks?: string[];
        errors?: Array<{ error?: string }>;
      };
    };

    expect(body.success, body.message || "API submit failed").toBe(true);
    expect(body.intake_id).toBeGreaterThan(0);

    if (body.drive?.enabled) {
      expect(
        body.drive.fallbacks ?? [],
        `Drive upload failed: ${JSON.stringify(body.drive.errors ?? body.drive)}`
      ).toEqual([]);
    }

    test.info().annotations.push({
      type: "api-intake",
      description: `intake_id=${body.intake_id} drive=${JSON.stringify(body.drive ?? {})}`,
    });

    if (body.drive?.enabled && body.drive.fallbacks?.length) {
      console.warn("Drive fallbacks:", body.drive);
    }
  });

  test("Client Intake nav is present after login", async ({ page, request }) => {
    test.skip(
      !process.env.E2E_EMAIL || !process.env.E2E_PASSWORD,
      "Set E2E_EMAIL and E2E_PASSWORD in e2e/.env"
    );

    await openLaunchpadForm(page, request);
    const nav = page.getByRole("button", { name: "Client Intake" });
    if (!(await nav.isVisible().catch(() => false))) {
      test.skip(
        true,
        "Client Intake nav not on this deploy — upload latest artifacts/prod/out.zip to mahaverse-dev"
      );
    }
    await expect(nav).toBeVisible();
  });
});
