import { defineConfig, devices } from '@playwright/test';
import { nxE2EPreset } from '@nx/playwright/preset';

import { workspaceRoot } from '@nx/devkit';

import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);

/** `korbjaeger:serve-e2e`, whose proxy reads the fake DBB. */
const APP_URL = 'http://localhost:4304';
/** `korbjaeger:fake-dbb`, the anonymised fixtures as the DBB. */
const FAKE_DBB_URL = 'http://localhost:4303/rest/team/id/313036/matches';
/** `korbjaeger:emulatoren`: the Auth emulator answers here once up. */
const AUTH_EMULATOR_URL = 'http://127.0.0.1:9199';

const SERVER_TIMEOUT_MS = (process.env['CI'] ? 360 : 120) * 1000;

export default defineConfig({
  ...nxE2EPreset(__filename, { testDir: './e2e' }),
  reporter: [
    [
      'html',
      {
        open: 'never',
        outputFolder: '../../reports/playwright/apps/korbjaeger',
      },
    ],
  ],
  timeout: 120 * 1000,
  use: {
    baseURL: process.env['BASE_URL'] || APP_URL,
    testIdAttribute: 'data-qa',
    trace: 'on-first-retry',
  },
  /*
   * The servers are Nx tasks, and reused: the inferred e2e and e2e-ci tasks
   * then depend on `serve-e2e`, `fake-dbb` and `emulatoren` (continuous,
   * Auth and Firestore for the account) and wait for them,
   * so every e2e file on a CI agent shares them (CLAUDE.md, Testing). The
   * app's own port, not `nx serve`'s, so a dev server on the real DBB is
   * never reused.
   */
  webServer: [
    {
      command: 'npx nx run korbjaeger:fake-dbb',
      url: FAKE_DBB_URL,
      reuseExistingServer: true,
      cwd: workspaceRoot,
      timeout: SERVER_TIMEOUT_MS,
    },
    {
      command: 'npx nx run korbjaeger:emulatoren',
      url: AUTH_EMULATOR_URL,
      reuseExistingServer: true,
      cwd: workspaceRoot,
      timeout: SERVER_TIMEOUT_MS,
    },
    {
      command: 'npx nx run korbjaeger:serve-e2e',
      url: APP_URL,
      reuseExistingServer: true,
      cwd: workspaceRoot,
      timeout: SERVER_TIMEOUT_MS,
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
