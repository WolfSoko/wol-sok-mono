import { workspaceRoot } from '@nx/devkit';
import { nxE2EPreset } from '@nx/playwright/preset';
import { defineConfig, devices } from '@playwright/test';
import { nxServer } from '@wolsok/shared-e2e-server';

const baseURL = process.env['BASE_URL'] || 'http://localhost:4350';

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  ...nxE2EPreset(__filename, { testDir: './e2e' }),
  timeout: 120 * 1000,
  use: {
    baseURL,
    testIdAttribute: 'data-testid',
    trace: 'on-first-retry',
  },
  // an Nx task that e2e-ci depends on and waits for (see CLAUDE.md, Testing)
  webServer: nxServer('ws-thanos-test-app:serve', 'http://localhost:4350', {
    cwd: workspaceRoot,
    timeout: 120 * 1000,
  }),
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
