import type { JestConfigWithTsJest } from 'ts-jest';

module.exports = {
  displayName: 'angular-examples',
  setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
  coverageDirectory: '../../coverage/apps/angular-examples',

  transform: {
    '^.+\\.(ts|mjs|js|html)$': [
      'jest-preset-angular',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
        stringifyContentPathRegex: '\\.(html|svg)$',
      },
    ],
  },
  // @angular-architects/native-federation re-exports the runtime as plain
  // ESM from a .js file, so it has to go through the transform as well.
  transformIgnorePatterns: [
    'node_modules/(?!.*.mjs$|@datorama/akita|@angular-architects/native-federation|@softarc/native-federation-runtime)',
  ],
  snapshotSerializers: [
    'jest-preset-angular/build/serializers/no-ng-attributes',
    'jest-preset-angular/build/serializers/ng-snapshot',
    'jest-preset-angular/build/serializers/html-comment',
  ],
  preset: '../../jest.preset.cjs',
  testEnvironment: 'jsdom',
} satisfies JestConfigWithTsJest;
