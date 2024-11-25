// apps/pacetrainer/vite.config.mts
import analog from 'file:///E:/IdeaProjects/wol-sok-mono/node_modules/@analogjs/platform/src/index.js';
import { nxViteTsPaths } from 'file:///E:/IdeaProjects/wol-sok-mono/node_modules/@nx/vite/plugins/nx-tsconfig-paths.plugin.js';
import {
  defineConfig,
  splitVendorChunkPlugin,
} from 'file:///E:/IdeaProjects/wol-sok-mono/node_modules/vite/dist/node/index.js';
var vite_config_default = defineConfig(({ mode }) => {
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
export { vite_config_default as default };
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiYXBwcy9wYWNldHJhaW5lci92aXRlLmNvbmZpZy5tdHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJFOlxcXFxJZGVhUHJvamVjdHNcXFxcd29sLXNvay1tb25vXFxcXGFwcHNcXFxccGFjZXRyYWluZXJcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkU6XFxcXElkZWFQcm9qZWN0c1xcXFx3b2wtc29rLW1vbm9cXFxcYXBwc1xcXFxwYWNldHJhaW5lclxcXFx2aXRlLmNvbmZpZy5tdHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0U6L0lkZWFQcm9qZWN0cy93b2wtc29rLW1vbm8vYXBwcy9wYWNldHJhaW5lci92aXRlLmNvbmZpZy5tdHNcIjtpbXBvcnQgYW5hbG9nIGZyb20gJ0BhbmFsb2dqcy9wbGF0Zm9ybSc7XG5pbXBvcnQgeyBueFZpdGVUc1BhdGhzIH0gZnJvbSAnQG54L3ZpdGUvcGx1Z2lucy9ueC10c2NvbmZpZy1wYXRocy5wbHVnaW4nO1xuaW1wb3J0IHsgQ29uZmlnRW52LCBkZWZpbmVDb25maWcsIHNwbGl0VmVuZG9yQ2h1bmtQbHVnaW4gfSBmcm9tICd2aXRlJztcblxuaW1wb3J0IHsgVml0ZVVzZXJDb25maWcgfSBmcm9tICd2aXRlc3QvY29uZmlnJztcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKCh7IG1vZGUgfTogQ29uZmlnRW52KTogVml0ZVVzZXJDb25maWcgPT4ge1xuICByZXR1cm4ge1xuICAgIHJvb3Q6ICdhcHBzL3BhY2V0cmFpbmVyJyxcbiAgICBwdWJsaWNEaXI6ICdzcmMvcHVibGljJyxcbiAgICBjYWNoZURpcjogYC4uLy4uL25vZGVfbW9kdWxlcy8udml0ZWAsXG4gICAgYnVpbGQ6IHtcbiAgICAgIG91dERpcjogJy4uLy4uL2Rpc3QvYXBwcy9wYWNldHJhaW5lci9jbGllbnQnLFxuICAgICAgcmVwb3J0Q29tcHJlc3NlZFNpemU6IHRydWUsXG4gICAgICB0YXJnZXQ6IFsnZXMyMDIwJ10sXG4gICAgfSxcbiAgICByZXNvbHZlOiB7XG4gICAgICBtYWluRmllbGRzOiBbJ21vZHVsZScsICdtYWluJ10sXG4gICAgICBleHRlbnNpb25zOiBbJy5tanMnLCAnLmpzJywgJy50cycsICcuanN4JywgJy50c3gnLCAnLmpzb24nXSxcbiAgICB9LFxuICAgIHNlcnZlcjoge1xuICAgICAgZnM6IHtcbiAgICAgICAgYWxsb3c6IFsnLiddLFxuICAgICAgfSxcbiAgICB9LFxuICAgIHNzcjoge1xuICAgICAgbm9FeHRlcm5hbDogWydmaXJlYmFzZS8qKicsICdmaXJlYmFzZS1mdW5jdGlvbnMvKionLCAnZmlyZWJhc2UtYWRtaW4vKionXSxcbiAgICB9LFxuICAgIHBsdWdpbnM6IFtcbiAgICAgIGFuYWxvZyh7XG4gICAgICAgIHZpdGU6IHtcbiAgICAgICAgICBpbmxpbmVTdHlsZXNFeHRlbnNpb246ICdzY3NzJyxcbiAgICAgICAgfSxcbiAgICAgICAgbml0cm86IHtcbiAgICAgICAgICByb3V0ZVJ1bGVzOiB7XG4gICAgICAgICAgICAnLyc6IHsgcHJlcmVuZGVyOiB0cnVlIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgICBwcmVzZXQ6ICdmaXJlYmFzZScsXG4gICAgICAgICAgZmlyZWJhc2U6IHtcbiAgICAgICAgICAgIG5vZGVWZXJzaW9uOiAnMjInLFxuICAgICAgICAgICAgZ2VuOiAyLFxuICAgICAgICAgICAgaHR0cHNPcHRpb25zOiB7XG4gICAgICAgICAgICAgIHJlZ2lvbjogJ2V1cm9wZS1jZW50cmFsMicsXG4gICAgICAgICAgICAgIG1heEluc3RhbmNlczogMTAwLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSksXG4gICAgICBueFZpdGVUc1BhdGhzKCksXG4gICAgICBzcGxpdFZlbmRvckNodW5rUGx1Z2luKCksXG4gICAgXSxcbiAgICB0ZXN0OiB7XG4gICAgICBnbG9iYWxzOiB0cnVlLFxuICAgICAgZW52aXJvbm1lbnQ6ICdqc2RvbScsXG4gICAgICBzZXR1cEZpbGVzOiBbJ3NyYy90ZXN0LXNldHVwLnRzJ10sXG4gICAgICBpbmNsdWRlOiBbJ3NyYy8qKi8qLnNwZWMudHMnXSxcbiAgICAgIHJlcG9ydGVyczogWydkZWZhdWx0J10sXG4gICAgICBjb3ZlcmFnZToge1xuICAgICAgICByZXBvcnRzRGlyZWN0b3J5OiAnLi4vLi4vY292ZXJhZ2UvYXBwcy9wYWNldHJhaW5lcicsXG4gICAgICAgIHByb3ZpZGVyOiAndjgnLFxuICAgICAgICByZXBvcnRlcjogWydodG1sJywgJ2xjb3YnLCAndGV4dCddLFxuICAgICAgfSxcbiAgICB9LFxuICAgIGRlZmluZToge1xuICAgICAgJ2ltcG9ydC5tZXRhLnZpdGVzdCc6IG1vZGUgIT09ICdwcm9kdWN0aW9uJyxcbiAgICB9LFxuICB9O1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQXFVLE9BQU8sWUFBWTtBQUN4VixTQUFTLHFCQUFxQjtBQUM5QixTQUFvQixjQUFjLDhCQUE4QjtBQUloRSxJQUFPLHNCQUFRLGFBQWEsQ0FBQyxFQUFFLEtBQUssTUFBaUM7QUFDbkUsU0FBTztBQUFBLElBQ0wsTUFBTTtBQUFBLElBQ04sV0FBVztBQUFBLElBQ1gsVUFBVTtBQUFBLElBQ1YsT0FBTztBQUFBLE1BQ0wsUUFBUTtBQUFBLE1BQ1Isc0JBQXNCO0FBQUEsTUFDdEIsUUFBUSxDQUFDLFFBQVE7QUFBQSxJQUNuQjtBQUFBLElBQ0EsU0FBUztBQUFBLE1BQ1AsWUFBWSxDQUFDLFVBQVUsTUFBTTtBQUFBLE1BQzdCLFlBQVksQ0FBQyxRQUFRLE9BQU8sT0FBTyxRQUFRLFFBQVEsT0FBTztBQUFBLElBQzVEO0FBQUEsSUFDQSxRQUFRO0FBQUEsTUFDTixJQUFJO0FBQUEsUUFDRixPQUFPLENBQUMsR0FBRztBQUFBLE1BQ2I7QUFBQSxJQUNGO0FBQUEsSUFDQSxLQUFLO0FBQUEsTUFDSCxZQUFZLENBQUMsZUFBZSx5QkFBeUIsbUJBQW1CO0FBQUEsSUFDMUU7QUFBQSxJQUNBLFNBQVM7QUFBQSxNQUNQLE9BQU87QUFBQSxRQUNMLE1BQU07QUFBQSxVQUNKLHVCQUF1QjtBQUFBLFFBQ3pCO0FBQUEsUUFDQSxPQUFPO0FBQUEsVUFDTCxZQUFZO0FBQUEsWUFDVixLQUFLLEVBQUUsV0FBVyxLQUFLO0FBQUEsVUFDekI7QUFBQSxVQUNBLFFBQVE7QUFBQSxVQUNSLFVBQVU7QUFBQSxZQUNSLGFBQWE7QUFBQSxZQUNiLEtBQUs7QUFBQSxZQUNMLGNBQWM7QUFBQSxjQUNaLFFBQVE7QUFBQSxjQUNSLGNBQWM7QUFBQSxZQUNoQjtBQUFBLFVBQ0Y7QUFBQSxRQUNGO0FBQUEsTUFDRixDQUFDO0FBQUEsTUFDRCxjQUFjO0FBQUEsTUFDZCx1QkFBdUI7QUFBQSxJQUN6QjtBQUFBLElBQ0EsTUFBTTtBQUFBLE1BQ0osU0FBUztBQUFBLE1BQ1QsYUFBYTtBQUFBLE1BQ2IsWUFBWSxDQUFDLG1CQUFtQjtBQUFBLE1BQ2hDLFNBQVMsQ0FBQyxrQkFBa0I7QUFBQSxNQUM1QixXQUFXLENBQUMsU0FBUztBQUFBLE1BQ3JCLFVBQVU7QUFBQSxRQUNSLGtCQUFrQjtBQUFBLFFBQ2xCLFVBQVU7QUFBQSxRQUNWLFVBQVUsQ0FBQyxRQUFRLFFBQVEsTUFBTTtBQUFBLE1BQ25DO0FBQUEsSUFDRjtBQUFBLElBQ0EsUUFBUTtBQUFBLE1BQ04sc0JBQXNCLFNBQVM7QUFBQSxJQUNqQztBQUFBLEVBQ0Y7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
