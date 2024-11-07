export default {
  displayName: 'utils-operators',

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
  coverageDirectory: '../../../coverage/libs/utils/operators',
  coverageReporters: ['lcov'],
  preset: '../../../jest.preset.js',
};
