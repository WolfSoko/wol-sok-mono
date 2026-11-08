import analog from '@analogjs/platform';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { fileURLToPath } from 'node:url';
import { ConfigEnv, defineConfig } from 'vite';

import { ViteUserConfig } from 'vitest/config';

/** Where `nx run korbjaeger:fake-dbb` serves the recorded DBB answers. */
const FAKE_DBB_BASE_URL = 'http://localhost:4303/rest';

/**
 * The workspace libs the proxy routes import. Nitro bundles the server
 * without the tsconfig paths `nxViteTsPaths` gives Vite, so it gets them
 * as aliases.
 */
const SERVER_LIBS = {
  '@wolsok/feat-shared-basketball-data': workspaceFile(
    'libs/features/basketball-data/src/index.ts'
  ),
  '@wolsok/utils-version': workspaceFile('libs/utils/version/src/index.ts'),
};

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
        // the workspace: the app, its libs and the Fontsource files
        allow: [workspaceFile('.')],
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
          alias: SERVER_LIBS,
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

function workspaceFile(path: string): string {
  return fileURLToPath(new URL(`../../${path}`, import.meta.url));
}
