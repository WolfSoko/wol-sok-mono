import type { JestConfigWithTsJest } from 'ts-jest';

export default {
  displayName: 'angular-examples',
  setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
  globals: {
    VERSION: 'v1.2.3',
  },
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
  transformIgnorePatterns: ['node_modules/(?!.*.mjs$|@datorama/akita)'],
  snapshotSerializers: [
    'jest-preset-angular/build/serializers/no-ng-attributes',
    'jest-preset-angular/build/serializers/ng-snapshot',
    'jest-preset-angular/build/serializers/html-comment',
  ],
  preset: '../../jest.preset.cjs',
  testEnvironment: 'jsdom',
} satisfies JestConfigWithTsJest;
