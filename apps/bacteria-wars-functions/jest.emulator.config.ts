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
};
