module.exports = {
  displayName: 'feat-lazy-bacteria-game',
  preset: '../../../../jest.preset.cjs',
  setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
  globals: {},
  coverageDirectory: '../../../../coverage/libs/features/lazy/bacteria-game',

  transform: {
    '^.+\\.(ts|mjs|js|html)$': [
      'jest-preset-angular',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
        stringifyContentPathRegex: '\\.(html|svg)$',
      },
    ],
  },
  // Akita ships ESM from its `main` entry, so it has to go through the
  // transform like the .mjs packages do.
  transformIgnorePatterns: ['node_modules/(?!(.*\\.mjs$|@datorama/akita))'],
  snapshotSerializers: [
    'jest-preset-angular/build/serializers/no-ng-attributes',
    'jest-preset-angular/build/serializers/ng-snapshot',
    'jest-preset-angular/build/serializers/html-comment',
  ],
};
