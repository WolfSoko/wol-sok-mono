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
};
