import { workspaceRoot } from '@nx/devkit';
import { nxE2EPreset } from '@nx/playwright/preset';
import { defineConfig, devices } from '@playwright/test';

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
  webServer: {
    command: 'npx nx serve ws-thanos-test-app',
    url: 'http://localhost:4350',
    reuseExistingServer: !process.env['CI'],
    cwd: workspaceRoot,
    timeout: 120 * 1000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
