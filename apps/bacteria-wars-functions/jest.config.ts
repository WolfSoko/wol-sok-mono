export default {
  displayName: 'bacteria-wars-functions',
  preset: '../../jest.preset.cjs',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js'],
  // firebase-admin's Auth, which `main.spec.ts` loads, needs jose: ESM only.
  transformIgnorePatterns: ['node_modules/(?!jose/)'],
  coverageDirectory: '../../coverage/apps/bacteria-wars-functions',
};
