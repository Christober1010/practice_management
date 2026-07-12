import { test, expect, type Page, type APIRequestContext } from "@playwright/test";

/**
 * UI end-to-end tests for the Offer Letter view on the live Mahaverse deployment.
 * Verifies:
 *  - acknowledgement checkboxes are NOT auto-selected
 *  - offer letter / job description / compliance contents render correctly
 *  - admin initiation modal shows the position templates dropdown
 */

const LAUNCHPAD_API =
  process.env.E2E_LAUNCHPAD_API_URL ||
  "https://launchpad.mahabehavioralhealth.com";

const STAFF_NO_OFFER = { username: "uitest0710", password: "UiTest@2026x" };
const STAFF_ACCEPTED = { username: "Test", password: "Temp@f4f518cc942f" };
const ADMIN = { username: "kittychristoflora@gmail.com", password: "Admin@123" };

async function seedLaunchpadAuth(
  page: Page,
  request: APIRequestContext,
  creds: { username: string; password: string }
) {
  const resp = await request.post(`${LAUNCHPAD_API}/backend/login.php`, {
    data: { username: creds.username, password: creds.password },
  });
  expect(resp.ok(), `login HTTP ${resp.status()}`).toBeTruthy();
  const data = (await resp.json()) as {
    success?: boolean;
    token?: string;
    user?: Record<string, unknown>;
    expires_at?: string;
  };
  expect(data.success, `login failed for ${creds.username}`).toBeTruthy();

  const expiresRaw = data.expires_at || "";
  const expiresIso = expiresRaw
    ? new Date(expiresRaw.replace(" ", "T")).toISOString()
    : new Date(Date.now() + 86400000).toISOString();

  await page.context().addInitScript(
    ({ token, user, expires }) => {
      localStorage.setItem("auth_token", token);
      localStorage.setItem("auth_user", JSON.stringify(user));
      localStorage.setItem("auth_expires_at", expires);
    },
    { token: data.token!, user: data.user ?? {}, expires: expiresIso }
  );
}

async function openOfferLetter(page: Page) {
  await page.goto("/launchpad/form/?view=offer-letter", {
    waitUntil: "domcontentloaded",
  });
  await expect(page.getByRole("heading", { name: "Offer Letter" })).toBeVisible({
    timeout: 30_000,
  });
}

test.describe("Offer Letter UI (live)", () => {
  test("staff without offer: checkboxes visible, UNCHECKED and disabled", async ({
    page,
    request,
  }) => {
    await seedLaunchpadAuth(page, request, STAFF_NO_OFFER);
    await openOfferLetter(page);

    await expect(
      page.getByText("Waiting for Admin/HR to initiate the offer")
    ).toBeVisible({ timeout: 20_000 });

    const jd = page.locator("#jdReadAck");
    const hipaa = page.locator("#hipaaAck");
    const abuse = page.locator("#abuseAck");

    await expect(jd).toBeVisible();
    await expect(hipaa).toBeVisible();
    await expect(abuse).toBeVisible();

    // The core assertion: none of them may start checked.
    await expect(jd).not.toBeChecked();
    await expect(hipaa).not.toBeChecked();
    await expect(abuse).not.toBeChecked();

    await expect(jd).toBeDisabled();
    await expect(hipaa).toBeDisabled();
    await expect(abuse).toBeDisabled();

    // Labels
    await expect(
      page.getByText(
        "I have read and understand the Job Responsibilities requirements completely."
      )
    ).toBeVisible();
    await expect(
      page.getByText(
        "I have read and understand the Confidentiality & HIPAA Agreement requirements completely."
      )
    ).toBeVisible();
    await expect(
      page.getByText(
        "I have read and understand the Child Abuse & Neglect Reporting requirements completely."
      )
    ).toBeVisible();
  });

  test("staff with accepted BC offer: contents correct, checkboxes hidden", async ({
    page,
    request,
  }) => {
    await seedLaunchpadAuth(page, request, STAFF_ACCEPTED);
    await openOfferLetter(page);

    // Stored (editable) offer body should render in the letter.
    await expect(
      page.getByText(
        "absolutely thrilled to offer you the position of Behavior Consultant"
      )
    ).toBeVisible({ timeout: 30_000 });

    // Accepted offers must not render the acknowledgement checkboxes.
    await expect(page.locator("#jdReadAck")).toHaveCount(0);
    await expect(page.locator("#hipaaAck")).toHaveCount(0);
    await expect(page.locator("#abuseAck")).toHaveCount(0);

    // Job Description tab: BC heading + the corrected responsibilities.
    await page.getByRole("button", { name: "Job Description" }).click();
    await expect(
      page.getByText("Behavior Consultant Requirements and Job Description")
    ).toBeVisible();
    await expect(page.getByText("Assessment Assistance:")).toBeVisible();
    await expect(page.getByText("RBT Support & Mentorship:")).toBeVisible();
    await expect(page.getByText("Supervision Compliance:")).toBeVisible();

    // Compliance Policies tab: HIPAA + Child Abuse texts.
    await page.getByRole("button", { name: "Compliance Policies" }).click();
    await expect(
      page.getByText("CONFIDENTIALITY & HIPAA AGREEMENT")
    ).toBeVisible();
    await expect(
      page.getByText("Child Abuse & Neglect Reporting Requirements Acknowledgement")
    ).toBeVisible();
  });

  test("staff with initiated offer: checkboxes start unchecked and can be toggled", async ({
    page,
    request,
  }) => {
    await seedLaunchpadAuth(page, request, STAFF_NO_OFFER);

    // Mock an initiated-but-not-accepted offer so checkboxes are enabled,
    // without mutating live data.
    await page.route("**/backend/offer_initiation_get.php*", (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          initiated: true,
          offer: {
            initiation_id: 999,
            staff_id: 9999,
            initiated_by_user_id: 2,
            employee_name: "Ui Test",
            job_title: "Behavior Consultant",
            pay_rate: "$25/hr",
            position_code: "BC",
            offer_letter_body:
              "On behalf of Maha Behavioral Health, I am absolutely thrilled to offer you the position of Behavior Consultant at {{pay_rate}}.",
            initiated_at: "2026-07-10 00:00:00",
            updated_at: "2026-07-10 00:00:00",
          },
        }),
      })
    );
    await page.route("**/backend/offer_acceptance_get.php*", (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          accepted: false,
          offer: null,
          staff_id: 9999,
        }),
      })
    );

    await openOfferLetter(page);

    const jd = page.locator("#jdReadAck");
    const hipaa = page.locator("#hipaaAck");
    const abuse = page.locator("#abuseAck");

    await expect(jd).toBeVisible({ timeout: 20_000 });
    await expect(jd).toBeEnabled();

    // Must start unchecked even with an initiated offer.
    await expect(jd).not.toBeChecked();
    await expect(hipaa).not.toBeChecked();
    await expect(abuse).not.toBeChecked();

    // Staff must be able to check each acknowledgement.
    await jd.click();
    await expect(jd).toBeChecked();
    await hipaa.click();
    await expect(hipaa).toBeChecked();
    await abuse.click();
    await expect(abuse).toBeChecked();

    // And uncheck again.
    await jd.click();
    await expect(jd).not.toBeChecked();
  });

  test("admin: initiation modal shows position dropdown and fills template", async ({
    page,
    request,
  }) => {
    await seedLaunchpadAuth(page, request, ADMIN);
    await openOfferLetter(page);

    await page.getByRole("button", { name: "Initiate Offer" }).click();
    await expect(page.getByText("Create account (if needed)")).toBeVisible();

    // Position dropdown fed from OfferLetterPositions table.
    // Wait for positions to load (trigger shows a combobox once fetched).
    const trigger = page.locator("#initPosition");
    await expect(trigger).toBeVisible();
    await expect
      .poll(
        async () => {
          await trigger.click();
          return page.getByRole("option").count();
        },
        { timeout: 20_000 }
      )
      .toBeGreaterThan(0);
    await expect(
      page.getByRole("option", { name: /Behavior Consultant/ })
    ).toBeVisible();
    await expect(
      page.getByRole("option", { name: /Registered Behavior Technician/ })
    ).toBeVisible();

    // Selecting BC must autofill job title + editable offer body.
    await page.getByRole("option", { name: /Behavior Consultant/ }).click();
    await expect(
      page.getByPlaceholder("Job title (auto-filled from position, editable)")
    ).toHaveValue("Behavior Consultant");
    await expect(page.locator("#editableOfferBody")).toContainText(
      "absolutely thrilled to offer you the position of Behavior Consultant"
    );
  });
});
