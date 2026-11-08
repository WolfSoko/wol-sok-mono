import analog from '@analogjs/platform';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { ConfigEnv, defineConfig } from 'vite';

import { ViteUserConfig } from 'vitest/config';

/** Where `nx run korbjaeger:fake-dbb` serves the recorded DBB answers. */
const FAKE_DBB_BASE_URL = 'http://localhost:4303/rest';

export default defineConfig(({ mode }: ConfigEnv): ViteUserConfig => {
  if (mode === 'e2e') {
    // the proxy routes (src/server/dbb) read the DBB from the fake server
    process.env['DBB_BASE_URL'] ??= FAKE_DBB_BASE_URL;
  }
  return {
    root: 'apps/korbjaeger',
    publicDir: 'src/public',
    cacheDir: `../../node_modules/.vite/apps/korbjaeger`,
    build: {
      outDir: '../../dist/apps/korbjaeger/client',
      reportCompressedSize: true,
      target: ['es2020'],
    },
    resolve: {
      mainFields: ['module', 'main'],
      extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json'],
    },
    server: {
      fs: {
        allow: ['.'],
      },
    },
    optimizeDeps: {
      // Scan every app source, not just the entry: routes are lazy, so their
      // dependencies were found only on first use (see rollapolla-analog).
      entries: ['src/**/*.ts', '!src/**/*.spec.ts', '!src/server/**'],
    },
    plugins: [
      analog({
        // Pages render in the browser only: the app is noindex (ADR 0019),
        // so Nitro serves just the shell and the DBB proxy (ADR 0018).
        ssr: false,
        vite: {
          inlineStylesExtension: 'scss',
        },
        nitro: {
          preset: 'firebase',
          // region and instances come with the Firebase project (#2875)
          firebase: {
            nodeVersion: '22',
            gen: 2,
          },
        },
      }),
      nxViteTsPaths(),
    ],
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['src/test-setup.ts'],
      include: ['src/**/*.spec.ts'],
      reporters: ['default'],
      coverage: {
        reportsDirectory: '../../coverage/apps/korbjaeger',
        provider: 'v8',
        reporter: ['html', 'lcov', 'text'],
      },
    },
    define: {
      'import.meta.vitest': mode !== 'production',
    },
  };
});
