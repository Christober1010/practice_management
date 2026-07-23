import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";
import path from "path";
import { E2E_TARGETS, targetsToRun, type E2eTarget } from "./e2e/targets";

/** Shared credentials (e2e/.env); per-target API URL from .env.test / .env.prod */
dotenv.config({ path: path.join(__dirname, "e2e", ".env") });

const runTargets = targetsToRun(process.env.E2E_TARGET);
const singleTarget =
  runTargets.length === 1 ? runTargets[0] : undefined;

function loadTargetDotenv(target: E2eTarget) {
  dotenv.config({
    path: path.join(__dirname, E2E_TARGETS[target].envFile),
    override: true,
  });
}

function projectEnv(target: E2eTarget): Record<string, string> {
  const t = E2E_TARGETS[target];
  return {
    E2E_TARGET: target,
    E2E_API_BASE: t.apiBase,
    NEXT_PUBLIC_BASE_URL: t.apiBase,
    E2E_AUTH_STORAGE: t.authStorage,
    PLAYWRIGHT_BASE_URL:
      process.env.PLAYWRIGHT_BASE_URL || `http://localhost:${t.port}`,
  };
}

function buildTargetProjects(target: E2eTarget) {
  const t = E2E_TARGETS[target];
  const baseURL =
    process.env.PLAYWRIGHT_BASE_URL || `http://localhost:${t.port}`;

  return [
    {
      name: `setup-${target}`,
      testMatch: /auth\.setup\.ts/,
      env: projectEnv(target),
      use: { baseURL },
    },
    {
      name: `${target}-chromium`,
      use: {
        ...devices["Desktop Chrome"],
        storageState: t.authStorage,
        baseURL,
      },
      dependencies: [`setup-${target}`],
      testIgnore: [/auth\.setup\.ts/, /api-endpoints\.spec\.ts/],
      env: projectEnv(target),
    },
    {
      name: `api-${target}`,
      testMatch: /(?:00-schema-readiness|api-endpoints|assignment-location-role)\.spec\.ts/,
      timeout: 120_000,
      env: projectEnv(target),
    },
  ];
}

const projects = runTargets.flatMap(buildTargetProjects);

const LAUNCHPAD_DEV_BASE =
  process.env.PLAYWRIGHT_BASE_URL || "https://mahaverse-dev.mahabehavioralhealth.com";

projects.push({
  name: "launchpad-dev",
  testMatch: /client-intake\.spec\.ts/,
  use: {
    ...devices["Desktop Chrome"],
    storageState: { cookies: [], origins: [] },
    baseURL: LAUNCHPAD_DEV_BASE,
  },
  timeout: 120_000,
  env: projectEnv("test"),
  webServer: process.env.PLAYWRIGHT_SKIP_WEBSERVER
    ? undefined
    : {
        command: `dotenv -e .env.test -- next dev -p ${process.env.E2E_LAUNCHPAD_DEV_PORT || "3010"}`,
        url: `http://localhost:${process.env.E2E_LAUNCHPAD_DEV_PORT || "3010"}`,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
});

projects.push({
  name: "launchpad-prod",
  testMatch: /client-intake\.spec\.ts/,
  use: {
    ...devices["Desktop Chrome"],
    storageState: { cookies: [], origins: [] },
    baseURL:
      process.env.PLAYWRIGHT_BASE_URL ||
      "https://mahaverse.mahabehavioralhealth.com",
  },
  timeout: 120_000,
});

projects.push({
  name: "launchpad-local",
  testMatch: /client-intake\.spec\.ts/,
  use: {
    ...devices["Desktop Chrome"],
    storageState: { cookies: [], origins: [] },
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:4173",
  },
  timeout: 120_000,
  webServer: process.env.PLAYWRIGHT_SKIP_WEBSERVER
    ? undefined
    : {
        command: "npx serve out -s -l 4173",
        url: "http://127.0.0.1:4173",
        reuseExistingServer: true,
        timeout: 60_000,
      },
});

const active = singleTarget ? E2E_TARGETS[singleTarget] : null;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ["list"],
    [
      "html",
      {
        outputFolder: singleTarget
          ? `playwright-report-${singleTarget}`
          : "playwright-report",
        open: "never",
      },
    ],
  ],
  use: {
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  timeout: 90_000,
  expect: { timeout: 15_000 },
  projects,
  webServer:
    process.env.PLAYWRIGHT_SKIP_WEBSERVER || !active
      ? undefined
      : {
          command: active.devCommand,
          url:
            process.env.PLAYWRIGHT_BASE_URL ||
            `http://localhost:${active.port}`,
          reuseExistingServer: !process.env.CI,
          timeout: 180_000,
        },
});

// Preload test env when config loads (default for editors / single-target runs)
if (singleTarget) {
  loadTargetDotenv(singleTarget);
}
