import { defineConfig, devices } from '@jscutlery/playwright-ct-angular';
import { swcAngularUnpluginOptions } from '@jscutlery/swc-angular';
import swc from 'unplugin-swc';

/**
 * Playwright Component Testing configuration for ws-thanos library.
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './src',
  testMatch: '**/*.ct.spec.ts',
  snapshotDir: './__snapshots__',
  timeout: 30000,
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  workers: process.env['CI'] ? 1 : undefined,
  reporter: 'html',
  use: {
    trace: 'on-first-retry',
    ctViteConfig: {
      plugins: [swc.vite(swcAngularUnpluginOptions())],
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
