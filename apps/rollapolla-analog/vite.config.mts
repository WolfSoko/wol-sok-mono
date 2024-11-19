import analog from '@analogjs/platform';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { ConfigEnv, defineConfig, splitVendorChunkPlugin } from 'vite';

import { ViteUserConfig } from 'vitest/config';

export default defineConfig(({ mode }: ConfigEnv): ViteUserConfig => {
  return {
    root: 'apps/rollapolla-analog',
    publicDir: 'src/public',
    cacheDir: `../../node_modules/.vite`,
    build: {
      outDir: '../../dist/apps/rollapolla-analog/client',
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
    ssr: {
      noExternal: ['firebase/**', 'firebase-functions/**', 'firebase-admin/**'],
    },
    plugins: [
      analog({
        vite: {
          inlineStylesExtension: 'scss',
        },
        nitro: {
          routeRules: {
            '/': { prerender: true },
          },
          preset: 'firebase',
          firebase: {
            nodeVersion: '22',
            gen: 2,
            httpsOptions: {
              region: 'europe-central2',
              maxInstances: 100,
            },
          },
        },
      }),
      nxViteTsPaths(),
      splitVendorChunkPlugin(),
    ],
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['src/test-setup.ts'],
      include: ['src/**/*.spec.ts'],
      reporters: ['default'],
      coverage: {
        reportsDirectory: '../../coverage/apps/rollapolla-analog',
        provider: 'v8',
        reporter: ['html', 'lcov', 'text'],
      },
    },
    define: {
      'import.meta.vitest': mode !== 'production',
    },
  };
});
