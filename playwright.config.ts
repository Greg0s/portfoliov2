import { defineConfig, devices } from '@playwright/test';

const port = 4321;
const base = process.env.BASE_PATH ?? '/portfoliov2/';

export default defineConfig({
  testDir: 'tests/e2e',
  // Every test opens its own page: they spread over the workers, and CI's shards, one by one rather than file by file.
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    // Relative paths in tests (`en/`) resolve under the base path.
    baseURL: `http://localhost:${String(port)}${base}`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
    // Safari, which many recruiters use: a smoke test of the journey (implementation plan §2.11).
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'], viewport: { width: 1440, height: 900 } },
      testMatch: /smoke/,
    },
  ],
  // The suite runs on the built site, as visitors get it.
  webServer: {
    command: `pnpm preview --port ${String(port)} --ignore-lock`,
    url: `http://localhost:${String(port)}${base}`,
    reuseExistingServer: !process.env.CI,
  },
});
