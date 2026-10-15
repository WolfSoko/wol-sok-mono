import analog from '@analogjs/platform';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { ConfigEnv, defineConfig, Plugin } from 'vite';

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
      // Scan every app source, not just the entry: routes and @defer blocks are
      // lazy, so their dependencies were found only on first use. Vite then
      // re-bundled them and the page ended up with two copies of Angular (NG0203).
      entries: ['src/**/*.ts', '!src/**/*.spec.ts'],
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
      ...(mode === 'development' ? [useDevelopEnvironment()] : []),
    ],
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['src/test-setup.ts'],
      include: ['src/**/*.spec.ts'],
      server: {
        deps: {
          // @angular/fire ships extensionless ESM imports Node can't load directly
          inline: ['@angular/fire'],
        },
      },
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

/**
 * Swaps the app's `environments/environment` for `environment.develop`, so
 * `nx serve` and the e2e tests talk to the Firestore emulator, not production.
 */
function useDevelopEnvironment(): Plugin {
  const appSources = '/apps/rollapolla-analog/src/';
  return {
    name: 'rollapolla-develop-environment',
    enforce: 'pre',
    resolveId(source, importer, options) {
      if (
        !importer?.includes(appSources) ||
        !source.endsWith('/environments/environment')
      ) {
        return null;
      }
      return this.resolve(`${source}.develop`, importer, {
        ...options,
        skipSelf: true,
      });
    },
  };
}
