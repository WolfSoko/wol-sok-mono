module.exports = {
  displayName: 'feat-lazy-bacteria-wars-admin',
  preset: '../../../../jest.preset.cjs',
  setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
  // The game's project setup loads the Firebase SDK, which Jest cannot run;
  // the specs fake `GameCloud` instead.
  moduleNameMapper: {
    '/storage/provide-game-cloud$':
      '<rootDir>/src/testing/provide-game-cloud.stub.ts',
  },
  coverageDirectory:
    '../../../../coverage/libs/features/lazy/bacteria-wars-admin',
  transform: {
    '^.+\\.(ts|mjs|js|html)$': [
      'jest-preset-angular',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
        stringifyContentPathRegex: '\\.(html|svg)$',
      },
    ],
  },
  transformIgnorePatterns: ['node_modules/(?!.*\\.mjs$)'],
  snapshotSerializers: [
    'jest-preset-angular/build/serializers/no-ng-attributes',
    'jest-preset-angular/build/serializers/ng-snapshot',
    'jest-preset-angular/build/serializers/html-comment',
  ],
};
