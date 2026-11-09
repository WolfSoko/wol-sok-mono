export default {
  displayName: 'korbjaeger-functions',
  preset: '../../jest.preset.cjs',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js'],
  // the v1 Auth trigger loads firebase-admin's Auth, which needs jose: ESM only
  transformIgnorePatterns: ['node_modules/(?!jose/)'],
  coverageDirectory: '../../coverage/apps/korbjaeger-functions',
};
