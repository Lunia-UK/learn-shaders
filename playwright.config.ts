import { defineConfig, devices } from '@playwright/test';

const port = 4321;

export default defineConfig({
  testDir: 'tests/e2e',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${port}`,
  },
  projects: [
    {
      name: 'chromium-swiftshader',
      use: {
        ...devices['Desktop Chrome'],
        // Software WebGL so rendering tests give the same pixels on every machine, GPU or not.
        launchOptions: {
          args: [
            '--use-angle=swiftshader',
            '--enable-unsafe-swiftshader',
            '--ignore-gpu-blocklist',
          ],
        },
      },
    },
  ],
  // Test the static build, the same files that get deployed.
  webServer: {
    command: `npm run build && npm run preview -- --port ${port}`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
