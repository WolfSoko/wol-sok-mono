import { nxE2EPreset } from '@nx/playwright/preset';
import { defineConfig } from '@playwright/test';

/**
 * The GPU cross-check of the deterministic simulation's integer shaders
 * (ADR 0015, step 6). No server: each check loads its bundle into a blank
 * page. SwiftShader is Chromium's software GPU, so it runs on CI workers
 * without one, and the same on every machine.
 */
export default defineConfig({
  ...nxE2EPreset(__filename, { testDir: './gpu-crosscheck' }),
  testMatch: '**/*.crosscheck.ts',
  timeout: 60_000,
  projects: [
    {
      name: 'swiftshader',
      use: {
        browserName: 'chromium',
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
});
