import { workspaceRoot } from '@nx/devkit';
import { nxE2EPreset } from '@nx/playwright/preset';
import { defineConfig, devices } from '@playwright/test';

// For CI, you may want to set BASE_URL to the deployed application.
// serve-e2e has a port of its own, so a running dev or production server is
// never mistaken for it.
const baseURL = process.env['BASE_URL'] || 'http://localhost:4222';

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  ...nxE2EPreset(__filename, { testDir: './e2e' }),
  timeout: 120_000,
  // The first check after a load waits for the game to boot. Firefox on a
  // busy CI agent can take longer than the default 5 s for it.
  expect: { timeout: process.env['CI'] ? 15_000 : 5_000 },
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    baseURL,
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },
  /*
   * Both servers are Nx tasks, and reused: the inferred e2e and e2e-ci tasks
   * depend on them and wait for both, so every spec file on a CI agent shares
   * them. The game is the production build pointed at the emulators
   * (environment.e2e.ts), so no test touches the real Firebase project.
   */
  webServer: [
    {
      command: 'npx nx run bacteria-game-remote:serve-e2e',
      url: 'http://localhost:4222',
      reuseExistingServer: true,
      cwd: workspaceRoot,
      timeout: process.env['CI'] ? 360_000 : 120_000,
    },
    {
      // Auth and Firestore; Firestore is up last (it needs a JVM).
      command: 'npx nx run bacteria-game-remote:firebase-emulators',
      url: 'http://127.0.0.1:8380',
      reuseExistingServer: true,
      cwd: workspaceRoot,
      timeout: 180_000,
    },
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
