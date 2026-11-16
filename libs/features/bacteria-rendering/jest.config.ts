module.exports = {
  displayName: 'feat-bacteria-rendering',
  preset: '../../../jest.preset.cjs',
  setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
  coverageDirectory: '../../../coverage/libs/features/bacteria-rendering',

  transform: {
    '^.+\\.(ts|mjs|js)$': [
      'jest-preset-angular',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
      },
    ],
  },
  transformIgnorePatterns: ['node_modules/(?!.*\\.mjs$)'],
};
