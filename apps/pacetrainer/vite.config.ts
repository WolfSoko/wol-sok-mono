import analog from '@analogjs/platform';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { ConfigEnv, defineConfig } from 'vite';

import { ViteUserConfig } from 'vitest/config';

export default defineConfig(({ mode }: ConfigEnv): ViteUserConfig => {
  return {
    root: 'apps/pacetrainer',
    publicDir: 'src/public',
    cacheDir: `../../node_modules/.vite`,
    build: {
      outDir: '../../dist/apps/pacetrainer/client',
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
    optimizeDeps: {
      // Analog's auto-discover-deps plugin crawls every package with an fesm
      // module, which reaches @angular/fire. That package lists its `ng add`
      // schematics as runtime dependencies, so the devkit gets dragged into the
      // browser dependency optimization, where esbuild fails on it.
      exclude: [
        '@angular-devkit/core',
        '@angular-devkit/schematics',
        '@schematics/angular',
      ],
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
            // nodejs24 is GA on Cloud Run functions (decommission 2028-10-31,
            // a year beyond nodejs22) and matches the toolchain in .nvmrc.
            // nitropack 2.13.4 still types this union as 22 | 20 | 18 | 16, so
            // an editor may flag it; the value only ends up in engines.node of
            // the generated functions package.json, which builds correctly.
            nodeVersion: '24',
            gen: 2,
            httpsOptions: {
              region: 'europe-central2',
              maxInstances: 100,
            },
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
        reportsDirectory: '../../coverage/apps/pacetrainer',
        provider: 'v8',
        reporter: ['html', 'lcov', 'text'],
      },
    },
    define: {
      'import.meta.vitest': mode !== 'production',
    },
  };
});
