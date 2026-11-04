import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for Shoppy E2E tests.
 * @see https://playwright.dev/docs/test-configuration
 *
 * NOTE: E2E tests are temporarily disabled via package.json script.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Use single worker in CI to prevent flaky tests from race conditions in shared test database state
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",
  timeout: 30000,
  expect: {
    timeout: 10000,
  },

  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "on-first-retry",
    actionTimeout: 10000,
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    env: {
      // Enable mock mode for E2E tests when Supabase is not configured.
      // This requires explicit opt-in AND non-production environment.
      // These env vars are passed to the Next.js dev server.
      E2E_MOCK_AUTH: process.env.NEXT_PUBLIC_SUPABASE_URL ? "false" : "true",
      ENABLE_E2E_MOCK_MODE: process.env.NEXT_PUBLIC_SUPABASE_URL
        ? "false"
        : "true",
      NEXT_PUBLIC_ENABLE_E2E_MOCK_MODE: process.env.NEXT_PUBLIC_SUPABASE_URL
        ? "false"
        : "true",
    },
  },
});
