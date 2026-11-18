import { defineConfig } from 'vitest/config';

import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

export default defineConfig({
  root: dirname(fileURLToPath(import.meta.url)),
  cacheDir: '../../../node_modules/.vite/libs/public/spa-cdk-stack',

  // the workspace's @wolsok/* aliases (tsconfig.base.json)
  resolve: { tsconfigPaths: true },

  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    // The first Template.fromStack synth pays the CDK module import cost (~9s cold)
    testTimeout: 20000,
    coverage: {
      reporter: ['lcov', 'html', 'text-summary'],
      reportsDirectory: '../../../coverage/libs/public/spa-cdk-stack',
      provider: 'v8',
    },
  },
});
