import analog from '@analogjs/platform';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { fileURLToPath } from 'node:url';
import { nitroTsPathAliases } from '../../tools/vite/nitro-ts-path-aliases';
import { ConfigEnv, defineConfig } from 'vite';

import { ViteUserConfig } from 'vitest/config';

/** Where `nx run korbjaeger:fake-dbb` serves the recorded DBB answers. */
const FAKE_DBB_BASE_URL = 'http://localhost:4303/rest';

export default defineConfig(({ mode }: ConfigEnv): ViteUserConfig => {
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
          // Nitro bundles the proxy routes without the tsconfig paths
          alias: nitroTsPathAliases(),
          runtimeConfig: {
            // the DBB the proxy reads (DbbProxyConfig): the real one unless
            // set, the fake DBB in the e2e build, NITRO_DBB_BASE_URL at run time
            dbbBaseUrl: mode === 'e2e' ? FAKE_DBB_BASE_URL : '',
          },
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
  };
});

function workspaceFile(path: string): string {
  return fileURLToPath(new URL(`../../${path}`, import.meta.url));
}
