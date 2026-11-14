import { defineConfig, devices } from '@playwright/test';
import { nxE2EPreset } from '@nx/playwright/preset';

import { workspaceRoot } from '@nx/devkit';

import { fileURLToPath } from 'node:url';
import { nxServer } from '@wolsok/shared-e2e-server';

const __filename = fileURLToPath(import.meta.url);

/** `korbjaeger:serve-e2e`, whose proxy reads the fake DBB. */
const APP_URL = 'http://localhost:4304';
/** `korbjaeger:fake-dbb`, the anonymised fixtures as the DBB. */
const FAKE_DBB_URL = 'http://localhost:4303/rest/team/id/313036/matches';
/** `korbjaeger:emulatoren`: the Auth emulator answers here once up. */
const AUTH_EMULATOR_URL = 'http://127.0.0.1:9199';

/** The sign-in through the Auth emulator's popup, on its own browser mode. */
const ACCOUNT_SPEC = /(^|[/])account\.spec\.ts$/;

const SERVER_TIMEOUT_MS = (process.env['CI'] ? 360 : 120) * 1000;
const SERVER = { cwd: workspaceRoot, timeout: SERVER_TIMEOUT_MS };

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
   * Auth and Firestore for the account) and wait for them, so every e2e
   * file on a CI agent shares them (CLAUDE.md, Testing); inside such a task
   * Playwright only waits for them (`nxServer`). The app's own port, not
   * `nx serve`'s, so a dev server on the real DBB is never reused.
   */
  webServer: [
    nxServer('korbjaeger:fake-dbb', FAKE_DBB_URL, SERVER),
    nxServer('korbjaeger:emulatoren', AUTH_EMULATOR_URL, SERVER),
    nxServer('korbjaeger:serve-e2e', APP_URL, SERVER),
  ],
  projects: [
    {
      name: 'chromium',
      testIgnore: ACCOUNT_SPEC,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'chromium-sign-in',
      testMatch: ACCOUNT_SPEC,
      /*
       * Chromium's new headless mode, not the headless shell: in the shell,
       * Auth's helper frame from the Auth emulator now and then commits but
       * never parses its page, so the sign-in popup's answer reaches no one
       * and the popup stays open (account.spec.ts failed about 1 run in 10
       * with two workers; 0 in 120 in this mode).
       */
      use: { ...devices['Desktop Chrome'], channel: 'chromium' },
    },
  ],
});
