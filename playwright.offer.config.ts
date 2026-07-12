import { defineConfig, devices } from "@playwright/test";

/** Standalone config for the live offer-letter UI tests (no webserver, no auth setup). */
export default defineConfig({
  testDir: "./e2e",
  testMatch: /offer-letter-ui\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  reporter: [["list"]],
  use: {
    ...devices["Desktop Chrome"],
    baseURL:
      process.env.PLAYWRIGHT_BASE_URL ||
      "https://mahaverse.mahabehavioralhealth.com",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
});
