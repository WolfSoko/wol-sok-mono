/**
 * The specs that need the Firestore emulator (`test-emulator`, ports of
 * their own in `emulator.json`): the functions' handlers against a real
 * Firestore and the app's real rules (`apps/korbjaeger/firestore.rules`).
 * A file of its own, not a spread of `jest.config.ts`: Jest loads it as ESM,
 * which takes no extensionless import.
 */
export default {
  displayName: 'korbjaeger-functions-emulator',
  preset: '../../jest.preset.cjs',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js'],
  testMatch: ['<rootDir>/src/**/*.emulator.ts'],
  // One Firestore for all: the specs clear it between them.
  maxWorkers: 1,
  // every step is a round trip to the emulator, slower on a busy CI worker
  testTimeout: 30_000,
};
