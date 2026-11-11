import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  cacheDir: '../../../node_modules/.vite/libs/features/korbjaeger-answers',
  // the workspace's @wolsok/* aliases (tsconfig.base.json)
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.spec.ts'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../../coverage/libs/features/korbjaeger-answers',
      provider: 'v8',
      reporter: ['html', 'lcov', 'text'],
    },
  },
});
