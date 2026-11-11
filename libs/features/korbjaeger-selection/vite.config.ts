import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  cacheDir: '../../../node_modules/.vite/libs/features/korbjaeger-selection',
  // the workspace's @wolsok/* aliases (tsconfig.base.json)
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/test-setup.ts'],
    include: ['src/**/*.spec.ts'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../../coverage/libs/features/korbjaeger-selection',
      provider: 'v8',
      reporter: ['html', 'lcov', 'text'],
    },
  },
});
