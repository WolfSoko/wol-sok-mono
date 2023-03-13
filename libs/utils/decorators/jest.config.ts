/* eslint-disable */
export default {
  displayName: 'libs/utils-decorators',

  globals: {},
  transform: {
    '^.+\\.[tj]sx?$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
      },
    ],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  coverageDirectory: '../../../coverage/libs/utils/decorators',
  coverageReporters: ['lcov'],
  preset: '../../../jest.preset.js',
};
