import type { JestConfigWithTsJest } from 'ts-jest';

module.exports = {
  displayName: 'nx-aws-cdk-v2',
  preset: '../../../jest.preset.cjs',
  testEnvironment: 'node',
  coverageDirectory: '../../../coverage/libs/public/nx-aws-cdk-v2',
} as JestConfigWithTsJest;
