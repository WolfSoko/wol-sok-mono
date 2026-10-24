/**
 * The functions' cores against the Firestore emulator - transactions,
 * `create()` markers, queries - run through
 * `nx run bacteria-wars-functions:test-integration`, which starts it
 * (`firebase.integration-test.json`).
 */
module.exports = {
  displayName: 'bacteria-wars-functions-integration',
  preset: '../../jest.preset.cjs',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  // firebase-admin's Auth needs jose, which ships as ESM only.
  transformIgnorePatterns: ['node_modules/(?!jose/)'],
  testMatch: ['<rootDir>/src/**/*.emulator.spec.ts'],
  testTimeout: 60_000,
  maxWorkers: 1,
};
