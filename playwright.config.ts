import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4201',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', testIgnore: '**/pages.spec.ts', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'pages-chromium',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: process.env['PAGES_BASE_URL'] ?? 'http://127.0.0.1:4202/fm-synthesis-guide/',
      },
    },
  ],
  // A dedicated server prevents stale harness/preview code from satisfying CI.
  webServer: [
    {
      command: 'npm start -- --host 127.0.0.1 --port 4201',
      url: 'http://127.0.0.1:4201',
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: 'npm run build:pages && node scripts/serve-pages.mjs',
      url: 'http://127.0.0.1:4202/fm-synthesis-guide/',
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
