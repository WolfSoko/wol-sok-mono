import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Convert import.meta.url to a file path
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  root: __dirname,
  cacheDir: '../../../node_modules/.vite/libs/shared/data-access',

  plugins: [nxViteTsPaths()],
  test: {
    globals: true,
    setupFiles: ['src/test-setup.ts'],
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      enabled: process.env.NX_TASK_TARGET_CONFIGURATION === 'ci',
      reporter: ['lcov', 'html', 'text-summary'],
      reportsDirectory: '../../../coverage/libs/shared/data-access',
      provider: 'v8',
      exclude: [
        'node_modules/',
        'src/test-setup.ts',
        '**/*.spec.ts',
        '**/*.test.ts',
      ],
    },
  },
});
