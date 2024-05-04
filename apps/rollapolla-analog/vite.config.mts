/// <reference types="vitest" />

import analog from '@analogjs/platform';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import {
  ConfigEnv,
  defineConfig,
  splitVendorChunkPlugin,
  UserConfig,
} from 'vite';

// https://vitejs.dev/config/
export default defineConfig(({ mode }: ConfigEnv): UserConfig => {
  return {
    root: __dirname,
    publicDir: 'src/public',
    cacheDir: `../../node_modules/.vite`,
    ssr: {
      noExternal: ['@analogjs/trpc', '@trpc/server'],
    },

    build: {
      outDir: '../../dist/apps/rollapolla-analog/client',
      reportCompressedSize: true,
      target: ['es2020'],
    },
    server: {
      fs: {
        allow: ['.'],
      },
    },
    plugins: [
      analog({
        vite: {
          inlineStylesExtension: 'scss',
        },
        nitro: {
          buildDir: '../../dist/apps/rollapolla-analog/.nitro',
          routeRules: {
            '/': {
              prerender: true,
            },
          },
        },
      }),
      nxViteTsPaths(),
      splitVendorChunkPlugin(),
    ],
    test: {
      globals: true,
      cache: { dir: '../../node_modules/.vitest' },
      environment: 'jsdom',
      setupFiles: ['src/test-setup.ts'],
      include: ['src/**/*.spec.ts'],
      reporters: ['default'],
      coverage: {
        reportsDirectory: '../../coverage/apps/rollapolla-analog',
        provider: 'v8',
      },
    },
    define: {
      'import.meta.vitest': mode !== 'production',
    },
  };
});
