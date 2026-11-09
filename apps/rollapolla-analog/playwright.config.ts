import { defineConfig, devices } from '@playwright/test';
import { nxE2EPreset } from '@nx/playwright/preset';
import { nxServer } from '@wolsok/shared-e2e-server';

import { workspaceRoot } from '@nx/devkit';

import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);

// For CI, you may want to set BASE_URL to the deployed application.
const baseURL = process.env['BASE_URL'] || 'http://localhost:4300';

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  ...nxE2EPreset(__filename, { testDir: './e2e' }),
  reporter: [
    [
      'html',
      {
        open: 'never',
        outputFolder: '../../reports/playwright/apps/rollapolla-analog',
      },
    ],
  ],
  timeout: (process.env['CI'] ? 720 : 120) * 1000,
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    baseURL,
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },
  /*
   * Both servers are Nx tasks, and reused: the inferred e2e and e2e-ci tasks
   * then depend on `serve` and `auth-emulator` (continuous) and wait for both,
   * so every e2e file on a CI agent shares one dev server and one Auth
   * emulator; inside such a task Playwright only waits for them
   * (`nxServer`). A plain `playwright test` starts them itself.
   */
  webServer: [
    nxServer('rollapolla-analog:serve', 'http://localhost:4300', {
      cwd: workspaceRoot,
      timeout: (process.env['CI'] ? 720 : 120) * 1000,
    }),
    // Voting and creating polls sign in anonymously. The Auth emulator runs on
    // Node alone; Firestore stays offline in e2e and applies writes locally.
    nxServer('rollapolla-analog:auth-emulator', 'http://127.0.0.1:9099', {
      cwd: workspaceRoot,
      timeout: 120 * 1000,
    }),
  ],

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

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
