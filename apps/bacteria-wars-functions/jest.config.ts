/**
 * Unit specs: no emulator. The specs against the emulators have their own
 * configs and targets (`test-rules`, `test-integration`).
 */
module.exports = {
  displayName: 'bacteria-wars-functions',
  preset: '../../jest.preset.cjs',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  // firebase-admin's Auth needs jose, which ships as ESM only.
  transformIgnorePatterns: ['node_modules/(?!jose/)'],
  testPathIgnorePatterns: ['\\.rules\\.spec\\.ts$', '\\.emulator\\.spec\\.ts$'],
  // The engine plays slowly under Jest.
  testTimeout: 60_000,
  coverageDirectory: '../../coverage/apps/bacteria-wars-functions',
};
