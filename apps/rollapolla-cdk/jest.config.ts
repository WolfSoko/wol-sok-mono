/* eslint-disable */
export default {
  displayName: 'rollapolla-cdk',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  modulePathIgnorePatterns: ['<rootDir>/e2e/'],
  coverageDirectory: '../../coverage/apps/rollapolla-cdk',
};
