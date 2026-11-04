// Node, not jsdom and no Angular preset: the engine runs in Cloud Functions
// too, so its specs prove it needs neither a DOM nor Angular.
module.exports = {
  displayName: 'feat-shared-bacteria-engine',
  preset: '../../../jest.preset.cjs',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  coverageDirectory: '../../../coverage/libs/features/bacteria-engine',
};
