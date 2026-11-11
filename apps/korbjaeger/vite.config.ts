import analog from '@analogjs/platform';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { nitroTsPathAliases } from '../../tools/vite/nitro-ts-path-aliases';
import { workspaceFile } from '../../tools/vite/workspace-file';
import browserslist from 'browserslist';
import { buildKonfigurationMerken } from './deploy/build-configuration';
import { cssZiele } from './deploy/css-ziele';
import { FUNCTION_REGION } from './src/shared/function-region';
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
      // the CSS for the browsers .browserslistrc names, not for es2020: so
      // light-dark() stays native and a part of a page can set a scheme
      cssTarget: cssZiele(browserslist()),
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
          routeRules: {
            // ADR 0019: no response is indexed. Hosting sends the header on
            // its files too (firebase.korbjaeger.json); the function sets it
            // itself, whether or not Hosting's headers reach its responses.
            '/**': { headers: { 'X-Robots-Tag': 'noindex' } },
          },
          preset: 'firebase',
          firebase: {
            nodeVersion: '22',
            gen: 2,
            httpsOptions: {
              // as pacetrainer and rollapolla-analog
              region: FUNCTION_REGION.id,
              // only the DBB proxy runs here, cached by the CDN: a few
              // instances serve it and keep a burst off the DBB and the bill
              maxInstances: 10,
            },
          },
        },
      }),
      nxViteTsPaths(),
      // the deploy refuses a build of any other mode than production
      buildKonfigurationMerken(workspaceFile('dist/apps/korbjaeger')),
    ],
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['src/test-setup.ts'],
      include: ['src/**/*.spec.ts'],
      reporters: ['default'],
      // 0.4.0's ESM imports some files without `.js`, which only a bundler resolves
      server: { deps: { inline: ['@material/material-color-utilities'] } },
      coverage: {
        reportsDirectory: '../../coverage/apps/korbjaeger',
        provider: 'v8',
        reporter: ['html', 'lcov', 'text'],
      },
    },
  };
});
