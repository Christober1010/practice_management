import { expect, type APIRequestContext, type Page } from "@playwright/test";

const DEFAULT_FORM_PATHS = ["/launchpad/form/", "/form/"];

const LAUNCHPAD_API =
  process.env.E2E_LAUNCHPAD_API_URL ||
  "https://launchpad.mahabehavioralhealth.com";

const MAHAVERSE_API =
  process.env.E2E_API_BASE ||
  "https://www.mahabehavioralhealth.com/mahaverse-backend-test";

export function launchpadFormPaths(): string[] {
  const custom = process.env.E2E_LAUNCHPAD_FORM_PATH?.trim();
  if (custom) return [custom.startsWith("/") ? custom : `/${custom}`];
  return DEFAULT_FORM_PATHS;
}

function requireCredentials() {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;
  if (!email || !password) {
    throw new Error("Set E2E_EMAIL and E2E_PASSWORD in e2e/.env");
  }
  return { email, password };
}

function normalizeExpiry(raw?: string): string {
  if (!raw) return new Date(Date.now() + 86400000).toISOString();
  const normalized = raw.includes("T") ? raw : raw.replace(" ", "T");
  const d = new Date(normalized);
  return Number.isNaN(d.getTime())
    ? new Date(Date.now() + 86400000).toISOString()
    : d.toISOString();
}

/** Mint Launchpad + Mahaverse tokens and seed browser localStorage (avoids flaky login UI). */
export async function seedLaunchpadSession(
  page: Page,
  request: APIRequestContext
) {
  const { email, password } = requireCredentials();

  const mahaResp = await request.post(`${MAHAVERSE_API}/login.php`, {
    data: { email, password },
  });
  expect(mahaResp.ok(), `Mahaverse login HTTP ${mahaResp.status()}`).toBeTruthy();
  const maha = (await mahaResp.json()) as {
    success?: boolean;
    token?: string;
    user?: Record<string, unknown>;
    expires_at?: string;
  };
  expect(maha.success, "Mahaverse login failed").toBeTruthy();

  const lpResp = await request.post(`${LAUNCHPAD_API}/backend/login.php`, {
    data: { email, password },
  });
  expect(lpResp.ok(), `Launchpad login HTTP ${lpResp.status()}`).toBeTruthy();
  const lp = (await lpResp.json()) as {
    success?: boolean;
    token?: string;
    user?: Record<string, unknown>;
    expires_at?: string;
  };
  expect(lp.token, "Launchpad token missing").toBeTruthy();

  const mahaExpiry = normalizeExpiry(maha.expires_at);
  const lpExpiry = normalizeExpiry(lp.expires_at);

  await page.context().addInitScript(
    ({ maha, lp, mahaExpiry, lpExpiry }) => {
      if (maha.token) {
        localStorage.setItem("aba_token", maha.token);
        localStorage.setItem("aba_user", JSON.stringify(maha.user ?? {}));
        localStorage.setItem("aba_token_expiry", mahaExpiry);
      }
      if (lp.token) {
        localStorage.setItem("auth_token", lp.token);
        localStorage.setItem("auth_user", JSON.stringify(lp.user ?? {}));
        localStorage.setItem("auth_expires_at", lpExpiry);
      }
    },
    { maha, lp, mahaExpiry, lpExpiry }
  );
}

/** Open Launchpad form with API-seeded auth (Mahaverse dev / hosted dev / local dev). */
export async function openLaunchpadForm(
  page: Page,
  request: APIRequestContext
): Promise<string> {
  await seedLaunchpadSession(page, request);

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);

  if (await waitForLaunchpadShell(page)) {
    return page.url().includes("/form") ? page.url() : "/launchpad/form/";
  }

  const launchpadLink = page.getByRole("link", { name: "Launchpad" });
  if (await launchpadLink.isVisible().catch(() => false)) {
    await launchpadLink.click();
    await page.waitForURL(/\/launchpad/, { timeout: 30_000 });
  }

  for (const formPath of launchpadFormPaths()) {
    if (!page.url().includes(formPath.replace(/\/$/, ""))) {
      await page.goto(formPath, { waitUntil: "domcontentloaded" });
    }
    if (await waitForLaunchpadShell(page)) return formPath;
  }

  throw new Error(
    "Launchpad form UI not found. Deploy the latest `out/` build — Client Intake lives at /launchpad/form/."
  );
}

async function waitForLaunchpadShell(page: Page): Promise<boolean> {
  const markers = [
    page.getByText("Welcome to Maha Launchpad"),
    page.getByRole("button", { name: "Client Intake" }),
    page.getByRole("button", { name: "Staff Profile" }),
    page.getByRole("button", { name: "Dashboard" }),
    page.getByText("Client Intake Packet"),
  ];

  for (let attempt = 0; attempt < 8; attempt++) {
    for (const locator of markers) {
      if (await locator.isVisible().catch(() => false)) return true;
    }
    await page.waitForTimeout(1000);
  }
  return false;
}
