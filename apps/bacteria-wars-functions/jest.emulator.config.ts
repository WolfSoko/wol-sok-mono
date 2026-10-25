/**
 * The specs that need the Firestore emulator (`test-emulator`): the
 * functions' handlers against a real Firestore, transactions and all.
 */
export default {
  displayName: 'bacteria-wars-functions-emulator',
  preset: '../../jest.preset.cjs',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js'],
  testMatch: ['<rootDir>/src/**/*.emulator.ts'],
  // One Firestore for all: the specs clear it between them.
  maxWorkers: 1,
  // Every step is a round trip to the emulator, and transactions that
  // contend back off and retry: a spec of two slices at once takes 3 s on
  // a laptop, and more on a busy CI worker than Jest's 5 s default.
  testTimeout: 30_000,
};
