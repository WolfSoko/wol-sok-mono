/**
 * The Firestore rules against the emulator (`test-emulator`), with ports of
 * their own (`rules-test/firebase.json`), apart from the e2e emulators that
 * may run on the same CI worker.
 */
export default {
  displayName: 'bacteria-game-remote-rules',
  preset: '../../../jest.preset.cjs',
  testEnvironment: 'node',
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
  moduleFileExtensions: ['ts', 'js'],
  testMatch: ['<rootDir>/**/*.emulator.ts'],
  maxWorkers: 1,
  // Every step is a round trip to the emulator: a busy CI worker takes
  // longer than Jest's 5 s default, as a timed-out hook once showed.
  testTimeout: 30_000,
};
