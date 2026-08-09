import { defineConfig, devices } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const credentialsFile = path.join(process.cwd(), "test-results", "kafarm", "e2e-credentials.json");
if (fs.existsSync(credentialsFile)) {
  const credentials = JSON.parse(fs.readFileSync(credentialsFile, "utf8"));
  process.env.E2E_CUSTOMER_EMAIL ||= credentials.customer?.email;
  process.env.E2E_CUSTOMER_PASSWORD ||= credentials.customer?.password;
  process.env.E2E_CARETAKER_EMAIL ||= credentials.caretaker?.email;
  process.env.E2E_CARETAKER_PASSWORD ||= credentials.caretaker?.password;
}

const port = Number(process.env.E2E_PORT || 3100);
const baseURL = process.env.E2E_BASE_URL || `http://127.0.0.1:${port}`;
const reportSuffix = process.env.E2E_REPORT_SUFFIX || "results";

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "test-results/playwright/artifacts",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [
    ["line"],
    ["json", { outputFile: `test-results/playwright/${reportSuffix}.json` }],
    ["html", { outputFolder: "playwright-report", open: "never" }],
  ],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    navigationTimeout: 30_000,
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "phone-chromium", use: { ...devices["Pixel 7"] } },
    { name: "tablet-chromium", use: { ...devices["iPad (gen 7)"], browserName: "chromium" } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `npm run start -- --hostname 127.0.0.1 --port ${port}`,
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
