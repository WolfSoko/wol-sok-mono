import { defineConfig } from 'vitest/config';

/**
 * The specs against the Firestore emulator (`test-emulator`, ports of their
 * own in `emulator/firebase.test.json`): the rules and the Firestore
 * adapter of the `Auswahl`. Node, no Angular TestBed: the adapter only
 * needs signals.
 */
export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/apps/korbjaeger-emulator',
  // the workspace's @wolsok/* aliases (tsconfig.base.json)
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.emulator.ts'],
    reporters: ['default'],
    // one emulator, cleared between tests: no files side by side
    fileParallelism: false,
    // every step is a round trip to the emulator, slower on a busy CI worker
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
