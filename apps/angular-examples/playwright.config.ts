import { workspaceRoot } from '@nx/devkit';
import { nxE2EPreset } from '@nx/playwright/preset';
import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env['BASE_URL'] || 'http://localhost:4200';

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  ...nxE2EPreset(__filename, {
    testDir: './e2e',
  }),
  timeout: (process.env['CI'] ? 720 : 120) * 1000,
  /* Shared settings for all the projects below. See ht
  tps://playwright.dev/docs/api/class-testoptions. */
  use: {
    baseURL,
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },
  /* Run your local dev server before starting the tests */
  webServer: {
    command: process.env['CI']
      ? 'echo "=== E2E DIAG angular-examples ===" && node -v && npm -v ; ls node_modules/@nx/angular/package.json 2>&1 ; ls node_modules/@module-federation/enhanced/package.json 2>&1 ; free -h 2>&1 | head -3 ; echo "=== START SERVE ===" ; stdbuf -oL -eL npx nx run angular-examples:serve 2>&1'
      : 'npx nx run angular-examples:serve',
    url: baseURL,
    reuseExistingServer: !process.env['CI'],
    cwd: workspaceRoot,
    timeout: process.env['CI'] ? 720_000 : 180_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },

    // Uncomment for mobile browsers support
    /* {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    }, */

    // Uncomment for branded browsers
    /* {
      name: 'Microsoft Edge',
      use: { ...devices['Desktop Edge'], channel: 'msedge' },
    },
    {
      name: 'Google Chrome',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    } */
  ],
});
