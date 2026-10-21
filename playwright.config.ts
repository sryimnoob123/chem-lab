import { defineConfig, devices } from "@playwright/test";

/**
 * 默认自己起 dev server（3000）。
 * 想在已跑起来的服务上跑（如生产态 3001），设置 E2E_BASE_URL，例如：
 *   E2E_BASE_URL=http://localhost:3001 npx playwright test
 * 此时不再拉起 webServer。
 */
const externalBase = process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { outputFolder: "e2e-review/playwright-report", open: "never" }]],
  outputDir: "e2e-review/test-results",
  use: {
    baseURL: externalBase ?? "http://127.0.0.1:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: externalBase
    ? undefined
    : {
        // 裸跑 e2e 时自动建好独立库并播种，避免首页"读取失败"导致 smoke 失败
        command: "node db/init.mjs && node db/seed-demo.mjs && npm run dev",
        url: "http://127.0.0.1:3000",
        reuseExistingServer: true,
        timeout: 300_000,
        env: { PGLITE_DIR: ".pgdata-e2e" },
      },
});
