// Node, not jsdom and no Angular preset: the lib runs in the app's server
// routes too, so its specs prove it needs neither a DOM nor Angular.
module.exports = {
  displayName: 'feat-shared-basketball-data',
  preset: '../../../jest.preset.cjs',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  coverageDirectory: '../../../coverage/libs/features/basketball-data',
};
