/* eslint-disable */
export default {
  displayName: 'utils-operators',

  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/tsconfig.spec.json',
    },
  },
  transform: {
    '^.+\\.[tj]sx?$': 'ts-jest',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  coverageDirectory: '../../../coverage/libs/utils/operators',
  coverageReporters: ['lcov'],
  preset: '../../../jest.preset.js',
};
