module.exports = {
  displayName: 'portfolio-cdk',
  preset: '../../jest.preset.cjs',
  testEnvironment: 'node',
  // In parallel workers, the worker that synthesizes a stack with
  // Source.data fails to exit gracefully; one worker exits cleanly.
  maxWorkers: 1,
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/apps/portfolio-cdk',
};
