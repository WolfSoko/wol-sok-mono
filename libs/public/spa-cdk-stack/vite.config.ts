import { defineConfig } from 'vite';

import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';

import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

export default defineConfig({
  root: dirname(fileURLToPath(import.meta.url)),
  cacheDir: '../../../node_modules/.vite/libs/public/spa-cdk-stack',

  plugins: [nxViteTsPaths()],

  // Uncomment this if you are using workers.
  // worker: {
  //  plugins: [ nxViteTsPaths() ],
  // },

  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reporter: ['lcov', 'html', 'text-summary'],
      reportsDirectory: '../../../coverage/libs/public/spa-cdk-stack',
      provider: 'v8',
    },
  },
});
