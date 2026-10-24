/**
 * The Firestore and Realtime Database rules of the game against the
 * emulators - run through `nx run bacteria-wars-functions:test-rules`, which
 * starts them (`firebase.rules-test.json`).
 */
module.exports = {
  displayName: 'bacteria-wars-functions-rules',
  preset: '../../jest.preset.cjs',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  testMatch: ['<rootDir>/src/**/*.rules.spec.ts'],
  testTimeout: 30_000,
  maxWorkers: 1,
};
