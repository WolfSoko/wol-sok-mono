// Node, not jsdom: the lib runs in Korbjäger's Cloud Functions too.
module.exports = {
  displayName: 'feat-shared-korbjaeger-account',
  preset: '../../../jest.preset.cjs',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js'],
  coverageDirectory: '../../../coverage/libs/features/korbjaeger-account',
};
